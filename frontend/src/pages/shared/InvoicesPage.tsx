import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Radio,
  Typography,
  message,
  Badge,
} from 'antd';
import {
  FileTextOutlined,
  EyeOutlined,
  ShopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { invoiceService } from '../../services/api';
import { Invoice } from '../../types';
import { InvoiceModal } from '../../components/InvoiceModal';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../i18n';
import { formatUnit } from '../../i18n/formatters';

const { Title, Text } = Typography;

export const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isHayvanci = user?.role === 'hayvanci';
  const isSucukcu  = user?.role === 'sucukcu';
  const isMarket   = user?.role === 'market';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchInvoices = async (type?: string) => {
    setLoading(true);
    try {
      const params = type && type !== 'all' ? { type } : undefined;
      const res = await invoiceService.getAll(params);
      setInvoices(res.data);
    } catch {
      message.error(t('invoices.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices(selectedType);
  }, [selectedType]);

  const handleOpenInvoice = (invoice: Invoice) => {
    setActiveInvoice(invoice);
    setModalVisible(true);
  };

  const columns = [
    {
      title: t('invoices.invoiceNumber'),
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text: string, record: Invoice) => (
        <Space direction="vertical" size={0}>
          <a
            style={{ fontWeight: 600, color: '#2563eb' }}
            onClick={() => handleOpenInvoice(record)}
          >
            {text}
          </a>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {new Date(record.invoice_date).toLocaleDateString()}
          </Text>
        </Space>
      ),
    },
    {
      title: t('invoices.invoiceType'),
      dataIndex: 'invoice_type',
      key: 'invoice_type',
      render: (type: 'hizmet' | 'satis') => {
        if (type === 'hizmet') {
          return (
            <Tag icon={<ToolOutlined />} color="purple">
              {t('invoices.serviceInvoice')}
            </Tag>
          );
        }
        return (
          <Tag icon={<ShopOutlined />} color="green">
            {t('invoices.salesInvoice')}
          </Tag>
        );
      },
    },
    {
      title: t('invoices.sender'),
      key: 'sender',
      render: (_: unknown, record: Invoice) => (
        <div>
          <Text strong>{record.sender_name}</Text>
          {record.sender_id === user?.id && <Tag color="blue" style={{ marginLeft: 6 }}>{t('common.me')}</Tag>}
          <div style={{ fontSize: 11, color: '#64748b' }}>{record.sender_email}</div>
        </div>
      ),
    },
    {
      title: t('invoices.receiver'),
      key: 'receiver',
      render: (_: unknown, record: Invoice) => (
        <div>
          <Text strong>{record.receiver_name}</Text>
          {record.receiver_id === user?.id && <Tag color="cyan" style={{ marginLeft: 6 }}>{t('common.me')}</Tag>}
          <div style={{ fontSize: 11, color: '#64748b' }}>{record.receiver_email}</div>
        </div>
      ),
    },
    {
      title: t('common.lotNumber'),
      dataIndex: 'lot_number',
      key: 'lot_number',
      render: (lot: string) => (lot ? <Tag color="blue">{lot}</Tag> : '-'),
    },
    {
      title: t('common.quantity'),
      key: 'quantity',
      align: 'right' as const,
      render: (_: unknown, record: Invoice) =>
        `${Number(record.quantity).toLocaleString()} ${formatUnit(record.unit, t)}`,
    },
    {
      title: t('common.totalPrice'),
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (val: number, record: Invoice) => (
        <Text strong style={{ fontSize: 14, color: '#16a34a' }}>
          {Number(val).toFixed(2)} {record.currency}
        </Text>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={status === 'odendi' ? 'success' : 'default'} text={status === 'odendi' ? t('invoices.paid') : status.toUpperCase()} />
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: unknown, record: Invoice) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenInvoice(record)}
          >
            {t('invoices.printPdf')}
          </Button>
        </Space>
      ),
    },
  ];

  const totalAmountSum = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  const hizmetCount = invoices.filter((i) => i.invoice_type === 'hizmet').length;
  const satisCount = invoices.filter((i) => i.invoice_type === 'satis').length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8, color: '#2563eb' }} />
          {t('invoices.title')}
        </Title>
        <Text type="secondary">
          {isMarket
            ? t('invoices.subtitleMarket')
            : isSucukcu
            ? t('invoices.subtitleProducer')
            : t('invoices.subtitleEnterprise')}
        </Text>
      </div>

      {/* Summary KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Card size="small" style={{ borderRadius: 8 }}>
          <Text type="secondary">{t('invoices.totalDocs')}</Text>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a', marginTop: 4 }}>
            {invoices.length} {t('units.piece')}
          </div>
        </Card>

        {/* Fason Hizmet sadece İşletme ve Üretici için gösterilir */}
        {!isMarket && (
          <Card size="small" style={{ borderRadius: 8 }}>
            <Text type="secondary">{t('invoices.serviceInvoices')}</Text>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed', marginTop: 4 }}>
              {hizmetCount} {t('units.piece')}
            </div>
          </Card>
        )}

        {/* Satış Faturaları sadece İşletme ve Market için gösterilir */}
        {!isSucukcu && (
          <Card size="small" style={{ borderRadius: 8 }}>
            <Text type="secondary">{isMarket ? t('invoices.purchaseInvoices') : t('invoices.salesInvoices')}</Text>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
              {satisCount} {t('units.piece')}
            </div>
          </Card>
        )}

        <Card size="small" style={{ borderRadius: 8 }}>
          <Text type="secondary">{t('invoices.totalVolume')}</Text>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
            {totalAmountSum.toFixed(2)} €
          </div>
        </Card>
      </div>

      <Card
        style={{ borderRadius: 8 }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span>{t('invoices.recordsTitle')}</span>
            {isHayvanci && (
              <Radio.Group
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="all">{t('invoices.allInvoices')}</Radio.Button>
                <Radio.Button value="hizmet">{t('invoices.filterHizmet')}</Radio.Button>
                <Radio.Button value="satis">{t('invoices.filterSatis')}</Radio.Button>
              </Radio.Group>
            )}
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={invoices}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <InvoiceModal
        visible={modalVisible}
        invoice={activeInvoice}
        onClose={() => setModalVisible(false)}
      />
    </div>
  );
};
