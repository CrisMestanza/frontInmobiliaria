// Lots service — extracted from PanelInmo.jsx
import { withApiBase } from '../config/api.js';
import { authFetch } from '../config/authFetch.js';
import { throwResponseError } from '../utils/apiErrors.js';

export const fetchLotesPage = async ({ idInmo, page = 1, pageSize = 20, search = '', status = 'all', project = 'all', sort = 'nombre', priceMin = '', priceMax = '', areaMin = '', areaMax = '', signal } = {}) => {
  const token = localStorage.getItem('access');
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    search,
    status,
    project,
    sort,
    price_min: priceMin,
    price_max: priceMax,
    area_min: areaMin,
    area_max: areaMax,
  });

  const res = await authFetch(
    withApiBase(`https://api.geohabita.com/api/dashboard_lotes_inmobiliaria/${idInmo}/?${query.toString()}`),
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );

  if (!res.ok) return { items: [], page: 1, page_size: pageSize, total: 0, total_pages: 1 };
  const data = await res.json();
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    page: data?.page || 1,
    page_size: data?.page_size || pageSize,
    total: data?.total || 0,
    total_pages: data?.total_pages || 1,
  };
};

export const updateLoteStatus = async (idlote, nuevoEstado) => {
  const token = localStorage.getItem('access');
  const res = await authFetch(
    withApiBase(`https://api.geohabita.com/api/updateLoteVendido/${idlote}/`),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ vendido: nuevoEstado }),
    },
  );
  if (!res.ok) await throwResponseError(res, 'No se pudo actualizar el estado del lote.');
  return true;
};

export const deleteLote = async (idlote) => {
  const token = localStorage.getItem('access');
  const res = await authFetch(
    withApiBase(`https://api.geohabita.com/api/deleteLote/${idlote}/`),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) await throwResponseError(res, 'No se pudo eliminar el lote.');
  return true;
};

export const fetchLoteDetail = async (idlote) => {
  const token = localStorage.getItem('access');
  const res = await authFetch(
    withApiBase(`https://api.geohabita.com/api/list_lote_id/${idlote}`),
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) await throwResponseError(res, 'No se pudo cargar el lote.');
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
};

// Helper: map estado code to label/class
export const getEstadoLote = (vendido) => {
  const value = Number(vendido);
  if (value === 0) return { label: 'Disponible', className: 'status-available' };
  if (value === 2) return { label: 'Reservado', className: 'status-reserved' };
  if (value === 1) return { label: 'Vendido', className: 'status-sold' };
  return { label: 'Sin estado', className: 'status-unknown' };
};

// Helper: check if lote is "new" (created within last 7 days)
export const isNewLote = (lote) => {
  const parseDateSafe = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const date =
    parseDateSafe(lote.created_at) ||
    parseDateSafe(lote.fecha_creacion) ||
    parseDateSafe(lote.fecha_registro) ||
    parseDateSafe(lote.createdAt) ||
    parseDateSafe(lote.fecha);
  if (!date) return false;
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
};
