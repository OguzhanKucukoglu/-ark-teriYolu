import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form] = Form.useForm();

  async function onFinish(values: { email: string; password: string }) {
    try {
      const { data } = await authService.login(values.email, values.password);
      setAuth(data.user, data.token);
      message.success('Giriş başarılı');
      navigate('/');
    } catch {
      message.error('Email veya şifre hatalı');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2}>🐄 AVATAR</Title>
            <Text type="secondary">Üretim & Lot Yönetim Sistemi</Text>
          </div>
          <Form form={form} onFinish={onFinish} layout="vertical" size="large">
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Geçerli email girin' }]}>
              <Input prefix={<UserOutlined />} placeholder="Email" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Şifre zorunludur' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Şifre" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>Giriş Yap</Button>
            </Form.Item>
          </Form>
          <Text>Hesabın yok mu? <Link to="/register">Kayıt Ol</Link></Text>
        </Space>
      </Card>
    </div>
  );
}
