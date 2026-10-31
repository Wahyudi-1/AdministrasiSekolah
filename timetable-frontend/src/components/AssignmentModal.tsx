import React, { useState, useMemo, useEffect } from 'react';
import { X, UserCheck, Plus, Trash2, AlertCircle, CheckSquare, Square, Clock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, Subject, ClassRoom, Lesson } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassRoom[];
  lessons: Lesson[];
  schoolId: string; // <-- Isolasi Multi-Tenant
  onDataUpdated: () => void;
}

export const AssignmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  subjects,
  classes,
  lessons,
  schoolId,
  onDataUpdated,
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [totalPeriods, setTotalPeriods] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Inisialisasi pilihan default saat data guru dan mapel tersedia
  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) setSelectedTeacherId(teachers[0].id);
    if (!selectedSubjectId && subjects.length > 0) setSelectedSubjectId(subjects[0].id);
  }, [teachers, subjects, selectedTeacherId, selectedSubjectId]);

  // Data guru yang sedang dipilih
  const selectedTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId);
  }, [teachers, selectedTeacherId]);

  // 1. Hitung total jam pelajaran (JP) yang sudah ditugaskan ke guru yang dipilih
  const teacherTotalAssignedJP = useMemo(() => {
    if (!selectedTeacherId) return 0;
    return lessons
      .filter((l) => l.teacher_id === selectedTeacherId)
      .reduce((sum, l) => sum + Number(l.total_periods ?? l.total_periods_per_week ?? 0), 0);
  }, [lessons, selectedTeacherId]);

  // 2. Kumpulkan seluruh ID kelas yang SUDAH diajar oleh guru ini (apapun mapelnya)
  const assignedClassIdsForTeacher = useMemo(() => {
    if (!selectedTeacherId) return new Set<string>();
    const classIdSet = new Set<string>();
    lessons
      .filter((l) => l.teacher_id === selectedTeacherId)
      .forEach((l) => classIdSet.add(l.class_id));
    return classIdSet;
  }, [lessons, selectedTeacherId]);

  // 3. Saring kelas: hanya tampilkan kelas yang BELUM diajar oleh guru ini
  const availableClasses = useMemo(() => {
    return classes.filter((cls) => !assignedClassIdsForTeacher.has(cls.id));
  }, [classes, assignedClassIdsForTeacher]);

  if (!isOpen) return null;

  // Handler pergantian guru: reset pilihan kelas yang aktif agar tidak tertinggal
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
        // Cari penugasan spesifik sekolah dan kelas tujuan
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
                Atur guru, mapel, kelas tujuan (multi-kelas), dan total JP per minggu
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form & List Penugasan */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          <form onSubmit={handleSaveAssignment} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

                {/* Badge Total Beban JP Guru Terpilih */}
                <div className="mt-1.5 p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Total Jam Ditugaskan:</span>
                  </div>
                  <div className="font-bold text-indigo-950 font-mono">
                    {teacherTotalAssignedJP} JP
                    {selectedTeacher?.min_periods_per_week ? (
                      <span className="text-[10px] text-slate-500 font-normal ml-1">
                        / Min {selectedTeacher.min_periods_per_week} JP
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white font-medium"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject_name} ({s.subject_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Total JP / Minggu</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={totalPeriods}
                  onChange={(e) => setTotalPeriods(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-white font-bold text-center"
                />
              </div>
            </div>

            {/* Pilihan Multi-Kelas (Kelas yang sudah diajar disembunyikan) */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block font-bold text-slate-700">
                    Tugaskan ke Kelas (Pilih Satu atau Banyak):
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Tersedia {availableClasses.length} dari {classes.length} kelas ({assignedClassIdsForTeacher.size} kelas sudah diajar guru ini)
                  </span>
                </div>
                {availableClasses.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllClasses}
                      className="text-[11px] text-indigo-600 hover:underline font-semibold"
                    >
                      Pilih Semua Kelas Tersedia
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
                    Guru ini sudah ditugaskan di seluruh kelas ({classes.length} kelas). Tidak ada kelas lain yang tersedia untuk guru ini.
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

          {/* Daftar Penugasan yang Sudah Ada */}
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

        {/* Footer Modal */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
