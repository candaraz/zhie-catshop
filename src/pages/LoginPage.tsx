import React, { useState } from 'react';
import { Database, Eye, EyeOff, KeyRound, Lock, Mail, Settings2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  clearSupabaseConfig,
  getSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseConfig,
} from '../lib/supabase';
import { Modal } from '../components/Modal';

export const LoginPage: React.FC = () => {
  const { login, mode, switchMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [configOpen, setConfigOpen] = useState(false);
  const currentCfg = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(currentCfg.url);
  const [sbKey, setSbKey] = useState(currentCfg.anonKey);
  const [cfgSaved, setCfgSaved] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke aplikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim().startsWith('http') || !sbKey.trim()) {
      setError('Masukkan URL Supabase (https://...) dan Anon Key yang valid.');
      return;
    }
    saveSupabaseConfig(sbUrl, sbKey);
    switchMode('supabase');
    setCfgSaved(true);
    setConfigOpen(false);
    setError(null);
  };

  const quickFill = (role: 'owner' | 'cashier') => {
    switchMode('local');
    if (role === 'owner') {
      setEmail('owner@zhiecatshop.id');
      setPassword('owner123');
    } else {
      setEmail('kasir@zhiecatshop.id');
      setPassword('kasir123');
    }
    setError(null);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img
            src="/logo.png"
            alt="Zhie Catshop"
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              marginBottom: 12,
              boxShadow: '0 8px 20px rgba(20, 83, 45, 0.22)',
            }}
          />
          <h1 style={{ margin: '0 0 4px', fontSize: 23, fontWeight: 800, color: 'var(--primary)' }}>
            Zhie Catshop
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Aplikasi Kasir & Manajemen Keuangan Toko Makanan Kucing
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="tabs-bar" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`tab-btn ${mode === 'supabase' ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => {
              switchMode('supabase');
              setError(null);
            }}
          >
            Server Supabase
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'local' ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => {
              switchMode('local');
              setError(null);
            }}
          >
            Mode Uji Lokal
          </button>
        </div>

        {mode === 'supabase' && !supabaseReady && (
          <div className="alert-box alert-warning" style={{ flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <ShieldAlert size={18} /> Kredensial Supabase Belum Diisi
            </div>
            <div style={{ fontSize: 12.5 }}>
              Masukkan <strong>Supabase URL</strong> dan <strong>Anon Key</strong> proyek Anda
              (atau isi di file <code>.env</code>) untuk sinkronisasi cloud multi-perangkat.
            </div>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setConfigOpen(true)}
            >
              <Settings2 size={15} /> Atur Kredensial Supabase
            </button>
          </div>
        )}

        {cfgSaved && mode === 'supabase' && supabaseReady && (
          <div className="alert-box alert-info" style={{ fontSize: 12.5 }}>
            Koneksi Supabase tersimpan. Masuk menggunakan akun email & password Supabase Auth Anda.
          </div>
        )}

        {error && (
          <div className="alert-box alert-danger" style={{ fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Pengguna
            </label>
            <div className="search-box">
              <Mail size={16} />
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="nama@zhiecatshop.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Kata Sandi
            </label>
            <div style={{ position: 'relative' }}>
              <div className="search-box">
                <Lock size={16} />
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: 42 }}
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ position: 'absolute', right: 4, top: 3 }}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                title={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPw ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 4, minHeight: 46, fontSize: 15 }}
            disabled={submitting || (mode === 'supabase' && !supabaseReady)}
          >
            {submitting ? 'Memproses Masuk...' : 'Masuk ke Zhie Catshop'}
          </button>
        </form>

        {mode === 'supabase' && supabaseReady && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfigOpen(true)}
            >
              <Database size={14} /> Ubah Koneksi Supabase
            </button>
          </div>
        )}

        {mode === 'local' && (
          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 12,
              background: 'var(--primary-soft)',
              border: '1px solid #cce3d5',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
              Akun Uji Lokal Multi-User (klik untuk isi cepat):
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ flex: 1 }}
                onClick={() => quickFill('owner')}
              >
                <KeyRound size={14} /> Pemilik (Owner)
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ flex: 1 }}
                onClick={() => quickFill('cashier')}
              >
                <KeyRound size={14} /> Kasir (Karyawan)
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
              Data uji lokal disimpan di browser Anda dan 100% dihitung dari transaksi nyata (mulai
              dari Rp 0).
            </div>
          </div>
        )}
      </div>

      {/* Modal Konfigurasi Supabase */}
      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Konfigurasi Koneksi Supabase"
        footer={
          <>
            {supabaseReady && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  clearSupabaseConfig();
                  setSbUrl('');
                  setSbKey('');
                  setConfigOpen(false);
                }}
              >
                Hapus Kredensial
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={() => setConfigOpen(false)}>
              Batal
            </button>
            <button type="submit" form="sb-config-form" className="btn btn-primary">
              Simpan Koneksi
            </button>
          </>
        }
      >
        <form id="sb-config-form" onSubmit={handleSaveSupabase} className="form-grid">
          <div className="form-group full">
            <div className="alert-box alert-info" style={{ marginBottom: 4, fontSize: 12.5 }}>
              Hanya masukkan <strong>Project URL</strong> dan <strong>Anon (Public) Key</strong>.
              Jangan pernah memasukkan <code>service_role</code> key di frontend. Pastikan file{' '}
              <code>supabase/schema.sql</code> sudah dijalankan di SQL Editor Supabase.
            </div>
          </div>
          <div className="form-group full">
            <label className="form-label">Supabase Project URL</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://xxxxxxxx.supabase.co"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              required
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Supabase Anon (Public) Key</label>
            <textarea
              className="form-textarea"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
