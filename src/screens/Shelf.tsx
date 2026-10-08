/**
 * SHELF tab — every product the user owns, in one list.
 * Products come from search (Open Beauty Facts) or a label photo; both land on
 * the same shelf, so each one feeds the routine, the ingredient check and the
 * "is it working?" trial timer. Routine templates (skincare traditions) sit at
 * the bottom, matched to what's on the shelf.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Modal, FlatList, Image, ActivityIndicator, Linking,
} from 'react-native';
import {
  ScanText, TriangleAlert, CircleAlert, Droplet, ArrowUpRight, Minus,
  ChevronDown, ChevronUp, Hourglass, ShoppingBag, CircleCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FlutedGlass } from '../components/FlutedGlass';
import { Pill } from '../components/Pill';
import { ProductLabelScanner } from '../components/ProductLabelScanner';
import { useStore, type ShelfProduct } from '../store';
import { STEP_LABEL, categoryOf, type ProductCategory } from '../products';
import { checkShelf } from '../conflicts';
import { trialWeek, type Trial } from '../trials';
import { RITUALS, suggestTemplate, adaptRoutineForRitual } from '../rituals';
import { searchProducts, type OBFProduct } from '../services/openbeauty';
import { C, R, T, S } from '../tokens';

const CATEGORY_CHOICES: ProductCategory[] = [
  'cleanser', 'moisturizer', 'spf', 'serum', 'antiox', 'exfoliant', 'retinoid',
];

const VERDICT_LABEL = { better: 'Working', same: 'No change', worse: 'Made it worse' } as const;

const shopSearch = (q: string) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`;

// ── Volume bar ────────────────────────────────────────────────────────────────
const VolumeBar: React.FC<{ value: number }> = ({ value }) => {
  const color = value < 25 ? C.warn : value < 45 ? C.accent : C.sage;
  return (
    <View style={volStyles.track}>
      <View style={[volStyles.fill, { width: `${value}%` as any, backgroundColor: color }]} />
    </View>
  );
};
const volStyles = StyleSheet.create({
  track: { height: 3, backgroundColor: C.line, borderRadius: 2, overflow: 'hidden', flex: 1 },
  fill:  { height: 3, borderRadius: 2 },
});

// ── Product thumb (search results) ────────────────────────────────────────────
const ProductThumb: React.FC<{ uri: string | null }> = ({ uri }) => {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={styles.thumb}>
        <Droplet size={18} strokeWidth={1.2} color={C.ink3} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.thumb} onError={() => setFailed(true)} resizeMode="contain" />;
};

export const Shelf: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { shelf, trials, skinFeel, lastScores, addProduct, removeProduct, setProductCategory } = useStore();

  const [showScanner, setShowScanner] = useState(false);
  const [showAdd, setShowAdd]         = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<OBFProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);   // product id whose type is being set
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findings = checkShelf(shelf, skinFeel);
  const suggested = lastScores ? suggestTemplate(lastScores) : null;

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProducts(text);
        setResults(data.filter(p => !shelf.some(s => s.name === p.name)));
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 420);
  }, [shelf]);

  const handleAdd = (p: OBFProduct) => {
    addProduct({
      name: p.name,
      brand: p.brand,
      ingredients: p.ingredients
        .split(/[,;]/).map(i => i.trim().toLowerCase()).filter(Boolean).slice(0, 30),
      category: p.category,
      barcode: p.id,
      purchaseUrl: shopSearch(`${p.brand} ${p.name}`),
    });
    closeModal();
  };

  const closeModal = () => {
    setShowAdd(false);
    setQuery(''); setResults([]); setSearched(false);
  };

  // A product whose type we couldn't tell can't join the routine until set.
  const setCategory = (p: ShelfProduct, category: ProductCategory) => {
    setProductCategory(p.id, category);
    setFixing(null);
  };

  return (
    <View style={styles.root}>
      <Background />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={T.kicker}>SHELF · {shelf.length} PRODUCTS</Text>
            <Text style={[T.h1, { fontSize: 30, marginTop: 4 }]}>
              your <Text style={{ fontStyle: 'italic', color: C.accentInk }}>products</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.scannerBtn} onPress={() => setShowScanner(true)} activeOpacity={0.8}>
            <ScanText size={18} strokeWidth={1.2} color={C.accentInk} />
            <Text style={[T.button, { fontSize: 11, color: C.accentInk }]}>Scan label</Text>
          </TouchableOpacity>
        </View>

        {/* One ingredient check for the whole shelf */}
        {shelf.length > 0 && (
          <>
            <Text style={[T.kicker, { marginBottom: 8 }]}>INGREDIENT CHECK</Text>
            {findings.length === 0 ? (
              <FlutedGlass padding={12} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <CircleCheck size={16} strokeWidth={1.3} color={C.sage} />
                  <Text style={[T.bodySm, { color: C.ink2, flex: 1 }]}>No clashes between your products.</Text>
                </View>
              </FlutedGlass>
            ) : (
              <View style={{ marginBottom: 16 }}>
                {findings.map((f, i) => {
                  const Icon = f.kind === 'conflict' ? TriangleAlert : CircleAlert;
                  const color = f.kind === 'conflict' ? C.danger : C.warn;
                  return (
                    <View key={i} style={[styles.finding, f.kind === 'conflict' && styles.findingConflict]}>
                      <Icon size={16} strokeWidth={1.3} color={color} />
                      <View style={{ flex: 1 }}>
                        <Text style={[T.body, { fontWeight: '600', fontSize: 13, color: C.ink }]}>{f.title}</Text>
                        <Text style={[T.bodySm, { color: C.ink2, marginTop: 2, lineHeight: 17 }]}>{f.body}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Products */}
        <Text style={[T.kicker, { marginBottom: 8 }]}>MY PRODUCTS</Text>
        {shelf.length === 0 && (
          <FlutedGlass padding={14} style={{ marginBottom: 10 }}>
            <Text style={[T.bodySm, { color: C.ink3, lineHeight: 17 }]}>
              Add what you use. Your morning and evening routine builds itself from this list,
              and every product is checked against the others.
            </Text>
          </FlutedGlass>
        )}

        {shelf.map(item => {
          const category = categoryOf(item);
          const trial = trials.find(t => t.productId === item.id);
          const low = item.remainingVolume < 25;
          const flagged = findings.some(f => !f.quiet && f.productIds.includes(item.id));
          return (
            <FlutedGlass key={item.id} padding={12} style={[{ marginBottom: 10 }, flagged && { borderColor: C.warn }]}>
              <View style={styles.productRow}>
                <View style={[styles.thumb, { backgroundColor: C.accentSoft }]}>
                  <ShoppingBag size={16} strokeWidth={1.2} color={C.accentInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[T.body, { fontWeight: '600', fontSize: 13, color: C.ink, flex: 1 }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {category
                      ? <Pill label={STEP_LABEL[category]} />
                      : (
                        <TouchableOpacity onPress={() => setFixing(fixing === item.id ? null : item.id)}>
                          <Pill label="Set type" variant="warn" />
                        </TouchableOpacity>
                      )}
                  </View>
                  {!!item.brand && <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>{item.brand}</Text>}
                  <View style={styles.volumeRow}>
                    <VolumeBar value={item.remainingVolume} />
                    <Text style={[T.num, { fontSize: 10, color: low ? C.warn : C.ink3 }]}>~{item.remainingVolume}% left</Text>
                  </View>
                  {item.ingredients.length > 0 && (
                    <View style={styles.ingredientRow}>
                      {item.ingredients.slice(0, 3).map(ing => (
                        <View key={ing} style={styles.ingChip}>
                          <Text style={[T.pill, { fontSize: 9, color: C.ink3 }]}>{ing}</Text>
                        </View>
                      ))}
                      {item.ingredients.length > 3 && (
                        <View style={styles.ingChip}>
                          <Text style={[T.pill, { fontSize: 9, color: C.ink4 }]}>+{item.ingredients.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeProduct(item.id)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Minus size={16} strokeWidth={1.2} color={C.ink3} />
                </TouchableOpacity>
              </View>

              {/* Pick a type so the routine can use it */}
              {!category && fixing === item.id && (
                <View style={[styles.ingredientRow, { marginTop: 10 }]}>
                  {CATEGORY_CHOICES.map(c => (
                    <TouchableOpacity key={c} onPress={() => setCategory(item, c)} style={styles.typeChip}>
                      <Text style={[T.pill, { color: C.ink2 }]}>{STEP_LABEL[c]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {trial && <TrialLine trial={trial} />}

              {low && !!item.purchaseUrl && (
                <TouchableOpacity style={styles.restockBtn} onPress={() => Linking.openURL(item.purchaseUrl)} activeOpacity={0.8}>
                  <ArrowUpRight size={13} strokeWidth={1.2} color={C.accentInk} />
                  <Text style={[T.button, { fontSize: 11, color: C.accentInk }]}>Restock</Text>
                </TouchableOpacity>
              )}
            </FlutedGlass>
          );
        })}

        <View style={styles.addRow}>
          <TouchableOpacity style={[styles.addBtn, { flex: 1 }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
            <Text style={[T.button, { color: C.ink }]}>+ Add product</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScanner(true)} activeOpacity={0.8}>
            <ScanText size={16} strokeWidth={1.2} color={C.accentInk} />
            <Text style={[T.button, { color: C.accentInk, fontSize: 12 }]}>Scan label</Text>
          </TouchableOpacity>
        </View>

        {/* Routine templates */}
        <Text style={[T.kicker, { marginTop: 26, marginBottom: 4 }]}>ROUTINE TEMPLATES</Text>
        <Text style={[T.bodySm, { color: C.ink3, marginBottom: 10, lineHeight: 17 }]}>
          Ways different skincare traditions build a routine, matched to what's on your shelf.
        </Text>
        {RITUALS.map(r => {
          const open = openTemplate === r.key;
          const steps = open ? adaptRoutineForRitual(r.key, shelf) : [];
          return (
            <FlutedGlass key={r.key} padding={12} style={{ marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setOpenTemplate(open ? null : r.key)} activeOpacity={0.8}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[T.kicker, { color: C.ink3 }]}>{r.culture.toUpperCase()} · {r.duration}</Text>
                      {r.key === suggested && <Pill label="FITS YOUR LAST SCAN" variant="accent" />}
                    </View>
                    <Text style={[T.body, { fontWeight: '600', fontSize: 14, color: C.ink, marginTop: 2 }]}>{r.name}</Text>
                    <Text style={[T.bodySm, { color: C.ink3 }]}>{r.tagline}</Text>
                  </View>
                  {open
                    ? <ChevronUp size={20} strokeWidth={1.2} color={C.ink3} />
                    : <ChevronDown size={20} strokeWidth={1.2} color={C.ink3} />}
                </View>
              </TouchableOpacity>
              {open && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[T.bodySm, { color: C.ink2, lineHeight: 18, marginBottom: 10 }]}>{r.description}</Text>
                  {steps.map((st, i) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={[T.num, { fontSize: 10, color: C.ink3, width: 22 }]}>{String(i + 1).padStart(2, '0')}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[T.bodySm, { color: C.ink2 }]}>{st.step}</Text>
                        {!!st.product && (
                          <Text style={[T.kicker, { color: C.accentInk, marginTop: 1 }]}>YOUR {st.product.toUpperCase()}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {r.benefits.map(b => <Pill key={b} label={b} variant="sage" />)}
                  </View>
                  <TouchableOpacity style={styles.templateBuy} onPress={() => Linking.openURL(r.recommended.buyUrl)} activeOpacity={0.8}>
                    <Text style={[T.bodySm, { color: C.ink2, flex: 1 }]}>
                      Example product: <Text style={{ fontWeight: '600' }}>{r.recommended.name}</Text> ({r.recommended.brand})
                    </Text>
                    <ArrowUpRight size={14} strokeWidth={1.2} color={C.accentInk} />
                  </TouchableOpacity>
                </View>
              )}
            </FlutedGlass>
          );
        })}
      </ScrollView>

      {/* AI label scanner */}
      <ProductLabelScanner
        visible={showScanner}
        barrierStatus={skinFeel}
        onClose={() => setShowScanner(false)}
        onProductAdded={p => {
          addProduct(p);
          setShowScanner(false);
        }}
      />

      {/* Open Beauty Facts search */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet" onRequestClose={closeModal}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={[T.h2, { fontSize: 18 }]}>Add product</Text>
            <TouchableOpacity onPress={closeModal} activeOpacity={0.7}>
              <Text style={[T.body, { color: C.ink3, fontSize: 18 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by brand or product name…"
              placeholderTextColor={C.ink3}
              value={query}
              onChangeText={handleSearch}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loading && <ActivityIndicator style={styles.searchSpinner} size="small" color={C.accent} />}
          </View>

          {!searched && !loading && (
            <View style={styles.emptyState}>
              <Text style={[T.kicker, { color: C.ink3, textAlign: 'center' }]}>SEARCH BY BRAND OR NAME</Text>
              <Text style={[T.bodySm, { color: C.ink4, textAlign: 'center', marginTop: 6 }]}>
                Powered by Open Beauty Facts. Can't find it? Scan the label instead.
              </Text>
            </View>
          )}
          {searched && results.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={[T.kicker, { color: C.ink3, textAlign: 'center' }]}>NO RESULTS</Text>
            </View>
          )}

          <FlatList
            data={results}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.catalogRow} onPress={() => handleAdd(item)} activeOpacity={0.7}>
                <ProductThumb uri={item.imageUrl} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontWeight: '500', color: C.ink }]} numberOfLines={1}>{item.name}</Text>
                  {item.brand ? (
                    <Text style={[T.bodySm, { color: C.ink3, marginTop: 1 }]} numberOfLines={1}>{item.brand}</Text>
                  ) : null}
                </View>
                <Text style={[T.button, { color: C.accent, flexShrink: 0, marginLeft: 8 }]}>+ Add</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.line }} />}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Modal>
    </View>
  );
};

// Where a product is in its trial: too early to judge, or ready for a verdict.
const TrialLine: React.FC<{ trial: Trial }> = ({ trial }) => {
  if (trial.verdict) {
    return (
      <Text style={[T.kicker, { color: C.ink3, marginTop: 10 }]}>
        TRIAL DONE · {VERDICT_LABEL[trial.verdict].toUpperCase()}
      </Text>
    );
  }
  const week = trialWeek(trial);
  const due = week > trial.weeks;
  return (
    <View style={styles.trialBox}>
      <Hourglass size={14} strokeWidth={1.3} color={C.accentInk} />
      <View style={{ flex: 1 }}>
        <Text style={[T.kicker, { color: C.accentInk }]}>
          {due
            ? `TRIAL · ${trial.weeks} WEEKS UP · CHECK IN ON TODAY`
            : `TRIAL · WEEK ${week} OF ${trial.weeks} · TOO EARLY TO JUDGE`}
        </Text>
        <Text style={[T.bodySm, { color: C.ink2, marginTop: 3, lineHeight: 16, fontSize: 11 }]}>
          {trial.active[0]!.toUpperCase() + trial.active.slice(1)} usually takes {trial.range}. {trial.earlyNote}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: S.gutter },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 },
  scannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accentSoft, marginBottom: 4,
    borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  finding: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FBF3E6', borderRadius: R.md, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(199,145,68,0.30)',
  },
  findingConflict: { backgroundColor: '#FBEEEA', borderColor: 'rgba(178,63,44,0.26)' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: {
    width: 40, height: 40, borderRadius: R.md,
    backgroundColor: C.surface2, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 },
  ingredientRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  ingChip: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: R.pill, backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.line,
  },
  typeChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.line2, backgroundColor: C.surface,
  },
  trialBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 10, padding: 10, borderRadius: R.md, backgroundColor: C.accentSoft,
  },
  restockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: R.md, backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '55',
  },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: {
    borderWidth: 1, borderColor: C.line2, borderRadius: R.md,
    paddingVertical: 12, alignItems: 'center', backgroundColor: C.surface,
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: C.accent + '55',
    borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: C.accentSoft,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  templateBuy: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    padding: 10, borderRadius: R.md, backgroundColor: C.surface2,
  },
  modal: { flex: 1, backgroundColor: C.bg, paddingTop: 24 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: S.gutter, marginBottom: 16,
  },
  searchWrap: { marginHorizontal: S.gutter, marginBottom: 12, position: 'relative' },
  searchInput: {
    backgroundColor: C.surface2, borderRadius: R.md,
    paddingHorizontal: 12, paddingVertical: 10, paddingRight: 36,
    fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink,
  },
  searchSpinner: { position: 'absolute', right: 10, top: 10 },
  emptyState: { paddingTop: 48, paddingHorizontal: S.gutter, alignItems: 'center' },
  catalogRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.gutter, paddingVertical: 12, gap: 12,
  },
});
