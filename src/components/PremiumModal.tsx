import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Lock, Sparkles, X } from 'lucide-react-native';
import { useStore, type PremiumReason } from '../store';
import { AI_LIMITS } from '../limits';
import { BILLING_LIVE, PRICE_LABEL, monthlyPrice, restore, subscribe } from '../services/purchases';
import { C, R, T, S } from '../tokens';

const { height: SCREEN_H } = Dimensions.get('window');

const { free: FREE, premium: PREM } = AI_LIMITS;

const COPY: Record<PremiumReason, { eyebrow: string; title: string; body: string }> = {
  scans: {
    eyebrow: 'AI SCANS · PREMIUM',
    title: 'You\'ve used this month\'s\nfree scans.',
    body: `Free includes ${FREE.face} face scans and ${FREE.label} label reads a month, and resets on the 1st. Premium raises that to ${PREM.face} of each, about one a day.`,
  },
  report: {
    eyebrow: 'DERMATOLOGIST REPORT · PREMIUM',
    title: 'Walk into your appointment\nwith the answers.',
    body: 'A PDF of your progress photos, every product with its start date, and how each trial went. It answers "what have you tried, and for how long?"',
  },
  backup: {
    eyebrow: 'PHOTO BACKUP · PREMIUM',
    title: 'Don\'t lose months\nof progress.',
    body: 'Your photos and history live only on this phone. Premium saves a backup to iCloud Drive, Google Drive or anywhere in Files. Restoring a backup is always free.',
  },
  recap: {
    eyebrow: 'RECAP HISTORY · PREMIUM',
    title: 'See every month,\nnot just the latest.',
    body: 'Free shows this month and last month. Premium keeps every monthly recap, so you can look back to where you started.',
  },
  timelapse: {
    eyebrow: 'PROGRESS TIMELAPSE · PREMIUM',
    title: 'Watch your skin change\nweek by week.',
    body: 'Your photo timeline and before-and-after compare are free. Premium plays every progress photo as a timelapse.',
  },
};

const FEATURES = [
  `${PREM.face} face scans and ${PREM.label} label reads a month`,
  'Dermatologist report (PDF)',
  'Photo backup to iCloud or Google Drive',
  'Every monthly recap',
  'Progress timelapse',
];

// One paywall for the whole app; it opens on whatever the user just tapped.
export const PremiumModal: React.FC = () => {
  const { showPremiumModal: visible, premiumReason, dismissPremiumModal, setPremiumStatus } = useStore();
  const slide = useRef(new Animated.Value(SCREEN_H)).current;
  const [price, setPrice] = useState(PRICE_LABEL);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    if (visible) monthlyPrice().then(p => p && setPrice(p)).catch(() => {});
  }, [visible]);

  const copy = COPY[premiumReason];

  const onSubscribe = async () => {
    setBusy(true);
    const outcome = await subscribe();
    setBusy(false);
    if (outcome === 'subscribed' || outcome === 'test') {
      setPremiumStatus(true);
      dismissPremiumModal();
    } else if (outcome === 'failed') {
      Alert.alert('Couldn\'t start Premium', 'Nothing was charged. Check your connection and try again.');
    }
  };

  const onRestore = async () => {
    setBusy(true);
    const ok = await restore();
    setBusy(false);
    if (ok) { setPremiumStatus(true); dismissPremiumModal(); }
    else Alert.alert('No subscription found', 'This store account doesn\'t have an active Poreless Premium subscription.');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissPremiumModal}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <BlurView style={StyleSheet.absoluteFill} intensity={60} tint="light" />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismissPremiumModal} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
          {/* Top handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={dismissPremiumModal} activeOpacity={0.7}>
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

          <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', lineHeight: 19, marginBottom: 22, paddingHorizontal: 8 }]}>
            {copy.body}
          </Text>

          {/* Price row */}
          <View style={styles.priceRow}>
            <View>
              <Text style={[T.num, { fontSize: 32, fontWeight: '700', color: C.ink }]}>{price}</Text>
              <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>PER MONTH</Text>
            </View>
            <View style={styles.featureList}>
              {FEATURES.map(f => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <Sparkles size={12} strokeWidth={1.2} color={C.accent} />
                  <Text style={[T.bodySm, { color: C.ink2, fontSize: 11, flex: 1 }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.cta, busy && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={onSubscribe}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={C.bg} /> : <Sparkles size={16} strokeWidth={1.2} color={C.bg} />}
            <Text style={[T.button, { color: C.bg, fontSize: 14 }]}>
              {BILLING_LIVE ? `Subscribe · ${price}/month` : 'Unlock Premium · test mode'}
            </Text>
          </TouchableOpacity>

          {BILLING_LIVE && (
            <TouchableOpacity onPress={onRestore} disabled={busy} style={{ alignSelf: 'center', marginTop: 12 }} hitSlop={8}>
              <Text style={[T.bodySm, { color: C.ink3, fontSize: 12, textDecorationLine: 'underline' }]}>Restore purchase</Text>
            </TouchableOpacity>
          )}

          <Text style={[T.bodySm, { color: C.ink4, textAlign: 'center', marginTop: 12, fontSize: 11, lineHeight: 16 }]}>
            {BILLING_LIVE
              ? 'Renews monthly until you cancel in your store account settings.\nRoutine, clash warnings, UV and trials always stay free.'
              : 'Store billing isn\'t set up in this build, so nothing is charged.\nRoutine, clash warnings, UV and trials always stay free.'}
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
