import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, RefreshCw, Layers, Clock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ConflictItem {
  id: string;
  table_name: string;
  record_id: string;
  offline_payload: any;
  cloud_payload: any;
  conflict_reason: string;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  onResolved: () => void;
}

export const ConflictResolverModal: React.FC<Props> = ({
  isOpen,
  onClose,
  schoolId,
  onResolved,
}) => {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sync_conflicts')
        .select('*')
        .eq('school_id', schoolId)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConflicts(data || []);
    } catch (e) {
      console.error('Gagal mengambil daftar konflik:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && schoolId) fetchConflicts();
  }, [isOpen, schoolId]);

  if (!isOpen) return null;

  // Opsi 1: Pertahankan Versi Offline (Paksa Update Cloud)
  const handleKeepOffline = async (item: ConflictItem) => {
    try {
      if (item.table_name === 'lessons') {
        await supabase
          .from('lessons')
          .update({
            split_pattern: item.offline_payload.split_pattern,
            allowed_slot_types: item.offline_payload.allowed_slot_types,
            preferred_room_id: item.offline_payload.preferred_room_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.record_id);
      }

      await supabase
        .from('sync_conflicts')
        .update({ resolved: true })
        .eq('id', item.id);

      fetchConflicts();
      onResolved();
    } catch (err: any) {
      alert(`Gagal menerapkan data offline: ${err.message}`);
    }
  };

  // Opsi 2: Abaikan Data Offline (Pakai Versi Cloud)
  const handleKeepCloud = async (conflictId: string) => {
    try {
      await supabase
        .from('sync_conflicts')
        .update({ resolved: true })
        .eq('id', conflictId);

      fetchConflicts();
      onResolved();
    } catch (err: any) {
      alert(`Gagal menandai selesai: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] text-xs">
        {/* Header */}
        <div className="p-4 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base font-bold">Review Tabrakan Data Offline (Conflict Resolver)</h2>
              <p className="text-[11px] text-amber-100">
                Pilih versi data yang ingin digunakan untuk menyelesaikan perbedaan data lokal vs server
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-amber-700 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daftar Konflik */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              <span>Memuat data konflik...</span>
            </div>
          ) : conflicts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed text-slate-500">
              <Check className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
              <p className="font-bold text-slate-700">Semua Data Sinkron Sempurna</p>
              <p className="text-[11px]">Tidak ada tabrakan data yang membutuhkan konfirmasi.</p>
            </div>
          ) : (
            conflicts.map((item) => (
              <div key={item.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <span className="font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" /> Tabel: {item.table_name} (ID: {item.record_id.slice(0, 8)}...)
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(item.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Versi Offline */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <span className="font-bold text-amber-700 block mb-1">Versi Anda (Pengeditan Offline):</span>
                    <pre className="text-[10px] bg-slate-50 p-2 rounded overflow-x-auto text-slate-700 font-mono">
                      {JSON.stringify(item.offline_payload, null, 2)}
                    </pre>
                    <button
                      onClick={() => handleKeepOffline(item)}
                      className="mt-2.5 w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md shadow-sm transition"
                    >
                      Paksa Pakai Data Offline Saya
                    </button>
                  </div>

                  {/* Versi Cloud */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <span className="font-bold text-indigo-700 block mb-1">Versi Terkini di Database Cloud:</span>
                    <pre className="text-[10px] bg-slate-50 p-2 rounded overflow-x-auto text-slate-700 font-mono">
                      {JSON.stringify(item.cloud_payload, null, 2)}
                    </pre>
                    <button
                      onClick={() => handleKeepCloud(item.id)}
                      className="mt-2.5 w-full py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-md shadow-sm transition"
                    >
                      Abaikan & Gunakan Versi Cloud
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
