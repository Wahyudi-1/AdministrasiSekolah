import { setIDBValue, getIDBValue } from './idb';

export interface SyncQueueItem {
  id: string;
  school_id: string;
  table: string;
  operation: 'insert' | 'upsert' | 'update' | 'delete';
  payload?: any;
  matchColumn?: string;
  matchValue?: any;
  timestamp: number;
  updated_at: string; // ISO String saat offline
  expected_version?: number; // OCC Versioning
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

// Simpan antrean ke LocalStorage dan IndexedDB (agar terbaca oleh Service Worker)
export const saveSyncQueue = (schoolId: string, queue: SyncQueueItem[]) => {
  try {
    localStorage.setItem(`${QUEUE_KEY_PREFIX}${schoolId}`, JSON.stringify(queue));
    // Simpan ke IndexedDB untuk dibaca Service Worker saat Native Background Sync
    setIDBValue('sync_queue', 'items', queue).catch((err) =>
      console.warn('Gagal sync ke IDB:', err)
    );
  } catch (e) {
    console.error('Gagal menyimpan antrean:', e);
  }
};

// Tambahkan aksi ke antrean dengan timestamp & versioning
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

  // Daftarkan Native SyncManager jika didukung oleh peramban
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg: any) => reg.sync.register('sync-timetable-mutations'))
      .catch((err) => console.warn('Background sync registration failed:', err));
  }

  return fullItem;
};

// Sinkronisasi manual dari UI React (Client-side fallback)
export const processSyncQueue = async (
  supabase: any,
  schoolId: string
): Promise<{ success: boolean; processedCount: number; conflictCount: number }> => {
  const queue = getSyncQueue(schoolId);
  if (queue.length === 0) return { success: true, processedCount: 0, conflictCount: 0 };

  try {
    const { data, error } = await supabase.rpc('process_offline_sync', {
      mutations: queue,
    });

    if (error) throw error;

    // Kosongkan antrean setelah dieksekusi oleh RPC
    saveSyncQueue(schoolId, []);
    return {
      success: true,
      processedCount: data?.processed || 0,
      conflictCount: data?.conflicts || 0,
    };
  } catch (err: any) {
    console.error('Gagal memproses sync queue RPC:', err);
    throw err;
  }
};
