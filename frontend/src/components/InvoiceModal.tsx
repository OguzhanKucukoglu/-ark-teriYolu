import React from 'react';
import { Modal, Button, Tag, Typography, Divider, Table } from 'antd';
import {
  FilePdfOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Invoice } from '../types';

const { Title, Text } = Typography;

interface InvoiceModalProps {
  visible: boolean;
  invoice: Invoice | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ visible, invoice, onClose }) => {
  if (!invoice) return null;

  const isHizmet = invoice.invoice_type === 'hizmet';
  const roleLabels: Record<string, string> = {
    hayvanci: 'İşletme',
    sucukcu: 'Üretici',
    market: 'Perakendeci (Market)',
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const invoiceTitle = isHizmet ? 'FASON ÜRETİM & İŞÇİLİK HİZMET FATURASI' : 'TOPTAN MAMUL SATIŞ FATURASI';
    const senderRoleText = roleLabels[invoice.sender_role] || invoice.sender_role;
    const receiverRoleText = roleLabels[invoice.receiver_role] || invoice.receiver_role;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Fatura - ${invoice.invoice_number}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            background: #fff;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            border: 1px solid #e5e7eb;
            padding: 28px;
            border-radius: 8px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .logo-area h1 {
            margin: 0;
            font-size: 24px;
            color: #1e3a8a;
            letter-spacing: 1px;
          }
          .logo-area p {
            margin: 4px 0 0 0;
            color: #6b7280;
            font-size: 11px;
          }
          .invoice-meta {
            text-align: right;
          }
          .invoice-meta h2 {
            margin: 0;
            font-size: 17px;
            color: #2563eb;
          }
          .invoice-meta p {
            margin: 4px 0 0;
            color: #4b5563;
          }
          .parties {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }
          .party-card {
            flex: 1;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 14px;
          }
          .party-title {
            font-size: 11px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 8px;
            border-bottom: 1px dashed #d1d5db;
            padding-bottom: 4px;
          }
          .party-name {
            font-size: 15px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 4px;
          }
          .party-detail {
            color: #4b5563;
            font-size: 12px;
            margin: 2px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          th {
            background: #f3f4f6;
            color: #374151;
            font-weight: 600;
            text-align: left;
            padding: 10px 12px;
            border-bottom: 2px solid #d1d5db;
            font-size: 12px;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
          }
          .text-right { text-align: right; }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 24px;
          }
          .totals-table {
            width: 320px;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 6px 12px;
          }
          .grand-total {
            background: #eff6ff;
            font-size: 15px;
            font-weight: 700;
            color: #1e40af;
            border-top: 2px solid #2563eb;
          }
          .note-box {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            font-size: 11px;
            color: #92400e;
            border-radius: 4px;
            margin-bottom: 16px;
          }
          .footer-note {
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
          }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            background: #dcfce7;
            color: #166534;
          }
          @media print {
            body { padding: 0; }
            .invoice-box { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div class="logo-area">
              <h1>AVATAR E-FATURA</h1>
              <p>Gıda Takip & Maliyet Muhasebesi Platformu</p>
            </div>
            <div class="invoice-meta">
              <h2>${invoiceTitle}</h2>
              <p><strong>Fatura No:</strong> ${invoice.invoice_number}</p>
              <p><strong>Tarih:</strong> ${new Date(invoice.invoice_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p><span class="badge">ÖDENDİ</span></p>
            </div>
          </div>

          <div class="parties">
            <div class="party-card">
              <div class="party-title">DÜZENLEYEN (HİZMET SAĞLAYICI / SATICI)</div>
              <div class="party-name">${invoice.sender_name}</div>
              <div class="party-detail"><strong>Unvan/Rol:</strong> ${senderRoleText}</div>
              <div class="party-detail"><strong>E-Posta:</strong> ${invoice.sender_email}</div>
              <div class="party-detail"><strong>Sistem Kullanıcı ID:</strong> #${invoice.sender_id}</div>
            </div>

            <div class="party-card">
              <div class="party-title">SAYIN (ALICI / HİZMET ALAN)</div>
              <div class="party-name">${invoice.receiver_name}</div>
              <div class="party-detail"><strong>Unvan/Rol:</strong> ${receiverRoleText}</div>
              <div class="party-detail"><strong>E-Posta:</strong> ${invoice.receiver_email}</div>
              <div class="party-detail"><strong>Sistem Kullanıcı ID:</strong> #${invoice.receiver_id}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Mal / Hizmet Açıklaması</th>
                <th>İlgili Lot No</th>
                <th class="text-right">Miktar</th>
                <th class="text-right">Birim Fiyat</th>
                <th class="text-right">KDV (%${Number(invoice.tax_rate).toFixed(0)})</th>
                <th class="text-right">Toplam Tutar</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>
                  <strong>${invoice.product_name}</strong>
                  <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
                    ${invoice.description || (isHizmet ? 'Fason üretim & işleme işçiliği' : 'Toptan mamul satışı')}
                  </div>
                </td>
                <td><code style="background: #f3f4f6; padding: 2px 5px; border-radius: 4px;">${invoice.lot_number || '-'}</code></td>
                <td class="text-right">${Number(invoice.quantity).toLocaleString('tr-TR')} ${invoice.unit}</td>
                <td class="text-right">${Number(invoice.unit_price).toFixed(2)} ${invoice.currency}</td>
                <td class="text-right">${Number(invoice.tax_amount).toFixed(2)} ${invoice.currency}</td>
                <td class="text-right"><strong>${Number(invoice.total_amount).toFixed(2)} ${invoice.currency}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="totals-wrap">
            <table class="totals-table">
              <tr>
                <td>Ara Toplam:</td>
                <td class="text-right">${Number(invoice.subtotal).toFixed(2)} ${invoice.currency}</td>
              </tr>
              <tr>
                <td>Hesaplanan KDV (%${Number(invoice.tax_rate).toFixed(0)}):</td>
                <td class="text-right">${Number(invoice.tax_amount).toFixed(2)} ${invoice.currency}</td>
              </tr>
              <tr class="grand-total">
                <td>GENEL TOPLAM:</td>
                <td class="text-right">${Number(invoice.total_amount).toFixed(2)} ${invoice.currency}</td>
              </tr>
            </table>
          </div>

          <div class="note-box">
            <strong>Mali Açıklama & Not:</strong><br/>
            ${isHizmet
              ? 'İşbu fatura, sucuk üreticisinin işletmeye sağladığı fason işleme ve işçilik hizmet bedelidir. Reçetede kullanılan et, baharat ve kılıf hammaddeleri işletmeye aittir ve mamul EKP hesabında hammadde maliyeti olarak ayrıca muhasebeleştirilmiştir.'
              : 'İşbu fatura, AVATAR Lot Takip Sistemi güvencesiyle üretilmiş nihai sucuk mamullerinin toptan satış bedelidir.'}
          </div>

          <div class="footer-note">
            Bu belge AVATAR Gıda Takip & Maliyet Muhasebesi Sistemi tarafından elektronik ortamda tanzim edilmiştir. Belge No: ${invoice.invoice_number}
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 40,
      render: () => 1,
    },
    {
      title: 'Mal / Hizmet Açıklaması',
      dataIndex: 'product_name',
      key: 'product_name',
      render: (text: string) => (
        <div>
          <Text strong>{text}</Text>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {invoice.description || (isHizmet ? 'Fason üretim & işçilik' : 'Toptan mamul satışı')}
          </div>
        </div>
      ),
    },
    {
      title: 'Lot No',
      dataIndex: 'lot_number',
      key: 'lot_number',
      render: (lot: string) => (lot ? <Tag color="blue">{lot}</Tag> : '-'),
    },
    {
      title: 'Miktar',
      key: 'quantity',
      align: 'right' as const,
      render: () => `${Number(invoice.quantity).toLocaleString('tr-TR')} ${invoice.unit}`,
    },
    {
      title: 'Birim Fiyat',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right' as const,
      render: (val: number) => `${Number(val).toFixed(2)} ${invoice.currency}`,
    },
    {
      title: 'KDV',
      key: 'tax_amount',
      align: 'right' as const,
      render: () => `${Number(invoice.tax_amount).toFixed(2)} ${invoice.currency}`,
    },
    {
      title: 'Toplam Tutar',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (val: number) => <Text strong style={{ color: '#1d4ed8' }}>{Number(val).toFixed(2)} ${invoice.currency}</Text>,
    },
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={860}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SafetyCertificateOutlined style={{ color: '#2563eb', fontSize: 20 }} />
          <span>Elektronik Fatura Görüntüleyici</span>
          <Tag color={isHizmet ? 'purple' : 'green'}>
            {isHizmet ? 'Fason Hizmet Faturası' : 'Satış Faturası'}
          </Tag>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose}>
          Kapat
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<FilePdfOutlined />}
          style={{ background: '#2563eb' }}
          onClick={handlePrint}
        >
          PDF Olarak İndir / Yazdır
        </Button>,
      ]}
    >
      <div style={{ padding: '8px 4px' }}>
        {/* Header Block */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #2563eb',
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, color: '#1e3a8a' }}>
              AVATAR E-FATURA SİSTEMİ
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isHizmet ? 'Üretici ➔ İşletme Hizmet Faturası' : 'İşletme ➔ Market Satış Faturası'}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold', fontSize: 16, color: '#2563eb' }}>
              {invoice.invoice_number}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Tarih: {new Date(invoice.invoice_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginTop: 4 }}>
              ÖDENDİ
            </Tag>
          </div>
        </div>

        {/* Parties Block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                borderBottom: '1px dashed #cbd5e1',
                paddingBottom: 4,
                marginBottom: 8,
              }}
            >
              <UserOutlined style={{ marginRight: 5 }} />
              DÜZENLEYEN (SATICI / HİZMET SAĞLAYICI)
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              {invoice.sender_name}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
              <strong>Unvan/Rol:</strong> {roleLabels[invoice.sender_role] || invoice.sender_role}
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              <strong>E-Posta:</strong> {invoice.sender_email}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              <strong>Kullanıcı No:</strong> #{invoice.sender_id}
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                borderBottom: '1px dashed #cbd5e1',
                paddingBottom: 4,
                marginBottom: 8,
              }}
            >
              <ShopOutlined style={{ marginRight: 5 }} />
              SAYIN (ALICI / MÜŞTERİ)
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              {invoice.receiver_name}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
              <strong>Unvan/Rol:</strong> {roleLabels[invoice.receiver_role] || invoice.receiver_role}
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              <strong>E-Posta:</strong> {invoice.receiver_email}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              <strong>Kullanıcı No:</strong> #{invoice.receiver_id}
            </div>
          </div>
        </div>

        {/* Invoice Item Table */}
        <Table
          columns={columns}
          dataSource={[invoice]}
          rowKey="id"
          pagination={false}
          size="middle"
          bordered
        />

        {/* Totals Section */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <div
            style={{
              width: 320,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <Text type="secondary">Ara Toplam:</Text>
              <Text strong>{Number(invoice.subtotal).toFixed(2)} {invoice.currency}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <Text type="secondary">KDV (%{Number(invoice.tax_rate).toFixed(0)}):</Text>
              <Text strong>{Number(invoice.tax_amount).toFixed(2)} {invoice.currency}</Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 'bold',
                color: '#1d4ed8',
              }}
            >
              <span>Genel Toplam:</span>
              <span>{Number(invoice.total_amount).toFixed(2)} {invoice.currency}</span>
            </div>
          </div>
        </div>

        {/* Notes alert */}
        <div
          style={{
            marginTop: 16,
            background: '#fffbeb',
            borderLeft: '4px solid #f59e0b',
            padding: 12,
            borderRadius: 4,
            fontSize: 12,
            color: '#92400e',
          }}
        >
          <strong>Mali Bilgilendirme: </strong>
          {isHizmet
            ? 'Bu fatura fason üretim ve işçilik hizmet bedelidir. Reçetede tüketilen tüm hammadde maliyetleri işletme bünyesinde olup mamul EKP hesabına doğrudan dahil edilmiştir.'
            : 'Bu fatura AVATAR platformu üzerinden onaylanmış toptan mamul satışına aittir.'}
        </div>
      </div>
    </Modal>
  );
};
