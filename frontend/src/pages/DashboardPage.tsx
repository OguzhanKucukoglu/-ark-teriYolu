import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Alert, Button, Space } from 'antd';
import { ShoppingCartOutlined, AuditOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../services/api';
import { useTranslation } from '../i18n';

const { Title, Text } = Typography;

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  reference_id?: number;
  is_read: boolean | number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [qualityAlerts, setQualityAlerts] = useState<NotificationItem[]>([]);

  useEffect(() => {
    notificationService.getAll()
      .then(res => {
        const notifs = (res.data.notifications || []) as NotificationItem[];
        setQualityAlerts(notifs.filter(n => n.type === 'kalite_sorunu' && !n.is_read));
      })
      .catch(() => {});
  }, []);

  const roleWelcome: Record<string, string> = {
    hayvanci: t('dashboard.welcomeHayvanci'),
    sucukcu:  t('dashboard.welcomeSucukcu'),
    market:   t('dashboard.welcomeMarket'),
  };

  return (
    <div>
      <Title level={3}>{t('dashboard.welcome')}, {user?.name} 👋</Title>
      <Text type="secondary">{roleWelcome[user?.role || '']}</Text>

      {qualityAlerts.length > 0 && (
        <Alert
          style={{ marginTop: 16, marginBottom: 16 }}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚠️ <strong>{t('common.error')}:</strong> {qualityAlerts.length} {t('market.recalledProducts')}</span>
              <Space>
                <Button size="small" danger onClick={() => navigate('/recalls')}>
                  {t('nav.recalls')}
                </Button>
              </Space>
            </div>
          }
          description={
            <div style={{ marginTop: 8 }}>
              {qualityAlerts.map(a => (
                <div key={a.id} style={{ marginBottom: 4 }}>
                  • <strong>{a.title}</strong>: {a.message}
                </div>
              ))}
            </div>
          }
          type="error"
          showIcon
        />
      )}

      <Alert
        style={{ marginTop: qualityAlerts.length > 0 ? 0 : 16, marginBottom: 24 }}
        message={t('dashboard.demoDataLoaded')}
        description={t('dashboard.demoDataDesc')}
        type="info"
        showIcon
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('dashboard.activeLots')} value={4} prefix={<AuditOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('dashboard.pendingOrders')} value={1} prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('nav.recalls')} value={0} prefix={<WarningOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('production.title')} value={1} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
