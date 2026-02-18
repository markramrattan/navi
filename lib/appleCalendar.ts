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

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  calendar?: string;
}

/** Parse iCal data string to extract VEVENTs */
function parseICalEvents(icalData: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const vcalendarMatch = icalData.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/gi);
  if (!vcalendarMatch) return events;

  for (const vcal of vcalendarMatch) {
    const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/gi;
    let match: RegExpExecArray | null;
    while ((match = veventRegex.exec(vcal)) !== null) {
      const block = match[0];
      const summary = block.match(/SUMMARY(?::(?:[^\r]*\r?\n)?[ \t]+)?:([^\r\n]*)/i)?.[1]?.replace(/\\,/g, ",") ?? "Untitled";
      const dtstart = block.match(/DTSTART(?:;.*?)?(?::(?:[^\r]*\r?\n)?[ \t]+)?:([^\r\n]*)/i)?.[1];
      const dtend = block.match(/DTEND(?:;.*?)?(?::(?:[^\r]*\r?\n)?[ \t]+)?:([^\r\n]*)/i)?.[1];
      if (!dtstart) continue;
      const start = parseICalDate(dtstart);
      if (!start) continue;
      const endParsed = dtend ? parseICalDate(dtend) : null;
      const end = endParsed && endParsed > start ? endParsed : new Date(start.getTime() + 30 * 60 * 1000);
      events.push({ title: summary.trim(), start, end });
    }
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function parseICalDate(val: string): Date | null {
  if (!val) return null;
  const clean = val.replace(/\s/g, "");
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/);
  if (!m) return null;
  const [, y, mo, d, h = "0", min = "0", s = "0"] = m;
  return new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(min, 10), parseInt(s, 10)));
}

export async function listUpcomingEvents(params: {
  dateStr?: string;
  daysAhead?: number;
}): Promise<{ success: true; events: CalendarEvent[] } | { success: false; error: string }> {
  if (!isConfigured()) {
    return {
      success: false,
      error: "Apple Calendar not configured. Add APPLE_ID and APPLE_APP_PASSWORD to .env",
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

    const now = new Date();
    let startDate: Date;
    const d = (params.dateStr || "today").toLowerCase();
    if (d === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (d === "tomorrow") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(params.dateStr || "")) {
      const [y, m, day] = (params.dateStr || "").split("-").map(Number);
      startDate = new Date(y, m - 1, day);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const daysAhead = params.daysAhead ?? 1;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead);

    const timeRange = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    const allEvents: CalendarEvent[] = [];
    for (const cal of calendars) {
      const objects = await client.fetchCalendarObjects({
        calendar: cal,
        timeRange,
      });
      for (const obj of objects) {
        const data = typeof obj.data === "string" ? obj.data : "";
        const parsed = parseICalEvents(data);
        const calName = getCalendarDisplayName(cal);
        for (const ev of parsed) {
          allEvents.push({ ...ev, calendar: calName || undefined });
        }
      }
    }

    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    return { success: true, events: allEvents };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
