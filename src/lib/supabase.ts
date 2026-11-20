import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'zhie_catshop_supabase_url';
const STORAGE_ANON_KEY = 'zhie_catshop_supabase_anon_key';

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

  if (envUrl && envKey && !envUrl.includes('your-project-id')) {
    return { url: envUrl, anonKey: envKey };
  }

  try {
    const savedUrl = localStorage.getItem(STORAGE_URL_KEY)?.trim() || '';
    const savedKey = localStorage.getItem(STORAGE_ANON_KEY)?.trim() || '';
    return { url: savedUrl, anonKey: savedKey };
  } catch {
    return { url: '', anonKey: '' };
  }
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  cachedClient = null;
}

export function clearSupabaseConfig() {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_ANON_KEY);
  cachedClient = null;
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    const { url, anonKey } = getSupabaseConfig();
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
}
