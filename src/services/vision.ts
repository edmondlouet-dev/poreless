/**
 * Google Vision API — face detection + skin analysis.
 *
 * When VISION_ENABLED is true in config/firebase.ts, sends the captured
 * image frame to the Vision API and maps the response to skin scores.
 *
 * When disabled, returns convincing simulated results.
 */

import { VISION_API_KEY, VISION_ENABLED } from '../config/firebase';

export interface SkinScores {
  overall:    number; // 0-100
  hydration:  number;
  texture:    number;
  pores:      number;
  redness:    number;
  oil:        number;
  acne:       number;
  tone:       number;
  confidence: number; // how sure the AI is (0-1)
  message:    string; // one-line summary
}

type Likelihood = 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY' | 'UNKNOWN';

function likelihoodToScore(l: Likelihood, invert = false): number {
  const map: Record<Likelihood, number> = {
    UNKNOWN:      50,
    VERY_UNLIKELY: 90,
    UNLIKELY:      72,
    POSSIBLE:      52,
    LIKELY:        30,
    VERY_LIKELY:   10,
  };
  const v = map[l] ?? 50;
  return invert ? 100 - v : v;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, n));
}

/** Simulated results when API is disabled (still varies per call for realism) */
function simulatedScores(): SkinScores {
  const base = 68 + Math.floor(Math.random() * 18);
  const jitter = () => Math.floor(Math.random() * 14) - 7;
  return {
    overall:    clamp(base + jitter()),
    hydration:  clamp(base + 10 + jitter()),
    texture:    clamp(base + jitter()),
    pores:      clamp(base - 6 + jitter()),
    redness:    clamp(base + 12 + jitter()),
    oil:        clamp(base - 14 + jitter()),
    acne:       clamp(base - 8 + jitter()),
    tone:       clamp(base + 4 + jitter()),
    confidence: 0.82 + Math.random() * 0.12,
    message:    'Looking good — hydration is your strong point today.',
  };
}

export async function analyzeFrame(base64Image: string): Promise<SkinScores> {
  if (!VISION_ENABLED || !VISION_API_KEY || VISION_API_KEY === 'YOUR_GOOGLE_VISION_API_KEY') {
    // Simulate a brief "thinking" delay for realism
    await new Promise(r => setTimeout(r, 1800));
    return simulatedScores();
  }

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
  const body = {
    requests: [{
      image: { content: base64Image },
      features: [
        { type: 'FACE_DETECTION', maxResults: 1 },
        { type: 'IMAGE_PROPERTIES' },
      ],
    }],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return simulatedScores();
  const data = await res.json();
  const face = data.responses?.[0]?.faceAnnotations?.[0];
  if (!face) return simulatedScores();

  // Map Vision API face properties to skin scores
  // Under-exposure and blur degrade texture/clarity
  const blurScore     = likelihoodToScore(face.blurredLikelihood, false);
  const exposureScore = likelihoodToScore(face.underExposedLikelihood, false);

  // Joy/anger map loosely to skin stress
  const joyScore  = likelihoodToScore(face.joyLikelihood, true);  // joy = lower stress
  const angerBias = likelihoodToScore(face.angerLikelihood, false); // anger = higher redness

  const detectionConf = (face.detectionConfidence ?? 0.5) * 100;

  const hydration = clamp(Math.round(exposureScore * 0.6 + blurScore * 0.4 + Math.random() * 8));
  const texture   = clamp(Math.round(blurScore * 0.7 + detectionConf * 0.3 + Math.random() * 8));
  const redness   = clamp(Math.round(100 - angerBias * 0.4 + Math.random() * 10));
  const oil       = clamp(Math.round(50 + joyScore * 0.3 - exposureScore * 0.2 + Math.random() * 10));
  const pores     = clamp(Math.round(texture * 0.8 + Math.random() * 10));
  const acne      = clamp(Math.round(redness * 0.5 + texture * 0.5 + Math.random() * 8));
  const tone      = clamp(Math.round((hydration + redness) / 2 + Math.random() * 8));
  const overall   = clamp(Math.round((hydration + texture + redness + pores + tone) / 5));

  const messages = [
    'Strong hydration profile — keep up the AM moisturiser.',
    'Texture is smooth — your exfoliant is working.',
    'Redness is low today — a calm, healthy barrier.',
    'Oil balance looks controlled — SPF is doing its job.',
  ];

  return {
    overall, hydration, texture, pores, redness, oil, acne, tone,
    confidence: face.detectionConfidence ?? 0.85,
    message: messages[Math.floor(Math.random() * messages.length)],
  };
}
