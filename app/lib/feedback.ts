export type FeedbackValue = "like" | "dislike" | "none";

export interface FeedbackEntry {
  conversationId: string;
  messageId: string;
  model: string;
  feedback: FeedbackValue;
  content: string;
}

export function isFeedbackValue(value: unknown): value is FeedbackValue {
  return value === "like" || value === "dislike" || value === "none";
}

export const FEEDBACK_CSV_HEADER =
  "timestamp,conversationId,messageId,model,feedback,content\n";

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function toFeedbackCsvRow(entry: FeedbackEntry, timestamp: string): string {
  return (
    [
      csvEscape(timestamp),
      csvEscape(entry.conversationId),
      csvEscape(entry.messageId),
      csvEscape(entry.model),
      csvEscape(entry.feedback),
      csvEscape(entry.content),
    ].join(",") + "\n"
  );
}
