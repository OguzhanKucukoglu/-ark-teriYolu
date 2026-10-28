import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, InputNumber, Typography,
  Tag, App, Divider, Space, Popconfirm, Select, Input,
  Card, Row, Col, Statistic, Empty,
} from 'antd';
import {
  PlusOutlined, TagsOutlined, PoweroffOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { listingService, lotService } from '../../services/api';
import { formatMoney, convertToEur, CurrencySelect } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbProduct } from '../../i18n/formatters';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── Tipler ───────────────────────────────────────────────────────────────────
interface Lot {
  id: number;
  lot_number: string;
  lot_type: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  status: string;
  production_date?: string;
}

interface FarmerListing {
  id: number;
  farmer_id: number;
  lot_id: number;
  lot_number: string;
  lot_quantity: number;
  lot_status: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  currency?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function FarmerListingsPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();

  const [listings, setListings]   = useState<FarmerListing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lots, setLots]           = useState<Lot[]>([]);

  // Yeni ilan modalı
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [form] = Form.useForm();
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);

  // Düzenleme modalı
  const [editOpen, setEditOpen]       = useState(false);
  const [editListing, setEditListing] = useState<FarmerListing | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm] = Form.useForm();

  // ── Yükleme ─────────────────────────────────────────────────────────────
  async function loadListings() {
    try {
      const { data } = await listingService.getMyFarmerListings();
      setListings(data);
    } catch {
      message.error('İlanlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function loadLots() {
    try {
      const { data } = await lotService.getAll();
      // Sadece aktif parça ve mamul lotlar
      setLots((data as Lot[]).filter(l =>
        l.status === 'active' &&
        (l.lot_type === 'parca' || l.lot_type === 'mamul') &&
        Number(l.quantity) > 0
      ));
    } catch {
      message.error('Lotlar yüklenemedi');
    }
  }

  useEffect(() => {
    loadListings();
    loadLots();
  }, []);

  // ── Hesaplamalar ────────────────────────────────────────────────────────
  const aktif   = listings.filter(l => l.is_active).length;
  const pasif   = listings.filter(l => !l.is_active).length;
  const toplamDeger = listings
    .filter(l => l.is_active)
    .reduce((s, l) => s + convertToEur(Number(l.quantity) * Number(l.unit_price), l.currency), 0);

  // İlan verilmemiş lotlar
  const listedLotIds = new Set(listings.map(l => l.lot_id));
  const availableLots = lots.filter(l => !listedLotIds.has(l.id));

  // ── Lot seçimi değişince ─────────────────────────────────────────────────
  function onLotSelect(lotId: number) {
    const lot = lots.find(l => l.id === lotId) ?? null;
    setSelectedLot(lot);
    if (lot) {
      form.setFieldsValue({
        product_name: lot.lot_number,
        quantity:     Number(lot.quantity),
        unit:         lot.unit,
        unit_price:   lot.unit_cost > 0 ? Number(lot.unit_cost) : undefined,
        currency:     (lot as any).currency || 'EUR',
      });
    }
  }

  // ── İlan oluştur ─────────────────────────────────────────────────────────
  async function onCreateSubmit(values: {
    lot_id: number;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    currency?: string;
    description?: string;
  }) {
    setCreating(true);
    try {
      await listingService.createFarmerListing(values);
      message.success('İlan oluşturuldu');
      setCreateOpen(false);
      setSelectedLot(null);
      form.resetFields();
      loadListings();
      loadLots();
    } catch {
      message.error('İlan oluşturulamadı');
    } finally {
      setCreating(false);
    }
  }

  // ── İlan düzenle ─────────────────────────────────────────────────────────
  function openEdit(listing: FarmerListing) {
    setEditListing(listing);
    editForm.setFieldsValue({
      unit_price:  Number(listing.unit_price),
      currency:    listing.currency || 'EUR',
      quantity:    Number(listing.quantity),
      description: listing.description,
    });
    setEditOpen(true);
  }

  async function onEditSubmit(values: {
    unit_price: number;
    currency?: string;
    quantity: number;
    description?: string;
  }) {
    if (!editListing) return;
    setEditSubmitting(true);
    try {
      await listingService.updateFarmerListing(editListing.id, values);
      message.success('İlan güncellendi');
      setEditOpen(false);
      loadListings();
    } catch {
      message.error('İlan güncellenemedi');
    } finally {
      setEditSubmitting(false);
    }
  }

  // ── Toggle ───────────────────────────────────────────────────────────────
  async function onToggle(listing: FarmerListing) {
    try {
      await listingService.toggleFarmerListing(listing.id);
      message.success(listing.is_active ? 'İlan pasife alındı' : 'İlan aktifleştirildi');
      loadListings();
    } catch {
      message.error('Durum güncellenemedi');
    }
  }

  // ── Tablo ────────────────────────────────────────────────────────────────
  const columns = [
    {
      title: `${t('listings.productName')} / ${t('common.lotNumber')}`, key: 'product',
      render: (_: unknown, r: FarmerListing) => (
        <div>
          <Text strong>{formatDbProduct(r.product_name, t)}</Text>
          <div>
            <Tag color="blue" style={{ fontSize: 11 }}>{r.lot_number}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: t('common.quantity'), key: 'qty',
      render: (_: unknown, r: FarmerListing) => (
        <Text>{Number(r.quantity).toFixed(2)} {formatUnit(r.unit, t)}</Text>
      ),
    },
    {
      title: t('common.unitPrice'), dataIndex: 'unit_price', key: 'unit_price',
      render: (v: number, r: FarmerListing) => <Text strong style={{ color: '#f50' }}>{formatMoney(v, r.currency)} / {formatUnit(r.unit, t)}</Text>,
    },
    {
      title: t('common.totalPrice'), key: 'total',
      render: (_: unknown, r: FarmerListing) => (
        <Tag color="green">
          {formatMoney(Number(r.quantity) * Number(r.unit_price), r.currency, true)}
        </Tag>
      ),
    },
    {
      title: t('common.status'), dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('common.active') : t('common.passive')}</Tag>,
    },
    {
      title: t('common.date'), dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
    {
      title: t('common.actions'), key: 'actions', width: 180,
      render: (_: unknown, r: FarmerListing) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={r.is_active ? t('listings.confirmTogglePassive') : t('listings.confirmToggleActive')}
            onConfirm={() => onToggle(r)}
            okText={t('common.yes')} cancelText={t('common.no')}
          >
            <Button size="small" danger={r.is_active} icon={<PoweroffOutlined />}>
              {r.is_active ? t('common.passive') : t('common.active')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <TagsOutlined /> {t('listings.title')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setSelectedLot(null);
          form.resetFields();
          setCreateOpen(true);
        }}>
          {t('listings.createListing')}
        </Button>
      </div>

      {/* İstatistikler */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('listings.activeListings')} value={aktif}
              valueStyle={{ color: aktif > 0 ? '#52c41a' : undefined }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('listings.passiveListings')} value={pasif}
              valueStyle={{ color: pasif > 0 ? '#8c8c8c' : undefined }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('listings.totalValue')} value={toplamDeger.toFixed(2)} suffix="€"
              valueStyle={{ color: '#f50' }} />
          </Card>
        </Col>
      </Row>

      {listings.length === 0 && !loading ? (
        <Empty
          description="Henüz ilan vermediniz"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Table
          dataSource={listings} columns={columns} rowKey="id"
          loading={loading} pagination={{ pageSize: 15 }}
        />
      )}

      {/* ── Yeni İlan Modalı ── */}
      <Modal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        width={520}
        title={<><PlusOutlined /> {t('listings.newMarketListing')}</>}
      >
        <Form form={form} onFinish={onCreateSubmit} layout="vertical">

          {/* Lot seçimi */}
          <Form.Item
            name="lot_id" label={t('listings.selectLot')}
            rules={[{ required: true, message: t('listings.selectLot') }]}
          >
            <Select
              showSearch
              placeholder={t('listings.selectLotPlaceholder')}
              onChange={onLotSelect}
              optionFilterProp="label"
              options={availableLots.map(l => ({
                value: l.id,
                label: `${l.lot_number} — ${Number(l.quantity).toFixed(2)} ${l.unit} (${l.lot_type})`,
              }))}
              notFoundContent={
                <div style={{ padding: 8, textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('common.noData')}
                  </Text>
                </div>
              }
            />
          </Form.Item>

          {/* Seçilen lot bilgisi */}
          {selectedLot && (
            <div style={{
              padding: '10px 14px', background: '#f0f5ff', borderRadius: 8,
              border: '1px solid #adc6ff', marginBottom: 16,
            }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{t('common.lotNumber')}</Text>
                  <div><Tag color="blue">{selectedLot.lot_number}</Tag></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{t('market.inStock')}</Text>
                  <div><Text strong>{Number(selectedLot.quantity).toFixed(2)} {selectedLot.unit}</Text></div>
                </Col>
                {selectedLot.unit_cost > 0 && (
                  <Col span={12} style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{t('production.ekp')}</Text>
                    <div><Text>{Number(selectedLot.unit_cost).toFixed(4)} €/{selectedLot.unit}</Text></div>
                  </Col>
                )}
              </Row>
            </div>
          )}

          <Form.Item
            name="product_name" label={t('listings.productName')}
            rules={[{ required: true, message: t('listings.productName') }]}
          >
            <Input placeholder={t('listings.productNamePlaceholder')} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={10}>
              <Form.Item
                name="quantity" label={t('listings.quantity')}
                rules={[{ required: true, message: t('rawMaterials.enterQuantity') }]}
              >
                <InputNumber min={0.001} step={0.1} precision={3} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="unit" label={t('common.unit')} rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="kg">kg</Select.Option>
                  <Select.Option value="paket">{t('production.packageUnit')}</Select.Option>
                  <Select.Option value="adet">adet</Select.Option>
                  <Select.Option value="lt">lt</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label={t('common.unitPrice')} required>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Form.Item
                    name="unit_price"
                    noStyle
                    rules={[{ required: true, message: t('common.unitPrice') }]}
                  >
                    <InputNumber min={0} step={0.01} precision={2} style={{ flex: 1 }} placeholder="0.00" />
                  </Form.Item>
                  <Form.Item name="currency" noStyle initialValue="EUR">
                    <CurrencySelect />
                  </Form.Item>
                </div>
              </Form.Item>
            </Col>
          </Row>

          {/* Anlık toplam hesap */}
          <Form.Item noStyle shouldUpdate={(prev, cur) =>
            prev.quantity !== cur.quantity || prev.unit_price !== cur.unit_price || prev.currency !== cur.currency
          }>
            {({ getFieldValue }) => {
              const qty   = getFieldValue('quantity') ?? 0;
              const price = getFieldValue('unit_price') ?? 0;
              const cur   = getFieldValue('currency') ?? 'EUR';
              const total = qty * price;
              return total > 0 ? (
                <div style={{
                  padding: '8px 14px', background: '#f6ffed', borderRadius: 8,
                  border: '1px solid #b7eb8f', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <Text type="secondary">{t('listings.totalValue')}</Text>
                  <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                    {formatMoney(total, cur, true)}
                  </Text>
                </div>
              ) : null;
            }}
          </Form.Item>

          <Form.Item name="description" label={`${t('common.description')} (${t('common.optional')})`}>
            <TextArea rows={2} placeholder={t('listings.descPlaceholder')} />
          </Form.Item>

          <Divider style={{ margin: '8px 0 16px' }} />
          <Button type="primary" htmlType="submit" block size="large" loading={creating}>
            {t('listings.publish')}
          </Button>
        </Form>
      </Modal>

      {/* ── Düzenleme Modalı ── */}
      <Modal
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={420}
        title={<><EditOutlined /> {t('listings.editListing')} — {editListing?.product_name}</>}
      >
        <Form form={editForm} onFinish={onEditSubmit} layout="vertical">

          {editListing && (
            <div style={{
              padding: '8px 12px', background: '#f0f5ff', borderRadius: 8,
              border: '1px solid #adc6ff', marginBottom: 16,
            }}>
              <Tag color="blue">{editListing.lot_number}</Tag>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                Depoda: {Number(editListing.lot_quantity).toFixed(2)} {editListing.unit}
              </Text>
            </div>
          )}

          <Row gutter={12}>
            <Col span={10}>
              <Form.Item
                name="quantity" label={t('listings.quantity')}
                rules={[{ required: true, message: t('rawMaterials.enterQuantity') }]}
              >
                <InputNumber min={0.001} step={0.1} precision={3}
                  style={{ width: '100%' }} addonAfter={editListing?.unit} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item label={t('common.unitPrice')} required>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Form.Item
                    name="unit_price"
                    noStyle
                    rules={[{ required: true, message: t('common.unitPrice') }]}
                  >
                    <InputNumber min={0} step={0.01} precision={2}
                      style={{ flex: 1 }} placeholder="0.00" />
                  </Form.Item>
                  <Form.Item name="currency" noStyle initialValue="EUR">
                    <CurrencySelect />
                  </Form.Item>
                </div>
              </Form.Item>
            </Col>
          </Row>

          {/* Anlık toplam */}
          <Form.Item noStyle shouldUpdate={(prev, cur) =>
            prev.quantity !== cur.quantity || prev.unit_price !== cur.unit_price || prev.currency !== cur.currency
          }>
            {({ getFieldValue }) => {
              const qty   = getFieldValue('quantity') ?? 0;
              const price = getFieldValue('unit_price') ?? 0;
              const cur   = getFieldValue('currency') ?? 'EUR';
              const total = qty * price;
              return total > 0 ? (
                <div style={{
                  padding: '8px 14px', background: '#f6ffed', borderRadius: 8,
                  border: '1px solid #b7eb8f', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <Text type="secondary">{t('listings.totalValue')}</Text>
                  <Text strong style={{ color: '#52c41a' }}>
                    {formatMoney(total, cur, true)}
                  </Text>
                </div>
              ) : null;
            }}
          </Form.Item>

          <Form.Item name="description" label={`${t('common.description')} (${t('common.optional')})`}>
            <TextArea rows={2} />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={editSubmitting}>
            {t('common.save')}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
