// useAdminData — fetch dashboard overview + projects
import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardOverview } from '../services/adminService.js';

export function useAdminData(idInmo) {
  const [resumen, setResumen] = useState(null);
  const [clicks, setClicks] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const silentRefresh = useCallback(async () => {
    if (!idInmo) return;
    try {
      const data = await fetchDashboardOverview(idInmo);
      setResumen(data.resumen);
      setClicks(data.clicks);
      setProyectos(data.proyectos);
    } catch (err) {
      console.error('Silent refresh failed:', err);
    }
  }, [idInmo]);

  useEffect(() => {
    if (!idInmo) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDashboardOverview(idInmo);
        if (!cancelled) {
          setResumen(data.resumen);
          setClicks(data.clicks);
          setProyectos(data.proyectos);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          console.error('Error cargando dashboard:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [idInmo, refreshKey]);

  return {
    resumen,
    clicks,
    proyectos,
    loading,
    error,
    refresh,
    silentRefresh,
    setProyectos, // exposed so modules can optimistically update
  };
}
