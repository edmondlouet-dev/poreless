import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Smile, Droplet, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { MetricStrip } from '../components/MetricStrip';
import { analyzeSkinFrame, type SkinAnalysis } from '../services/gemini';
import { checkFacePhoto } from '../services/faceCheck';
import { SKIN_FEEL, type SkinFeel } from '../skin';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

type Step = 'preview' | 'scanning' | 'done';

// How the skin FEELS is something only the user knows; a photo can't show it.
// Their answer (not the scan) drives the "go gentle on actives" advice elsewhere.
const FEEL_ICON: Record<SkinFeel, typeof Smile> = {
  comfortable: Smile,
  tight: Droplet,
  sensitive: Zap,
};

const { width: SCREEN_W } = Dimensions.get('window');
const CAM_H = Math.min(340, SCREEN_W * 0.9);

// Every score is "how visible is this in the photo", higher = less visible.
const metricsFromScores = (s: SkinAnalysis) => [
  { key: 'overall',   value: String(s.overall),   label: 'Appearance', dot: 'good' as const },
  { key: 'hydration', value: String(s.hydration), label: 'Not dry',    dot: s.hydration < 65 ? 'warn' as const : 'good' as const },
  { key: 'texture',   value: String(s.texture),   label: 'Smooth',     dot: 'good' as const },
  { key: 'pores',     value: String(s.pores),     label: 'Pores',      dot: s.pores < 65 ? 'warn' as const : 'good' as const },
  { key: 'redness',   value: String(s.redness),   label: 'Calm',       dot: 'good' as const },
  { key: 'oil',       value: String(s.oil),       label: 'Matte',      dot: s.oil < 55 ? 'warn' as const : 'good' as const },
  { key: 'acne',      value: String(s.acne),      label: 'Clear',      dot: s.acne < 65 ? 'warn' as const : 'good' as const },
  { key: 'tone',      value: String(s.tone),      label: 'Even',       dot: 'good' as const },
];

export const Scan: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { setLastScores, updateMetrics, incrementSurfaceScan, geminiLive, faceMetrics } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep]     = useState<Step>('preview');
  const [scores, setScores] = useState<SkinAnalysis | null>(null);
  // Why the last photo needs a retake ('' = no specific reason), or null if it was fine.
  const [retake, setRetake] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  const feel = (Object.keys(SKIN_FEEL) as SkinFeel[])
    .find(k => SKIN_FEEL[k] === faceMetrics.barrierStatus) ?? null;
  const pickFeel = (k: SkinFeel) => updateMetrics({ barrierStatus: SKIN_FEEL[k] });

  const capture = async () => {
    setStep('scanning');
    try {
      let base64 = '';
      if (permission?.granted && cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
        base64 = photo.base64 ?? '';
        // On-device check first: a bad photo gets a retake without an AI call.
        const check = await checkFacePhoto(photo.uri, photo.width, photo.height, 'skin');
        if (check.issue) {
          setScores(null);
          setRetake(check.issue);
          setStep('done');
          return;
        }
      }
      const result = await analyzeSkinFrame(base64);
      setScores(result);
      setRetake(result.photoUsable ? null : (result.photoIssue ?? ''));
      // Only a real reading of a usable photo goes into history; demo numbers and
      // retake-needed photos would make the trend lines lie.
      if (!result.simulated && result.photoUsable) {
        setLastScores({
          overall: result.overall, hydration: result.hydration, texture: result.texture,
          pores: result.pores, redness: result.redness, oil: result.oil,
          acne: result.acne, tone: result.tone,
        });
        incrementSurfaceScan();
      }
      setStep('done');
    } catch {
      setStep('preview');
      Alert.alert(
        'Couldn\'t analyse this photo',
        'Check your connection and try again. No scores were saved.',
      );
    }
  };

  const PermissionPrompt = () => (
    <View style={styles.permBox}>
      <FaceLogo size={48} color={C.ink3} />
      <Text style={[T.h2, { textAlign: 'center', marginTop: 16 }]}>Camera access needed</Text>
      <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', marginTop: 8, lineHeight: 18 }]}>
        Poreless uses your front camera to take a photo for analysis.
        Photos are sent for analysis and not stored by Poreless.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.85}>
        <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>Allow camera →</Text>
      </TouchableOpacity>
    </View>
  );

  const demo = scores ? scores.simulated : !geminiLive;
  const usable = step === 'done' && retake === null && scores && scores.photoUsable;

  return (
    <View style={styles.root}>
      <Background />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: S.gutter }]}>
          <View>
            <Text style={T.kicker}>SCAN · DAILY</Text>
            <Text style={[T.h1, { fontSize: 30, marginTop: 4 }]}>
              face <Text style={{ fontStyle: 'italic', color: C.accentInk }}>scan</Text>
            </Text>
          </View>
          <View style={[styles.aiBadge, !demo ? { borderColor: C.accent } : {}]}>
            <Text style={[T.kicker, { color: !demo ? C.accent : C.ink3, fontSize: 9 }]}>
              {demo ? 'AI · DEMO' : 'AI · LIVE'}
            </Text>
          </View>
        </View>

        {/* Camera / face-art — NO box frame, just the figure */}
        <View style={[styles.cameraWrap, { marginHorizontal: S.gutter }]}>
          {permission?.granted ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <FaceLogo size={SCREEN_W * 0.38} color={C.ink3} strokeWidth={0.8} />
            </View>
          )}

          {/* Status pill only */}
          <View style={styles.statusPill}>
            <Text style={[T.kicker, { color: 'white', letterSpacing: 0.8, fontSize: 9 }]}>
              {step === 'preview'  && '· even light · no filter · face the camera ·'}
              {step === 'scanning' && '· analysing photo ·'}
              {step === 'done'     && '· scan complete ·'}
            </Text>
          </View>

          {step === 'scanning' && (
            <View style={styles.scanningOverlay}>
              <ActivityIndicator color={C.accent} size="large" />
            </View>
          )}
        </View>

        {/* Permission prompt */}
        {!permission?.granted && <PermissionPrompt />}

        {/* ── Skin feel check-in — the user's answer, not the camera's guess ── */}
        <View style={{ paddingHorizontal: S.gutter, marginBottom: 14 }}>
          <Text style={[T.kicker, { marginBottom: 8 }]}>HOW DOES YOUR SKIN FEEL TODAY?</Text>
          <View style={styles.flagRow}>
            {(Object.keys(SKIN_FEEL) as SkinFeel[]).map(k => {
              const active = feel === k;
              const Icon = FEEL_ICON[k];
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.flagChip, active && styles.flagChipActive]}
                  onPress={() => pickFeel(k)}
                  activeOpacity={0.7}
                >
                  <Icon size={16} strokeWidth={1.2} color={active ? C.accentInk : C.ink3} />
                  <Text style={[T.kicker, {
                    color: active ? C.accentInk : C.ink3,
                    fontSize: 9, letterSpacing: 0.4,
                  }]}>
                    {SKIN_FEEL[k].replace('Feels ', '').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {feel === 'sensitive' && (
            <FlutedGlass padding={10} style={{ marginTop: 8 }}>
              <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>
                ✦ Noted. Poreless will suggest pausing strong actives (retinoids, acids)
                until your skin feels comfortable again.
              </Text>
            </FlutedGlass>
          )}
        </View>

        {/* Something worth a professional look: no scores, just the pointer */}
        {step === 'done' && scores?.seeDoctor && (
          <View style={[styles.aiMessage, { marginHorizontal: S.gutter, borderColor: C.warn }]}>
            <Text style={[T.kicker, { color: C.warn, marginBottom: 3 }]}>WORTH A PROFESSIONAL LOOK</Text>
            <Text style={[T.bodySm, { color: C.ink2 }]}>
              {scores.seeDoctorReason ? `${scores.seeDoctorReason}. ` : ''}
              This is worth showing a GP or dermatologist. Poreless can't assess it.
            </Text>
          </View>
        )}

        {/* Photo not good enough: ask for a retake instead of guessing */}
        {step === 'done' && retake !== null && (
          <View style={[styles.aiMessage, { marginHorizontal: S.gutter }]}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 3 }]}>RETAKE FOR A RELIABLE READ</Text>
            <Text style={[T.bodySm, { color: C.ink2 }]}>
              {retake ? `${retake[0]!.toUpperCase()}${retake.slice(1)}. ` : ''}
              Face the camera in even daylight, without filters. Nothing was saved.
            </Text>
          </View>
        )}

        {/* Results */}
        {usable && !scores.seeDoctor && (
          <>
            <View style={[styles.aiMessage, { marginHorizontal: S.gutter }]}>
              <Text style={[T.kicker, { color: C.accent, marginBottom: 3 }]}>
                {scores.simulated ? 'DEMO DATA · NOT YOUR SKIN' : `AI ESTIMATE · ${scores.light.toUpperCase()} LIGHT`}
              </Text>
              <Text style={[T.bodySm, { color: C.ink2 }]}>{scores.message}</Text>
            </View>
            <View style={{ paddingHorizontal: S.gutter, marginBottom: 8 }}>
              <MetricStrip metrics={metricsFromScores(scores)} active="overall" onPick={() => {}} />
            </View>
            <Text style={[T.bodySm, { color: C.ink3, fontSize: 11, lineHeight: 15, marginHorizontal: S.gutter, marginBottom: 12 }]}>
              How your skin looks in this one photo, scored 0–100 (higher = less visible).
              Light, camera and makeup change it, so watch the trend over several scans.
              A cosmetic estimate, not a medical assessment.
            </Text>
          </>
        )}

        {/* CTA */}
        {permission?.granted && (
          <View style={{ paddingHorizontal: S.gutter }}>
            {step !== 'done' ? (
              <TouchableOpacity
                style={[styles.primaryBtn, step === 'scanning' && { backgroundColor: C.ink3 }]}
                onPress={step === 'preview' ? capture : undefined}
                activeOpacity={0.85}
              >
                <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>
                  {step === 'scanning' ? '⏳  Analysing…' : '⊙  Capture · front camera'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: C.sage }]}
                onPress={() => setStep('preview')}
                activeOpacity={0.85}
              >
                <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>
                  {usable ? '✓  Done · scan again' : '⊙  Retake'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  aiBadge: {
    borderWidth: 1, borderColor: C.line2, borderRadius: R.pill,
    paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4,
  },
  cameraWrap: {
    height: CAM_H,
    backgroundColor: '#E8DDD0',
    borderRadius: R.lg,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
  },
  logoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0EAE0',
  },
  statusPill: {
    position: 'absolute', top: 12, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: R.pill,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251,250,247,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  permBox: { marginHorizontal: S.gutter, alignItems: 'center', padding: 20, marginBottom: 14 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1, borderColor: C.line2,
    backgroundColor: C.surface,
  },
  flagChipActive: { backgroundColor: C.accentSoft, borderColor: C.accent },
  aiMessage: {
    backgroundColor: C.accentSoft, borderRadius: R.md,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  primaryBtn: {
    backgroundColor: C.ink, borderRadius: R.md,
    paddingVertical: 14, alignItems: 'center',
  },
});
