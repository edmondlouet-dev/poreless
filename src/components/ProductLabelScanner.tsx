/**
 * AI Label Recognizer — replaces the barcode scanner.
 *
 * Luxury bottles rarely carry a usable barcode, so instead we photograph the
 * LABEL, run it through OCR, and hand the extracted text to Gemini, which
 * returns a clean structured product profile (name / brand / ingredients).
 *
 * Pipeline:  capture frame → Cloud Vision OCR (simulated until a key is set)
 *            → Gemini parses to JSON → append to the shelf → conflict check.
 *
 * Free for everyone, and fully mock-safe in Expo Go / web (no native binary
 * dependency beyond the standard expo-camera wrapper).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, ScanText, ShoppingBag, Check, TriangleAlert } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, type ShelfProduct } from '../store';
import { C, R, T, S } from '../tokens';

/**
 * Cloud Vision OCR — simulated. Returns the raw text a label photo would yield.
 * Each capture varies so the recognizer doesn't return the same product twice.
 * When a Vision key is wired this is the single function to swap out.
 */
const LABEL_SAMPLES = [
  'LA MER\nCrème de la Mer\nMoisturizing Cream\nAqua, Algae Extract, Mineral Oil, Glycerin',
  'ESTÉE LAUDER\nAdvanced Night Repair\nSynchronized Multi-Recovery Complex',
  'SKINCEUTICALS\nC E FERULIC\nL-Ascorbic Acid 15% Vitamin E Ferulic Acid',
  'LA ROCHE-POSAY\nRetinol B3 Serum\nPure Retinol 0.3% Niacinamide',
  'AUGUSTINUS BADER\nThe Cleansing Balm\nTFC8 Glycerin Panthenol Aloe',
  "PAULA'S CHOICE\nSkin Perfecting 2% BHA\nLiquid Exfoliant Salicylic Acid",
];

async function simulateOCR(): Promise<string> {
  await new Promise(r => setTimeout(r, 700));
  const pick = LABEL_SAMPLES[Math.floor(Math.random() * LABEL_SAMPLES.length)]!;
  // append entropy so repeat scans of "the same" sample can still differ downstream
  return `${pick}\n#${Date.now() % 100000}`;
}

interface Props {
  visible: boolean;
  barrierStatus: string;
  onClose: () => void;
  onProductAdded: (product: ShelfProduct) => void;
}

type Phase = 'aim' | 'reading' | 'preview';

export const ProductLabelScanner: React.FC<Props> = ({
  visible, barrierStatus, onClose, onProductAdded,
}) => {
  const insets = useSafeAreaInsets();
  const { analyzeLabel, geminiLive } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase]     = useState<Phase>('aim');
  const [stage, setStage]     = useState('');   // sub-status during reading
  const [product, setProduct] = useState<ShelfProduct | null>(null);
  const cameraRef = useRef<any>(null);
  const cardSlide = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (!visible) { setPhase('aim'); setProduct(null); setStage(''); }
  }, [visible]);

  useEffect(() => {
    if (phase === 'preview') {
      Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, bounciness: 5 }).start();
    } else {
      cardSlide.setValue(300);
    }
  }, [phase]);

  const capture = async () => {
    setPhase('reading');
    try {
      // 1. Snapshot the label as base64 so Gemini Vision can read it directly.
      let imageBase64 = '';
      if (permission?.granted && cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
          imageBase64 = photo?.base64 ?? '';
        } catch {}
      }
      // 2. With a real photo, Gemini Vision does the OCR; without one (no camera),
      //    fall back to a sample label so the flow still works in any environment.
      setStage(imageBase64 ? 'Reading the label…' : 'Recognizing a sample…');
      const ocrText = imageBase64 ? '' : await simulateOCR();
      // 3. Cosmetic-chemist pass → structured profile + conflict verdict. Routed
      //    through the store so isAnalyzing drives the dashboard shimmer and the
      //    verdict is judged against the live barrier reading.
      setStage('Consulting the chemist…');
      const shelf = await analyzeLabel(ocrText, imageBase64 || undefined);
      setProduct(shelf);
      setPhase('preview');
    } catch {
      setPhase('aim');
    }
  };

  const handleAdd = () => {
    if (!product) return;
    onProductAdded(product);
    onClose();
  };

  const showWarning = !!product?.warningText;
  const cameraReady = !!permission?.granted;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Camera or warm placeholder */}
        {cameraReady && phase !== 'preview' ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1714' }]} />
        )}

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View>
            <Text style={[T.kicker, { color: 'rgba(255,255,255,0.9)', letterSpacing: 2 }]}>SCAN PRODUCT LABEL</Text>
            <Text style={[T.kicker, { color: geminiLive ? '#5BD66E' : 'rgba(255,255,255,0.5)', fontSize: 8, marginTop: 3 }]}>
              {geminiLive ? 'AI VISION · LIVE' : 'AI VISION · SIM'} · FREE
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <X size={24} strokeWidth={1.2} color="white" />
          </TouchableOpacity>
        </View>

        {/* Aim phase — thin sand frame + instruction */}
        {phase === 'aim' && (
          <>
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={styles.labelFrame} />
              <Text style={styles.frameHint}>Align the product label within the frame.</Text>
            </View>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
              {!cameraReady && (
                <TouchableOpacity style={styles.allowBtn} onPress={requestPermission} activeOpacity={0.85}>
                  <Text style={[T.button, { color: C.bg, fontSize: 13 }]}>Allow camera →</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.captureBtn} onPress={capture} activeOpacity={0.85}>
                <ScanText size={18} strokeWidth={1.3} color={C.ink} />
                <Text style={[T.button, { color: C.ink, fontSize: 14 }]}>
                  {cameraReady ? 'Capture label' : 'Recognize a sample label'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Reading phase */}
        {phase === 'reading' && (
          <View style={styles.readingWrap} pointerEvents="none">
            <ActivityIndicator size="large" color={SAND} />
            <Text style={[T.kicker, { color: 'white', marginTop: 14, letterSpacing: 1.5 }]}>{stage || 'Reading…'}</Text>
          </View>
        )}

        {/* Preview phase */}
        {phase === 'preview' && product && (
          <>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1714' }]} />
            <Animated.View style={[styles.card, { paddingBottom: insets.bottom + 28, transform: [{ translateY: cardSlide }] }]}>
              <Text style={[T.kicker, { color: C.accent, marginBottom: 12 }]}>✦ IDENTIFIED</Text>

              {/* Softer, shorter conflict note */}
              {showWarning && (
                <View style={styles.warnNote}>
                  <TriangleAlert size={14} strokeWidth={1.3} color={C.warn} />
                  <Text style={[T.bodySm, { color: C.ink2, flex: 1, fontSize: 12, lineHeight: 16 }]}>
                    {product.warningText}
                  </Text>
                </View>
              )}

              <View style={styles.cardHead}>
                <View style={styles.productIcon}>
                  <ShoppingBag size={22} strokeWidth={1.2} color={C.accentInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontWeight: '600', fontSize: 15, color: C.ink }]}>{product.name}</Text>
                  <Text style={[T.kicker, { color: C.ink3, marginTop: 3 }]}>{product.brand}</Text>
                </View>
              </View>

              <Text style={[T.kicker, { marginBottom: 8 }]}>KEY INGREDIENTS</Text>
              <View style={styles.ingredientRow}>
                {product.ingredients.slice(0, 5).map(ing => (
                  <View key={ing} style={styles.ingredientChip}>
                    <Text style={[T.pill, { color: C.ink2, fontSize: 10 }]}>{ing}</Text>
                  </View>
                ))}
                {product.ingredients.length > 5 && (
                  <Text style={[T.kicker, { color: C.ink3, fontSize: 9 }]}>+{product.ingredients.length - 5}</Text>
                )}
              </View>

              <View style={styles.ctaRow}>
                <TouchableOpacity style={styles.rescanBtn} onPress={() => { setProduct(null); setPhase('aim'); }} activeOpacity={0.7}>
                  <Text style={[T.button, { color: C.ink2, fontSize: 12 }]}>Rescan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85}>
                  <Check size={16} strokeWidth={1.2} color={C.bg} />
                  <Text style={[T.button, { color: C.bg, fontSize: 13 }]}>Add to Shelf</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </>
        )}
      </View>
    </Modal>
  );
};

const SAND = '#D8C3A5';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B08' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: S.gutter, paddingBottom: 12,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  labelFrame: {
    width: 240, height: 300, borderRadius: 14,
    borderWidth: 1.5, borderColor: SAND,
    backgroundColor: 'transparent',
  },
  frameHint: {
    ...T.kicker, color: SAND, marginTop: 20,
    letterSpacing: 0.6, fontSize: 11, textAlign: 'center', paddingHorizontal: 40,
  },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: S.gutter, gap: 10 },
  allowBtn: { backgroundColor: SAND, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' },
  captureBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: SAND, borderRadius: R.md, paddingVertical: 14,
  },
  readingWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
  },
  warnNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FEF6EC', borderRadius: R.md,
    borderWidth: 1, borderColor: 'rgba(193,140,60,0.25)',
    padding: 11, marginBottom: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  productIcon: {
    width: 48, height: 48, borderRadius: R.md,
    backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  ingredientRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20, alignItems: 'center' },
  ingredientChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line,
  },
  ctaRow: { flexDirection: 'row', gap: 10 },
  rescanBtn: {
    flex: 1, borderWidth: 1, borderColor: C.line2, borderRadius: R.md,
    paddingVertical: 12, alignItems: 'center', backgroundColor: C.surface2,
  },
  addBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.ink, borderRadius: R.md, paddingVertical: 12,
  },
});
