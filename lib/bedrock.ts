import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { createEvent as createAppleCalendarEvent, isConfigured as isAppleCalendarConfigured } from "@/lib/appleCalendar";

const region = process.env.AWS_REGION || "us-east-1";
const modelId =
  process.env.BEDROCK_MODEL_ID || "us.amazon.nova-2-lite-v1:0";

const client = new BedrockRuntimeClient({ region });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are Navi, a friendly Personal Life Admin assistant. You help users manage everyday tasks like:
- Scheduling appointments and calendar events
- Setting reminders
- Organizing documents and important information

When a user asks to set a reminder or add a calendar event, use the create_reminder tool. If Apple Calendar is connected, events go to iCloud (sync to iPhone) with a notification 15 min before. Use the 'calendar' parameter when they want Family vs Work (e.g. "put in my Work calendar" → calendar: "work"). Default alert is 15 min before; they can ask for different timing.
Be helpful, concise, and conversational. Use Markdown formatting (headings, bold, lists, links) in your responses for clarity.`;

const CREATE_REMINDER_TOOL = {
  toolSpec: {
    name: "create_reminder",
    description:
      "Creates a reminder for the user. Use when they want to set a reminder, schedule something, or add a calendar event. Events go to Apple Calendar with an iPhone notification 15 min before.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short title for the reminder (e.g. 'Post parcel')",
          },
          date: {
            type: "string",
            description:
              "Date in YYYY-MM-DD format, or 'today' or 'tomorrow'",
          },
          time: {
            type: "string",
            description: "Time in HH:MM format (24h or 12h with am/pm)",
          },
          notes: {
            type: "string",
            description: "Optional extra details",
          },
          calendar: {
            type: "string",
            description:
              "Which calendar to add to: 'family', 'work', 'home', or 'personal'. Use based on context (e.g. work tasks → work, family stuff → family). Omit to use default.",
          },
          alert_minutes_before: {
            type: "number",
            description:
              "Minutes before the event to send iPhone notification (default 15). Use 0 for at time of event.",
          },
        },
        required: ["title", "date", "time"],
      },
    },
  },
};

const LIST_REMINDERS_TOOL = {
  toolSpec: {
    name: "list_reminders",
    description:
      "Lists all reminders the user has created in this session. Use when the user asks what reminders they have.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          _placeholder: { type: "string", description: "Unused" },
        },
      },
    },
  },
};

const TOOL_CONFIG = {
  tools: [CREATE_REMINDER_TOOL, LIST_REMINDERS_TOOL],
};

// In-memory reminder store (per server instance; resets on restart)
const reminders: Array<{
  title: string;
  date: string;
  time: string;
  notes?: string;
  createdAt: string;
}> = [];

async function executeCreateReminder(input: {
  title?: string;
  date?: string;
  time?: string;
  notes?: string;
  calendar?: string;
  alert_minutes_before?: number;
}): Promise<string> {
  const title = input.title || "Reminder";
  const date = input.date || "today";
  const time = input.time || "9:00";
  const notes = input.notes || "";

  if (isAppleCalendarConfigured()) {
    const result = await createAppleCalendarEvent({
      title,
      dateStr: date,
      timeStr: time,
      notes,
      calendar: input.calendar,
      alertMinutesBefore: input.alert_minutes_before,
    });
    if (result.success) {
      const mins = input.alert_minutes_before ?? 15;
      const alertMsg = mins === 0
        ? "You'll get a notification at the time of the event."
        : `You'll get an iPhone notification ${mins} min before.`;
      const calMsg = input.calendar ? ` Added to ${input.calendar} calendar.` : "";
      return `Reminder added to your Apple Calendar: "${title}" on ${date} at ${time}${notes ? ` (${notes})` : ""}.${calMsg} ${alertMsg}`;
    }
    return `Could not add to Apple Calendar: ${result.error}. Stored locally instead: "${title}" on ${date} at ${time}.`;
  }

  reminders.push({
    title,
    date,
    time,
    notes,
    createdAt: new Date().toISOString(),
  });

  return `Reminder created: "${title}" on ${date} at ${time}${notes ? ` (${notes})` : ""}. Add APPLE_ID and APPLE_APP_PASSWORD to .env to sync to your iPhone calendar.`;
}

function listReminders(): string {
  if (reminders.length === 0) {
    return "No reminders yet. Ask me to create one!";
  }
  return reminders
    .map(
      (r, i) =>
        `${i + 1}. **${r.title}** — ${r.date} at ${r.time}${r.notes ? ` (${r.notes})` : ""}`
    )
    .join("\n");
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  // Convert simple messages to Converse format (use type assertion for tool-use messages)
  const converseMessages: Array<{ role: "user" | "assistant"; content: unknown[] }> =
    messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: [{ text: m.content }],
    }));

  const maxToolRounds = 5;
  let round = 0;

  while (round < maxToolRounds) {
    round++;
    const response = await client.send(
      new ConverseCommand({
        modelId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: converseMessages as any,
        system: [{ text: SYSTEM_PROMPT }],
        toolConfig: TOOL_CONFIG,
        inferenceConfig: {
          maxTokens: 1024,
          temperature: 0.7,
        },
      })
    );

    const output = response.output;
    if (!output || !("message" in output) || !output.message) {
      throw new Error("Invalid response from Bedrock");
    }

    const outputMessage = output.message;
    converseMessages.push(outputMessage as { role: "user" | "assistant"; content: unknown[] });

    if (response.stopReason === "end_turn" || response.stopReason === "max_tokens") {
      const content = outputMessage.content;
      const textBlock = content?.find((b: { text?: string }) => "text" in b && b.text);
      return textBlock && "text" in textBlock ? (textBlock.text ?? "") : "";
    }

    if (response.stopReason === "tool_use" && outputMessage.content) {
      for (const block of outputMessage.content) {
        if ("toolUse" in block && block.toolUse) {
          const { toolUseId, name, input } = block.toolUse;
          let resultText: string;
          try {
            if (name === "create_reminder") {
              const params = input as {
                title?: string;
                date?: string;
                time?: string;
                notes?: string;
                calendar?: string;
                alert_minutes_before?: number;
              };
              resultText = await executeCreateReminder(params);
            } else if (name === "list_reminders") {
              resultText = listReminders();
            } else {
              resultText = `Unknown tool: ${name}`;
            }
          } catch (err) {
            resultText =
              err instanceof Error ? err.message : "Tool execution failed";
          }
          converseMessages.push({
            role: "user",
            content: [
              {
                toolResult: {
                  toolUseId,
                  content: [{ text: resultText }],
                  status: "success",
                },
              },
            ],
          });
        }
      }
    }
  }

  return "I had trouble completing that. Please try again.";
}
