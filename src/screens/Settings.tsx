import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FlutedGlass } from '../components/FlutedGlass';
import { useStore } from '../store';
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
  const { temperatureUnit, setTemperatureUnit, userProfile, togglePassiveTracking, geminiLive, resetApp } = useStore();

  const isCelsius = temperatureUnit === 'C';

  const confirmReset = () => {
    Alert.alert(
      'Start over?',
      'This clears your profile, answers, shelf and sign-in on this device, and returns you to the intro. This cannot be undone.',
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
          {/* Temperature unit */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>DISPLAY</Text>
          <FlutedGlass padding={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: '500' }]}>Temperature Unit</Text>
                <Text style={[T.bodySm, { color: C.ink3, marginTop: 2 }]}>
                  Shown on Today's weather/UV strip
                </Text>
              </View>
              {/* C / F toggle */}
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitBtn, isCelsius && styles.unitBtnActive]}
                  onPress={() => setTemperatureUnit('C')}
                  activeOpacity={0.7}
                >
                  <Text style={[T.button, { fontSize: 13, color: isCelsius ? C.accentInk : C.ink3 }]}>°C</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitBtn, !isCelsius && styles.unitBtnActive]}
                  onPress={() => setTemperatureUnit('F')}
                  activeOpacity={0.7}
                >
                  <Text style={[T.button, { fontSize: 13, color: !isCelsius ? C.accentInk : C.ink3 }]}>°F</Text>
                </TouchableOpacity>
              </View>
            </View>
          </FlutedGlass>

          {/* Passive vanity tracking */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>TRACKING</Text>
          <FlutedGlass padding={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: '500' }]}>Passive Vanity Tracking</Text>
                <Text style={[T.bodySm, { color: C.ink3, marginTop: 2, lineHeight: 17 }]}>
                  Quietly logs passive metrics and habit streaks in the background.
                </Text>
              </View>
              <Switch
                value={userProfile.passiveTrackingEnabled}
                onValueChange={togglePassiveTracking}
                trackColor={{ false: C.surface3, true: C.accent + '80' }}
                thumbColor={userProfile.passiveTrackingEnabled ? C.accent : C.ink4}
              />
            </View>
          </FlutedGlass>

          {/* Notifications placeholder */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>NOTIFICATIONS</Text>
          <FlutedGlass padding={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
            {[
              { label: 'Morning reminder',  sub: 'Daily 7 AM routine nudge' },
              { label: 'Scan reminder',     sub: 'Every 3 days' },
              { label: 'Weekly summary',    sub: 'Sunday skin report' },
            ].map((item, i, arr) => (
              <View key={item.label}
                style={[styles.settingRow, i < arr.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontWeight: '500' }]}>{item.label}</Text>
                  <Text style={[T.bodySm, { color: C.ink3, marginTop: 2 }]}>{item.sub}</Text>
                </View>
                <Switch
                  value={false}
                  onValueChange={() => {}}
                  trackColor={{ false: C.surface3, true: C.accent + '80' }}
                  thumbColor={C.accent}
                />
              </View>
            ))}
          </FlutedGlass>

          {/* AI engine status — reflects a real key check at launch */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>AI ENGINE</Text>
          <FlutedGlass padding={14} style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.statusDot, { backgroundColor: geminiLive ? C.sage : C.ink4 }]} />
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: '500' }]}>
                  Poreless AI · {geminiLive ? 'Live' : 'Simulation'}
                </Text>
                <Text style={[T.bodySm, { color: C.ink3, marginTop: 2, lineHeight: 17 }]}>
                  {geminiLive
                    ? 'Connected — scans, label reads and editorial insights run on the live model.'
                    : 'No verified key — every feature runs a realistic on-device simulation. Add an AIza Gemini key to .env to go live.'}
                </Text>
              </View>
            </View>
          </FlutedGlass>

          {/* App info */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>ABOUT</Text>
          <FlutedGlass padding={14} style={{ marginBottom: 18 }}>
            <Text style={[T.body, { fontWeight: '500' }]}>Poreless</Text>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 4 }]}>Version 1.0.0</Text>
            <Text style={[T.bodySm, { color: C.ink3, marginTop: 8, lineHeight: 17 }]}>
              Skin analysis powered by peer-reviewed research.{'\n'}
              Not medical advice. Always consult a dermatologist for clinical concerns.
            </Text>
          </FlutedGlass>

          {/* Danger zone — start over */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>DATA</Text>
          <TouchableOpacity style={styles.resetBtn} onPress={confirmReset} activeOpacity={0.85}>
            <Text style={[T.button, { color: C.danger, fontSize: 13 }]}>Start over · reset all my data</Text>
          </TouchableOpacity>
          <Text style={[T.bodySm, { color: C.ink4, fontSize: 11, marginTop: 8, lineHeight: 16 }]}>
            Clears your profile, answers, shelf and sign-in on this device and returns to the intro.
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
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  unitToggle: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: C.line2,
    borderRadius: R.md, overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: C.surface,
  },
  unitBtnActive: { backgroundColor: C.accentSoft },
  statusDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  resetBtn: {
    borderWidth: 1, borderColor: C.danger + '55', borderRadius: R.md,
    paddingVertical: 13, alignItems: 'center', backgroundColor: '#FBEEEA',
  },
});
