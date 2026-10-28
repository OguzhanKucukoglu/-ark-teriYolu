import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Modal } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation, LanguageSwitcher } from '../../i18n';

const { Title, Text } = Typography;

type RoleKey = 'hayvanci' | 'sucukcu' | 'market';

interface RoleOption {
  key: RoleKey;
  emoji: string;
  label: string;
  description: string;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate   = useNavigate();
  const { setAuth } = useAuthStore();
  const [form]     = Form.useForm();
  const [roleForm] = Form.useForm();

  const roleOptions: RoleOption[] = [
    {
      key: 'hayvanci',
      emoji: '🐄',
      label: t('roles.hayvanci'),
      description: t('roles.hayvanciDesc'),
    },
    {
      key: 'sucukcu',
      emoji: '🌭',
      label: t('roles.sucukcu'),
      description: t('roles.sucukcuDesc'),
    },
    {
      key: 'market',
      emoji: '🏪',
      label: t('roles.market'),
      description: t('roles.marketDesc'),
    },
  ];

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
      message.success(t('auth.registerSuccess'));
      setModalOpen(false);
      navigate('/');
    } catch {
      message.error(t('auth.registerError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f2f5 100%)',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <LanguageSwitcher />
      </div>
      <Card style={{ width: 440, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderRadius: 12 }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>🐄 AVATAR</Title>
            <Text type="secondary">{t('auth.systemSubtitle')}</Text>
          </div>

          <Form form={form} onFinish={onStep1Finish} layout="vertical" size="large" style={{ textAlign: 'left' }}>
            <Form.Item
              name="name"
              label={t('auth.fullName')}
              rules={[{ required: true }]}
            >
              <Input placeholder={t('auth.fullName')} />
            </Form.Item>

            <Form.Item
              name="email"
              label={t('auth.email')}
              rules={[{ required: true, type: 'email' }]}
            >
              <Input placeholder={t('auth.email')} />
            </Form.Item>

            <Form.Item
              name="password"
              label={t('auth.password')}
              rules={[{ required: true, min: 6 }]}
            >
              <Input.Password placeholder={t('auth.password')} />
            </Form.Item>

            <Form.Item
              name="confirm"
              label={t('auth.confirmPassword')}
              dependencies={['password']}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Mismatch'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder={t('auth.confirmPassword')} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block size="large" style={{ borderRadius: 8 }}>
                {t('auth.register')}
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary">
            {t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link>
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
            <Title level={4} style={{ marginBottom: 4 }}>{t('auth.selectRoleTitle')}</Title>
          </div>
        }
      >
        {/* Rol Kartları */}
        <div style={{ display: 'flex', gap: 12, margin: '20px 0' }}>
          {roleOptions.map(role => {
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
              label={t('auth.businessName')}
              rules={[{ required: true, message: t('auth.businessNameRequired') }]}
            >
              <Input
                placeholder={
                  selectedRole === 'hayvanci' ? t('auth.farmPlaceholder')
                  : selectedRole === 'sucukcu' ? t('auth.producerPlaceholder')
                  : t('auth.marketPlaceholder')
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
                {t('auth.completeRegister')}
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('auth.changeLaterNotice')}
              </Text>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}
