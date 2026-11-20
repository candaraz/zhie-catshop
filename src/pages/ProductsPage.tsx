import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Edit3,
  History,
  Info,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { PRODUCT_UNITS, type Product, type ProductUnit, type StockAdjustmentType } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { adjustProductStock, deleteProduct, saveCategory, saveProduct } from '../lib/dataService';
import { formatDateTime, formatNumber, formatRupiah } from '../lib/format';
import { Modal } from '../components/Modal';

export const ProductsPage: React.FC = () => {
  const { data, refreshData, showToast } = useApp();
  const { user, mode, isOwner, canViewCostPrice } = useAuth();

  const [tab, setTab] = useState<'products' | 'history'>('products');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  // Category Modal
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Product Form Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    category_id: '',
    brand: '',
    unit: 'pcs' as ProductUnit,
    cost_price: '',
    sell_price: '',
    stock: '0',
    min_stock: '5',
    description: '',
  });

  // Manual Stock Adjustment Modal
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<StockAdjustmentType>('add');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);

  const categories = data?.categories || [];
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filteredProducts = useMemo(() => {
    const list = data?.products || [];
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (catFilter !== 'all' && p.category_id !== catFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
      );
    });
  }, [data?.products, search, catFilter]);

  const openAddModal = () => {
    setEditing(null);
    const nextNum = String((data?.products.length || 0) + 1).padStart(3, '0');
    setForm({
      sku: `PRD-${nextNum}`,
      barcode: '',
      name: '',
      category_id: categories[0]?.id || '',
      brand: '',
      unit: 'pcs',
      cost_price: '',
      sell_price: '',
      stock: '0',
      min_stock: '5',
      description: '',
    });
    setFormOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditing(p);
    setForm({
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      category_id: p.category_id || '',
      brand: p.brand || '',
      unit: p.unit,
      cost_price: p.cost_price !== null ? String(p.cost_price) : '0',
      sell_price: String(p.sell_price),
      stock: String(p.stock),
      min_stock: String(p.min_stock),
      description: p.description || '',
    });
    setFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.sku.trim() || !form.name.trim()) {
      showToast('SKU dan Nama Produk wajib diisi.', 'error');
      return;
    }
    const sellPrice = Number(form.sell_price);
    const costPrice = Number(form.cost_price || 0);
    if (Number.isNaN(sellPrice) || sellPrice < 0) {
      showToast('Harga jual tidak valid.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveProduct(mode, user, {
        id: editing?.id,
        sku: form.sku,
        barcode: form.barcode,
        name: form.name,
        category_id: form.category_id || null,
        brand: form.brand,
        unit: form.unit,
        cost_price: costPrice,
        sell_price: sellPrice,
        stock: Number(form.stock || 0),
        min_stock: Number(form.min_stock || 0),
        description: form.description,
        is_active: true,
      });
      showToast(editing ? 'Produk berhasil diperbarui.' : 'Produk baru berhasil ditambahkan.');
      setFormOpen(false);
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan produk.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!user || !isOwner) return;
    if (!window.confirm(`Hapus produk "${p.name}"?`)) return;
    try {
      await deleteProduct(mode, user, p.id);
      showToast('Produk dihapus.');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus produk.', 'error');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !stockModalProduct) return;
    const qty = Number(adjQty);
    if (Number.isNaN(qty) || qty < 0) {
      showToast('Masukkan jumlah stok yang valid.', 'error');
      return;
    }
    if (!adjReason.trim()) {
      showToast('Masukkan keterangan / alasan perubahan stok.', 'error');
      return;
    }
    setAdjSaving(true);
    try {
      await adjustProductStock(mode, user, stockModalProduct.id, adjType, qty, adjReason);
      showToast('Stok produk berhasil disesuaikan secara manual.');
      setStockModalProduct(null);
      setAdjQty('');
      setAdjReason('');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyesuaikan stok.', 'error');
    } finally {
      setAdjSaving(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !catName.trim()) return;
    setCatSaving(true);
    try {
      await saveCategory(mode, user, catName);
      showToast(`Kategori "${catName.trim()}" ditambahkan.`);
      setCatName('');
      setCatOpen(false);
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menambah kategori.', 'error');
    } finally {
      setCatSaving(false);
    }
  };

  return (
    <div>
      <div className="alert-box alert-info">
        <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Sistem Stok Manual:</strong> Transaksi penjualan di kasir{' '}
          <strong>tidak mengurangi stok secara otomatis</strong>. Pemilik dapat menambah, mengurangi,
          atau menyesuaikan stok secara manual di sini beserta riwayat perubahannya.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div className="tabs-bar" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`tab-btn ${tab === 'products' ? 'active' : ''}`}
            onClick={() => setTab('products')}
          >
            <Package size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Daftar Produk ({data?.products.length || 0})
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            <History size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Riwayat Stok ({data?.stock_adjustments.length || 0})
          </button>
        </div>

        {isOwner && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={() => setCatOpen(true)}>
              <Plus size={16} /> Kategori
            </button>
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <Plus size={17} /> Tambah Produk
            </button>
          </div>
        )}
      </div>

      {tab === 'products' ? (
        <div className="card">
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                className="form-input"
                placeholder="Cari nama produk, SKU, barcode, atau merek..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: 200 }}
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Belum ada produk yang cocok.{' '}
              {isOwner && 'Klik "Tambah Produk" untuk mulai mengisi katalog toko.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU / Produk</th>
                    <th>Kategori & Merek</th>
                    {canViewCostPrice && <th className="text-right">Harga Modal</th>}
                    <th className="text-right">Harga Jual</th>
                    <th className="text-right">Stok</th>
                    {isOwner && <th className="text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const isLow = p.stock <= p.min_stock;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="font-bold">{p.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {p.sku}
                            {p.barcode ? ` • Barcode: ${p.barcode}` : ''}
                          </div>
                        </td>
                        <td>
                          <div>{categoryMap.get(p.category_id || '') || 'Lain-lain'}</div>
                          {p.brand && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {p.brand}
                            </div>
                          )}
                        </td>
                        {canViewCostPrice && (
                          <td className="text-right">
                            {p.cost_price !== null ? formatRupiah(p.cost_price) : '-'}
                          </td>
                        )}
                        <td className="text-right font-bold text-primary">
                          {formatRupiah(p.sell_price)}
                          <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>
                            /{p.unit}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                            {formatNumber(p.stock)} {p.unit}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Min: {formatNumber(p.min_stock)}
                          </div>
                        </td>
                        {isOwner && (
                          <td className="text-right">
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setStockModalProduct(p);
                                  setAdjType('add');
                                  setAdjQty('');
                                  setAdjReason('');
                                }}
                                title="Sesuaikan Stok Manual"
                              >
                                <ArrowUpDown size={14} /> Stok
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm btn-icon"
                                onClick={() => openEditModal(p)}
                                title="Edit Produk"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon text-danger"
                                onClick={() => handleDeleteProduct(p)}
                                title="Hapus Produk"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          {(data?.stock_adjustments || []).length === 0 ? (
            <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Belum ada riwayat penyesuaian stok manual.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Produk</th>
                    <th>Jenis</th>
                    <th className="text-right">Stok Awal</th>
                    <th className="text-right">Perubahan</th>
                    <th className="text-right">Stok Akhir</th>
                    <th>Alasan & Petugas</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.stock_adjustments.map((sa) => (
                    <tr key={sa.id}>
                      <td>{formatDateTime(sa.created_at)}</td>
                      <td className="font-bold">{sa.product_name}</td>
                      <td>
                        <span
                          className={`badge ${
                            sa.adjustment_type === 'add'
                              ? 'badge-success'
                              : sa.adjustment_type === 'reduce'
                              ? 'badge-danger'
                              : 'badge-info'
                          }`}
                        >
                          {sa.adjustment_type === 'add'
                            ? 'Tambah'
                            : sa.adjustment_type === 'reduce'
                            ? 'Kurangi'
                            : 'Atur Ulang'}
                        </span>
                      </td>
                      <td className="text-right">{formatNumber(sa.previous_stock)}</td>
                      <td className="text-right font-bold">
                        {sa.quantity_change > 0 ? `+${formatNumber(sa.quantity_change)}` : formatNumber(sa.quantity_change)}
                      </td>
                      <td className="text-right font-bold text-primary">
                        {formatNumber(sa.new_stock)}
                      </td>
                      <td>
                        <div>{sa.reason || '-'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          Oleh: {sa.adjusted_by_name}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah / Edit Produk */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Produk' : 'Tambah Produk Baru'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setFormOpen(false)}>
              Batal
            </button>
            <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSaveProduct} className="form-grid">
          <div className="form-group">
            <label className="form-label">Kode Produk / SKU *</label>
            <input
              className="form-input"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Barcode (Opsional)</label>
            <input
              className="form-input"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              placeholder="Scan / ketik barcode"
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Nama Produk *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Bolt Salmon 1kg"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select
              className="form-select"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Merek</label>
            <input
              className="form-input"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="Contoh: Bolt, Whiskas, Royal Canin"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Satuan *</label>
            <select
              className="form-select"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value as ProductUnit })}
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Harga Modal (Rp) *</label>
            <input
              type="number"
              min="0"
              className="form-input"
              value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Harga Jual (Rp) *</label>
            <input
              type="number"
              min="0"
              className="form-input"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Stok Awal / Saat Ini</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              disabled={Boolean(editing)}
            />
            {editing && (
              <span className="form-hint">
                Gunakan tombol "Stok" untuk menyesuaikan stok manual agar tercatat di riwayat.
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Stok Minimum (Peringatan)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Keterangan Produk</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Catatan tambahan produk..."
            />
          </div>
        </form>
      </Modal>

      {/* Modal Penyesuaian Stok Manual */}
      <Modal
        open={Boolean(stockModalProduct)}
        onClose={() => setStockModalProduct(null)}
        title={`Sesuaikan Stok Manual — ${stockModalProduct?.name || ''}`}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setStockModalProduct(null)}
            >
              Batal
            </button>
            <button
              type="submit"
              form="stock-adj-form"
              className="btn btn-primary"
              disabled={adjSaving}
            >
              {adjSaving ? 'Menyimpan...' : 'Simpan Perubahan Stok'}
            </button>
          </>
        }
      >
        {stockModalProduct && (
          <form id="stock-adj-form" onSubmit={handleAdjustStock} className="form-grid">
            <div className="form-group full">
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--primary-soft)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Stok Tercatat Saat Ini:</span>
                <strong className="text-primary">
                  {formatNumber(stockModalProduct.stock)} {stockModalProduct.unit}
                </strong>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Jenis Penyesuaian</label>
              <select
                className="form-select"
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as StockAdjustmentType)}
              >
                <option value="add">Tambah Stok (+)</option>
                <option value="reduce">Kurangi Stok (-)</option>
                <option value="set">Atur Ulang / Stok Opname (=)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                {adjType === 'set' ? 'Jumlah Stok Baru' : 'Jumlah Perubahan'} ({stockModalProduct.unit})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                required
              />
            </div>
            <div className="form-group full">
              <label className="form-label">Keterangan / Alasan *</label>
              <input
                className="form-input"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Contoh: Restock dari supplier / Stok opname mingguan / Kemasan rusak"
                required
              />
            </div>
          </form>
        )}
      </Modal>
      {/* Modal Tambah Kategori */}
      <Modal
        open={catOpen}
        onClose={() => setCatOpen(false)}
        title="Tambah Kategori Produk"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCatOpen(false)}>
              Batal
            </button>
            <button type="submit" form="cat-form" className="btn btn-primary" disabled={catSaving}>
              {catSaving ? 'Menyimpan...' : 'Simpan Kategori'}
            </button>
          </>
        }
      >
        <form id="cat-form" onSubmit={handleAddCategory} className="form-grid">
          <div className="form-group full">
            <label className="form-label">Nama Kategori Baru *</label>
            <input
              className="form-input"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Contoh: Grooming & Sampo"
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
