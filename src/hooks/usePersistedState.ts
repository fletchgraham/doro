import { useEffect, useRef } from "react";

const STORAGE_DEBOUNCE_MS = 500;

// Set once storage has been replaced wholesale (a backup restore) and the
// page is about to reload: the in-memory state is stale from then on and
// must not be written back over what was restored.
let writesSuspended = false;

export const suspendStorageWrites = () => {
  writesSuspended = true;
};

// Every mounted store's flush, for when storage must be current right now
// (e.g. reading it into a backup)
const flushers = new Set<() => void>();

export const flushStorageWrites = () => {
  for (const flush of flushers) flush();
};

/**
 * Keep `value` saved to localStorage under `key`. Writes are debounced so
 * rapid updates (typing notes) don't thrash storage, and any pending
 * write is flushed as soon as the page is hidden or closed, so a refresh
 * right after a change doesn't lose it.
 */
export default function usePersistedState(key: string, value: unknown) {
  // The write waiting on its debounce, if any
  const pendingRef = useRef<{ key: string; json: string } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only touches refs, so one stable function serves every caller
    const flush = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending === null || writesSuspended) return;
      localStorage.setItem(pending.key, pending.json);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    flushers.add(flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      flushers.delete(flush);
      // Unmounting: save whatever is still waiting
      flush();
    };
  }, []);

  useEffect(() => {
    pendingRef.current = { key, json: JSON.stringify(value) };
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(flushStorageWrites, STORAGE_DEBOUNCE_MS);
  }, [key, value]);
}
