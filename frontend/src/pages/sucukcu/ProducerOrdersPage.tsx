import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Typography, Tag, Descriptions,
  Divider, Space, Popconfirm, Alert, App,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, EyeOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '../../services/api';

const { Title, Text } = Typography;

interface Order {
  id: number;
  buyer_id: number;
  buyer_name: string;
  seller_id: number;
  product_name: string;
  expected_qty: number;
  status: string;
  order_date: string;
  notes?: string;
  seller_phone?: string;
  seller_address?: string;
}

interface RawMaterial {
  id: number;
  material_type: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  lot_number: string;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  beklemede:           { color: 'orange',  label: 'Beklemede' },
  onaylandi:           { color: 'green',   label: 'Onaylandı' },
  hammadde_gonderildi: { color: 'blue',    label: 'Hammadde Gönderildi' },
  uretimde:            { color: 'purple',  label: 'Üretimde' },
  tamamlandi:          { color: 'success', label: 'Tamamlandı' },
  iptal:               { color: 'red',     label: 'İptal' },
};

export default function ProducerOrdersPage() {
  const { message } = App.useApp();
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail]     = useState<{ order: Order; rawMaterials: RawMaterial[] } | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  async function load() {
    try {
      const { data } = await orderService.getAll();
      setOrders(data);
    } catch {
      message.error('Siparişler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function viewDetail(id: number) {
    try {
      const { data } = await orderService.getById(id);
      setDetail(data);
      setDetailOpen(true);
    } catch {
      message.error('Detay yüklenemedi');
    }
  }

  async function updateStatus(id: number, status: string) {
    setUpdating(id);
    try {
      await orderService.updateStatus(id, status);
      if (status === 'onaylandi') {
        message.success('Sipariş onaylandı — hammaddeler hayvancının stoğundan düşüldü');
      } else if (status === 'iptal') {
        message.success('Sipariş iptal edildi');
      }
      load();
      if (detailOpen) setDetailOpen(false);
    } catch {
      message.error('Durum güncellenemedi');
    } finally {
      setUpdating(null);
    }
  }

  const columns = [
    {
      title: 'Hayvancı', dataIndex: 'buyer_name', key: 'buyer_name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Ürün', dataIndex: 'product_name', key: 'product_name',
    },
    {
      title: 'Beklenen Miktar', dataIndex: 'expected_qty', key: 'expected_qty',
      render: (v: number) => `${Number(v).toFixed(1)} kg`,
    },
    {
      title: 'Durum', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const s = STATUS_MAP[v] ?? { color: 'default', label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Tarih', dataIndex: 'order_date', key: 'order_date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'İşlemler', key: 'actions',
      render: (_: unknown, r: Order) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>
            Detay
          </Button>
          {r.status === 'beklemede' && (
            <>
              <Popconfirm
                title="Siparişi onaylamak istiyor musunuz?"
                description="Onaylandığında hammaddeler hayvancının stoğundan düşülecektir."
                onConfirm={() => updateStatus(r.id, 'onaylandi')}
                okText="Evet, Onayla" cancelText="Hayır"
                okType="primary"
              >
                <Button
                  size="small" type="primary" icon={<CheckOutlined />}
                  loading={updating === r.id}
                >
                  Onayla
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Siparişi iptal etmek istiyor musunuz?"
                onConfirm={() => updateStatus(r.id, 'iptal')}
                okText="Evet" cancelText="Hayır" okType="danger"
              >
                <Button size="small" danger icon={<CloseOutlined />}>
                  Reddet
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ShoppingOutlined /> Gelen Siparişler
        </Title>
        <Tag color="blue">{orders.filter(o => o.status === 'beklemede').length} bekleyen</Tag>
      </div>

      <Table
        dataSource={orders} columns={columns} rowKey="id"
        loading={loading} pagination={{ pageSize: 15 }}
        rowClassName={r => r.status === 'beklemede' ? '' : 'opacity-60'}
      />

      {/* Detay Modalı */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          detail?.order.status === 'beklemede' ? (
            <Space>
              <Popconfirm
                title="Siparişi iptal etmek istiyor musunuz?"
                onConfirm={() => updateStatus(detail.order.id, 'iptal')}
                okText="Evet" cancelText="Hayır" okType="danger"
              >
                <Button danger icon={<CloseOutlined />}>Reddet</Button>
              </Popconfirm>
              <Popconfirm
                title="Siparişi onaylamak istiyor musunuz?"
                description="Onaylandığında hammaddeler hayvancının stoğundan düşülecektir."
                onConfirm={() => updateStatus(detail.order.id, 'onaylandi')}
                okText="Evet, Onayla" cancelText="Hayır" okType="primary"
              >
                <Button type="primary" icon={<CheckOutlined />}
                  loading={updating === detail?.order.id}>
                  Onayla
                </Button>
              </Popconfirm>
            </Space>
          ) : null
        }
        width={580}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingOutlined />
            <span>Sipariş #{detail?.order.id} — Detay</span>
            {detail && (
              <Tag color={STATUS_MAP[detail.order.status]?.color ?? 'default'}>
                {STATUS_MAP[detail.order.status]?.label ?? detail.order.status}
              </Tag>
            )}
          </div>
        }
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Hayvancı" span={2}>
                <Text strong>{detail.order.buyer_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ürün">{detail.order.product_name}</Descriptions.Item>
              <Descriptions.Item label="Beklenen Miktar">
                {Number(detail.order.expected_qty).toFixed(1)} kg
              </Descriptions.Item>
              <Descriptions.Item label="Sipariş Tarihi" span={2}>
                {dayjs(detail.order.order_date).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              {detail.order.notes && (
                <Descriptions.Item label="Not" span={2}>
                  {detail.order.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {detail.rawMaterials.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }}>Gönderilecek Hammaddeler</Divider>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.rawMaterials.map(rm => (
                    <div key={rm.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 12px', background: '#fafafa', borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}>
                      <Text>{rm.material_type}</Text>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Tag color="blue">{Number(rm.quantity).toFixed(2)} {rm.unit}</Tag>
                        <Tag>{rm.lot_number}</Tag>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {detail.order.status === 'beklemede' && (
              <Alert
                type="warning" showIcon style={{ marginTop: 16, fontSize: 12 }}
                message="Onayladığınızda hammaddeler hayvancının stoğundan otomatik düşülecektir."
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
