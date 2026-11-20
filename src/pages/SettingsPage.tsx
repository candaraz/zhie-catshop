import React, { useEffect, useState } from 'react';
import { Database, Download, Save, Settings, Upload } from 'lucide-react';
import type { StoreSettings } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  exportBackupJson,
  restoreLocalBackupJson,
  saveStoreSettings,
} from '../lib/dataService';

export const SettingsPage: React.FC = () => {
  const { data, refreshData, showToast } = useApp();
  const { user, mode } = useAuth();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<StoreSettings>({
    id: '',
    store_name: 'Zhie Catshop',
    address: '',
    phone: '',
    logo_url: '/logo.png',
    initial_cash_balance: 0,
    receipt_header: '',
    receipt_footer: '',
    owner_name: '',
    owner_phone: '',
    updated_at: '',
  });

  useEffect(() => {
    if (data?.store_settings) {
      setForm(data.store_settings);
    }
  }, [data?.store_settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showToast('Ukuran logo maksimal 1MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, logo_url: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.store_name.trim()) {
      showToast('Nama toko wajib diisi.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveStoreSettings(mode, user, form);
      showToast('Pengaturan toko berhasil disimpan.');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!data) return;
    const json = exportBackupJson(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cadangan-ZhieCatshop-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File cadangan data (JSON) berhasil diunduh.');
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mode !== 'local') {
      showToast(
        'Pemulihan langsung di browser hanya untuk Mode Uji Lokal. Untuk Supabase, gunakan backup SQL di dashboard Supabase.',
        'warning'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        restoreLocalBackupJson(String(reader.result));
        await refreshData();
        showToast('Data cadangan berhasil dipulihkan!');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'File cadangan tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <form onSubmit={handleSave} className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Settings size={18} color="var(--primary)" /> Profil & Pengaturan Toko
          </h2>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nama Toko (Bisa diubah kapan saja) *</label>
            <input
              className="form-input"
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nomor Telepon Toko</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Alamat Toko</label>
            <textarea
              className="form-textarea"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Alamat lengkap toko untuk ditampilkan pada struk..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Saldo Awal Kas (Rp)</label>
            <input
              type="number"
              className="form-input"
              value={form.initial_cash_balance}
              onChange={(e) =>
                setForm({ ...form, initial_cash_balance: Number(e.target.value || 0) })
              }
            />
            <span className="form-hint">
              Digunakan sebagai dasar perhitungan Saldo Kas Saat Ini di Dashboard.
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Logo Toko (Opsional, maks 1MB)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={form.logo_url || '/logo.png'}
                alt="Logo Toko"
                style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover' }}
              />
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Header Struk</label>
            <input
              className="form-input"
              value={form.receipt_header}
              onChange={(e) => setForm({ ...form, receipt_header: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Footer Struk</label>
            <input
              className="form-input"
              value={form.receipt_footer}
              onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nama Pemilik Toko</label>
            <input
              className="form-input"
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nomor Kontak Pemilik</label>
            <input
              className="form-input"
              value={form.owner_phone}
              onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
            />
          </div>
        </div>
      </form>

      {/* Pencadangan Data */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Database size={18} color="var(--primary)" /> Pencadangan & Pemulihan Data
          </h2>
        </div>
        <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: 13.5 }}>
          Unduh seluruh data toko (produk, pelanggan, penjualan, piutang, pengeluaran, arus kas, dan
          pengaturan) ke dalam file JSON sebagai cadangan berkala.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={handleDownloadBackup}>
            <Download size={16} /> Unduh Cadangan Data (.json)
          </button>
          {mode === 'local' && (
            <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> Pulihkan dari File Cadangan
              <input
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={handleRestoreBackup}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
};
