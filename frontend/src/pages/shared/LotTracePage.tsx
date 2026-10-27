import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Tabs, Table, Typography, Spin, message, Descriptions, Alert } from 'antd';
import { lotService } from '../../services/api';

const { Title } = Typography;

export default function LotTracePage() {
  const { id } = useParams<{ id: string }>();
  const [forward, setForward]   = useState<Record<string, unknown> | null>(null);
  const [backward, setBackward] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      lotService.traceForward(Number(id)),
      lotService.traceBackward(Number(id)),
    ])
      .then(([f, b]) => { setForward(f.data); setBackward(b.data); })
      .catch(() => message.error('İzleme verisi yüklenemedi'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin size="large" />;

  const marketColumns = [
    { title: 'Market', dataIndex: 'market_name', key: 'market_name' },
    { title: 'Miktar', key: 'qty', render: (_: unknown, r: Record<string, unknown>) => `${r.quantity} ${r.unit}` },
    { title: 'Telefon', dataIndex: 'market_phone', key: 'market_phone' },
    { title: 'Adres', dataIndex: 'market_address', key: 'market_address' },
  ];

  const rawMatColumns = [
    { title: 'Lot No', dataIndex: 'lot_number', key: 'lot_number', render: (v: string) => <strong>{v}</strong> },
    { title: 'Malzeme', dataIndex: 'material_type', key: 'material_type' },
    { title: 'Miktar', key: 'qty', render: (_: unknown, r: Record<string, unknown>) => `${r.quantity_used} ${r.unit}` },
    { title: 'Tedarikçi', dataIndex: 'supplier_name', key: 'supplier_name' },
  ];

  return (
    <div>
      <Title level={3}>Lot İzlenebilirlik</Title>

      <Tabs
        items={[
          {
            key: 'forward',
            label: '→ İleri İzleme (Hammadde → Market)',
            children: forward ? (
              <div>
                <Alert
                  message={`${(forward.summary as Record<string, unknown>)?.affectedMarketCount || 0} market etkilendi`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Card title="Etkilenen Marketler" size="small">
                  <Table
                    dataSource={forward.marketSales as Record<string, unknown>[]}
                    columns={marketColumns}
                    rowKey="id"
                    size="small"
                  />
                </Card>
              </div>
            ) : <span>Veri yok</span>,
          },
          {
            key: 'backward',
            label: '← Geri İzleme (Mamul → Hammadde)',
            children: backward ? (
              <div>
                <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="Tedarikçiler">
                    {((backward.summary as Record<string, unknown>)?.suppliers as string[])?.join(', ') || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Hammadde Lot Sayısı">
                    {(backward.summary as Record<string, unknown>)?.rawMaterialLotCount as number}
                  </Descriptions.Item>
                </Descriptions>
                <Card title="Kullanılan Hammadde Lotları" size="small">
                  <Table
                    dataSource={backward.rawMaterialLots as Record<string, unknown>[]}
                    columns={rawMatColumns}
                    rowKey="id"
                    size="small"
                  />
                </Card>
              </div>
            ) : <span>Veri yok</span>,
          },
        ]}
      />
    </div>
  );
}
