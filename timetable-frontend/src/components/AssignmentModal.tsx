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
  Target,
  AlertTriangle,
  Compass,
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

  const selectedTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId);
  }, [teachers, selectedTeacherId]);

  // 1. Analisis Penugasan Guru Saat Ini (Beban JP, Fokus Jenjang, Fokus Mapel)
  const teacherAnalytics = useMemo(() => {
    if (!selectedTeacherId) {
      return {
        totalJP: 0,
        assignedClassIds: new Set<string>(),
        activeGrades: new Set<number>(),
        dominantGrade: null as number | null,
        activeSubjectIds: new Set<string>(),
      };
    }

    const teacherLessons = lessons.filter((l) => l.teacher_id === selectedTeacherId);
    const totalJP = teacherLessons.reduce(
      (sum, l) => sum + Number(l.total_periods ?? l.total_periods_per_week ?? 0),
      0
    );

    const assignedClassIds = new Set<string>();
    const activeGrades = new Set<number>();
    const gradeCounts = new Map<number, number>();
    const activeSubjectIds = new Set<string>();

    teacherLessons.forEach((l) => {
      assignedClassIds.add(l.class_id);
      activeSubjectIds.add(l.subject_id);
      const cls = classes.find((c) => c.id === l.class_id);
      if (cls?.grade_level) {
        activeGrades.add(cls.grade_level);
        gradeCounts.set(cls.grade_level, (gradeCounts.get(cls.grade_level) || 0) + 1);
      }
    });

    // Cari jenjang kelas yang paling banyak diajar oleh guru ini (Dominant Grade)
    let dominantGrade: number | null = null;
    let maxCount = 0;
    gradeCounts.forEach((count, grade) => {
      if (count > maxCount) {
        maxCount = count;
        dominantGrade = grade;
      }
    });

    return {
      totalJP,
      assignedClassIds,
      activeGrades,
      dominantGrade,
      activeSubjectIds,
    };
  }, [lessons, selectedTeacherId, classes]);

  // 2. Klasifikasi Linieritas Mata Pelajaran
  const { linearSubjects, otherSubjects } = useMemo(() => {
    const eligibleIds = new Set(selectedTeacher?.eligible_subject_ids || []);
    const linear: Subject[] = [];
    const others: Subject[] = [];

    subjects.forEach((s) => {
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

  // Otomatis pilihkan mapel linier pertama saat berganti guru
  useEffect(() => {
    if (linearSubjects.length > 0 && !linearSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(linearSubjects[0].id);
    }
  }, [selectedTeacherId, linearSubjects]);

  // 3. Algoritma Rekomendasi Kelas & Deteksi Mapel Pilihan (Tahap 2)
  const availableClassesWithScores = useMemo(() => {
    // Hitung total JP setiap kelas saat ini untuk mendeteksi kelas yang kekurangan jam mapel pilihan
    const classTotalJPMap = new Map<string, number>();
    const gradeMaxJPMap = new Map<number, number>();

    classes.forEach((c) => {
      const jp = lessons
        .filter((l) => l.class_id === c.id)
        .reduce((sum, l) => sum + Number(l.total_periods ?? l.total_periods_per_week ?? 0), 0);
      classTotalJPMap.set(c.id, jp);
      const currentMax = gradeMaxJPMap.get(c.grade_level) || 0;
      if (jp > currentMax) gradeMaxJPMap.set(c.grade_level, jp);
    });

    return classes
      .filter((cls) => !teacherAnalytics.assignedClassIds.has(cls.id))
      .map((cls) => {
        const isSameDominantGrade =
          teacherAnalytics.dominantGrade !== null && cls.grade_level === teacherAnalytics.dominantGrade;
        const isAlreadyTaughtGrade = teacherAnalytics.activeGrades.has(cls.grade_level);

        // Cek apakah mapel yang dipilih sudah ada pengampunya di kelas ini
        const existingLessonInClass = lessons.find(
          (l) => l.class_id === cls.id && l.subject_id === selectedSubjectId
        );

        // Cek apakah kelas ini masih kekurangan jam dibanding kelas sejenjangnya (butuh mapel pilihan)
        const currentClassJP = classTotalJPMap.get(cls.id) || 0;
        const maxGradeJP = gradeMaxJPMap.get(cls.grade_level) || 0;
        const jpDeficit = maxGradeJP - currentClassJP;

        // Cek aturan kurikulum untuk mapel & jenjang ini
        const currRule = curriculumStructures.find(
          (cs) => cs.grade_level === cls.grade_level && cs.subject_id === selectedSubjectId
        );

        // Skor prioritas pengurutan rekomendasi
        let priorityScore = 0;
        if (isSameDominantGrade) priorityScore += 50;
        else if (isAlreadyTaughtGrade) priorityScore += 30;
        if (!existingLessonInClass) priorityScore += 20;
        if (currRule) priorityScore += 15;
        if (jpDeficit > 0) priorityScore += 10;

        return {
          cls,
          isSameDominantGrade,
          isAlreadyTaughtGrade,
          existingLessonInClass,
          jpDeficit,
          currRule,
          priorityScore,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore || a.cls.class_name.localeCompare(b.cls.class_name));
  }, [classes, teacherAnalytics, lessons, selectedSubjectId, curriculumStructures]);

  // 4. Peringatan Anti-Fragmentasi (Jika guru mengajar terlalu banyak jenjang / terlalu banyak mapel berbeda)
  const fragmentationWarning = useMemo(() => {
    const warnings: string[] = [];

    // Cek jika memilih mapel baru padahal sudah mengajar 2 mapel berbeda
    if (
      selectedSubjectId &&
      teacherAnalytics.activeSubjectIds.size >= 2 &&
      !teacherAnalytics.activeSubjectIds.has(selectedSubjectId)
    ) {
      warnings.push(
        `Guru ini sudah mengampu ${teacherAnalytics.activeSubjectIds.size} mata pelajaran berbeda. Menambah mapel baru akan memecah fokus persiapan bahan ajar.`
      );
    }

    // Cek jika memilih kelas yang membuat guru mengajar di 3 jenjang berbeda sekaligus
    const previewGrades = new Set(teacherAnalytics.activeGrades);
    selectedClassIds.forEach((cId) => {
      const c = classes.find((item) => item.id === cId);
      if (c?.grade_level) previewGrades.add(c.grade_level);
    });

    if (previewGrades.size > 2) {
      warnings.push(
        `Penugasan ini membuat guru mengajar di ${previewGrades.size} tingkat jenjang berbeda (${Array.from(previewGrades)
          .sort()
          .map((g) => `Kelas ${g}`)
          .join(', ')}). Disarankan fokus maksimal pada 1–2 jenjang saja.`
      );
    }

    return warnings;
  }, [selectedSubjectId, selectedClassIds, teacherAnalytics, classes]);

  // Auto-fill Total JP berdasarkan struktur kurikulum saat mapel atau kelas dipilih
  useEffect(() => {
    if (!selectedSubjectId) return;

    const targetGrade =
      selectedClassIds.length > 0
        ? classes.find((c) => c.id === selectedClassIds[0])?.grade_level
        : teacherAnalytics.dominantGrade || classes[0]?.grade_level;

    if (!targetGrade) return;

    const matchedRule = curriculumStructures.find(
      (cs) => cs.grade_level === targetGrade && cs.subject_id === selectedSubjectId
    );

    if (matchedRule && matchedRule.default_periods > 0) {
      setTotalPeriods(matchedRule.default_periods);
    }
  }, [selectedSubjectId, selectedClassIds, classes, curriculumStructures, teacherAnalytics.dominantGrade]);

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

  // Pilih otomatis hanya kelas pada jenjang yang direkomendasikan (Fokus 1 Jenjang)
  const handleSelectRecommendedGradeClasses = () => {
    const targetGrade =
      teacherAnalytics.dominantGrade ||
      availableClassesWithScores[0]?.cls.grade_level;
    if (!targetGrade) return;

    const recommendedIds = availableClassesWithScores
      .filter((item) => item.cls.grade_level === targetGrade && !item.existingLessonInClass)
      .map((item) => item.cls.id);

    setSelectedClassIds(recommendedIds);
  };

  const handleSelectAllClasses = () => {
    setSelectedClassIds(availableClassesWithScores.map((item) => item.cls.id));
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

  // Cek apakah mapel yang dipilih merupakan mapel Pilihan/Peminatan pada kurikulum
  const currentSubjectElectiveInfo = useMemo(() => {
    return curriculumStructures.find(
      (cs) => cs.subject_id === selectedSubjectId && cs.is_compulsory === false
    );
  }, [curriculumStructures, selectedSubjectId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">Penugasan Mengajar Cerdas (Rekomendasi Linieritas & Fokus Jenjang)</h2>
              <p className="text-xs text-slate-400">
                Sistem otomatis menyarankan mapel linier, standar JP kurikulum, dan konsentrasi jenjang kelas
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
          <form onSubmit={handleSaveAssignment} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Pilih Guru */}
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

                <div className="mt-1.5 p-2 bg-indigo-50/80 border border-indigo-200 rounded-lg space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-indigo-900 font-semibold">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      {selectedTeacher?.education_degree || 'S1'} — {selectedTeacher?.major || 'Umum'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-indigo-100">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-500" /> Total Ditugaskan:
                    </span>
                    <span className="font-mono font-bold text-indigo-950">
                      {teacherAnalytics.totalJP} JP / Min {selectedTeacher?.min_periods_per_week ?? 24} JP
                    </span>
                  </div>
                  {teacherAnalytics.dominantGrade && (
                    <div className="flex items-center justify-between text-[10px] text-emerald-800 font-bold pt-0.5">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-emerald-600" /> Fokus Saat Ini:
                      </span>
                      <span>Jenjang Kelas {teacherAnalytics.dominantGrade}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Pilih Mata Pelajaran (Dikelompokkan Linieritas) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Mata Pelajaran</span>
                  {linearSubjects.some((s) => s.id === selectedSubjectId) ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> Sesuai Ijazah
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                      Lintas Bidang
                    </span>
                  )}
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white font-medium"
                >
                  {linearSubjects.length > 0 && (
                    <optgroup label="⭐ Linier / Diizinkan Sesuai Ijazah">
                      {linearSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          ⭐ {s.subject_name} ({s.subject_code})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={linearSubjects.length > 0 ? '⚠️ Mata Pelajaran Lintas Bidang' : 'Daftar Mata Pelajaran'}>
                    {otherSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name} ({s.subject_code})
                      </option>
                    ))}
                  </optgroup>
                </select>

                {currentSubjectElectiveInfo && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 flex items-start gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Mapel Pilihan/Peminatan:</strong> Tidak wajib ada di seluruh kelas pada jenjang Kelas {currentSubjectElectiveInfo.grade_level}. Pilih hanya kelas rombel peminatan terkait.
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Total JP / Minggu */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Total JP / Minggu</span>
                  <span className="text-[10px] text-indigo-600 font-semibold">Auto-Kurikulum</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={totalPeriods}
                  onChange={(e) => setTotalPeriods(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-white font-bold text-center text-indigo-900 text-sm"
                />
                {selectedClassIds.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                    Tambahan beban: <strong>+{selectedClassIds.length * totalPeriods} JP</strong> (Total menjadi{' '}
                    <strong>{teacherAnalytics.totalJP + selectedClassIds.length * totalPeriods} JP</strong>)
                  </p>
                )}
              </div>
            </div>

            {/* Peringatan Anti-Fragmentasi (Jika mengajar terlalu banyak jenjang/mapel) */}
            {fragmentationWarning.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-1">
                {fragmentationWarning.map((warn, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pilihan Kelas dengan Rekomendasi Pintar */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div>
                  <label className="block font-bold text-slate-700">
                    Tugaskan ke Kelas (Diurutkan Berdasarkan Rekomendasi Fokus Jenjang):
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Tersedia {availableClassesWithScores.length} kelas yang belum diajar oleh guru ini
                  </span>
                </div>

                {availableClassesWithScores.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectRecommendedGradeClasses}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>
                        Pilih Fokus Kelas{' '}
                        {teacherAnalytics.dominantGrade || availableClassesWithScores[0]?.cls.grade_level}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllClasses}
                      className="text-[11px] text-indigo-600 hover:underline font-semibold"
                    >
                      Pilih Semua
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

              {availableClassesWithScores.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {availableClassesWithScores.map(({ cls, isSameDominantGrade, existingLessonInClass, jpDeficit }) => {
                    const isChecked = selectedClassIds.includes(cls.id);
                    const existingTeacher = existingLessonInClass
                      ? teachers.find((t) => t.id === existingLessonInClass.teacher_id)
                      : null;

                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleToggleClass(cls.id)}
                        className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : isSameDominantGrade
                            ? 'bg-emerald-50/70 text-slate-800 border-emerald-300 hover:bg-emerald-100/70'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5 font-bold">
                            {isChecked ? (
                              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 opacity-40 shrink-0" />
                            )}
                            <span>Kelas {cls.class_name}</span>
                          </div>
                          {isSameDominantGrade && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                isChecked ? 'bg-indigo-500 text-white' : 'bg-emerald-200 text-emerald-900'
                              }`}
                            >
                              ⭐ Fokus
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 pl-5 text-[9.5px] leading-tight">
                          {existingTeacher ? (
                            <span className={isChecked ? 'text-amber-200' : 'text-amber-700 font-semibold'}>
                              Diampu: {existingTeacher.teacher_code}
                            </span>
                          ) : jpDeficit > 0 ? (
                            <span className={isChecked ? 'text-indigo-100' : 'text-indigo-600 font-semibold'}>
                              Butuh +{jpDeficit} JP
                            </span>
                          ) : (
                            <span className={isChecked ? 'text-indigo-200' : 'text-slate-400'}>
                              Tingkat {cls.grade_level}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Guru ini sudah ditugaskan di seluruh kelas ({classes.length} kelas).
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

          {/* Daftar Distribusi Penugasan */}
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
