import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Modal } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

type RoleKey = 'hayvanci' | 'sucukcu' | 'market';

interface RoleOption {
  key: RoleKey;
  emoji: string;
  label: string;
  description: string;
}

const ROLES: RoleOption[] = [
  {
    key: 'hayvanci',
    emoji: '🐄',
    label: 'İşletme',
    description: 'Üretim yaptırmak istiyorum',
  },
  {
    key: 'sucukcu',
    emoji: '🌭',
    label: 'Üretici',
    description: 'Üretim yapıyorum',
  },
  {
    key: 'market',
    emoji: '🏪',
    label: 'Market',
    description: 'Satış yapıyorum',
  },
];

export default function RegisterPage() {
  const navigate   = useNavigate();
  const { setAuth } = useAuthStore();
  const [form]     = Form.useForm();
  const [roleForm] = Form.useForm();

  // Step 1 değerleri — rol seçim modalına taşınacak
  const [step1Values, setStep1Values] = useState<{ name: string; email: string; password: string } | null>(null);
  const [modalOpen, setModalOpen]     = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  // Step 1: temel bilgiler → modal aç
  async function onStep1Finish(values: { name: string; email: string; password: string; confirm: string }) {
    setStep1Values(values);
    setSelectedRole(null);
    roleForm.resetFields();
    setModalOpen(true);
  }

  // Step 2: rol + işletme adı → kayıt tamamla
  async function onRoleConfirm(roleValues: { business_name: string }) {
    if (!selectedRole || !step1Values) return;
    setSubmitting(true);
    try {
      const payload = {
        name:     step1Values.name,
        email:    step1Values.email,
        password: step1Values.password,
        role:     selectedRole,
        address:  roleValues.business_name || undefined,
      };
      const { data } = await authService.register(payload);
      setAuth(data.user, data.token);
      message.success('Kayıt başarılı, hoş geldiniz!');
      setModalOpen(false);
      navigate('/');
    } catch {
      message.error('Kayıt sırasında hata oluştu. Email zaten kayıtlı olabilir.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f2f5 100%)',
    }}>
      <Card style={{ width: 440, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderRadius: 12 }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>🐄 AVATAR</Title>
            <Text type="secondary">Yeni hesap oluşturun</Text>
          </div>

          <Form form={form} onFinish={onStep1Finish} layout="vertical" size="large" style={{ textAlign: 'left' }}>
            <Form.Item
              name="name"
              label="Ad Soyad"
              rules={[{ required: true, message: 'Ad Soyad zorunludur' }]}
            >
              <Input placeholder="Ad Soyad" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: 'email', message: 'Geçerli bir email girin' }]}
            >
              <Input placeholder="ornek@email.com" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Şifre"
              rules={[{ required: true, min: 6, message: 'En az 6 karakter olmalı' }]}
            >
              <Input.Password placeholder="Şifre" />
            </Form.Item>

            <Form.Item
              name="confirm"
              label="Şifre Tekrar"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Şifreyi tekrar girin' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Şifreler eşleşmiyor'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Şifre Tekrar" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block size="large" style={{ borderRadius: 8 }}>
                Kayıt Ol
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary">
            Zaten hesabın var mı? <Link to="/login">Giriş Yap</Link>
          </Text>
        </Space>
      </Card>

      {/* Rol Seçim Modalı */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={560}
        centered
        title={
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <Title level={4} style={{ marginBottom: 4 }}>Hesap Türünüzü Seçin</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Platforma nasıl katılmak istiyorsunuz?</Text>
          </div>
        }
      >
        {/* Rol Kartları */}
        <div style={{ display: 'flex', gap: 12, margin: '20px 0' }}>
          {ROLES.map(role => {
            const isSelected = selectedRole === role.key;
            return (
              <div
                key={role.key}
                onClick={() => setSelectedRole(role.key)}
                style={{
                  flex: 1,
                  border: `2px solid ${isSelected ? '#1890ff' : '#e8e8e8'}`,
                  borderRadius: 10,
                  padding: '16px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isSelected ? '#e6f4ff' : '#fafafa',
                  transition: 'all 0.2s',
                  position: 'relative',
                  userSelect: 'none',
                }}
              >
                {isSelected && (
                  <CheckCircleFilled
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: '#1890ff',
                      fontSize: 16,
                    }}
                  />
                )}
                <div style={{ fontSize: 32, marginBottom: 8 }}>{role.emoji}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{role.label}</div>
                <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>{role.description}</div>
              </div>
            );
          })}
        </div>

        {/* Seçim yapıldıysa işletme adı ve onay */}
        {selectedRole && (
          <Form
            form={roleForm}
            onFinish={onRoleConfirm}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="business_name"
              label="İşletme Adı"
              rules={[{ required: true, message: 'İşletme adı zorunludur' }]}
            >
              <Input
                placeholder={
                  selectedRole === 'hayvanci' ? 'Çiftlik / işletme adı'
                  : selectedRole === 'sucukcu' ? 'Üretim tesisi adı'
                  : 'Market / mağaza adı'
                }
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={submitting}
                style={{ borderRadius: 8 }}
              >
                Kaydı Tamamla
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Bu bilgileri daha sonra profil ayarlarından değiştirebilirsiniz.
              </Text>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}
