import { createDAVClient } from "tsdav";

const ICAL_SERVER = "https://caldav.icloud.com";

function parseDateTime(
  dateStr: string,
  timeStr: string
): { start: Date; end: Date } {
  const now = new Date();
  let targetDate: Date;

  const d = dateStr.toLowerCase();
  if (d === "today") {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (d === "tomorrow") {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, day] = dateStr.split("-").map(Number);
    targetDate = new Date(y, m - 1, day);
  } else {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  let hours = 9;
  let minutes = 0;
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const suffix = (timeMatch[3] || "").toLowerCase();
    if (suffix === "pm" && hours < 12) hours += 12;
    if (suffix === "am" && hours === 12) hours = 0;
  }

  targetDate.setHours(hours, minutes, 0, 0);
  const endDate = new Date(targetDate.getTime() + 30 * 60 * 1000);
  return { start: targetDate, end: endDate };
}

function formatICalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

export function isConfigured(): boolean {
  return !!(
    process.env.APPLE_ID &&
    process.env.APPLE_APP_PASSWORD
  );
}

function getCalendarDisplayName(cal: { displayName?: string | Record<string, unknown> }): string {
  const name = cal.displayName;
  if (typeof name === "string") return name.toLowerCase();
  if (name && typeof name === "object" && "#" in name) return String((name as { "#"?: string })["#"] ?? "").toLowerCase();
  return "";
}

function pickCalendar(
  calendars: Array<{ displayName?: string | Record<string, unknown>; url: string }>,
  preferred?: string
): (typeof calendars)[0] {
  if (preferred) {
    const pref = preferred.toLowerCase();
    const match = calendars.find((c) => {
      const name = getCalendarDisplayName(c);
      return name === pref || name.includes(pref);
    });
    if (match) return match;
  }
  return calendars[0];
}

export async function createEvent(params: {
  title: string;
  dateStr: string;
  timeStr: string;
  notes?: string;
  calendar?: string;
  alertMinutesBefore?: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!isConfigured()) {
    return {
      success: false,
      error:
        "Apple Calendar not configured. Add APPLE_ID and APPLE_APP_PASSWORD to .env",
    };
  }

  try {
    const client = await createDAVClient({
      serverUrl: ICAL_SERVER,
      credentials: {
        username: process.env.APPLE_ID!,
        password: process.env.APPLE_APP_PASSWORD!,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    const calendars = await client.fetchCalendars();
    if (!calendars || calendars.length === 0) {
      return { success: false, error: "No calendars found in iCloud account" };
    }

    const calendar = pickCalendar(calendars, params.calendar);

    const { start, end } = parseDateTime(params.dateStr, params.timeStr);
    const uid = `navi-${Date.now()}-${Math.random().toString(36).slice(2)}@navi`;
    const dtstamp = formatICalDate(new Date());
    const dtstart = formatICalDate(start);
    const dtend = formatICalDate(end);
    const summary = params.title.replace(/\n/g, " ").replace(/\r/g, "");
    const description = (params.notes || "").replace(/\n/g, " ").replace(/\r/g, "");

    const alertMins = params.alertMinutesBefore ?? 15;
    const trigger = `-PT${Math.max(0, alertMins)}M`;

    const valarm = [
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      `TRIGGER:${trigger}`,
      "END:VALARM",
    ].join("\r\n");

    const iCalString = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Navi//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      ...(description ? [`DESCRIPTION:${description}`] : []),
      valarm,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    await client.createCalendarObject({
      calendar,
      filename: `${uid}.ics`,
      iCalString,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
