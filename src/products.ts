// Product catalog + routine builder. The routine is built from the user's
// shelf: each product's category decides where it sits and when it's used.

export type ProductCategory =
  | 'cleanser' | 'antiox' | 'serum' | 'exfoliant'
  | 'retinoid' | 'moisturizer' | 'spf';

export type Tone = 'AM' | 'PM' | 'both';

export interface ProductInfo {
  category: ProductCategory;
  actives: string[];
  tone: Tone;
  mins: number;
}

export interface RoutineStep {
  name: string;
  category: ProductCategory;
  actives: string[];
  tone: Tone;
  mins: number;
  freq?: string;
}

export interface GapWarning {
  key: ProductCategory;
  label: string;
  reason: string;
}

// Canonical AM layering order (thinnest → thickest)
const ORDER: ProductCategory[] = [
  'cleanser', 'antiox', 'serum', 'exfoliant', 'retinoid', 'moisturizer', 'spf',
];

export const STEP_LABEL: Record<ProductCategory, string> = {
  cleanser:   'Cleanser',
  antiox:     'Vitamin C / Antioxidant',
  serum:      'Treatment Serum',
  exfoliant:  'Exfoliant',
  retinoid:   'Retinoid',
  moisturizer:'Moisturizer',
  spf:        'SPF 30+',
};

export const CATALOG: Record<string, ProductInfo> = {
  'CeraVe Hydrating Cleanser':     { category: 'cleanser',    actives: ['ceramides', 'hyaluronic acid'], tone: 'both', mins: 1 },
  'La Roche-Posay Toleriane':       { category: 'moisturizer', actives: ['glycerin', 'niacinamide'],      tone: 'both', mins: 1 },
  'EltaMD UV Clear SPF 46':         { category: 'spf',         actives: ['niacinamide', 'zinc oxide'],    tone: 'AM',   mins: 1 },
  'The Ordinary Niacinamide 10%':   { category: 'serum',       actives: ['niacinamide', 'zinc'],          tone: 'AM',   mins: 1 },
  'Differin (Adapalene 0.1%)':      { category: 'retinoid',    actives: ['adapalene'],                    tone: 'PM',   mins: 2 },
  'Paula\'s Choice BHA 2%':         { category: 'exfoliant',   actives: ['salicylic acid'],               tone: 'PM',   mins: 1 },
  'SkinCeuticals C E Ferulic':      { category: 'antiox',      actives: ['vitamin c', 'vitamin e'],       tone: 'AM',   mins: 1 },
  'Neutrogena Hydro Boost Gel':     { category: 'moisturizer', actives: ['hyaluronic acid'],              tone: 'both', mins: 1 },
  'The Ordinary AHA 30%+BHA 2%':    { category: 'exfoliant',   actives: ['glycolic acid', 'salicylic acid'], tone: 'PM', mins: 2 },
  'Cetaphil Gentle Cleanser':       { category: 'cleanser',    actives: ['glycerin'],                     tone: 'both', mins: 1 },
  'Kiehl\'s Midnight Recovery':     { category: 'serum',       actives: ['lavender oil', 'squalane'],     tone: 'PM',   mins: 2 },
  'La Roche-Posay Anthelios SPF 60':{ category: 'spf',         actives: ['mexoryl', 'tinosorb'],          tone: 'AM',   mins: 1 },
};

// The minimum the routine builder needs from a shelf product.
export interface RoutineProduct {
  name: string;
  category?: ProductCategory | null;
  ingredients: string[];
}

const CATEGORIES = new Set<ProductCategory>(ORDER);
export const isCategory = (c: unknown): c is ProductCategory =>
  typeof c === 'string' && CATEGORIES.has(c as ProductCategory);

// A product's category: its own if it has one, else a known catalog entry.
export function categoryOf(p: { name: string; category?: string | null }): ProductCategory | null {
  if (isCategory(p.category)) return p.category;
  return CATALOG[p.name]?.category ?? null;
}

// When each kind of product belongs: SPF and vitamin C by day, retinoids and
// acids at night (they raise sun sensitivity), the basics both times.
const TONE: Record<ProductCategory, Tone> = {
  cleanser: 'both', moisturizer: 'both', serum: 'both',
  antiox: 'AM', spf: 'AM', retinoid: 'PM', exfoliant: 'PM',
};

// Acid nights when the shelf has both an exfoliant and a retinoid: using both on
// the same night raises irritation, so they alternate (acid twice a week).
const ACID_NIGHTS = new Set([1, 4]);   // Monday and Thursday

export function buildRoutine(shelf: RoutineProduct[], when: Tone, date = new Date()): RoutineStep[] {
  const valid = shelf
    .map(p => {
      const category = categoryOf(p);
      if (!category) return null;
      const info = CATALOG[p.name];
      return {
        name: p.name, category,
        actives: info?.actives ?? p.ingredients.slice(0, 3),
        tone: TONE[category],
        mins: info?.mins ?? 1,
      };
    })
    .filter((p): p is RoutineStep => p !== null)
    .filter(p => p.tone === when || p.tone === 'both');

  // First product per category, in canonical order
  let result: RoutineStep[] = [];
  for (const cat of ORDER) {
    const match = valid.find(p => p.category === cat);
    if (match) result.push(match);
  }

  const hasCat = (c: ProductCategory) => result.some(p => p.category === c);
  if (when === 'PM' && hasCat('exfoliant') && hasCat('retinoid')) {
    const acidNight = ACID_NIGHTS.has(date.getDay());
    result = result
      .filter(p => p.category !== (acidNight ? 'retinoid' : 'exfoliant'))
      .map(p => (p.category === 'exfoliant' ? { ...p, freq: 'acid night · Mon & Thu' }
        : p.category === 'retinoid' ? { ...p, freq: 'not on acid nights' } : p));
  }
  return result;
}

// ── Evening compensator ────────────────────────────────────────────────────────
// When the user reaches their evening routine having (likely) missed the morning,
// we intelligently fold each missed AM step into tonight — UNLESS it clashes with
// what's already scheduled for PM, in which case we drop it with a clear reason.
export type CompAction = 'carried' | 'dropped';

export interface Compensation {
  step: string;
  category: ProductCategory;
  action: CompAction;
  reason: string;
}

export interface CompensatedRoutine {
  steps: RoutineStep[];
  compensations: Compensation[];
}

export function buildEveningRoutine(shelf: RoutineProduct[], amCompleted: boolean, date = new Date()): CompensatedRoutine {
  const pm = buildRoutine(shelf, 'PM', date);
  if (amCompleted) return { steps: pm, compensations: [] };

  const am = buildRoutine(shelf, 'AM');
  const pmCats        = new Set(pm.map(s => s.category));
  const pmHasRetinoid = pm.some(s => s.category === 'retinoid');
  const pmHasExfoliant = pm.some(s => s.category === 'exfoliant');

  const compensations: Compensation[] = [];
  const carried: RoutineStep[] = [];

  for (const step of am) {
    if (pmCats.has(step.category)) continue;   // already covered tonight
    if (step.category === 'spf') continue;      // SPF at night is pointless — skip silently

    // Conflict rules — actives that must not share a night with a retinoid/acid.
    if (step.category === 'antiox' && (pmHasRetinoid || pmHasExfoliant)) {
      compensations.push({
        step: STEP_LABEL[step.category], category: step.category, action: 'dropped',
        reason: `Vitamin C destabilises beside tonight's ${pmHasRetinoid ? 'retinoid' : 'exfoliant'} — held for the morning.`,
      });
      continue;
    }
    if (step.category === 'exfoliant' && pmHasRetinoid) {
      compensations.push({
        step: STEP_LABEL[step.category], category: step.category, action: 'dropped',
        reason: `An acid over tonight's retinoid risks over-exfoliation — held for the morning.`,
      });
      continue;
    }

    carried.push(step);
    compensations.push({
      step: STEP_LABEL[step.category], category: step.category, action: 'carried',
      reason: `Missed this morning — safely folded into tonight.`,
    });
  }

  // Re-thread carried steps into canonical layering order alongside the PM steps.
  const merged = [...pm, ...carried];
  const ordered = ORDER.flatMap(cat => merged.filter(s => s.category === cat));
  return { steps: ordered, compensations };
}

// Concerns from onboarding map to the active a routine should add to address them.
const CONCERN_GAP: Record<string, GapWarning> = {
  acne:      { key: 'exfoliant', label: 'BHA Exfoliant',    reason: 'You flagged breakouts. Salicylic acid helps keep pores clear; give it 6–8 weeks.' },
  texture:   { key: 'exfoliant', label: 'Gentle Exfoliant', reason: 'For texture & pores, a PHA/AHA 2×/week smooths the surface.' },
  darkspots: { key: 'antiox',    label: 'Vitamin C Serum',  reason: 'For dark spots, daily SPF matters most. Morning vitamin C under it may help them fade.' },
  aging:     { key: 'retinoid',  label: 'Retinoid',         reason: 'For fine lines, a nightly retinoid is the most evidence-backed active.' },
  dryness:   { key: 'serum',     label: 'Hydrating Serum',  reason: 'You flagged dryness. A hyaluronic acid serum on damp skin, sealed with moisturiser, helps.' },
};

export function routineGaps(shelf: RoutineProduct[], concerns: string[] = []): GapWarning[] {
  const cats = shelf
    .map(categoryOf)
    .filter(Boolean) as ProductCategory[];

  // Personalised gaps from the onboarding concerns come FIRST — they're the most
  // relevant to why this user is here, so Browse surfaces them ahead of staples.
  const concernGaps: GapWarning[] = [];
  for (const c of concerns) {
    const g = CONCERN_GAP[c];
    if (g && !cats.includes(g.key) && !concernGaps.some(x => x.key === g.key)) concernGaps.push(g);
  }

  const staples: GapWarning[] = [];
  if (!cats.includes('cleanser'))
    staples.push({ key: 'cleanser', label: 'Cleanser', reason: 'Essential first step — removes overnight oil and preps skin for actives.' });
  if (!cats.includes('moisturizer'))
    staples.push({ key: 'moisturizer', label: 'Moisturizer', reason: 'Locks in hydration and strengthens the barrier.' });
  if (!cats.some(c => c === 'spf'))
    staples.push({ key: 'spf', label: 'Broad-Spectrum SPF', reason: 'Sun exposure is the biggest outside cause of skin ageing. Daily SPF has the strongest evidence of any step.' });

  // De-dupe staples that a concern gap already covers.
  const merged = [...concernGaps];
  for (const s of staples) if (!merged.some(g => g.key === s.key)) merged.push(s);
  return merged;
}
