import React, { useState } from 'react';
import { X, ShieldCheck, Check, Users, User } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Teacher } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  schoolId: string;
  onDataUpdated: () => void;
}

export const TeacherPolicyModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  schoolId,
  onDataUpdated,
}) => {
  const [targetScope, setTargetScope] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    teachers[0]?.id || ''
  );

  const [maxConsecutive, setMaxConsecutive] = useState<number>(4);
  const [maxPerDay, setMaxPerDay] = useState<number>(8);
  const [maxIdleGap, setMaxIdleGap] = useState<number>(1);
  const [minWeekly, setMinWeekly] = useState<number>(24);
  const [disallowFullDay, setDisallowFullDay] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        max_consecutive_periods: Number(maxConsecutive),
        max_periods_per_day: Number(maxPerDay),
        max_idle_gap_per_day: Number(maxIdleGap),
        min_periods_per_week: Number(minWeekly),
        disallow_full_day: Boolean(disallowFullDay),
        updated_at: new Date().toISOString(),
      };

      if (targetScope === 'ALL') {
        const { error } = await supabase
          .from('teachers')
          .update(payload)
          .eq('school_id', schoolId);
        if (error) throw error;
        alert(`Berhasil menerapkan kebijakan untuk SELURUH guru (${teachers.length} guru)!`);
      } else {
        const { error } = await supabase
          .from('teachers')
          .update(payload)
          .eq('id', selectedTeacherId);
        if (error) throw error;
        alert('Berhasil memperbarui kebijakan guru terpilih!');
      }

      onDataUpdated();
      onClose();
    } catch (err: any) {
      alert(`Gagal menyimpan kebijakan guru: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTeacherSelect = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const tch = teachers.find((t) => t.id === teacherId);
    if (tch) {
      setMaxConsecutive(tch.max_consecutive_periods ?? 4);
      setMaxPerDay(tch.max_periods_per_day ?? 8);
      setMaxIdleGap(tch.max_idle_gap_per_day ?? 1);
      setMinWeekly(tch.min_periods_per_week ?? 24);
      setDisallowFullDay(tch.disallow_full_day ?? true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-300" />
            <div>
              <h2 className="text-sm font-bold">Kebijakan Beban Mengajar Guru</h2>
              <p className="text-[11px] text-indigo-200">
                Atur batasan jam berturut-turut, batas jam kosong harian, dan jam minimal
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-indigo-800 text-indigo-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApply} className="p-6 space-y-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Terapkan Kebijakan Untuk:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('ALL')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition ${
                  targetScope === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Seluruh Guru ({teachers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('SPECIFIC')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition ${
                  targetScope === 'SPECIFIC'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Guru Tertentu</span>
              </button>
            </div>
          </div>

          {targetScope === 'SPECIFIC' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pilih Guru:</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => handleTeacherSelect(e.target.value)}
                className="w-full p-2 border rounded-xl bg-white text-slate-800 font-semibold"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.teacher_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Maks. Jam Beruntun
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={maxConsecutive}
                  onChange={(e) => setMaxConsecutive(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-white font-bold text-indigo-900"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Maks. berturut-turut</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Maks. Jam / Hari
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-white font-bold text-indigo-900"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Maks. total harian</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Maks. Jam Kosong
                </label>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={maxIdleGap}
                  onChange={(e) => setMaxIdleGap(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-white font-bold text-rose-700"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Sela kosong harian</p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Target Jam Mengajar Minimal per Pekan
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={minWeekly}
                onChange={(e) => setMinWeekly(Number(e.target.value))}
                className="w-full p-2 border rounded-lg bg-white font-bold text-emerald-800"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Standar sertifikasi: 24 JP / pekan</p>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={disallowFullDay}
                  onChange={(e) => setDisallowFullDay(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">
                    Dilarang Mengajar Penuh (*Full Day*) Tanpa Jeda
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed block">
                    Guru tidak diperbolehkan mengajar dari jam pertama hingga jam terakhir dalam satu hari.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Terapkan Kebijakan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
