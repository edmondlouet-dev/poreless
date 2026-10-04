import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
  ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Settings as SettingsIcon, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { MetricStrip } from '../components/MetricStrip';
import { FlutedGlass } from '../components/FlutedGlass';
import { FaceLogo } from '../components/FaceLogo';
import { PremiumModal } from '../components/PremiumModal';
import { SkeletonLines } from '../components/Skeleton';
import { analyzeStructuralFrame } from '../services/gemini';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

function isWithin7Days(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 7 * 24 * 60 * 60 * 1000;
}

const { width: W } = Dimensions.get('window');
const DIAGRAM_SIZE = Math.min(W - S.gutter * 2, 280);

type ScanStep = 'idle' | 'camera' | 'scanning' | 'done';

interface Props { onOpenSettings?: () => void; }

export const Proportions: React.FC<Props> = ({ onOpenSettings }) => {
  const insets = useSafeAreaInsets();
  const {
    structural, userProfile, usageCounters,
    updateMetrics, recordStructuralScan, showPremiumModal, openPremiumModal, dismissPremiumModal,
    setPremiumStatus, editorialInsight, isAnalyzing, refreshEditorialInsight, geminiLive,
  } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive]         = useState('tilt');
  const [scanStep, setScanStep]     = useState<ScanStep>('idle');
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
  const cameraRef = useRef<any>(null);
  const autoStarted = useRef(false);

  const locked = !userProfile.isPremium &&
    usageCounters.structuralScansThisWeek >= 1 &&
    isWithin7Days(usageCounters.lastStructuralScanDate);

  // Start camera immediately on mount if permission already granted, or request it.
  useEffect(() => {
    if (autoStarted.current || locked) return;
    if (!permission) return;
    if (permission.granted) {
      autoStarted.current = true;
      setScanStep('camera');
    } else if (permission.canAskAgain) {
      requestPermission().then(res => {
        if (res.granted && !autoStarted.current) {
          autoStarted.current = true;
          setScanStep('camera');
        }
      });
    }
  }, [permission?.granted]);

  const tiltLabel = structural.canthalTilt < 0 ? 'Slightly Downward'
    : structural.canthalTilt > 0 ? 'Positive' : 'Neutral';

  // Live metrics drive the strip so a fresh scan visibly changes the numbers.
  const LM_METRICS = [
    { key: 'tilt',    value: `${structural.canthalTilt}°`, label: 'Tilt', dot: (structural.canthalTilt < 0 ? 'warn' : 'good') as 'warn' | 'good' },
    { key: 'midface', value: structural.midfaceRatio.toFixed(2), label: 'Midface', dot: (structural.midfaceRatio > 1.08 ? 'warn' : 'good') as 'warn' | 'good' },
    { key: 'fluid',   value: structural.fluidRetention, label: 'Fluid', dot: (structural.fluidRetention === 'Low' ? 'good' : 'warn') as 'warn' | 'good' },
    { key: 'barrier', value: structural.barrierStatus.split(' / ')[0] ?? 'N/A', label: 'Barrier', dot: (/sensiti|fatig/i.test(structural.barrierStatus) ? 'warn' : 'good') as 'warn' | 'good' },
  ];

  const startScan = async () => {
    if (locked) { openPremiumModal(); return; }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert('Camera needed', 'Allow camera access to scan your facial structure.'); return; }
    }
    setScanStep('camera');
  };

  const capture = async () => {
    setScanStep('scanning');
    try {
      let base64 = '';
      if (permission?.granted && cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
        base64 = photo.base64 ?? '';
      }
      const result = await analyzeStructuralFrame(base64);
      updateMetrics(result);          // canthalTilt, midfaceRatio, fluidRetention, barrierStatus
      recordStructuralScan();
      setScanStep('done');
      // Ask the Gemini brain for a luxury-magazine read of the new geometry.
      refreshEditorialInsight();
    } catch {
      setScanStep('idle');
      Alert.alert('Scan failed', 'Please try again.');
    }
  };

  const insights = [
    {
      title: `Canthal Tilt: ${structural.canthalTilt}° (${tiltLabel})`,
      body: structural.canthalTilt < 0
        ? 'A slightly downward outer-eye corner softens the gaze. When applying eye serum, press up-and-out toward the brow tail to lift the appearance — never drag inward.'
        : 'Positive canthal tilt correlates with a more alert, lifted eye area. Maintain with gentle upward eye-care movements.',
      tag: structural.canthalTilt < 0 ? 'Watch' : 'Good',
      tagVariant: structural.canthalTilt < 0 ? 'warn' : 'sage',
    },
    {
      title: `Midface Ratio: ${structural.midfaceRatio.toFixed(2)}${structural.midfaceRatio > 1.08 ? ' (Mild Asymmetry)' : ''}`,
      body: structural.midfaceRatio > 1.08
        ? 'A ratio above 1.08 reads as mild asymmetry. Sculpt the fuller cheek upward toward the temple with fewer passes on the lighter side to even the structure over time.'
        : 'Midface length is well-proportioned. Mewing and proper tongue posture help maintain this long-term.',
      tag: structural.midfaceRatio > 1.08 ? 'Moderate' : 'Good',
      tagVariant: structural.midfaceRatio > 1.08 ? 'warn' : 'sage',
    },
    {
      title: `Fluid Retention: ${structural.fluidRetention}`,
      body: structural.fluidRetention === 'Low'
        ? 'Lymphatic flow is clear. A light morning drainage keeps the midface defined.'
        : 'Trace lymph downward from the inner brow along the jaw to the collarbone — three slow passes per side before product — to de-puff and define.',
      tag: structural.fluidRetention === 'Low' ? 'Good' : 'Moderate',
      tagVariant: structural.fluidRetention === 'Low' ? 'sage' : 'warn',
    },
    {
      title: `Barrier: ${structural.barrierStatus}`,
      body: /sensiti|fatig/i.test(structural.barrierStatus)
        ? 'Your barrier reads reactive. Favour gentle, fragrance-free formulas and press the final layer in with warm palms rather than rubbing to calm reactivity.'
        : 'Barrier health is strong. Consistency compounds — protect it with daily SPF.',
      tag: /sensiti|fatig/i.test(structural.barrierStatus) ? 'Watch' : 'Good',
      tagVariant: /sensiti|fatig/i.test(structural.barrierStatus) ? 'warn' : 'sage',
    },
  ];

  return (
    <View style={styles.root}>
      <Background mode="lookmax" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <View style={styles.badgeRow}>
              <Text style={[T.kicker, { color: C.accent }]}>✦ PROPORTIONS MODE</Text>
            </View>
            <Text style={[T.h1, { fontSize: 34, marginTop: 4 }]}>
              facial{' '}
              <Text style={{ fontStyle: 'italic', color: C.accentInk }}>structure</Text>
            </Text>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 4 }]}>
              beyond skin · ratios · angles · improvements
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} activeOpacity={0.7} onPress={onOpenSettings}>
            <SettingsIcon size={20} strokeWidth={1.3} color={C.ink3} />
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 16 }}>
          <MetricStrip metrics={LM_METRICS} active={active} onPick={setActive} />
        </View>

        {/* AI editorial read — shimmers while the Gemini brain composes it */}
        {(isAnalyzing || editorialInsight) && (
          <FlutedGlass padding={16} mode="lookmax" style={{ marginBottom: 14 }}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 10 }]}>
              ✦ PORELESS AI · EDITORIAL READ
            </Text>
            {isAnalyzing && !editorialInsight ? (
              <SkeletonLines lines={3} lastWidth="55%" />
            ) : (
              <Text style={[T.body, { color: C.ink2, lineHeight: 22, fontSize: 15, fontStyle: 'italic' }]}>
                {editorialInsight}
              </Text>
            )}
          </FlutedGlass>
        )}

        {/* Face diagram / live scan camera */}
        <FlutedGlass padding={16} mode="lookmax" style={{ marginBottom: 14 }}>
          <View style={styles.diagramWrap}>
            {scanStep === 'camera' || scanStep === 'scanning' ? (
              <View style={styles.cameraBox}>
                {permission?.granted ? (
                  <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
                ) : (
                  <View style={styles.camPlaceholder}>
                    <FaceLogo size={DIAGRAM_SIZE * 0.5} color={C.ink3} strokeWidth={0.8} />
                  </View>
                )}
                {/* structural framing brackets */}
                <View style={styles.frameCorner} />
                <View style={[styles.frameCorner, styles.frameTR]} />
                <View style={[styles.frameCorner, styles.frameBL]} />
                <View style={[styles.frameCorner, styles.frameBR]} />
                <View style={styles.scanStatus}>
                  <Text style={[T.kicker, { color: 'white', fontSize: 9 }]}>
                    {scanStep === 'scanning'
                      ? '· mapping 68 landmarks ·'
                      : '· align face · natural light · look ahead ·'}
                  </Text>
                </View>
                {scanStep === 'scanning' && (
                  <View style={styles.scanningOverlay}>
                    <ActivityIndicator color={C.accent} size="large" />
                  </View>
                )}
              </View>
            ) : (
              <FaceLogo size={DIAGRAM_SIZE} color={C.ink2} strokeWidth={1.4} animated />
            )}
          </View>
        </FlutedGlass>

        <View style={styles.footer}>
          <Text style={[T.kicker, { color: C.ink3 }]}>METRICS · STRUCTURAL</Text>
          <Text style={[T.kicker, { color: geminiLive ? C.accent : C.ink3 }]}>
            {geminiLive ? 'PORELESS AI · LIVE' : 'PORELESS AI · SIM'}
          </Text>
        </View>

        <Text style={[T.kicker, { marginBottom: 8, marginTop: 8 }]}>INSIGHTS · TAP TO EXPAND</Text>
        {insights.map((ins, i) => {
          const isOpen = expandedInsight === i;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setExpandedInsight(isOpen ? null : i)}
              activeOpacity={0.8}
            >
              <FlutedGlass padding={12} mode="lookmax" style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.body, { fontWeight: '600', fontSize: 13, flex: 1 }]}>{ins.title}</Text>
                  <View style={[styles.insightTag, { backgroundColor: ins.tagVariant === 'sage' ? C.sageSoft : '#FEF3E2' }]}>
                    <Text style={[T.pill, { color: ins.tagVariant === 'sage' ? C.sage : C.warn }]}>{ins.tag}</Text>
                  </View>
                  <View style={{ marginLeft: 8 }}>
                    {isOpen
                      ? <ChevronUp size={16} strokeWidth={1.4} color={C.ink3} />
                      : <ChevronDown size={16} strokeWidth={1.4} color={C.ink3} />}
                  </View>
                </View>
                {isOpen && (
                  <Text style={[T.bodySm, { color: C.ink3, marginTop: 10, lineHeight: 17 }]}>{ins.body}</Text>
                )}
              </FlutedGlass>
            </TouchableOpacity>
          );
        })}

        {/* Scan CTA — camera flow, gated for a second scan within 7 days */}
        {scanStep === 'camera' ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[styles.analyseBtn, { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line2 }]}
              onPress={() => setScanStep('idle')} activeOpacity={0.8}>
              <Text style={[T.button, { color: C.ink3, fontSize: 13 }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.analyseBtn, { flex: 2 }]} onPress={capture} activeOpacity={0.85}>
              <Text style={[T.button, { color: C.bg, fontSize: 13 }]}>⊙  Capture structure</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.analyseBtn, locked && styles.analyseBtnLocked, scanStep === 'scanning' && { backgroundColor: C.ink3 }]}
            onPress={scanStep === 'scanning' ? undefined : startScan}
            activeOpacity={0.85}
          >
            <Text style={[T.button, { color: locked ? C.ink3 : C.bg, fontSize: 13 }]}>
              {scanStep === 'scanning'
                ? '⏳  Analysing structure…'
                : scanStep === 'done'
                  ? '✓  Scan complete · scan again'
                  : locked
                    ? '⊘  Unlock structural rescan · Premium'
                    : '⊙  Scan facial structure'}
            </Text>
            {locked && scanStep !== 'scanning' && (
              <Text style={[T.kicker, { color: C.ink4, marginTop: 5, fontSize: 9 }]}>
                Free scan used · resets in 7 days · or unlock Premium
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <PremiumModal
        visible={showPremiumModal}
        onClose={dismissPremiumModal}
        onActivate={() => { setPremiumStatus(true); dismissPremiumModal(); }}
        reason="structural"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  diagramWrap: { alignItems: 'center', backgroundColor: '#FAF8F3', borderRadius: R.md, paddingVertical: 12 },
  cameraBox: {
    width: DIAGRAM_SIZE, height: DIAGRAM_SIZE, borderRadius: R.md,
    overflow: 'hidden', backgroundColor: '#E8DDD0', position: 'relative',
  },
  camPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EAE0' },
  frameCorner: {
    position: 'absolute', top: 14, left: 14, width: 22, height: 22,
    borderTopWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
  },
  frameTR: { left: undefined, right: 14, borderLeftWidth: 0, borderRightWidth: 2 },
  frameBL: { top: undefined, bottom: 14, borderTopWidth: 0, borderBottomWidth: 2 },
  frameBR: { top: undefined, left: undefined, right: 14, bottom: 14, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 2, borderBottomWidth: 2 },
  scanStatus: {
    position: 'absolute', top: 12, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.pill,
  },
  scanningOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(251,250,247,0.35)', alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  insightTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, marginLeft: 8 },
  analyseBtn: {
    backgroundColor: C.ink,
    borderRadius: R.md,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  analyseBtnLocked: {
    backgroundColor: '#F0EDE8',
    borderWidth: 1,
    borderColor: '#DDD8D0',
  },
});
