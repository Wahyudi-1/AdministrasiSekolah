import { createClient } from '@supabase/supabase-js';

// Mengambil variabel lingkungan dari Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Pengecekan konsol untuk mempermudah pelacakan (debugging) di Inspect Element
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Peringatan Supabase]: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan pada saat build. ' +
    'Pastikan secret GitHub Actions (SUPABASE_URL dan SUPABASE_ANON_KEY) sudah terdaftar di repository/environment secrets.'
  );
}

// Gunakan URL dan Anon Key jika tersedia, atau gunakan placeholder URL yang valid secara format
// agar fungsi createClient() tidak melempar pengecualian fatal (unhandled exception) yang membuat halaman putih.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
