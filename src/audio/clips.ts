/** Player-uploaded sound clips live in IndexedDB — they never leave this browser. */

const DB = 'pb-clips';
const STORE = 'clips';
export const MAX_CLIP_BYTES = 8 * 1024 * 1024;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveClip(file: File): Promise<{ id: string; name: string }> {
  if (!file.type.startsWith('audio/')) throw new Error('That is not an audio file.');
  if (file.size > MAX_CLIP_BYTES) throw new Error('Keep clips under 8 MB — trim it to the good part.');
  const id = crypto.randomUUID();
  await tx('readwrite', (s) => s.put(file, id));
  return { id, name: file.name.replace(/\.[^.]+$/, '') };
}

export const loadClip = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
