import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { wakeUpSolverServer } from '../lib/solverApi';
import {
  WorkDay,
  TimeSlot,
  Teacher,
  ClassRoom,
  Room,
  Subject,
  Lesson,
  ScheduleItem,
  GenerationJob,
} from '../types';

export function useRealtimeSchedule(explicitSchoolId?: string) {
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);
  const [solverOnline, setSolverOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const getResolvedSchoolId = useCallback(async (): Promise<string | null> => {
    if (explicitSchoolId) return explicitSchoolId;
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || null;
  }, [explicitSchoolId]);

  const fetchAllData = useCallback(async () => {
    const schoolId = await getResolvedSchoolId();
    if (!schoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [daysRes, slotsRes, teachersRes, classesRes, roomsRes, subjectsRes, lessonsRes, schedRes] =
      await Promise.all([
        supabase.from('work_days').select('*').eq('school_id', schoolId).order('day_index'),
        supabase.from('time_slots').select('*').eq('school_id', schoolId).order('period_number'),
        supabase.from('teachers').select('*').eq('school_id', schoolId).order('teacher_code'),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('class_name'),
        supabase.from('rooms').select('*').eq('school_id', schoolId).order('room_name'),
        supabase.from('subjects').select('*').eq('school_id', schoolId).order('subject_code'),
        supabase.from('lessons').select('*').eq('school_id', schoolId),
        supabase.from('schedules').select('*').eq('school_id', schoolId),
      ]);

    if (daysRes.data) setWorkDays(daysRes.data);
    if (slotsRes.data) setTimeSlots(slotsRes.data);
    if (teachersRes.data) setTeachers(teachersRes.data);
    if (classesRes.data) setClasses(classesRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (subjectsRes.data) setSubjects(subjectsRes.data);
    if (lessonsRes.data) setLessons(lessonsRes.data);
    if (schedRes.data) setSchedules(schedRes.data);
    setLoading(false);
  }, [getResolvedSchoolId]);

  const fetchSchedulesOnly = useCallback(async () => {
    const schoolId = await getResolvedSchoolId();
    if (!schoolId) return;
    const { data } = await supabase.from('schedules').select('*').eq('school_id', schoolId);
    if (data) setSchedules(data);
  }, [getResolvedSchoolId]);

  useEffect(() => {
    let jobChannel: any = null;
    let scheduleChannel: any = null;

    fetchAllData();
    wakeUpSolverServer().then(setSolverOnline);

    getResolvedSchoolId().then((schoolId) => {
      if (!schoolId) return;

      // Listener khusus job sekolah aktif
      jobChannel = supabase
        .channel(`realtime-jobs-${schoolId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'generation_jobs',
            filter: `school_id=eq.${schoolId}`,
          },
          (payload) => {
            const updatedJob = payload.new as GenerationJob;
            setActiveJob(updatedJob);
            if (updatedJob.status === 'completed') {
              fetchSchedulesOnly();
            }
          }
        )
        .subscribe();

      // Listener perubahan jadwal khusus sekolah aktif
      scheduleChannel = supabase
        .channel(`realtime-schedules-${schoolId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedules',
            filter: `school_id=eq.${schoolId}`,
          },
          () => {
            fetchSchedulesOnly();
          }
        )
        .subscribe();
    });

    return () => {
      if (jobChannel) supabase.removeChannel(jobChannel);
      if (scheduleChannel) supabase.removeChannel(scheduleChannel);
    };
  }, [fetchAllData, fetchSchedulesOnly, getResolvedSchoolId]);

  return {
    workDays,
    timeSlots,
    teachers,
    classes,
    rooms,
    subjects,
    lessons,
    schedules,
    activeJob,
    solverOnline,
    loading,
    refreshData: fetchAllData,
  };
}
