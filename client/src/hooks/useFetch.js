// Loads data from the API and keeps  { data, loading, error }  for the page.
//   const { data, loading, error, reload } = useFetch(() => http.get('/dashboard/student'), []);
// The second argument lists what should trigger a reload (like useEffect).
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0); // ignores answers of older requests that arrive late

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const body = await fetcher();
      if (id === latest.current) setState({ data: body.data, loading: false, error: null });
    } catch (err) {
      if (id === latest.current) setState({ data: null, loading: false, error: err.message });
    }
  }, deps);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { latest.current += 1; }, []); // page closed: ignore the pending answer

  return { ...state, reload: load };
}
