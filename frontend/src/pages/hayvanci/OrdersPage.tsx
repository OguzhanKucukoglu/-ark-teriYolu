import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Typography, Tag, Descriptions,
  Divider, App, Empty,
} from 'antd';
import { EyeOutlined, ShoppingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '../../services/api';

const { Title, Text } = Typography;

interface Order {
  id: number;
  buyer_id: number;
  buyer_name: string;
  seller_id: number;
  seller_name: string;
  seller_phone?: string;
  seller_address?: string;
  product_name: string;
  expected_qty: number;
  status: string;
  order_date: string;
  notes?: string;
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
  beklemede:           { color: 'orange',  label: '⏳ Onay Bekleniyor' },
  onaylandi:           { color: 'green',   label: '✅ Onaylandı' },
  hammadde_gonderildi: { color: 'blue',    label: '📦 Hammadde Gönderildi' },
  uretimde:            { color: 'purple',  label: '⚙️ Üretimde' },
  tamamlandi:          { color: 'success', label: '🎉 Tamamlandı' },
  iptal:               { color: 'red',     label: '❌ İptal' },
};

export default function OrdersPage() {
  const { message } = App.useApp();
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail]         = useState<{ order: Order; rawMaterials: RawMaterial[] } | null>(null);

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

  const columns = [
    {
      title: 'Sucukçu', dataIndex: 'seller_name', key: 'seller_name',
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
      title: '', key: 'action',
      render: (_: unknown, r: Order) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>
          Detay
        </Button>
      ),
    },
  ];

  const bekleyen = orders.filter(o => o.status === 'beklemede').length;
  const onaylandi = orders.filter(o => o.status === 'onaylandi').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ShoppingOutlined /> Siparişlerim
        </Title>
        <div style={{ display: 'flex', gap: 8 }}>
          {bekleyen > 0 && <Tag color="orange">{bekleyen} beklemede</Tag>}
          {onaylandi > 0 && <Tag color="green">{onaylandi} onaylandı</Tag>}
        </div>
      </div>

      {orders.length === 0 && !loading ? (
        <Empty description="Henüz sipariş vermediniz" />
      ) : (
        <Table
          dataSource={orders} columns={columns} rowKey="id"
          loading={loading} pagination={{ pageSize: 15 }}
        />
      )}

      {/* Detay Modalı */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={560}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingOutlined />
            <span>Sipariş #{detail?.order.id}</span>
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
            {/* Sucukçu bilgileri */}
            <div style={{
              background: '#f0f5ff', borderRadius: 10, padding: '12px 16px',
              marginBottom: 16, border: '1px solid #adc6ff',
            }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                Üretici Bilgileri
              </Text>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <Text strong style={{ fontSize: 14 }}>{detail.order.seller_name}</Text>
                </div>
                {detail.order.seller_phone && (
                  <div style={{ color: '#595959' }}>
                    📞 {detail.order.seller_phone}
                  </div>
                )}
                {detail.order.seller_address && (
                  <div style={{ color: '#595959' }}>
                    📍 {detail.order.seller_address}
                  </div>
                )}
              </div>
            </div>

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
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
                <Divider style={{ margin: '12px 0' }}>Gönderilen Hammaddeler</Divider>
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

            {/* Durum açıklaması */}
            {detail.order.status === 'beklemede' && (
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f',
              }}>
                <Text style={{ fontSize: 12 }}>
                  ⏳ Sucukçunun onayı bekleniyor. Onaylandığında hammaddeler stoğunuzdan düşülecektir.
                </Text>
              </div>
            )}
            {detail.order.status === 'onaylandi' && (
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f',
              }}>
                <Text style={{ fontSize: 12, color: '#52c41a' }}>
                  ✅ Sipariş onaylandı. Hammaddeler stoğunuzdan düşüldü.
                </Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
