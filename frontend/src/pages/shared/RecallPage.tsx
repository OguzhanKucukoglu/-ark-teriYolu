import { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, Typography, message, Card, Descriptions } from 'antd';
import { WarningOutlined, EyeOutlined } from '@ant-design/icons';
import { recallService, lotService } from '../../services/api';
import { Recall, Lot } from '../../types';
import { useTranslation } from '../../i18n';
import { formatUnit, formatDbStatus } from '../../i18n/formatters';

const { Title } = Typography;

export default function RecallPage() {
  const { t } = useTranslation();
  const [recalls, setRecalls]         = useState<Recall[]>([]);
  const [lots, setLots]               = useState<Lot[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [selectedRecall, setSelected] = useState<Record<string, unknown> | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    Promise.all([recallService.getAll(), lotService.getAll()])
      .then(([r, l]) => { setRecalls(r.data); setLots(l.data); })
      .catch(() => message.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(values: { lot_id: number; reason: string }) {
    try {
      const { data } = await recallService.initiate(values);
      message.success(`Geri çağırma başlatıldı. ${data.affectedMarkets} market etkilendi.`);
      setModalOpen(false);
      form.resetFields();
      const { data: updated } = await recallService.getAll();
      setRecalls(updated);
    } catch {
      message.error('Geri çağırma başlatılamadı');
    }
  }

  async function viewDetail(id: number) {
    try {
      const { data } = await recallService.getById(id);
      setSelected(data);
      setDetailOpen(true);
    } catch {
      message.error('Detay yüklenemedi');
    }
  }

  const columns = [
    { title: t('common.lotNumber'), dataIndex: 'lot_number', key: 'lot_number', render: (v: string) => <strong>{v}</strong> },
    { title: t('recalls.reasonLabel'), dataIndex: 'reason', key: 'reason' },
    { title: t('recalls.affectedMarkets'), dataIndex: 'affected_count', key: 'affected_count', render: (v: number) => <Tag color="red">{v} {t('roles.market')}</Tag> },
    { title: t('common.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'aktif' ? 'red' : 'green'}>{formatDbStatus(v, t)}</Tag> },
    { title: t('common.date'), dataIndex: 'created_at', key: 'created_at', render: (v: string) => new Date(v).toLocaleDateString() },
    { title: t('common.actions'), key: 'action', render: (_: unknown, r: Recall) => <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r.id)}>{t('common.details')}</Button> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3}><WarningOutlined /> {t('recalls.title')}</Title>
        <Button type="primary" danger onClick={() => setModalOpen(true)}>{t('recalls.startRecall')}</Button>
      </div>

      <Table dataSource={recalls} columns={columns} rowKey="id" loading={loading} />

      <Modal title={t('recalls.startRecall')} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} onFinish={onSubmit} layout="vertical">
          <Form.Item name="lot_id" label={t('common.lotNumber')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Lot">
              {lots.filter(l => l.status === 'active').map(l => (
                <Select.Option key={l.id} value={l.id}>{l.lot_number} — {l.quantity} {formatUnit(l.unit, t)}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label={t('recalls.recallReason')} rules={[{ required: true, min: 10 }]}>
            <Input.TextArea rows={3} placeholder="..." />
          </Form.Item>
          <Button type="primary" danger htmlType="submit" block>{t('recalls.startRecall')}</Button>
        </Form>
      </Modal>

      <Modal
        title={t('recalls.detailTitle')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={700}
      >
        {selectedRecall && (
          <div>
            <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('common.lotNumber')}>{(selectedRecall.recall as Record<string, unknown>)?.lot_number as string}</Descriptions.Item>
              <Descriptions.Item label={t('recalls.reasonLabel')}>{(selectedRecall.recall as Record<string, unknown>)?.reason as string}</Descriptions.Item>
            </Descriptions>
            <Card title={t('recalls.affectedMarkets')} size="small">
              <Table
                dataSource={selectedRecall.affectedMarkets as Record<string, unknown>[]}
                rowKey="id"
                size="small"
                columns={[
                  { title: t('roles.market'), dataIndex: 'market_name', key: 'market_name' },
                  { title: t('common.quantity'), key: 'qty', render: (_: unknown, r: Record<string, unknown>) => `${r.quantity} ${r.unit}` },
                  { title: t('common.phone'), dataIndex: 'market_phone', key: 'market_phone' },
                  { title: t('common.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
