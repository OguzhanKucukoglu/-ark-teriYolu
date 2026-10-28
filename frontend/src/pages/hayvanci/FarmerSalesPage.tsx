import { useEffect, useState, useMemo } from 'react';
import {
  Table, Tag, Typography, Button, Space, Card, Row, Col,
  Statistic, Empty, App, Alert, Tabs, Modal, Descriptions, Badge,
} from 'antd';
import {
  DollarCircleOutlined, ShopOutlined, WarningOutlined,
  EyeOutlined, PhoneOutlined, EnvironmentOutlined, CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { purchaseService, invoiceService } from '../../services/api';
import { Invoice } from '../../types';
import { InvoiceModal } from '../../components/InvoiceModal';

const { Title, Text } = Typography;

interface SaleItem {
  id: number;
  market_id: number;
  market_name: string;
  market_phone?: string;
  market_address?: string;
  listing_id: number;
  product_name?: string;
  lot_id: number;
  lot_number: string;
  lot_status: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  status: string;
  purchase_date: string;
  complaint_count?: number;
  latest_complaint?: string;
}

interface ComplaintItem {
  id: number;
  title: string;
  message: string;
  lot_id: number;
  lot_number: string;
  lot_status: string;
  lot_quantity: number;
  lot_unit: string;
  is_read: boolean | number;
  created_at: string;
}

export default function FarmerSalesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [sales, setSales]               = useState<SaleItem[]>([]);
  const [complaints, setComplaints]     = useState<ComplaintItem[]>([]);
  const [loading, setLoading]           = useState(true);

  // Detay modalı
  const [detailOpen, setDetailOpen]     = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleItem | null>(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  async function openInvoice(purchaseId: number) {
    try {
      const { data } = await invoiceService.getAll({ reference_type: 'market_purchase', reference_id: purchaseId });
      if (data && data.length > 0) {
        setSelectedInvoice(data[0]);
        setInvoiceModalVisible(true);
      } else {
        message.warning('Bu satışa ait fatura bulunamadı');
      }
    } catch {
      message.error('Fatura yüklenemedi');
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [salesRes, complaintsRes] = await Promise.all([
        purchaseService.getAll(),
        purchaseService.getComplaints().catch(() => ({ data: [] })),
      ]);
      setSales(salesRes.data || []);
      setComplaints(complaintsRes.data || []);
    } catch {
      message.error('Satış bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // İstatistik hesaplamaları
  const totalRevenue = useMemo(
    () => sales.reduce((sum, s) => sum + Number(s.total_price || 0), 0),
    [sales]
  );

  const problemCount = useMemo(
    () => sales.filter(s => Number(s.complaint_count || 0) > 0 || s.lot_status === 'recalled').length,
    [sales]
  );

  const columns = [
    {
      title: 'Ürün / Lot',
      key: 'product',
      render: (_: unknown, r: SaleItem) => (
        <div>
          <Text strong>{r.product_name || r.lot_number}</Text>
          <div>
            <Tag color={r.lot_status === 'recalled' ? 'red' : 'blue'} style={{ fontSize: 11 }}>
              {r.lot_number}
            </Tag>
            {r.lot_status === 'recalled' && (
              <Tag color="red" style={{ fontSize: 11 }}>Geri Çekildi</Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Alıcı Market',
      key: 'market',
      render: (_: unknown, r: SaleItem) => (
        <div>
          <Text strong style={{ color: '#1890ff' }}>
            <ShopOutlined style={{ marginRight: 4 }} />
            {r.market_name}
          </Text>
          {r.market_phone && (
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              <PhoneOutlined style={{ marginRight: 4 }} />{r.market_phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Miktar',
      key: 'quantity',
      render: (_: unknown, r: SaleItem) => `${Number(r.quantity).toFixed(2)} ${r.unit}`,
    },
    {
      title: 'Birim Fiyat',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (v: number, r: SaleItem) => `${Number(v).toFixed(2)} € / ${r.unit}`,
    },
    {
      title: 'Toplam Tutar',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (v: number) => (
        <Tag color="green" style={{ fontSize: 13, fontWeight: 600 }}>
          {Number(v).toFixed(2)} €
        </Tag>
      ),
    },
    {
      title: 'Kalite Durumu',
      key: 'status',
      render: (_: unknown, r: SaleItem) => {
        const hasIssue = Number(r.complaint_count || 0) > 0;
        if (r.lot_status === 'recalled') {
          return <Tag color="error">⚠️ Geri Çağrıldı</Tag>;
        }
        if (hasIssue) {
          return (
            <Badge status="error" text={<Tag color="error">Sorun Bildirildi ({r.complaint_count})</Tag>} />
          );
        }
        return <Tag color="success"><CheckCircleOutlined /> Sorunsuz</Tag>;
      },
    },
    {
      title: 'Satış Tarihi',
      dataIndex: 'purchase_date',
      key: 'purchase_date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'İşlem',
      key: 'actions',
      render: (_: unknown, r: SaleItem) => (
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
            icon={<EyeOutlined />}
            onClick={() => { setSelectedSale(r); setDetailOpen(true); }}
          >
            Detay
          </Button>
          <Button
            size="small"
            type="link"
            style={{ padding: 0 }}
            onClick={() => navigate(`/lots/${r.lot_id}/trace`)}
          >
            İzle
          </Button>
          {(Number(r.complaint_count || 0) > 0 || r.lot_status === 'recalled') && (
            <Button
              size="small"
              danger
              onClick={() => navigate('/recalls')}
            >
              Geri Çağır
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const complaintColumns = [
    {
      title: 'Sorun Bildirilen Lot',
      key: 'lot',
      render: (_: unknown, c: ComplaintItem) => (
        <div>
          <Tag color="red" style={{ fontSize: 12, fontWeight: 600 }}>{c.lot_number}</Tag>
          <div style={{ marginTop: 2 }}>
            <Tag color={c.lot_status === 'recalled' ? 'red' : 'default'} style={{ fontSize: 10 }}>
              {c.lot_status === 'recalled' ? 'Geri Çekildi (Bloke)' : 'Aktif'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Bildirim Başlığı & Mesajı',
      key: 'message',
      render: (_: unknown, c: ComplaintItem) => (
        <div>
          <Text strong style={{ color: '#cf1322', display: 'block' }}>
            {c.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#434343' }}>
            {c.message}
          </Text>
        </div>
      ),
    },
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Hızlı Aksiyon',
      key: 'action',
      render: (_: unknown, c: ComplaintItem) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/lots/${c.lot_id}/trace`)}
          >
            Lot İzleme
          </Button>
          <Button
            size="small"
            danger
            icon={<WarningOutlined />}
            onClick={() => navigate('/recalls')}
          >
            Geri Çağırma Başlat
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DollarCircleOutlined /> Satışlarım
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Marketlere yapılan ürün satışları ve gelen kalite / sorun geri bildirimleri
          </Text>
        </div>
        <Button onClick={loadData}>Yenile</Button>
      </div>

      {/* Problem Varsa Uyarı Kartı */}
      {problemCount > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Dikkat: Marketlerden ${problemCount} adet satışınız için kalite sorunu bildirilmiştir!`}
          description={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span>Sorunlu lotları inceleyebilir, ileriye/geriye izleme yapabilir veya geri çağırma başlatabilirsiniz.</span>
              <Button size="small" danger onClick={() => navigate('/recalls')}>
                Geri Çağırma Yönetimi
              </Button>
            </div>
          }
        />
      )}

      {/* İstatistik Kartları */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Toplam Satış"
              value={sales.length}
              suffix="işlem"
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Toplam Satış Geliri"
              value={totalRevenue.toFixed(2)}
              suffix="€"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Farklı Market Sayısı"
              value={new Set(sales.map(s => s.market_id)).size}
              suffix="market"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Sorunlu / Şikayetli Lot"
              value={problemCount}
              suffix="adet"
              valueStyle={{ color: problemCount > 0 ? '#cf1322' : '#52c41a' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Sekmeler */}
      <Tabs
        defaultActiveKey="sales"
        items={[
          {
            key: 'sales',
            label: `🛒 Satış Listesi (${sales.length})`,
            children: (
              sales.length === 0 && !loading ? (
                <Empty description="Henüz market satışı gerçekleşmedi" />
              ) : (
                <Table
                  dataSource={sales}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                />
              )
            ),
          },
          {
            key: 'complaints',
            label: (
              <span>
                ⚠️ Sorun Bildirimleri{' '}
                {complaints.length > 0 && <Tag color="red">{complaints.length}</Tag>}
              </span>
            ),
            children: (
              complaints.length === 0 && !loading ? (
                <Empty
                  description="Harika! Hiçbir marketten sorun bildirimi gelmedi."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Table
                  dataSource={complaints}
                  columns={complaintColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              )
            ),
          },
        ]}
      />

      {/* Detay Modalı */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Space>
            {selectedSale && (
              <Button
                type="primary"
                onClick={() => {
                  setDetailOpen(false);
                  navigate(`/lots/${selectedSale.lot_id}/trace`);
                }}
              >
                Lotu İzle (İleri / Geri)
              </Button>
            )}
            <Button onClick={() => setDetailOpen(false)}>Kapat</Button>
          </Space>
        }
        width={560}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            <span>Satış Detayı — #{selectedSale?.id}</span>
          </div>
        }
      >
        {selectedSale && (
          <div>
            {/* Şikayet uyarısı varsa */}
            {Number(selectedSale.complaint_count || 0) > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Bu lot için market tarafından sorun bildirilmiştir!"
                description={selectedSale.latest_complaint}
              />
            )}

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Alıcı Market" span={2}>
                <Text strong>{selectedSale.market_name}</Text>
              </Descriptions.Item>
              {selectedSale.market_phone && (
                <Descriptions.Item label="Market Telefon" span={2}>
                  <PhoneOutlined style={{ marginRight: 6 }} />{selectedSale.market_phone}
                </Descriptions.Item>
              )}
              {selectedSale.market_address && (
                <Descriptions.Item label="Market Adres" span={2}>
                  <EnvironmentOutlined style={{ marginRight: 6 }} />{selectedSale.market_address}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Ürün Adı">
                {selectedSale.product_name || selectedSale.lot_number}
              </Descriptions.Item>
              <Descriptions.Item label="Lot Numarası">
                <Tag color="blue">{selectedSale.lot_number}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Satılan Miktar">
                <Text strong>{Number(selectedSale.quantity).toFixed(2)} {selectedSale.unit}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Birim Fiyat">
                {Number(selectedSale.unit_price).toFixed(2)} € / {selectedSale.unit}
              </Descriptions.Item>
              <Descriptions.Item label="Toplam Tutar" span={2}>
                <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                  {Number(selectedSale.total_price).toFixed(2)} €
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Satış Tarihi" span={2}>
                {dayjs(selectedSale.purchase_date).format('DD.MM.YYYY HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
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
