/**
 * INCI API client — always talks to the local proxy (or the deployed proxy URL).
 * The real API key lives only in proxy/.env and is never bundled into the app.
 *
 * Swap PROXY_URL to your deployed host before submitting to App Store / Play Store.
 * e.g. 'https://poreless-proxy.railway.app'
 */

const PROXY_URL =
  process.env.EXPO_PUBLIC_PROXY_URL ??
  'http://localhost:3001';

export interface InciProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  ingredients: string;
  category: string;
}

export interface InciIngredient {
  name: string;
  inci: string;
  function: string;
  safetyRating: number | null;
  concerns: string[];
  description: string;
}

export interface CompatibilityResult {
  verdict: 'synergy' | 'conflict' | 'caution' | 'neutral';
  title: string;
  explanation: string;
}

async function proxyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PROXY_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/**
 * Search products by name / brand / keyword.
 * Returns an empty array on failure so the UI degrades gracefully.
 */
export async function inciSearchProducts(
  query: string,
  page = 1,
): Promise<InciProduct[]> {
  if (!query || query.length < 2) return [];
  try {
    const data = await proxyGet<any>(
      `/search?q=${encodeURIComponent(query)}&page=${page}`,
    );
    // Normalise whatever shape the upstream API returns
    const items: any[] = data.products ?? data.results ?? data.data ?? data ?? [];
    return items.map((p: any) => ({
      id:          String(p.id ?? p._id ?? Math.random()),
      name:        p.name ?? p.product_name ?? '',
      brand:       p.brand ?? p.brands ?? '',
      imageUrl:    p.image_url ?? p.imageUrl ?? p.image_front_url ?? null,
      ingredients: p.ingredients_text ?? p.ingredients ?? '',
      category:    p.category ?? 'moisturizer',
    })).filter(p => p.name);
  } catch (err) {
    console.warn('[inci] search error:', err);
    return [];
  }
}

/**
 * Analyse a single ingredient by INCI name.
 */
export async function inciGetIngredient(name: string): Promise<InciIngredient | null> {
  try {
    const data = await proxyGet<any>(`/ingredient/${encodeURIComponent(name)}`);
    return {
      name:         data.name ?? name,
      inci:         data.inci ?? data.inci_name ?? name,
      function:     data.function ?? data.functions ?? '',
      safetyRating: data.safety_rating ?? data.safetyRating ?? null,
      concerns:     data.concerns ?? [],
      description:  data.description ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Check whether two ingredients interact.
 */
export async function inciCheckCompatibility(
  a: string,
  b: string,
): Promise<CompatibilityResult | null> {
  try {
    const data = await proxyGet<any>(
      `/compatibility?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
    );
    return {
      verdict:     data.verdict ?? 'neutral',
      title:       data.title ?? '',
      explanation: data.explanation ?? data.description ?? '',
    };
  } catch {
    return null;
  }
}
