import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Modal, FlatList, Image, ActivityIndicator, Linking,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  ScanText, ShoppingBag, TriangleAlert, Droplet,
  ArrowUpRight, Minus,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { FlutedGlass } from '../components/FlutedGlass';
import { Pill } from '../components/Pill';
import { ProductLabelScanner } from '../components/ProductLabelScanner';
import { useStore } from '../store';
import { CATALOG, registerProduct, type ProductCategory } from '../products';
import { searchProducts, type OBFProduct } from '../services/openbeauty';
import { C, R, T, S } from '../tokens';

// ── Harsh active detection (mirrors scanner) ──────────────────────────────────
const HARSH_ACTIVES = [
  'retinol', 'retinyl', 'tretinoin', 'adapalene',
  'glycolic acid', 'salicylic acid', 'benzoyl peroxide',
  'ascorbic acid', 'vitamin c', 'lactic acid',
];

function harshActiveIn(ingredients: string[]): string | null {
  for (const h of HARSH_ACTIVES) {
    if (ingredients.some(i => i.toLowerCase().includes(h))) return h;
  }
  return null;
}

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

// ── Back arrow ────────────────────────────────────────────────────────────────
const BackArrow = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M19 12H5M11 18l-6-6 6-6" stroke={C.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ── Product thumb ─────────────────────────────────────────────────────────────
const ProductThumb: React.FC<{ uri: string | null }> = ({ uri }) => {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={styles.thumb}>
        <Droplet size={18} strokeWidth={1.2} color={C.ink3} />
      </View>
    );
  }
  return (
    <Image source={{ uri }} style={styles.thumb} onError={() => setFailed(true)} resizeMode="contain" />
  );
};

interface Props { onBack: () => void }

export const Products: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const {
    owned, addProduct, removeProduct,
    userShelf, addBarcodeProduct, removeBarcodeProduct,
    faceMetrics,
  } = useStore();

  const [showScanner, setShowScanner] = useState(false);
  const [showAdd, setShowAdd]         = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<OBFProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const barrierFatigued = /sensiti|fatig/i.test(faceMetrics.barrierStatus);

  // ── Unified shelf ─────────────────────────────────────────────────────────
  // One inventory, two sources: INCI-scanned products (with tracked volume) and
  // routine-linked catalog products (with their actives as the ingredient
  // profile). Every item renders the same way — name, ingredient chips, and a
  // volume bar where we track it — so there's a single "My Shelf", not two lists.
  type UnifiedItem = {
    id: string;
    name: string;
    subtitle: string;
    ingredients: string[];
    volume: number | null;
    tone?: string;
    purchaseUrl?: string;
    source: 'inci' | 'routine';
  };

  const unified: UnifiedItem[] = [
    ...userShelf.map(p => ({
      id: p.id, name: p.name, subtitle: p.brand,
      ingredients: p.ingredients, volume: p.remainingVolume,
      purchaseUrl: p.purchaseUrl, source: 'inci' as const,
    })),
    ...owned
      .filter(name => !userShelf.some(p => p.name === name))
      .map(name => {
        const info = CATALOG[name];
        return {
          id: `owned-${name}`, name,
          subtitle: info?.category ? info.category.toUpperCase() : 'ROUTINE',
          ingredients: info?.actives ?? [],
          volume: null,
          tone: info?.tone === 'both' ? 'AM/PM' : (info?.tone ?? 'AM/PM'),
          source: 'routine' as const,
        };
      }),
  ];

  const removeUnified = (item: UnifiedItem) =>
    item.source === 'inci' ? removeBarcodeProduct(item.id) : removeProduct(item.name);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProducts(text);
        setResults(data.filter(p => !owned.includes(p.name)));
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 420);
  }, [owned]);

  const handleAdd = (product: OBFProduct) => {
    registerProduct(product.name, product.category as ProductCategory);
    addProduct(product.name);
    setShowAdd(false);
    setQuery(''); setResults([]); setSearched(false);
  };

  const closeModal = () => {
    setShowAdd(false);
    setQuery(''); setResults([]); setSearched(false);
  };

  return (
    <View style={styles.root}>
      <Background />
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>

        {/* Nav bar */}
        <View style={[styles.navBar, { paddingHorizontal: S.gutter }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <BackArrow />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[T.h2, { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: 0 }]}>
              My shelf
            </Text>
            <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>
              {unified.length} products · INCI data linked
            </Text>
          </View>
          {/* Label scanner CTA */}
          <TouchableOpacity
            style={styles.scannerBtn}
            onPress={() => setShowScanner(true)}
            activeOpacity={0.8}
          >
            <ScanText size={18} strokeWidth={1.2} color={C.accentInk} />
            <Text style={[T.button, { fontSize: 11, color: C.accentInk }]}>Scan label</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Unified shelf — one inventory, every item with INCI + volume ── */}
          <View style={styles.sectionH}>
            <Text style={T.kicker}>MY SHELF · INCI TRACKED</Text>
            <Text style={[T.num, { fontSize: 10, color: C.ink3 }]}>{unified.length}</Text>
          </View>

          {unified.map(item => {
            const harsh    = harshActiveIn(item.ingredients);
            const conflict = barrierFatigued && !!harsh;
            const low      = item.volume !== null && item.volume < 25;

            return (
              <FlutedGlass key={item.id} padding={12} style={{ marginBottom: 10 }}>
                {/* Conflict note — barrier-aware, surfaces on any harsh active */}
                {conflict && (
                  <View style={styles.conflictBanner}>
                    <TriangleAlert size={13} strokeWidth={1.3} color={C.warn} />
                    <Text style={[T.bodySm, { color: C.ink2, flex: 1, fontSize: 11, lineHeight: 15 }]}>
                      Has <Text style={{ fontWeight: '600' }}>{harsh}</Text> — ease in gently while your barrier recovers.
                    </Text>
                  </View>
                )}

                <View style={styles.productRow}>
                  {/* Icon — differentiates a scanned product from a routine staple */}
                  <View style={[styles.thumb, item.source === 'inci' && { backgroundColor: C.accentSoft }]}>
                    {item.source === 'inci'
                      ? <ShoppingBag size={16} strokeWidth={1.2} color={C.accentInk} />
                      : <Droplet size={16} strokeWidth={1.2} color={C.ink3} />}
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[T.body, { fontWeight: '600', fontSize: 13, color: C.ink, flex: 1 }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.source === 'routine' && item.tone && <Pill label={item.tone} />}
                    </View>
                    <Text style={[T.kicker, { color: C.ink3, marginTop: 2 }]}>{item.subtitle}</Text>

                    {/* Volume row — tracked for scanned items; routine items show a label */}
                    {item.volume !== null ? (
                      <View style={styles.volumeRow}>
                        <VolumeBar value={item.volume} />
                        <Text style={[T.num, { fontSize: 10, color: item.volume < 20 ? C.warn : C.ink3 }]}>
                          {item.volume}%
                        </Text>
                      </View>
                    ) : (
                      <Text style={[T.kicker, { color: C.ink4, fontSize: 8, marginTop: 6, letterSpacing: 0.6 }]}>
                        ROUTINE-LINKED · VOLUME NOT TRACKED
                      </Text>
                    )}

                    {/* Ingredient profile — INCI for scanned, actives for catalog */}
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

                  {/* Remove */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeUnified(item)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Minus size={16} strokeWidth={1.2} color={C.ink3} />
                  </TouchableOpacity>
                </View>

                {/* Restock button (visible when a tracked volume is low) */}
                {low && item.purchaseUrl && (
                  <TouchableOpacity
                    style={styles.restockBtn}
                    onPress={() => Linking.openURL(item.purchaseUrl!)}
                    activeOpacity={0.8}
                  >
                    <ArrowUpRight size={13} strokeWidth={1.2} color={C.accentInk} />
                    <Text style={[T.button, { fontSize: 11, color: C.accentInk }]}>Restock Product</Text>
                  </TouchableOpacity>
                )}
              </FlutedGlass>
            );
          })}

          {/* Add buttons */}
          <View style={styles.addRow}>
            <TouchableOpacity
              style={[styles.addBtn, { flex: 1 }]}
              onPress={() => setShowAdd(true)}
              activeOpacity={0.8}
            >
              <Text style={[T.button, { color: C.ink }]}>+ Add product</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scanBtn]}
              onPress={() => setShowScanner(true)}
              activeOpacity={0.8}
            >
              <ScanText size={16} strokeWidth={1.2} color={C.accentInk} />
              <Text style={[T.button, { color: C.accentInk, fontSize: 12 }]}>Scan label</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* AI label scanner modal */}
      <ProductLabelScanner
        visible={showScanner}
        barrierStatus={faceMetrics.barrierStatus}
        onClose={() => setShowScanner(false)}
        onProductAdded={(p) => {
          addBarcodeProduct(p);
          setShowScanner(false);
        }}
      />

      {/* OBF search modal */}
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
              placeholder="Search millions of products…"
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
              <Text style={[T.kicker, { color: C.ink3, textAlign: 'center' }]}>
                SEARCH BY BRAND, NAME, OR INGREDIENT
              </Text>
              <Text style={[T.bodySm, { color: C.ink4, textAlign: 'center', marginTop: 6 }]}>
                Powered by Open Beauty Facts
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
                  <View style={styles.pillRow}>
                    <Pill label={item.category} />
                  </View>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  scannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accentSoft,
    borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  scroll: { paddingHorizontal: S.gutter },
  sectionH: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  conflictBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FEF6EC',
    borderRadius: R.md, padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(193,140,60,0.22)',
  },
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
  ingChipWarn: { backgroundColor: '#FBEEEA', borderColor: 'rgba(178,63,44,0.25)' },
  restockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: R.md,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accent + '55',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: {
    borderWidth: 1, borderColor: C.line2, borderRadius: R.md,
    paddingVertical: 12, alignItems: 'center',
    backgroundColor: C.surface,
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: C.accent + '55',
    borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: C.accentSoft,
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
