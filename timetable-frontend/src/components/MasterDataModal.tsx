import React, { useState } from 'react';
import { X, Users, BookOpen, School, Trash2, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, Subject, ClassRoom } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassRoom[];
  onDataUpdated: () => void;
}

type TabType = 'TEACHER' | 'SUBJECT' | 'CLASS';

export const MasterDataModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  subjects,
  classes,
  onDataUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('TEACHER');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form State - Guru
  const [teacherCode, setTeacherCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [maxPeriods, setMaxPeriods] = useState<number>(6);

  // Form State - Mapel
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');

  // Form State - Kelas
  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<number>(10);

  if (!isOpen) return null;

  // Handler Tambah Guru
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherCode.trim() || !fullName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('teachers').insert([
        {
          teacher_code: teacherCode.trim().toUpperCase(),
          full_name: fullName.trim(),
          max_periods_per_day: Number(maxPeriods),
          unavailable_slots: [],
        },
      ]);
      if (error) throw error;

      setTeacherCode('');
      setFullName('');
      setMaxPeriods(6);
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menambah guru: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler Tambah Mapel
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectCode.trim() || !subjectName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('subjects').insert([
        {
          subject_code: subjectCode.trim().toUpperCase(),
          subject_name: subjectName.trim(),
        },
      ]);
      if (error) throw error;

      setSubjectCode('');
      setSubjectName('');
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menambah mapel: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler Tambah Kelas
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('classes').insert([
        {
          class_name: className.trim(),
          grade_level: Number(gradeLevel),
        },
      ]);
      if (error) throw error;

      setClassName('');
      setGradeLevel(10);
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menambah kelas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler Hapus Data
  const handleDelete = async (table: 'teachers' | 'subjects' | 'classes', id: string, name: string) => {
    if (!confirm(`Hapus "${name}"? Kartu pelajaran terkait mungkin akan terpengaruh.`)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menghapus data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Kelola Data Master Sekolah</h2>
            <p className="text-xs text-slate-400">Tambah dan kelola daftar Guru, Mata Pelajaran, dan Kelas</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => { setActiveTab('TEACHER'); setErrorMsg(''); }}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'TEACHER'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" /> Guru ({teachers.length})
          </button>
          <button
            onClick={() => { setActiveTab('SUBJECT'); setErrorMsg(''); }}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'SUBJECT'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Mata Pelajaran ({subjects.length})
          </button>
          <button
            onClick={() => { setActiveTab('CLASS'); setErrorMsg(''); }}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'CLASS'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <School className="w-4 h-4" /> Kelas ({classes.length})
          </button>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Konten Tab */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* TAB 1: GURU */}
          {activeTab === 'TEACHER' && (
            <div className="space-y-4">
              <form onSubmit={handleAddTeacher} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kode Guru</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: G01"
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Lengkap & Gelar</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd."
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Maks JP/Hari</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={maxPeriods}
                      onChange={(e) => setMaxPeriods(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 h-[34px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-20 text-center">Kode</th>
                      <th className="p-2.5">Nama Guru</th>
                      <th className="p-2.5 w-28 text-center">Batas JP/Hari</th>
                      <th className="p-2.5 w-16 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-center font-mono font-bold text-slate-600">{t.teacher_code}</td>
                        <td className="p-2.5 font-medium text-slate-800">{t.full_name}</td>
                        <td className="p-2.5 text-center text-slate-600">{t.max_periods_per_day} JP</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleDelete('teachers', t.id, t.full_name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Hapus Guru"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {teachers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">Belum ada data guru.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: MATA PELAJARAN */}
          {activeTab === 'SUBJECT' && (
            <div className="space-y-4">
              <form onSubmit={handleAddSubject} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kode Mapel</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MAT"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Mata Pelajaran</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Matematika"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 h-[34px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Mapel
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-24 text-center">Kode</th>
                      <th className="p-2.5">Nama Mata Pelajaran</th>
                      <th className="p-2.5 w-16 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-center font-mono font-bold text-slate-600">{s.subject_code}</td>
                        <td className="p-2.5 font-medium text-slate-800">{s.subject_name}</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleDelete('subjects', s.id, s.subject_name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Hapus Mapel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {subjects.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400 italic">Belum ada data mata pelajaran.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: KELAS */}
          {activeTab === 'CLASS' && (
            <div className="space-y-4">
              <form onSubmit={handleAddClass} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Rombel / Kelas</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: X-A / XII-MIPA-1"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tingkat Kelas</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value={7}>Kelas 7 (SMP)</option>
                    <option value={8}>Kelas 8 (SMP)</option>
                    <option value={9}>Kelas 9 (SMP)</option>
                    <option value={10}>Kelas 10 (SMA/SMK)</option>
                    <option value={11}>Kelas 11 (SMA/SMK)</option>
                    <option value={12}>Kelas 12 (SMA/SMK)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 h-[34px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Kelas
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Nama Kelas</th>
                      <th className="p-2.5 w-28 text-center">Tingkat</th>
                      <th className="p-2.5 w-16 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-bold text-slate-800">{c.class_name}</td>
                        <td className="p-2.5 text-center text-slate-600">Tingkat {c.grade_level}</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleDelete('classes', c.id, c.class_name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Hapus Kelas"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {classes.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400 italic">Belum ada data kelas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Modal */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
