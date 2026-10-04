/**
 * Poreless INCI Proxy — sits between the mobile app and the INCI API.
 * The real API key lives only in .env (never in the client bundle).
 *
 * Deploy options: Railway, Render, Fly.io, Heroku, or any Node host.
 * Set the env vars shown in .env.example on your hosting dashboard.
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const API_KEY  = process.env.INCI_API_KEY;
const API_BASE = process.env.INCI_API_BASE_URL ?? 'https://api.inci-beauty.com/v1';
const PORT     = process.env.PORT ?? 3001;

if (!API_KEY) {
  console.error('[proxy] INCI_API_KEY is not set. Check your .env file.');
  process.exit(1);
}

const app = express();
app.use(cors());          // allow the Expo dev server (localhost:8081 / EAS)
app.use(express.json());

// ── helpers ────────────────────────────────────────────────────────────────

async function inciGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'User-Agent':  'Poreless/1.0',
      Accept:        'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw { status: res.status, message: text || res.statusText };
  }
  return res.json();
}

// ── routes ─────────────────────────────────────────────────────────────────

// GET /health
app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * GET /search?q=<query>&page=1&size=20
 * Search products by name, brand, or ingredient keyword.
 */
app.get('/search', async (req, res) => {
  const { q, page = '1', size = '20' } = req.query;
  if (!q || String(q).length < 2) {
    return res.status(400).json({ error: 'q must be at least 2 characters' });
  }
  try {
    const data = await inciGet('/products/search', { query: q, page, per_page: size });
    res.json(data);
  } catch (err) {
    res.status(err.status ?? 502).json({ error: err.message ?? 'upstream error' });
  }
});

/**
 * GET /ingredient/:name
 * Analyse a single INCI ingredient — returns safety rating, function, etc.
 */
app.get('/ingredient/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name).trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const data = await inciGet(`/ingredients/${encodeURIComponent(name)}`);
    res.json(data);
  } catch (err) {
    res.status(err.status ?? 502).json({ error: err.message ?? 'upstream error' });
  }
});

/**
 * GET /product/:id
 * Full product detail including ingredient breakdown.
 */
app.get('/product/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const data = await inciGet(`/products/${encodeURIComponent(id)}`);
    res.json(data);
  } catch (err) {
    res.status(err.status ?? 502).json({ error: err.message ?? 'upstream error' });
  }
});

/**
 * GET /compatibility?a=ingredient1&b=ingredient2
 * Check whether two ingredients interact (conflict / synergy / neutral).
 */
app.get('/compatibility', async (req, res) => {
  const { a, b } = req.query;
  if (!a || !b) return res.status(400).json({ error: 'a and b query params required' });
  try {
    const data = await inciGet('/ingredients/compatibility', { a, b });
    res.json(data);
  } catch (err) {
    res.status(err.status ?? 502).json({ error: err.message ?? 'upstream error' });
  }
});

app.listen(PORT, () => {
  console.log(`[proxy] Poreless INCI proxy listening on http://localhost:${PORT}`);
});
