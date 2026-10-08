// ── Monthly AI allowance ──────────────────────────────────────────────────────
// Every face scan and label read is a paid AI call, so free accounts get a few
// a month and Premium gets roughly one a day. Only real AI calls count: the
// on-device photo check, demo mode and failed reads are free.
// Counted on the phone, so it's a soft limit until the proxy can count per account.
import { monthKey } from './dates';

export type AiKind = 'face' | 'label';
export interface AiUsage { month: string; face: number; label: number }

export const AI_LIMITS: Record<'free' | 'premium', Record<AiKind, number>> = {
  free:    { face: 4,  label: 4 },
  premium: { face: 30, label: 30 },
};

export const emptyUsage = (): AiUsage => ({ month: monthKey(), face: 0, label: 0 });

// A new calendar month starts a fresh allowance.
export const currentUsage = (u: AiUsage | null | undefined): AiUsage =>
  u && u.month === monthKey() ? u : emptyUsage();

export function aiLeft(u: AiUsage | null | undefined, kind: AiKind, premium: boolean): number {
  const limit = AI_LIMITS[premium ? 'premium' : 'free'][kind];
  return Math.max(0, limit - currentUsage(u)[kind]);
}
