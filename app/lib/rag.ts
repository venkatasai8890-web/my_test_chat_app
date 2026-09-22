// Server-only client for the local rag-service (see rag-service/README.md).
// Never imported by client components — only by Route Handlers.

export interface RetrievedChunk {
  content: string;
  source: string | null;
  page_number: number | null;
}

function getRagServiceConfig(): { url: string; token: string } | null {
  const url = process.env.RAG_SERVICE_URL;
  const token = process.env.RAG_SERVICE_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export function isRagServiceConfigured(): boolean {
  return getRagServiceConfig() !== null;
}

export async function ingestFile(
  file: File,
  namespace: string
): Promise<{ chunks: number; filename: string }> {
  const config = getRagServiceConfig();
  if (!config) {
    throw new Error(
      "RAG service is not configured (RAG_SERVICE_URL/RAG_SERVICE_TOKEN missing)"
    );
  }

  const form = new FormData();
  form.append("namespace", namespace);
  form.append("file", file);

  const res = await fetch(`${config.url}/ingest`, {
    method: "POST",
    headers: { "X-RAG-Service-Token": config.token },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`RAG ingest failed (${res.status}): ${detail}`);
  }

  return res.json();
}

export async function retrieveChunks(
  query: string,
  namespace: string,
  k = 6
): Promise<RetrievedChunk[]> {
  const config = getRagServiceConfig();
  if (!config) {
    throw new Error(
      "RAG service is not configured (RAG_SERVICE_URL/RAG_SERVICE_TOKEN missing)"
    );
  }

  const res = await fetch(`${config.url}/retrieve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RAG-Service-Token": config.token,
    },
    body: JSON.stringify({ query, namespace, k }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`RAG retrieve failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return Array.isArray(data.chunks) ? data.chunks : [];
}
