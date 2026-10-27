import { useState, useEffect } from 'react';
import {
  Calendar,
  Play,
  Plus,
  Clock,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useRealtimeSchedule } from './hooks/useRealtimeSchedule';
import { triggerScheduleGeneration } from './lib/solverApi';
import { TimetableGrid } from './components/TimetableGrid';
import { MasterDataModal } from './components/MasterDataModal';
import { TimeConfigModal } from './components/TimeConfigModal';
import { TeacherConstraintModal } from './components/TeacherConstraintModal';

export default function App() {
  const {
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
    refreshData,
  } = useRealtimeSchedule();

  const [filterMode, setFilterMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [isConstraintModalOpen, setIsConstraintModalOpen] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  useEffect(() => {
    if (filterMode === 'CLASS' && classes.length > 0 && !selectedId) {
      setSelectedId(classes[0].id);
    } else if (filterMode === 'TEACHER' && teachers.length > 0 && !selectedId) {
      setSelectedId(teachers[0].id);
    }
  }, [filterMode, classes, teachers, selectedId]);

  const handleModeChange = (mode: 'CLASS' | 'TEACHER') => {
    setFilterMode(mode);
    setSelectedId(mode === 'CLASS' ? classes[0]?.id || '' : teachers[0]?.id || '');
  };

  const handleGenerate = async () => {
    try {
      setIsTriggering(true);
      await triggerScheduleGeneration();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTriggering(false);
    }
  };

  const isSolving =
    isTriggering || activeJob?.status === 'queued' || activeJob?.status === 'processing';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header Utama */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Smart Timetable CSP</h1>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    solverOnline
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {solverOnline ? 'Solver Render: Aktif' : 'Solver Render: Standby'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Penjadwalan Otomatis Anti-Bentrok (Supabase + Render OR-Tools)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsTimeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium"
            >
              <Clock className="w-4 h-4 text-slate-600" />
              Hari & Jam (Pre/Post)
            </button>

            <button
              onClick={() => setIsConstraintModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Syarat Jam Guru
            </button>

            <button
              onClick={() => setIsLessonModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              Tambah Kartu Mapel
            </button>

            <button
              onClick={handleGenerate}
              disabled={isSolving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold shadow-sm transition"
            >
              {isSolving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isSolving ? 'Menyusun Jadwal...' : 'Generate Jadwal Otomatis'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Notifikasi Status Realtime */}
        {activeJob && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              activeJob.status === 'completed'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : activeJob.status === 'failed'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-indigo-50 border-indigo-300 text-indigo-900'
            }`}
          >
            <div className="flex items-center gap-3 text-sm">
              {activeJob.status === 'completed' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              {activeJob.status === 'failed' && <AlertCircle className="w-5 h-5 text-rose-600" />}
              {(activeJob.status === 'queued' || activeJob.status === 'processing') && (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              )}
              <div>
                <span className="font-bold uppercase text-xs mr-2 px-2 py-0.5 rounded bg-white/70">
                  {activeJob.status}
                </span>
                <span>{activeJob.progress_message}</span>
              </div>
            </div>
            {activeJob.execution_time_ms && (
              <span className="text-xs font-mono opacity-75">
                Selesai dalam {activeJob.execution_time_ms} ms
              </span>
            )}
          </div>
        )}

        {/* Bar Filter Matriks */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-100">
              <button
                onClick={() => handleModeChange('CLASS')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filterMode === 'CLASS' ? 'bg-white shadow text-indigo-600' : 'text-slate-600'
                }`}
              >
                Matriks per Kelas
              </button>
              <button
                onClick={() => handleModeChange('TEACHER')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filterMode === 'TEACHER' ? 'bg-white shadow text-indigo-600' : 'text-slate-600'
                }`}
              >
                Matriks per Guru
              </button>
            </div>

            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium bg-white"
            >
              {filterMode === 'CLASS'
                ? classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.class_name}
                    </option>
                  ))
                : teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.teacher_code})
                    </option>
                  ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Kartu Pelajaran: {lessons.length}</span>
            <span>Slot Terisi: {schedules.length}</span>
            <button
              onClick={refreshData}
              className="flex items-center gap-1 text-indigo-600 hover:underline font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Segarkan
            </button>
          </div>
        </div>

        {/* Matriks Jadwal */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">Memuat jadwal dari Supabase...</div>
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
          />
        )}
      </main>

      {/* Kumpulan Modal Konfigurasi */}
      <MasterDataModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        onSuccess={refreshData}
        teachers={teachers}
        classes={classes}
        subjects={subjects}
        rooms={rooms}
      />

      <TimeConfigModal
        isOpen={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onSuccess={refreshData}
        workDays={workDays}
      />

      <TeacherConstraintModal
        isOpen={isConstraintModalOpen}
        onClose={() => setIsConstraintModalOpen(false)}
        onSuccess={refreshData}
        teachers={teachers}
        workDays={workDays}
      />
    </div>
  );
}
