import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { FEEDBACK_CSV_HEADER, isFeedbackValue, toFeedbackCsvRow } from "@/app/lib/feedback";

export const runtime = "nodejs";

const FEEDBACK_CSV_PATH = path.join(process.cwd(), "feedback.csv");

export async function POST(request: NextRequest) {
  try {
    const { conversationId, messageId, model, feedback, content } = await request.json();

    if (
      typeof conversationId !== "string" ||
      typeof messageId !== "string" ||
      typeof model !== "string" ||
      typeof content !== "string" ||
      !isFeedbackValue(feedback)
    ) {
      return NextResponse.json(
        { error: "Invalid feedback payload" },
        { status: 400 }
      );
    }

    try {
      await fs.access(FEEDBACK_CSV_PATH);
    } catch {
      await fs.writeFile(FEEDBACK_CSV_PATH, FEEDBACK_CSV_HEADER, "utf8");
    }

    const row = toFeedbackCsvRow(
      { conversationId, messageId, model, feedback, content },
      new Date().toISOString()
    );
    await fs.appendFile(FEEDBACK_CSV_PATH, row, "utf8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500 }
    );
  }
}
