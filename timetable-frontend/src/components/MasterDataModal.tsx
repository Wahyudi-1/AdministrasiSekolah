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
  GraduationCap,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, Subject, ClassRoom, Room, CurriculumStructure } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassRoom[];
  rooms?: Room[];
  curriculumStructures?: CurriculumStructure[];
  schoolId: string;
  onDataUpdated: () => void;
}

type TabType = 'SUBJECT' | 'CURRICULUM' | 'TEACHER' | 'CLASS' | 'ROOM';

export const MasterDataModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  subjects,
  classes,
  rooms = [],
  curriculumStructures = [],
  schoolId,
  onDataUpdated,
}) => {
  // Tab default dimulai dari Mata Pelajaran atau Standar JP
  const [activeTab, setActiveTab] = useState<TabType>('SUBJECT');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // State Form & Edit - Guru (+ Pendidikan & Linieritas, Maks JP otomatis default 8)
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherCode, setTeacherCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [educationDegree, setEducationDegree] = useState('S1');
  const [major, setMajor] = useState('');
  const [eligibleSubjectIds, setEligibleSubjectIds] = useState<string[]>([]);

  // State Form & Edit - Mapel
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');

  // State Form - Struktur Kurikulum per Jenjang
  const [currGradeLevel, setCurrGradeLevel] = useState<number>(10);
  const [currSubjectId, setCurrSubjectId] = useState<string>('');
  const [currDefaultPeriods, setCurrDefaultPeriods] = useState<number>(4);
  const [currIsCompulsory, setCurrIsCompulsory] = useState<boolean>(true);

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
    setEducationDegree('S1');
    setMajor('');
    setEligibleSubjectIds([]);

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

  // --- HANDLER GURU & LINIERITAS ---
  const handleToggleEligibleSubject = (subjectId: string) => {
    setEligibleSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleStartEditTeacher = (t: Teacher) => {
    setEditingTeacherId(t.id);
    setTeacherCode(t.teacher_code);
    setFullName(t.full_name);
    setEducationDegree(t.education_degree || 'S1');
    setMajor(t.major || '');
    setEligibleSubjectIds(t.eligible_subject_ids || []);
    setErrorMsg('');
  };

  const handleSubmitTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherCode.trim() || !fullName.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      let targetTeacherId = editingTeacherId;

      if (editingTeacherId) {
        const { error } = await supabase
          .from('teachers')
          .update({
            teacher_code: teacherCode.trim().toUpperCase(),
            full_name: fullName.trim(),
            education_degree: educationDegree.trim(),
            major: major.trim(),
          })
          .eq('id', editingTeacherId)
          .eq('school_id', schoolId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('teachers')
          .insert([
            {
              school_id: schoolId,
              teacher_code: teacherCode.trim().toUpperCase(),
              full_name: fullName.trim(),
              education_degree: educationDegree.trim(),
              major: major.trim(),
              max_periods_per_day: 8, // Default aman, diatur lanjut di Kebijakan Guru
              unavailable_slots: [],
            },
          ])
          .select()
          .single();
        if (error) throw error;
        targetTeacherId = data.id;
      }

      // Sinkronkan Tabel Linieritas Mapel (teacher_eligible_subjects)
      if (targetTeacherId) {
        await supabase
          .from('teacher_eligible_subjects')
          .delete()
          .eq('school_id', schoolId)
          .eq('teacher_id', targetTeacherId);

        if (eligibleSubjectIds.length > 0) {
          const eligiblePayload = eligibleSubjectIds.map((subId) => ({
            school_id: schoolId,
            teacher_id: targetTeacherId,
            subject_id: subId,
          }));
          const { error: eligErr } = await supabase
            .from('teacher_eligible_subjects')
            .insert(eligiblePayload);
          if (eligErr) throw eligErr;
        }
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

  // --- HANDLER STRUKTUR KURIKULUM ---
  const handleSubmitCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSubId = currSubjectId || subjects[0]?.id;
    if (!targetSubId) {
      setErrorMsg('Pilih mata pelajaran terlebih dahulu.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('curriculum_structures').upsert(
        [
          {
            school_id: schoolId,
            grade_level: Number(currGradeLevel),
            subject_id: targetSubId,
            default_periods: Number(currDefaultPeriods),
            is_compulsory: Boolean(currIsCompulsory),
          },
        ],
        { onConflict: 'school_id,grade_level,subject_id' }
      );
      if (error) throw error;
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan standar kurikulum: ${err.message}`);
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
    table: 'teachers' | 'subjects' | 'classes' | 'rooms' | 'curriculum_structures',
    id: string,
    name: string
  ) => {
    if (!confirm(`Hapus "${name}"?`)) return;

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

  // --- HANDLER RESET KATEGORI ---
  const handleResetAllCategory = async (
    table: 'teachers' | 'subjects' | 'classes' | 'rooms' | 'curriculum_structures',
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold">Kelola Data Master & Struktur Kurikulum</h2>
            <p className="text-xs text-slate-400">
              Alur pengisian terstruktur: Mapel &rarr; Standar JP Kurikulum &rarr; Guru & Linieritas &rarr; Kelas &rarr; Ruangan
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

        {/* Tab Navigasi (Urutan Baru: Mapel -> Standar JP Jenjang -> Guru & Linieritas -> Kelas -> Ruangan) */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1.5 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            onClick={() => {
              setActiveTab('SUBJECT');
              resetForms();
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'SUBJECT'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" /> 1. Mata Pelajaran ({subjects.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('CURRICULUM');
              if (!currSubjectId && subjects.length > 0) setCurrSubjectId(subjects[0].id);
              resetForms();
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'CURRICULUM'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600" /> 2. Standar JP Jenjang ({curriculumStructures.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('TEACHER');
              resetForms();
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'TEACHER'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" /> 3. Guru & Linieritas ({teachers.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('CLASS');
              resetForms();
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'CLASS'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <School className="w-4 h-4" /> 4. Kelas ({classes.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('ROOM');
              resetForms();
            }}
            className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'ROOM'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" /> 5. Ruangan ({rooms.length})
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
          {/* TAB 1: MATA PELAJARAN */}
          {activeTab === 'SUBJECT' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSubmitSubject}
                className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border transition ${
                  editingSubjectId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Kode Mapel*</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: FIS"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs uppercase bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Mata Pelajaran*</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Fisika"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
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

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Mata Pelajaran ({subjects.length})</span>
                {subjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('subjects', 'Mata Pelajaran')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
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
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('subjects', s.id, s.subject_name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
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

          {/* TAB 2: STRUKTUR KURIKULUM (STANDAR JP PER JENJANG) */}
          {activeTab === 'CURRICULUM' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Atur alokasi JP standar mingguan untuk tiap mata pelajaran pada masing-masing jenjang. Pengaturan ini akan mengisi otomatis jumlah JP dan memberi rekomendasi penugasan.
                </span>
              </div>

              <form
                onSubmit={handleSubmitCurriculum}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tingkat Jenjang*</label>
                  <select
                    value={currGradeLevel}
                    onChange={(e) => setCurrGradeLevel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value={7}>Kelas 7 (SMP)</option>
                    <option value={8}>Kelas 8 (SMP)</option>
                    <option value={9}>Kelas 9 (SMP)</option>
                    <option value={10}>Kelas 10 (Fase E)</option>
                    <option value={11}>Kelas 11 (Fase F)</option>
                    <option value={12}>Kelas 12 (Fase F)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mata Pelajaran*</label>
                  <select
                    value={currSubjectId}
                    onChange={(e) => setCurrSubjectId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name} ({s.subject_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Standar JP & Sifat</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={currDefaultPeriods}
                      onChange={(e) => setCurrDefaultPeriods(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-center font-bold"
                    />
                    <select
                      value={currIsCompulsory ? 'WAJIB' : 'PILIHAN'}
                      onChange={(e) => setCurrIsCompulsory(e.target.value === 'WAJIB')}
                      className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-[11px] bg-white font-semibold"
                    >
                      <option value="WAJIB">Wajib Semua Kelas</option>
                      <option value="PILIHAN">Pilihan / Peminatan</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading || subjects.length === 0}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 h-[34px] shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Simpan Standar</span>
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-2.5 w-28 text-center bg-slate-100">Jenjang</th>
                      <th className="p-2.5 bg-slate-100">Mata Pelajaran</th>
                      <th className="p-2.5 w-28 text-center bg-slate-100">Standar JP</th>
                      <th className="p-2.5 w-36 text-center bg-slate-100">Kategori Mapel</th>
                      <th className="p-2.5 w-20 text-center bg-slate-100">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {curriculumStructures
                      .slice()
                      .sort((a, b) => a.grade_level - b.grade_level)
                      .map((cs) => {
                        const sub = subjects.find((s) => s.id === cs.subject_id);
                        return (
                          <tr key={cs.id} className="hover:bg-slate-50/80">
                            <td className="p-2.5 text-center font-bold text-indigo-900">
                              Kelas {cs.grade_level}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-800">
                              {sub?.subject_name || 'Mapel Terhapus'} ({sub?.subject_code})
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                              {cs.default_periods} JP
                            </td>
                            <td className="p-2.5 text-center">
                              {cs.is_compulsory !== false ? (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                  Wajib Nasional
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                  Mapel Pilihan / Peminatan
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() =>
                                  handleDelete(
                                    'curriculum_structures',
                                    cs.id,
                                    `${sub?.subject_name} Kelas ${cs.grade_level}`
                                  )
                                }
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {curriculumStructures.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                          Belum ada standar kurikulum yang ditetapkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: GURU & LINIERITAS (INPUT MAKS JP SUDAH DIHILANGKAN) */}
          {activeTab === 'TEACHER' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSubmitTeacher}
                className={`p-4 rounded-xl border space-y-3.5 transition ${
                  editingTeacherId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Kode Guru*</label>
                    <input
                      type="text"
                      required
                      placeholder="G01"
                      value={teacherCode}
                      onChange={(e) => setTeacherCode(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs uppercase bg-white font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Lengkap & Gelar*</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd."
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Jenjang Ijazah</label>
                    <select
                      value={educationDegree}
                      onChange={(e) => setEducationDegree(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                    >
                      <option value="S1">S1 / D4</option>
                      <option value="S2">S2 (Magister)</option>
                      <option value="S3">S3 (Doktor)</option>
                      <option value="D3">D3</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Jurusan / Program Studi Ijazah</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pendidikan Fisika / Sastra Inggris"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>

                {/* Pemilih Linieritas Mapel yang Diizinkan */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <span>Mata Pelajaran yang Diizinkan / Linier Sesuai Sertifikasi & Ijazah:</span>
                  </label>
                  {subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white border border-slate-200 rounded-lg">
                      {subjects.map((sub) => {
                        const isSelected = eligibleSubjectIds.includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleToggleEligibleSubject(sub.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3 h-3" />
                            ) : (
                              <Square className="w-3 h-3 opacity-40" />
                            )}
                            <span>{sub.subject_name} ({sub.subject_code})</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Data Mata Pelajaran masih kosong. Silakan isi terlebih dahulu di tab 1 (Mata Pelajaran).
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {editingTeacherId && (
                    <button
                      type="button"
                      onClick={resetForms}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white transition shadow-sm ${
                      editingTeacherId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {editingTeacherId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingTeacherId ? 'Simpan Perubahan Guru' : 'Tambah Guru & Linieritas'}</span>
                  </button>
                </div>
              </form>

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Guru & Kualifikasi ({teachers.length})</span>
                {teachers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('teachers', 'Guru')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Semua Guru</span>
                  </button>
                )}
              </div>

              {/* Tabel Guru (Kolom Maks JP dihapus, kolom Mapel Linier mendapat ruang lebih leluasa) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-2.5 w-16 text-center bg-slate-100">Kode</th>
                      <th className="p-2.5 w-72 bg-slate-100">Nama Guru & Pendidikan</th>
                      <th className="p-2.5 bg-slate-100">Mata Pelajaran Linier Diizinkan</th>
                      <th className="p-2.5 w-20 text-center bg-slate-100">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map((t) => {
                      const eligibleSubs = subjects.filter((s) =>
                        (t.eligible_subject_ids || []).includes(s.id)
                      );
                      return (
                        <tr
                          key={t.id}
                          className={`transition ${
                            editingTeacherId === t.id ? 'bg-amber-50' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="p-2.5 text-center font-mono font-bold text-slate-600">{t.teacher_code}</td>
                          <td className="p-2.5">
                            <p className="font-bold text-slate-800">{t.full_name}</p>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {t.education_degree || 'S1'} — {t.major || 'Belum diisi'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {eligibleSubs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {eligibleSubs.map((sub) => (
                                  <span
                                    key={sub.id}
                                    className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold"
                                  >
                                    {sub.subject_name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Otomatis Berdasarkan Nama Jurusan</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleStartEditTeacher(t)}
                                className="p-1 text-slate-400 hover:text-amber-600 rounded transition"
                                title="Edit Guru & Linieritas"
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
                      );
                    })}
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

          {/* TAB 4: KELAS */}
          {activeTab === 'CLASS' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSubmitClass}
                className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border transition ${
                  editingClassId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Rombel / Kelas*</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: X-A / XII-MIPA-1"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tingkat Kelas*</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
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

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Kelas Rombel ({classes.length})</span>
                {classes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('classes', 'Kelas')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
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
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('classes', c.id, c.class_name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
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

          {/* TAB 5: RUANGAN KHUSUS */}
          {activeTab === 'ROOM' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSubmitRoom}
                className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border transition ${
                  editingRoomId ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Ruangan Khusus*</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: LAB-FISIKA / Lapangan"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipe / Kategori Ruangan</label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
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

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs">Daftar Ruangan Khusus ({rooms.length})</span>
                {rooms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetAllCategory('rooms', 'Ruangan Khusus')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
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
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('rooms', r.id, r.room_name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
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

        {/* Footer Modal */}
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
