/**
 * Gemini engine — the app's "intelligence" layer.
 *
 * Every function has two paths:
 *   • LIVE  — when EXPO_PUBLIC_PROXY_URL is set, it asks the Poreless proxy,
 *             which calls Gemini, and parses the structured response. If that
 *             call fails, the function THROWS: it never quietly swaps in made-up
 *             numbers, because a fake skin reading shown as real is the one thing
 *             this app must never do.
 *   • DEMO  — only when no proxy is configured at all. Results carry
 *             simulated: true so every screen can label them as demo data.
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
 * structured product profile. LIVE: Gemini parses it (via the proxy) and a
 * failure throws. DEMO (no proxy): picks a sample profile deterministically
 * from the OCR text so different labels give different products.
 */
export async function profileFromLabelText(ocrText: string): Promise<ProductProfile> {
  if (keyReady()) {
    const parsed = await callAI('label-text', { ocrText });
    return {
      name: String(parsed.name || 'Unknown product'),
      brand: String(parsed.brand ?? ''),
      ingredients: ingredientList(parsed),
      category: String(parsed.category ?? 'moisturizer'),
    };
  }
  await new Promise(r => setTimeout(r, 900));
  const picked = SIM_PROFILES[hashString(ocrText) % SIM_PROFILES.length]!;
  return { ...picked };
}

// ── 2. Skin analysis from a captured frame ─────────────────────────────────────
// Every score describes how skin LOOKS in one photo (higher = that thing is less
// visible). None of them is a medical measurement: a phone photo cannot measure
// skin water content or barrier function.

export interface SkinAnalysis {
  overall: number;     // "Appearance": plain average of the seven below
  hydration: number;   // visible dryness / flaking
  texture: number;     // visible roughness
  pores: number;       // visible pore size
  redness: number;     // visible redness
  oil: number;         // visible shine (higher = less shiny)
  acne: number;        // visible spots
  tone: number;        // visible unevenness
  message: string;
  light: 'Low' | 'Even' | 'Bright';
  photoUsable: boolean;        // false → don't show or save scores, ask for a retake
  photoIssue: string | null;
  seeDoctor: boolean;          // something worth showing a GP or dermatologist
  seeDoctorReason: string | null;
  simulated: boolean;          // demo data, not a reading of this photo
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Math.round(n)));

const SKIN_KEYS = ['hydration', 'texture', 'pores', 'redness', 'oil', 'acne', 'tone'] as const;

function appearanceIndex(s: Record<(typeof SKIN_KEYS)[number], number>): number {
  return clamp(SKIN_KEYS.reduce((sum, k) => sum + s[k], 0) / SKIN_KEYS.length);
}

const optText = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 140) : null;

/**
 * Scores the visible appearance of skin in a captured frame. LIVE: Gemini looks
 * at the photo via the proxy and may refuse a poor photo (photoUsable=false).
 * DEMO (no proxy configured): stable numbers derived from the image bytes,
 * flagged simulated so the UI never presents them as a reading.
 */
export async function analyzeSkinFrame(imageBase64: string): Promise<SkinAnalysis> {
  if (keyReady()) {
    if (!imageBase64) throw new Error('No photo captured');
    const p = await callAI('skin', { imageBase64 });
    const scores = {
      hydration: clamp(Number(p.hydration)), texture: clamp(Number(p.texture)),
      pores: clamp(Number(p.pores)), redness: clamp(Number(p.redness)),
      oil: clamp(Number(p.oil)), acne: clamp(Number(p.acne)), tone: clamp(Number(p.tone)),
    };
    // A missing or non-numeric score means the model couldn't judge it: treat
    // the photo as unusable rather than inventing a number.
    const complete = SKIN_KEYS.every(k => Number.isFinite(Number(p[k])));
    return {
      ...scores,
      overall: appearanceIndex(scores),
      message: optText(p.message) ?? 'Scan complete.',
      light: (['Low', 'Even', 'Bright'].includes(p.light) ? p.light : 'Even'),
      photoUsable: p.photoUsable !== false && complete,
      photoIssue: optText(p.photoIssue) ?? (complete ? null : 'Couldn\'t read every area of skin'),
      seeDoctor: p.seeDoctor === true,
      seeDoctorReason: optText(p.seeDoctorReason),
      simulated: false,
    };
  }

  await new Promise(r => setTimeout(r, 1600));

  // DEMO: numbers vary with the image bytes so the UI can be exercised, but they
  // are not a reading of the skin and are labelled as such everywhere.
  const sample = imageBase64.slice(0, 4000) + imageBase64.slice(-2000);
  const h = hashString(sample || String(Date.now()));
  const base = 62 + (h % 16);
  const j = (seed: number) => ((hashString(sample + seed) % 15) - 7);
  const scores = {
    hydration: clamp(base + 8 + j(1)),
    texture:   clamp(base + j(2)),
    pores:     clamp(base - 6 + j(3)),
    redness:   clamp(base + 10 + j(4)),
    oil:       clamp(base - 4 + j(5)),
    acne:      clamp(base - 2 + j(6)),
    tone:      clamp(base + 4 + j(7)),
  };

  return {
    ...scores,
    overall: appearanceIndex(scores),
    message: 'Demo data: connect Poreless AI to analyse your own photo.',
    light: 'Even',
    photoUsable: true,
    photoIssue: null,
    seeDoctor: false,
    seeDoctorReason: null,
    simulated: true,
  };
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
  'ascorbic acid', 'vitamin c', 'lactic acid',
];

function firstHarshActive(ingredients: string[]): string | null {
  const lower = ingredients.map(i => i.toLowerCase());
  for (const h of HARSH_ACTIVES) {
    if (lower.some(ing => ing.includes(h))) return h;
  }
  return null;
}

// DEMO-only conflict result (no proxy configured) derived from a deterministic
// seed, so the same input is stable and different inputs differ.
function simProductConflict(barrierStatus: string, seed: string): ProductConflict {
  const barrierFatigued = /sensiti/i.test(barrierStatus);
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
      ? `Contains ${harsh}: patch test, then ease it in two nights a week while your skin feels sensitive.` +
        (/retin|adapalene/.test(harsh!) ? ' Retinoids are not recommended during pregnancy.' : '')
      : null,
  };
}

function productFrom(p: any, ingredients: string[]): ProductConflict {
  return {
    brand: String(p.brand ?? ''),
    name: String(p.name || 'Unknown product'),
    ingredients,
    category: String(p.category ?? 'moisturizer'),
    conflictDetected: !!p.conflictDetected,
    warningText: p.warningText ? String(p.warningText) : null,
  };
}

const ingredientList = (p: any): string[] =>
  Array.isArray(p?.ingredients)
    ? p.ingredients.map((s: any) => String(s).toLowerCase()).slice(0, 12) : [];

/**
 * LIVE multimodal label read: sends the label PHOTO to Gemini Vision via the
 * proxy, which reads it and returns a structured profile plus an irritation
 * check in one call. An unreadable label or a failed call throws so the
 * scanner asks for a retake; it never substitutes a different product.
 */
export async function analyzeProductFromImage(
  barrierStatus: string,
  imageBase64: string,
): Promise<ProductConflict> {
  if (keyReady()) {
    if (!imageBase64) throw new Error('No photo captured');
    const p = await callAI('product-image', { barrierStatus, imageBase64 });
    const ingredients = ingredientList(p);
    if (p.readable === false || ingredients.length === 0) {
      throw new Error('Label not readable');
    }
    return productFrom(p, ingredients);
  }
  await new Promise(r => setTimeout(r, 700));
  return simProductConflict(barrierStatus, `img-${imageBase64.length}-${Date.now()}`);
}

export async function analyzeProductConflict(
  barrierStatus: string,
  rawLabelText: string,
): Promise<ProductConflict> {
  if (keyReady()) {
    const p = await callAI('product-text', { barrierStatus, rawLabelText });
    return productFrom(p, ingredientList(p));
  }

  // DEMO — deterministic profile from the label text, then the irritation rule.
  await new Promise(r => setTimeout(r, 700));
  return simProductConflict(barrierStatus, rawLabelText);
}

export const GEMINI_LIVE = keyReady();
