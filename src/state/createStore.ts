import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: () => void): () => void;
}

/** A tiny observable value, optionally mirrored to localStorage. */
export function createStore<T>(initial: T, persistKey?: string, revive?: (raw: unknown) => T): Store<T> {
  let value = initial;
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) value = revive ? revive(JSON.parse(raw)) : { ...initial, ...JSON.parse(raw) };
    } catch {
      // Private mode or corrupt data — fall back to defaults.
    }
  }
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      if (persistKey) {
        try {
          localStorage.setItem(persistKey, JSON.stringify(value));
        } catch {
          // Storage full or unavailable; the in-memory value still works.
        }
      }
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
