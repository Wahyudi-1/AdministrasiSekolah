import React, { useState } from 'react';
import { School, Lock, Mail, User, Phone, MapPin, KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  onAuthSuccess: () => void;
}

export const AuthPage: React.FC<Props> = ({ onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [tokenCode, setTokenCode] = useState('');

  // 1. Handler Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      onAuthSuccess();
    } catch (err: any) {
      setErrorMsg(err.message === 'Invalid login credentials' ? 'Email atau password salah.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handler Registrasi dengan Verifikasi Token
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // A. Periksa Validitas Token
      const { data: tokenData, error: tokenError } = await supabase
        .from('access_tokens')
        .select('*')
        .eq('token_code', tokenCode.trim())
        .eq('is_active', true)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('Token akses tidak valid atau sudah tidak aktif.');
      }

      if (tokenData.times_used >= tokenData.max_uses) {
        throw new Error('Batas kuota penggunaan token ini telah habis.');
      }

      // B. Daftarkan Akun ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Gagal membuat user.');

      const userId = authData.user.id;

      // C. Simpan Profil Sekolah
      const { error: profileError } = await supabase.from('schools').insert([
        {
          id: userId,
          full_name: fullName.trim(),
          whatsapp_number: whatsapp.trim(),
          school_name: schoolName.trim(),
          school_address: schoolAddress.trim(),
          email: email.trim(),
          token_used: tokenCode.trim(),
        },
      ]);
      if (profileError) throw profileError;

      // D. Update Penggunaan Token (+1)
      await supabase
        .from('access_tokens')
        .update({ times_used: tokenData.times_used + 1 })
        .eq('id', tokenData.id);

      // E. Salin Template Hari Kerja Default (Senin - Sabtu) untuk Sekolah Baru
      await supabase.from('work_days').insert([
        { school_id: userId, day_index: 1, day_name: 'Senin', is_active: true },
        { school_id: userId, day_index: 2, day_name: 'Selasa', is_active: true },
        { school_id: userId, day_index: 3, day_name: 'Rabu', is_active: true },
        { school_id: userId, day_index: 4, day_name: 'Kamis', is_active: true },
        { school_id: userId, day_index: 5, day_name: 'Jumat', is_active: true },
        { school_id: userId, day_index: 6, day_name: 'Sabtu', is_active: false },
      ]);

      setSuccessMsg('Registrasi berhasil! Silakan masuk dengan akun Anda.');
      setIsRegister(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        
        {/* Header Visual */}
        <div className="bg-indigo-600 p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <School className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Smart Timetable CSP</h1>
          <p className="text-indigo-200 text-xs mt-1">
            Platform Pembuat Jadwal Pelajaran Otomatis Multi-Sekolah
          </p>
        </div>

        {/* Notifikasi */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Login */}
          {!isRegister ? (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Username</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="nama@sekolah.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Memeriksa...' : 'Masuk ke Aplikasi'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-3 border-t">
                <p className="text-slate-500">
                  Belum memiliki akun terdaftar?{' '}
                  <button
                    type="button"
                    onClick={() => { setIsRegister(true); setErrorMsg(''); }}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Registrasi dengan Token
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* Form Registrasi */
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Pengguna</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="Wahyu Hidayat"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="tel"
                      required
                      placeholder="08123456789"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Asal Nama Sekolah</label>
                <div className="relative">
                  <School className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="SMA Negeri 1 Surabaya"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Sekolah</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Jl. Wijaya Kusuma No. 48, Surabaya"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Username</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@sman1.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <label className="block font-bold text-indigo-950 mb-1">
                  Token Akses Database (Wajib)
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Masukkan token dari admin"
                    value={tokenCode}
                    onChange={(e) => setTokenCode(e.target.value.toUpperCase())}
                    className="w-full pl-8 pr-2.5 py-1.5 border border-indigo-200 uppercase font-mono font-bold rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 text-indigo-900"
                  />
                </div>
                <p className="text-[10px] text-indigo-600 mt-1">
                  * Dapatkan kode token aktivasi dari pemegang database.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition"
              >
                {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Sekolah'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setErrorMsg(''); }}
                  className="text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Sudah punya akun? Masuk
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
