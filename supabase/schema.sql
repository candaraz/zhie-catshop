-- ============================================================================
-- ZHIE CATSHOP — SKEMA DATABASE SUPABASE (MULTI-USER POS & KEUANGAN)
-- Jalankan file ini di Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABEL USERS (Profil Multi-User terhubung ke auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'cashier')) DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  permissions JSONB NOT NULL DEFAULT '{
    "can_view_cost_price": false,
    "can_record_expense": false,
    "can_manage_customers": true,
    "can_receive_receivable_payment": true
  }'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger otomatis: Akun pertama yang dibuat di Supabase Auth otomatis menjadi OWNER
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_count INT;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM public.users;
  IF v_user_count = 0 THEN
    INSERT INTO public.users (id, email, full_name, role, is_active, permissions)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Pemilik Zhie Catshop'),
      'owner',
      TRUE,
      '{"can_view_cost_price": true, "can_record_expense": true, "can_manage_customers": true, "can_receive_receivable_payment": true}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 2. TABEL CATEGORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed 7 kategori awal
INSERT INTO public.categories (name, description) VALUES
  ('Makanan kucing kering', 'Dry food berbagai merek dan kemasan'),
  ('Makanan kucing basah', 'Wet food kaleng, pouch, dan sachet'),
  ('Snack kucing', 'Camilan, creamy treats, dan biskuit kucing'),
  ('Pasir kucing', 'Pasir gumpal, bentonit, tahu/tofu, dan silika'),
  ('Vitamin dan obat', 'Suplemen bulu, vitamin nafsu makan, obat kutu/cacing'),
  ('Aksesoris', 'Kalung, tempat makan, litter box, mainan, kandang'),
  ('Lain-lain', 'Perlengkapan hewan peliharaan lainnya')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. TABEL PRODUCTS (Stok manual — tidak berkurang otomatis saat penjualan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand TEXT DEFAULT '',
  unit TEXT NOT NULL CHECK (unit IN ('pcs', 'kg', 'gram', 'karung', 'sachet', 'botol')) DEFAULT 'pcs',
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,2) NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- ----------------------------------------------------------------------------
-- 4. TABEL CUSTOMERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. TABEL SALES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cashier_name TEXT NOT NULL DEFAULT 'Pengguna',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  change_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  remaining_debt NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (remaining_debt >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('tunai', 'transfer', 'kredit')) DEFAULT 'tunai',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'unpaid')) DEFAULT 'paid',
  notes TEXT DEFAULT '',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(user_id);

-- ----------------------------------------------------------------------------
-- 6. TABEL SALE_ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  price_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);

-- ----------------------------------------------------------------------------
-- 7. TABEL RECEIVABLES (Piutang Pelanggan — tidak pernah dihapus saat lunas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount NUMERIC(14,2) NOT NULL CHECK (remaining_amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid')) DEFAULT 'unpaid',
  due_date DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receivables_customer ON public.receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);

-- ----------------------------------------------------------------------------
-- 8. TABEL PAYMENTS (Riwayat pembayaran penjualan & cicilan piutang)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  receivable_id UUID REFERENCES public.receivables(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  received_by_name TEXT NOT NULL DEFAULT 'Pengguna',
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('tunai', 'transfer')) DEFAULT 'tunai',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT DEFAULT '',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_receivable ON public.payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date DESC);

-- ----------------------------------------------------------------------------
-- 9. TABEL EXPENSES (Pengeluaran terklasifikasi: inventory / operational / personal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('inventory', 'operational', 'personal')) DEFAULT 'operational',
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('tunai', 'transfer')) DEFAULT 'tunai',
  notes TEXT DEFAULT '',
  receipt_url TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_by_name TEXT NOT NULL DEFAULT 'Pengguna',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON public.expenses(expense_type);

-- ----------------------------------------------------------------------------
-- 10. TABEL STOCK_ADJUSTMENTS (Riwayat Perubahan Stok Manual)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  adjusted_by_name TEXT NOT NULL DEFAULT 'Pemilik',
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'reduce', 'set')),
  previous_stock NUMERIC(14,2) NOT NULL,
  quantity_change NUMERIC(14,2) NOT NULL,
  new_stock NUMERIC(14,2) NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON public.stock_adjustments(product_id);

-- ----------------------------------------------------------------------------
-- 11. TABEL CASH_TRANSACTIONS (Buku Kas / Arus Kas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  category TEXT NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('sale', 'receivable_payment', 'expense', 'initial_balance')),
  reference_id UUID,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('tunai', 'transfer')) DEFAULT 'tunai',
  description TEXT DEFAULT '',
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL DEFAULT 'Pengguna',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_tx_date ON public.cash_transactions(transaction_date DESC);

-- ----------------------------------------------------------------------------
-- 12. TABEL STORE_SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'Zhie Catshop',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  logo_url TEXT DEFAULT '/logo.png',
  initial_cash_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  receipt_header TEXT DEFAULT 'Terima kasih telah berbelanja di Zhie Catshop',
  receipt_footer TEXT DEFAULT 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
  owner_name TEXT DEFAULT 'Pemilik Zhie Catshop',
  owner_phone TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.store_settings (store_name)
SELECT 'Zhie Catshop'
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

-- ----------------------------------------------------------------------------
-- 13. TABEL AUDIT_LOGS (Riwayat Aktivitas & Login)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT 'Sistem',
  user_role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON public.audit_logs(created_at DESC);

-- ============================================================================
-- FUNGSI HELPER RBAC (SECURITY DEFINER) UNTUK ROW LEVEL SECURITY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'owner' AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND is_active = TRUE
      AND (role = 'owner' OR COALESCE((permissions ->> perm)::BOOLEAN, FALSE) = TRUE)
  );
$$;

-- ============================================================================
-- AKTIFKAN ROW LEVEL SECURITY (RLS) DI SEMUA TABEL
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES: USERS
CREATE POLICY "users_select_self_or_owner" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_owner());
CREATE POLICY "users_owner_manage" ON public.users
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "users_update_last_login" ON public.users
  FOR UPDATE USING (auth.uid() = id AND is_active = TRUE)
  WITH CHECK (auth.uid() = id AND is_active = TRUE);

-- POLICIES: CATEGORIES
CREATE POLICY "categories_read_active" ON public.categories
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "categories_owner_write" ON public.categories
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- POLICIES: PRODUCTS (Kasir hanya boleh baca; hanya Owner boleh ubah produk/harga/stok)
CREATE POLICY "products_read_active" ON public.products
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "products_owner_write" ON public.products
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- VIEW AMAN: PRODUCTS_SECURE (Menyembunyikan harga modal di backend untuk kasir tanpa izin)
CREATE OR REPLACE VIEW public.products_secure AS
SELECT
  p.id,
  p.sku,
  p.barcode,
  p.name,
  p.category_id,
  p.brand,
  p.unit,
  CASE WHEN public.has_permission('can_view_cost_price') THEN p.cost_price ELSE NULL END AS cost_price,
  p.sell_price,
  p.stock,
  p.min_stock,
  p.description,
  p.is_active,
  p.created_at,
  p.updated_at
FROM public.products p
WHERE public.is_active_user();

-- POLICIES: CUSTOMERS (Kasir bisa baca & tambah pelanggan)
CREATE POLICY "customers_read_active" ON public.customers
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "customers_insert_active" ON public.customers
  FOR INSERT WITH CHECK (public.has_permission('can_manage_customers'));
CREATE POLICY "customers_update_active" ON public.customers
  FOR UPDATE USING (public.has_permission('can_manage_customers'));
CREATE POLICY "customers_delete_owner" ON public.customers
  FOR DELETE USING (public.is_owner());

-- POLICIES: SALES & SALE_ITEMS (Kasir tidak boleh menghapus transaksi!)
CREATE POLICY "sales_read_active" ON public.sales
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "sales_insert_active" ON public.sales
  FOR INSERT WITH CHECK (public.is_active_user() AND user_id = auth.uid());
CREATE POLICY "sales_update_owner" ON public.sales
  FOR UPDATE USING (public.is_owner());
CREATE POLICY "sales_delete_owner" ON public.sales
  FOR DELETE USING (public.is_owner());

CREATE POLICY "sale_items_read_active" ON public.sale_items
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "sale_items_insert_active" ON public.sale_items
  FOR INSERT WITH CHECK (public.is_active_user());
CREATE POLICY "sale_items_owner_modify" ON public.sale_items
  FOR DELETE USING (public.is_owner());

-- POLICIES: RECEIVABLES & PAYMENTS (Riwayat piutang tidak dihapus oleh kasir)
CREATE POLICY "receivables_read_active" ON public.receivables
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "receivables_insert_active" ON public.receivables
  FOR INSERT WITH CHECK (public.is_active_user());
CREATE POLICY "receivables_update_active" ON public.receivables
  FOR UPDATE USING (public.has_permission('can_receive_receivable_payment'));

CREATE POLICY "payments_read_active" ON public.payments
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "payments_insert_active" ON public.payments
  FOR INSERT WITH CHECK (public.is_active_user() AND user_id = auth.uid());

-- POLICIES: EXPENSES (Kasir hanya bisa catat pengeluaran jika diberi izin)
CREATE POLICY "expenses_read_authorized" ON public.expenses
  FOR SELECT USING (public.is_owner() OR public.has_permission('can_record_expense'));
CREATE POLICY "expenses_insert_authorized" ON public.expenses
  FOR INSERT WITH CHECK (public.has_permission('can_record_expense') AND user_id = auth.uid());
CREATE POLICY "expenses_owner_modify" ON public.expenses
  FOR UPDATE USING (public.is_owner());
CREATE POLICY "expenses_owner_delete" ON public.expenses
  FOR DELETE USING (public.is_owner());

-- POLICIES: STOCK_ADJUSTMENTS (Hanya Owner dapat mengubah stok)
CREATE POLICY "stock_adj_read_active" ON public.stock_adjustments
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "stock_adj_owner_write" ON public.stock_adjustments
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- POLICIES: CASH_TRANSACTIONS
CREATE POLICY "cash_tx_read_owner_or_self" ON public.cash_transactions
  FOR SELECT USING (public.is_owner() OR user_id = auth.uid());
CREATE POLICY "cash_tx_insert_active" ON public.cash_transactions
  FOR INSERT WITH CHECK (public.is_active_user());

-- POLICIES: STORE_SETTINGS
CREATE POLICY "store_settings_read_active" ON public.store_settings
  FOR SELECT USING (public.is_active_user());
CREATE POLICY "store_settings_owner_write" ON public.store_settings
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- POLICIES: AUDIT_LOGS
CREATE POLICY "audit_logs_read_owner" ON public.audit_logs
  FOR SELECT USING (public.is_owner());
CREATE POLICY "audit_logs_insert_active" ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_active_user());

-- ============================================================================
-- RPC ATOMIC TRANSACTION: TRANSAKSI KASIR (Idempotent, Tidak Kurangi Stok!)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_sale_transaction(
  p_invoice_number TEXT,
  p_customer_id UUID,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_total_amount NUMERIC,
  p_paid_amount NUMERIC,
  p_payment_method TEXT,
  p_due_date DATE,
  p_notes TEXT,
  p_idempotency_key TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_existing_sale_id UUID;
  v_sale_id UUID;
  v_change NUMERIC := 0;
  v_remaining NUMERIC := 0;
  v_cash_in NUMERIC := 0;
  v_status TEXT := 'paid';
  v_item JSONB;
  v_prod RECORD;
  v_unit_price NUMERIC;
  v_qty NUMERIC;
  v_item_subtotal NUMERIC;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akses ditolak: akun tidak aktif atau belum terdaftar.';
  END IF;

  -- Cek idempotency agar klik ganda tidak membuat transaksi dobel
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_sale_id FROM public.sales WHERE idempotency_key = p_idempotency_key;
    IF v_existing_sale_id IS NOT NULL THEN
      RETURN v_existing_sale_id;
    END IF;
  END IF;

  IF p_paid_amount >= p_total_amount THEN
    v_change := p_paid_amount - p_total_amount;
    v_remaining := 0;
    v_cash_in := p_total_amount;
    v_status := 'paid';
  ELSIF p_paid_amount > 0 THEN
    v_change := 0;
    v_remaining := p_total_amount - p_paid_amount;
    v_cash_in := p_paid_amount;
    v_status := 'partial';
  ELSE
    v_change := 0;
    v_remaining := p_total_amount;
    v_cash_in := 0;
    v_status := 'unpaid';
  END IF;

  IF v_remaining > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Pelanggan wajib dipilih untuk transaksi kredit atau pembayaran sebagian.';
  END IF;

  INSERT INTO public.sales (
    invoice_number, sale_date, customer_id, user_id, cashier_name,
    subtotal, discount, total_amount, paid_amount, change_amount, remaining_debt,
    payment_method, payment_status, notes, idempotency_key
  ) VALUES (
    p_invoice_number, NOW(), p_customer_id, v_user.id, v_user.full_name,
    p_subtotal, p_discount, p_total_amount, p_paid_amount, v_change, v_remaining,
    p_payment_method, v_status, COALESCE(p_notes, ''), p_idempotency_key
  ) RETURNING id INTO v_sale_id;

  -- Simpan item penjualan (STOK PRODUK TIDAK DIUBAH OTOMATIS)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT id, name, unit, cost_price, sell_price INTO v_prod
    FROM public.products WHERE id = (v_item->>'product_id')::UUID;

    v_qty := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_item_subtotal := v_qty * v_unit_price;

    INSERT INTO public.sale_items (
      sale_id, product_id, product_name, unit, quantity,
      cost_price, original_price, unit_price, price_overridden, subtotal
    ) VALUES (
      v_sale_id, v_prod.id, COALESCE(v_prod.name, v_item->>'product_name'),
      COALESCE(v_prod.unit, v_item->>'unit', 'pcs'), v_qty,
      COALESCE(v_prod.cost_price, 0), COALESCE(v_prod.sell_price, v_unit_price),
      v_unit_price, COALESCE((v_item->>'price_overridden')::BOOLEAN, FALSE),
      v_item_subtotal
    );
  END LOOP;

  -- Jika ada uang masuk, catat pembayaran & buku kas
  IF v_cash_in > 0 THEN
    INSERT INTO public.payments (
      sale_id, customer_id, user_id, received_by_name, amount, payment_method, payment_date, notes, idempotency_key
    ) VALUES (
      v_sale_id, p_customer_id, v_user.id, v_user.full_name, v_cash_in,
      CASE WHEN p_payment_method = 'transfer' THEN 'transfer' ELSE 'tunai' END,
      NOW(), 'Pembayaran penjualan ' || p_invoice_number,
      CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || '-pay' ELSE NULL END
    );

    INSERT INTO public.cash_transactions (
      transaction_date, type, category, reference_type, reference_id,
      amount, payment_method, description, user_id, created_by_name
    ) VALUES (
      NOW(), 'in', 'Penjualan', 'sale', v_sale_id,
      v_cash_in, CASE WHEN p_payment_method = 'transfer' THEN 'transfer' ELSE 'tunai' END,
      'Penjualan ' || p_invoice_number, v_user.id, v_user.full_name
    );
  END IF;

  -- Jika ada sisa utang, buat catatan piutang
  IF v_remaining > 0 THEN
    INSERT INTO public.receivables (
      sale_id, customer_id, invoice_number, transaction_date,
      total_amount, paid_amount, remaining_amount, status, due_date, notes
    ) VALUES (
      v_sale_id, p_customer_id, p_invoice_number, NOW(),
      p_total_amount, v_cash_in, v_remaining, 'unpaid', p_due_date, COALESCE(p_notes, '')
    );
  END IF;

  -- Catat audit log
  INSERT INTO public.audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
  VALUES (
    v_user.id, v_user.full_name, v_user.role, 'CREATE_SALE', 'sales', v_sale_id::TEXT,
    jsonb_build_object('invoice_number', p_invoice_number, 'total_amount', p_total_amount, 'paid_amount', v_cash_in, 'remaining_debt', v_remaining)
  );

  RETURN v_sale_id;
END;
$$;

-- ============================================================================
-- RPC ATOMIC: PEMBAYARAN PIUTANG (Mendukung cicilan, riwayat tetap tersimpan)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_receivable_payment(
  p_receivable_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_notes TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_rec public.receivables%ROWTYPE;
  v_existing_payment_id UUID;
  v_payment_id UUID;
  v_new_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active = TRUE;
  IF NOT FOUND OR NOT public.has_permission('can_receive_receivable_payment') THEN
    RAISE EXCEPTION 'Akses ditolak untuk menerima pembayaran piutang.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_payment_id FROM public.payments WHERE idempotency_key = p_idempotency_key;
    IF v_existing_payment_id IS NOT NULL THEN
      RETURN v_existing_payment_id;
    END IF;
  END IF;

  SELECT * INTO v_rec FROM public.receivables WHERE id = p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data piutang tidak ditemukan.';
  END IF;
  IF v_rec.remaining_amount <= 0 THEN
    RAISE EXCEPTION 'Piutang ini sudah lunas.';
  END IF;
  IF p_amount <= 0 OR p_amount > v_rec.remaining_amount THEN
    RAISE EXCEPTION 'Nominal pembayaran harus antara Rp 1 dan sisa utang.';
  END IF;

  v_new_paid := v_rec.paid_amount + p_amount;
  v_new_remaining := v_rec.remaining_amount - p_amount;
  v_new_status := CASE WHEN v_new_remaining <= 0 THEN 'paid' ELSE 'unpaid' END;

  INSERT INTO public.payments (
    sale_id, receivable_id, customer_id, user_id, received_by_name,
    amount, payment_method, payment_date, notes, idempotency_key
  ) VALUES (
    v_rec.sale_id, v_rec.id, v_rec.customer_id, v_user.id, v_user.full_name,
    p_amount, p_payment_method, NOW(), COALESCE(p_notes, 'Pembayaran piutang ' || v_rec.invoice_number), p_idempotency_key
  ) RETURNING id INTO v_payment_id;

  UPDATE public.receivables
  SET paid_amount = v_new_paid,
      remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = v_rec.id;

  UPDATE public.sales
  SET paid_amount = paid_amount + p_amount,
      remaining_debt = v_new_remaining,
      payment_status = CASE WHEN v_new_remaining <= 0 THEN 'paid' ELSE 'partial' END
  WHERE id = v_rec.sale_id;

  INSERT INTO public.cash_transactions (
    transaction_date, type, category, reference_type, reference_id,
    amount, payment_method, description, user_id, created_by_name
  ) VALUES (
    NOW(), 'in', 'Pembayaran Piutang', 'receivable_payment', v_payment_id,
    p_amount, p_payment_method, 'Cicilan piutang ' || v_rec.invoice_number, v_user.id, v_user.full_name
  );

  INSERT INTO public.audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
  VALUES (
    v_user.id, v_user.full_name, v_user.role, 'RECEIVABLE_PAYMENT', 'receivables', v_rec.id::TEXT,
    jsonb_build_object('invoice_number', v_rec.invoice_number, 'amount', p_amount, 'new_remaining', v_new_remaining, 'status', v_new_status)
  );

  RETURN v_payment_id;
END;
$$;

-- ============================================================================
-- RPC ATOMIC: PENYESUAIAN STOK MANUAL (Hanya Owner)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id UUID,
  p_adjustment_type TEXT,
  p_quantity NUMERIC,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_prod public.products%ROWTYPE;
  v_new_stock NUMERIC;
  v_qty_change NUMERIC;
  v_adj_id UUID;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Hanya Pemilik (Owner) yang dapat mengubah stok produk.';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();
  SELECT * INTO v_prod FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan.';
  END IF;

  IF p_adjustment_type = 'add' THEN
    v_new_stock := v_prod.stock + p_quantity;
    v_qty_change := p_quantity;
  ELSIF p_adjustment_type = 'reduce' THEN
    v_new_stock := GREATEST(0, v_prod.stock - p_quantity);
    v_qty_change := v_new_stock - v_prod.stock;
  ELSIF p_adjustment_type = 'set' THEN
    v_new_stock := GREATEST(0, p_quantity);
    v_qty_change := v_new_stock - v_prod.stock;
  ELSE
    RAISE EXCEPTION 'Tipe penyesuaian stok tidak valid.';
  END IF;

  UPDATE public.products SET stock = v_new_stock, updated_at = NOW() WHERE id = p_product_id;

  INSERT INTO public.stock_adjustments (
    product_id, user_id, adjusted_by_name, adjustment_type,
    previous_stock, quantity_change, new_stock, reason
  ) VALUES (
    p_product_id, v_user.id, v_user.full_name, p_adjustment_type,
    v_prod.stock, v_qty_change, v_new_stock, COALESCE(p_reason, '')
  ) RETURNING id INTO v_adj_id;

  INSERT INTO public.audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
  VALUES (
    v_user.id, v_user.full_name, v_user.role, 'ADJUST_STOCK', 'products', p_product_id::TEXT,
    jsonb_build_object('product_name', v_prod.name, 'type', p_adjustment_type, 'previous', v_prod.stock, 'new', v_new_stock, 'reason', p_reason)
  );

  RETURN v_adj_id;
END;
$$;

-- ============================================================================
-- GRANT HAK AKSES SCHEMA PUBLIC KE ROLE AUTHENTICATED (Tetap dijaga oleh RLS!)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.products_secure TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

