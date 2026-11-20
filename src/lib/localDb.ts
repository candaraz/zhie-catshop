import {
  INITIAL_CATEGORIES,
  type AuditLog,
  type CashTransaction,
  type Category,
  type Customer,
  type Expense,
  type Payment,
  type Product,
  type Receivable,
  type Sale,
  type SaleItem,
  type StockAdjustment,
  type StoreSettings,
  type UserProfile,
} from '../types';
import { generateUUID } from './format';

const DB_KEY = 'zhie_catshop_local_db_v1';

export interface LocalUserRecord extends UserProfile {
  password_hash: string; // Hanya untuk simulasi mode uji lokal (bukan produksi Supabase)
}

export interface LocalDatabase {
  users: LocalUserRecord[];
  categories: Category[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  sale_items: SaleItem[];
  receivables: Receivable[];
  payments: Payment[];
  expenses: Expense[];
  stock_adjustments: StockAdjustment[];
  cash_transactions: CashTransaction[];
  store_settings: StoreSettings;
  audit_logs: AuditLog[];
}

function simpleHash(input: string): string {
  // Hash sederhana khusus untuk Mode Uji Lokal; mode Supabase menggunakan Supabase Auth
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return `loc_${(h >>> 0).toString(16)}`;
}

export function createInitialLocalDb(): LocalDatabase {
  const now = new Date().toISOString();
  const categories: Category[] = INITIAL_CATEGORIES.map((name) => ({
    id: generateUUID(),
    name,
    description: '',
    created_at: now,
  }));

  const ownerId = generateUUID();
  const cashierId = generateUUID();

  return {
    users: [
      {
        id: ownerId,
        email: 'owner@zhiecatshop.id',
        full_name: 'Pemilik Zhie Catshop',
        role: 'owner',
        is_active: true,
        permissions: {
          can_view_cost_price: true,
          can_record_expense: true,
          can_manage_customers: true,
          can_receive_receivable_payment: true,
        },
        last_login_at: null,
        created_at: now,
        password_hash: simpleHash('owner123'),
      },
      {
        id: cashierId,
        email: 'kasir@zhiecatshop.id',
        full_name: 'Kasir Zhie Catshop',
        role: 'cashier',
        is_active: true,
        permissions: {
          can_view_cost_price: false,
          can_record_expense: false,
          can_manage_customers: true,
          can_receive_receivable_payment: true,
        },
        last_login_at: null,
        created_at: now,
        password_hash: simpleHash('kasir123'),
      },
    ],
    categories,
    // Tidak ada data transaksi/angka palsu: mulai dari kosong & dihitung murni dari input nyata
    products: [],
    customers: [],
    sales: [],
    sale_items: [],
    receivables: [],
    payments: [],
    expenses: [],
    stock_adjustments: [],
    cash_transactions: [],
    store_settings: {
      id: generateUUID(),
      store_name: 'Zhie Catshop',
      address: '',
      phone: '',
      logo_url: '/logo.png',
      initial_cash_balance: 0,
      receipt_header: 'Terima kasih telah berbelanja di Zhie Catshop',
      receipt_footer: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
      owner_name: 'Pemilik Zhie Catshop',
      owner_phone: '',
      updated_at: now,
    },
    audit_logs: [],
  };
}

export function loadLocalDb(): LocalDatabase {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const init = createInitialLocalDb();
      saveLocalDb(init);
      return init;
    }
    const parsed = JSON.parse(raw) as LocalDatabase;
    if (!parsed.store_settings || !Array.isArray(parsed.categories)) {
      const init = createInitialLocalDb();
      saveLocalDb(init);
      return init;
    }
    return parsed;
  } catch {
    const init = createInitialLocalDb();
    saveLocalDb(init);
    return init;
  }
}

export function saveLocalDb(db: LocalDatabase): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function verifyLocalCredentials(email: string, password: string): UserProfile | null {
  const db = loadLocalDb();
  const normalized = email.trim().toLowerCase();
  const found = db.users.find(
    (u) => u.email.toLowerCase() === normalized && u.password_hash === simpleHash(password)
  );
  if (!found) return null;
  if (!found.is_active) {
    throw new Error('Akun Anda telah dinonaktifkan oleh Pemilik toko.');
  }
  found.last_login_at = new Date().toISOString();
  db.audit_logs.unshift({
    id: generateUUID(),
    user_id: found.id,
    user_name: found.full_name,
    user_role: found.role,
    action: 'LOGIN',
    entity_type: 'auth',
    entity_id: found.id,
    details: { email: found.email, mode: 'local' },
    created_at: new Date().toISOString(),
  });
  saveLocalDb(db);
  const { password_hash: _ph, ...profile } = found;
  return profile;
}

export function createLocalUser(
  actor: UserProfile,
  payload: {
    email: string;
    password: string;
    full_name: string;
    role: 'owner' | 'cashier';
    permissions: UserProfile['permissions'];
  }
): UserProfile {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat menambah pengguna.');
  }
  const db = loadLocalDb();
  const email = payload.email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error('Email sudah terdaftar.');
  }
  const now = new Date().toISOString();
  const record: LocalUserRecord = {
    id: generateUUID(),
    email,
    full_name: payload.full_name.trim(),
    role: payload.role,
    is_active: true,
    permissions:
      payload.role === 'owner'
        ? {
            can_view_cost_price: true,
            can_record_expense: true,
            can_manage_customers: true,
            can_receive_receivable_payment: true,
          }
        : payload.permissions,
    last_login_at: null,
    created_at: now,
    updated_at: now,
    password_hash: simpleHash(payload.password),
  };
  db.users.push(record);
  db.audit_logs.unshift({
    id: generateUUID(),
    user_id: actor.id,
    user_name: actor.full_name,
    user_role: actor.role,
    action: 'CREATE_USER',
    entity_type: 'users',
    entity_id: record.id,
    details: { email: record.email, role: record.role },
    created_at: now,
  });
  saveLocalDb(db);
  const { password_hash: _ph, ...profile } = record;
  return profile;
}

export function hashLocalPassword(password: string): string {
  return simpleHash(password);
}
