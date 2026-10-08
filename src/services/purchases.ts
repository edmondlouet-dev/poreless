// ── Premium subscription (£4.99 a month) via RevenueCat ───────────────────────
// RevenueCat wraps App Store and Google Play billing. Set
// EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY and create a "premium"
// entitlement with a monthly product. Without a key the app runs in test
// mode: the paywall says so and unlocks Premium without charging, so the
// features can be tried before the store products exist.
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

export const PRICE_LABEL = '£4.99';
const ENTITLEMENT = 'premium';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
}) ?? '';

export const BILLING_LIVE = !!KEY;

let configured = false;
function ensureConfigured(): boolean {
  if (!BILLING_LIVE) return false;
  if (!configured) {
    Purchases.configure({ apiKey: KEY });
    configured = true;
  }
  return true;
}

const hasPremium = (info: { entitlements: { active: Record<string, unknown> } }) =>
  !!info.entitlements.active[ENTITLEMENT];

// Whether the store says this phone's account is subscribed. null = unknown
// (test mode or offline), so the caller keeps what it had.
export async function checkPremium(): Promise<boolean | null> {
  if (!ensureConfigured()) return null;
  try { return hasPremium(await Purchases.getCustomerInfo()); } catch { return null; }
}

// The store's own price string for the monthly plan (local currency), if available.
export async function monthlyPrice(): Promise<string | null> {
  if (!ensureConfigured()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.monthly?.product.priceString ?? null;
  } catch { return null; }
}

export type PurchaseOutcome = 'subscribed' | 'cancelled' | 'failed' | 'test';

export async function subscribe(): Promise<PurchaseOutcome> {
  if (!ensureConfigured()) return 'test';
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
    if (!pkg) return 'failed';
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPremium(customerInfo) ? 'subscribed' : 'failed';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'failed';
  }
}

export async function restore(): Promise<boolean | null> {
  if (!ensureConfigured()) return null;
  try { return hasPremium(await Purchases.restorePurchases()); } catch { return null; }
}
