import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Modal, Typography, Tag, Descriptions,
  Divider, Space, Popconfirm, Alert, App,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, EyeOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '../../services/api';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbStatus, formatDbPart, formatDbProduct } from '../../i18n/formatters';

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
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
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
        message.success('Sipariş onaylandı ve doğrudan Üretim Yönetimine aktarıldı!');
        if (detailOpen) setDetailOpen(false);
        navigate('/production');
        return;
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
      title: t('production.farmLabel'), dataIndex: 'buyer_name', key: 'buyer_name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: t('production.productName'), dataIndex: 'product_name', key: 'product_name',
    },
    {
      title: t('production.expectedQty'), dataIndex: 'expected_qty', key: 'expected_qty',
      render: (v: number) => <Tag color="blue">{Math.round(Number(v))} {t('production.packageUnit')}</Tag>,
    },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const s = STATUS_MAP[v] ?? { color: 'default' };
        return <Tag color={s.color}>{formatDbStatus(v, t)}</Tag>;
      },
    },
    {
      title: t('common.date'), dataIndex: 'order_date', key: 'order_date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: t('common.actions'), key: 'actions',
      render: (_: unknown, r: Order) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>
            {t('common.details')}
          </Button>
          {r.status === 'beklemede' && (
            <>
              <Popconfirm
                title={t('orders.confirmOrderTitle')}
                onConfirm={() => updateStatus(r.id, 'onaylandi')}
                okText={t('common.yes')} cancelText={t('common.no')}
                okType="primary"
              >
                <Button
                  size="small" type="primary" icon={<CheckOutlined />}
                  loading={updating === r.id}
                >
                  {t('common.confirm')}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t('orders.cancelOrderTitle')}
                onConfirm={() => updateStatus(r.id, 'iptal')}
                okText={t('common.yes')} cancelText={t('common.no')} okType="danger"
              >
                <Button size="small" danger icon={<CloseOutlined />}>
                  {t('common.cancel')}
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
          <ShoppingOutlined /> {t('orders.title')}
        </Title>
        <Tag color="blue">{orders.filter(o => o.status === 'beklemede').length} {t('common.pending')}</Tag>
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
                title={t('orders.cancelOrderTitle')}
                onConfirm={() => updateStatus(detail.order.id, 'iptal')}
                okText={t('common.yes')} cancelText={t('common.no')} okType="danger"
              >
                <Button danger icon={<CloseOutlined />}>{t('common.cancel')}</Button>
              </Popconfirm>
              <Popconfirm
                title={t('orders.confirmOrderTitle')}
                onConfirm={() => updateStatus(detail.order.id, 'onaylandi')}
                okText={t('common.yes')} cancelText={t('common.no')} okType="primary"
              >
                <Button type="primary" icon={<CheckOutlined />}
                  loading={updating === detail?.order.id}>
                  {t('common.confirm')}
                </Button>
              </Popconfirm>
            </Space>
          ) : null
        }
        width={580}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingOutlined />
            <span>{t('orders.detailTitle')} #{detail?.order.id}</span>
            {detail && (
              <Tag color={STATUS_MAP[detail.order.status]?.color ?? 'default'}>
                {detail.order.status === 'beklemede' ? t('common.pending') : detail.order.status === 'uretimde' ? t('common.inProduction') : detail.order.status === 'tamamlandi' ? t('common.completed') : (STATUS_MAP[detail.order.status]?.label ?? detail.order.status)}
              </Tag>
            )}
          </div>
        }
      >
        {detail && (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('production.farmLabel')} span={2}>
                <Text strong>{detail.order.buyer_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('production.productName')}>{formatDbProduct(detail.order.product_name, t)}</Descriptions.Item>
              <Descriptions.Item label={t('production.expectedQty')}>
                <Text strong style={{ color: '#52c41a' }}>{Math.round(Number(detail.order.expected_qty))} {formatUnit('paket', t)}</Text>
                <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>(1 kg / {formatUnit('paket', t)})</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.orderDate')} span={2}>
                {dayjs(detail.order.order_date).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              {detail.order.notes && (
                <Descriptions.Item label={t('common.notes')} span={2}>
                  {detail.order.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {detail.rawMaterials.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }}>{t('orders.sentRawMaterials')}</Divider>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.rawMaterials.map(rm => (
                    <div key={rm.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 12px', background: '#fafafa', borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}>
                      <Text>{formatDbPart(rm.material_type, t)}</Text>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Tag color="blue">{Number(rm.quantity).toFixed(2)} {formatUnit(rm.unit, t)}</Tag>
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
                message={t('orders.approveStockNotice')}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
