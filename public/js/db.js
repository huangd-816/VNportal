// ============================================
// VNportal — IndexedDB (local audio/video)
// localStorage can't handle binary files,
// so we use IndexedDB for audio blobs.
// ============================================

const DB = (() => {
  const DB_NAME    = 'vnportal_files';
  const DB_VERSION = 1;
  const STORE_NAME = 'tracks';
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  // Save a file blob under a unique key (e.g. "vinyl_id:track_index")
  async function saveFile(key, file) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx   = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Store as blob with metadata
      const record = {
        id:       key,
        blob:     file,
        name:     file.name,
        type:     file.type,
        size:     file.size,
        savedAt:  Date.now()
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(key);
      req.onerror   = e => reject(e.target.error);
    });
  }

  // Get a blob URL ready to play
  async function getFileURL(key) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx    = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(key);
      req.onsuccess = e => {
        if (!e.target.result) { resolve(null); return; }
        const url = URL.createObjectURL(e.target.result.blob);
        resolve(url);
      };
      req.onerror = e => reject(e.target.error);
    });
  }

  // Get raw record (with metadata)
  async function getFile(key) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx    = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(key);
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function deleteFile(key) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx    = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function hasFile(key) {
    const rec = await getFile(key);
    return rec !== null;
  }

  // Generate a stable key for a track
  function trackKey(vinylId, trackIndex) {
    return `${vinylId}:${trackIndex}`;
  }

  return { saveFile, getFileURL, getFile, deleteFile, hasFile, trackKey };
})();
