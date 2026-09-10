import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { ChatSettings, DEFAULT_SETTINGS } from "../../lib/chatSettings";

export const runtime = "nodejs";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function buildGenerationConfig(settings: Partial<ChatSettings> | undefined) {
  const s = { ...DEFAULT_SETTINGS, ...settings };

  return {
    temperature: clamp(s.temperature, 0, 2),
    topK:
      s.topK !== undefined && s.topK !== null
        ? Math.max(1, Math.round(s.topK))
        : undefined,
    topP: s.topP !== undefined && s.topP !== null ? clamp(s.topP, 0, 1) : undefined,
    maxOutputTokens:
      s.maxOutputTokens !== undefined && s.maxOutputTokens !== null
        ? Math.max(1, Math.round(s.maxOutputTokens))
        : undefined,
    frequencyPenalty: clamp(s.frequencyPenalty, -2, 2),
    presencePenalty: clamp(s.presencePenalty, -2, 2),
    stopSequences: s.stopSequence ? [s.stopSequence] : undefined,
    seed: s.seed !== undefined && s.seed !== null ? Math.round(s.seed) : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { messages, settings } = await request.json();

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

    const model = settings?.model || DEFAULT_SETTINGS.model;
    const config = buildGenerationConfig(settings);

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

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
