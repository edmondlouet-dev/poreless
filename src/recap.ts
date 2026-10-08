// ── Monthly recap: what actually happened this month ───────────────────────────
// Built only from what the user logged: finished routines, saved scans, products
// added and trial verdicts. Nothing is estimated or filled in.
import { bestStreak, monthKey } from './dates';
import type { ScanEntry, ShelfProduct, SkinScores } from './store';
import type { Trial } from './trials';

export interface ScoreChange { label: string; from: number; to: number }

export interface Recap {
  month: string;              // "2026-10"
  routines: number;
  morning: number;
  evening: number;
  activeDays: number;
  daysInPeriod: number;       // whole month, or days so far if it's this month
  bestStreak: number;
  scans: number;
  firstPhoto: ScanEntry | null;
  lastPhoto: ScanEntry | null;
  changes: ScoreChange[];     // first vs last scored scan of the month
  productsAdded: number;
  trialsStarted: number;
  verdicts: { product: string; verdict: Trial['verdict'] }[];
}

const SCORE_LABELS: { key: keyof SkinScores; label: string }[] = [
  { key: 'overall',   label: 'Appearance' },
  { key: 'acne',      label: 'Clear' },
  { key: 'redness',   label: 'Calm' },
  { key: 'texture',   label: 'Smooth' },
  { key: 'tone',      label: 'Even' },
  { key: 'oil',       label: 'Matte' },
  { key: 'hydration', label: 'Not dry' },
  { key: 'pores',     label: 'Pores' },
];

interface Data {
  completions: string[];
  scans: ScanEntry[];
  shelf: ShelfProduct[];
  trials: Trial[];
}

export function buildRecap(month: string, data: Data, now = new Date()): Recap {
  const inMonth = (iso: string) => monthKey(new Date(iso)) === month;
  const done = data.completions.filter(k => k.startsWith(month));
  const days = new Set(done.map(k => k.split('|')[0]!));

  const [y, m] = month.split('-').map(Number);
  const monthDays = new Date(y!, m!, 0).getDate();
  const daysInPeriod = month === monthKey(now) ? now.getDate() : monthDays;

  const scans = data.scans.filter(s => inMonth(s.date));
  const photos = scans.filter(s => s.photoUri);
  const scored = scans.filter(s => s.scores);
  const first = scored[0]?.scores, last = scored[scored.length - 1]?.scores;
  const changes = first && last && scored.length >= 2
    ? SCORE_LABELS.map(({ key, label }) => ({ label, from: first[key], to: last[key] }))
    : [];

  return {
    month,
    routines: done.length,
    morning: done.filter(k => k.endsWith('|AM')).length,
    evening: done.filter(k => k.endsWith('|PM')).length,
    activeDays: days.size,
    daysInPeriod,
    bestStreak: bestStreak(days),
    scans: scans.length,
    firstPhoto: photos[0] ?? null,
    lastPhoto: photos.length > 1 ? photos[photos.length - 1]! : null,
    changes,
    productsAdded: data.shelf.filter(p => inMonth(p.addedAt)).length,
    trialsStarted: data.trials.filter(t => inMonth(t.startedAt)).length,
    verdicts: data.trials
      .filter(t => t.verdict && t.verdictAt && inMonth(t.verdictAt))
      .map(t => ({ product: t.productName, verdict: t.verdict })),
  };
}

export const recapIsEmpty = (r: Recap) =>
  r.routines === 0 && r.scans === 0 && r.productsAdded === 0 && r.verdicts.length === 0;

// Months that have anything in them, newest first.
export function recapMonths(data: Data, now = new Date()): string[] {
  const keys = new Set<string>([monthKey(now)]);
  data.completions.forEach(k => keys.add(k.slice(0, 7)));
  data.scans.forEach(s => keys.add(monthKey(new Date(s.date))));
  data.shelf.forEach(p => keys.add(monthKey(new Date(p.addedAt))));
  return [...keys].sort().reverse();
}

// Last month, while the new month is in its first week.
export function lastMonthKey(now = new Date()): string | null {
  if (now.getDate() > 7) return null;
  return monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}
