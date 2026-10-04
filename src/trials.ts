// ── "Is it working?" product trials ────────────────────────────────────────────
// Most actives need weeks before you can judge them, and switching early is the
// most common way routines fail. When a product with a known active joins the
// shelf, a trial starts with the time that active typically needs, and the app
// asks for a verdict (with photos) only once that time is up.

export type TrialVerdict = 'better' | 'same' | 'worse';

export interface Trial {
  productId: string;
  productName: string;
  active: string;          // e.g. "a retinoid"
  startedAt: string;       // ISO date
  weeks: number;           // when to judge it
  range: string;           // the typical window, for display ("8–12 weeks")
  earlyNote: string;       // what's normal in the first weeks
  verdict?: TrialVerdict;
  verdictAt?: string;
}

interface ActiveTimeline {
  match: string[];
  active: string;
  weeks: number;
  range: string;
  earlyNote: string;
}

// Typical time to a visible change, from dermatology guidance (AAD, BAD/NHS
// patient leaflets). Ranges vary between people; these are the usual windows.
const TIMELINES: ActiveTimeline[] = [
  {
    match: ['retinol', 'retinal', 'retinyl', 'tretinoin', 'adapalene'],
    active: 'a retinoid', weeks: 12, range: '8–12 weeks',
    earlyNote: 'Dryness, flaking and a few extra spots in the first weeks are common. Start 2–3 nights a week.',
  },
  {
    match: ['benzoyl peroxide'],
    active: 'benzoyl peroxide', weeks: 8, range: '6–8 weeks',
    earlyNote: 'Some dryness at first is normal. It can bleach towels and pillowcases.',
  },
  {
    match: ['salicylic acid'],
    active: 'salicylic acid (BHA)', weeks: 8, range: '6–8 weeks',
    earlyNote: 'Mild tingling is normal; stinging that lasts means use it less often.',
  },
  {
    match: ['azelaic acid'],
    active: 'azelaic acid', weeks: 12, range: '8–12 weeks',
    earlyNote: 'A brief tingle when applied is common and usually settles.',
  },
  {
    match: ['ascorbic acid', 'vitamin c', 'ascorbyl'],
    active: 'vitamin C', weeks: 12, range: '8–12 weeks',
    earlyNote: 'Changes to dark spots are slow. Keep wearing SPF every day.',
  },
  {
    match: ['niacinamide'],
    active: 'niacinamide', weeks: 8, range: '8–12 weeks',
    earlyNote: 'Usually gentle. High strengths (over 5%) can cause redness in some people.',
  },
  {
    match: ['glycolic acid', 'lactic acid', 'mandelic acid'],
    active: 'an exfoliating acid (AHA)', weeks: 8, range: '4–8 weeks',
    earlyNote: 'Start twice a week. Skin can be more sun-sensitive, so wear SPF.',
  },
];

export function trialFor(product: { id: string; name: string; ingredients: string[] }): Trial | null {
  const lower = product.ingredients.map(i => i.toLowerCase());
  const t = TIMELINES.find(tl => tl.match.some(m => lower.some(i => i.includes(m))));
  if (!t) return null;
  return {
    productId: product.id,
    productName: product.name,
    active: t.active,
    startedAt: new Date().toISOString(),
    weeks: t.weeks,
    range: t.range,
    earlyNote: t.earlyNote,
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const trialWeek = (t: Trial, now = new Date()) =>
  Math.floor((now.getTime() - new Date(t.startedAt).getTime()) / WEEK_MS) + 1;

export const trialDue = (t: Trial, now = new Date()) =>
  !t.verdict && now.getTime() - new Date(t.startedAt).getTime() >= t.weeks * WEEK_MS;

export const VERDICT_ADVICE: Record<TrialVerdict, string> = {
  better: 'Keep going. Consistency is what holds the result.',
  same: 'No change after a fair trial is a real answer. Try a different active rather than ' +
    'adding more on top, or ask a pharmacist. For acne that hasn\'t improved after 2–3 months ' +
    'of shop-bought treatment, see a GP.',
  worse: 'Stop using it. If irritation, swelling or a rash doesn\'t settle within a few days, ' +
    'speak to a pharmacist or GP.',
};
