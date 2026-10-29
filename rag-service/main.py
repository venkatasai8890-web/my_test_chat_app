"""FastAPI RAG service for my_test_chat_app.

Wraps the same LangChain + Pinecone + OpenAI-embeddings approach validated in
~/Pinecone_RAG_homework/ingest.py and rag.py, adapted for multiple uploaded
files with per-conversation isolation via Pinecone namespaces. Qdrant is an
optional second vector store (selected per request via vector_db), using the
raw qdrant-client approach from ~/Qdrant_RAG_homework/qdrant_rag.py with
per-conversation isolation via a conversation_id payload filter. Final answer
generation happens in the Next.js app with Gemini, not here — this service
only handles chunking, embedding, and retrieval.

Runs locally only (bind to 127.0.0.1) and is never called from the browser;
the Next.js server is the sole intended caller. Every endpoint requires the
X-RAG-Service-Token header to match RAG_SERVICE_TOKEN.
"""

import functools
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest_models

load_dotenv()

PINECONE_API_KEY = os.environ["PINECONE_API_KEY"]
_ = os.environ["OPENAI_API_KEY"]  # required by langchain_openai; read implicitly from env
INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "chat-app-rag")
PINECONE_CLOUD = os.environ.get("PINECONE_CLOUD", "aws")
PINECONE_REGION = os.environ.get("PINECONE_REGION", "us-east-1")
SERVICE_TOKEN = os.environ.get("RAG_SERVICE_TOKEN")

# Optional: Qdrant is only used when a request asks for vector_db="qdrant".
# If these are unset, the service still starts and Pinecone works as before.
QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
QDRANT_COLLECTION_NAME = os.environ.get("QDRANT_COLLECTION_NAME", "chat-app-rag")
QDRANT_TENANT_FIELD = "conversation_id"
QDRANT_UPSERT_BATCH_SIZE = 64

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
MAX_FILE_BYTES = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}

_pc = Pinecone(api_key=PINECONE_API_KEY)
_embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)


def _ensure_index() -> None:
    if INDEX_NAME not in [idx["name"] for idx in _pc.list_indexes()]:
        _pc.create_index(
            name=INDEX_NAME,
            dimension=EMBEDDING_DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
        )
    while not _pc.describe_index(INDEX_NAME).status["ready"]:
        pass


@functools.cache
def _qdrant_client() -> QdrantClient:
    if not QDRANT_URL or not QDRANT_API_KEY:
        raise HTTPException(503, "Qdrant is not configured on the RAG service")
    return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60)


def _ensure_qdrant_collection(client: QdrantClient) -> None:
    """Create the collection if missing; refuse to write to one this service didn't create.

    A collection created here always has a conversation_id payload index. An
    existing collection without it (e.g. a homework collection with the same
    vector size) is never written to, so its data can't be mixed with ours.
    """
    if not client.collection_exists(QDRANT_COLLECTION_NAME):
        client.create_collection(
            collection_name=QDRANT_COLLECTION_NAME,
            vectors_config=rest_models.VectorParams(
                size=EMBEDDING_DIMENSION,
                distance=rest_models.Distance.COSINE,
            ),
        )

    info = client.get_collection(QDRANT_COLLECTION_NAME)
    vectors = info.config.params.vectors
    if (
        not isinstance(vectors, rest_models.VectorParams)
        or vectors.size != EMBEDDING_DIMENSION
        or vectors.distance != rest_models.Distance.COSINE
    ):
        raise HTTPException(
            500,
            f"Qdrant collection '{QDRANT_COLLECTION_NAME}' has an incompatible vector config",
        )

    if QDRANT_TENANT_FIELD not in (info.payload_schema or {}):
        if info.points_count:
            raise HTTPException(
                500,
                f"Qdrant collection '{QDRANT_COLLECTION_NAME}' already contains data not "
                "created by this service; set QDRANT_COLLECTION_NAME to a dedicated collection",
            )
        client.create_payload_index(
            collection_name=QDRANT_COLLECTION_NAME,
            field_name=QDRANT_TENANT_FIELD,
            field_schema=rest_models.KeywordIndexParams(
                type=rest_models.KeywordIndexType.KEYWORD,
                is_tenant=True,
            ),
            wait=True,
        )


def _conversation_filter(namespace: str) -> rest_models.Filter:
    return rest_models.Filter(
        must=[
            rest_models.FieldCondition(
                key=QDRANT_TENANT_FIELD,
                match=rest_models.MatchValue(value=namespace),
            )
        ]
    )


def _qdrant_ingest(chunks, namespace: str) -> None:
    client = _qdrant_client()
    _ensure_qdrant_collection(client)

    vectors = _embeddings.embed_documents([chunk.page_content for chunk in chunks])
    points = [
        rest_models.PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "text": chunk.page_content,
                "source": chunk.metadata.get("source"),
                "page_number": chunk.metadata.get("page_number"),
                QDRANT_TENANT_FIELD: namespace,
            },
        )
        for chunk, vector in zip(chunks, vectors)
    ]
    for start in range(0, len(points), QDRANT_UPSERT_BATCH_SIZE):
        client.upsert(
            collection_name=QDRANT_COLLECTION_NAME,
            points=points[start : start + QDRANT_UPSERT_BATCH_SIZE],
            wait=True,
        )


def _qdrant_retrieve(query: str, namespace: str, k: int) -> list[dict]:
    client = _qdrant_client()
    if not client.collection_exists(QDRANT_COLLECTION_NAME):
        return []

    results = client.query_points(
        collection_name=QDRANT_COLLECTION_NAME,
        query=_embeddings.embed_query(query),
        query_filter=_conversation_filter(namespace),
        limit=k,
        with_payload=True,
    ).points
    return [
        {
            "content": point.payload.get("text", ""),
            "source": point.payload.get("source"),
            "page_number": point.payload.get("page_number"),
        }
        for point in results
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_index()
    yield


app = FastAPI(title="chat-app RAG service", lifespan=lifespan)


def _require_auth(token: Optional[str]) -> None:
    if not SERVICE_TOKEN:
        raise HTTPException(500, "RAG_SERVICE_TOKEN is not configured on the server")
    if token != SERVICE_TOKEN:
        raise HTTPException(401, "Invalid or missing service token")


def _load_and_split(path: Path, suffix: str, original_name: str):
    if suffix == ".pdf":
        loader = PyPDFLoader(str(path))
    else:
        loader = TextLoader(str(path), encoding="utf-8")

    docs = loader.load()
    for doc in docs:
        doc.metadata["source"] = original_name
        if "page" in doc.metadata:
            doc.metadata["page_number"] = doc.metadata["page"] + 1

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    return splitter.split_documents(docs)


VectorDb = Literal["pinecone", "qdrant"]


class RetrieveRequest(BaseModel):
    query: str
    namespace: str
    k: int = 6
    vector_db: VectorDb = "pinecone"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(
    namespace: str = Form(...),
    file: UploadFile = File(...),
    vector_db: VectorDb = Form("pinecone"),
    x_rag_service_token: Optional[str] = Header(default=None, alias="X-RAG-Service-Token"),
):
    _require_auth(x_rag_service_token)

    original_name = file.filename or "upload"
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400, f"Unsupported file type '{suffix}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
        )

    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(400, f"File exceeds {MAX_FILE_BYTES // (1024 * 1024)}MB limit")
    if not namespace.strip():
        raise HTTPException(400, "namespace is required")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp) / f"upload{suffix}"
        tmp_path.write_bytes(data)
        chunks = _load_and_split(tmp_path, suffix, original_name)

    if not chunks:
        raise HTTPException(400, "No extractable text found in file")

    if vector_db == "qdrant":
        _qdrant_ingest(chunks, namespace)
    else:
        vectorstore = PineconeVectorStore(
            index_name=INDEX_NAME, embedding=_embeddings, namespace=namespace
        )
        vectorstore.add_documents(chunks)

    return {
        "chunks": len(chunks),
        "namespace": namespace,
        "filename": original_name,
        "vector_db": vector_db,
    }


@app.post("/retrieve")
async def retrieve(
    body: RetrieveRequest,
    x_rag_service_token: Optional[str] = Header(default=None, alias="X-RAG-Service-Token"),
):
    _require_auth(x_rag_service_token)

    if not body.namespace.strip():
        raise HTTPException(400, "namespace is required")

    if body.vector_db == "qdrant":
        return {"chunks": _qdrant_retrieve(body.query, body.namespace, body.k)}

    vectorstore = PineconeVectorStore(
        index_name=INDEX_NAME, embedding=_embeddings, namespace=body.namespace
    )
    docs = vectorstore.similarity_search(body.query, k=body.k)

    return {
        "chunks": [
            {
                "content": doc.page_content,
                "source": doc.metadata.get("source"),
                "page_number": doc.metadata.get("page_number"),
            }
            for doc in docs
        ]
    }
