import { setIDBValue } from './idb';

export interface SyncQueueItem {
  id: string;
  school_id: string;
  table: string;
  operation: 'insert' | 'upsert' | 'update' | 'delete';
  payload?: any;
  matchColumn?: string;
  matchValue?: any;
  timestamp: number;
  updated_at: string;
  expected_version?: number;
  description: string;
}

const QUEUE_KEY_PREFIX = 'smart_timetable_sync_queue_';

// Ambil antrean sinkronisasi
export const getSyncQueue = (schoolId: string): SyncQueueItem[] => {
  try {
    const raw = localStorage.getItem(`${QUEUE_KEY_PREFIX}${schoolId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Gagal membaca antrean lokal:', e);
    return [];
  }
};

// Simpan antrean ke LocalStorage dan IndexedDB
export const saveSyncQueue = (schoolId: string, queue: SyncQueueItem[]) => {
  try {
    localStorage.setItem(`${QUEUE_KEY_PREFIX}${schoolId}`, JSON.stringify(queue));
    setIDBValue('sync_queue', 'items', queue).catch((err) =>
      console.warn('Gagal sync ke IDB:', err)
    );
  } catch (e) {
    console.error('Gagal menyimpan antrean:', e);
  }
};

// Tambahkan aksi ke antrean dengan isolasi school_id
export const enqueueSyncAction = (
  item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'updated_at'> & {
    expected_version?: number;
  }
): SyncQueueItem => {
  const fullItem: SyncQueueItem = {
    ...item,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    updated_at: new Date().toISOString(),
    expected_version: item.expected_version ?? 1,
  };

  const queue = getSyncQueue(item.school_id);
  queue.push(fullItem);
  saveSyncQueue(item.school_id, queue);

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg: any) => reg.sync.register('sync-timetable-mutations'))
      .catch((err) => console.warn('Background sync registration failed:', err));
  }

  return fullItem;
};

// Sinkronisasi dengan isolasi ketat school_id
export const processSyncQueue = async (
  supabase: any,
  schoolId: string
): Promise<{ success: boolean; processedCount: number; conflictCount: number }> => {
  const queue = getSyncQueue(schoolId);
  if (queue.length === 0) return { success: true, processedCount: 0, conflictCount: 0 };

  try {
    // 1. Coba eksekusi melalui RPC jika fungsi PostgreSQL tersedia
    const { data, error } = await supabase.rpc('process_offline_sync', {
      mutations: queue,
    });

    if (!error) {
      saveSyncQueue(schoolId, []);
      return {
        success: true,
        processedCount: data?.processed || queue.length,
        conflictCount: data?.conflicts || 0,
      };
    }
  } catch (rpcErr) {
    console.warn('RPC process_offline_sync gagal atau belum tersedia, beralih ke direct fallback:', rpcErr);
  }

  // 2. Direct Fallback: Eksekusi antrean langsung ke tabel dengan isolasi school_id yang ketat
  let processed = 0;
  let conflicts = 0;
  const remainingQueue: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.operation === 'insert') {
        const payloadWithTenant = Array.isArray(item.payload)
          ? item.payload.map((p) => ({ ...p, school_id: schoolId }))
          : { ...item.payload, school_id: schoolId };

        const { error } = await supabase.table(item.table).insert(payloadWithTenant);
        if (error) throw error;
        processed++;
      } else if (item.operation === 'upsert') {
        const payloadWithTenant = Array.isArray(item.payload)
          ? item.payload.map((p) => ({ ...p, school_id: schoolId }))
          : { ...item.payload, school_id: schoolId };

        const onConflictVal =
          item.matchColumn ||
          (item.table === 'teachers'
            ? 'school_id,teacher_code'
            : item.table === 'subjects'
            ? 'school_id,subject_code'
            : item.table === 'classes'
            ? 'school_id,class_name'
            : 'school_id,id');

        const { error } = await supabase
          .table(item.table)
          .upsert(payloadWithTenant, { onConflict: onConflictVal });
        if (error) throw error;
        processed++;
      } else if (item.operation === 'update') {
        const matchCol = item.matchColumn || 'id';
        const { error } = await supabase
          .table(item.table)
          .update(item.payload)
          .eq('school_id', schoolId)
          .eq(matchCol, item.matchValue);
        if (error) throw error;
        processed++;
      } else if (item.operation === 'delete') {
        const matchCol = item.matchColumn || 'id';
        const { error } = await supabase
          .table(item.table)
          .delete()
          .eq('school_id', schoolId)
          .eq(matchCol, item.matchValue);
        if (error) throw error;
        processed++;
      }
    } catch (err: any) {
      console.error(`Gagal memproses mutasi ${item.description}:`, err);
      conflicts++;
      remainingQueue.push(item);
    }
  }

  saveSyncQueue(schoolId, remainingQueue);
  return {
    success: conflicts === 0,
    processedCount: processed,
    conflictCount: conflicts,
  };
};
