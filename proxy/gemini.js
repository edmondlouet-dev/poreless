/**
 * Gemini routes — the app's AI calls go through here so the Gemini key never
 * ships inside the app.
 *
 * The app picks a task and sends only that task's inputs (a photo, a few
 * fields). The prompt, model and key all live here, so a stolen app build can
 * only ask the questions Poreless asks, never use the key as a free Gemini.
 */
const express = require('express');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL   = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

// Requests per client IP per minute across all /ai routes.
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? 20);
// ~4 MB of base64 ≈ a 3 MB JPEG; a quality 0.6 phone photo is well under that.
const MAX_IMAGE_CHARS = 4_000_000;

// ── input checks ───────────────────────────────────────────────────────────

class BadInput extends Error {}

function str(v, name, max) {
  if (typeof v !== 'string' || !v.trim()) throw new BadInput(`${name} is required`);
  if (v.length > max) throw new BadInput(`${name} is too long`);
  return v;
}

function image(v) {
  str(v, 'imageBase64', MAX_IMAGE_CHARS);
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(v)) throw new BadInput('imageBase64 must be base64');
  return v;
}

function num(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadInput(`${name} must be a number`);
  return n;
}

function optStr(v, fallback, max) {
  return typeof v === 'string' && v.trim() ? v.slice(0, max) : fallback;
}

// ── tasks: each turns validated input into { prompt, image? } ───────────────

// Shared rules for every photo task. The model describes how skin LOOKS in one
// photo; it never measures what skin is doing underneath (hydration, barrier,
// lymph), diagnoses, or promises that care will change bone structure.
const PHOTO_RULES =
  'Only describe what is visible in this one photo. Do not diagnose, name medical ' +
  'conditions, or guess at things a photo cannot show (skin water content, skin ' +
  'barrier function, lymph or fluid levels). Set photoUsable=false, with a short ' +
  'photoIssue such as "too dark", "face turned", "filter or heavy makeup", ' +
  '"face not fully visible" or "blurry", whenever the photo is not good enough to ' +
  'judge; never guess to fill the gap. Set seeDoctor=true, with a short neutral ' +
  'seeDoctorReason, only if you see something a GP or dermatologist should look at ' +
  '(for example a mole that looks irregular, an open or bleeding sore, a widespread ' +
  'rash, deep painful-looking cysts, or swelling around the eyes or lips).';

const TASKS = {
  'label-text': ({ ocrText }) => ({
    prompt:
      'You read skincare product labels. From the following OCR text of a label, ' +
      'return STRICT JSON with keys: name (string), brand (string), ingredients ' +
      '(array of lowercase INCI strings, max 12), category (one of: cleanser, ' +
      'antiox, serum, exfoliant, retinoid, moisturizer, spf). Only list ingredients ' +
      'that are actually written in the text; if none are legible, return an empty ' +
      'array. Never invent or guess ingredients: people rely on this list to avoid ' +
      'allergens. Use "" for an unknown name or brand. OCR TEXT:\n' +
      str(ocrText, 'ocrText', 4000),
  }),

  // flaggedConcerns is accepted for backwards compatibility but deliberately not
  // sent to the model: telling it what the user worries about biases it to find it.
  skin: ({ imageBase64 }) => ({
    image: image(imageBase64),
    prompt:
      'You describe the visible cosmetic appearance of facial skin in a selfie. ' +
      PHOTO_RULES + ' ' +
      'Score each item 0-100 where higher always means the issue is LESS visible: ' +
      'hydration (visible dryness or flaking; higher = less visibly dry), texture ' +
      '(visible roughness; higher = smoother-looking), pores (visible pore size; ' +
      'higher = less visible), redness (visible redness; higher = less red), oil ' +
      '(visible shine; higher = less shiny), acne (visible spots or blemishes; higher ' +
      '= fewer), tone (visible unevenness or dark patches; higher = more even). ' +
      'Redness and dark patches are harder to see on deeper skin tones; if you cannot ' +
      'judge them reliably, set photoUsable=false. Rate light as Low, Even or Bright. ' +
      'message: one plain sentence about what is visible, with no medical claims and ' +
      'no product advice. Return STRICT JSON: { "photoUsable": boolean, "photoIssue": ' +
      'string|null, "seeDoctor": boolean, "seeDoctorReason": string|null, "light": ' +
      'string, "hydration": number, "texture": number, "pores": number, "redness": ' +
      'number, "oil": number, "acne": number, "tone": number, "message": string }.',
  }),

  structure: ({ imageBase64 }) => ({
    image: image(imageBase64),
    prompt:
      'You give rough, neutral estimates of face proportions from a front-facing ' +
      'selfie. ' + PHOTO_RULES + ' Head tilt and camera angle change these numbers, ' +
      'so set photoUsable=false unless the face is straight-on and level. Return ' +
      'STRICT JSON: { "photoUsable": boolean, "photoIssue": string|null, ' +
      '"seeDoctor": boolean, "seeDoctorReason": string|null, "canthalTilt": number ' +
      '(degrees, outer eye corner relative to inner, negative = lower, range -6..6), ' +
      '"midfaceRatio": number (0.95..1.20), "fluidRetention": "Low"|"Moderate"|"High" ' +
      '(how puffy the face LOOKS in this photo only; puffiness changes with sleep, ' +
      'salt and time of day) }. These are normal variations, not problems to fix.',
  }),

  insight: ({ canthalTilt, midfaceRatio, fluidRetention, barrierStatus }) => ({
    prompt:
      'You write for a calm, evidence-led skincare app. In ONE short, kind paragraph ' +
      '(max 55 words, no bullet points, no numbers), describe this person\'s face ' +
      'proportions as neutral, normal variation. Never rank attractiveness, never ' +
      'call a feature a flaw, and never suggest that massage, skincare, gua sha or ' +
      '"mewing" can change bone structure, eye shape or symmetry: they cannot. You ' +
      'may mention that puffiness varies day to day and that gentle, consistent ' +
      'skincare and daily sunscreen are what help skin. Inputs (rough estimates from ' +
      `one photo) — eye tilt ${num(canthalTilt, 'canthalTilt')}°, midface ratio ` +
      `${num(midfaceRatio, 'midfaceRatio').toFixed(2)}, puffiness ` +
      `${optStr(fluidRetention, 'moderate', 20)}, skin feel (self-reported) ` +
      `${optStr(barrierStatus, 'not checked', 60)}. Return STRICT JSON: { "insight": string }.`,
  }),

  'product-image': ({ imageBase64, barrierStatus }) => ({
    image: image(imageBase64),
    prompt:
      'You read skincare product labels from a photo. Read the brand, product name ' +
      'and the visible ingredient list. Only list ingredients you can actually read; ' +
      'never invent or guess them, because people rely on this list to avoid ' +
      'allergens. Return STRICT JSON: { "readable": boolean, "brand": string, ' +
      '"name": string, "ingredients": string[] (lowercase INCI, max 12), "category": ' +
      'one of cleanser|antiox|serum|exfoliant|retinoid|moisturizer|spf, ' +
      '"conflictDetected": boolean, "warningText": string|null }. Set readable=false ' +
      'if the ingredient list cannot be made out. ' + CONFLICT_RULES(barrierStatus),
  }),

  'product-text': ({ rawLabelText, barrierStatus }) => ({
    prompt:
      'You read skincare product labels. From the OCR label text below, return ' +
      'STRICT JSON: { "brand": string, "name": string, "ingredients": string[] ' +
      '(lowercase INCI, max 12, only ones actually written in the text, never ' +
      'guessed), "category": one of cleanser|antiox|serum|exfoliant|retinoid|' +
      'moisturizer|spf, "conflictDetected": boolean, "warningText": string | null }. ' +
      CONFLICT_RULES(barrierStatus) + '\nOCR TEXT:\n' +
      str(rawLabelText, 'rawLabelText', 4000),
  }),
};

// The irritation rule both product tasks share. Barrier status is what the user
// told the app about how their skin feels, not something a scan measured.
function CONFLICT_RULES(barrierStatus) {
  return (
    'The user reports their skin currently feels "' +
    optStr(barrierStatus, 'not checked', 60) + '". Set conflictDetected true ONLY ' +
    'if the product contains a strong active (retinoid, AHA/BHA, benzoyl peroxide, ' +
    'high-strength vitamin C) AND the user reports their skin feels sensitive. ' +
    'warningText: one short, plain sentence on how to ease it in (for example a ' +
    'patch test or two nights a week); if the product contains a retinoid, also ' +
    'say retinoids are not recommended during pregnancy. Else null.'
  );
}

// ── rate limit: fixed one-minute window per client IP, in memory ────────────
// Good enough for a single proxy instance. Once auth is on, key this by user id.

const hits = new Map();
setInterval(() => hits.clear(), 60_000).unref();

function rateLimit(req, res, next) {
  const key = req.ip;
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  if (n > RATE_LIMIT) {
    res.set('Retry-After', '60');
    return res.status(429).json({ error: 'too many requests' });
  }
  next();
}

// ── Gemini call ────────────────────────────────────────────────────────────

async function callGemini({ prompt, image }) {
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image } });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        // Temperature 0: the same photo should give the same reading, so a change
        // between scans is the skin (or the light), not the model's dice roll.
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}

// ── router ─────────────────────────────────────────────────────────────────

const router = express.Router();

// GET /ai/health → { live } so the app can show a truthful LIVE/SIM badge.
router.get('/health', (_req, res) => res.json({ live: !!API_KEY }));

// POST /ai/:task  body = that task's inputs  →  the model's JSON
router.post('/:task', rateLimit, async (req, res) => {
  const build = Object.hasOwn(TASKS, req.params.task) ? TASKS[req.params.task] : null;
  if (!build) return res.status(404).json({ error: 'unknown task' });
  if (!API_KEY) return res.status(503).json({ error: 'AI is not configured' });

  let call;
  try {
    call = build(req.body ?? {});
  } catch (err) {
    return res.status(400).json({ error: err instanceof BadInput ? err.message : 'bad request' });
  }

  try {
    res.json(await callGemini(call));
  } catch (err) {
    console.error(`[proxy] /ai/${req.params.task} failed:`, err.message);
    res.status(502).json({ error: 'AI request failed' });
  }
});

module.exports = router;
