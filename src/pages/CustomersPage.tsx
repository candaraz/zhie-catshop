import React, { useMemo, useState } from 'react';
import { Edit3, Eye, Plus, Search, Users } from 'lucide-react';
import type { Customer } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { saveCustomer } from '../lib/dataService';
import { formatDateTime, formatRupiah } from '../lib/format';
import { Modal } from '../components/Modal';

export const CustomersPage: React.FC = () => {
  const { data, refreshData, showToast } = useApp();
  const { user, mode, canManageCustomers } = useAuth();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  const receivableByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    (data?.receivables || []).forEach((r) => {
      if (r.status === 'unpaid' && r.remaining_amount > 0) {
        map.set(r.customer_id, (map.get(r.customer_id) || 0) + r.remaining_amount);
      }
    });
    return map;
  }, [data?.receivables]);

  const salesCountByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    (data?.sales || []).forEach((s) => {
      if (s.customer_id) {
        map.set(s.customer_id, (map.get(s.customer_id) || 0) + 1);
      }
    });
    return map;
  }, [data?.sales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.customers || []).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [data?.customers, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '', notes: '' });
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, notes: c.notes });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      showToast('Nama pelanggan wajib diisi.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveCustomer(mode, user, {
        id: editing?.id,
        name: form.name,
        phone: form.phone,
        address: form.address,
        notes: form.notes,
      });
      showToast(editing ? 'Data pelanggan diperbarui.' : 'Pelanggan baru ditambahkan.');
      setFormOpen(false);
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan pelanggan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const customerSales = useMemo(() => {
    if (!historyCustomer) return [];
    return (data?.sales || []).filter((s) => s.customer_id === historyCustomer.id);
  }, [historyCustomer, data?.sales]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Users size={18} color="var(--primary)" /> Daftar Pelanggan ({data?.customers.length || 0})
          </h2>
          {canManageCustomers && (
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <Plus size={17} /> Tambah Pelanggan
            </button>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="search-box">
            <Search size={16} />
            <input
              className="form-input"
              placeholder="Cari nama pelanggan, nomor telepon, atau alamat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Belum ada data pelanggan.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Pelanggan</th>
                  <th>Telepon & Alamat</th>
                  <th className="text-center">Transaksi</th>
                  <th className="text-right">Total Piutang</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const debt = receivableByCustomer.get(c.id) || 0;
                  const count = salesCountByCustomer.get(c.id) || 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="font-bold">{c.name}</div>
                        {c.notes && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {c.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{c.phone || '-'}</div>
                        {c.address && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {c.address}
                          </div>
                        )}
                      </td>
                      <td className="text-center">{count}x</td>
                      <td className="text-right">
                        {debt > 0 ? (
                          <span className="badge badge-danger">{formatRupiah(debt)}</span>
                        ) : (
                          <span className="badge badge-success">Rp 0</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setHistoryCustomer(c)}
                          >
                            <Eye size={14} /> Riwayat
                          </button>
                          {canManageCustomers && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm btn-icon"
                              onClick={() => openEdit(c)}
                              title="Edit Pelanggan"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Pelanggan */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setFormOpen(false)}>
              Batal
            </button>
            <button type="submit" form="customer-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Pelanggan'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSave} className="form-grid">
          <div className="form-group full">
            <label className="form-label">Nama Pelanggan *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Ibu Rina"
              required
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Nomor Telepon / WhatsApp</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Alamat (Opsional)</label>
            <textarea
              className="form-textarea"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Alamat rumah / pengiriman"
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Catatan Pelanggan</label>
            <input
              className="form-input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Contoh: Langganan pakan Royal Canin"
            />
          </div>
        </form>
      </Modal>

      {/* Modal Riwayat Pembelian Pelanggan */}
      <Modal
        open={Boolean(historyCustomer)}
        onClose={() => setHistoryCustomer(null)}
        title={`Riwayat Pembelian — ${historyCustomer?.name || ''}`}
        size="lg"
      >
        {historyCustomer && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 10,
                background: 'var(--primary-soft)',
                marginBottom: 14,
              }}
            >
              <span>Total Piutang Aktif:</span>
              <strong className="text-danger">
                {formatRupiah(receivableByCustomer.get(historyCustomer.id) || 0)}
              </strong>
            </div>
            {customerSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                Belum ada riwayat pembelian untuk pelanggan ini.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. Transaksi</th>
                      <th>Tanggal</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Dibayar</th>
                      <th className="text-right">Sisa Piutang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerSales.map((s) => (
                      <tr key={s.id}>
                        <td className="font-bold text-primary">{s.invoice_number}</td>
                        <td>{formatDateTime(s.sale_date)}</td>
                        <td className="text-right font-bold">{formatRupiah(s.total_amount)}</td>
                        <td className="text-right">{formatRupiah(s.paid_amount)}</td>
                        <td className="text-right">
                          {s.remaining_debt > 0 ? (
                            <span className="badge badge-danger">
                              {formatRupiah(s.remaining_debt)}
                            </span>
                          ) : (
                            <span className="badge badge-success">Lunas</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
