// ── Structural skin analytics + shelf inventory + synergy/blueprint logic ──────
// Pure data + logic (no JSX). Connective tissue between the Proportions scan,
// the Rituals traditions, and the Today routine.

export type FluidLevel = 'Low' | 'Moderate' | 'High';

export interface StructuralMetrics {
  canthalTilt: number;       // degrees, rough photo estimate — normal variation, not a grade
  midfaceRatio: number;      // rough photo estimate — normal variation, not a grade
  fluidRetention: FluidLevel; // how puffy the face looked in the last photo
  barrierStatus: string;     // how the user SAYS their skin feels: one of SKIN_FEEL's values
}

// Skin feel is self-reported: a photo can't show barrier function, so the
// "go gentle on actives" logic keys off what the user tells us. Values keep
// the word "sensitive" where it applies so /sensiti/ checks elsewhere still work.
export type SkinFeel = 'comfortable' | 'tight' | 'sensitive';
export const SKIN_FEEL: Record<SkinFeel, string> = {
  comfortable: 'Feels comfortable',
  tight:       'Feels tight',
  sensitive:   'Feels sensitive',
};
export const SKIN_FEEL_UNSET = 'Not checked yet';

export interface ShelfItem {
  id: string;
  name: string;
  active: string;            // canonical chemical, lowercase
  tag: string;               // editorial label
}

// Neutral placeholders until the first scan; nothing here is a reading.
export const DEFAULT_STRUCTURAL: StructuralMetrics = {
  canthalTilt: 0,
  midfaceRatio: 1.05,
  fluidRetention: 'Low',
  barrierStatus: SKIN_FEEL_UNSET,
};

export const DEFAULT_SHELF: ShelfItem[] = [
  { id: 'vitc',    name: 'Vitamin C Serum',   active: 'vitamin c',       tag: 'Vitamin C' },
  { id: 'retinol', name: 'Retinol 0.5%',      active: 'retinol',         tag: 'Retinol' },
  { id: 'ha',      name: 'Hyaluronic Acid',   active: 'hyaluronic acid', tag: 'Hyaluronic Acid' },
];

// ── Per-tradition movement vocabulary ──────────────────────────────────────────
interface Technique { drainage: string; sculpt: string; lift: string; soothe: string }

const TECHNIQUE: Record<string, Technique> = {
  japanese:     { drainage: 'Tanzaku downward sweep', sculpt: 'Kobido cheek lift',   lift: 'Kobido eye tap',       soothe: 'lotion-mask press' },
  korean:       { drainage: 'gua-sha jaw glide',      sculpt: 'gua-sha cheek sculpt', lift: 'essence patting lift', soothe: 'cica layering press' },
  french:       { drainage: 'micellar sweep',    sculpt: 'roller cheek sculpt',  lift: 'serum pressure point', soothe: 'thermal-water mist' },
  ayurvedic:    { drainage: 'abhyanga oil sweep',   sculpt: 'kansa wand sculpt',    lift: 'netra-marma eye press',soothe: 'kumkumadi warm press' },
  african:      { drainage: 'shea-slip drainage',     sculpt: 'black-soap lift',      lift: 'baobab eye tap',       soothe: 'moringa balm press' },
  scandinavian: { drainage: 'cold-rinse sweep', sculpt: 'lagom cheek glide',    lift: 'cryo eye press',       soothe: 'cloudberry press' },
  greek:        { drainage: 'olive-oil effleurage',   sculpt: 'squalane cheek sculpt',lift: 'honey eye lift',       soothe: 'beeswax seal press' },
};

// ── Feature 1: Structural Sculpting Blueprint ──────────────────────────────────
export type BlueprintIcon = 'drainage' | 'sculpt' | 'lift' | 'soothe';

export interface BlueprintStep {
  icon: BlueprintIcon;
  title: string;
  body: string;
}

// Massage steps are offered as a pleasant routine, not a treatment: no massage
// moves lymph on demand, evens bone structure or lifts the eye's angle.
export function getStructuralBlueprint(ritualKey: string, m: StructuralMetrics): BlueprintStep[] {
  const t = TECHNIQUE[ritualKey] ?? TECHNIQUE.japanese;
  const steps: BlueprintStep[] = [];

  if (m.fluidRetention !== 'Low') {
    steps.push({
      icon: 'drainage',
      title: `${t.drainage}`,
      body: `Your face looked a little puffy in your last scan; that shifts with sleep, salt and time of day. If you like, sweep gently from the inner brow along the jaw, three slow passes per side. It can feel de-puffing, though evidence for facial massage is limited.`,
    });
  }

  steps.push({
    icon: 'sculpt',
    title: `${t.sculpt}`,
    body: `Spread moisturiser with light upward strokes from the chin toward the temples. Gentle application avoids tugging; it won't reshape the face, and it doesn't need to.`,
  });

  steps.push({
    icon: 'lift',
    title: `${t.lift}`,
    body: `Tap eye cream on with your ring finger and never drag the thin skin around the eye. Eye shape is set by bone and ligaments, so the goal is comfort, not a lift.`,
  });

  if (/sensiti/i.test(m.barrierStatus)) {
    steps.push({
      icon: 'soothe',
      title: `${t.soothe}`,
      body: `You said your skin feels sensitive. Press, don't rub, the final layer in with clean palms, and keep tonight fragrance-free.`,
    });
  }

  return steps;
}

// ── Feature 2: Cosmetic Conflict Harmonizer (Synergy Check) ────────────────────
export type SynergyKind = 'conflict' | 'caution' | 'synergy';

export interface SynergyFinding {
  kind: SynergyKind;
  title: string;
  body: string;
}

const has = (shelf: ShelfItem[], needle: string) =>
  shelf.some(s => s.active.includes(needle) || s.tag.toLowerCase().includes(needle));

export function getSynergyReport(
  ritualKey: string,
  ritualName: string,
  barrierStatus: string,
  shelf: ShelfItem[],
): SynergyFinding[] {
  const findings: SynergyFinding[] = [];
  const barrierFatigued = /sensiti/i.test(barrierStatus);
  const hasRetinol = has(shelf, 'retinol') || has(shelf, 'adapalene');
  const hasVitC    = has(shelf, 'vitamin c') || has(shelf, 'ascorbic');
  const hasHA      = has(shelf, 'hyaluronic');

  if (barrierFatigued && hasRetinol) {
    findings.push({
      kind: 'conflict',
      title: 'Conflict detected — Retinol',
      body: `You said your skin feels sensitive, and retinoids can make that worse. Swap tonight's retinol for your Hyaluronic Acid during ${ritualName}, and bring the retinol back once your skin feels comfortable.`,
    });
  }

  if (hasVitC && hasRetinol) {
    findings.push({
      kind: 'caution',
      title: 'Timing — Vitamin C & Retinol',
      body: `Using both at once can be irritating for some people. A simple routine is Vitamin C in the morning (under SPF) and Retinol in the evening.`,
    });
  }

  if (hasHA) {
    findings.push({
      kind: 'synergy',
      title: 'Synergy — Hyaluronic Acid',
      body: `Hyaluronic Acid fits ${ritualName}'s layered hydration. Apply it to slightly damp skin and follow with moisturiser to hold the water in.`,
    });
  }

  if (ritualKey === 'french' && shelf.length > 2) {
    findings.push({
      kind: 'caution',
      title: 'Restraint — La Pharmacie',
      body: `This tradition trusts fewer, clinical actives. Tonight, choose one treatment from your shelf and let it work rather than stacking the full set.`,
    });
  }

  return findings;
}
