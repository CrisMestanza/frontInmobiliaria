// Admin overview service — extracted from PanelInmo.jsx
import { withApiBase } from '../config/api.js';
import { authFetch } from '../config/authFetch.js';
import { throwResponseError } from '../utils/apiErrors.js';

export const resolveProjectImageUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== 'string') return null;
  if (rawPath.startsWith('http')) return rawPath;
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return withApiBase(`https://api.geohabita.com${normalizedPath}`);
};

export const getProjectImageCandidates = (project) => {
  if (!project) return [];
  const rawCandidates = [
    project.hero_image_resolved,
    project.hero_image_url,
    project.portada_resolved,
    ...(Array.isArray(project.gallery_images) ? project.gallery_images : []),
    project.hero_image,
    project.imagenproyecto,
    project.imagen,
    project.portada,
    project.imagen_url,
    project.thumbnail,
    project.cover,
  ];

  return Array.from(new Set(rawCandidates.map(resolveProjectImageUrl).filter(Boolean)));
};

export const fetchProjectImages = async (projectId) => {
  if (!projectId) return [];
  try {
    const res = await fetch(
      withApiBase(`https://api.geohabita.com/api/list_imagen_proyecto/${projectId}`),
    );
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => resolveProjectImageUrl(item?.imagenproyecto))
      .filter(Boolean);
  } catch (error) {
    console.error('No se pudo resolver la galería del proyecto:', error);
    return [];
  }
};

export const hasFinancingConfigValue = (value) => {
  if (!value) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '{}' || trimmed === 'null') return false;
    try {
      const parsed = JSON.parse(trimmed);
      return !!parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
    } catch {
      return true;
    }
  }
  return typeof value === 'object' ? Object.keys(value).length > 0 : Boolean(value);
};

export const fetchDashboardOverview = async (idInmo) => {
  const token = localStorage.getItem('access');
  const [resOverview, resProjects] = await Promise.all([
    authFetch(
      withApiBase(`https://api.geohabita.com/api/dashboard_overview_inmobiliaria/${idInmo}/`),
      { headers: { Authorization: `Bearer ${token}` } },
    ),
    authFetch(
      withApiBase(`https://api.geohabita.com/api/getProyectoInmo/${idInmo}`),
      { headers: { Authorization: `Bearer ${token}` } },
    ),
  ]);

  if (!resOverview.ok) {
    const body = await resOverview.text().catch(() => '');
    throw new Error(`Dashboard error ${resOverview.status}: ${body.slice(0, 200)}`);
  }
  const overview = await resOverview.json();
  const rawProjects = resProjects.ok ? await resProjects.json() : [];

  const projectById = new Map(
    (Array.isArray(rawProjects) ? rawProjects : []).map((project) => [
      Number(project?.idproyecto),
      project,
    ]),
  );

  const overviewProjects = Array.isArray(overview?.proyectos) ? overview.proyectos : [];

  const normalizedProjects = await Promise.all(
    overviewProjects.map(async (project) => {
      const fullProject = projectById.get(Number(project?.idproyecto)) || {};
      const directImage =
        getProjectImageCandidates({
          ...fullProject,
          ...project,
          gallery_images: [],
        })[0] || null;
      // Siempre se consulta la galería real: los campos "directos" del proyecto
      // (hero_image, imagenproyecto, etc.) a veces quedan vacíos o desactualizados,
      // y sin la galería como respaldo la card se queda sin ninguna imagen válida.
      const galleryImages = await fetchProjectImages(project.idproyecto);
      return {
        ...fullProject,
        ...project,
        financing_config_full: fullProject?.financing_config ?? null,
        gallery_images: galleryImages,
        hero_image_resolved: directImage || galleryImages[0] || null,
      };
    }),
  );

  return {
    resumen: overview?.resumen || null,
    clicks: overview?.clicks || null,
    proyectos: normalizedProjects,
  };
};

export const toggleProjectPublic = async (idproyecto, nextValue) => {
  const token = localStorage.getItem('access');
  const res = await authFetch(
    withApiBase(`https://api.geohabita.com/api/updateProyecto/${idproyecto}/`),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publico_mapa: nextValue ? 1 : 0 }),
    },
  );
  if (!res.ok) await throwResponseError(res, 'No se pudo actualizar la visibilidad del proyecto.');
  return true;
};

export const deleteProject = async (idproyecto) => {
  const token = localStorage.getItem('access');
  const res = await authFetch(
    withApiBase(`https://api.geohabita.com/api/deleteProyecto/${idproyecto}/`),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) await throwResponseError(res, 'No se pudo eliminar el proyecto.');
  return true;
};
