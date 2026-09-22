/**
 * Player-uploaded sound clips. Each one is kept in this browser (IndexedDB) so it
 * plays instantly and offline, and copied to the site's database so it follows
 * the player to any laptop.
 */

const DB = 'pb-clips';
const STORE = 'clips';
export const MAX_CLIP_BYTES = 4 * 1024 * 1024;
const PENDING = 'pb.clips.pending.v1';

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
  if (file.size > MAX_CLIP_BYTES) throw new Error('Keep clips under 4 MB. Trim it to the good part.');
  const id = crypto.randomUUID();
  await tx('readwrite', (s) => s.put(file, id));
  const name = file.name.replace(/\.[^.]+$/, '');
  setPending([...pending(), { id, name }]);
  void uploadPending();
  return { id, name };
}

const pending = (): { id: string; name: string }[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING) ?? '[]');
  } catch {
    return [];
  }
};
const setPending = (list: { id: string; name: string }[]) => localStorage.setItem(PENDING, JSON.stringify(list));

let uploading = false;

/** Copy any clips the database hasn't got yet. Safe to call often; it gives up quietly when offline. */
export async function uploadPending() {
  if (uploading) return;
  uploading = true;
  try {
    for (const item of pending()) {
      const blob = await tx<Blob | undefined>('readonly', (s) => s.get(item.id));
      if (blob) {
        const res = await fetch(`/api/clips?id=${item.id}&name=${encodeURIComponent(item.name)}`, {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'audio/mpeg' },
          body: blob,
        });
        const accepted = res.ok && (res.headers.get('content-type') ?? '').includes('json');
        // A 4xx (other than "no such endpoint") means it will never be accepted, so stop retrying it.
        const refused = res.status >= 400 && res.status < 500 && res.status !== 404;
        if (!accepted && !refused) break; // offline, no database here, or a server hiccup: try again later
      }
      setPending(pending().filter((p) => p.id !== item.id));
    }
  } catch {
    // offline
  } finally {
    uploading = false;
  }
}

/** Straight to the site, for a phone whose laptop it can't reach directly. Returns the clip's id. */
export async function uploadClipFile(file: File): Promise<string> {
  if (!file.type.startsWith('audio/')) throw new Error('That is not an audio file.');
  if (file.size > MAX_CLIP_BYTES) throw new Error('Keep clips under 4 MB. Trim it to the good part.');
  const id = crypto.randomUUID();
  const name = file.name.replace(/\.[^.]+$/, '');
  const res = await fetch(`/api/clips?id=${id}&name=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file }).catch(() => null);
  if (!res?.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error('The clip could not be uploaded. Try again when you have signal.');
  return id;
}

/** This browser's copy if it has one; otherwise fetch it from the database and keep it. */
export async function loadClip(id: string): Promise<Blob | undefined> {
  const local = await tx<Blob | undefined>('readonly', (s) => s.get(id));
  if (local) return local;
  try {
    const res = await fetch(`/api/clips?id=${id}`);
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('audio/')) return undefined;
    const blob = await res.blob();
    await tx('readwrite', (s) => s.put(blob, id));
    return blob;
  } catch {
    return undefined;
  }
}
