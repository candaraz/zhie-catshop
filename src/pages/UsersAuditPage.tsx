import React, { useState } from 'react';
import { Activity, Edit3, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import type { UserPermissions, UserProfile, UserRole } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { createUserAccount, updateUserAccount } from '../lib/dataService';
import { formatDateTime } from '../lib/format';
import { Modal } from '../components/Modal';

const DEFAULT_CASHIER_PERMS: UserPermissions = {
  can_view_cost_price: false,
  can_record_expense: false,
  can_manage_customers: true,
  can_receive_receivable_payment: true,
};

export const UsersAuditPage: React.FC = () => {
  const { data, refreshData, showToast } = useApp();
  const { user, mode } = useAuth();

  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'cashier' as UserRole,
    is_active: true,
    permissions: { ...DEFAULT_CASHIER_PERMS },
  });

  const openCreate = () => {
    setForm({
      full_name: '',
      email: '',
      password: '',
      role: 'cashier',
      is_active: true,
      permissions: { ...DEFAULT_CASHIER_PERMS },
    });
    setCreateOpen(true);
  };

  const openEdit = (u: UserProfile) => {
    setEditTarget(u);
    setForm({
      full_name: u.full_name,
      email: u.email,
      password: '',
      role: u.role,
      is_active: u.is_active,
      permissions: { ...DEFAULT_CASHIER_PERMS, ...u.permissions },
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.password.length < 6) {
      showToast('Kata sandi minimal 6 karakter.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createUserAccount(mode, user, {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        permissions: form.permissions,
      });
      showToast('Akun pengguna baru berhasil dibuat.');
      setCreateOpen(false);
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat akun pengguna.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editTarget) return;
    setSaving(true);
    try {
      await updateUserAccount(mode, user, editTarget.id, {
        full_name: form.full_name,
        role: form.role,
        is_active: form.is_active,
        permissions: form.permissions,
        new_password: form.password || undefined,
      });
      showToast('Data dan hak akses pengguna berhasil diperbarui.');
      setEditTarget(null);
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui pengguna.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (target: UserProfile) => {
    if (!user) return;
    try {
      await updateUserAccount(mode, user, target.id, {
        full_name: target.full_name,
        role: target.role,
        is_active: !target.is_active,
        permissions: target.permissions,
      });
      showToast(
        target.is_active ? `Akun ${target.full_name} dinonaktifkan.` : `Akun ${target.full_name} diaktifkan.`
      );
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengubah status akun.', 'error');
    }
  };

  return (
    <div>
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
            className={`tab-btn ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            <ShieldCheck size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Manajemen Pengguna ({data?.users.length || 0})
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'audit' ? 'active' : ''}`}
            onClick={() => setTab('audit')}
          >
            <Activity size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Riwayat Aktivitas / Audit Log ({data?.audit_logs.length || 0})
          </button>
        </div>

        {tab === 'users' && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={17} /> Tambah Karyawan / Akun
          </button>
        )}
      </div>

      {tab === 'users' ? (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama & Email</th>
                  <th>Peran (Role)</th>
                  <th>Hak Akses Kasir</th>
                  <th>Login Terakhir</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users || []).map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-bold">{u.full_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'owner' ? 'badge-success' : 'badge-info'}`}>
                        {u.role === 'owner' ? 'OWNER / PEMILIK' : 'KASIR / KARYAWAN'}
                      </span>
                    </td>
                    <td>
                      {u.role === 'owner' ? (
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          Akses penuh seluruh aplikasi
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {u.permissions?.can_view_cost_price && (
                            <span className="badge badge-neutral">Lihat Modal</span>
                          )}
                          {u.permissions?.can_record_expense && (
                            <span className="badge badge-neutral">Catat Pengeluaran</span>
                          )}
                          {u.permissions?.can_manage_customers && (
                            <span className="badge badge-neutral">Pelanggan</span>
                          )}
                          {u.permissions?.can_receive_receivable_payment && (
                            <span className="badge badge-neutral">Bayar Piutang</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{formatDateTime(u.last_login_at)}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => openEdit(u)}
                        >
                          <Edit3 size={14} /> Edit
                        </button>
                        {u.id !== user?.id && (
                          <button
                            type="button"
                            className={`btn btn-sm ${u.is_active ? 'btn-outline' : 'btn-primary'}`}
                            onClick={() => toggleActive(u)}
                            title={u.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                          >
                            {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          {(data?.audit_logs || []).length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
              Belum ada catatan aktivitas.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Pengguna</th>
                    <th>Aksi</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.audit_logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.created_at)}</td>
                      <td>
                        <div className="font-bold">{log.user_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user_role}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{log.action}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 340 }}>
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah / Edit Pengguna */}
      <Modal
        open={createOpen || Boolean(editTarget)}
        onClose={() => {
          setCreateOpen(false);
          setEditTarget(null);
        }}
        title={editTarget ? `Edit Pengguna — ${editTarget.full_name}` : 'Tambah Akun Karyawan / Pengguna'}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setCreateOpen(false);
                setEditTarget(null);
              }}
            >
              Batal
            </button>
            <button type="submit" form="user-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </>
        }
      >
        <form
          id="user-form"
          onSubmit={editTarget ? handleUpdate : handleCreate}
          className="form-grid"
        >
          <div className="form-group full">
            <label className="form-label">Nama Lengkap *</label>
            <input
              className="form-input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Email Login *</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={Boolean(editTarget)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {editTarget ? 'Kata Sandi Baru (Opsional)' : 'Kata Sandi (Min. 6 karakter) *'}
            </label>
            <input
              type="password"
              className="form-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editTarget}
              placeholder={editTarget ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Peran (Role)</label>
            <select
              className="form-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="cashier">Kasir / Karyawan</option>
              <option value="owner">Pemilik / Owner</option>
            </select>
          </div>

          {form.role === 'cashier' && (
            <div className="form-group full">
              <label className="form-label" style={{ marginBottom: 4 }}>
                Hak Akses Tambahan untuk Kasir (Diterapkan di Backend RLS)
              </label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.permissions.can_view_cost_price}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: { ...form.permissions, can_view_cost_price: e.target.checked },
                      })
                    }
                  />
                  <span>Izinkan melihat harga modal produk</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.permissions.can_record_expense}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: { ...form.permissions, can_record_expense: e.target.checked },
                      })
                    }
                  />
                  <span>Izinkan mencatat pengeluaran</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.permissions.can_manage_customers}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: { ...form.permissions, can_manage_customers: e.target.checked },
                      })
                    }
                  />
                  <span>Izinkan menambah & mengedit data pelanggan</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.permissions.can_receive_receivable_payment}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: {
                          ...form.permissions,
                          can_receive_receivable_payment: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>Izinkan menerima pembayaran piutang pelanggan</span>
                </label>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
