/**
 * Timezone-safe date and time helpers shared by Frontend and Backend.
 * Defaults to Asia/Bangkok so cloud deployments in UTC still trigger exact Thai local times.
 */

export function getZonedParts(date: Date = new Date(), timeZone = 'Asia/Bangkok'): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  weekday: number; // 0 (Sun) - 6 (Sat)
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour === '24' ? '00' : map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;
  const timeStr = `${pad(hour)}:${pad(minute)}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
    weekday: weekdayMap[map.weekday] ?? date.getDay(),
  };
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function getNextRecurrenceDate(
  currentDateStr: string,
  recurrence: 'none' | 'daily' | 'weekdays' | 'weekly'
): string | null {
  if (recurrence === 'none') return null;
  if (recurrence === 'daily') return addDaysToDateStr(currentDateStr, 1);
  if (recurrence === 'weekly') return addDaysToDateStr(currentDateStr, 7);
  if (recurrence === 'weekdays') {
    let next = addDaysToDateStr(currentDateStr, 1);
    for (let i = 0; i < 7; i++) {
      const [y, m, d] = next.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        return next;
      }
      next = addDaysToDateStr(next, 1);
    }
  }
  return null;
}

export function timeStrToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTimeStr(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatThaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

export function formatShortThaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}
