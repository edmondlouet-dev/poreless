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

const TASKS = {
  'label-text': ({ ocrText }) => ({
    prompt:
      'You are a cosmetic-label parser. From the following OCR text of a skincare ' +
      'product label, return STRICT JSON with keys: name (string), brand (string), ' +
      'ingredients (array of lowercase INCI strings, max 12), category (one of: ' +
      'cleanser, antiox, serum, exfoliant, retinoid, moisturizer, spf). ' +
      'If a field is unknown, infer the most likely value. OCR TEXT:\n' +
      str(ocrText, 'ocrText', 4000),
  }),

  skin: ({ imageBase64, flaggedConcerns }) => {
    const concerns = Array.isArray(flaggedConcerns)
      ? flaggedConcerns.filter(c => typeof c === 'string').slice(0, 10).map(c => c.slice(0, 40))
      : [];
    return {
      image: image(imageBase64),
      prompt:
        'You are a dermatology-grade skin analyzer. Score this selfie 0-100 for: ' +
        'overall, hydration, texture, pores, redness (higher = calmer), oil ' +
        '(higher = balanced), acne (higher = clearer), tone. Also rate light ' +
        '(Low/Even/Bright) and estimate camera distanceCm. Consider these user-' +
        'flagged concerns: ' + (concerns.join(', ') || 'none') + '. ' +
        'Return STRICT JSON with those keys plus confidence (0-1) and a one-line ' +
        'message field.',
    };
  },

  structure: ({ imageBase64 }) => ({
    image: image(imageBase64),
    prompt:
      'You are a facial-proportions analyst. From this front-facing selfie return ' +
      'STRICT JSON: canthalTilt (degrees, negative = downward, range -6..6), ' +
      'midfaceRatio (0.95..1.20), fluidRetention (Low/Moderate/High), ' +
      'barrierStatus (short phrase e.g. "Healthy / Resilient" or "Sensitive / Fatigued").',
  }),

  insight: ({ canthalTilt, midfaceRatio, fluidRetention, barrierStatus }) => ({
    prompt:
      'You are the lead writer for a luxury skincare magazine. In ONE warm, ' +
      'elegant paragraph (max 55 words, no bullet points, no numbers repeated ' +
      'mechanically), interpret this reader\'s facial geometry in a comforting, ' +
      'premium tone that makes them feel seen and capable. Metrics — canthal ' +
      `tilt ${num(canthalTilt, 'canthalTilt')}°, midface ratio ${num(midfaceRatio, 'midfaceRatio').toFixed(2)}, ` +
      `fluid retention ${optStr(fluidRetention, 'moderate', 20)}, barrier ` +
      `${optStr(barrierStatus, 'balanced', 60)}. Return STRICT JSON: { "insight": string }.`,
  }),

  'product-image': ({ imageBase64, barrierStatus }) => ({
    image: image(imageBase64),
    prompt:
      'You are an expert cosmetic chemist reading a skincare product label from ' +
      'this photo. Read the brand, product name, and the visible ingredient list. ' +
      'Return STRICT JSON: { "readable": boolean, "brand": string, "name": string, ' +
      '"ingredients": string[] (lowercase INCI, max 12), "category": one of ' +
      'cleanser|antiox|serum|exfoliant|retinoid|moisturizer|spf, "conflictDetected": ' +
      'boolean, "warningText": string|null }. Set readable=false if the label text ' +
      'truly cannot be made out. The user\'s barrier status is "' +
      optStr(barrierStatus, 'balanced', 60) +
      '". Set conflictDetected true ONLY if the product contains a strong active ' +
      '(retinoid, AHA/BHA, benzoyl peroxide, high-dose vitamin C) AND the barrier ' +
      'reads sensitive or fatigued. warningText: one short, reassuring sentence on ' +
      'how to ease it in, else null.',
  }),

  'product-text': ({ rawLabelText, barrierStatus }) => ({
    prompt:
      'You are an expert cosmetic chemist. From the OCR label text below, return ' +
      'STRICT JSON: { "brand": string, "name": string, "ingredients": string[] ' +
      '(lowercase INCI, max 12), "category": one of cleanser|antiox|serum|' +
      'exfoliant|retinoid|moisturizer|spf, "conflictDetected": boolean, ' +
      '"warningText": string | null }. The user\'s barrier status is "' +
      optStr(barrierStatus, 'balanced', 60) + '". Set conflictDetected true ONLY if the product contains ' +
      'a strong active (retinoid, AHA/BHA, benzoyl peroxide, high-dose vitamin C) ' +
      'AND the barrier reads sensitive or fatigued. warningText: one short, ' +
      'reassuring sentence on how to ease it in, else null.\nOCR TEXT:\n' +
      str(rawLabelText, 'rawLabelText', 4000),
  }),
};

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
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
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
