import React, { useState } from 'react';
import { ArrowLeftRight, Lock, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
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
  onScheduleUpdated?: () => void;
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
  onScheduleUpdated,
}) => {
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

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

  const validateMoveOrSwap = (
    sourceItem: ScheduleItem,
    targetSlot: TimeSlot,
    targetItem?: ScheduleItem
  ): { valid: boolean; reason?: string } => {
    if (targetSlot.slot_type === 'BREAK') {
      return { valid: false, reason: 'Jam istirahat' };
    }

    const sourceSlot = timeSlots.find((s) => s.id === sourceItem.time_slot_id);
    if (!sourceSlot) return { valid: false, reason: 'Slot asal tidak valid' };

    const sourceLesson = getLesson(sourceItem.lesson_id);
    if (sourceLesson && sourceLesson.allowed_slot_types !== targetSlot.slot_type) {
      return { valid: false, reason: `Wajib zona ${sourceLesson.allowed_slot_types}` };
    }

    if (targetItem) {
      const targetLesson = getLesson(targetItem.lesson_id);
      if (targetLesson && targetLesson.allowed_slot_types !== sourceSlot.slot_type) {
        return { valid: false, reason: `Target wajib zona ${targetLesson.allowed_slot_types}` };
      }
    }

    const checkTeacherUnavailable = (teacherId: string, slot: TimeSlot): string | null => {
      const teacher = getTeacher(teacherId);
      if (!teacher || !teacher.unavailable_slots) return null;
      for (const rule of teacher.unavailable_slots) {
        if (rule.day_index === slot.day_index && rule.level === 'HARD') {
          if (
            rule.periods === 'ALL' ||
            (Array.isArray(rule.periods) && rule.periods.includes(slot.period_number))
          ) {
            return `${teacher.full_name} berhalangan`;
          }
        }
      }
      return null;
    };

    const unavailSource = checkTeacherUnavailable(sourceItem.teacher_id, targetSlot);
    if (unavailSource) return { valid: false, reason: unavailSource };

    if (targetItem) {
      const unavailTarget = checkTeacherUnavailable(targetItem.teacher_id, sourceSlot);
      if (unavailTarget) return { valid: false, reason: unavailTarget };
    }

    const othersInTarget = schedules.filter(
      (sc) =>
        sc.time_slot_id === targetSlot.id &&
        sc.id !== sourceItem.id &&
        sc.id !== targetItem?.id
    );

    const teacherClashTarget = othersInTarget.find((sc) => sc.teacher_id === sourceItem.teacher_id);
    if (teacherClashTarget) {
      const cls = getClass(teacherClashTarget.class_id);
      return { valid: false, reason: `Guru bentrok di ${cls?.class_name}` };
    }

    const classClashTarget = othersInTarget.find((sc) => sc.class_id === sourceItem.class_id);
    if (classClashTarget) {
      return { valid: false, reason: `Kelas sudah terisi` };
    }

    if (sourceItem.room_id) {
      const roomClashTarget = othersInTarget.find((sc) => sc.room_id === sourceItem.room_id);
      if (roomClashTarget) {
        return { valid: false, reason: `Ruangan dipakai` };
      }
    }

    if (targetItem) {
      const othersInSource = schedules.filter(
        (sc) =>
          sc.time_slot_id === sourceSlot.id &&
          sc.id !== sourceItem.id &&
          sc.id !== targetItem.id
      );

      if (othersInSource.some((sc) => sc.teacher_id === targetItem.teacher_id)) {
        return { valid: false, reason: `Guru target bentrok di slot asal` };
      }
      if (othersInSource.some((sc) => sc.class_id === targetItem.class_id)) {
        return { valid: false, reason: `Kelas target bentrok di slot asal` };
      }
      if (targetItem.room_id && othersInSource.some((sc) => sc.room_id === targetItem.room_id)) {
        return { valid: false, reason: `Ruangan target bentrok di slot asal` };
      }
    }

    return { valid: true };
  };

  const executeMoveOrSwap = async (targetSlot: TimeSlot, targetItem?: ScheduleItem) => {
    if (!selectedSchedule || isUpdating) return;

    if (selectedSchedule.time_slot_id === targetSlot.id) {
      setSelectedSchedule(null);
      return;
    }

    const validation = validateMoveOrSwap(selectedSchedule, targetSlot, targetItem);
    if (!validation.valid) {
      alert(`Tidak dapat memindahkan jadwal:\n${validation.reason}`);
      return;
    }

    setIsUpdating(true);
    try {
      if (!targetItem) {
        const { error } = await supabase
          .from('schedules')
          .update({ time_slot_id: targetSlot.id })
          .eq('id', selectedSchedule.id);
        if (error) throw error;
      } else {
        const sourceSlotId = selectedSchedule.time_slot_id;
        const targetSlotId = targetSlot.id;

        const { error: delErr } = await supabase
          .from('schedules')
          .delete()
          .in('id', [selectedSchedule.id, targetItem.id]);
        if (delErr) throw delErr;

        const { error: insErr } = await supabase.from('schedules').insert([
          {
            lesson_id: selectedSchedule.lesson_id,
            time_slot_id: targetSlotId,
            teacher_id: selectedSchedule.teacher_id,
            class_id: selectedSchedule.class_id,
            room_id: selectedSchedule.room_id,
            is_locked: selectedSchedule.is_locked,
          },
          {
            lesson_id: targetItem.lesson_id,
            time_slot_id: sourceSlotId,
            teacher_id: targetItem.teacher_id,
            class_id: targetItem.class_id,
            room_id: targetItem.room_id,
            is_locked: targetItem.is_locked,
          },
        ]);
        if (insErr) throw insErr;
      }

      setSelectedSchedule(null);
      if (onScheduleUpdated) onScheduleUpdated();
    } catch (err: any) {
      alert(`Gagal memperbarui jadwal: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-3">
      {selectedSchedule && (
        <div className="p-3 bg-indigo-900 text-white rounded-xl shadow flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-300" />
            <span>
              Mode Pindah/Tukar Aktif: Klik kotak tujuan berwarna <b>Hijau</b> untuk memindahkan
              atau menukar posisi jadwal.
            </span>
          </div>
          <button
            onClick={() => setSelectedSchedule(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 font-semibold"
          >
            <X className="w-3.5 h-3.5" /> Batal Pilih
          </button>
        </div>
      )}

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
                        ☕ {slot.slot_name} ({slot.start_time.slice(0, 5)} -{' '}
                        {slot.end_time.slice(0, 5)})
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

                  const isSelectedSource = selectedSchedule?.id === scheduled?.id;
                  const checkResult =
                    selectedSchedule && !isSelectedSource
                      ? validateMoveOrSwap(selectedSchedule, slot, scheduled)
                      : null;

                  return (
                    <td
                      key={day.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (selectedSchedule) executeMoveOrSwap(slot, scheduled);
                      }}
                      onClick={() => {
                        if (selectedSchedule) {
                          executeMoveOrSwap(slot, scheduled);
                        } else if (scheduled) {
                          setSelectedSchedule(scheduled);
                        }
                      }}
                      className={`p-2 border border-slate-200 align-top h-24 transition cursor-pointer ${
                        isSelectedSource
                          ? 'ring-2 ring-indigo-600 bg-indigo-50/60'
                          : checkResult?.valid
                          ? 'bg-emerald-50/70 hover:bg-emerald-100/80 ring-1 ring-emerald-400'
                          : checkResult && !checkResult.valid
                          ? 'bg-rose-50/60 opacity-80 cursor-not-allowed'
                          : ''
                      }`}
                    >
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
                          draggable
                          onDragStart={() => setSelectedSchedule(scheduled)}
                          className={`p-2 rounded-lg border-l-4 shadow-sm select-none ${getBadgeColor(
                            subject.id
                          )}`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-xs leading-tight">
                              {subject.subject_name}
                            </span>
                            {scheduled.is_locked && (
                              <Lock className="w-3 h-3 opacity-60 shrink-0" />
                            )}
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

                      {checkResult && (
                        <div
                          className={`mt-1.5 text-[10px] font-semibold flex items-center gap-1 ${
                            checkResult.valid ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {checkResult.valid ? (
                            <>
                              <CheckCircle className="w-3 h-3 shrink-0" />
                              <span>{scheduled ? 'Klik Tukar' : 'Klik Pindah'}</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="truncate" title={checkResult.reason}>
                                {checkResult.reason}
                              </span>
                            </>
                          )}
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
    </div>
  );
};
