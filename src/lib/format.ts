export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'Rp 0';
  const isNegative = amount < 0;
  const abs = Math.round(Math.abs(amount));
  const formatted = new Intl.NumberFormat('id-ID').format(abs);
  return `${isNegative ? '-' : ''}Rp ${formatted}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function toDateInputValue(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameDay(iso: string, targetDate: Date = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

export function isWithinDateRange(iso: string, startStr: string, endStr: string): boolean {
  const d = new Date(iso);
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T23:59:59.999`);
  return d >= start && d <= end;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ZH-${y}${m}${d}-${rand}`;
}

export function getExpenseTypeLabel(type: 'inventory' | 'operational' | 'personal'): string {
  switch (type) {
    case 'inventory':
      return 'Pembelian Persediaan (Stok)';
    case 'operational':
      return 'Biaya Operasional';
    case 'personal':
      return 'Pengambilan Pemilik (Pribadi)';
  }
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'tunai':
      return 'Tunai';
    case 'transfer':
      return 'Transfer';
    case 'kredit':
      return 'Kredit / Piutang';
    default:
      return method;
  }
}
