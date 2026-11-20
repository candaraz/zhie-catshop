import React, { useMemo, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { calculateFinancialSummary } from '../lib/finance';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRupiah,
  getExpenseTypeLabel,
  getPaymentMethodLabel,
  isWithinDateRange,
  toDateInputValue,
} from '../lib/format';
import { exportTableToExcel, exportTableToPdf } from '../lib/exportUtils';

type ReportTab =
  | 'daily'
  | 'monthly'
  | 'yearly'
  | 'expenses'
  | 'receivables'
  | 'stock'
  | 'gross_profit'
  | 'net_profit'
  | 'cashflow';

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: 'daily', label: 'Penjualan Harian' },
  { id: 'monthly', label: 'Penjualan Bulanan' },
  { id: 'yearly', label: 'Penjualan Tahunan' },
  { id: 'expenses', label: 'Pengeluaran' },
  { id: 'receivables', label: 'Piutang' },
  { id: 'stock', label: 'Stok Produk' },
  { id: 'gross_profit', label: 'Laba Kotor' },
  { id: 'net_profit', label: 'Laba Bersih' },
  { id: 'cashflow', label: 'Arus Kas' },
];

export const ReportsPage: React.FC = () => {
  const { data } = useApp();
  const today = toDateInputValue();
  const firstOfMonth = toDateInputValue(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [activeTab, setActiveTab] = useState<ReportTab>('net_profit');
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  const summary = useMemo(() => {
    if (!data) return null;
    return calculateFinancialSummary(
      data.sales,
      data.sale_items,
      data.expenses,
      data.cash_transactions,
      startDate,
      endDate
    );
  }, [data, startDate, endDate]);

  const periodSales = useMemo(
    () => (data?.sales || []).filter((s) => isWithinDateRange(s.sale_date, startDate, endDate)),
    [data?.sales, startDate, endDate]
  );

  const periodExpenses = useMemo(
    () =>
      (data?.expenses || []).filter((e) => isWithinDateRange(e.expense_date, startDate, endDate)),
    [data?.expenses, startDate, endDate]
  );

  const periodCash = useMemo(
    () =>
      (data?.cash_transactions || []).filter((c) =>
        isWithinDateRange(c.transaction_date, startDate, endDate)
      ),
    [data?.cash_transactions, startDate, endDate]
  );

  // Agregasi Harian, Bulanan, Tahunan
  const salesByPeriod = useMemo(() => {
    const map = new Map<string, { period: string; count: number; omzet: number; paid: number; debt: number }>();
    const source = activeTab === 'yearly' ? data?.sales || [] : periodSales;
    source.forEach((s) => {
      const d = new Date(s.sale_date);
      let key = '';
      if (activeTab === 'daily') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
      } else if (activeTab === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = `${d.getFullYear()}`;
      }
      const prev = map.get(key) || { period: key, count: 0, omzet: 0, paid: 0, debt: 0 };
      prev.count += 1;
      prev.omzet += s.total_amount;
      prev.paid += Math.min(s.paid_amount, s.total_amount);
      prev.debt += s.remaining_debt;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
  }, [activeTab, periodSales, data?.sales]);

  // Laba kotor per produk
  const grossProfitBySale = useMemo(() => {
    const itemsMap = new Map<string, number>();
    (data?.sale_items || []).forEach((i) => {
      itemsMap.set(i.sale_id, (itemsMap.get(i.sale_id) || 0) + i.cost_price * i.quantity);
    });
    return periodSales.map((s) => {
      const hpp = itemsMap.get(s.id) || 0;
      return {
        invoice: s.invoice_number,
        date: formatDateTime(s.sale_date),
        customer: s.customer_name || 'Umum',
        omzet: s.total_amount,
        hpp,
        grossProfit: s.total_amount - hpp,
      };
    });
  }, [periodSales, data?.sale_items]);

  if (!data || !summary) return <div className="card">Memuat laporan...</div>;

  const storeName = data.store_settings.store_name || 'Zhie Catshop';
  const periodLabel = `${formatDate(startDate)} s/d ${formatDate(endDate)}`;

  const handleExport = (format: 'pdf' | 'excel') => {
    const tabTitle = REPORT_TABS.find((t) => t.id === activeTab)?.label || 'Laporan';
    const filename = `ZhieCatshop-${activeTab}-${startDate}_${endDate}`;

    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let summaryLines: { label: string; value: string }[] = [];

    if (activeTab === 'daily' || activeTab === 'monthly' || activeTab === 'yearly') {
      headers = ['Periode', 'Jumlah Transaksi', 'Omzet', 'Diterima', 'Sisa Piutang'];
      rows = salesByPeriod.map((r) => [
        r.period,
        r.count,
        formatRupiah(r.omzet),
        formatRupiah(r.paid),
        formatRupiah(r.debt),
      ]);
      summaryLines = [
        { label: 'Total Omzet Periode', value: formatRupiah(summary.omzet) },
        { label: 'Jumlah Transaksi', value: String(summary.transactionCount) },
      ];
    } else if (activeTab === 'expenses') {
      headers = ['Tanggal', 'Kategori', 'Klasifikasi', 'Keterangan', 'Metode', 'Nominal'];
      rows = periodExpenses.map((e) => [
        formatDate(e.expense_date),
        e.category,
        getExpenseTypeLabel(e.expense_type),
        e.description,
        getPaymentMethodLabel(e.payment_method),
        formatRupiah(e.amount),
      ]);
      summaryLines = [
        { label: 'Pembelian Persediaan (Stok)', value: formatRupiah(summary.inventoryPurchases) },
        { label: 'Biaya Operasional', value: formatRupiah(summary.operationalExpenses) },
        { label: 'Pengambilan Pemilik (Pribadi)', value: formatRupiah(summary.ownerDrawings) },
        { label: 'Total Semua Pengeluaran', value: formatRupiah(summary.totalExpenses) },
      ];
    } else if (activeTab === 'receivables') {
      headers = ['Pelanggan', 'No. Transaksi', 'Tanggal', 'Total Tagihan', 'Dibayar', 'Sisa Utang', 'Status'];
      rows = data.receivables.map((r) => [
        r.customer_name || '-',
        r.invoice_number,
        formatDate(r.transaction_date),
        formatRupiah(r.total_amount),
        formatRupiah(r.paid_amount),
        formatRupiah(r.remaining_amount),
        r.status === 'paid' ? 'Lunas' : 'Belum Lunas',
      ]);
    } else if (activeTab === 'stock') {
      headers = ['SKU', 'Nama Produk', 'Merek', 'Stok', 'Min. Stok', 'Harga Modal', 'Harga Jual', 'Nilai Stok'];
      rows = data.products.map((p) => [
        p.sku,
        p.name,
        p.brand || '-',
        `${formatNumber(p.stock)} ${p.unit}`,
        formatNumber(p.min_stock),
        formatRupiah(p.cost_price || 0),
        formatRupiah(p.sell_price),
        formatRupiah((p.cost_price || 0) * p.stock),
      ]);
    } else if (activeTab === 'gross_profit') {
      headers = ['No. Transaksi', 'Tanggal', 'Pelanggan', 'Omzet', 'HPP (Modal)', 'Laba Kotor'];
      rows = grossProfitBySale.map((g) => [
        g.invoice,
        g.date,
        g.customer,
        formatRupiah(g.omzet),
        formatRupiah(g.hpp),
        formatRupiah(g.grossProfit),
      ]);
      summaryLines = [
        { label: 'Total Omzet', value: formatRupiah(summary.omzet) },
        { label: 'Total HPP (Modal Barang Terjual)', value: formatRupiah(summary.hpp) },
        { label: 'Laba Kotor', value: formatRupiah(summary.grossProfit) },
      ];
    } else if (activeTab === 'net_profit') {
      headers = ['Komponen Laba Rugi', 'Nominal'];
      rows = [
        ['Omzet (Total Penjualan)', formatRupiah(summary.omzet)],
        ['Harga Pokok Penjualan (HPP / Modal Barang Terjual)', `-${formatRupiah(summary.hpp)}`],
        ['LABA KOTOR (Omzet - HPP)', formatRupiah(summary.grossProfit)],
        ['Biaya Operasional Usaha', `-${formatRupiah(summary.operationalExpenses)}`],
        ['LABA BERSIH USAHA', formatRupiah(summary.netProfit)],
        ['--- Catatan Terpisah (Bukan Biaya Operasional) ---', ''],
        ['Pengambilan Pemilik / Pengeluaran Pribadi (Prive)', formatRupiah(summary.ownerDrawings)],
        ['Pembelian Persediaan / Stok (Hanya di Arus Kas)', formatRupiah(summary.inventoryPurchases)],
      ];
    } else {
      headers = ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Metode', 'Nominal'];
      rows = periodCash.map((c) => [
        formatDateTime(c.transaction_date),
        c.type === 'in' ? 'Kas Masuk' : 'Kas Keluar',
        c.category,
        c.description,
        getPaymentMethodLabel(c.payment_method),
        formatRupiah(c.type === 'in' ? c.amount : -c.amount),
      ]);
      summaryLines = [
        { label: 'Total Kas Masuk (Uang Nyata Diterima)', value: formatRupiah(summary.cashIn) },
        { label: 'Total Kas Keluar (Semua Pengeluaran)', value: formatRupiah(summary.cashOut) },
        { label: 'Arus Kas Bersih Periode', value: formatRupiah(summary.netCashFlow) },
        {
          label: 'Piutang Baru Belum Dibayar (Bukan Uang Tunai)',
          value: formatRupiah(summary.unpaidReceivablesCreated),
        },
      ];
    }

    if (format === 'pdf') {
      exportTableToPdf({
        title: `Laporan ${tabTitle}`,
        subtitle: periodLabel,
        storeName,
        headers,
        rows,
        summaryLines,
        filename,
      });
    } else {
      exportTableToExcel({
        sheetName: tabTitle,
        headers,
        rows,
        summaryRows: summaryLines.map((s) => [s.label, s.value]),
        filename,
      });
    }
  };

  return (
    <div>
      {/* Filter Tanggal & Ekspor */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Dari Tanggal</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sampai Tanggal</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={() => handleExport('pdf')}>
              <Download size={16} /> Ekspor PDF
            </button>
            <button type="button" className="btn btn-primary" onClick={() => handleExport('excel')}>
              <FileSpreadsheet size={16} /> Ekspor Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabs 9 Laporan */}
      <div className="tabs-bar">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Konten Laporan */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <BarChart3 size={18} color="var(--primary)" /> Laporan{' '}
            {REPORT_TABS.find((t) => t.id === activeTab)?.label}
          </h2>
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            Periode: {periodLabel}
          </span>
        </div>

        {/* 1-3: Penjualan Harian / Bulanan / Tahunan */}
        {(activeTab === 'daily' || activeTab === 'monthly' || activeTab === 'yearly') && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th className="text-center">Jumlah Transaksi</th>
                  <th className="text-right">Omzet (Total Penjualan)</th>
                  <th className="text-right">Uang Diterima</th>
                  <th className="text-right">Sisa Piutang</th>
                </tr>
              </thead>
              <tbody>
                {salesByPeriod.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted" style={{ padding: 28 }}>
                      Belum ada data penjualan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  salesByPeriod.map((r) => (
                    <tr key={r.period}>
                      <td className="font-bold">{r.period}</td>
                      <td className="text-center">{r.count}</td>
                      <td className="text-right font-bold">{formatRupiah(r.omzet)}</td>
                      <td className="text-right text-primary">{formatRupiah(r.paid)}</td>
                      <td className="text-right text-danger">{formatRupiah(r.debt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4: Pengeluaran */}
        {activeTab === 'expenses' && (
          <div>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <div className="kpi-card">
                <div className="kpi-label">Pembelian Stok</div>
                <div className="kpi-value text-primary">{formatRupiah(summary.inventoryPurchases)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Biaya Operasional</div>
                <div className="kpi-value">{formatRupiah(summary.operationalExpenses)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Pengambilan Pemilik (Pribadi)</div>
                <div className="kpi-value text-accent">{formatRupiah(summary.ownerDrawings)}</div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kategori</th>
                    <th>Klasifikasi</th>
                    <th>Keterangan</th>
                    <th className="text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {periodExpenses.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDate(e.expense_date)}</td>
                      <td className="font-bold">{e.category}</td>
                      <td>{getExpenseTypeLabel(e.expense_type)}</td>
                      <td>{e.description}</td>
                      <td className="text-right font-bold text-danger">{formatRupiah(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5: Piutang */}
        {activeTab === 'receivables' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>No. Transaksi</th>
                  <th>Tanggal</th>
                  <th className="text-right">Total Tagihan</th>
                  <th className="text-right">Dibayar</th>
                  <th className="text-right">Sisa Utang</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.receivables.map((r) => (
                  <tr key={r.id}>
                    <td className="font-bold">{r.customer_name}</td>
                    <td>{r.invoice_number}</td>
                    <td>{formatDate(r.transaction_date)}</td>
                    <td className="text-right">{formatRupiah(r.total_amount)}</td>
                    <td className="text-right text-primary">{formatRupiah(r.paid_amount)}</td>
                    <td className="text-right font-bold text-danger">
                      {formatRupiah(r.remaining_amount)}
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                        {r.status === 'paid' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6: Stok */}
        {activeTab === 'stock' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produk</th>
                  <th className="text-right">Stok</th>
                  <th className="text-right">Harga Modal</th>
                  <th className="text-right">Harga Jual</th>
                  <th className="text-right">Estimasi Nilai Modal</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td className="font-bold">{p.name}</td>
                    <td className="text-right">
                      <span className={`badge ${p.stock <= p.min_stock ? 'badge-danger' : 'badge-success'}`}>
                        {formatNumber(p.stock)} {p.unit}
                      </span>
                    </td>
                    <td className="text-right">{formatRupiah(p.cost_price || 0)}</td>
                    <td className="text-right">{formatRupiah(p.sell_price)}</td>
                    <td className="text-right font-bold">
                      {formatRupiah((p.cost_price || 0) * p.stock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 7: Laba Kotor */}
        {activeTab === 'gross_profit' && (
          <div>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <div className="kpi-card">
                <div className="kpi-label">Omzet Penjualan</div>
                <div className="kpi-value">{formatRupiah(summary.omzet)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">HPP (Modal Barang Terjual)</div>
                <div className="kpi-value text-danger">{formatRupiah(summary.hpp)}</div>
              </div>
              <div className="kpi-card highlight">
                <div className="kpi-label">Laba Kotor (Omzet - HPP)</div>
                <div className="kpi-value">{formatRupiah(summary.grossProfit)}</div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No. Transaksi</th>
                    <th>Tanggal</th>
                    <th>Pelanggan</th>
                    <th className="text-right">Omzet</th>
                    <th className="text-right">HPP</th>
                    <th className="text-right">Laba Kotor</th>
                  </tr>
                </thead>
                <tbody>
                  {grossProfitBySale.map((g) => (
                    <tr key={g.invoice}>
                      <td className="font-bold text-primary">{g.invoice}</td>
                      <td>{g.date}</td>
                      <td>{g.customer}</td>
                      <td className="text-right">{formatRupiah(g.omzet)}</td>
                      <td className="text-right text-muted">{formatRupiah(g.hpp)}</td>
                      <td className="text-right font-bold text-primary">
                        {formatRupiah(g.grossProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8: Laba Bersih */}
        {activeTab === 'net_profit' && (
          <div style={{ maxWidth: 680 }}>
            <table className="data-table">
              <tbody>
                <tr>
                  <td className="font-bold">Omzet (Total Penjualan)</td>
                  <td className="text-right font-bold">{formatRupiah(summary.omzet)}</td>
                </tr>
                <tr>
                  <td>Dikurangi: Harga Modal Barang Terjual (HPP)</td>
                  <td className="text-right text-danger">-{formatRupiah(summary.hpp)}</td>
                </tr>
                <tr style={{ background: 'var(--primary-soft)' }}>
                  <td className="font-bold text-primary">LABA KOTOR</td>
                  <td className="text-right font-bold text-primary">
                    {formatRupiah(summary.grossProfit)}
                  </td>
                </tr>
                <tr>
                  <td>Dikurangi: Biaya Operasional Usaha</td>
                  <td className="text-right text-danger">
                    -{formatRupiah(summary.operationalExpenses)}
                  </td>
                </tr>
                <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                  <td className="font-bold" style={{ fontSize: 15 }}>
                    LABA BERSIH USAHA
                  </td>
                  <td className="text-right font-bold" style={{ fontSize: 16 }}>
                    {formatRupiah(summary.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="alert-box alert-warning" style={{ marginTop: 18, flexDirection: 'column', gap: 6 }}>
              <strong>Pos Terpisah (Tidak Mengurangi Laba Bersih Usaha):</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>Pengambilan Pemilik / Pengeluaran Pribadi (Prive):</span>
                <strong>{formatRupiah(summary.ownerDrawings)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>Pembelian Persediaan / Stok (Sudah dihitung saat barang terjual via HPP):</span>
                <strong>{formatRupiah(summary.inventoryPurchases)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* 9: Arus Kas */}
        {activeTab === 'cashflow' && (
          <div>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Kas Masuk (Uang Nyata)</div>
                <div className="kpi-value text-primary">{formatRupiah(summary.cashIn)}</div>
                <div className="kpi-sub">Penjualan tunai/transfer + cicilan</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Kas Keluar (Semua Pengeluaran)</div>
                <div className="kpi-value text-danger">{formatRupiah(summary.cashOut)}</div>
                <div className="kpi-sub">Stok + Operasional + Pribadi</div>
              </div>
              <div className="kpi-card highlight">
                <div className="kpi-label">Arus Kas Bersih Periode</div>
                <div className="kpi-value">{formatRupiah(summary.netCashFlow)}</div>
                <div className="kpi-sub">Kas Masuk - Kas Keluar</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Piutang Baru (Belum Masuk Kas)</div>
                <div className="kpi-value text-accent">
                  {formatRupiah(summary.unpaidReceivablesCreated)}
                </div>
                <div className="kpi-sub">Tidak dihitung uang tunai</div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Kategori</th>
                    <th>Keterangan</th>
                    <th>Metode</th>
                    <th className="text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {periodCash.map((c) => (
                    <tr key={c.id}>
                      <td>{formatDateTime(c.transaction_date)}</td>
                      <td>
                        <span className={`badge ${c.type === 'in' ? 'badge-success' : 'badge-danger'}`}>
                          {c.type === 'in' ? 'Kas Masuk' : 'Kas Keluar'}
                        </span>
                      </td>
                      <td>{c.category}</td>
                      <td>{c.description}</td>
                      <td>{getPaymentMethodLabel(c.payment_method)}</td>
                      <td
                        className={`text-right font-bold ${
                          c.type === 'in' ? 'text-primary' : 'text-danger'
                        }`}
                      >
                        {c.type === 'in' ? '+' : '-'}
                        {formatRupiah(c.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
