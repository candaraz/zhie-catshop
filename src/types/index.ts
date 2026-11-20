export type UserRole = 'owner' | 'cashier';

export interface UserPermissions {
  can_view_cost_price: boolean;
  can_record_expense: boolean;
  can_manage_customers: boolean;
  can_receive_receivable_payment: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  permissions: UserPermissions;
  last_login_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export type ProductUnit = 'pcs' | 'kg' | 'gram' | 'karung' | 'sachet' | 'botol';

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category_id: string | null;
  brand: string;
  unit: ProductUnit;
  cost_price: number | null; // null jika kasir tidak punya izin melihat harga modal
  sell_price: number;
  stock: number;
  min_stock: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'tunai' | 'transfer' | 'kredit';
export type CashPaymentMethod = 'tunai' | 'transfer';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  cost_price: number;
  original_price: number;
  unit_price: number;
  price_overridden: boolean;
  subtotal: number;
}

export interface Sale {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_id: string | null;
  customer_name?: string;
  user_id: string | null;
  cashier_name: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  remaining_debt: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes: string;
  idempotency_key: string | null;
  created_at: string;
  items?: SaleItem[];
}

export interface Receivable {
  id: string;
  sale_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  invoice_number: string;
  transaction_date: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'paid';
  due_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  sale_id: string | null;
  receivable_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  received_by_name: string;
  amount: number;
  payment_method: CashPaymentMethod;
  payment_date: string;
  notes: string;
  idempotency_key: string | null;
  created_at: string;
}

export type ExpenseType = 'inventory' | 'operational' | 'personal';

export const EXPENSE_CATEGORIES: { label: string; defaultType: ExpenseType }[] = [
  { label: 'Pembelian stok makanan kucing', defaultType: 'inventory' },
  { label: 'Pembelian snack', defaultType: 'inventory' },
  { label: 'Bensin', defaultType: 'operational' },
  { label: 'Jajanan', defaultType: 'personal' },
  { label: 'Makan dan minum', defaultType: 'personal' },
  { label: 'Listrik', defaultType: 'operational' },
  { label: 'Internet', defaultType: 'operational' },
  { label: 'Transportasi', defaultType: 'operational' },
  { label: 'Keperluan toko', defaultType: 'operational' },
  { label: 'Keperluan pribadi', defaultType: 'personal' },
  { label: 'Lain-lain', defaultType: 'operational' },
];

export const INITIAL_CATEGORIES: string[] = [
  'Makanan kucing kering',
  'Makanan kucing basah',
  'Snack kucing',
  'Pasir kucing',
  'Vitamin dan obat',
  'Aksesoris',
  'Lain-lain',
];

export const PRODUCT_UNITS: ProductUnit[] = ['pcs', 'kg', 'gram', 'karung', 'sachet', 'botol'];

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  expense_type: ExpenseType;
  description: string;
  amount: number;
  payment_method: CashPaymentMethod;
  notes: string;
  receipt_url: string | null;
  user_id: string | null;
  recorded_by_name: string;
  idempotency_key: string | null;
  created_at: string;
}

export type StockAdjustmentType = 'add' | 'reduce' | 'set';

export interface StockAdjustment {
  id: string;
  product_id: string;
  product_name?: string;
  user_id: string | null;
  adjusted_by_name: string;
  adjustment_type: StockAdjustmentType;
  previous_stock: number;
  quantity_change: number;
  new_stock: number;
  reason: string;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  transaction_date: string;
  type: 'in' | 'out';
  category: string;
  reference_type: 'sale' | 'receivable_payment' | 'expense' | 'initial_balance';
  reference_id: string | null;
  amount: number;
  payment_method: CashPaymentMethod;
  description: string;
  user_id: string | null;
  created_by_name: string;
  created_at: string;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  address: string;
  phone: string;
  logo_url: string;
  initial_cash_balance: number;
  receipt_header: string;
  receipt_footer: string;
  owner_name: string;
  owner_phone: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  priceOverridden: boolean;
}

export type NavPage =
  | 'dashboard'
  | 'cashier'
  | 'products'
  | 'customers'
  | 'receivables'
  | 'expenses'
  | 'transactions'
  | 'reports'
  | 'users'
  | 'settings';
