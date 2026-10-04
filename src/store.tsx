import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSession, signOut as authSignOut } from './services/auth';
import type { UserProfile } from './services/auth';
import {
  DEFAULT_STRUCTURAL,
  type StructuralMetrics, type ShelfItem,
} from './skin';
import {
  analyzeProductConflict, analyzeProductFromImage, generateEditorialInsight,
  verifyGeminiKey, GEMINI_LIVE,
  type EditorialMetrics,
} from './services/gemini';

type AppMode = 'normal' | 'lookmax';

// ── Extended shelf product (barcode-scanned, full INCI data) ──────────────────
export interface ShelfProduct {
  id: string;
  name: string;
  brand: string;
  ingredients: string[];
  remainingVolume: number;  // 0–100
  purchaseUrl: string;
  barcode?: string;
  category?: string;
  warningText?: string | null;   // conflict note from the Gemini cosmetic chemist
}

export interface SkinScores {
  overall: number; hydration: number; texture: number;
  pores: number; redness: number; oil: number; acne: number; tone: number;
}

// ── Single source of truth for the shelf ──────────────────────────────────────
// The Rituals synergy/blueprint engine needs a lightweight {active, tag} view of
// each product. Rather than maintain a second parallel array, we DERIVE it from
// the rich userShelf so there is exactly one inventory to keep in sync.
const ACTIVE_KEYWORDS = [
  'retinol', 'retinyl', 'tretinoin', 'adapalene', 'ascorbic acid', 'vitamin c',
  'niacinamide', 'salicylic acid', 'glycolic acid', 'lactic acid', 'azelaic',
  'hyaluronic acid', 'ceramide', 'squalane', 'panthenol', 'glycerin',
];

function primaryActive(p: ShelfProduct): string {
  for (const ing of p.ingredients) {
    const low = ing.toLowerCase();
    const hit = ACTIVE_KEYWORDS.find(k => low.includes(k));
    if (hit) return hit;
  }
  return (p.ingredients[0] ?? '').toLowerCase();
}

export function deriveShelfItems(products: ShelfProduct[]): ShelfItem[] {
  return products.map(p => ({
    id: p.id,
    name: p.name,
    active: primaryActive(p),
    tag: p.name.length <= 18 ? p.name : (p.brand || p.name.slice(0, 18)),
  }));
}

interface UsageCounters {
  surfaceScansToday: number;
  structuralScansThisWeek: number;
  lastScanTimestamp: string | null;
  lastStructuralScanDate: string | null;
}

export interface QuestionnaireAnswers {
  goals: string[];
  concern: string[];
  skintype: string[];
  frequency: string[];
  age: string[];
  source: string[];
}

interface StoreState {
  authed: boolean;
  pitchSeen: boolean;
  planSeen: boolean;               // personalised plan summary shown once
  questionnaireComplete: boolean;
  user: UserProfile | null;
  owned: string[];
  streak: number;
  lastScan: Date | null;
  lastScores: SkinScores | null;
  prevScores: SkinScores | null;   // the scan before lastScores — drives deltas
  mode: AppMode;
  activeRitual: string | null;
  temperatureUnit: 'C' | 'F';
  structural: StructuralMetrics;
  // ── New global state ──────────────────────────────────────────────────────
  passiveTrackingEnabled: boolean;
  usageCounters: UsageCounters;
  userShelf: ShelfProduct[];
  ritualStreaks: Record<string, number>;
  showPremiumModal: boolean;
  questionnaireAnswers: QuestionnaireAnswers;
  // ── AI brain ────────────────────────────────────────────────────────────────
  isAnalyzing: boolean;            // true while a Gemini call is in flight
  editorialInsight: string | null; // luxury-magazine read of the latest structure
  geminiLive: boolean;             // verified at launch — drives truthful LIVE/SIM badges
}

interface StoreComputed {
  userProfile: { isPremium: boolean; streakCount: number; passiveTrackingEnabled: boolean };
  faceMetrics: StructuralMetrics;
  selectedTraditionId: string | null;
  shelf: ShelfItem[];           // derived from userShelf — single source of truth
}

interface StoreActions {
  login: (user: UserProfile) => void;
  logout: () => void;
  setPitchSeen: () => void;
  setPlanSeen: () => void;
  completeQuestionnaire: () => void;
  addProduct: (name: string) => void;
  removeProduct: (name: string) => void;
  setMode: (mode: AppMode) => void;
  setLastScores: (scores: SkinScores) => void;
  setActiveRitual: (key: string | null) => void;
  setTemperatureUnit: (unit: 'C' | 'F') => void;
  // ── Spec handlers ──────────────────────────────────────────────────────────
  updateMetrics: (metrics: Partial<StructuralMetrics>) => void;
  togglePassiveTracking: () => void;
  setPremiumStatus: (isPremium: boolean) => void;
  addBarcodeProduct: (product: ShelfProduct) => void;
  removeBarcodeProduct: (id: string) => void;
  logRoutineUsage: () => void;          // decrement shelf volumes on a completed routine
  completeDailyRitual: (ritualKey: string) => void;
  incrementSurfaceScan: () => void;
  recordStructuralScan: () => void;
  saveQuestionnaire: (answers: QuestionnaireAnswers) => void;
  openPremiumModal: () => void;
  dismissPremiumModal: () => void;
  // ── AI brokers — async, drive isAnalyzing + global re-render ─────────────────
  analyzeLabel: (rawLabelText: string, imageBase64?: string) => Promise<ShelfProduct>;
  refreshEditorialInsight: () => Promise<void>;
  resetApp: () => Promise<void>;   // wipe all local data → restart at the intro
}

type FullStore = StoreState & StoreActions & StoreComputed;

const PITCH_KEY          = '@poreless_pitch_seen';
const PLAN_KEY           = '@poreless_plan_seen';
const QUESTIONNAIRE_KEY  = '@poreless_questionnaire_done';
const ANSWERS_KEY        = '@poreless_questionnaire_answers';
// Bump this token to force a one-time fresh start on the next launch: every
// "@poreless*" key is wiped once, so the app reopens at the intro screen.
const RESET_KEY          = '@poreless_reset_token';
const RESET_TOKEN        = '2026-06-fresh-start';

// Clears every locally-persisted key this app owns (onboarding flags, answers,
// session, local users) but preserves the reset token so the wipe runs once.
async function wipePorelessStorage() {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter(k => k.startsWith('@poreless') && k !== RESET_KEY);
  if (ours.length) await AsyncStorage.multiRemove(ours);
}

const EMPTY_ANSWERS: QuestionnaireAnswers = {
  goals: [], concern: [], skintype: [], frequency: [], age: [], source: [],
};

const DEFAULT_USER_SHELF: ShelfProduct[] = [
  {
    id: 'vitc',
    name: 'Vitamin C Serum',
    brand: 'The Ordinary',
    ingredients: ['ascorbic acid', 'propanediol', 'glycerin', 'hyaluronic acid'],
    remainingVolume: 65,
    purchaseUrl: 'https://www.amazon.co.uk/s?k=the+ordinary+vitamin+c&tag=poreless-20',
    category: 'antiox',
  },
  {
    id: 'retinol',
    name: 'Retinol 0.5%',
    brand: 'The Ordinary',
    ingredients: ['retinol', 'squalane', 'tocopherol', 'bisabolol'],
    remainingVolume: 18,
    purchaseUrl: 'https://www.amazon.co.uk/s?k=the+ordinary+retinol+0.5&tag=poreless-20',
    category: 'retinoid',
  },
  {
    id: 'ha',
    name: 'Hyaluronic Acid 2% + B5',
    brand: 'The Ordinary',
    ingredients: ['hyaluronic acid', 'sodium hyaluronate', 'pentylene glycol', 'water', 'panthenol'],
    remainingVolume: 80,
    purchaseUrl: 'https://www.amazon.co.uk/s?k=the+ordinary+hyaluronic+acid&tag=poreless-20',
    category: 'serum',
  },
];

const defaults: StoreState = {
  authed: false,
  pitchSeen: false,
  planSeen: false,
  questionnaireComplete: false,
  user: null,
  owned: [
    'CeraVe Hydrating Cleanser',
    'The Ordinary Niacinamide 10%',
    'EltaMD UV Clear SPF 46',
    'La Roche-Posay Toleriane',
    'Differin (Adapalene 0.1%)',
  ],
  streak: 14,
  lastScan: new Date(Date.now() - 18 * 60 * 60 * 1000),
  lastScores: {
    overall: 78, hydration: 82, texture: 74,
    pores: 69, redness: 88, oil: 55, acne: 64, tone: 71,
  },
  prevScores: {
    overall: 75, hydration: 78, texture: 72,
    pores: 67, redness: 84, oil: 58, acne: 61, tone: 69,
  },
  mode: 'normal',
  activeRitual: null,
  temperatureUnit: 'C',
  structural: DEFAULT_STRUCTURAL,
  passiveTrackingEnabled: true,
  usageCounters: {
    surfaceScansToday: 0,
    structuralScansThisWeek: 0,
    lastScanTimestamp: null,
    lastStructuralScanDate: null,
  },
  userShelf: DEFAULT_USER_SHELF,
  ritualStreaks: {},
  showPremiumModal: false,
  questionnaireAnswers: EMPTY_ANSWERS,
  isAnalyzing: false,
  editorialInsight: null,
  geminiLive: GEMINI_LIVE,
};

const StoreContext = createContext<FullStore>({} as FullStore);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StoreState>(defaults);

  // Always-fresh mirror of state for async brokers that would otherwise close
  // over a stale snapshot.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    (async () => {
      // One-time fresh-start wipe when the reset token changes — guarantees the
      // app reopens at the intro screen with no saved profile.
      try {
        const token = await AsyncStorage.getItem(RESET_KEY);
        if (token !== RESET_TOKEN) {
          await wipePorelessStorage();
          await AsyncStorage.setItem(RESET_KEY, RESET_TOKEN);
        }
      } catch {}

      const [user, qDone, pSeen, answersRaw, planSeen] = await Promise.all([
        getSession(),
        AsyncStorage.getItem(QUESTIONNAIRE_KEY),
        AsyncStorage.getItem(PITCH_KEY),
        AsyncStorage.getItem(ANSWERS_KEY),
        AsyncStorage.getItem(PLAN_KEY),
      ]);
      let answers = EMPTY_ANSWERS;
      if (answersRaw) { try { answers = { ...EMPTY_ANSWERS, ...JSON.parse(answersRaw) }; } catch {} }
      setState(s => ({
        ...s,
        authed: !!user,
        user: user ?? null,
        questionnaireComplete: !!(user || qDone),
        pitchSeen: !!pSeen,
        planSeen: !!planSeen,
        questionnaireAnswers: answers,
      }));

      // Confirm the Gemini key actually authenticates so badges tell the truth.
      verifyGeminiKey().then(ok => setState(s => ({ ...s, geminiLive: ok }))).catch(() => {});
    })();
  }, []);

  const login = (user: UserProfile) =>
    setState(s => ({ ...s, authed: true, user }));

  const logout = async () => {
    await authSignOut();
    setState(s => ({ ...s, authed: false, user: null }));
  };

  const setPitchSeen = () => {
    AsyncStorage.setItem(PITCH_KEY, '1');
    setState(s => ({ ...s, pitchSeen: true }));
  };

  const setPlanSeen = () => {
    AsyncStorage.setItem(PLAN_KEY, '1');
    setState(s => ({ ...s, planSeen: true }));
  };

  const completeQuestionnaire = () => {
    AsyncStorage.setItem(QUESTIONNAIRE_KEY, '1');
    setState(s => ({ ...s, questionnaireComplete: true }));
  };

  const addProduct = (name: string) =>
    setState(s => ({ ...s, owned: s.owned.includes(name) ? s.owned : [...s.owned, name] }));

  const removeProduct = (name: string) =>
    setState(s => ({ ...s, owned: s.owned.filter(n => n !== name) }));

  const setMode = (mode: AppMode) => setState(s => ({ ...s, mode }));

  const setLastScores = (scores: SkinScores) =>
    setState(s => ({ ...s, prevScores: s.lastScores, lastScores: scores, lastScan: new Date() }));

  const saveQuestionnaire = (answers: QuestionnaireAnswers) => {
    AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    setState(s => ({ ...s, questionnaireAnswers: answers }));
  };

  const setActiveRitual = (key: string | null) =>
    setState(s => ({ ...s, activeRitual: key }));

  const setTemperatureUnit = (unit: 'C' | 'F') =>
    setState(s => ({ ...s, temperatureUnit: unit }));

  const updateMetrics = (metrics: Partial<StructuralMetrics>) =>
    setState(s => ({ ...s, structural: { ...s.structural, ...metrics } }));

  const togglePassiveTracking = () =>
    setState(s => ({ ...s, passiveTrackingEnabled: !s.passiveTrackingEnabled }));

  const setPremiumStatus = (isPremium: boolean) =>
    setState(s => ({ ...s, user: s.user ? { ...s.user, premium: isPremium } : s.user }));

  const addBarcodeProduct = (product: ShelfProduct) =>
    setState(s => ({
      ...s,
      userShelf: s.userShelf.some(p => p.id === product.id || (p.barcode && p.barcode === product.barcode))
        ? s.userShelf
        : [...s.userShelf, product],
    }));

  const removeBarcodeProduct = (id: string) =>
    setState(s => ({ ...s, userShelf: s.userShelf.filter(p => p.id !== id) }));

  // Each completed routine draws down the shelf a little, like real daily use.
  const logRoutineUsage = () =>
    setState(s => ({
      ...s,
      userShelf: s.userShelf.map(p => ({
        ...p,
        remainingVolume: Math.max(0, p.remainingVolume - (2 + Math.floor(Math.random() * 4))),
      })),
    }));

  const completeDailyRitual = (ritualKey: string) =>
    setState(s => ({
      ...s,
      ritualStreaks: { ...s.ritualStreaks, [ritualKey]: (s.ritualStreaks[ritualKey] ?? 0) + 1 },
    }));

  const incrementSurfaceScan = () =>
    setState(s => ({
      ...s,
      usageCounters: {
        ...s.usageCounters,
        surfaceScansToday: s.usageCounters.surfaceScansToday + 1,
        lastScanTimestamp: new Date().toISOString(),
      },
    }));

  const recordStructuralScan = () =>
    setState(s => ({
      ...s,
      usageCounters: {
        ...s.usageCounters,
        structuralScansThisWeek: s.usageCounters.structuralScansThisWeek + 1,
        lastStructuralScanDate: new Date().toISOString(),
      },
    }));

  const openPremiumModal    = () => setState(s => ({ ...s, showPremiumModal: true }));
  const dismissPremiumModal = () => setState(s => ({ ...s, showPremiumModal: false }));

  // Wipe all local data and return to the very first screen (the intro/pitch).
  const resetApp = async () => {
    try { await wipePorelessStorage(); } catch {}
    try { await authSignOut(); } catch {}
    try { await AsyncStorage.setItem(RESET_KEY, RESET_TOKEN); } catch {}
    setState({ ...defaults, geminiLive: stateRef.current.geminiLive });
  };

  // ── AI brokers ──────────────────────────────────────────────────────────────
  // The label scanner hands us raw OCR text; we run it through the Gemini cosmetic
  // chemist (against the live barrier reading), flip isAnalyzing so the dashboard
  // can shimmer, and return a fully-formed shelf product carrying any warningText.
  const analyzeLabel = async (rawLabelText: string, imageBase64?: string): Promise<ShelfProduct> => {
    setState(s => ({ ...s, isAnalyzing: true }));
    try {
      const barrier = stateRef.current.structural.barrierStatus;
      // With a label photo we use Gemini Vision (real OCR); otherwise the text path.
      const result = imageBase64
        ? await analyzeProductFromImage(barrier, imageBase64)
        : await analyzeProductConflict(barrier, rawLabelText);
      const q = `${result.brand} ${result.name}`.trim();
      return {
        id: `lbl-${Date.now()}`,
        name: result.name,
        brand: result.brand,
        ingredients: result.ingredients,
        remainingVolume: 100,
        purchaseUrl: `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}&tag=poreless-20`,
        category: result.category,
        warningText: result.conflictDetected ? result.warningText : null,
      };
    } finally {
      setState(s => ({ ...s, isAnalyzing: false }));
    }
  };

  // Generates the luxury editorial paragraph from the current structural metrics.
  const refreshEditorialInsight = async (): Promise<void> => {
    setState(s => ({ ...s, isAnalyzing: true }));
    try {
      const m = stateRef.current.structural;
      const metrics: EditorialMetrics = {
        canthalTilt: m.canthalTilt,
        midfaceRatio: m.midfaceRatio,
        fluidRetention: m.fluidRetention,
        barrierStatus: m.barrierStatus,
      };
      const insight = await generateEditorialInsight(metrics);
      setState(s => ({ ...s, editorialInsight: insight, isAnalyzing: false }));
    } catch {
      setState(s => ({ ...s, isAnalyzing: false }));
    }
  };

  const isPremium = state.user?.premium ?? false;

  return (
    <StoreContext.Provider value={{
      ...state,
      userProfile: { isPremium, streakCount: state.streak, passiveTrackingEnabled: state.passiveTrackingEnabled },
      faceMetrics: state.structural,
      selectedTraditionId: state.activeRitual,
      shelf: deriveShelfItems(state.userShelf),
      login, logout, setPitchSeen, setPlanSeen, completeQuestionnaire,
      addProduct, removeProduct, setMode,
      setLastScores, setActiveRitual, setTemperatureUnit,
      updateMetrics, togglePassiveTracking, setPremiumStatus,
      addBarcodeProduct, removeBarcodeProduct, logRoutineUsage, completeDailyRitual,
      incrementSurfaceScan, recordStructuralScan, saveQuestionnaire,
      openPremiumModal, dismissPremiumModal,
      analyzeLabel, refreshEditorialInsight, resetApp,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
