import React, { useState } from 'react';
import {
  X,
  Users,
  BookOpen,
  School,
  Trash2,
  Plus,
  AlertCircle,
  Pencil,
  Check,
  Building2,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, Subject, ClassRoom, Room } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassRoom[];
  rooms?: Room[];
  schoolId: string;
  onDataUpdated: () => void;
}

type TabType = 'TEACHER' | 'SUBJECT' | 'CLASS' | 'ROOM';

export const MasterDataModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  subjects,
  classes,
  rooms = [],
  schoolId,
  onDataUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('TEACHER');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // State Form & Edit - Guru
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherCode, setTeacherCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [maxPeriods, setMaxPeriods] = useState<number>(6);

  // State Form & Edit - Mapel
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');

  // State Form & Edit - Kelas
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<number>(10);

  // State Form & Edit - Ruangan Khusus
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState('LAB');

  if (!isOpen) return null;

  const resetForms = () => {
    setEditingTeacherId(null);
    setTeacherCode('');
    setFullName('');
    setMaxPeriods(6);

    setEditingSubjectId(null);
    setSubjectCode('');
    setSubjectName('');

    setEditingClassId(null);
    setClassName('');
    setGradeLevel(10);

    setEditingRoomId(null);
    setRoomName('');
    setRoomType('LAB');

    setErrorMsg('');
  };

  // --- HANDLER GURU ---
  const handleStartEditTeacher = (t: Teacher) => {
    setEditingTeacherId(t.id);
    setTeacherCode(t.teacher_code);
    setFullName(t.full_name);
    setMaxPeriods(t.max_periods_per_day);
    setErrorMsg('');
  };

  const handleSubmitTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherCode.trim() || !fullName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      if (editingTeacherId) {
        const { error } = await supabase
          .from('teachers')
          .update({
            teacher_code: teacherCode.trim().toUpperCase(),
            full_name: fullName.trim(),
            max_periods_per_day: Number(maxPeriods),
          })
          .eq('id', editingTeacherId)
          .eq('school_id', schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teachers').insert([
          {
            school_id: schoolId,
            teacher_code: teacherCode.trim().toUpperCase(),
            full_name: fullName.trim(),
            max_periods_per_day: Number(maxPeriods),
            unavailable_slots: [],
          },
        ]);
        if (error) throw error;
      }
      resetForms();
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan data guru: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER MAPEL ---
  const handleStartEditSubject = (s: Subject) => {
    setEditingSubjectId(s.id);
    setSubjectCode(s.subject_code);
    setSubjectName(s.subject_name);
    setErrorMsg('');
  };

  const handleSubmitSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectCode.trim() || !subjectName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      if (editingSubjectId) {
        const { error } = await supabase
          .from('subjects')
          .update({
            subject_code: subjectCode.trim().toUpperCase(),
            subject_name: subjectName.trim(),
          })
          .eq('id', editingSubjectId)
          .eq('school_id', schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subjects').insert([
          {
            school_id: schoolId,
            subject_code: subjectCode.trim().toUpperCase(),
            subject_name: subjectName.trim(),
          },
        ]);
        if (error) throw error;
      }
      resetForms();
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan data mapel: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER KELAS ---
  const handleStartEditClass = (c: ClassRoom) => {
    setEditingClassId(c.id);
    setClassName(c.class_name);
    setGradeLevel(c.grade_level);
    setErrorMsg('');
  };

  const handleSubmitClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      if (editingClassId) {
        const { error } = await supabase
          .from('classes')
          .update({
            class_name: className.trim(),
            grade_level: Number(gradeLevel),
          })
          .eq('id', editingClassId)
          .eq('school_id', schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert([
          {
            school_id: schoolId,
            class_name: className.trim(),
            grade_level: Number(gradeLevel),
          },
        ]);
        if (error) throw error;
      }
      resetForms();
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan data kelas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER RUANGAN KHUSUS ---
  const handleStartEditRoom = (r: Room) => {
    setEditingRoomId(r.id);
    setRoomName(r.room_name);
    setRoomType(r.room_type || 'LAB');
    setErrorMsg('');
  };

  const handleSubmitRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      if (editingRoomId) {
        const { error } = await supabase
          .from('rooms')
          .update({
            room_name: roomName.trim(),
            room_type: roomType.trim(),
          })
          .eq('id', editingRoomId)
          .eq('school_id', schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rooms').insert([
          {
            school_id: schoolId,
            room_name: roomName.trim(),
            room_type: roomType.trim(),
          },
        ]);
        if (error) throw error;
      }
      resetForms();
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan data ruangan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER HAPUS SATUAN ---
  const handleDelete = async (
    table: 'teachers' | 'subjects' | 'classes' | 'rooms',
    id: string,
    name: string
  ) => {
    if (!confirm(`Hapus "${name}"? Kartu jadwal terkait mungkin akan terpengaruh.`)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('school_id', schoolId);
      if (error) throw error;
      resetForms();
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menghapus data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER RESET / KOSONGKAN SELURUH DATA KATEGORI ---
  const handleResetAllCategory = async (
    table: 'teachers' | 'subjects' | 'classes' | 'rooms',
    labelCategory: string
  ) => {
    const confirmation = prompt(
      `PERINGATAN: Anda akan menghapus SELURUH data ${labelCategory} milik sekolah ini!\n\nKetik kata "RESET" untuk mengonfirmasi:`
    );
    if (confirmation !== 'RESET') return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('school_id', schoolId);
      if (error) throw error;

      resetForms();
      onDataUpdated();
      alert(`Seluruh data ${labelCategory} berhasil dikosongkan!`);
    } catch (err: any) {
      setErrorMsg(`Gagal mereset data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal (Diberi shrink-0 agar tidak terkompres) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold">Kelola Data Master Sekolah</h2>
            <p className="text-xs text-slate-400">
              Tambah, edit, dan kelola Guru, Mata Pelajaran, Kelas, dan Ruangan Khusus
            </p>
          </div>
          <button
            onClick={() => {
              resetForms();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi (Diberi shrink-0 agar selalu tampil utuh & tidak terpotong) */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            onClick={() => {
              setActiveTab('TEACHER');
              resetForms();
            }}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'TEACHER'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" /> Guru ({teachers.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('SUBJECT');
              resetForms();
            }}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'SUBJECT'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Mata Pelajaran ({subjects.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('CLASS');
              resetForms();
            }}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'CLASS'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <School className="w-4 h-4" /> Kelas ({classes.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('ROOM');
              resetForms();
            }}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'ROOM'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" /> Ruangan Khusus ({rooms.length})
          </button>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Konten Tab */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {/* TAB 1: GURU */}
          {activeTab === 'TEACHER' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSubmitTeacher}
                className={`grid grid-cols-1 md:grid-cols-4 gap-3 p-3.5 rounded-xl border transition ${
                  editingTeacherId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kode Guru</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: G01"
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs uppercase focus:ring-2 focus:ring-indigo-500 bg-white"
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
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="w-20">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Maks JP</label>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={maxPeriods}
                      onChange={(e) => setMaxPeriods(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white text-center font-bold"
                    />
                  </div>
                  <div className="flex-1 flex gap-1.5">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shrink-0 h-[34px] text-white transition ${
                        editingTeacherId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {editingTeacherId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{editingTeacherId ? 'Simpan' : 'Tambah'}</span>
                    </button>
                    {editingTeacherId && (
                      <button
                        type="button"
                        onClick={resetForms}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold h-[34px]"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {/* Baris Tombol Reset & Judul Tabel */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Guru Terdaftar ({teachers.length})</span>
                {teachers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('teachers', 'Guru')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                    title="Kosongkan seluruh data guru untuk sekolah ini"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Semua Guru</span>
                  </button>
                )}
              </div>

              {/* Tabel Guru (Header diberi sticky top-0 agar tidak hilang saat scroll) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-2.5 w-20 text-center bg-slate-100">Kode</th>
                      <th className="p-2.5 bg-slate-100">Nama Guru</th>
                      <th className="p-2.5 w-28 text-center bg-slate-100">Batas JP/Hari</th>
                      <th className="p-2.5 w-24 text-center bg-slate-100">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map((t) => (
                      <tr
                        key={t.id}
                        className={`transition ${
                          editingTeacherId === t.id ? 'bg-amber-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-2.5 text-center font-mono font-bold text-slate-600">{t.teacher_code}</td>
                        <td className="p-2.5 font-medium text-slate-800">{t.full_name}</td>
                        <td className="p-2.5 text-center text-slate-600">{t.max_periods_per_day} JP</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleStartEditTeacher(t)}
                              className="p-1 text-slate-400 hover:text-amber-600 rounded transition"
                              title="Edit Guru"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('teachers', t.id, t.full_name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Hapus Guru"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
              <form
                onSubmit={handleSubmitSubject}
                className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border transition ${
                  editingSubjectId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kode Mapel</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MAT"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs uppercase focus:ring-2 focus:ring-indigo-500 bg-white"
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
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 h-[34px] text-white transition ${
                      editingSubjectId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {editingSubjectId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingSubjectId ? 'Simpan' : 'Tambah Mapel'}</span>
                  </button>
                  {editingSubjectId && (
                    <button
                      type="button"
                      onClick={resetForms}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold h-[34px]"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>

              {/* Baris Tombol Reset Mapel */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Mata Pelajaran ({subjects.length})</span>
                {subjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('subjects', 'Mata Pelajaran')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                    title="Kosongkan seluruh mata pelajaran untuk sekolah ini"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Semua Mapel</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-2.5 w-24 text-center bg-slate-100">Kode</th>
                      <th className="p-2.5 bg-slate-100">Nama Mata Pelajaran</th>
                      <th className="p-2.5 w-24 text-center bg-slate-100">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((s) => (
                      <tr
                        key={s.id}
                        className={`transition ${
                          editingSubjectId === s.id ? 'bg-amber-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-2.5 text-center font-mono font-bold text-slate-600">{s.subject_code}</td>
                        <td className="p-2.5 font-medium text-slate-800">{s.subject_name}</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleStartEditSubject(s)}
                              className="p-1 text-slate-400 hover:text-amber-600 rounded transition"
                              title="Edit Mapel"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('subjects', s.id, s.subject_name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Hapus Mapel"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
              <form
                onSubmit={handleSubmitClass}
                className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border transition ${
                  editingClassId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Rombel / Kelas</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: X-A / XII-MIPA-1"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tingkat Kelas</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value={7}>Kelas 7 (SMP)</option>
                    <option value={8}>Kelas 8 (SMP)</option>
                    <option value={9}>Kelas 9 (SMP)</option>
                    <option value={10}>Kelas 10 (SMA/SMK)</option>
                    <option value={11}>Kelas 11 (SMA/SMK)</option>
                    <option value={12}>Kelas 12 (SMA/SMK)</option>
                  </select>
                </div>
                <div className="flex items-end gap-1.5">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 h-[34px] text-white transition ${
                      editingClassId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {editingClassId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingClassId ? 'Simpan' : 'Tambah Kelas'}</span>
                  </button>
                  {editingClassId && (
                    <button
                      type="button"
                      onClick={resetForms}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold h-[34px]"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>

              {/* Baris Tombol Reset Kelas */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Kelas Rombel ({classes.length})</span>
                {classes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('classes', 'Kelas')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                    title="Kosongkan seluruh data kelas untuk sekolah ini"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Semua Kelas</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-2.5 bg-slate-100">Nama Kelas</th>
                      <th className="p-2.5 w-28 text-center bg-slate-100">Tingkat</th>
                      <th className="p-2.5 w-24 text-center bg-slate-100">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((c) => (
                      <tr
                        key={c.id}
                        className={`transition ${
                          editingClassId === c.id ? 'bg-amber-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-slate-800">{c.class_name}</td>
                        <td className="p-2.5 text-center text-slate-600">Tingkat {c.grade_level}</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleStartEditClass(c)}
                              className="p-1 text-slate-400 hover:text-amber-600 rounded transition"
                              title="Edit Kelas"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('classes', c.id, c.class_name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

          {/* TAB 4: RUANGAN KHUSUS */}
          {activeTab === 'ROOM' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSubmitRoom}
                className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border transition ${
                  editingRoomId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Ruangan Khusus</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: LAB-TIK / Lapangan / R-101"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipe / Kategori Ruangan</label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="LAB">Laboratorium / Ruang Praktik</option>
                    <option value="THEORY">Ruang Teori / Reguler</option>
                    <option value="OUTDOOR">Outdoor / Lapangan Olahraga</option>
                    <option value="HALL">Aula / Serbaguna</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>
                <div className="flex items-end gap-1.5">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 h-[34px] text-white transition ${
                      editingRoomId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {editingRoomId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingRoomId ? 'Simpan' : 'Tambah Ruangan'}</span>
                  </button>
                  {editingRoomId && (
                    <button
                      type="button"
                      onClick={resetForms}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold h-[34px]"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>

              {/* Baris Tombol Reset Ruangan */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Ruangan Khusus ({rooms.length})</span>
                {rooms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('rooms', 'Ruangan Khusus')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                    title="Kosongkan seluruh ruangan khusus untuk sekolah ini"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Semua Ruangan</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-2.5 bg-slate-100">Nama Ruangan Khusus</th>
                      <th className="p-2.5 w-36 text-center bg-slate-100">Kategori</th>
                      <th className="p-2.5 w-24 text-center bg-slate-100">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rooms.map((r) => (
                      <tr
                        key={r.id}
                        className={`transition ${
                          editingRoomId === r.id ? 'bg-amber-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-slate-800">{r.room_name}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {r.room_type || 'UMUM'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleStartEditRoom(r)}
                              className="p-1 text-slate-400 hover:text-amber-600 rounded transition"
                              title="Edit Ruangan"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('rooms', r.id, r.room_name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Hapus Ruangan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rooms.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400 italic">Belum ada data ruangan khusus.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal (Diberi shrink-0) */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={() => {
              resetForms();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
