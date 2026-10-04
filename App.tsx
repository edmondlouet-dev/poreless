import React, { useState, useCallback, useEffect } from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';

import { StoreProvider, useStore } from './src/store';
import { TabBar } from './src/components/TabBar';
import { Login } from './src/screens/Login';
import { SignUp } from './src/screens/SignUp';
import { Questionnaire } from './src/screens/Questionnaire';
import { PlanSummary } from './src/screens/PlanSummary';
import { Pitch } from './src/screens/Pitch';
import { Today } from './src/screens/Today';
import { Scan } from './src/screens/Scan';
import { Proportions } from './src/screens/Proportions';
import { Rituals } from './src/screens/Rituals';
import { You } from './src/screens/You';
import { Products } from './src/screens/Products';
import { Settings } from './src/screens/Settings';

SplashScreen.preventAutoHideAsync();

type TabKey = 'today' | 'scan' | 'proportions' | 'rituals' | 'you';
type AuthScreen = 'login' | 'signup';

const MainApp: React.FC = () => {
  const {
    authed, pitchSeen, planSeen, questionnaireComplete,
    setPitchSeen, setPlanSeen, setMode,
  } = useStore();
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [showProducts, setShowProducts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setMode(tab === 'proportions' ? 'lookmax' : 'normal');
  };

  // A reset sends pitchSeen back to false — clear any open overlays and return
  // to the first tab so the intro flow starts clean.
  useEffect(() => {
    if (!pitchSeen) {
      setShowSettings(false);
      setShowProducts(false);
      setActiveTab('today');
    }
  }, [pitchSeen]);

  // Step 1: Business pitch (shown once on first install)
  if (!pitchSeen) {
    return <Pitch onContinue={setPitchSeen} />;
  }

  // Step 2: Onboarding questionnaire
  if (!questionnaireComplete) {
    return <Questionnaire />;
  }

  // Step 2.5: Personalised plan summary (once)
  if (!planSeen) {
    return <PlanSummary onContinue={setPlanSeen} />;
  }

  // Step 3: Auth
  if (!authed) {
    if (authScreen === 'signup') {
      return <SignUp onBack={() => setAuthScreen('login')} />;
    }
    return <Login onSignUp={() => setAuthScreen('signup')} />;
  }

  // Step 4: Settings overlay
  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />;
  }

  // Step 5: Products overlay
  if (showProducts) {
    return <Products onBack={() => setShowProducts(false)} />;
  }

  // Step 6: Main tab interface
  return (
    <View style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={{ flex: 1 }}>
        {activeTab === 'today'       && <Today />}
        {activeTab === 'scan'        && <Scan />}
        {activeTab === 'proportions' && <Proportions onOpenSettings={() => setShowSettings(true)} />}
        {activeTab === 'rituals'     && <Rituals />}
        {activeTab === 'you'         && (
          <You
            onProducts={() => setShowProducts(true)}
            onSettings={() => setShowSettings(true)}
          />
        )}
      </View>

      <View style={styles.tabBarContainer}>
        <TabBar
          active={activeTab}
          onChange={handleTabChange}
          mode={activeTab === 'proportions' ? 'lookmax' : 'normal'}
        />
      </View>
    </View>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Italic: CormorantGaramond_400Regular_Italic,
    Inter_400Regular,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <MainApp />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    position: 'relative',
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
