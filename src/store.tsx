import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSession, signOut as authSignOut } from './services/auth';
import type { UserProfile } from './services/auth';
import { SKIN_FEEL_UNSET } from './skin';
import { isCategory, type ProductCategory } from './products';
import { trialFor, type Trial, type TrialVerdict } from './trials';
import { dayKey, streakFrom } from './dates';
import { keepPhoto, deletePhoto, deleteAllPhotos } from './services/photos';
import { checkPremium } from './services/purchases';
import { aiLeft, currentUsage, emptyUsage, type AiKind, type AiUsage } from './limits';
import {
  analyzeProductConflict, analyzeProductFromImage,
  verifyGeminiKey, GEMINI_LIVE,
} from './services/gemini';

// ── One shelf: every product the user owns, however it was added ───────────────
// Search results and label scans land in the same list, so every product feeds
// the routine, the conflict checker and the trial timer alike.
export interface ShelfProduct {
  id: string;
  name: string;
  brand: string;
  ingredients: string[];
  category: ProductCategory | null;
  remainingVolume: number;  // 0–100, a rough estimate drawn down by use
  purchaseUrl: string;
  barcode?: string;
  warningText?: string | null;   // irritation note from the AI label read
  addedAt: string;
}

export type NewProduct = Omit<ShelfProduct, 'id' | 'addedAt' | 'remainingVolume' | 'category'> & {
  category?: string | null;
};

export interface SkinScores {
  overall: number; hydration: number; texture: number;
  pores: number; redness: number; oil: number; acne: number; tone: number;
}

// One face scan: the photo (kept on the phone) and, when the AI gave a real
// reading, its scores. Demo numbers are never stored.
export interface ScanEntry {
  id: string;
  date: string;
  photoUri: string | null;
  scores: SkinScores | null;
}

export interface QuestionnaireAnswers {
  goals: string[];
  concern: string[];
  skintype: string[];
  frequency: string[];
  age: string[];
  source: string[];
}

// Everything below is saved on the phone and survives restarts.
export interface SavedData {
  skinFeel: string;                           // how the user SAYS their skin feels
  shelf: ShelfProduct[];
  scans: ScanEntry[];
  completions: string[];                      // routineKey()s of finished routines
  doneSteps: Record<string, ProductCategory[]>; // today's ticked steps, per routine
  trials: Trial[];
  spfReapplyAt: string | null;
  premium: boolean;                           // subscription, as last confirmed by the store
  aiUsage: AiUsage;                           // AI calls used this calendar month
}

// Why the paywall opened, so it leads with the feature the user just tapped.
export type PremiumReason = 'scans' | 'report' | 'backup' | 'recap' | 'timelapse';

interface StoreState extends SavedData {
  authed: boolean;
  pitchSeen: boolean;
  planSeen: boolean;
  questionnaireComplete: boolean;
  user: UserProfile | null;
  showPremiumModal: boolean;
  premiumReason: PremiumReason;
  questionnaireAnswers: QuestionnaireAnswers;
  isAnalyzing: boolean;            // true while a label read is in flight
  geminiLive: boolean;             // verified at launch — drives truthful LIVE/DEMO badges
}

interface StoreComputed {
  isPremium: boolean;
  streak: number;
  lastScores: SkinScores | null;
  prevScores: SkinScores | null;
  aiLeft: (kind: AiKind) => number;
}

interface StoreActions {
  login: (user: UserProfile) => void;
  logout: () => void;
  setPitchSeen: () => void;
  setPlanSeen: () => void;
  completeQuestionnaire: () => void;
  saveQuestionnaire: (answers: QuestionnaireAnswers) => void;
  setSkinFeel: (feel: string) => void;
  addProduct: (product: NewProduct) => void;
  removeProduct: (id: string) => void;
  setProductCategory: (id: string, category: ProductCategory) => void;
  addScan: (photoTempUri: string | null, scores: SkinScores | null) => Promise<void>;
  deleteScan: (id: string) => void;
  toggleStep: (key: string, category: ProductCategory) => void;
  completeRoutine: (key: string, categories: ProductCategory[]) => void;
  setTrialVerdict: (productId: string, verdict: TrialVerdict) => void;
  setSpfReapplyAt: (iso: string | null) => void;
  setPremiumStatus: (isPremium: boolean) => void;
  openPremiumModal: (reason?: PremiumReason) => void;
  recordAiUse: (kind: AiKind) => void;
  restoreData: (data: Omit<SavedData, 'premium' | 'aiUsage'>, answers: QuestionnaireAnswers | null) => void;
  dismissPremiumModal: () => void;
  analyzeLabel: (rawLabelText: string, imageBase64?: string) => Promise<NewProduct>;
  resetApp: () => Promise<void>;   // wipe all local data → restart at the intro
}

type FullStore = StoreState & StoreActions & StoreComputed;

const PITCH_KEY          = '@poreless_pitch_seen';
const PLAN_KEY           = '@poreless_plan_seen';
const QUESTIONNAIRE_KEY  = '@poreless_questionnaire_done';
const ANSWERS_KEY        = '@poreless_questionnaire_answers';
const DATA_KEY           = '@poreless_data_v1';
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

// Everything starts empty: a new user sees only what they add or scan.
const EMPTY_DATA: SavedData = {
  skinFeel: SKIN_FEEL_UNSET,
  shelf: [],
  scans: [],
  completions: [],
  doneSteps: {},
  trials: [],
  spfReapplyAt: null,
  premium: false,
  aiUsage: emptyUsage(),
};

const defaults: StoreState = {
  ...EMPTY_DATA,
  authed: false,
  pitchSeen: false,
  planSeen: false,
  questionnaireComplete: false,
  user: null,
  showPremiumModal: false,
  premiumReason: 'scans',
  questionnaireAnswers: EMPTY_ANSWERS,
  isAnalyzing: false,
  geminiLive: GEMINI_LIVE,
};

const pickSaved = (s: StoreState): SavedData => ({
  skinFeel: s.skinFeel, shelf: s.shelf, scans: s.scans, completions: s.completions,
  doneSteps: s.doneSteps, trials: s.trials, spfReapplyAt: s.spfReapplyAt,
  premium: s.premium, aiUsage: s.aiUsage,
});

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const StoreContext = createContext<FullStore>({} as FullStore);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StoreState>(defaults);
  const [hydrated, setHydrated] = useState(false);

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

      const [user, qDone, pSeen, answersRaw, planSeen, dataRaw] = await Promise.all([
        getSession(),
        AsyncStorage.getItem(QUESTIONNAIRE_KEY),
        AsyncStorage.getItem(PITCH_KEY),
        AsyncStorage.getItem(ANSWERS_KEY),
        AsyncStorage.getItem(PLAN_KEY),
        AsyncStorage.getItem(DATA_KEY),
      ]);
      let answers = EMPTY_ANSWERS;
      if (answersRaw) { try { answers = { ...EMPTY_ANSWERS, ...JSON.parse(answersRaw) }; } catch {} }
      let data = EMPTY_DATA;
      if (dataRaw) { try { data = { ...EMPTY_DATA, ...JSON.parse(dataRaw) }; } catch {} }
      // Ticked steps only matter for today.
      const today = dayKey();
      const doneSteps = Object.fromEntries(
        Object.entries(data.doneSteps).filter(([k]) => k.startsWith(today)),
      );
      setState(s => ({
        ...s,
        ...data,
        doneSteps,
        authed: !!user,
        user: user ?? null,
        questionnaireComplete: !!(user || qDone),
        pitchSeen: !!pSeen,
        planSeen: !!planSeen,
        questionnaireAnswers: answers,
      }));
      setHydrated(true);

      // The store is the source of truth for the subscription; offline or in
      // test mode, keep the last known state.
      checkPremium().then(p => { if (p !== null) setState(s => ({ ...s, premium: p })); }).catch(() => {});

      // Confirm the AI proxy actually answers so badges tell the truth.
      verifyGeminiKey().then(ok => setState(s => ({ ...s, geminiLive: ok }))).catch(() => {});
    })();
  }, []);

  // Save the user's data whenever it changes (after the first load, so the
  // empty defaults never overwrite what's on disk).
  const saved = pickSaved(state);
  const savedJson = JSON.stringify(saved);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(DATA_KEY, savedJson).catch(() => {});
  }, [hydrated, savedJson]);

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

  const saveQuestionnaire = (answers: QuestionnaireAnswers) => {
    AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    setState(s => ({ ...s, questionnaireAnswers: answers }));
  };

  const setSkinFeel = (skinFeel: string) => setState(s => ({ ...s, skinFeel }));

  // Adding a product with a known active also starts its "is it working?" trial.
  const addProduct = (p: NewProduct) =>
    setState(s => {
      const dup = s.shelf.some(x =>
        (p.barcode && x.barcode === p.barcode) ||
        (x.name.toLowerCase() === p.name.toLowerCase() && x.brand.toLowerCase() === p.brand.toLowerCase()));
      if (dup) return s;
      const product: ShelfProduct = {
        ...p,
        id: newId('p'),
        category: isCategory(p.category) ? p.category : null,
        remainingVolume: 100,
        addedAt: new Date().toISOString(),
      };
      const trial = trialFor(product);
      return {
        ...s,
        shelf: [...s.shelf, product],
        trials: trial ? [...s.trials, trial] : s.trials,
      };
    });

  // Removing a product drops its unfinished trial; finished verdicts stay for the recap.
  const removeProduct = (id: string) =>
    setState(s => ({
      ...s,
      shelf: s.shelf.filter(p => p.id !== id),
      trials: s.trials.filter(t => t.productId !== id || !!t.verdict),
    }));

  const setProductCategory = (id: string, category: ProductCategory) =>
    setState(s => ({ ...s, shelf: s.shelf.map(p => (p.id === id ? { ...p, category } : p)) }));

  const addScan = async (photoTempUri: string | null, scores: SkinScores | null) => {
    const id = newId('scan');
    const photoUri = photoTempUri ? await keepPhoto(photoTempUri, id) : null;
    if (!photoUri && !scores) return;
    setState(s => ({
      ...s,
      scans: [...s.scans, { id, date: new Date().toISOString(), photoUri, scores }],
    }));
  };

  const deleteScan = (id: string) => {
    const entry = stateRef.current.scans.find(e => e.id === id);
    if (entry?.photoUri) deletePhoto(entry.photoUri);
    setState(s => ({ ...s, scans: s.scans.filter(e => e.id !== id) }));
  };

  const toggleStep = (key: string, category: ProductCategory) =>
    setState(s => {
      const cur = s.doneSteps[key] ?? [];
      const next = cur.includes(category) ? cur.filter(c => c !== category) : [...cur, category];
      return { ...s, doneSteps: { ...s.doneSteps, [key]: next } };
    });

  // A finished routine counts once, ticks every step, and draws down an
  // estimate of what's left in each product used (about 1% per use).
  const completeRoutine = (key: string, categories: ProductCategory[]) =>
    setState(s => {
      if (s.completions.includes(key)) {
        return { ...s, doneSteps: { ...s.doneSteps, [key]: categories } };
      }
      const used = new Set(categories);
      const seen = new Set<ProductCategory>();
      const shelf = s.shelf.map(p => {
        if (!p.category || !used.has(p.category) || seen.has(p.category)) return p;
        seen.add(p.category);
        return { ...p, remainingVolume: Math.max(0, p.remainingVolume - 1) };
      });
      return {
        ...s,
        shelf,
        completions: [...s.completions, key],
        doneSteps: { ...s.doneSteps, [key]: categories },
      };
    });

  const setTrialVerdict = (productId: string, verdict: TrialVerdict) =>
    setState(s => ({
      ...s,
      trials: s.trials.map(t => t.productId === productId && !t.verdict
        ? { ...t, verdict, verdictAt: new Date().toISOString() } : t),
    }));

  const setSpfReapplyAt = (spfReapplyAt: string | null) => setState(s => ({ ...s, spfReapplyAt }));

  const setPremiumStatus = (premium: boolean) => setState(s => ({ ...s, premium }));

  const openPremiumModal = (reason: PremiumReason = 'scans') =>
    setState(s => ({ ...s, showPremiumModal: true, premiumReason: reason }));
  const dismissPremiumModal = () => setState(s => ({ ...s, showPremiumModal: false }));

  const recordAiUse = (kind: AiKind) =>
    setState(s => {
      const u = currentUsage(s.aiUsage);
      return { ...s, aiUsage: { ...u, [kind]: u[kind] + 1 } };
    });

  // Replaces everything on this phone with a backup's contents. The
  // subscription and this month's AI allowance stay as they are.
  const restoreData = (data: Omit<SavedData, 'premium' | 'aiUsage'>, answers: QuestionnaireAnswers | null) => {
    if (answers) AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(answers)).catch(() => {});
    setState(s => ({
      ...s,
      ...EMPTY_DATA,
      ...data,
      premium: s.premium,
      aiUsage: s.aiUsage,
      doneSteps: {},
      questionnaireAnswers: answers ? { ...EMPTY_ANSWERS, ...answers } : s.questionnaireAnswers,
    }));
  };

  // Wipe all local data and return to the very first screen (the intro/pitch).
  const resetApp = async () => {
    try { await wipePorelessStorage(); } catch {}
    try { await deleteAllPhotos(); } catch {}
    try { await authSignOut(); } catch {}
    try { await AsyncStorage.setItem(RESET_KEY, RESET_TOKEN); } catch {}
    setState({ ...defaults, geminiLive: stateRef.current.geminiLive });
    checkPremium().then(p => { if (p !== null) setState(s => ({ ...s, premium: p })); }).catch(() => {});
  };

  // The label scanner hands us a photo (or raw text); the AI reads the product
  // and checks it against how the user says their skin feels.
  const analyzeLabel = async (rawLabelText: string, imageBase64?: string): Promise<NewProduct> => {
    setState(s => ({ ...s, isAnalyzing: true }));
    try {
      const feel = stateRef.current.skinFeel;
      const result = imageBase64
        ? await analyzeProductFromImage(feel, imageBase64)
        : await analyzeProductConflict(feel, rawLabelText);
      if (GEMINI_LIVE) recordAiUse('label');
      const q = `${result.brand} ${result.name}`.trim();
      return {
        name: result.name,
        brand: result.brand,
        ingredients: result.ingredients,
        purchaseUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`,
        category: result.category,
        warningText: result.conflictDetected ? result.warningText : null,
      };
    } finally {
      setState(s => ({ ...s, isAnalyzing: false }));
    }
  };

  const isPremium = !!state.user?.premium || state.premium;

  const scored = state.scans.filter(e => e.scores);
  const lastScores = scored[scored.length - 1]?.scores ?? null;
  const prevScores = scored[scored.length - 2]?.scores ?? null;

  return (
    <StoreContext.Provider value={{
      ...state,
      isPremium,
      streak: streakFrom(state.completions),
      lastScores, prevScores,
      aiLeft: (kind: AiKind) => aiLeft(state.aiUsage, kind, isPremium),
      login, logout, setPitchSeen, setPlanSeen, completeQuestionnaire, saveQuestionnaire,
      setSkinFeel, addProduct, removeProduct, setProductCategory, addScan, deleteScan,
      toggleStep, completeRoutine, setTrialVerdict, setSpfReapplyAt,
      setPremiumStatus, openPremiumModal, dismissPremiumModal, recordAiUse, restoreData,
      analyzeLabel, resetApp,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
