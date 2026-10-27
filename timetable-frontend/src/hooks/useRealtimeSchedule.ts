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

export function useRealtimeSchedule() {
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

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const [daysRes, slotsRes, teachersRes, classesRes, roomsRes, subjectsRes, lessonsRes, schedRes] =
      await Promise.all([
        supabase.from('work_days').select('*').order('day_index'),
        supabase.from('time_slots').select('*').order('period_number'),
        supabase.from('teachers').select('*').order('teacher_code'),
        supabase.from('classes').select('*').order('class_name'),
        supabase.from('rooms').select('*').order('room_name'),
        supabase.from('subjects').select('*').order('subject_code'),
        supabase.from('lessons').select('*'),
        supabase.from('schedules').select('*'),
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
  }, []);

  const fetchSchedulesOnly = useCallback(async () => {
    const { data } = await supabase.from('schedules').select('*');
    if (data) setSchedules(data);
  }, []);

  useEffect(() => {
    fetchAllData();
    wakeUpSolverServer().then(setSolverOnline);

    const jobChannel = supabase
      .channel('realtime-jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'generation_jobs' },
        (payload) => {
          const updatedJob = payload.new as GenerationJob;
          setActiveJob(updatedJob);
          if (updatedJob.status === 'completed') {
            fetchSchedulesOnly();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobChannel);
    };
  }, [fetchAllData, fetchSchedulesOnly]);

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
