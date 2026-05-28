// useLotsData — fetch lots with pagination, filters, sorting
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLotesPage } from '../services/lotsService.js';

export function useLotsData(idInmo) {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortKey, setSortKey] = useState('nombre');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [areaMin, setAreaMin] = useState('');
  const [areaMax, setAreaMax] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, projectFilter, sortKey, priceMin, priceMax, areaMin, areaMax]);

  useEffect(() => {
    if (!idInmo) return;

    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const result = await fetchLotesPage({
          idInmo,
          page,
          pageSize: 20,
          search: searchTerm,
          status: statusFilter,
          project: projectFilter,
          sort: sortKey,
          priceMin,
          priceMax,
          areaMin,
          areaMax,
          signal: controller.signal,
        });
        if (!cancelled) {
          setLotes(result.items);
          setMeta({
            page: result.page,
            page_size: result.page_size,
            total: result.total,
            total_pages: result.total_pages,
          });
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          console.error('Error cargando lotes:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [idInmo, page, refreshKey, searchTerm, statusFilter, projectFilter, sortKey, priceMin, priceMax, areaMin, areaMax]);

  return {
    lotes,
    loading,
    page,
    setPage,
    meta,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    projectFilter,
    setProjectFilter,
    sortKey,
    setSortKey,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    areaMin,
    setAreaMin,
    areaMax,
    setAreaMax,
    refresh,
  };
}
