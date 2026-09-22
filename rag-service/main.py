"""FastAPI RAG service for my_test_chat_app.

Wraps the same LangChain + Pinecone + OpenAI-embeddings approach validated in
~/Pinecone_RAG_homework/ingest.py and rag.py, adapted for multiple uploaded
files with per-conversation isolation via Pinecone namespaces. Final answer
generation happens in the Next.js app with Gemini, not here — this service
only handles chunking, embedding, and retrieval.

Runs locally only (bind to 127.0.0.1) and is never called from the browser;
the Next.js server is the sole intended caller. Every endpoint requires the
X-RAG-Service-Token header to match RAG_SERVICE_TOKEN.
"""

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec
from pydantic import BaseModel

load_dotenv()

PINECONE_API_KEY = os.environ["PINECONE_API_KEY"]
_ = os.environ["OPENAI_API_KEY"]  # required by langchain_openai; read implicitly from env
INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "chat-app-rag")
PINECONE_CLOUD = os.environ.get("PINECONE_CLOUD", "aws")
PINECONE_REGION = os.environ.get("PINECONE_REGION", "us-east-1")
SERVICE_TOKEN = os.environ.get("RAG_SERVICE_TOKEN")

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


class RetrieveRequest(BaseModel):
    query: str
    namespace: str
    k: int = 6


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(
    namespace: str = Form(...),
    file: UploadFile = File(...),
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

    vectorstore = PineconeVectorStore(
        index_name=INDEX_NAME, embedding=_embeddings, namespace=namespace
    )
    vectorstore.add_documents(chunks)

    return {"chunks": len(chunks), "namespace": namespace, "filename": original_name}


@app.post("/retrieve")
async def retrieve(
    body: RetrieveRequest,
    x_rag_service_token: Optional[str] = Header(default=None, alias="X-RAG-Service-Token"),
):
    _require_auth(x_rag_service_token)

    if not body.namespace.strip():
        raise HTTPException(400, "namespace is required")

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
