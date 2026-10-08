// Local-calendar date helpers. Keys use the phone's own day, not UTC, so a
// routine done at 11pm counts for that evening.

export type Slot = 'AM' | 'PM';

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const routineKey = (slot: Slot, d = new Date()) => `${dayKey(d)}|${slot}`;

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
};

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
};

// Consecutive days, ending today (or yesterday, so the streak doesn't look
// broken before today's routine), with at least one completed routine.
export function streakFrom(completions: string[], now = new Date()): number {
  const days = new Set(completions.map(k => k.split('|')[0]));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function bestStreak(days: Set<string>): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const [y, m, dd] = k.split('-').map(Number);
    const d = new Date(y!, m! - 1, dd!);
    run = prev && (d.getTime() - prev.getTime()) <= 26 * 60 * 60 * 1000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
