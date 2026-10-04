// ── One ingredient-conflict checker for the whole app ──────────────────────────
// Reads the shelf plus how the user says their skin feels, and returns findings
// in priority order. Today shows the top one; the Shelf tab shows them all.

export type FindingKind = 'conflict' | 'caution';

export interface Finding {
  kind: FindingKind;
  title: string;
  body: string;
  productIds: string[];
  quiet?: boolean;   // general info: listed on the Shelf, never pushed to Today
}

interface CheckedProduct {
  id: string;
  name: string;
  ingredients: string[];
  warningText?: string | null;   // from the AI label read, when it flagged one
}

const RETINOIDS  = ['retinol', 'retinyl', 'retinal', 'tretinoin', 'retinoic', 'adapalene'];
const ACIDS      = ['glycolic acid', 'salicylic acid', 'lactic acid', 'mandelic acid'];
const VITAMIN_C  = ['ascorbic acid', 'vitamin c', 'ascorbyl'];
const BPO        = ['benzoyl peroxide'];
const HARSH      = [...RETINOIDS, ...ACIDS, ...VITAMIN_C, ...BPO];

const hasAny = (p: CheckedProduct, list: string[]) =>
  p.ingredients.some(i => list.some(n => i.toLowerCase().includes(n)));

export function firstHarshActive(ingredients: string[]): string | null {
  for (const h of HARSH) {
    if (ingredients.some(i => i.toLowerCase().includes(h))) return h;
  }
  return null;
}

export function checkShelf(shelf: CheckedProduct[], skinFeel: string): Finding[] {
  const findings: Finding[] = [];
  const sensitive = /sensiti/i.test(skinFeel);
  const retinoids = shelf.filter(p => hasAny(p, RETINOIDS));
  const acids     = shelf.filter(p => hasAny(p, ACIDS));
  const vitC      = shelf.filter(p => hasAny(p, VITAMIN_C));
  const bpo       = shelf.filter(p => hasAny(p, BPO));

  // 1. Skin feels sensitive while strong actives are on the shelf.
  if (sensitive) {
    const harsh = shelf.filter(p => hasAny(p, HARSH));
    for (const p of harsh) {
      findings.push({
        kind: 'conflict',
        title: `Go gentle with ${p.name}`,
        body: p.warningText ??
          `It contains ${firstHarshActive(p.ingredients)}. You said your skin feels sensitive, so pause it ` +
          'and bring it back slowly once your skin feels comfortable again.',
        productIds: [p.id],
      });
    }
  }

  // 2. Anything the AI label read flagged that isn't already covered above.
  for (const p of shelf) {
    if (p.warningText && !findings.some(f => f.productIds.includes(p.id))) {
      findings.push({ kind: 'caution', title: p.name, body: p.warningText, productIds: [p.id] });
    }
  }

  // 3. Retinoid and an exfoliating acid on the same night.
  if (retinoids.length && acids.length) {
    findings.push({
      kind: 'caution',
      title: 'Retinoid and acid: different nights',
      body: 'Using both on the same night makes irritation more likely, so your evening routine ' +
        'alternates them: the acid on Monday and Thursday, the retinoid on the other nights.',
      productIds: [...retinoids, ...acids].map(p => p.id),
    });
  }

  // 4. Benzoyl peroxide can inactivate some retinoids (tretinoin) when layered.
  if (retinoids.length && bpo.length) {
    findings.push({
      kind: 'caution',
      title: 'Benzoyl peroxide and retinoid',
      body: 'Benzoyl peroxide can break down some retinoids such as tretinoin when applied together. ' +
        'Use benzoyl peroxide in the morning and the retinoid at night. Adapalene is more stable.',
      productIds: [...retinoids, ...bpo].map(p => p.id),
    });
  }

  // 5. Vitamin C and retinoid: timing, not a true clash.
  if (retinoids.length && vitC.length) {
    findings.push({
      kind: 'caution',
      title: 'Vitamin C by day, retinoid at night',
      body: 'Both at once can be irritating for some people. Vitamin C in the morning under SPF ' +
        'and the retinoid in the evening keeps them apart. Your routine already does this.',
      productIds: [...retinoids, ...vitC].map(p => p.id),
      quiet: true,
    });
  }

  // 6. Retinoids aren't recommended in pregnancy.
  if (retinoids.length) {
    findings.push({
      kind: 'caution',
      title: 'Retinoids and pregnancy',
      body: 'Retinoids are not recommended if you are pregnant, trying to conceive or breastfeeding. ' +
        'Ask a pharmacist or GP about alternatives such as azelaic acid.',
      productIds: retinoids.map(p => p.id),
      quiet: true,
    });
  }

  return findings;
}
