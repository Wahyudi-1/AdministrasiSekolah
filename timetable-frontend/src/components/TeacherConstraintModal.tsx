import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, WorkDay, UnavailableRule } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teachers: Teacher[];
  workDays: WorkDay[];
}

export const TeacherConstraintModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  teachers,
  workDays,
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [dayIndex, setDayIndex] = useState<number>(1);
  const [periodsInput, setPeriodsInput] = useState<string>('1,2');
  const [level, setLevel] = useState<'HARD' | 'SOFT'>('HARD');
  const [reason, setReason] = useState<string>('Tugas Luar / MGMP');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const currentTeacher = teachers.find((t) => t.id === (selectedTeacherId || teachers[0]?.id));

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeacher) return;

    setSaving(true);
    const parsedPeriods: number[] | 'ALL' =
      periodsInput.trim().toUpperCase() === 'ALL'
        ? 'ALL'
        : periodsInput
            .split(',')
            .map((p) => Number(p.trim()))
            .filter((n) => !isNaN(n));

    const newRule: UnavailableRule = {
      day_index: dayIndex,
      periods: parsedPeriods,
      level,
      reason,
    };

    const updatedRules = [...(currentTeacher.unavailable_slots || []), newRule];

    const { error } = await supabase
      .from('teachers')
      .update({ unavailable_slots: updatedRules })
      .eq('id', currentTeacher.id);

    setSaving(false);
    if (error) {
      alert(`Gagal menyimpan batasan guru: ${error.message}`);
    } else {
      onSuccess();
    }
  };

  const handleClearRules = async () => {
    if (!currentTeacher) return;
    await supabase.from('teachers').update({ unavailable_slots: [] }).eq('id', currentTeacher.id);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 text-sm">
        <h3 className="text-lg font-bold text-slate-800">
          Syarat Peletakan Jam & Ketersediaan Guru
        </h3>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Pilih Guru</label>
          <select
            value={currentTeacher?.id || ''}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="w-full border rounded-lg p-2"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.teacher_code})
              </option>
            ))}
          </select>
        </div>

        {/* Daftar Aturan Saat Ini */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Daftar Jam Berhalangan (JSON Rules)
            </span>
            {currentTeacher?.unavailable_slots?.length ? (
              <button
                type="button"
                onClick={handleClearRules}
                className="text-xs text-rose-600 hover:underline font-medium"
              >
                Reset Semua Aturan
              </button>
            ) : null}
          </div>

          {currentTeacher?.unavailable_slots?.length ? (
            <ul className="space-y-1 text-xs">
              {currentTeacher.unavailable_slots.map((r, i) => (
                <li key={i} className="p-1.5 bg-white rounded border flex justify-between">
                  <span>
                    <b>Hari ke-{r.day_index}</b> | Jam:{' '}
                    {Array.isArray(r.periods) ? r.periods.join(', ') : 'SEHARIAN (ALL)'} —{' '}
                    <i>{r.reason}</i>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                      r.level === 'HARD'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {r.level}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-slate-400 italic">
              Guru ini tersedia di semua hari dan jam kerja.
            </div>
          )}
        </div>

        {/* Form Tambah Aturan */}
        <form onSubmit={handleAddRule} className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Hari Berhalangan</label>
              <select
                value={dayIndex}
                onChange={(e) => setDayIndex(Number(e.target.value))}
                className="w-full border rounded-lg p-2"
              >
                {workDays.map((d) => (
                  <option key={d.id} value={d.day_index}>
                    {d.day_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Periode Jam (Ketik <b>ALL</b> atau <b>1,2</b>)
              </label>
              <input
                type="text"
                value={periodsInput}
                onChange={(e) => setPeriodsInput(e.target.value)}
                placeholder="Contoh: 0,1,2 atau ALL"
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tingkat Syarat</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as 'HARD' | 'SOFT')}
                className="w-full border rounded-lg p-2"
              >
                <option value="HARD">HARD (Wajib Diblokir Mutlak)</option>
                <option value="SOFT">SOFT (Usahakan Dihindari)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Keterangan Alasan</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Selesai
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              {saving ? 'Menyimpan...' : '+ Tambah Syarat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
