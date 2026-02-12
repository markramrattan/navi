import { NextRequest, NextResponse } from "next/server";
import { chat, ChatMessage } from "@/lib/bedrock";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const response = await chat(messages);
    return NextResponse.json({ message: response });
  } catch (err) {
    console.error("Chat API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to get response: ${message}` },
      { status: 500 }
    );
  }
}
