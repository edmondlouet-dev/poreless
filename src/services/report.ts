// ── Dermatologist report (Premium) ─────────────────────────────────────────────
// One PDF a user can bring to a GP or dermatologist: progress photos over time,
// every product with when it was started, how each trial went, and how
// consistently the routine was done. It answers the first question in most
// appointments: "what have you tried, and for how long?"
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { QuestionnaireAnswers, ScanEntry, ShelfProduct, SkinScores } from '../store';
import { STEP_LABEL } from '../products';
import { trialWeek, type Trial } from '../trials';
import { dayKey, shortDate, MONTHS } from '../dates';
import { SKINTYPE_LABEL, CONCERN_LABEL } from '../skin';

export interface ReportInput {
  name: string;
  skinFeel: string;
  answers: QuestionnaireAnswers;
  scans: ScanEntry[];
  shelf: ShelfProduct[];
  trials: Trial[];
  completions: string[];
}

const MAX_PHOTOS = 6;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const longDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const weeksSince = (iso: string, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / (7 * 24 * 3600 * 1000)));

// First, last and evenly spaced photos in between.
export function pickPhotos<T>(photos: T[], max = MAX_PHOTOS): T[] {
  if (photos.length <= max) return photos;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(photos[Math.round((i * (photos.length - 1)) / (max - 1))]!);
  return out;
}

const VERDICT = { better: 'Improved', same: 'No change', worse: 'Worse' } as const;

const SCORE_ROWS: { key: keyof SkinScores; label: string }[] = [
  { key: 'acne', label: 'Spots / breakouts' },
  { key: 'redness', label: 'Redness' },
  { key: 'texture', label: 'Texture' },
  { key: 'tone', label: 'Uneven tone' },
  { key: 'oil', label: 'Shine' },
  { key: 'hydration', label: 'Dryness' },
];

export function buildReportHtml(
  input: ReportInput,
  photoData: Record<string, string>,   // scan id → data URI
  now = new Date(),
): string {
  const { answers, scans, shelf, trials, completions } = input;
  const photos = pickPhotos(scans.filter(s => s.photoUri && photoData[s.id]));

  const since = new Date(now); since.setDate(since.getDate() - 29);
  const sinceKey = dayKey(since);
  const recent = completions.filter(k => k.split('|')[0]! >= sinceKey);
  const activeDays = new Set(recent.map(k => k.split('|')[0])).size;
  const am = recent.filter(k => k.endsWith('|AM')).length;
  const pm = recent.filter(k => k.endsWith('|PM')).length;

  const scored = scans.filter(s => s.scores);
  const first = scored[0], last = scored[scored.length - 1];

  const started = [...scans.map(s => s.date), ...shelf.map(p => p.addedAt), ...trials.map(t => t.startedAt)].sort()[0];

  const list = (xs: string[]) => (xs.length ? esc(xs.join(', ')) : 'Not given');

  const photoHtml = photos.length
    ? `<div class="photos">${photos.map(p => `
        <figure><img src="${photoData[p.id]}"/><figcaption>${esc(longDate(p.date))}</figcaption></figure>`).join('')}
      </div>
      <p class="note">${scans.filter(s => s.photoUri).length} photos in total, taken on a phone front camera with an outline of the previous photo to keep the framing similar. Lighting varies between photos.</p>`
    : '<p class="note">No progress photos yet.</p>';

  const productRows = [...shelf]
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    .map(p => {
      const t = trials.find(x => x.productId === p.id);
      return `<tr>
        <td><b>${esc(p.name)}</b>${p.brand ? `<br/><span class="muted">${esc(p.brand)}</span>` : ''}</td>
        <td>${p.category ? esc(STEP_LABEL[p.category]) : '—'}</td>
        <td>${esc(longDate(p.addedAt))}<br/><span class="muted">${weeksSince(p.addedAt, now)} weeks ago</span></td>
        <td class="ingr">${t ? `<b>${esc(t.active)}</b><br/>` : ''}${esc(p.ingredients.slice(0, 8).join(', ')) || '—'}</td>
      </tr>`;
    }).join('');

  const trialRows = trials.map(t => `<tr>
      <td><b>${esc(t.productName)}</b></td>
      <td>${esc(t.active)}</td>
      <td>${esc(longDate(t.startedAt))}</td>
      <td>${t.verdict ? `${weeksSince(t.startedAt, new Date(t.verdictAt ?? now))} weeks` : `week ${trialWeek(t, now)}`}<br/><span class="muted">usual: ${esc(t.range)}</span></td>
      <td>${t.verdict ? `<b>${VERDICT[t.verdict]}</b> (patient's view)` : 'Still in progress'}</td>
    </tr>`).join('');

  const scoreHtml = first && last && first !== last
    ? `<table><tr><th>Sign</th><th>${esc(shortDate(first.date))}</th><th>${esc(shortDate(last.date))}</th></tr>
        ${SCORE_ROWS.map(r => `<tr><td>${r.label}</td><td>${first.scores![r.key]}</td><td>${last.scores![r.key]}</td></tr>`).join('')}
      </table>
      <p class="note">0–100 per photo, higher means less visible. These are cosmetic estimates by an AI model from a single phone photo each, affected by light and camera. They are not a clinical grading.</p>`
    : '<p class="note">Not enough scored photos to compare yet.</p>';

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1814; font-size: 11px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 2px; font-weight: 600; }
  h2 { font-size: 13px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #DDD6CC; text-transform: uppercase; letter-spacing: .06em; }
  .muted { color: #7A7268; }
  .note { color: #7A7268; font-size: 10px; margin-top: 6px; }
  table.meta { width: auto; }
  .meta td { padding: 2px 18px 2px 0; border: none; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 600; font-size: 10px; color: #7A7268; padding: 5px 6px; border-bottom: 1px solid #DDD6CC; }
  td { vertical-align: top; padding: 6px; border-bottom: 1px solid #EEE8E0; }
  td.ingr { font-size: 9.5px; color: #4A443C; }
  .photos { display: flex; flex-wrap: wrap; gap: 8px; }
  figure { margin: 0; width: 31%; page-break-inside: avoid; }
  figure img { width: 100%; height: 190px; object-fit: cover; border-radius: 6px; }
  figcaption { text-align: center; font-size: 10px; color: #7A7268; margin-top: 3px; }
  .disclaimer { margin-top: 26px; padding: 10px 12px; background: #F4EFE8; border-radius: 6px; font-size: 10px; color: #4A443C; }
</style></head><body>
  <h1>Skin progress report</h1>
  <div class="muted">Prepared by the patient with the Poreless app · ${esc(longDate(now.toISOString()))}</div>

  <h2>Patient</h2>
  <table class="meta">
    <tr><td class="muted">Name</td><td>${esc(input.name)}</td></tr>
    <tr><td class="muted">Age range</td><td>${list(answers.age)}</td></tr>
    <tr><td class="muted">Skin type (self-reported)</td><td>${list(answers.skintype.map(x => SKINTYPE_LABEL[x] ?? x))}</td></tr>
    <tr><td class="muted">Main concerns</td><td>${list(answers.concern.map(x => CONCERN_LABEL[x] ?? x))}</td></tr>
    <tr><td class="muted">How skin feels now</td><td>${esc(input.skinFeel)}</td></tr>
    <tr><td class="muted">Tracking since</td><td>${started ? esc(longDate(started)) : '—'}</td></tr>
  </table>

  <h2>Progress photos</h2>
  ${photoHtml}

  <h2>Products used</h2>
  ${shelf.length ? `<table><tr><th>Product</th><th>Type</th><th>Started</th><th>Key active · ingredients</th></tr>${productRows}</table>` : '<p class="note">No products logged.</p>'}

  <h2>Treatment trials</h2>
  ${trials.length ? `<table><tr><th>Product</th><th>Active</th><th>Started</th><th>Time on it</th><th>Result</th></tr>${trialRows}</table>
    <p class="note">"Usual" is the typical time for that active to show a visible change, from published guidance (AAD, British Association of Dermatologists).</p>` : '<p class="note">No products with a tracked active.</p>'}

  <h2>Routine, last 30 days</h2>
  <table class="meta">
    <tr><td class="muted">Days with a routine done</td><td>${activeDays} of 30</td></tr>
    <tr><td class="muted">Morning routines</td><td>${am}</td></tr>
    <tr><td class="muted">Evening routines</td><td>${pm}</td></tr>
  </table>

  <h2>Photo scores, first vs latest</h2>
  ${scoreHtml}

  <div class="disclaimer">Self-recorded by the patient. Product start dates are when each product was added in the app. Poreless is not a medical device and this report is not a diagnosis.</div>
</body></html>`;
}

async function photoDataFor(scans: ScanEntry[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of pickPhotos(scans.filter(x => x.photoUri))) {
    try {
      const b64 = await FileSystem.readAsStringAsync(s.photoUri!, { encoding: FileSystem.EncodingType.Base64 });
      out[s.id] = `data:image/jpeg;base64,${b64}`;
    } catch {}
  }
  return out;
}

// Builds the PDF and opens the share sheet (email, AirDrop, Files, print).
export async function shareReport(input: ReportInput): Promise<void> {
  const html = buildReportHtml(input, await photoDataFor(input.scans));
  const { uri } = await Print.printToFileAsync({ html });
  const dest = `${FileSystem.cacheDirectory}Poreless-skin-report-${dayKey()}.pdf`;
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share skin report' });
}
