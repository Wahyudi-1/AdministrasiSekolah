import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, ClassRoom, Subject, Room, SlotType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teachers: Teacher[];
  classes: ClassRoom[];
  subjects: Subject[];
  rooms: Room[];
}

export const MasterDataModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  teachers,
  classes,
  subjects,
  rooms,
}) => {
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [totalPeriods, setTotalPeriods] = useState(4);
  const [splitPattern, setSplitPattern] = useState('2+2');
  const [slotType, setSlotType] = useState<SlotType>('FORMAL');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from('lessons').insert({
      teacher_id: teacherId || teachers[0]?.id,
      subject_id: subjectId || subjects[0]?.id,
      class_id: classId || classes[0]?.id,
      preferred_room_id: roomId || rooms[0]?.id,
      total_periods_per_week: totalPeriods,
      split_pattern: splitPattern,
      allowed_slot_types: slotType,
    });

    setSaving(false);
    if (error) {
      alert(`Gagal menyimpan: ${error.message}`);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">
          Tambah Kartu Pembelajaran (Lesson)
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Guru Pengampu</label>
            <select
              value={teacherId || teachers[0]?.id || ''}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.teacher_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Mata Pelajaran</label>
            <select
              value={subjectId || subjects[0]?.id || ''}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_name} ({s.subject_code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Rombel Kelas</label>
              <select
                value={classId || classes[0]?.id || ''}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full border rounded-lg p-2"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Ruang Belajar</label>
              <select
                value={roomId || rooms[0]?.id || ''}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full border rounded-lg p-2"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Total JP / Minggu</label>
              <input
                type="number"
                min={1}
                max={12}
                value={totalPeriods}
                onChange={(e) => setTotalPeriods(Number(e.target.value))}
                className="w-full border rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Pola Blok (Split Pattern)
              </label>
              <input
                type="text"
                placeholder="Contoh: 2+2 atau 3"
                value={splitPattern}
                onChange={(e) => setSplitPattern(e.target.value)}
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Zona Waktu Penempatan</label>
            <select
              value={slotType}
              onChange={(e) => setSlotType(e.target.value as SlotType)}
              className="w-full border rounded-lg p-2"
            >
              <option value="FORMAL">Jam Formal Inti (FORMAL)</option>
              <option value="PRE">Jam Sebelum Formal / Pagi (PRE)</option>
              <option value="POST">Jam Setelah Formal / Sore (POST)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              {saving ? 'Menyimpan...' : 'Simpan Kartu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
