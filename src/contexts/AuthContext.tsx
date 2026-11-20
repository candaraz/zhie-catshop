import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import type { DataMode } from '../lib/dataService';
import { loadLocalDb, verifyLocalCredentials } from '../lib/localDb';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

const SESSION_LOCAL_KEY = 'zhie_catshop_local_session_uid';
const MODE_PREF_KEY = 'zhie_catshop_mode';

interface AuthContextValue {
  user: UserProfile | null;
  mode: DataMode;
  loading: boolean;
  isOwner: boolean;
  canViewCostPrice: boolean;
  canRecordExpense: boolean;
  canManageCustomers: boolean;
  canReceiveReceivablePayment: boolean;
  login: (email: string, password: string, targetMode?: DataMode) => Promise<void>;
  logout: () => Promise<void>;
  switchMode: (newMode: DataMode) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<DataMode>(() => {
    const saved = localStorage.getItem(MODE_PREF_KEY) as DataMode | null;
    if (saved === 'supabase' && isSupabaseConfigured()) return 'supabase';
    if (saved === 'local') return 'local';
    return isSupabaseConfigured() ? 'supabase' : 'local';
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSupabaseProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const profile = data as UserProfile;
    if (!profile.is_active) {
      await sb.auth.signOut();
      throw new Error('Akun Anda telah dinonaktifkan oleh Pemilik toko.');
    }
    return profile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (mode === 'local') {
      const uid = localStorage.getItem(SESSION_LOCAL_KEY);
      if (!uid) {
        setUser(null);
        return;
      }
      const db = loadLocalDb();
      const found = db.users.find((u) => u.id === uid);
      if (!found || !found.is_active) {
        localStorage.removeItem(SESSION_LOCAL_KEY);
        setUser(null);
        return;
      }
      const { password_hash: _ph, ...profile } = found;
      setUser(profile);
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      setUser(null);
      return;
    }
    const { data } = await sb.auth.getSession();
    if (!data.session?.user) {
      setUser(null);
      return;
    }
    const profile = await loadSupabaseProfile(data.session.user.id);
    setUser(profile);
  }, [mode, loadSupabaseProfile]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      setLoading(true);
      try {
        await refreshProfile();
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    init();

    if (mode === 'supabase') {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
          if (!session?.user) {
            setUser(null);
          } else {
            loadSupabaseProfile(session.user.id)
              .then((p) => active && setUser(p))
              .catch(() => active && setUser(null));
          }
        });
        return () => {
          active = false;
          listener.subscription.unsubscribe();
        };
      }
    }
    return () => {
      active = false;
    };
  }, [mode, refreshProfile, loadSupabaseProfile]);

  const login = async (email: string, password: string, targetMode?: DataMode) => {
    const activeMode = targetMode || mode;
    if (activeMode !== mode) {
      setMode(activeMode);
      localStorage.setItem(MODE_PREF_KEY, activeMode);
    }

    if (activeMode === 'local') {
      const profile = verifyLocalCredentials(email, password);
      if (!profile) {
        throw new Error('Email atau kata sandi salah.');
      }
      localStorage.setItem(SESSION_LOCAL_KEY, profile.id);
      setUser(profile);
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Koneksi internet terputus. Tidak dapat masuk ke server Supabase.');
    }

    const sb = getSupabaseClient();
    if (!sb) {
      throw new Error('Kredensial Supabase belum diatur. Isi URL & Anon Key Supabase terlebih dahulu.');
    }

    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(
        error.message === 'Invalid login credentials'
          ? 'Email atau kata sandi tidak cocok.'
          : error.message
      );
    }
    if (!data.user) throw new Error('Gagal mendapatkan data akun.');

    const profile = await loadSupabaseProfile(data.user.id);
    if (!profile) {
      await sb.auth.signOut();
      throw new Error(
        'Akun Auth ditemukan, tetapi profil belum terdaftar di tabel public.users. Tambahkan baris akun ini di tabel users (role: owner).'
      );
    }

    await sb
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', profile.id);

    await sb.from('audit_logs').insert({
      user_id: profile.id,
      user_name: profile.full_name,
      user_role: profile.role,
      action: 'LOGIN',
      entity_type: 'auth',
      entity_id: profile.id,
      details: { email: profile.email },
    });

    setUser(profile);
  };

  const logout = async () => {
    if (mode === 'local') {
      localStorage.removeItem(SESSION_LOCAL_KEY);
      setUser(null);
      return;
    }
    const sb = getSupabaseClient();
    if (sb) {
      await sb.auth.signOut();
    }
    setUser(null);
  };

  const switchMode = (newMode: DataMode) => {
    localStorage.setItem(MODE_PREF_KEY, newMode);
    setMode(newMode);
    setUser(null);
  };

  const isOwner = user?.role === 'owner';
  const canViewCostPrice = Boolean(isOwner || user?.permissions?.can_view_cost_price);
  const canRecordExpense = Boolean(isOwner || user?.permissions?.can_record_expense);
  const canManageCustomers = Boolean(isOwner || user?.permissions?.can_manage_customers);
  const canReceiveReceivablePayment = Boolean(
    isOwner || user?.permissions?.can_receive_receivable_payment
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        mode,
        loading,
        isOwner,
        canViewCostPrice,
        canRecordExpense,
        canManageCustomers,
        canReceiveReceivablePayment,
        login,
        logout,
        switchMode,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return ctx;
}
