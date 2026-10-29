# chat-app RAG service

A small FastAPI microservice used only by `my_test_chat_app`'s Next.js server —
it is never called directly from the browser. It wraps the same LangChain +
Pinecone + OpenAI-embeddings approach already validated in
`~/Pinecone_RAG_homework`, adapted to handle multiple uploaded files with
per-conversation isolation via Pinecone namespaces. It only handles chunking,
embedding, and retrieval; final answer generation happens in the Next.js app
with Gemini.

## Setup

1. Create a venv and install dependencies:
   ```bash
   cd rag-service
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and fill in `PINECONE_API_KEY` and
   `OPENAI_API_KEY` with your own keys (do not copy `.env` from
   `Pinecone_RAG_homework`).
3. Set `RAG_SERVICE_TOKEN` in `.env` to match the value configured in
   `my_test_chat_app/.env.local`.
4. Optional, for Qdrant: set `QDRANT_URL`, `QDRANT_API_KEY`, and
   `QDRANT_COLLECTION_NAME` (default `chat-app-rag`). Without them the service
   runs with Pinecone only.

## Run

```bash
cd rag-service
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Binds to `127.0.0.1` only — nothing outside this machine can reach it, and
only the Next.js server is meant to call it.

## Endpoints

- `POST /ingest` — multipart `file` + `namespace` form fields, plus optional
  `vector_db` (`pinecone` default, or `qdrant`). Loads the file (PDF via
  `PyPDFLoader`, `.txt`/`.md` via `TextLoader`), splits it with
  `RecursiveCharacterTextSplitter`, and embeds with OpenAI
  `text-embedding-3-small`. Pinecone: upserts into the `PINECONE_INDEX_NAME`
  index under that namespace. Qdrant: upserts into `QDRANT_COLLECTION_NAME`
  with `text`, `source`, `page_number`, and `conversation_id` (= namespace) in
  each point's payload.
- `POST /retrieve` — JSON `{ query, namespace, k, vector_db }`. Returns the
  top-k chunks with `source`/`page_number` metadata for that namespace
  (Qdrant: filtered by `conversation_id`).
- `GET /health` — liveness check, no auth required.

`/ingest` and `/retrieve` require an `X-RAG-Service-Token` header matching
`RAG_SERVICE_TOKEN`.

The Pinecone index (`chat-app-rag` by default) is separate from
`Pinecone_RAG_homework`'s `apple-10k-rag` index and is created automatically
on first startup if it doesn't already exist.

## Qdrant

Qdrant support uses the raw `qdrant-client` (no `langchain-qdrant`). The
collection is shared across conversations; every point carries a
`conversation_id` payload field (keyword index, `is_tenant=True`) and every
search filters on it, so one chat never retrieves another chat's chunks.

On first Qdrant upload the service creates the collection (1536 dimensions,
cosine distance — matching `text-embedding-3-small`). If the configured
collection already exists but was not created by this service (no
`conversation_id` index and existing points), the service refuses to write to
it. This keeps vectors from other embedding models, such as
`text-embedding-ada-002` in `Qdrant_RAG_homework`, from being mixed in.
