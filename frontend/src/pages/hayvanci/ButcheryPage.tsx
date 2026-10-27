import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, DatePicker, InputNumber,
  Typography, Tag, Descriptions, Divider,
  Space, Spin, Alert, App,
} from 'antd';
import {
  ScissorOutlined, PlusOutlined, EyeOutlined, CheckCircleFilled,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { butcheryService, mlService } from '../../services/api';

const { Title, Text } = Typography;

// ─── Hayvan türü tanımları ────────────────────────────────────────────────────
type AnimalKey = 'inek' | 'koyun' | 'tavuk';

interface AnimalType {
  key: AnimalKey;
  emoji: string;
  label: string;
  parts: string[];
}

const ANIMAL_TYPES: AnimalType[] = [
  {
    key: 'inek',
    emoji: '🐄',
    label: 'İnek',
    parts: ['Gerdan', 'Antrikot', 'Kaburga', 'Kontrifile', 'Bonfile', 'Sokum', 'Bağırsak', 'Kol'],
  },
  {
    key: 'koyun',
    emoji: '🐑',
    label: 'Koyun / Kuzu',
    parts: ['Pirzola', 'But', 'Kol', 'Kaburga', 'Bağırsak', 'Gerdan', 'İncik'],
  },
  {
    key: 'tavuk',
    emoji: '🐔',
    label: 'Tavuk',
    parts: ['Bütün Tavuk'],
  },
];

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface PartWeight {
  part_name: string;
  weight_kg: number | null;
}

interface ButcheryRecord {
  id: number;
  animal_type: string;
  operation_date: string;
  total_output_kg: number;
  waste_kg: number;
  total_cost: number;
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

// ML tahmin sonucu
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

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function ButcheryPage() {
  const { message } = App.useApp();
  const [operations, setOperations] = useState<ButcheryRecord[]>([]);
  const [loading, setLoading]       = useState(true);

  // Modal — Adım 1: hayvan türü seçimi
  const [step1Open, setStep1Open]       = useState(false);
  const [selectedType, setSelectedType] = useState<AnimalType | null>(null);

  // Modal — Adım 2: parça kiloları + tarih
  const [step2Open, setStep2Open]   = useState(false);
  const [partWeights, setPartWeights] = useState<PartWeight[]>([]);
  const [cutDate, setCutDate]       = useState<Dayjs>(dayjs());
  const [submitting, setSubmitting] = useState(false);

  // Detay modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail]         = useState<{ operation: ButcheryRecord; parts: PartDetail[] } | null>(null);

  // Tablo filtresi
  const [filterBefore, setFilterBefore] = useState<Dayjs | null>(null);

  // ML tahmin
  const [mlResult, setMlResult]     = useState<MLButcheryResult | null>(null);
  const [mlLoading, setMlLoading]   = useState(false);

  // ─── Veri yükle ─────────────────────────────────────────────────────────────
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

  // ─── Adım 1: tür seçildi → adım 2'ye geç ───────────────────────────────────
  function onTypeConfirm() {
    if (!selectedType) return;
    setPartWeights(selectedType.parts.map(p => ({ part_name: p, weight_kg: null })));
    setMlResult(null);
    setStep1Open(false);
    setStep2Open(true);
    // ML tahminini arka planda başlat (entry_weight_kg henüz yok — 0 gönder, ratio döner)
    fetchMlPrediction(selectedType.key, 0);
  }

  async function fetchMlPrediction(animalKey: string, entryKg: number) {
    setMlLoading(true);
    try {
      const { data } = await mlService.predictButchery({
        animal_type:     animalKey,
        entry_weight_kg: entryKg,
        purchase_cost:   0,
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

  // ─── Kaydet ─────────────────────────────────────────────────────────────────
  async function onSubmit() {
    if (!selectedType) return;

    const empty = partWeights.filter(p => p.weight_kg === null || p.weight_kg <= 0);
    if (empty.length > 0) {
      message.error('Tüm parçalar için kilogram giriniz');
      return;
    }

    setSubmitting(true);
    try {
      await butcheryService.create({
        animal_type:    selectedType.key,
        operation_date: cutDate.format('YYYY-MM-DD'),
        notes:          undefined,
        parts: partWeights.map(p => ({
          part_name:        p.part_name,
          actual_weight_kg: p.weight_kg ?? 0,
          is_byproduct:     false,
        })),
      });
      message.success('Parçalama kaydedildi');
      setStep2Open(false);
      setSelectedType(null);
      setPartWeights([]);
      setCutDate(dayjs());
      loadOperations();
    } catch {
      message.error('Kayıt sırasında hata oluştu');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Detay ──────────────────────────────────────────────────────────────────
  async function viewDetail(id: number) {
    try {
      const { data } = await butcheryService.getById(id);
      setDetail(data);
      setDetailOpen(true);
    } catch {
      message.error('Detay yüklenemedi');
    }
  }

  // ─── Filtrelenmiş liste ──────────────────────────────────────────────────────
  const filtered = filterBefore
    ? operations.filter(op => dayjs(op.operation_date).isBefore(filterBefore, 'day') || dayjs(op.operation_date).isSame(filterBefore, 'day'))
    : operations;

  // ─── Tablo kolonları ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Hayvan Türü', dataIndex: 'animal_type', key: 'animal_type',
      render: (v: string) => {
        const t = ANIMAL_TYPES.find(a => a.key === v?.toLowerCase() || a.label.toLowerCase().includes(v?.toLowerCase()));
        return <span>{t?.emoji ?? '🐾'} {v}</span>;
      },
    },
    {
      title: 'Kesim Tarihi', dataIndex: 'operation_date', key: 'operation_date',
      render: (v: string) => v ? dayjs(v).format('DD.MM.YYYY') : '-',
      sorter: (a: ButcheryRecord, b: ButcheryRecord) =>
        dayjs(a.operation_date).unix() - dayjs(b.operation_date).unix(),
    },
    {
      title: 'Toplam Çıkış', dataIndex: 'total_output_kg', key: 'total_output_kg',
      render: (v: number) => v ? <Tag color="blue">{Number(v).toFixed(2)} kg</Tag> : '-',
    },
    {
      title: 'Fire', dataIndex: 'waste_kg', key: 'waste_kg',
      render: (v: number) => Number(v) > 0.001
        ? <Tag color="orange">{Number(v).toFixed(3)} kg</Tag>
        : <Tag color="green">—</Tag>,
    },
    {
      title: 'Maliyet', dataIndex: 'total_cost', key: 'total_cost',
      render: (v: number) => v ? `${Number(v).toFixed(2)} €` : '-',
    },
    {
      title: '', key: 'action',
      render: (_: unknown, r: ButcheryRecord) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>Detay</Button>
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Başlık + Filtre + Yeni buton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}><ScissorOutlined /> Parçalama İşlemleri</Title>
        <Space>
          <Text type="secondary">Şu tarihten önce:</Text>
          <DatePicker
            format="DD.MM.YYYY"
            placeholder="Tarih filtrele"
            value={filterBefore}
            onChange={v => setFilterBefore(v)}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedType(null); setStep1Open(true); }}>
            Yeni Parçalama
          </Button>
        </Space>
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* ── ADIM 1: Hayvan Türü Seçimi ── */}
      <Modal
        open={step1Open}
        onCancel={() => setStep1Open(false)}
        footer={null}
        width={520}
        centered
        title={
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <Title level={4} style={{ margin: 0 }}>Hayvan Türü Seçin</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Parçalanacak hayvanı seçin</Text>
          </div>
        }
      >
        {/* 3 kare */}
        <div style={{ display: 'flex', gap: 12, margin: '24px 0 20px' }}>
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
          Devam Et →
        </Button>
      </Modal>

      {/* ── ADIM 2: Parça Kiloları + Tarih ── */}
      <Modal
        open={step2Open}
        onCancel={() => setStep2Open(false)}
        footer={null}
        width={540}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{selectedType?.emoji}</span>
            <span>{selectedType?.label} — Parça Kiloları</span>
          </div>
        }
      >
        <div style={{ marginBottom: 20 }}>

          {/* ── ML Tahmin Kartı ── */}
          {mlLoading && (
            <div style={{ textAlign: 'center', padding: '12px 0', marginBottom: 12 }}>
              <Spin size="small" />
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                <RobotOutlined /> Geçmiş verilerden tahmin hesaplanıyor...
              </Text>
            </div>
          )}
          {!mlLoading && mlResult && (
            <div style={{
              background: '#f9f0ff', border: '1.5px solid #d3adf7',
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong style={{ color: '#531dab', fontSize: 13 }}>
                  <RobotOutlined /> AI Beklenti Tahmini
                </Text>
                {(() => {
                  const lbl = confidenceLabel(mlResult.method, mlResult.sample_count);
                  return <Tag color={lbl.color === '#52c41a' ? 'green' : lbl.color === '#faad14' ? 'orange' : 'default'}>{lbl.text}</Tag>;
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {mlResult.parts.map(p => (
                  <div key={p.part_name} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, padding: '3px 0', borderBottom: '1px solid #efe8ff',
                  }}>
                    <Text style={{ fontSize: 12 }}>{p.part_name}</Text>
                    <Text style={{ fontSize: 12 }}>
                      %{(p.expected_ratio * 100).toFixed(1)} oranında
                    </Text>
                  </div>
                ))}
                {mlResult.predicted_waste_kg > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Tahmini Fire</Text>
                    <Tag color="orange">%{(mlResult.predicted_waste_kg / (mlResult.total_predicted_kg || 1) * 100).toFixed(1)}</Tag>
                  </div>
                )}
              </div>
              <Alert
                message={mlResult.notes}
                type="info"
                style={{ marginTop: 8, fontSize: 11 }}
                showIcon={false}
              />
            </div>
          )}

          {/* Parça satırları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {partWeights.map((p, idx) => (
              <div
                key={p.part_name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#fafafa',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                }}
              >
                <Text strong style={{ minWidth: 110 }}>{p.part_name}</Text>
                <InputNumber
                  min={0}
                  max={9999}
                  step={0.1}
                  precision={2}
                  placeholder="0.00"
                  value={p.weight_kg}
                  onChange={v => updateWeight(idx, v)}
                  addonAfter="kg"
                  style={{ width: 160 }}
                />
              </div>
            ))}
          </div>

          {/* Özet satırı */}
          {partWeights.some(p => p.weight_kg && p.weight_kg > 0) && (
            <div style={{
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <Text type="secondary">Toplam</Text>
              <Text strong style={{ color: '#52c41a' }}>
                {partWeights.reduce((s, p) => s + (p.weight_kg || 0), 0).toFixed(2)} kg
              </Text>
            </div>
          )}

          {/* Kesim tarihi */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            marginBottom: 20,
          }}>
            <Text strong>Kesim Tarihi</Text>
            <DatePicker
              format="DD.MM.YYYY"
              value={cutDate}
              onChange={v => setCutDate(v ?? dayjs())}
              style={{ width: 160 }}
            />
          </div>

          <Button
            type="primary"
            block
            size="large"
            loading={submitting}
            onClick={onSubmit}
            style={{ borderRadius: 8 }}
          >
            Kaydet
          </Button>
        </div>
      </Modal>

      {/* ── Detay Modal ── */}
      <Modal
        title="Parçalama Detayı"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" style={{ marginBottom: 16 }} column={2}>
              <Descriptions.Item label="Hayvan Türü">{detail.operation.animal_type}</Descriptions.Item>
              <Descriptions.Item label="Kesim Tarihi">
                {dayjs(detail.operation.operation_date).format('DD.MM.YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Toplam Çıkış">{Number(detail.operation.total_output_kg).toFixed(2)} kg</Descriptions.Item>
              <Descriptions.Item label="Fire">
                {Number(detail.operation.waste_kg) > 0 ? `${Number(detail.operation.waste_kg).toFixed(3)} kg` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Toplam Maliyet" span={2}>
                {Number(detail.operation.total_cost) > 0 ? `${Number(detail.operation.total_cost).toFixed(2)} €` : '—'}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '12px 0' }}>Parçalar</Divider>

            <Table
              dataSource={detail.parts}
              rowKey="part_name"
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Parça', dataIndex: 'part_name', key: 'part_name',
                  render: (v: string, r: PartDetail) =>
                    r.is_byproduct ? <Tag color="orange">{v}</Tag> : <strong>{v}</strong>,
                },
                {
                  title: 'Ağırlık', dataIndex: 'actual_weight_kg', key: 'actual_weight_kg',
                  render: (v: number) => `${Number(v).toFixed(2)} kg`,
                },
                {
                  title: 'Birim Maliyet', dataIndex: 'unit_cost', key: 'unit_cost',
                  render: (v: number) => Number(v) > 0 ? `${Number(v).toFixed(4)} €/kg` : '—',
                },
                {
                  title: 'Lot No', dataIndex: 'lot_number', key: 'lot_number',
                  render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '—',
                },
              ]}
              summary={rows => {
                const total = (rows as PartDetail[]).reduce((s, r) => s + (Number(r.actual_weight_kg) || 0), 0);
                return (
                  <Table.Summary.Row style={{ fontWeight: 'bold', background: '#fafafa' }}>
                    <Table.Summary.Cell index={0}>Toplam</Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>{total.toFixed(3)} kg</Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                    <Table.Summary.Cell index={3} />
                  </Table.Summary.Row>
                );
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
