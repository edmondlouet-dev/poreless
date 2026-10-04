/**
 * On-device photo check with Google ML Kit face detection.
 *
 * Runs on the phone before a photo is sent to the AI, so a bad photo (no face,
 * head turned, too far away, eyes closed) gets a retake prompt straight away and
 * never costs an AI call. It also measures eye tilt from real eye-corner
 * landmarks instead of asking the AI to guess an angle.
 *
 * ML Kit is a native module, so it only exists in a development or store build.
 * In Expo Go or on web the check reports available=false and the scan carries
 * on with the AI's own photo check.
 */
import { NativeModules } from 'react-native';
import FaceDetection, { type Face, type Point } from '@react-native-ml-kit/face-detection';

export type FaceCheckKind = 'skin' | 'structure';

export interface FaceCheck {
  available: boolean;          // false → no on-device detector; don't gate on it
  issue: string | null;        // why the photo needs a retake, else null
  canthalTilt: number | null;  // degrees, outer corner above inner = positive
}

// How far the head may turn before the reading stops being comparable. The
// structure scan is stricter because angles are what it reports.
const LIMITS: Record<FaceCheckKind, { yaw: number; roll: number; pitch: number }> = {
  skin:      { yaw: 20, roll: 15, pitch: 20 },
  structure: { yaw: 10, roll: 6,  pitch: 12 },
};
// Face width as a share of the photo's shorter side; a selfie at arm's length
// is usually 35–60%.
const MIN_FACE_SHARE = 0.22;

const UNAVAILABLE: FaceCheck = { available: false, issue: null, canthalTilt: null };

export function faceCheckAvailable(): boolean {
  return !!NativeModules.FaceDetection;
}

export async function checkFacePhoto(
  uri: string,
  width: number,
  height: number,
  kind: FaceCheckKind,
): Promise<FaceCheck> {
  if (!uri || !faceCheckAvailable()) return UNAVAILABLE;

  let faces: Face[];
  try {
    faces = await FaceDetection.detect(uri, {
      performanceMode: 'accurate',
      contourMode: kind === 'structure' ? 'all' : 'none',
      classificationMode: 'all',
      minFaceSize: 0.15,
    });
  } catch {
    // A detector error shouldn't block the scan; the AI still checks the photo.
    return UNAVAILABLE;
  }

  const result = (issue: string | null, canthalTilt: number | null = null): FaceCheck =>
    ({ available: true, issue, canthalTilt });

  if (faces.length === 0) return result('No face found');
  if (faces.length > 1) return result('More than one face in the photo');

  const face = faces[0]!;
  const lim = LIMITS[kind];
  if (Math.abs(face.rotationY) > lim.yaw) return result('Face turned to the side');
  if (Math.abs(face.rotationZ) > lim.roll) return result('Head tilted');
  if (Math.abs(face.rotationX) > lim.pitch) return result('Head tilted up or down');

  const shorter = Math.min(width, height);
  if (shorter > 0 && face.frame.width / shorter < MIN_FACE_SHARE) return result('Move a little closer');

  const eyesOpen = Math.min(face.leftEyeOpenProbability ?? 1, face.rightEyeOpenProbability ?? 1);
  if (kind === 'structure' && eyesOpen < 0.4) return result('Eyes look closed');

  if (kind !== 'structure') return result(null);
  const left = face.contours?.leftEye?.points ?? [];
  const right = face.contours?.rightEye?.points ?? [];
  return result(null, left.length >= 4 && right.length >= 4 ? canthalTiltFrom(left, right) : null);
}

// ── eye tilt from eye-contour points ─────────────────────────────────────────
// Canthal tilt is the angle of the line from the inner to the outer eye corner,
// measured against the line joining the two inner corners. Measuring against
// that line (not the photo's horizontal) cancels out a slightly tilted head.
// Mirroring the photo doesn't change the result, so front-camera flips are fine.

const rotate = (p: Point, a: number): Point => ({
  x: p.x * Math.cos(a) - p.y * Math.sin(a),
  y: p.x * Math.sin(a) + p.y * Math.cos(a),
});

const centroid = (ps: Point[]): Point => ({
  x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
  y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
});

export function canthalTiltFrom(eyeA: Point[], eyeB: Point[]): number {
  // 1. Level the eyes roughly using their centres, so "inner" and "outer"
  //    corners can be picked by distance from the face's midline.
  const cA = centroid(eyeA), cB = centroid(eyeB);
  const a0 = -Math.atan2(cB.y - cA.y, cB.x - cA.x);
  const A = eyeA.map(p => rotate(p, a0)), B = eyeB.map(p => rotate(p, a0));
  const mid = (centroid(A).x + centroid(B).x) / 2;
  const corners = (eye: Point[]) => {
    const byDist = [...eye].sort((p, q) => Math.abs(p.x - mid) - Math.abs(q.x - mid));
    return { inner: byDist[0]!, outer: byDist[byDist.length - 1]! };
  };
  const ca = corners(A), cb = corners(B);

  // 2. Re-level on the inner corners, then read each eye's angle.
  const a1 = -Math.atan2(cb.inner.y - ca.inner.y, cb.inner.x - ca.inner.x);
  const tilt = ({ inner, outer }: { inner: Point; outer: Point }) => {
    const i = rotate(inner, a1), o = rotate(outer, a1);
    // Image y grows downward, so an outer corner ABOVE the inner one has o.y < i.y.
    return (Math.atan2(i.y - o.y, Math.abs(o.x - i.x)) * 180) / Math.PI;
  };
  const deg = (tilt(ca) + tilt(cb)) / 2;
  return Math.round(Math.max(-12, Math.min(12, deg)) * 10) / 10;
}
