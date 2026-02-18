import { NextRequest, NextResponse } from "next/server";
import { chat, ChatMessage } from "@/lib/bedrock";

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 8000;

function validateMessages(messages: unknown): messages is ChatMessage[] {
  if (!messages || !Array.isArray(messages)) return false;
  if (messages.length > MAX_MESSAGES) return false;
  return messages.every(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      "role" in m &&
      (m.role === "user" || m.role === "assistant") &&
      "content" in m &&
      typeof (m as ChatMessage).content === "string" &&
      (m as ChatMessage).content.length <= MAX_MESSAGE_LENGTH
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { messages } = (body && typeof body === "object" && "messages" in body)
      ? (body as { messages: unknown })
      : { messages: undefined };

    if (!validateMessages(messages)) {
      return NextResponse.json(
        {
          error:
            "messages array is required, must be an array of {role, content}, max 50 messages, each content max 8000 chars",
        },
        { status: 400 }
      );
    }

    const response = await chat(messages);
    return NextResponse.json({ message: response });
  } catch (err) {
    console.error("Chat API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Throttling") || message.includes("rate") ? 429 : 500;
    return NextResponse.json(
      { error: `Failed to get response: ${message}` },
      { status }
    );
  }
}
