import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Play,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Users,
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  X,
  Trash2,
  Check,
  Pencil,
  UserCheck,
  Layers,
  CheckSquare,
  Square,
  LogOut,
  KeyRound,
  School,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { triggerScheduleGeneration } from './lib/solverApi';
import { TimetableGrid } from './components/TimetableGrid';
import { MasterDataModal } from './components/MasterDataModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { AssignmentModal } from './components/AssignmentModal';
import { AuthPage } from './components/AuthPage';
import { AdminTokenModal } from './components/AdminTokenModal';
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

// Daftar email administrator yang berhak mengelola token & database
const ADMIN_EMAILS = [
  'joedie.meyson@gmail.com',
];

export const App: React.FC = () => {
  // State Autentikasi & Profil Sekolah
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [schoolProfile, setSchoolProfile] = useState<{
    school_name: string;
    full_name: string;
    school_address: string;
  } | null>(null);

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

  // State Modal Navigasi
  const [isMasterModalOpen, setIsMasterModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState<boolean>(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState<boolean>(false);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState<boolean>(false);
  const [isConstraintModalOpen, setIsConstraintModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  // State Konfigurasi Kartu Beban Mengajar (Multi-Kelas)
  const [configAssignmentKey, setConfigAssignmentKey] = useState<string>('');
  const [configTargetClassIds, setConfigTargetClassIds] = useState<string[]>([]);
  const [configSplitPattern, setConfigSplitPattern] = useState<string>('2+2');
  const [configZone, setConfigZone] = useState<'PRE' | 'FORMAL' | 'POST'>('FORMAL');
  const [configRoomId, setConfigRoomId] = useState<string>('');
  const [savingCardConfig, setSavingCardConfig] = useState<boolean>(false);

  // State Slot Waktu (Multi-Hari)
  const [targetDayIndices, setTargetDayIndices] = useState<number[]>([1, 2, 3, 4, 5]);
  const [slotPeriod, setSlotPeriod] = useState<number>(1);
  const [slotName, setSlotName] = useState<string>('Jam ke-1');
  const [slotStart, setSlotStart] = useState<string>('07:00');
  const [slotEnd, setSlotEnd] = useState<string>('07:45');
  const [slotType, setSlotType] = useState<'PRE' | 'FORMAL' | 'POST' | 'BREAK'>('FORMAL');
  const [savingSlot, setSavingSlot] = useState<boolean>(false);

  // State Syarat Jam Guru
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [unavailDayIndex, setUnavailDayIndex] = useState<number>(1);
  const [unavailPeriods, setUnavailPeriods] = useState<string>('ALL');
  const [savingConstraint, setSavingConstraint] = useState<boolean>(false);

  // State Solver Engine
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [jobStatus, setJobStatus] = useState<{
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
    message: string;
    elapsedMs?: number;
  }>({
    status: 'idle',
    message: 'GitHub Actions Solver: Siap',
  });

  // Validasi Hak Akses Admin
  const isAdmin = useMemo(() => {
    if (!session?.user?.email) return false;
    return ADMIN_EMAILS.map((email) => email.toLowerCase()).includes(
      session.user.email.toLowerCase()
    );
  }, [session?.user?.email]);

  // 1. Pemeriksaan Sesi Login Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setTeachers([]);
        setClasses([]);
        setSubjects([]);
        setLessons([]);
        setSchedules([]);
        setSchoolProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Mengambil Semua Data Milik Sekolah yang Sedang Login
  const fetchAllData = async () => {
    if (!session?.user) return;
    const schoolId = session.user.id;

    try {
      const [
        profileRes,
        daysRes,
        slotsRes,
        teachersRes,
        classesRes,
        roomsRes,
        subjectsRes,
        lessonsRes,
        schedulesRes,
      ] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
        supabase.from('work_days').select('*').eq('school_id', schoolId).order('day_index'),
        supabase.from('time_slots').select('*').eq('school_id', schoolId).order('day_index').order('period_number'),
        supabase.from('teachers').select('*').eq('school_id', schoolId).order('full_name'),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('grade_level').order('class_name'),
        supabase.from('rooms').select('*').eq('school_id', schoolId).order('room_name'),
        supabase.from('subjects').select('*').eq('school_id', schoolId).order('subject_name'),
        supabase.from('lessons').select('*').eq('school_id', schoolId),
        supabase.from('schedules').select('*').eq('school_id', schoolId),
      ]);

      if (profileRes.data) {
        setSchoolProfile(profileRes.data);
      }

      if (daysRes.data && daysRes.data.length === 0) {
        const defaultDays = [
          { school_id: schoolId, day_index: 1, day_name: 'Senin', is_active: true },
          { school_id: schoolId, day_index: 2, day_name: 'Selasa', is_active: true },
          { school_id: schoolId, day_index: 3, day_name: 'Rabu', is_active: true },
          { school_id: schoolId, day_index: 4, day_name: 'Kamis', is_active: true },
          { school_id: schoolId, day_index: 5, day_name: 'Jumat', is_active: true },
          { school_id: schoolId, day_index: 6, day_name: 'Sabtu', is_active: false },
        ];
        const { data: insertedDays } = await supabase.from('work_days').insert(defaultDays).select();
        if (insertedDays) setWorkDays(insertedDays);
      } else if (daysRes.data) {
        setWorkDays(daysRes.data);
      }

      if (slotsRes.data) setTimeSlots(slotsRes.data);
      if (teachersRes.data) {
        setTeachers(teachersRes.data);
        if (!selectedTeacherId && teachersRes.data.length > 0) setSelectedTeacherId(teachersRes.data[0].id);
      }
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
      console.error('Gagal mengambil data sekolah:', err.message);
    }
  };

  useEffect(() => {
    if (!session?.user) return;
    fetchAllData();

    const jobsChannel = supabase
      .channel('realtime_generation_jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generation_jobs',
          filter: `school_id=eq.${session.user.id}`,
        },
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
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
          filter: `school_id=eq.${session.user.id}`,
        },
        () => fetchAllData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(schedulesChannel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintMode('SINGLE');
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if (filterMode === 'CLASS' && classes.length > 0) {
      if (!classes.some((c) => c.id === selectedId)) setSelectedId(classes[0].id);
    } else if (filterMode === 'TEACHER' && teachers.length > 0) {
      if (!teachers.some((t) => t.id === selectedId)) setSelectedId(teachers[0].id);
    }
  }, [filterMode, classes, teachers]);

  const handleLogout = async () => {
    if (!confirm('Keluar dari sesi akun sekolah ini?')) return;
    await supabase.auth.signOut();
  };

  const uniqueSubjectTeacherPairs = useMemo(() => {
    const map = new Map<string, { teacherId: string; subjectId: string; totalPeriods: number }>();
    lessons.forEach((l) => {
      const key = `${l.teacher_id}__${l.subject_id}`;
      if (!map.has(key)) {
        map.set(key, {
          teacherId: l.teacher_id,
          subjectId: l.subject_id,
          totalPeriods: Number(l.total_periods ?? l.total_periods_per_week ?? 4),
        });
      }
    });
    return Array.from(map.entries()).map(([key, data]) => ({ key, ...data }));
  }, [lessons]);

  // Validasi Kesiapan Data Penjadwalan
  const validationStatus = useMemo(() => {
    const issues: string[] = [];

    if (teachers.length === 0) issues.push('Belum ada data Guru di Master Data.');
    if (classes.length === 0) issues.push('Belum ada data Kelas di Master Data.');
    if (subjects.length === 0) issues.push('Belum ada data Mata Pelajaran.');
    if (timeSlots.length === 0) issues.push('Slot Hari & Jam belum dikonfigurasi.');
    if (lessons.length === 0) issues.push('Belum ada Kartu Beban Mengajar yang dibuat.');

    if (teachers.length > 0 && lessons.length > 0) {
      const unassignedTeachers = teachers.filter(
        (t) => !lessons.some((l) => l.teacher_id === t.id)
      );
      if (unassignedTeachers.length > 0) {
        const names = unassignedTeachers.map((t) => t.full_name).slice(0, 2).join(', ');
        const extra = unassignedTeachers.length > 2 ? ` (+${unassignedTeachers.length - 2} lainnya)` : '';
        issues.push(`Guru belum memiliki penugasan jam: ${names}${extra}`);
      }
    }

    if (classes.length > 0 && lessons.length > 0) {
      const unassignedClasses = classes.filter(
        (c) => !lessons.some((l) => l.class_id === c.id)
      );
      if (unassignedClasses.length > 0) {
        const names = unassignedClasses.map((c) => c.class_name).slice(0, 3).join(', ');
        const extra = unassignedClasses.length > 3 ? ` (+${unassignedClasses.length - 3} lainnya)` : '';
        issues.push(`Kelas belum memiliki kartu pelajaran: ${names}${extra}`);
      }
    }

    if (lessons.length > 0) {
      const invalidLessons = lessons.filter((l) => {
        if (!l.allowed_slot_types) return true;
        const totalJP = Number(l.total_periods ?? l.total_periods_per_week ?? 0);
        if (totalJP <= 0) return true;

        const patternStr = Array.isArray(l.split_pattern)
          ? l.split_pattern.join('+')
          : String(l.split_pattern || '').trim();

        if (!patternStr) return true;
        const parts = patternStr
          .split('+')
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && n > 0);

        if (parts.length === 0) return true;
        const sum = parts.reduce((a, b) => a + b, 0);
        return sum !== totalJP;
      });

      if (invalidLessons.length > 0) {
        issues.push(
          `Ada ${invalidLessons.length} kartu beban mengajar yang pola pecah bloknya belum sesuai dengan total JP atau zona slotnya belum diatur.`
        );
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }, [teachers, classes, subjects, timeSlots, lessons]);

  const handleAssignmentKeyChange = (key: string) => {
    setConfigAssignmentKey(key);
    if (!key) {
      setConfigTargetClassIds([]);
      return;
    }
    const [tId, sId] = key.split('__');
    const matchedLessons = lessons.filter((l) => l.teacher_id === tId && l.subject_id === sId);
    setConfigTargetClassIds(matchedLessons.map((l) => l.class_id));

    if (matchedLessons.length > 0) {
      const first = matchedLessons[0];
      setConfigSplitPattern(
        Array.isArray(first.split_pattern) ? first.split_pattern.join('+') : String(first.split_pattern)
      );
      setConfigZone((first.allowed_slot_types as any) || 'FORMAL');
      setConfigRoomId(first.preferred_room_id || '');
    }
  };

  const handleSaveCardConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configAssignmentKey || configTargetClassIds.length === 0) return;

    const [, sId] = configAssignmentKey.split('__');
    const targetPair = uniqueSubjectTeacherPairs.find((p) => p.key === configAssignmentKey);
    const expectedTotalJP = targetPair?.totalPeriods || 4;

    const parts = configSplitPattern
      .split('+')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    const sum = parts.reduce((a, b) => a + b, 0);

    if (sum !== expectedTotalJP) {
      alert(
        `Total jam pada pola pecah blok (${parts.join('+')} = ${sum} JP) tidak cocok dengan beban mata pelajaran (${expectedTotalJP} JP)!`
      );
      return;
    }

    setSavingCardConfig(true);
    try {
      const cleanPatternString = parts.join('+');

      for (const classId of configTargetClassIds) {
        const existing = lessons.find((l) => l.class_id === classId && l.subject_id === sId);
        if (existing) {
          const { error } = await supabase
            .from('lessons')
            .update({
              split_pattern: cleanPatternString,
              allowed_slot_types: configZone,
              preferred_room_id: configRoomId || null,
            })
            .eq('id', existing.id);
          if (error) throw error;
        }
      }

      await fetchAllData();
      alert(`Berhasil memperbarui kartu beban mengajar untuk ${configTargetClassIds.length} kelas!`);
    } catch (err: any) {
      alert(`Gagal menyimpan pengaturan kartu: ${err.message}`);
    } finally {
      setSavingCardConfig(false);
    }
  };

  const handleEditSingleLesson = (l: Lesson) => {
    const key = `${l.teacher_id}__${l.subject_id}`;
    setConfigAssignmentKey(key);
    setConfigTargetClassIds([l.class_id]);
    setConfigSplitPattern(
      Array.isArray(l.split_pattern) ? l.split_pattern.join('+') : String(l.split_pattern)
    );
    setConfigZone((l.allowed_slot_types as any) || 'FORMAL');
    setConfigRoomId(l.preferred_room_id || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Hapus kartu pelajaran ini?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (!error) fetchAllData();
  };

  const handleToggleDay = async (day: WorkDay) => {
    const { error } = await supabase
      .from('work_days')
      .update({ is_active: !day.is_active })
      .eq('id', day.id);
    if (!error) fetchAllData();
  };

  const handleToggleTargetDay = (dayIndex: number) => {
    setTargetDayIndices((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const handleSelectAllActiveDays = () => {
    const activeIndices = workDays.filter((d) => d.is_active).map((d) => d.day_index);
    setTargetDayIndices(activeIndices);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || targetDayIndices.length === 0) return;

    setSavingSlot(true);
    try {
      const recordsToUpsert = targetDayIndices.map((dayIdx) => ({
        school_id: session.user.id,
        day_index: dayIdx,
        period_number: Number(slotPeriod),
        slot_name: slotName.trim(),
        start_time: slotStart,
        end_time: slotEnd,
        slot_type: slotType,
      }));

      const { error } = await supabase
        .from('time_slots')
        .upsert(recordsToUpsert, { onConflict: 'school_id,day_index,period_number' });

      if (error) throw error;
      await fetchAllData();
      alert(`Berhasil menyimpan "${slotName}" untuk ${targetDayIndices.length} hari kerja!`);
    } catch (err: any) {
      alert(`Gagal menyimpan slot waktu: ${err.message}`);
    } finally {
      setSavingSlot(false);
    }
  };

  const handleResetAllSlots = async () => {
    if (!session?.user) return;
    const konfirmasi = window.confirm(
      'PERINGATAN: Mengosongkan seluruh slot jam juga akan menghapus jadwal pelajaran sekolah Anda yang saat ini terpasang di matriks.\n\nLanjutkan?'
    );
    if (!konfirmasi) return;

    setSavingSlot(true);
    try {
      await supabase.from('schedules').delete().eq('school_id', session.user.id);
      await supabase.from('time_slots').delete().eq('school_id', session.user.id);
      await fetchAllData();
      alert('Semua slot jam dan jadwal berhasil dikosongkan!');
    } catch (err: any) {
      alert(`Gagal mengosongkan slot jam: ${err.message}`);
    } finally {
      setSavingSlot(false);
    }
  };

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
    const { error } = await supabase.from('teachers').update({ unavailable_slots: [] }).eq('id', teacherId);
    if (!error) fetchAllData();
  };

  // Pemicu Solver GitHub Actions dengan Peringatan & Konfirmasi
  const handleTriggerSolver = async () => {
    // 1. Jika data belum lengkap, tampilkan peringatan rincian dan minta konfirmasi apakah tetap ingin melanjutkan
    if (!validationStatus.isValid) {
      const warningMessage =
        'PERINGATAN: Pengaturan data belum lengkap:\n\n' +
        validationStatus.issues.map((issue) => `• ${issue}`).join('\n') +
        '\n\nMenyusun jadwal saat data belum lengkap dapat menyebabkan jadwal tidak optimal atau gagal memenuhi target jam.\n\nApakah Anda yakin tetap ingin melanjutkan proses generate jadwal otomatis?';

      const proceedWithIncomplete = window.confirm(warningMessage);
      if (!proceedWithIncomplete) return;
    } else {
      // 2. Jika seluruh data sudah lengkap, tampilkan konfirmasi standar
      const proceedComplete = window.confirm(
        'Seluruh data guru, rombel kelas, pola jam, dan slot waktu telah lengkap.\n\nJalankan mesin Google OR-Tools di GitHub Actions untuk menyusun jadwal sekolah Anda?'
      );
      if (!proceedComplete) return;
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
      setJobStatus({ status: 'failed', message: `Gagal: ${err.message}` });
    }
  };

  const handleExportExcel = () => {
    if (schedules.length === 0) {
      alert('Belum ada jadwal yang terbentuk untuk diekspor.');
      return;
    }

    const activeDays = workDays.filter((d) => d.is_active);
    const uniquePeriods = Array.from(new Set(timeSlots.map((s) => s.period_number))).sort((a, b) => a - b);
    const wb = XLSX.utils.book_new();

    classes.forEach((cls) => {
      const rows: any[] = [];
      const headerRow = ['Jam Ke', ...activeDays.map((d) => d.day_name)];
      rows.push(headerRow);

      uniquePeriods.forEach((period) => {
        const row = [`Jam ke-${period}`];
        activeDays.forEach((day) => {
          const slot = timeSlots.find((s) => s.day_index === day.day_index && s.period_number === period);
          if (!slot) {
            row.push('-');
            return;
          }
          if (slot.slot_type === 'BREAK') {
            row.push(`ISTIRAHAT (${slot.slot_name})`);
            return;
          }

          const item = schedules.find((sc) => sc.time_slot_id === slot.id && sc.class_id === cls.id);
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

    const schoolSlug = schoolProfile?.school_name?.replace(/\s+/g, '_') || 'Sekolah';
    XLSX.writeFile(wb, `Jadwal_${schoolSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrintBatch = (mode: 'SINGLE' | 'ALL_CLASSES' | 'ALL_TEACHERS') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 450);
  };

  const currentSingleTitle = useMemo(() => {
    const prefix = schoolProfile?.school_name ? `${schoolProfile.school_name.toUpperCase()} — ` : '';
    if (filterMode === 'CLASS') {
      const cls = classes.find((c) => c.id === selectedId);
      return cls ? `${prefix}JADWAL KELAS ${cls.class_name.toUpperCase()}` : 'JADWAL PELAJARAN';
    } else {
      const tch = teachers.find((t) => t.id === selectedId);
      return tch ? `${prefix}JADWAL MENGAJAR: ${tch.full_name.toUpperCase()}` : 'JADWAL MENGAJAR';
    }
  }, [filterMode, selectedId, classes, teachers, schoolProfile]);

  // Loading state sesi
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        <span>Memeriksa sesi autentikasi sekolah...</span>
      </div>
    );
  }

  // Tampilkan AuthPage jika belum login
  if (!session) {
    return <AuthPage onAuthSuccess={fetchAllData} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm 6mm;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header.app-navbar, nav, .print\\:hidden, button, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            display: block !important;
          }
          .print-sheet {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .sheet-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
            height: auto !important;
            max-height: 28px !important;
            margin: 0 0 4px 0 !important;
            padding: 0 0 3px 0 !important;
            border-bottom: 1.5px solid #0f172a !important;
          }
          .sheet-header h2 {
            font-size: 10pt !important;
            font-weight: 800 !important;
            margin: 0 !important;
            color: #0f172a !important;
          }
          .sheet-header span {
            font-size: 7.5pt !important;
            color: #475569 !important;
          }
          .print-sheet div {
            overflow: visible !important;
            box-shadow: none !important;
            max-height: none !important;
          }
          .print-sheet table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-sheet tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-sheet th {
            background-color: #0f172a !important;
            color: #ffffff !important;
            font-size: 8pt !important;
            font-weight: 700 !important;
            padding: 3px 4px !important;
            border: 1px solid #334155 !important;
          }
          .print-sheet td {
            padding: 2px 3px !important;
            border: 1px solid #cbd5e1 !important;
            vertical-align: top !important;
          }
          .print-sheet td > div, .print-sheet [class*="min-h-"] {
            min-height: 0 !important;
            height: auto !important;
            padding: 1.5px 3px !important;
            margin: 0 !important;
          }
          .print-sheet td p, .print-sheet td span, .print-sheet td div {
            font-size: 7.5pt !important;
            line-height: 1.1 !important;
          }
        }
      `}</style>

      {/* HEADER NAVIGASI UTAMA */}
      <header className="app-navbar bg-white border-b border-slate-200 px-6 py-3 shadow-sm sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <School className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-slate-900 leading-tight">
                  {schoolProfile?.school_name || 'Smart Timetable CSP'}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {jobStatus.message}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                User: <span className="font-semibold text-slate-700">{schoolProfile?.full_name || session.user.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tombol Panel Token (Khusus Admin) */}
            {isAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition shadow-sm"
                title="Generate dan kelola token akses sekolah"
              >
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Panel Token</span>
              </button>
            )}

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
              onClick={() => setIsAssignmentModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold transition shadow-sm"
            >
              <UserCheck className="w-4 h-4 text-indigo-700" />
              <span>Penugasan Guru</span>
            </button>

            <button
              onClick={() => {
                if (uniqueSubjectTeacherPairs.length > 0 && !configAssignmentKey) {
                  handleAssignmentKeyChange(uniqueSubjectTeacherPairs[0].key);
                }
                setIsLessonModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Kartu Beban Mengajar</span>
            </button>

            <button
              onClick={() => {
                handleSelectAllActiveDays();
                setIsSlotModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
            >
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Hari & Jam</span>
            </button>

            <button
              onClick={() => setIsConstraintModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Syarat Jam Guru</span>
            </button>

            {/* TOMBOL GENERATE JADWAL OTOMATIS: SELALU AKTIF */}
            <button
              onClick={handleTriggerSolver}
              disabled={isGenerating}
              title={
                !validationStatus.isValid
                  ? 'Catatan: Ada beberapa pengaturan data yang belum lengkap. Klik untuk melihat detail & konfirmasi.'
                  : 'Klik untuk membuat jadwal otomatis'
              }
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                isGenerating
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 cursor-pointer'
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

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition"
              title="Keluar dari akun sekolah"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* BANNER STATUS KESIAPAN DATA (INFORMASIONAL) */}
      {!validationStatus.isValid && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-3 print:hidden">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Pengaturan jadwal belum lengkap:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800 text-[11px]">
                {validationStatus.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-amber-700 italic">
                * Anda tetap dapat menekan tombol "Generate Jadwal Otomatis" untuk melanjutkan jika diinginkan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BANNER STATUS SOLVER */}
      {jobStatus.status !== 'idle' && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-3 print:hidden">
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
                <span className="text-[11px] font-mono opacity-75">({jobStatus.elapsedMs} ms)</span>
              )}
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/70 border border-current">
              {jobStatus.status}
            </span>
          </div>
        </div>
      )}

      {/* TOOLBAR FILTER & MATRIKS */}
      <main className="max-w-7xl mx-auto w-full px-6 py-4 flex-1 flex flex-col gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setFilterMode('CLASS')}
                className={`px-3 py-1.5 rounded-md transition ${
                  filterMode === 'CLASS' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Matriks per Kelas
              </button>
              <button
                onClick={() => setFilterMode('TEACHER')}
                className={`px-3 py-1.5 rounded-md transition ${
                  filterMode === 'TEACHER' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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

        {/* MATRIKS JADWAL */}
        <div className="flex-1">
          {printMode === 'SINGLE' && (
            <div className="print-sheet">
              <div className="sheet-header hidden print:flex">
                <h2>{currentSingleTitle}</h2>
                <span>{schoolProfile?.school_address || 'sekolah.ewahyu.my.id'}</span>
              </div>
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
            </div>
          )}

          {printMode === 'ALL_CLASSES' && (
            <div>
              {classes.map((cls) => (
                <div key={cls.id} className="print-sheet">
                  <div className="sheet-header">
                    <h2>
                      {schoolProfile?.school_name ? `${schoolProfile.school_name.toUpperCase()} — ` : ''}
                      JADWAL PELAJARAN KELAS {cls.class_name.toUpperCase()}
                    </h2>
                    <span>{schoolProfile?.school_address || 'sekolah.ewahyu.my.id'}</span>
                  </div>
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
            <div>
              {teachers.map((tch) => (
                <div key={tch.id} className="print-sheet">
                  <div className="sheet-header">
                    <h2>
                      {schoolProfile?.school_name ? `${schoolProfile.school_name.toUpperCase()} — ` : ''}
                      JADWAL MENGAJAR: {tch.full_name.toUpperCase()} ({tch.teacher_code})
                    </h2>
                    <span>{schoolProfile?.school_address || 'sekolah.ewahyu.my.id'}</span>
                  </div>
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

      {/* MODAL ADMIN TOKEN (HANYA DI-RENDER JIKA LOGIN SEBAGAI ADMIN) */}
      {isAdmin && (
        <AdminTokenModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} />
      )}

      {/* MODAL MASTER DATA */}
      <MasterDataModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        teachers={teachers}
        subjects={subjects}
        classes={classes}
        rooms={rooms}
        onDataUpdated={fetchAllData}
      />

      {/* MODAL IMPORT EXCEL */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onDataImported={fetchAllData}
      />

      {/* MODAL PENUGASAN GURU */}
      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        teachers={teachers}
        subjects={subjects}
        classes={classes}
        lessons={lessons}
        onDataUpdated={fetchAllData}
      />

      {/* MODAL KARTU BEBAN MENGAJAR */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden p-6 space-y-4 text-xs max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pengaturan Kartu Beban Mengajar (Lesson Cards)
                </h2>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Atur Pola Pecah Blok (Split), Zona Slot, dan Ruangan Khusus untuk beberapa kelas sekaligus
                </p>
              </div>
              <button onClick={() => setIsLessonModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-700" />
              </button>
            </div>

            {lessons.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <UserCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Belum Ada Penugasan Mengajar</p>
                <p className="text-[11px] text-slate-500 mt-1 mb-4">
                  Buka menu "Penugasan Guru" terlebih dahulu untuk menentukan guru, mapel, kelas, dan jumlah JP.
                </p>
                <button
                  onClick={() => {
                    setIsLessonModalOpen(false);
                    setIsAssignmentModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg"
                >
                  Buka Menu Penugasan Guru
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveCardConfig} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pilih Penugasan Guru & Mata Pelajaran:
                  </label>
                  <select
                    value={configAssignmentKey}
                    onChange={(e) => handleAssignmentKeyChange(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white font-semibold text-slate-800"
                  >
                    {uniqueSubjectTeacherPairs.map((pair) => {
                      const sub = subjects.find((s) => s.id === pair.subjectId);
                      const tch = teachers.find((t) => t.id === pair.teacherId);
                      return (
                        <option key={pair.key} value={pair.key}>
                          {sub?.subject_name} — {tch?.full_name} ({pair.totalPeriods} JP / Minggu)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block font-bold text-slate-700">Terapkan Pengaturan ke Kelas:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const [tId, sId] = configAssignmentKey.split('__');
                          const matched = lessons.filter((l) => l.teacher_id === tId && l.subject_id === sId);
                          setConfigTargetClassIds(matched.map((l) => l.class_id));
                        }}
                        className="text-[11px] text-indigo-600 hover:underline font-semibold"
                      >
                        Pilih Semua Kelas Terkait
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setConfigTargetClassIds([])}
                        className="text-[11px] text-rose-600 hover:underline font-semibold"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const [tId, sId] = configAssignmentKey.split('__');
                      const availableClassesForPair = lessons
                        .filter((l) => l.teacher_id === tId && l.subject_id === sId)
                        .map((l) => classes.find((c) => c.id === l.class_id))
                        .filter(Boolean) as ClassRoom[];

                      return availableClassesForPair.map((cls) => {
                        const isChecked = configTargetClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => {
                              setConfigTargetClassIds((prev) =>
                                prev.includes(cls.id) ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-lg font-bold border transition flex items-center gap-1.5 ${
                              isChecked
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-50" />}
                            <span>Kelas {cls.class_name}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pola Pecah Blok (Split)</label>
                    <input
                      type="text"
                      value={configSplitPattern}
                      onChange={(e) => setConfigSplitPattern(e.target.value)}
                      placeholder="Contoh: 2+2 atau 3"
                      className="w-full p-2 border rounded-lg bg-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Zona Slot Diizinkan</label>
                    <select
                      value={configZone}
                      onChange={(e) => setConfigZone(e.target.value as any)}
                      className="w-full p-2 border rounded-lg bg-white"
                    >
                      <option value="FORMAL">FORMAL (KBM Utama)</option>
                      <option value="PRE">PRE (Pra-KBM / Pagi)</option>
                      <option value="POST">POST (Sore / Ekskul)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ruangan Khusus</label>
                    <select
                      value={configRoomId}
                      onChange={(e) => setConfigRoomId(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white"
                    >
                      <option value="">-- Ruang Kelas Reguler --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.room_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingCardConfig || configTargetClassIds.length === 0}
                    className={`px-5 py-2 rounded-lg text-white font-bold transition flex items-center gap-1.5 ${
                      savingCardConfig || configTargetClassIds.length === 0
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Terapkan Pengaturan ({configTargetClassIds.length} Kelas Terpilih)</span>
                  </button>
                </div>
              </form>
            )}

            <div className="border-t pt-3 overflow-y-auto flex-1 space-y-1.5">
              <p className="font-bold text-slate-600 mb-1">
                Daftar Kartu Beban Mengajar Terdaftar ({lessons.length})
              </p>
              {lessons.map((l) => {
                const tch = teachers.find((t) => t.id === l.teacher_id);
                const sub = subjects.find((s) => s.id === l.subject_id);
                const cls = classes.find((c) => c.id === l.class_id);
                const rm = rooms.find((r) => r.id === l.preferred_room_id);
                return (
                  <div
                    key={l.id}
                    className="p-2.5 bg-slate-50 border rounded-lg flex items-center justify-between hover:bg-slate-100/70 transition"
                  >
                    <div>
                      <span className="font-bold text-indigo-900">{sub?.subject_name}</span> —{' '}
                      <span className="font-semibold text-slate-800">Kelas {cls?.class_name}</span> ({tch?.full_name})
                      {rm && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-semibold">
                          [{rm.room_name}]
                        </span>
                      )}
                      <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] font-mono">
                        {l.total_periods ?? l.total_periods_per_week ?? 0} JP (
                        {Array.isArray(l.split_pattern) ? l.split_pattern.join('+') : l.split_pattern})
                      </span>
                      <span className="ml-1.5 px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                        {l.allowed_slot_types}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditSingleLesson(l)}
                        className="text-slate-400 hover:text-amber-600 p-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLesson(l.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL SLOT JAM */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Konfigurasi Hari Kerja & Slot Jam (Pre / Formal / Post)
                </h2>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Atur hari aktif sekolah dan terapkan slot waktu ke beberapa hari sekaligus
                </p>
              </div>
              <button onClick={() => setIsSlotModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-700" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-500 uppercase mb-2">Hari Kerja Aktif Sekolah</label>
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

            <form onSubmit={handleSaveSlot} className="space-y-3.5 border-t pt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700">Terapkan Slot Ini ke Hari:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllActiveDays}
                      className="text-[11px] text-indigo-600 hover:underline font-semibold"
                    >
                      Pilih Semua Hari Aktif
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setTargetDayIndices([])}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {workDays
                    .filter((d) => d.is_active)
                    .map((d) => {
                      const isSelected = targetDayIndices.includes(d.day_index);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleToggleTargetDay(d.day_index)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span>{d.day_name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Periode Ke-</label>
                  <input
                    type="number"
                    min={0}
                    max={16}
                    value={slotPeriod}
                    onChange={(e) => setSlotPeriod(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tipe Zona Waktu</label>
                  <select
                    value={slotType}
                    onChange={(e) => setSlotType(e.target.value as any)}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="FORMAL">FORMAL (KBM Inti)</option>
                    <option value="PRE">PRE (Pra-KBM / Pagi)</option>
                    <option value="POST">POST (Ekskul / Sore)</option>
                    <option value="BREAK">BREAK (Istirahat)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Label Slot</label>
                <input
                  type="text"
                  value={slotName}
                  onChange={(e) => setSlotName(e.target.value)}
                  placeholder="Contoh: Jam ke-1 / Istirahat Siang"
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={handleResetAllSlots}
                  disabled={savingSlot}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Kosongkan Semua Slot Jam</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSlotModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={savingSlot || targetDayIndices.length === 0}
                    className={`px-5 py-2 rounded-lg text-white font-bold transition ${
                      savingSlot || targetDayIndices.length === 0
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'
                    }`}
                  >
                    {savingSlot ? 'Menyimpan...' : `Simpan Slot Waktu (${targetDayIndices.length} Hari Terpilih)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SYARAT JAM GURU */}
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
                  <label className="block font-semibold mb-1">Jam Ke (Ketik ALL atau pisah koma: 1,2)</label>
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
                  <div key={t.id} className="p-2.5 bg-slate-50 rounded-lg border flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{t.full_name}</p>
                      <p className="text-[11px] text-slate-500">{JSON.stringify(t.unavailable_slots)}</p>
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
    </div>
  );
};

export default App;
