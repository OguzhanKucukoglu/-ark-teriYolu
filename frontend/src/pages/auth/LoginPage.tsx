import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation, LanguageSwitcher } from '../../i18n';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form] = Form.useForm();

  async function onFinish(values: { email: string; password: string }) {
    try {
      const { data } = await authService.login(values.email, values.password);
      setAuth(data.user, data.token);
      message.success(t('auth.loginSuccess'));
      navigate('/');
    } catch {
      message.error(t('auth.loginFailed'));
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <LanguageSwitcher />
      </div>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2}>🐄 AVATAR</Title>
            <Text type="secondary">{t('auth.systemSubtitle')}</Text>
          </div>
          <Form form={form} onFinish={onFinish} layout="vertical" size="large">
            <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
              <Input prefix={<UserOutlined />} placeholder={t('auth.email')} />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>{t('auth.login')}</Button>
            </Form.Item>
          </Form>
          <Text>{t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link></Text>
        </Space>
      </Card>
    </div>
  );
}
