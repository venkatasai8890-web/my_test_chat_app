export interface ChatSettings {
  model: string;
  temperature: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequence: string;
  seed?: number;
}

export const DEFAULT_SETTINGS: ChatSettings = {
  model: "gemini-3-flash-preview",
  temperature: 0.5,
  topK: undefined,
  topP: undefined,
  maxOutputTokens: undefined,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequence: "",
  seed: undefined,
};

export const MODEL_OPTIONS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
];

export const PARAM_INFO: Record<
  keyof Omit<ChatSettings, "model" | "stopSequence">,
  { label: string; description: string }
> = {
  temperature: {
    label: "Temperature",
    description:
      "Controls randomness of the output. Lower values (near 0) make responses more focused and predictable; higher values (up to 2) make them more creative and varied.",
  },
  topK: {
    label: "Top K",
    description:
      "Limits token selection to the K most probable next tokens at each step. Lower values produce more focused, less random text.",
  },
  topP: {
    label: "Top P",
    description:
      "Nucleus sampling: only considers tokens whose cumulative probability reaches P. Lower values narrow the choices to the most likely tokens. Typically adjust either temperature or Top P, not both.",
  },
  maxOutputTokens: {
    label: "Output Tokens",
    description:
      "Maximum number of tokens the model can generate in its response. A token is roughly four characters.",
  },
  frequencyPenalty: {
    label: "Frequency Penalty",
    description:
      "Penalizes tokens based on how often they've already appeared in the generated text. Positive values reduce repetition of words and phrases.",
  },
  presencePenalty: {
    label: "Presence Penalty",
    description:
      "Penalizes tokens that have appeared at all in the generated text so far. Positive values encourage the model to introduce new topics/words.",
  },
  seed: {
    label: "Seed",
    description:
      "Fixes the random seed used during generation so repeated requests with the same prompt and parameters tend to produce the same response. Leave blank for a random seed each time.",
  },
};

export const STOP_SEQUENCE_INFO = {
  label: "Stop Sequence",
  description:
    "A character sequence that tells the model to stop generating further output as soon as it's produced. Useful for controlling response length or structure.",
};
