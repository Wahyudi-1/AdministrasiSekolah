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
  BookOpen,
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabaseClient';
import { triggerScheduleGeneration, getLatestJobStatus } from './lib/solverApi';
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

  // State Modal
  const [isMasterModalOpen, setIsMasterModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // State Solver Engine & Realtime Job
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [jobStatus, setJobStatus] = useState<{
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
    message: string;
    elapsedMs?: number;
  }>({
    status: 'idle',
    message: 'GitHub Actions Solver: Siap menyusun jadwal.',
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
        supabase.from('time_slots').select('*').order('period_number'),
        supabase.from('teachers').select('*').order('full_name'),
        supabase.from('classes').select('*').order('grade_level').order('class_name'),
        supabase.from('rooms').select('*').order('room_name'),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('lessons').select('*'),
        supabase.from('schedules').select('*'),
      ]);

      if (daysRes.data) setWorkDays(daysRes.data);
      if (slotsRes.data) setTimeSlots(slotsRes.data);
      if (teachersRes.data) setTeachers(teachersRes.data);
      if (classesRes.data) {
        setClasses(classesRes.data);
        if (!selectedId && classesRes.data.length > 0 && filterMode === 'CLASS') {
          setSelectedId(classesRes.data[0].id);
        }
      }
      if (roomsRes.data) setRooms(roomsRes.data);
      if (subjectsRes.data) setSubjects(subjectsRes.data);
      if (lessonsRes.data) setLessons(lessonsRes.data);
      if (schedulesRes.data) setSchedules(schedulesRes.data);
    } catch (err: any) {
      console.error('Gagal mengambil data:', err.message);
    }
  };

  useEffect(() => {
    fetchAllData();

    // 2. Langganan Realtime Supabase untuk Tabel 'generation_jobs' & 'schedules'
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

  // Update selectedId ketika beralih antara filter Guru / Kelas
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

  // 3. Memicu Pembuatan Jadwal Otomatis (Solver Engine)
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

  // 4. Ekspor Matriks Jadwal ke Excel (.xlsx)
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

    // Buat Sheet per Kelas
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
            row.push(`${subject?.subject_name || 'Mapel'}\n(${teacher?.full_name || 'Guru'})`);
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      
      {/* HEADER NAVIGASI UTAMA */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Judul Sistem */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-slate-900 leading-tight">
                  Smart Timetable CSP
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  GitHub Actions + Supabase
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sistem Penjadwalan Sekolah Otomatis Bebas Bentrok
              </p>
            </div>
          </div>

          {/* Tombol Aksi Pengaturan & Master Data */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Tombol Master Data */}
            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
              title="Kelola Guru, Mapel, dan Kelas"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Master Data</span>
            </button>

            {/* Tombol Import Excel Massal */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition shadow-sm"
              title="Upload file Excel Guru, Mapel, dan Kelas"
            >
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>Import Excel</span>
            </button>

            {/* Tombol Eksekusi Solver */}
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

      {/* BANNER STATUS SOLVER / REALTIME NOTIFIKASI */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-4">
        <div
          className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs transition ${
            jobStatus.status === 'processing'
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : jobStatus.status === 'completed'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : jobStatus.status === 'failed'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-white border-slate-200 text-slate-600 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {jobStatus.status === 'processing' || jobStatus.status === 'queued' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            ) : jobStatus.status === 'completed' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : jobStatus.status === 'failed' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sliders className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span className="font-medium">{jobStatus.message}</span>
            {jobStatus.elapsedMs && (
              <span className="text-[11px] font-mono opacity-75">
                (Selesai dalam {jobStatus.elapsedMs} ms)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/70 border border-current">
              Status: {jobStatus.status}
            </span>
          </div>
        </div>
      </div>

      {/* TOOLBAR FILTER & EKSPOR */}
      <main className="max-w-7xl mx-auto w-full px-6 py-4 flex-1 flex flex-col gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          
          {/* Pilihan Mode Tampilan: Matriks per Kelas / Guru */}
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

            {/* Dropdown Pilihan Kelas / Guru */}
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {filterMode === 'CLASS'
                ? classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.class_name} (Tingkat {c.grade_level})
                    </option>
                  ))
                : teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.teacher_code})
                    </option>
                  ))}
            </select>

            <button
              onClick={fetchAllData}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800"
              title="Segarkan Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Tombol Cetak & Ekspor */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak PDF</span>
            </button>
          </div>

        </div>

        {/* MATRIKS JADWAL UTAMA */}
        <div className="flex-1">
          {classes.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-sm">Data Masih Kosong</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Mulai dengan menambahkan data Guru, Mapel, dan Kelas via Master Data atau Import Excel.
              </p>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
              >
                Upload File Excel Sekarang
              </button>
            </div>
          ) : (
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
        </div>
      </main>

      {/* MODAL 1: PENGELOLAAN MASTER DATA */}
      <MasterDataModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        teachers={teachers}
        subjects={subjects}
        classes={classes}
        onDataUpdated={fetchAllData}
      />

      {/* MODAL 2: IMPORT MASSAL DARI EXCEL */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onDataImported={fetchAllData}
      />

    </div>
  );
};
