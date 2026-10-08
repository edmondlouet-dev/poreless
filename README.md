# Poreless — Skincare Tracker App

A high-fidelity React Native (Expo) implementation of the **Poreless** skincare tracking app, built from the v3 design handoff.

## Design System at a Glance

- **Modernised antiquity** aesthetic: paper-white surfaces, terracotta accent, Greek-roman typography
- **Fluted glass** cards with animated touch response — tap or drag to see the texture shift
- **Cormorant Garamond** (display) · **Inter** (body) · **JetBrains Mono** (numbers)
- Four tabs: Today · Progress · Shelf · You

---

## Running on a Free Phone Simulator on Windows

### Recommended: Android Emulator via Android Studio

This is the best free option on Windows — no Mac needed.

**Step 1 — Install Node.js (18 or 20)**
Download from https://nodejs.org and install.

**Step 2 — Install Android Studio**
Download from https://developer.android.com/studio (free).
During install, tick: *Android SDK*, *Android SDK Platform*, *Android Virtual Device (AVD)*.

**Step 3 — Create a virtual device**
1. Open Android Studio → More Actions → AVD Manager
2. Click *Create Virtual Device*
3. Choose **Pixel 7** (or similar) → select **API 34** system image → Finish
4. Press ▶ to start the emulator

**Step 4 — Install dependencies & run**
```bash
npm install
npx expo start --android
```
The app will build and launch inside your Android emulator.

---

### Alternative: Browser simulation (fastest to try, no install needed beyond Node.js)

```bash
npm install
npx expo start --web
```
Then in Chrome, press **F12** → click the phone icon (Toggle Device Toolbar) → choose *iPhone 14 Pro* from the dropdown. Pixel-accurate phone preview in your browser, no simulator needed.

---

### Alternative: Your own Android phone

1. Install **Expo Go** from the Play Store
2. Run `npx expo start`
3. Scan the QR code with the Expo Go app

---

## Development build (needed for location, notifications and photo checks)

UV (expo-location), SPF reminders (expo-notifications), saved progress photos
(expo-file-system) and the ML Kit photo check are native code, so they need a
development build of Poreless, not Expo Go. In Expo Go or on the web the photo
check switches itself off and the AI's own photo check still applies.

Build it in the cloud with EAS (free tier is enough; no Mac needed):

```bash
npm install
npx eas-cli login                 # your Expo account
npm run build:dev:android         # gives an install link / QR for an .apk
npm run build:dev:ios             # needs an Apple Developer account; register your iPhone when asked
```

Install the build on your phone once, then run `npm start` and open the project
from the Poreless dev app. You only need a new build when a native package is
added or app.json changes; JavaScript changes load straight from `npm start`.

Or build locally: `npx expo run:android` (Android SDK) or `npx expo run:ios`
(a Mac with Xcode). iOS 15.5+ is set in app.json.

### What the dev build does

Before a photo goes to the AI, `src/services/faceCheck.ts` runs Google ML Kit
face detection on the phone. It sends back a retake prompt for no face, a turned
or tilted head, a face that is too small, or closed eyes, without spending an AI
call.

---

## Project Structure

```
App.tsx                  — root, onboarding gate + four tabs
src/
  tokens.ts             — colors, spacing, typography
  store.tsx             — app state, saved on the phone (AsyncStorage)
  products.ts           — routine builder: orders the shelf into AM/PM steps
  conflicts.ts          — the one ingredient checker (Today + Shelf)
  trials.ts             — "is it working?" timelines per active
  recap.ts              — monthly recap numbers
  rituals.ts            — routine templates from skincare traditions
  dates.ts              — local-day keys and streaks
  services/
    gemini.ts           — face + label reads, via the proxy
    faceCheck.ts        — on-device photo check (ML Kit)
    uv.ts               — UV index from Open-Meteo
    reminders.ts        — local SPF reapply notification
    photos.ts           — progress photos, kept on the phone
    openbeauty.ts       — product search
  components/
    FlutedGlass.tsx     — ★ signature animated glass card
    TabBar.tsx          — frosted glass tab bar
    MonthlyRecap.tsx    — recap sheet
    TrendChart.tsx      — score trend line
    ScoreDetails.tsx    — what each score means
    AmbientModeOverlay.tsx — "Guide me" timed walkthrough
    ProductLabelScanner.tsx — label photo → product
  screens/
    Today.tsx           — brief (real UV), check-ins, routine, gaps
    Progress.tsx        — scan, photo timeline, timelapse, trends, recap
    Scan.tsx            — camera + ghost overlay + skin-feel check-in
    Shelf.tsx           — products, ingredient check, trials, templates
    You.tsx             — profile, privacy, settings
proxy/                  — small Node server that keeps the Gemini key off the phone
design/
  liquid-glass.html     — Liquid Glass HTML prototype
legacy/
  v3.pbxproj            — Xcode project file from the earlier SwiftUI version (sources not in repo)
```

## API keys

The app never holds an API key. Gemini calls go through `proxy/`,
which keeps the keys on the server.

1. Copy `proxy/.env.example` to `proxy/.env` and add your Gemini (and INCI) key.
2. Run the proxy: `cd proxy && npm install && npm start`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_PROXY_URL` to the proxy's
   address. Without it, every AI feature uses its built-in simulation.

Anything prefixed `EXPO_PUBLIC_` is built into the app, so never put a key there.
(RevenueCat's public SDK keys below are the exception: they're designed to ship in apps.)

## Premium (£4.99 a month)

| Free | Premium |
|---|---|
| 4 face scans + 4 label reads a month | 30 of each |
| Routine, clash warnings, UV/SPF, trials | same |
| Photo timeline, compare, this and last month's recap | every monthly recap, timelapse |
| Restore a backup | make backups, dermatologist report PDF |

AI allowances are counted on the phone (`src/limits.ts`), so they're a soft limit
until the proxy counts per account.

Billing runs through RevenueCat (`src/services/purchases.ts`). To charge for real:

1. Create a monthly subscription at £4.99 in App Store Connect and Google Play Console.
2. In RevenueCat, add both apps, an entitlement called `premium` with those products,
   and make them the current offering's monthly package.
3. Put the public SDK keys in `.env` as `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`
   and make a new build.

Without the keys the paywall runs in test mode and unlocks Premium for free.

---

## The Fluted Glass Animation

Every card in the app has the **fluted glass** texture — frosted glass with vertical ridges.

**Touch behaviour (subtle, non-distracting):**
- **Tap**: a soft circular glow appears at the touch point and fades on release
- **Drag across a card**: the ridge texture shifts horizontally ±3px, simulating how real frosted glass refracts light differently as your angle changes
- Both effects **spring back** when you lift your finger

The movement is capped at ~3–4px so it never interferes with readability. It gives tactile feedback without becoming a distraction.

**Implementation:** `src/components/FlutedGlass.tsx` — uses `PanResponder` + `Animated.spring` on two values: `fluteShift` (SVG translateX) and `glowOpacity` (radial highlight).

---

## Fonts

| Family | Role | Package |
|---|---|---|
| Cormorant Garamond Italic | Display / wordmark | `@expo-google-fonts/cormorant-garamond` |
| Inter | Body text | `@expo-google-fonts/inter` |
| JetBrains Mono | Numbers / kickers / tab labels | `@expo-google-fonts/jetbrains-mono` |

---

## Color Tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#FBFAF7` | App background (paper white) |
| `accent` | `#C2772D` | Active states, CTAs, brand mark |
| `accentSoft` | `#F9F0E5` | Completed rows, selected cards |
| `ink` | `#1A1814` | Primary text |
| `ink3` | `#8C8779` | Captions, kickers |
| `sage` | `#8E8B5C` | Done / positive states |

Full token list in `src/tokens.ts`.

---
