// ── Structural skin analytics + shelf inventory + synergy/blueprint logic ──────
// Pure data + logic (no JSX). Connective tissue between the Proportions scan,
// the Rituals traditions, and the Today routine.

export type FluidLevel = 'Low' | 'Moderate' | 'High';

export interface StructuralMetrics {
  canthalTilt: number;       // degrees — negative = downward tilt
  midfaceRatio: number;      // 1.0 ≈ balanced; >1.08 reads as mild asymmetry
  fluidRetention: FluidLevel;
  barrierStatus: string;     // e.g. 'Sensitive / Fatigued'
}

export interface ShelfItem {
  id: string;
  name: string;
  active: string;            // canonical chemical, lowercase
  tag: string;               // editorial label
}

export const DEFAULT_STRUCTURAL: StructuralMetrics = {
  canthalTilt: -2,
  midfaceRatio: 1.14,
  fluidRetention: 'Moderate',
  barrierStatus: 'Sensitive / Fatigued',
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
  french:       { drainage: 'micellar lymph wipe',    sculpt: 'roller cheek sculpt',  lift: 'serum pressure point', soothe: 'thermal-water mist' },
  ayurvedic:    { drainage: 'marma lymph abhyanga',   sculpt: 'kansa wand sculpt',    lift: 'netra-marma eye press',soothe: 'kumkumadi warm press' },
  african:      { drainage: 'shea-slip drainage',     sculpt: 'black-soap lift',      lift: 'baobab eye tap',       soothe: 'moringa balm press' },
  scandinavian: { drainage: 'cold-rinse lymph flush', sculpt: 'lagom cheek glide',    lift: 'cryo eye press',       soothe: 'cloudberry press' },
  greek:        { drainage: 'olive-oil effleurage',   sculpt: 'squalane cheek sculpt',lift: 'honey eye lift',       soothe: 'beeswax seal press' },
};

// ── Feature 1: Structural Sculpting Blueprint ──────────────────────────────────
export type BlueprintIcon = 'drainage' | 'sculpt' | 'lift' | 'soothe';

export interface BlueprintStep {
  icon: BlueprintIcon;
  title: string;
  body: string;
}

export function getStructuralBlueprint(ritualKey: string, m: StructuralMetrics): BlueprintStep[] {
  const t = TECHNIQUE[ritualKey] ?? TECHNIQUE.japanese;
  const steps: BlueprintStep[] = [];

  if (m.fluidRetention !== 'Low') {
    steps.push({
      icon: 'drainage',
      title: `${t.drainage}`,
      body: `Fluid retention reads ${m.fluidRetention.toLowerCase()}. Trace down from the inner brow along the jaw to the collarbone — three slow passes per side — to move lymph before product.`,
    });
  }

  if (m.midfaceRatio > 1.08) {
    steps.push({
      icon: 'sculpt',
      title: `${t.sculpt}`,
      body: `Midface ratio ${m.midfaceRatio.toFixed(2)} shows mild asymmetry. Sculpt the fuller cheek upward toward the temple, mirroring fewer passes on the lighter side to even the structure.`,
    });
  }

  if (m.canthalTilt < 0) {
    steps.push({
      icon: 'lift',
      title: `${t.lift}`,
      body: `Canthal tilt ${m.canthalTilt}° sits slightly downward. As eye serum absorbs, press up-and-out from the outer corner toward the tail of the brow — never drag inward.`,
    });
  }

  if (/sensiti|fatig/i.test(m.barrierStatus)) {
    steps.push({
      icon: 'soothe',
      title: `${t.soothe}`,
      body: `Barrier is ${m.barrierStatus.toLowerCase()}. Finish by pressing — not rubbing — the final layer in with warm palms to seal moisture and calm reactivity.`,
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
  const barrierFatigued = /sensiti|fatig/i.test(barrierStatus);
  const hasRetinol = has(shelf, 'retinol') || has(shelf, 'adapalene');
  const hasVitC    = has(shelf, 'vitamin c') || has(shelf, 'ascorbic');
  const hasHA      = has(shelf, 'hyaluronic');

  if (barrierFatigued && hasRetinol) {
    findings.push({
      kind: 'conflict',
      title: 'Conflict detected — Retinol',
      body: `Retinol contradicts the active barrier fatigue flagged in your last scan. The Harmonizer suggests replacing it with your Hyaluronic Acid to preserve the protective state of tonight's ${ritualName} tradition.`,
    });
  }

  if (hasVitC && hasRetinol) {
    findings.push({
      kind: 'caution',
      title: 'Timing — Vitamin C & Retinol',
      body: `Layered together these destabilise and over-sensitise. Keep Vitamin C to the morning and Retinol to alternate evenings so neither undercuts the other.`,
    });
  }

  if (hasHA) {
    findings.push({
      kind: 'synergy',
      title: 'Synergy — Hyaluronic Acid',
      body: `Hyaluronic Acid amplifies ${ritualName}'s layered hydration. Apply to skin still damp from the previous step so it draws moisture inward rather than pulling it from the barrier.`,
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
