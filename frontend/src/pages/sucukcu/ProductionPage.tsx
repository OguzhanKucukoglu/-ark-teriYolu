import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Typography, Tag, Descriptions,
  Divider, Space, InputNumber, DatePicker, Alert, App,
  Row, Col, Statistic, Card,
} from 'antd';
import {
  CheckCircleFilled, EyeOutlined,
  PlusOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { productionService, orderService } from '../../services/api';

const { Title, Text } = Typography;

// ── Tipler ───────────────────────────────────────────────────────────────────
interface Order {
  id: number;
  buyer_name: string;
  product_name: string;
  expected_qty: number;
  status: string;
  order_date: string;
  notes?: string;
}

interface ProductionOrder {
  id: number;
  order_id: number;
  buyer_name: string;
  production_number: string;
  product_name: string;
  expected_qty: number;
  actual_qty?: number;
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
  const { message } = App.useApp();

  const [productions, setProductions] = useState<ProductionOrder[]>([]);
  const [loading, setLoading]         = useState(true);

  // Yeni üretim emri — onaylı siparişler
  const [newOpen, setNewOpen]         = useState(false);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [creating, setCreating]       = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

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
  const [productionDate, setProductionDate] = useState<Dayjs>(dayjs());
  const [submitting, setSubmitting]     = useState(false);
  const [result, setResult]             = useState<CompletionResult | null>(null);

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

  // Onaylanan siparişleri yükle (üretim emri açılabilecekler)
  async function loadReadyOrders() {
    setOrdersLoading(true);
    try {
      const { data } = await orderService.getAll();
      // Onaylı veya hammadde gönderilmiş, henüz üretim emri olmayan siparişler
      const existingOrderIds = new Set(productions.map(p => p.order_id));
      setReadyOrders(
        (data as Order[]).filter(o =>
          (o.status === 'onaylandi' || o.status === 'hammadde_gonderildi') &&
          !existingOrderIds.has(o.id)
        )
      );
    } catch {
      message.error('Siparişler yüklenemedi');
    } finally {
      setOrdersLoading(false);
    }
  }

  function openNew() {
    setSelectedOrderId(null);
    setNewOpen(true);
    loadReadyOrders();
  }

  async function createProduction() {
    if (!selectedOrderId) return;
    const order = readyOrders.find(o => o.id === selectedOrderId);
    if (!order) return;

    setCreating(true);
    try {
      await productionService.create({
        order_id:     selectedOrderId,
        product_name: order.product_name,
        expected_qty: order.expected_qty,
      });
      message.success('Üretim emri oluşturuldu');
      setNewOpen(false);
      loadProductions();
    } catch {
      message.error('Üretim emri oluşturulamadı');
    } finally {
      setCreating(false);
    }
  }

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
  function openComplete(prod: ProductionOrder) {
    setCompleting(prod);
    setActualQty(Number(prod.expected_qty));
    setServiceCost(null);
    setProductionDate(dayjs());
    setResult(null);
    setCompleteOpen(true);
  }

  async function submitComplete() {
    if (!completing || !actualQty || !serviceCost) return;
    setSubmitting(true);
    try {
      const { data } = await productionService.complete(completing.id, {
        actual_qty:      actualQty,
        service_cost:    serviceCost,
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
      title: 'Üretim No', dataIndex: 'production_number', key: 'production_number',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Hayvancı', dataIndex: 'buyer_name', key: 'buyer_name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Ürün', dataIndex: 'product_name', key: 'product_name',
    },
    {
      title: 'Beklenen', dataIndex: 'expected_qty', key: 'expected_qty',
      render: (v: number) => `${Number(v).toFixed(1)} kg`,
    },
    {
      title: 'Gerçek', dataIndex: 'actual_qty', key: 'actual_qty',
      render: (v: number) => v ? <Text strong style={{ color: '#52c41a' }}>{Number(v).toFixed(1)} kg</Text> : '—',
    },
    {
      title: 'EKP', dataIndex: 'ekp', key: 'ekp',
      render: (v: number) => v ? <Tag color="orange">{Number(v).toFixed(4)} €/kg</Tag> : '—',
    },
    {
      title: 'Durum', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const s = STATUS_MAP[v] ?? { color: 'default', label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'İşlemler', key: 'actions',
      render: (_: unknown, r: ProductionOrder) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>
            Detay
          </Button>
          {r.status === 'uretimde' && (
            <Button
              size="small" type="primary" icon={<CheckCircleFilled />}
              onClick={() => openComplete(r)}
            >
              Tamamla
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
        <Title level={3} style={{ margin: 0 }}>
          <ExperimentOutlined /> Üretim Yönetimi
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          Yeni Üretim Emri
        </Button>
      </div>

      {/* İstatistik kartları */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Aktif Üretim" value={aktif} suffix="adet"
              valueStyle={{ color: aktif > 0 ? '#1890ff' : undefined }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Tamamlanan" value={biten} suffix="adet"
              valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Ort. EKP" value={biten > 0 ? toplamEkp.toFixed(4) : '—'} suffix="€/kg"
              valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={productions} columns={columns} rowKey="id"
        loading={loading} pagination={{ pageSize: 15 }}
      />

      {/* ── Yeni Üretim Emri Modalı ── */}
      <Modal
        open={newOpen}
        onCancel={() => setNewOpen(false)}
        title={<><PlusOutlined /> Yeni Üretim Emri</>}
        footer={
          <Space>
            <Button onClick={() => setNewOpen(false)}>İptal</Button>
            <Button type="primary" loading={creating}
              disabled={!selectedOrderId} onClick={createProduction}>
              Üretim Emri Oluştur
            </Button>
          </Space>
        }
        width={540}
      >
        {ordersLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Text type="secondary">Onaylı siparişler yükleniyor...</Text>
          </div>
        ) : readyOrders.length === 0 ? (
          <Alert
            type="info" showIcon
            message="Üretim emri açılabilecek onaylı sipariş bulunmuyor."
            description="Hayvancının siparişi onaylamanız gerekiyor (Gelen Siparişler sayfasından)."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
              Üretim emri açmak istediğiniz siparişi seçin:
            </Text>
            {readyOrders.map(order => {
              const sel = selectedOrderId === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  style={{
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${sel ? '#1890ff' : '#f0f0f0'}`,
                    background: sel ? '#e6f4ff' : '#fafafa',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text strong>{order.product_name}</Text>
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        — {order.buyer_name}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Tag color="green">{Number(order.expected_qty).toFixed(1)} kg</Tag>
                      <Tag color={order.status === 'onaylandi' ? 'green' : 'blue'}>
                        {order.status === 'onaylandi' ? 'Onaylı' : 'Hammadde Gönderildi'}
                      </Tag>
                    </div>
                  </div>
                  {order.notes && (
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                      Not: {order.notes}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(order.order_date).format('DD.MM.YYYY')}
                  </Text>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── Detay Modalı ── */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          detail?.productionOrder.status === 'uretimde' ? (
            <Button type="primary" icon={<CheckCircleFilled />}
              onClick={() => { setDetailOpen(false); openComplete(detail!.productionOrder); }}>
              Üretimi Tamamla
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
                {STATUS_MAP[detail.productionOrder.status]?.label}
              </Tag>
            )}
          </div>
        }
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Hayvancı" span={2}>
                <Text strong>{detail.productionOrder.buyer_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ürün">{detail.productionOrder.product_name}</Descriptions.Item>
              <Descriptions.Item label="Beklenen Miktar">
                {Number(detail.productionOrder.expected_qty).toFixed(1)} kg
              </Descriptions.Item>
              {detail.productionOrder.actual_qty && (
                <Descriptions.Item label="Gerçek Miktar">
                  <Text strong style={{ color: '#52c41a' }}>
                    {Number(detail.productionOrder.actual_qty).toFixed(1)} kg
                  </Text>
                </Descriptions.Item>
              )}
              {detail.productionOrder.ekp && (
                <Descriptions.Item label="EKP">
                  <Tag color="orange">{Number(detail.productionOrder.ekp).toFixed(4)} €/kg</Tag>
                </Descriptions.Item>
              )}
              {detail.productionOrder.service_cost && (
                <Descriptions.Item label="Hizmet Bedeli">
                  {Number(detail.productionOrder.service_cost).toFixed(2)} €
                </Descriptions.Item>
              )}
              {detail.productionOrder.total_raw_cost && (
                <Descriptions.Item label="Hammadde Maliyeti">
                  {Number(detail.productionOrder.total_raw_cost).toFixed(2)} €
                </Descriptions.Item>
              )}
              {detail.productionOrder.production_date && (
                <Descriptions.Item label="Üretim Tarihi" span={2}>
                  {dayjs(detail.productionOrder.production_date).format('DD.MM.YYYY')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {detail.rawMaterials.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }}>Kullanılan Hammaddeler</Divider>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.rawMaterials.map(rm => (
                    <div key={rm.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 12px', background: '#fafafa', borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}>
                      <Text>{rm.material_type}</Text>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Tag color="blue">{Number(rm.quantity_used).toFixed(2)} {rm.unit}</Tag>
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
                <Divider style={{ margin: '12px 0' }}>Oluşan Mamul Lotlar</Divider>
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
            <span>Üretimi Tamamla — {completing?.production_number}</span>
          </div>
        }
      >
        {result ? (
          // Tamamlama sonucu göster
          <div>
            <Alert type="success" showIcon message="Üretim başarıyla tamamlandı!" style={{ marginBottom: 16 }} />

            <div style={{
              background: '#f6ffed', border: '1.5px solid #b7eb8f',
              borderRadius: 12, padding: '16px 20px', marginBottom: 16,
            }}>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Statistic title="Gerçek Üretim" value={result.actualQty.toFixed(1)} suffix="kg"
                    valueStyle={{ color: '#52c41a', fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="EKP (Birim Maliyet)" value={result.ekp.toFixed(4)} suffix="€/kg"
                    valueStyle={{ color: '#fa8c16', fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="VKP (%38 Marjla)" value={result.vkp.toFixed(4)} suffix="€/kg"
                    valueStyle={{ color: '#1890ff', fontSize: 18 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Brüt Kâr Marjı" value={result.marj.toFixed(2)} suffix="%"
                    valueStyle={{ color: result.marj > 20 ? '#52c41a' : '#faad14', fontSize: 18 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Hammadde Maliyeti" value={result.totalRawCost.toFixed(2)} suffix="€"
                    valueStyle={{ fontSize: 16 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Hizmet Bedeli" value={result.serviceCost.toFixed(2)} suffix="€"
                    valueStyle={{ fontSize: 16 }} />
                </Col>
              </Row>
            </div>

            <div style={{
              padding: '10px 14px', background: '#e6f4ff', borderRadius: 8,
              border: '1px solid #adc6ff', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12 }}>
                📦 Lot <strong>{result.lotNumber}</strong> oluşturuldu ve hayvancının stoğuna eklendi.
              </Text>
            </div>

            <Button type="primary" block onClick={() => { setCompleteOpen(false); setResult(null); }}>
              Kapat
            </Button>
          </div>
        ) : (
          // Tamamlama formu
          <div>
            <div style={{
              background: '#f0f5ff', borderRadius: 10, padding: '10px 14px',
              marginBottom: 16, border: '1px solid #adc6ff',
            }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Sipariş:</Text>
              <Text strong style={{ marginLeft: 8 }}>{completing?.product_name}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                — {completing?.buyer_name} · Beklenen: {Number(completing?.expected_qty).toFixed(1)} kg
              </Text>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Gerçek Üretilen Miktar (kg)
                </Text>
                <InputNumber
                  min={0.001} step={0.1} precision={3}
                  value={actualQty}
                  onChange={v => setActualQty(v)}
                  addonAfter="kg"
                  style={{ width: '100%' }}
                  size="large"
                />
                {actualQty && completing && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Verim: %{((actualQty / Number(completing.expected_qty)) * 100).toFixed(1)}
                  </Text>
                )}
              </div>

              <div>
                <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Hizmet Bedeli (toplam işçilik/üretim ücreti)
                </Text>
                <InputNumber
                  min={0} step={0.01} precision={2}
                  value={serviceCost}
                  onChange={v => setServiceCost(v)}
                  addonAfter="€"
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>

              <div>
                <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Üretim Tarihi
                </Text>
                <DatePicker
                  format="DD.MM.YYYY"
                  value={productionDate}
                  onChange={v => setProductionDate(v ?? dayjs())}
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>

              {/* Anlık EKP önizleme */}
              {actualQty && serviceCost && actualQty > 0 && (
                <div style={{
                  padding: '10px 14px', background: '#fffbe6', borderRadius: 8,
                  border: '1px solid #ffe58f',
                }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Tahmini EKP (hammadde maliyeti bilinmeden): Hizmet / Miktar ={' '}
                    <strong>{(serviceCost / actualQty).toFixed(4)} €/kg</strong>
                    {' '}(gerçek EKP hammadde maliyeti eklenerek hesaplanır)
                  </Text>
                </div>
              )}

              <Alert
                type="info" showIcon style={{ fontSize: 12 }}
                message="Tamamlandığında EKP hesaplanır, mamul lotu hayvancının stoğuna eklenir."
              />

              <Button
                type="primary" block size="large"
                loading={submitting}
                disabled={!actualQty || !serviceCost}
                onClick={submitComplete}
                icon={<CheckCircleFilled />}
              >
                Üretimi Tamamla ve EKP Hesapla
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
