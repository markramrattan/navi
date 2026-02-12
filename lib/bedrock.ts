import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const region = process.env.AWS_REGION || "us-east-1";
const modelId = process.env.BEDROCK_MODEL_ID || "amazon.nova-2-lite-v1:0";

const client = new BedrockRuntimeClient({ region });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are Navi, a friendly Personal Life Admin assistant. You help users manage everyday tasks like:
- Scheduling appointments and calendar events
- Setting reminders
- Organizing documents and important information

Be helpful, concise, and conversational. If a user asks for something you can't do yet (like actually creating calendar events), acknowledge it warmly and suggest what they could do manually, or note that these features are coming soon.`;

export async function chat(messages: ChatMessage[]): Promise<string> {
  const formattedMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: [{ text: m.content }],
  }));

  const response = await client.send(
    new ConverseCommand({
      modelId,
      messages: formattedMessages,
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.7,
      },
    })
  );

  const output = response.output;
  if (!output || !("message" in output)) {
    throw new Error("Invalid response from Bedrock");
  }

  const content = output.message.content;
  if (!content || content.length === 0) {
    return "";
  }

  const textBlock = content.find((block) => "text" in block && block.text);
  return textBlock && "text" in textBlock ? textBlock.text : "";
}
