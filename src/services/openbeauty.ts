/**
 * Open Beauty Facts API — free, open database of cosmetics products.
 * Docs: https://world.openbeautyfacts.org/data
 */

export interface OBFProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  ingredients: string;
  category: string;
}

const BASE = 'https://world.openbeautyfacts.org';

function mapCategory(tags: string[] = []): string {
  const t = tags.join(' ').toLowerCase();
  if (t.includes('cleanser') || t.includes('face-wash') || t.includes('foaming')) return 'cleanser';
  if (t.includes('spf') || t.includes('sunscreen') || t.includes('sun-protection')) return 'spf';
  if (t.includes('serum')) return 'serum';
  if (t.includes('moisturiser') || t.includes('moisturizer') || t.includes('cream') || t.includes('lotion')) return 'moisturizer';
  if (t.includes('retinol') || t.includes('retinoid') || t.includes('adapalene')) return 'retinoid';
  if (t.includes('exfoliant') || t.includes('aha') || t.includes('bha') || t.includes('acid')) return 'exfoliant';
  if (t.includes('vitamin-c') || t.includes('ascorbic') || t.includes('antioxidant')) return 'antiox';
  if (t.includes('toner')) return 'serum';
  if (t.includes('mask') || t.includes('eye')) return 'serum';
  return 'moisturizer';
}

export async function searchProducts(query: string, page = 1): Promise<OBFProduct[]> {
  if (!query || query.length < 2) return [];
  const url =
    `${BASE}/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=30&page=${page}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Poreless/1.0 (edmondlouet@gmail.com)' } });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.products ?? [])
    .filter((p: any) => p.product_name)
    .map((p: any) => ({
      id:          p._id ?? p.code ?? Math.random().toString(36),
      name:        p.product_name,
      brand:       p.brands ?? '',
      imageUrl:    p.image_front_url ?? p.image_url ?? null,
      ingredients: p.ingredients_text ?? '',
      category:    mapCategory(p.categories_tags),
    }));
}

export async function getProduct(barcode: string): Promise<OBFProduct | null> {
  const res = await fetch(`${BASE}/api/v0/product/${barcode}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  const p = data.product;
  if (!p) return null;
  return {
    id:          barcode,
    name:        p.product_name ?? 'Unknown',
    brand:       p.brands ?? '',
    imageUrl:    p.image_front_url ?? null,
    ingredients: p.ingredients_text ?? '',
    category:    mapCategory(p.categories_tags),
  };
}
