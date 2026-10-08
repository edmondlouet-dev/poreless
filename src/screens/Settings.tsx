import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FlutedGlass } from '../components/FlutedGlass';
import { useStore } from '../store';
import { AI_LIMITS } from '../limits';
import { shareBackup, pickBackup, unpackBackup } from '../services/backup';
import { BILLING_LIVE, PRICE_LABEL, restore } from '../services/purchases';
import { shortDate } from '../dates';
import { C, R, T, S } from '../tokens';

const BackArrow = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M19 12H5M11 18l-6-6 6-6" stroke={C.ink} strokeWidth={1.6}
      fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

interface Props { onBack: () => void }

export const Settings: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const {
    geminiLive, resetApp, isPremium, aiLeft, openPremiumModal, setPremiumStatus, restoreData,
    questionnaireAnswers,
  } = store;
  const [busy, setBusy] = useState<'backup' | 'restore' | 'purchase' | null>(null);
  const plan = AI_LIMITS[isPremium ? 'premium' : 'free'];

  const backUp = async () => {
    if (!isPremium) return openPremiumModal('backup');
    setBusy('backup');
    try {
      await shareBackup({
        skinFeel: store.skinFeel, shelf: store.shelf, scans: store.scans, completions: store.completions,
        doneSteps: store.doneSteps, trials: store.trials, spfReapplyAt: store.spfReapplyAt,
        premium: store.premium, aiUsage: store.aiUsage,
      }, questionnaireAnswers);
    } catch {
      Alert.alert('Backup didn\'t finish', 'Nothing was changed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  // Restoring is free: a backup is the user's own data.
  const restoreBackup = async () => {
    let picked;
    try { picked = await pickBackup(); } catch {
      return Alert.alert('Not a Poreless backup', 'Pick the .json file that Back up made.');
    }
    if (!picked) return;
    Alert.alert(
      'Restore this backup?',
      `From ${shortDate(picked.createdAt)} with ${picked.photoCount} photos. It replaces the shelf, photos and history on this phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: async () => {
          setBusy('restore');
          try {
            const { data, answers } = await unpackBackup(picked.file);
            restoreData(data, answers);
            Alert.alert('Restored', 'Your photos and history are back.');
          } catch {
            Alert.alert('Restore didn\'t finish', 'Try again with the same file.');
          } finally {
            setBusy(null);
          }
        } },
      ],
    );
  };

  const restorePurchase = async () => {
    setBusy('purchase');
    const ok = await restore();
    setBusy(null);
    if (ok) setPremiumStatus(true);
    Alert.alert(ok ? 'Premium restored' : 'No subscription found',
      ok ? 'Thanks for subscribing.' : 'This store account doesn\'t have an active Poreless Premium subscription.');
  };

  const confirmReset = () => {
    Alert.alert(
      'Start over?',
      'This clears your profile, answers, shelf, progress photos and sign-in on this device, and returns you to the intro. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset everything', style: 'destructive', onPress: () => { resetApp(); } },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <Background />
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        {/* Nav bar */}
        <View style={[styles.navBar, { paddingHorizontal: S.gutter }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <BackArrow />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[T.h2, { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: 0 }]}>
              Settings
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* AI engine status — reflects a real key check at launch */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>AI ENGINE</Text>
          <FlutedGlass padding={14} style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.statusDot, { backgroundColor: geminiLive ? C.sage : C.ink4 }]} />
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: '500' }]}>
                  Poreless AI · {geminiLive ? 'Live' : 'Demo'}
                </Text>
                <Text style={[T.bodySm, { color: C.ink3, marginTop: 2, lineHeight: 17 }]}>
                  {geminiLive
                    ? 'Connected. Scans and label reads run on the live model; if a call fails you\'ll be asked to retry, never shown made-up results.'
                    : 'Not connected. Scans show demo data, clearly labelled and never saved. Set EXPO_PUBLIC_PROXY_URL to go live.'}
                </Text>
              </View>
            </View>
          </FlutedGlass>

          {/* Plan */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>PLAN</Text>
          <FlutedGlass padding={14} style={{ marginBottom: 10 }}>
            <Text style={[T.body, { fontWeight: '500' }]}>
              {isPremium ? 'Premium' : 'Free'}{isPremium ? '' : ` · Premium is ${PRICE_LABEL}/month`}
            </Text>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 4, lineHeight: 17 }]}>
              This month: {aiLeft('face')} of {plan.face} face scans and {aiLeft('label')} of {plan.label} label
              reads left. Resets on the 1st.
            </Text>
            {!isPremium && (
              <TouchableOpacity onPress={() => openPremiumModal('scans')} style={{ marginTop: 10 }} activeOpacity={0.7}>
                <Text style={[T.button, { color: C.accentInk, fontSize: 13 }]}>See Premium →</Text>
              </TouchableOpacity>
            )}
            {BILLING_LIVE && (
              <TouchableOpacity onPress={restorePurchase} disabled={!!busy} style={{ marginTop: 10 }} activeOpacity={0.7}>
                <Text style={[T.bodySm, { color: C.ink3, textDecorationLine: 'underline' }]}>
                  {busy === 'purchase' ? 'Checking…' : 'Restore purchase'}
                </Text>
              </TouchableOpacity>
            )}
            {isPremium && BILLING_LIVE && (
              <Text style={[T.bodySm, { color: C.ink4, fontSize: 11, marginTop: 8, lineHeight: 16 }]}>
                Cancel any time in your App Store or Google Play subscriptions.
              </Text>
            )}
          </FlutedGlass>

          {/* Backup */}
          <Text style={[T.kicker, { marginBottom: 8, marginTop: 8 }]}>BACKUP</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TouchableOpacity style={[styles.dataBtn, { flex: 1 }]} onPress={backUp} disabled={!!busy} activeOpacity={0.85}>
              <Text style={[T.button, { color: C.ink, fontSize: 13 }]}>
                {busy === 'backup' ? 'Packing…' : `Back up${isPremium ? '' : ' · Premium'}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dataBtn, { flex: 1 }]} onPress={restoreBackup} disabled={!!busy} activeOpacity={0.85}>
              <Text style={[T.button, { color: C.ink, fontSize: 13 }]}>{busy === 'restore' ? 'Restoring…' : 'Restore'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[T.bodySm, { color: C.ink4, fontSize: 11, marginBottom: 18, lineHeight: 16 }]}>
            Back up saves one file with your photos, shelf and history. Choose iCloud Drive, Google Drive
            or Files when the share sheet opens. Restore works on any plan.
          </Text>

          {/* App info */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>ABOUT</Text>
          <FlutedGlass padding={14} style={{ marginBottom: 18 }}>
            <Text style={[T.body, { fontWeight: '500' }]}>Poreless</Text>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 4 }]}>Version 1.0.0</Text>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 8, lineHeight: 17 }]}>
              Advice is based on published dermatology guidance.{'\n'}
              Not medical advice. See a GP or dermatologist for anything that worries you.
            </Text>
          </FlutedGlass>

          {/* Danger zone — start over */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>DATA</Text>
          <TouchableOpacity style={styles.resetBtn} onPress={confirmReset} activeOpacity={0.85}>
            <Text style={[T.button, { color: C.danger, fontSize: 13 }]}>Start over · reset all my data</Text>
          </TouchableOpacity>
          <Text style={[T.bodySm, { color: C.ink4, fontSize: 11, marginTop: 8, lineHeight: 16 }]}>
            Clears your profile, answers, shelf, progress photos and sign-in on this device and returns to the intro.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: S.gutter },
  statusDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  dataBtn: {
    borderWidth: 1, borderColor: C.line2, borderRadius: R.md,
    paddingVertical: 13, alignItems: 'center', backgroundColor: C.surface,
  },
  resetBtn: {
    borderWidth: 1, borderColor: C.danger + '55', borderRadius: R.md,
    paddingVertical: 13, alignItems: 'center', backgroundColor: '#FBEEEA',
  },
});
