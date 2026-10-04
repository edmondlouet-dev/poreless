// ── Progress photos, kept on the phone only ────────────────────────────────────
import * as FileSystem from 'expo-file-system/legacy';

const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}progress/` : null;

// Copies a camera capture (which lives in a cache folder the OS may clear) into
// the app's own documents folder. Returns null if it can't be saved.
export async function keepPhoto(tempUri: string, id: string): Promise<string | null> {
  if (!DIR) return null;
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    const dest = `${DIR}${id}.jpg`;
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  } catch {
    return null;
  }
}

export async function deletePhoto(uri: string): Promise<void> {
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
}

export async function deleteAllPhotos(): Promise<void> {
  if (!DIR) return;
  try { await FileSystem.deleteAsync(DIR, { idempotent: true }); } catch {}
}
