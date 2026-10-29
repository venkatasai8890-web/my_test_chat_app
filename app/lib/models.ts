export interface GeminiModelOption {
  id: string;
  label: string;
}

// Text-chat-capable Gemini models supported by the installed @google/genai SDK.
// Image, audio (lyria), and robotics models are intentionally excluded.
export const GEMINI_MODELS: GeminiModelOption[] = [
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)" },
];

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;

export function isSupportedGeminiModel(model: unknown): model is string {
  return (
    typeof model === "string" &&
    GEMINI_MODELS.some((m) => m.id === model)
  );
}
