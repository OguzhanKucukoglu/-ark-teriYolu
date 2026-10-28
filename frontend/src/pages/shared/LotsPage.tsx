import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Button, Space, message } from 'antd';
import { EyeOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { lotService } from '../../services/api';
import { Lot } from '../../types';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbStatus } from '../../i18n/formatters';

const { Title } = Typography;

const statusColors: Record<string, string> = {
  active:   'green',
  blocked:  'orange',
  recalled: 'red',
  consumed: 'default',
  sold:     'blue',
};

export default function LotsPage() {
  const { t } = useTranslation();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    lotService.getAll()
      .then(r => setLots(r.data))
      .catch(() => message.error('Lotlar yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: t('common.lotNumber'), dataIndex: 'lot_number', key: 'lot_number', render: (v: string) => <strong>{v}</strong> },
    { title: t('common.details'), dataIndex: 'lot_type', key: 'lot_type' },
    { title: t('common.quantity'), key: 'qty', render: (_: unknown, r: Lot) => `${Number(r.quantity).toFixed(3)} ${formatUnit(r.unit, t)}` },
    { title: t('common.unitPrice'), dataIndex: 'unit_cost', key: 'unit_cost', render: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(4)} €` : '-' },
    { title: t('common.totalCost'), dataIndex: 'total_cost', key: 'total_cost', render: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(2)} €` : '-' },
    { title: t('common.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] ?? 'default'}>{formatDbStatus(v, t)}</Tag> },
    { title: t('common.date'), dataIndex: 'created_at', key: 'created_at', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    {
      title: t('common.actions'), key: 'action',
      render: (_: unknown, r: Lot) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/lots/${r.id}/trace`)}>{t('lots.traceForward')}</Button>
          <Button size="small" icon={<ApartmentOutlined />} onClick={() => navigate(`/lots/${r.id}/trace`)}>{t('lots.traceBackward')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>{t('nav.lots')}</Title>
      <Table dataSource={lots} columns={columns} rowKey="id" loading={loading} />
    </div>
  );
}
