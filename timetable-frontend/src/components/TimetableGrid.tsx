import React from 'react';
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

interface Props {
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
}

const COLORS = [
  'bg-blue-50 border-blue-500 text-blue-900',
  'bg-emerald-50 border-emerald-500 text-emerald-900',
  'bg-purple-50 border-purple-500 text-purple-900',
  'bg-amber-50 border-amber-500 text-amber-900',
  'bg-rose-50 border-rose-500 text-rose-900',
  'bg-cyan-50 border-cyan-500 text-cyan-900',
];

export const TimetableGrid: React.FC<Props> = ({
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
  const activeDays = workDays.filter((d) => d.is_active);
  const uniquePeriods = Array.from(new Set(timeSlots.map((s) => s.period_number))).sort(
    (a, b) => a - b
  );

  const getTeacher = (id: string) => teachers.find((t) => t.id === id);
  const getClass = (id: string) => classes.find((c) => c.id === id);
  const getRoom = (id: string | null) => rooms.find((r) => r.id === id);
  const getLesson = (id: string) => lessons.find((l) => l.id === id);
  const getSubject = (id?: string) => subjects.find((s) => s.id === id);

  const getBadgeColor = (subjectId: string) => {
    const idx = subjects.findIndex((s) => s.id === subjectId);
    return COLORS[idx >= 0 ? idx % COLORS.length : 0];
  };

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="p-3 border border-slate-700 w-24 text-center">Periode</th>
            {activeDays.map((day) => (
              <th key={day.id} className="p-3 border border-slate-700 min-w-[185px]">
                {day.day_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniquePeriods.map((periodNum) => (
            <tr key={periodNum} className="hover:bg-slate-50/60">
              <td className="p-2 border border-slate-200 bg-slate-100 font-semibold text-center text-slate-700">
                Jam ke-{periodNum}
              </td>

              {activeDays.map((day) => {
                const slot = timeSlots.find(
                  (s) => s.day_index === day.day_index && s.period_number === periodNum
                );

                if (!slot) {
                  return (
                    <td
                      key={day.id}
                      className="p-2 border border-slate-200 bg-slate-100/70 text-center text-xs text-slate-400 italic"
                    >
                      Tidak Ada Jam
                    </td>
                  );
                }

                if (slot.slot_type === 'BREAK') {
                  return (
                    <td
                      key={day.id}
                      className="p-2 border border-slate-200 bg-amber-50/80 text-center font-medium text-amber-800 text-xs"
                    >
                      ☕ {slot.slot_name} ({slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)})
                    </td>
                  );
                }

                const scheduled = schedules.find(
                  (sc) =>
                    sc.time_slot_id === slot.id &&
                    (filterMode === 'CLASS'
                      ? sc.class_id === selectedId
                      : sc.teacher_id === selectedId)
                );

                const lesson = scheduled ? getLesson(scheduled.lesson_id) : undefined;
                const subject = lesson ? getSubject(lesson.subject_id) : undefined;
                const teacher = scheduled ? getTeacher(scheduled.teacher_id) : undefined;
                const classRoom = scheduled ? getClass(scheduled.class_id) : undefined;
                const room = scheduled ? getRoom(scheduled.room_id) : undefined;

                return (
                  <td key={day.id} className="p-2 border border-slate-200 align-top h-24">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                      <span>
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </span>
                      {slot.slot_type !== 'FORMAL' && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                          {slot.slot_type}
                        </span>
                      )}
                    </div>

                    {scheduled && subject ? (
                      <div
                        className={`p-2 rounded-lg border-l-4 shadow-sm ${getBadgeColor(
                          subject.id
                        )}`}
                      >
                        <div className="font-bold text-xs leading-tight">
                          {subject.subject_name}
                        </div>
                        <div className="text-[11px] mt-1 opacity-90">
                          {filterMode === 'CLASS'
                            ? `👨‍🏫 ${teacher?.full_name}`
                            : `🏫 Kelas ${classRoom?.class_name}`}
                        </div>
                        {room && (
                          <div className="text-[10px] mt-0.5 font-mono opacity-75">
                            📍 {room.room_name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-12 flex items-center justify-center text-xs text-slate-300 border border-dashed border-slate-200 rounded">
                        Kosong
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
