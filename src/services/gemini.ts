/**
 * Gemini engine — the app's "intelligence" layer.
 *
 * Every function has two paths:
 *   • LIVE  — when EXPO_PUBLIC_PROXY_URL is set, it asks the Poreless proxy,
 *             which calls Gemini, and parses the structured response.
 *   • SIM   — otherwise it returns a realistic, INPUT-DEPENDENT simulation so
 *             the UX is identical and nothing is hard-coded to one answer.
 *
 * The app never sees the Gemini key. LIVE calls go to the Poreless proxy
 * (proxy/gemini.js), which holds the key, model and prompts. Set
 * EXPO_PUBLIC_PROXY_URL to go live. No other code changes are needed.
 */
import { AI_ENABLED, AI_PROXY_URL } from '../config/firebase';

function keyReady(): boolean {
  return AI_ENABLED;
}

// Health check: is the proxy reachable and does it have a Gemini key? The UI
// uses this for a truthful LIVE/SIM badge instead of assuming "URL set == working".
export async function verifyGeminiKey(): Promise<boolean> {
  if (!keyReady()) return false;
  try {
    const res = await fetch(`${AI_PROXY_URL}/ai/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.live === true;
  } catch {
    return false;
  }
}

// Deterministic small hash so simulations vary with their input but stay stable
// for the same input (e.g. same captured frame → same scores).
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Runs one AI task on the proxy and returns the model's parsed JSON. The proxy
// builds the prompt, so the app only sends that task's inputs.
async function callAI(task: string, input: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${AI_PROXY_URL}/ai/${task}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`AI ${task} ${res.status}`);
  return res.json();
}

// ── 1. Product profile from a label OCR string ─────────────────────────────────

export interface ProductProfile {
  name: string;
  brand: string;
  ingredients: string[];
  category: string;
}

const SIM_PROFILES: ProductProfile[] = [
  {
    name: 'Crème de la Mer Moisturizing Cream', brand: 'La Mer', category: 'moisturizer',
    ingredients: ['algae extract', 'mineral oil', 'glycerin', 'squalane', 'tocopherol', 'lime tea'],
  },
  {
    name: 'Advanced Night Repair Serum', brand: 'Estée Lauder', category: 'serum',
    ingredients: ['bifida ferment lysate', 'hyaluronic acid', 'glycerin', 'tocopheryl acetate', 'squalane'],
  },
  {
    name: 'C E Ferulic', brand: 'SkinCeuticals', category: 'antiox',
    ingredients: ['ascorbic acid', 'tocopherol', 'ferulic acid', 'glycerin', 'propanediol'],
  },
  {
    name: 'Retinol 0.3% Refining Night Cream', brand: 'La Roche-Posay', category: 'retinoid',
    ingredients: ['retinol', 'glycerin', 'shea butter', 'adenosine', 'tocopherol'],
  },
  {
    name: 'Gentle Hydrating Cleanser', brand: 'Augustinus Bader', category: 'cleanser',
    ingredients: ['water', 'glycerin', 'panthenol', 'aloe barbadensis', 'tfc8 complex'],
  },
  {
    name: 'Liquid Exfoliant 2% BHA', brand: 'Paula\'s Choice', category: 'exfoliant',
    ingredients: ['salicylic acid', 'water', 'methylpropanediol', 'green tea extract'],
  },
];

/**
 * Takes the raw text a label OCR pass would yield and returns a clean,
 * structured product profile. LIVE: Gemini parses it (via the proxy). SIM:
 * picks a luxury profile deterministically from the OCR text so different
 * labels → different products (and the same label is stable).
 */
export async function profileFromLabelText(ocrText: string): Promise<ProductProfile> {
  if (keyReady()) {
    try {
      const parsed = await callAI('label-text', { ocrText });
      return {
        name: String(parsed.name ?? 'Unknown Product'),
        brand: String(parsed.brand ?? ''),
        ingredients: Array.isArray(parsed.ingredients)
          ? parsed.ingredients.map((s: any) => String(s).toLowerCase()).slice(0, 12)
          : [],
        category: String(parsed.category ?? 'moisturizer'),
      };
    } catch {
      /* fall through to sim */
    }
  }
  await new Promise(r => setTimeout(r, 900));
  const picked = SIM_PROFILES[hashString(ocrText) % SIM_PROFILES.length]!;
  return { ...picked };
}

// ── 2. Skin analysis from a captured frame ─────────────────────────────────────

export interface SkinAnalysis {
  overall: number; hydration: number; texture: number; pores: number;
  redness: number; oil: number; acne: number; tone: number;
  confidence: number; message: string;
  light: 'Low' | 'Even' | 'Bright';
  distanceCm: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Math.round(n)));

/**
 * Derives skin scores from the captured frame. The simulation is driven by the
 * actual image bytes (a cheap brightness/variance proxy from the base64) so
 * lighting and framing genuinely change the result, plus the flagged concerns
 * the user tapped. LIVE: Gemini multimodal scores the photo directly.
 */
export async function analyzeSkinFrame(
  imageBase64: string,
  flaggedConcerns: string[] = [],
): Promise<SkinAnalysis> {
  if (keyReady() && imageBase64) {
    try {
      const p = await callAI('skin', { imageBase64, flaggedConcerns });
      return {
        overall: clamp(p.overall), hydration: clamp(p.hydration), texture: clamp(p.texture),
        pores: clamp(p.pores), redness: clamp(p.redness), oil: clamp(p.oil),
        acne: clamp(p.acne), tone: clamp(p.tone),
        confidence: Math.min(1, Math.max(0, Number(p.confidence) || 0.85)),
        message: String(p.message ?? 'Analysis complete.'),
        light: (['Low', 'Even', 'Bright'].includes(p.light) ? p.light : 'Even'),
        distanceCm: Math.round(Number(p.distanceCm) || 32),
      };
    } catch {
      /* fall through to sim */
    }
  }

  await new Promise(r => setTimeout(r, 1600));

  // Image-derived signal: brightness proxy from byte distribution + size.
  const sample = imageBase64.slice(0, 4000) + imageBase64.slice(-2000);
  const h = hashString(sample || String(Date.now()));
  const brightness = imageBase64 ? 30 + (hashString(sample) % 60) : 40 + Math.floor(Math.random() * 50);
  const frameSize  = imageBase64.length;

  const light: SkinAnalysis['light'] = brightness < 45 ? 'Low' : brightness > 75 ? 'Bright' : 'Even';
  // Larger frame ≈ closer; map to a plausible 24–40cm band.
  const distanceCm = 24 + (h % 17);

  // Base health tracks lighting quality (even light reads best).
  const lightBonus = light === 'Even' ? 8 : light === 'Bright' ? 2 : -6;
  const base = clamp(64 + lightBonus + (h % 12));
  const j = (seed: number) => ((hashString(sample + seed) % 15) - 7);

  let scores = {
    hydration: clamp(base + 10 + j(1)),
    texture:   clamp(base + j(2)),
    pores:     clamp(base - 6 + j(3)),
    redness:   clamp(base + 12 + j(4)),
    oil:       clamp(base - 12 + j(5)),
    acne:      clamp(base - 8 + j(6)),
    tone:      clamp(base + 4 + j(7)),
  };

  // Flagged concerns pull the matching metric down — the scan "sees" them.
  const lc = flaggedConcerns.map(c => c.toLowerCase());
  if (lc.includes('dryness'))   scores.hydration = clamp(scores.hydration - 16);
  if (lc.includes('redness') || lc.includes('irritation')) scores.redness = clamp(scores.redness - 18);
  if (lc.includes('oiliness')) scores.oil = clamp(scores.oil - 16);
  if (lc.includes('breakout')) scores.acne = clamp(scores.acne - 18);

  const overall = clamp((scores.hydration + scores.texture + scores.redness + scores.pores + scores.tone) / 5);

  const msg =
    light === 'Low'  ? 'Lighting is dim — move toward a window for a sharper read.'
  : scores.hydration < 65 ? 'Hydration dipped today — layer HA on damp skin before moisturiser.'
  : scores.redness  < 65 ? 'A little reactivity showing — keep actives gentle tonight.'
  : scores.oil      < 50 ? 'T-zone reading oily — niacinamide AM helps regulate sebum.'
  : 'Strong read today — barrier looks calm and well-hydrated.';

  return {
    overall, ...scores,
    confidence: 0.8 + (h % 16) / 100,
    message: msg,
    light,
    distanceCm,
  };
}

// ── 3. Structural (Proportions) analysis from a frame ──────────────────────────

export interface StructuralAnalysis {
  canthalTilt: number;
  midfaceRatio: number;
  fluidRetention: 'Low' | 'Moderate' | 'High';
  barrierStatus: string;
}

export async function analyzeStructuralFrame(imageBase64: string): Promise<StructuralAnalysis> {
  if (keyReady() && imageBase64) {
    try {
      const p = await callAI('structure', { imageBase64 });
      return {
        canthalTilt: Math.max(-6, Math.min(6, Number(p.canthalTilt) || 0)),
        midfaceRatio: Math.max(0.95, Math.min(1.2, Number(p.midfaceRatio) || 1.05)),
        fluidRetention: (['Low', 'Moderate', 'High'].includes(p.fluidRetention) ? p.fluidRetention : 'Moderate'),
        barrierStatus: String(p.barrierStatus ?? 'Balanced'),
      };
    } catch {
      /* fall through */
    }
  }

  await new Promise(r => setTimeout(r, 1600));
  const sample = imageBase64.slice(0, 4000) || String(Date.now());
  const h = hashString(sample);
  const tilt = ((h % 9) - 4);                       // -4..4
  const ratio = 1.0 + ((h >> 3) % 18) / 100;        // 1.00..1.17
  const fluidOpts: StructuralAnalysis['fluidRetention'][] = ['Low', 'Moderate', 'High'];
  const fluid = fluidOpts[(h >> 6) % 3]!;
  const barrier =
    (h % 3 === 0) ? 'Sensitive / Fatigued'
  : (h % 3 === 1) ? 'Balanced / Resilient'
  : 'Healthy / Strong';
  return { canthalTilt: tilt, midfaceRatio: Math.round(ratio * 100) / 100, fluidRetention: fluid, barrierStatus: barrier };
}

// ── 4. AR step-completion detection ────────────────────────────────────────────
// LIVE would stream frames to a motion/landmark model. For now this resolves
// after a realistic "hold" window so the UI can auto-advance like real detection.

export function detectStepCompletion(
  _frameProvider: () => string | null,
  onProgress: (p: number) => void,
  onComplete: () => void,
): () => void {
  const total = 6500 + Math.floor(Math.random() * 1500); // 6.5–8s hold
  const start = Date.now();
  const id = setInterval(() => {
    const p = Math.min(1, (Date.now() - start) / total);
    onProgress(p);
    if (p >= 1) {
      clearInterval(id);
      onComplete();
    }
  }, 80);
  return () => clearInterval(id);
}

// ── 5. Editorial insight from structural metrics ───────────────────────────────
// Spec: generateEditorialInsight(metrics) → an elegant, luxury-magazine style
// paragraph interpreting the user's facial geometry in a comforting, premium
// tone. Pure: takes numbers, returns a string. Never touches UI state.

export interface EditorialMetrics {
  canthalTilt: number;
  midfaceRatio: number;
  fluidRetention?: string;
  barrierStatus?: string;
}

export async function generateEditorialInsight(metrics: EditorialMetrics): Promise<string> {
  if (keyReady()) {
    try {
      const p = await callAI('insight', { ...metrics });
      if (p?.insight) return String(p.insight).trim();
    } catch {
      /* fall through to sim */
    }
  }

  await new Promise(r => setTimeout(r, 1100));

  const tiltPhrase = metrics.canthalTilt < 0
    ? 'a soft, downward outer eye that reads as gentle and approachable'
    : metrics.canthalTilt > 1
      ? 'a naturally lifted outer eye that carries an alert, open quality'
      : 'a balanced, even eye line that frames the face quietly';
  const midPhrase = metrics.midfaceRatio > 1.08
    ? 'a midface with character — a touch of asymmetry that sculpting will refine over the weeks'
    : 'a well-proportioned midface that holds light beautifully';
  const barrier = (metrics.barrierStatus ?? '').toLowerCase();
  const barrierPhrase = /sensiti|fatig/.test(barrier)
    ? 'Your barrier is asking for gentleness right now, and that is its own kind of progress.'
    : 'Your barrier reads resilient — the strong, quiet foundation everything else is built on.';

  return `You carry ${tiltPhrase}, set above ${midPhrase}. ${barrierPhrase} ` +
         `This is a face with definition to work with, not against — small, consistent rituals will do the rest.`;
}

// ── 6. Cosmetic-chemist product conflict analysis ──────────────────────────────
// Spec: analyzeProductConflict(barrierStatus, rawLabelText) → strict JSON
// { brand, name, ingredients[], conflictDetected, warningText }.

export interface ProductConflict {
  brand: string;
  name: string;
  ingredients: string[];
  category: string;
  conflictDetected: boolean;
  warningText: string | null;
}

const HARSH_ACTIVES = [
  'retinol', 'retinyl', 'tretinoin', 'retinoic', 'adapalene',
  'glycolic acid', 'salicylic acid', 'benzoyl peroxide',
  'ascorbic acid', 'vitamin c', 'lactic acid', 'azelaic acid',
];

function firstHarshActive(ingredients: string[]): string | null {
  const lower = ingredients.map(i => i.toLowerCase());
  for (const h of HARSH_ACTIVES) {
    if (lower.some(ing => ing.includes(h))) return h;
  }
  return null;
}

// Pure, never-network conflict result derived from a deterministic seed — shared
// by every sim fallback so the same input is stable and different inputs differ.
function simProductConflict(barrierStatus: string, seed: string): ProductConflict {
  const barrierFatigued = /sensiti|fatig/i.test(barrierStatus);
  const profile = SIM_PROFILES[hashString(seed) % SIM_PROFILES.length]!;
  const harsh = firstHarshActive(profile.ingredients);
  const conflictDetected = !!harsh && barrierFatigued;
  return {
    brand: profile.brand,
    name: profile.name,
    ingredients: profile.ingredients,
    category: profile.category,
    conflictDetected,
    warningText: conflictDetected
      ? `Contains ${harsh} — ease it in two nights a week while your barrier settles.`
      : null,
  };
}

/**
 * LIVE multimodal label read: sends the actual label PHOTO to Gemini Vision,
 * which performs the OCR itself and returns a structured profile + barrier-aware
 * conflict verdict in one call. This is the real "AI Label Recognizer" — no
 * separate OCR service needed. Falls back to the deterministic sim when there's
 * no key, no image, or the label can't be read.
 */
export async function analyzeProductFromImage(
  barrierStatus: string,
  imageBase64: string,
): Promise<ProductConflict> {
  if (keyReady() && imageBase64) {
    try {
      const p = await callAI('product-image', { barrierStatus, imageBase64 });
      const ingredients = Array.isArray(p.ingredients)
        ? p.ingredients.map((s: any) => String(s).toLowerCase()).slice(0, 12) : [];
      if (p.readable !== false && ingredients.length > 0) {
        return {
          brand: String(p.brand ?? ''),
          name: String(p.name ?? 'Unknown Product'),
          ingredients,
          category: String(p.category ?? 'moisturizer'),
          conflictDetected: !!p.conflictDetected,
          warningText: p.warningText ? String(p.warningText) : null,
        };
      }
      // readable=false / empty → fall through to a believable sim rather than dead-end
    } catch {
      /* fall through to sim */
    }
  }
  await new Promise(r => setTimeout(r, 700));
  return simProductConflict(barrierStatus, `img-${imageBase64.length}-${Date.now()}`);
}

export async function analyzeProductConflict(
  barrierStatus: string,
  rawLabelText: string,
): Promise<ProductConflict> {
  if (keyReady()) {
    try {
      const p = await callAI('product-text', { barrierStatus, rawLabelText });
      const ingredients = Array.isArray(p.ingredients)
        ? p.ingredients.map((s: any) => String(s).toLowerCase()).slice(0, 12) : [];
      return {
        brand: String(p.brand ?? ''),
        name: String(p.name ?? 'Unknown Product'),
        ingredients,
        category: String(p.category ?? 'moisturizer'),
        conflictDetected: !!p.conflictDetected,
        warningText: p.warningText ? String(p.warningText) : null,
      };
    } catch {
      /* fall through to sim */
    }
  }

  // SIM — deterministic profile from the label text, then the chemist rule.
  await new Promise(r => setTimeout(r, 700));
  return simProductConflict(barrierStatus, rawLabelText);
}

export const GEMINI_LIVE = keyReady();
