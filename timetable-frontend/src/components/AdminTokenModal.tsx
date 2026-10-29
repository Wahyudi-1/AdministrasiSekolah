import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  School,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface TokenItem {
  id: string;
  token_code: string;
  description: string;
  is_active: boolean;
  max_uses: number;
  times_used: number;
  created_at: string;
}

interface RegisteredSchool {
  id: string;
  full_name: string;
  whatsapp_number: string;
  school_name: string;
  school_address: string;
  email: string;
  token_used: string;
  created_at: string;
}

export const AdminTokenModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'TOKENS' | 'SCHOOLS'>('TOKENS');
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [schools, setSchools] = useState<RegisteredSchool[]>([]);
  const [loading, setLoading] = useState(false);

  // State Form Buat Token
  const [customToken, setCustomToken] = useState('');
  const [description, setDescription] = useState('');
  const [maxUses, setMaxUses] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [tokensRes, schoolsRes] = await Promise.all([
        supabase.from('access_tokens').select('*').order('created_at', { ascending: false }),
        supabase.from('schools').select('*').order('created_at', { ascending: false }),
      ]);
      if (tokensRes.data) setTokens(tokensRes.data);
      if (schoolsRes.data) setSchools(schoolsRes.data);
    } catch (err) {
      console.error('Gagal mengambil data admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
      generateRandomCode();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCustomToken(`SKL-${part1}-${part2}`);
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToken.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('access_tokens').insert([
        {
          token_code: customToken.trim().toUpperCase(),
          description: description.trim() || 'Token Akses Sekolah',
          max_uses: Number(maxUses),
          is_active: true,
        },
      ]);
      if (error) throw error;
      setDescription('');
      setMaxUses(1);
      generateRandomCode();
      fetchAdminData();
    } catch (err: any) {
      alert(`Gagal membuat token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (token: TokenItem) => {
    const { error } = await supabase
      .from('access_tokens')
      .update({ is_active: !token.is_active })
      .eq('id', token.id);
    if (!error) fetchAdminData();
  };

  const handleDeleteToken = async (id: string, code: string) => {
    if (!confirm(`Hapus token "${code}"?`)) return;
    const { error } = await supabase.from('access_tokens').delete().eq('id', id);
    if (!error) fetchAdminData();
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold">Panel Administrator Database & Token</h2>
              <p className="text-xs text-slate-400">
                Kelola token registrasi dan pantau daftar sekolah pengguna aplikasi
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('TOKENS')}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'TOKENS'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" /> Kelola Token Akses ({tokens.length})
          </button>
          <button
            onClick={() => setActiveTab('SCHOOLS')}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'SCHOOLS'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <School className="w-4 h-4" /> Daftar Sekolah Terdaftar ({schools.length})
          </button>
        </div>

        {/* Konten Utama */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeTab === 'TOKENS' ? (
            <>
              {/* Form Generate Token Baru */}
              <form
                onSubmit={handleCreateToken}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Kode Token</label>
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Acak
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value.toUpperCase())}
                    className="w-full p-2 border rounded-lg font-mono font-bold uppercase bg-white text-indigo-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Keterangan / Peruntukan Sekolah</label>
                  <input
                    type="text"
                    placeholder="Contoh: SMAN 1 Surabaya / Kuota MGMP"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="w-20">
                    <label className="block font-bold text-slate-700 mb-1">Kuota</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={maxUses}
                      onChange={(e) => setMaxUses(Number(e.target.value))}
                      className="w-full p-2 border rounded-lg bg-white text-center font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Buat Token
                  </button>
                </div>
              </form>

              {/* Tabel Daftar Token */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Kode Token</th>
                      <th className="p-2.5">Keterangan</th>
                      <th className="p-2.5 text-center">Terpakai / Kuota</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tokens.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-indigo-900 flex items-center gap-2">
                          <span>{t.token_code}</span>
                          <button
                            onClick={() => handleCopy(t.token_code, t.id)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500"
                            title="Salin Token"
                          >
                            {copiedId === t.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="p-2.5 text-slate-700">{t.description}</td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              t.times_used >= t.max_uses
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {t.times_used} / {t.max_uses}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleToggleActive(t)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-slate-100 text-slate-500 border border-slate-300'
                            }`}
                          >
                            {t.is_active ? (
                              <>
                                <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> Aktif
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-3.5 h-3.5" /> Nonaktif
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleDeleteToken(t.id, t.token_code)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Hapus Token"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tokens.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                          Belum ada token akses.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* Tabel Daftar Sekolah Terdaftar */
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Nama Sekolah</th>
                    <th className="p-2.5">Alamat</th>
                    <th className="p-2.5">Penanggung Jawab</th>
                    <th className="p-2.5">WhatsApp & Email</th>
                    <th className="p-2.5 text-center">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schools.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{s.school_name}</td>
                      <td className="p-2.5 text-slate-600">{s.school_address}</td>
                      <td className="p-2.5 font-medium text-slate-800">{s.full_name}</td>
                      <td className="p-2.5 text-slate-600">
                        <div>{s.whatsapp_number}</div>
                        <div className="text-[10px] text-slate-400">{s.email}</div>
                      </td>
                      <td className="p-2.5 text-center font-mono text-[11px] font-bold text-indigo-700">
                        {s.token_used || '-'}
                      </td>
                    </tr>
                  ))}
                  {schools.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                        Belum ada sekolah yang mendaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
