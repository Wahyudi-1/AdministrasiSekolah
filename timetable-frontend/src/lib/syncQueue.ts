import { SupabaseClient } from '@supabase/supabase-js';

export interface SyncQueueItem {
  id: string;
  school_id: string;
  table: string;
  operation: 'insert' | 'upsert' | 'update' | 'delete';
  payload?: any;
  matchColumn?: string;
  matchValue?: any;
  timestamp: number;
  description: string;
}

const QUEUE_KEY_PREFIX = 'smart_timetable_sync_queue_';

// Ambil seluruh antrean perubahan untuk sekolah yang sedang aktif
export const getSyncQueue = (schoolId: string): SyncQueueItem[] => {
  try {
    const raw = localStorage.getItem(`${QUEUE_KEY_PREFIX}${schoolId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Gagal membaca antrean sinkronisasi:', e);
    return [];
  }
};

// Simpan antrean ke memori lokal
export const saveSyncQueue = (schoolId: string, queue: SyncQueueItem[]) => {
  try {
    localStorage.setItem(`${QUEUE_KEY_PREFIX}${schoolId}`, JSON.stringify(queue));
  } catch (e) {
    console.error('Gagal menyimpan antrean sinkronisasi:', e);
  }
};

// Masukkan aksi mutasi baru ke antrean
export const enqueueSyncAction = (
  item: Omit<SyncQueueItem, 'id' | 'timestamp'>
): SyncQueueItem => {
  const fullItem: SyncQueueItem = {
    ...item,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
  };
  const queue = getSyncQueue(item.school_id);
  queue.push(fullItem);
  saveSyncQueue(item.school_id, queue);
  return fullItem;
};

// Jalankan dan kirim semua antrean ke Supabase
export const processSyncQueue = async (
  supabase: SupabaseClient,
  schoolId: string
): Promise<{ success: boolean; processedCount: number; errors: any[] }> => {
  const queue = getSyncQueue(schoolId);
  if (queue.length === 0) return { success: true, processedCount: 0, errors: [] };

  const errors: any[] = [];
  const remainingQueue: SyncQueueItem[] = [];
  let processedCount = 0;

  for (const item of queue) {
    try {
      const query: any = supabase.from(item.table);
      if (item.operation === 'insert') {
        const { error } = await query.insert(item.payload);
        if (error) throw error;
      } else if (item.operation === 'upsert') {
        const { error } = await query.upsert(item.payload, {
          onConflict: item.matchColumn || undefined,
        });
        if (error) throw error;
      } else if (item.operation === 'update') {
        const { error } = await query
          .update(item.payload)
          .eq(item.matchColumn || 'id', item.matchValue);
        if (error) throw error;
      } else if (item.operation === 'delete') {
        const { error } = await query
          .delete()
          .eq(item.matchColumn || 'id', item.matchValue);
        if (error) throw error;
      }
      processedCount++;
    } catch (err: any) {
      console.error(`Gagal sinkronisasi aksi [${item.description}]:`, err);
      errors.push({ item, error: err.message || err });
      // Simpan kembali item yang gagal agar tidak hilang
      remainingQueue.push(item);
    }
  }

  saveSyncQueue(schoolId, remainingQueue);
  return {
    success: errors.length === 0,
    processedCount,
    errors,
  };
};
