import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  UserCheck,
  Plus,
  Trash2,
  AlertCircle,
  CheckSquare,
  Square,
  Clock,
  GraduationCap,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, Subject, ClassRoom, Lesson, CurriculumStructure } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassRoom[];
  lessons: Lesson[];
  curriculumStructures?: CurriculumStructure[];
  schoolId: string;
  onDataUpdated: () => void;
}

export const AssignmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  subjects,
  classes,
  lessons,
  curriculumStructures = [],
  schoolId,
  onDataUpdated,
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [totalPeriods, setTotalPeriods] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) setSelectedTeacherId(teachers[0].id);
    if (!selectedSubjectId && subjects.length > 0) setSelectedSubjectId(subjects[0].id);
  }, [teachers, subjects, selectedTeacherId, selectedSubjectId]);

  // Data guru aktif terpilih
  const selectedTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId);
  }, [teachers, selectedTeacherId]);

  // 1. Total Jam Pelajaran yang sudah diemban guru
  const teacherTotalAssignedJP = useMemo(() => {
    if (!selectedTeacherId) return 0;
    return lessons
      .filter((l) => l.teacher_id === selectedTeacherId)
      .reduce((sum, l) => sum + Number(l.total_periods ?? l.total_periods_per_week ?? 0), 0);
  }, [lessons, selectedTeacherId]);

  // 2. Daftar kelas yang SUDAH diajar guru ini (tidak ditampilkan lagi)
  const assignedClassIdsForTeacher = useMemo(() => {
    if (!selectedTeacherId) return new Set<string>();
    const classIdSet = new Set<string>();
    lessons
      .filter((l) => l.teacher_id === selectedTeacherId)
      .forEach((l) => classIdSet.add(l.class_id));
    return classIdSet;
  }, [lessons, selectedTeacherId]);

  // 3. Kelas yang masih tersedia
  const availableClasses = useMemo(() => {
    return classes.filter((cls) => !assignedClassIdsForTeacher.has(cls.id));
  }, [classes, assignedClassIdsForTeacher]);

  // 4. Pembagian Mata Pelajaran: Linier vs Lainnya
  const { linearSubjects, otherSubjects } = useMemo(() => {
    const eligibleIds = new Set(selectedTeacher?.eligible_subject_ids || []);
    const linear: Subject[] = [];
    const others: Subject[] = [];

    subjects.forEach((s) => {
      // Dianggap linier jika terdaftar di eligible_subject_ids atau nama major guru memuat nama mapel
      const isExplicitEligible = eligibleIds.has(s.id);
      const isMajorMatch =
        selectedTeacher?.major &&
        s.subject_name.toLowerCase().includes(selectedTeacher.major.toLowerCase());

      if (isExplicitEligible || isMajorMatch) {
        linear.push(s);
      } else {
        others.push(s);
      }
    });

    return { linearSubjects: linear, otherSubjects: others };
  }, [subjects, selectedTeacher]);

  // Auto-fill Total JP berdasarkan kurikulum saat mapel atau kelas pertama dipilih
  useEffect(() => {
    if (!selectedSubjectId || selectedClassIds.length === 0) return;

    // Ambil jenjang dari kelas pertama yang dicentang
    const firstClass = classes.find((c) => c.id === selectedClassIds[0]);
    if (!firstClass) return;

    const matchedRule = curriculumStructures.find(
      (cs) => cs.grade_level === firstClass.grade_level && cs.subject_id === selectedSubjectId
    );

    if (matchedRule && matchedRule.default_periods > 0) {
      setTotalPeriods(matchedRule.default_periods);
    }
  }, [selectedSubjectId, selectedClassIds, classes, curriculumStructures]);

  if (!isOpen) return null;

  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setSelectedClassIds([]);
  };

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleSelectAllClasses = () => {
    setSelectedClassIds(availableClasses.map((c) => c.id));
  };

  const handleClearClasses = () => {
    setSelectedClassIds([]);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedSubjectId) {
      setErrorMsg('Pilih guru dan mata pelajaran terlebih dahulu.');
      return;
    }
    if (selectedClassIds.length === 0) {
      setErrorMsg('Pilih minimal satu kelas tujuan.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const defaultSplit =
        totalPeriods === 1 ? '1' :
        totalPeriods === 2 ? '2' :
        totalPeriods === 3 ? '2+1' :
        totalPeriods === 4 ? '2+2' :
        totalPeriods === 5 ? '3+2' : '3+3';

      for (const classId of selectedClassIds) {
        const existing = lessons.find(
          (l) => l.class_id === classId && l.subject_id === selectedSubjectId
        );

        if (existing) {
          const { error } = await supabase
            .from('lessons')
            .update({
              teacher_id: selectedTeacherId,
              total_periods_per_week: Number(totalPeriods),
              total_periods: Number(totalPeriods),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .eq('school_id', schoolId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('lessons').insert([
            {
              school_id: schoolId,
              teacher_id: selectedTeacherId,
              subject_id: selectedSubjectId,
              class_id: classId,
              total_periods_per_week: Number(totalPeriods),
              total_periods: Number(totalPeriods),
              split_pattern: defaultSplit,
              allowed_slot_types: 'FORMAL',
              preferred_room_id: null,
            },
          ]);
          if (error) throw error;
        }
      }

      setSelectedClassIds([]);
      onDataUpdated();
      alert(`Berhasil menyimpan penugasan untuk ${selectedClassIds.length} kelas!`);
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan penugasan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: string, label: string) => {
    if (!confirm(`Hapus penugasan "${label}"?`)) return;
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id)
        .eq('school_id', schoolId);
      if (error) throw error;
      onDataUpdated();
    } catch (err: any) {
      setErrorMsg(`Gagal menghapus penugasan: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">Penugasan Mengajar Guru (Distribusi Jam KBM)</h2>
              <p className="text-xs text-slate-400">
                Alokasikan guru sesuai linieritas ijazah dan standar kurikulum per jenjang
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          <form onSubmit={handleSaveAssignment} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Kolom 1: Pilihan Guru & Profil Linieritas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Guru Pengampu</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white font-medium"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.teacher_code})
                    </option>
                  ))}
                </select>

                {/* Profil Latar Belakang Pendidikan & Status Beban Guru */}
                <div className="mt-1.5 p-2 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-indigo-900 font-semibold">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      {selectedTeacher?.education_degree || 'S1'} {selectedTeacher?.major || 'Kependidikan'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-indigo-100 text-indigo-950 font-bold">
                    <span className="flex items-center gap-1 font-normal text-slate-600">
                      <Clock className="w-3 h-3 text-indigo-500" /> Beban Jam:
                    </span>
                    <span>
                      {teacherTotalAssignedJP} JP{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        / Min {selectedTeacher?.min_periods_per_week ?? 24} JP
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Kolom 2: Mata Pelajaran Terklasifikasi Linieritas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Mata Pelajaran</span>
                  {linearSubjects.some((s) => s.id === selectedSubjectId) && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> Linier
                    </span>
                  )}
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white font-medium"
                >
                  {linearSubjects.length > 0 && (
                    <optgroup label="⭐ Linier / Rekomendasi Ijazah">
                      {linearSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          ⭐ {s.subject_name} ({s.subject_code})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={linearSubjects.length > 0 ? 'Mata Pelajaran Lainnya' : 'Semua Mata Pelajaran'}>
                    {otherSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name} ({s.subject_code})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Kolom 3: Total JP Mingguan (Auto-filled by Kurikulum) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Total JP / Minggu</span>
                  <span className="text-[10px] text-slate-400 font-normal">Otomatis Kurikulum</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={totalPeriods}
                  onChange={(e) => setTotalPeriods(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-white font-bold text-center text-indigo-900"
                />
              </div>
            </div>

            {/* Pilihan Multi-Kelas */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block font-bold text-slate-700">
                    Tugaskan ke Kelas (Pilih Satu atau Banyak):
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Tersedia {availableClasses.length} kelas ({assignedClassIdsForTeacher.size} kelas sudah diampu guru ini)
                  </span>
                </div>
                {availableClasses.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllClasses}
                      className="text-[11px] text-indigo-600 hover:underline font-semibold"
                    >
                      Pilih Semua Tersedia
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearClasses}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Kosongkan
                    </button>
                  </div>
                )}
              </div>

              {availableClasses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableClasses.map((cls) => {
                    const isChecked = selectedClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleToggleClass(cls.id)}
                        className={`px-3 py-1.5 rounded-lg font-bold border transition flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-50" />}
                        <span>Kelas {cls.class_name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Guru ini sudah ditugaskan pada seluruh kelas ({classes.length} kelas).
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading || selectedClassIds.length === 0}
                className={`px-5 py-2 rounded-lg text-white font-bold transition flex items-center gap-1.5 ${
                  loading || selectedClassIds.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Penugasan ({selectedClassIds.length} Kelas Terpilih)</span>
              </button>
            </div>
          </form>

          {/* Daftar Penugasan Sedia Ada */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between">
              <span>Daftar Distribusi Penugasan Mengajar ({lessons.length})</span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Mata Pelajaran</th>
                  <th className="p-2.5">Kelas</th>
                  <th className="p-2.5">Guru Pengampu</th>
                  <th className="p-2.5 text-center">Beban JP</th>
                  <th className="p-2.5 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lessons.map((l) => {
                  const tch = teachers.find((t) => t.id === l.teacher_id);
                  const sub = subjects.find((s) => s.id === l.subject_id);
                  const cls = classes.find((c) => c.id === l.class_id);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-slate-800">{sub?.subject_name}</td>
                      <td className="p-2.5 font-semibold text-indigo-700">Kelas {cls?.class_name}</td>
                      <td className="p-2.5 text-slate-700">{tch?.full_name}</td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-700">
                          {l.total_periods ?? l.total_periods_per_week ?? 0} JP
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() =>
                            handleDeleteAssignment(l.id, `${sub?.subject_name} - Kelas ${cls?.class_name}`)
                          }
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Hapus Penugasan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lessons.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                      Belum ada penugasan guru yang dibuat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
