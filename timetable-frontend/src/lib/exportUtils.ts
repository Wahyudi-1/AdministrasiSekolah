import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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

interface ExportParams {
  workDays: WorkDay[];
  timeSlots: TimeSlot[];
  teachers: Teacher[];
  classes: ClassRoom[];
  rooms: Room[];
  subjects: Subject[];
  lessons: Lesson[];
  schedules: ScheduleItem[];
}

/**
 * Fungsi pembantu untuk menyusun baris matriks jadwal (digunakan oleh PDF & Excel)
 */
function buildMatrixRows(
  params: ExportParams,
  filterMode: 'CLASS' | 'TEACHER',
  targetId: string
): { head: string[][]; body: string[][] } {
  const { workDays, timeSlots, teachers, classes, rooms, subjects, lessons, schedules } = params;
  const activeDays = workDays.filter((d) => d.is_active);
  const uniquePeriods = Array.from(new Set(timeSlots.map((s) => s.period_number))).sort(
    (a, b) => a - b
  );

  const head = [['Periode', ...activeDays.map((d) => d.day_name)]];

  const body = uniquePeriods.map((periodNum) => {
    const row: string[] = [`Jam ke-${periodNum}`];

    activeDays.forEach((day) => {
      const slot = timeSlots.find(
        (s) => s.day_index === day.day_index && s.period_number === periodNum
      );

      if (!slot) {
        row.push('-');
        return;
      }

      const timeRange = `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`;

      if (slot.slot_type === 'BREAK') {
        row.push(`ISTIRAHAT: ${slot.slot_name}\n(${timeRange})`);
        return;
      }

      const scheduled = schedules.find(
        (sc) =>
          sc.time_slot_id === slot.id &&
          (filterMode === 'CLASS' ? sc.class_id === targetId : sc.teacher_id === targetId)
      );

      if (!scheduled) {
        row.push(`(${timeRange})\n-`);
        return;
      }

      const lesson = lessons.find((l) => l.id === scheduled.lesson_id);
      const subject = subjects.find((s) => s.id === lesson?.subject_id);
      const teacher = teachers.find((t) => t.id === scheduled.teacher_id);
      const classRoom = classes.find((c) => c.id === scheduled.class_id);
      const room = rooms.find((r) => r.id === scheduled.room_id);

      const zoneTag = slot.slot_type !== 'FORMAL' ? ` [${slot.slot_type}]` : '';
      const subInfo =
        filterMode === 'CLASS'
          ? teacher?.full_name || ''
          : `Kelas ${classRoom?.class_name || ''}`;
      const roomInfo = room ? ` (${room.room_name})` : '';

      row.push(`${timeRange}${zoneTag}\n${subject?.subject_name || ''}\n${subInfo}${roomInfo}`);
    });

    return row;
  });

  return { head, body };
}

/**
 * 1. FITUR EKSPOR KE EXCEL (.xlsx)
 * Menghasilkan workbook Excel yang berisi tab untuk setiap Kelas dan Rekap Guru
 */
export function exportTimetableToExcel(params: ExportParams) {
  const workbook = XLSX.utils.book_new();
  const activeDays = params.workDays.filter((d) => d.is_active);

  // Buat Sheet untuk masing-masing Rombel Kelas
  params.classes.forEach((cls) => {
    const { head, body } = buildMatrixRows(params, 'CLASS', cls.id);
    const sheetData = [
      [`JADWAL PELAJARAN KELAS ${cls.class_name.toUpperCase()}`],
      [`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`],
      [],
      ...head,
      ...body,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Atur lebar kolom agar rapi saat dibuka di Microsoft Excel
    worksheet['!cols'] = [
      { wch: 14 }, // Kolom Periode
      ...activeDays.map(() => ({ wch: 28 })), // Kolom Hari Kerja
    ];

    const safeSheetName = `Kelas_${cls.class_name}`.replace(/[\\/?*[\]]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
  });

  // Buat Sheet Tambahan: Daftar Rekapitulasi Seluruh Jadwal (Flat Table untuk Pivot/Filter)
  const flatRows = params.schedules.map((sc) => {
    const slot = params.timeSlots.find((s) => s.id === sc.time_slot_id);
    const day = params.workDays.find((d) => d.day_index === slot?.day_index);
    const lesson = params.lessons.find((l) => l.id === sc.lesson_id);
    const subject = params.subjects.find((s) => s.id === lesson?.subject_id);
    const teacher = params.teachers.find((t) => t.id === sc.teacher_id);
    const cls = params.classes.find((c) => c.id === sc.class_id);
    const room = params.rooms.find((r) => r.id === sc.room_id);

    return {
      Hari: day?.day_name || '',
      'Periode Ke': slot?.period_number ?? '',
      'Jam Mulai': slot?.start_time?.slice(0, 5) || '',
      'Jam Selesai': slot?.end_time?.slice(0, 5) || '',
      'Zona Waktu': slot?.slot_type || '',
      Kelas: cls?.class_name || '',
      'Mata Pelajaran': subject?.subject_name || '',
      'Kode Guru': teacher?.teacher_code || '',
      'Nama Guru': teacher?.full_name || '',
      Ruangan: room?.room_name || '',
    };
  });

  if (flatRows.length > 0) {
    const rekapSheet = XLSX.utils.json_to_sheet(flatRows);
    XLSX.utils.book_append_sheet(workbook, rekapSheet, 'Rekap_Database');
  }

  XLSX.writeFile(workbook, `Master_Jadwal_Sekolah_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 2. FITUR CETAK PILIHAN SAAT INI KE PDF (1 Kelas / 1 Guru)
 */
export function exportSingleViewToPdf(
  params: ExportParams,
  filterMode: 'CLASS' | 'TEACHER',
  selectedId: string,
  title: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { head, body } = buildMatrixRows(params, filterMode, selectedId);

  doc.setFontSize(14);
  doc.text(`JADWAL PELAJARAN - ${title.toUpperCase()}`, 14, 14);
  doc.setFontSize(9);
  doc.text(`Dicetak otomatis pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 20);

  autoTable(doc, {
    startY: 24,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold', fillColor: [241, 245, 249] } },
  });

  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Jadwal_${safeName}.pdf`);
}

/**
 * 3. FITUR CETAK SELURUH KELAS SEKALIGUS DALAM SATU PDF (Master PDF Multi-Page)
 * Setiap kelas dicetak pada halaman baru secara otomatis
 */
export function exportAllClassesMasterPdf(params: ExportParams) {
  if (params.classes.length === 0) {
    alert('Data kelas masih kosong.');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const printDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  params.classes.forEach((cls, index) => {
    // Tambahkan halaman baru untuk kelas ke-2 dan seterusnya
    if (index > 0) {
      doc.addPage('a4', 'landscape');
    }

    const { head, body } = buildMatrixRows(params, 'CLASS', cls.id);

    // Header Kop di Setiap Halaman Kelas
    doc.setFontSize(14);
    doc.text(`JADWAL PELAJARAN - KELAS ${cls.class_name.toUpperCase()}`, 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Tingkat Kelas: ${cls.grade_level}  |  Halaman ${index + 1} dari ${
        params.classes.length
      }  |  Tanggal Cetak: ${printDate}`,
      14,
      20
    );

    autoTable(doc, {
      startY: 24,
      head,
      body,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle',
        halign: 'center',
      },
      headStyles: {
        fillColor: [30, 41, 59], // Warna Slate-800
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold', fillColor: [241, 245, 249] },
      },
    });
  });

  doc.save(`Master_Jadwal_Seluruh_Kelas_${new Date().toISOString().slice(0, 10)}.pdf`);
}
