import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Download,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { NavPage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

interface LayoutProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: NavPage;
  label: string;
  icon: React.ReactNode;
  section: 'utama' | 'operasional' | 'manajemen';
  visible: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ currentPage, onNavigate, children }) => {
  const { user, mode, isOwner, canRecordExpense, logout } = useAuth();
  const { data, isOnline, loadingData, refreshData, canInstallPwa, installPwa, toasts, dismissToast } =
    useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  const storeName = data?.store_settings?.store_name || 'Zhie Catshop';
  const logoUrl = data?.store_settings?.logo_url || '/logo.png';

  const allNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={19} />,
      section: 'utama',
      visible: true,
    },
    {
      id: 'cashier',
      label: 'Kasir',
      icon: <ShoppingCart size={19} />,
      section: 'utama',
      visible: true,
    },
    {
      id: 'products',
      label: 'Produk & Stok',
      icon: <Package size={19} />,
      section: 'operasional',
      visible: true,
    },
    {
      id: 'customers',
      label: 'Pelanggan',
      icon: <Users size={19} />,
      section: 'operasional',
      visible: true,
    },
    {
      id: 'receivables',
      label: 'Piutang',
      icon: <BookOpen size={19} />,
      section: 'operasional',
      visible: true,
    },
    {
      id: 'expenses',
      label: 'Pengeluaran',
      icon: <Wallet size={19} />,
      section: 'operasional',
      visible: isOwner || canRecordExpense,
    },
    {
      id: 'transactions',
      label: 'Riwayat Transaksi',
      icon: <History size={19} />,
      section: 'operasional',
      visible: true,
    },
    {
      id: 'reports',
      label: 'Laporan Keuangan',
      icon: <BarChart3 size={19} />,
      section: 'manajemen',
      visible: isOwner,
    },
    {
      id: 'users',
      label: 'Pengguna & Audit',
      icon: <ShieldCheck size={19} />,
      section: 'manajemen',
      visible: isOwner,
    },
    {
      id: 'settings',
      label: 'Pengaturan Toko',
      icon: <Settings size={19} />,
      section: 'manajemen',
      visible: isOwner,
    },
  ];
  const navItems = allNavItems.filter((item) => item.visible);

  const activeTitle = navItems.find((i) => i.id === currentPage)?.label || 'Dashboard';

  const handleSelectPage = (page: NavPage) => {
    onNavigate(page);
    setMoreOpen(false);
  };

  return (
    <div className="app-shell">
      {/* Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item ${t.type}`}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ minWidth: 24, minHeight: 24, padding: 2 }}
              onClick={() => dismissToast(t.id)}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoUrl} alt={storeName} className="sidebar-logo" />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-brand-title">{storeName}</div>
            <div className="sidebar-brand-sub">POS & Manajemen Keuangan</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navigasi Utama">
          <div className="nav-section-label">Utama</div>
          {navItems
            .filter((i) => i.section === 'utama')
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => handleSelectPage(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

          <div className="nav-section-label">Operasional</div>
          {navItems
            .filter((i) => i.section === 'operasional')
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => handleSelectPage(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

          {navItems.some((i) => i.section === 'manajemen') && (
            <>
              <div className="nav-section-label">Manajemen Pemilik</div>
              {navItems
                .filter((i) => i.section === 'manajemen')
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
                    onClick={() => handleSelectPage(item.id)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">
              {(user?.full_name || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.full_name}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                {isOwner ? 'Pemilik (Owner)' : 'Kasir (Karyawan)'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-block"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
            onClick={logout}
          >
            <LogOut size={15} /> Keluar Akun
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">{activeTitle}</h1>
          </div>

          <div className="topbar-right">
            {mode === 'local' ? (
              <span
                className="conn-pill local"
                title="Data tersimpan di perangkat ini (Mode Uji Lokal). Hubungkan Supabase untuk sinkronisasi cloud."
              >
                <Wifi size={14} /> Mode Lokal
              </span>
            ) : isOnline ? (
              <span className="conn-pill online" title="Terhubung ke server Supabase">
                <Wifi size={14} /> Online
              </span>
            ) : (
              <span
                className="conn-pill offline"
                title="Koneksi internet terputus. Transaksi tidak tersimpan ke server."
              >
                <WifiOff size={14} /> Offline
              </span>
            )}

            {canInstallPwa && (
              <button type="button" className="btn btn-accent btn-sm" onClick={installPwa}>
                <Download size={15} /> Pasang Aplikasi
              </button>
            )}

            <button
              type="button"
              className="btn btn-outline btn-icon"
              onClick={refreshData}
              disabled={loadingData}
              title="Muat ulang data"
            >
              <RefreshCw size={16} className={loadingData ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {!isOnline && mode === 'supabase' && (
          <div style={{ padding: '12px 24px 0' }}>
            <div className="alert-box alert-danger" style={{ marginBottom: 0 }}>
              <WifiOff size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Koneksi Internet Terputus!</strong> Aplikasi tidak dapat menyimpan transaksi
                baru ke server Supabase saat offline. Sambungkan internet sebelum melanjutkan
                transaksi.
              </div>
            </div>
          </div>
        )}

        <main className="page-content">{children}</main>
      </div>

      {/* Mobile Bottom Navigation (Nyaman satu tangan) */}
      <nav className="bottom-nav" aria-label="Navigasi Bawah HP">
        <button
          type="button"
          className={`bottom-nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleSelectPage('dashboard')}
        >
          <span className="bnav-icon-wrap">
            <LayoutDashboard size={19} />
          </span>
          <span>Beranda</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-btn ${currentPage === 'products' ? 'active' : ''}`}
          onClick={() => handleSelectPage('products')}
        >
          <span className="bnav-icon-wrap">
            <Package size={19} />
          </span>
          <span>Produk</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-btn pos-cta ${currentPage === 'cashier' ? 'active' : ''}`}
          onClick={() => handleSelectPage('cashier')}
        >
          <span className="bnav-icon-wrap">
            <ShoppingCart size={20} />
          </span>
          <span style={{ color: currentPage === 'cashier' ? 'var(--accent)' : undefined }}>
            Kasir
          </span>
        </button>

        <button
          type="button"
          className={`bottom-nav-btn ${currentPage === 'receivables' ? 'active' : ''}`}
          onClick={() => handleSelectPage('receivables')}
        >
          <span className="bnav-icon-wrap">
            <BookOpen size={19} />
          </span>
          <span>Piutang</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-btn ${moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(true)}
        >
          <span className="bnav-icon-wrap">
            <Menu size={19} />
          </span>
          <span>Menu</span>
        </button>
      </nav>

      {/* Mobile More Drawer */}
      {moreOpen && (
        <div className="modal-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={logoUrl}
                  alt={storeName}
                  style={{ width: 34, height: 34, borderRadius: 8 }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{storeName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {user?.full_name} ({isOwner ? 'Pemilik' : 'Kasir'})
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setMoreOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`btn ${currentPage === item.id ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
                  onClick={() => handleSelectPage(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-danger btn-block" onClick={logout}>
                <LogOut size={16} /> Keluar dari Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
