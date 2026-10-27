import { useEffect, useState, useMemo } from 'react';
import {
  Card, Button, Modal, Typography, Tag, App,
  Row, Col, Input, Empty, Spin, Descriptions, Divider,
  InputNumber, Alert, Progress, Tooltip, Select, Checkbox,
} from 'antd';
import {
  SearchOutlined, PhoneOutlined, EnvironmentOutlined,
  ShoppingCartOutlined, InfoCircleOutlined, ExperimentOutlined,
  RobotOutlined, ThunderboltOutlined, FilterOutlined,
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { listingService, mlService, rawMaterialService, butcheryService, orderService } from '../../services/api';

const { Title, Text } = Typography;
const { Search } = Input;

// ── Sabitler ──────────────────────────────────────────────────────────────────
const PRODUCT_META: Record<string, { emoji: string; color: string }> = {
  'Sucuk':    { emoji: '🌭', color: '#f50' },
  'Salam':    { emoji: '🥩', color: '#eb2f96' },
  'Sosis':    { emoji: '🍖', color: '#fa8c16' },
  'Pastırma': { emoji: '🥓', color: '#722ed1' },
};

// source: 'part' → parçalama lotu  |  'stock' → raw_materials deposu
// source: 'part'  → sadece et (parçalama lotundan, hayvan seçimi gerektirir)
// source: 'stock' → raw_materials deposu (bağırsak dahil diğer tüm malzemeler)
const PRODUCT_MATERIALS: Record<string, { name: string; unit: string; source: 'part' | 'stock' }[]> = {
  'Sucuk': [
    { name: 'Et',       unit: 'kg', source: 'part'  },
    { name: 'Yağ',      unit: 'kg', source: 'stock' },
    { name: 'Sarımsak', unit: 'kg', source: 'stock' },
    { name: 'Bağırsak', unit: 'kg', source: 'stock' },
    { name: 'Tuz',      unit: 'kg', source: 'stock' },
    { name: 'Baharat',  unit: 'kg', source: 'stock' },
  ],
  'Salam': [
    { name: 'Et',                  unit: 'kg', source: 'part'  },
    { name: 'Sarımsak',            unit: 'kg', source: 'stock' },
    { name: 'Tuz',                 unit: 'kg', source: 'stock' },
    { name: 'Baharat',             unit: 'kg', source: 'stock' },
    { name: 'Jelatin',             unit: 'kg', source: 'stock' },
    { name: 'İlikli Kemik Suyu',   unit: 'lt', source: 'stock' },
    { name: 'Yumurta Akı',         unit: 'lt', source: 'stock' },
    { name: 'Kırmızı Pancar Suyu', unit: 'lt', source: 'stock' },
  ],
  'Sosis': [
    { name: 'Et',       unit: 'kg', source: 'part'  },
    { name: 'Yoğurt',   unit: 'kg', source: 'stock' },
    { name: 'Salça',    unit: 'kg', source: 'stock' },
    { name: 'Tuz',      unit: 'kg', source: 'stock' },
    { name: 'Baharat',  unit: 'kg', source: 'stock' },
    { name: 'Bağırsak', unit: 'kg', source: 'stock' },
  ],
  'Pastırma': [
    { name: 'Et',    unit: 'kg', source: 'part'  },
    { name: 'Tuz',   unit: 'kg', source: 'stock' },
    { name: 'Çemen', unit: 'kg', source: 'stock' },
  ],
};

const ANIMAL_META: Record<string, { emoji: string; label: string }> = {
  'inek':  { emoji: '🐄', label: 'İnek' },
  'koyun': { emoji: '🐑', label: 'Koyun / Kuzu' },
  'tavuk': { emoji: '🐔', label: 'Tavuk' },
};

// Hangi hayvandan hangi ürün yapılabilir
const ANIMAL_PRODUCTS: Record<string, string[]> = {
  'inek':  ['Sucuk', 'Salam', 'Sosis', 'Pastırma'],
  'koyun': ['Sucuk', 'Salam', 'Sosis'],
  'tavuk': ['Sucuk', 'Salam', 'Sosis'],
};

// ── Tipler ────────────────────────────────────────────────────────────────────
interface ProducerListing {
  id: number;
  producer_id: number;
  producer_name: string;
  phone?: string;
  address?: string;
  product_name: string;
  description?: string;
  service_price: number;
  service_unit: string;
  min_order_qty?: number;
  required_materials?: string;
  is_active: boolean;
  created_at: string;
}

interface RawMaterial {
  id: number;
  material_type: string;
  quantity: number;
  unit: string;
  unit_price: number;
  lot_id: number;
}

interface AvailablePart {
  part_id: number;
  part_name: string;
  animal_type: string;
  operation_date: string;
  lot_id: number;
  lot_number: string;
  available_kg: number;
}

interface MLResult {
  predicted_qty_ratio: number;
  predicted_ekp: number;
  confidence: number;
  sample_count: number;
  method: string;
  notes: string;
}

// Seçilen parça lotu + miktar
interface PartSelection {
  lot_id: number;
  kg: number;
  checked: boolean; // gönderilecek mi?
}

function confidenceColor(c: number) {
  if (c >= 0.8) return '#52c41a';
  if (c >= 0.5) return '#faad14';
  return '#ff4d4f';
}
function methodLabel(m: string) {
  const map: Record<string, string> = {
    random_forest: 'RandomForest ML',
    linear:        'Lineer Regresyon',
    rule_based:    'Kural Tabanlı',
  };
  return map[m] ?? m;
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function ProducerListingsPage() {
  const { message: msg } = App.useApp();

  const [listings, setListings] = useState<ProducerListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const [stock, setStock]           = useState<RawMaterial[]>([]);
  const [availParts, setAvailParts] = useState<AvailablePart[]>([]);
  const [stockLoading, setStockLoading] = useState(true);

  // Filtre state
  const [selProduct, setSelProduct] = useState<string | null>(null);
  const [selAnimal,  setSelAnimal]  = useState<string | null>(null);
  // part kaynaklı hammadde adı → PartSelection (her parça adı için ayrı satır)
  const [partSel, setPartSel] = useState<Record<string, PartSelection>>({});
  // stock kaynaklı hammadde adı → kg
  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});

  // Detay modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selListing, setSelListing] = useState<ProducerListing | null>(null);

  // ML modal
  const [mlOpen,    setMlOpen]    = useState(false);
  const [mlListing, setMlListing] = useState<ProducerListing | null>(null);
  const [mlInputs,  setMlInputs]  = useState<Record<string, number>>({});
  const [mlResult,  setMlResult]  = useState<MLResult | null>(null);
  const [mlLoading, setMlLoading] = useState(false);

  // Sipariş modal
  const [orderOpen,      setOrderOpen]      = useState(false);
  const [orderListing,   setOrderListing]   = useState<ProducerListing | null>(null);
  const [orderInputs,    setOrderInputs]    = useState<Record<string, number>>({});
  const [orderNote,      setOrderNote]      = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // ── Yükle ────────────────────────────────────────────────────────────────
  useEffect(() => {
    listingService.getProducerListings()
      .then(r => setListings(r.data))
      .catch(() => msg.error('İlanlar yüklenemedi'))
      .finally(() => setLoading(false));

    Promise.all([rawMaterialService.getAll(), butcheryService.getAvailableParts()])
      .then(([rm, ap]) => { setStock(rm.data); setAvailParts(ap.data); })
      .finally(() => setStockLoading(false));
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────
  function onProductSelect(p: string | null) {
    setSelProduct(p); setSelAnimal(null); setPartSel({}); setStockInputs({});
  }
  function onAnimalSelect(a: string | null) {
    setSelAnimal(a);
    setPartSel({});
    // Seçili ürün bu hayvanla uyumsuzsa sıfırla
    if (a && selProduct && !(ANIMAL_PRODUCTS[a] ?? []).includes(selProduct)) {
      setSelProduct(null);
      setStockInputs({});
    }
  }

  // ── Stok haritaları ──────────────────────────────────────────────────────

  // raw_materials toplamı (Tuz, Baharat, Sarımsak vb.)
  const stockMap = useMemo(() => {
    const m: Record<string, number> = {};
    stock.forEach(s => {
      const k = s.material_type.toLocaleLowerCase('tr-TR').trim();
      m[k] = (m[k] ?? 0) + Number(s.quantity);
    });
    return m;
  }, [stock]);

  // Seçilen hayvandan, bu parça adındaki toplam aktif kg
  // "Et" gibi soyut bir ad eşleşmiyorsa → seçili hayvanın TÜM parçalarının toplamı
  function getPartAvail(matName: string): number {
    if (!selAnimal) return 0;

    const matKey    = matName.toLocaleLowerCase('tr-TR');
    const animalKey = selAnimal.toLocaleLowerCase('tr-TR');

    // Önce birebir parça adı eşleşmesine bak (örn. "Bağırsak")
    const direct = availParts
      .filter(p =>
        p.animal_type.toLocaleLowerCase('tr-TR') === animalKey &&
        p.part_name.toLocaleLowerCase('tr-TR')   === matKey
      )
      .reduce((s, p) => s + Number(p.available_kg), 0);

    if (direct > 0) return direct;

    // Eşleşme yoksa (örn. "Et") → seçili hayvandaki tüm aktif parçaların toplamı
    return availParts
      .filter(p =>
        p.animal_type.toLocaleLowerCase('tr-TR') === animalKey &&
        Number(p.available_kg) > 0
      )
      .reduce((s, p) => s + Number(p.available_kg), 0);
  }

  // Birleşik stok: hem raw_materials hem parça lotlarını tek haritada göster
  function getUnifiedAvail(matName: string, source: 'part' | 'stock'): number {
    if (source === 'part') return getPartAvail(matName);

    const matKey = matName.toLocaleLowerCase('tr-TR').trim();

    // raw_materials'da doğrudan bu isimle kayıt var mı?
    let fromStock = stockMap[matKey] ?? 0;

    // "Bağırsak" ise hayvan türüne özgü adla da bak
    // (parçalamadan "İnek Bağırsağı" / "Koyun Bağırsağı" olarak kaydedilir)
    if (matKey === 'bağırsak') {
      const inekKey  = 'inek bağırsağı';
      const koyunKey = 'koyun bağırsağı';
      if (selAnimal) {
        const ak = selAnimal.toLocaleLowerCase('tr-TR');
        if (ak === 'inek' || ak === 'dana') {
          fromStock += stockMap[inekKey] ?? 0;
        } else if (ak === 'koyun' || ak === 'kuzu') {
          fromStock += stockMap[koyunKey] ?? 0;
        }
      } else {
        // Hayvan seçilmemişse her iki türü topla
        fromStock += (stockMap[inekKey] ?? 0) + (stockMap[koyunKey] ?? 0);
      }
    }

    // Aynı isimde aktif parça lotu da olabilir
    const fromParts = availParts
      .filter(p =>
        p.part_name.toLocaleLowerCase('tr-TR') === matKey &&
        Number(p.available_kg) > 0 &&
        (selAnimal ? p.animal_type.toLocaleLowerCase('tr-TR') === selAnimal.toLocaleLowerCase('tr-TR') : true)
      )
      .reduce((s, p) => s + Number(p.available_kg), 0);

    return fromStock + fromParts;
  }

  // Lot listesi (seçilen hayvan + parça adı)
  function getPartLots(partName: string): AvailablePart[] {
    if (!selAnimal) return [];
    return availParts.filter(
      p => p.animal_type.toLocaleLowerCase('tr-TR') === selAnimal.toLocaleLowerCase('tr-TR')
        && p.part_name.toLocaleLowerCase('tr-TR')   === partName.toLocaleLowerCase('tr-TR')
    );
  }

  // Girilen miktar (checked + kg set ise)
  function getEnteredKg(matName: string, source: 'part' | 'stock'): number {
    if (source === 'part') {
      const s = partSel[matName];
      return s?.checked ? (s.kg ?? 0) : 0;
    }
    return stockInputs[matName] ?? 0;
  }

  // ── Kaç birim üretim yapılabilir ─────────────────────────────────────────
  function calcMaxBatches(listing: ProducerListing): number | null {
    if (!selProduct || listing.product_name !== selProduct) return null;
    const mats    = parseMaterials(listing.required_materials);
    const matDefs = PRODUCT_MATERIALS[selProduct] ?? [];
    const active  = matDefs.filter(m => getEnteredKg(m.name, m.source) > 0);
    if (active.length === 0) return null;
    let min = Infinity;
    active.forEach(m => {
      const need = mats[m.name]?.amount;
      const have = getEnteredKg(m.name, m.source);
      if (need && need > 0) min = Math.min(min, have / need);
    });
    return isFinite(min) ? min : null;
  }

  // ── Filtre + sıralama ────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let r = listings;
    if (search) {
      const l = search.toLowerCase();
      r = r.filter(x => x.product_name.toLowerCase().includes(l) || x.producer_name.toLowerCase().includes(l));
    }
    if (selProduct) r = r.filter(x => x.product_name === selProduct);
    const hasAny = (PRODUCT_MATERIALS[selProduct ?? ''] ?? []).some(m => getEnteredKg(m.name, m.source) > 0);
    if (selProduct && hasAny) {
      r = [...r].sort((a, b) => (calcMaxBatches(b) ?? -1) - (calcMaxBatches(a) ?? -1));
    }
    return r;
  }, [listings, search, selProduct, partSel, stockInputs]);

  function parseMaterials(raw?: string): Record<string, { amount: number; unit: string }> {
    if (!raw) return {};
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return {}; }
  }

  // ── ML tahmin — part + stock inputları birleştir ─────────────────────────
  function openMl(listing: ProducerListing) {
    const mats    = parseMaterials(listing.required_materials);
    const matDefs = PRODUCT_MATERIALS[listing.product_name] ?? [];
    const inputs: Record<string, number> = {};
    Object.keys(mats).forEach(key => {
      const def  = matDefs.find(m => m.name === key);
      const have = def ? getEnteredKg(key, def.source) : 0;
      // Filtreden değer geldiyse kullan, yoksa ilan'daki birim miktarı kullan
      inputs[key] = have > 0 ? have : mats[key].amount;
    });
    setMlListing(listing);
    setMlInputs(inputs);
    setMlResult(null);
    setMlOpen(true);
  }

  async function runMlPredict() {
    if (!mlListing) return;
    setMlLoading(true);
    setMlResult(null);
    try {
      const { data } = await mlService.predictProduction({
        product_name:           mlListing.product_name,
        producer_id:            mlListing.producer_id,
        service_price_per_unit: Number(mlListing.service_price),
        materials:              mlInputs,
      });
      setMlResult(data);
    } catch {
      msg.error('Tahmin yapılamadı — ML servisi yanıt vermiyor');
    } finally {
      setMlLoading(false);
    }
  }

  // ── Sipariş ──────────────────────────────────────────────────────────────
  function openOrder(listing: ProducerListing) {
    const mats    = parseMaterials(listing.required_materials);
    const matDefs = PRODUCT_MATERIALS[listing.product_name] ?? [];
    const inputs: Record<string, number> = {};
    Object.keys(mats).forEach(key => {
      const def  = matDefs.find(m => m.name === key);
      const have = def ? getEnteredKg(key, def.source) : 0;
      inputs[key] = have > 0 ? have : 0;
    });
    setOrderListing(listing);
    setOrderInputs(inputs);
    setOrderNote('');
    setOrderOpen(true);
    setDetailOpen(false);
  }

  async function submitOrder() {
    if (!orderListing) return;
    const matDefs = PRODUCT_MATERIALS[orderListing.product_name] ?? [];

    // Toplam hammadde miktarı (Et bazlı — expected_qty)
    const etInput = orderInputs['Et'] ?? 0;
    const totalInput = Object.values(orderInputs).reduce((s, v) => s + (v || 0), 0);
    const expectedQty = etInput > 0 ? etInput * 0.85 : totalInput * 0.85;

    // rawMaterials: lot_id'si olan hammaddeler (parça lotları)
    const rawMaterials: { lot_id: number; material_type: string; quantity: number; unit: string; unit_price: number }[] = [];

    for (const [matName, qty] of Object.entries(orderInputs)) {
      if (!qty || qty <= 0) continue;
      const def = matDefs.find(m => m.name === matName);
      if (!def) continue;

      if (def.source === 'part') {
        // Parça lotundan gelen — partSel'den lot_id al
        const sel = partSel[matName];
        // Et için seçili herhangi bir parça lot'u yoksa tüm seçili parçaları ekle
        if (matName === 'Et') {
          // Seçili tüm parçaları ayrı kalemler olarak ekle
          Object.entries(partSel).forEach(([pName, pSel]) => {
            if (pSel?.checked && pSel.kg > 0 && pSel.lot_id) {
              rawMaterials.push({
                lot_id:        pSel.lot_id,
                material_type: pName,
                quantity:      pSel.kg,
                unit:          'kg',
                unit_price:    0,
              });
            }
          });
        } else if (sel?.lot_id) {
          rawMaterials.push({
            lot_id:        sel.lot_id,
            material_type: matName,
            quantity:      qty,
            unit:          def.unit,
            unit_price:    0,
          });
        }
      } else {
        // Stok hammaddesi — lot_id bul (raw_materials tablosundan)
        const stockItem = stock.find(s =>
          s.material_type.toLocaleLowerCase('tr-TR') === matName.toLocaleLowerCase('tr-TR')
        );
        if (stockItem?.lot_id) {
          rawMaterials.push({
            lot_id:        stockItem.lot_id,
            material_type: matName,
            quantity:      qty,
            unit:          def.unit,
            unit_price:    stockItem.unit_price ?? 0,
          });
        }
      }
    }

    setOrderSubmitting(true);
    try {
      await orderService.create({
        seller_id:    orderListing.producer_id,
        listing_id:   orderListing.id,
        expected_qty: Math.round(expectedQty * 100) / 100,
        notes:        orderNote || null,
        rawMaterials,
      });
      msg.success('Sipariş oluşturuldu! Sucukçunun onayı bekleniyor.');
      setOrderOpen(false);
    } catch {
      msg.error('Sipariş oluşturulamadı');
    } finally {
      setOrderSubmitting(false);
    }
  }

  // ── Filtre paneli hesapları ──────────────────────────────────────────────
  const filterMats  = PRODUCT_MATERIALS[selProduct ?? ''] ?? [];
  const partMats    = filterMats.filter(m => m.source === 'part');
  const stockMats   = filterMats.filter(m => m.source === 'stock');
  const hasAnyInput = filterMats.some(m => getEnteredKg(m.name, m.source) > 0);
  const allOk       = hasAnyInput && filterMats
    .filter(m => getEnteredKg(m.name, m.source) > 0)
    .every(m => getEnteredKg(m.name, m.source) <= getUnifiedAvail(m.name, m.source));

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>🌭 Sucukçu İlanları</Title>
        <Search placeholder="Ürün veya üretici ara..." allowClear style={{ width: 260 }}
          prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── Filtre Paneli ── */}
      <Card style={{ marginBottom: 20, borderRadius: 12, border: '1.5px solid #e8e8e8' }}
        styles={{ body: { padding: '16px 20px' } }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <FilterOutlined style={{ color: '#1890ff' }} />
          <Text strong>Üretim Planlama Filtresi</Text>
          {hasAnyInput && (
            <Tag color={allOk ? 'green' : 'orange'} style={{ marginLeft: 'auto' }}>
              {allOk
                ? <><CheckCircleOutlined /> Stok yeterli</>
                : <><WarningOutlined /> Bazı hammaddeler yetersiz</>}
            </Tag>
          )}
        </div>

        {/* Adım 1: Ürün seç */}
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          1. Ne üretmek istiyorsunuz?
        </Text>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(PRODUCT_META).map(([name, meta]) => {
            const active = selProduct === name;
            // Hayvan seçilmişse o hayvanda yapılamayan ürünleri devre dışı bırak
            const allowed = selAnimal
              ? (ANIMAL_PRODUCTS[selAnimal] ?? []).includes(name)
              : true;
            return (
              <Tooltip key={name} title={!allowed ? `${ANIMAL_META[selAnimal!]?.label} ile ${name} yapılamaz` : ''}>
                <div
                  onClick={() => allowed && onProductSelect(active ? null : name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', borderRadius: 20,
                    cursor: allowed ? 'pointer' : 'not-allowed',
                    border: `1.5px solid ${active ? meta.color : '#d9d9d9'}`,
                    background: active ? '#fafafa' : allowed ? '#fff' : '#f5f5f5',
                    fontWeight: active ? 700 : 400,
                    color: active ? meta.color : allowed ? '#595959' : '#bfbfbf',
                    transition: 'all 0.15s', userSelect: 'none',
                    opacity: allowed ? 1 : 0.45,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 13 }}>{name}</span>
                </div>
              </Tooltip>
            );
          })}
          {selProduct && (
            <Button size="small" type="text" onClick={() => onProductSelect(null)}
              style={{ color: '#999', alignSelf: 'center' }}>Temizle ✕</Button>
          )}
        </div>

        {/* Adım 2: Hayvan türü seç */}
        {selProduct && partMats.length > 0 && (
          <>
            <Divider style={{ margin: '0 0 12px' }} />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              2. Hangi hayvandan et / parça kullanacaksınız?
            </Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {Object.entries(ANIMAL_META)
                .filter(([key]) =>
                  // Seçili ürünle uyumsuz hayvanları listede gösterme
                  !selProduct || (ANIMAL_PRODUCTS[key] ?? []).includes(selProduct)
                )
                .map(([key, meta]) => {
                const active   = selAnimal === key;
                const hasStock = availParts.some(p =>
                  p.animal_type.toLocaleLowerCase('tr-TR') === key && Number(p.available_kg) > 0
                );
                const totalKg  = availParts
                  .filter(p => p.animal_type.toLocaleLowerCase('tr-TR') === key)
                  .reduce((s, p) => s + Number(p.available_kg), 0);
                return (
                  <Tooltip key={key} title={!hasStock ? 'Bu türde aktif parça lotu yok' : ''}>
                    <div onClick={() => hasStock && onAnimalSelect(active ? null : key)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 16px', borderRadius: 20,
                      cursor: hasStock ? 'pointer' : 'not-allowed',
                      border: `1.5px solid ${active ? '#1890ff' : '#d9d9d9'}`,
                      background: active ? '#e6f4ff' : hasStock ? '#fff' : '#f5f5f5',
                      fontWeight: active ? 700 : 400,
                      color: active ? '#1890ff' : hasStock ? '#595959' : '#bfbfbf',
                      transition: 'all 0.15s', userSelect: 'none',
                    }}>
                      <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                      <span style={{ fontSize: 13 }}>{meta.label}</span>
                      {hasStock && (
                        <Tag color="blue" style={{ fontSize: 10, marginLeft: 2 }}>
                          {totalKg.toFixed(0)} kg
                        </Tag>
                      )}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </>
        )}

        {/* Adım 3: Parça seçimi — seçilen hayvandaki TÜM aktif parçalar listelenir */}
        {selProduct && selAnimal && (
          <>
            <Divider style={{ margin: '0 0 12px' }} />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
              3. Gönderilecek parçaları seçin ve miktarlarını girin:
            </Text>

            {/* Adım 3: Sadece 'part' kaynaklı hammadde adlarıyla (yani Et) eşleşen parçalar */}
            {(() => {
              // Hangi parça adları 'stock' tanımlı → bunları Adım 3'ten kesinlikle çıkar
              // toLocaleLowerCase('tr-TR') ile Türkçe karakter güvenli karşılaştırma
              const stockMatNames = new Set(
                (PRODUCT_MATERIALS[selProduct] ?? [])
                  .filter(m => m.source === 'stock')
                  .map(m => m.name.toLocaleLowerCase('tr-TR'))
              );

              const partsOfAnimal = Array.from(new Set(
                availParts
                  .filter(p =>
                    p.animal_type.toLocaleLowerCase('tr-TR') === selAnimal.toLocaleLowerCase('tr-TR') &&
                    Number(p.available_kg) > 0 &&
                    !stockMatNames.has(p.part_name.toLocaleLowerCase('tr-TR'))
                  )
                  .map(p => p.part_name)
              ));

              if (partsOfAnimal.length === 0) {
                return (
                  <Alert type="warning" message="Bu hayvana ait aktif parça lotu bulunamadı." showIcon />
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {partsOfAnimal.map(partName => {
                    const lots    = getPartLots(partName);
                    const avail   = getPartAvail(partName);
                    const sel     = partSel[partName];
                    const checked = sel?.checked ?? false;
                    const kg      = sel?.kg ?? 0;
                    const ok      = !checked || kg <= avail;

                    return (
                      <div key={partName} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', background: checked ? '#f6ffed' : '#fafafa',
                        borderRadius: 10,
                        border: `1.5px solid ${checked && !ok ? '#ffbb96' : checked ? '#b7eb8f' : '#f0f0f0'}`,
                        transition: 'all 0.15s',
                      }}>
                        {/* Checkbox */}
                        <Checkbox
                          checked={checked}
                          onChange={e => {
                            const defaultLot = lots[0];
                            setPartSel(prev => ({
                              ...prev,
                              [partName]: {
                                lot_id:  prev[partName]?.lot_id ?? defaultLot?.lot_id ?? 0,
                                kg:      prev[partName]?.kg ?? Math.min(avail, 10),
                                checked: e.target.checked,
                              },
                            }));
                          }}
                        />

                        {/* Parça adı + stok */}
                        <div style={{ minWidth: 130 }}>
                          <Text style={{ fontWeight: checked ? 600 : 400 }}>{partName}</Text>
                          <div style={{ fontSize: 11, color: '#888' }}>
                            Depoda: {avail.toFixed(2)} kg
                          </div>
                        </div>

                        {/* Lot seçimi (birden fazla lotsa) */}
                        {checked && lots.length > 1 && (
                          <Select
                            size="small"
                            style={{ width: 200 }}
                            value={sel?.lot_id}
                            placeholder="Lot seç"
                            onChange={lotId => {
                              setPartSel(prev => ({
                                ...prev,
                                [partName]: { ...prev[partName]!, lot_id: lotId },
                              }));
                            }}
                            options={lots.map(l => ({
                              value: l.lot_id,
                              label: `${l.lot_number} — ${Number(l.available_kg).toFixed(1)} kg`,
                            }))}
                          />
                        )}
                        {checked && lots.length === 1 && (
                          <Text style={{ fontSize: 11, color: '#888', minWidth: 120 }}>
                            {lots[0].lot_number}
                          </Text>
                        )}

                        {/* Miktar girişi */}
                        {checked && (
                          <InputNumber
                            size="small"
                            min={0} max={avail} step={0.1} precision={2}
                            value={kg || null}
                            onChange={v => {
                              setPartSel(prev => ({
                                ...prev,
                                [partName]: { ...prev[partName]!, kg: v ?? 0 },
                              }));
                            }}
                            addonAfter="kg"
                            style={{ width: 140 }}
                          />
                        )}

                        {/* Stok durumu */}
                        {checked && (
                          ok
                            ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                            : <Tooltip title={`${(kg - avail).toFixed(2)} kg eksik`}>
                                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                              </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {/* Adım 4: Diğer hammaddeler (stock) */}
        {selProduct && stockMats.length > 0 && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
              {partMats.length > 0 ? '4.' : '2.'} Diğer hammaddelerden ne kadar kullanacaksınız?
            </Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {stockMats.map(mat => {
                const entered = stockInputs[mat.name] ?? 0;
                const avail   = stockMap[mat.name.toLowerCase().trim()] ?? 0;
                const ok      = entered <= avail;
                return (
                  <div key={mat.name} style={{
                    padding: '10px 12px', background: '#fafafa', borderRadius: 10,
                    border: `1px solid ${entered > 0 && !ok ? '#ffbb96' : '#f0f0f0'}`,
                    minWidth: 160,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: 600 }}>{mat.name}</Text>
                      {entered > 0 && (ok
                        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      )}
                    </div>
                    <InputNumber size="small" min={0} step={0.1} precision={2} placeholder="0.00"
                      value={stockInputs[mat.name] ?? null}
                      onChange={v => setStockInputs(prev => ({ ...prev, [mat.name]: v ?? 0 }))}
                      addonAfter={mat.unit} style={{ width: '100%' }} />
                    <Text style={{
                      fontSize: 11, marginTop: 4, display: 'block',
                      color: !stockLoading && entered > 0 ? (ok ? '#52c41a' : '#ff4d4f') : '#8c8c8c',
                    }}>
                      Depoda: {stockLoading ? '…' : `${avail.toFixed(2)} ${mat.unit}`}
                      {entered > 0 && !ok && ` (${(entered - avail).toFixed(2)} eksik)`}
                    </Text>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* ── İlan Listesi ── */}
      {displayed.length === 0 ? (
        <Empty description={selProduct ? `${selProduct} için aktif ilan bulunamadı` : 'Henüz ilan yok'} />
      ) : (
        <Row gutter={[16, 16]}>
          {displayed.map(listing => {
            const meta    = PRODUCT_META[listing.product_name] ?? { emoji: '📦', color: '#1890ff' };
            const mats    = parseMaterials(listing.required_materials);
            const matKeys = Object.keys(mats);
            const batches = calcMaxBatches(listing);
            const matDefs = PRODUCT_MATERIALS[listing.product_name] ?? [];

            return (
              <Col key={listing.id} xs={24} sm={12} lg={8}>
                <Card hoverable style={{ borderRadius: 12, height: '100%', position: 'relative' }}
                  styles={{ body: { padding: '16px 20px' } }}
                  onClick={() => openOrder(listing)}>

                  {batches !== null && batches > 0 && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: allOk ? '#52c41a' : '#faad14',
                      color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                    }}>
                      ≈ {batches.toFixed(1)} birim
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      fontSize: 28, width: 52, height: 52, background: '#f5f5f5',
                      borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{meta.emoji}</div>
                    <div>
                      <Text strong style={{ fontSize: 16 }}>{listing.product_name}</Text><br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{listing.producer_name}</Text>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <Tag color={meta.color} style={{ fontSize: 13, padding: '2px 10px' }}>
                        {Number(listing.service_price).toFixed(2)} € / {listing.service_unit}
                      </Tag>
                    </div>
                  </div>

                  {listing.description && (
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                      {listing.description}
                    </Text>
                  )}

                  {matKeys.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
                        Birim başına gereken:
                      </Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {matKeys.map(key => {
                          const need  = mats[key].amount;
                          const def   = matDefs.find(m => m.name === key);
                          const have  = def ? getEnteredKg(key, def.source) : 0;
                          const maxB  = have > 0 && need > 0 ? Math.floor(have / need) : null;
                          const color = maxB === null ? 'default' : maxB > 0 ? 'green' : 'red';
                          return (
                            <Tag key={key} color={color} style={{ fontSize: 11 }}>
                              {key}: {need} {mats[key].unit}{maxB !== null && ` · ${maxB}×`}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0',
                  }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {listing.min_order_qty ? `Min: ${listing.min_order_qty} ${listing.service_unit}` : 'Min. sipariş yok'}
                    </Text>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Tooltip title="AI Üretim Tahmini">
                        <Button size="small" icon={<RobotOutlined />}
                          style={{ color: '#722ed1', borderColor: '#722ed1' }}
                          onClick={e => { e.stopPropagation(); openMl(listing); }}>Tahmin</Button>
                      </Tooltip>
                      <Button size="small" icon={<InfoCircleOutlined />}
                        onClick={e => { e.stopPropagation(); setSelListing(listing); setDetailOpen(true); }}>
                        Detay
                      </Button>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* ── Detay Modalı ── */}
      <Modal open={detailOpen} onCancel={() => setDetailOpen(false)}
        footer={null}
        width={520}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{selListing ? (PRODUCT_META[selListing.product_name]?.emoji ?? '📦') : ''}</span>
            <span>{selListing?.product_name} — İlan Detayı</span>
          </div>
        }
      >
        {selListing && (() => {
          const mats    = parseMaterials(selListing.required_materials);
          const keys    = Object.keys(mats);
          const matDefs = PRODUCT_MATERIALS[selListing.product_name] ?? [];
          return (
            <div>
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Üretici" span={2}><Text strong>{selListing.producer_name}</Text></Descriptions.Item>
                {selListing.phone && <Descriptions.Item label={<><PhoneOutlined /> Telefon</>} span={2}>{selListing.phone}</Descriptions.Item>}
                {selListing.address && <Descriptions.Item label={<><EnvironmentOutlined /> Adres</>} span={2}>{selListing.address}</Descriptions.Item>}
                <Descriptions.Item label="Hizmet Fiyatı">
                  <Text strong style={{ color: '#f50' }}>{Number(selListing.service_price).toFixed(2)} € / {selListing.service_unit}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Min. Sipariş">
                  {selListing.min_order_qty ? `${selListing.min_order_qty} ${selListing.service_unit}` : '—'}
                </Descriptions.Item>
              </Descriptions>
              {selListing.description && (
                <div style={{ marginBottom: 16, padding: '10px 12px', background: '#f9f9f9', borderRadius: 8 }}>
                  <Text type="secondary">{selListing.description}</Text>
                </div>
              )}
              {keys.length > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }}>Birim Başına Gereken Hammaddeler</Divider>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {keys.map(key => {
                      const def   = matDefs.find(m => m.name === key);
                      const have  = def ? getEnteredKg(key, def.source) : 0;
                      const avail = def ? getUnifiedAvail(key, def.source) : 0;
                      return (
                        <div key={key} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 12px', background: '#fafafa', borderRadius: 6,
                          border: `1px solid ${have > 0 && have > avail ? '#ffbb96' : '#f0f0f0'}`,
                        }}>
                          <Text>{key}</Text>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Tag color="blue">{mats[key].amount} {mats[key].unit}</Tag>
                            {have > 0 && !stockLoading && (
                              <Tag color={have <= avail ? 'green' : 'red'} style={{ fontSize: 11 }}>
                                Depoda: {avail.toFixed(1)} {mats[key].unit}
                              </Tag>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div style={{ marginTop: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  💡 Sipariş verdiğinizde bu hammaddeleri sucukçuya göndermeniz gerekecektir.
                </Text>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Sipariş Modalı ── */}
      <Modal
        open={orderOpen}
        onCancel={() => setOrderOpen(false)}
        footer={null}
        width={600}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCartOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            <span>{orderListing?.product_name} — Sipariş Ver</span>
            <Tag color="blue" style={{ marginLeft: 4 }}>{orderListing?.producer_name}</Tag>
          </div>
        }
      >
        {orderListing && (() => {
          const mats    = parseMaterials(orderListing.required_materials);
          const matDefs = PRODUCT_MATERIALS[orderListing.product_name] ?? [];
          const totalEt = orderInputs['Et'] ?? 0;
          const expectedQty = totalEt > 0 ? totalEt * 0.85 : 0;

          return (
            <div>
              {/* Üretici bilgileri */}
              <div style={{
                background: '#f0f5ff', borderRadius: 10, padding: '12px 16px',
                marginBottom: 16, border: '1px solid #adc6ff',
              }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Üretici</Text>
                    <div style={{ fontWeight: 700 }}>{orderListing.producer_name}</div>
                  </div>
                  {orderListing.phone && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Telefon</Text>
                      <div><PhoneOutlined style={{ marginRight: 4 }} />{orderListing.phone}</div>
                    </div>
                  )}
                  {orderListing.address && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Adres</Text>
                      <div><EnvironmentOutlined style={{ marginRight: 4 }} />{orderListing.address}</div>
                    </div>
                  )}
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Hizmet Fiyatı</Text>
                    <div style={{ color: '#f50', fontWeight: 700 }}>
                      {Number(orderListing.service_price).toFixed(2)} € / {orderListing.service_unit}
                    </div>
                  </div>
                  {orderListing.min_order_qty && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Min. Sipariş</Text>
                      <div>{orderListing.min_order_qty} {orderListing.service_unit}</div>
                    </div>
                  )}
                </div>
              </div>

              <Divider style={{ margin: '0 0 14px' }}>Göndereceğiniz Hammaddeler</Divider>

              {/* Hammadde miktarları */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {Object.keys(mats).map(key => {
                  const def   = matDefs.find(m => m.name === key);
                  const avail = def ? getUnifiedAvail(key, def.source) : 0;
                  const qty   = orderInputs[key] ?? 0;
                  const ok    = qty <= avail;
                  const need  = mats[key].amount;

                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#fafafa', borderRadius: 8,
                      border: `1px solid ${qty > 0 && !ok ? '#ffbb96' : '#f0f0f0'}`,
                    }}>
                      <div style={{ minWidth: 160 }}>
                        <Text style={{ fontWeight: 500 }}>{key}</Text>
                        <div style={{ fontSize: 11, color: '#888' }}>
                          Birim başına: {need} {mats[key].unit} · Depoda: {avail.toFixed(2)} {mats[key].unit}
                        </div>
                        {qty > 0 && !ok && (
                          <div style={{ fontSize: 11, color: '#ff4d4f' }}>
                            ⚠ Stok yetersiz ({(qty - avail).toFixed(2)} {mats[key].unit} eksik)
                          </div>
                        )}
                      </div>
                      <InputNumber
                        min={0} step={0.1} precision={2}
                        value={orderInputs[key] ?? null}
                        onChange={v => setOrderInputs(prev => ({ ...prev, [key]: v ?? 0 }))}
                        addonAfter={mats[key].unit}
                        style={{ width: 160 }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Beklenen çıktı tahmini */}
              {expectedQty > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#f6ffed', borderRadius: 8,
                  border: '1px solid #b7eb8f', marginBottom: 16,
                }}>
                  <Text type="secondary">Tahmini mamul çıktı (%85 verim)</Text>
                  <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                    ≈ {expectedQty.toFixed(1)} kg
                  </Text>
                </div>
              )}

              {/* Not */}
              <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Not (opsiyonel)</Text>
                <Input.TextArea
                  rows={2}
                  placeholder="Sucukçuya iletmek istediğiniz not..."
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                />
              </div>

              <Alert
                type="warning" showIcon style={{ marginBottom: 16, fontSize: 12 }}
                message="Sipariş sucukçu tarafından onaylandığında hammaddeler stoğunuzdan otomatik düşülecektir."
              />

              <Button
                type="primary" block size="large" icon={<ShoppingCartOutlined />}
                loading={orderSubmitting}
                disabled={Object.values(orderInputs).every(v => !v || v <= 0)}
                onClick={submitOrder}
                style={{ borderRadius: 8 }}
              >
                Siparişi Gönder
              </Button>
            </div>
          );
        })()}
      </Modal>

      {/* ── ML Tahmin Modalı ── */}
      <Modal open={mlOpen} onCancel={() => { setMlOpen(false); setMlResult(null); }}
        footer={null} width={560} centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined style={{ color: '#722ed1', fontSize: 20 }} />
            <span>{mlListing?.product_name} — AI Üretim Tahmini</span>
            <Tag color="purple" style={{ marginLeft: 4 }}>{mlListing?.producer_name}</Tag>
          </div>
        }
      >
        {mlListing && (() => {
          const mats    = parseMaterials(mlListing.required_materials);
          const keys    = Object.keys(mats);
          const matDefs = PRODUCT_MATERIALS[mlListing.product_name] ?? [];
          const total   = Object.values(mlInputs).reduce((s, v) => s + (v || 0), 0);
          return (
            <div>
              <Alert type="info" showIcon icon={<ExperimentOutlined />} style={{ marginBottom: 16, fontSize: 12 }}
                message="Hammadde miktarlarını kontrol edin — bu üreticinin geçmiş verisiyle tahmin yapılır." />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {keys.map(key => {
                  const def   = matDefs.find(m => m.name === key);
                  const avail = def ? getUnifiedAvail(key, def.source) : 0;
                  const entr  = mlInputs[key] ?? 0;
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#fafafa', borderRadius: 8,
                      border: `1px solid ${entr > 0 && entr > avail ? '#ffbb96' : '#f0f0f0'}`,
                    }}>
                      <div style={{ minWidth: 140 }}>
                        <Text>{key}</Text>
                        {entr > 0 && !stockLoading && (
                          <div style={{ fontSize: 11, color: entr <= avail ? '#52c41a' : '#ff4d4f' }}>
                            Depoda: {avail.toFixed(2)} {mats[key].unit}
                          </div>
                        )}
                      </div>
                      <InputNumber min={0} step={0.1} precision={2}
                        value={mlInputs[key] ?? null}
                        onChange={v => setMlInputs(prev => ({ ...prev, [key]: v ?? 0 }))}
                        addonAfter={mats[key].unit} style={{ width: 160 }} />
                    </div>
                  );
                })}
              </div>

              {total > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 14px', background: '#f0f5ff', borderRadius: 8,
                  border: '1px solid #adc6ff', marginBottom: 16,
                }}>
                  <Text type="secondary">Toplam hammadde</Text>
                  <Text strong>{total.toFixed(2)} kg</Text>
                </div>
              )}

              <Button type="primary" block size="large" icon={<ThunderboltOutlined />}
                loading={mlLoading} disabled={total <= 0} onClick={runMlPredict}
                style={{ borderRadius: 8, marginBottom: 16, background: '#722ed1', borderColor: '#722ed1' }}>
                Tahmin Yap
              </Button>

              {mlResult && (
                <div style={{ border: '1.5px solid #d9f7be', borderRadius: 10, padding: '16px 18px', background: '#f6ffed' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 14 }}>Tahmin Sonucu</Text>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Tag color="purple">{methodLabel(mlResult.method)}</Tag>
                      {mlResult.sample_count > 0 && <Tag color="blue">{mlResult.sample_count} kayıt</Tag>}
                    </div>
                  </div>
                  <Row gutter={12} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <div style={{ textAlign: 'center', padding: '12px 8px', background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: '#52c41a' }}>
                          {(total * mlResult.predicted_qty_ratio).toFixed(1)} kg
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Beklenen mamul çıktı</div>
                        <Tag style={{ marginTop: 4 }} color="green">Verim %{(mlResult.predicted_qty_ratio * 100).toFixed(1)}</Tag>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ textAlign: 'center', padding: '12px 8px', background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: '#f50' }}>
                          {mlResult.predicted_ekp.toFixed(2)} €
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Tahmini EKP / kg</div>
                        <Tag style={{ marginTop: 4 }} color="orange">
                          Toplam: {(total * mlResult.predicted_qty_ratio * mlResult.predicted_ekp).toFixed(2)} €
                        </Tag>
                      </div>
                    </Col>
                  </Row>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>Model Güveni</Text>
                      <Text style={{ fontSize: 12, color: confidenceColor(mlResult.confidence) }}>
                        %{(mlResult.confidence * 100).toFixed(0)}
                      </Text>
                    </div>
                    <Progress percent={Math.round(mlResult.confidence * 100)}
                      strokeColor={confidenceColor(mlResult.confidence)} showInfo={false} size="small" />
                  </div>
                  <Alert type="warning" message={mlResult.notes} style={{ fontSize: 11, marginTop: 4 }} />
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
