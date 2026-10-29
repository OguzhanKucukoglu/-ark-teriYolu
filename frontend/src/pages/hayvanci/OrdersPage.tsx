import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Typography, Tag, Descriptions,
  Divider, App, Empty, Space,
} from 'antd';
import { EyeOutlined, ShoppingOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService, invoiceService } from '../../services/api';
import { Invoice } from '../../types';
import { InvoiceModal } from '../../components/InvoiceModal';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbStatus, formatDbPart, formatDbProduct } from '../../i18n/formatters';

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
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail]         = useState<{ order: Order; rawMaterials: RawMaterial[] } | null>(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  async function openInvoice(orderId: number) {
    try {
      const { data } = await invoiceService.getAll({ order_id: orderId });
      if (data && data.length > 0) {
        setSelectedInvoice(data[0]);
        setInvoiceModalVisible(true);
      } else {
        message.warning(t('common.noData'));
      }
    } catch {
      message.error(t('common.error'));
    }
  }

  async function load() {
    try {
      const { data } = await orderService.getAll();
      setOrders(data);
    } catch {
      message.error(t('common.error'));
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
      message.error(t('common.error'));
    }
  }

  const columns = [
    {
      title: t('roles.sucukcu'), dataIndex: 'seller_name', key: 'seller_name',
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
      title: t('common.actions'), key: 'action',
      render: (_: unknown, r: Order) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>
            {t('common.details')}
          </Button>
          {r.status === 'tamamlandi' && (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => openInvoice(r.id)}
            >
              {t('invoices.title')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const bekleyen = orders.filter(o => o.status === 'beklemede').length;
  const onaylandi = orders.filter(o => o.status === 'onaylandi').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ShoppingOutlined /> {t('nav.orders')}
        </Title>
        <div style={{ display: 'flex', gap: 8 }}>
          {bekleyen > 0 && <Tag color="orange">{bekleyen} {t('common.pending')}</Tag>}
          {onaylandi > 0 && <Tag color="green">{onaylandi} {t('common.confirm')}</Tag>}
        </div>
      </div>

      {orders.length === 0 && !loading ? (
        <Empty description={t('common.noData')} />
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
            <span>{t('orders.detailTitle')} #{detail?.order.id}</span>
            {detail && (
              <Tag color={STATUS_MAP[detail.order.status]?.color ?? 'default'}>
                {formatDbStatus(detail.order.status, t)}
              </Tag>
            )}
          </div>
        }
      >
        {detail && (
          <div>
            {/* Üretici bilgileri */}
            <div style={{
              background: '#f0f5ff', borderRadius: 10, padding: '12px 16px',
              marginBottom: 16, border: '1px solid #adc6ff',
            }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                {t('roles.sucukcu')}
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

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
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

            {/* Durum açıklaması */}
            {detail.order.status === 'beklemede' && (
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f',
              }}>
                <Text style={{ fontSize: 12 }}>
                  {t('orders.waitingProducerApproval')}
                </Text>
              </div>
            )}
            {detail.order.status === 'onaylandi' && (
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f',
              }}>
                <Text style={{ fontSize: 12, color: '#52c41a' }}>
                  {t('orders.orderApprovedNotice')}
                </Text>
              </div>
            )}
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
