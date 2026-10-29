import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_GEMINI_MODEL, isSupportedGeminiModel } from "@/app/lib/models";
import { clampGenerationSettings, toGenerateContentConfig } from "@/app/lib/settings";
import { parseVectorDb, retrieveChunks } from "@/app/lib/rag";

export const runtime = "nodejs";

function buildRagSystemInstruction(chunks: { content: string; source: string | null; page_number: number | null }[]): string {
  const excerpts = chunks
    .map((c, i) => {
      const label = [c.source, c.page_number ? `page ${c.page_number}` : null]
        .filter(Boolean)
        .join(", ");
      return `[Excerpt ${i + 1}${label ? ` — ${label}` : ""}]\n${c.content}`;
    })
    .join("\n\n");

  return (
    "You are answering the user's question using excerpts from a document " +
    "they uploaded. Use only these excerpts to answer; if the answer isn't " +
    "contained in them, say so clearly. Cite page numbers when available.\n\n" +
    `Excerpts:\n${excerpts}`
  );
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model, settings, conversationId, vectorDb } =
      await request.json();
    const selectedModel = isSupportedGeminiModel(model)
      ? model
      : DEFAULT_GEMINI_MODEL;
    const generationSettings = clampGenerationSettings(settings);

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Convert chat messages to Gemini format
    const contents = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })
    );

    // If the conversation has an attached, successfully-ingested document,
    // retrieve relevant chunks and inject them as a system instruction.
    // Retrieval failures (e.g. rag-service not running) never break chat —
    // we log and fall back to a normal, context-free response.
    let ragSystemInstruction: string | undefined;
    if (typeof conversationId === "string" && conversationId.trim()) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m: { role: string; content: string }) => m.role === "user");
      const selectedVectorDb = parseVectorDb(vectorDb);
      if (lastUserMessage && selectedVectorDb) {
        try {
          const chunks = await retrieveChunks(
            lastUserMessage.content,
            conversationId,
            undefined,
            selectedVectorDb
          );
          if (chunks.length > 0) {
            ragSystemInstruction = buildRagSystemInstruction(chunks);
          }
        } catch (error) {
          console.error("RAG retrieval failed, continuing without context:", error);
        }
      }
    }

    const config = {
      ...toGenerateContentConfig(generationSettings),
      ...(ragSystemInstruction
        ? { systemInstruction: ragSystemInstruction }
        : {}),
    };

    // Gemini occasionally returns transient 429 (rate limit) or 503 (overloaded)
    // errors; retry those specifically with a short increasing backoff before
    // giving up. Any other error is rethrown immediately, unretried.
    const RETRYABLE_STATUS_CODES = new Set([429, 503]);
    const MAX_GEMINI_RETRIES = 2;
    const RETRY_DELAYS_MS = [1000, 2000];

    async function generateContentWithRetry() {
      for (let attempt = 0; ; attempt++) {
        try {
          return await ai.models.generateContent({
            model: selectedModel,
            contents,
            config,
          });
        } catch (error) {
          const status = (error as { status?: number })?.status;
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            `Gemini generateContent failed (attempt ${attempt + 1}/${MAX_GEMINI_RETRIES + 1}): status=${status ?? "unknown"} message=${message}`
          );

          const isRetryable =
            typeof status === "number" && RETRYABLE_STATUS_CODES.has(status);
          if (!isRetryable || attempt >= MAX_GEMINI_RETRIES) {
            throw error;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAYS_MS[attempt])
          );
        }
      }
    }

    const response = await generateContentWithRetry();

    const text =
      response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated";

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
