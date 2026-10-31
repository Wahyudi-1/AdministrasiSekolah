import React, { useState, useMemo } from 'react';
import {
  X,
  Scale,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Layers,
  Award,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Teacher, ClassRoom, Lesson, Subject } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  classes: ClassRoom[];
  lessons: Lesson[];
  subjects: Subject[];
}

export const WorkloadAuditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  classes,
  lessons,
  subjects,
}) => {
  const [activeTab, setActiveTab] = useState<'TEACHERS' | 'CLASSES'>('TEACHERS');

  // 1. Audit Jam Mengajar Guru (Sinkron dengan AssignmentModal)
  const teacherAudits = useMemo(() => {
    return teachers.map((tch) => {
      const assignedLessons = lessons.filter((l) => l.teacher_id === tch.id);
      const totalAllocatedJP = assignedLessons.reduce(
        (sum, l) => sum + Number(l.total_periods ?? l.total_periods_per_week ?? 0),
        0
      );
      const minTarget = tch.min_periods_per_week ?? 24;
      const isFulfilled = totalAllocatedJP >= minTarget;
      const diff = totalAllocatedJP - minTarget;

      // Rincian mapel & kelas yang diampu untuk laporan Excel
      const details = assignedLessons
        .map((l) => {
          const sub = subjects.find((s) => s.id === l.subject_id);
          const cls = classes.find((c) => c.id === l.class_id);
          const jp = Number(l.total_periods ?? l.total_periods_per_week ?? 0);
          return `${sub?.subject_name || 'Mapel'} - ${cls?.class_name || 'Kelas'} (${jp} JP)`;
        })
        .join('; ');

      return {
        teacher: tch,
        totalAllocatedJP,
        minTarget,
        isFulfilled,
        diff,
        assignedCount: assignedLessons.length,
        details,
      };
    });
  }, [teachers, lessons, subjects, classes]);

  // 2. Audit Keseimbangan Akumulatif Jam Kelas per Jenjang
  const gradeLevelAudits = useMemo(() => {
    const gradesMap = new Map<number | string, { classItem: ClassRoom; totalJP: number }[]>();

    classes.forEach((cls) => {
      const grade = cls.grade_level || 'Lainnya';
      const classLessons = lessons.filter((l) => l.class_id === cls.id);
      const totalJP = classLessons.reduce(
        (sum, l) => sum + Number(l.total_periods ?? l.total_periods_per_week ?? 0),
        0
      );

      if (!gradesMap.has(grade)) {
        gradesMap.set(grade, []);
      }
      gradesMap.get(grade)!.push({ classItem: cls, totalJP });
    });

    return Array.from(gradesMap.entries()).map(([grade, classList]) => {
      const jpValues = classList.map((c) => c.totalJP);
      const minJP = Math.min(...jpValues);
      const maxJP = Math.max(...jpValues);
      const isBalanced = minJP === maxJP && minJP > 0;
      const expectedJP = maxJP;

      return {
        grade,
        classList,
        isBalanced,
        minJP,
        maxJP,
        expectedJP,
      };
    });
  }, [classes, lessons]);

  // 3. Fungsi Ekspor Laporan Audit ke Excel (2 Sheets)
  const handleExportAuditExcel = () => {
    const wb = XLSX.utils.book_new();

    // --- SHEET 1: AUDIT JAM MENGAJAR GURU ---
    const teacherRows: any[] = [
      [
        'No',
        'Kode Guru',
        'Nama Lengkap Guru',
        'Jumlah Kartu Penugasan',
        'Total Jam Terdaftar (JP/Pekan)',
        'Target Jam Minimal (JP)',
        'Selisih (JP)',
        'Status Kecukupan Jam',
        'Maks Jam Berturut-turut',
        'Maks Jam Harian',
        'Rincian Penugasan Mapel & Kelas',
      ],
    ];

    teacherAudits.forEach((item, index) => {
      teacherRows.push([
        index + 1,
        item.teacher.teacher_code,
        item.teacher.full_name,
        item.assignedCount,
        item.totalAllocatedJP,
        item.minTarget,
        item.diff >= 0 ? `+${item.diff}` : item.diff,
        item.isFulfilled ? 'TERCAPAI' : `KURANG ${Math.abs(item.diff)} JP`,
        item.teacher.max_consecutive_periods ?? 4,
        item.teacher.max_periods_per_day ?? 8,
        item.details || '-',
      ]);
    });

    const wsTeachers = XLSX.utils.aoa_to_sheet(teacherRows);
    wsTeachers['!cols'] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 28 },
      { wch: 22 },
      { wch: 26 },
      { wch: 22 },
      { wch: 12 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 55 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'Audit Jam Guru');

    // --- SHEET 2: AUDIT KESEIMBANGAN JENJANG KELAS ---
    const classRows: any[] = [
      [
        'No',
        'Jenjang Tingkat',
        'Nama Kelas / Rombel',
        'Total Akumulasi Jam (JP/Pekan)',
        'Standar Jam Jenjang (JP)',
        'Selisih Jam Kelas (JP)',
        'Status Keseimbangan Jenjang',
      ],
    ];

    let rowNum = 1;
    gradeLevelAudits.forEach((group) => {
      group.classList.forEach((cls) => {
        const diff = cls.totalJP - group.maxJP;
        classRows.push([
          rowNum++,
          `Kelas ${group.grade}`,
          cls.classItem.class_name,
          cls.totalJP,
          group.expectedJP,
          diff,
          group.isBalanced
            ? 'SEIMBANG SERAGAM'
            : diff === 0
            ? 'SESUAI STANDAR TERTINGGI'
            : `KURANG ${Math.abs(diff)} JP DARI ROMBEL LAIN`,
        ]);
      });
    });

    const wsClasses = XLSX.utils.aoa_to_sheet(classRows);
    wsClasses['!cols'] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 20 },
      { wch: 28 },
      { wch: 24 },
      { wch: 22 },
      { wch: 32 },
    ];
    XLSX.utils.book_append_sheet(wb, wsClasses, 'Keseimbangan Kelas');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_Audit_Beban_Mengajar_&_Kelas_${dateStr}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold">Audit Beban Mengajar & Keseimbangan Jam</h2>
              <p className="text-[11px] text-slate-400">
                Verifikasi jam minimal guru dan kesetaraan akumulasi jam per jenjang kelas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAuditExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-sm"
              title="Unduh Laporan Audit lengkap dalam format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Laporan Audit (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-3 font-bold shrink-0">
          <button
            onClick={() => setActiveTab('TEACHERS')}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'TEACHERS'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Kecukupan Jam Guru ({teachers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('CLASSES')}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'CLASSES'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Keseimbangan Jenjang Kelas ({gradeLevelAudits.length} Jenjang)</span>
          </button>
        </div>

        {/* Isi Tab */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'TEACHERS' ? (
            /* TAB 1: AUDIT JAM GURU */
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-indigo-900">
                <span className="font-semibold">
                  Guru yang telah memenuhi target jam minimal pekanan:
                </span>
                <span className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs">
                  {teacherAudits.filter((a) => a.isFulfilled).length} / {teachers.length} Guru
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Nama Guru</th>
                      <th className="p-2.5 text-center">Kode</th>
                      <th className="p-2.5 text-center">Jumlah Kartu</th>
                      <th className="p-2.5 text-center">Total Jam Terdaftar</th>
                      <th className="p-2.5 text-center">Target Minimal</th>
                      <th className="p-2.5 text-center">Status Kelayakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacherAudits.map((item) => (
                      <tr key={item.teacher.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{item.teacher.full_name}</td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{item.teacher.teacher_code}</td>
                        <td className="p-2.5 text-center font-semibold text-slate-700">{item.assignedCount} Kartu</td>
                        <td className="p-2.5 text-center font-mono font-bold text-indigo-900">
                          {item.totalAllocatedJP} JP / Pekan
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">
                          {item.minTarget} JP
                        </td>
                        <td className="p-2.5 text-center">
                          {item.isFulfilled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Tercapai (+{item.diff} JP)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Kurang {Math.abs(item.diff)} JP</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 2: AUDIT KESEIMBANGAN JAM JENJANG KELAS */
            <div className="space-y-4">
              {gradeLevelAudits.map((gradeGroup) => (
                <div
                  key={gradeGroup.grade}
                  className={`p-4 rounded-xl border transition ${
                    gradeGroup.isBalanced
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-amber-50/50 border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Award className={`w-4 h-4 ${gradeGroup.isBalanced ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <h3 className="font-bold text-slate-900 text-sm">
                        Jenjang Tingkat: Kelas {gradeGroup.grade}
                      </h3>
                      <span className="text-slate-500 font-medium">
                        ({gradeGroup.classList.length} Rombongan Belajar)
                      </span>
                    </div>

                    {gradeGroup.isBalanced ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Akumulasi Seimbang ({gradeGroup.expectedJP} JP / Pekan)</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Belum Sama (Rentang: {gradeGroup.minJP} s.d. {gradeGroup.maxJP} JP)</span>
                      </span>
                    )}
                  </div>

                  {/* Rincian Akumulatif Tiap Kelas pada Jenjang Ini */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {gradeGroup.classList.map((cls) => {
                      const isClassDiscrepant = cls.totalJP !== gradeGroup.maxJP;
                      return (
                        <div
                          key={cls.classItem.id}
                          className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                            isClassDiscrepant
                              ? 'bg-white border-amber-400 shadow-sm'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <span className="font-bold text-slate-800">
                            Kelas {cls.classItem.class_name}
                          </span>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="font-mono font-bold text-indigo-900 text-sm">
                              {cls.totalJP} JP
                            </span>
                            {isClassDiscrepant && (
                              <span className="text-[10px] font-bold text-rose-600">
                                -{gradeGroup.maxJP - cls.totalJP} JP
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            * Gunakan tombol Ekspor Laporan di kanan atas untuk mengunduh rincian lengkap ke Excel.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
