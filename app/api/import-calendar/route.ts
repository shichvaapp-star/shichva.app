import { NextResponse } from "next/server";

function decodeICSText(text: string): string {
  return text
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\\\/g, '\\');
}

function parseICSDate(icsDateStr: string): Date {
  const cleanStr = icsDateStr.split(':').pop() || '';
  const y = parseInt(cleanStr.substring(0, 4), 10);
  const m = parseInt(cleanStr.substring(4, 6), 10) - 1;
  const d = parseInt(cleanStr.substring(6, 8), 10);
  
  if (cleanStr.includes('T')) {
    const hh = parseInt(cleanStr.substring(9, 11), 10) || 0;
    const mm = parseInt(cleanStr.substring(11, 13), 10) || 0;
    const ss = parseInt(cleanStr.substring(13, 15), 10) || 0;
    return new Date(Date.UTC(y, m, d, hh, mm, ss));
  }
  return new Date(Date.UTC(y, m, d));
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "Missing calendar URL" }, { status: 400 });
    }

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch calendar from Google" }, { status: 400 });
    }

    const icsText = await res.text();

    // Unfold lines
    const lines = icsText.split(/\r?\n/);
    const unfoldedLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (unfoldedLines.length > 0) {
          unfoldedLines[unfoldedLines.length - 1] += line.substring(1);
        }
      } else {
        unfoldedLines.push(line);
      }
    }

    const events: Array<{ title: string; startDate: string; endDate?: string; description?: string }> = [];
    let currentEvent: any = null;

    for (const line of unfoldedLines) {
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = {};
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.summary && currentEvent.dtstart) {
          try {
            const start = parseICSDate(currentEvent.dtstart);
            const end = currentEvent.dtend ? parseICSDate(currentEvent.dtend) : undefined;
            
            // Adjust end date if it is an all-day event (all-day events have VALUE=DATE and DTEND is exclusive day).
            let adjustedEnd = end;
            if (end && !currentEvent.dtstart.includes('T') && !currentEvent.dtend.includes('T')) {
              // Decrement by 1 day to make it inclusive end date
              adjustedEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
              if (adjustedEnd.getTime() <= start.getTime()) {
                adjustedEnd = undefined; // it's a single day event
              }
            }

            events.push({
              title: currentEvent.summary,
              startDate: start.toISOString(),
              endDate: adjustedEnd ? adjustedEnd.toISOString() : undefined,
              description: currentEvent.description || ""
            });
          } catch (e) {
            console.error("Error parsing event dates", e, currentEvent);
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const keyPart = line.substring(0, colonIdx);
          const value = line.substring(colonIdx + 1);
          
          if (keyPart.startsWith('SUMMARY')) {
            currentEvent.summary = decodeICSText(value);
          } else if (keyPart.startsWith('DTSTART')) {
            currentEvent.dtstart = value;
          } else if (keyPart.startsWith('DTEND')) {
            currentEvent.dtend = value;
          } else if (keyPart.startsWith('DESCRIPTION')) {
            currentEvent.description = decodeICSText(value);
          }
        }
      }
    }

    // Sort by date ascending
    events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    // Filter only events from 6 months ago up to 1 year forward
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oneYearForward = new Date();
    oneYearForward.setFullYear(oneYearForward.getFullYear() + 1);

    const filteredEvents = events.filter(e => {
      const d = new Date(e.startDate);
      return d >= sixMonthsAgo && d <= oneYearForward;
    });

    return NextResponse.json({ events: filteredEvents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
