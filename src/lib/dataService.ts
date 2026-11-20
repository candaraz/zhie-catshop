import type {
  AuditLog,
  CashPaymentMethod,
  CashTransaction,
  Category,
  Customer,
  Expense,
  ExpenseType,
  Payment,
  PaymentMethod,
  Product,
  Receivable,
  Sale,
  SaleItem,
  StockAdjustment,
  StockAdjustmentType,
  StoreSettings,
  UserPermissions,
  UserProfile,
} from '../types';
import { generateInvoiceNumber, generateUUID } from './format';
import {
  createLocalUser,
  hashLocalPassword,
  loadLocalDb,
  saveLocalDb,
  type LocalDatabase,
} from './localDb';
import { getSupabaseClient } from './supabase';

export type DataMode = 'supabase' | 'local';

function assertOnlineForSupabase(mode: DataMode) {
  if (mode === 'supabase' && typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'Koneksi internet terputus. Transaksi tidak dapat disimpan ke server Supabase. Periksa koneksi Anda lalu coba lagi.'
    );
  }
}

export interface AllStoreData {
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
  users: UserProfile[];
  audit_logs: AuditLog[];
}

export async function fetchAllData(mode: DataMode, actor: UserProfile): Promise<AllStoreData> {
  if (mode === 'local') {
    const db = loadLocalDb();
    const canSeeCost = actor.role === 'owner' || actor.permissions.can_view_cost_price;
    const products = db.products.map((p) => ({
      ...p,
      cost_price: canSeeCost ? p.cost_price : null,
    }));
    const users =
      actor.role === 'owner'
        ? db.users.map(({ password_hash: _ph, ...u }) => u)
        : db.users.filter((u) => u.id === actor.id).map(({ password_hash: _ph, ...u }) => u);

    const customerMap = new Map(db.customers.map((c) => [c.id, c]));
    const productMap = new Map(db.products.map((p) => [p.id, p]));

    const sales = db.sales.map((s) => ({
      ...s,
      customer_name: s.customer_id ? customerMap.get(s.customer_id)?.name || 'Pelanggan' : 'Umum',
    }));

    const receivables = db.receivables.map((r) => ({
      ...r,
      customer_name: customerMap.get(r.customer_id)?.name || 'Pelanggan',
      customer_phone: customerMap.get(r.customer_id)?.phone || '',
    }));

    const stock_adjustments = db.stock_adjustments.map((sa) => ({
      ...sa,
      product_name: productMap.get(sa.product_id)?.name || 'Produk',
    }));

    return {
      categories: db.categories,
      products,
      customers: db.customers,
      sales,
      sale_items: db.sale_items,
      receivables,
      payments: db.payments,
      expenses:
        actor.role === 'owner' || actor.permissions.can_record_expense ? db.expenses : [],
      stock_adjustments,
      cash_transactions:
        actor.role === 'owner'
          ? db.cash_transactions
          : db.cash_transactions.filter((c) => c.user_id === actor.id),
      store_settings: db.store_settings,
      users,
      audit_logs: actor.role === 'owner' ? db.audit_logs : [],
    };
  }

  // SUPABASE MODE
  assertOnlineForSupabase(mode);
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Klien Supabase belum terkonfigurasi.');

  const [
    catRes,
    prodRes,
    custRes,
    salesRes,
    itemsRes,
    recRes,
    payRes,
    expRes,
    adjRes,
    cashRes,
    setRes,
    usersRes,
    auditRes,
  ] = await Promise.all([
    sb.from('categories').select('*').order('name'),
    sb.from('products_secure').select('*').order('name'),
    sb.from('customers').select('*').order('name'),
    sb.from('sales').select('*').order('sale_date', { ascending: false }),
    sb.from('sale_items').select('*'),
    sb.from('receivables').select('*').order('transaction_date', { ascending: false }),
    sb.from('payments').select('*').order('payment_date', { ascending: false }),
    actor.role === 'owner' || actor.permissions.can_record_expense
      ? sb.from('expenses').select('*').order('expense_date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    sb.from('stock_adjustments').select('*').order('created_at', { ascending: false }),
    sb.from('cash_transactions').select('*').order('transaction_date', { ascending: false }),
    sb.from('store_settings').select('*').limit(1).maybeSingle(),
    sb.from('users').select('*').order('created_at'),
    actor.role === 'owner'
      ? sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (catRes.error) throw new Error(catRes.error.message);
  if (prodRes.error) throw new Error(prodRes.error.message);
  if (custRes.error) throw new Error(custRes.error.message);
  if (salesRes.error) throw new Error(salesRes.error.message);

  const customers = (custRes.data || []) as Customer[];
  const products = (prodRes.data || []) as Product[];
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const sales = ((salesRes.data || []) as Sale[]).map((s) => ({
    ...s,
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    total_amount: Number(s.total_amount),
    paid_amount: Number(s.paid_amount),
    change_amount: Number(s.change_amount),
    remaining_debt: Number(s.remaining_debt),
    customer_name: s.customer_id ? customerMap.get(s.customer_id)?.name || 'Pelanggan' : 'Umum',
  }));

  const receivables = ((recRes.data || []) as Receivable[]).map((r) => ({
    ...r,
    total_amount: Number(r.total_amount),
    paid_amount: Number(r.paid_amount),
    remaining_amount: Number(r.remaining_amount),
    customer_name: customerMap.get(r.customer_id)?.name || 'Pelanggan',
    customer_phone: customerMap.get(r.customer_id)?.phone || '',
  }));

  const stock_adjustments = ((adjRes.data || []) as StockAdjustment[]).map((sa) => ({
    ...sa,
    previous_stock: Number(sa.previous_stock),
    quantity_change: Number(sa.quantity_change),
    new_stock: Number(sa.new_stock),
    product_name: productMap.get(sa.product_id)?.name || 'Produk',
  }));

  const defaultSettings: StoreSettings = {
    id: '',
    store_name: 'Zhie Catshop',
    address: '',
    phone: '',
    logo_url: '/logo.png',
    initial_cash_balance: 0,
    receipt_header: 'Terima kasih telah berbelanja di Zhie Catshop',
    receipt_footer: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
    owner_name: 'Pemilik Zhie Catshop',
    owner_phone: '',
    updated_at: new Date().toISOString(),
  };

  return {
    categories: (catRes.data || []) as Category[],
    products: products.map((p) => ({
      ...p,
      cost_price: p.cost_price === null ? null : Number(p.cost_price),
      sell_price: Number(p.sell_price),
      stock: Number(p.stock),
      min_stock: Number(p.min_stock),
    })),
    customers,
    sales,
    sale_items: ((itemsRes.data || []) as SaleItem[]).map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      cost_price: Number(i.cost_price),
      original_price: Number(i.original_price),
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal),
    })),
    receivables,
    payments: ((payRes.data || []) as Payment[]).map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
    expenses: ((expRes.data || []) as Expense[]).map((e) => ({
      ...e,
      amount: Number(e.amount),
    })),
    stock_adjustments,
    cash_transactions: ((cashRes.data || []) as CashTransaction[]).map((c) => ({
      ...c,
      amount: Number(c.amount),
    })),
    store_settings: setRes.data
      ? {
          ...(setRes.data as StoreSettings),
          initial_cash_balance: Number((setRes.data as StoreSettings).initial_cash_balance || 0),
        }
      : defaultSettings,
    users: (usersRes.data || []) as UserProfile[],
    audit_logs: (auditRes.data || []) as AuditLog[],
  };
}

/* ==================== KATEGORI PRODUK ==================== */
export async function saveCategory(
  mode: DataMode,
  actor: UserProfile,
  name: string,
  description: string = ''
): Promise<Category> {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat menambah kategori.');
  }
  assertOnlineForSupabase(mode);
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Nama kategori wajib diisi.');
  const now = new Date().toISOString();

  if (mode === 'local') {
    const db = loadLocalDb();
    if (db.categories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error('Kategori dengan nama tersebut sudah ada.');
    }
    const created: Category = {
      id: generateUUID(),
      name: cleanName,
      description: description.trim(),
      created_at: now,
    };
    db.categories.push(created);
    saveLocalDb(db);
    return created;
  }

  const sb = getSupabaseClient()!;
  const { data, error } = await sb
    .from('categories')
    .insert({ name: cleanName, description: description.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Category;
}

/* ==================== PRODUK & STOK MANUAL ==================== */
export async function saveProduct(
  mode: DataMode,
  actor: UserProfile,
  payload: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<Product> {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat menambah atau mengubah data produk.');
  }
  assertOnlineForSupabase(mode);
  const now = new Date().toISOString();

  if (mode === 'local') {
    const db = loadLocalDb();
    if (payload.id) {
      const idx = db.products.findIndex((p) => p.id === payload.id);
      if (idx === -1) throw new Error('Produk tidak ditemukan.');
      const updated: Product = {
        ...db.products[idx],
        ...payload,
        id: payload.id,
        updated_at: now,
      };
      db.products[idx] = updated;
      db.audit_logs.unshift({
        id: generateUUID(),
        user_id: actor.id,
        user_name: actor.full_name,
        user_role: actor.role,
        action: 'UPDATE_PRODUCT',
        entity_type: 'products',
        entity_id: updated.id,
        details: { name: updated.name, sell_price: updated.sell_price },
        created_at: now,
      });
      saveLocalDb(db);
      return updated;
    } else {
      if (db.products.some((p) => p.sku.toLowerCase() === payload.sku.trim().toLowerCase())) {
        throw new Error('Kode produk / SKU sudah digunakan.');
      }
      const created: Product = {
        ...payload,
        id: generateUUID(),
        sku: payload.sku.trim(),
        created_at: now,
        updated_at: now,
      };
      db.products.push(created);
      db.audit_logs.unshift({
        id: generateUUID(),
        user_id: actor.id,
        user_name: actor.full_name,
        user_role: actor.role,
        action: 'CREATE_PRODUCT',
        entity_type: 'products',
        entity_id: created.id,
        details: { name: created.name, sku: created.sku },
        created_at: now,
      });
      saveLocalDb(db);
      return created;
    }
  }

  const sb = getSupabaseClient()!;
  const row = {
    sku: payload.sku.trim(),
    barcode: payload.barcode?.trim() || null,
    name: payload.name.trim(),
    category_id: payload.category_id || null,
    brand: payload.brand?.trim() || '',
    unit: payload.unit,
    cost_price: Number(payload.cost_price || 0),
    sell_price: Number(payload.sell_price || 0),
    stock: Number(payload.stock || 0),
    min_stock: Number(payload.min_stock || 0),
    description: payload.description?.trim() || '',
    is_active: payload.is_active !== false,
    updated_at: now,
  };

  if (payload.id) {
    const { data, error } = await sb
      .from('products')
      .update(row)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await sb.from('audit_logs').insert({
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'UPDATE_PRODUCT',
      entity_type: 'products',
      entity_id: payload.id,
      details: { name: row.name, sell_price: row.sell_price },
    });
    return data as Product;
  } else {
    const { data, error } = await sb.from('products').insert(row).select().single();
    if (error) throw new Error(error.message);
    await sb.from('audit_logs').insert({
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'CREATE_PRODUCT',
      entity_type: 'products',
      entity_id: (data as Product).id,
      details: { name: row.name, sku: row.sku },
    });
    return data as Product;
  }
}

export async function deleteProduct(mode: DataMode, actor: UserProfile, productId: string) {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat menghapus produk.');
  }
  assertOnlineForSupabase(mode);
  if (mode === 'local') {
    const db = loadLocalDb();
    const target = db.products.find((p) => p.id === productId);
    db.products = db.products.filter((p) => p.id !== productId);
    db.audit_logs.unshift({
      id: generateUUID(),
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'DELETE_PRODUCT',
      entity_type: 'products',
      entity_id: productId,
      details: { name: target?.name },
      created_at: new Date().toISOString(),
    });
    saveLocalDb(db);
    return;
  }
  const sb = getSupabaseClient()!;
  const { error } = await sb.from('products').delete().eq('id', productId);
  if (error) throw new Error(error.message);
}

export async function adjustProductStock(
  mode: DataMode,
  actor: UserProfile,
  productId: string,
  adjustmentType: StockAdjustmentType,
  quantity: number,
  reason: string
) {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat mengubah stok produk.');
  }
  assertOnlineForSupabase(mode);
  if (quantity < 0) throw new Error('Jumlah stok tidak boleh negatif.');

  if (mode === 'local') {
    const db = loadLocalDb();
    const prod = db.products.find((p) => p.id === productId);
    if (!prod) throw new Error('Produk tidak ditemukan.');
    const prev = Number(prod.stock);
    let next = prev;
    let delta = 0;
    if (adjustmentType === 'add') {
      next = prev + quantity;
      delta = quantity;
    } else if (adjustmentType === 'reduce') {
      next = Math.max(0, prev - quantity);
      delta = next - prev;
    } else {
      next = Math.max(0, quantity);
      delta = next - prev;
    }
    const now = new Date().toISOString();
    prod.stock = next;
    prod.updated_at = now;

    db.stock_adjustments.unshift({
      id: generateUUID(),
      product_id: productId,
      product_name: prod.name,
      user_id: actor.id,
      adjusted_by_name: actor.full_name,
      adjustment_type: adjustmentType,
      previous_stock: prev,
      quantity_change: delta,
      new_stock: next,
      reason: reason.trim(),
      created_at: now,
    });

    db.audit_logs.unshift({
      id: generateUUID(),
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'ADJUST_STOCK',
      entity_type: 'products',
      entity_id: productId,
      details: { product_name: prod.name, type: adjustmentType, prev, next, reason },
      created_at: now,
    });
    saveLocalDb(db);
    return;
  }

  const sb = getSupabaseClient()!;
  const { error } = await sb.rpc('adjust_product_stock', {
    p_product_id: productId,
    p_adjustment_type: adjustmentType,
    p_quantity: quantity,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
}

/* ==================== PELANGGAN ==================== */
export async function saveCustomer(
  mode: DataMode,
  actor: UserProfile,
  payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<Customer> {
  if (actor.role !== 'owner' && !actor.permissions.can_manage_customers) {
    throw new Error('Anda tidak memiliki izin mengelola data pelanggan.');
  }
  assertOnlineForSupabase(mode);
  const now = new Date().toISOString();

  if (mode === 'local') {
    const db = loadLocalDb();
    if (payload.id) {
      const idx = db.customers.findIndex((c) => c.id === payload.id);
      if (idx === -1) throw new Error('Pelanggan tidak ditemukan.');
      const updated: Customer = { ...db.customers[idx], ...payload, id: payload.id, updated_at: now };
      db.customers[idx] = updated;
      saveLocalDb(db);
      return updated;
    } else {
      const created: Customer = { ...payload, id: generateUUID(), created_at: now, updated_at: now };
      db.customers.push(created);
      db.audit_logs.unshift({
        id: generateUUID(),
        user_id: actor.id,
        user_name: actor.full_name,
        user_role: actor.role,
        action: 'CREATE_CUSTOMER',
        entity_type: 'customers',
        entity_id: created.id,
        details: { name: created.name },
        created_at: now,
      });
      saveLocalDb(db);
      return created;
    }
  }

  const sb = getSupabaseClient()!;
  const row = {
    name: payload.name.trim(),
    phone: payload.phone?.trim() || '',
    address: payload.address?.trim() || '',
    notes: payload.notes?.trim() || '',
    updated_at: now,
  };

  if (payload.id) {
    const { data, error } = await sb
      .from('customers')
      .update(row)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Customer;
  } else {
    const { data, error } = await sb.from('customers').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data as Customer;
  }
}

/* ==================== TRANSAKSI KASIR (ATOMIC + IDEMPOTENT + STOK TIDAK BERKURANG OTOMATIS) ==================== */
export interface CreateSaleInput {
  customerId: string | null;
  items: {
    product_id: string;
    product_name: string;
    unit: string;
    quantity: number;
    cost_price: number;
    original_price: number;
    unit_price: number;
    price_overridden: boolean;
  }[];
  discount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  dueDate: string | null;
  notes: string;
  idempotencyKey: string;
}

export async function createSaleTransaction(
  mode: DataMode,
  actor: UserProfile,
  input: CreateSaleInput
): Promise<Sale> {
  assertOnlineForSupabase(mode);
  if (input.items.length === 0) throw new Error('Keranjang belanja masih kosong.');

  const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = Math.max(0, Math.min(subtotal, Number(input.discount || 0)));
  const totalAmount = Math.max(0, subtotal - discount);
  const paidAmount = Math.max(0, Number(input.paidAmount || 0));

  let changeAmount = 0;
  let remainingDebt = 0;
  let cashIn = 0;
  let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'paid';

  if (paidAmount >= totalAmount) {
    changeAmount = paidAmount - totalAmount;
    remainingDebt = 0;
    cashIn = totalAmount;
    paymentStatus = 'paid';
  } else if (paidAmount > 0) {
    changeAmount = 0;
    remainingDebt = totalAmount - paidAmount;
    cashIn = paidAmount;
    paymentStatus = 'partial';
  } else {
    changeAmount = 0;
    remainingDebt = totalAmount;
    cashIn = 0;
    paymentStatus = 'unpaid';
  }

  if (remainingDebt > 0 && !input.customerId) {
    throw new Error('Pilih pelanggan terlebih dahulu untuk pembayaran sebagian atau kredit/utang.');
  }

  const invoiceNumber = generateInvoiceNumber();
  const now = new Date().toISOString();

  if (mode === 'local') {
    const db = loadLocalDb();
    // Cek idempotency agar klik ganda tidak menghasilkan transaksi dobel
    const existing = db.sales.find((s) => s.idempotency_key === input.idempotencyKey);
    if (existing) {
      return {
        ...existing,
        items: db.sale_items.filter((i) => i.sale_id === existing.id),
      };
    }

    const saleId = generateUUID();
    const customer = input.customerId
      ? db.customers.find((c) => c.id === input.customerId)
      : undefined;

    const sale: Sale = {
      id: saleId,
      invoice_number: invoiceNumber,
      sale_date: now,
      customer_id: input.customerId,
      customer_name: customer?.name || 'Umum',
      user_id: actor.id,
      cashier_name: actor.full_name,
      subtotal,
      discount,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      change_amount: changeAmount,
      remaining_debt: remainingDebt,
      payment_method: input.paymentMethod,
      payment_status: paymentStatus,
      notes: input.notes.trim(),
      idempotency_key: input.idempotencyKey,
      created_at: now,
    };

    // Simpan item (STOK PRODUK TIDAK DIKURANGI OTOMATIS SESUAI KETENTUAN)
    const saleItems: SaleItem[] = input.items.map((item) => {
      const dbProd = db.products.find((p) => p.id === item.product_id);
      return {
        id: generateUUID(),
        sale_id: saleId,
        product_id: item.product_id,
        product_name: item.product_name,
        unit: item.unit,
        quantity: item.quantity,
        cost_price: Number(dbProd?.cost_price ?? item.cost_price ?? 0),
        original_price: item.original_price,
        unit_price: item.unit_price,
        price_overridden: item.price_overridden,
        subtotal: item.quantity * item.unit_price,
      };
    });

    db.sales.unshift(sale);
    db.sale_items.push(...saleItems);

    const cashMethod: CashPaymentMethod = input.paymentMethod === 'transfer' ? 'transfer' : 'tunai';

    if (cashIn > 0) {
      db.payments.unshift({
        id: generateUUID(),
        sale_id: saleId,
        receivable_id: null,
        customer_id: input.customerId,
        user_id: actor.id,
        received_by_name: actor.full_name,
        amount: cashIn,
        payment_method: cashMethod,
        payment_date: now,
        notes: `Pembayaran penjualan ${invoiceNumber}`,
        idempotency_key: `${input.idempotencyKey}-pay`,
        created_at: now,
      });

      db.cash_transactions.unshift({
        id: generateUUID(),
        transaction_date: now,
        type: 'in',
        category: 'Penjualan',
        reference_type: 'sale',
        reference_id: saleId,
        amount: cashIn,
        payment_method: cashMethod,
        description: `Penjualan ${invoiceNumber}`,
        user_id: actor.id,
        created_by_name: actor.full_name,
        created_at: now,
      });
    }

    if (remainingDebt > 0 && input.customerId) {
      db.receivables.unshift({
        id: generateUUID(),
        sale_id: saleId,
        customer_id: input.customerId,
        customer_name: customer?.name || 'Pelanggan',
        invoice_number: invoiceNumber,
        transaction_date: now,
        total_amount: totalAmount,
        paid_amount: cashIn,
        remaining_amount: remainingDebt,
        status: 'unpaid',
        due_date: input.dueDate || null,
        notes: input.notes.trim(),
        created_at: now,
        updated_at: now,
      });
    }

    db.audit_logs.unshift({
      id: generateUUID(),
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'CREATE_SALE',
      entity_type: 'sales',
      entity_id: saleId,
      details: { invoice_number: invoiceNumber, total_amount: totalAmount, remaining_debt: remainingDebt },
      created_at: now,
    });

    saveLocalDb(db);
    return { ...sale, items: saleItems };
  }

  // SUPABASE RPC ATOMIC
  const sb = getSupabaseClient()!;
  const { data: saleId, error } = await sb.rpc('create_sale_transaction', {
    p_invoice_number: invoiceNumber,
    p_customer_id: input.customerId,
    p_subtotal: subtotal,
    p_discount: discount,
    p_total_amount: totalAmount,
    p_paid_amount: paidAmount,
    p_payment_method: input.paymentMethod,
    p_due_date: input.dueDate || null,
    p_notes: input.notes.trim(),
    p_idempotency_key: input.idempotencyKey,
    p_items: input.items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      unit: i.unit,
      quantity: i.quantity,
      unit_price: i.unit_price,
      price_overridden: i.price_overridden,
    })),
  });
  if (error) throw new Error(error.message);

  const { data: createdSale, error: fetchErr } = await sb
    .from('sales')
    .select('*')
    .eq('id', saleId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { data: createdItems } = await sb.from('sale_items').select('*').eq('sale_id', saleId);

  return {
    ...(createdSale as Sale),
    items: (createdItems || []) as SaleItem[],
  };
}

/* ==================== PEMBAYARAN PIUTANG ==================== */
export async function recordReceivablePayment(
  mode: DataMode,
  actor: UserProfile,
  payload: {
    receivableId: string;
    amount: number;
    paymentMethod: CashPaymentMethod;
    notes: string;
    idempotencyKey: string;
  }
): Promise<Payment> {
  if (actor.role !== 'owner' && !actor.permissions.can_receive_receivable_payment) {
    throw new Error('Anda tidak memiliki izin menerima pembayaran piutang.');
  }
  assertOnlineForSupabase(mode);

  const now = new Date().toISOString();

  if (mode === 'local') {
    const db = loadLocalDb();
    const existing = db.payments.find((p) => p.idempotency_key === payload.idempotencyKey);
    if (existing) return existing;

    const rec = db.receivables.find((r) => r.id === payload.receivableId);
    if (!rec) throw new Error('Data piutang tidak ditemukan.');
    if (rec.remaining_amount <= 0) throw new Error('Piutang ini sudah lunas.');
    if (payload.amount <= 0 || payload.amount > rec.remaining_amount) {
      throw new Error('Nominal pembayaran harus lebih dari Rp 0 dan tidak melebihi sisa utang.');
    }

    rec.paid_amount += payload.amount;
    rec.remaining_amount = Math.max(0, rec.remaining_amount - payload.amount);
    rec.status = rec.remaining_amount <= 0 ? 'paid' : 'unpaid';
    rec.updated_at = now;

    const sale = db.sales.find((s) => s.id === rec.sale_id);
    if (sale) {
      sale.paid_amount += payload.amount;
      sale.remaining_debt = rec.remaining_amount;
      sale.payment_status = rec.remaining_amount <= 0 ? 'paid' : 'partial';
    }

    const payment: Payment = {
      id: generateUUID(),
      sale_id: rec.sale_id,
      receivable_id: rec.id,
      customer_id: rec.customer_id,
      user_id: actor.id,
      received_by_name: actor.full_name,
      amount: payload.amount,
      payment_method: payload.paymentMethod,
      payment_date: now,
      notes: payload.notes.trim() || `Pembayaran piutang ${rec.invoice_number}`,
      idempotency_key: payload.idempotencyKey,
      created_at: now,
    };

    db.payments.unshift(payment);
    db.cash_transactions.unshift({
      id: generateUUID(),
      transaction_date: now,
      type: 'in',
      category: 'Pembayaran Piutang',
      reference_type: 'receivable_payment',
      reference_id: payment.id,
      amount: payload.amount,
      payment_method: payload.paymentMethod,
      description: `Cicilan piutang ${rec.invoice_number}`,
      user_id: actor.id,
      created_by_name: actor.full_name,
      created_at: now,
    });

    db.audit_logs.unshift({
      id: generateUUID(),
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'RECEIVABLE_PAYMENT',
      entity_type: 'receivables',
      entity_id: rec.id,
      details: { invoice_number: rec.invoice_number, amount: payload.amount, status: rec.status },
      created_at: now,
    });

    saveLocalDb(db);
    return payment;
  }

  const sb = getSupabaseClient()!;
  const { data: paymentId, error } = await sb.rpc('record_receivable_payment', {
    p_receivable_id: payload.receivableId,
    p_amount: payload.amount,
    p_payment_method: payload.paymentMethod,
    p_notes: payload.notes.trim(),
    p_idempotency_key: payload.idempotencyKey,
  });
  if (error) throw new Error(error.message);

  const { data: payData, error: payErr } = await sb
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  if (payErr) throw new Error(payErr.message);
  return payData as Payment;
}

/* ==================== PENGELUARAN ==================== */
export async function createExpense(
  mode: DataMode,
  actor: UserProfile,
  payload: {
    expense_date: string;
    category: string;
    expense_type: ExpenseType;
    description: string;
    amount: number;
    payment_method: CashPaymentMethod;
    notes: string;
    receipt_url: string | null;
    idempotencyKey: string;
  }
): Promise<Expense> {
  if (actor.role !== 'owner' && !actor.permissions.can_record_expense) {
    throw new Error('Anda tidak memiliki izin mencatat pengeluaran.');
  }
  assertOnlineForSupabase(mode);
  if (payload.amount <= 0) throw new Error('Nominal pengeluaran harus lebih dari Rp 0.');

  const now = new Date().toISOString();
  const expenseDateIso = payload.expense_date.includes('T')
    ? payload.expense_date
    : `${payload.expense_date}T12:00:00`;

  if (mode === 'local') {
    const db = loadLocalDb();
    const existing = db.expenses.find((e) => e.idempotency_key === payload.idempotencyKey);
    if (existing) return existing;

    const expense: Expense = {
      id: generateUUID(),
      expense_date: expenseDateIso,
      category: payload.category,
      expense_type: payload.expense_type,
      description: payload.description.trim(),
      amount: payload.amount,
      payment_method: payload.payment_method,
      notes: payload.notes.trim(),
      receipt_url: payload.receipt_url,
      user_id: actor.id,
      recorded_by_name: actor.full_name,
      idempotency_key: payload.idempotencyKey,
      created_at: now,
    };

    db.expenses.unshift(expense);
    db.cash_transactions.unshift({
      id: generateUUID(),
      transaction_date: expenseDateIso,
      type: 'out',
      category: payload.category,
      reference_type: 'expense',
      reference_id: expense.id,
      amount: payload.amount,
      payment_method: payload.payment_method,
      description: `${payload.category}: ${payload.description.trim()}`,
      user_id: actor.id,
      created_by_name: actor.full_name,
      created_at: now,
    });

    db.audit_logs.unshift({
      id: generateUUID(),
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'CREATE_EXPENSE',
      entity_type: 'expenses',
      entity_id: expense.id,
      details: { category: expense.category, type: expense.expense_type, amount: expense.amount },
      created_at: now,
    });

    saveLocalDb(db);
    return expense;
  }

  const sb = getSupabaseClient()!;
  const { data, error } = await sb
    .from('expenses')
    .insert({
      expense_date: expenseDateIso,
      category: payload.category,
      expense_type: payload.expense_type,
      description: payload.description.trim(),
      amount: payload.amount,
      payment_method: payload.payment_method,
      notes: payload.notes.trim(),
      receipt_url: payload.receipt_url,
      user_id: actor.id,
      recorded_by_name: actor.full_name,
      idempotency_key: payload.idempotencyKey,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const created = data as Expense;
  await sb.from('cash_transactions').insert({
    transaction_date: expenseDateIso,
    type: 'out',
    category: payload.category,
    reference_type: 'expense',
    reference_id: created.id,
    amount: payload.amount,
    payment_method: payload.payment_method,
    description: `${payload.category}: ${payload.description.trim()}`,
    user_id: actor.id,
    created_by_name: actor.full_name,
  });

  await sb.from('audit_logs').insert({
    user_id: actor.id,
    user_name: actor.full_name,
    user_role: actor.role,
    action: 'CREATE_EXPENSE',
    entity_type: 'expenses',
    entity_id: created.id,
    details: { category: created.category, type: created.expense_type, amount: created.amount },
  });

  return created;
}

export async function deleteExpense(mode: DataMode, actor: UserProfile, expenseId: string) {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat menghapus pengeluaran.');
  }
  assertOnlineForSupabase(mode);
  if (mode === 'local') {
    const db = loadLocalDb();
    db.expenses = db.expenses.filter((e) => e.id !== expenseId);
    db.cash_transactions = db.cash_transactions.filter(
      (c) => !(c.reference_type === 'expense' && c.reference_id === expenseId)
    );
    saveLocalDb(db);
    return;
  }
  const sb = getSupabaseClient()!;
  await sb.from('cash_transactions').delete().eq('reference_type', 'expense').eq('reference_id', expenseId);
  const { error } = await sb.from('expenses').delete().eq('id', expenseId);
  if (error) throw new Error(error.message);
}

/* ==================== PENGATURAN TOKO ==================== */
export async function saveStoreSettings(
  mode: DataMode,
  actor: UserProfile,
  payload: StoreSettings
): Promise<StoreSettings> {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat mengubah pengaturan toko.');
  }
  assertOnlineForSupabase(mode);
  const now = new Date().toISOString();

  if (mode === 'local') {
    const db = loadLocalDb();
    db.store_settings = { ...payload, updated_at: now };
    db.audit_logs.unshift({
      id: generateUUID(),
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'UPDATE_SETTINGS',
      entity_type: 'store_settings',
      entity_id: payload.id,
      details: { store_name: payload.store_name, initial_cash_balance: payload.initial_cash_balance },
      created_at: now,
    });
    saveLocalDb(db);
    return db.store_settings;
  }

  const sb = getSupabaseClient()!;
  const row = {
    store_name: payload.store_name.trim() || 'Zhie Catshop',
    address: payload.address.trim(),
    phone: payload.phone.trim(),
    logo_url: payload.logo_url || '/logo.png',
    initial_cash_balance: Number(payload.initial_cash_balance || 0),
    receipt_header: payload.receipt_header.trim(),
    receipt_footer: payload.receipt_footer.trim(),
    owner_name: payload.owner_name.trim(),
    owner_phone: payload.owner_phone.trim(),
    updated_at: now,
  };

  if (payload.id) {
    const { data, error } = await sb
      .from('store_settings')
      .update(row)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as StoreSettings;
  } else {
    const { data, error } = await sb.from('store_settings').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data as StoreSettings;
  }
}

/* ==================== MANAJEMEN PENGGUNA (MULTI-USER) ==================== */
export async function createUserAccount(
  mode: DataMode,
  actor: UserProfile,
  payload: {
    email: string;
    password: string;
    full_name: string;
    role: 'owner' | 'cashier';
    permissions: UserPermissions;
  }
): Promise<UserProfile> {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat membuat akun pengguna.');
  }
  assertOnlineForSupabase(mode);

  if (mode === 'local') {
    return createLocalUser(actor, payload);
  }

  const sb = getSupabaseClient()!;
  const { data, error } = await sb.functions.invoke('manage-users', {
    body: { action: 'create', ...payload },
  });
  if (error) {
    throw new Error(
      `Gagal memanggil Edge Function manage-users: ${error.message}. Pastikan Edge Function supabase/functions/manage-users sudah di-deploy di proyek Supabase Anda.`
    );
  }
  if (data?.error) throw new Error(data.error);
  return data.user as UserProfile;
}

export async function updateUserAccount(
  mode: DataMode,
  actor: UserProfile,
  userId: string,
  updates: {
    full_name: string;
    role: 'owner' | 'cashier';
    is_active: boolean;
    permissions: UserPermissions;
    new_password?: string;
  }
): Promise<void> {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Pemilik (Owner) yang dapat mengubah akun pengguna.');
  }
  if (userId === actor.id && !updates.is_active) {
    throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri.');
  }
  assertOnlineForSupabase(mode);
  const now = new Date().toISOString();

  if (mode === 'local') {
    const db = loadLocalDb();
    const target = db.users.find((u) => u.id === userId);
    if (!target) throw new Error('Pengguna tidak ditemukan.');
    target.full_name = updates.full_name.trim();
    target.role = updates.role;
    target.is_active = updates.is_active;
    target.permissions = updates.permissions;
    target.updated_at = now;
    if (updates.new_password && updates.new_password.length >= 6) {
      target.password_hash = hashLocalPassword(updates.new_password);
    }
    db.audit_logs.unshift({
      id: generateUUID(),
      user_id: actor.id,
      user_name: actor.full_name,
      user_role: actor.role,
      action: 'UPDATE_USER',
      entity_type: 'users',
      entity_id: userId,
      details: { full_name: target.full_name, role: target.role, is_active: target.is_active },
      created_at: now,
    });
    saveLocalDb(db);
    return;
  }

  const sb = getSupabaseClient()!;
  const { error } = await sb
    .from('users')
    .update({
      full_name: updates.full_name.trim(),
      role: updates.role,
      is_active: updates.is_active,
      permissions: updates.permissions,
      updated_at: now,
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);

  if (updates.new_password && updates.new_password.length >= 6) {
    const { error: pwErr } = await sb.functions.invoke('manage-users', {
      body: { action: 'update_password', user_id: userId, new_password: updates.new_password },
    });
    if (pwErr) throw new Error(`Profil disimpan, namun gagal ubah password: ${pwErr.message}`);
  }

  await sb.from('audit_logs').insert({
    user_id: actor.id,
    user_name: actor.full_name,
    user_role: actor.role,
    action: 'UPDATE_USER',
    entity_type: 'users',
    entity_id: userId,
    details: { full_name: updates.full_name, role: updates.role, is_active: updates.is_active },
  });
}

/* ==================== BACKUP & RESTORE JSON ==================== */
export function exportBackupJson(data: AllStoreData): string {
  return JSON.stringify(
    {
      app: 'Zhie Catshop',
      exported_at: new Date().toISOString(),
      version: 1,
      data,
    },
    null,
    2
  );
}

export function restoreLocalBackupJson(jsonStr: string): void {
  const parsed = JSON.parse(jsonStr);
  const payload = parsed.data || parsed;
  if (!payload || !Array.isArray(payload.categories) || !payload.store_settings) {
    throw new Error('Format file cadangan tidak valid.');
  }
  const current = loadLocalDb();
  const merged: LocalDatabase = {
    ...current,
    categories: payload.categories || current.categories,
    products: payload.products || [],
    customers: payload.customers || [],
    sales: payload.sales || [],
    sale_items: payload.sale_items || [],
    receivables: payload.receivables || [],
    payments: payload.payments || [],
    expenses: payload.expenses || [],
    stock_adjustments: payload.stock_adjustments || [],
    cash_transactions: payload.cash_transactions || [],
    store_settings: payload.store_settings || current.store_settings,
    audit_logs: payload.audit_logs || current.audit_logs,
  };
  saveLocalDb(merged);
}
