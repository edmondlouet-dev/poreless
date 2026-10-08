// Full-screen monthly recap: routines, consistency, scans, how the face changed
// (first vs last photo and score), and product trial outcomes.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react-native';
import { FlutedGlass } from './FlutedGlass';
import { useStore } from '../store';
import { buildRecap, recapIsEmpty, recapMonths } from '../recap';
import { monthLabel, shortDate } from '../dates';
import { C, R, T, S } from '../tokens';

interface Props {
  visible: boolean;
  initialMonth?: string;
  onClose: () => void;
}

// Free shows the latest two months (this one and last); Premium keeps them all.
const FREE_MONTHS = 2;

const VERDICT_LABEL = { better: 'Working', same: 'No change', worse: 'Made it worse' } as const;

export const MonthlyRecap: React.FC<Props> = ({ visible, initialMonth, onClose }) => {
  const { completions, scans, shelf, trials, isPremium, openPremiumModal } = useStore();
  const { width } = useWindowDimensions();
  const data = { completions, scans, shelf, trials };
  const months = recapMonths(data);
  const [idx, setIdx] = useState(0);

  // Jump to the requested month each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const i = initialMonth ? months.indexOf(initialMonth) : 0;
    setIdx(i >= 0 ? i : 0);
  }, [visible, initialMonth]);

  const month = months[Math.min(idx, months.length - 1)]!;
  const r = buildRecap(month, data);
  const empty = recapIsEmpty(r);
  const locked = !isPremium && idx >= FREE_MONTHS;
  // The paywall can't open over this sheet, so close it first.
  const unlock = () => { onClose(); setTimeout(() => openPremiumModal('recap'), 450); };
  const pct = r.daysInPeriod ? Math.round((r.activeDays / r.daysInPeriod) * 100) : 0;
  const photoW = (width - S.gutter * 2 - 10) / 2;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setIdx(i => Math.min(months.length - 1, i + 1))}
            disabled={idx >= months.length - 1}
            hitSlop={10}
          >
            <ChevronLeft size={22} strokeWidth={1.4} color={idx >= months.length - 1 ? C.line2 : C.ink2} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={T.kicker}>MONTHLY RECAP</Text>
            <Text style={[T.h2, { fontSize: 20, marginTop: 2 }]}>{monthLabel(month)}</Text>
          </View>
          <TouchableOpacity onPress={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} hitSlop={10}>
            <ChevronRight size={22} strokeWidth={1.4} color={idx === 0 ? C.line2 : C.ink2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 14 }} hitSlop={10}>
            <X size={20} strokeWidth={1.4} color={C.ink3} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: S.gutter, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {locked ? (
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 12 }}>
              <Lock size={22} strokeWidth={1.3} color={C.accentInk} />
              <Text style={[T.h2, { fontSize: 18, marginTop: 12, textAlign: 'center' }]}>Older recaps are Premium</Text>
              <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', marginTop: 6, lineHeight: 18 }]}>
                Free shows this month and last month. Your data for {monthLabel(month)} is still saved.
              </Text>
              <TouchableOpacity style={styles.unlockBtn} onPress={unlock} activeOpacity={0.85}>
                <Text style={[T.button, { color: C.bg, fontSize: 13 }]}>See Premium</Text>
              </TouchableOpacity>
            </View>
          ) : empty ? (
            <Text style={[T.bodySm, { color: C.ink3, textAlign: 'center', marginTop: 40, lineHeight: 18 }]}>
              Nothing logged this month yet. Finish a routine or take a scan and it will show up here.
            </Text>
          ) : (
            <>
              {/* Headline stats */}
              <View style={styles.grid}>
                <Stat value={String(r.routines)} label="Routines done" />
                <Stat value={`${pct}%`} label={`Days active (${r.activeDays}/${r.daysInPeriod})`} />
                <Stat value={`${r.bestStreak}d`} label="Best streak" />
              </View>
              <View style={styles.grid}>
                <Stat value={String(r.morning)} label="Mornings" />
                <Stat value={String(r.evening)} label="Evenings" />
                <Stat value={String(r.scans)} label="Scans" />
              </View>

              {/* How the face changed: photos first, then scores */}
              <Text style={[T.kicker, { marginTop: 10, marginBottom: 8 }]}>HOW YOUR SKIN CHANGED</Text>
              {r.firstPhoto && r.lastPhoto ? (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  {[r.firstPhoto, r.lastPhoto].map((p, i) => (
                    <View key={p.id}>
                      <Image source={{ uri: p.photoUri! }} style={[styles.photo, { width: photoW, height: photoW * 1.25 }]} />
                      <Text style={[T.kicker, { color: C.ink3, marginTop: 4, textAlign: 'center' }]}>
                        {i === 0 ? 'START' : 'END'} · {shortDate(p.date)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[T.bodySm, { color: C.ink3, marginBottom: 12, lineHeight: 17 }]}>
                  Take at least two progress photos in a month to see them side by side.
                </Text>
              )}

              {r.changes.length > 0 && (
                <FlutedGlass padding={12} style={{ marginBottom: 6 }}>
                  {r.changes.map(c => {
                    const d = c.to - c.from;
                    return (
                      <View key={c.label} style={styles.changeRow}>
                        <Text style={[T.bodySm, { flex: 1, color: C.ink2 }]}>{c.label}</Text>
                        <Text style={[T.num, { fontSize: 12, color: C.ink3, width: 70, textAlign: 'right' }]}>
                          {c.from} → {c.to}
                        </Text>
                        <Text style={[T.num, {
                          fontSize: 12, width: 40, textAlign: 'right', fontWeight: '600',
                          color: d > 2 ? C.sage : d < -2 ? C.warn : C.ink3,
                        }]}>
                          {d > 0 ? '+' : ''}{d}
                        </Text>
                      </View>
                    );
                  })}
                </FlutedGlass>
              )}
              <Text style={[T.bodySm, { color: C.ink4, fontSize: 11, lineHeight: 15, marginBottom: 16 }]}>
                First vs last scored scan this month. Light and camera shift scores by a few points,
                so small changes are noise. The photos are the better guide.
              </Text>

              {/* Products */}
              <Text style={[T.kicker, { marginBottom: 8 }]}>PRODUCTS</Text>
              <FlutedGlass padding={12} style={{ marginBottom: 16 }}>
                <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18 }]}>
                  {r.productsAdded} added · {r.trialsStarted} trial{r.trialsStarted === 1 ? '' : 's'} started
                </Text>
                {r.verdicts.map(v => (
                  <Text key={v.product} style={[T.bodySm, { color: C.ink2, lineHeight: 18, marginTop: 4 }]}>
                    {v.product}: <Text style={{ fontWeight: '600' }}>{VERDICT_LABEL[v.verdict!]}</Text>
                  </Text>
                ))}
              </FlutedGlass>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <FlutedGlass padding={12} style={{ flex: 1, alignItems: 'center' }}>
    <Text style={[T.num, { fontSize: 22, fontWeight: '600', textAlign: 'center' }]}>{value}</Text>
    <Text style={[T.kicker, { color: C.ink3, textAlign: 'center', marginTop: 3, fontSize: 8 }]}>{label}</Text>
  </FlutedGlass>
);

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: C.bg, paddingTop: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.gutter, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  grid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  photo: { borderRadius: R.md, backgroundColor: C.surface2 },
  changeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  unlockBtn: { backgroundColor: C.ink, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 22, marginTop: 18 },
});
