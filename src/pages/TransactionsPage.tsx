import React, { useMemo, useState } from 'react';
import { Eye, History, Printer, Search } from 'lucide-react';
import type { Sale } from '../types';
import { useApp } from '../contexts/AppContext';
import {
  formatDateTime,
  formatRupiah,
  getPaymentMethodLabel,
  isWithinDateRange,
  toDateInputValue,
} from '../lib/format';
import { Modal } from '../components/Modal';
import { SaleReceiptModal } from '../components/ReceiptModal';

export const TransactionsPage: React.FC = () => {
  const { data } = useApp();

  const today = toDateInputValue();
  const monthStart = toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  const itemsBySale = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['sale_items']>();
    (data?.sale_items || []).forEach((item) => {
      const list = map.get(item.sale_id) || [];
      list.push(item);
      map.set(item.sale_id, list);
    });
    return map;
  }, [data?.sale_items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.sales || []).filter((s) => {
      if (startDate && endDate && !isWithinDateRange(s.sale_date, startDate, endDate)) {
        return false;
      }
      if (!q) return true;
      const items = itemsBySale.get(s.id) || [];
      return (
        s.invoice_number.toLowerCase().includes(q) ||
        (s.customer_name || '').toLowerCase().includes(q) ||
        s.cashier_name.toLowerCase().includes(q) ||
        items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    });
  }, [data?.sales, search, startDate, endDate, itemsBySale]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <History size={18} color="var(--primary)" /> Riwayat Transaksi ({filtered.length})
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="search-box">
            <Search size={16} />
            <input
              className="form-input"
              placeholder="Cari no. transaksi, pelanggan, kasir, atau nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tidak ada transaksi pada rentang tanggal ini.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. Transaksi</th>
                  <th>Tanggal & Waktu</th>
                  <th>Pelanggan & Kasir</th>
                  <th>Produk</th>
                  <th className="text-right">Total Belanja</th>
                  <th className="text-right">Dibayar</th>
                  <th className="text-right">Sisa Piutang</th>
                  <th>Metode</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const items = itemsBySale.get(s.id) || [];
                  return (
                    <tr key={s.id}>
                      <td className="font-bold text-primary">{s.invoice_number}</td>
                      <td>{formatDateTime(s.sale_date)}</td>
                      <td>
                        <div className="font-bold">{s.customer_name || 'Umum'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          Kasir: {s.cashier_name}
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: 220, fontSize: 12.5 }}>
                          {items.slice(0, 2).map((i) => (
                            <div key={i.id}>
                              {i.product_name} ({i.quantity} {i.unit})
                            </div>
                          ))}
                          {items.length > 2 && (
                            <span className="text-muted">+{items.length - 2} produk lainnya</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right font-bold">{formatRupiah(s.total_amount)}</td>
                      <td className="text-right text-primary">{formatRupiah(s.paid_amount)}</td>
                      <td className="text-right">
                        {s.remaining_debt > 0 ? (
                          <span className="badge badge-danger">
                            {formatRupiah(s.remaining_debt)}
                          </span>
                        ) : (
                          <span className="badge badge-success">Lunas</span>
                        )}
                      </td>
                      <td>{getPaymentMethodLabel(s.payment_method)}</td>
                      <td className="text-right">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm btn-icon"
                            title="Detail Transaksi"
                            onClick={() => setDetailSale(s)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm btn-icon"
                            title="Cetak Struk"
                            onClick={() => setReceiptSale(s)}
                          >
                            <Printer size={14} />
                          </button>
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

      {/* Modal Detail Transaksi */}
      <Modal
        open={Boolean(detailSale)}
        onClose={() => setDetailSale(null)}
        title={`Detail Transaksi — ${detailSale?.invoice_number || ''}`}
        size="lg"
      >
        {detailSale && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                padding: 12,
                borderRadius: 10,
                background: 'var(--surface-subtle)',
              }}
            >
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Tanggal & Waktu
                </div>
                <div className="font-bold">{formatDateTime(detailSale.sale_date)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Kasir Pembuat
                </div>
                <div className="font-bold">{detailSale.cashier_name}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Pelanggan
                </div>
                <div className="font-bold">{detailSale.customer_name || 'Umum'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Metode Pembayaran
                </div>
                <div className="font-bold">{getPaymentMethodLabel(detailSale.payment_method)}</div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Harga Satuan</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(itemsBySale.get(detailSale.id) || []).map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.product_name}
                        {i.price_overridden && (
                          <span className="badge badge-warning" style={{ marginLeft: 6 }}>
                            Harga diubah
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        {i.quantity} {i.unit}
                      </td>
                      <td className="text-right">{formatRupiah(i.unit_price)}</td>
                      <td className="text-right font-bold">{formatRupiah(i.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <div>Subtotal: {formatRupiah(detailSale.subtotal)}</div>
              {detailSale.discount > 0 && <div>Diskon: -{formatRupiah(detailSale.discount)}</div>}
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>
                Total: {formatRupiah(detailSale.total_amount)}
              </div>
              <div>Dibayar: {formatRupiah(detailSale.paid_amount)}</div>
              {detailSale.change_amount > 0 && (
                <div>Kembalian: {formatRupiah(detailSale.change_amount)}</div>
              )}
              {detailSale.remaining_debt > 0 && (
                <div className="text-danger font-bold">
                  Sisa Piutang: {formatRupiah(detailSale.remaining_debt)}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {data && (
        <SaleReceiptModal
          open={Boolean(receiptSale)}
          onClose={() => setReceiptSale(null)}
          sale={receiptSale}
          items={receiptSale ? itemsBySale.get(receiptSale.id) || [] : []}
          settings={data.store_settings}
        />
      )}
    </div>
  );
};
