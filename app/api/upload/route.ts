import { NextRequest, NextResponse } from "next/server";
import { ingestFile, isRagServiceConfigured, parseVectorDb } from "@/app/lib/rag";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];

export async function POST(request: NextRequest) {
  try {
    if (!isRagServiceConfigured()) {
      return NextResponse.json(
        { error: "RAG service is not configured on the server" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const conversationId = formData.get("conversationId");
    const vectorDb = parseVectorDb(formData.get("vectorDb"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (typeof conversationId !== "string" || !conversationId.trim()) {
      return NextResponse.json(
        { error: "Missing conversationId" },
        { status: 400 }
      );
    }

    if (!vectorDb) {
      return NextResponse.json(
        { error: "Unsupported vectorDb. Allowed: pinecone, qdrant" },
        { status: 400 }
      );
    }

    const extension = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        {
          error: `Unsupported file type '${extension}'. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_FILE_BYTES / (1024 * 1024)}MB limit` },
        { status: 400 }
      );
    }

    const result = await ingestFile(file, conversationId, vectorDb);

    return NextResponse.json({
      ok: true,
      filename: result.filename,
      chunks: result.chunks,
      vectorDb,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}
