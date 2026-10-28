import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Typography, Tag, Descriptions,
  Divider, Space, InputNumber, DatePicker, Alert, App,
  Row, Col, Statistic, Card,
} from 'antd';
import {
  CheckCircleFilled, EyeOutlined,
  ReloadOutlined, ExperimentOutlined, FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { productionService, invoiceService } from '../../services/api';
import { Invoice } from '../../types';
import { InvoiceModal } from '../../components/InvoiceModal';
import { formatMoney, convertToEur, CurrencySelect, EurEquivalentPreview } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbStatus, formatDbPart, formatDbProduct } from '../../i18n/formatters';

const { Title, Text } = Typography;

// ── Tipler ───────────────────────────────────────────────────────────────────
interface ProductionOrder {
  id: number;
  order_id: number;
  buyer_name: string;
  production_number: string;
  product_name: string;
  expected_qty: number;
  actual_qty?: number;
  package_weight?: number;
  total_input_kg?: number;
  fire_qty?: number;
  fire_rate?: number;
  service_cost?: number;
  total_raw_cost?: number;
  ekp?: number;
  status: string;
  production_date?: string;
  created_at: string;
}

interface RawMaterial {
  id: number;
  material_type: string;
  quantity_used: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  lot_number: string;
}

interface FinishedLot {
  id: number;
  lot_number: string;
  quantity: number;
  unit: string;
}

interface CompletionResult {
  lotNumber: string;
  actualQty: number;
  packageWeight?: number;
  totalInputKg?: number;
  fireQty?: number;
  fireRate?: number;
  totalRawCost: number;
  serviceCost: number;
  totalCost: number;
  ekp: number;
  vkp: number;
  brutKar: number;
  marj: number;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  beklemede:   { color: 'orange', label: 'Beklemede' },
  uretimde:    { color: 'blue',   label: 'Üretimde' },
  tamamlandi:  { color: 'green',  label: 'Tamamlandı' },
  sevk_edildi: { color: 'purple', label: 'Sevk Edildi' },
};

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function ProductionPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const [productions, setProductions] = useState<ProductionOrder[]>([]);
  const [loading, setLoading]         = useState(true);

  // Detay
  const [detailOpen, setDetailOpen]   = useState(false);
  const [detail, setDetail]           = useState<{
    productionOrder: ProductionOrder;
    rawMaterials: RawMaterial[];
    finishedLots: FinishedLot[];
  } | null>(null);

  // Tamamlama
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting]     = useState<ProductionOrder | null>(null);
  const [actualQty, setActualQty]       = useState<number | null>(null);
  const [serviceCost, setServiceCost]   = useState<number | null>(null);
  const [serviceCurrency, setServiceCurrency] = useState<string>('EUR');
  const [productionDate, setProductionDate] = useState<Dayjs>(dayjs());
  const [submitting, setSubmitting]     = useState(false);
  const [result, setResult]             = useState<CompletionResult | null>(null);
  const [orderInputKg, setOrderInputKg] = useState<number>(0);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  async function openInvoice(prodId: number) {
    try {
      const { data } = await invoiceService.getAll({ reference_type: 'production_order', reference_id: prodId });
      if (data && data.length > 0) {
        setSelectedInvoice(data[0]);
        setInvoiceModalVisible(true);
      } else {
        message.warning('Bu üretim emrine ait fatura bulunamadı');
      }
    } catch {
      message.error('Fatura yüklenemedi');
    }
  }

  // ── Yükleme ─────────────────────────────────────────────────────────────
  async function loadProductions() {
    try {
      const { data } = await productionService.getAll();
      setProductions(data);
    } catch {
      message.error('Üretim emirleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProductions(); }, []);

  // Detay
  async function viewDetail(id: number) {
    try {
      const { data } = await productionService.getById(id);
      setDetail(data);
      setDetailOpen(true);
    } catch {
      message.error('Detay yüklenemedi');
    }
  }

  // Tamamlama
  async function openComplete(prod: ProductionOrder) {
    setCompleting(prod);
    const initialQty = Math.round(Number(prod.expected_qty)) || 1;
    setActualQty(initialQty);
    setServiceCost(null);
    setProductionDate(dayjs());
    setResult(null);
    setOrderInputKg(0);
    setCompleteOpen(true);

    try {
      const { data } = await productionService.getById(prod.id);
      if (data && data.rawMaterials) {
        const total = data.rawMaterials.reduce((sum: number, rm: { quantity_used: number }) => sum + Number(rm.quantity_used || 0), 0);
        setOrderInputKg(total);
      }
    } catch {
      // sessizce geç
    }
  }

  async function submitComplete() {
    if (!completing || !actualQty || !serviceCost) return;
    setSubmitting(true);
    try {
      const costInEur = convertToEur(serviceCost, serviceCurrency);
      const { data } = await productionService.complete(completing.id, {
        actual_qty:      actualQty,
        service_cost:    costInEur,
        production_date: productionDate.format('YYYY-MM-DD'),
      });
      setResult(data);
      loadProductions();
    } catch {
      message.error('Üretim tamamlanamadı');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Tablo ────────────────────────────────────────────────────────────────
  const columns = [
    {
      title: t('production.productionNo'), dataIndex: 'production_number', key: 'production_number',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('roles.hayvanci'), dataIndex: 'buyer_name', key: 'buyer_name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: t('production.productName'), dataIndex: 'product_name', key: 'product_name',
      render: (v: string) => <strong>{formatDbProduct(v, t)}</strong>,
    },
    {
      title: t('production.expectedQty'), dataIndex: 'expected_qty', key: 'expected_qty',
      render: (v: number) => `${Math.round(Number(v))} ${t('production.packageUnit')}`,
    },
    {
      title: t('production.actualQty'), dataIndex: 'actual_qty', key: 'actual_qty',
      render: (v: number) => v ? <Text strong style={{ color: '#52c41a' }}>{Math.round(Number(v))} {t('production.packageUnit')}</Text> : '—',
    },
    {
      title: t('butchery.wasteLoss'), key: 'fire',
      render: (_: unknown, r: ProductionOrder) => {
        if (r.status !== 'tamamlandi' && r.status !== 'sevk_edildi') return '—';
        const rate = Number(r.fire_rate || 0);
        return (
          <Space size={4}>
            <Tag color={rate > 20 ? 'volcano' : 'blue'}>
              {Number(r.fire_qty || 0).toFixed(2)} kg (%{rate.toFixed(1)})
            </Tag>
            {rate > 20 && (
              <Tag color="red" icon={<WarningOutlined />} style={{ fontWeight: 600 }}>
                {t('reports.tabAnomalies')}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: t('production.ekp'), dataIndex: 'ekp', key: 'ekp',
      render: (v: number) => v ? <Tag color="orange">{Number(v).toFixed(4)} €/{t('production.packageUnit').toLowerCase()}</Tag> : '—',
    },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const s = STATUS_MAP[v] ?? { color: 'default' };
        return <Tag color={s.color}>{formatDbStatus(v, t)}</Tag>;
      },
    },
    {
      title: t('common.actions'), key: 'actions',
      render: (_: unknown, r: ProductionOrder) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>
            {t('common.details')}
          </Button>
          {(r.status === 'tamamlandi' || r.status === 'sevk_edildi') && (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => openInvoice(r.id)}
            >
              {t('invoices.title')}
            </Button>
          )}
          {r.status === 'uretimde' && (
            <Button
              size="small" type="primary" icon={<CheckCircleFilled />}
              onClick={() => openComplete(r)}
            >
              {t('common.confirm')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const aktif    = productions.filter(p => p.status === 'uretimde').length;
  const biten    = productions.filter(p => p.status === 'tamamlandi').length;
  const toplamEkp = productions
    .filter(p => p.ekp)
    .reduce((s, p) => s + Number(p.ekp), 0) /
    (productions.filter(p => p.ekp).length || 1);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ExperimentOutlined /> {t('production.title')}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('production.ordersFlowNotice')}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadProductions}>
          {t('common.refresh')}
        </Button>
      </div>

      {/* İstatistik kartları */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('production.activeProduction')} value={aktif} suffix={`(${t('common.active')})`}
              valueStyle={{ color: aktif > 0 ? '#1890ff' : undefined }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('production.completedCount')} value={biten} suffix={`(${t('common.completed')})`}
              valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('production.avgEkp')} value={biten > 0 ? toplamEkp.toFixed(4) : '—'} suffix={`€/${t('production.packageUnit').toLowerCase()}`}
              valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={productions} columns={columns} rowKey="id"
        loading={loading} pagination={{ pageSize: 15 }}
      />

      {/* ── Detay Modalı ── */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          detail?.productionOrder.status === 'uretimde' ? (
            <Button type="primary" icon={<CheckCircleFilled />}
              onClick={() => { setDetailOpen(false); openComplete(detail!.productionOrder); }}>
              {t('production.completeTitle')}
            </Button>
          ) : null
        }
        width={580}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExperimentOutlined />
            <span>{detail?.productionOrder.production_number}</span>
            {detail && (
              <Tag color={STATUS_MAP[detail.productionOrder.status]?.color}>
                {detail.productionOrder.status === 'beklemede' ? t('common.pending') : detail.productionOrder.status === 'uretimde' ? t('common.inProduction') : detail.productionOrder.status === 'tamamlandi' ? t('common.completed') : STATUS_MAP[detail.productionOrder.status]?.label}
              </Tag>
            )}
          </div>
        }
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('production.farmLabel')} span={2}>
                <Text strong>{detail.productionOrder.buyer_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('production.productName')}>{detail.productionOrder.product_name}</Descriptions.Item>
              <Descriptions.Item label={t('production.expectedQty')}>
                <Text strong>{Math.round(Number(detail.productionOrder.expected_qty))} {t('production.packageUnit')}</Text>
                <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>(1 kg / {t('production.packageUnit')})</Text>
              </Descriptions.Item>
              {detail.productionOrder.actual_qty && (
                <Descriptions.Item label={t('production.actualQty')}>
                  <Text strong style={{ color: '#52c41a' }}>
                    {Math.round(Number(detail.productionOrder.actual_qty))} {t('production.packageUnit')}
                  </Text>
                  <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                    (1 kg / {t('production.packageUnit')})
                  </Text>
                </Descriptions.Item>
              )}
              {detail.productionOrder.ekp && (
                <Descriptions.Item label={t('production.ekp')}>
                  <Tag color="orange">{Number(detail.productionOrder.ekp).toFixed(4)} €/{t('production.packageUnit').toLowerCase()}</Tag>
                </Descriptions.Item>
              )}
              {detail.productionOrder.service_cost && (
                <Descriptions.Item label={t('production.serviceCost')}>
                  {Number(detail.productionOrder.service_cost).toFixed(2)} €
                </Descriptions.Item>
              )}
              {detail.productionOrder.total_raw_cost && (
                <Descriptions.Item label={t('production.rawCostLabel')}>
                  {Number(detail.productionOrder.total_raw_cost).toFixed(2)} €
                </Descriptions.Item>
              )}
              {detail.productionOrder.production_date && (
                <Descriptions.Item label={t('production.productionDateLabel')} span={2}>
                  {dayjs(detail.productionOrder.production_date).format('DD.MM.YYYY')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {detail.rawMaterials.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }}>{t('production.usedMaterials')}</Divider>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.rawMaterials.map(rm => (
                    <div key={rm.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 12px', background: '#fafafa', borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}>
                      <Text>{formatDbPart(rm.material_type, t)}</Text>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Tag color="blue">{Number(rm.quantity_used).toFixed(2)} {formatUnit(rm.unit, t)}</Tag>
                        <Tag>{rm.lot_number}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {Number(rm.total_cost).toFixed(2)} €
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {detail.finishedLots.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }}>{t('production.producedLots')}</Divider>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.finishedLots.map(fl => (
                    <div key={fl.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 12px', background: '#f6ffed', borderRadius: 6,
                      border: '1px solid #b7eb8f',
                    }}>
                      <Tag color="green">{fl.lot_number}</Tag>
                      <Text strong style={{ color: '#52c41a' }}>
                        {Number(fl.quantity).toFixed(1)} {fl.unit}
                      </Text>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Tamamlama Modalı ── */}
      <Modal
        open={completeOpen}
        onCancel={() => { setCompleteOpen(false); setResult(null); }}
        footer={null}
        width={520}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleFilled style={{ color: '#52c41a' }} />
            <span>{t('production.completeTitle')} — {completing?.production_number}</span>
          </div>
        }
      >
        {result ? (
          // Tamamlama sonucu göster
          <div>
            <Alert type="success" showIcon message={t('production.completeSuccess')} style={{ marginBottom: 16 }} />

            <div style={{
              background: '#f6ffed', border: '1.5px solid #b7eb8f',
              borderRadius: 12, padding: '16px 20px', marginBottom: 16,
            }}>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Statistic title={t('production.actualResultSummary')} value={result.actualQty} suffix={`${t('production.packageUnit')} (1 kg)`}
                    valueStyle={{ color: '#52c41a', fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic title={t('production.fireOccurred')} value={Number(result.fireQty || 0).toFixed(2)} suffix={`kg (%${Number(result.fireRate || 0).toFixed(1)})`}
                    valueStyle={{ color: Number(result.fireRate || 0) > 20 ? '#d97706' : '#2563eb', fontSize: 18 }} />
                </Col>
                <Col span={12}>
                  <Statistic title={t('production.ekp')} value={result.ekp.toFixed(4)} suffix={`€/${t('production.packageUnit').toLowerCase()}`}
                    valueStyle={{ color: '#fa8c16', fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic title={t('production.vkp')} value={result.vkp.toFixed(4)} suffix={`€/${t('production.packageUnit').toLowerCase()}`}
                    valueStyle={{ color: '#1890ff', fontSize: 18 }} />
                </Col>
                <Col span={12}>
                  <Statistic title={t('production.grossMargin')} value={result.marj.toFixed(2)} suffix="%"
                    valueStyle={{ color: result.marj > 20 ? '#52c41a' : '#faad14', fontSize: 18 }} />
                </Col>
                <Col span={12}>
                  <Statistic title={t('production.serviceCost')} value={result.serviceCost.toFixed(2)} suffix="€"
                    valueStyle={{ fontSize: 16 }} />
                </Col>
              </Row>
            </div>

            <div style={{
              padding: '10px 14px', background: '#e6f4ff', borderRadius: 8,
              border: '1px solid #adc6ff', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12 }}>
                📦 Lot <strong>{result.lotNumber}</strong> ({result.actualQty} {t('production.packageUnit')}) {t('production.completeSuccess')}
              </Text>
            </div>

            <Button type="primary" block onClick={() => { setCompleteOpen(false); setResult(null); }}>
              {t('common.close')}
            </Button>
          </div>
        ) : (
          // Tamamlama formu
          <div>
            <div style={{
              background: '#f0f5ff', borderRadius: 10, padding: '10px 14px',
              marginBottom: 16, border: '1px solid #adc6ff',
            }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('production.productName')}:</Text>
              <Text strong style={{ marginLeft: 8 }}>{completing?.product_name}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                — {completing?.buyer_name} · {t('production.expectedQty')}: {Math.round(Number(completing?.expected_qty))} {t('production.packageUnit')} (1 kg / {t('production.packageUnit')})
              </Text>
            </div>

            {/* Fire ve Gramaj Bilgi Kartı */}
            <div style={{
              background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
              border: '1px solid #e2e8f0', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <Text type="secondary">{t('production.rawCostLabel')}:</Text>
                <Text strong>{orderInputKg > 0 ? `${orderInputKg.toFixed(2)} kg` : '—'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <Text type="secondary">{t('production.actualQty')}:</Text>
                <Text strong style={{ color: '#2563eb' }}>
                  {Number(actualQty || 0) * 1.0} kg ({actualQty || 0} {t('production.packageUnit')})
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <Text type="secondary">{t('production.fireOccurred')}:</Text>
                <Tag color={orderInputKg > 0 && ((Math.max(0, orderInputKg - (Number(actualQty || 0) * 1.0)) / orderInputKg) * 100) > 20 ? 'volcano' : 'green'}>
                  {orderInputKg > 0 ? Math.max(0, orderInputKg - (Number(actualQty || 0) * 1.0)).toFixed(2) : '0.00'} kg
                  {orderInputKg > 0 ? ` (%${((Math.max(0, orderInputKg - (Number(actualQty || 0) * 1.0)) / orderInputKg) * 100).toFixed(1)})` : ''}
                </Tag>
              </div>

              {orderInputKg > 0 && ((Math.max(0, orderInputKg - (Number(actualQty || 0) * 1.0)) / orderInputKg) * 100) > 20 && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ marginTop: 8, fontSize: 11 }}
                  message={t('production.fireAnomalyWarn')}
                />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  {t('production.actualQtyInputLabel')}
                </Text>
                <InputNumber
                  min={1} step={1} precision={0}
                  value={actualQty}
                  onChange={v => setActualQty(v ? Math.round(v) : null)}
                  addonAfter={t('production.packageUnit')}
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>

              <div>
                <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  {t('production.serviceCost')}
                </Text>
                <div style={{ display: 'flex', gap: 6 }}>
                  <InputNumber
                    min={0} step={0.01} precision={2}
                    value={serviceCost}
                    onChange={v => setServiceCost(v)}
                    style={{ flex: 1 }}
                    size="large"
                    placeholder="0.00"
                  />
                  <CurrencySelect
                    value={serviceCurrency}
                    onChange={v => setServiceCurrency(v)}
                    size="large"
                  />
                </div>
                <EurEquivalentPreview amount={serviceCost} currency={serviceCurrency} />
                {serviceCost && actualQty && actualQty > 0 && (
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                    {t('production.servicePerPackage')}: {formatMoney(serviceCost / actualQty, serviceCurrency)} / {t('production.packageUnit').toLowerCase()}
                  </Text>
                )}
              </div>

              <div>
                <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  {t('production.dateLabel')}
                </Text>
                <DatePicker
                  format="DD.MM.YYYY"
                  value={productionDate}
                  onChange={v => setProductionDate(v ?? dayjs())}
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>

              <Button
                type="primary" block size="large"
                loading={submitting}
                disabled={!actualQty || !serviceCost}
                onClick={submitComplete}
                icon={<CheckCircleFilled />}
              >
                {t('production.completeTitle')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <InvoiceModal
        visible={invoiceModalVisible}
        invoice={selectedInvoice}
        onClose={() => setInvoiceModalVisible(false)}
      />
    </div>
  );
}
