import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Typography, Space, Popover, List, Button, Tag } from 'antd';
import {
  DashboardOutlined, ScissorOutlined, ShoppingCartOutlined,
  UnorderedListOutlined, TagsOutlined, ForkOutlined, BellOutlined,
  LogoutOutlined, UserOutlined, WarningOutlined, AuditOutlined, InboxOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';
import { notificationService } from '../../services/api';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface NotificationItem {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: number;
  is_read: boolean | number;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  hayvanci: 'İşletme',
  sucukcu:  'Üretici',
  market:   'Market',
};

const roleColors: Record<string, string> = {
  hayvanci: '#52c41a',
  sucukcu:  '#1890ff',
  market:   '#fa8c16',
};

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [popoverOpen, setPopoverOpen]     = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await notificationService.getAll();
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch {
      // sessizce geç
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function handleMarkRead(n: NotificationItem) {
    if (!n.is_read) {
      try {
        await notificationService.markRead(n.id);
        fetchNotifications();
      } catch {
        // ignore
      }
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationService.markAll();
      fetchNotifications();
    } catch {
      // ignore
    }
  }

  const menuItems = getMenuItems(user?.role || '');

  const userMenu = [
    { key: 'logout', icon: <LogoutOutlined />, label: 'Çıkış Yap', onClick: () => { logout(); navigate('/login'); } },
  ];

  const notificationContent = (
    <div style={{ width: 360, maxHeight: 420, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: 14 }}>
          Bildirimler {unreadCount > 0 && <Tag color="red">{unreadCount} yeni</Tag>}
        </Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={handleMarkAllRead} style={{ padding: 0 }}>
            Tümünü okundu yap
          </Button>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c8c8c' }}>
            Henüz bildiriminiz yok
          </div>
        ) : (
          <List
            size="small"
            dataSource={notifications}
            renderItem={(item) => {
              const isUnread = !item.is_read;
              const isQualityIssue = item.type === 'kalite_sorunu';

              return (
                <List.Item
                  key={item.id}
                  onClick={() => handleMarkRead(item)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 6,
                    cursor: 'pointer',
                    background: isUnread ? (isQualityIssue ? '#fff1f0' : '#f0f5ff') : '#fafafa',
                    border: `1px solid ${isUnread ? (isQualityIssue ? '#ffa39e' : '#adc6ff') : '#f0f0f0'}`,
                    display: 'block',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {isQualityIssue ? (
                      <WarningOutlined style={{ color: '#ff4d4f', fontSize: 16, marginTop: 2 }} />
                    ) : item.type === 'satis' ? (
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16, marginTop: 2 }} />
                    ) : item.type === 'siparis' ? (
                      <ShoppingCartOutlined style={{ color: '#1890ff', fontSize: 16, marginTop: 2 }} />
                    ) : (
                      <BellOutlined style={{ color: '#faad14', fontSize: 16, marginTop: 2 }} />
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong style={{ fontSize: 13, color: isQualityIssue ? '#cf1322' : undefined }}>
                          {item.title}
                        </Text>
                        {isUnread && <Tag color={isQualityIssue ? 'error' : 'processing'} style={{ fontSize: 10, lineHeight: '16px' }}>Yeni</Tag>}
                      </div>

                      <Text style={{ fontSize: 12, display: 'block', margin: '4px 0', color: '#595959' }}>
                        {item.message}
                      </Text>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}
                        </Text>

                        {isQualityIssue && (
                          <Space size="small">
                            {item.reference_id && (
                              <Button
                                size="small"
                                type="link"
                                style={{ padding: 0, fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPopoverOpen(false);
                                  navigate(`/lots/${item.reference_id}/trace`);
                                }}
                              >
                                İleri İzle
                              </Button>
                            )}
                            <Button
                              size="small"
                              type="link"
                              danger
                              style={{ padding: 0, fontSize: 11 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPopoverOpen(false);
                                navigate('/recalls');
                              }}
                            >
                              Geri Çağır
                            </Button>
                          </Space>
                        )}
                      </div>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="dark" collapsible>
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #1f1f1f' }}>
          <Text strong style={{ color: '#fff', fontSize: 18 }}>🐄 AVATAR</Text>
          <br />
          <Text style={{ color: roleColors[user?.role || ''], fontSize: 12 }}>
            {roleLabels[user?.role || '']}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <Space size="large">
            <Popover
              content={notificationContent}
              trigger="click"
              placement="bottomRight"
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
            >
              <Badge count={unreadCount} overflowCount={99}>
                <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: unreadCount > 0 ? '#ff4d4f' : '#595959' }} />
              </Badge>
            </Popover>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: roleColors[user?.role || ''] }} />
                <Text>{user?.name}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px', padding: '24px', background: '#fff', borderRadius: '8px', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

function getMenuItems(role: string) {
  const dashboard = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  ];

  const hayvanci = [
    { key: '/butchery',          icon: <ScissorOutlined />,       label: 'Parçalama' },
    { key: '/raw-materials',     icon: <InboxOutlined />,         label: 'Hammadde Stoğu' },
    { key: '/producer-listings', icon: <UnorderedListOutlined />, label: 'Sucukçu İlanları' },
    { key: '/orders',            icon: <ShoppingCartOutlined />,  label: 'Siparişlerim' },
    { key: '/farmer-listings',   icon: <TagsOutlined />,          label: 'İlanlarım' },
    { key: '/lots',              icon: <AuditOutlined />,         label: 'Lot Yönetimi' },
    { key: '/recalls',           icon: <WarningOutlined />,       label: 'Geri Çağırmalar' },
  ];

  const sucukcu = [
    { key: '/producer-listings-manage', icon: <TagsOutlined />,          label: 'İlanlarım' },
    { key: '/producer-orders',          icon: <ShoppingCartOutlined />,  label: 'Gelen Siparişler' },
    { key: '/production',               icon: <ForkOutlined />,          label: 'Üretim' },
  ];

  const market = [
    { key: '/market-listings', icon: <UnorderedListOutlined />, label: 'Ürün İlanları' },
    { key: '/purchases',       icon: <ShoppingCartOutlined />,  label: 'Satın Almalarım' },
  ];

  const roleMenus: Record<string, typeof dashboard> = { hayvanci, sucukcu, market };
  return [...dashboard, ...(roleMenus[role] || [])];
}
