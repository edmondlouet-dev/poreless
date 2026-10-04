import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Flame, Droplet, CircleDot, Zap, Droplets } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { MetricStrip } from '../components/MetricStrip';
import { analyzeSkinFrame, type SkinAnalysis } from '../services/gemini';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

type Step = 'preview' | 'scanning' | 'done';

type SkinConcern = 'Redness' | 'Dryness' | 'Breakout' | 'Irritation' | 'Oiliness';
const ALL_CONCERNS: SkinConcern[] = ['Redness', 'Dryness', 'Breakout', 'Irritation', 'Oiliness'];

const CONCERN_ICON: Record<SkinConcern, typeof Flame> = {
  Redness: Flame,
  Dryness: Droplet,
  Breakout: CircleDot,
  Irritation: Zap,
  Oiliness: Droplets,
};

const { width: SCREEN_W } = Dimensions.get('window');
const CAM_H = Math.min(340, SCREEN_W * 0.9);

const metricsFromScores = (s: any) => [
  { key: 'overall',   value: String(s.overall),   label: 'Overall',   dot: 'good' as const },
  { key: 'hydration', value: String(s.hydration),  label: 'Hydration', dot: s.hydration < 65 ? 'warn' as const : 'good' as const },
  { key: 'texture',   value: String(s.texture),    label: 'Texture',   dot: 'good' as const },
  { key: 'pores',     value: String(s.pores),      label: 'Pores',     dot: s.pores < 65 ? 'warn' as const : 'good' as const },
  { key: 'redness',   value: String(s.redness),    label: 'Calm',      dot: 'good' as const },
  { key: 'oil',       value: String(s.oil),        label: 'Oil',       dot: s.oil < 55 ? 'warn' as const : 'good' as const },
  { key: 'acne',      value: String(s.acne),       label: 'Acne',      dot: s.acne < 65 ? 'warn' as const : 'good' as const },
  { key: 'tone',      value: String(s.tone),       label: 'Tone',      dot: 'good' as const },
];

export const Scan: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { setLastScores, updateMetrics, incrementSurfaceScan, geminiLive } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep]     = useState<Step>('preview');
  const [scores, setScores] = useState<SkinAnalysis | null>(null);
  const [flagged, setFlagged] = useState<Set<SkinConcern>>(new Set());
  const cameraRef = useRef<any>(null);

  const toggleFlag = (c: SkinConcern) => {
    setFlagged(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const capture = async () => {
    setStep('scanning');
    try {
      let base64 = '';
      if (permission?.granted && cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
        base64 = photo.base64 ?? '';
      }
      // Real analysis: result varies with lighting, framing and flagged concerns.
      const result = await analyzeSkinFrame(base64, Array.from(flagged));
      setScores(result);
      setLastScores({
        overall: result.overall, hydration: result.hydration, texture: result.texture,
        pores: result.pores, redness: result.redness, oil: result.oil,
        acne: result.acne, tone: result.tone,
      });
      // Barrier status is now *derived* from the scan, so the conflict harmonizer
      // reacts to the actual reading instead of a fixed value.
      updateMetrics({
        barrierStatus: result.redness < 65
          ? 'Sensitive / Fatigued'
          : result.redness < 80 ? 'Balanced / Resilient' : 'Healthy / Strong',
      });
      incrementSurfaceScan();
      setStep('done');
    } catch {
      setStep('preview');
      Alert.alert('Scan failed', 'Please try again.');
    }
  };

  const PermissionPrompt = () => (
    <View style={styles.permBox}>
      <FaceLogo size={48} color={C.ink3} />
      <Text style={[T.h2, { textAlign: 'center', marginTop: 16 }]}>Camera access needed</Text>
      <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', marginTop: 8, lineHeight: 18 }]}>
        Poreless uses your front camera to analyse your skin in real time.
        No images are stored or shared without your permission.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.85}>
        <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>Allow camera →</Text>
      </TouchableOpacity>
    </View>
  );

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
          <View style={[styles.aiBadge, geminiLive ? { borderColor: C.accent } : {}]}>
            <Text style={[T.kicker, { color: geminiLive ? C.accent : C.ink3, fontSize: 9 }]}>
              {geminiLive ? 'AI · LIVE' : 'AI · SIM'}
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
              {step === 'preview'  && '· good light · centred ·'}
              {step === 'scanning' && '· AI analysing · 28 markers ·'}
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

        {/* ── Skin concern flags — always visible ─────────────────────────── */}
        <View style={{ paddingHorizontal: S.gutter, marginBottom: 14 }}>
          <Text style={[T.kicker, { marginBottom: 8 }]}>FLAG A CONCERN</Text>
          <View style={styles.flagRow}>
            {ALL_CONCERNS.map(c => {
              const active = flagged.has(c);
              const Icon = CONCERN_ICON[c];
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.flagChip, active && styles.flagChipActive]}
                  onPress={() => toggleFlag(c)}
                  activeOpacity={0.7}
                >
                  <Icon size={16} strokeWidth={1.2} color={active ? C.accentInk : C.ink3} />
                  <Text style={[T.kicker, {
                    color: active ? C.accentInk : C.ink3,
                    fontSize: 9, letterSpacing: 0.4,
                  }]}>
                    {c.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {flagged.size > 0 && (
            <FlutedGlass padding={10} style={{ marginTop: 8 }}>
              <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>
                ✦ {Array.from(flagged).join(' · ')} noted. These are logged with your next scan
                to track improvement over time.
              </Text>
            </FlutedGlass>
          )}
        </View>

        {/* Results */}
        {step === 'done' && scores && (
          <>
            <View style={[styles.aiMessage, { marginHorizontal: S.gutter }]}>
              <Text style={[T.kicker, { color: C.accent, marginBottom: 3 }]}>
                AI SUMMARY · {Math.round(scores.confidence * 100)}% CONFIDENCE
              </Text>
              <Text style={[T.bodySm, { color: C.ink2 }]}>{scores.message}</Text>
            </View>
            <View style={{ paddingHorizontal: S.gutter, marginBottom: 12 }}>
              <MetricStrip metrics={metricsFromScores(scores)} active="overall" onPick={() => {}} />
            </View>
          </>
        )}

        {/* Quality checks — real values come back with the scan */}
        {step === 'done' && scores && permission?.granted && (
          <View style={[styles.qualityRow, { marginHorizontal: S.gutter }]}>
            {[
              { l: 'Light',    v: scores.light },
              { l: 'Distance', v: `${scores.distanceCm} cm` },
              { l: 'Markers',  v: '28' },
            ].map(q => (
              <FlutedGlass key={q.l} padding={10} style={{ flex: 1 }}>
                <Text style={[T.kicker, { textAlign: 'center', marginBottom: 3 }]}>{q.l}</Text>
                <Text style={[T.num, { fontSize: 15, fontWeight: '600', textAlign: 'center' }]}>{q.v}</Text>
              </FlutedGlass>
            ))}
          </View>
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
                <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>✓  Done · scan again</Text>
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
  qualityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: C.ink, borderRadius: R.md,
    paddingVertical: 14, alignItems: 'center',
  },
});
