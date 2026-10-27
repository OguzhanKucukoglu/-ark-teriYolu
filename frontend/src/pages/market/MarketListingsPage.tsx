import { useEffect, useState } from 'react';
import {
  Card, Button, Modal, Typography, Tag, App,
  Row, Col, Input, Empty, Spin, Descriptions, Divider, InputNumber,
} from 'antd';
import {
  SearchOutlined, PhoneOutlined,
  ShoppingCartOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { listingService, purchaseService } from '../../services/api';

const { Title, Text } = Typography;
const { Search } = Input;

// Lot tipine göre renk/ikon
const LOT_META: Record<string, { emoji: string; color: string; label: string }> = {
  parca: { emoji: '🥩', color: '#f50',     label: 'Et / Parça' },
  mamul: { emoji: '🌭', color: '#722ed1',  label: 'Mamul Ürün' },
};

interface FarmerListing {
  id: number;
  farmer_id: number;
  farmer_name: string;
  phone?: string;
  lot_id: number;
  lot_number: string;
  lot_status: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export default function MarketListingsPage() {
  const { message } = App.useApp();

  const [listings, setListings] = useState<FarmerListing[]>([]);
  const [filtered, setFiltered] = useState<FarmerListing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // Detay modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected]     = useState<FarmerListing | null>(null);

  // Satın alma modal
  const [buyOpen, setBuyOpen]     = useState(false);
  const [buyListing, setBuyListing] = useState<FarmerListing | null>(null);

  async function load() {
    try {
      const { data } = await listingService.getFarmerListings();
      setListings(data);
      setFiltered(data);
    } catch {
      message.error('İlanlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function onSearch(val: string) {
    setSearch(val);
    const lower = val.toLowerCase();
    setFiltered(
      listings.filter(l =>
        l.product_name.toLowerCase().includes(lower) ||
        l.farmer_name.toLowerCase().includes(lower)
      )
    );
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>🛒 Ürün İlanları</Title>
        <Search
          placeholder="Ürün veya hayvancı ara..."
          allowClear style={{ width: 280 }}
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Empty description="Henüz ilan yok" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map(listing => {
            // lot_number'dan tipi çıkar (PRC = parça, MAM/SUC = mamul)
            const isManufactured = listing.lot_number.startsWith('MAM') ||
              listing.lot_number.startsWith('SUC');
            const lotType = isManufactured ? 'mamul' : 'parca';
            const meta    = LOT_META[lotType];
            const total   = Number(listing.quantity) * Number(listing.unit_price);

            return (
              <Col key={listing.id} xs={24} sm={12} lg={8}>
                <Card
                  hoverable
                  style={{ borderRadius: 12, height: '100%' }}
                  styles={{ body: { padding: '16px 20px' } }}
                  onClick={() => { setBuyListing(listing); setBuyOpen(true); }}
                >
                  {/* Başlık */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      fontSize: 28, width: 52, height: 52, background: '#f5f5f5',
                      borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {meta.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 16 }}>{listing.product_name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{listing.farmer_name}</Text>
                    </div>
                    <Tag color={meta.color} style={{ fontSize: 13, padding: '2px 10px' }}>
                      {Number(listing.unit_price).toFixed(2)} € / {listing.unit}
                    </Tag>
                  </div>

                  {listing.description && (
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                      {listing.description}
                    </Text>
                  )}

                  {/* Bilgiler */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <Tag>{Number(listing.quantity).toFixed(2)} {listing.unit} mevcut</Tag>
                    <Tag color="blue">{listing.lot_number}</Tag>
                    <Tag color={meta.color}>{meta.label}</Tag>
                  </div>

                  {/* Alt */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 8, borderTop: '1px solid #f0f0f0',
                  }}>
                    <Text strong style={{ color: '#52c41a', fontSize: 14 }}>
                      Toplam: {total.toFixed(2)} €
                    </Text>
                    <Button
                      size="small" icon={<InfoCircleOutlined />}
                      onClick={e => {
                        e.stopPropagation();
                        setSelected(listing);
                        setDetailOpen(true);
                      }}
                    >
                      Detay
                    </Button>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* ── Detay Modalı ── */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Button type="primary" icon={<ShoppingCartOutlined />}
            onClick={() => {
              setDetailOpen(false);
              setBuyListing(selected);
              setBuyOpen(true);
            }}>
            Satın Al
          </Button>
        }
        width={480}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>
              {selected?.lot_number.startsWith('SUC') || selected?.lot_number.startsWith('MAM') ? '🌭' : '🥩'}
            </span>
            <span>{selected?.product_name} — Detay</span>
          </div>
        }
      >
        {selected && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Satıcı" span={2}>
                <Text strong>{selected.farmer_name}</Text>
              </Descriptions.Item>
              {selected.phone && (
                <Descriptions.Item label={<><PhoneOutlined /> Telefon</>} span={2}>
                  {selected.phone}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Lot No">
                <Tag color="blue">{selected.lot_number}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Miktar">
                <Text strong>{Number(selected.quantity).toFixed(2)} {selected.unit}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Birim Fiyat">
                <Text strong style={{ color: '#f50' }}>
                  {Number(selected.unit_price).toFixed(2)} € / {selected.unit}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Toplam Değer">
                <Text strong style={{ color: '#52c41a' }}>
                  {(Number(selected.quantity) * Number(selected.unit_price)).toFixed(2)} €
                </Text>
              </Descriptions.Item>
            </Descriptions>
            {selected.description && (
              <div style={{ padding: '10px 12px', background: '#f9f9f9', borderRadius: 8 }}>
                <Text type="secondary">{selected.description}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Satın Al Modalı ── */}
      <Modal
        open={buyOpen}
        onCancel={() => setBuyOpen(false)}
        footer={null}
        width={460}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCartOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            <span>{buyListing?.product_name} — Satın Al</span>
          </div>
        }
      >
        {buyListing && (
          <BuyForm
            listing={buyListing}
            onClose={() => setBuyOpen(false)}
            onSuccess={() => { setBuyOpen(false); load(); }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Satın Al formu (ayrı bileşen — local state için) ─────────────────────────
function BuyForm({
  listing,
  onClose,
  onSuccess,
}: {
  listing: FarmerListing;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { message } = App.useApp();
  const [qty, setQty]         = useState<number>(Math.min(1, Number(listing.quantity)));
  const [submitting, setSubmitting] = useState(false);
  const price = Number(listing.unit_price);
  const total = qty * price;

  async function handleBuy() {
    if (!qty || qty <= 0) {
      message.warning('Geçerli bir miktar girin');
      return;
    }
    setSubmitting(true);
    try {
      await purchaseService.create({
        farmer_id:  listing.farmer_id,
        listing_id: listing.id,
        lot_id:     listing.lot_id,
        quantity:   qty,
        unit:       listing.unit,
        unit_price: price,
      });
      message.success('Satın alma işlemi başarıyla kaydedildi');
      onSuccess();
    } catch {
      message.error('Satın alma işlemi başarısız');
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Satıcı bilgisi */}
      <div style={{
        background: '#f0f5ff', borderRadius: 10, padding: '12px 16px',
        marginBottom: 16, border: '1px solid #adc6ff',
      }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>Satıcı</Text>
            <div><Text strong>{listing.farmer_name}</Text></div>
          </div>
          {listing.phone && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Telefon</Text>
              <div><PhoneOutlined style={{ marginRight: 4 }} />{listing.phone}</div>
            </div>
          )}
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>Lot</Text>
            <div><Tag color="blue">{listing.lot_number}</Tag></div>
          </div>
        </div>
      </div>

      <Divider style={{ margin: '0 0 16px' }}>Sipariş Detayı</Divider>

      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
          Almak istediğiniz miktar ({listing.unit})
        </Text>
        <InputNumber
          min={0.001}
          max={Number(listing.quantity)}
          step={0.1}
          precision={3}
          value={qty}
          onChange={v => setQty(v ?? 0.001)}
          addonAfter={listing.unit}
          style={{ width: '100%' }}
          size="large"
        />
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
          Maksimum: {Number(listing.quantity).toFixed(2)} {listing.unit}
        </Text>
      </div>

      {/* Fiyat özeti */}
      <div style={{
        background: '#f6ffed', border: '1.5px solid #b7eb8f',
        borderRadius: 10, padding: '14px 18px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary">Birim Fiyat</Text>
          <Text>{price.toFixed(2)} € / {listing.unit}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary">Miktar</Text>
          <Text>{qty.toFixed(3)} {listing.unit}</Text>
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text strong style={{ fontSize: 15 }}>Toplam</Text>
          <Text strong style={{ fontSize: 18, color: '#52c41a' }}>{total.toFixed(2)} €</Text>
        </div>
      </div>

      <Button
        type="primary" block size="large" icon={<ShoppingCartOutlined />}
        loading={submitting}
        onClick={handleBuy}
      >
        Satın Al
      </Button>
    </div>
  );
}
