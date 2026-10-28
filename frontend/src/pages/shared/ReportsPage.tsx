import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Typography, Tabs, Table, Tag,
  Button, Space, Spin, Alert, Descriptions, Radio,
} from 'antd';
import {
  BarChartOutlined, ExperimentOutlined, ScissorOutlined,
  ShoppingOutlined, WarningOutlined, ReloadOutlined,
  ArrowDownOutlined, InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, mlService, anomalyService } from '../../services/api';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbStatus, formatDbPart } from '../../i18n/formatters';

const { Title, Text, Paragraph } = Typography;

export default function ReportsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  // Veri durumları
  const [summary, setSummary]           = useState<any>(null);
  const [butchery, setButchery]         = useState<any[]>([]);
  const [production, setProduction]     = useState<any[]>([]);
  const [lotMovements, setLotMovements] = useState<any[]>([]);
  const [sales, setSales]               = useState<any[]>([]);
  const [recalls, setRecalls]           = useState<any[]>([]);

  // ML Değerlendirme Verileri
  const [mlProdEval, setMlProdEval]     = useState<any>(null);
  const [mlButchEval, setMlButchEval]   = useState<any>(null);
  const [mlLoading, setMlLoading]       = useState(false);

  // Anomali ve Risk Verileri
  const [anomaliesData, setAnomaliesData] = useState<{ summary: any; anomalies: any[] }>({
    summary: { total: 0, critical: 0, warning: 0, info: 0, healthy: true },
    anomalies: [],
  });
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'critical' | 'warning'>('all');

  async function loadAllReports() {
    setLoading(true);
    try {
      const [sumRes, butchRes, prodRes, movRes, salesRes, recRes, anomRes] = await Promise.all([
        reportService.getSummary().catch(() => ({ data: null })),
        reportService.getButchery().catch(() => ({ data: [] })),
        reportService.getProduction().catch(() => ({ data: [] })),
        reportService.getLotMovements().catch(() => ({ data: [] })),
        reportService.getSales().catch(() => ({ data: [] })),
        reportService.getRecalls().catch(() => ({ data: [] })),
        anomalyService.getAll().catch(() => ({ data: { summary: { total: 0, critical: 0, warning: 0, info: 0, healthy: true }, anomalies: [] } })),
      ]);

      setSummary(sumRes.data);
      setButchery(butchRes.data || []);
      setProduction(prodRes.data || []);
      setLotMovements(movRes.data || []);
      setSales(salesRes.data || []);
      setRecalls(recRes.data || []);
      if (anomRes?.data) {
        setAnomaliesData(anomRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadMlEvaluation() {
    setMlLoading(true);
    try {
      const [pEval, bEval] = await Promise.all([
        mlService.evaluateProduction().catch(() => ({ data: null })),
        mlService.evaluateButchery('koyun').catch(() => ({ data: null })),
      ]);
      setMlProdEval(pEval.data);
      setMlButchEval(bEval.data);
    } finally {
      setMlLoading(false);
    }
  }

  useEffect(() => {
    loadAllReports();
    loadMlEvaluation();
  }, []);

  if (loading && !summary) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16 }}>Raporlar ve analiz verileri yükleniyor...</Paragraph>
      </div>
    );
  }

  // ── Kolon Tanımları ────────────────────────────────────────────────────────

  // 1. Parçalama Kolonları
  const butcheryColumns = [
    {
      title: 'Tarih',
      dataIndex: 'operation_date',
      key: 'operation_date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
    {
      title: 'Tür / Operatör',
      key: 'type',
      render: (_: unknown, r: any) => (
        <div>
          <Tag color="geekblue" style={{ textTransform: 'capitalize' }}>{r.animal_type}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.operator_name}</Text>
        </div>
      ),
    },
    {
      title: 'Giriş Ağırlığı',
      dataIndex: 'input_weight_kg',
      key: 'input_weight_kg',
      render: (v: number) => <Text strong>{v.toFixed(2)} kg</Text>,
    },
    {
      title: 'Net Çıktı',
      dataIndex: 'total_output_kg',
      key: 'total_output_kg',
      render: (v: number) => `${v.toFixed(2)} kg`,
    },
    {
      title: 'Fire Ağırlığı',
      dataIndex: 'waste_kg',
      key: 'waste_kg',
      render: (v: number) => <Text type="danger">{v.toFixed(2)} kg</Text>,
    },
    {
      title: 'Fire Oranı',
      dataIndex: 'waste_percent',
      key: 'waste_percent',
      render: (v: number) => (
        <Tag color={v > 12 ? 'red' : v > 7 ? 'orange' : 'green'}>
          %{v.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: 'Toplam Maliyet',
      dataIndex: 'total_cost',
      key: 'total_cost',
      render: (v: number) => `${v.toFixed(2)} €`,
    },
    {
      title: 'Maliyet Dengesi',
      key: 'cost_balance',
      render: (_: unknown, r: any) => {
        const partsTotal = (r.parts || []).reduce((sum: number, p: any) => sum + (p.allocated_cost || 0), 0);
        const balanced = Math.abs(partsTotal - r.total_cost) < 0.05;
        return (
          <Tag color={balanced ? 'success' : 'error'}>
            {balanced ? '✓ Tam Dengeli' : `Fark: ${(partsTotal - r.total_cost).toFixed(2)} €`}
          </Tag>
        );
      },
    },
  ];

  // 2. Üretim Kolonları (Sapma Gösterimli)
  const productionColumns = [
    {
      title: 'Üretim No',
      dataIndex: 'production_number',
      key: 'production_number',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Ürün Adı',
      dataIndex: 'product_name',
      key: 'product_name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Beklenen (Paket)',
      dataIndex: 'expected_qty',
      key: 'expected_qty',
      render: (v: number) => `${Math.round(Number(v))} Paket`,
    },
    {
      title: 'Gerçekleşen (Paket)',
      dataIndex: 'actual_qty',
      key: 'actual_qty',
      render: (v: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          {v ? `${Math.round(Number(v))} Paket` : '—'}
        </Text>
      ),
    },
    {
      title: 'Fire / Dolum Kaybı',
      key: 'fire',
      render: (_: unknown, r: any) => {
        if (!r.fire_qty && r.fire_qty !== 0) return '—';
        const rate = Number(r.fire_rate || 0);
        return (
          <Tag color={rate > 20 ? 'volcano' : 'blue'}>
            {Number(r.fire_qty).toFixed(2)} kg (%{rate.toFixed(1)})
          </Tag>
        );
      },
    },
    {
      title: 'Hammadde (€)',
      dataIndex: 'total_raw_cost',
      key: 'total_raw_cost',
      render: (v: number) => `${Number(v || 0).toFixed(2)} €`,
    },
    {
      title: 'Hizmet Bedeli (€)',
      dataIndex: 'service_cost',
      key: 'service_cost',
      render: (v: number) => `${Number(v || 0).toFixed(2)} €`,
    },
    {
      title: 'Gerçek EKP (€/paket)',
      dataIndex: 'ekp',
      key: 'ekp',
      render: (v: number) => (
        <Tag color="orange" style={{ fontWeight: 600 }}>
          {v ? `${Number(v).toFixed(4)} €` : '—'}
        </Tag>
      ),
    },
    {
      title: 'VKP (%38 Marj)',
      dataIndex: 'vkp',
      key: 'vkp',
      render: (v: number) => v ? `${Number(v).toFixed(4)} €` : '—',
    },
    {
      title: 'Brüt Kâr Marjı',
      dataIndex: 'brut_kar_marji',
      key: 'brut_kar_marji',
      render: (v: number) => (
        <Tag color={Number(v) > 20 ? 'green' : 'gold'}>
          %{Number(v || 0).toFixed(1)}
        </Tag>
      ),
    },
  ];

  // 3. Lot Hareketleri Kolonları
  const movementColumns = [
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Lot Numarası',
      key: 'lot_number',
      render: (_: unknown, r: any) => (
        <div>
          <Tag color={r.lot_status === 'recalled' ? 'red' : 'blue'}>{r.lot_number}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>({r.lot_type})</Text>
        </div>
      ),
    },
    {
      title: 'Hareket Türü',
      dataIndex: 'movement_type',
      key: 'movement_type',
      render: (v: string) => {
        const map: Record<string, { label: string; color: string }> = {
          giris:    { label: 'Giriş', color: 'green' },
          cikis:    { label: 'Çıkış', color: 'orange' },
          sevk:     { label: 'Sevk', color: 'blue' },
          satis:    { label: 'Satış', color: 'purple' },
          bloke:    { label: 'Bloke / Recall', color: 'red' },
          fire:     { label: 'Fire', color: 'default' },
        };
        const m = map[v] || { label: v, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: 'Miktar',
      key: 'qty',
      render: (_: unknown, r: any) => `${Number(r.quantity).toFixed(2)} ${r.unit}`,
    },
    {
      title: 'Kaynak → Hedef',
      key: 'transfer',
      render: (_: unknown, r: any) => (
        <Text style={{ fontSize: 12 }}>
          {r.from_user_name || 'Sistem / Alış'} → {r.to_user_name || 'İşletme / Stok'}
        </Text>
      ),
    },
    {
      title: 'Referans',
      key: 'ref',
      render: (_: unknown, r: any) => (
        <Tag style={{ fontSize: 11 }}>{r.reference_type} #{r.reference_id}</Tag>
      ),
    },
  ];

  // 4. Satış Kolonları
  const salesColumns = [
    {
      title: 'Tarih',
      dataIndex: 'purchase_date',
      key: 'purchase_date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Alıcı Market',
      dataIndex: 'market_name',
      key: 'market_name',
      render: (v: string, r: any) => (
        <div>
          <Text strong>{v}</Text>
          {r.market_phone && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.market_phone}</div>}
        </div>
      ),
    },
    {
      title: 'Ürün / Lot',
      key: 'product',
      render: (_: unknown, r: any) => (
        <div>
          <Text strong>{r.product_name || r.lot_number}</Text>
          <div><Tag color="blue">{r.lot_number}</Tag></div>
        </div>
      ),
    },
    {
      title: 'Miktar',
      key: 'quantity',
      render: (_: unknown, r: any) => `${Number(r.quantity).toFixed(2)} ${r.unit}`,
    },
    {
      title: 'Birim Fiyat',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (v: number, r: any) => `${Number(v).toFixed(2)} € / ${r.unit}`,
    },
    {
      title: 'Toplam Tutar',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (v: number) => <Tag color="green" style={{ fontSize: 13 }}>{Number(v).toFixed(2)} €</Tag>,
    },
    {
      title: 'Şikayet Durumu',
      key: 'complaint',
      render: (_: unknown, r: any) => (
        Number(r.complaint_count || 0) > 0 ? (
          <Tag color="red">⚠️ Sorun Bildirildi ({r.complaint_count})</Tag>
        ) : (
          <Tag color="green">✓ Sorunsuz</Tag>
        )
      ),
    },
  ];

  // 5. Geri Çağırma Kolonları
  const recallColumns = [
    {
      title: 'Başlangıç Tarihi',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Geri Çağrılan Lot',
      dataIndex: 'lot_number',
      key: 'lot_number',
      render: (v: string) => <Tag color="red" style={{ fontSize: 13, fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: 'Sebep / Gerekçe',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Text style={{ color: '#cf1322' }}>{v}</Text>,
    },
    {
      title: 'Etkilenen Market',
      dataIndex: 'affected_count',
      key: 'affected_count',
      render: (v: number) => <Tag color="volcano">{v} Market</Tag>,
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={v === 'aktif' ? 'error' : 'success'}>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Başlatan',
      dataIndex: 'initiator_name',
      key: 'initiator_name',
    },
  ];

  return (
    <div>
      {/* Üst Başlık & Eylemler */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BarChartOutlined /> {t('reports.title')}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('reports.subtitle')}
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadAllReports(); loadMlEvaluation(); }}>
            {t('common.refresh')}
          </Button>
        </Space>
      </div>

      {/* ── Üst KPI Kartları ─────────────────────────────────────────────────── */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #1890ff' }}>
              <Statistic
                title={t('dashboard.kpiTotalRawCost')}
                value={summary.rawMaterials?.totalCost || 0}
                precision={2}
                suffix="€"
                valueStyle={{ color: '#1890ff' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {summary.rawMaterials?.itemCount || 0} {t('common.quantity')}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #fa8c16' }}>
              <Statistic
                title={t('dashboard.kpiAvgEkp')}
                value={summary.production?.avgEkp || 0}
                precision={4}
                suffix="€/kg"
                valueStyle={{ color: '#fa8c16' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                VKP: {summary.production?.avgVkp?.toFixed(4)} € · Marj: %{summary.production?.avgMarginPercent}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #52c41a' }}>
              <Statistic
                title={t('dashboard.kpiSalesRevenue')}
                value={summary.sales?.totalRevenue || 0}
                precision={2}
                suffix="€"
                valueStyle={{ color: '#52c41a' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {summary.sales?.saleCount || 0} {t('nav.sales')} · {summary.sales?.totalSoldQty || 0} {t('common.unit')}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #cf1322' }}>
              <Statistic
                title={t('dashboard.kpiWasteRate')}
                value={summary.butchery?.averageWastePercent || 0}
                precision={2}
                suffix="%"
                valueStyle={{ color: (summary.butchery?.averageWastePercent || 0) > 10 ? '#cf1322' : '#52c41a' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {summary.lots?.recalledLots || 0} {t('common.recalled')} / {t('common.blocked')}
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Raporlama Sekmeleri ──────────────────────────────────────────────── */}
      <Tabs
        defaultActiveKey="production"
        type="card"
        size="small"
        tabBarGutter={6}
        items={[
          // SEKME 1: ÜRETİM VE EKP MALİYET RAPORU
          {
            key: 'production',
            label: <span><ExperimentOutlined /> {t('reports.tabProduction')}</span>,
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={t('reports.ekpLogicTitle')}
                  description={t('reports.ekpLogicDesc')}
                />
                <Table
                  dataSource={production}
                  columns={productionColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },

          // SEKME 2: PARÇALAMA VE FİRE DENGE RAPORU
          {
            key: 'butchery',
            label: <span><ScissorOutlined /> {t('reports.tabButchery')}</span>,
            children: (
              <div>
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={t('butchery.principleTitle')}
                  description={t('reports.conservationDesc')}
                />
                <Table
                  dataSource={butchery}
                  columns={butcheryColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <div style={{ margin: '8px 16px', background: '#fafafa', padding: 16, borderRadius: 8 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('butchery.producedLotsTitle')}:</Text>
                        <Row gutter={[8, 8]}>
                          {(record.parts || []).map((p: any) => (
                            <Col span={6} key={p.id}>
                              <Card size="small">
                                <Text strong>{formatDbPart(p.part_name, t)}</Text>
                                <div><Tag color="blue">{p.actual_weight_kg} kg</Tag> <Tag color="cyan">%{p.ratio_percent}</Tag></div>
                                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                                  {t('common.totalCost')}: {p.allocated_cost} € ({p.unit_cost} €/kg)
                                </div>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    ),
                  }}
                />
              </div>
            ),
          },

          // SEKME 3: LOT HAREKETLERİ DENETİM İZİ
          {
            key: 'movements',
            label: <span><InboxOutlined /> {t('reports.tabMovements')}</span>,
            children: (
              <div>
                <Table
                  dataSource={lotMovements}
                  columns={movementColumns}
                  rowKey="id"
                  pagination={{ pageSize: 15 }}
                />
              </div>
            ),
          },

          // SEKME 4: SATIŞ VE CİRO RAPORU
          {
            key: 'sales',
            label: <span><ShoppingOutlined /> {t('reports.tabSales')}</span>,
            children: (
              <div>
                <Table
                  dataSource={sales}
                  columns={salesColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },

          // SEKME 5: GERİ ÇAĞIRMA (RECALL) RAPORU
          {
            key: 'recalls',
            label: <span><WarningOutlined /> {t('reports.tabRecalls')}</span>,
            children: (
              <div>
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={t('recalls.title')}
                  description={t('reports.recallScenarioDesc')}
                />
                <Table
                  dataSource={recalls}
                  columns={recallColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <div style={{ margin: '8px 16px', background: '#fff1f0', padding: 12, borderRadius: 8, border: '1px solid #ffa39e' }}>
                        <Text strong style={{ color: '#cf1322', display: 'block', marginBottom: 6 }}>
                          {t('recalls.affectedMarkets')} ({record.affectedMarkets?.length || 0}):
                        </Text>
                        <Row gutter={[12, 12]}>
                          {(record.affectedMarkets || []).map((m: any, idx: number) => (
                            <Col span={8} key={idx}>
                              <Card size="small" style={{ background: '#fff' }}>
                                <Text strong>{m.market_name}</Text>
                                <div>{t('common.phone')}: {m.market_phone || '—'}</div>
                                <div>{t('common.quantity')}: <Tag color="volcano">{m.quantity} {formatUnit(m.unit, t)}</Tag></div>
                                <div>{t('common.status')}: <Tag color="red">{formatDbStatus(m.status, t)}</Tag></div>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    ),
                  }}
                />
              </div>
            ),
          },

          // SEKME 6: YAPAY ZEKA (ML) DOĞRULAMA VE REFERANS MODEL KARŞILAŞTIRMASI
          {
            key: 'ml_evaluation',
            label: <span>🤖 {t('reports.tabMl')}</span>,
            children: (
              <div>
                {mlLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : (
                  <div>
                    {/* Model A Değerlendirme Kartı */}
                    {mlProdEval && (
                      <Card
                        title={
                          <Space>
                            <ExperimentOutlined style={{ color: '#1890ff' }} />
                            <span>{mlProdEval.model_name} — {t('reports.mlModelTitle')}</span>
                          </Space>
                        }
                        style={{ marginBottom: 20, borderRadius: 10 }}
                      >
                        <Alert
                          type="success"
                          showIcon
                          style={{ marginBottom: 16 }}
                          message={t('reports.modelPerformance')}
                          description={mlProdEval.comparison?.summary}
                        />

                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          {/* Baseline Model */}
                          <Col span={12}>
                            <Card size="small" title={t('reports.baselineTitle')} style={{ background: '#fafafa' }}>
                              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                                {mlProdEval.baseline_model?.name}
                              </Paragraph>
                              <Descriptions size="small" column={2} bordered>
                                <Descriptions.Item label={t('reports.maeQty')}>
                                  {mlProdEval.baseline_model?.quantity_metrics?.mae} kg
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.rmseQty')}>
                                  {mlProdEval.baseline_model?.quantity_metrics?.rmse} kg
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.mapeQty')}>
                                  %{mlProdEval.baseline_model?.quantity_metrics?.mape}
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.maeEkp')}>
                                  {mlProdEval.baseline_model?.ekp_metrics?.mae} €
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.rmseEkp')}>
                                  {mlProdEval.baseline_model?.ekp_metrics?.rmse} €
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.mapeEkp')}>
                                  %{mlProdEval.baseline_model?.ekp_metrics?.mape}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>
                          </Col>

                          {/* ML Model */}
                          <Col span={12}>
                            <Card size="small" title={t('reports.mlModelTitle')} style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                                {mlProdEval.ml_model?.name} · {mlProdEval.sample_count} {t('common.details')}
                              </Paragraph>
                              <Descriptions size="small" column={2} bordered>
                                <Descriptions.Item label={t('reports.maeQty')}>
                                  <Text strong style={{ color: '#52c41a' }}>
                                    {mlProdEval.ml_model?.quantity_metrics?.mae} kg
                                  </Text>
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.rmseQty')}>
                                  {mlProdEval.ml_model?.quantity_metrics?.rmse} kg
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.r2Qty')}>
                                  {mlProdEval.ml_model?.quantity_metrics?.r2}
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.maeEkp')}>
                                  <Text strong style={{ color: '#52c41a' }}>
                                    {mlProdEval.ml_model?.ekp_metrics?.mae} €
                                  </Text>
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.rmseEkp')}>
                                  {mlProdEval.ml_model?.ekp_metrics?.rmse} €
                                </Descriptions.Item>
                                <Descriptions.Item label={t('reports.r2Ekp')}>
                                  {mlProdEval.ml_model?.ekp_metrics?.r2}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>
                          </Col>
                        </Row>

                        <Descriptions size="small" bordered column={1}>
                          <Descriptions.Item label={t('reports.featuresUsed')}>
                            {mlProdEval.features?.join(', ')}
                          </Descriptions.Item>
                          <Descriptions.Item label={t('reports.modelApproach')}>
                            {mlProdEval.methodology}
                          </Descriptions.Item>
                          <Descriptions.Item label={t('reports.limitations')}>
                            {mlProdEval.limitations}
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    )}

                    {/* Model B Değerlendirme Kartı */}
                    {mlButchEval && (
                      <Card
                        title={
                          <Space>
                            <ScissorOutlined style={{ color: '#52c41a' }} />
                            <span>{mlButchEval.model_name} — {t('reports.mlModelTitle')}</span>
                          </Space>
                        }
                        style={{ borderRadius: 10 }}
                      >
                        <Alert
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                          message={t('reports.butcheryYieldEval')}
                          description={mlButchEval.comparison?.summary}
                        />

                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          <Col span={12}>
                            <Card size="small" title={t('reports.fixedRecipeRef')} style={{ background: '#fafafa' }}>
                              <Statistic
                                title={t('reports.avgPartError')}
                                value={mlButchEval.baseline_model?.average_mae_kg}
                                precision={4}
                                suffix="kg"
                              />
                            </Card>
                          </Col>
                          <Col span={12}>
                            <Card size="small" title={t('reports.mlRegression')} style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                              <Statistic
                                title={t('reports.avgPartError')}
                                value={mlButchEval.ml_model?.average_mae_kg}
                                precision={4}
                                suffix="kg"
                                valueStyle={{ color: '#52c41a' }}
                                prefix={<ArrowDownOutlined />}
                              />
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                %{mlButchEval.comparison?.mae_reduction_percent} {t('reports.errorReduction')}
                              </Text>
                            </Card>
                          </Col>
                        </Row>

                        <Table
                          size="small"
                          dataSource={mlButchEval.part_breakdown || []}
                          rowKey="part_name"
                          pagination={false}
                          style={{ marginBottom: 16 }}
                          columns={[
                            { title: t('butchery.partName'), dataIndex: 'part_name', key: 'part_name', render: (v: string) => <strong>{formatDbPart(v, t)}</strong> },
                            { title: t('reports.recipeRatio'), dataIndex: 'recipe_ratio', key: 'recipe_ratio', render: (v: number) => `%${(v * 100).toFixed(1)}` },
                            { title: t('reports.avgActual'), dataIndex: 'avg_actual_kg', key: 'avg_actual_kg', render: (v: number) => `${v} kg` },
                            { title: 'Baseline MAE (kg)', dataIndex: 'baseline_mae_kg', key: 'baseline_mae_kg', render: (v: number) => `${v.toFixed(3)} kg` },
                            { title: 'ML MAE (kg)', dataIndex: 'ml_mae_kg', key: 'ml_mae_kg', render: (v: number) => <Tag color="green">{v.toFixed(3)} kg</Tag> },
                          ]}
                        />

                        <Descriptions size="small" bordered column={1}>
                          <Descriptions.Item label={t('reports.modelApproach')}>
                            {mlButchEval.methodology}
                          </Descriptions.Item>
                          <Descriptions.Item label={t('reports.limitations')}>
                            {mlButchEval.limitations}
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            ),
          },

          // SEKME 7: AKILLI ANOMALİ VE RİSK İZLEME
          {
            key: 'anomalies',
            label: (
              <Space size={4}>
                <span>🚨 {t('reports.tabAnomalies')}</span>
                {anomaliesData.summary?.total > 0 && (
                  <Tag
                    color={anomaliesData.summary?.critical > 0 ? 'red' : 'orange'}
                    style={{ margin: 0, padding: '0 5px', fontSize: 11, lineHeight: '16px', borderRadius: 10 }}
                  >
                    {anomaliesData.summary?.total}
                  </Tag>
                )}
              </Space>
            ),
            children: (
              <div>
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={t('reports.anomalySystemTitle')}
                  description={t('reports.anomalySystemDesc')}
                />

                {/* Anomali İstatistik Kartları */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card size="small" style={{ borderLeft: '4px solid #1890ff' }}>
                      <Statistic
                        title={t('reports.anomalyTotalDetected')}
                        value={anomaliesData.summary?.total || 0}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ borderLeft: '4px solid #ff4d4f' }}>
                      <Statistic
                        title={t('reports.anomalyCritical')}
                        value={anomaliesData.summary?.critical || 0}
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ borderLeft: '4px solid #faad14' }}>
                      <Statistic
                        title={t('reports.anomalyWarning')}
                        value={anomaliesData.summary?.warning || 0}
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ borderLeft: `4px solid ${anomaliesData.summary?.healthy ? '#52c41a' : '#ff4d4f'}` }}>
                      <Statistic
                        title={t('reports.anomalyNormal')}
                        value={anomaliesData.summary?.healthy ? t('common.success') : t('common.error')}
                        valueStyle={{ color: anomaliesData.summary?.healthy ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Filtreleme */}
                <div style={{ marginBottom: 16 }}>
                  <Radio.Group
                    value={anomalyFilter}
                    onChange={e => setAnomalyFilter(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="all">{t('common.all')} ({anomaliesData.summary?.total || 0})</Radio.Button>
                    <Radio.Button value="critical">🚨 {t('reports.anomalyCritical')} ({anomaliesData.summary?.critical || 0})</Radio.Button>
                    <Radio.Button value="warning">⚠️ {t('reports.anomalyWarning')} ({anomaliesData.summary?.warning || 0})</Radio.Button>
                  </Radio.Group>
                </div>

                {/* Anomali Tablosu */}
                <Table
                  dataSource={
                    anomalyFilter === 'all'
                      ? anomaliesData.anomalies
                      : anomaliesData.anomalies.filter(a => a.severity === anomalyFilter)
                  }
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: t('reports.severity'),
                      dataIndex: 'severity',
                      key: 'severity',
                      width: 100,
                      render: (v: string) => (
                        <Tag color={v === 'critical' ? 'red' : v === 'warning' ? 'orange' : 'blue'}>
                          {v === 'critical' ? t('reports.critical') : v === 'warning' ? t('reports.warning') : t('reports.info')}
                        </Tag>
                      ),
                    },
                    {
                      title: t('reports.relatedEntity'),
                      dataIndex: 'entity_code',
                      key: 'entity_code',
                      width: 150,
                      render: (v: string, r: any) => (
                        <div>
                          <Text strong>{v}</Text>
                          <div><Tag style={{ fontSize: 10 }}>{r.entity_type}</Tag></div>
                        </div>
                      ),
                    },
                    {
                      title: t('reports.anomalyTitleAndDetail'),
                      key: 'details',
                      render: (_: unknown, r: any) => (
                        <div>
                          <Text strong style={{ color: r.severity === 'critical' ? '#cf1322' : '#d46b08' }}>
                            {r.title}
                          </Text>
                          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
                            {r.description}
                          </Paragraph>
                          <div style={{ background: '#fffbe6', padding: '6px 10px', borderRadius: 6, border: '1px solid #ffe58f', fontSize: 12 }}>
                            <Text strong style={{ color: '#ad6800' }}>{t('reports.suggestedAction')}</Text>
                            <span>{r.suggested_action}</span>
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: t('reports.measuredThreshold'),
                      key: 'metric',
                      width: 160,
                      render: (_: unknown, r: any) => (
                        <div>
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>{t('reports.measured')}</Text>
                            <Text strong style={{ color: '#ff4d4f' }}>{r.metric_value} {r.metric_unit}</Text>
                          </div>
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>{t('reports.threshold')}</Text>
                            <Text strong>{r.threshold_value} {r.metric_unit}</Text>
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: t('common.date'),
                      dataIndex: 'created_at',
                      key: 'created_at',
                      width: 120,
                      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
