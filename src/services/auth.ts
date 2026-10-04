/**
 * Auth service — wraps Firebase when configured, falls back to local
 * AsyncStorage-backed auth with SHA-256 hashed passwords.
 *
 * Special account: edmondlouet@gmail.com always passes, returns premium.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { FIREBASE_ENABLED, FIREBASE_CONFIG } from '../config/firebase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  premium: boolean;
  createdAt: number;
}

// ── Lifetime premium accounts ────────────────────────────────────────────────

const PREMIUM_EMAILS = new Set(['edmondlouet@gmail.com']);

// ── Local auth helpers ────────────────────────────────────────────────────────

const USERS_KEY = '@poreless_users';
const SESSION_KEY = '@poreless_session';

type LocalUser = { uid: string; name: string; email: string; hash: string; createdAt: number };

async function getLocalUsers(): Promise<LocalUser[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalUsers(users: LocalUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hash(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

function makeUid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Firebase (static import, guarded at runtime) ─────────────────────────────

let firebaseInitialized = false;

async function initFirebase() {
  if (firebaseInitialized || !FIREBASE_ENABLED) return;
  try {
    const { initializeApp, getApps } = await Promise.resolve(require('firebase/app'));
    if (!getApps().length) initializeApp(FIREBASE_CONFIG);
    firebaseInitialized = true;
  } catch {
    // Firebase not available
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function signUp(name: string, email: string, password: string): Promise<UserProfile> {
  const normalized = email.trim().toLowerCase();

  if (FIREBASE_ENABLED) {
    await initFirebase();
    try {
      const { getAuth, createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
      const auth = getAuth();
      const cred = await createUserWithEmailAndPassword(auth, normalized, password);
      await updateProfile(cred.user, { displayName: name });
      return {
        uid: cred.user.uid,
        name,
        email: normalized,
        premium: PREMIUM_EMAILS.has(normalized),
        createdAt: Date.now(),
      };
    } catch (e: any) {
      throw new Error(e.message ?? 'Sign-up failed.');
    }
  }

  // Local fallback
  const users = await getLocalUsers();
  if (users.find(u => u.email === normalized)) {
    throw new Error('An account with that email already exists.');
  }
  const pwHash = await hash(password);
  const user: LocalUser = { uid: makeUid(), name, email: normalized, hash: pwHash, createdAt: Date.now() };
  await saveLocalUsers([...users, user]);
  const profile: UserProfile = {
    uid: user.uid, name, email: normalized,
    premium: PREMIUM_EMAILS.has(normalized), createdAt: user.createdAt,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const normalized = email.trim().toLowerCase();

  // Always let premium accounts in (demo bypass — no password check)
  if (PREMIUM_EMAILS.has(normalized)) {
    const profile: UserProfile = {
      uid: 'premium-' + normalized,
      name: 'Edmond',
      email: normalized,
      premium: true,
      createdAt: Date.now(),
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    return profile;
  }

  if (FIREBASE_ENABLED) {
    await initFirebase();
    try {
      const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
      const auth = getAuth();
      const cred = await signInWithEmailAndPassword(auth, normalized, password);
      return {
        uid: cred.user.uid,
        name: cred.user.displayName ?? normalized.split('@')[0],
        email: normalized,
        premium: PREMIUM_EMAILS.has(normalized),
        createdAt: cred.user.metadata.creationTime
          ? new Date(cred.user.metadata.creationTime).getTime()
          : Date.now(),
      };
    } catch (e: any) {
      throw new Error(e.message ?? 'Sign-in failed.');
    }
  }

  // Local fallback
  const users = await getLocalUsers();
  const found = users.find(u => u.email === normalized);
  if (!found) throw new Error('No account found for that email.');
  const pwHash = await hash(password);
  if (found.hash !== pwHash) throw new Error('Incorrect password.');
  const profile: UserProfile = {
    uid: found.uid, name: found.name, email: normalized,
    premium: false, createdAt: found.createdAt,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
  if (FIREBASE_ENABLED) {
    try {
      const { getAuth } = require('firebase/auth');
      await getAuth().signOut();
    } catch {
      // ignore
    }
  }
}

export async function getSession(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
