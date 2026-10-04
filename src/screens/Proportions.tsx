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
import { checkFacePhoto } from '../services/faceCheck';
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

  // null until a scan runs; then whether that scan's result was demo data.
  const [lastSimulated, setLastSimulated] = useState<boolean | null>(null);
  const demo = lastSimulated ?? !geminiLive;
  const [notice, setNotice] = useState<string | null>(null);

  const tiltLabel = structural.canthalTilt < 0 ? 'outer corner lower'
    : structural.canthalTilt > 0 ? 'outer corner higher' : 'level';
  const feelsSensitive = /sensiti/i.test(structural.barrierStatus);

  // Proportions are normal variation, so they never get a good/warn grade. Only
  // the self-reported skin feel can flag something to act on.
  const LM_METRICS = [
    { key: 'tilt',    value: `${structural.canthalTilt}°`, label: 'Eye tilt', dot: 'good' as const },
    { key: 'midface', value: structural.midfaceRatio.toFixed(2), label: 'Midface', dot: 'good' as const },
    { key: 'fluid',   value: structural.fluidRetention, label: 'Puffiness', dot: 'good' as const },
    { key: 'barrier', value: structural.barrierStatus.replace('Feels ', ''), label: 'Skin feel', dot: (feelsSensitive ? 'warn' : 'good') as 'warn' | 'good' },
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
      let measuredTilt: number | null = null;
      if (permission?.granted && cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
        base64 = photo.base64 ?? '';
        // On-device check first: angles are only comparable from a straight-on,
        // level photo, and a bad one shouldn't cost an AI call or the free scan.
        const check = await checkFacePhoto(photo.uri, photo.width, photo.height, 'structure');
        if (check.issue) {
          setNotice(`${check.issue}. Face the camera straight-on and level, in even light. Nothing was saved, and this didn't use your free scan.`);
          setScanStep('camera');
          return;
        }
        measuredTilt = check.canthalTilt;
      }
      const ai = await analyzeStructuralFrame(base64);
      // Eye tilt measured from real eye-corner landmarks beats the AI's estimate.
      const result = measuredTilt !== null ? { ...ai, canthalTilt: measuredTilt } : ai;
      setLastSimulated(result.simulated);
      if (result.seeDoctor) {
        setNotice(`${result.seeDoctorReason ? result.seeDoctorReason + '. ' : ''}This is worth showing a GP or dermatologist. Poreless can't assess it.`);
        setScanStep('idle');
        return;
      }
      if (!result.photoUsable) {
        setNotice(`${result.photoIssue ? result.photoIssue + '. ' : ''}Face the camera straight-on and level, in even light. Nothing was saved, and this didn't use your free scan.`);
        setScanStep('camera');
        return;
      }
      setNotice(null);
      // Demo numbers never overwrite saved readings.
      if (!result.simulated) {
        const { canthalTilt, midfaceRatio, fluidRetention } = result;
        updateMetrics({ canthalTilt, midfaceRatio, fluidRetention });
        recordStructuralScan();
      }
      setScanStep('done');
      refreshEditorialInsight();
    } catch {
      setScanStep('idle');
      Alert.alert('Couldn\'t analyse this photo', 'Check your connection and try again. Nothing was saved.');
    }
  };

  const insights = [
    {
      title: `Eye tilt: ${structural.canthalTilt}° (${tiltLabel})`,
      body: 'Measured from your eye corners in one photo; small head turns shift it by a degree or so. ' +
        'Eye shape is set by bone and ligaments, and every shape is normal. Skincare and ' +
        'massage don\'t change it, so there is nothing here to fix.',
      tag: 'Info',
      tagVariant: 'sage',
    },
    {
      title: `Midface ratio: ${structural.midfaceRatio.toFixed(2)}`,
      body: 'A rough estimate of midface length relative to width. Faces vary widely and ' +
        'every face is slightly asymmetric. Skincare, gua sha and "mewing" have no good ' +
        'evidence of changing adult facial structure.',
      tag: 'Info',
      tagVariant: 'sage',
    },
    {
      title: `Puffiness: ${structural.fluidRetention}`,
      body: structural.fluidRetention === 'Low'
        ? 'Your face didn\'t look puffy in this photo.'
        : 'Your face looked a little puffy in this photo. Puffiness changes with sleep, salt, ' +
          'alcohol, allergies and time of day. A cool rinse can feel refreshing. If swelling ' +
          'is sudden, painful or around the lips or eyes, see a doctor.',
      tag: structural.fluidRetention === 'Low' ? 'Info' : 'Varies',
      tagVariant: 'sage',
    },
    {
      title: `Skin feel: ${structural.barrierStatus}`,
      body: feelsSensitive
        ? 'You said your skin feels sensitive. Favour gentle, fragrance-free products and pause ' +
          'strong actives (retinoids, acids) until it feels comfortable again.'
        : 'This is what you told us on the Scan tab; a photo can\'t show how skin feels. ' +
          'Update it there whenever it changes. Daily SPF is the best-evidenced habit for skin.',
      tag: feelsSensitive ? 'Go gentle' : 'Info',
      tagVariant: feelsSensitive ? 'warn' : 'sage',
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
              rough estimates · normal variation · not a grade
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} activeOpacity={0.7} onPress={onOpenSettings}>
            <SettingsIcon size={20} strokeWidth={1.3} color={C.ink3} />
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 16 }}>
          <MetricStrip metrics={LM_METRICS} active={active} onPick={setActive} />
        </View>

        {notice && (
          <FlutedGlass padding={12} mode="lookmax" style={{ marginBottom: 14 }}>
            <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18 }]}>{notice}</Text>
          </FlutedGlass>
        )}

        {/* AI editorial read — shimmers while the Gemini brain composes it */}
        {(isAnalyzing || editorialInsight) && (
          <FlutedGlass padding={16} mode="lookmax" style={{ marginBottom: 14 }}>
            <Text style={[T.kicker, { color: C.accent, marginBottom: 10 }]}>
              ✦ PORELESS AI · A NOTE ON YOUR PROPORTIONS
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
                      ? '· analysing photo ·'
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
          <Text style={[T.kicker, { color: !demo ? C.accent : C.ink3 }]}>
            {demo ? 'PORELESS AI · DEMO' : 'PORELESS AI · LIVE'}
          </Text>
        </View>

        <Text style={[T.bodySm, { color: C.ink3, fontSize: 11, lineHeight: 15, marginTop: 4 }]}>
          Rough estimates from one photo, for curiosity only. They describe normal variation,
          not health or attractiveness, and skincare doesn't change them.
        </Text>

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
