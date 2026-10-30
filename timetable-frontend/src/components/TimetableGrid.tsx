import React, { useMemo } from 'react';
import {
  WorkDay,
  TimeSlot,
  Teacher,
  ClassRoom,
  Room,
  Subject,
  Lesson,
  ScheduleItem,
} from '../types';
import { BarChart3, Clock, CheckCircle2 } from 'lucide-react';

interface TimetableGridProps {
  workDays: WorkDay[];
  timeSlots: TimeSlot[];
  teachers: Teacher[];
  classes: ClassRoom[];
  rooms: Room[];
  subjects: Subject[];
  lessons: Lesson[];
  schedules: ScheduleItem[];
  filterMode: 'CLASS' | 'TEACHER';
  selectedId: string;
  showChartInPrint?: boolean; // Properti toggle cetak grafik bar
  onScheduleUpdated?: () => void;
}

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  workDays,
  timeSlots,
  teachers,
  classes,
  rooms,
  subjects,
  lessons,
  schedules,
  filterMode,
  selectedId,
  showChartInPrint = true,
}) => {
  const activeDays = useMemo(
    () => workDays.filter((d) => d.is_active).sort((a, b) => a.day_index - b.day_index),
    [workDays]
  );

  const periods = useMemo(() => {
    const periodSet = new Set<number>();
    timeSlots.forEach((slot) => periodSet.add(slot.period_number));
    return Array.from(periodSet).sort((a, b) => a - b);
  }, [timeSlots]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const lessonMap = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);

  // Statistik Beban Harian Guru
  const teacherDailyStats = useMemo(() => {
    if (filterMode !== 'TEACHER' || !selectedId) return null;

    const teacher = teacherMap.get(selectedId);
    let totalWeekJP = 0;

    const dayBreakdown = activeDays.map((day) => {
      const daySlots = timeSlots
        .filter((s) => s.day_index === day.day_index && s.slot_type !== 'BREAK')
        .sort((a, b) => a.period_number - b.period_number);

      const activePeriods: number[] = [];

      daySlots.forEach((slot) => {
        const item = schedules.find(
          (sc) => sc.time_slot_id === slot.id && sc.teacher_id === selectedId
        );
        if (item) {
          activePeriods.push(slot.period_number);
        }
      });

      const countJP = activePeriods.length;
      totalWeekJP += countJP;

      let gapCount = 0;
      if (countJP >= 2) {
        const minP = Math.min(...activePeriods);
        const maxP = Math.max(...activePeriods);
        gapCount = maxP - minP + 1 - countJP;
      }

      return {
        dayName: day.day_name,
        dayIndex: day.day_index,
        jpCount: countJP,
        gapCount,
        activePeriods,
      };
    });

    const maxDayJP = Math.max(...dayBreakdown.map((d) => d.jpCount), 1);
    const avgDaily = (totalWeekJP / (activeDays.length || 1)).toFixed(1);

    return {
      teacher,
      totalWeekJP,
      avgDaily,
      maxDayJP,
      dayBreakdown,
    };
  }, [filterMode, selectedId, activeDays, timeSlots, schedules, teacherMap]);

  return (
    <div className="space-y-3">
      {/* =========================================================================
          GRAFIK BATANG BEBAN HARIAN GURU
          (Memiliki toggle showChartInPrint agar dapat disembunyikan saat cetak)
          ========================================================================= */}
      {filterMode === 'TEACHER' && teacherDailyStats && (
        <div
          className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm ${
            showChartInPrint
              ? 'print:border print:border-slate-300 print:p-2 print:mb-2 print:shadow-none print:break-inside-avoid'
              : 'print:hidden'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 print:border-slate-200 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-indigo-50 text-indigo-600 print:hidden">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs print:text-[8pt] print:font-extrabold">
                  Distribusi Beban Mengajar Harian: {teacherDailyStats.teacher?.full_name} ({teacherDailyStats.teacher?.teacher_code})
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs print:text-[7.5pt]">
              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-indigo-900 print:border-slate-300">
                Total: {teacherDailyStats.totalWeekJP} JP / Pekan
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-700 print:border-slate-300">
                Rata-rata: {teacherDailyStats.avgDaily} JP / Hari
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 font-bold text-amber-900 print:border-slate-300">
                Batas Sela: Maks {teacherDailyStats.teacher?.max_idle_gap_per_day ?? 1} JP
              </span>
            </div>
          </div>

          {/* Bar Chart Visual Compact */}
          <div className="grid grid-cols-5 md:grid-cols-6 gap-2 pt-0.5">
            {teacherDailyStats.dayBreakdown.map((item) => {
              const heightPercent = Math.round((item.jpCount / 8) * 100);
              const isHeavy = item.jpCount >= 6;
              const hasGap = item.gapCount > 0;

              return (
                <div
                  key={item.dayIndex}
                  className="flex flex-col items-center justify-end p-1.5 rounded-lg bg-slate-50 border border-slate-200 print:border-slate-300 print:p-1 print:bg-white"
                >
                  {/* Status Jam Sela */}
                  <div className="h-4 flex items-center justify-center mb-0.5">
                    {hasGap ? (
                      <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300 print:text-[6.5pt]">
                        Sela {item.gapCount}j
                      </span>
                    ) : item.jpCount > 0 ? (
                      <span className="text-[8.5px] font-bold text-emerald-700 print:text-[6.5pt]">
                        Rapat
                      </span>
                    ) : null}
                  </div>

                  {/* Angka JP */}
                  <span className="font-mono font-bold text-slate-800 text-xs print:text-[7pt] mb-0.5">
                    {item.jpCount} JP
                  </span>

                  {/* Batang Bar */}
                  <div className="w-full bg-slate-200 print:bg-slate-100 rounded h-10 print:h-8 flex items-end p-0.5 overflow-hidden border border-slate-300">
                    <div
                      style={{ height: `${Math.max(Math.min(heightPercent, 100), item.jpCount > 0 ? 15 : 0)}%` }}
                      className={`w-full rounded transition-all ${
                        item.jpCount === 0
                          ? 'bg-transparent'
                          : isHeavy
                          ? 'bg-amber-500 print:bg-slate-600'
                          : 'bg-indigo-600 print:bg-slate-800'
                      }`}
                    />
                  </div>

                  {/* Label Hari */}
                  <span className="mt-1 font-bold text-slate-700 text-[10px] print:text-[7pt]">
                    {item.dayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          MATRIKS GRID JADWAL UTAMA
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto print:border-none print:shadow-none">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2 text-center font-bold border-r border-slate-800 w-20 print:w-16 print:p-1 print:text-[7.5pt]">
                Periode
              </th>
              {activeDays.map((day) => (
                <th
                  key={day.id}
                  className="p-2 text-center font-bold border-r border-slate-800 last:border-r-0 min-w-[130px] print:min-w-0 print:p-1 print:text-[7.5pt]"
                >
                  {day.day_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {periods.map((periodNum) => (
              <tr key={periodNum} className="hover:bg-slate-50/50">
                <td className="p-1.5 text-center bg-slate-50 font-bold text-slate-700 border-r border-slate-200 print:p-1">
                  <div className="font-mono text-xs print:text-[7pt]">Jam {periodNum}</div>
                  {(() => {
                    const sampleSlot = timeSlots.find((s) => s.period_number === periodNum);
                    if (sampleSlot && sampleSlot.start_time && sampleSlot.end_time) {
                      return (
                        <div className="text-[9.5px] text-slate-400 font-normal print:text-[6pt]">
                          {sampleSlot.start_time.slice(0, 5)}-{sampleSlot.end_time.slice(0, 5)}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </td>

                {activeDays.map((day) => {
                  const slot = timeSlots.find(
                    (s) => s.day_index === day.day_index && s.period_number === periodNum
                  );

                  if (!slot) {
                    return (
                      <td
                        key={day.id}
                        className="p-1.5 text-center text-slate-300 bg-slate-50/30 border-r border-slate-200 last:border-r-0 print:p-1"
                      >
                        -
                      </td>
                    );
                  }

                  if (slot.slot_type === 'BREAK') {
                    return (
                      <td
                        key={day.id}
                        className="p-1.5 text-center bg-amber-50/70 border-r border-slate-200 last:border-r-0 text-amber-800 font-bold text-[10px] print:text-[6.5pt] print:bg-slate-100"
                      >
                        {slot.slot_name || 'ISTIRAHAT'}
                      </td>
                    );
                  }

                  let matchedSchedule: ScheduleItem | undefined;
                  if (filterMode === 'CLASS') {
                    matchedSchedule = schedules.find(
                      (sc) => sc.time_slot_id === slot.id && sc.class_id === selectedId
                    );
                  } else {
                    matchedSchedule = schedules.find(
                      (sc) => sc.time_slot_id === slot.id && sc.teacher_id === selectedId
                    );
                  }

                  if (!matchedSchedule) {
                    return (
                      <td
                        key={day.id}
                        className="p-1.5 text-center text-slate-300 border-r border-slate-200 last:border-r-0 print:p-1"
                      >
                        <span className="text-[9.5px] opacity-40 print:text-[6pt]">-</span>
                      </td>
                    );
                  }

                  const lesson = lessonMap.get(matchedSchedule.lesson_id);
                  const subject = lesson ? subjectMap.get(lesson.subject_id) : undefined;
                  const teacher = teacherMap.get(matchedSchedule.teacher_id);
                  const classItem = classMap.get(matchedSchedule.class_id);
                  const roomItem = matchedSchedule.room_id
                    ? roomMap.get(matchedSchedule.room_id)
                    : undefined;

                  return (
                    <td
                      key={day.id}
                      className="p-1.5 border-r border-slate-200 last:border-r-0 align-top bg-white print:p-1"
                    >
                      <div className="p-1 rounded bg-indigo-50/80 border border-indigo-200 space-y-0.5 print:bg-white print:border-slate-300 print:p-0.5">
                        <div className="font-bold text-indigo-900 leading-tight print:text-[7pt] print:text-black">
                          {subject?.subject_name || 'Mata Pelajaran'}
                        </div>

                        <div className="flex items-center justify-between text-[9.5px] text-slate-600 font-semibold print:text-[6.5pt]">
                          {filterMode === 'CLASS' ? (
                            <span>{teacher?.full_name || 'Guru'}</span>
                          ) : (
                            <span className="text-indigo-800 print:text-black font-bold">
                              Kelas {classItem?.class_name || 'Rombel'}
                            </span>
                          )}

                          {roomItem && (
                            <span className="px-1 bg-amber-100 text-amber-800 rounded text-[8.5px] font-bold print:border print:border-slate-300 print:text-[6pt]">
                              {roomItem.room_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
