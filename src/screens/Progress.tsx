/**
 * PROGRESS tab — today's photo + scan, then everything over time:
 * the photo timeline (compare any photo with the latest, or play a timelapse),
 * a trend line per score, the score explanations, and the monthly recap.
 * Photos stay on the phone; only the scan's AI read leaves it.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, Alert,
  useWindowDimensions,
} from 'react-native';
import { Play, X, CalendarDays, FileText } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FlutedGlass } from '../components/FlutedGlass';
import { MetricStrip } from '../components/MetricStrip';
import { ScoreDetails } from '../components/ScoreDetails';
import { TrendChart } from '../components/TrendChart';
import { MonthlyRecap } from '../components/MonthlyRecap';
import { shareReport } from '../services/report';
import { Scan } from './Scan';
import { useStore, type ScanEntry, type SkinScores } from '../store';
import { shortDate } from '../dates';
import { C, R, T, S } from '../tokens';

const TREND_FIELDS: { key: keyof SkinScores; label: string }[] = [
  { key: 'overall',   label: 'Appearance' },
  { key: 'acne',      label: 'Clear' },
  { key: 'redness',   label: 'Calm' },
  { key: 'texture',   label: 'Smooth' },
  { key: 'tone',      label: 'Even' },
  { key: 'oil',       label: 'Matte' },
  { key: 'hydration', label: 'Not dry' },
  { key: 'pores',     label: 'Pores' },
];

const THUMB = 64;

export const Progress: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    scans, lastScores, prevScores, deleteScan, isPremium, openPremiumModal,
    user, skinFeel, questionnaireAnswers, shelf, trials, completions,
  } = useStore();
  const [reporting, setReporting] = useState(false);
  const [metric, setMetric] = useState<keyof SkinScores>('overall');
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [showTimelapse, setShowTimelapse] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  const photos = scans.filter(e => e.photoUri);
  const latest = photos[photos.length - 1] ?? null;
  const before = photos.find(p => p.id === beforeId && p.id !== latest?.id) ?? (photos.length > 1 ? photos[0]! : null);
  const photoW = (width - S.gutter * 2 - 10) / 2;

  const trendPoints = scans
    .filter(e => e.scores)
    .map(e => ({ date: shortDate(e.date), value: e.scores![metric] }));

  const confirmDelete = (e: ScanEntry) =>
    Alert.alert('Delete this photo?', `${shortDate(e.date)} · it will be removed from this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteScan(e.id) },
    ]);

  const playTimelapse = () => (isPremium ? setShowTimelapse(true) : openPremiumModal('timelapse'));

  const makeReport = async () => {
    if (!isPremium) return openPremiumModal('report');
    setReporting(true);
    try {
      await shareReport({
        name: user?.name ?? 'Not given', skinFeel, answers: questionnaireAnswers,
        scans, shelf, trials, completions,
      });
    } catch {
      Alert.alert('Couldn\'t make the report', 'Try again in a moment.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Background />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingHorizontal: S.gutter }]}>
          <View style={{ flex: 1 }}>
            <Text style={T.kicker}>PROGRESS</Text>
            <Text style={[T.h1, { fontSize: 30, marginTop: 4 }]}>
              your skin, <Text style={{ fontStyle: 'italic', color: C.accentInk }}>over time</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.recapBtn} onPress={makeReport} disabled={reporting} activeOpacity={0.8}>
              <FileText size={14} strokeWidth={1.3} color={C.accentInk} />
              <Text style={[T.button, { fontSize: 11, color: C.accentInk }]}>{reporting ? 'Preparing…' : 'Report'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.recapBtn} onPress={() => setShowRecap(true)} activeOpacity={0.8}>
              <CalendarDays size={14} strokeWidth={1.3} color={C.accentInk} />
              <Text style={[T.button, { fontSize: 11, color: C.accentInk }]}>Recap</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Scan />

        <View style={{ paddingHorizontal: S.gutter, marginTop: 22 }}>
          {/* Photo timeline */}
          <View style={styles.sectionHeader}>
            <Text style={T.kicker}>PHOTO TIMELINE</Text>
            <Text style={[T.num, { fontSize: 10, color: C.ink3 }]}>{photos.length} photos</Text>
          </View>
          {photos.length === 0 ? (
            <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17, marginBottom: 18 }]}>
              Your photos appear here after each scan. Dermatologists judge change from photos taken the
              same way each time, so use the ghost outline and similar light.
            </Text>
          ) : (
            <>
              {before && latest && (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  {[before, latest].map((p, i) => (
                    <View key={p.id}>
                      <Image source={{ uri: p.photoUri! }} style={[styles.photo, { width: photoW, height: photoW * 1.25 }]} />
                      <Text style={[T.kicker, { color: C.ink3, marginTop: 4, textAlign: 'center' }]}>
                        {i === 0 ? 'BEFORE' : 'LATEST'} · {shortDate(p.date)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.map(p => {
                  const selected = p.id === before?.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setBeforeId(p.id)}
                      onLongPress={() => confirmDelete(p)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: p.photoUri! }} style={[styles.thumb, selected && styles.thumbSelected]} />
                      <Text style={[T.kicker, { fontSize: 8, color: C.ink3, textAlign: 'center', marginTop: 3 }]}>
                        {shortDate(p.date)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={[T.bodySm, { color: C.ink4, fontSize: 11, marginTop: 6 }]}>
                Tap a photo to compare it with the latest. Hold to delete.
              </Text>
              {photos.length >= 3 && (
                <TouchableOpacity style={styles.timelapseBtn} onPress={playTimelapse} activeOpacity={0.85}>
                  <Play size={14} strokeWidth={1.4} color={C.bg} />
                  <Text style={[T.button, { color: C.bg, fontSize: 13 }]}>
                    Play timelapse{isPremium ? '' : ' · Premium'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 18 }} />
            </>
          )}

          {/* Trend line for one score */}
          <Text style={[T.kicker, { marginBottom: 8 }]}>TREND</Text>
          {lastScores && (
            <View style={{ marginBottom: 10, marginHorizontal: -S.gutter }}>
              <View style={{ paddingHorizontal: S.gutter }}>
                <MetricStrip
                  metrics={TREND_FIELDS.map(f => ({
                    key: f.key, label: f.label, value: String(lastScores[f.key]), dot: 'good' as const,
                  }))}
                  active={metric}
                  onPick={k => setMetric(k as keyof SkinScores)}
                />
              </View>
            </View>
          )}
          <FlutedGlass padding={14} style={{ marginBottom: 8 }}>
            <TrendChart points={trendPoints} width={width - S.gutter * 2 - 28} />
          </FlutedGlass>
          <Text style={[T.bodySm, { color: C.ink4, fontSize: 11, lineHeight: 15, marginBottom: 18 }]}>
            Higher means less visible in the photo. Light and camera move scores by a few points,
            so look for a direction over several weeks, not one jump.
          </Text>

          {/* What each score means */}
          {lastScores && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[T.kicker, { flex: 1 }]}>LATEST SCORES</Text>
                <Text style={[T.kicker, { color: C.ink4, fontSize: 8 }]}>TAP FOR DETAIL</Text>
              </View>
              <ScoreDetails lastScores={lastScores} prevScores={prevScores} />
            </>
          )}
        </View>
      </ScrollView>

      <Timelapse visible={showTimelapse} photos={photos} onClose={() => setShowTimelapse(false)} />
      <MonthlyRecap visible={showRecap} onClose={() => setShowRecap(false)} />
    </View>
  );
};

// Steps through every progress photo in order, a few per second.
const Timelapse: React.FC<{ visible: boolean; photos: ScanEntry[]; onClose: () => void }> = ({
  visible, photos, onClose,
}) => {
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible || photos.length === 0) return;
    setI(0);
    timer.current = setInterval(() => setI(n => (n + 1) % photos.length), 450);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [visible, photos.length]);

  const p = photos[Math.min(i, photos.length - 1)];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.timelapse}>
        {p && <Image source={{ uri: p.photoUri! }} style={{ width, height: width * 1.33 }} resizeMode="cover" />}
        {p && (
          <Text style={[T.kicker, { color: 'white', marginTop: 14 }]}>
            {shortDate(p.date)} · {i + 1} of {photos.length}
          </Text>
        )}
        <TouchableOpacity style={styles.timelapseClose} onPress={onClose} hitSlop={12}>
          <X size={24} strokeWidth={1.4} color="white" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 },
  recapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accentSoft, borderRadius: R.md,
    paddingHorizontal: 10, paddingVertical: 7, marginBottom: 4,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  photo: { borderRadius: R.md, backgroundColor: C.surface2 },
  thumb: { width: THUMB, height: THUMB * 1.25, borderRadius: R.sm, backgroundColor: C.surface2 },
  thumbSelected: { borderWidth: 2, borderColor: C.accent },
  timelapseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.ink, borderRadius: R.md, paddingVertical: 12, marginTop: 12,
  },
  timelapse: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  timelapseClose: { position: 'absolute', top: 56, right: 20 },
});
