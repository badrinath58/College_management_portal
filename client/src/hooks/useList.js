// Everything a table page needs: server-side pagination + search + filters.
//   const list = useList('/books', { limit: 10 });
//   list.items, list.pagination, list.loading, list.error
//   list.setSearch('data')  list.setFilter('category', 'Mathematics')  list.setPage(2)  list.reload()
// Searching or filtering always jumps back to page 1.
import { useCallback, useEffect, useRef, useState } from 'react';
import { http } from '../services/api';
import useDebounce from './useDebounce';

export default function useList(url, { limit = 10, initialFilters = {}, enabled = true, params: fixedParams } = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearchText] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [state, setState] = useState({ items: [], pagination: null, extra: null, loading: enabled, error: null });
  const debouncedSearch = useDebounce(search);
  const latest = useRef(0);
  const fixedKey = JSON.stringify(fixedParams || {});          // extra params that always apply (e.g. { subject_id: 3 })

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    // empty filters are not sent
    const params = { page, limit, q: debouncedSearch || undefined, ...JSON.parse(fixedKey) };
    Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) params[k] = v; });
    try {
      const body = await http.get(url, params);
      if (id !== latest.current) return;
      const { items, pagination, ...extra } = body.data; // "extra" = things like totals or rules sent with the list
      setState({ items, pagination, extra, loading: false, error: null });
    } catch (err) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [url, page, limit, debouncedSearch, filters, enabled, fixedKey]);

  useEffect(() => { setPage(1); }, [fixedKey]);   // a different subject/section starts again at page 1
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { latest.current += 1; }, []);

  const setSearch = useCallback((text) => { setSearchText(text); setPage(1); }, []);
  const setFilter = useCallback((name, value) => { setFilters((f) => ({ ...f, [name]: value })); setPage(1); }, []);
  const resetFilters = useCallback(() => { setFilters(initialFilters); setSearchText(''); setPage(1); }, []); // eslint-disable-line

  return { ...state, page, search, filters, setPage, setSearch, setFilter, resetFilters, reload: load };
}
