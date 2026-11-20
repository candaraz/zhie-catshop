import React from 'react';
import jsPDF from 'jspdf';
import { Download, Printer } from 'lucide-react';
import type { Payment, Receivable, Sale, SaleItem, StoreSettings } from '../types';
import { formatDateTime, formatRupiah, getPaymentMethodLabel } from '../lib/format';
import { Modal } from './Modal';

interface SaleReceiptProps {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  items: SaleItem[];
  settings: StoreSettings;
}

export const SaleReceiptModal: React.FC<SaleReceiptProps> = ({
  open,
  onClose,
  sale,
  items,
  settings,
}) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 180] });
    let y = 10;
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(settings.store_name || 'Zhie Catshop', 40, y, { align: 'center' });
    y += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    if (settings.address) {
      doc.text(settings.address, 40, y, { align: 'center', maxWidth: 70 });
      y += 5;
    }
    if (settings.phone) {
      doc.text(`Telp: ${settings.phone}`, 40, y, { align: 'center' });
      y += 5;
    }
    doc.text('--------------------------------', 40, y, { align: 'center' });
    y += 4;
    doc.text(`No    : ${sale.invoice_number}`, 5, y);
    y += 4;
    doc.text(`Tgl   : ${formatDateTime(sale.sale_date)}`, 5, y);
    y += 4;
    doc.text(`Kasir : ${sale.cashier_name}`, 5, y);
    y += 4;
    doc.text(`Plgn  : ${sale.customer_name || 'Umum'}`, 5, y);
    y += 4;
    doc.text('--------------------------------', 40, y, { align: 'center' });
    y += 4;

    items.forEach((item) => {
      doc.text(item.product_name, 5, y, { maxWidth: 70 });
      y += 4;
      doc.text(`${item.quantity} ${item.unit} x ${formatRupiah(item.unit_price)}`, 5, y);
      doc.text(formatRupiah(item.subtotal), 75, y, { align: 'right' });
      y += 4.5;
    });

    doc.text('--------------------------------', 40, y, { align: 'center' });
    y += 4;
    doc.text('Subtotal:', 5, y);
    doc.text(formatRupiah(sale.subtotal), 75, y, { align: 'right' });
    y += 4;
    if (sale.discount > 0) {
      doc.text('Diskon:', 5, y);
      doc.text(`-${formatRupiah(sale.discount)}`, 75, y, { align: 'right' });
      y += 4;
    }
    doc.setFont('courier', 'bold');
    doc.text('TOTAL:', 5, y);
    doc.text(formatRupiah(sale.total_amount), 75, y, { align: 'right' });
    y += 4.5;
    doc.setFont('courier', 'normal');
    doc.text(`Bayar (${getPaymentMethodLabel(sale.payment_method)}):`, 5, y);
    doc.text(formatRupiah(sale.paid_amount), 75, y, { align: 'right' });
    y += 4;
    if (sale.change_amount > 0) {
      doc.text('Kembalian:', 5, y);
      doc.text(formatRupiah(sale.change_amount), 75, y, { align: 'right' });
      y += 4;
    }
    if (sale.remaining_debt > 0) {
      doc.setFont('courier', 'bold');
      doc.text('Sisa Piutang:', 5, y);
      doc.text(formatRupiah(sale.remaining_debt), 75, y, { align: 'right' });
      y += 4;
      doc.setFont('courier', 'normal');
    }
    doc.text('--------------------------------', 40, y, { align: 'center' });
    y += 5;
    if (settings.receipt_footer) {
      doc.text(settings.receipt_footer, 40, y, { align: 'center', maxWidth: 70 });
    }
    doc.save(`Struk-${sale.invoice_number}.pdf`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Struk Transaksi"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={handleDownloadPdf}>
            <Download size={16} /> Unduh PDF
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Cetak Struk
          </button>
        </>
      }
    >
      <div className="receipt-paper printable-receipt">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {settings.store_name || 'Zhie Catshop'}
          </div>
          {settings.address && <div style={{ fontSize: 11 }}>{settings.address}</div>}
          {settings.phone && <div style={{ fontSize: 11 }}>Telp: {settings.phone}</div>}
          {settings.receipt_header && (
            <div style={{ fontSize: 11, marginTop: 4 }}>{settings.receipt_header}</div>
          )}
        </div>

        <div className="receipt-divider" />
        <div className="receipt-row">
          <span>No. Transaksi</span>
          <span>{sale.invoice_number}</span>
        </div>
        <div className="receipt-row">
          <span>Tanggal</span>
          <span>{formatDateTime(sale.sale_date)}</span>
        </div>
        <div className="receipt-row">
          <span>Kasir</span>
          <span>{sale.cashier_name}</span>
        </div>
        <div className="receipt-row">
          <span>Pelanggan</span>
          <span>{sale.customer_name || 'Umum'}</span>
        </div>

        <div className="receipt-divider" />
        {items.map((item) => (
          <div key={item.id} style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 700 }}>{item.product_name}</div>
            <div className="receipt-row">
              <span>
                {item.quantity} {item.unit} x {formatRupiah(item.unit_price)}
              </span>
              <span>{formatRupiah(item.subtotal)}</span>
            </div>
          </div>
        ))}

        <div className="receipt-divider" />
        <div className="receipt-row">
          <span>Subtotal</span>
          <span>{formatRupiah(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="receipt-row">
            <span>Diskon</span>
            <span>-{formatRupiah(sale.discount)}</span>
          </div>
        )}
        <div className="receipt-row" style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>
          <span>TOTAL</span>
          <span>{formatRupiah(sale.total_amount)}</span>
        </div>
        <div className="receipt-row">
          <span>Bayar ({getPaymentMethodLabel(sale.payment_method)})</span>
          <span>{formatRupiah(sale.paid_amount)}</span>
        </div>
        {sale.change_amount > 0 && (
          <div className="receipt-row">
            <span>Kembalian</span>
            <span>{formatRupiah(sale.change_amount)}</span>
          </div>
        )}
        {sale.remaining_debt > 0 && (
          <div className="receipt-row" style={{ fontWeight: 700 }}>
            <span>Sisa Piutang</span>
            <span>{formatRupiah(sale.remaining_debt)}</span>
          </div>
        )}
        <div className="receipt-divider" />
        <div style={{ textAlign: 'center', fontSize: 11 }}>
          {settings.receipt_footer || 'Terima kasih atas kunjungan Anda!'}
        </div>
      </div>
    </Modal>
  );
};

interface PaymentReceiptProps {
  open: boolean;
  onClose: () => void;
  receivable: Receivable | null;
  payment: Payment | null;
  settings: StoreSettings;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptProps> = ({
  open,
  onClose,
  receivable,
  payment,
  settings,
}) => {
  if (!receivable || !payment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bukti Pembayaran Piutang"
      footer={
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> Cetak Bukti Bayar
        </button>
      }
    >
      <div className="receipt-paper printable-receipt">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {settings.store_name || 'Zhie Catshop'}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>BUKTI PEMBAYARAN PIUTANG</div>
          {settings.phone && <div style={{ fontSize: 11 }}>Telp: {settings.phone}</div>}
        </div>
        <div className="receipt-divider" />
        <div className="receipt-row">
          <span>No. Transaksi</span>
          <span>{receivable.invoice_number}</span>
        </div>
        <div className="receipt-row">
          <span>Pelanggan</span>
          <span>{receivable.customer_name}</span>
        </div>
        <div className="receipt-row">
          <span>Tanggal Bayar</span>
          <span>{formatDateTime(payment.payment_date)}</span>
        </div>
        <div className="receipt-row">
          <span>Diterima Oleh</span>
          <span>{payment.received_by_name}</span>
        </div>
        <div className="receipt-divider" />
        <div className="receipt-row">
          <span>Total Tagihan</span>
          <span>{formatRupiah(receivable.total_amount)}</span>
        </div>
        <div className="receipt-row" style={{ fontWeight: 800, fontSize: 14 }}>
          <span>Nominal Dibayar</span>
          <span>{formatRupiah(payment.amount)}</span>
        </div>
        <div className="receipt-row">
          <span>Metode</span>
          <span>{getPaymentMethodLabel(payment.payment_method)}</span>
        </div>
        <div className="receipt-row">
          <span>Sisa Utang</span>
          <span>{formatRupiah(receivable.remaining_amount)}</span>
        </div>
        <div className="receipt-row">
          <span>Status</span>
          <span>{receivable.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}</span>
        </div>
        {payment.notes && (
          <>
            <div className="receipt-divider" />
            <div style={{ fontSize: 11 }}>Catatan: {payment.notes}</div>
          </>
        )}
        <div className="receipt-divider" />
        <div style={{ textAlign: 'center', fontSize: 11 }}>Simpan bukti pembayaran ini.</div>
      </div>
    </Modal>
  );
};
