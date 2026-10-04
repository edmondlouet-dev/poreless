/**
 * Firebase configuration
 *
 * HOW TO SET UP (5 minutes):
 *  1. Go to https://console.firebase.google.com
 *  2. Create a new project (e.g. "poreless-app")
 *  3. Click the </> Web icon to add a web app
 *  4. Copy the firebaseConfig values and paste them below
 *  5. In Firebase console → Authentication → Sign-in method → enable Email/Password
 *
 * The app will work without this (local auth fallback) but Firebase
 * gives you a real user database, password reset emails, and Google sign-in.
 */

export const FIREBASE_CONFIG = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

/** Set to true once you have pasted real Firebase credentials above */
export const FIREBASE_ENABLED = false;

/**
 * Google Vision API key for face scan AI.
 *
 * HOW TO GET ONE (free tier — 1000 requests/month):
 *  1. Go to https://console.cloud.google.com
 *  2. Enable "Cloud Vision API"
 *  3. Create an API key under APIs & Services → Credentials
 *  4. Paste it below
 */
export const VISION_API_KEY = 'YOUR_GOOGLE_VISION_API_KEY';
export const VISION_ENABLED = false;

/**
 * AI (Gemini) — powers the AI Label Recognizer, skin and proportions analysis,
 * and editorial insights.
 *
 * The app never holds the Gemini key: every call goes through the Poreless
 * proxy (proxy/), which keeps the key, model and prompts on the server. Set
 * EXPO_PUBLIC_PROXY_URL in your gitignored `.env` to turn live AI on; without
 * it every Gemini-backed feature runs its local simulation.
 */
export const AI_PROXY_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? '';
export const AI_ENABLED = !!AI_PROXY_URL;
