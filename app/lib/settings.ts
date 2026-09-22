// Generation settings for Gemini requests.
// Every field here maps directly to a field on GenerateContentConfig in the
// installed @google/genai SDK (see node_modules/@google/genai/dist/genai.d.ts,
// `GenerateContentConfig`). No parameter is invented beyond what that type
// declares as supported.

export interface GenerationSettings {
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequence: string;
  seed: number | null;
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  temperature: 0.5,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequence: "",
  seed: null,
};

export interface FieldRange {
  min: number;
  max: number;
  step: number;
}

// Ranges enforced both in the UI and on the server. These mirror the ranges
// documented for the Gemini API's GenerationConfig, except where noted.
export const SETTINGS_RANGES: Record<
  "temperature" | "topP" | "frequencyPenalty" | "presencePenalty",
  FieldRange
> = {
  temperature: { min: 0, max: 2, step: 0.01 },
  topP: { min: 0, max: 1, step: 0.01 },
  frequencyPenalty: { min: -2, max: 2, step: 0.1 },
  presencePenalty: { min: -2, max: 2, step: 0.1 },
};

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

// topK and maxOutputTokens are only bounded below ("1 or higher" / "positive
// integer") by the Gemini API — there is no fixed upper bound in the SDK, so
// none is invented here. Number.MAX_SAFE_INTEGER is used purely as a finite
// ceiling to reject non-numeric/garbage input, not as an API-imposed limit.
const clampPositiveInt = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
};

const SAFE_SEED_MIN = -2147483648;
const SAFE_SEED_MAX = 2147483647;

const clampSeed = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return Math.min(SAFE_SEED_MAX, Math.max(SAFE_SEED_MIN, n));
};

export function clampGenerationSettings(
  input: Partial<GenerationSettings> | undefined | null
): GenerationSettings {
  const src = input ?? {};
  return {
    temperature: clampNumber(
      src.temperature,
      SETTINGS_RANGES.temperature.min,
      SETTINGS_RANGES.temperature.max,
      DEFAULT_GENERATION_SETTINGS.temperature
    ),
    topP: clampNumber(
      src.topP,
      SETTINGS_RANGES.topP.min,
      SETTINGS_RANGES.topP.max,
      DEFAULT_GENERATION_SETTINGS.topP
    ),
    topK: clampPositiveInt(src.topK, DEFAULT_GENERATION_SETTINGS.topK),
    maxOutputTokens: clampPositiveInt(
      src.maxOutputTokens,
      DEFAULT_GENERATION_SETTINGS.maxOutputTokens
    ),
    frequencyPenalty: clampNumber(
      src.frequencyPenalty,
      SETTINGS_RANGES.frequencyPenalty.min,
      SETTINGS_RANGES.frequencyPenalty.max,
      DEFAULT_GENERATION_SETTINGS.frequencyPenalty
    ),
    presencePenalty: clampNumber(
      src.presencePenalty,
      SETTINGS_RANGES.presencePenalty.min,
      SETTINGS_RANGES.presencePenalty.max,
      DEFAULT_GENERATION_SETTINGS.presencePenalty
    ),
    stopSequence:
      typeof src.stopSequence === "string" ? src.stopSequence.slice(0, 500) : "",
    seed: clampSeed(src.seed),
  };
}

// Converts app-level settings into the SDK's GenerateContentConfig shape.
// Unset optional fields (empty stop sequence, null seed) are omitted rather
// than sent as empty/zero values, matching the SDK's own "unset" semantics.
export function toGenerateContentConfig(settings: GenerationSettings) {
  const config: {
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stopSequences?: string[];
    seed?: number;
  } = {
    temperature: settings.temperature,
    topP: settings.topP,
    topK: settings.topK,
    maxOutputTokens: settings.maxOutputTokens,
    frequencyPenalty: settings.frequencyPenalty,
    presencePenalty: settings.presencePenalty,
  };

  if (settings.stopSequence.trim().length > 0) {
    config.stopSequences = [settings.stopSequence];
  }
  if (settings.seed !== null) {
    config.seed = settings.seed;
  }

  return config;
}
