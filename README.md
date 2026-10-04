# Poreless — Skincare Tracker App

A high-fidelity React Native (Expo) implementation of the **Poreless** skincare tracking app, built from the v3 design handoff.

## Design System at a Glance

- **Modernised antiquity** aesthetic: paper-white surfaces, terracotta accent, Greek-roman typography
- **Fluted glass** cards with animated touch response — tap or drag to see the texture shift
- **Cormorant Garamond** (display) · **Inter** (body) · **JetBrains Mono** (numbers)
- Five tabs: Today · Scan · Lookmax · Trend · You

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

## On-device photo checks (needs a development build)

Before a photo goes to the AI, `src/services/faceCheck.ts` runs Google ML Kit
face detection on the phone. It sends back a retake prompt for no face, a turned
or tilted head, a face that is too small, or closed eyes, without spending an AI
call. On the Proportions scan it also measures eye tilt from the eye-corner
landmarks instead of asking the AI to guess.

ML Kit is native code, so it runs in a development build, not in Expo Go or on
the web. There the check switches itself off and the AI's own photo check still
applies.

```bash
npm install
npx expo run:android   # builds and installs a dev build on the emulator or a plugged-in phone
# iOS (needs a Mac): npx expo run:ios   — iOS 15.5+, set in app.json
```

---

## Project Structure

```
App.tsx                  — root, fonts + navigation
src/
  tokens.ts             — colors, spacing, typography
  products.ts           — catalog + routine builder
  store.tsx             — React Context state
  components/
    FlutedGlass.tsx     — ★ signature animated glass card
    Background.tsx      — radial gradient + global flute overlay
    TabBar.tsx          — custom frosted glass tab bar
    MetricStrip.tsx     — scrollable score cards
    RoutineRow.tsx      — checkable routine item with WHY expander
    FaceLogo.tsx        — animated SVG line-art face draw-in
    Pill.tsx            — tag pill (default / accent / sage / on)
  screens/
    Login.tsx           — auth screen with animated logo
    Today.tsx           — daily routine + score strip
    Scan.tsx            — face scan UI
    Lookmax.tsx         — facial structure analysis + warm palette
    Trend.tsx           — progress chart + metric rows
    You.tsx             — profile + settings list
    Products.tsx        — product list + add modal
assets/
  scan-portrait.png     — line-art face portrait placeholder
  logo-face.png         — logo raster fallback
proxy/                  — small Node server that keeps the Gemini and INCI keys off the phone
design/
  liquid-glass.html     — Liquid Glass HTML prototype
legacy/
  v3.pbxproj            — Xcode project file from the earlier SwiftUI version (sources not in repo)
```

## API keys

The app never holds an API key. Gemini and INCI calls go through `proxy/`,
which keeps the keys on the server.

1. Copy `proxy/.env.example` to `proxy/.env` and add your Gemini (and INCI) key.
2. Run the proxy: `cd proxy && npm install && npm start`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_PROXY_URL` to the proxy's
   address. Without it, every AI feature uses its built-in simulation.

Anything prefixed `EXPO_PUBLIC_` is built into the app, so never put a key there.

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

## AR Sculpting Guides

`src/components/ARSculptOverlay.tsx` lays a face-filter-style guide over the front
camera: a wireframe **face mesh**, a pulsing **detection bracket**, animated
**movement arrows** (drainage / sculpt / lift / soothe) and **press points**. It's
launched two ways — from a ritual's Structural Blueprint (Rituals tab) and from
Ambient Mode's "how to apply" button.

**Lock-on state machine.** Each step runs an *acquisition sweep* (a scan line
travels down the face while the mesh + bracket fade in), then flips to **FACE
LOCKED**, and only *then* starts the AI completion detector. The whole guide is
swayed as a single unit so it reads as anchored to the face. All of this uses only
Expo-Go-safe APIs (`expo-camera` + `react-native-svg` + `Animated`), so it runs in
Expo Go with no native build.

### Optional: true face-landmark tracking (requires a dev build)

Expo Go cannot run native frame processors, so the mesh is centered rather than
pinned to real landmarks. To anchor overlays to actual face coordinates, move to an
**EAS development build** and wire a detector:

```bash
# 1. Leave Expo Go behind — create a dev build
npx expo install react-native-vision-camera react-native-worklets-core
npm i  react-native-vision-camera-face-detector
npx expo prebuild
eas build --profile development --platform ios   # or run locally with Xcode
```

Then feed live landmarks into the overlay. The integration point already exists:
`ARSculptOverlay` calls `detectStepCompletion(frameProvider, …)` with a
`frameProvider` that currently returns `null`. Swap it for the detector's frame
output, and map the returned landmark box to the SVG `viewBox` (the mesh, bracket
and arrows are all authored in a `100 × 150` portrait space, so it's a single
affine transform). Keep the Expo-Go fallback by guarding the native import behind a
capability check so the app still loads in Expo Go.