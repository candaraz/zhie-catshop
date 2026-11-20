import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchAllData, type AllStoreData } from '../lib/dataService';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface AppContextValue {
  data: AllStoreData | null;
  loadingData: boolean;
  dataError: string | null;
  isOnline: boolean;
  toasts: ToastMessage[];
  canInstallPwa: boolean;
  installPwa: () => Promise<void>;
  refreshData: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, mode } = useAuth();
  const [data, setData] = useState<AllStoreData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      showToast('Koneksi internet kembali terhubung.', 'success');
    };
    const onOffline = () => {
      setIsOnline(false);
      showToast(
        'Koneksi internet terputus. Perubahan tidak akan tersimpan ke server hingga online.',
        'warning'
      );
    };
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, [showToast]);

  const refreshData = useCallback(async () => {
    if (!user) {
      setData(null);
      return;
    }
    setLoadingData(true);
    setDataError(null);
    try {
      const res = await fetchAllData(mode, user);
      setData(res);
      if (res.store_settings?.store_name) {
        document.title = `${res.store_settings.store_name} — Kasir & Manajemen Keuangan`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data toko.';
      setDataError(msg);
      showToast(msg, 'error');
    } finally {
      setLoadingData(false);
    }
  }, [user, mode, showToast]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const installPwa = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      showToast('Zhie Catshop berhasil dipasang ke layar utama!', 'success');
    }
    setDeferredPrompt(null);
  };

  return (
    <AppContext.Provider
      value={{
        data,
        loadingData,
        dataError,
        isOnline,
        toasts,
        canInstallPwa: Boolean(deferredPrompt),
        installPwa,
        refreshData,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus digunakan di dalam AppProvider');
  return ctx;
}
