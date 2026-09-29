import { useEffect } from 'react';

/**
 * Keep the screen awake while `active`. The browser drops the lock whenever the page is hidden (another tab, a
 * locked phone), so it is taken again each time the page comes back.
 */
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let live = true;
    let asking = false;
    let lock: WakeLockSentinel | null = null;
    const take = () => {
      if (asking || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      asking = true;
      navigator.wakeLock
        .request('screen')
        .then((l) => (live ? (lock = l) : void l.release()))
        .catch(() => {})
        .finally(() => (asking = false));
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', take);
      void lock?.release();
    };
  }, [active]);
}
