import React, { useEffect, useState } from 'react';
import type { NavPage } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CashierPage } from './pages/CashierPage';
import { ProductsPage } from './pages/ProductsPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReceivablesPage } from './pages/ReceivablesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersAuditPage } from './pages/UsersAuditPage';
import { SettingsPage } from './pages/SettingsPage';

const AuthenticatedApp: React.FC = () => {
  const { user, loading, isOwner, canRecordExpense } = useAuth();
  const [page, setPage] = useState<NavPage>('dashboard');

  // Guard RBAC jika user berganti peran
  useEffect(() => {
    if (!user) return;
    if (!isOwner && (page === 'reports' || page === 'users' || page === 'settings')) {
      setPage('dashboard');
    }
    if (!isOwner && !canRecordExpense && page === 'expenses') {
      setPage('dashboard');
    }
  }, [user, isOwner, canRecordExpense, page]);

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <img
            src="/logo.png"
            alt="Zhie Catshop"
            style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 12 }}
          />
          <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Memuat Zhie Catshop...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
      {page === 'cashier' && <CashierPage />}
      {page === 'products' && <ProductsPage />}
      {page === 'customers' && <CustomersPage />}
      {page === 'receivables' && <ReceivablesPage />}
      {page === 'expenses' && (isOwner || canRecordExpense) && <ExpensesPage />}
      {page === 'transactions' && <TransactionsPage />}
      {page === 'reports' && isOwner && <ReportsPage />}
      {page === 'users' && isOwner && <UsersAuditPage />}
      {page === 'settings' && isOwner && <SettingsPage />}
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AuthenticatedApp />
      </AppProvider>
    </AuthProvider>
  );
}
