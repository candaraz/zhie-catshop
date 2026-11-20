import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Info, Plus, Trash2, Wallet } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  type CashPaymentMethod,
  type ExpenseType,
} from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { createExpense, deleteExpense } from '../lib/dataService';
import {
  formatDate,
  formatRupiah,
  generateUUID,
  getExpenseTypeLabel,
  getPaymentMethodLabel,
  toDateInputValue,
} from '../lib/format';
import { Modal } from '../components/Modal';

export const ExpensesPage: React.FC = () => {
  const { data, refreshData, showToast } = useApp();
  const { user, mode, isOwner } = useAuth();

  const [typeFilter, setTypeFilter] = useState<'all' | ExpenseType>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const [form, setForm] = useState({
    expense_date: toDateInputValue(),
    category: EXPENSE_CATEGORIES[0].label,
    expense_type: EXPENSE_CATEGORIES[0].defaultType as ExpenseType,
    description: '',
    amount: '',
    payment_method: 'tunai' as CashPaymentMethod,
    notes: '',
    receipt_url: null as string | null,
  });

  const handleCategoryChange = (catLabel: string) => {
    const found = EXPENSE_CATEGORIES.find((c) => c.label === catLabel);
    setForm((prev) => ({
      ...prev,
      category: catLabel,
      expense_type: found ? found.defaultType : prev.expense_type,
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran foto nota maksimal 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, receipt_url: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    const amount = Number(form.amount);
    if (!form.description.trim() || Number.isNaN(amount) || amount <= 0) {
      showToast('Keterangan dan nominal pengeluaran yang valid wajib diisi.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createExpense(mode, user, {
        expense_date: form.expense_date,
        category: form.category,
        expense_type: form.expense_type,
        description: form.description,
        amount,
        payment_method: form.payment_method,
        notes: form.notes,
        receipt_url: form.receipt_url,
        idempotencyKey: generateUUID(),
      });
      showToast('Pengeluaran berhasil dicatat ke arus kas.');
      setFormOpen(false);
      setForm({
        expense_date: toDateInputValue(),
        category: EXPENSE_CATEGORIES[0].label,
        expense_type: EXPENSE_CATEGORIES[0].defaultType,
        description: '',
        amount: '',
        payment_method: 'tunai',
        notes: '',
        receipt_url: null,
      });
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan pengeluaran.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !isOwner) return;
    if (!window.confirm('Hapus catatan pengeluaran ini? Saldo kas akan ikut diperbarui.')) return;
    try {
      await deleteExpense(mode, user, id);
      showToast('Pengeluaran dihapus.');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus pengeluaran.', 'error');
    }
  };

  const expenses = data?.expenses || [];
  const filtered = useMemo(
    () => expenses.filter((e) => typeFilter === 'all' || e.expense_type === typeFilter),
    [expenses, typeFilter]
  );

  const totals = useMemo(() => {
    const inventory = expenses
      .filter((e) => e.expense_type === 'inventory')
      .reduce((s, e) => s + e.amount, 0);
    const operational = expenses
      .filter((e) => e.expense_type === 'operational')
      .reduce((s, e) => s + e.amount, 0);
    const personal = expenses
      .filter((e) => e.expense_type === 'personal')
      .reduce((s, e) => s + e.amount, 0);
    return { inventory, operational, personal, total: inventory + operational + personal };
  }, [expenses]);

  return (
    <div>
      <div className="alert-box alert-info">
        <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Akuntansi Pengeluaran Akurat:</strong> Semua kategori tetap masuk ke{' '}
          <strong>Arus Kas</strong>. <strong>Pembelian Persediaan (Stok)</strong> mengurangi kas
          namun tidak mengurangi laba langsung (mencegah hitung ganda dengan HPP).{' '}
          <strong>Pengeluaran Pribadi</strong> dicatat sebagai Pengambilan Pemilik (Prive), bukan
          biaya operasional usaha.
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Semua Pengeluaran</div>
          <div className="kpi-value text-danger">{formatRupiah(totals.total)}</div>
          <div className="kpi-sub">Masuk ke arus kas keluar</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pembelian Persediaan (Stok)</div>
          <div className="kpi-value text-primary">{formatRupiah(totals.inventory)}</div>
          <div className="kpi-sub">Tidak mengurangi laba 2x</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Biaya Operasional Usaha</div>
          <div className="kpi-value">{formatRupiah(totals.operational)}</div>
          <div className="kpi-sub">Mengurangi laba bersih</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pengambilan Pemilik (Pribadi)</div>
          <div className="kpi-value text-accent">{formatRupiah(totals.personal)}</div>
          <div className="kpi-sub">Prive / non-operasional</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Wallet size={18} color="var(--primary)" /> Daftar Pengeluaran
          </h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: 'auto', minHeight: 38 }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | ExpenseType)}
            >
              <option value="all">Semua Jenis</option>
              <option value="inventory">Pembelian Persediaan (Stok)</option>
              <option value="operational">Biaya Operasional</option>
              <option value="personal">Pengambilan Pemilik (Pribadi)</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={17} /> Catat Pengeluaran
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Belum ada data pengeluaran tercatat.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori & Klasifikasi</th>
                  <th>Keterangan</th>
                  <th>Metode & Petugas</th>
                  <th className="text-right">Nominal</th>
                  <th className="text-right">Nota / Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.expense_date)}</td>
                    <td>
                      <div className="font-bold">{e.category}</div>
                      <span
                        className={`badge ${
                          e.expense_type === 'inventory'
                            ? 'badge-info'
                            : e.expense_type === 'personal'
                            ? 'badge-accent'
                            : 'badge-neutral'
                        }`}
                        style={{ marginTop: 3 }}
                      >
                        {getExpenseTypeLabel(e.expense_type)}
                      </span>
                    </td>
                    <td>
                      <div>{e.description}</div>
                      {e.notes && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{e.notes}</div>
                      )}
                    </td>
                    <td>
                      <div>{getPaymentMethodLabel(e.payment_method)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Oleh: {e.recorded_by_name}
                      </div>
                    </td>
                    <td className="text-right font-bold text-danger">{formatRupiah(e.amount)}</td>
                    <td className="text-right">
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {e.receipt_url && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm btn-icon"
                            title="Lihat Foto Nota"
                            onClick={() => setPreviewImg(e.receipt_url)}
                          >
                            <ImageIcon size={14} />
                          </button>
                        )}
                        {isOwner && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon text-danger"
                            title="Hapus Pengeluaran"
                            onClick={() => handleDelete(e.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Pengeluaran */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Catat Pengeluaran Baru"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setFormOpen(false)}>
              Batal
            </button>
            <button type="submit" form="expense-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </>
        }
      >
        <form id="expense-form" onSubmit={handleSave} className="form-grid">
          <div className="form-group">
            <label className="form-label">Tanggal *</label>
            <input
              type="date"
              className="form-input"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Metode Pembayaran</label>
            <select
              className="form-select"
              value={form.payment_method}
              onChange={(e) =>
                setForm({ ...form, payment_method: e.target.value as CashPaymentMethod })
              }
            >
              <option value="tunai">Tunai</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div className="form-group full">
            <label className="form-label">Kategori Pengeluaran *</label>
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group full">
            <label className="form-label">Klasifikasi Akuntansi</label>
            <select
              className="form-select"
              value={form.expense_type}
              onChange={(e) => setForm({ ...form, expense_type: e.target.value as ExpenseType })}
            >
              <option value="inventory">
                Pembelian Persediaan / Stok (Kurangi Kas, Tidak Kurangi Laba 2x)
              </option>
              <option value="operational">Biaya Operasional Usaha (Mengurangi Laba Bersih)</option>
              <option value="personal">
                Pengambilan Pemilik / Pribadi (Prive, Bukan Biaya Operasional)
              </option>
            </select>
          </div>
          <div className="form-group full">
            <label className="form-label">Keterangan *</label>
            <input
              className="form-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Contoh: Belanja 5 karung Bolt Salmon / Bayar token listrik"
              required
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Nominal (Rp) *</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Catatan (Opsional)</label>
            <input
              className="form-input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan tambahan..."
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Upload Foto Nota (Opsional, maks 2MB)</label>
            <input
              type="file"
              accept="image/*"
              className="form-input"
              onChange={handlePhotoUpload}
            />
            {form.receipt_url && (
              <img
                src={form.receipt_url}
                alt="Pratinjau Nota"
                style={{ maxHeight: 140, borderRadius: 8, marginTop: 8, objectFit: 'contain' }}
              />
            )}
          </div>
        </form>
      </Modal>

      {/* Preview Foto Nota */}
      <Modal
        open={Boolean(previewImg)}
        onClose={() => setPreviewImg(null)}
        title="Foto Nota Pengeluaran"
      >
        {previewImg && (
          <img
            src={previewImg}
            alt="Nota"
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 10 }}
          />
        )}
      </Modal>
    </div>
  );
};
