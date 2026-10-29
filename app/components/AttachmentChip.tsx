"use client";

import { FileText, Loader2, X, AlertCircle } from "lucide-react";

export type AttachmentStatus = "uploading" | "ready" | "error";

export type VectorDb = "pinecone" | "qdrant";

export interface AttachmentState {
  filename: string;
  status: AttachmentStatus;
  // The vector store this document was indexed into; chat retrieves from it.
  vectorDb: VectorDb;
  error?: string;
}

interface AttachmentChipProps {
  attachment: AttachmentState;
  onRemove: () => void;
}

export default function AttachmentChip({ attachment, onRemove }: AttachmentChipProps) {
  const isError = attachment.status === "error";

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
        isError
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-blue-50 border-blue-200 text-blue-700"
      }`}
      title={isError ? attachment.error : undefined}
    >
      {attachment.status === "uploading" && (
        <Loader2 size={14} className="animate-spin" />
      )}
      {isError && <AlertCircle size={14} />}
      {attachment.status === "ready" && <FileText size={14} />}

      <span className="max-w-[220px] truncate">
        {attachment.status === "uploading" && "Indexing "}
        {isError && "Failed: "}
        {attachment.filename}
      </span>
      {attachment.status === "ready" && (
        <span className="text-xs opacity-70">
          · {attachment.vectorDb === "qdrant" ? "Qdrant" : "Pinecone"}
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="hover:opacity-70 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
}
