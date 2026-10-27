import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { WorkDay, SlotType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workDays: WorkDay[];
}

export const TimeConfigModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, workDays }) => {
  const [dayIndex, setDayIndex] = useState<number>(1);
  const [periodNumber, setPeriodNumber] = useState<number>(0);
  const [slotName, setSlotName] = useState<string>('Literasi Pagi');
  const [startTime, setStartTime] = useState<string>('06:30');
  const [endTime, setEndTime] = useState<string>('07:00');
  const [slotType, setSlotType] = useState<SlotType>('PRE');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleDayActive = async (day: WorkDay) => {
    await supabase
      .from('work_days')
      .update({ is_active: !day.is_active })
      .eq('id', day.id);
    onSuccess();
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('time_slots').upsert(
      {
        day_index: dayIndex,
        period_number: periodNumber,
        slot_name: slotName,
        start_time: startTime,
        end_time: endTime,
        slot_type: slotType,
      },
      { onConflict: 'day_index,period_number' }
    );
    setSaving(false);

    if (error) {
      alert(`Gagal menyimpan slot waktu: ${error.message}`);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5">
        <h3 className="text-lg font-bold text-slate-800">
          Konfigurasi Hari Kerja & Slot Jam (Pre / Formal / Post)
        </h3>

        {/* Pengaturan Hari Aktif */}
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
            Hari Kerja Aktif
          </label>
          <div className="flex flex-wrap gap-2">
            {workDays.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDayActive(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  d.is_active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {d.day_name} {d.is_active ? '✓' : '✕'}
              </button>
            ))}
          </div>
        </div>

        {/* Form Tambah / Update Jam Pelajaran pada Hari Tertentu */}
        <form onSubmit={handleAddSlot} className="space-y-3 text-sm border-t pt-4">
          <div className="font-semibold text-slate-700">Tambah / Ubah Slot Jam Hari Tertentu</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Pilih Hari</label>
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
                Urutan Periode (0 = Sebelum Jam Ke-1)
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Nama Slot</label>
              <input
                type="text"
                value={slotName}
                onChange={(e) => setSlotName(e.target.value)}
                placeholder="Contoh: Jam Ke-1 / Ekskul"
                className="w-full border rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Kategori Zona Jam</label>
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value as SlotType)}
                className="w-full border rounded-lg p-2"
              >
                <option value="PRE">PRE (Sebelum Jam Formal)</option>
                <option value="FORMAL">FORMAL (Jam Pelajaran Inti)</option>
                <option value="POST">POST (Setelah Jam Formal)</option>
                <option value="BREAK">BREAK (Jam Istirahat)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Jam Mulai</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Jam Selesai</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
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
              Tutup
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              {saving ? 'Menyimpan...' : 'Simpan Slot Waktu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
