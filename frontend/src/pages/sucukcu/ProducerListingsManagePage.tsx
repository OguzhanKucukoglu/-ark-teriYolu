import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, InputNumber, Typography,
  Tag, Card, Row, Col, Input, Divider, Space, Popconfirm, App,
} from 'antd';
import {
  PlusOutlined, CheckCircleFilled, TagsOutlined,
  EditOutlined, PoweroffOutlined,
} from '@ant-design/icons';
import { listingService } from '../../services/api';
import { useTranslation } from '../../i18n';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── Ürün tanımları ────────────────────────────────────────────────────────────
type ProductKey = 'sucuk' | 'salam' | 'sosis' | 'pastirma';

interface ProductType {
  key: ProductKey;
  emoji: string;
  label: string;
  description: string;
  ingredients: { name: string; unit: string }[];
}

const PRODUCTS: ProductType[] = [
  {
    key: 'sucuk',
    emoji: '🌭',
    label: 'Sucuk',
    description: 'Geleneksel fermente et ürünü',
    ingredients: [
      { name: 'Et',       unit: 'kg' },
      { name: 'Yağ',      unit: 'kg' },
      { name: 'Sarımsak', unit: 'kg' },
      { name: 'Bağırsak', unit: 'kg' },
      { name: 'Tuz',      unit: 'kg' },
      { name: 'Baharat',  unit: 'kg' },
    ],
  },
  {
    key: 'salam',
    emoji: '🥩',
    label: 'Salam',
    description: 'Pişirilmiş et ürünü',
    ingredients: [
      { name: 'Et',                   unit: 'kg' },
      { name: 'Sarımsak',             unit: 'kg' },
      { name: 'Tuz',                  unit: 'kg' },
      { name: 'Baharat',              unit: 'kg' },
      { name: 'Jelatin',              unit: 'kg' },
      { name: 'İlikli Kemik Suyu',    unit: 'lt' },
      { name: 'Yumurta Akı',          unit: 'lt' },
      { name: 'Kırmızı Pancar Suyu',  unit: 'lt' },
    ],
  },
  {
    key: 'sosis',
    emoji: '🍖',
    label: 'Sosis',
    description: 'Taze veya pişirilmiş sosis',
    ingredients: [
      { name: 'Et',      unit: 'kg' },
      { name: 'Yoğurt',  unit: 'kg' },
      { name: 'Salça',   unit: 'kg' },
      { name: 'Tuz',     unit: 'kg' },
      { name: 'Baharat', unit: 'kg' },
      { name: 'Bağırsak', unit: 'kg' },
    ],
  },
  {
    key: 'pastirma',
    emoji: '🥓',
    label: 'Pastırma',
    description: 'Kuru kürleme et ürünü',
    ingredients: [
      { name: 'Et',     unit: 'kg' },
      { name: 'Tuz',    unit: 'kg' },
      { name: 'Çemen',  unit: 'kg' },
    ],
  },
];

interface IngredientAmount {
  name: string;
  unit: string;
  amount: number | null;
}

interface Listing {
  id: number;
  product_name: string;
  description?: string;
  service_price: number;
  service_unit: string;
  min_order_qty?: number;
  required_materials?: string;
  is_active: boolean;
  created_at: string;
}

export default function ProducerListingsManagePage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [listings, setListings]         = useState<Listing[]>([]);
  const [loading, setLoading]           = useState(true);
  const [step1Open, setStep1Open]       = useState(false);
  const [step2Open, setStep2Open]       = useState(false);
  const [selectedProduct, setSelected]  = useState<ProductType | null>(null);
  const [ingredients, setIngredients]   = useState<IngredientAmount[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [form] = Form.useForm();

  // ── Düzenleme durumu ──
  const [editOpen, setEditOpen]               = useState(false);
  const [editingListing, setEditingListing]   = useState<Listing | null>(null);
  const [editProduct, setEditProduct]         = useState<ProductType | null>(null);
  const [editIngredients, setEditIngredients] = useState<IngredientAmount[]>([]);
  const [editSubmitting, setEditSubmitting]   = useState(false);
  const [editForm] = Form.useForm();

  async function load() {
    try {
      const { data } = await listingService.getMyProducerListings();
      setListings(data);
    } catch {
      message.error('İlanlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function onProductSelect(product: ProductType) {
    setSelected(product);
    setIngredients(product.ingredients.map(i => ({ ...i, amount: null })));
  }

  function onStep1Confirm() {
    if (!selectedProduct) return;
    setStep1Open(false);
    setStep2Open(true);
  }

  function updateIngredient(idx: number, val: number | null) {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, amount: val } : ing));
  }

  async function onSubmit(values: {
    service_price: number;
    min_order_qty?: number;
    description?: string;
  }) {
    if (!selectedProduct) return;

    const filledIngredients = ingredients.filter(i => i.amount && i.amount > 0);
    const requiredMaterials = Object.fromEntries(
      filledIngredients.map(i => [i.name, { amount: i.amount, unit: i.unit }])
    );

    setSubmitting(true);
    try {
      await listingService.createProducerListing({
        product_name:       selectedProduct.label,
        description:        values.description || `${selectedProduct.label} üretimi`,
        service_price:      values.service_price,
        service_unit:       'kg',
        min_order_qty:      values.min_order_qty,
        required_materials: requiredMaterials,
      });
      message.success('İlan oluşturuldu');
      setStep2Open(false);
      setSelected(null);
      setIngredients([]);
      form.resetFields();
      load();
    } catch {
      message.error('İlan oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  }

  // ── İlan düzenleme ──
  function openEdit(listing: Listing) {
    const product = PRODUCTS.find(p => p.label === listing.product_name) ?? null;
    setEditingListing(listing);
    setEditProduct(product);

    // Mevcut required_materials JSON'ını parse et
    let existingMaterials: Record<string, { amount: number; unit: string }> = {};
    if (listing.required_materials) {
      try {
        existingMaterials = typeof listing.required_materials === 'string'
          ? JSON.parse(listing.required_materials)
          : (listing.required_materials as unknown as Record<string, { amount: number; unit: string }>);
      } catch {
        existingMaterials = {};
      }
    }

    // Ürün tanımından hammadde listesini oluştur, mevcut miktarlarla doldur
    if (product) {
      setEditIngredients(product.ingredients.map(i => ({
        name: i.name,
        unit: i.unit,
        amount: existingMaterials[i.name]?.amount ?? null,
      })));
    } else {
      // Ürün tanımda yoksa mevcut malzemeleri göster
      setEditIngredients(Object.entries(existingMaterials).map(([name, val]) => ({
        name,
        unit: val.unit,
        amount: val.amount,
      })));
    }

    editForm.setFieldsValue({
      service_price: Number(listing.service_price),
      min_order_qty: listing.min_order_qty ? Number(listing.min_order_qty) : undefined,
      description: listing.description,
    });
    setEditOpen(true);
  }

  function updateEditIngredient(idx: number, val: number | null) {
    setEditIngredients(prev => prev.map((ing, i) => (i === idx ? { ...ing, amount: val } : ing)));
  }

  async function onEditSubmit(values: {
    service_price: number;
    min_order_qty?: number;
    description?: string;
  }) {
    if (!editingListing) return;

    const filledIngredients = editIngredients.filter(i => i.amount && i.amount > 0);
    const requiredMaterials = Object.fromEntries(
      filledIngredients.map(i => [i.name, { amount: i.amount, unit: i.unit }])
    );

    setEditSubmitting(true);
    try {
      await listingService.updateProducerListing(editingListing.id, {
        description:         values.description || null,
        service_price:       values.service_price,
        min_order_qty:       values.min_order_qty || null,
        required_materials:  requiredMaterials,
      });
      message.success('İlan güncellendi');
      setEditOpen(false);
      setEditingListing(null);
      load();
    } catch {
      message.error('İlan güncellenemedi');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function onToggle(listing: Listing) {
    try {
      await listingService.toggleProducerListing(listing.id);
      message.success(listing.is_active ? 'İlan pasife alındı' : 'İlan aktifleştirildi');
      load();
    } catch {
      message.error('Durum güncellenemedi');
    }
  }

  const columns = [
    {
      title: t('production.productName'), dataIndex: 'product_name', key: 'product_name',
      render: (v: string) => {
        const p = PRODUCTS.find(p => p.label === v);
        return <Text strong>{p?.emoji} {v}</Text>;
      },
    },
    {
      title: t('common.description'), dataIndex: 'description', key: 'description',
      render: (v: string) => v || '—',
    },
    {
      title: t('production.serviceCost'), dataIndex: 'service_price', key: 'service_price',
      render: (v: number) => `${Number(v).toFixed(2)} € / kg`,
    },
    {
      title: t('producerListings.minOrder'), dataIndex: 'min_order_qty', key: 'min_order_qty',
      render: (v: number) => v ? `${v} kg` : '—',
    },
    {
      title: t('common.status'), dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('common.active') : t('common.passive')}</Tag>,
    },
    {
      title: t('common.date'), dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: t('common.actions'), key: 'actions', width: 200,
      render: (_: unknown, r: Listing) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={r.is_active ? t('listings.confirmTogglePassive') : t('listings.confirmToggleActive')}
            onConfirm={() => onToggle(r)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button
              size="small"
              danger={!!r.is_active}
              icon={<PoweroffOutlined />}
            >
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
          <TagsOutlined /> {t('producerListings.manageTitle')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelected(null); setStep1Open(true); }}>
          {t('listings.createListing')}
        </Button>
      </div>

      <Table dataSource={listings} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      {/* ── ADIM 1: Ürün seçimi ── */}
      <Modal
        open={step1Open}
        onCancel={() => setStep1Open(false)}
        footer={null}
        width={580}
        centered
        title={
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <Title level={4} style={{ margin: 0 }}>{t('producerListings.selectProduct')}</Title>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 12, margin: '20px 0' }}>
          {PRODUCTS.map(product => {
            const isSelected = selectedProduct?.key === product.key;
            return (
              <div
                key={product.key}
                onClick={() => onProductSelect(product)}
                style={{
                  flex: 1,
                  border: `2px solid ${isSelected ? '#1890ff' : '#e8e8e8'}`,
                  borderRadius: 10,
                  padding: '16px 8px',
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
                <div style={{ fontSize: 32, marginBottom: 6 }}>{product.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{product.label}</div>
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.3 }}>{product.description}</div>
              </div>
            );
          })}
        </div>

        {/* Seçilen ürünün hammadde listesi */}
        {selectedProduct && (
          <Card size="small" style={{ background: '#f6f8ff', border: '1px solid #d0e4ff', marginBottom: 16 }}>
            <Text strong style={{ fontSize: 12, color: '#1890ff' }}>Gerekli Hammaddeler:</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {selectedProduct.ingredients.map(i => (
                <Tag key={i.name} color="blue">{i.name} ({i.unit})</Tag>
              ))}
            </div>
          </Card>
        )}

        <Button
          type="primary" block size="large"
          disabled={!selectedProduct}
          onClick={onStep1Confirm}
          style={{ borderRadius: 8 }}
        >
          Devam Et →
        </Button>
      </Modal>

      {/* ── ADIM 2: Hammadde miktarları + fiyat ── */}
      <Modal
        open={step2Open}
        onCancel={() => setStep2Open(false)}
        footer={null}
        width={520}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{selectedProduct?.emoji}</span>
            <span>{selectedProduct?.label} — {t('producerListings.step2Title')}</span>
          </div>
        }
      >
        <Form form={form} onFinish={onSubmit} layout="vertical">

          <Divider orientation="left" style={{ fontSize: 13, color: '#666', marginTop: 0 }}>
            {t('producerListings.rawMaterialsForUnit')}
          </Divider>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {ingredients.map((ing, idx) => (
              <div key={ing.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0',
              }}>
                <Text style={{ minWidth: 140 }}>{ing.name}</Text>
                <InputNumber
                  min={0} step={0.01} precision={3}
                  placeholder="0.000"
                  value={ing.amount}
                  onChange={v => updateIngredient(idx, v)}
                  addonAfter={ing.unit}
                  style={{ width: 160 }}
                />
              </div>
            ))}
          </div>

          <Divider orientation="left" style={{ fontSize: 13, color: '#666' }}>
            {t('producerListings.priceAndCapacity')}
          </Divider>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="service_price" label={`${t('producerListings.serviceCost')} (€/kg)`}
                rules={[{ required: true, message: t('producerListings.priceRequired') }]}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} addonAfter="€/kg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="min_order_qty" label={`${t('producerListings.minOrder')} (kg)`}>
                <InputNumber min={0} step={1} precision={0} style={{ width: '100%' }} addonAfter="kg" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label={t('common.description')}>
            <TextArea rows={2} placeholder={t('producerListings.descPlaceholder')} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting} style={{ borderRadius: 8 }}>
              {t('producerListings.publishListing')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── İLAN DÜZENLEME MODALI ── */}
      <Modal
        open={editOpen}
        onCancel={() => { setEditOpen(false); setEditingListing(null); }}
        footer={null}
        width={520}
        centered
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{editProduct?.emoji ?? '📦'}</span>
            <span>{editingListing?.product_name} — {t('listings.editListing')}</span>
          </div>
        }
      >
        <Form form={editForm} onFinish={onEditSubmit} layout="vertical">

          <Divider orientation="left" style={{ fontSize: 13, color: '#666', marginTop: 0 }}>
            {t('producerListings.rawMaterialsForUnit')}
          </Divider>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {editIngredients.map((ing, idx) => (
              <div key={ing.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0',
              }}>
                <Text style={{ minWidth: 140 }}>{ing.name}</Text>
                <InputNumber
                  min={0} step={0.01} precision={3}
                  placeholder="0.000"
                  value={ing.amount}
                  onChange={v => updateEditIngredient(idx, v)}
                  addonAfter={ing.unit}
                  style={{ width: 160 }}
                />
              </div>
            ))}
          </div>

          <Divider orientation="left" style={{ fontSize: 13, color: '#666' }}>
            {t('producerListings.priceAndCapacity')}
          </Divider>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="service_price" label={`${t('producerListings.serviceCost')} (€/kg)`}
                rules={[{ required: true, message: t('producerListings.priceRequired') }]}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} addonAfter="€/kg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="min_order_qty" label={`${t('producerListings.minOrder')} (kg)`}>
                <InputNumber min={0} step={1} precision={0} style={{ width: '100%' }} addonAfter="kg" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label={t('common.description')}>
            <TextArea rows={2} placeholder={t('producerListings.descPlaceholder')} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={editSubmitting} style={{ borderRadius: 8 }}>
              {t('common.save')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
