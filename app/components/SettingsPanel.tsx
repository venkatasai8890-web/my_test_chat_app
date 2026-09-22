"use client";

import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import {
  DEFAULT_GENERATION_SETTINGS,
  GenerationSettings,
  SETTINGS_RANGES,
} from "@/app/lib/settings";

interface SettingsPanelProps {
  open: boolean;
  initialSettings: GenerationSettings;
  onSave: (settings: GenerationSettings) => void;
  onClose: () => void;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info size={14} className="text-gray-400 hover:text-gray-600 cursor-help" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function FieldLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
      {label}
      <InfoTooltip text={tooltip} />
    </span>
  );
}

export default function SettingsPanel({
  open,
  initialSettings,
  onSave,
  onClose,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<GenerationSettings>(initialSettings);

  useEffect(() => {
    if (open) setDraft(initialSettings);
  }, [open, initialSettings]);

  if (!open) return null;

  const update = <K extends keyof GenerationSettings>(
    key: K,
    value: GenerationSettings[K]
  ) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">Generation Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel
                label="Temperature"
                tooltip="Controls randomness. Lower values (near 0) make output more focused and deterministic; higher values (up to 2) make it more creative and varied."
              />
              <span className="text-sm text-gray-500 tabular-nums">{draft.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={SETTINGS_RANGES.temperature.min}
              max={SETTINGS_RANGES.temperature.max}
              step={SETTINGS_RANGES.temperature.step}
              value={draft.temperature}
              onChange={(e) => update("temperature", Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Top P */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel
                label="Top P"
                tooltip="Nucleus sampling: only considers tokens whose cumulative probability adds up to this value. Lower values narrow the choices to the most likely tokens."
              />
              <span className="text-sm text-gray-500 tabular-nums">{draft.topP.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={SETTINGS_RANGES.topP.min}
              max={SETTINGS_RANGES.topP.max}
              step={SETTINGS_RANGES.topP.step}
              value={draft.topP}
              onChange={(e) => update("topP", Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Top K */}
          <div className="flex items-center justify-between">
            <FieldLabel
              label="Top K"
              tooltip="Limits token selection to the K most likely next tokens at each step. Lower values produce more predictable text. Must be 1 or higher."
            />
            <input
              type="number"
              min={1}
              step={1}
              value={draft.topK}
              onChange={(e) => update("topK", Number(e.target.value))}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Output Tokens */}
          <div className="flex items-center justify-between">
            <FieldLabel
              label="Output Tokens"
              tooltip="Maximum number of tokens the model can generate in its response. Must be a positive integer."
            />
            <input
              type="number"
              min={1}
              step={1}
              value={draft.maxOutputTokens}
              onChange={(e) => update("maxOutputTokens", Number(e.target.value))}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Frequency Penalty */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel
                label="Frequency Penalty"
                tooltip="Positive values discourage the model from repeating the same tokens, encouraging more varied word choice. Negative values encourage repetition."
              />
              <span className="text-sm text-gray-500 tabular-nums">{draft.frequencyPenalty.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={SETTINGS_RANGES.frequencyPenalty.min}
              max={SETTINGS_RANGES.frequencyPenalty.max}
              step={SETTINGS_RANGES.frequencyPenalty.step}
              value={draft.frequencyPenalty}
              onChange={(e) => update("frequencyPenalty", Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Presence Penalty */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel
                label="Presence Penalty"
                tooltip="Positive values encourage the model to talk about new topics it hasn't mentioned yet in the response. Negative values encourage staying on topics already mentioned."
              />
              <span className="text-sm text-gray-500 tabular-nums">{draft.presencePenalty.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={SETTINGS_RANGES.presencePenalty.min}
              max={SETTINGS_RANGES.presencePenalty.max}
              step={SETTINGS_RANGES.presencePenalty.step}
              value={draft.presencePenalty}
              onChange={(e) => update("presencePenalty", Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Stop Sequence */}
          <div>
            <div className="mb-1.5">
              <FieldLabel
                label="Stop Sequence"
                tooltip="If the model generates this exact text, it will stop generating further output. Leave blank for no stop sequence."
              />
            </div>
            <input
              type="text"
              value={draft.stopSequence}
              onChange={(e) => update("stopSequence", e.target.value)}
              placeholder="e.g. END"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Seed */}
          <div className="flex items-center justify-between">
            <FieldLabel
              label="Seed"
              tooltip="Fixes the random seed so repeated requests with the same settings tend to produce the same output. Leave blank for a random seed each time."
            />
            <input
              type="number"
              step={1}
              value={draft.seed ?? ""}
              onChange={(e) =>
                update("seed", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="random"
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={() => setDraft(DEFAULT_GENERATION_SETTINGS)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onSave(draft)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
