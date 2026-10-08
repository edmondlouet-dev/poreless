import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FaceLogo } from '../components/FaceLogo';
import { FlutedGlass } from '../components/FlutedGlass';
import { useStore } from '../store';
import { C, R, T, S } from '../tokens';

const ChevronRight = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M9 6l6 6-6 6" stroke={C.ink3} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const MENU_ITEMS = [
  { label: 'Settings',       icon: '◐', screen: 'settings' },
  { label: 'Skin profile',   icon: '◉', screen: null },
  { label: 'Privacy',        icon: '◌', screen: null },
  { label: 'About Poreless', icon: '◯', screen: null },
];

interface Props {
  onSettings?: () => void;
}

type InfoModal = 'skin' | 'privacy' | 'about' | null;

const SKINTYPE_LABEL: Record<string, string> = {
  oily: 'Oily', dry: 'Dry', combo: 'Combination', normal: 'Normal', sensitive: 'Sensitive',
};
const CONCERN_LABEL: Record<string, string> = {
  acne: 'Acne & breakouts', dryness: 'Dryness', darkspots: 'Dark spots',
  texture: 'Texture & pores', redness: 'Redness & sensitivity', aging: 'Fine lines & aging',
};

const InfoRow: React.FC<{ label: string; value: string; last?: boolean }> = ({ label, value, last }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9, gap: 16 },
    !last && { borderBottomWidth: 1, borderBottomColor: C.line }]}>
    <Text style={[T.bodySm, { color: C.ink3 }]}>{label}</Text>
    <Text style={[T.bodySm, { color: C.ink, fontWeight: '600', flex: 1, textAlign: 'right' }]}>{value}</Text>
  </View>
);

export const You: React.FC<Props> = ({ onSettings }) => {
  const insets = useSafeAreaInsets();
  const { user, streak, completions, scans, shelf, logout, questionnaireAnswers, skinFeel, isPremium } = useStore();
  const [infoModal, setInfoModal] = useState<InfoModal>(null);
  const displayName = user?.name ?? 'You';


  return (
    <View style={styles.root}>
      <Background />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar — face logo, not scan portrait */}
        <View style={styles.profileTop}>
          <View style={styles.avatarWrap}>
            <FaceLogo size={52} color={C.ink2} strokeWidth={1.2} />
          </View>
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={[T.pill, { color: C.accent }]}>✦ LIFETIME PREMIUM</Text>
            </View>
          )}
          <Text style={[T.h2, { marginTop: 10 }]}>{displayName}</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { value: String(streak),             label: 'Day streak' },
            { value: String(completions.length), label: 'Routines done' },
            { value: String(scans.length),       label: 'Scans taken' },
          ].map(stat => (
            <FlutedGlass key={stat.label} padding={12} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[T.num, { fontSize: 22, fontWeight: '600', textAlign: 'center' }]}>
                {stat.value}
              </Text>
              <Text style={[T.kicker, { color: C.ink3, textAlign: 'center', marginTop: 3, letterSpacing: 0.4 }]}>
                {stat.label}
              </Text>
            </FlutedGlass>
          ))}
        </View>

        {/* Menu list */}
        <Text style={[T.kicker, { marginBottom: 8 }]}>ACCOUNT</Text>
        <View style={styles.menuList}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, i < MENU_ITEMS.length-1 && styles.menuRowBorder]}
              onPress={() => {
                if (item.screen === 'settings') onSettings?.();
                else if (item.label === 'Skin profile')   setInfoModal('skin');
                else if (item.label === 'Privacy')        setInfoModal('privacy');
                else if (item.label === 'About Poreless') setInfoModal('about');
              }}
              activeOpacity={0.6}
            >
              <Text style={[T.body, { color: C.ink3, marginRight: 10 }]}>{item.icon}</Text>
              <Text style={[T.body, { flex: 1, fontWeight: '500', color: C.ink }]}>{item.label}</Text>
              <ChevronRight />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOut} onPress={logout} activeOpacity={0.7}>
          <Text style={[T.button, { color: C.ink3 }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Skin profile / Privacy / About — info sheets */}
      <Modal
        visible={infoModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInfoModal(null)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={[T.h2, { fontSize: 18 }]}>
              {infoModal === 'skin' ? 'Skin profile' : infoModal === 'privacy' ? 'Privacy' : 'About Poreless'}
            </Text>
            <TouchableOpacity onPress={() => setInfoModal(null)} activeOpacity={0.7}>
              <Text style={[T.body, { color: C.ink3, fontSize: 18 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: S.gutter, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

            {infoModal === 'skin' && (
              <>
                <Text style={[T.kicker, { marginBottom: 8 }]}>FROM YOUR ONBOARDING</Text>
                <FlutedGlass padding={14} style={{ marginBottom: 12 }}>
                  <InfoRow label="Skin type" value={(questionnaireAnswers.skintype.map(s => SKINTYPE_LABEL[s] ?? s).join(', ')) || 'Not set'} />
                  <InfoRow label="Top concerns" value={(questionnaireAnswers.concern.map(c => CONCERN_LABEL[c] ?? c).join(', ')) || 'Not set'} />
                  <InfoRow label="Goals" value={questionnaireAnswers.goals.length ? `${questionnaireAnswers.goals.length} selected` : 'Not set'} />
                  <InfoRow label="Age range" value={questionnaireAnswers.age[0] ?? 'Not set'} last />
                </FlutedGlass>
                <Text style={[T.kicker, { marginBottom: 8 }]}>RIGHT NOW</Text>
                <FlutedGlass padding={14}>
                  <InfoRow label="Skin feel (you said)" value={skinFeel} />
                  <InfoRow label="Products on shelf" value={String(shelf.length)} last />
                </FlutedGlass>
                <Text style={[T.bodySm, { color: C.ink4, marginTop: 14, lineHeight: 17 }]}>
                  Your answers shape the daily brief and which gaps come first. Update how your skin
                  feels on the Progress tab whenever it changes.
                </Text>
              </>
            )}

            {infoModal === 'privacy' && (
              <>
                {[
                  ['What leaves your phone', 'When you scan your face or a product label, that photo is sent through the Poreless server to Google\'s Gemini AI to be read. The Poreless server doesn\'t save it.'],
                  ['What stays on your phone', 'Your progress photos, scores, shelf, routine history and profile are saved only on this device.'],
                  ['Location', 'If you allow it, your rough location (about 1 km) is sent to Open-Meteo to look up today\'s UV index. It isn\'t stored.'],
                  ['No selling', 'We never sell your data or skin photos to third parties.'],
                  ['Your control', 'Hold a photo on the Progress tab to delete it, or use Settings → Start over to erase everything on this device.'],
                ].map(([h, b]) => (
                  <FlutedGlass key={h} padding={14} style={{ marginBottom: 10 }}>
                    <Text style={[T.body, { fontWeight: '600', marginBottom: 4 }]}>{h}</Text>
                    <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17 }]}>{b}</Text>
                  </FlutedGlass>
                ))}
              </>
            )}

            {infoModal === 'about' && (
              <>
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <FaceLogo size={56} color={C.ink2} strokeWidth={1.2} />
                  <Text style={[T.h2, { marginTop: 10 }]}>Poreless</Text>
                  <Text style={[T.kicker, { color: C.ink3, marginTop: 4 }]}>VERSION 1.0.0</Text>
                </View>
                <FlutedGlass padding={14} style={{ marginBottom: 10 }}>
                  <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18 }]}>
                    Poreless builds your routine from the products you own, checks them against each other,
                    tracks your skin with progress photos, and tells you when a product has had long enough to work.
                  </Text>
                </FlutedGlass>
                <FlutedGlass padding={14}>
                  <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17 }]}>
                    Advice is based on published dermatology guidance. Not medical advice: see a GP or
                    dermatologist for anything that worries you.
                  </Text>
                </FlutedGlass>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  profileTop: { alignItems: 'center', marginBottom: 20 },
  avatarWrap: {
    width: 88, height: 88,
    borderRadius: 44,
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  premiumBadge: {
    marginTop: 8,
    backgroundColor: C.accentSoft,
    borderRadius: R.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  menuList: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.line,
    marginBottom: 16, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  signOut: { alignItems: 'center', paddingVertical: 16 },
  sheet: { flex: 1, backgroundColor: C.bg, paddingTop: 16 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: S.gutter, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
});
