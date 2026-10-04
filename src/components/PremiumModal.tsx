import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Lock, Sparkles, X } from 'lucide-react-native';
import { C, R, T, S } from '../tokens';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onActivate?: () => void;
  reason?: 'structural' | 'library';
}

const COPY = {
  structural: {
    eyebrow: 'ARCHITECTURAL LAYER · LOCKED',
    title: 'Deep structural analysis\nrequires membership.',
    body: 'Your free weekly structural scan has been used. Unlock unlimited deep-mesh facial analysis and the complete global heritage library.',
  },
  library: {
    eyebrow: 'HERITAGE LIBRARY · LOCKED',
    title: 'Complete your global ritual\ncollection.',
    body: 'The first three traditions are always free. Unlock the full seven-tradition heritage library and unlimited structural scans.',
  },
};

export const PremiumModal: React.FC<Props> = ({
  visible, onClose, onActivate, reason = 'structural',
}) => {
  const slide = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [visible]);

  const copy = COPY[reason];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <BlurView style={StyleSheet.absoluteFill} intensity={60} tint="light" />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
          {/* Top handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={24} strokeWidth={1.2} color={C.ink3} />
          </TouchableOpacity>

          {/* Lock icon */}
          <View style={styles.iconWrap}>
            <Lock size={24} strokeWidth={1.2} color={C.accentInk} />
          </View>

          <Text style={[T.kicker, { color: C.accent, marginBottom: 14, textAlign: 'center' }]}>
            {copy.eyebrow}
          </Text>

          <Text style={[T.h1, { fontSize: 28, textAlign: 'center', marginBottom: 14, lineHeight: 34 }]}>
            {copy.title}
          </Text>

          <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', lineHeight: 19, marginBottom: 28, paddingHorizontal: 8 }]}>
            {copy.body}
          </Text>

          {/* Price row */}
          <View style={styles.priceRow}>
            <View>
              <Text style={[T.num, { fontSize: 32, fontWeight: '700', color: C.ink }]}>£6.99</Text>
              <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>PER MONTH</Text>
            </View>
            <View style={styles.featureList}>
              {[
                'Unlimited structural mesh analysis',
                'All 7 global heritage traditions',
                'Priority skin insights',
              ].map(f => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <Sparkles size={12} strokeWidth={1.2} color={C.accent} />
                  <Text style={[T.bodySm, { color: C.ink2, fontSize: 11 }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.85}
            onPress={onActivate ?? onClose}
          >
            <Sparkles size={16} strokeWidth={1.2} color={C.bg} />
            <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>Activate Membership →</Text>
          </TouchableOpacity>

          <Text style={[T.bodySm, { color: C.ink4, textAlign: 'center', marginTop: 14, fontSize: 11, lineHeight: 16 }]}>
            Cancel anytime. Billed monthly via App Store.{'\n'}
            Free tier features always remain available.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(26,24,20,0.35)',
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: S.gutter + 4,
    paddingTop: 16, paddingBottom: 44,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.line2,
    alignSelf: 'center', marginBottom: 20,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: S.gutter,
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '44',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 20, marginBottom: 28,
    backgroundColor: C.surface2, borderRadius: R.lg,
    padding: 16,
  },
  featureList: { flex: 1, justifyContent: 'center' },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.ink, borderRadius: R.md,
    paddingVertical: 15,
  },
});
