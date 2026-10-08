// ── Backup and restore ─────────────────────────────────────────────────────────
// Photos and history live only on the phone. A backup is one file holding all of
// it (photos included) that the user saves wherever they like through the share
// sheet: iCloud Drive, Google Drive, Files, email. Making one is Premium;
// restoring one is always free, so nobody's data is held hostage.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { QuestionnaireAnswers, SavedData } from '../store';
import { deleteAllPhotos, readPhotoBase64, writePhotoBase64 } from './photos';
import { dayKey } from '../dates';

const FORMAT = 'poreless-backup';
const VERSION = 1;

type BackedUp = Omit<SavedData, 'premium' | 'aiUsage'>;

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  createdAt: string;
  data: BackedUp;
  answers: QuestionnaireAnswers | null;
  photos: Record<string, string>;   // scan id → base64 JPEG
}

export async function shareBackup(data: SavedData, answers: QuestionnaireAnswers): Promise<void> {
  const { premium: _p, aiUsage: _u, ...rest } = data;
  const photos: Record<string, string> = {};
  for (const s of rest.scans) {
    if (!s.photoUri) continue;
    const b64 = await readPhotoBase64(s.photoUri);
    if (b64) photos[s.id] = b64;
  }
  const file: BackupFile = {
    format: FORMAT, version: VERSION, createdAt: new Date().toISOString(),
    data: { ...rest, doneSteps: {} }, answers, photos,
  };
  const dest = `${FileSystem.cacheDirectory}Poreless-backup-${dayKey()}.json`;
  await FileSystem.writeAsStringAsync(dest, JSON.stringify(file));
  try {
    await Sharing.shareAsync(dest, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save Poreless backup' });
  } finally {
    FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
  }
}

export type PickedBackup = { createdAt: string; photoCount: number; file: BackupFile };

// Lets the user pick a backup file. null = they cancelled; throws if it isn't a Poreless backup.
export async function pickBackup(): Promise<PickedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const raw = await FileSystem.readAsStringAsync(res.assets[0].uri);
  let file: BackupFile;
  try { file = JSON.parse(raw); } catch { throw new Error('not a backup'); }
  if (file?.format !== FORMAT || !file.data || !Array.isArray(file.data.scans)) throw new Error('not a backup');
  return { createdAt: file.createdAt, photoCount: Object.keys(file.photos ?? {}).length, file };
}

// Replaces the photos on this phone with the backup's and returns the data to load.
export async function unpackBackup(file: BackupFile): Promise<{ data: BackedUp; answers: QuestionnaireAnswers | null }> {
  await deleteAllPhotos();
  const scans = [];
  for (const s of file.data.scans) {
    const b64 = file.photos?.[s.id];
    const photoUri = b64 ? await writePhotoBase64(s.id, b64) : null;
    if (photoUri || s.scores) scans.push({ ...s, photoUri });
  }
  return { data: { ...file.data, scans }, answers: file.answers ?? null };
}
