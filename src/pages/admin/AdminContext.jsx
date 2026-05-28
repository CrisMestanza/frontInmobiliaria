// AdminContext — shares dashboard data + actions across admin modules
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAdminData } from '../../hooks/useAdminData.js';
import { useLotsData } from '../../hooks/useLotsData.js';
import { toggleProjectPublic, deleteProject } from '../../services/adminService.js';
import { updateLoteStatus, deleteLote } from '../../services/lotsService.js';
import { resolveProjectImageUrl } from '../../services/adminService.js';

const AdminContext = createContext(null);

const getProjectImageCandidates = (project) => {
  if (!project) return [];
  return [
    project.hero_image_resolved,
    ...(Array.isArray(project.gallery_images) ? project.gallery_images : []),
    project.hero_image,
    project.imagenproyecto,
    project.imagen,
    project.portada,
  ]
    .map(resolveProjectImageUrl)
    .filter(Boolean);
};

export function AdminProvider({ children }) {
  const idInmo = localStorage.getItem('idinmobiliaria');
  const token = localStorage.getItem('access');

  const {
    resumen,
    clicks,
    proyectos,
    loading,
    error,
    refresh: refreshOverview,
    silentRefresh,
    setProyectos,
  } = useAdminData(idInmo);

  const lotsData = useLotsData(idInmo);

  useEffect(() => {
    if (!proyectos.length || typeof window === 'undefined') return;
    const urls = Array.from(
      new Set(proyectos.flatMap((project) => getProjectImageCandidates(project))),
    ).slice(0, 36);

    urls.forEach((url) => {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = url;
    });
  }, [proyectos]);

  // Derived metrics
  const totalLotes = resumen?.totalLotes || 0;
  const totalContactos = clicks?.total_clicks_contactos || 0;
  const totalInteres = clicks?.total_clicks_proyectos || 0;

  const engagementRate = useMemo(() => {
    if (!proyectos.length) return 0;
    return Math.round((totalContactos / proyectos.length) * 10) / 10;
  }, [totalContactos, proyectos.length]);

  const proyectoNombrePorId = useMemo(() => {
    const map = new Map();
    proyectos.forEach((p) => map.set(p.idproyecto, p.nombreproyecto));
    return map;
  }, [proyectos]);

  const lotesStatsPorProyecto = useMemo(() => {
    const map = new Map();
    proyectos.forEach((p) => {
      map.set(p.idproyecto, p.lote_stats || {
        total: 0, disponible: 0, reservado: 0, vendido: 0,
      });
    });
    return map;
  }, [proyectos]);

  // Actions
  const handleTogglePublic = async (proyecto, nextValue) => {
    if (!proyecto?.idproyecto) return;
    const id = proyecto.idproyecto;
    const prevValue = proyecto.publico_mapa;
    // Optimistic update
    setProyectos((prev) =>
      prev.map((p) => (p.idproyecto === id ? { ...p, publico_mapa: nextValue ? 1 : 0 } : p)),
    );
    try {
      await toggleProjectPublic(id, nextValue);
    } catch (err) {
      console.error(err);
      // Rollback
      setProyectos((prev) =>
        prev.map((p) => (p.idproyecto === id ? { ...p, publico_mapa: prevValue } : p)),
      );
      window.alertError?.(err?.message || 'No se pudo actualizar la visibilidad.');
    }
  };

  const handleDeleteProject = async (idproyecto) => {
    try {
      await deleteProject(idproyecto);
      setProyectos((prev) => prev.filter((p) => p.idproyecto !== idproyecto));
      window.alertSuccess?.('Proyecto eliminado ✅');
      silentRefresh();
      lotsData.refresh();
    } catch (err) {
      console.error(err);
      window.alertError?.(err?.message || 'No se pudo eliminar el proyecto.');
    }
  };

  const handleUpdateLoteStatus = async (idlote, nuevoEstado) => {
    try {
      await updateLoteStatus(idlote, nuevoEstado);
      silentRefresh();
      lotsData.refresh();
    } catch (err) {
      console.error(err);
      window.alertError?.(err?.message || 'No se pudo actualizar el estado.');
    }
  };

  const handleDeleteLote = async (idlote) => {
    if (!window.confirm('¿Seguro que deseas eliminar este lote?')) return;
    try {
      await deleteLote(idlote);
      lotsData.refresh();
      silentRefresh();
    } catch (err) {
      console.error(err);
      window.alertError?.(err?.message || 'No se pudo eliminar el lote.');
    }
  };

  const value = useMemo(() => ({
    idInmo,
    token,
    // Data
    resumen,
    clicks,
    proyectos,
    loading,
    error,
    // Derived
    totalLotes,
    totalContactos,
    totalInteres,
    engagementRate,
    proyectoNombrePorId,
    lotesStatsPorProyecto,
    // Lots
    lotsData,
    // Actions
    refreshOverview,
    silentRefresh,
    setProyectos,
    handleTogglePublic,
    handleDeleteProject,
    handleUpdateLoteStatus,
    handleDeleteLote,
  }), [
    idInmo, token, resumen, clicks, proyectos, loading, error,
    totalLotes, totalContactos, totalInteres, engagementRate,
    proyectoNombrePorId, lotesStatsPorProyecto, lotsData,
    refreshOverview, silentRefresh, setProyectos,
    handleTogglePublic, handleDeleteProject,
    handleUpdateLoteStatus, handleDeleteLote,
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
