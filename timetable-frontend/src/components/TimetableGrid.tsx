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
import { BarChart3, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

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

  // Pemetaan ID cepat
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const lessonMap = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);

  // Statistik & Data Distribusi Beban Harian Guru
  const teacherDailyStats = useMemo(() => {
    if (filterMode !== 'TEACHER' || !selectedId) return null;

    const teacher = teacherMap.get(selectedId);
    let totalWeekJP = 0;

    const dayBreakdown = activeDays.map((day) => {
      // Ambil slot hari ini
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

      // Hitung selisih jam kosong di tengah hari (idle gap)
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
    <div className="space-y-4">
      {/* =========================================================================
          GRAFIK BATANG (BAR CHART) DISTRIBUSI BEBAN HARIAN GURU
          Hanya ditampilkan jika memilih filter "Matriks per Guru"
          ========================================================================= */}
      {filterMode === 'TEACHER' && teacherDailyStats && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs">
                  Distribusi Beban Mengajar Harian: {teacherDailyStats.teacher?.full_name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Visualisasi sebaran jam mengajar dan deteksi jam sela (idle gap) sepekan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 mr-1.5">Total Beban:</span>
                <span className="font-bold font-mono text-indigo-700">
                  {teacherDailyStats.totalWeekJP} JP
                </span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 mr-1.5">Rata-rata:</span>
                <span className="font-bold font-mono text-slate-700">
                  {teacherDailyStats.avgDaily} JP/Hari
                </span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visual */}
          <div className="grid grid-cols-5 md:grid-cols-6 gap-3 pt-1">
            {teacherDailyStats.dayBreakdown.map((item) => {
              const heightPercent = Math.round((item.jpCount / 8) * 100);
              const isHeavy = item.jpCount >= 6;
              const hasGap = item.gapCount > 0;

              return (
                <div
                  key={item.dayIndex}
                  className="flex flex-col items-center justify-end p-2.5 rounded-xl bg-slate-50/80 border border-slate-200 hover:bg-slate-100/80 transition"
                >
                  {/* Badge Gap Jam Kosong jika terdeteksi */}
                  <div className="h-5 flex items-center justify-center mb-1">
                    {hasGap ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5"
                        title={`${item.gapCount} jam kosong di tengah jadwal`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>Sela {item.gapCount}j</span>
                      </span>
                    ) : item.jpCount > 0 ? (
                      <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Rapat
                      </span>
                    ) : null}
                  </div>

                  {/* Angka JP */}
                  <span className="font-mono font-bold text-slate-800 text-xs mb-1">
                    {item.jpCount} JP
                  </span>

                  {/* Batang Bar */}
                  <div className="w-full bg-slate-200 rounded-md h-16 flex items-end p-0.5 overflow-hidden">
                    <div
                      style={{ height: `${Math.min(heightPercent, 100)}%` }}
                      className={`w-full rounded transition-all duration-500 ${
                        item.jpCount === 0
                          ? 'bg-transparent'
                          : isHeavy
                          ? 'bg-amber-500 shadow-sm'
                          : 'bg-indigo-600 shadow-sm shadow-indigo-200'
                      }`}
                    />
                  </div>

                  {/* Nama Hari */}
                  <span className="mt-2 font-bold text-slate-700 text-[11px]">
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-2.5 text-center font-bold border-r border-slate-800 w-24">
                Periode
              </th>
              {activeDays.map((day) => (
                <th
                  key={day.id}
                  className="p-2.5 text-center font-bold border-r border-slate-800 last:border-r-0 min-w-[150px]"
                >
                  {day.day_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {periods.map((periodNum) => (
              <tr key={periodNum} className="hover:bg-slate-50/50">
                {/* Kolom Label Periode Jam */}
                <td className="p-2 text-center bg-slate-50 font-bold text-slate-700 border-r border-slate-200">
                  <div className="font-mono text-xs">Jam {periodNum}</div>
                  {(() => {
                    const sampleSlot = timeSlots.find((s) => s.period_number === periodNum);
                    if (sampleSlot && sampleSlot.start_time && sampleSlot.end_time) {
                      return (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {sampleSlot.start_time.slice(0, 5)} - {sampleSlot.end_time.slice(0, 5)}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </td>

                {/* Sel Tiap Hari */}
                {activeDays.map((day) => {
                  const slot = timeSlots.find(
                    (s) => s.day_index === day.day_index && s.period_number === periodNum
                  );

                  if (!slot) {
                    return (
                      <td
                        key={day.id}
                        className="p-2 text-center text-slate-300 bg-slate-50/30 border-r border-slate-200 last:border-r-0"
                      >
                        -
                      </td>
                    );
                  }

                  if (slot.slot_type === 'BREAK') {
                    return (
                      <td
                        key={day.id}
                        className="p-2 text-center bg-amber-50/70 border-r border-slate-200 last:border-r-0 text-amber-800 font-bold text-[11px]"
                      >
                        {slot.slot_name || 'ISTIRAHAT'}
                      </td>
                    );
                  }

                  // Cari jadwal yang cocok
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
                        className="p-2 text-center text-slate-300 border-r border-slate-200 last:border-r-0 min-h-[52px]"
                      >
                        <span className="text-[10px] opacity-40">Kosong</span>
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
                      className="p-2 border-r border-slate-200 last:border-r-0 align-top bg-white"
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200 space-y-0.5">
                        <div className="font-bold text-indigo-900 leading-tight">
                          {subject?.subject_name || 'Mata Pelajaran'}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-600 font-semibold pt-0.5">
                          {filterMode === 'CLASS' ? (
                            <span>{teacher?.full_name || 'Guru'}</span>
                          ) : (
                            <span className="text-indigo-800">
                              Kelas {classItem?.class_name || 'Rombel'}
                            </span>
                          )}

                          {roomItem && (
                            <span className="px-1 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
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
