import { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Modal, DatePicker, InputNumber,
  Typography, Tag, Descriptions, Divider,
  Space, Spin, App, Input, Radio, Card, Row, Col, Collapse,
} from 'antd';
import {
  ScissorOutlined, PlusOutlined, EyeOutlined, CheckCircleFilled,
  RobotOutlined, ThunderboltOutlined, InfoCircleOutlined,
  CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { butcheryService, mlService } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

// ── Hayvan Türü Tanımları ──────────────────────────────────────────────────────
type AnimalKey = 'inek' | 'koyun' | 'tavuk';

interface AnimalType {
  key: AnimalKey;
  emoji: string;
  label: string;
  parts: string[];
}

const ANIMAL_TYPES: AnimalType[] = [
  {
    key: 'koyun',
    emoji: '🐑',
    label: 'Koyun / Kuzu',
    parts: ['Pirzola', 'But', 'Sırt / Kontrfile', 'Kol / Omuz', 'Kaburga', 'Gerdan', 'Kıyma / Kuşbaşı', 'İncik', 'Bağırsak'],
  },
  {
    key: 'inek',
    emoji: '🐄',
    label: 'İnek / Dana',
    parts: ['Antrikot', 'Bonfile', 'Kontrfile', 'Sokum', 'But', 'Kol', 'Kaburga', 'Gerdan', 'Bağırsak'],
  },
  {
    key: 'tavuk',
    emoji: '🐔',
    label: 'Tavuk',
    parts: ['Bütün Tavuk'],
  },
];

// Değer Ağırlıklı Dağıtım İçin Piyasa Çarpanları
const PART_VALUE_MULTIPLIERS: Record<string, number> = {
  'pirzola':          2.2,
  'sırt / kontrfile': 1.8,
  'sırt':             1.8,
  'but':              1.3,
  'kol / omuz':       1.1,
  'kol':              1.1,
  'kaburga':          0.9,
  'incik':            0.9,
  'gerdan':           0.8,
  'kıyma / kuşbaşı':  1.0,
  'kıyma':            1.0,
  'kuşbaşı':          1.1,
  'bağırsak':         0.3,
  'antrikot':         2.5,
  'bonfile':          2.8,
  'kontrfile':        2.2,
  'sokum':            1.5,
  'tavuk':            1.0,
};

function getPartMultiplier(partName: string): number {
  const norm = partName.toLowerCase().trim();
  for (const [key, mult] of Object.entries(PART_VALUE_MULTIPLIERS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return mult;
    }
  }
  return 1.0;
}

// ── Tipler ────────────────────────────────────────────────────────────────────
interface PartWeight {
  part_name: string;
  weight_kg: number | null;
}

interface ButcheryRecord {
  id: number;
  animal_type: string;
  animal_ear_tag?: string;
  operation_date: string;
  input_weight_kg?: number;
  total_output_kg: number;
  waste_kg: number;
  total_cost: number;
  unit_cost_input?: number;
  distribution_method?: string;
  notes?: string;
  parts?: PartDetail[];
}

interface PartDetail {
  part_name: string;
  actual_weight_kg: number;
  allocated_cost: number;
  unit_cost: number;
  lot_number?: string;
  is_byproduct: boolean;
}

interface MLButcheryResult {
  parts: { part_name: string; predicted_weight_kg: number; expected_ratio: number; allocated_cost: number; unit_cost: number }[];
  predicted_waste_kg: number;
  total_predicted_kg: number;
  sample_count: number;
  method: string;
  notes: string;
}

function confidenceLabel(method: string, n: number) {
  if (method === 'random_forest') return { color: '#52c41a', text: `RandomForest (${n} kayıt)` };
  if (method === 'linear')        return { color: '#faad14', text: `Lineer Regresyon (${n} kayıt)` };
  return { color: '#8c8c8c', text: `Reçete Tabanlı${n > 0 ? ` (${n} kayıt)` : ''}` };
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function ButcheryPage() {
  const { message } = App.useApp();
  const [operations, setOperations] = useState<ButcheryRecord[]>([]);
  const [loading, setLoading]       = useState(true);

  // Modal 1: Hayvan türü seçimi
  const [step1Open, setStep1Open]       = useState(false);
  const [selectedType, setSelectedType] = useState<AnimalType | null>(null);

  // Modal 2: Parçalama & Maliyet Dağıtım Formu
  const [step2Open, setStep2Open]           = useState(false);
  const [inputWeightKg, setInputWeightKg]   = useState<number | null>(25.0);
  const [animalEarTag, setAnimalEarTag]     = useState<string>('TR-06-KUZU-001');
  const [purchaseCost, setPurchaseCost]     = useState<number | null>(287.50);
  const [distMethod, setDistMethod]         = useState<'agirlik' | 'deger'>('agirlik');
  const [partWeights, setPartWeights]       = useState<PartWeight[]>([]);
  const [cutDate, setCutDate]               = useState<Dayjs>(dayjs());
  const [notes, setNotes]                   = useState<string>('');
  const [submitting, setSubmitting]         = useState(false);

  // Detay modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail]         = useState<{ operation: ButcheryRecord; parts: PartDetail[] } | null>(null);

  // Tablo filtresi
  const [filterBefore, setFilterBefore] = useState<Dayjs | null>(null);

  // ML tahmin
  const [mlResult, setMlResult]   = useState<MLButcheryResult | null>(null);
  const [mlLoading, setMlLoading] = useState(false);

  // ── Veri yükle ─────────────────────────────────────────────────────────────
  async function loadOperations() {
    try {
      const { data } = await butcheryService.getAll();
      setOperations(data);
    } catch {
      message.error('Parçalama kayıtları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOperations(); }, []);

  // ── Adım 1: Tür seçimi ve Adım 2'ye geçiş ──────────────────────────────────
  function onTypeConfirm() {
    if (!selectedType) return;
    setPartWeights(selectedType.parts.map(p => ({ part_name: p, weight_kg: null })));
    setMlResult(null);

    // Hayvana göre varsayılan giriş değerleri
    if (selectedType.key === 'koyun') {
      setInputWeightKg(25.0);
      setAnimalEarTag('TR-06-KUZU-001');
      setPurchaseCost(287.50);
    } else if (selectedType.key === 'inek') {
      setInputWeightKg(350.0);
      setAnimalEarTag('TR-34-DANA-101');
      setPurchaseCost(4200.00);
    } else {
      setInputWeightKg(2.5);
      setAnimalEarTag('TR-16-TVK-01');
      setPurchaseCost(15.00);
    }

    setStep1Open(false);
    setStep2Open(true);
    fetchMlPrediction(selectedType.key, selectedType.key === 'koyun' ? 25.0 : 350.0);
  }

  async function fetchMlPrediction(animalKey: string, entryKg: number) {
    setMlLoading(true);
    try {
      const { data } = await mlService.predictButchery({
        animal_type:     animalKey,
        entry_weight_kg: entryKg,
        purchase_cost:   purchaseCost || 0,
      });
      setMlResult(data);
    } catch {
      setMlResult(null);
    } finally {
      setMlLoading(false);
    }
  }

  function updateWeight(idx: number, val: number | null) {
    setPartWeights(prev => prev.map((p, i) => i === idx ? { ...p, weight_kg: val } : p));
  }

  // ── Hazır Örnek Değerleri Doldurma Fonksiyonları ─────────────────────────
  function fillScenario287() {
    setInputWeightKg(25.0);
    setAnimalEarTag('TR-06-KUZU-001');
    setPurchaseCost(287.50); // 25 x 11.50 €
    setNotes('Standart kuzu parçalama (25 kg Kuzu, 11.50 €/kg)');

    // Toplam 22 kg kuzu parçaları (3 kg fire)
    const kuzuParts = [
      { part_name: 'Pirzola',          weight_kg: 3.50 },
      { part_name: 'But',              weight_kg: 6.00 },
      { part_name: 'Sırt / Kontrfile', weight_kg: 2.50 },
      { part_name: 'Kol / Omuz',       weight_kg: 4.50 },
      { part_name: 'Kaburga',          weight_kg: 2.50 },
      { part_name: 'Gerdan',           weight_kg: 1.50 },
      { part_name: 'Kıyma / Kuşbaşı',  weight_kg: 0.50 },
      { part_name: 'İncik',            weight_kg: 0.50 },
      { part_name: 'Bağırsak',         weight_kg: 0.50 },
    ];
    setPartWeights(kuzuParts);
    message.success('Standart kuzu parçalama değerleri dolduruldu (25 kg Giriş · 22 kg Çıkan · 3 kg Fire · 287.50 €)!');
  }

  function fillScenario351() {
    setInputWeightKg(25.0);
    setAnimalEarTag('TR-06-KUZU-002');
    setPurchaseCost(351.00); // 351 €
    setNotes('Ek masraflı alternatif toplam maliyet senaryosu (351.00 €)');

    const kuzuParts = [
      { part_name: 'Pirzola',          weight_kg: 3.50 },
      { part_name: 'But',              weight_kg: 6.00 },
      { part_name: 'Sırt / Kontrfile', weight_kg: 2.50 },
      { part_name: 'Kol / Omuz',       weight_kg: 4.50 },
      { part_name: 'Kaburga',          weight_kg: 2.50 },
      { part_name: 'Gerdan',           weight_kg: 1.50 },
      { part_name: 'Kıyma / Kuşbaşı',  weight_kg: 0.50 },
      { part_name: 'İncik',            weight_kg: 0.50 },
      { part_name: 'Bağırsak',         weight_kg: 0.50 },
    ];
    setPartWeights(kuzuParts);
    message.info('351.00 € ek masraflı maliyet senaryosu dolduruldu!');
  }

  // ── Canlı Ağırlık ve Maliyet Dağıtım Hesaplamaları ───────────────────────────
  const totalOutputKg = useMemo(() => {
    return partWeights.reduce((s, p) => s + (p.weight_kg || 0), 0);
  }, [partWeights]);

  const wasteKg = useMemo(() => {
    return Math.max(0, parseFloat(((inputWeightKg || 0) - totalOutputKg).toFixed(3)));
  }, [inputWeightKg, totalOutputKg]);

  const fireRate = useMemo(() => {
    return (inputWeightKg && inputWeightKg > 0) ? (wasteKg / inputWeightKg) * 100 : 0;
  }, [inputWeightKg, wasteKg]);

  const unitCostInput = useMemo(() => {
    return (inputWeightKg && inputWeightKg > 0 && purchaseCost) ? (purchaseCost / inputWeightKg) : 0;
  }, [inputWeightKg, purchaseCost]);

  // Her parçaya dağıtılan maliyetlerin canlı haritası
  const calculatedPartsMap = useMemo(() => {
    const cost = purchaseCost || 0;
    const map: Record<string, { allocatedCost: number; unitCost: number; ratio: number; mult: number }> = {};

    let totalPoints = 0;
    if (distMethod === 'deger') {
      totalPoints = partWeights.reduce((s, p) => {
        const mult = getPartMultiplier(p.part_name);
        return s + ((p.weight_kg || 0) * mult);
      }, 0);
    }

    partWeights.forEach(p => {
      const w = p.weight_kg || 0;
      const mult = getPartMultiplier(p.part_name);
      let ratio = 0;
      if (distMethod === 'deger' && totalPoints > 0) {
        ratio = (w * mult) / totalPoints;
      } else if (totalOutputKg > 0) {
        ratio = w / totalOutputKg;
      }

      const allocatedCost = cost * ratio;
      const unitCost = w > 0 ? (allocatedCost / w) : 0;

      map[p.part_name] = {
        allocatedCost,
        unitCost,
        ratio,
        mult,
      };
    });

    return map;
  }, [partWeights, purchaseCost, distMethod, totalOutputKg]);

  // Dağıtılan toplam tutar
  const totalAllocatedCost = useMemo(() => {
    return Object.values(calculatedPartsMap).reduce((s, p) => s + p.allocatedCost, 0);
  }, [calculatedPartsMap]);

  // ── Kaydet ─────────────────────────────────────────────────────────────────
  async function onSubmit() {
    if (!selectedType) return;

    const empty = partWeights.filter(p => p.weight_kg === null || p.weight_kg <= 0);
    if (empty.length > 0) {
      message.error('Lütfen tüm parçalar için ağırlık giriniz.');
      return;
    }

    if (!inputWeightKg || inputWeightKg <= 0) {
      message.error('Lütfen giriş hayvanı ağırlığını giriniz.');
      return;
    }

    if (!purchaseCost || purchaseCost <= 0) {
      message.error('Lütfen toplam alış maliyetini giriniz.');
      return;
    }

    setSubmitting(true);
    try {
      await butcheryService.create({
        animal_type:         selectedType.key,
        animal_ear_tag:      animalEarTag || null,
        operation_date:      cutDate.format('YYYY-MM-DD'),
        input_weight_kg:     inputWeightKg,
        total_cost:          purchaseCost,
        unit_cost_input:     unitCostInput,
        distribution_method: distMethod,
        notes:               notes || null,
        parts: partWeights.map(p => ({
          part_name:        p.part_name,
          actual_weight_kg: p.weight_kg ?? 0,
          is_byproduct:     p.part_name.toLowerCase().includes('bağırsak'),
        })),
      });

      message.success('Parçalama işlemi ve maliyet dağıtımı başarıyla kaydedildi!');
      setStep2Open(false);
      setSelectedType(null);
      setPartWeights([]);
      loadOperations();
    } catch {
      message.error('Kayıt sırasında hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Detay Görüntüle ────────────────────────────────────────────────────────
  async function viewDetail(id: number) {
    try {
      const { data } = await butcheryService.getById(id);
      setDetail(data);
      setDetailOpen(true);
    } catch {
      message.error('Detay yüklenemedi');
    }
  }

  // ── Tablo Kolonları ────────────────────────────────────────────────────────
  const filtered = filterBefore
    ? operations.filter(op => dayjs(op.operation_date).isBefore(filterBefore, 'day') || dayjs(op.operation_date).isSame(filterBefore, 'day'))
    : operations;

  const columns = [
    {
      title: 'Küpe / Parti No', dataIndex: 'animal_ear_tag', key: 'animal_ear_tag',
      render: (v: string) => v ? <strong>{v}</strong> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Hayvan Türü', dataIndex: 'animal_type', key: 'animal_type',
      render: (v: string) => {
        const t = ANIMAL_TYPES.find(a => a.key === v?.toLowerCase() || a.label.toLowerCase().includes(v?.toLowerCase()));
        return <span>{t?.emoji ?? '🐾'} {v}</span>;
      },
    },
    {
      title: 'Giriş Karkas', dataIndex: 'input_weight_kg', key: 'input_weight_kg',
      render: (v: number) => v ? `${Number(v).toFixed(2)} kg` : '-',
    },
    {
      title: 'Çıkan Parçalar', dataIndex: 'total_output_kg', key: 'total_output_kg',
      render: (v: number) => v ? <Tag color="blue">{Number(v).toFixed(2)} kg</Tag> : '-',
    },
    {
      title: 'Fire / Kayıp', dataIndex: 'waste_kg', key: 'waste_kg',
      render: (v: number, r: ButcheryRecord) => {
        const rate = (r.input_weight_kg && r.input_weight_kg > 0) ? ((Number(v) / r.input_weight_kg) * 100).toFixed(1) : '0';
        return Number(v) > 0.001
          ? <Tag color="volcano">{Number(v).toFixed(2)} kg (%{rate})</Tag>
          : <Tag color="green">0 kg</Tag>;
      },
    },
    {
      title: 'Toplam Alış Maliyeti', dataIndex: 'total_cost', key: 'total_cost',
      render: (v: number) => v ? <strong style={{ color: '#f50' }}>{Number(v).toFixed(2)} €</strong> : '-',
    },
    {
      title: 'Dağıtım Anahtarı', dataIndex: 'distribution_method', key: 'distribution_method',
      render: (v: string) => v === 'deger'
        ? <Tag color="purple">💎 Değer Ağırlıklı</Tag>
        : <Tag color="cyan">⚖️ Miktar Ağırlıklı</Tag>,
    },
    {
      title: 'Kesim Tarihi', dataIndex: 'operation_date', key: 'operation_date',
      render: (v: string) => v ? dayjs(v).format('DD.MM.YYYY') : '-',
      sorter: (a: ButcheryRecord, b: ButcheryRecord) => dayjs(a.operation_date).unix() - dayjs(b.operation_date).unix(),
    },
    {
      title: 'İşlem', key: 'action',
      render: (_: unknown, r: ButcheryRecord) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>Detay</Button>
      ),
    },
  ];

  return (
    <div>
      {/* ── Başlık & Yeni Buton ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><ScissorOutlined /> Bütün Kuzu / Hayvan Parçalama & Maliyet Dağıtımı</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Karkas parçalama, ağırlık dengesi, fire kontrolü ve miktar/değer ağırlıklı maliyet dağıtım anahtarı.
          </Text>
        </div>
        <Space>
          <Text type="secondary">Tarihe göre filtrele:</Text>
          <DatePicker
            format="DD.MM.YYYY"
            placeholder="Şu tarihten önce"
            value={filterBefore}
            onChange={v => setFilterBefore(v)}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedType(null); setStep1Open(true); }}>
            Yeni Parçalama İşlemi
          </Button>
        </Space>
      </div>

      {/* ── Parçalama İşlemleri Tablosu ── */}
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* ── ADIM 1: Hayvan Türü Seçimi Modalı ── */}
      <Modal
        open={step1Open}
        onCancel={() => setStep1Open(false)}
        footer={null}
        width={540}
        centered
        title={
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <Title level={4} style={{ margin: 0 }}>Parçalanacak Hayvan Türü</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Küçükbaş parçalama için Koyun / Kuzu seçiniz</Text>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 12, margin: '20px 0' }}>
          {ANIMAL_TYPES.map(type => {
            const isSelected = selectedType?.key === type.key;
            return (
              <div
                key={type.key}
                onClick={() => setSelectedType(type)}
                style={{
                  flex: 1,
                  border: `2px solid ${isSelected ? '#1890ff' : '#e8e8e8'}`,
                  borderRadius: 10,
                  padding: '20px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isSelected ? '#e6f4ff' : '#fafafa',
                  transition: 'all 0.18s',
                  position: 'relative',
                  userSelect: 'none',
                }}
              >
                {isSelected && (
                  <CheckCircleFilled style={{ position: 'absolute', top: 8, right: 8, color: '#1890ff', fontSize: 16 }} />
                )}
                <div style={{ fontSize: 36, marginBottom: 8 }}>{type.emoji}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{type.label}</div>
              </div>
            );
          })}
        </div>

        <Button
          type="primary"
          block
          size="large"
          disabled={!selectedType}
          onClick={onTypeConfirm}
          style={{ borderRadius: 8 }}
        >
          Parçalama ve Maliyet Dağıtımına Başla →
        </Button>
      </Modal>

      {/* ── ADIM 2: Parçalama, Ağırlık Dengesi & Maliyet Dağıtım Modalı ── */}
      <Modal
        open={step2Open}
        onCancel={() => setStep2Open(false)}
        footer={null}
        width={760}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>{selectedType?.emoji}</span>
            <span>{selectedType?.label} Parçalama ve Maliyet Dağıtım Anahtarı</span>
          </div>
        }
      >
        <div style={{ marginBottom: 16 }}>

          {/* Hazır Örnek Doldurma Butonları */}
          <div style={{
            background: '#e6f4ff', borderRadius: 8, padding: '10px 14px',
            marginBottom: 16, border: '1px solid #91caff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <Text strong style={{ color: '#003eb3' }}>📋 Hızlı Senaryo Doldurucu:</Text>
              <Text style={{ fontSize: 11, display: 'block', color: '#595959' }}>
                Örnek kuzu parçalama verilerini tek tıkla forma aktarın.
              </Text>
            </div>
            <Space>
              <Button
                size="small"
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={fillScenario287}
              >
                25 kg / 287.50 € (Standart Alış)
              </Button>
              <Button
                size="small"
                style={{ borderColor: '#fa8c16', color: '#d46b08' }}
                icon={<ThunderboltOutlined />}
                onClick={fillScenario351}
              >
                25 kg / 351.00 € (Ek Masraflı Alış)
              </Button>
            </Space>
          </div>

          {/* 1. GİRİŞ BİLGİLERİ KARTI */}
          <Card size="small" title="1. Giriş Hayvanı ve Satın Alma Maliyeti" style={{ marginBottom: 14, borderRadius: 8 }}>
            <Row gutter={[12, 10]}>
              <Col xs={24} sm={8}>
                <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Küpe / Parti No:</Text>
                <Input
                  placeholder="TR-06-KUZU-001"
                  value={animalEarTag}
                  onChange={e => setAnimalEarTag(e.target.value)}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Giriş Karkas Ağırlığı:</Text>
                <InputNumber
                  min={0.1}
                  step={0.5}
                  precision={2}
                  addonAfter="kg"
                  style={{ width: '100%' }}
                  value={inputWeightKg}
                  onChange={v => {
                    setInputWeightKg(v);
                    if (selectedType && v) fetchMlPrediction(selectedType.key, v);
                  }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Toplam Alış Maliyeti:</Text>
                <InputNumber
                  min={0}
                  step={10}
                  precision={2}
                  addonAfter="€"
                  style={{ width: '100%' }}
                  value={purchaseCost}
                  onChange={v => setPurchaseCost(v)}
                />
              </Col>
            </Row>

            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
              <span>Hesaplanan Giriş Birim Fiyatı: <strong>{unitCostInput.toFixed(2)} €/kg</strong></span>
              <span>Kesim Tarihi: <DatePicker size="small" value={cutDate} onChange={v => v && setCutDate(v)} /></span>
            </div>
          </Card>

          {/* 2. MALİYET DAĞITIM ANAHTARI SEÇİMİ */}
          <Card size="small" title="2. Maliyet Dağıtım Anahtarı (Distribution Key)" style={{ marginBottom: 14, borderRadius: 8 }}>
            <Radio.Group
              value={distMethod}
              onChange={e => setDistMethod(e.target.value)}
              style={{ width: '100%' }}
            >
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12}>
                  <div style={{
                    padding: '10px 12px', borderRadius: 8,
                    border: `1.5px solid ${distMethod === 'agirlik' ? '#1890ff' : '#e8e8e8'}`,
                    background: distMethod === 'agirlik' ? '#e6f4ff' : '#fafafa',
                    cursor: 'pointer',
                  }} onClick={() => setDistMethod('agirlik')}>
                    <Radio value="agirlik">
                      <Text strong>⚖️ Miktar (Ağırlık) Ağırlıklı Dağıtım</Text>
                    </Radio>
                    <Paragraph type="secondary" style={{ fontSize: 11, margin: '4px 0 0 24px' }}>
                      Toplam maliyet çıkan parçaların kilolarına göre paylaştırılır. Her parçanın birim maliyeti eşit olur (Fire maliyeti sağlam parçalara yüklenir).
                    </Paragraph>
                  </div>
                </Col>

                <Col xs={24} sm={12}>
                  <div style={{
                    padding: '10px 12px', borderRadius: 8,
                    border: `1.5px solid ${distMethod === 'deger' ? '#722ed1' : '#e8e8e8'}`,
                    background: distMethod === 'deger' ? '#f9f0ff' : '#fafafa',
                    cursor: 'pointer',
                  }} onClick={() => setDistMethod('deger')}>
                    <Radio value="deger">
                      <Text strong style={{ color: '#722ed1' }}>💎 Değer (Piyasa Çarpanı) Ağırlıklı Dağıtım</Text>
                    </Radio>
                    <Paragraph type="secondary" style={{ fontSize: 11, margin: '4px 0 0 24px' }}>
                      Pirzola, antrikot gibi değerli etlere piyasa çarpanı uygulanarak daha yüksek maliyet, kemikli/yan ürünlere daha düşük maliyet verilir.
                    </Paragraph>
                  </div>
                </Col>
              </Row>
            </Radio.Group>
          </Card>

          {/* 3. PARÇA AĞIRLIKLARI VE CANLI MALİYET DAĞITIM TABLOSU */}
          <Card
            size="small"
            title="3. Parça Ürünleri, Fiili Ağırlıklar ve Dağıtılan Maliyetler"
            extra={
              mlLoading ? <Spin size="small" /> : mlResult && (
                <Tag color={confidenceLabel(mlResult.method, mlResult.sample_count).color === '#52c41a' ? 'green' : 'purple'}>
                  <RobotOutlined /> {confidenceLabel(mlResult.method, mlResult.sample_count).text}
                </Tag>
              )
            }
            style={{ marginBottom: 14, borderRadius: 8 }}
          >
            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Parça Adı</th>
                    {distMethod === 'deger' && <th style={{ padding: '6px 8px' }}>Değer Çarpanı</th>}
                    <th style={{ padding: '6px 8px', width: 150 }}>Fiili Ağırlık (kg)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Maliyet Payı (€)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Birim Maliyet (€/kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {partWeights.map((p, idx) => {
                    const calc = calculatedPartsMap[p.part_name] || { allocatedCost: 0, unitCost: 0, mult: 1 };
                    const mlPart = mlResult?.parts.find(mp => mp.part_name.toLowerCase().includes(p.part_name.toLowerCase()));

                    return (
                      <tr key={p.part_name} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <Text strong>{p.part_name}</Text>
                          {mlPart && (
                            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                              AI Beklenti: ~{mlPart.predicted_weight_kg.toFixed(2)} kg (%{(mlPart.expected_ratio * 100).toFixed(0)})
                            </Text>
                          )}
                        </td>
                        {distMethod === 'deger' && (
                          <td style={{ padding: '6px 8px' }}>
                            <Tag color={calc.mult >= 1.5 ? 'purple' : calc.mult >= 1.0 ? 'blue' : 'default'} style={{ fontSize: 10 }}>
                              ×{calc.mult}
                            </Tag>
                          </td>
                        )}
                        <td style={{ padding: '6px 8px' }}>
                          <InputNumber
                            size="small"
                            min={0}
                            max={9999}
                            step={0.1}
                            precision={2}
                            placeholder="0.00"
                            value={p.weight_kg}
                            onChange={v => updateWeight(idx, v)}
                            addonAfter="kg"
                            style={{ width: 130 }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <strong style={{ color: '#0958d9' }}>{calc.allocatedCost.toFixed(2)} €</strong>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <Tag color="cyan">{calc.unitCost.toFixed(2)} €/kg</Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 4. AĞIRLIK VE MALİYET DENGESİ (KÜTLE KORUNUM KONTROLÜ) */}
          <div style={{
            background: '#fafafa', border: '1.5px solid #d9d9d9',
            borderRadius: 8, padding: '12px 16px', marginBottom: 14,
          }}>
            <Row gutter={[16, 8]}>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11 }}>Giriş Karkas:</Text>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{(inputWeightKg || 0).toFixed(2)} kg</div>
              </Col>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11 }}>Çıkan Parçalar:</Text>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1890ff' }}>{totalOutputKg.toFixed(2)} kg</div>
              </Col>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11 }}>Parçalama Firesi:</Text>
                <div style={{ fontWeight: 700, fontSize: 14, color: wasteKg > 0 ? '#ff4d4f' : '#52c41a' }}>
                  {wasteKg.toFixed(2)} kg (%{fireRate.toFixed(1)})
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11 }}>Toplam Dağıtılan Maliyet:</Text>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#52c41a' }}>
                  {totalAllocatedCost.toFixed(2)} € / {(purchaseCost || 0).toFixed(2)} €
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#595959' }}>
                {Math.abs((purchaseCost || 0) - totalAllocatedCost) < 0.01 ? (
                  <><CheckCircleOutlined style={{ color: '#52c41a' }} /> Toplam dağıtılan tutar alış maliyetine tam eşittir.</>
                ) : (
                  <><WarningOutlined style={{ color: '#faad14' }} /> Dağıtım dengeleniyor...</>
                )}
              </span>
              <Tag color="green">Kayıp / Sapma: 0.00 €</Tag>
            </div>
          </div>

          {/* 5. MALİYET VE KÜTLE DENGESİ ANALİZ NOTU */}
          <Collapse
            ghost
            size="small"
            style={{ marginBottom: 16, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}
            items={[
              {
                key: 'discrepancy',
                label: (
                  <Space>
                    <InfoCircleOutlined style={{ color: '#d48806' }} />
                    <Text strong style={{ color: '#d48806', fontSize: 12 }}>
                      Karkas Alım ve Fire Analizi Bilgilendirme Notu
                    </Text>
                  </Space>
                ),
                children: (
                  <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
                    <p>
                      <strong>1. Fiyat ve Ek Maliyet Analizi:</strong> Karkas alımında <em>25 kg × 11,50 € = 287,50 €</em> yalın et bedelidir; bazı faturalarda mezbaha kesim, nakliye ve veteriner operasyonel giderleri eklenerek toplam fatura tutarı <em>351,00 €</em> olarak yer alabilmektedir (Fark: 63,50 €). Sistemimiz her iki maliyet yöntemini de destekler ve parça maliyetlerini eksiksiz dağıtır.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>2. Kütle Dengesi ve Fire:</strong> 25 kg karkas giriş ağırlığına karşılık elde edilen net parçalar <em>22 kg</em> etmektedir. Aradaki 3 kg (%12), kesim sırasında kemik tozu, buharlaşma ve temizlikten kaynaklanan <strong>kaçınılmaz parçalama firesidir</strong>. Sistemimiz bu 3 kg'ı fire olarak kaydeder ve maliyet bütünlüğünü tam koruyarak parçalara paylaştırır.
                    </p>
                  </div>
                ),
              },
            ]}
          />

          <Button
            type="primary"
            block
            size="large"
            loading={submitting}
            disabled={totalOutputKg <= 0 || !inputWeightKg || !purchaseCost}
            onClick={onSubmit}
            style={{ borderRadius: 8 }}
          >
            Parçalamayı ve Maliyet Dağıtımını Onayla ({totalOutputKg.toFixed(1)} kg Çıkış · {(purchaseCost || 0).toFixed(2)} €)
          </Button>
        </div>
      </Modal>

      {/* ── DETAY MODALI ── */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={680}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>
              {ANIMAL_TYPES.find(a => a.key === detail?.operation.animal_type?.toLowerCase())?.emoji ?? '🐾'}
            </span>
            <span>Parçalama ve Maliyet Dağıtım Detayı</span>
          </div>
        }
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Küpe / Parti No">
                <strong>{detail.operation.animal_ear_tag || '—'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Hayvan Türü">
                {detail.operation.animal_type}
              </Descriptions.Item>
              <Descriptions.Item label="Giriş Karkas">
                {Number(detail.operation.input_weight_kg || detail.operation.total_output_kg).toFixed(2)} kg
              </Descriptions.Item>
              <Descriptions.Item label="Toplam Çıkış">
                <Tag color="blue">{Number(detail.operation.total_output_kg).toFixed(2)} kg</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Parçalama Firesi">
                <Tag color={Number(detail.operation.waste_kg) > 0 ? 'volcano' : 'green'}>
                  {Number(detail.operation.waste_kg).toFixed(2)} kg
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Toplam Alış Maliyeti">
                <strong style={{ color: '#f50' }}>{Number(detail.operation.total_cost).toFixed(2)} €</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Dağıtım Anahtarı" span={2}>
                {detail.operation.distribution_method === 'deger'
                  ? <Tag color="purple">💎 Değer (Piyasa Çarpanı) Ağırlıklı Dağıtım</Tag>
                  : <Tag color="cyan">⚖️ Miktar (Ağırlık) Ağırlıklı Dağıtım</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Kesim Tarihi" span={2}>
                {dayjs(detail.operation.operation_date).format('DD.MM.YYYY')}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Üretilen Parça Lotları ve Birim Maliyetleri">
              <Table
                dataSource={detail.parts}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Parça Adı', dataIndex: 'part_name', key: 'part_name', render: (v: string) => <strong>{v}</strong> },
                  { title: 'Lot No', dataIndex: 'lot_number', key: 'lot_number', render: (v: string) => <Tag>{v}</Tag> },
                  { title: 'Ağırlık', dataIndex: 'actual_weight_kg', key: 'actual_weight_kg', render: (v: number) => `${Number(v).toFixed(2)} kg` },
                  { title: 'Dağıtılan Maliyet', dataIndex: 'allocated_cost', key: 'allocated_cost', render: (v: number) => <strong style={{ color: '#0958d9' }}>{Number(v).toFixed(2)} €</strong> },
                  { title: 'Birim Maliyet', dataIndex: 'unit_cost', key: 'unit_cost', render: (v: number) => <Tag color="cyan">{Number(v).toFixed(2)} €/kg</Tag> },
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
