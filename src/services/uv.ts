// ── Real UV index for where the user is ────────────────────────────────────────
// Location comes from the phone (only when the user allows it) and the UV index
// from Open-Meteo, a free forecast API that needs no key. Nothing is stored.
import * as Location from 'expo-location';

export interface UVReading {
  now: number;
  maxToday: number;
  peakHour: number | null;   // local hour of today's peak, 0–23
  fetchedAt: number;
}

export type UVState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error' }
  | { status: 'ok'; reading: UVReading };

// WHO UV index bands. Sun protection is advised from 3 upwards.
export function uvBand(uv: number): { label: string; protect: boolean } {
  if (uv < 3)  return { label: 'Low',       protect: false };
  if (uv < 6)  return { label: 'Moderate',  protect: true };
  if (uv < 8)  return { label: 'High',      protect: true };
  if (uv < 11) return { label: 'Very high', protect: true };
  return { label: 'Extreme', protect: true };
}

export async function fetchUV(askPermission: boolean): Promise<UVState> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    let granted = current.granted;
    if (!granted && askPermission && current.canAskAgain) {
      granted = (await Location.requestForegroundPermissionsAsync()).granted;
    }
    if (!granted) return { status: 'denied' };

    const pos = await Location.getLastKnownPositionAsync()
      ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    if (!pos) return { status: 'error' };
    // Two decimal places (~1 km) is plenty for UV and keeps the request vague.
    const lat = pos.coords.latitude.toFixed(2);
    const lon = pos.coords.longitude.toFixed(2);
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=uv_index&hourly=uv_index&forecast_days=1&timezone=auto',
    );
    if (!res.ok) return { status: 'error' };
    const data = await res.json();
    const hourly: number[] = data?.hourly?.uv_index ?? [];
    const times: string[] = data?.hourly?.time ?? [];
    const now = Number(data?.current?.uv_index);
    if (!Number.isFinite(now) || hourly.length === 0) return { status: 'error' };
    const maxToday = Math.max(...hourly);
    const peakIdx = hourly.indexOf(maxToday);
    const peakHour = times[peakIdx] ? Number(times[peakIdx]!.slice(11, 13)) : null;
    return {
      status: 'ok',
      reading: { now: Math.round(now * 10) / 10, maxToday: Math.round(maxToday * 10) / 10, peakHour, fetchedAt: Date.now() },
    };
  } catch {
    return { status: 'error' };
  }
}
