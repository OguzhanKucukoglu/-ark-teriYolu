import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Select, InputNumber, DatePicker,
  Typography, Tag, message, Card, Statistic, Row, Col,
  Input, Popconfirm, Space, Alert, Spin, Radio, Descriptions,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, InboxOutlined,
  ScanOutlined, CheckCircleFilled, ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { rawMaterialService, ocrService } from '../../services/api';
import { formatMoney, convertToEur, CurrencySelect, EurEquivalentPreview } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbStatus, formatDbPart } from '../../i18n/formatters';

const { Title, Text, Paragraph } = Typography;

// Mantıklı sıra: et → kuru/toz → sıvı → protein bazlı → süt/yumurta → sebze/meyve
const MATERIALS = [
  { label: 'Dana Karkas / But',    unit: 'kg',  category: 'Et' },
  { label: 'Kuzu Karkas / Parça',  unit: 'kg',  category: 'Et' },
  { label: 'Tuz',                  unit: 'kg',  category: 'Kuru/Toz' },
  { label: 'Baharat',              unit: 'kg',  category: 'Kuru/Toz' },
  { label: 'Çemen',                unit: 'kg',  category: 'Kuru/Toz' },
  { label: 'Sarımsak',             unit: 'kg',  category: 'Kuru/Toz' },
  { label: 'Jelatin',              unit: 'kg',  category: 'Kuru/Toz' },
  { label: 'Yağ',                  unit: 'lt',  category: 'Sıvı' },
  { label: 'İlikli Kemik Suyu',    unit: 'lt',  category: 'Sıvı' },
  { label: 'Kırmızı Pancar Suyu',  unit: 'lt',  category: 'Sıvı' },
  { label: 'Salça',                unit: 'kg',  category: 'Sebze/Meyve' },
  { label: 'Yoğurt',               unit: 'kg',  category: 'Süt/Yumurta' },
  { label: 'Yumurta Akı',          unit: 'lt',  category: 'Süt/Yumurta' },
  { label: 'İnek Bağırsağı',       unit: 'kg',  category: 'Bağırsak' },
  { label: 'Koyun Bağırsağı',      unit: 'kg',  category: 'Bağırsak' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Et':           'volcano',
  'Kuru/Toz':     'orange',
  'Sıvı':         'blue',
  'Sebze/Meyve':  'green',
  'Süt/Yumurta':  'purple',
  'Bağırsak':     'cyan',
};

interface RawMaterial {
  id: number;
  material_type: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  currency?: string;
  lot_number: string;
  lot_status: string;
  created_at: string;
}

export default function RawMaterialsPage() {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Seçili malzeme türüne göre varsayılan birimi otomatik doldur
  const [selectedUnit, setSelectedUnit] = useState<string>('kg');

  // OCR Fatura / İrsaliye Okuma State
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSample, setOcrSample] = useState<string>('sample_meat');
  const [ocrResult, setOcrResult] = useState<any | null>(null);

  async function runOcr(sampleKey: string) {
    setOcrLoading(true);
    setOcrSample(sampleKey);
    try {
      const { data } = await ocrService.analyze({ sampleId: sampleKey });
      if (data.success) {
        setOcrResult(data.data);
      }
    } catch {
      message.error('Belge OCR ile okunamadı');
    } finally {
      setOcrLoading(false);
    }
  }

  function openOcrModal() {
    setOcrOpen(true);
    if (!ocrResult) {
      runOcr('sample_meat');
    }
  }

  function applyOcrToForm() {
    if (!ocrResult) return;
    form.setFieldsValue({
      material_type: ocrResult.material_label || ocrResult.material_type,
      quantity: ocrResult.quantity,
      unit: ocrResult.unit || 'kg',
      unit_price: ocrResult.unit_price,
      currency: (ocrResult as any).currency || 'EUR',
      supplier_name: ocrResult.supplier_name,
      expiry_date: ocrResult.expiry_date ? dayjs(ocrResult.expiry_date) : undefined,
    });
    setSelectedUnit(ocrResult.unit || 'kg');
    setOcrOpen(false);
    setModalOpen(true);
    message.success('OCR fatura bilgileri hammadde formuna aktarıldı!');
  }

  async function load() {
    try {
      const { data } = await rawMaterialService.getAll();
      setMaterials(data);
    } catch {
      message.error('Hammaddeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function onMaterialChange(val: string) {
    const found = MATERIALS.find(m => m.label === val);
    if (found) {
      setSelectedUnit(found.unit);
      form.setFieldsValue({ unit: found.unit });
    }
  }

  async function onSubmit(values: {
    material_type: string;
    quantity: number;
    unit: string;
    unit_price: number;
    supplier_name?: string;
    expiry_date?: dayjs.Dayjs;
  }) {
    setSubmitting(true);
    try {
      await rawMaterialService.create({
        ...values,
        expiry_date: values.expiry_date ? values.expiry_date.format('YYYY-MM-DD') : undefined,
      });
      message.success('Hammadde stoka eklendi');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch {
      message.error('Hammadde eklenemedi');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: number) {
    try {
      await rawMaterialService.remove(id);
      message.success('Hammadde silindi');
      load();
    } catch {
      message.error('Silinemedi');
    }
  }

  // İstatistikler
  const activeCount = materials.filter(m => m.lot_status === 'active').length;
  const totalValue  = materials
    .filter(m => m.lot_status === 'active')
    .reduce((s, m) => s + convertToEur(Number(m.total_cost), m.currency), 0);

  const columns = [
    {
      title: t('rawMaterials.materialType'), dataIndex: 'material_type', key: 'material_type',
      render: (v: string) => {
        const found = MATERIALS.find(m => m.label === v);
        const color = found ? CATEGORY_COLORS[found.category] : 'default';
        return <Tag color={color}>{formatDbPart(v, t)}</Tag>;
      },
    },
    {
      title: t('common.quantity'), key: 'qty',
      render: (_: unknown, r: RawMaterial) =>
        <Text strong>{Number(r.quantity).toFixed(2)} {formatUnit(r.unit, t)}</Text>,
    },
    {
      title: t('common.unitPrice'), dataIndex: 'unit_price', key: 'unit_price',
      render: (v: number, r: RawMaterial) => formatMoney(v, r.currency),
    },
    {
      title: t('common.totalCost'), dataIndex: 'total_cost', key: 'total_cost',
      render: (v: number, r: RawMaterial) => <Text strong>{formatMoney(v, r.currency, true)}</Text>,
    },
    {
      title: t('common.lotNumber'), dataIndex: 'lot_number', key: 'lot_number',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('common.status'), dataIndex: 'lot_status', key: 'lot_status',
      render: (v: string) => (
        <Tag color={v === 'active' ? 'green' : 'default'}>
          {formatDbStatus(v, t)}
        </Tag>
      ),
    },
    {
      title: t('common.date'), dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
    {
      title: '', key: 'action',
      render: (_: unknown, r: RawMaterial) => (
        <Popconfirm
          title={t('rawMaterials.deleteConfirm')}
          onConfirm={() => onDelete(r.id)}
          okText={t('common.yes')} cancelText={t('common.no')}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <InboxOutlined /> {t('rawMaterials.title')}
        </Title>
        <Space>
          <Button
            icon={<ScanOutlined />}
            style={{ borderColor: '#722ed1', color: '#722ed1', fontWeight: 500 }}
            onClick={openOcrModal}
          >
            {t('rawMaterials.scanOcrButton')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {t('rawMaterials.addModalTitle')}
          </Button>
        </Space>
      </div>

      {/* İstatistik kartları */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('rawMaterials.activeStockItem')} value={activeCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('rawMaterials.totalStockValue')} value={totalValue.toFixed(2)} suffix="€" />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('rawMaterials.totalRecords')} value={materials.length} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={materials}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        rowClassName={(r) => r.lot_status !== 'active' ? 'ant-table-row-disabled' : ''}
      />

      {/* Ekleme Modalı */}
      <Modal
        title={t('rawMaterials.addModalTitle')}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={500}
      >
        <div style={{
          background: '#f9f0ff', padding: '10px 14px', borderRadius: 8,
          border: '1px solid #d3adf7', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <Text strong style={{ color: '#531dab', fontSize: 13 }}>📸 {t('rawMaterials.scanOcrButton')}</Text>
            <div style={{ fontSize: 11, color: '#722ed1' }}>{t('ocr.engineNoticeTitle')}</div>
          </div>
          <Button
            size="small"
            style={{ borderColor: '#722ed1', color: '#722ed1', fontWeight: 500 }}
            icon={<ScanOutlined />}
            onClick={() => { setModalOpen(false); openOcrModal(); }}
          >
            {t('rawMaterials.ocrAnalyzeBtn')}
          </Button>
        </div>

        <Form form={form} onFinish={onSubmit} layout="vertical" size="large">

          <Form.Item name="material_type" label={t('rawMaterials.materialType')} rules={[{ required: true, message: t('rawMaterials.selectMaterial') }]}>
            <Select
              showSearch
              placeholder={t('rawMaterials.selectOrSearch')}
              onChange={onMaterialChange}
            >
              {/* Kategorilere göre gruplandırılmış */}
              {Object.entries(
                MATERIALS.reduce<Record<string, typeof MATERIALS>>((acc, m) => {
                  if (!acc[m.category]) acc[m.category] = [];
                  acc[m.category].push(m);
                  return acc;
                }, {})
              ).map(([cat, items]) => (
                <Select.OptGroup key={cat} label={cat}>
                  {items.map(m => (
                    <Select.Option key={m.label} value={m.label}>
                      <Tag color={CATEGORY_COLORS[cat]} style={{ marginRight: 6 }}>{cat}</Tag>
                      {m.label}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="quantity" label={t('common.quantity')} rules={[{ required: true, message: t('rawMaterials.enterQuantity') }]}>
                <InputNumber
                  min={0.001} step={0.1} precision={3}
                  style={{ width: '100%' }}
                  addonAfter={selectedUnit}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="unit" label={t('common.unit')} rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="kg">kg</Select.Option>
                  <Select.Option value="lt">lt</Select.Option>
                  <Select.Option value="adet">adet</Select.Option>
                  <Select.Option value="gr">gr</Select.Option>
                  <Select.Option value="ml">ml</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={t('common.unitPrice')} required style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item
                name="unit_price"
                noStyle
                rules={[{ required: true, message: t('rawMaterials.enterQuantity') }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  precision={2}
                  style={{ flex: 1 }}
                  placeholder="0.00"
                />
              </Form.Item>
              <Form.Item name="currency" noStyle initialValue="EUR">
                <CurrencySelect />
              </Form.Item>
            </div>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.unit_price !== cur.unit_price || prev.currency !== cur.currency}>
              {({ getFieldValue }) => (
                <EurEquivalentPreview
                  amount={getFieldValue('unit_price')}
                  currency={getFieldValue('currency')}
                />
              )}
            </Form.Item>
          </Form.Item>

          <Form.Item name="supplier_name" label={t('common.supplier')}>
            <Input placeholder={t('rawMaterials.supplierPlaceholder')} />
          </Form.Item>

          <Form.Item name="expiry_date" label={t('common.expiryDate')}>
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder={t('rawMaterials.expiryPlaceholder')} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              {t('rawMaterials.addToStock')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 📸 Yapay Zeka Fatura / İrsaliye Okuma (OCR) Modalı ── */}
      <Modal
        title={
          <Space>
            <ScanOutlined style={{ color: '#722ed1' }} />
            <span>{t('ocr.modalTitle')}</span>
            <Tag color="purple">{t('ocr.smartRecognitionTag')}</Tag>
          </Space>
        }
        open={ocrOpen}
        onCancel={() => setOcrOpen(false)}
        width={750}
        footer={
          <Space>
            <Button onClick={() => setOcrOpen(false)}>{t('ocr.cancel')}</Button>
            <Button
              type="primary"
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
              icon={<CheckCircleFilled />}
              disabled={!ocrResult}
              onClick={applyOcrToForm}
            >
              {t('ocr.applyToForm')}
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('ocr.engineNoticeTitle')}
          description={t('ocr.engineNoticeDesc')}
        />

        {/* Demo Şablon Seçimi */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('ocr.readyTemplates')}
          </Text>
          <Radio.Group
            value={ocrSample}
            onChange={e => runOcr(e.target.value)}
            buttonStyle="solid"
            style={{ width: '100%' }}
          >
            <Row gutter={[8, 8]}>
              <Col span={8}>
                <Radio.Button value="sample_meat" style={{ width: '100%', textAlign: 'center', height: 'auto', padding: '8px 4px' }}>
                  <div style={{ fontWeight: 600 }}>{t('ocr.tplMeat')}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{t('ocr.tplMeatSub')}</div>
                </Radio.Button>
              </Col>
              <Col span={8}>
                <Radio.Button value="sample_spice" style={{ width: '100%', textAlign: 'center', height: 'auto', padding: '8px 4px' }}>
                  <div style={{ fontWeight: 600 }}>{t('ocr.tplSpice')}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{t('ocr.tplSpiceSub')}</div>
                </Radio.Button>
              </Col>
              <Col span={8}>
                <Radio.Button value="sample_casing" style={{ width: '100%', textAlign: 'center', height: 'auto', padding: '8px 4px' }}>
                  <div style={{ fontWeight: 600 }}>{t('ocr.tplCasing')}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{t('ocr.tplCasingSub')}</div>
                </Radio.Button>
              </Col>
            </Row>
          </Radio.Group>
        </div>

        {/* OCR Sonuç Kartı */}
        {ocrLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip={t('ocr.scanning')} />
          </div>
        ) : ocrResult ? (
          <div>
            <div style={{
              background: '#f9f0ff', padding: '12px 16px', borderRadius: 8,
              border: '1px solid #d3adf7', marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Space>
                <ThunderboltOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                <Text strong style={{ color: '#531dab' }}>
                  {t('ocr.successScore')} %{(ocrResult.confidence * 100).toFixed(1)}
                </Text>
              </Space>
              <Tag color="success">{t('ocr.highAccuracy')}</Tag>
            </div>

            <Row gutter={16}>
              {/* Sol: Ayrıştırılan Alanlar */}
              <Col span={13}>
                <Card size="small" title={t('ocr.parsedDataCard')} style={{ height: '100%' }}>
                  <Descriptions size="small" bordered column={1}>
                    <Descriptions.Item label={t('ocr.supplierName')}>
                      <Text strong>{ocrResult.supplier_name}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('ocr.invoiceNumber')}>
                      <Tag color="blue">{ocrResult.invoice_number}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('ocr.material')}>
                      <Tag color="volcano">{ocrResult.material_label || ocrResult.material_type}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('ocr.quantity')}>
                      <Text strong style={{ color: '#1890ff' }}>{ocrResult.quantity} {ocrResult.unit}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('ocr.unitPrice')}>
                      {formatMoney(ocrResult.unit_price, (ocrResult as any).currency || 'EUR')} / {ocrResult.unit}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('ocr.totalAmount')}>
                      <Text strong style={{ color: '#52c41a' }}>{formatMoney(ocrResult.total_amount, (ocrResult as any).currency || 'EUR', true)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('ocr.lotNumber')}>
                      <Tag color="purple">{ocrResult.lot_number}</Tag>
                    </Descriptions.Item>
                    {ocrResult.expiry_date && (
                      <Descriptions.Item label={t('ocr.expiryDate')}>
                        {dayjs(ocrResult.expiry_date).format('DD.MM.YYYY')}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Col>

              {/* Sağ: Belgeden Çıkarılan Ham Metin */}
              <Col span={11}>
                <Card size="small" title={t('ocr.rawTextCard')} style={{ height: '100%', background: '#fafafa' }}>
                  <pre style={{
                    fontSize: 11, background: '#262626', color: '#52c41a',
                    padding: 10, borderRadius: 6, maxHeight: 220, overflowY: 'auto',
                    margin: 0, fontFamily: 'monospace',
                  }}>
                    {ocrResult.detected_text}
                  </pre>
                  <Paragraph type="secondary" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
                    {t('ocr.nlpNote')}
                  </Paragraph>
                </Card>
              </Col>
            </Row>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
