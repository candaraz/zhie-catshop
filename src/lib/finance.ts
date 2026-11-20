import type {
  CashTransaction,
  Expense,
  Product,
  Receivable,
  Sale,
  SaleItem,
  StoreSettings,
} from '../types';
import { isSameDay, isWithinDateRange } from './format';

export interface FinancialSummary {
  omzet: number; // Total penjualan
  hpp: number; // Harga pokok penjualan (modal barang terjual)
  grossProfit: number; // Laba kotor = Omzet - HPP
  operationalExpenses: number; // Biaya operasional usaha
  netProfit: number; // Laba bersih = Laba kotor - Biaya operasional
  inventoryPurchases: number; // Pembelian stok (mengurangi kas, TIDAK langsung mengurangi laba)
  ownerDrawings: number; // Pengambilan pemilik / pengeluaran pribadi (bukan biaya operasional)
  totalExpenses: number; // Semua pengeluaran (masuk arus kas)
  cashIn: number; // Uang benar-benar masuk (penjualan tunai/transfer + cicilan piutang)
  cashOut: number; // Uang keluar (semua pengeluaran)
  netCashFlow: number; // Arus kas bersih periode = cashIn - cashOut
  unpaidReceivablesCreated: number; // Piutang baru yang belum dibayar pada periode
  transactionCount: number;
}

/**
 * Menghitung ringkasan keuangan yang akurat secara akuntansi untuk periode tertentu.
 * Rumus:
 * - Omzet = Total Penjualan
 * - Laba Kotor = Penjualan - HPP (modal barang yang terjual)
 * - Laba Bersih = Laba Kotor - Biaya Operasional
 * - Pengeluaran Pribadi = Pengambilan Pemilik (Prive), bukan biaya operasional
 * - Pembelian Stok = Mengurangi kas di Arus Kas, tidak mengurangi laba langsung (hindari hitung ganda)
 * - Piutang belum dibayar != Uang tunai masuk
 */
export function calculateFinancialSummary(
  sales: Sale[],
  saleItems: SaleItem[],
  expenses: Expense[],
  cashTransactions: CashTransaction[],
  startDate: string,
  endDate: string
): FinancialSummary {
  const periodSales = sales.filter((s) => isWithinDateRange(s.sale_date, startDate, endDate));
  const periodSaleIds = new Set(periodSales.map((s) => s.id));
  const periodItems = saleItems.filter((item) => periodSaleIds.has(item.sale_id));
  const periodExpenses = expenses.filter((e) => isWithinDateRange(e.expense_date, startDate, endDate));
  const periodCash = cashTransactions.filter((c) => isWithinDateRange(c.transaction_date, startDate, endDate));

  const omzet = periodSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const hpp = periodItems.reduce(
    (sum, i) => sum + Number(i.cost_price || 0) * Number(i.quantity || 0),
    0
  );
  const grossProfit = omzet - hpp;

  const operationalExpenses = periodExpenses
    .filter((e) => e.expense_type === 'operational')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const inventoryPurchases = periodExpenses
    .filter((e) => e.expense_type === 'inventory')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const ownerDrawings = periodExpenses
    .filter((e) => e.expense_type === 'personal')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalExpenses = operationalExpenses + inventoryPurchases + ownerDrawings;
  const netProfit = grossProfit - operationalExpenses;

  const cashIn = periodCash
    .filter((c) => c.type === 'in')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const cashOut = periodCash
    .filter((c) => c.type === 'out')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const unpaidReceivablesCreated = periodSales.reduce(
    (sum, s) => sum + Number(s.remaining_debt || 0),
    0
  );

  return {
    omzet,
    hpp,
    grossProfit,
    operationalExpenses,
    netProfit,
    inventoryPurchases,
    ownerDrawings,
    totalExpenses,
    cashIn,
    cashOut,
    netCashFlow: cashIn - cashOut,
    unpaidReceivablesCreated,
    transactionCount: periodSales.length,
  };
}

export interface DashboardMetrics {
  todaySalesTotal: number;
  todaySalesCount: number;
  todayCashIn: number;
  todayExpensesTotal: number;
  currentCashBalance: number;
  totalReceivables: number;
  unpaidReceivablesCount: number;
  totalProducts: number;
  lowStockProducts: Product[];
  todayGrossProfit: number;
  monthGrossProfit: number;
}

export function calculateDashboardMetrics(
  sales: Sale[],
  saleItems: SaleItem[],
  expenses: Expense[],
  receivables: Receivable[],
  cashTransactions: CashTransaction[],
  products: Product[],
  settings: StoreSettings
): DashboardMetrics {
  const today = new Date();

  const todaySales = sales.filter((s) => isSameDay(s.sale_date, today));
  const todaySaleIds = new Set(todaySales.map((s) => s.id));
  const todayItems = saleItems.filter((i) => todaySaleIds.has(i.sale_id));

  const todaySalesTotal = todaySales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const todayHpp = todayItems.reduce(
    (sum, i) => sum + Number(i.cost_price || 0) * Number(i.quantity || 0),
    0
  );
  const todayGrossProfit = todaySalesTotal - todayHpp;

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthSales = sales.filter((s) => new Date(s.sale_date) >= monthStart);
  const monthSaleIds = new Set(monthSales.map((s) => s.id));
  const monthItems = saleItems.filter((i) => monthSaleIds.has(i.sale_id));
  const monthOmzet = monthSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const monthHpp = monthItems.reduce(
    (sum, i) => sum + Number(i.cost_price || 0) * Number(i.quantity || 0),
    0
  );
  const monthGrossProfit = monthOmzet - monthHpp;

  const todayCashIn = cashTransactions
    .filter((c) => c.type === 'in' && isSameDay(c.transaction_date, today))
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const todayExpensesTotal = expenses
    .filter((e) => isSameDay(e.expense_date, today))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalAllCashIn = cashTransactions
    .filter((c) => c.type === 'in')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalAllCashOut = cashTransactions
    .filter((c) => c.type === 'out')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const currentCashBalance =
    Number(settings.initial_cash_balance || 0) + totalAllCashIn - totalAllCashOut;

  const activeReceivables = receivables.filter((r) => r.status === 'unpaid' && r.remaining_amount > 0);
  const totalReceivables = activeReceivables.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);

  const activeProducts = products.filter((p) => p.is_active !== false);
  const lowStockProducts = activeProducts.filter((p) => Number(p.stock) <= Number(p.min_stock));

  return {
    todaySalesTotal,
    todaySalesCount: todaySales.length,
    todayCashIn,
    todayExpensesTotal,
    currentCashBalance,
    totalReceivables,
    unpaidReceivablesCount: activeReceivables.length,
    totalProducts: activeProducts.length,
    lowStockProducts,
    todayGrossProfit,
    monthGrossProfit,
  };
}

export interface SalesChartPoint {
  label: string;
  key: string;
  total: number;
  count: number;
}

export function buildDailySalesChart(sales: Sale[], days: number = 14): SalesChartPoint[] {
  const result: SalesChartPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d);

    const daySales = sales.filter((s) => isSameDay(s.sale_date, d));
    const total = daySales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    result.push({ label, key, total, count: daySales.length });
  }
  return result;
}

export function buildMonthlySalesChart(sales: Sale[], months: number = 6): SalesChartPoint[] {
  const result: SalesChartPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(d);

    const mSales = sales.filter((s) => {
      const sd = new Date(s.sale_date);
      return sd.getFullYear() === y && sd.getMonth() === m;
    });
    const total = mSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    result.push({ label, key, total, count: mSales.length });
  }
  return result;
}
