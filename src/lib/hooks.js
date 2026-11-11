import { useCallback, useEffect, useRef, useState } from 'react';

/** Memuat data async: { data, loading, error, reload, refresh }
 *  reload  = muat ulang dengan layar "Memuat data..."
 *  refresh = muat ulang diam-diam (tanpa berkedip), mengembalikan Promise */
export function useData(fn, deps = []) {
  const [state, set] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const load = useCallback(() => {
    let alive = true;
    set((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && set({ data, loading: false, error: null }))
        .catch((error) => alive && set({ data: null, loading: false, error }));
    return () => { alive = false; };
  }, deps); // eslint-disable-line
  const refresh = useCallback(async () => {
    try { set({ data: await fnRef.current(), loading: false, error: null }); }
    catch (error) { set({ data: null, loading: false, error }); }
  }, []);
  useEffect(() => load(), [load]);
  return { ...state, reload: load, refresh };
}
