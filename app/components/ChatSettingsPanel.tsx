"use client";

import { X } from "lucide-react";
import Tooltip from "./Tooltip";
import {
  ChatSettings,
  DEFAULT_SETTINGS,
  MODEL_OPTIONS,
  PARAM_INFO,
  STOP_SEQUENCE_INFO,
} from "../lib/chatSettings";

interface ChatSettingsPanelProps {
  settings: ChatSettings;
  onChange: (settings: ChatSettings) => void;
  onClose: () => void;
}

function Field({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium text-gray-800">{label}</label>
        <Tooltip text={tooltip} />
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export default function ChatSettingsPanel({
  settings,
  onChange,
  onClose,
}: ChatSettingsPanelProps) {
  const update = <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  const parseOptionalNumber = (raw: string) =>
    raw === "" ? undefined : Number(raw);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Chat settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <Field
            label="Model"
            tooltip="The Gemini model used to generate responses. Different models trade off speed, cost, and capability."
          >
            <select
              value={settings.model}
              onChange={(e) => update("model", e.target.value)}
              className={inputClass}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </Field>

          <Field label={PARAM_INFO.temperature.label} tooltip={PARAM_INFO.temperature.description}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature}
                onChange={(e) => update("temperature", Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-sm text-gray-700 text-right">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
          </Field>

          <Field label={PARAM_INFO.topK.label} tooltip={PARAM_INFO.topK.description}>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Model default"
              value={settings.topK ?? ""}
              onChange={(e) =>
                update("topK", parseOptionalNumber(e.target.value))
              }
              className={inputClass}
            />
          </Field>

          <Field label={PARAM_INFO.topP.label} tooltip={PARAM_INFO.topP.description}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.topP ?? 1}
                onChange={(e) => update("topP", Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-sm text-gray-700 text-right">
                {(settings.topP ?? 1).toFixed(2)}
              </span>
            </div>
          </Field>

          <Field
            label={PARAM_INFO.maxOutputTokens.label}
            tooltip={PARAM_INFO.maxOutputTokens.description}
          >
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Model default"
              value={settings.maxOutputTokens ?? ""}
              onChange={(e) =>
                update("maxOutputTokens", parseOptionalNumber(e.target.value))
              }
              className={inputClass}
            />
          </Field>

          <Field
            label={PARAM_INFO.frequencyPenalty.label}
            tooltip={PARAM_INFO.frequencyPenalty.description}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={settings.frequencyPenalty}
                onChange={(e) =>
                  update("frequencyPenalty", Number(e.target.value))
                }
                className="flex-1"
              />
              <span className="w-10 text-sm text-gray-700 text-right">
                {settings.frequencyPenalty.toFixed(1)}
              </span>
            </div>
          </Field>

          <Field
            label={PARAM_INFO.presencePenalty.label}
            tooltip={PARAM_INFO.presencePenalty.description}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={settings.presencePenalty}
                onChange={(e) =>
                  update("presencePenalty", Number(e.target.value))
                }
                className="flex-1"
              />
              <span className="w-10 text-sm text-gray-700 text-right">
                {settings.presencePenalty.toFixed(1)}
              </span>
            </div>
          </Field>

          <Field label={STOP_SEQUENCE_INFO.label} tooltip={STOP_SEQUENCE_INFO.description}>
            <input
              type="text"
              placeholder="e.g. \n or ###"
              value={settings.stopSequence}
              onChange={(e) => update("stopSequence", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label={PARAM_INFO.seed.label} tooltip={PARAM_INFO.seed.description}>
            <input
              type="number"
              step={1}
              placeholder="Random"
              value={settings.seed ?? ""}
              onChange={(e) =>
                update("seed", parseOptionalNumber(e.target.value))
              }
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4">
          <button
            onClick={() => onChange(DEFAULT_SETTINGS)}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
