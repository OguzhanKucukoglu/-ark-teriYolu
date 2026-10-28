import { useEffect, useState, useMemo } from 'react';
import {
  Card, Button, Modal, Typography, Tag, App,
  Row, Col, Input, Empty, Descriptions, Divider,
  InputNumber, Alert, Progress, Tooltip, Checkbox, Space,
} from 'antd';
import {
  SearchOutlined, PhoneOutlined, EnvironmentOutlined,
  ShoppingCartOutlined, InfoCircleOutlined, ExperimentOutlined,
  RobotOutlined, FilterOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  ThunderboltOutlined, ClearOutlined,
} from '@ant-design/icons';
import { listingService, mlService, rawMaterialService, butcheryService, orderService } from '../../services/api';
import { formatMoney } from '../../utils/currency';
import { useTranslation } from '../../i18n';

const { Title, Text } = Typography;
const { Search } = Input;

// ── Sabitler ──────────────────────────────────────────────────────────────────
const PRODUCT_META: Record<string, { emoji: string; color: string }> = {
  'Sucuk':    { emoji: '🌭', color: '#f50' },
  'Salam':    { emoji: '🥩', color: '#eb2f96' },
  'Sosis':    { emoji: '🍖', color: '#fa8c16' },
  'Pastırma': { emoji: '🥓', color: '#722ed1' },
};

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
  'inek':  { emoji: '🐄', label: 'İnek / Dana' },
  'koyun': { emoji: '🐑', label: 'Koyun / Kuzu' },
  'tavuk': { emoji: '🐔', label: 'Tavuk' },
};

// Hangi hayvandan hangi ürün yapılabilir
const ANIMAL_PRODUCTS: Record<string, string[]> = {
  'inek':  ['Sucuk', 'Salam', 'Sosis', 'Pastırma'],
  'koyun': ['Sucuk', 'Salam', 'Sosis'],
  'tavuk': ['Sucuk', 'Salam', 'Sosis'],
};

// ── Parça Uyum Kontrolü (Öneri B) ──────────────────────────────────────────────
interface PartSuitability {
  status: 'recommended' | 'warning' | 'unsuitable' | 'neutral';
  badge: string;
  tagColor: string;
  description: string;
}

const PRODUCT_SUITABLE_PARTS: Record<string, {
  recommended: string[];
  unsuitable: string[];
  unsuitableReason: string;
  luxuryWarn?: string[];
}> = {
  'Pastırma': {
    recommended: ['antrikot', 'kontrifile', 'kontrfile', 'sokum', 'nuat', 'tranç', 'bonfile'],
    unsuitable: ['kaburga', 'gerdan', 'kol', 'but', 'incik', 'bağırsak', 'bütün tavuk', 'pirzola'],
    unsuitableReason: 'Pastırma için uygun değildir. Pastırma sadece blok bifteklik etlerle (Antrikot, Kontrfile, Sokum, Nuat) üretilebilir.',
  },
  'Sucuk': {
    recommended: ['kaburga', 'gerdan', 'kol', 'but', 'incik', 'kuşbaşı', 'kıyma', 'döş'],
    unsuitable: ['bağırsak', 'bütün tavuk'],
    unsuitableReason: 'Kırmızı et sucuğu için ana et olarak uygun değildir.',
    luxuryWarn: ['antrikot', 'kontrifile', 'kontrfile', 'bonfile'],
  },
  'Salam': {
    recommended: ['gerdan', 'kol', 'but', 'kaburga', 'incik', 'bütün tavuk'],
    unsuitable: ['bağırsak'],
    unsuitableReason: 'Ana et parçası olarak kullanılamaz.',
  },
  'Sosis': {
    recommended: ['gerdan', 'kol', 'but', 'kaburga', 'incik', 'bütün tavuk'],
    unsuitable: ['bağırsak'],
    unsuitableReason: 'Ana et parçası olarak kullanılamaz.',
  },
};

function getPartSuitability(productName: string, partName: string): PartSuitability {
  const norm = partName.toLowerCase().trim();
  const rule = PRODUCT_SUITABLE_PARTS[productName];
  if (!rule) return { status: 'neutral', badge: 'Normal', tagColor: 'default', description: 'Kullanılabilir' };

  if (rule.unsuitable.some(u => norm.includes(u))) {
    return {
      status: 'unsuitable',
      badge: '❌ Uyumsuz',
      tagColor: 'error',
      description: rule.unsuitableReason,
    };
  }

  if (rule.luxuryWarn && rule.luxuryWarn.some(l => norm.includes(l))) {
    return {
      status: 'warning',
      badge: '⚠️ Lüks Parça',
      tagColor: 'warning',
      description: 'Bifteklik değerli et. Kıyma/harç yerine pastırma veya taze satış için önerilir.',
    };
  }

  if (rule.recommended.some(r => norm.includes(r))) {
    return {
      status: 'recommended',
      badge: '✅ İdeal Parça',
      tagColor: 'success',
      description: `${productName} üretimi için ideal ve tavsiye edilen et parçasıdır.`,
    };
  }

  return { status: 'neutral', badge: 'Kullanılabilir', tagColor: 'blue', description: 'Standart et parçası.' };
}

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
  currency?: string;
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
  predicted_packages?: number;
  package_weight?: number;
  total_input_kg?: number;
  predicted_fire_kg?: number;
  predicted_fire_rate?: number;
  predicted_qty_ratio: number;
  predicted_ekp: number;
  confidence: number;
  sample_count: number;
  method: string;
  notes: string;
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

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function ProducerListingsPage() {
  const { t } = useTranslation();
  const { message: msg } = App.useApp();

  const [listings, setListings]         = useState<ProducerListing[]>([]);
  const [loading, setLoading]           = useState(true);
  const [stock, setStock]               = useState<RawMaterial[]>([]);
  const [availParts, setAvailParts]     = useState<AvailablePart[]>([]);
  const [stockLoading, setStockLoading] = useState(true);

  // ── Sadece Arama & Filtre State (Siparişten tamamen bağımsız) ──
  const [search, setSearch]             = useState('');
  const [selProduct, setSelProduct]     = useState<string | null>(null);
  const [selAnimal, setSelAnimal]       = useState<string | null>(null);

  // ── Detay Modalı State ──
  const [detailOpen, setDetailOpen]     = useState(false);
  const [selListing, setSelListing]     = useState<ProducerListing | null>(null);

  // ── ML Tahmin Modalı State ──
  const [mlOpen, setMlOpen]             = useState(false);
  const [mlListing, setMlListing]       = useState<ProducerListing | null>(null);
  const [mlInputs, setMlInputs]         = useState<Record<string, number>>({});
  const [mlResult, setMlResult]         = useState<MLResult | null>(null);
  const [mlLoading, setMlLoading]       = useState(false);

  // ── Sipariş Modalı State (Parça seçimi, hammadde girişi ve sipariş burada) ──
  const [orderOpen, setOrderOpen]             = useState(false);
  const [orderListing, setOrderListing]       = useState<ProducerListing | null>(null);
  // Parça ID -> seçilen kg
  const [orderPartKgs, setOrderPartKgs]       = useState<Record<number, number>>({});
  // Depo hammaddesi adı -> seçilen kg (Tuz, Sarımsak, Baharat vb.)
  const [orderStockInputs, setOrderStockInputs] = useState<Record<string, number>>({});
  const [orderNote, setOrderNote]             = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderAnimalFilter, setOrderAnimalFilter] = useState<string | null>(null);

  // ── Verileri Yükle ──────────────────────────────────────────────────────────
  useEffect(() => {
    listingService.getProducerListings()
      .then(r => setListings(r.data))
      .catch(() => msg.error('İlanlar yüklenemedi'))
      .finally(() => setLoading(false));

    Promise.all([rawMaterialService.getAll(), butcheryService.getAvailableParts()])
      .then(([rm, ap]) => { setStock(rm.data); setAvailParts(ap.data); })
      .finally(() => setStockLoading(false));
  }, []);

  // ── Stok Haritaları ─────────────────────────────────────────────────────────
  const stockMap = useMemo(() => {
    const m: Record<string, number> = {};
    stock.forEach(s => {
      const k = s.material_type.toLocaleLowerCase('tr-TR').trim();
      m[k] = (m[k] ?? 0) + Number(s.quantity);
    });
    return m;
  }, [stock]);

  // Depodaki toplam aktif et miktarı (tüm aktif parçalar)
  const totalAvailMeatKg = useMemo(() => {
    return availParts.reduce((s, p) => s + Number(p.available_kg || 0), 0);
  }, [availParts]);

  // Belirli bir hammadde için toplam stok (parça veya raw_materials)
  function getUnifiedAvail(matName: string, _source?: 'part' | 'stock'): number {
    const matKey = matName.toLocaleLowerCase('tr-TR').trim();

    if (matKey === 'et') {
      return totalAvailMeatKg > 0 ? totalAvailMeatKg : (stockMap['et'] ?? 0);
    }

    let fromStock = stockMap[matKey] ?? 0;
    if (matKey === 'bağırsak') {
      fromStock += (stockMap['inek bağırsağı'] ?? 0) + (stockMap['koyun bağırsağı'] ?? 0);
      const partCasing = availParts
        .filter(p => p.part_name.toLocaleLowerCase('tr-TR').includes('bağırsak'))
        .reduce((s, p) => s + Number(p.available_kg), 0);
      fromStock += partCasing;
    }

    return fromStock;
  }

  function parseMaterials(raw?: string): Record<string, { amount: number; unit: string }> {
    if (!raw) return {};
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return {}; }
  }

  // ── Mevcut Stokla Kaç Birim / Paket Üretilebilir? ─────────────────────────
  function calcMaxBatches(listing: ProducerListing): number | null {
    const mats = parseMaterials(listing.required_materials);
    const keys = Object.keys(mats);
    if (keys.length === 0) return null;

    let minBatches = Infinity;
    for (const key of keys) {
      const need = mats[key].amount;
      if (!need || need <= 0) continue;
      const def = (PRODUCT_MATERIALS[listing.product_name] ?? []).find(m => m.name === key);
      const avail = getUnifiedAvail(key, def?.source);
      const batches = avail / need;
      if (batches < minBatches) {
        minBatches = batches;
      }
    }
    return isFinite(minBatches) && minBatches >= 0 ? minBatches : null;
  }

  // ── Filtrelenen İlanlar (Sadece İlan Listesini Etkiler) ──────────────────────
  const displayed = useMemo(() => {
    let r = listings;
    if (search) {
      const l = search.toLowerCase();
      r = r.filter(x =>
        x.product_name.toLowerCase().includes(l) ||
        x.producer_name.toLowerCase().includes(l) ||
        (x.description && x.description.toLowerCase().includes(l))
      );
    }
    if (selProduct) {
      r = r.filter(x => x.product_name === selProduct);
    }
    if (selAnimal) {
      const allowedProducts = ANIMAL_PRODUCTS[selAnimal] ?? [];
      r = r.filter(x => allowedProducts.includes(x.product_name));
    }
    return r;
  }, [listings, search, selProduct, selAnimal]);

  // ── Sipariş Modalı Açılış ───────────────────────────────────────────────────
  function openOrder(listing: ProducerListing) {
    setOrderListing(listing);
    setOrderNote('');
    setOrderAnimalFilter(null);

    // Başlangıçta parçaları boşalt
    setOrderPartKgs({});

    // Diğer hammaddeler için varsayılan 0
    const mats = parseMaterials(listing.required_materials);
    const initialStockInputs: Record<string, number> = {};
    Object.keys(mats).forEach(k => {
      if (k.toLowerCase() !== 'et') {
        initialStockInputs[k] = 0;
      }
    });
    setOrderStockInputs(initialStockInputs);

    setOrderOpen(true);
    setDetailOpen(false);
  }

  // Sipariş Modalındaki Seçili Toplam Et
  const orderSelectedMeatKg = useMemo(() => {
    return Object.values(orderPartKgs).reduce((s, v) => s + (v || 0), 0);
  }, [orderPartKgs]);

  // Reçeteye göre diğer hammaddeleri otomatik doldurma
  function autoFillStockInputs() {
    if (!orderListing || orderSelectedMeatKg <= 0) return;
    const mats = parseMaterials(orderListing.required_materials);
    const etUnit = mats['Et']?.amount || 1.0;
    const factor = orderSelectedMeatKg / etUnit;

    const newInputs: Record<string, number> = {};
    Object.entries(mats).forEach(([key, val]) => {
      if (key.toLowerCase() !== 'et') {
        const calculated = parseFloat((val.amount * factor).toFixed(2));
        newInputs[key] = calculated;
      }
    });
    setOrderStockInputs(newInputs);
    msg.success('Reçete oranlarına göre diğer hammaddeler otomatik hesaplandı!');
  }

  // Sipariş Gönder (Gerçek parça adları ve lot_id'leri ile iletilir)
  async function submitOrder() {
    if (!orderListing) return;

    if (orderSelectedMeatKg <= 0) {
      msg.warning('Lütfen en az bir et parçasından miktar giriniz.');
      return;
    }

    // Pastırma için uygunsuz parça kontrolü
    if (orderListing.product_name === 'Pastırma') {
      const hasUnsuitable = Object.entries(orderPartKgs).some(([partIdStr, kg]) => {
        if (!kg || kg <= 0) return false;
        const part = availParts.find(p => p.part_id === Number(partIdStr));
        if (!part) return false;
        const suit = getPartSuitability('Pastırma', part.part_name);
        return suit.status === 'unsuitable';
      });

      if (hasUnsuitable) {
        msg.error('Pastırma siparişinde kaburga/gerdan/bağırsak gibi kıymalık parçalar kullanılamaz! Lütfen Antrikot, Kontrfile veya Sokum seçiniz.');
        return;
      }
    }

    // 1 kg standart paket hesabı
    const expectedPackages = Math.max(1, Math.round((orderSelectedMeatKg * 0.85) / 1.0));

    // rawMaterials dizisi: gerçek parça adları ve lot ID'leri ile oluşturulur
    const rawMaterials: { lot_id: number; material_type: string; quantity: number; unit: string; unit_price: number }[] = [];

    // 1. Seçilen et parçalarını ekle
    Object.entries(orderPartKgs).forEach(([partIdStr, kg]) => {
      if (kg && kg > 0) {
        const part = availParts.find(p => p.part_id === Number(partIdStr));
        if (part) {
          rawMaterials.push({
            lot_id:        part.lot_id,
            material_type: `${part.animal_type} - ${part.part_name}`,
            quantity:      kg,
            unit:          'kg',
            unit_price:    0,
          });
        }
      }
    });

    // 2. Diğer reçete malzemelerini ekle (Tuz, Sarımsak, Baharat, Bağırsak)
    Object.entries(orderStockInputs).forEach(([matName, qty]) => {
      if (qty && qty > 0) {
        const matDef = (PRODUCT_MATERIALS[orderListing.product_name] ?? []).find(m => m.name === matName);
        const stockItem = stock.find(s =>
          s.material_type.toLocaleLowerCase('tr-TR') === matName.toLocaleLowerCase('tr-TR') ||
          (matName.toLowerCase() === 'bağırsak' && s.material_type.toLowerCase().includes('bağırsak'))
        );

        rawMaterials.push({
          lot_id:        stockItem?.lot_id ?? 0,
          material_type: stockItem?.material_type ?? matName,
          quantity:      qty,
          unit:          matDef?.unit ?? 'kg',
          unit_price:    stockItem?.unit_price ?? 0,
        });
      }
    });

    setOrderSubmitting(true);
    try {
      await orderService.create({
        seller_id:    orderListing.producer_id,
        listing_id:   orderListing.id,
        expected_qty: expectedPackages,
        notes:        orderNote || null,
        rawMaterials,
      });

      msg.success(`Sipariş oluşturuldu! Seçilen ${rawMaterials.length} hammadde kalemi üreticiye iletildi.`);
      setOrderOpen(false);
    } catch (err: unknown) {
      const errDetail = (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
      const errMsg = errDetail?.detail || errDetail?.error || 'Sipariş oluşturulamadı. Lütfen tekrar deneyiniz.';
      msg.error(errMsg);
    } finally {
      setOrderSubmitting(false);
    }
  }

  // ── ML Tahmin Modalı ────────────────────────────────────────────────────────
  function openMl(listing: ProducerListing) {
    const mats = parseMaterials(listing.required_materials);
    const inputs: Record<string, number> = {};
    Object.keys(mats).forEach(key => {
      inputs[key] = mats[key].amount || 1.0;
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

  // Filtre aktif mi kontrolü
  const hasActiveFilters = Boolean(search || selProduct || selAnimal);

  return (
    <div>
      {/* ── Başlık & Arama ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>🌭 {t('producerListings.title')}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('producerListings.subtitle')}
          </Text>
        </div>
        <Search
          placeholder={t('common.search')}
          allowClear
          style={{ width: 280 }}
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── SADELEŞTİRİLMİŞ İLAN FİLTRESİ (Sadece Filtreleme Yapar) ── */}
      <Card
        style={{ marginBottom: 20, borderRadius: 12, border: '1.5px solid #e8e8e8', background: '#fafafa' }}
        styles={{ body: { padding: '14px 20px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Space>
            <FilterOutlined style={{ color: '#1890ff', fontSize: 16 }} />
            <Text strong style={{ fontSize: 14 }}>İlan Filtreleme</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({displayed.length} ilan listeleniyor · Depoda toplam {totalAvailMeatKg.toFixed(1)} kg et mevcut)
            </Text>
          </Space>
          {hasActiveFilters && (
            <Button
              size="small"
              type="link"
              danger
              icon={<ClearOutlined />}
              onClick={() => { setSearch(''); setSelProduct(null); setSelAnimal(null); }}
            >
              Filtreleri Temizle
            </Button>
          )}
        </div>

        <Row gutter={[20, 10]} align="middle">
          {/* Ürün Filtresi */}
          <Col xs={24} md={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12, minWidth: 65 }}>Ürün Türü:</Text>
              <div
                onClick={() => setSelProduct(null)}
                style={{
                  padding: '4px 12px', borderRadius: 16, cursor: 'pointer',
                  border: `1.5px solid ${!selProduct ? '#1890ff' : '#d9d9d9'}`,
                  background: !selProduct ? '#e6f4ff' : '#fff',
                  color: !selProduct ? '#1890ff' : '#595959',
                  fontWeight: !selProduct ? 600 : 400,
                  fontSize: 12, transition: 'all 0.15s',
                }}
              >
                Tümü ({listings.length})
              </div>
              {Object.entries(PRODUCT_META).map(([name, meta]) => {
                const active = selProduct === name;
                const count = listings.filter(l => l.product_name === name).length;
                return (
                  <div
                    key={name}
                    onClick={() => setSelProduct(active ? null : name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', borderRadius: 16, cursor: 'pointer',
                      border: `1.5px solid ${active ? meta.color : '#d9d9d9'}`,
                      background: active ? '#fff' : '#fff',
                      color: active ? meta.color : '#595959',
                      fontWeight: active ? 700 : 400,
                      fontSize: 12, transition: 'all 0.15s',
                    }}
                  >
                    <span>{meta.emoji}</span>
                    <span>{name}</span>
                    <Tag style={{ marginLeft: 2, fontSize: 10, padding: '0 4px' }} bordered={false}>{count}</Tag>
                  </div>
                );
              })}
            </div>
          </Col>

          {/* Hayvan Türü Uyumu Filtresi */}
          <Col xs={24} md={10}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12, minWidth: 75 }}>Hayvan Türü:</Text>
              <div
                onClick={() => setSelAnimal(null)}
                style={{
                  padding: '4px 12px', borderRadius: 16, cursor: 'pointer',
                  border: `1.5px solid ${!selAnimal ? '#1890ff' : '#d9d9d9'}`,
                  background: !selAnimal ? '#e6f4ff' : '#fff',
                  color: !selAnimal ? '#1890ff' : '#595959',
                  fontWeight: !selAnimal ? 600 : 400,
                  fontSize: 12, transition: 'all 0.15s',
                }}
              >
                Fark Etmez
              </div>
              {Object.entries(ANIMAL_META).map(([key, meta]) => {
                const active = selAnimal === key;
                const animalMeatKg = availParts
                  .filter(p => p.animal_type.toLocaleLowerCase('tr-TR') === key)
                  .reduce((s, p) => s + Number(p.available_kg), 0);

                return (
                  <div
                    key={key}
                    onClick={() => setSelAnimal(active ? null : key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', borderRadius: 16, cursor: 'pointer',
                      border: `1.5px solid ${active ? '#1890ff' : '#d9d9d9'}`,
                      background: active ? '#e6f4ff' : '#fff',
                      color: active ? '#1890ff' : '#595959',
                      fontWeight: active ? 600 : 400,
                      fontSize: 12, transition: 'all 0.15s',
                    }}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                    {animalMeatKg > 0 && (
                      <Tag color="cyan" style={{ fontSize: 9, marginLeft: 2, padding: '0 4px' }}>
                        {animalMeatKg.toFixed(0)} kg
                      </Tag>
                    )}
                  </div>
                );
              })}
            </div>
          </Col>
        </Row>
      </Card>

      {/* ── İLAN LİSTESİ ── */}
      {loading || stockLoading ? (
        <Card style={{ textAlign: 'center', padding: 40 }}><Text type="secondary">İlanlar ve stok bilgileri yükleniyor...</Text></Card>
      ) : displayed.length === 0 ? (
        <Empty description={selProduct ? `${selProduct} için aktif ilan bulunamadı` : 'Kriterlere uygun ilan bulunamadı'} />
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
                <Card
                  hoverable
                  style={{ borderRadius: 12, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}
                  styles={{ body: { padding: '16px 20px', display: 'flex', flexDirection: 'column', height: '100%' } }}
                  onClick={() => openOrder(listing)}
                >
                  {/* Kapasite rozeti */}
                  {batches !== null && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      background: batches > 0 ? '#52c41a' : '#ff4d4f',
                      color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                    }}>
                      {batches > 0 ? `≈ ${Math.floor(batches)} paket kapasite` : 'Stok yetersiz'}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      fontSize: 28, width: 50, height: 50, background: '#f5f5f5',
                      borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{meta.emoji}</div>
                    <div>
                      <Text strong style={{ fontSize: 16 }}>{listing.product_name}</Text><br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{listing.producer_name}</Text>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <Tag color={meta.color} style={{ fontSize: 13, padding: '2px 10px', fontWeight: 600 }}>
                      {formatMoney(listing.service_price, listing.currency)} / {listing.service_unit}
                    </Tag>
                    {listing.min_order_qty && (
                      <Tag style={{ fontSize: 11 }}>Min. {listing.min_order_qty} {listing.service_unit}</Tag>
                    )}
                  </div>

                  {listing.description && (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12, flex: '1 0 auto' }}>
                      {listing.description}
                    </Text>
                  )}

                  {/* Reçete ve Stok Durumu Önizlemesi */}
                  {matKeys.length > 0 && (
                    <div style={{ marginBottom: 12, marginTop: 'auto' }}>
                      <Text style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>
                        Birim İhtiyaç & Depodaki Stok:
                      </Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {matKeys.map(key => {
                          const need  = mats[key].amount;
                          const def   = matDefs.find(m => m.name === key);
                          const avail = getUnifiedAvail(key, def?.source);
                          const isOk  = avail >= need;
                          return (
                            <Tag
                              key={key}
                              color={isOk ? 'green' : 'orange'}
                              style={{ fontSize: 11, padding: '1px 6px' }}
                            >
                              {key}: {need} {mats[key].unit} <span style={{ opacity: 0.75 }}>({avail.toFixed(0)} stok)</span>
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Alt İşlem Butonları */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 8, paddingTop: 10, borderTop: '1px solid #f0f0f0',
                  }}>
                    <Button
                      type="primary"
                      size="small"
                      icon={<ShoppingCartOutlined />}
                      onClick={e => { e.stopPropagation(); openOrder(listing); }}
                    >
                      {t('producerListings.orderNow')}
                    </Button>

                    <Space size={4}>
                      <Tooltip title={t('producerListings.aiEstimate')}>
                        <Button
                          size="small"
                          icon={<RobotOutlined />}
                          style={{ color: '#722ed1', borderColor: '#722ed1' }}
                          onClick={e => { e.stopPropagation(); openMl(listing); }}
                        >
                          {t('producerListings.aiEstimate')}
                        </Button>
                      </Tooltip>
                      <Button
                        size="small"
                        icon={<InfoCircleOutlined />}
                        onClick={e => { e.stopPropagation(); setSelListing(listing); setDetailOpen(true); }}
                      >
                        {t('common.details')}
                      </Button>
                    </Space>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* ── DETAY MODALI ── */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={560}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>{selListing ? (PRODUCT_META[selListing.product_name]?.emoji ?? '📦') : ''}</span>
            <span>{selListing?.product_name} — İlan Detayı</span>
          </div>
        }
      >
        {selListing && (() => {
          const mats = parseMaterials(selListing.required_materials);
          const keys = Object.keys(mats);
          const matDefs = PRODUCT_MATERIALS[selListing.product_name] ?? [];
          return (
            <div>
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label={t('roles.sucukcu')} span={2}>
                  <Text strong>{selListing.producer_name}</Text>
                </Descriptions.Item>
                {selListing.phone && (
                  <Descriptions.Item label={<><PhoneOutlined /> {t('common.phone')}</>} span={2}>
                    {selListing.phone}
                  </Descriptions.Item>
                )}
                {selListing.address && (
                  <Descriptions.Item label={<><EnvironmentOutlined /> {t('common.address')}</>} span={2}>
                    {selListing.address}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label={t('producerListings.serviceCost')}>
                  <Text strong style={{ color: '#f50', fontSize: 15 }}>
                    {formatMoney(selListing.service_price, selListing.currency)} / {selListing.service_unit}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('producerListings.minOrder')}>
                  {selListing.min_order_qty ? `${selListing.min_order_qty} ${selListing.service_unit}` : '—'}
                </Descriptions.Item>
              </Descriptions>

              {selListing.description && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f9f9f9', borderRadius: 8 }}>
                  <Text type="secondary">{selListing.description}</Text>
                </div>
              )}

              {keys.length > 0 && (
                <>
                  <Divider style={{ margin: '14px 0 10px' }}>Birim Başına İstenen Hammaddeler</Divider>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {keys.map(key => {
                      const def   = matDefs.find(m => m.name === key);
                      const avail = getUnifiedAvail(key, def?.source);
                      return (
                        <div key={key} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: '#fafafa', borderRadius: 6,
                          border: '1px solid #f0f0f0',
                        }}>
                          <Text strong>{key}</Text>
                          <Space>
                            <Tag color="blue">{mats[key].amount} {mats[key].unit}</Tag>
                            <Tag color={avail >= mats[key].amount ? 'green' : 'orange'}>
                              Depoda: {avail.toFixed(1)} {mats[key].unit}
                            </Tag>
                          </Space>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <Button
                type="primary"
                block
                size="large"
                icon={<ShoppingCartOutlined />}
                style={{ marginTop: 20 }}
                onClick={() => openOrder(selListing)}
              >
                {t('producerListings.orderNow')}
              </Button>
            </div>
          );
        })()}
      </Modal>

      {/* ── SİPARİŞ MODALI (Parça Seçimi, Lot Bağlantısı & Uyum Kontrolü Burada) ── */}
      <Modal
        open={orderOpen}
        onCancel={() => setOrderOpen(false)}
        footer={null}
        width={720}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCartOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            <span>{orderListing?.product_name} — {t('producerListings.orderNow')}</span>
            <Tag color="blue" style={{ marginLeft: 4 }}>{orderListing?.producer_name}</Tag>
          </div>
        }
      >
        {orderListing && (() => {
          const mats = parseMaterials(orderListing.required_materials);
          const stockMatKeys = Object.keys(mats).filter(k => k.toLowerCase() !== 'et');
          const totalStockInput = Object.values(orderStockInputs).reduce((s, v) => s + (v || 0), 0);
          const totalInputKg = orderSelectedMeatKg + totalStockInput;
          const expectedPackages = orderSelectedMeatKg > 0 ? Math.max(1, Math.round((orderSelectedMeatKg * 0.85) / 1.0)) : 0;
          const estimatedFire = totalInputKg > 0 ? Math.max(0, parseFloat((totalInputKg - (expectedPackages * 1.0)).toFixed(2))) : 0;
          const estimatedCost = (expectedPackages * Number(orderListing.service_price)).toFixed(2);

          // Mezbaha aktif parçaları
          const activeParts = availParts.filter(p => Number(p.available_kg) > 0);

          // İsteğe bağlı modal içi hayvan filtreleme
          const filteredParts = orderAnimalFilter
            ? activeParts.filter(p => p.animal_type.toLocaleLowerCase('tr-TR') === orderAnimalFilter.toLocaleLowerCase('tr-TR'))
            : activeParts;

          return (
            <div>
              {/* Üretici özet kartı */}
              <div style={{
                background: '#f0f5ff', borderRadius: 8, padding: '10px 14px',
                marginBottom: 16, border: '1px solid #adc6ff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              }}>
                <div>
                  <Text strong>{orderListing.producer_name}</Text>
                  {orderListing.phone && <Text type="secondary" style={{ marginLeft: 12 }}><PhoneOutlined /> {orderListing.phone}</Text>}
                </div>
                <div>
                  <Text type="secondary">{t('producerListings.serviceCost')}: </Text>
                  <Text strong style={{ color: '#f50', fontSize: 15 }}>
                    {formatMoney(orderListing.service_price, orderListing.currency)} / {orderListing.service_unit}
                  </Text>
                </div>
              </div>

              {/* ── BÖLÜM 1: ET VE PARÇA SEÇİMİ (MEZBAHA STOĞU) ── */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <Text strong style={{ fontSize: 14 }}>1. Mezbaha Parça ve Lot Seçimi (Et)</Text>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                      Hangi hayvanın hangi parça lotlarını üreticiye göndereceğinizi belirleyin.
                    </Text>
                  </div>
                  {activeParts.length > 0 && (
                    <Space size={4}>
                      <Button
                        size="small"
                        type={orderAnimalFilter === null ? 'primary' : 'default'}
                        onClick={() => setOrderAnimalFilter(null)}
                      >
                        Tümü
                      </Button>
                      {['inek', 'koyun', 'tavuk'].map(a => {
                        const cnt = activeParts.filter(p => p.animal_type.toLocaleLowerCase('tr-TR') === a).length;
                        if (cnt === 0) return null;
                        return (
                          <Button
                            key={a}
                            size="small"
                            type={orderAnimalFilter === a ? 'primary' : 'default'}
                            onClick={() => setOrderAnimalFilter(orderAnimalFilter === a ? null : a)}
                          >
                            {ANIMAL_META[a]?.emoji} {ANIMAL_META[a]?.label}
                          </Button>
                        );
                      })}
                    </Space>
                  )}
                </div>

                {filteredParts.length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Depoda aktif mezbaha parçası bulunamadı. Lütfen önce parçalama yapınız veya ham stok kullanınız."
                    style={{ marginBottom: 12 }}
                  />
                ) : (
                  <div style={{
                    maxHeight: 220, overflowY: 'auto', border: '1px solid #f0f0f0',
                    borderRadius: 8, padding: 8, background: '#fafafa',
                  }}>
                    {filteredParts.map(part => {
                      const suitability = getPartSuitability(orderListing.product_name, part.part_name);
                      const currentKg   = orderPartKgs[part.part_id] ?? 0;
                      const isSelected  = currentKg > 0;
                      const isUnsuitable = suitability.status === 'unsuitable' && orderListing.product_name === 'Pastırma';

                      return (
                        <div
                          key={part.part_id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: isSelected ? '#f6ffed' : '#fff',
                            borderRadius: 6, marginBottom: 6,
                            border: `1.5px solid ${isSelected ? '#b7eb8f' : '#e8e8e8'}`,
                            opacity: isUnsuitable ? 0.65 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Checkbox
                              disabled={isUnsuitable}
                              checked={isSelected}
                              onChange={e => {
                                setOrderPartKgs(prev => ({
                                  ...prev,
                                  [part.part_id]: e.target.checked ? Math.min(10, Number(part.available_kg)) : 0,
                                }));
                              }}
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Text strong style={{ fontSize: 13 }}>
                                  {ANIMAL_META[part.animal_type.toLowerCase()]?.emoji ?? '🥩'} {part.animal_type} - {part.part_name}
                                </Text>
                                <Tag style={{ fontSize: 10 }}>{part.lot_number}</Tag>
                                <Tooltip title={suitability.description}>
                                  <Tag color={suitability.tagColor} style={{ fontSize: 10, cursor: 'pointer' }}>
                                    {suitability.badge}
                                  </Tag>
                                </Tooltip>
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Depoda: <strong style={{ color: '#1890ff' }}>{Number(part.available_kg).toFixed(2)} kg</strong>
                              </Text>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <InputNumber
                              size="small"
                              min={0}
                              max={Number(part.available_kg)}
                              step={0.5}
                              precision={2}
                              disabled={isUnsuitable}
                              placeholder="0.00"
                              value={currentKg > 0 ? currentKg : null}
                              onChange={val => {
                                setOrderPartKgs(prev => ({
                                  ...prev,
                                  [part.part_id]: val ?? 0,
                                }));
                              }}
                              addonAfter="kg"
                              style={{ width: 140 }}
                            />
                            <Button
                              size="small"
                              disabled={isUnsuitable}
                              onClick={() => {
                                setOrderPartKgs(prev => ({
                                  ...prev,
                                  [part.part_id]: Number(part.available_kg),
                                }));
                              }}
                            >
                              Tümü
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Seçilen toplam et özeti */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: '#e6f4ff', borderRadius: 6, marginTop: 8,
                }}>
                  <Text strong style={{ color: '#0958d9' }}>Seçilen Toplam Et Miktarı:</Text>
                  <Tag color="blue" style={{ fontSize: 14, fontWeight: 700, padding: '2px 10px' }}>
                    {orderSelectedMeatKg.toFixed(2)} kg
                  </Tag>
                </div>
              </div>

              {/* ── BÖLÜM 2: DİĞER REÇETE HAMMADDELERİ ── */}
              {stockMatKeys.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <Text strong style={{ fontSize: 14 }}>2. Diğer Reçete Hammaddeleri</Text>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        Baharat, tuz, sarımsak ve kılıf stoğunuzdan gönderilecek miktarları belirleyin.
                      </Text>
                    </div>
                    {orderSelectedMeatKg > 0 && (
                      <Button
                        size="small"
                        type="dashed"
                        icon={<ThunderboltOutlined />}
                        style={{ color: '#1890ff', borderColor: '#1890ff' }}
                        onClick={autoFillStockInputs}
                      >
                        Reçeteye Göre Otomatik Doldur
                      </Button>
                    )}
                  </div>

                  <Row gutter={[10, 10]}>
                    {stockMatKeys.map(key => {
                      const need  = mats[key].amount;
                      const avail = getUnifiedAvail(key, 'stock');
                      const val   = orderStockInputs[key] ?? 0;
                      const isOk  = val <= avail;

                      return (
                        <Col key={key} xs={24} sm={12}>
                          <div style={{
                            padding: '8px 12px', background: '#fafafa', borderRadius: 8,
                            border: `1px solid ${val > 0 && !isOk ? '#ffbb96' : '#f0f0f0'}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text strong style={{ fontSize: 12 }}>{key}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Reçete: {need} {mats[key].unit}/birim
                              </Text>
                            </div>
                            <InputNumber
                              size="small"
                              min={0}
                              step={0.1}
                              precision={2}
                              placeholder="0.00"
                              value={val > 0 ? val : null}
                              onChange={v => setOrderStockInputs(prev => ({ ...prev, [key]: v ?? 0 }))}
                              addonAfter={mats[key].unit}
                              style={{ width: '100%' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                              <Text style={{ fontSize: 10, color: val > 0 && !isOk ? '#ff4d4f' : '#888' }}>
                                Depoda: {avail.toFixed(2)} {mats[key].unit}
                              </Text>
                              {val > 0 && (
                                isOk
                                  ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                                  : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                              )}
                            </div>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                </div>
              )}

              {/* ── BÖLÜM 3: ÜRETİM VE FİRE TAHMİNİ ÖZETİ ── */}
              {orderSelectedMeatKg > 0 && (
                <div style={{
                  padding: '12px 16px', background: '#f6ffed', borderRadius: 8,
                  border: '1px solid #b7eb8f', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">Tahmini Mamul Çıktısı (Paket):</Text>
                    <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                      {expectedPackages} Paket <span style={{ fontSize: 12, fontWeight: 'normal', color: '#888' }}>(Standart 1 kg/paket)</span>
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Tahmini Kuruma & Dolum Firesi:</Text>
                    <Tag color="volcano" style={{ fontSize: 12 }}>
                      {estimatedFire.toFixed(2)} kg (%{totalInputKg > 0 ? ((estimatedFire / totalInputKg) * 100).toFixed(1) : 0})
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #d9d9d9' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Tahmini Fason Hizmet Tutarı:</Text>
                    <Text strong style={{ color: '#f50', fontSize: 15 }}>
                      {estimatedCost} €
                    </Text>
                  </div>
                </div>
              )}

              {/* Sipariş Notu */}
              <div style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Sipariş Notu (Opsiyonel):</Text>
                <Input.TextArea
                  rows={2}
                  placeholder="Üreticiye iletmek istediğiniz özel not veya istekler..."
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                />
              </div>

              <Button
                type="primary"
                block
                size="large"
                icon={<ShoppingCartOutlined />}
                loading={orderSubmitting}
                disabled={orderSelectedMeatKg <= 0}
                onClick={submitOrder}
                style={{ borderRadius: 8 }}
              >
                {orderSelectedMeatKg > 0
                  ? `Siparişi Onayla ve Gönder (${orderSelectedMeatKg.toFixed(1)} kg Et · ~${expectedPackages} Paket)`
                  : 'Lütfen En Az Bir Et Parçası Seçiniz'}
              </Button>
            </div>
          );
        })()}
      </Modal>

      {/* ── ML TAHMİN MODALI ── */}
      <Modal
        open={mlOpen}
        onCancel={() => { setMlOpen(false); setMlResult(null); }}
        footer={null}
        width={560}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined style={{ color: '#722ed1', fontSize: 20 }} />
            <span>{mlListing?.product_name} — AI Üretim Tahmini</span>
            <Tag color="purple" style={{ marginLeft: 4 }}>{mlListing?.producer_name}</Tag>
          </div>
        }
      >
        {mlListing && (() => {
          const mats  = parseMaterials(mlListing.required_materials);
          const keys  = Object.keys(mats);
          const total = Object.values(mlInputs).reduce((s, v) => s + (v || 0), 0);

          return (
            <div>
              <Alert
                type="info"
                showIcon
                icon={<ExperimentOutlined />}
                style={{ marginBottom: 16, fontSize: 12 }}
                message="Makine öğrenimi modeli, geçmiş fason üretim verilerine dayanarak mamul paket sayısı, kuruma firesi ve EKP tahmini yapar."
              />

              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                  Hammadde Miktarlarını Ayarlayın:
                </Text>
                <Row gutter={[8, 8]}>
                  {keys.map(k => (
                    <Col key={k} span={12}>
                      <div style={{ padding: '6px 10px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 12 }}>{k}</Text>
                          <Text type="secondary" style={{ fontSize: 10 }}>Reçete: {mats[k].amount} {mats[k].unit}</Text>
                        </div>
                        <InputNumber
                          size="small"
                          min={0}
                          step={0.5}
                          precision={2}
                          value={mlInputs[k] ?? null}
                          onChange={v => setMlInputs(prev => ({ ...prev, [k]: v ?? 0 }))}
                          addonAfter={mats[k].unit}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, marginBottom: 16,
              }}>
                <Text style={{ fontSize: 13 }}>Toplam Girdi:</Text>
                <Text strong style={{ fontSize: 14 }}>{total.toFixed(2)} kg</Text>
              </div>

              <Button
                type="primary"
                block
                size="large"
                icon={<ThunderboltOutlined />}
                loading={mlLoading}
                disabled={total <= 0}
                onClick={runMlPredict}
                style={{ background: '#722ed1', borderColor: '#722ed1', borderRadius: 8, marginBottom: 16 }}
              >
                Yapay Zeka ile Tahmin Et
              </Button>

              {/* Tahmin Sonuçları */}
              {mlResult && (
                <div style={{ padding: 16, background: '#faf5ff', borderRadius: 10, border: '1px solid #d3adf7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 14 }}>Tahmin Sonucu</Text>
                    <Space size={4}>
                      <Tag color="purple">{methodLabel(mlResult.method)}</Tag>
                      {mlResult.sample_count > 0 && <Tag color="blue">{mlResult.sample_count} kayıt</Tag>}
                    </Space>
                  </div>

                  <Row gutter={12} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <div style={{ textAlign: 'center', padding: '12px 8px', background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
                          {mlResult.predicted_packages ?? Math.max(1, Math.round(total * mlResult.predicted_qty_ratio))} Paket
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          Standart Çıktı ({mlResult.predicted_packages ?? Math.max(1, Math.round(total * mlResult.predicted_qty_ratio))} kg)
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ textAlign: 'center', padding: '12px 8px', background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#f50' }}>
                          {mlResult.predicted_ekp.toFixed(2)} €
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Tahmini EKP / paket</div>
                      </div>
                    </Col>
                  </Row>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: '#fff', borderRadius: 8,
                    border: '1px solid #e8e8e8', marginBottom: 10, fontSize: 12,
                  }}>
                    <Text type="secondary">Tahmini Kuruma/Dolum Firesi:</Text>
                    <Tag color="volcano">
                      {mlResult.predicted_fire_kg !== undefined
                        ? `${Number(mlResult.predicted_fire_kg).toFixed(2)} kg (%${mlResult.predicted_fire_rate})`
                        : `${Math.max(0, total - (mlResult.predicted_packages ?? Math.round(total * 0.85))).toFixed(2)} kg`}
                    </Tag>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>Model Güven Skoru</Text>
                      <Text style={{ fontSize: 12, color: confidenceColor(mlResult.confidence) }}>
                        %{(mlResult.confidence * 100).toFixed(0)}
                      </Text>
                    </div>
                    <Progress
                      percent={Math.round(mlResult.confidence * 100)}
                      strokeColor={confidenceColor(mlResult.confidence)}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                  {mlResult.notes && <Alert type="warning" message={mlResult.notes} style={{ fontSize: 11, marginTop: 4 }} />}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
