"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Smile, ThumbsUp, ThumbsDown } from "lucide-react";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢"];

interface MessageActionsProps {
  content: string;
}

export default function MessageActions({ content }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const reactionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reactionOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) {
        setReactionOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [reactionOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  const toggleReaction = (emoji: string) => {
    setReaction((prev) => (prev === emoji ? null : emoji));
    setReactionOpen(false);
  };

  const toggleFeedback = (type: "like" | "dislike") => {
    setFeedback((prev) => (prev === type ? null : type));
  };

  const feedbackMessage =
    feedback === "like"
      ? "Thanks for your feedback!"
      : feedback === "dislike"
      ? "Thanks for your feedback. We'll use it to improve responses."
      : null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleCopy}
          title="Copy"
          aria-label="Copy response"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
        </button>

        <div className="relative" ref={reactionRef}>
          <button
            type="button"
            onClick={() => setReactionOpen((prev) => !prev)}
            title="React"
            aria-label="React to response"
            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
              reaction ? "text-blue-600" : "text-gray-500"
            }`}
          >
            {reaction ? (
              <span className="text-base leading-none">{reaction}</span>
            ) : (
              <Smile size={16} />
            )}
          </button>

          {reactionOpen && (
            <div className="absolute left-0 top-full mt-1 flex gap-1 bg-white border border-gray-200 rounded-full shadow-md px-2 py-1 z-10">
              {REACTIONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={`text-base p-1 rounded-full hover:bg-gray-100 transition-colors ${
                    reaction === emoji ? "bg-blue-100" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => toggleFeedback("like")}
          title="Like"
          aria-label="Like response"
          aria-pressed={feedback === "like"}
          className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
            feedback === "like" ? "text-blue-600 bg-blue-50" : "text-gray-500"
          }`}
        >
          <ThumbsUp size={16} fill={feedback === "like" ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          onClick={() => toggleFeedback("dislike")}
          title="Dislike"
          aria-label="Dislike response"
          aria-pressed={feedback === "dislike"}
          className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
            feedback === "dislike" ? "text-red-600 bg-red-50" : "text-gray-500"
          }`}
        >
          <ThumbsDown size={16} fill={feedback === "dislike" ? "currentColor" : "none"} />
        </button>
      </div>

      {feedbackMessage && (
        <p className="text-xs text-gray-500 mt-1">{feedbackMessage}</p>
      )}
    </div>
  );
}
