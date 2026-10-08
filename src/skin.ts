// ── Self-reported skin feel ────────────────────────────────────────────────────
// A photo can't show barrier function, so the "go gentle on actives" logic keys
// off what the user tells us. Values keep the word "sensitive" where it applies
// so /sensiti/ checks elsewhere still work.

export type SkinFeel = 'comfortable' | 'tight' | 'sensitive';
export const SKIN_FEEL: Record<SkinFeel, string> = {
  comfortable: 'Feels comfortable',
  tight:       'Feels tight',
  sensitive:   'Feels sensitive',
};
export const SKIN_FEEL_UNSET = 'Not checked yet';

// Onboarding answer codes → readable labels.
export const SKINTYPE_LABEL: Record<string, string> = {
  oily: 'Oily', dry: 'Dry', combo: 'Combination', normal: 'Normal', sensitive: 'Sensitive',
};
export const CONCERN_LABEL: Record<string, string> = {
  acne: 'Acne & breakouts', dryness: 'Dryness', darkspots: 'Dark spots',
  texture: 'Texture & pores', redness: 'Redness & sensitivity', aging: 'Fine lines & aging',
};
