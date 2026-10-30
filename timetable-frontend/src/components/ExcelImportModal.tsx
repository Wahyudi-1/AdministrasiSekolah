import React, { useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDataImported: () => void;
  schoolId: string;
}

export const ExcelImportModal: React.FC<Props> = ({ isOpen, onClose, onDataImported, schoolId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<{
    teachersCount: number;
    subjectsCount: number;
    classesCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Guru
    const wsGuru = XLSX.utils.aoa_to_sheet([
      ['Kode Guru*', 'Nama Lengkap & Gelar*', 'Maks JP Per Hari'],
      ['G01', 'Drs. H. Ahmad Fauzi, M.Pd.', 6],
      ['G02', 'Siti Rahmawati, S.Pd.', 6],
      ['G03', 'Budi Santoso, M.Si.', 8],
    ]);
    XLSX.utils.book_append_sheet(wb, wsGuru, 'GURU');

    // Sheet 2: Mata Pelajaran
    const wsMapel = XLSX.utils.aoa_to_sheet([
      ['Kode Mapel*', 'Nama Mata Pelajaran*'],
      ['MAT', 'Matematika'],
      ['BIN', 'Bahasa Indonesia'],
      ['BIG', 'Bahasa Inggris'],
      ['FIS', 'Fisika'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsMapel, 'MAPEL');

    // Sheet 3: Kelas
    const wsKelas = XLSX.utils.aoa_to_sheet([
      ['Nama Kelas*', 'Tingkat (7-12)*'],
      ['X-A', 10],
      ['X-B', 10],
      ['XI-IPA-1', 11],
      ['XII-IPA-1', 12],
    ]);
    XLSX.utils.book_append_sheet(wb, wsKelas, 'KELAS');

    XLSX.writeFile(wb, 'Template_Master_Data_Sekolah.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage('');
      setImportSummary(null);
    }
  };

  const handleProcessImport = async () => {
    if (!file) {
      setErrorMessage('Pilih file Excel terlebih dahulu.');
      return;
    }

    if (!schoolId) {
      setErrorMessage('ID Sekolah tidak ditemukan. Silakan muat ulang halaman.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setImportSummary(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'buffer' });

      let importedTeachers = 0;
      let importedSubjects = 0;
      let importedClasses = 0;

      // A. Import GURU
      const sheetGuruName = wb.SheetNames.find((s) => s.toUpperCase().includes('GURU'));
      if (sheetGuruName) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetGuruName]);
        const teacherRecords = rows
          .map((r) => ({
            school_id: schoolId,
            teacher_code: String(r['Kode Guru*'] || r['Kode Guru'] || r['KODE'] || '').trim().toUpperCase(),
            full_name: String(r['Nama Lengkap & Gelar*'] || r['Nama Guru'] || r['NAMA'] || '').trim(),
            max_periods_per_day: Number(r['Maks JP Per Hari'] || 6),
            unavailable_slots: [],
          }))
          .filter((t) => t.teacher_code && t.full_name);

        // Deduplikasi unik per teacher_code dalam file yang sama
        const uniqueTeachers = Array.from(
          new Map(teacherRecords.map((t) => [t.teacher_code, t])).values()
        );

        if (uniqueTeachers.length > 0) {
          const { error } = await supabase.from('teachers').upsert(uniqueTeachers, {
            onConflict: 'school_id,teacher_code',
          });
          if (error) throw error;
          importedTeachers = uniqueTeachers.length;
        }
      }

      // B. Import MATA PELAJARAN
      const sheetMapelName = wb.SheetNames.find(
        (s) => s.toUpperCase().includes('MAPEL') || s.toUpperCase().includes('SUBJECT')
      );
      if (sheetMapelName) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetMapelName]);
        const subjectRecords = rows
          .map((r) => ({
            school_id: schoolId,
            subject_code: String(r['Kode Mapel*'] || r['Kode Mapel'] || r['KODE'] || '').trim().toUpperCase(),
            subject_name: String(r['Nama Mata Pelajaran*'] || r['Nama Mapel'] || r['MAPEL'] || '').trim(),
          }))
          .filter((s) => s.subject_code && s.subject_name);

        // Deduplikasi unik per subject_code dalam file yang sama
        const uniqueSubjects = Array.from(
          new Map(subjectRecords.map((s) => [s.subject_code, s])).values()
        );

        if (uniqueSubjects.length > 0) {
          const { error } = await supabase.from('subjects').upsert(uniqueSubjects, {
            onConflict: 'school_id,subject_code',
          });
          if (error) throw error;
          importedSubjects = uniqueSubjects.length;
        }
      }

      // C. Import KELAS
      const sheetKelasName = wb.SheetNames.find(
        (s) => s.toUpperCase().includes('KELAS') || s.toUpperCase().includes('CLASS')
      );
      if (sheetKelasName) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetKelasName]);
        const classRecords = rows
          .map((r) => ({
            school_id: schoolId,
            class_name: String(r['Nama Kelas*'] || r['Kelas'] || r['ROMBEL'] || '').trim(),
            grade_level: Number(r['Tingkat (7-12)*'] || r['Tingkat'] || 10),
          }))
          .filter((c) => c.class_name);

        // Deduplikasi unik per class_name dalam file yang sama
        const uniqueClasses = Array.from(
          new Map(classRecords.map((c) => [c.class_name, c])).values()
        );

        if (uniqueClasses.length > 0) {
          const { error } = await supabase.from('classes').upsert(uniqueClasses, {
            onConflict: 'school_id,class_name',
          });
          if (error) throw error;
          importedClasses = uniqueClasses.length;
        }
      }

      setImportSummary({
        teachersCount: importedTeachers,
        subjectsCount: importedSubjects,
        classesCount: importedClasses,
      });

      onDataImported();
    } catch (err: any) {
      setErrorMessage(`Gagal memproses file Excel: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header Modal */}
        <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <h2 className="text-base font-bold">Import Data Master dari Excel</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-emerald-700 text-emerald-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badan Modal */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-emerald-900">Belum punya format Excel yang sesuai?</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Unduh template resmi 3 sheet (GURU, MAPEL, KELAS) berikut:
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm shrink-0 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Template</span>
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center transition bg-slate-50/50">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <label className="block font-semibold text-slate-700 mb-1 cursor-pointer">
              <span className="text-emerald-700 underline">Pilih Berkas Excel</span> dari komputer
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-slate-400">Mendukung format .xlsx dan .xls</p>
            {file && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{file.name}</span>
              </div>
            )}
          </div>

          {importSummary && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Import Data Berhasil!</p>
                <ul className="list-disc list-inside mt-1 text-[11px] space-y-0.5 text-emerald-800">
                  <li>{importSummary.teachersCount} data guru diperbarui</li>
                  <li>{importSummary.subjectsCount} mata pelajaran diperbarui</li>
                  <li>{importSummary.classesCount} kelas rombel diperbarui</li>
                </ul>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-semibold"
          >
            Tutup
          </button>
          <button
            onClick={handleProcessImport}
            disabled={!file || isLoading}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-white font-bold transition ${
              !file || isLoading
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Unggah & Simpan Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
