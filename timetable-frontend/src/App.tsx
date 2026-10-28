import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Play,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Users,
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  ShieldAlert,
  X,
  Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabaseClient';
import { triggerScheduleGeneration } from './lib/solverApi';
import { TimetableGrid } from './components/TimetableGrid';
import { MasterDataModal } from './components/MasterDataModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import {
  WorkDay,
  TimeSlot,
  Teacher,
  ClassRoom,
  Room,
  Subject,
  Lesson,
  ScheduleItem,
} from './types';

export const App: React.FC = () => {
  // State Data Master & Jadwal
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  // State Filter & Navigasi Matriks
  const [filterMode, setFilterMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedId, setSelectedId] = useState<string>('');
  const [printMode, setPrintMode] = useState<'SINGLE' | 'ALL_CLASSES' | 'ALL_TEACHERS'>('SINGLE');

  // State Modal
  const [isMasterModalOpen, setIsMasterModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState<boolean>(false);
  const [isConstraintModalOpen, setIsConstraintModalOpen] = useState<boolean>(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState<boolean>(false);

  // State Form Slot Waktu (Hari & Jam)
  const [slotDayIndex, setSlotDayIndex] = useState<number>(1);
  const [slotPeriod, setSlotPeriod] = useState<number>(1);
  const [slotName, setSlotName] = useState<string>('Jam ke-1');
  const [slotStart, setSlotStart] = useState<string>('07:00');
  const [slotEnd, setSlotEnd] = useState<string>('07:45');
  const [slotType, setSlotType] = useState<'PRE' | 'FORMAL' | 'POST' | 'BREAK'>('FORMAL');
  const [savingSlot, setSavingSlot] = useState<boolean>(false);

  // State Form Syarat Jam Guru
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [unavailDayIndex, setUnavailDayIndex] = useState<number>(1);
  const [unavailPeriods, setUnavailPeriods] = useState<string>('ALL');
  const [savingConstraint, setSavingConstraint] = useState<boolean>(false);

  // State Form Tambah Kartu Mapel (Lesson)
  const [lessonTeacherId, setLessonTeacherId] = useState<string>('');
  const [lessonSubjectId, setLessonSubjectId] = useState<string>('');
  const [lessonClassId, setLessonClassId] = useState<string>('');
  const [lessonRoomId, setLessonRoomId] = useState<string>('');
  const [lessonTotalPeriods, setLessonTotalPeriods] = useState<number>(4);
  const [lessonSplitPattern, setLessonSplitPattern] = useState<string>('2+2');
  const [lessonZone, setLessonZone] = useState<'PRE' | 'FORMAL' | 'POST'>('FORMAL');
  const [savingLesson, setSavingLesson] = useState<boolean>(false);

  // State Solver Engine & Realtime Job
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [jobStatus, setJobStatus] = useState<{
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
    message: string;
    elapsedMs?: number;
  }>({
    status: 'idle',
    message: 'GitHub Actions Solver: Siap',
  });

  // 1. Mengambil Semua Data dari Supabase
  const fetchAllData = async () => {
    try {
      const [
        daysRes,
        slotsRes,
        teachersRes,
        classesRes,
        roomsRes,
        subjectsRes,
        lessonsRes,
        schedulesRes,
      ] = await Promise.all([
        supabase.from('work_days').select('*').order('day_index'),
        supabase.from('time_slots').select('*').order('day_index').order('period_number'),
        supabase.from('teachers').select('*').order('full_name'),
        supabase.from('classes').select('*').order('grade_level').order('class_name'),
        supabase.from('rooms').select('*').order('room_name'),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('lessons').select('*'),
        supabase.from('schedules').select('*'),
      ]);

      if (daysRes.data) setWorkDays(daysRes.data);
      if (slotsRes.data) setTimeSlots(slotsRes.data);
      if (teachersRes.data) {
        setTeachers(teachersRes.data);
        if (!selectedTeacherId && teachersRes.data.length > 0) {
          setSelectedTeacherId(teachersRes.data[0].id);
          setLessonTeacherId(teachersRes.data[0].id);
        }
      }
      if (classesRes.data) {
        setClasses(classesRes.data);
        if (!selectedId && classesRes.data.length > 0 && filterMode === 'CLASS') {
          setSelectedId(classesRes.data[0].id);
        }
        if (!lessonClassId && classesRes.data.length > 0) {
          setLessonClassId(classesRes.data[0].id);
        }
      }
      if (roomsRes.data) setRooms(roomsRes.data);
      if (subjectsRes.data) {
        setSubjects(subjectsRes.data);
        if (!lessonSubjectId && subjectsRes.data.length > 0) {
          setLessonSubjectId(subjectsRes.data[0].id);
        }
      }
      if (lessonsRes.data) setLessons(lessonsRes.data);
      if (schedulesRes.data) setSchedules(schedulesRes.data);
    } catch (err: any) {
      console.error('Gagal mengambil data:', err.message);
    }
  };

  useEffect(() => {
    fetchAllData();

    const jobsChannel = supabase
      .channel('realtime_generation_jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'generation_jobs' },
        (payload: any) => {
          const row = payload.new;
          if (row) {
            setJobStatus({
              status: row.status,
              message: row.progress_message || 'Sedang memproses...',
              elapsedMs: row.execution_time_ms,
            });

            if (row.status === 'completed') {
              setIsGenerating(false);
              fetchAllData();
            } else if (row.status === 'failed') {
              setIsGenerating(false);
            }
          }
        }
      )
      .subscribe();

    const schedulesChannel = supabase
      .channel('realtime_schedules')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(schedulesChannel);
    };
  }, []);

  useEffect(() => {
    if (filterMode === 'CLASS' && classes.length > 0) {
      if (!classes.some((c) => c.id === selectedId)) {
        setSelectedId(classes[0].id);
      }
    } else if (filterMode === 'TEACHER' && teachers.length > 0) {
      if (!teachers.some((t) => t.id === selectedId)) {
        setSelectedId(teachers[0].id);
      }
    }
  }, [filterMode, classes, teachers]);

  // Toggle Hari Aktif
  const handleToggleDay = async (day: WorkDay) => {
    const { error } = await supabase
      .from('work_days')
      .update({ is_active: !day.is_active })
      .eq('id', day.id);
    if (!error) fetchAllData();
  };

  // Simpan Slot Waktu
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSlot(true);
    try {
      const { error } = await supabase.from('time_slots').upsert(
        [
          {
            day_index: Number(slotDayIndex),
            period_number: Number(slotPeriod),
            slot_name: slotName.trim(),
            start_time: slotStart,
            end_time: slotEnd,
            slot_type: slotType,
          },
        ],
        { onConflict: 'day_index,period_number' }
      );
      if (error) throw error;
      await fetchAllData();
    } catch (err: any) {
      alert(`Gagal menyimpan slot waktu: ${err.message}`);
    } finally {
      setSavingSlot(false);
    }
  };

  // Simpan Syarat Jam Berhalangan Guru
  const handleAddConstraint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) return;
    setSavingConstraint(true);
    try {
      const teacher = teachers.find((t) => t.id === selectedTeacherId);
      const currentRules = Array.isArray(teacher?.unavailable_slots)
        ? [...teacher!.unavailable_slots]
        : [];

      const parsedPeriods =
        unavailPeriods.trim().toUpperCase() === 'ALL'
          ? 'ALL'
          : unavailPeriods
              .split(',')
              .map((p) => Number(p.trim()))
              .filter((n) => !isNaN(n) && n > 0);

      currentRules.push({
        day_index: Number(unavailDayIndex),
        periods: parsedPeriods,
        level: 'HARD',
      });

      const { error } = await supabase
        .from('teachers')
        .update({ unavailable_slots: currentRules })
        .eq('id', selectedTeacherId);

      if (error) throw error;
      await fetchAllData();
    } catch (err: any) {
      alert(`Gagal menyimpan syarat jam guru: ${err.message}`);
    } finally {
      setSavingConstraint(false);
    }
  };

  const handleClearConstraint = async (teacherId: string) => {
    const { error } = await supabase
      .from('teachers')
      .update({ unavailable_slots: [] })
      .eq('id', teacherId);
    if (!error) fetchAllData();
  };

  // Simpan Kartu Mapel (Lesson)
  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTeacherId || !lessonSubjectId || !lessonClassId) {
      alert('Pilih Guru, Mata Pelajaran, dan Kelas terlebih dahulu.');
      return;
    }
    setSavingLesson(true);
    try {
      const splitArray = lessonSplitPattern
        .split('+')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      const { error } = await supabase.from('lessons').insert([
        {
          teacher_id: lessonTeacherId,
          subject_id: lessonSubjectId,
          class_id: lessonClassId,
          preferred_room_id: lessonRoomId || null,
          total_periods: Number(lessonTotalPeriods),
          split_pattern: splitArray,
          allowed_slot_types: lessonZone,
        },
      ]);
      if (error) throw error;
      await fetchAllData();
      setIsLessonModalOpen(false);
    } catch (err: any) {
      alert(`Gagal menyimpan kartu mapel: ${err.message}`);
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (!error) fetchAllData();
  };

  // Pemicu Solver GitHub Actions
  const handleTriggerSolver = async () => {
    if (lessons.length === 0 || timeSlots.length === 0) {
      alert('Kartu mapel atau slot waktu masih kosong. Masukkan data terlebih dahulu.');
      return;
    }

    if (!confirm('Jalankan mesin OR-Tools di GitHub Actions untuk membuat jadwal otomatis?')) {
      return;
    }

    setIsGenerating(true);
    setJobStatus({
      status: 'queued',
      message: 'Mendaftarkan job & menyalakan mesin GitHub Actions...',
    });

    try {
      await triggerScheduleGeneration();
    } catch (err: any) {
      alert(`Gagal memicu GitHub Actions: ${err.message}`);
      setIsGenerating(false);
      setJobStatus({
        status: 'failed',
        message: `Gagal: ${err.message}`,
      });
    }
  };

  // Ekspor ke Excel (.xlsx)
  const handleExportExcel = () => {
    if (schedules.length === 0) {
      alert('Belum ada jadwal yang terbentuk untuk diekspor.');
      return;
    }

    const activeDays = workDays.filter((d) => d.is_active);
    const uniquePeriods = Array.from(new Set(timeSlots.map((s) => s.period_number))).sort(
      (a, b) => a - b
    );

    const wb = XLSX.utils.book_new();

    classes.forEach((cls) => {
      const rows: any[] = [];
      const headerRow = ['Jam Ke', ...activeDays.map((d) => d.day_name)];
      rows.push(headerRow);

      uniquePeriods.forEach((period) => {
        const row = [`Jam ke-${period}`];
        activeDays.forEach((day) => {
          const slot = timeSlots.find(
            (s) => s.day_index === day.day_index && s.period_number === period
          );
          if (!slot) {
            row.push('-');
            return;
          }
          if (slot.slot_type === 'BREAK') {
            row.push(`ISTIRAHAT (${slot.slot_name})`);
            return;
          }

          const item = schedules.find(
            (sc) => sc.time_slot_id === slot.id && sc.class_id === cls.id
          );
          if (item) {
            const lesson = lessons.find((l) => l.id === item.lesson_id);
            const subject = subjects.find((s) => s.id === lesson?.subject_id);
            const teacher = teachers.find((t) => t.id === item.teacher_id);
            row.push(`${subject?.subject_name || 'Mapel'} (${teacher?.full_name || 'Guru'})`);
          } else {
            row.push('');
          }
        });
        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `Kelas ${cls.class_name}`.slice(0, 31));
    });

    XLSX.writeFile(wb, `Master_Jadwal_Pelajaran_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Cetak PDF Massal (Seluruh Kelas / Seluruh Guru)
  const handlePrintBatch = (mode: 'SINGLE' | 'ALL_CLASSES' | 'ALL_TEACHERS') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode('SINGLE');
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* HEADER NAVIGASI UTAMA */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-sm sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-slate-900 leading-tight">
                  Smart Timetable CSP
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {jobStatus.message}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Penjadwalan Otomatis Anti-Bentrok (Supabase + GitHub Actions OR-Tools)
              </p>
            </div>
          </div>

          {/* Tombol Aksi Pengaturan & Master Data */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Master Data</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition shadow-sm"
            >
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>Import Excel</span>
            </button>

            <button
              onClick={() => setIsSlotModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
            >
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Hari & Jam (Pre/Post)</span>
            </button>

            <button
              onClick={() => setIsConstraintModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Syarat Jam Guru</span>
            </button>

            <button
              onClick={() => setIsLessonModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Tambah Kartu Mapel</span>
            </button>

            <button
              onClick={handleTriggerSolver}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-md transition ${
                isGenerating
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyusun Jadwal...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Generate Jadwal Otomatis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* BANNER STATUS SOLVER */}
      {jobStatus.status !== 'idle' && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4 print:hidden">
          <div
            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs transition ${
              jobStatus.status === 'processing' || jobStatus.status === 'queued'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : jobStatus.status === 'completed'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {jobStatus.status === 'processing' || jobStatus.status === 'queued' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              ) : jobStatus.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{jobStatus.message}</span>
              {jobStatus.elapsedMs && (
                <span className="text-[11px] font-mono opacity-75">
                  ({jobStatus.elapsedMs} ms)
                </span>
              )}
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/70 border border-current">
              {jobStatus.status}
            </span>
          </div>
        </div>
      )}

      {/* TOOLBAR FILTER & EKSPOR */}
      <main className="max-w-7xl mx-auto w-full px-6 py-4 flex-1 flex flex-col gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setFilterMode('CLASS')}
                className={`px-3 py-1.5 rounded-md transition ${
                  filterMode === 'CLASS'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Matriks per Kelas
              </button>
              <button
                onClick={() => setFilterMode('TEACHER')}
                className={`px-3 py-1.5 rounded-md transition ${
                  filterMode === 'TEACHER'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Matriks per Guru
              </button>
            </div>

            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {filterMode === 'CLASS'
                ? classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.class_name}
                    </option>
                  ))
                : teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
            </select>

            <button
              onClick={fetchAllData}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Segarkan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={() => handlePrintBatch('SINGLE')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak Tampilan Ini</span>
            </button>
            <button
              onClick={() => handlePrintBatch('ALL_CLASSES')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4" />
              <span>PDF Seluruh Kelas</span>
            </button>
            <button
              onClick={() => handlePrintBatch('ALL_TEACHERS')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-semibold transition"
            >
              <Users className="w-4 h-4" />
              <span>PDF Seluruh Guru</span>
            </button>
          </div>
        </div>

        {/* MATRIKS JADWAL UTAMA */}
        <div className="flex-1">
          {printMode === 'SINGLE' && (
            <TimetableGrid
              workDays={workDays}
              timeSlots={timeSlots}
              teachers={teachers}
              classes={classes}
              rooms={rooms}
              subjects={subjects}
              lessons={lessons}
              schedules={schedules}
              filterMode={filterMode}
              selectedId={selectedId}
              onScheduleUpdated={fetchAllData}
            />
          )}

          {printMode === 'ALL_CLASSES' && (
            <div className="space-y-8">
              {classes.map((cls) => (
                <div key={cls.id} className="break-after-page">
                  <h2 className="text-base font-bold mb-2">
                    Jadwal Pelajaran — Kelas {cls.class_name}
                  </h2>
                  <TimetableGrid
                    workDays={workDays}
                    timeSlots={timeSlots}
                    teachers={teachers}
                    classes={classes}
                    rooms={rooms}
                    subjects={subjects}
                    lessons={lessons}
                    schedules={schedules}
                    filterMode="CLASS"
                    selectedId={cls.id}
                  />
                </div>
              ))}
            </div>
          )}

          {printMode === 'ALL_TEACHERS' && (
            <div className="space-y-8">
              {teachers.map((tch) => (
                <div key={tch.id} className="break-after-page">
                  <h2 className="text-base font-bold mb-2">
                    Jadwal Mengajar — {tch.full_name} ({tch.teacher_code})
                  </h2>
                  <TimetableGrid
                    workDays={workDays}
                    timeSlots={timeSlots}
                    teachers={teachers}
                    classes={classes}
                    rooms={rooms}
                    subjects={subjects}
                    lessons={lessons}
                    schedules={schedules}
                    filterMode="TEACHER"
                    selectedId={tch.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: MASTER DATA (GURU, MAPEL, KELAS) */}
      <MasterDataModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        teachers={teachers}
        subjects={subjects}
        classes={classes}
        onDataUpdated={fetchAllData}
      />

      {/* MODAL 2: IMPORT EXCEL MASSAL */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onDataImported={fetchAllData}
      />

      {/* MODAL 3: KONFIGURASI HARI KERJA & SLOT JAM */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Konfigurasi Hari Kerja & Slot Jam (Pre / Formal / Post)
              </h2>
              <button onClick={() => setIsSlotModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-700" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-500 uppercase mb-2">
                Hari Kerja Aktif
              </label>
              <div className="flex flex-wrap gap-2">
                {workDays.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleToggleDay(d)}
                    className={`px-3 py-1.5 rounded-lg font-bold border transition ${
                      d.is_active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                  >
                    {d.day_name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Pilih Hari</label>
                  <select
                    value={slotDayIndex}
                    onChange={(e) => setSlotDayIndex(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    {workDays
                      .filter((d) => d.is_active)
                      .map((d) => (
                        <option key={d.id} value={d.day_index}>
                          {d.day_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Periode Ke-</label>
                  <input
                    type="number"
                    min={0}
                    max={16}
                    value={slotPeriod}
                    onChange={(e) => setSlotPeriod(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Label Slot</label>
                  <input
                    type="text"
                    value={slotName}
                    onChange={(e) => setSlotName(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tipe Zona Waktu</label>
                  <select
                    value={slotType}
                    onChange={(e) => setSlotType(e.target.value as any)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="PRE">PRE (Pra-KBM / Pagi)</option>
                    <option value="FORMAL">FORMAL (KBM Inti)</option>
                    <option value="POST">POST (Ekskul / Sore)</option>
                    <option value="BREAK">BREAK (Istirahat)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSlotModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={savingSlot}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {savingSlot ? 'Menyimpan...' : 'Simpan Slot Waktu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SYARAT JAM GURU (UNAVAILABLE SLOTS) */}
      {isConstraintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Pengaturan Jam Berhalangan Guru (Hard Constraint)
              </h2>
              <button onClick={() => setIsConstraintModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-700" />
              </button>
            </div>

            <form onSubmit={handleAddConstraint} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Pilih Guru</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.teacher_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Hari Berhalangan</label>
                  <select
                    value={unavailDayIndex}
                    onChange={(e) => setUnavailDayIndex(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    {workDays
                      .filter((d) => d.is_active)
                      .map((d) => (
                        <option key={d.id} value={d.day_index}>
                          {d.day_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Jam Ke (Ketik ALL atau pisah koma: 1,2)
                  </label>
                  <input
                    type="text"
                    value={unavailPeriods}
                    onChange={(e) => setUnavailPeriods(e.target.value)}
                    placeholder="ALL atau 1,2,3"
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingConstraint}
                className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {savingConstraint ? 'Menyimpan...' : '+ Tambah Larangan Jam Mengajar'}
              </button>
            </form>

            <div className="border-t pt-3 max-h-48 overflow-y-auto space-y-2">
              {teachers
                .filter((t) => t.unavailable_slots && t.unavailable_slots.length > 0)
                .map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 bg-slate-50 rounded-lg border flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{t.full_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {JSON.stringify(t.unavailable_slots)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleClearConstraint(t.id)}
                      className="text-rose-600 hover:underline font-semibold"
                    >
                      Reset
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: TAMBAH KARTU MAPEL (LESSONS) */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden p-6 space-y-4 text-xs max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Tambah Kartu Beban Mengajar (Lesson Card)
              </h2>
              <button onClick={() => setIsLessonModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-700" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Guru Pengampu</label>
                  <select
                    value={lessonTeacherId}
                    onChange={(e) => setLessonTeacherId(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Mata Pelajaran</label>
                  <select
                    value={lessonSubjectId}
                    onChange={(e) => setLessonSubjectId(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name} ({s.subject_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Kelas</label>
                  <select
                    value={lessonClassId}
                    onChange={(e) => setLessonClassId(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Total JP / Minggu</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={lessonTotalPeriods}
                    onChange={(e) => setLessonTotalPeriods(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Pola Pecah Blok (Split)</label>
                  <input
                    type="text"
                    value={lessonSplitPattern}
                    onChange={(e) => setLessonSplitPattern(e.target.value)}
                    placeholder="Contoh: 2+2 atau 3"
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Zona Slot Diizinkan</label>
                  <select
                    value={lessonZone}
                    onChange={(e) => setLessonZone(e.target.value as any)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="FORMAL">FORMAL (KBM Utama)</option>
                    <option value="PRE">PRE (Kegiatan Pagi)</option>
                    <option value="POST">POST (Sore / Ekskul)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Ruangan Khusus (Opsional)</label>
                  <select
                    value={lessonRoomId}
                    onChange={(e) => setLessonRoomId(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="">-- Tanpa Ruangan Khusus --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingLesson}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {savingLesson ? 'Menyimpan...' : '+ Simpan Kartu Mapel'}
              </button>
            </form>

            {/* Daftar Kartu Mapel yang Sudah Ada */}
            <div className="border-t pt-3 overflow-y-auto flex-1 space-y-1.5">
              <p className="font-bold text-slate-600 mb-1">
                Daftar Kartu Mapel Terdaftar ({lessons.length})
              </p>
              {lessons.map((l) => {
                const tch = teachers.find((t) => t.id === l.teacher_id);
                const sub = subjects.find((s) => s.id === l.subject_id);
                const cls = classes.find((c) => c.id === l.class_id);
                return (
                  <div
                    key={l.id}
                    className="p-2 bg-slate-50 border rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-indigo-900">{sub?.subject_name}</span> —{' '}
                      <span className="font-semibold">Kelas {cls?.class_name}</span> ({tch?.full_name})
                      <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] font-mono">
                        {l.total_periods} JP ({Array.isArray(l.split_pattern) ? l.split_pattern.join('+') : l.split_pattern})
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteLesson(l.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
