import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { NavPage } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  buildDailySalesChart,
  buildMonthlySalesChart,
  calculateDashboardMetrics,
} from '../lib/finance';
import { formatDateTime, formatNumber, formatRupiah } from '../lib/format';

interface DashboardPageProps {
  onNavigate: (page: NavPage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { data, loadingData } = useApp();
  const { isOwner, canRecordExpense } = useAuth();
  const [chartTab, setChartTab] = useState<'daily' | 'monthly'>('daily');

  const metrics = useMemo(() => {
    if (!data) return null;
    return calculateDashboardMetrics(
      data.sales,
      data.sale_items,
      data.expenses,
      data.receivables,
      data.cash_transactions,
      data.products,
      data.store_settings
    );
  }, [data]);

  const dailyChart = useMemo(() => buildDailySalesChart(data?.sales || [], 14), [data]);
  const monthlyChart = useMemo(() => buildMonthlySalesChart(data?.sales || [], 6), [data]);

  if (loadingData && !data) {
    return <div className="card">Memuat data dashboard dari database...</div>;
  }

  if (!data || !metrics) {
    return <div className="card">Data belum tersedia.</div>;
  }

  const recentSales = data.sales.slice(0, 6);

  return (
    <div>
      {/* Quick Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Ringkasan operasional & keuangan real-time dari database
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => onNavigate('cashier')}
          >
            <ShoppingCart size={17} /> Buka Kasir
          </button>
          {(isOwner || canRecordExpense) && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('expenses')}
            >
              <Wallet size={16} /> Catat Pengeluaran
            </button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-top">
            <span className="kpi-label">Penjualan Hari Ini</span>
            <span className="kpi-icon light">
              <ShoppingCart size={18} />
            </span>
          </div>
          <div className="kpi-value">{formatRupiah(metrics.todaySalesTotal)}</div>
          <div className="kpi-sub">{metrics.todaySalesCount} transaksi hari ini</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Uang Masuk Hari Ini</span>
            <span className="kpi-icon">
              <ArrowDownCircle size={18} />
            </span>
          </div>
          <div className="kpi-value text-primary">{formatRupiah(metrics.todayCashIn)}</div>
          <div className="kpi-sub">Tunai, transfer & cicilan piutang</div>
        </div>

        {(isOwner || canRecordExpense) && (
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Pengeluaran Hari Ini</span>
              <span className="kpi-icon danger">
                <ArrowUpCircle size={18} />
              </span>
            </div>
            <div className="kpi-value text-danger">{formatRupiah(metrics.todayExpensesTotal)}</div>
            <div className="kpi-sub">Semua kategori pengeluaran</div>
          </div>
        )}

        {isOwner && (
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Saldo Kas Saat Ini</span>
              <span className="kpi-icon">
                <Wallet size={18} />
              </span>
            </div>
            <div className="kpi-value">{formatRupiah(metrics.currentCashBalance)}</div>
            <div className="kpi-sub">
              Saldo awal + kas masuk - kas keluar
            </div>
          </div>
        )}

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Piutang Pelanggan</span>
            <span className="kpi-icon accent">
              <BookOpen size={18} />
            </span>
          </div>
          <div className="kpi-value text-accent">{formatRupiah(metrics.totalReceivables)}</div>
          <div className="kpi-sub">{metrics.unpaidReceivablesCount} tagihan belum lunas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Jumlah Produk</span>
            <span className="kpi-icon">
              <Package size={18} />
            </span>
          </div>
          <div className="kpi-value">{formatNumber(metrics.totalProducts)}</div>
          <div className="kpi-sub">
            {metrics.lowStockProducts.length} produk stok menipis
          </div>
        </div>

        {isOwner && (
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">Laba Kotor Hari Ini</span>
              <span className="kpi-icon">
                <TrendingUp size={18} />
              </span>
            </div>
            <div className="kpi-value text-primary">{formatRupiah(metrics.todayGrossProfit)}</div>
            <div className="kpi-sub">
              Bulan ini: {formatRupiah(metrics.monthGrossProfit)}
            </div>
          </div>
        )}
      </div>

      {/* Grafik Penjualan + Stok Menipis */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Grafik Penjualan</h2>
            <div className="tabs-bar" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`tab-btn ${chartTab === 'daily' ? 'active' : ''}`}
                onClick={() => setChartTab('daily')}
              >
                Harian (14 Hari)
              </button>
              <button
                type="button"
                className={`tab-btn ${chartTab === 'monthly' ? 'active' : ''}`}
                onClick={() => setChartTab('monthly')}
              >
                Bulanan (6 Bulan)
              </button>
            </div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTab === 'daily' ? dailyChart : monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ece8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(v: number) =>
                    v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${v / 1000}rb` : `${v}`
                  }
                />
                <Tooltip
                  formatter={(value: unknown) => [formatRupiah(Number(value || 0)), 'Penjualan']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8e4', fontSize: 12.5 }}
                />
                <Bar
                  dataKey="total"
                  fill={chartTab === 'daily' ? '#14532d' : '#ea580c'}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Produk Stok Menipis */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <AlertTriangle size={18} color="var(--accent)" /> Produk Stok Menipis
            </h2>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('products')}
            >
              Kelola Stok
            </button>
          </div>
          {metrics.lowStockProducts.length === 0 ? (
            <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {metrics.totalProducts === 0
                ? 'Belum ada produk. Tambahkan produk di menu Produk & Stok.'
                : 'Semua stok produk dalam kondisi aman di atas batas minimum.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="text-right">Stok</th>
                    <th className="text-right">Min.</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.lowStockProducts.slice(0, 6).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-bold">{p.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.sku}</div>
                      </td>
                      <td className="text-right">
                        <span className="badge badge-danger">
                          {formatNumber(p.stock)} {p.unit}
                        </span>
                      </td>
                      <td className="text-right text-muted">
                        {formatNumber(p.min_stock)} {p.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Transaksi Terbaru */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Transaksi Terbaru</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate('transactions')}
          >
            Lihat Semua
          </button>
        </div>
        {recentSales.length === 0 ? (
          <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Belum ada transaksi penjualan tercatat. Mulai transaksi pertama di menu Kasir.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. Transaksi</th>
                  <th>Tanggal</th>
                  <th>Pelanggan</th>
                  <th>Kasir</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id}>
                    <td className="font-bold text-primary">{s.invoice_number}</td>
                    <td>{formatDateTime(s.sale_date)}</td>
                    <td>{s.customer_name || 'Umum'}</td>
                    <td>{s.cashier_name}</td>
                    <td className="text-right font-bold">{formatRupiah(s.total_amount)}</td>
                    <td>
                      {s.payment_status === 'paid' ? (
                        <span className="badge badge-success">Lunas</span>
                      ) : s.payment_status === 'partial' ? (
                        <span className="badge badge-warning">
                          Sebagian (Sisa {formatRupiah(s.remaining_debt)})
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          Piutang ({formatRupiah(s.remaining_debt)})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
