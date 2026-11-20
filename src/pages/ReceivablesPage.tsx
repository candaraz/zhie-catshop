import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Eye, History, PlusCircle, Printer, Search } from 'lucide-react';
import type { CashPaymentMethod, Payment, Receivable } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { recordReceivablePayment } from '../lib/dataService';
import {
  formatDate,
  formatDateTime,
  formatRupiah,
  generateUUID,
  getPaymentMethodLabel,
} from '../lib/format';
import { Modal } from '../components/Modal';
import { PaymentReceiptModal } from '../components/ReceiptModal';

export const ReceivablesPage: React.FC = () => {
  const { data, refreshData, showToast } = useApp();
  const { user, mode, canReceiveReceivablePayment } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  // Modal Tambah Pembayaran
  const [payTarget, setPayTarget] = useState<Receivable | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<CashPaymentMethod>('tunai');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  // Modal Riwayat & Detail
  const [detailTarget, setDetailTarget] = useState<Receivable | null>(null);

  // Modal Cetak Bukti Bayar
  const [receiptData, setReceiptData] = useState<{ rec: Receivable; pay: Payment } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.receivables || []).filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.customer_name || '').toLowerCase().includes(q) ||
        r.invoice_number.toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    });
  }, [data?.receivables, search, statusFilter]);

  const totalUnpaid = useMemo(
    () =>
      (data?.receivables || [])
        .filter((r) => r.status === 'unpaid')
        .reduce((s, r) => s + r.remaining_amount, 0),
    [data?.receivables]
  );

  const getPaymentsForReceivable = (rec: Receivable) =>
    (data?.payments || []).filter((p) => p.receivable_id === rec.id || p.sale_id === rec.sale_id);

  const getSaleItemsForReceivable = (rec: Receivable) =>
    (data?.sale_items || []).filter((i) => i.sale_id === rec.sale_id);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !payTarget || paying) return;
    const amount = Number(payAmount);
    if (Number.isNaN(amount) || amount <= 0 || amount > payTarget.remaining_amount) {
      showToast(
        `Nominal harus antara Rp 1 dan ${formatRupiah(payTarget.remaining_amount)}.`,
        'error'
      );
      return;
    }

    setPaying(true);
    try {
      const payment = await recordReceivablePayment(mode, user, {
        receivableId: payTarget.id,
        amount,
        paymentMethod: payMethod,
        notes: payNotes,
        idempotencyKey: generateUUID(),
      });

      const updatedRec: Receivable = {
        ...payTarget,
        paid_amount: payTarget.paid_amount + amount,
        remaining_amount: Math.max(0, payTarget.remaining_amount - amount),
        status: payTarget.remaining_amount - amount <= 0 ? 'paid' : 'unpaid',
      };

      setPayTarget(null);
      setPayAmount('');
      setPayNotes('');
      setReceiptData({ rec: updatedRec, pay: payment });
      showToast('Pembayaran piutang berhasil dicatat.');
      await refreshData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mencatat pembayaran.', 'error');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Sisa Piutang Aktif</div>
          <div className="kpi-value text-accent">{formatRupiah(totalUnpaid)}</div>
          <div className="kpi-sub">Belum dianggap uang tunai masuk</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Tagihan Belum Lunas</div>
          <div className="kpi-value">
            {(data?.receivables || []).filter((r) => r.status === 'unpaid').length}
          </div>
          <div className="kpi-sub">Perlu penagihan / cicilan</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Tagihan Sudah Lunas</div>
          <div className="kpi-value text-primary">
            {(data?.receivables || []).filter((r) => r.status === 'paid').length}
          </div>
          <div className="kpi-sub">Riwayat tetap tersimpan aman</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <BookOpen size={18} color="var(--primary)" /> Daftar Piutang Pelanggan
          </h2>
          <div className="tabs-bar" style={{ marginBottom: 0 }}>
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'unpaid', label: 'Belum Lunas' },
                { id: 'paid', label: 'Lunas' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`tab-btn ${statusFilter === f.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="search-box">
            <Search size={16} />
            <input
              className="form-input"
              placeholder="Cari nama pelanggan atau nomor transaksi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tidak ada data piutang.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pelanggan & Transaksi</th>
                  <th>Tanggal & Jatuh Tempo</th>
                  <th className="text-right">Total Tagihan</th>
                  <th className="text-right">Sudah Dibayar</th>
                  <th className="text-right">Sisa Utang</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-bold">{r.customer_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600 }}>
                        {r.invoice_number}
                      </div>
                    </td>
                    <td>
                      <div>{formatDate(r.transaction_date)}</div>
                      {r.due_date && (
                        <div style={{ fontSize: 11.5, color: 'var(--accent)' }}>
                          JT: {formatDate(r.due_date)}
                        </div>
                      )}
                    </td>
                    <td className="text-right">{formatRupiah(r.total_amount)}</td>
                    <td className="text-right text-primary">{formatRupiah(r.paid_amount)}</td>
                    <td className="text-right font-bold text-danger">
                      {formatRupiah(r.remaining_amount)}
                    </td>
                    <td>
                      {r.status === 'paid' ? (
                        <span className="badge badge-success">
                          <CheckCircle2 size={12} /> Lunas
                        </span>
                      ) : (
                        <span className="badge badge-warning">Belum Lunas</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {r.status === 'unpaid' && canReceiveReceivablePayment && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setPayTarget(r);
                              setPayAmount(String(r.remaining_amount));
                              setPayMethod('tunai');
                              setPayNotes('');
                            }}
                          >
                            <PlusCircle size={14} /> Bayar
                          </button>
                        )}
                        {r.status === 'unpaid' && r.customer_phone && (
                          <a
                            href={`https://wa.me/${r.customer_phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(
                              `Halo ${r.customer_name}, kami dari ${
                                data?.store_settings.store_name || 'Zhie Catshop'
                              } mengingatkan tagihan ${r.invoice_number} dengan sisa piutang sebesar ${formatRupiah(
                                r.remaining_amount
                              )}. Terima kasih.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-sm"
                            title="Kirim pengingat via WhatsApp"
                          >
                            WA
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setDetailTarget(r)}
                        >
                          <Eye size={14} /> Detail & Riwayat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Pembayaran Piutang */}
      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={`Tambah Pembayaran Piutang — ${payTarget?.customer_name || ''}`}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setPayTarget(null)}>
              Batal
            </button>
            <button
              type="submit"
              form="rec-pay-form"
              className="btn btn-primary"
              disabled={paying}
            >
              {paying ? 'Menyimpan...' : 'Simpan Pembayaran'}
            </button>
          </>
        }
      >
        {payTarget && (
          <form id="rec-pay-form" onSubmit={handleRecordPayment} className="form-grid">
            <div className="form-group full">
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--accent-light)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Sisa Utang ({payTarget.invoice_number}):</span>
                <strong className="text-danger">{formatRupiah(payTarget.remaining_amount)}</strong>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nominal Pembayaran (Rp) *</label>
              <input
                type="number"
                min="1"
                max={payTarget.remaining_amount}
                className="form-input"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
              <span className="form-hint">Mendukung pembayaran sebagian (cicilan) atau lunas.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Metode Pembayaran</label>
              <select
                className="form-select"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as CashPaymentMethod)}
              >
                <option value="tunai">Tunai</option>
                <option value="transfer">Transfer Bank / QRIS</option>
              </select>
            </div>
            <div className="form-group full">
              <label className="form-label">Catatan Pembayaran</label>
              <input
                className="form-input"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Contoh: Cicilan ke-1 via transfer"
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Detail Utang & Riwayat Pembayaran */}
      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title={`Detail Piutang — ${detailTarget?.invoice_number || ''}`}
        size="lg"
      >
        {detailTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                padding: 14,
                borderRadius: 12,
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Pelanggan
                </div>
                <div className="font-bold">{detailTarget.customer_name}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Tanggal Transaksi
                </div>
                <div className="font-bold">{formatDateTime(detailTarget.transaction_date)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Total Tagihan / Dibayar
                </div>
                <div className="font-bold">
                  {formatRupiah(detailTarget.total_amount)} /{' '}
                  <span className="text-primary">{formatRupiah(detailTarget.paid_amount)}</span>
                </div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Sisa Utang
                </div>
                <div className="font-bold text-danger">
                  {formatRupiah(detailTarget.remaining_amount)}
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Daftar Barang Transaksi</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Harga</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSaleItemsForReceivable(detailTarget).map((i) => (
                      <tr key={i.id}>
                        <td>{i.product_name}</td>
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
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={16} /> Riwayat Pembayaran
              </h4>
              {getPaymentsForReceivable(detailTarget).length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Belum ada pembayaran yang tercatat.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Metode</th>
                        <th>Diterima Oleh</th>
                        <th className="text-right">Nominal</th>
                        <th className="text-right">Bukti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaymentsForReceivable(detailTarget).map((p) => (
                        <tr key={p.id}>
                          <td>{formatDateTime(p.payment_date)}</td>
                          <td>{getPaymentMethodLabel(p.payment_method)}</td>
                          <td>{p.received_by_name}</td>
                          <td className="text-right font-bold text-primary">
                            {formatRupiah(p.amount)}
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setReceiptData({ rec: detailTarget, pay: p })}
                            >
                              <Printer size={13} /> Cetak
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Bukti Bayar */}
      {data && (
        <PaymentReceiptModal
          open={Boolean(receiptData)}
          onClose={() => setReceiptData(null)}
          receivable={receiptData?.rec || null}
          payment={receiptData?.pay || null}
          settings={data.store_settings}
        />
      )}
    </div>
  );
};
