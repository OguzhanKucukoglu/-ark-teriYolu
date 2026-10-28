import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Tabs, Table, Typography, Spin, message, Descriptions, Alert } from 'antd';
import { lotService } from '../../services/api';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbPart } from '../../i18n/formatters';

const { Title } = Typography;

export default function LotTracePage() {
  const { t } = useTranslation();
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
      .catch(() => message.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin size="large" />;

  const marketColumns = [
    { title: t('roles.market'), dataIndex: 'market_name', key: 'market_name' },
    { title: t('common.quantity'), key: 'qty', render: (_: unknown, r: Record<string, unknown>) => `${r.quantity} ${formatUnit(r.unit as string, t)}` },
    { title: t('common.phone'), dataIndex: 'market_phone', key: 'market_phone' },
    { title: t('common.address'), dataIndex: 'market_address', key: 'market_address' },
  ];

  const rawMatColumns = [
    { title: t('common.lotNumber'), dataIndex: 'lot_number', key: 'lot_number', render: (v: string) => <strong>{v}</strong> },
    { title: t('lots.materialColumn'), dataIndex: 'material_type', key: 'material_type', render: (v: string) => formatDbPart(v, t) },
    { title: t('common.quantity'), key: 'qty', render: (_: unknown, r: Record<string, unknown>) => `${r.quantity_used} ${formatUnit(r.unit as string, t)}` },
    { title: t('common.supplier'), dataIndex: 'supplier_name', key: 'supplier_name' },
  ];

  return (
    <div>
      <Title level={3}>{t('lots.tracePageTitle')}</Title>

      <Tabs
        items={[
          {
            key: 'forward',
            label: t('lots.tabForward'),
            children: forward ? (
              <div>
                <Alert
                  message={`${(forward.summary as Record<string, unknown>)?.affectedMarketCount || 0} ${t('lots.marketsAffectedMsg')}`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Card title={t('lots.affectedMarketsCard')} size="small">
                  <Table
                    dataSource={forward.marketSales as Record<string, unknown>[]}
                    columns={marketColumns}
                    rowKey="id"
                    size="small"
                  />
                </Card>
              </div>
            ) : <span>{t('common.noData')}</span>,
          },
          {
            key: 'backward',
            label: t('lots.tabBackward'),
            children: backward ? (
              <div>
                <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label={t('lots.suppliersLabel')}>
                    {((backward.summary as Record<string, unknown>)?.suppliers as string[])?.join(', ') || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('lots.rawLotCountLabel')}>
                    {(backward.summary as Record<string, unknown>)?.rawMaterialLotCount as number}
                  </Descriptions.Item>
                </Descriptions>
                <Card title={t('lots.usedRawLotsCard')} size="small">
                  <Table
                    dataSource={backward.rawMaterialLots as Record<string, unknown>[]}
                    columns={rawMatColumns}
                    rowKey="id"
                    size="small"
                  />
                </Card>
              </div>
            ) : <span>{t('common.noData')}</span>,
          },
        ]}
      />
    </div>
  );
}
