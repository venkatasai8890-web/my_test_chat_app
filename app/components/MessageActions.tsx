"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Copy, Check } from "lucide-react";

export type MessageFeedback = "like" | "dislike" | null;

interface MessageActionsProps {
  content: string;
  feedback: MessageFeedback;
  onToggleLike: () => void;
  onToggleDislike: () => void;
}

export default function MessageActions({
  content,
  feedback,
  onToggleLike,
  onToggleDislike,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const baseBtn =
    "p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-700 hover:bg-gray-100";

  return (
    <div className="flex items-center gap-1 mt-1.5">
      <button
        type="button"
        onClick={onToggleLike}
        aria-pressed={feedback === "like"}
        aria-label="Like this response"
        title="Like"
        className={`${baseBtn} ${
          feedback === "like" ? "text-blue-600 hover:text-blue-600 bg-blue-50 hover:bg-blue-50" : ""
        }`}
      >
        <ThumbsUp size={14} fill={feedback === "like" ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={onToggleDislike}
        aria-pressed={feedback === "dislike"}
        aria-label="Dislike this response"
        title="Dislike"
        className={`${baseBtn} ${
          feedback === "dislike" ? "text-red-600 hover:text-red-600 bg-red-50 hover:bg-red-50" : ""
        }`}
      >
        <ThumbsDown size={14} fill={feedback === "dislike" ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy response"
        title="Copy"
        className={baseBtn}
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      </button>
      {copied && <span className="text-xs text-gray-500">Copied</span>}
    </div>
  );
}
