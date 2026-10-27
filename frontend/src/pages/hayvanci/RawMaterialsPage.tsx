import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Select, InputNumber, DatePicker,
  Typography, Tag, message, Card, Statistic, Row, Col,
  Input, Popconfirm,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { rawMaterialService } from '../../services/api';

const { Title, Text } = Typography;

// Mantıklı sıra: kuru/toz → sıvı → protein bazlı → süt/yumurta → sebze/meyve
const MATERIALS = [
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
  lot_number: string;
  lot_status: string;
  created_at: string;
}

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Seçili malzeme türüne göre varsayılan birimi otomatik doldur
  const [selectedUnit, setSelectedUnit] = useState<string>('kg');

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
    .reduce((s, m) => s + Number(m.total_cost), 0);

  const columns = [
    {
      title: 'Hammadde', dataIndex: 'material_type', key: 'material_type',
      render: (v: string) => {
        const found = MATERIALS.find(m => m.label === v);
        const color = found ? CATEGORY_COLORS[found.category] : 'default';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: 'Miktar', key: 'qty',
      render: (_: unknown, r: RawMaterial) =>
        <Text strong>{Number(r.quantity).toFixed(2)} {r.unit}</Text>,
    },
    {
      title: 'Birim Fiyat', dataIndex: 'unit_price', key: 'unit_price',
      render: (v: number) => `${Number(v).toFixed(2)} €`,
    },
    {
      title: 'Toplam Değer', dataIndex: 'total_cost', key: 'total_cost',
      render: (v: number) => <Text strong>{Number(v).toFixed(2)} €</Text>,
    },
    {
      title: 'Lot No', dataIndex: 'lot_number', key: 'lot_number',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Durum', dataIndex: 'lot_status', key: 'lot_status',
      render: (v: string) => (
        <Tag color={v === 'active' ? 'green' : 'default'}>
          {v === 'active' ? 'Aktif' : v}
        </Tag>
      ),
    },
    {
      title: 'Eklenme', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
    {
      title: '', key: 'action',
      render: (_: unknown, r: RawMaterial) => (
        <Popconfirm
          title="Bu hammaddeyi silmek istiyor musunuz?"
          onConfirm={() => onDelete(r.id)}
          okText="Evet" cancelText="Hayır"
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
          <InboxOutlined /> Hammadde Stoğu
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Hammadde Ekle
        </Button>
      </div>

      {/* İstatistik kartları */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Aktif Stok Kalemi" value={activeCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Toplam Stok Değeri" value={totalValue.toFixed(2)} suffix="€" />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Toplam Kayıt" value={materials.length} />
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
        title="Hammadde Ekle"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form form={form} onFinish={onSubmit} layout="vertical" size="large">

          <Form.Item name="material_type" label="Hammadde Türü" rules={[{ required: true, message: 'Hammadde seçin' }]}>
            <Select
              showSearch
              placeholder="Seçin veya arayın"
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
              <Form.Item name="quantity" label="Miktar" rules={[{ required: true, message: 'Miktar girin' }]}>
                <InputNumber
                  min={0.001} step={0.1} precision={3}
                  style={{ width: '100%' }}
                  addonAfter={selectedUnit}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="unit" label="Birim" rules={[{ required: true }]}>
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

          <Form.Item name="unit_price" label="Birim Fiyat (€)" rules={[{ required: true, message: 'Fiyat girin' }]}>
            <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} addonAfter="€/birim" />
          </Form.Item>

          <Form.Item name="supplier_name" label="Tedarikçi">
            <Input placeholder="Tedarikçi adı (opsiyonel)" />
          </Form.Item>

          <Form.Item name="expiry_date" label="Son Kullanma Tarihi">
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder="Seçin (opsiyonel)" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Stoğa Ekle
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
