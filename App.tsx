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
import { TabBar, type TabKey } from './src/components/TabBar';
import { Login } from './src/screens/Login';
import { SignUp } from './src/screens/SignUp';
import { Questionnaire } from './src/screens/Questionnaire';
import { PlanSummary } from './src/screens/PlanSummary';
import { Pitch } from './src/screens/Pitch';
import { Today } from './src/screens/Today';
import { Progress } from './src/screens/Progress';
import { Shelf } from './src/screens/Shelf';
import { You } from './src/screens/You';
import { Settings } from './src/screens/Settings';

SplashScreen.preventAutoHideAsync();

type AuthScreen = 'login' | 'signup';

const MainApp: React.FC = () => {
  const {
    authed, pitchSeen, planSeen, questionnaireComplete,
    setPitchSeen, setPlanSeen,
  } = useStore();
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [showSettings, setShowSettings] = useState(false);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  // A reset sends pitchSeen back to false — clear any open overlays and return
  // to the first tab so the intro flow starts clean.
  useEffect(() => {
    if (!pitchSeen) {
      setShowSettings(false);
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

  // Step 5: Main tab interface
  return (
    <View style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={{ flex: 1 }}>
        {activeTab === 'today'    && <Today onNavigate={setActiveTab} />}
        {activeTab === 'progress' && <Progress />}
        {activeTab === 'shelf'    && <Shelf />}
        {activeTab === 'you'      && <You onSettings={() => setShowSettings(true)} />}
      </View>

      <View style={styles.tabBarContainer}>
        <TabBar active={activeTab} onChange={setActiveTab} />
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
