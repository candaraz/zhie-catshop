import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { CartItem, PaymentMethod, Product, Sale, SaleItem } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { createSaleTransaction, saveCustomer } from '../lib/dataService';
import { formatNumber, formatRupiah, generateUUID } from '../lib/format';
import { Modal } from '../components/Modal';
import { SaleReceiptModal } from '../components/ReceiptModal';

export const CashierPage: React.FC = () => {
  const { data, refreshData, showToast } = useApp();
  const { user, mode, isOwner, canManageCustomers } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tunai');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Price override modal (hanya untuk Owner dengan konfirmasi)
  const [priceEditItem, setPriceEditItem] = useState<CartItem | null>(null);
  const [newPriceInput, setNewPriceInput] = useState('');

  // Quick Add Customer modal
  const [quickCustOpen, setQuickCustOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');

  // Receipt Modal
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [receiptItems, setReceiptItems] = useState<SaleItem[]>([]);

  const categories = data?.categories || [];
  const customers = data?.customers || [];

  const filteredProducts = useMemo(() => {
    const list = (data?.products || []).filter((p) => p.is_active !== false);
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (selectedCat !== 'all' && p.category_id !== selectedCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [data?.products, search, selectedCat]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sell_price, priceOverridden: false }];
    });
  };

  const updateQty = (productId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: nextQty } : i))
    );
  };

  const confirmPriceOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceEditItem) return;
    const val = Number(newPriceInput);
    if (Number.isNaN(val) || val < 0) {
      showToast('Masukkan harga jual yang valid.', 'error');
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === priceEditItem.product.id
          ? { ...i, unitPrice: val, priceOverridden: val !== i.product.sell_price }
          : i
      )
    );
    showToast(`Harga "${priceEditItem.product.name}" diubah menjadi ${formatRupiah(val)}.`);
    setPriceEditItem(null);
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    [cart]
  );
  const discountNum = Math.max(0, Math.min(subtotal, Number(discount || 0)));
  const grandTotal = Math.max(0, subtotal - discountNum);

  const paidNum =
    paymentMethod === 'kredit'
      ? Math.max(0, Number(paidAmountStr || 0))
      : paidAmountStr === ''
      ? grandTotal
      : Math.max(0, Number(paidAmountStr || 0));

  const changeAmount = Math.max(0, paidNum - grandTotal);
  const remainingDebt = Math.max(0, grandTotal - paidNum);

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickCustName.trim()) return;
    try {
      const created = await saveCustomer(mode, user, {
        name: quickCustName.trim(),
        phone: quickCustPhone.trim(),
        address: '',
        notes: '',
      });
      await refreshData();
      setSelectedCustomerId(created.id);
      setQuickCustOpen(false);
      setQuickCustName('');
      setQuickCustPhone('');
      showToast(`Pelanggan "${created.name}" ditambahkan & dipilih.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menambah pelanggan.', 'error');
    }
  };

  const handleCheckout = async () => {
    if (!user || submitting) return;
    if (cart.length === 0) {
      showToast('Keranjang belanja masih kosong.', 'error');
      return;
    }
    if (remainingDebt > 0 && !selectedCustomerId) {
      showToast(
        'Pilih pelanggan terlebih dahulu karena ada sisa piutang / pembayaran belum penuh.',
        'error'
      );
      return;
    }

    setSubmitting(true);
    const idempotencyKey = generateUUID();
    try {
      const created = await createSaleTransaction(mode, user, {
        customerId: selectedCustomerId || null,
        items: cart.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          unit: i.product.unit,
          quantity: i.quantity,
          cost_price: Number(i.product.cost_price || 0),
          original_price: i.product.sell_price,
          unit_price: i.unitPrice,
          price_overridden: i.priceOverridden,
        })),
        discount: discountNum,
        paidAmount: paidNum,
        paymentMethod,
        dueDate: remainingDebt > 0 ? dueDate || null : null,
        notes,
        idempotencyKey,
      });

      const cust = customers.find((c) => c.id === selectedCustomerId);
      setReceiptSale({ ...created, customer_name: cust?.name || 'Umum' });
      setReceiptItems(created.items || []);

      // Reset keranjang
      setCart([]);
      setDiscount('0');
      setPaidAmountStr('');
      setDueDate('');
      setNotes('');
      setPaymentMethod('tunai');

      showToast(
        remainingDebt > 0
          ? `Transaksi ${created.invoice_number} tersimpan. Sisa ${formatRupiah(
              remainingDebt
            )} masuk piutang.`
          : `Transaksi ${created.invoice_number} berhasil!`,
        'success'
      );
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pos-layout">
      {/* Kiri: Katalog Produk */}
      <div>
        <div className="card" style={{ padding: 16 }}>
          <div className="search-box" style={{ marginBottom: 12 }}>
            <Search size={16} />
            <input
              type="text"
              className="form-input"
              placeholder="Cari nama produk, SKU, atau scan barcode lalu Enter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  const q = search.trim().toLowerCase();
                  const exact = (data?.products || []).find(
                    (p) =>
                      p.is_active !== false &&
                      ((p.barcode && p.barcode.toLowerCase() === q) || p.sku.toLowerCase() === q)
                  );
                  if (exact) {
                    e.preventDefault();
                    addToCart(exact);
                    setSearch('');
                    showToast(`"${exact.name}" ditambahkan ke keranjang.`);
                  } else if (filteredProducts.length === 1) {
                    e.preventDefault();
                    addToCart(filteredProducts[0]);
                    setSearch('');
                    showToast(`"${filteredProducts[0].name}" ditambahkan ke keranjang.`);
                  }
                }
              }}
            />
          </div>

          <div className="category-pills">
            <button
              type="button"
              className={`cat-pill ${selectedCat === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCat('all')}
            >
              Semua ({data?.products.length || 0})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cat-pill ${selectedCat === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCat(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Tidak ada produk ditemukan. Tambahkan produk di menu Produk & Stok terlebih dahulu.
            </div>
          ) : (
            <div className="pos-product-grid">
              {filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.product.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="pos-product-card"
                    style={
                      inCart
                        ? { borderColor: 'var(--primary)', background: 'var(--primary-soft)' }
                        : undefined
                    }
                    onClick={() => addToCart(p)}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sku}</span>
                        {inCart && (
                          <span className="badge badge-accent">{inCart.quantity}x</span>
                        )}
                      </div>
                      <div className="pos-product-name">{p.name}</div>
                      {p.brand && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.brand}</div>
                      )}
                    </div>
                    <div>
                      <div className="pos-product-price">
                        {formatRupiah(p.sell_price)}
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                          /{p.unit}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Stok catatan: {formatNumber(p.stock)} {p.unit}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Kanan: Keranjang & Pembayaran */}
      <div id="pos-cart-section" className="pos-cart-panel">
        <div className="pos-cart-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
            <ShoppingCart size={18} color="var(--primary)" />
            Keranjang ({cart.reduce((s, i) => s + i.quantity, 0)})
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-danger"
              onClick={() => setCart([])}
            >
              Kosongkan
            </button>
          )}
        </div>

        {/* Pelanggan */}
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
          <select
            className="form-select"
            style={{ flex: 1, minHeight: 38, padding: '6px 10px' }}
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">Pelanggan Umum (Tanpa Akun)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
          {canManageCustomers && (
            <button
              type="button"
              className="btn btn-outline btn-icon"
              title="Tambah Pelanggan Cepat"
              onClick={() => setQuickCustOpen(true)}
            >
              <UserPlus size={16} />
            </button>
          )}
        </div>

        {/* Daftar Item */}
        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)' }}>
              Ketuk produk di sebelah kiri untuk menambahkan ke keranjang.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="cart-item-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{item.product.name}</div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon text-danger"
                    style={{ minWidth: 26, minHeight: 26, padding: 2 }}
                    onClick={() => updateQty(item.product.id, 0)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {formatRupiah(item.unitPrice)}
                    </span>
                    {item.priceOverridden && (
                      <span className="badge badge-warning" style={{ fontSize: 10 }}>
                        Diubah
                      </span>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px', minHeight: 24, fontSize: 11 }}
                        onClick={() => {
                          setPriceEditItem(item);
                          setNewPriceInput(String(item.unitPrice));
                        }}
                        title="Ubah harga jual dengan konfirmasi"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>

                  <div className="qty-control">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => updateQty(item.product.id, Number((item.quantity - 1).toFixed(2)))}
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={item.quantity}
                      onChange={(e) => updateQty(item.product.id, Number(e.target.value))}
                      style={{
                        width: 44,
                        textAlign: 'center',
                        border: 'none',
                        fontWeight: 700,
                        background: 'transparent',
                      }}
                    />
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => updateQty(item.product.id, Number((item.quantity + 1).toFixed(2)))}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>
                  {formatRupiah(item.quantity * item.unitPrice)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ringkasan & Pembayaran */}
        <div className="pos-cart-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span className="text-muted">Subtotal</span>
            <strong>{formatRupiah(subtotal)}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span className="text-muted" style={{ fontSize: 13 }}>
              Diskon (Rp)
            </span>
            <input
              type="number"
              min="0"
              className="form-input"
              style={{ width: 135, minHeight: 34, padding: '4px 8px', textAlign: 'right' }}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--primary)',
              paddingTop: 6,
              borderTop: '1px dashed var(--border-strong)',
            }}
          >
            <span>TOTAL</span>
            <span>{formatRupiah(grandTotal)}</span>
          </div>

          {/* Metode Pembayaran */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(
              [
                { id: 'tunai', label: 'Tunai' },
                { id: 'transfer', label: 'Transfer' },
                { id: 'kredit', label: 'Kredit/Utang' },
              ] as { id: PaymentMethod; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                className={`btn btn-sm ${paymentMethod === m.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setPaymentMethod(m.id);
                  if (m.id === 'kredit') setPaidAmountStr('0');
                  else setPaidAmountStr('');
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: 12 }}>
              {paymentMethod === 'kredit'
                ? 'Uang Muka / Bayar Sebagian (Rp 0 jika utang penuh)'
                : 'Jumlah Dibayar (Kosongkan = Bayar Pas)'}
            </label>
            <input
              type="number"
              min="0"
              className="form-input"
              style={{ minHeight: 38, fontWeight: 700 }}
              placeholder={String(grandTotal)}
              value={paidAmountStr}
              onChange={(e) => setPaidAmountStr(e.target.value)}
            />
            {paymentMethod === 'tunai' && grandTotal > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {[
                  { label: 'Pas', val: grandTotal },
                  { label: '20rb', val: 20000 },
                  { label: '50rb', val: 50000 },
                  { label: '100rb', val: 100000 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: '2px 9px', minHeight: 26, fontSize: 11.5 }}
                    onClick={() => setPaidAmountStr(String(chip.val))}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {changeAmount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--success-bg)',
                color: 'var(--success)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span>Kembalian</span>
              <span>{formatRupiah(changeAmount)}</span>
            </div>
          )}

          {remainingDebt > 0 && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--accent-light)',
                border: '1px solid var(--accent-border)',
                color: '#9a3412',
                fontSize: 12.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Masuk ke Piutang Pelanggan:</span>
                <span>{formatRupiah(remainingDebt)}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600 }}>Jatuh Tempo (Opsional):</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ minHeight: 32, marginTop: 3, fontSize: 12.5 }}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <input
            className="form-input"
            style={{ minHeight: 36, fontSize: 12.5 }}
            placeholder="Catatan transaksi (opsional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button
            type="button"
            className="btn btn-accent btn-block"
            style={{ minHeight: 46, fontSize: 15, fontWeight: 800 }}
            disabled={cart.length === 0 || submitting}
            onClick={handleCheckout}
          >
            <CheckCircle2 size={18} />
            {submitting ? 'Menyimpan Transaksi...' : `Proses Pembayaran (${formatRupiah(grandTotal)})`}
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi Ubah Harga Jual */}
      <Modal
        open={Boolean(priceEditItem)}
        onClose={() => setPriceEditItem(null)}
        title="Konfirmasi Ubah Harga Jual"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPriceEditItem(null)}
            >
              Batal
            </button>
            <button type="submit" form="price-override-form" className="btn btn-accent">
              Konfirmasi Harga Baru
            </button>
          </>
        }
      >
        {priceEditItem && (
          <form id="price-override-form" onSubmit={confirmPriceOverride} className="form-grid">
            <div className="form-group full">
              <div className="alert-box alert-warning" style={{ marginBottom: 4 }}>
                Anda akan mengubah harga jual khusus untuk transaksi ini saja. Harga master produk
                tidak berubah.
              </div>
            </div>
            <div className="form-group full">
              <label className="form-label">Produk</label>
              <div className="font-bold">{priceEditItem.product.name}</div>
              <div className="form-hint">
                Harga normal: {formatRupiah(priceEditItem.product.sell_price)}
              </div>
            </div>
            <div className="form-group full">
              <label className="form-label">Harga Jual Baru (Rp)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={newPriceInput}
                onChange={(e) => setNewPriceInput(e.target.value)}
                required
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Tambah Pelanggan Cepat */}
      <Modal
        open={quickCustOpen}
        onClose={() => setQuickCustOpen(false)}
        title="Tambah Pelanggan Cepat"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setQuickCustOpen(false)}
            >
              Batal
            </button>
            <button type="submit" form="quick-cust-form" className="btn btn-primary">
              Simpan & Pilih
            </button>
          </>
        }
      >
        <form id="quick-cust-form" onSubmit={handleQuickAddCustomer} className="form-grid">
          <div className="form-group full">
            <label className="form-label">Nama Pelanggan *</label>
            <input
              className="form-input"
              value={quickCustName}
              onChange={(e) => setQuickCustName(e.target.value)}
              required
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Nomor Telepon</label>
            <input
              className="form-input"
              value={quickCustPhone}
              onChange={(e) => setQuickCustPhone(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Floating Mobile Cart Jump Bar (Nyaman satu tangan di HP) */}
      {cart.length > 0 && (
        <button
          type="button"
          className="mobile-cart-fab"
          onClick={() =>
            document.getElementById('pos-cart-section')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} />
            <strong>{cart.reduce((s, i) => s + i.quantity, 0)} item</strong>
          </span>
          <strong>Bayar {formatRupiah(grandTotal)} ↓</strong>
        </button>
      )}

      {/* Modal Struk */}
      {data && (
        <SaleReceiptModal
          open={Boolean(receiptSale)}
          onClose={() => setReceiptSale(null)}
          sale={receiptSale}
          items={receiptItems}
          settings={data.store_settings}
        />
      )}
    </div>
  );
};
