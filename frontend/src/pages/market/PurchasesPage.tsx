import { useEffect, useState } from 'react';
import {
  Table, Tag, Typography, Button, Modal, Form, Input,
  Card, Row, Col, Statistic, Empty, App, Alert, Space,
} from 'antd';
import {
  ShoppingCartOutlined, WarningOutlined, PhoneOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseService, invoiceService } from '../../services/api';
import { Invoice } from '../../types';
import { InvoiceModal } from '../../components/InvoiceModal';
import { formatMoney, convertToEur } from '../../utils/currency';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Purchase {
  id: number;
  market_id: number;
  farmer_id: number;
  farmer_name: string;
  farmer_phone?: string;
  listing_id: number;
  product_name?: string;
  lot_id: number;
  lot_number: string;
  lot_status?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  currency?: string;
  status: string;
  purchase_date: string;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  beklemede:     { color: 'orange',  label: 'Beklemede' },
  onaylandi:     { color: 'blue',    label: 'Onaylandı' },
  sevk_edildi:   { color: 'purple',  label: 'Sevk Edildi' },
  teslim_alindi: { color: 'green',   label: 'Teslim Alındı' },
};

export default function PurchasesPage() {
  const { message } = App.useApp();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading]     = useState(true);

  // Sorun bildir modalı
  const [feedbackOpen, setFeedbackOpen]       = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [submitting, setSubmitting]           = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [form] = Form.useForm();

  async function openInvoice(purchaseId: number) {
    try {
      const { data } = await invoiceService.getAll({ reference_type: 'market_purchase', reference_id: purchaseId });
      if (data && data.length > 0) {
        setSelectedInvoice(data[0]);
        setInvoiceModalVisible(true);
      } else {
        message.warning('Bu işleme ait fatura bulunamadı');
      }
    } catch {
      message.error('Fatura yüklenemedi');
    }
  }

  async function load() {
    try {
      const { data } = await purchaseService.getAll();
      setPurchases(data);
    } catch {
      message.error('Satın almalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openFeedback(purchase: Purchase) {
    setSelectedPurchase(purchase);
    form.resetFields();
    setFeedbackOpen(true);
  }

  async function onFeedbackSubmit(values: { issue: string }) {
    if (!selectedPurchase) return;
    setSubmitting(true);
    try {
      await purchaseService.feedback(selectedPurchase.lot_number, values.issue, {
        farmer_id: selectedPurchase.farmer_id,
        lot_id:    selectedPurchase.lot_id,
      });
      message.success('Kalite bildirimi işletmeye iletildi');
      setFeedbackOpen(false);
      form.resetFields();
    } catch {
      message.error('Geri bildirim gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  }

  const totalSpent = purchases.reduce((sum, p) => sum + convertToEur(Number(p.total_price), p.currency), 0);
  const recalledPurchases = purchases.filter(p => p.lot_status === 'recalled' || p.lot_status === 'blocked');

  const columns = [
    {
      title: 'Ürün / Lot', key: 'product',
      render: (_: unknown, r: Purchase) => (
        <div>
          <Text strong>{r.product_name || r.lot_number}</Text>
          <div>
            <Tag color={r.lot_status === 'recalled' ? 'red' : 'blue'} style={{ fontSize: 11 }}>
              {r.lot_number}
            </Tag>
            {r.lot_status === 'recalled' && (
              <Tag color="red" style={{ fontSize: 11 }}>⚠️ GERİ ÇAĞRILDI</Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Satıcı (İşletme)', key: 'farmer',
      render: (_: unknown, r: Purchase) => (
        <div>
          <Text strong>{r.farmer_name}</Text>
          {r.farmer_phone && (
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
              <PhoneOutlined style={{ marginRight: 4 }} />{r.farmer_phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Miktar', key: 'qty',
      render: (_: unknown, r: Purchase) => `${Number(r.quantity).toFixed(2)} ${r.unit}`,
    },
    {
      title: 'Birim Fiyat', dataIndex: 'unit_price', key: 'unit_price',
      render: (v: number, r: Purchase) => `${formatMoney(v, r.currency)} / ${r.unit}`,
    },
    {
      title: 'Toplam Tutar', dataIndex: 'total_price', key: 'total_price',
      render: (v: number, r: Purchase) => <Tag color="green">{formatMoney(v, r.currency, true)}</Tag>,
    },
    {
      title: 'Durum', dataIndex: 'status', key: 'status',
      render: (v: string, r: Purchase) => {
        if (r.lot_status === 'recalled') {
          return <Tag color="red">Geri Çağrıldı (Satış Bloke)</Tag>;
        }
        const s = STATUS_MAP[v] ?? { color: 'default', label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Tarih', dataIndex: 'purchase_date', key: 'purchase_date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'İşlem', key: 'action',
      render: (_: unknown, r: Purchase) => (
        <Space size="small">
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => openInvoice(r.id)}
          >
            Fatura
          </Button>
          <Button
            size="small"
            danger
            icon={<WarningOutlined />}
            onClick={() => openFeedback(r)}
          >
            Sorun Bildir
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ShoppingCartOutlined /> Satın Almalarım
        </Title>
      </div>

      {recalledPurchases.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Dikkat: Satın aldığınız ${recalledPurchases.length} kalem ürün için Geri Çağırma (Recall) başlatılmıştır!`}
          description={`Etkilenen lotlar: ${[...new Set(recalledPurchases.map(p => p.lot_number))].join(', ')}. Bu ürünlerin satışı bloke edilmiştir, lütfen tedarikçi işletme ile iletişime geçiniz.`}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Toplam Alım" value={purchases.length} suffix="işlem" />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Toplam Harcama"
              value={totalSpent.toFixed(2)}
              suffix="€"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Geri Çağrılan Ürün"
              value={recalledPurchases.length}
              suffix="kalem"
              valueStyle={{ color: recalledPurchases.length > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {purchases.length === 0 && !loading ? (
        <Empty description="Henüz satın alma işleminiz bulunmuyor" />
      ) : (
        <Table
          dataSource={purchases}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      )}

      <Modal
        open={feedbackOpen}
        onCancel={() => setFeedbackOpen(false)}
        footer={null}
        width={440}
        title={<><WarningOutlined style={{ color: '#faad14' }} /> Lot Kalite Sorunu Bildir</>}
      >
        {selectedPurchase && (
          <Form form={form} onFinish={onFeedbackSubmit} layout="vertical">
            <div style={{
              padding: '8px 12px', background: '#fffbe6', borderRadius: 8,
              border: '1px solid #ffe58f', marginBottom: 16,
            }}>
              <Text strong>{selectedPurchase.product_name || selectedPurchase.lot_number}</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color="blue">{selectedPurchase.lot_number}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Satıcı: {selectedPurchase.farmer_name}
                </Text>
              </div>
            </div>

            <Form.Item
              name="issue"
              label="Sorun Açıklaması"
              rules={[{ required: true, min: 5, message: 'Lütfen sorunu kısaca açıklayın' }]}
            >
              <TextArea rows={3} placeholder="Tespit edilen kalite/ambalaj/soğuk zincir sorununu yazın..." />
            </Form.Item>

            <Button type="primary" danger htmlType="submit" block loading={submitting}>
              Bildirimi Gönder
            </Button>
          </Form>
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
