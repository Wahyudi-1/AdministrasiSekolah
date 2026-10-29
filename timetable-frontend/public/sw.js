const CACHE_NAME = 'smart-timetable-v2';
const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.json'];

// Ganti sesuai URL Project & Anon Key Supabase Anda
const SUPABASE_URL = 'https://rvwgyovtqflguxgxdswb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Ganti dengan anon key Anda

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// ==================== NATIVE BACKGROUND SYNC ====================

function getIDBValue(dbName, storeName, key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        return resolve(null);
      }
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    };
  });
}

function clearIDBStore(dbName, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) return resolve(true);
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve(true);
    };
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-timetable-mutations') {
    event.waitUntil(processBackgroundSync());
  }
});

async function processBackgroundSync() {
  try {
    const token = await getIDBValue('SmartTimetableDB', 'auth', 'supabase_jwt');
    const queue = (await getIDBValue('SmartTimetableDB', 'sync_queue', 'items')) || [];

    if (!token || queue.length === 0) return;

    // Tembak PostgREST RPC langsung tanpa supabase-js
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/process_offline_sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ mutations: queue }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`RPC Gagal (${response.status}): ${errText}`);
    }

    const result = await response.json();
    console.log('[SW] Background Sync Selesai:', result);

    // Kosongkan antrean setelah berhasil
    await clearIDBStore('SmartTimetableDB', 'sync_queue');

    // Beritahu jendela/tab aplikasi yang sedang aktif
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SW_SYNC_SUCCESS',
        processed: result.processed,
        conflicts: result.conflicts,
      });
    });
  } catch (error) {
    console.error('[SW] Background sync gagal, akan dijadwalkan ulang oleh OS:', error);
    // Melempar error agar browser melakukan retry otomatis
    throw error;
  }
}
