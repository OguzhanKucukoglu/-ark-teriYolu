export type UserRole = 'hayvanci' | 'sucukcu' | 'market';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Lot {
  id: number;
  lot_number: string;
  lot_type: 'hammadde' | 'mamul' | 'hayvan' | 'parca';
  owner_id: number;
  owner_name?: string;
  quantity: number;
  unit: string;
  unit_cost?: number;
  total_cost?: number;
  supplier_name?: string;
  production_date?: string;
  expiry_date?: string;
  status: 'active' | 'blocked' | 'recalled' | 'consumed' | 'sold';
  created_at: string;
}

export interface LotMovement {
  id: number;
  lot_id: number;
  movement_type: 'giris' | 'cikis' | 'sevk' | 'iade' | 'fire' | 'bloke' | 'satis' | 'transfer';
  quantity: number;
  unit: string;
  reference_type?: string;
  reference_id?: number;
  from_user_name?: string;
  to_user_name?: string;
  notes?: string;
  created_at: string;
}

export interface ButcheryPart {
  part_name: string;
  actual_weight_kg: number;
  allocated_cost?: number;
  unit_cost?: number;
  is_byproduct?: boolean;
  lot_number?: string;
}

export interface Order {
  id: number;
  buyer_id: number;
  buyer_name?: string;
  seller_id: number;
  seller_name?: string;
  listing_id: number;
  product_name?: string;
  status: 'beklemede' | 'onaylandi' | 'hammadde_gonderildi' | 'uretimde' | 'tamamlandi' | 'iptal';
  expected_qty: number;
  order_date: string;
}

export interface ProductionOrder {
  id: number;
  order_id: number;
  producer_id: number;
  production_number: string;
  product_name: string;
  expected_qty: number;
  actual_qty?: number;
  package_weight?: number;
  total_input_kg?: number;
  fire_qty?: number;
  fire_rate?: number;
  service_cost?: number;
  total_raw_cost?: number;
  ekp?: number;
  status: 'beklemede' | 'uretimde' | 'tamamlandi' | 'sevk_edildi';
  production_date?: string;
}

export interface ProducerListing {
  id: number;
  producer_id: number;
  producer_name?: string;
  product_name: string;
  description?: string;
  service_price: number;
  service_unit: string;
  min_order_qty?: number;
  is_active: boolean;
}

export interface FarmerListing {
  id: number;
  farmer_id: number;
  farmer_name?: string;
  lot_id: number;
  lot_number?: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  description?: string;
  is_active: boolean;
}

export interface Recall {
  id: number;
  initiated_by: number;
  lot_id: number;
  lot_number?: string;
  reason: string;
  status: 'aktif' | 'tamamlandi' | 'iptal';
  affected_count?: number;
  created_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  invoice_type: 'hizmet' | 'satis';
  sender_id: number;
  sender_name: string;
  sender_email: string;
  sender_role: string;
  receiver_id: number;
  receiver_name: string;
  receiver_email: string;
  receiver_role: string;
  reference_type: string;
  reference_id: number;
  lot_number?: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: 'odendi' | 'beklemede' | 'iptal';
  invoice_date: string;
  created_at: string;
}
