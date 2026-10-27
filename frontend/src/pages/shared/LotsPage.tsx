import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Button, Space, message } from 'antd';
import { EyeOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { lotService } from '../../services/api';
import { Lot } from '../../types';

const { Title } = Typography;

const statusColors: Record<string, string> = {
  active:   'green',
  blocked:  'orange',
  recalled: 'red',
  consumed: 'default',
  sold:     'blue',
};
const statusLabels: Record<string, string> = {
  active:   'Aktif',
  blocked:  'Bloke',
  recalled: 'Geri Çekildi',
  consumed: 'Tüketildi',
  sold:     'Satıldı',
};

export default function LotsPage() {
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
    { title: 'Lot No', dataIndex: 'lot_number', key: 'lot_number', render: (v: string) => <strong>{v}</strong> },
    { title: 'Tür', dataIndex: 'lot_type', key: 'lot_type' },
    { title: 'Miktar', key: 'qty', render: (_: unknown, r: Lot) => `${Number(r.quantity).toFixed(3)} ${r.unit}` },
    { title: 'Birim Maliyet', dataIndex: 'unit_cost', key: 'unit_cost', render: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(4)} €` : '-' },
    { title: 'Toplam Maliyet', dataIndex: 'total_cost', key: 'total_cost', render: (v: unknown) => Number(v) > 0 ? `${Number(v).toFixed(2)} €` : '-' },
    { title: 'Durum', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] ?? 'default'}>{statusLabels[v] ?? v}</Tag> },
    { title: 'Tarih', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v ? new Date(v).toLocaleDateString('tr-TR') : '-' },
    {
      title: 'İşlem', key: 'action',
      render: (_: unknown, r: Lot) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/lots/${r.id}/trace`)}>İleri İzle</Button>
          <Button size="small" icon={<ApartmentOutlined />} onClick={() => navigate(`/lots/${r.id}/trace`)}>Geri İzle</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Lot Yönetimi</Title>
      <Table dataSource={lots} columns={columns} rowKey="id" loading={loading} />
    </div>
  );
}
