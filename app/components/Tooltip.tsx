"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";

export default function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-describedby={tooltipId}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-gray-400 hover:text-gray-600 focus:outline-none"
      >
        <HelpCircle size={14} />
      </button>
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg z-10"
        >
          {text}
        </span>
      )}
    </span>
  );
}
