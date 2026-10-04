/**
 * RITUALS tab — cultural skincare traditions from around the world.
 * AI suggests which ritual best suits the user's current skin scores.
 * Each tradition links the structural scan (Proportions) to a tailored
 * application blueprint and an editorial shelf-synergy report.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import {
  Waves, Sparkle, Plus, Flower, Leaf, Scale, Clock,
  ShoppingBag, ArrowUpRight, ChevronDown, ChevronUp,
  Activity, FlaskConical,
  ArrowDownRight, MoveUpRight, Hand, Feather,
  TriangleAlert, CircleAlert, Sparkles, ScanFace,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FlutedGlass } from '../components/FlutedGlass';
import { Pill } from '../components/Pill';
import { useStore } from '../store';
import { RITUALS, aiSuggestRitual, getRitual } from '../rituals';
import {
  getStructuralBlueprint, getSynergyReport,
  type BlueprintIcon, type SynergyKind,
} from '../skin';
import { PremiumModal } from '../components/PremiumModal';
import { ARSculptOverlay, type ARStep } from '../components/ARSculptOverlay';
import { C, R, T, S } from '../tokens';

const FREE_RITUAL_COUNT = 3;

const ICON_SIZE = 24;
const ICON_SW   = 1.2;
const NAV_ACTIVE   = '#2A2522';
const NAV_INACTIVE = '#A09B95';

const RITUAL_ICONS = {
  japanese: Waves, korean: Sparkle, french: Plus, ayurvedic: Flower,
  african: Leaf, scandinavian: Scale, greek: Clock,
} as const;

const RitualIcon: React.FC<{ id: string; color?: string }> = ({ id, color = NAV_INACTIVE }) => {
  const Icon = RITUAL_ICONS[id as keyof typeof RITUAL_ICONS];
  if (!Icon) return null;
  return <Icon size={ICON_SIZE} strokeWidth={ICON_SW} color={color} />;
};

const BLUEPRINT_GLYPH: Record<BlueprintIcon, typeof Hand> = {
  drainage: ArrowDownRight, sculpt: Hand, lift: MoveUpRight, soothe: Feather,
};

const SYNERGY_STYLE: Record<SynergyKind, { Icon: typeof Sparkles; color: string; bg: string; border: string }> = {
  conflict: { Icon: TriangleAlert, color: C.danger, bg: '#FBEEEA', border: 'rgba(178,63,44,0.26)' },
  caution:  { Icon: CircleAlert,   color: C.warn,   bg: '#FBF3E6', border: 'rgba(199,145,68,0.30)' },
  synergy:  { Icon: Sparkles,      color: C.sage,   bg: C.sageSoft, border: 'rgba(142,139,92,0.32)' },
};

export const Rituals: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    lastScores, activeRitual, setActiveRitual, structural, shelf,
    userProfile, openPremiumModal, showPremiumModal, dismissPremiumModal,
    setPremiumStatus,
  } = useStore();
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [openBlueprint, setOpenBlueprint] = useState<string | null>(null);
  const [openSynergy, setOpenSynergy] = useState<string | null>(null);
  const [arSession, setArSession]     = useState<{ steps: ARStep[]; ritual: string } | null>(null);
  const aiPick = aiSuggestRitual(lastScores);

  const tryRitual = (key: string) => setActiveRitual(activeRitual === key ? null : key);

  const openCard = useCallback((key: string, idx: number) => {
    const isLocked = !userProfile.isPremium && idx >= FREE_RITUAL_COUNT;
    if (isLocked) { openPremiumModal(); return; }
    setExpanded(prev => (prev === key ? null : key));
    setOpenBlueprint(null);
    setOpenSynergy(null);
  }, [userProfile.isPremium, openPremiumModal]);

  return (
    <View style={styles.root}>
      <Background />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 18 }}>
          <Text style={T.kicker}>GLOBAL RITUALS</Text>
          <Text style={[T.h1, { fontSize: 34, marginTop: 4 }]}>
            skin <Text style={{ fontStyle: 'italic', color: C.accentInk }}>traditions</Text>
          </Text>
          <Text style={[T.bodySm, { color: C.ink3, marginTop: 4, lineHeight: 18 }]}>
            Skincare wisdom from seven cultures, tuned to your last structural scan. Try one for 7 days — your Today routine adapts automatically.
          </Text>
        </View>

        {/* AI recommendation */}
        <FlutedGlass padding={14} style={{ marginBottom: 20, borderColor: C.accent }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Sparkles size={ICON_SIZE} strokeWidth={ICON_SW} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[T.kicker, { color: C.accent, marginBottom: 4 }]}>AI RECOMMENDS FOR YOU</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <RitualIcon id={aiPick} color={NAV_ACTIVE} />
                <Text style={[T.body, { fontWeight: '600', color: C.ink }]}>
                  {getRitual(aiPick)?.culture} — {getRitual(aiPick)?.name}
                </Text>
              </View>
              <Text style={[T.bodySm, { color: C.ink3, marginTop: 3 }]}>
                Based on your latest scan scores.{' '}
                {lastScores
                  ? `Hydration ${lastScores.hydration}, Redness ${lastScores.redness}.`
                  : 'Run a scan for personalised picks.'}
              </Text>
            </View>
          </View>
        </FlutedGlass>

        {/* Ritual cards */}
        {RITUALS.map((r, idx) => {
          const isExpanded = expanded === r.key;
          const isActive   = activeRitual === r.key;
          const isAi       = r.key === aiPick;
          const isLocked   = !userProfile.isPremium && idx >= FREE_RITUAL_COUNT;
          const blueprint  = getStructuralBlueprint(r.key, structural);
          const synergy    = getSynergyReport(r.key, r.name, structural.barrierStatus, shelf);

          return (
            <FlutedGlass
              key={r.key}
              padding={14}
              style={[
                styles.card,
                isActive && styles.cardActive,
                isAi && !isActive && styles.cardAi,
                isLocked && styles.cardLocked,
              ]}
            >
              {/* Card header */}
              <TouchableOpacity onPress={() => openCard(r.key, idx)} activeOpacity={0.8}>
                <View style={styles.cardHead}>
                  <View style={styles.iconWrap}>
                    <RitualIcon id={r.key} color={isActive ? NAV_ACTIVE : NAV_INACTIVE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[T.kicker, { color: isActive ? C.accent : isLocked ? C.ink4 : C.ink3 }]}>{r.culture.toUpperCase()}</Text>
                      {isAi    && !isLocked && <Pill label="AI PICK" variant="accent" />}
                      {isActive && <Pill label="ACTIVE" variant="on" />}
                      {isLocked && <Pill label="PREMIUM" variant="warn" />}
                    </View>
                    <Text style={[T.body, { fontWeight: '600', fontSize: 15, color: C.ink, marginTop: 2 }]}>{r.name}</Text>
                    <Text style={[T.bodySm, { color: C.ink3 }]}>{r.tagline}</Text>
                  </View>
                  {isExpanded
                    ? <ChevronUp size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink3} />
                    : <ChevronDown size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink3} />}
                </View>
              </TouchableOpacity>

              {/* Expanded content */}
              {isExpanded && (
                <View style={styles.cardBody}>
                  <View style={styles.divider} />

                  <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18, marginBottom: 14 }]}>
                    {r.description}
                  </Text>

                  <Text style={[T.kicker, { marginBottom: 8 }]}>THE ROUTINE · {r.duration}</Text>
                  {r.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={[T.num, { fontSize: 10, color: C.ink3, width: 24 }]}>
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <Text style={[T.bodySm, { flex: 1, color: C.ink2 }]}>{step}</Text>
                    </View>
                  ))}

                  {/* ── Recommended product (after the steps) ───────────────── */}
                  <Text style={[T.kicker, { marginTop: 16, marginBottom: 8 }]}>RECOMMENDED FOR THIS RITUAL</Text>
                  <View style={styles.productCard}>
                    <View style={styles.productIcon}>
                      <ShoppingBag size={ICON_SIZE} strokeWidth={ICON_SW} color={C.accentInk} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.body, { fontWeight: '600', fontSize: 14, color: C.ink }]}>{r.recommended.name}</Text>
                      <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>{r.recommended.brand}</Text>
                      <Text style={[T.bodySm, { color: C.ink2, marginTop: 6, lineHeight: 17 }]}>{r.recommended.why}</Text>
                      <TouchableOpacity
                        style={styles.browseBtn}
                        activeOpacity={0.8}
                        onPress={() => Linking.openURL(r.recommended.buyUrl)}
                      >
                        <Text style={[T.button, { fontSize: 12, color: C.accentInk }]}>Browse to buy</Text>
                        <ArrowUpRight size={16} strokeWidth={ICON_SW} color={C.accentInk} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* ── Feature 1: Structural Sculpting Blueprint ───────────── */}
                  <TouchableOpacity
                    style={styles.featureHead}
                    activeOpacity={0.7}
                    onPress={() => setOpenBlueprint(prev => (prev === r.key ? null : r.key))}
                  >
                    <Activity size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink2} />
                    <View style={{ flex: 1 }}>
                      <Text style={[T.body, { fontWeight: '600', fontSize: 13.5, color: C.ink }]}>Structural Sculpting Blueprint</Text>
                      <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>{blueprint.length} movements · from your scan</Text>
                    </View>
                    {openBlueprint === r.key
                      ? <ChevronUp size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink3} />
                      : <ChevronDown size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink3} />}
                  </TouchableOpacity>

                  {openBlueprint === r.key && (
                    <View style={styles.featureBody}>
                      {/* structural metric chips */}
                      <View style={styles.metricChips}>
                        <MetricChip label="CANTHAL" value={`${structural.canthalTilt}°`} />
                        <MetricChip label="MIDFACE" value={structural.midfaceRatio.toFixed(2)} />
                        <MetricChip label="FLUID" value={structural.fluidRetention} />
                        <MetricChip label="BARRIER" value={structural.barrierStatus.split(' / ')[0]} />
                      </View>
                      {blueprint.map((b, i) => {
                        const Glyph = BLUEPRINT_GLYPH[b.icon];
                        return (
                          <View key={i} style={styles.blueprintRow}>
                            <View style={styles.blueprintGlyph}>
                              <Glyph size={ICON_SIZE} strokeWidth={ICON_SW} color={C.accentInk} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[T.body, { fontWeight: '600', fontSize: 13, color: C.ink }]}>
                                {String(i + 1).padStart(2, '0')} · {b.title}
                              </Text>
                              <Text style={[T.bodySm, { color: C.ink2, marginTop: 3, lineHeight: 17 }]}>{b.body}</Text>
                            </View>
                          </View>
                        );
                      })}

                      {/* Enter AR mode — live arrows over the front camera */}
                      {blueprint.length > 0 && (
                        <TouchableOpacity
                          style={styles.arBtn}
                          activeOpacity={0.85}
                          onPress={() => setArSession({
                            ritual: r.name,
                            steps: blueprint.map(b => ({ icon: b.icon, title: b.title, body: b.body })),
                          })}
                        >
                          <ScanFace size={ICON_SIZE} strokeWidth={ICON_SW} color={C.bg} />
                          <Text style={[T.button, { color: C.bg, fontSize: 13 }]}>Follow in AR mode</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* ── Feature 2: Synergy Check ────────────────────────────── */}
                  <TouchableOpacity
                    style={styles.featureHead}
                    activeOpacity={0.7}
                    onPress={() => setOpenSynergy(prev => (prev === r.key ? null : r.key))}
                  >
                    <FlaskConical size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink2} />
                    <View style={{ flex: 1 }}>
                      <Text style={[T.body, { fontWeight: '600', fontSize: 13.5, color: C.ink }]}>Synergy Check</Text>
                      <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>{shelf.length} on shelf · barrier-aware</Text>
                    </View>
                    {openSynergy === r.key
                      ? <ChevronUp size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink3} />
                      : <ChevronDown size={ICON_SIZE} strokeWidth={ICON_SW} color={C.ink3} />}
                  </TouchableOpacity>

                  {openSynergy === r.key && (
                    <View style={styles.featureBody}>
                      <View style={styles.shelfRow}>
                        {shelf.map(item => (
                          <View key={item.id} style={styles.shelfChip}>
                            <Text style={[T.pill, { color: C.ink2 }]}>{item.tag}</Text>
                          </View>
                        ))}
                      </View>
                      {synergy.map((f, i) => {
                        const st = SYNERGY_STYLE[f.kind];
                        return (
                          <View key={i} style={[styles.synergyBanner, { backgroundColor: st.bg, borderColor: st.border }]}>
                            <st.Icon size={ICON_SIZE} strokeWidth={ICON_SW} color={st.color} />
                            <View style={{ flex: 1 }}>
                              <Text style={[T.kicker, { color: st.color, marginBottom: 3 }]}>{f.title}</Text>
                              <Text style={[T.bodySm, { color: C.ink2, lineHeight: 17 }]}>{f.body}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <Text style={[T.kicker, { marginTop: 16, marginBottom: 6 }]}>BENEFITS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {r.benefits.map(b => <Pill key={b} label={b} variant="sage" />)}
                  </View>

                  <View style={styles.philosophyBox}>
                    <Text style={[T.kicker, { color: C.accent, marginBottom: 4 }]}>PHILOSOPHY</Text>
                    <Text style={[T.bodySm, { color: C.ink2, fontStyle: 'italic', lineHeight: 17 }]}>
                      "{r.philosophy}"
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.tryBtn, isActive && styles.tryBtnActive]}
                    onPress={() => tryRitual(r.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[T.button, { color: isActive ? C.ink : C.bg, fontSize: 13 }]}>
                      {isActive ? '✓  Currently active — tap to remove' : `Try ${r.name} for 7 days →`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </FlutedGlass>
          );
        })}

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Text style={[T.kicker, { color: C.ink4, textAlign: 'center', lineHeight: 16 }]}>
            ✦ ACTIVE RITUAL · adapts tomorrow's routine{'\n'}
            Blueprint & synergy read your latest structural scan
          </Text>
        </View>
      </ScrollView>

      <PremiumModal
        visible={showPremiumModal}
        onClose={dismissPremiumModal}
        onActivate={() => { setPremiumStatus(true); dismissPremiumModal(); }}
        reason="library"
      />

      {arSession && (
        <ARSculptOverlay
          steps={arSession.steps}
          ritualName={arSession.ritual}
          onClose={() => setArSession(null)}
        />
      )}
    </View>
  );
};

const MetricChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.metricChip}>
    <Text style={[T.kicker, { color: C.ink3, fontSize: 8, letterSpacing: 0.6 }]}>{label}</Text>
    <Text style={[T.num, { fontSize: 12, fontWeight: '600', color: C.ink, marginTop: 2 }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  card: { marginBottom: 10, borderColor: C.line },
  cardActive: { borderColor: C.accent, backgroundColor: C.accentSoft },
  cardAi: { borderColor: C.accent + '66' },
  cardLocked: { opacity: 0.7 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap: { width: 30, alignItems: 'center', paddingTop: 2 },
  cardBody: { marginTop: 12 },
  divider: { height: 1, backgroundColor: C.line, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },

  // Recommended product
  productCard: {
    flexDirection: 'row', gap: 12,
    padding: 12,
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.line,
  },
  productIcon: {
    width: 40, height: 40, borderRadius: R.md,
    backgroundColor: C.accentSoft,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  browseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: R.md,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '55',
  },

  // Feature sections
  featureHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 14,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: C.surface2,
    borderRadius: R.md,
  },
  featureBody: { marginTop: 10, gap: 12 },
  metricChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.line,
    minWidth: 64,
  },
  blueprintRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  arBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: R.md,
    backgroundColor: C.accentInk,
  },
  blueprintGlyph: {
    width: 38, height: 38, borderRadius: R.md,
    backgroundColor: C.accentSoft,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // Synergy
  shelfRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shelfChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.line2,
  },
  synergyBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
  },

  philosophyBox: {
    marginTop: 14, padding: 12,
    backgroundColor: C.accentSoft,
    borderRadius: R.md,
    marginBottom: 14,
  },
  tryBtn: { backgroundColor: C.ink, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' },
  tryBtnActive: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line2 },
  footerNote: { marginTop: 16, padding: 12, backgroundColor: C.surface2, borderRadius: R.md },
});
