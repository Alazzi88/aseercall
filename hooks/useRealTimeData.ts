import { useEffect, useRef, useState } from 'react';
import { syncService } from '../services/sync';

/**
 * Hook that fetches data and keeps it fresh via:
 * 1. BroadcastChannel (instant cross-tab updates)
 * 2. storage events (same-tab compat)
 * 3. setInterval polling (fallback for throttled background tabs)
 */
export function useRealTimeData<T>(
  fetchFn: () => T,
  deps: React.DependencyList = [],
  intervalMs = 5000
): T {
  const [data, setData] = useState<T>(() => fetchFn());
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    const refresh = () => setData(fetchRef.current());
    refresh();

    const unsubscribe = syncService.subscribe(refresh);
    const interval = setInterval(refresh, intervalMs);
    window.addEventListener('storage', refresh);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('storage', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
