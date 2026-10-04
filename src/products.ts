// Product catalog + routine builder

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
  exfoliant:  'BHA Exfoliant',
  retinoid:   'Retinoid',
  moisturizer:'Moisturizer',
  spf:        'Mineral SPF 30+',
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

// Registers a product fetched from Open Beauty Facts into the CATALOG so the
// routine builder can pick it up. Called before addProduct() in the store.
export function registerProduct(name: string, category: ProductCategory, actives: string[] = []): void {
  if (!CATALOG[name]) {
    CATALOG[name] = { category, actives, tone: 'both', mins: 1 };
  }
}

export function buildRoutine(owned: string[], when: Tone): RoutineStep[] {
  const matched = owned
    .map(name => {
      const info = CATALOG[name];
      return info ? { name, ...info } : null;
    })
    .filter((p): p is RoutineStep & { name: string } => p !== null);

  const filtered = matched.filter(p => p.tone === when || p.tone === 'both');

  // Skip retinoid in AM, skip SPF in PM
  const valid = filtered.filter(p => {
    if (when === 'AM' && p.category === 'retinoid') return false;
    if (when === 'PM' && p.category === 'spf') return false;
    return true;
  });

  // First product per category, in canonical order
  const seen = new Set<ProductCategory>();
  const result: RoutineStep[] = [];
  for (const cat of ORDER) {
    const match = valid.find(p => p.category === cat && !seen.has(p.category));
    if (match) {
      seen.add(cat);
      result.push(match);
    }
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

export function buildEveningRoutine(owned: string[], amCompleted: boolean): CompensatedRoutine {
  const pm = buildRoutine(owned, 'PM');
  if (amCompleted) return { steps: pm, compensations: [] };

  const am = buildRoutine(owned, 'AM');
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
  acne:      { key: 'exfoliant', label: 'BHA Exfoliant',    reason: 'You flagged breakouts — salicylic acid clears pores and cuts comedones.' },
  texture:   { key: 'exfoliant', label: 'Gentle Exfoliant', reason: 'For texture & pores, a PHA/AHA 2×/week smooths the surface.' },
  darkspots: { key: 'antiox',    label: 'Vitamin C Serum',  reason: 'For dark spots, morning Vitamin C fades pigment under SPF.' },
  aging:     { key: 'retinoid',  label: 'Retinoid',         reason: 'For fine lines, a nightly retinoid is the most evidence-backed active.' },
  dryness:   { key: 'serum',     label: 'Hydrating Serum',  reason: 'You flagged dryness — a hyaluronic acid serum layers in moisture.' },
};

export function routineGaps(owned: string[], concerns: string[] = []): GapWarning[] {
  const cats = owned
    .map(n => CATALOG[n]?.category)
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
    staples.push({ key: 'spf', label: 'Broad-Spectrum SPF', reason: 'UV is the #1 cause of premature aging. Non-negotiable.' });

  // De-dupe staples that a concern gap already covers.
  const merged = [...concernGaps];
  for (const s of staples) if (!merged.some(g => g.key === s.key)) merged.push(s);
  return merged;
}
