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
  Layers,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, Subject, ClassRoom, Lesson, CurriculumStructure } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers?: Teacher[];
  subjects?: Subject[];
  classes?: ClassRoom[];
  lessons?: Lesson[];
  curriculumStructures?: CurriculumStructure[];
  schoolId: string;
  onDataUpdated: () => void;
}

export const AssignmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers = [],
  subjects = [],
  classes = [],
  lessons = [],
  curriculumStructures = [],
  schoolId,
  onDataUpdated,
}) => {
  // 1. STATE DASAR
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 2. INISIALISASI DEFAULT GURU & MAPEL
  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) setSelectedTeacherId(teachers[0].id);
    if (!selectedSubjectId && subjects.length > 0) setSelectedSubjectId(subjects[0].id);
  }, [teachers, subjects, selectedTeacherId, selectedSubjectId]);

  // 3. OBJEK GURU & MAPEL TERPILIH
  const selectedTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId);
  }, [teachers, selectedTeacherId]);

  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  // 4. ANALISIS BEBAN & AFINITAS GURU SAAT INI
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
      if (l.class_id) assignedClassIds.add(l.class_id);
      if (l.subject_id) activeSubjectIds.add(l.subject_id);
      const cls = classes.find((c) => c.id === l.class_id);
      if (cls?.grade_level) {
        activeGrades.add(cls.grade_level);
        gradeCounts.set(cls.grade_level, (gradeCounts.get(cls.grade_level) || 0) + 1);
      }
    });

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

  // 5. PEMBAGIAN MAPEL LINIER VS LINTAS BIDANG
  const { linearSubjects, otherSubjects } = useMemo(() => {
    const eligibleIds = new Set(selectedTeacher?.eligible_subject_ids || []);
    const linear: Subject[] = [];
    const others: Subject[] = [];
    const teacherMajor = String(selectedTeacher?.major || '').toLowerCase().trim();

    subjects.forEach((s) => {
      const isExplicitEligible = eligibleIds.has(s.id);
      const subName = String(s.subject_name || '').toLowerCase();
      const isMajorMatch = teacherMajor.length > 0 && subName.includes(teacherMajor);

      if (isExplicitEligible || isMajorMatch) {
        linear.push(s);
      } else {
        others.push(s);
      }
    });

    return { linearSubjects: linear, otherSubjects: others };
  }, [subjects, selectedTeacher]);

  useEffect(() => {
    if (linearSubjects.length > 0 && !linearSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(linearSubjects[0].id);
    }
  }, [selectedTeacherId, linearSubjects]);

  // 6. ATURAN STRUKTUR KURIKULUM & DAFTAR JENJANG AKTIF UNTUK MAPEL INI
  const subjectCurriculumRules = useMemo(() => {
    if (!selectedSubjectId) return [];
    return curriculumStructures.filter((cs) => cs.subject_id === selectedSubjectId);
  }, [curriculumStructures, selectedSubjectId]);

  const allowedGradeLevels = useMemo(() => {
    return new Set(subjectCurriculumRules.map((cs) => cs.grade_level));
  }, [subjectCurriculumRules]);

  // 7. PENYARINGAN KELAS KETAT: HANYA KELAS YANG JENJANGNYA TERDAFTAR PADA MAPEL INI
  const availableClassesWithScores = useMemo(() => {
    // Filter hanya kelas yang jenjangnya terdaftar di kurikulum untuk mapel ini
    // dan belum pernah diajar oleh guru ini
    const filteredClasses = classes.filter((cls) => {
      const isGradeAllowed = allowedGradeLevels.has(cls.grade_level);
      const isNotAssignedToTeacher = !teacherAnalytics.assignedClassIds.has(cls.id);
      return isGradeAllowed && isNotAssignedToTeacher;
    });

    // Statistik beban jam kelas
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

    return filteredClasses
      .map((cls) => {
        const isSameDominantGrade =
          teacherAnalytics.dominantGrade !== null && cls.grade_level === teacherAnalytics.dominantGrade;
        const isAlreadyTaughtGrade = teacherAnalytics.activeGrades.has(cls.grade_level);

        const existingLessonInClass = lessons.find(
          (l) => l.class_id === cls.id && l.subject_id === selectedSubjectId
        );

        const currentClassJP = classTotalJPMap.get(cls.id) || 0;
        const maxGradeJP = gradeMaxJPMap.get(cls.grade_level) || 0;
        const jpDeficit = maxGradeJP - currentClassJP;

        const currRule = subjectCurriculumRules.find(
          (cs) => cs.grade_level === cls.grade_level
        );

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
      .sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        return String(a.cls.class_name || '').localeCompare(String(b.cls.class_name || ''));
      });
  }, [classes, allowedGradeLevels, teacherAnalytics, lessons, selectedSubjectId, subjectCurriculumRules]);

  // Bersihkan pilihan kelas yang tidak lagi relevan saat mapel atau guru berganti
  useEffect(() => {
    setSelectedClassIds((prev) =>
      prev.filter((cId) => availableClassesWithScores.some((item) => item.cls.id === cId))
    );
  }, [selectedSubjectId, selectedTeacherId, availableClassesWithScores]);

  // 8. RINGKASAN TAMBAHAN JP OTOMATIS BERDASARKAN KELAS TERPILIH
  const selectedClassesSummary = useMemo(() => {
    let totalAddedJP = 0;
    selectedClassIds.forEach((cId) => {
      const cls = classes.find((c) => c.id === cId);
      if (cls) {
        const rule = subjectCurriculumRules.find((cs) => cs.grade_level === cls.grade_level);
        totalAddedJP += rule?.default_periods ?? 0;
      }
    });

    return {
      count: selectedClassIds.length,
      totalAddedJP,
      newTotalTeacherJP: teacherAnalytics.totalJP + totalAddedJP,
    };
  }, [selectedClassIds, classes, subjectCurriculumRules, teacherAnalytics.totalJP]);

  // 9. INFO MAPEL PILIHAN & PERINGATAN FRAGMENTASI
  const currentSubjectElectiveInfo = useMemo(() => {
    return curriculumStructures.find(
      (cs) => cs.subject_id === selectedSubjectId && cs.is_compulsory === false
    );
  }, [curriculumStructures, selectedSubjectId]);

  const fragmentationWarning = useMemo(() => {
    const warnings: string[] = [];

    if (
      selectedSubjectId &&
      teacherAnalytics.activeSubjectIds.size >= 2 &&
      !teacherAnalytics.activeSubjectIds.has(selectedSubjectId)
    ) {
      warnings.push(
        `Guru ini sudah mengampu ${teacherAnalytics.activeSubjectIds.size} mata pelajaran berbeda. Menambah mapel baru akan memecah konsentrasi bahan ajar.`
      );
    }

    const previewGrades = new Set(teacherAnalytics.activeGrades);
    selectedClassIds.forEach((cId) => {
      const c = classes.find((item) => item.id === cId);
      if (c?.grade_level) previewGrades.add(c.grade_level);
    });

    if (previewGrades.size > 2) {
      warnings.push(
        `Penugasan ini menyebabkan guru mengajar di ${previewGrades.size} tingkat jenjang (${Array.from(previewGrades)
          .sort()
          .map((g) => `Kelas ${g}`)
          .join(', ')}). Disarankan fokus maksimal pada 1–2 jenjang.`
      );
    }

    return warnings;
  }, [selectedSubjectId, selectedClassIds, teacherAnalytics, classes]);

  // =========================================================================
  // SELURUH HOOK DI ATAS TUNTAS DIEKSEKUSI. BARU EARLY RETURN DI SINI:
  // =========================================================================
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

  // Simpan Penugasan: Setiap kelas otomatis menggunakan standar JP jenjangnya dari kurikulum
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
      for (const classId of selectedClassIds) {
        const targetClass = classes.find((c) => c.id === classId);
        const currRule = subjectCurriculumRules.find(
          (cs) => cs.grade_level === targetClass?.grade_level
        );
        const assignedPeriods = currRule?.default_periods ?? 4;

        const defaultSplit =
          assignedPeriods === 1 ? '1' :
          assignedPeriods === 2 ? '2' :
          assignedPeriods === 3 ? '2+1' :
          assignedPeriods === 4 ? '2+2' :
          assignedPeriods === 5 ? '3+2' :
          assignedPeriods === 6 ? '3+3' :
          `${Math.ceil(assignedPeriods / 2)}+${Math.floor(assignedPeriods / 2)}`;

        const existing = lessons.find(
          (l) => l.class_id === classId && l.subject_id === selectedSubjectId
        );

        if (existing) {
          const { error } = await supabase
            .from('lessons')
            .update({
              teacher_id: selectedTeacherId,
              total_periods_per_week: Number(assignedPeriods),
              total_periods: Number(assignedPeriods),
              split_pattern: defaultSplit,
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
              total_periods_per_week: Number(assignedPeriods),
              total_periods: Number(assignedPeriods),
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">Penugasan Mengajar Guru (Distribusi Jam KBM)</h2>
              <p className="text-xs text-slate-400">
                Alokasi otomatis mengikuti standar JP kurikulum dan menyaring rombel sesuai jenjang mapel
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
              {/* Kolom 1: Pilih Guru */}
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
                      <Clock className="w-3 h-3 text-indigo-500" /> Beban Terdaftar:
                    </span>
                    <span className="font-mono font-bold text-indigo-950">
                      {teacherAnalytics.totalJP} JP / Min {selectedTeacher?.min_periods_per_week ?? 24} JP
                    </span>
                  </div>
                  {teacherAnalytics.dominantGrade && (
                    <div className="flex items-center justify-between text-[10px] text-emerald-800 font-bold pt-0.5">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-emerald-600" /> Fokus Jenjang:
                      </span>
                      <span>Tingkat Kelas {teacherAnalytics.dominantGrade}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Kolom 2: Pilih Mata Pelajaran */}
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
                      <strong>Mapel Pilihan/Peminatan:</strong> Hanya ditugaskan ke kelas rombel peminatan tertentu di jenjang Kelas {currentSubjectElectiveInfo.grade_level}.
                    </span>
                  </div>
                )}
              </div>

              {/* Kolom 3: Info Standar Alokasi JP Kurikulum (Input manual sudah dihapus) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Standar JP Kurikulum</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-600" /> Otomatis
                  </span>
                </label>
                
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 min-h-[76px] flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                      Jenjang & Beban Baku Mapel Ini:
                    </span>
                    {subjectCurriculumRules.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {subjectCurriculumRules.map((rule) => (
                          <span
                            key={rule.id}
                            className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-[10.5px]"
                          >
                            Kelas {rule.grade_level}: <span className="font-mono text-indigo-700">{rule.default_periods} JP</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10.5px] text-rose-600 font-semibold italic">
                        Belum ada standar JP di kurikulum
                      </span>
                    )}
                  </div>

                  {selectedClassesSummary.count > 0 && (
                    <div className="pt-1.5 border-t border-slate-100 text-[10.5px] text-slate-600 flex items-center justify-between">
                      <span>Total Tambahan:</span>
                      <strong className="text-emerald-700 font-mono text-xs">
                        +{selectedClassesSummary.totalAddedJP} JP ({selectedClassesSummary.count} Kelas)
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Peringatan Anti-Fragmentasi */}
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

            {/* Pilihan Rombel Kelas (Hanya Jenjang yang Sesuai Kurikulum Mapel Terpilih) */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div>
                  <label className="block font-bold text-slate-700">
                    Tugaskan ke Kelas (Hanya Jenjang yang Memuat Mapel {selectedSubject?.subject_name}):
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Tersedia {availableClassesWithScores.length} kelas di jenjang{' '}
                    {Array.from(allowedGradeLevels).sort().map((g) => `Kelas ${g}`).join(', ') || '-'}
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

              {allowedGradeLevels.size === 0 ? (
                /* Jika mapel belum didaftarkan di jenjang manapun pada master kurikulum */
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-3">
                  <Compass className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Mata Pelajaran Belum Memiliki Konfigurasi Jenjang di Kurikulum</p>
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      Mata pelajaran <strong>{selectedSubject?.subject_name}</strong> belum dimasukkan ke jenjang kelas manapun pada menu <strong>Master Data &amp; Kurikulum &rarr; 2. Standar JP Jenjang</strong>.
                      Silakan tetapkan standar JP jenjangnya terlebih dahulu agar rombongan belajar kelas dapat dimunculkan di sini.
                    </p>
                  </div>
                </div>
              ) : availableClassesWithScores.length > 0 ? (
                /* Grid Kelas yang Sesuai Jenjang Mapel */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {availableClassesWithScores.map(({ cls, isSameDominantGrade, existingLessonInClass, jpDeficit, currRule }) => {
                    const isChecked = selectedClassIds.includes(cls.id);
                    const existingTeacher = existingLessonInClass
                      ? teachers.find((t) => t.id === existingLessonInClass.teacher_id)
                      : null;

                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleToggleClass(cls.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
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
                          
                          {/* Label Beban JP Otomatis Kurikulum */}
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                              isChecked
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {currRule?.default_periods ?? '-'} JP
                          </span>
                        </div>

                        <div className="mt-2 pl-5 text-[9.5px] leading-tight flex items-center justify-between">
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

                          {isSameDominantGrade && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                isChecked ? 'bg-indigo-400 text-white' : 'bg-emerald-200 text-emerald-900'
                              }`}
                            >
                              ⭐ Fokus
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Seluruh kelas di jenjang mapel ini ({Array.from(allowedGradeLevels).map((g) => `Kelas ${g}`).join(', ')}) sudah diajar oleh guru ini.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedClassesSummary.count > 0 ? (
                  <>
                    Beban guru akan menjadi{' '}
                    <strong className="text-indigo-900 font-bold">{selectedClassesSummary.newTotalTeacherJP} JP</strong>{' '}
                    (ditambah {selectedClassesSummary.totalAddedJP} JP dari {selectedClassesSummary.count} kelas terpilih).
                  </>
                ) : (
                  'Pilih kelas di atas untuk menerapkan penugasan.'
                )}
              </span>

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
                <span>
                  Simpan Penugasan ({selectedClassesSummary.count} Kelas | +{selectedClassesSummary.totalAddedJP} JP)
                </span>
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
