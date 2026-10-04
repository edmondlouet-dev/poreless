// ── Shared skincare-tradition data ─────────────────────────────────────────────
// Consumed by both the Rituals screen and the Today routine so a chosen ritual
// can adapt tomorrow's routine.

import { CATALOG, type ProductCategory } from './products';

export interface RecommendedProduct {
  name: string;
  brand: string;
  why: string;
  buyUrl: string;
}

export interface Ritual {
  key: string;
  culture: string;
  name: string;
  tagline: string;
  description: string;
  steps: string[];
  benefits: string[];
  bestFor: string[];
  duration: string;
  philosophy: string;
  recommended: RecommendedProduct;
}

const SEPHORA = (q: string) => `https://www.sephora.com/search?keyword=${encodeURIComponent(q)}`;

export const RITUALS: Ritual[] = [
  {
    key: 'japanese',
    culture: 'Japanese',
    name: 'Mizu no Te',
    tagline: 'Water as ritual',
    description:
      'Japanese skincare is rooted in *mottainai* — nothing wasted. The focus is on gentle cleansing, deep hydration through layered toners (lotion), and a respect for the skin\'s natural state. Less is treated as more.',
    steps: ['Oil cleanse', 'Foam cleanse', 'Lotion (hydrating toner)', 'Essence', 'SPF (AM) / serum (PM)'],
    benefits: ['Exceptional hydration', 'Prevents over-stripping', 'Refined texture over time'],
    bestFor: ['dryness', 'texture', 'redness'],
    duration: '10 min',
    philosophy: 'Respect the barrier. Hydrate in layers.',
    recommended: {
      name: 'Hatomugi Hydrating Lotion',
      brand: 'Imju · Naturie',
      why: 'A featherweight Job\'s-tears lotion built for the lotion-layering step — floods the barrier without a single heavy occlusive.',
      buyUrl: SEPHORA('japanese hydrating lotion toner'),
    },
  },
  {
    key: 'korean',
    culture: 'Korean',
    name: 'Yuri Pibu',
    tagline: 'Glass skin method',
    description:
      'K-beauty popularised the concept of glass skin — a luminous, poreless finish achieved through a multi-step layering protocol. Ingredients like snail mucin, centella, and niacinamide are central.',
    steps: ['Double cleanse', 'Exfoliant (2–3×/week)', 'Toner', 'Essence', 'Sheet mask (2×/week)', 'Serum', 'Eye cream', 'Moisturiser', 'SPF'],
    benefits: ['Maximum glow', 'Deep pore care', 'Intensive ingredient layering'],
    bestFor: ['acne', 'pores', 'tone'],
    duration: '20 min',
    philosophy: 'More steps, more glow. Patience over shortcuts.',
    recommended: {
      name: 'Advanced Snail 96 Mucin Essence',
      brand: 'COSRX',
      why: 'The quintessential glass-skin essence — 96% snail secretion to layer hydration and smooth texture between toner and serum.',
      buyUrl: SEPHORA('snail mucin essence'),
    },
  },
  {
    key: 'french',
    culture: 'French',
    name: 'La Pharmacie',
    tagline: 'Pharmacy over counter',
    description:
      'French dermatological tradition trusts science over trends. Micellar water, minimal actives, and pharmacy-grade formulas. Fewer products, clinically tested. The idea: a well-maintained skin doesn\'t need to hide.',
    steps: ['Micellar water (no rubbing)', 'Light moisturiser', 'SPF', 'Targeted serum PM only'],
    benefits: ['Reduced sensitivity', 'Clean barrier', 'No fragrance overload'],
    bestFor: ['redness', 'dryness', 'aging'],
    duration: '5 min',
    philosophy: 'Trust the pharmacy. Less product, more science.',
    recommended: {
      name: 'Sensibio H2O Micellar Water',
      brand: 'Bioderma',
      why: 'The French pharmacy icon — lifts the day off without rubbing, ideal for the fatigued, reactive barrier your scan flagged.',
      buyUrl: SEPHORA('bioderma micellar water'),
    },
  },
  {
    key: 'ayurvedic',
    culture: 'Ayurvedic',
    name: 'Dinacharya',
    tagline: 'Daily sacred practice',
    description:
      'Rooted in 5,000 years of Vedic medicine, Ayurvedic skincare addresses the skin as a mirror of internal health. Abhyanga (self-massage with warm oils), turmeric, neem, and rose water are pillars of the practice.',
    steps: ['Cleanse with gram flour / neem paste', 'Rose water toner', 'Kumkumadi face oil (drops)', 'Turmeric-honey mask (2×/week)', 'Facial abhyanga massage'],
    benefits: ['Deep nourishment', 'Anti-inflammatory', 'Improves circulation', 'Mind-skin connection'],
    bestFor: ['darkspots', 'dryness', 'acne'],
    duration: '15 min',
    philosophy: 'The skin is the body\'s outermost mind.',
    recommended: {
      name: 'Kumkumadi Tailam Face Oil',
      brand: 'Forest Essentials',
      why: 'The saffron-and-herb oil at the heart of abhyanga — drops glide for the lymphatic massage your structural blueprint calls for.',
      buyUrl: SEPHORA('kumkumadi face oil'),
    },
  },
  {
    key: 'african',
    culture: 'West African',
    name: 'Ubuntu Skin',
    tagline: 'What the earth gives',
    description:
      'West African skincare traditions lean on raw, whole ingredients — black soap from plantain ash and cocoa pod, shea butter from the karite tree, and moringa oil. These are among the richest natural actives known.',
    steps: ['African black soap cleanse', 'Rosehip oil serum', 'Shea butter moisturise', 'Moringa SPF blend (AM)'],
    benefits: ['Intense barrier repair', 'Hyperpigmentation fading', 'Rich in vitamins A, E, F'],
    bestFor: ['darkspots', 'dryness', 'texture'],
    duration: '8 min',
    philosophy: 'Nature\'s chemistry, unprocessed.',
    recommended: {
      name: 'Unrefined Ivory Shea Butter',
      brand: 'Karité Collective',
      why: 'Whole, cold-pressed shea for the seal step — vitamins A and E rebuild a depleted barrier overnight.',
      buyUrl: SEPHORA('raw unrefined shea butter'),
    },
  },
  {
    key: 'scandinavian',
    culture: 'Scandinavian',
    name: 'Lagom',
    tagline: 'Not too much, not too little',
    description:
      'Scandinavian skincare embraces *lagom* — just the right amount. Cold water rinses, stripped-back routines, and a belief that skin heals best when left to its own devices. Inspired by Nordic climate survival.',
    steps: ['Cold water rinse', 'Gentle fragrance-free cleanser', 'Nordic cloudberry moisturiser', 'Mineral SPF'],
    benefits: ['Barrier strength', 'No fragrance irritation', 'Resilient to climate extremes'],
    bestFor: ['redness', 'acne', 'sensitive'],
    duration: '4 min',
    philosophy: 'Resilience over intervention.',
    recommended: {
      name: 'Cloudberry Brightening Cream',
      brand: 'Lumene',
      why: 'Arctic cloudberry and a fragrance-free base — the restrained moisturiser this tradition is built around, kind to a sensitive barrier.',
      buyUrl: SEPHORA('cloudberry moisturizer'),
    },
  },
  {
    key: 'greek',
    culture: 'Ancient Greek',
    name: 'Kairos',
    tagline: 'The right moment',
    description:
      'Ancient Greeks used olive oil, honey, and salt scrubs. Kairos means seizing the perfect moment — in skincare, this translates to seasonal adaptation and reading the skin\'s daily needs rather than following a fixed script.',
    steps: ['Honey & olive oil cleanse', 'Rosewater mist', 'Olive squalane serum', 'Beeswax balm (PM)'],
    benefits: ['Antioxidant-rich', 'Antibacterial honey', 'Deep olive polyphenols'],
    bestFor: ['aging', 'dryness', 'glow'],
    duration: '10 min',
    philosophy: 'Kairos — know when to act, when to rest.',
    recommended: {
      name: '100% Squalane Facial Oil',
      brand: 'The Ordinary',
      why: 'Olive-derived squalane — the weightless seal for the Kairos finish, mirroring skin\'s own lipids without heaviness.',
      buyUrl: SEPHORA('squalane facial oil'),
    },
  },
];

export const getRitual = (key: string | null): Ritual | undefined =>
  RITUALS.find(r => r.key === key);

export function aiSuggestRitual(
  scores: { acne: number; hydration: number; redness: number; pores: number; tone: number } | null,
): string {
  if (!scores) return 'japanese';
  const { acne, hydration, redness, pores, tone } = scores;
  if (acne < 65 && pores < 65) return 'korean';
  if (hydration < 65)          return 'japanese';
  if (redness < 65)            return 'scandinavian';
  if (tone < 65)               return 'ayurvedic';
  return 'french';
}

// Map a ritual step's wording to an owned product category, so tomorrow's
// routine can name a real product the user owns where one fits.
const STEP_CATEGORY: { match: RegExp; category: ProductCategory }[] = [
  { match: /cleanse|soap|micellar|foam|wash/i, category: 'cleanser' },
  { match: /spf|sun/i,                          category: 'spf' },
  { match: /exfoli|aha|bha|scrub/i,             category: 'exfoliant' },
  { match: /retin|adapalene/i,                  category: 'retinoid' },
  { match: /vitamin c|antioxid/i,               category: 'antiox' },
  { match: /serum|essence|oil|toner|lotion|mist|mask|eye/i, category: 'serum' },
  { match: /moistur|cream|butter|balm/i,        category: 'moisturizer' },
];

export interface AdaptedStep { step: string; product: string }

export function adaptRoutineForRitual(ritualKey: string, owned: string[]): AdaptedStep[] {
  const ritual = getRitual(ritualKey);
  if (!ritual) return [];

  const ownedByCat = new Map<ProductCategory, string>();
  for (const name of owned) {
    const cat = CATALOG[name]?.category;
    if (cat && !ownedByCat.has(cat)) ownedByCat.set(cat, name);
  }

  return ritual.steps.map(step => {
    const rule = STEP_CATEGORY.find(r => r.match.test(step));
    const product = rule ? ownedByCat.get(rule.category) : undefined;
    return { step, product: product ?? 'From the tradition' };
  });
}
