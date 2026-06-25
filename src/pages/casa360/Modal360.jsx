import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BoxSelect,
  ChevronDown,
  ChevronRight,
  Church,
  Eye,
  EyeOff,
  Goal,
  Home,
  ImagePlus,
  Landmark,
  Link2,
  Map as MapIcon,
  MapPin,
  MousePointerClick,
  Move,
  Pencil,
  Plus,
  History,
  Save,
  Store,
  Trees,
  RotateCw,
  Trash2,
  Upload,
  Volleyball,
  Waves,
  X,
} from "lucide-react";
import { authFetch } from "../../config/authFetch.js";
import { withApiBase } from "../../config/api.js";
import { getResponseErrorMessage } from "../../utils/apiErrors.js";
import styles from "./modal360.module.css";

let viewerRuntimePromise = null;
let viewerRuntimeCache = null;

const loadViewerRuntime = async () => {
  if (!viewerRuntimePromise) {
    viewerRuntimePromise = Promise.all([
      import("@photo-sphere-viewer/core"),
      import("@photo-sphere-viewer/markers-plugin"),
      import("three"),
      import("@photo-sphere-viewer/core/index.css"),
      import("@photo-sphere-viewer/markers-plugin/index.css"),
    ]).then(([core, markersPlugin, three]) => {
      viewerRuntimeCache = {
        Viewer: core.Viewer,
        EquirectangularAdapter: core.EquirectangularAdapter,
        MarkersPlugin: markersPlugin.MarkersPlugin,
        Vector3: three.Vector3,
      };
      return viewerRuntimeCache;
    });
  }
  return viewerRuntimePromise;
};

const MARKER_SIZE = { width: 34, height: 34 };
const OVERLAY_VIEWBOX = { width: 1200, height: 780 };
const DEFAULT_LAYOUT_CONFIG = {
  visible: true,
  x: 70,
  y: 70,
  scale: 0.78,
  scaleX: 1,
  scaleY: 1,
  rotation: -8,
  skewX: 0,
  skewY: 0,
  opacity: 0.92,
  lotOpacity: 0.82,
  showProjectOutline: true,
  tiltX: 0,
  tiltY: 0,
  perspectiveDepth: 900,
  textureMode: "solid",
  showShadow: true,
  lotOverrides: {},
};

const DEFAULT_ALIGNMENT_STATE = {
  active: false,
  step: "plan",
  pairs: [],
  pendingPlanPoint: null,
  result: null,
  error: null,
};

const REQUIRED_AFFINE_POINTS = 3;
const SNAP_THRESHOLD_PX = 28;

const buildApiUrl = (path) => withApiBase(`https://api.geohabita.com${path}`);

const normalizeImageUrl = (url) => {
  if (!url) return "";
  return url.startsWith("http") ? url : buildApiUrl(url);
};

const getImageId = (img) => img?.id_imagen ?? img?.id;

const normalizeStoredImage = (img) => ({
  ...img,
  id_imagen: getImageId(img),
  nombre: img?.nombre || img?.name || `Vista ${getImageId(img) || ""}`.trim(),
  imagen: normalizeImageUrl(img?.imagen),
  isDraft: false,
  file: null,
});

const parseOverlayPayload = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getImageOverlayPayload = (img) =>
  parseOverlayPayload(
    img?.overlays_2d ??
      img?.overlay_2d ??
      img?.overlay2d ??
      img?.tour_overlay ??
      img?.tour_data,
  );

const TEMP_MARKER_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <circle cx="17" cy="17" r="10" fill="#22c55e" fill-opacity="0.9"/>
  <circle cx="17" cy="17" r="4" fill="#ffffff"/>
  <circle cx="17" cy="17" r="15" fill="none" stroke="#22c55e" stroke-width="2" stroke-opacity="0.55"/>
</svg>
`)}`;

const HOTSPOT_MARKER_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <circle cx="17" cy="17" r="9" fill="#0f172a" fill-opacity="0.95"/>
  <circle cx="17" cy="17" r="3.5" fill="#86efac"/>
  <circle cx="17" cy="17" r="14" fill="none" stroke="#86efac" stroke-width="2" stroke-opacity="0.55"/>
</svg>
`)}`;

const ANNOTATION_MARKER_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="62" viewBox="0 0 44 62">
  <defs>
    <filter id="sh" x="-50%" y="-30%" width="200%" height="200%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#1e0a44" flood-opacity=".48"/>
    </filter>
    <radialGradient id="hg" cx="38%" cy="32%">
      <stop offset="0%" stop-color="#c4b5fd"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </radialGradient>
    <linearGradient id="sg" x1="22" y1="36" x2="22" y2="62" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <ellipse cx="22" cy="60" rx="7" ry="2.5" fill="rgba(0,0,0,0.22)"/>
  <rect x="19" y="36" width="6" height="24" rx="3" fill="url(#sg)" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/>
  <g filter="url(#sh)">
    <circle cx="22" cy="20" r="18" fill="url(#hg)" stroke="rgba(255,255,255,0.95)" stroke-width="2.5"/>
  </g>
  <circle cx="22" cy="13" r="2.8" fill="white"/>
  <rect x="19.5" y="18" width="5" height="11" rx="2.5" fill="white"/>
</svg>
`)}`;
const ANNOTATION_MARKER_SIZE = { width: 44, height: 62 };

const DRAWING_SCENARIO_TYPES = [
  { key: "area",   label: "Area libre",       icon: MapIcon, color: "#0ea5e9" },
  { key: "lote",   label: "Lote",             icon: Home,    color: "#16a34a" },
  { key: "parque", label: "Parque",           icon: Trees,   color: "#22c55e" },
  { key: "loza",   label: "Loza deportiva",   icon: Volleyball, color: "#22d3ee" },
  { key: "cancha", label: "Cancha deportiva", icon: Goal,       color: "#4ade80" },
  { key: "piscina",  label: "Piscina",          icon: Waves,    color: "#06b6d4" },
  { key: "plaza",    label: "Plaza",            icon: Landmark, color: "#f59e0b" },
  { key: "iglesia",  label: "Iglesia",          icon: Church,   color: "#e2e8f0" },
  { key: "comercio", label: "Comercio",         icon: Store,    color: "#8b5cf6" },
];

const DEFAULT_DRAWING_SCENARIO = DRAWING_SCENARIO_TYPES[0];

const getDrawingScenario = (key) =>
  DRAWING_SCENARIO_TYPES.find((item) => item.key === key) ||
  DEFAULT_DRAWING_SCENARIO;

const renderCourtIcon = () => null;

const createDraftImage = (file, nombre) => ({
  id_imagen: `draft-${crypto.randomUUID()}`,
  nombre: nombre?.trim() || file.name.replace(/\.[^.]+$/, ""),
  imagen: URL.createObjectURL(file),
  file,
  isDraft: true,
});

const removeTempMarker = (markers) => {
  if (!markers) return;
  try {
    markers.removeMarker("temp");
  } catch {
    // El marker temporal aun no existe.
  }
};

// SVGSVGElement.offsetTop devuelve 0 en varios browsers; calcula el offset real
// sumando la altura de los hermanos anteriores dentro del mismo contenedor.
const getSvgTopOffsetInParent = (svgEl) => {
  if (!svgEl) return 0;
  let y = 0;
  let sibling = svgEl.previousElementSibling;
  while (sibling) {
    const st = window.getComputedStyle(sibling);
    y += sibling.offsetHeight + Math.max(parseFloat(st.marginBottom) || 0, 0);
    sibling = sibling.previousElementSibling;
  }
  return y || svgEl.offsetTop || 0;
};

const makeMarkerPosition = (yaw, pitch) => ({ yaw, pitch });

const installDeferredViewerAutoSize = (viewer, delay = 180) => {
  if (!viewer?.autoSize) return () => {};

  const autoSize = viewer.autoSize.bind(viewer);
  let timeoutId = null;

  viewer.autoSize = () => {
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      autoSize();
    }, delay);
  };

  return () => {
    if (timeoutId) window.clearTimeout(timeoutId);
    viewer.autoSize = autoSize;
  };
};

const normalizePolygonCoords = (coords = []) => {
  const normalized = coords
    .map((point) => ({
      lat: Number(point.lat ?? point.latitud),
      lng: Number(point.lng ?? point.longitud),
      orden: point.orden,
    }))
    .filter(
      (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
    );

  if (normalized.length < 2) return normalized;

  const hasOrder = normalized.every(
    (point) => point.orden !== null && point.orden !== undefined,
  );

  if (hasOrder) {
    return normalized
      .sort((a, b) => Number(a.orden) - Number(b.orden))
      .map((point) => ({ lat: point.lat, lng: point.lng }));
  }

  const center = normalized.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  center.lat /= normalized.length;
  center.lng /= normalized.length;

  return normalized
    .sort((a, b) => {
      const angleA = Math.atan2(a.lat - center.lat, a.lng - center.lng);
      const angleB = Math.atan2(b.lat - center.lat, b.lng - center.lng);
      return angleA - angleB;
    })
    .map((point) => ({ lat: point.lat, lng: point.lng }));
};

const buildSvgPath = (points) =>
  points.length
    ? `${points
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(" ")} Z`
    : "";

const getLoteFill = (vendido) => {
  const value = Number(vendido);
  if (value === 1) return "#ef4444";
  if (value === 2) return "#f59e0b";
  return "#22c55e";
};

const getLoteId = (lote) =>
  lote?.idlote ?? lote?.id ?? lote?.id_lote ?? lote?.lote_id;

// Identificador estable de un lote como string, para usar como clave en Sets/Maps
// (selección, overrides, etc). Si el lote no trae un id real del backend, usamos su
// índice como respaldo — pero SIEMPRE con el mismo criterio en todos lados, porque
// mezclar "" con el índice en distintos puntos del código rompía la selección
// (un lote podía marcarse seleccionado con una clave y buscarse con otra distinta).
const getLoteKey = (lote, index) =>
  String(getLoteId(lote) ?? (index !== undefined ? `idx-${index}` : ""));

const buildImportedGeometry = (projectPoints = [], lotes = []) => {
  const normalizedProject = normalizePolygonCoords(projectPoints);
  const normalizedLotes = Array.isArray(lotes)
    ? lotes
        .map((lote) => ({
          ...lote,
          puntos: normalizePolygonCoords(lote.puntos || []),
        }))
        .filter((lote) => lote.puntos.length >= 3)
    : [];

  const allPoints = [
    ...normalizedProject,
    ...normalizedLotes.flatMap((lote) => lote.puntos),
  ];

  if (!allPoints.length) return null;

  const bounds = allPoints.reduce(
    (acc, point) => ({
      minLat: Math.min(acc.minLat, point.lat),
      maxLat: Math.max(acc.maxLat, point.lat),
      minLng: Math.min(acc.minLng, point.lng),
      maxLng: Math.max(acc.maxLng, point.lng),
    }),
    {
      minLat: Infinity,
      maxLat: -Infinity,
      minLng: Infinity,
      maxLng: -Infinity,
    },
  );

  const spanLat = Math.max(bounds.maxLat - bounds.minLat, 0.000001);
  const spanLng = Math.max(bounds.maxLng - bounds.minLng, 0.000001);
  const padding = 56;
  const drawableWidth = OVERLAY_VIEWBOX.width - padding * 2;
  const drawableHeight = OVERLAY_VIEWBOX.height - padding * 2;

  const projectPoint = (point) => ({
    x: padding + ((point.lng - bounds.minLng) / spanLng) * drawableWidth,
    y: padding + ((bounds.maxLat - point.lat) / spanLat) * drawableHeight,
  });

  const projectSvgPoints = normalizedProject.map(projectPoint);
  const projectPath = buildSvgPath(projectSvgPoints);

  const lotesSvg = normalizedLotes.map((lote) => {
    const points = lote.puntos.map(projectPoint);
    return {
      idlote: getLoteId(lote),
      nombre: lote.nombre,
      precio: lote.precio,
      moneda: lote.moneda,
      area_total_m2: lote.area_total_m2,
      ancho: lote.ancho,
      largo: lote.largo,
      vendido: lote.vendido,
      color: getLoteFill(lote.vendido),
      points,
      path: buildSvgPath(points),
    };
  });

  return {
    projectPath,
    projectCount: normalizedProject.length,
    projectPoints: projectSvgPoints,
    lotes: lotesSvg,
  };
};

const isSvgPoint = (point) =>
  Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));

const hydrateStoredGeometry = (geometry) => {
  if (!geometry) return null;

  const projectPoints = Array.isArray(geometry.projectPoints)
    ? geometry.projectPoints
        .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
        .filter(isSvgPoint)
    : [];

  const lotes = Array.isArray(geometry.lotes)
    ? geometry.lotes
        .map((lote) => {
          const points = Array.isArray(lote.points)
            ? lote.points
                .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
                .filter(isSvgPoint)
            : [];

          return {
            ...lote,
            points,
            path: lote.path || buildSvgPath(points),
          };
        })
        .filter((lote) => lote.points.length >= 3)
    : [];

  return {
    ...geometry,
    projectPoints,
    projectCount: Number(geometry.projectCount) || projectPoints.length,
    projectPath: geometry.projectPath || buildSvgPath(projectPoints),
    lotes,
  };
};

const hasRenderableGeometry = (geometry) => {
  if (!geometry) return false;
  const hydrated = hydrateStoredGeometry(geometry);
  return !!(
    hydrated &&
    (hydrated.projectPath || (hydrated.lotes || []).some((lote) => lote.path))
  );
};

const serializeOverlayLayouts = (
  overlayLayouts,
  runtimeByImage = {},
  imageIds = null,
) => {
  const allowedImageIds = imageIds ? new Set([...imageIds].map(String)) : null;

  return Object.entries(overlayLayouts)
    .filter(([imageId, config]) => {
      if (allowedImageIds && !allowedImageIds.has(String(imageId)))
        return false;
      return config?.visible !== false;
    })
    .map(([imageId, config]) => ({
      imageId,
      ...config,
      ...(runtimeByImage[String(imageId)] || {}),
    }));
};

const isValidTexturePoint = (point) =>
  Array.isArray(point) &&
  point.length === 2 &&
  Number.isFinite(Number(point[0])) &&
  Number.isFinite(Number(point[1]));

const isValidSphericalPoint = isValidTexturePoint;

const getLotCentroid = (points = []) => {
  if (!points.length) return { cx: 0, cy: 0 };
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { cx, cy };
};

const getAlignmentQuality = (averageError) => {
  if (!Number.isFinite(averageError))
    return { label: "Sin medicion", tone: "neutral" };
  if (averageError < 5) return { label: "Excelente", tone: "good" };
  if (averageError <= 15) return { label: "Aceptable", tone: "warn" };
  return { label: "Revisar", tone: "bad" };
};

const createAlignmentSnapCandidates = (geometry) => {
  if (!geometry) return [];
  const candidates = [];

  (geometry.projectPoints || []).forEach((point, index) => {
    candidates.push({
      x: point.x,
      y: point.y,
      type: "project-vertex",
      label: `Vertice proyecto ${index + 1}`,
      priority: 1,
    });
  });

  (geometry.lotes || []).forEach((lote, loteIndex) => {
    const loteName = lote.nombre || `Lote ${loteIndex + 1}`;
    (lote.points || []).forEach((point, pointIndex) => {
      candidates.push({
        x: point.x,
        y: point.y,
        type: "lot-vertex",
        label: `${loteName} vertice ${pointIndex + 1}`,
        priority: 0,
      });
    });

    if ((lote.points || []).length >= 3) {
      const centroid = getLotCentroid(lote.points);
      candidates.push({
        x: centroid.cx,
        y: centroid.cy,
        type: "lot-centroid",
        label: `${loteName} centroide`,
        priority: 2,
      });
    }
  });

  return candidates;
};

const getSvgPointFromClient = (svgEl, clientX, clientY) => {
  if (!svgEl?.createSVGPoint) return null;
  const matrix = svgEl.getScreenCTM?.();
  if (!matrix) return null;
  const point = svgEl.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const svgPoint = point.matrixTransform(matrix.inverse());
  return { x: svgPoint.x, y: svgPoint.y };
};

const chooseSnapCandidate = (svgEl, svgPoint, clientX, clientY, candidates) => {
  if (!svgEl || !svgPoint || !candidates?.length) {
    return { ...svgPoint, label: "Punto libre", snapped: false, type: "free" };
  }

  const matrix = svgEl.getScreenCTM?.();
  if (!matrix) {
    return { ...svgPoint, label: "Punto libre", snapped: false, type: "free" };
  }

  let best = null;
  candidates.forEach((candidate) => {
    const candidateSvgPoint = svgEl.createSVGPoint();
    candidateSvgPoint.x = candidate.x;
    candidateSvgPoint.y = candidate.y;
    const screenPoint = candidateSvgPoint.matrixTransform(matrix);
    const distance = Math.hypot(
      screenPoint.x - clientX,
      screenPoint.y - clientY,
    );
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && candidate.priority < best.priority)
    ) {
      best = { ...candidate, distance };
    }
  });

  if (best && best.distance <= SNAP_THRESHOLD_PX) {
    return { ...best, snapped: true };
  }

  return { ...svgPoint, label: "Punto libre", snapped: false, type: "free" };
};

const solveLinear3 = (matrix, values) => {
  const a = matrix.map((row, index) => [...row, values[index]]);

  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }

    if (Math.abs(a[pivot][col]) < 1e-8) return null;
    if (pivot !== col) [a[col], a[pivot]] = [a[pivot], a[col]];

    const pivotValue = a[col][col];
    for (let j = col; j < 4; j += 1) a[col][j] /= pivotValue;

    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j < 4; j += 1) {
        a[row][j] -= factor * a[col][j];
      }
    }
  }

  return [a[0][3], a[1][3], a[2][3]];
};

const applyAffineMatrix = (matrix, point) => {
  if (!Array.isArray(matrix) || matrix.length !== 6) return point;
  const [a, b, c, d, e, f] = matrix.map(Number);
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
};

const computeAffineAlignment = (pairs) => {
  if (!Array.isArray(pairs) || pairs.length < REQUIRED_AFFINE_POINTS) {
    return null;
  }

  const usablePairs = pairs.filter((pair) => {
    const sx = Number(pair.sourceLayout?.x);
    const sy = Number(pair.sourceLayout?.y);
    const tx = Number(pair.targetViewer?.x);
    const ty = Number(pair.targetViewer?.y);
    return [sx, sy, tx, ty].every(Number.isFinite);
  });

  if (usablePairs.length < REQUIRED_AFFINE_POINTS) return null;

  // Verificar que los puntos no estén alineados (para evitar matriz singular)
  const sourcePoints = usablePairs.map((pair) => [
    pair.sourceLayout.x,
    pair.sourceLayout.y,
  ]);
  const targetPoints = usablePairs.map((pair) => [
    pair.targetViewer.x,
    pair.targetViewer.y,
  ]);

  // Calcular área del triángulo formado por los primeros 3 puntos para verificar colinealidad
  if (sourcePoints.length >= 3) {
    const [x1, y1] = sourcePoints[0];
    const [x2, y2] = sourcePoints[1];
    const [x3, y3] = sourcePoints[2];
    const area = Math.abs(
      (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2,
    );
    if (area < 1e-6) {
      return null; // Puntos colineales
    }
  }

  const sourceMatrix = usablePairs.map((pair) => [
    Number(pair.sourceLayout?.x),
    Number(pair.sourceLayout?.y),
    1,
  ]);
  const targetX = usablePairs.map((pair) => Number(pair.targetViewer?.x));
  const targetY = usablePairs.map((pair) => Number(pair.targetViewer?.y));

  if (
    sourceMatrix.flat().some((value) => !Number.isFinite(value)) ||
    targetX.some((value) => !Number.isFinite(value)) ||
    targetY.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }

  const normalMatrix = sourceMatrix.reduce(
    (acc, row) => {
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          acc[r][c] += row[r] * row[c];
        }
      }
      return acc;
    },
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
  );

  const buildNormalTarget = (targetValues) =>
    sourceMatrix.reduce(
      (acc, row, index) => {
        for (let r = 0; r < 3; r += 1) {
          acc[r] += row[r] * targetValues[index];
        }
        return acc;
      },
      [0, 0, 0],
    );

  const xCoefficients = solveLinear3(normalMatrix, buildNormalTarget(targetX));
  const yCoefficients = solveLinear3(normalMatrix, buildNormalTarget(targetY));
  if (!xCoefficients || !yCoefficients) return null;

  const matrix = [
    xCoefficients[0],
    yCoefficients[0],
    xCoefficients[1],
    yCoefficients[1],
    xCoefficients[2],
    yCoefficients[2],
  ];

  const residuals = usablePairs.map((pair, index) => {
    const projected = applyAffineMatrix(matrix, pair.sourceLayout);
    const error = Math.hypot(
      projected.x - pair.targetViewer.x,
      projected.y - pair.targetViewer.y,
    );
    return {
      index: index + 1,
      error,
      sourceLabel: pair.source?.label || `Punto ${index + 1}`,
    };
  });

  const averageError =
    residuals.reduce((sum, item) => sum + item.error, 0) / residuals.length;
  const maxError = Math.max(...residuals.map((item) => item.error));

  return {
    matrix,
    residuals,
    averageError,
    maxError,
    pointCount: usablePairs.length,
    quality: getAlignmentQuality(averageError),
  };
};

const applyLotSvgTransform = (points, override) => {
  if (override?.committedPoints?.length) return override.committedPoints;
  const dx = Number(override?.svgDx) || 0;
  const dy = Number(override?.svgDy) || 0;
  const s = Number(override?.svgScale) || 1;
  if (dx === 0 && dy === 0 && s === 1) return points;
  const { cx, cy } = getLotCentroid(points);
  return points.map((p) => ({
    x: dx + cx + (p.x - cx) * s,
    y: dy + cy + (p.y - cy) * s,
  }));
};

const computeGroupCentroid = (lotes, selectedIds, lotOverrides) => {
  let totalX = 0,
    totalY = 0,
    count = 0;
  lotes.forEach((l, index) => {
    const key = getLoteKey(l, index);
    if (!selectedIds.has(key)) return;
    const override = lotOverrides[key] ?? {};
    const pts = applyLotSvgTransform(l.points || [], override);
    const { cx, cy } = getLotCentroid(pts);
    totalX += cx;
    totalY += cy;
    count++;
  });
  return count ? { cx: totalX / count, cy: totalY / count } : { cx: 0, cy: 0 };
};

const applyGroupTransformWithTiltToPoints = (points, gcx, gcy, groupEdit) => {
  const {
    scale = 1,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
    skewX = 0,
    skewY = 0,
    dx = 0,
    dy = 0,
    tiltX = 0,
    tiltY = 0,
    perspectiveDepth = 900,
    flipX = false,
    flipY = false,
    dz = 0,
    pivotOffsetX = 0,
    pivotOffsetY = 0,
    lensCurve = 0,
  } = groupEdit;
  if (
    scale === 1 &&
    scaleX === 1 &&
    scaleY === 1 &&
    rotation === 0 &&
    skewX === 0 &&
    skewY === 0 &&
    dx === 0 &&
    dy === 0 &&
    tiltX === 0 &&
    tiltY === 0 &&
    !flipX &&
    !flipY &&
    dz === 0 &&
    pivotOffsetX === 0 &&
    pivotOffsetY === 0 &&
    lensCurve === 0
  )
    return points;
  const pivotX = gcx + pivotOffsetX;
  const pivotY = gcy + pivotOffsetY;
  const r = (rotation * Math.PI) / 180;
  const rX = (tiltX * Math.PI) / 180;
  const rY = (tiltY * Math.PI) / 180;
  const skX = (skewX * Math.PI) / 180;
  const skY = (skewY * Math.PI) / 180;
  const pD = perspectiveDepth || 900;
  const cosR = Math.cos(r),
    sinR = Math.sin(r);
  const signX = flipX ? -1 : 1;
  const signY = flipY ? -1 : 1;
  const lensK = lensCurve / 100;
  return points.map((p) => {
    let lx = (p.x - pivotX) * scale * scaleX * signX;
    let ly = (p.y - pivotY) * scale * scaleY * signY;
    let x = lx * cosR - ly * sinR;
    let y = lx * sinR + ly * cosR;
    if (lensK !== 0) {
      const rr = Math.sqrt(x * x + y * y) / 600;
      const lensFactor = Math.max(0.05, 1 + lensK * rr * rr);
      x *= lensFactor;
      y *= lensFactor;
    }
    let z = 0;
    if (skX !== 0 || skY !== 0) {
      const sx = x + y * Math.tan(skX);
      const sy = y + x * Math.tan(skY);
      x = sx;
      y = sy;
    }
    if (rY !== 0) {
      const cY = Math.cos(rY),
        sY = Math.sin(rY);
      const nx = x * cY + z * sY;
      z = -x * sY + z * cY;
      x = nx;
    }
    if (rX !== 0) {
      const cX = Math.cos(rX),
        sX = Math.sin(rX);
      const ny = y * cX - z * sX;
      z = y * sX + z * cX;
      y = ny;
    }
    z += dz;
    const factor = rX !== 0 || rY !== 0 || dz !== 0 ? pD / (pD - z) : 1;
    return { x: pivotX + dx + x * factor, y: pivotY + dy + y * factor };
  });
};

const DEFAULT_GROUP_EDIT = {
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  dx: 0,
  dy: 0,
  opacity: null,
  textureMode: null,
  tiltX: 0,
  tiltY: 0,
  perspectiveDepth: 900,
  flipX: false,
  flipY: false,
  dz: 0,
  pivotOffsetX: 0,
  pivotOffsetY: 0,
  lensCurve: 0,
  vertexOffsets: {},
};

// Identifica un vértice por su coordenada BASE (antes de aplicar el transform
// del grupo), redondeada para tolerar el ruido de punto flotante. Dos lotes
// vecinos que comparten una esquina en el plano original tienen el mismo
// punto base ahí, así que comparten la misma clave — arrastrar esa esquina
// mueve a todos los lotes que la tocan a la vez, no solo a uno.
const getVertexKey = (x, y) => `${Math.round(x * 10) / 10}|${Math.round(y * 10) / 10}`;

const applyVertexOffsetsToPoints = (points, baseKeys, vertexOffsets) => {
  if (!vertexOffsets || !baseKeys || !Object.keys(vertexOffsets).length) return points;
  return points.map((p, i) => {
    const off = vertexOffsets[baseKeys[i]];
    if (!off) return p;
    return { x: p.x + (off.dx || 0), y: p.y + (off.dy || 0) };
  });
};

// ── Modo "ajuste fino sobre el tour" (zoom) ──────────────────────────────
// A diferencia del modo tarjeta flotante (espacio 2D del plano + CSS), este modo
// trabaja directo sobre coordenadas esféricas (yaw/pitch en radianes) porque los
// lotes ya están anclados a la foto y la cámara se mueve libremente (zoom real).
const DEFAULT_SPHERICAL_GROUP_EDIT = {
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  dYaw: 0,
  dPitch: 0,
  tiltX: 0,
  tiltY: 0,
  perspectiveDepth: 900,
  opacity: null,
  textureMode: null,
};

const getSphericalCentroid = (points = []) => {
  if (!points.length) return { yaw: 0, pitch: 0 };
  const yaw = points.reduce((s, p) => s + p.yaw, 0) / points.length;
  const pitch = points.reduce((s, p) => s + p.pitch, 0) / points.length;
  return { yaw, pitch };
};

// Cuántos "píxeles falsos" representa 1 radián del plano tangente — sólo se usa
// internamente para reutilizar la misma matemática de inclinación/perspectiva del
// modo tarjeta flotante (afinada para rangos de cientos de píxeles) con ángulos
// que en la práctica son fracciones de radián.
const TANGENT_PLANE_PSEUDO_PX_PER_RAD = 4000;

// Aproxima un plano tangente local alrededor del centroide (válido para grupos de
// lotes con extensión angular pequeña, que es el caso típico de un proyecto
// inmobiliario) para poder escalar/rotar/mover/inclinar con la misma matemática
// 2D+falso-3D que el modo tarjeta flotante, pero centrada en la foto en vez de en
// la pantalla.
const applySphericalGroupTransform = (points, centroidYaw, centroidPitch, edit) => {
  const {
    scale = 1,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
    skewX = 0,
    skewY = 0,
    dYaw = 0,
    dPitch = 0,
    tiltX = 0,
    tiltY = 0,
    perspectiveDepth = 900,
  } = edit || {};
  if (
    scale === 1 &&
    scaleX === 1 &&
    scaleY === 1 &&
    rotation === 0 &&
    skewX === 0 &&
    skewY === 0 &&
    dYaw === 0 &&
    dPitch === 0 &&
    tiltX === 0 &&
    tiltY === 0
  )
    return points;
  const cosLat = Math.cos(centroidPitch) || 1;
  const r = (rotation * Math.PI) / 180;
  const cosR = Math.cos(r),
    sinR = Math.sin(r);
  const skX = (skewX * Math.PI) / 180;
  const skY = (skewY * Math.PI) / 180;
  const rX = (tiltX * Math.PI) / 180;
  const rY = (tiltY * Math.PI) / 180;
  const pD = perspectiveDepth || 900;
  const K = TANGENT_PLANE_PSEUDO_PX_PER_RAD;
  return points.map((p) => {
    const lx = (p.yaw - centroidYaw) * cosLat * K * scale * scaleX;
    const ly = (p.pitch - centroidPitch) * K * scale * scaleY;
    let x = lx * cosR - ly * sinR;
    let y = lx * sinR + ly * cosR;
    if (skX !== 0 || skY !== 0) {
      const sx = x + y * Math.tan(skX);
      const sy = y + x * Math.tan(skY);
      x = sx;
      y = sy;
    }
    let z = 0;
    if (rY !== 0) {
      const cY = Math.cos(rY),
        sY = Math.sin(rY);
      const nx = x * cY + z * sY;
      z = -x * sY + z * cY;
      x = nx;
    }
    if (rX !== 0) {
      const cX = Math.cos(rX),
        sX = Math.sin(rX);
      const ny = y * cX - z * sX;
      z = y * sX + z * cX;
      y = ny;
    }
    const factor = rX !== 0 || rY !== 0 ? pD / (pD - z) : 1;
    const finalX = (x * factor) / K;
    const finalY = (y * factor) / K;
    const pitch = Math.max(
      -Math.PI / 2 + 0.001,
      Math.min(Math.PI / 2 - 0.001, centroidPitch + dPitch + finalY),
    );
    const yaw = centroidYaw + dYaw + finalX / cosLat;
    return { yaw, pitch };
  });
};

const getAffineCssMatrix = (config) => {
  const matrix = config?.affineMatrix;
  if (!Array.isArray(matrix) || matrix.length !== 6) return "";
  const values = matrix.map((value) => Number(value));
  if (values.some((value) => !Number.isFinite(value))) return "";
  return `matrix(${values.map((value) => Number(value.toFixed(6))).join(", ")})`;
};

const buildOverlayCssTransform = (config = {}) => {
  const {
    x = 0,
    y = 0,
    scale = 1,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
    skewX = 0,
    skewY = 0,
    tiltX = 0,
    tiltY = 0,
  } = config;
  const affine = getAffineCssMatrix(config);
  const tilt =
    tiltX !== 0 || tiltY !== 0
      ? `rotateX(${tiltX}deg) rotateY(${tiltY}deg) `
      : "";
  const skew =
    skewX !== 0 || skewY !== 0 ? `skew(${skewX}deg, ${skewY}deg) ` : "";
  const manual = `translate(${x}px, ${y}px) ${tilt}scale(${scale * scaleX}, ${scale * scaleY}) ${skew}rotate(${rotation}deg)`;
  return affine ? `${manual} ${affine}` : manual;
};

// perspectiveOrigin: centro del div con la propiedad CSS `perspective` (por defecto el viewer).
// CSS coloca el vanishing point en (50%, 50%) del elemento padre — si no se pasa, se asume (0,0)
// lo que produce un shift cuando hay tilt.
const applyAlignmentWarp = (viewerPoint, config, perspectiveOrigin = null) => {
  const pairs = Array.isArray(config?.alignmentWarp?.pairs)
    ? config.alignmentWarp.pairs
    : [];
  if (pairs.length < REQUIRED_AFFINE_POINTS) return viewerPoint;

  // Calcular transformación con mayor precisión usando todos los puntos
  let totalWeight = 0;
  let dx = 0;
  let dy = 0;

  for (const pair of pairs) {
    const source = pair?.sourceLayout;
    const target = pair?.targetViewer;
    if (
      !Number.isFinite(Number(source?.x)) ||
      !Number.isFinite(Number(source?.y)) ||
      !Number.isFinite(Number(target?.x)) ||
      !Number.isFinite(Number(target?.y))
    ) {
      continue;
    }

    // Calcular punto base transformado
    const anchorBase = transformOverlayPoint(
      source,
      config,
      1,
      1,
      perspectiveOrigin,
      false,
    );

    // Si estamos muy cerca de un punto de anclaje, usar directamente ese punto
    const distance = Math.hypot(
      viewerPoint.x - anchorBase.x,
      viewerPoint.y - anchorBase.y,
    );
    if (distance < 0.75) {
      return { x: Number(target.x), y: Number(target.y) };
    }

    // Calcular peso inversamente proporcional a la distancia
    const weight = 1 / Math.max(distance ** 4, 1);
    totalWeight += weight;
    dx += (Number(target.x) - anchorBase.x) * weight;
    dy += (Number(target.y) - anchorBase.y) * weight;
  }

  // Si no hay puntos válidos, devolver el punto original
  if (totalWeight <= 0) return viewerPoint;

  // Aplicar corrección ponderada
  return {
    x: viewerPoint.x + dx / totalWeight,
    y: viewerPoint.y + dy / totalWeight,
  };
};

const transformOverlayPoint = (
  point,
  config,
  baseScaleX,
  baseScaleY,
  perspectiveOrigin = null,
  includeAlignmentWarp = true,
) => {
  const rz = ((Number(config?.rotation) || 0) * Math.PI) / 180;
  const tiltX = ((Number(config?.tiltX) || 0) * Math.PI) / 180;
  const tiltY = ((Number(config?.tiltY) || 0) * Math.PI) / 180;
  const skewXRad = ((Number(config?.skewX) || 0) * Math.PI) / 180;
  const skewYRad = ((Number(config?.skewY) || 0) * Math.PI) / 180;
  const scale = Number(config?.scale) || 1;
  const scaleX = Number(config?.scaleX) || 1;
  const scaleY = Number(config?.scaleY) || 1;
  const tx = Number(config?.x) || 0;
  const ty = Number(config?.y) || 0;
  const pD = Number(config?.perspectiveDepth) || 900;

  // Step 1 – 2D rotation (rotateZ) around transform-origin top-left
  const lx = point.x * baseScaleX;
  const ly = point.y * baseScaleY;
  const affinePoint = applyAffineMatrix(config?.affineMatrix, { x: lx, y: ly });
  const cosZ = Math.cos(rz),
    sinZ = Math.sin(rz);
  let x = affinePoint.x * cosZ - affinePoint.y * sinZ;
  let y = affinePoint.x * sinZ + affinePoint.y * cosZ;
  let z = 0;

  // Step 1.5 – shear (matches CSS skew(), applied before scale)
  if (skewXRad !== 0 || skewYRad !== 0) {
    const sx = x + y * Math.tan(skewXRad);
    const sy = y + x * Math.tan(skewYRad);
    x = sx;
    y = sy;
  }

  // Step 2 – scale (uniform "size" plus independent horizontal/vertical fine-tune)
  x *= scale * scaleX;
  y *= scale * scaleY;

  // Step 3 – rotateY (tilt left/right); starts from z=0 so simplified
  if (tiltY !== 0) {
    const cY = Math.cos(tiltY),
      sY = Math.sin(tiltY);
    const nx = x * cY + z * sY;
    z = -x * sY + z * cY;
    x = nx;
  }

  // Step 4 – rotateX (tilt forward/back)
  if (tiltX !== 0) {
    const cX = Math.cos(tiltX),
      sX = Math.sin(tiltX);
    const ny = y * cX - z * sX;
    z = y * sX + z * cX;
    y = ny;
  }

  // Step 5 – perspective projection con el vanishing point correcto.
  // CSS `perspective` property usa perspective-origin (50% 50%) del elemento padre.
  // screen = origin + (point - origin) * pD / (pD - z)
  const hasTilt = tiltX !== 0 || tiltY !== 0;
  const factor = hasTilt ? pD / (pD - z) : 1;
  const ox = perspectiveOrigin?.x ?? 0;
  const oy = perspectiveOrigin?.y ?? 0;

  const viewerPoint = {
    x: ox + (x + tx - ox) * factor,
    y: oy + (y + ty - oy) * factor,
  };

  // Aplicar corrección de alineación con mayor precisión
  return includeAlignmentWarp
    ? applyAlignmentWarp(viewerPoint, config, perspectiveOrigin)
    : viewerPoint;
};

// Convierte un punto en espacio OVERLAY_VIEWBOX (coordenadas del plano 2D) a píxeles
// del visor, usando el mismo runtime (tamaño/offset del overlay) que el resto del
// editor. Se usa para la selección por rectángulo (marquee), que dibuja en espacio
// de píxeles del visor en vez del espacio interno del SVG del overlay.
const getOverlayLayoutPointScreenPosition = (point, config, runtime) => {
  if (!runtime || !config) return null;
  const svgWidth = Number(runtime.overlayWidth) || OVERLAY_VIEWBOX.width;
  const svgHeight = Number(runtime.overlayHeight) || OVERLAY_VIEWBOX.height;
  const offsetX = Number(runtime.overlayOffsetX) || 0;
  const offsetY = Number(runtime.overlayOffsetY) || 0;
  const vw = Number(runtime.viewerWidth) || 0;
  const vh = Number(runtime.viewerHeight) || 0;
  const perspOrig = vw > 0 && vh > 0 ? { x: vw / 2, y: vh / 2 } : null;
  const localPoint = {
    x: offsetX + (Number(point.x) / OVERLAY_VIEWBOX.width) * svgWidth,
    y: offsetY + (Number(point.y) / OVERLAY_VIEWBOX.height) * svgHeight,
  };
  const viewerPoint = transformOverlayPoint(
    localPoint,
    config,
    1,
    1,
    perspOrig,
  );
  if (!Number.isFinite(viewerPoint.x) || !Number.isFinite(viewerPoint.y))
    return null;
  return viewerPoint;
};

const hasAnchoredGeometry = (snapshot) =>
  !!snapshot &&
  (snapshot.projectPolygon?.length >= 3 ||
    snapshot.projectPolygonPixels?.length >= 3 ||
    (snapshot.lotPolygons || []).some(
      (lote) => lote.polygon?.length >= 3 || lote.polygonPixels?.length >= 3,
    ));

const remapImageId = (value, imageMap = {}) => {
  const key = String(value ?? "");
  return imageMap[key] || value;
};

const projectViewerPointWithCamera = (viewer, viewerPoint, width, height) => {
  const camera = viewer?.renderer?.camera;
  if (!camera || !width || !height || !viewerRuntimeCache?.Vector3) return null;

  const ndcX = (Number(viewerPoint.x) / width) * 2 - 1;
  const ndcY = 1 - (Number(viewerPoint.y) / height) * 2;
  const direction = new viewerRuntimeCache.Vector3(ndcX, ndcY, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();

  return viewer.dataHelper.vector3ToSphericalCoords(direction);
};

const projectViewerPointToAnchoredPoint = (
  viewer,
  viewerPoint,
  { allowOutOfViewport = false } = {},
) => {
  const width = viewer?.state?.size?.width || 0;
  const height = viewer?.state?.size?.height || 0;
  const viewerX = Number(viewerPoint?.x);
  const viewerY = Number(viewerPoint?.y);

  if (
    !width ||
    !height ||
    !Number.isFinite(viewerX) ||
    !Number.isFinite(viewerY)
  ) {
    return null;
  }

  if (
    !allowOutOfViewport &&
    (viewerX < 0 || viewerY < 0 || viewerX > width || viewerY > height)
  ) {
    return null;
  }

  const spherical =
    viewer.dataHelper.viewerCoordsToSphericalCoords({
      x: viewerX,
      y: viewerY,
    }) ||
    projectViewerPointWithCamera(
      viewer,
      { x: viewerX, y: viewerY },
      width,
      height,
    );
  if (!spherical) return null;

  let texture = null;
  try {
    texture = viewer.dataHelper.sphericalCoordsToTextureCoords(spherical);
  } catch {
    texture = null;
  }

  const texturePoint =
    Number.isFinite(texture?.textureX) && Number.isFinite(texture?.textureY)
      ? [texture.textureX, texture.textureY]
      : null;

  return Number.isFinite(spherical.yaw) && Number.isFinite(spherical.pitch)
    ? {
        spherical: [spherical.yaw, spherical.pitch],
        pixels: texturePoint,
      }
    : null;
};

// Variante de projectViewerPointToAnchoredPoint que parte directo de un punto
// esférico (yaw/pitch ya conocidos) — se usa para los lotes ya ajustados en
// modo "zoom" (anchoredEditMode), donde el punto de partida ya es esférico y no
// hace falta proyectar desde píxeles del visor.
const sphericalPointToAnchoredPoint = (viewer, point) => {
  const yaw = Number(point?.yaw);
  const pitch = Number(point?.pitch);
  if (!viewer?.dataHelper || !Number.isFinite(yaw) || !Number.isFinite(pitch))
    return null;

  let texture = null;
  try {
    texture = viewer.dataHelper.sphericalCoordsToTextureCoords({ yaw, pitch });
  } catch {
    texture = null;
  }

  const texturePoint =
    Number.isFinite(texture?.textureX) && Number.isFinite(texture?.textureY)
      ? [texture.textureX, texture.textureY]
      : null;

  return { spherical: [yaw, pitch], pixels: texturePoint };
};

const SliderWithInput = ({
  label,
  tooltip,
  value,
  min,
  max,
  step,
  numMin,
  numMax,
  numStep,
  format,
  parse,
  onChange,
  arrowStep = 1,
  fineArrowStep,
}) => {
  const smallStep = fineArrowStep ?? arrowStep / 5;
  const handleArrow = (dir, amount = arrowStep) => {
    const raw = Math.min(max, Math.max(min, value + dir * amount));
    onChange(Math.round(raw * 100000) / 100000);
  };
  return (
    <div className={styles.sliderControl} title={tooltip}>
      <span className={styles.sliderLabel}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.sliderRange}
      />
      <div className={styles.sliderInputRow}>
        <button type="button" className={styles.stepArrow} onClick={() => handleArrow(-1, smallStep)}>−−</button>
        <button type="button" className={styles.stepArrow} onClick={() => handleArrow(-1)}>−</button>
        <input
          type="number"
          className={styles.numberInput}
          min={numMin ?? min}
          max={numMax ?? max}
          step={numStep ?? step}
          value={format ? format(value) : value}
          onChange={(e) => {
            const display = Number(e.target.value);
            if (!Number.isFinite(display)) return;
            const raw = parse ? parse(display) : display;
            if (raw < min - 1e-9 || raw > max + 1e-9) return;
            onChange(raw);
          }}
        />
        <button type="button" className={styles.stepArrow} onClick={() => handleArrow(1)}>+</button>
        <button type="button" className={styles.stepArrow} onClick={() => handleArrow(1, smallStep)}>++</button>
      </div>
    </div>
  );
};

// Borrador local: guarda el avance del overlay 2D (posición, lotes confirmados/fijos)
// en localStorage para que cerrar la pestaña sin publicar no borre el trabajo.
const LOCAL_DRAFT_KEY = (idproyecto) => `gh360_draft_${idproyecto}`;
const LOCAL_DRAFT_DEBOUNCE_MS = 1500;

const readLocalDraft = (idproyecto) => {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY(idproyecto));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeLocalDraft = (idproyecto, data) => {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY(idproyecto), JSON.stringify(data));
  } catch {
    // Cuota de localStorage llena o modo privado — el autoguardado simplemente
    // no persiste esta vez, sin romper la edición en curso.
  }
};

const clearLocalDraft = (idproyecto) => {
  try {
    localStorage.removeItem(LOCAL_DRAFT_KEY(idproyecto));
  } catch {
    // no-op
  }
};

const formatRelativeSavedAt = (timestamp) => {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes === 1) return "hace 1 minuto";
  if (minutes < 60) return `hace ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "hace 1 hora";
  return `hace ${hours} horas`;
};

const Modal360 = ({ idproyecto, onClose, embedded = false }) => {
  const [imagenes, setImagenes] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [selectedImg, setSelectedImg] = useState(null);
  const [coords, setCoords] = useState(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerRuntimeReady, setViewerRuntimeReady] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [newPointName, setNewPointName] = useState("");
  const [newPointFile, setNewPointFile] = useState(null);
  const [savingTour, setSavingTour] = useState(false);
  const [projectGeometry, setProjectGeometry] = useState(null);
  const [geometryLoading, setGeometryLoading] = useState(false);
  const [overlayLayouts, setOverlayLayouts] = useState({});
  const [anchoredOverlays, setAnchoredOverlays] = useState({});
  const [additionalOverlayInstances, setAdditionalOverlayInstances] = useState({});
  const [localDraftPrompt, setLocalDraftPrompt] = useState(null);
  const [localDraftSavedAt, setLocalDraftSavedAt] = useState(null);
  const localDraftReadyRef = useRef(false);
  const localDraftTimeoutRef = useRef(null);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [selectedLotIds, setSelectedLotIds] = useState(new Set());
  const [groupEdit, setGroupEdit] = useState(DEFAULT_GROUP_EDIT);
  const [groupDragState, setGroupDragState] = useState(null);
  const [anchoredEditMode, setAnchoredEditMode] = useState(false);
  const [sphericalGroupEdit, setSphericalGroupEdit] = useState(DEFAULT_SPHERICAL_GROUP_EDIT);
  const [anchoredGroupDragState, setAnchoredGroupDragState] = useState(null);
  const [alignmentMode, setAlignmentMode] = useState(DEFAULT_ALIGNMENT_STATE);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [sliderPrecision, setSliderPrecision] = useState("normal");
  const [showAlignmentDetails, setShowAlignmentDetails] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationLabel, setAnnotationLabel] = useState("");
  const [annotationDesc, setAnnotationDesc] = useState("");
  const [drawMode, setDrawMode] = useState(null);
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState([]);
  const [polygonCursorPos, setPolygonCursorPos] = useState(null);
  const [userDrawings, setUserDrawings] = useState({});
  const [selectedDrawingScenario, setSelectedDrawingScenario] = useState(
    DEFAULT_DRAWING_SCENARIO.key,
  );
  const [drawingColor, setDrawingColor] = useState("#ffffff");
  const [drawingAreaName, setDrawingAreaName] = useState("");
  const [viewerPanTick, setViewerPanTick] = useState(0);
  const groupEditRef = useRef(DEFAULT_GROUP_EDIT);
  const selectedLotIdsRef = useRef(new Set());
  const groupEditBaseRef = useRef({});
  const annotationModeRef = useRef(false);
  const annotationsRef = useRef([]);
  const anchoredEditModeRef = useRef(false);
  const sphericalGroupEditRef = useRef(DEFAULT_SPHERICAL_GROUP_EDIT);
  const anchoredGroupDragRef = useRef(null);

  const token = localStorage.getItem("access");
  const viewerRef = useRef(null);
  const viewerInstance = useRef(null);
  const viewerRuntimeRef = useRef(null);
  const overlaySvgRef = useRef(null);
  const batchItemsRef = useRef([]);
  const imagenesRef = useRef([]);
  const overlayLayoutsRef = useRef({});
  const selectedOverlayConfigRef = useRef(null);
  const anchoredOverlaysRef = useRef({});
  const additionalOverlayInstancesRef = useRef({});
  const layoutEditModeRef = useRef(false);
  const overlayVisibleRef = useRef(false);
  const alignmentModeRef = useRef(DEFAULT_ALIGNMENT_STATE);
  const overlayCardRef = useRef(null);
  const overlayUndoStackRef = useRef([]);
  const [marqueeState, setMarqueeState] = useState(null);
  const [marqueeDragging, setMarqueeDragging] = useState(false);
  const [selectionToolActive, setSelectionToolActive] = useState(false);
  const overlayDragFrameRef = useRef(null);
  const overlayDragPatchRef = useRef(null);
  const groupDragFrameRef = useRef(null);
  const groupDragPatchRef = useRef(null);
  const anchoredGroupDragFrameRef = useRef(null);
  const anchoredGroupDragPatchRef = useRef(null);
  const [vertexDragState, setVertexDragState] = useState(null);
  const vertexDragFrameRef = useRef(null);
  const vertexDragPatchRef = useRef(null);
  const drawModeRef = useRef(null);
  const currentPolygonPointsRef = useRef([]);
  const drawOverlayRef = useRef(null);
  const drawPanFrameRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadViewerRuntime()
      .then((runtime) => {
        if (!active) return;
        viewerRuntimeRef.current = runtime;
        setViewerRuntimeReady(true);
      })
      .catch((error) => {
        console.error("No se pudo cargar el runtime 360 editor:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedImageId = selectedImg?.id_imagen
    ? String(selectedImg.id_imagen)
    : "";
  const selectedOverlayConfig = selectedImageId
    ? overlayLayouts[selectedImageId]
    : null;
  const deferredOverlayConfig = useDeferredValue(selectedOverlayConfig);
  const deferredGroupEdit = useDeferredValue(groupEdit);

  const existingDestinations = useMemo(() => {
    if (!selectedImg) return [];
    return imagenes.filter((img) => img.id_imagen !== selectedImg.id_imagen);
  }, [imagenes, selectedImg]);

  const conexionesActuales = useMemo(() => {
    if (!selectedImg) return [];
    return conexiones.filter((item) => item.origenId === selectedImg.id_imagen);
  }, [conexiones, selectedImg]);

  const currentImageAnnotations = useMemo(
    () => annotations.filter((a) => String(a.imageId) === String(selectedImageId)),
    [annotations, selectedImageId],
  );

  const importedOverlaySummary = useMemo(() => {
    if (!projectGeometry) return null;
    return {
      lotes: projectGeometry.lotes.length,
      vertices: projectGeometry.projectCount,
    };
  }, [projectGeometry]);

  const additionalInstanceCount = useMemo(
    () => (additionalOverlayInstances[selectedImageId] || []).length,
    [additionalOverlayInstances, selectedImageId],
  );

  const alignmentSnapCandidates = useMemo(
    () => createAlignmentSnapCandidates(projectGeometry),
    [projectGeometry],
  );

  // Pre-compute SVG path strings for all lots — only rebuilds when geometry changes
  const lotSvgPaths = useMemo(() => {
    if (!projectGeometry?.lotes) return {};
    return Object.fromEntries(
      projectGeometry.lotes.map((lote, i) => [
        getLoteKey(lote, i),
        lote.path || buildSvgPath(lote.points || []),
      ]),
    );
  }, [projectGeometry]);

  const hasValidCoords =
    Number.isFinite(coords?.yaw) && Number.isFinite(coords?.pitch);

  const resetPointMode = () => {
    setCoords(null);
    setNewPointName("");
    setNewPointFile(null);
    const markers = viewerInstance.current?.getPlugin(
      viewerRuntimeRef.current?.MarkersPlugin,
    );
    removeTempMarker(markers);
  };

  const saveAnnotation = () => {
    if (!coords || !annotationLabel.trim() || !selectedImg) return;
    setAnnotations((prev) => [
      ...prev,
      {
        id: `ann-${crypto.randomUUID()}`,
        imageId: selectedImg.id_imagen,
        yaw: coords.yaw,
        pitch: coords.pitch,
        label: annotationLabel.trim(),
        description: annotationDesc.trim(),
      },
    ]);
    setAnnotationLabel("");
    setAnnotationDesc("");
    resetPointMode();
    window.alertSuccess?.("Pin de anotación guardado.");
  };

  const removeAnnotation = (id) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleAnnotationMode = () => {
    setAnnotationMode((prev) => {
      if (!prev) resetPointMode();
      return !prev;
    });
  };

  const getDrawRelativePoint = (e) => {
    const el = drawOverlayRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleDrawClick = (e) => {
    if (drawModeRef.current !== "polygon") return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getDrawRelativePoint(e);
    if (!pt) return;
    const pts = currentPolygonPointsRef.current;
    if (pts.length >= 3) {
      const first = pts[0];
      if (Math.hypot(pt.x - first.x, pt.y - first.y) < 0.035) {
        closePolygon();
        return;
      }
    }
    const next = [...pts, pt];
    currentPolygonPointsRef.current = next;
    setCurrentPolygonPoints(next);
  };

  const handleDrawMouseMove = (e) => {
    if (drawModeRef.current !== "polygon") return;
    setPolygonCursorPos(getDrawRelativePoint(e));
  };

  const closePolygon = () => {
    const pts = currentPolygonPointsRef.current;
    if (pts.length < 3 || !selectedImageId) return;
    const scenario = getDrawingScenario(selectedDrawingScenario);

    // Anclar cada punto al panorama esférico para que sigan el movimiento del visor
    let sphericalPoints = null;
    const viewer = viewerInstance.current;
    const el = drawOverlayRef.current;
    if (viewer && el && el.clientWidth && el.clientHeight) {
      const sphs = pts.map((pt) => {
        try {
          const vp = { x: pt.x * el.clientWidth, y: pt.y * el.clientHeight };
          const sph = viewer.dataHelper.viewerCoordsToSphericalCoords(vp);
          if (!sph || !Number.isFinite(sph.yaw) || !Number.isFinite(sph.pitch)) return null;
          return { yaw: sph.yaw, pitch: sph.pitch };
        } catch {
          return null;
        }
      });
      if (sphs.every(Boolean)) sphericalPoints = sphs;
    }

    setUserDrawings((prev) => ({
      ...prev,
      [selectedImageId]: [
        ...(prev[selectedImageId] || []),
        {
          id: `draw-${crypto.randomUUID()}`,
          type: "polygon",
          points: [...pts],
          sphericalPoints,
          depth: 0,
          strokeWidth: 4,
          label: scenario.key === "area" ? drawingAreaName.trim() : scenario.label,
          scenarioKey: scenario.key,
          scenarioLabel: scenario.label,
          scenarioColor: drawingColor,
          showShadow: false,
        },
      ],
    }));
    currentPolygonPointsRef.current = [];
    setCurrentPolygonPoints([]);
    setPolygonCursorPos(null);
  };

  const undoLastPoint = () => {
    setCurrentPolygonPoints((prev) => {
      const next = prev.slice(0, -1);
      currentPolygonPointsRef.current = next;
      return next;
    });
  };

  const undoLastDrawing = () => {
    if (!selectedImageId) return;
    setUserDrawings((prev) => {
      const list = prev[selectedImageId] || [];
      if (!list.length) return prev;
      return { ...prev, [selectedImageId]: list.slice(0, -1) };
    });
  };

  const clearAllDrawings = () => {
    if (!selectedImageId) return;
    currentPolygonPointsRef.current = [];
    setCurrentPolygonPoints([]);
    setPolygonCursorPos(null);
    setUserDrawings((prev) => ({ ...prev, [selectedImageId]: [] }));
  };

  const setShapeDepth = (shapeId, depth) => {
    if (!selectedImageId) return;
    setUserDrawings((prev) => ({
      ...prev,
      [selectedImageId]: (prev[selectedImageId] || []).map((s) =>
        s.id === shapeId ? { ...s, depth } : s
      ),
    }));
  };

  const setShapeStroke = (shapeId, strokeWidth) => {
    if (!selectedImageId) return;
    setUserDrawings((prev) => ({
      ...prev,
      [selectedImageId]: (prev[selectedImageId] || []).map((s) =>
        s.id === shapeId ? { ...s, strokeWidth } : s
      ),
    }));
  };

  const setShapeLabel = (shapeId, label) => {
    if (!selectedImageId) return;
    setUserDrawings((prev) => ({
      ...prev,
      [selectedImageId]: (prev[selectedImageId] || []).map((s) =>
        s.id === shapeId ? { ...s, label } : s
      ),
    }));
  };

  const setShapeScenario = (shapeId, scenarioKey) => {
    if (!selectedImageId) return;
    const scenario = getDrawingScenario(scenarioKey);
    setUserDrawings((prev) => ({
      ...prev,
      [selectedImageId]: (prev[selectedImageId] || []).map((s) => {
        if (s.id !== shapeId) return s;
        const previousScenario = getDrawingScenario(s.scenarioKey);
        const usesAutomaticLabel =
          !s.label || s.label === s.scenarioLabel || s.label === previousScenario.label;
        return {
          ...s,
          scenarioKey: scenario.key,
          scenarioLabel: scenario.label,
          scenarioColor: scenario.color,
          label: usesAutomaticLabel ? scenario.label : s.label,
        };
      }),
    }));
  };

  const setShapeShadow = (shapeId, showShadow) => {
    if (!selectedImageId) return;
    setUserDrawings((prev) => ({
      ...prev,
      [selectedImageId]: (prev[selectedImageId] || []).map((s) =>
        s.id === shapeId ? { ...s, showShadow } : s
      ),
    }));
  };

  const setShapeColor = (shapeId, color) => {
    if (!selectedImageId) return;
    setUserDrawings((prev) => ({
      ...prev,
      [selectedImageId]: (prev[selectedImageId] || []).map((s) =>
        s.id === shapeId ? { ...s, scenarioColor: color } : s
      ),
    }));
  };

  const toP = (v) => `${(v * 100).toFixed(3)}%`;

  const projectSphToPx = ({ yaw, pitch }) => {
    const viewer = viewerInstance.current;
    if (!viewer) return null;
    try {
      const pt = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw, pitch });
      return (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) ? pt : null;
    } catch {
      return null;
    }
  };

  const drawSegment = (x1, y1, x2, y2, sw, shadowW, dash, key, color = "white") => (
    <g key={key}>
      <line x1={toP(x1)} y1={toP(y1)} x2={toP(x2)} y2={toP(y2)}
        stroke="rgba(0,0,0,0.65)" strokeWidth={shadowW}
        strokeDasharray={dash} strokeLinecap="round" />
      <line x1={toP(x1)} y1={toP(y1)} x2={toP(x2)} y2={toP(y2)}
        stroke={color} strokeWidth={sw}
        strokeDasharray={dash} strokeLinecap="round" />
    </g>
  );

  // Mismo estilo y misma matemática de proyección que el visor 360 público
  // (Viewer360ModalCasa.jsx), para que un trazo se vea idéntico en ambos lados.
  const renderCompletedShape = (shape) => {
    if (!shape.points || shape.points.length < 2) return null;
    let pts = shape.points;
    if (shape.sphericalPoints?.length >= 3) {
      const viewer = viewerInstance.current;
      const el = drawOverlayRef.current;
      if (viewer && el && el.clientWidth && el.clientHeight) {
        const camPos = viewer.getPosition();
        const camYaw = camPos?.yaw ?? 0;
        const camPitch = camPos?.pitch ?? 0;
        // Vector unitario de la dirección de cámara (esférico → cartesiano)
        const cx = Math.cos(camPitch) * Math.sin(camYaw);
        const cy = Math.sin(camPitch);
        const cz = Math.cos(camPitch) * Math.cos(camYaw);

        const projected = shape.sphericalPoints.map(({ yaw, pitch }) => {
          try {
            // Si el punto cae detrás de la cámara (producto punto <= 0), se descarta —
            // proyectarlo igual lo manda a una posición falsa (por eso aparecía "en el cielo").
            const px = Math.cos(pitch) * Math.sin(yaw);
            const py = Math.sin(pitch);
            const pz = Math.cos(pitch) * Math.cos(yaw);
            if (px * cx + py * cy + pz * cz <= 0.04) return null;

            const pos = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw, pitch });
            if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
            const nx = pos.x / el.clientWidth;
            const ny = pos.y / el.clientHeight;
            if (nx < -0.5 || nx > 1.5 || ny < -0.5 || ny > 1.5) return null;
            return { x: nx, y: ny };
          } catch { return null; }
        });
        const validPts = projected.filter(Boolean);
        if (validPts.length < 3) return null;
        pts = validPts;
      }
    }
    const depth = shape.depth || 0;
    const sw = shape.strokeWidth ?? 4;
    const shadowW = sw + 4;
    const scenario = getDrawingScenario(shape.scenarioKey);
    const ScenarioIcon = scenario.icon;
    const scenarioLabel =
      shape.label || shape.scenarioLabel || (shape.scenarioKey ? scenario.label : "");
    const displayScenarioLabel =
      scenarioLabel.length > 18
        ? `${scenarioLabel.slice(0, 17)}...`
        : scenarioLabel;
    const scenarioColor =
      shape.scenarioColor || (shape.scenarioKey ? scenario.color : "white");
    const dx = depth * 0.004;
    const dy = depth * 0.006;
    const n = pts.length;

    // Coordenadas en píxeles para sombra y etiqueta (polygon/text no soportan % en SVG)
    const el = drawOverlayRef.current;
    const w = el?.clientWidth || 1;
    const h = el?.clientHeight || 1;
    const pxPts = pts.map((p) => ({ x: p.x * w, y: p.y * h }));
    const lx = pxPts.reduce((s, p) => s + p.x, 0) / pxPts.length;
    const ly = pxPts.reduce((s, p) => s + p.y, 0) / pxPts.length;

    // Orientación del polígono: ángulo de la arista más larga
    let polyAngle = 0;
    { let maxLen = 0;
      for (let i = 0; i < pxPts.length; i++) {
        const a = pxPts[i]; const b = pxPts[(i + 1) % pxPts.length];
        const dx2 = b.x - a.x; const dy2 = b.y - a.y;
        const len = Math.hypot(dx2, dy2);
        if (len > maxLen) { maxLen = len; polyAngle = Math.atan2(dy2, dx2) * 180 / Math.PI; }
      }
    }
    // Dimensiones en el marco local rotado del polígono
    const rad = -polyAngle * Math.PI / 180;
    const cosA = Math.cos(rad); const sinA = Math.sin(rad);
    const local = pxPts.map(p => ({
      x: (p.x - lx) * cosA - (p.y - ly) * sinA,
      y: (p.x - lx) * sinA + (p.y - ly) * cosA,
    }));
    const localXs = local.map(p => p.x); const localYs = local.map(p => p.y);
    const localW = Math.max(...localXs) - Math.min(...localXs);
    const localH = Math.max(...localYs) - Math.min(...localYs);

    const courtIcon = renderCourtIcon(shape.scenarioKey, lx, ly, localW, localH, polyAngle);
    const hideLabel = shape.scenarioKey === "area" && !shape.label?.trim();
    const labelY = courtIcon ? ly - localH * 0.28 : ly;
    const hasLabelIcon = shape.scenarioKey !== "area";
    const pillW = Math.max(68, displayScenarioLabel.length * 8.5 + (hasLabelIcon ? 50 : 22));
    const pillH = 28;
    const pillHalf = pillW / 2;
    const labelIconX = -pillHalf + 9;
    const labelTextX = hasLabelIcon ? -pillHalf + 34 : 0;

    const pxPoints = pxPts.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <g key={shape.id}>
        {/* Sombra base solo cuando hay etiqueta visible */}
        {shape.showShadow && !hideLabel && (
          <polygon points={pxPoints} fill="rgba(0,0,0,0.22)" stroke="none" />
        )}
        {depth > 0 && pts.map((p, i) => {
          const next = pts[(i + 1) % n];
          const bx = p.x + dx; const by = p.y + dy;
          const bnx = next.x + dx; const bny = next.y + dy;
          return (
            <g key={`back-${i}`}>
              {drawSegment(bx, by, bnx, bny, sw - 1, shadowW - 1, undefined, `bl-${i}`, scenarioColor)}
              {drawSegment(p.x, p.y, bx, by, Math.max(1, sw - 2), shadowW - 2, "5 3", `ed-${i}`, scenarioColor)}
            </g>
          );
        })}
        {/* Halo exterior solo cuando hay etiqueta — evita "sombra" en trazos sin nombre */}
        {!hideLabel && (
          <polygon
            points={pxPoints}
            fill="none"
            stroke={scenarioColor}
            strokeWidth={sw + 14}
            strokeOpacity="0.09"
            strokeLinejoin="round"
          />
        )}
        {/* Relleno principal */}
        <polygon
          points={pxPoints}
          fill={scenarioColor}
          fillOpacity={hideLabel ? "0.13" : "0.20"}
          stroke={scenarioColor}
          strokeWidth={hideLabel ? sw + 1 : sw + 4}
          strokeLinejoin="round"
          strokeOpacity={hideLabel ? "0.70" : "0.88"}
        />
        {/* Borde interior blanco — da crisp y profundidad */}
        <polygon
          points={pxPoints}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={sw * 0.32}
          strokeLinejoin="round"
        />
        {courtIcon}
        {!hideLabel && scenarioLabel && (
          <g transform={`translate(${lx}, ${labelY})`}>
            {/* Sombra suave detrás de la pastilla */}
            <rect
              x={-pillHalf + 2} y={-pillH / 2 + 3}
              width={pillW} height={pillH}
              rx={pillH / 2} ry={pillH / 2}
              fill="rgba(0,0,0,0.30)"
            />
            {/* Pastilla principal */}
            <rect
              x={-pillHalf} y={-pillH / 2}
              width={pillW} height={pillH}
              rx={pillH / 2} ry={pillH / 2}
              fill="rgba(10,14,26,0.78)"
              stroke={scenarioColor}
              strokeWidth="1.5"
              strokeOpacity="0.70"
            />
            {hasLabelIcon && (
              <ScenarioIcon
                x={labelIconX} y={-10}
                width={20} height={20}
                color={scenarioColor}
                strokeWidth={2.2}
              />
            )}
            <text
              x={labelTextX}
              y={1}
              textAnchor={hasLabelIcon ? "start" : "middle"}
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="700"
              fill="white"
              letterSpacing="0.5"
            >
              {displayScenarioLabel}
            </text>
          </g>
        )}
      </g>
    );
  };

  const renderInProgressPolygon = (pts, cursorPos) => {
    if (!pts.length) return null;
    const isNearFirst =
      cursorPos &&
      pts.length >= 3 &&
      Math.hypot(cursorPos.x - pts[0].x, cursorPos.y - pts[0].y) < 0.035;
    const last = pts[pts.length - 1];
    return (
      <g>
        {pts.slice(0, -1).map((p, i) =>
          drawSegment(p.x, p.y, pts[i + 1].x, pts[i + 1].y, 2.5, 5, "8 5", `seg-${i}`)
        )}
        {cursorPos && drawSegment(last.x, last.y, cursorPos.x, cursorPos.y, 1.5, 3.5, "5 4", "preview")}
        {isNearFirst && drawSegment(cursorPos.x, cursorPos.y, pts[0].x, pts[0].y, 2, 3.5, "4 3", "close-preview")}
        {pts.map((p, i) => (
          <circle key={i} cx={toP(p.x)} cy={toP(p.y)}
            r={i === 0 && isNearFirst ? 10 : 7}
            fill={i === 0 ? (isNearFirst ? "rgba(80,230,120,0.95)" : "white") : "white"}
            stroke={i === 0 ? (isNearFirst ? "rgba(0,130,60,0.9)" : "rgba(0,0,0,0.65)") : "rgba(0,0,0,0.65)"}
            strokeWidth="2.5" />
        ))}
      </g>
    );
  };

  const renderDrawingOverlay = () => {
    const imgDrawings = (selectedImageId && userDrawings[selectedImageId]) || [];
    if (!drawMode && !imgDrawings.length && !currentPolygonPoints.length) return null;
    const isActive = drawMode === "polygon";
    return (
      <div
        ref={drawOverlayRef}
        className={styles.drawingOverlayLayer}
        style={{
          cursor: isActive ? "crosshair" : "default",
          pointerEvents: isActive ? "all" : "none",
        }}
        onClick={isActive ? handleDrawClick : undefined}
        onMouseMove={isActive ? handleDrawMouseMove : undefined}
        onMouseLeave={isActive ? () => setPolygonCursorPos(null) : undefined}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {imgDrawings.map((shape) => renderCompletedShape(shape))}
          {isActive && renderInProgressPolygon(currentPolygonPoints, polygonCursorPos)}
        </svg>
      </div>
    );
  };

  const renderHotspots = () => {
    const viewer = viewerInstance.current;
    if (!viewer || !selectedImg) return;

    const markers = viewer.getPlugin(viewerRuntimeRef.current?.MarkersPlugin);
    markers.clearMarkers();

    const storedAnchoredOverlay =
      anchoredOverlaysRef.current[String(selectedImg.id_imagen)] ||
      anchoredOverlays[String(selectedImg.id_imagen)] ||
      null;
    const overlayConfig =
      selectedOverlayConfigRef.current || selectedOverlayConfig;
    const overlayIsExplicitlyHidden = overlayConfig?.visible === false;

    // anchoredEditMode ("ajuste fino sobre el tour"): los lotes ya están anclados a
    // la foto y se editan en vivo, así que tratamos esto igual que el modo no-edición
    // a efectos de qué representación usar (anclada a la esfera, no la tarjeta flotante).
    const isAnchoredRenderMode =
      !layoutEditModeRef.current || anchoredEditModeRef.current;

    // En modo no-edición usar la snapshot almacenada (coordenadas esféricas ya fijas).
    // Sólo actualizar campos visuales del config actual para evitar re-proyección
    // incorrecta cuando el visor se mueve (p.ej. por doble clic en Conexión/Anotar).
    // En anchoredEditMode siempre se reconstruye para reflejar ajustes recién confirmados.
    let anchoredPreview;
    if (overlayIsExplicitlyHidden) {
      anchoredPreview = null;
    } else if (isAnchoredRenderMode && overlayConfig?.visible) {
      if (storedAnchoredOverlay && !anchoredEditModeRef.current) {
        const globalTexture = overlayConfig.textureMode ?? "solid";
        anchoredPreview = {
          ...storedAnchoredOverlay,
          textureMode: globalTexture,
          lotOpacity: overlayConfig.lotOpacity,
          lotPolygons: (storedAnchoredOverlay.lotPolygons || []).map((lote) => {
            const override =
              overlayConfig.lotOverrides?.[String(lote.idlote ?? "")] ?? {};
            return {
              ...lote,
              textureMode: override.textureMode ?? globalTexture,
            };
          }),
        };
      } else {
        const built = buildAnchoredOverlaySnapshot(
          selectedImg.id_imagen,
          overlayConfig,
        );
        // Cachear en el ref para que llamadas posteriores no re-proyecten con pan diferente
        if (built) {
          anchoredOverlaysRef.current = {
            ...anchoredOverlaysRef.current,
            [String(selectedImg.id_imagen)]: built,
          };
        }
        anchoredPreview = built;
      }
    } else {
      anchoredPreview = storedAnchoredOverlay;
    }

    if (anchoredPreview?.visible && isAnchoredRenderMode) {
      if (
        anchoredPreview.showProjectOutline !== false &&
        ((Array.isArray(anchoredPreview.projectPolygon) &&
          anchoredPreview.projectPolygon.length >= 3) ||
          (Array.isArray(anchoredPreview.projectPolygonPixels) &&
            anchoredPreview.projectPolygonPixels.length >= 3))
      ) {
        const hasProjectSpherical =
          Array.isArray(anchoredPreview.projectPolygon) &&
          anchoredPreview.projectPolygon.length >= 3;
        markers.addMarker({
          id: `overlay-project-${selectedImg.id_imagen}`,
          ...(hasProjectSpherical
            ? { polygon: anchoredPreview.projectPolygon }
            : { polygonPixels: anchoredPreview.projectPolygonPixels }),
          svgStyle: {
            fill: "rgba(34, 197, 94, 0.06)",
            stroke: "rgba(74, 222, 128, 0.78)",
            strokeWidth: "3.5px",
            strokeDasharray: "12 7",
            strokeLinejoin: "round",
            strokeOpacity: "0.85",
          },
          zIndex: 5,
        });
      }

      (anchoredPreview.lotPolygons || []).forEach((lote, index) => {
        const loteId = String(lote.idlote ?? "");
        // En modo zoom, los lotes seleccionados se muestran en la capa interactiva
        // propia (con su transformación en vivo), no acá, para no duplicarlos.
        if (anchoredEditModeRef.current && selectedLotIdsRef.current.has(loteId))
          return;

        const hasSpherical =
          Array.isArray(lote.polygon) && lote.polygon.length >= 3;
        const hasPixels =
          Array.isArray(lote.polygonPixels) && lote.polygonPixels.length >= 3;
        if (!hasSpherical && !hasPixels) return;
        const markerKey = lote.idlote ?? lote.nombre ?? index;

        const lotTMode = lote.textureMode ?? anchoredPreview.textureMode ?? "solid";
        let lotFill, lotFillOpacity;
        if (lotTMode === "outline") {
          lotFill = "none";
          lotFillOpacity = "1";
        } else if (lotTMode === "transparent") {
          lotFill = lote.color || "#22c55e";
          lotFillOpacity = "0.35";
        } else {
          lotFill = lote.color || "#22c55e";
          lotFillOpacity = String(anchoredPreview.lotOpacity ?? 0.82);
        }

        markers.addMarker({
          id: `overlay-lote-${selectedImg.id_imagen}-${markerKey}-${index}`,
          ...(hasSpherical
            ? { polygon: lote.polygon }
            : { polygonPixels: lote.polygonPixels }),
          svgStyle: {
            fill: lotFill,
            fillOpacity: lotFillOpacity,
            stroke: "rgba(255,255,255,0.75)",
            strokeWidth: "0.8px",
            strokeLinejoin: "round",
            cursor: anchoredEditModeRef.current ? "pointer" : undefined,
          },
          data: anchoredEditModeRef.current ? { type: "lot", loteId } : undefined,
          zIndex: 6,
        });
      });
    }

    // Render additional overlay instances (committed from previous imports on this image).
    // These ignore the live overlay's edit mode — they're permanently fixed — but each
    // instance has its own `visible` flag so a specific stray/duplicate one can be
    // hidden without touching the others or the live overlay.
    {
      const additionalInstances =
        additionalOverlayInstancesRef.current[String(selectedImg.id_imagen)] || [];
      const seenInstanceIds = new Set();
      const uniqueAdditionalInstances = additionalInstances.filter((inst, idx) => {
        const id = inst?.instanceId ?? idx;
        if (seenInstanceIds.has(id)) return false;
        seenInstanceIds.add(id);
        return true;
      });
      uniqueAdditionalInstances.forEach((instance, instanceIdx) => {
        if (!instance || !hasAnchoredGeometry(instance)) return;
        if (instance.visible === false) return;
        const instId = instance.instanceId || instanceIdx;

        if (
          instance.showProjectOutline !== false &&
          ((Array.isArray(instance.projectPolygon) && instance.projectPolygon.length >= 3) ||
            (Array.isArray(instance.projectPolygonPixels) && instance.projectPolygonPixels.length >= 3))
        ) {
          const hasSph = Array.isArray(instance.projectPolygon) && instance.projectPolygon.length >= 3;
          markers.addMarker({
            id: `overlay-project-extra-${selectedImg.id_imagen}-${instId}`,
            ...(hasSph ? { polygon: instance.projectPolygon } : { polygonPixels: instance.projectPolygonPixels }),
            svgStyle: {
              fill: "rgba(34, 197, 94, 0.06)",
              stroke: "rgba(74, 222, 128, 0.78)",
              strokeWidth: "3.5px",
              strokeDasharray: "12 7",
              strokeLinejoin: "round",
              strokeOpacity: "0.85",
            },
            zIndex: 5,
          });
        }

        (instance.lotPolygons || []).forEach((lote, lotIdx) => {
          const hasSph = Array.isArray(lote.polygon) && lote.polygon.length >= 3;
          const hasPx = Array.isArray(lote.polygonPixels) && lote.polygonPixels.length >= 3;
          if (!hasSph && !hasPx) return;
          const mKey = lote.idlote ?? lote.nombre ?? lotIdx;
          const tMode = lote.textureMode ?? instance.textureMode ?? "solid";
          const lotFill = tMode === "outline" ? "none" : (lote.color || "#22c55e");
          const lotOpacity =
            tMode === "outline" ? "1" : tMode === "transparent" ? "0.35" : String(instance.lotOpacity ?? 0.82);
          markers.addMarker({
            id: `overlay-lote-extra-${selectedImg.id_imagen}-${instId}-${mKey}-${lotIdx}`,
            ...(hasSph ? { polygon: lote.polygon } : { polygonPixels: lote.polygonPixels }),
            svgStyle: {
              fill: lotFill,
              fillOpacity: lotOpacity,
              stroke: "rgba(255,255,255,0.75)",
              strokeWidth: "0.8px",
              strokeLinejoin: "round",
            },
            zIndex: 6,
          });
        });
      });
    }

    conexionesActuales.forEach((hotspot) => {
      markers.addMarker({
        id: hotspot.id,
        image: HOTSPOT_MARKER_ICON,
        size: MARKER_SIZE,
        anchor: "center center",
        position: makeMarkerPosition(hotspot.yaw, hotspot.pitch),
        tooltip: hotspot.destinoNombre || "Ir",
        data: { destinoId: hotspot.destinoId },
      });
    });

    annotationsRef.current
      .filter((ann) => String(ann.imageId) === String(selectedImg?.id_imagen))
      .forEach((ann) => {
        const safeLabel = String(ann.label ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeDesc = ann.description ? String(ann.description).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
        markers.addMarker({
          id: `ann-${ann.id}`,
          html: `<div class="gh-local-ann-marker"><div class="gh-local-ann-hbar"><span class="gh-local-ann-label">${safeLabel}</span></div><div class="gh-local-ann-vline"></div></div>`,
          size: { width: 180, height: 37 },
          anchor: "bottom center",
          position: makeMarkerPosition(ann.yaw, ann.pitch),
          tooltip: safeDesc ? `<strong>${safeLabel}</strong><br><span style="font-size:0.84em;opacity:0.82">${safeDesc}</span>` : undefined,
          data: { type: "annotation", annotationId: ann.id },
        });
      });

    if (hasValidCoords) {
      markers.addMarker({
        id: "temp",
        image: TEMP_MARKER_ICON,
        size: MARKER_SIZE,
        anchor: "center center",
        position: makeMarkerPosition(coords.yaw, coords.pitch),
        tooltip: "Nuevo punto",
      });
    }
  };

  // Guarda un punto de restauración (config del overlay + instancias fijas/ancladas)
  // antes de cualquier cambio que el usuario pueda querer deshacer con Ctrl+Z.
  const pushOverlayUndoSnapshot = (imageId = selectedImageId) => {
    if (!imageId) return;
    overlayUndoStackRef.current = [
      ...overlayUndoStackRef.current.slice(-49),
      {
        imageId,
        config: overlayLayoutsRef.current[imageId] || DEFAULT_LAYOUT_CONFIG,
        additionalInstances: additionalOverlayInstancesRef.current[imageId] || [],
      },
    ];
  };

  const updateSelectedOverlayConfig = (patch) => {
    if (!selectedImageId) return;

    pushOverlayUndoSnapshot(selectedImageId);
    const prevConfig = overlayLayoutsRef.current[selectedImageId] || DEFAULT_LAYOUT_CONFIG;
    const nextConfig = { ...prevConfig, ...patch };
    const nextLayouts = {
      ...overlayLayoutsRef.current,
      [selectedImageId]: nextConfig,
    };
    overlayLayoutsRef.current = nextLayouts;
    selectedOverlayConfigRef.current = nextConfig;

    React.startTransition(() => {
      setOverlayLayouts(nextLayouts);
    });

    // Re-renderizar marcadores PSV inmediatamente si el visor está listo y no estamos en edición
    if (viewerReady && !layoutEditModeRef.current && viewerInstance.current) {
      renderHotspots();
    }
  };

  const undoOverlayConfig = () => {
    const entry = overlayUndoStackRef.current.pop();
    if (!entry) return;
    const nextLayouts = { ...overlayLayoutsRef.current, [entry.imageId]: entry.config };
    overlayLayoutsRef.current = nextLayouts;
    selectedOverlayConfigRef.current = entry.config;
    setOverlayLayouts(nextLayouts);

    const nextAdditional = {
      ...additionalOverlayInstancesRef.current,
      [entry.imageId]: entry.additionalInstances || [],
    };
    additionalOverlayInstancesRef.current = nextAdditional;
    setAdditionalOverlayInstances(nextAdditional);

    if (viewerInstance.current) renderHotspots();
  };

  const getCurrentOverlayRuntime = () => {
    const viewer = viewerInstance.current;
    const viewerElement = viewerRef.current;
    if (!viewer || !viewerElement) return null;

    const position = viewer.getPosition?.();
    const zoomLevel = viewer.getZoomLevel?.();
    const overlaySvg = overlaySvgRef.current;

    return {
      yaw: Number(position?.yaw),
      pitch: Number(position?.pitch),
      zoomLevel: Number(zoomLevel),
      viewerWidth: Number(viewerElement.clientWidth || 0),
      viewerHeight: Number(viewerElement.clientHeight || 0),
      overlayWidth: Number(
        overlaySvg?.clientWidth ||
          overlaySvg?.viewBox?.baseVal?.width ||
          OVERLAY_VIEWBOX.width,
      ),
      overlayHeight: Number(
        overlaySvg?.clientHeight ||
          overlaySvg?.viewBox?.baseVal?.height ||
          OVERLAY_VIEWBOX.height,
      ),
      overlayOffsetX: Number(overlaySvg?.offsetLeft || 0),
      overlayOffsetY: getSvgTopOffsetInParent(overlaySvg),
    };
  };

  const getCurrentScreenOverlaySnapshot = (
    config = selectedOverlayConfigRef.current || selectedOverlayConfig,
    runtime = getCurrentOverlayRuntime(),
  ) => {
    if (!config?.visible || !projectGeometry || !runtime) return null;

    const svgWidth = Number(runtime.overlayWidth) || OVERLAY_VIEWBOX.width;
    const svgHeight = Number(runtime.overlayHeight) || OVERLAY_VIEWBOX.height;
    const offsetX = Number(runtime.overlayOffsetX) || 0;
    const offsetY = Number(runtime.overlayOffsetY) || 0;
    // CSS perspective-origin por defecto = centro del viewer (50% 50%)
    const vw = Number(runtime.viewerWidth) || 0;
    const vh = Number(runtime.viewerHeight) || 0;
    const perspOrig = vw > 0 && vh > 0 ? { x: vw / 2, y: vh / 2 } : null;

    const convertPoint = (point, transformConfig = config) => {
      const localPoint = {
        x: offsetX + (point.x / OVERLAY_VIEWBOX.width) * svgWidth,
        y: offsetY + (point.y / OVERLAY_VIEWBOX.height) * svgHeight,
      };
      const viewerPoint = transformOverlayPoint(
        localPoint,
        transformConfig,
        1,
        1,
        perspOrig,
      );

      if (!Number.isFinite(viewerPoint.x) || !Number.isFinite(viewerPoint.y))
        return null;
      return [viewerPoint.x, viewerPoint.y];
    };

    const projectPolygonPoints = (projectGeometry.projectPoints || [])
      .map(convertPoint)
      .filter(isValidTexturePoint);

    const lotPolygons = (projectGeometry.lotes || [])
      .map((lote, loteIndex) => {
        const loteId = getLoteKey(lote, loteIndex);
        const override = config.lotOverrides?.[loteId] ?? {};
        const pts = override.committedPoints?.length
          ? override.committedPoints
          : lote.points || [];
        return {
          idlote: lote.idlote,
          color: lote.color,
          vendido: lote.vendido,
          textureMode: override.textureMode ?? config.textureMode ?? "solid",
          polygonPoints: pts
            .map((point) => convertPoint(point, config))
            .filter(isValidTexturePoint),
        };
      })
      .filter((lote) => lote.polygonPoints.length >= 3);

    if (projectPolygonPoints.length < 3 && !lotPolygons.length) return null;

    return {
      visible: true,
      lotOpacity: config.lotOpacity,
      showProjectOutline: config.showProjectOutline !== false,
      viewerWidth: Number(runtime.viewerWidth) || 0,
      viewerHeight: Number(runtime.viewerHeight) || 0,
      projectPolygonPoints,
      lotPolygons,
    };
  };

  const captureCurrentLayoutRuntime = (imageId = selectedImageId) => {
    if (!imageId) return null;

    const runtime = getCurrentOverlayRuntime();
    if (!runtime) return null;
    const currentConfig =
      selectedOverlayConfigRef.current || selectedOverlayConfig;
    const screenOverlay = getCurrentScreenOverlaySnapshot(
      currentConfig,
      runtime,
    );
    const nextConfig = {
      ...(overlayLayoutsRef.current[String(imageId)] || DEFAULT_LAYOUT_CONFIG),
      ...runtime,
      ...(screenOverlay ? { screenOverlay } : {}),
    };
    const nextLayouts = {
      ...overlayLayoutsRef.current,
      [String(imageId)]: nextConfig,
    };
    overlayLayoutsRef.current = nextLayouts;
    if (String(imageId) === selectedImageId) {
      selectedOverlayConfigRef.current = nextConfig;
    }

    setOverlayLayouts(nextLayouts);

    return {
      ...runtime,
      ...(screenOverlay ? { screenOverlay } : {}),
    };
  };

  // Convierte un punto en espacio del plano 2D (OVERLAY_VIEWBOX) a su posición
  // esférica anclada a la foto actual, usando la transformación CSS vigente
  // (x/y/escala/rotación/etc). Es la versión reutilizable de la conversión que usa
  // buildAnchoredOverlaySnapshot, para poder calcular un punto suelto (p.ej. al
  // confirmar un ajuste esférico) sin tener que reconstruir todo el snapshot.
  const convertOverlayLayoutPointToAnchored = (
    point,
    config = selectedOverlayConfigRef.current || selectedOverlayConfig,
  ) => {
    const viewer = viewerInstance.current;
    const viewerElement = viewerRef.current;
    const overlaySvg = overlaySvgRef.current;
    if (!viewer || !viewerElement || !overlaySvg) return null;

    const svgLayoutWidth =
      overlaySvg.clientWidth ||
      overlaySvg.viewBox?.baseVal?.width ||
      OVERLAY_VIEWBOX.width;
    const svgLayoutHeight =
      overlaySvg.clientHeight ||
      overlaySvg.viewBox?.baseVal?.height ||
      OVERLAY_VIEWBOX.height;
    const svgOffsetX = overlaySvg.offsetLeft || 0;
    const svgOffsetY = getSvgTopOffsetInParent(overlaySvg);
    if (!svgLayoutWidth || !svgLayoutHeight) return null;

    const layoutPerspOrig =
      viewerElement.clientWidth > 0
        ? { x: viewerElement.clientWidth / 2, y: viewerElement.clientHeight / 2 }
        : null;
    const localPoint = {
      x: svgOffsetX + (point.x / OVERLAY_VIEWBOX.width) * svgLayoutWidth,
      y: svgOffsetY + (point.y / OVERLAY_VIEWBOX.height) * svgLayoutHeight,
    };
    const viewerPoint = transformOverlayPoint(localPoint, config, 1, 1, layoutPerspOrig);
    if (!Number.isFinite(viewerPoint.x) || !Number.isFinite(viewerPoint.y))
      return null;
    return projectViewerPointToAnchoredPoint(viewer, viewerPoint, {
      allowOutOfViewport: true,
    });
  };

  const buildAnchoredOverlaySnapshot = (
    imageId = selectedImageId,
    config = selectedOverlayConfigRef.current || selectedOverlayConfig,
  ) => {
    const viewer = viewerInstance.current;
    const viewerElement = viewerRef.current;
    const overlaySvg = overlaySvgRef.current;
    if (
      !viewer ||
      !viewerElement ||
      !overlaySvg ||
      !projectGeometry ||
      !config?.visible ||
      !imageId
    ) {
      return anchoredOverlays[String(imageId)] || null;
    }

    const viewerRect = viewerElement.getBoundingClientRect();
    const svgLayoutWidth =
      overlaySvg.clientWidth ||
      overlaySvg.viewBox?.baseVal?.width ||
      OVERLAY_VIEWBOX.width;
    const svgLayoutHeight =
      overlaySvg.clientHeight ||
      overlaySvg.viewBox?.baseVal?.height ||
      OVERLAY_VIEWBOX.height;
    const svgOffsetX = overlaySvg.offsetLeft || 0;
    const svgOffsetY = getSvgTopOffsetInParent(overlaySvg);

    if (
      !svgLayoutWidth ||
      !svgLayoutHeight ||
      !viewerRect.width ||
      !viewerRect.height
    ) {
      return anchoredOverlays[String(imageId)] || null;
    }

    const buildSnapshotFromConverter = (convertPoint) => {
      const isAnchoredMode = anchoredEditModeRef.current;
      // En modo zoom la cámara se mueve libre, así que NUNCA hay que re-derivar una
      // posición ya anclada a partir de píxeles del visor (eso depende de hacia dónde
      // esté mirando la cámara en ESE momento, y haría "saltar" todo lo que no se
      // tocó manualmente). El snapshot ya guardado (caché o el que vino del backend)
      // es la fuente de verdad para todo lo que no se ajustó en esta sesión.
      const cachedSnapshot = isAnchoredMode
        ? anchoredOverlaysRef.current[String(imageId)] ||
          anchoredOverlays[String(imageId)] ||
          null
        : null;

      let projectPolygon, projectPolygonPixels;
      if (cachedSnapshot?.projectPolygon?.length >= 3) {
        projectPolygon = cachedSnapshot.projectPolygon;
        projectPolygonPixels = cachedSnapshot.projectPolygonPixels?.length >= 3
          ? cachedSnapshot.projectPolygonPixels
          : [];
      } else {
        const projectAnchoredPoints = (projectGeometry.projectPoints || [])
          .map(convertPoint)
          .filter((point) => point?.spherical);
        projectPolygon = projectAnchoredPoints
          .map((point) => point.spherical)
          .filter(isValidSphericalPoint);
        projectPolygonPixels = projectAnchoredPoints
          .map((point) => point.pixels)
          .filter(isValidTexturePoint);
      }

      const lotOverrides = config?.lotOverrides ?? {};
      const activeGroupEdit = groupEditRef.current;
      const activeSelectedIds = selectedLotIdsRef.current;
      const baseOverrides = groupEditBaseRef.current;
      const activeSphericalGroupEdit = sphericalGroupEditRef.current;
      const groupCentroid =
        !isAnchoredMode && activeSelectedIds.size > 0
          ? computeGroupCentroid(
              projectGeometry.lotes,
              activeSelectedIds,
              baseOverrides,
            )
          : null;

      // Posición esférica "base" de un lote: sus puntos ya confirmados en esta
      // sesión de modo zoom si los tiene; si no, los del snapshot ya anclado
      // (caché/backend); y sólo como último recurso (lote nunca anclado todavía)
      // los derivados de su posición en el plano 2D, que sí depende de la cámara.
      const getLoteBaseSpherical = (lote, override, loteId) => {
        if (override.committedSphericalPoints?.length >= 3) {
          return override.committedSphericalPoints.map(([yaw, pitch]) => ({
            yaw,
            pitch,
          }));
        }
        const cachedLote = cachedSnapshot?.lotPolygons?.find(
          (l) => String(l.idlote ?? "") === loteId,
        );
        if (cachedLote?.polygon?.length >= 3) {
          return cachedLote.polygon.map(([yaw, pitch]) => ({ yaw, pitch }));
        }
        return applyLotSvgTransform(lote.points || [], override)
          .map(convertPoint)
          .filter((point) => point?.spherical)
          .map((point) => ({ yaw: point.spherical[0], pitch: point.spherical[1] }));
      };

      let sphericalGroupCentroid = null;
      if (isAnchoredMode && activeSelectedIds.size > 0) {
        const allBasePoints = [];
        projectGeometry.lotes.forEach((lote, loteIndex) => {
          const loteId = getLoteKey(lote, loteIndex);
          if (!activeSelectedIds.has(loteId)) return;
          const override = baseOverrides[loteId] ?? {};
          allBasePoints.push(...getLoteBaseSpherical(lote, override, loteId));
        });
        sphericalGroupCentroid = getSphericalCentroid(allBasePoints);
      }

      const lotPolygons = projectGeometry.lotes
        .map((lote, loteIndex) => {
          const loteId = getLoteKey(lote, loteIndex);
          const isSelected = activeSelectedIds.has(loteId);
          const override = loteId
            ? isSelected
              ? (baseOverrides[loteId] ?? {})
              : (lotOverrides[loteId] ?? {})
            : {};
          if (override.visible === false || override.anchoredFixed) return null;

          let anchoredPoints;

          if (isAnchoredMode) {
            // Modo "ajuste fino sobre el tour": el lote ya está anclado a la foto;
            // el ajuste (si lo hay) se aplica sobre coordenadas esféricas, no sobre
            // el plano 2D — así el resultado no depende del zoom/posición actual de
            // la cámara.
            let basePts = getLoteBaseSpherical(lote, override, loteId);
            if (isSelected && sphericalGroupCentroid) {
              basePts = applySphericalGroupTransform(
                basePts,
                sphericalGroupCentroid.yaw,
                sphericalGroupCentroid.pitch,
                activeSphericalGroupEdit,
              );
            }
            anchoredPoints = basePts
              .map((point) => sphericalPointToAnchoredPoint(viewer, point))
              .filter((point) => point?.spherical);
          } else {
            let transformedPoints = applyLotSvgTransform(
              lote.points || [],
              override,
            );
            if (isSelected && groupCentroid) {
              transformedPoints = applyGroupTransformWithTiltToPoints(
                transformedPoints,
                groupCentroid.cx,
                groupCentroid.cy,
                activeGroupEdit,
              );
            }
            anchoredPoints = transformedPoints
              .map(convertPoint)
              .filter((point) => point?.spherical);
          }

          const activeEdit = isAnchoredMode
            ? activeSphericalGroupEdit
            : activeGroupEdit;

          return {
            idlote: getLoteId(lote),
            nombre: lote.nombre,
            precio: lote.precio,
            moneda: lote.moneda,
            area_total_m2: lote.area_total_m2,
            ancho: lote.ancho,
            largo: lote.largo,
            color: lote.color,
            vendido: lote.vendido,
            textureMode: isSelected
              ? (activeEdit.textureMode ??
                override.textureMode ??
                config.textureMode ??
                "solid")
              : (override.textureMode ?? config.textureMode ?? "solid"),
            lotOpacity: isSelected
              ? (activeEdit.opacity ??
                override.opacity ??
                config.lotOpacity)
              : (override.opacity ?? config.lotOpacity),
            polygon: anchoredPoints
              .map((point) => point.spherical)
              .filter(isValidSphericalPoint),
            polygonPixels: anchoredPoints
              .map((point) => point.pixels)
              .filter(isValidTexturePoint),
          };
        })
        .filter(Boolean)
        .filter(
          (lote) => lote.polygon.length >= 3 || lote.polygonPixels.length >= 3,
        );

      return {
        imageId: String(imageId),
        visible: config.visible !== false,
        lotOpacity: config.lotOpacity,
        showProjectOutline: config.showProjectOutline !== false,
        textureMode: config.textureMode ?? "solid",
        showShadow: config.showShadow !== false,
        projectPolygon: projectPolygon.length >= 3 ? projectPolygon : [],
        projectPolygonPixels:
          projectPolygonPixels.length >= 3 ? projectPolygonPixels : [],
        lotPolygons,
      };
    };

    const layoutPerspOrig =
      viewerElement.clientWidth > 0
        ? {
            x: viewerElement.clientWidth / 2,
            y: viewerElement.clientHeight / 2,
          }
        : null;
    const convertPointFromLayout = (point) => {
      const localPoint = {
        x: svgOffsetX + (point.x / OVERLAY_VIEWBOX.width) * svgLayoutWidth,
        y: svgOffsetY + (point.y / OVERLAY_VIEWBOX.height) * svgLayoutHeight,
      };
      const viewerPoint = transformOverlayPoint(
        localPoint,
        config,
        1,
        1,
        layoutPerspOrig,
      );

      if (!Number.isFinite(viewerPoint.x) || !Number.isFinite(viewerPoint.y))
        return null;
      return projectViewerPointToAnchoredPoint(viewer, viewerPoint, {
        allowOutOfViewport: true,
      });
    };

    const layoutSnapshot = buildSnapshotFromConverter(convertPointFromLayout);
    return layoutSnapshot;
  };

  const snapshotOverlayForImage = (
    imageId = selectedImageId,
    config = selectedOverlayConfigRef.current || selectedOverlayConfig,
  ) => {
    const snapshot = buildAnchoredOverlaySnapshot(imageId, config);
    if (!snapshot) return null;

    anchoredOverlaysRef.current = {
      ...anchoredOverlaysRef.current,
      [String(imageId)]: snapshot,
    };
    setAnchoredOverlays((prev) => ({
      ...prev,
      [String(imageId)]: snapshot,
    }));

    return snapshot;
  };

  const persistCurrentOverlayPosition = () => {
    const currentConfig =
      selectedOverlayConfigRef.current || selectedOverlayConfig;
    if (!currentConfig?.visible) return null;
    captureCurrentLayoutRuntime();
    // When a valid snapshot already exists, return it as-is.
    // Rebuilding here would re-project the 2D overlay through the CURRENT camera
    // position, which may differ from when the user positioned the lots, corrupting
    // the stored spherical coordinates.
    // Callers that want a fresh re-projection (e.g. intentional exit from edit mode)
    // must delete anchoredOverlaysRef.current[imageId] before calling this function.
    const existing = anchoredOverlaysRef.current[String(selectedImageId)];
    if (existing && hasAnchoredGeometry(existing)) return existing;
    return snapshotOverlayForImage(selectedImageId);
  };

  const handleSelectImage = (img) => {
    commitPendingGroupEditIfAny();
    persistCurrentOverlayPosition();
    setSelectedImg(img);
  };

  const load2DGeometry = async (forceReload = false, { silent = false } = {}) => {
    if (!forceReload && hasRenderableGeometry(projectGeometry)) {
      const hydrated = hydrateStoredGeometry(projectGeometry);
      if (hydrated !== projectGeometry) setProjectGeometry(hydrated);
      return hydrated;
    }
    if (!forceReload && geometryLoading) return hydrateStoredGeometry(projectGeometry);

    setGeometryLoading(true);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const fetchOpts = { headers, cache: "no-store" };

    try {
      const projectRequest = authFetch(
        withApiBase(
          `https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`,
        ),
        fetchOpts,
      );

      const lotesRequest = authFetch(
        withApiBase(
          `https://api.geohabita.com/api/listPuntosLoteProyecto/${idproyecto}/`,
        ),
        fetchOpts,
      );

      const [projectRes, lotesRes] = await Promise.allSettled([
        projectRequest,
        lotesRequest,
      ]);

      const projectResponse =
        projectRes.status === "fulfilled" ? projectRes.value : null;
      const lotesResponse =
        lotesRes.status === "fulfilled" ? lotesRes.value : null;

      const projectData = projectResponse?.ok
        ? await projectResponse.json().catch(() => [])
        : [];

      let lotesData = [];

      if (lotesResponse?.ok) {
        lotesData = await lotesResponse.json().catch(() => []);
      } else {
        const fallback = await authFetch(
          withApiBase(
            `https://api.geohabita.com/api/getLoteProyecto/${idproyecto}`,
          ),
          fetchOpts,
        );

        lotesData = fallback.ok ? await fallback.json().catch(() => []) : [];
      }

      const geometry = hydrateStoredGeometry(
        buildImportedGeometry(projectData, lotesData),
      );
      setProjectGeometry(geometry);

      if (!geometry && !silent) {
        window.alertInfo?.(
          "Este proyecto aun no tiene trazos 2D listos para importar.",
        );
      }

      return geometry;
    } catch (error) {
      console.error("Error cargando trazos 2D para 360:", error);
      if (!silent) {
        window.alertError?.(
          "No se pudieron importar los trazos 2D del proyecto.",
        );
      }
      return null;
    } finally {
      setGeometryLoading(false);
    }
  };

  const loadStoredImages = useCallback(async () => {
    if (!idproyecto) return;

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await authFetch(
        buildApiUrl(`/api/get_imagen_360_casa/${idproyecto}/`),
        { headers },
      );
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) return;

      const storedImages = data
        .map(normalizeStoredImage)
        .filter((img) => img.id_imagen && img.imagen);

      if (!storedImages.length) return;

      setImagenes((prev) => {
        const existingIds = new Set(prev.map((img) => String(img.id_imagen)));
        const nextStored = storedImages.filter(
          (img) => !existingIds.has(String(img.id_imagen)),
        );
        return nextStored.length ? [...nextStored, ...prev] : prev;
      });

      setSelectedImg((prev) => prev || storedImages[0] || null);

      const loadedLayouts = {};
      const loadedAnchoredOverlays = {};
      const loadedAdditionalInstances = {};
      const loadedAnnotationsMap = new Map();
      const loadedUserDrawings = {};
      let loadedGeometry = null;

      storedImages.forEach((img) => {
        const payload = getImageOverlayPayload(img);
        if (!payload) return;
        if (!loadedGeometry && payload.geometry) {
          loadedGeometry = hydrateStoredGeometry(payload.geometry);
        }

        (payload.layouts || []).forEach((layout) => {
          const imageId = String(
            layout?.imageId ?? layout?.imagenId ?? layout?.id_imagen ?? "",
          );
          if (imageId) loadedLayouts[imageId] = layout;
        });

        (payload.anchoredOverlays || payload.panoramaOverlays || []).forEach(
          (overlay) => {
            const imageId = String(
              overlay?.imageId ?? overlay?.imagenId ?? overlay?.id_imagen ?? "",
            );
            if (imageId && hasAnchoredGeometry(overlay)) {
              loadedAnchoredOverlays[imageId] = {
                ...overlay,
                imageId,
              };
            }
          },
        );

        (payload.annotations || []).forEach((ann) => {
          if (ann?.id && ann?.imageId && ann?.label) {
            loadedAnnotationsMap.set(String(ann.id), ann);
          }
        });

        if (payload.userDrawings && typeof payload.userDrawings === "object") {
          Object.entries(payload.userDrawings).forEach(([imageId, shapes]) => {
            if (!imageId || !Array.isArray(shapes) || !shapes.length) return;
            const key = String(imageId);
            loadedUserDrawings[key] = [
              ...(loadedUserDrawings[key] || []),
              ...shapes,
            ];
          });
        }

        if (payload.additionalOverlays && typeof payload.additionalOverlays === "object") {
          Object.entries(payload.additionalOverlays).forEach(([imageId, instances]) => {
            if (!imageId || !Array.isArray(instances) || !instances.length) return;
            const key = String(imageId);
            const valid = instances.filter((inst) => hasAnchoredGeometry(inst));
            if (valid.length) {
              loadedAdditionalInstances[key] = [
                ...(loadedAdditionalInstances[key] || []),
                ...valid,
              ];
            }
          });
        }
      });

      if (loadedGeometry) {
        setProjectGeometry((prev) =>
          hasRenderableGeometry(prev)
            ? hydrateStoredGeometry(prev)
            : loadedGeometry,
        );
      } else if (
        Object.keys(loadedLayouts).length ||
        Object.keys(loadedAnchoredOverlays).length
      ) {
        // Tours guardados antes de que el plano 2D viajara embebido en el payload
        // (o de otra sesión) no traen la geometría de los lotes. Si ya hay overlays
        // configurados, la recuperamos en segundo plano para que la edición y la
        // selección múltiple funcionen sin pedirle al usuario que vuelva a importar.
        load2DGeometry(false, { silent: true });
      }
      if (Object.keys(loadedLayouts).length) {
        setOverlayLayouts((prev) => ({ ...loadedLayouts, ...prev }));
      }
      if (Object.keys(loadedAnchoredOverlays).length) {
        setAnchoredOverlays((prev) => ({ ...loadedAnchoredOverlays, ...prev }));
      }
      if (Object.keys(loadedAdditionalInstances).length) {
        additionalOverlayInstancesRef.current = {
          ...loadedAdditionalInstances,
          ...additionalOverlayInstancesRef.current,
        };
        setAdditionalOverlayInstances((prev) => ({ ...loadedAdditionalInstances, ...prev }));
      }
      if (loadedAnnotationsMap.size) {
        setAnnotations((prev) => {
          const existingIds = new Set(prev.map((a) => String(a.id)));
          const newAnns = [...loadedAnnotationsMap.values()].filter(
            (a) => !existingIds.has(String(a.id)),
          );
          return newAnns.length ? [...prev, ...newAnns] : prev;
        });
      }
      if (Object.keys(loadedUserDrawings).length) {
        setUserDrawings((prev) => {
          const next = { ...loadedUserDrawings, ...prev };
          Object.entries(loadedUserDrawings).forEach(([imageId, shapes]) => {
            const existing = prev[imageId] || [];
            const existingIds = new Set(existing.map((shape) => String(shape.id)));
            const newShapes = shapes.filter(
              (shape) => shape?.id && !existingIds.has(String(shape.id)),
            );
            next[imageId] = newShapes.length ? [...newShapes, ...existing] : existing;
          });
          return next;
        });
      }
    } catch (error) {
      console.error("Error cargando imagenes 360 guardadas:", error);
    } finally {
      // Si hay un borrador local (autoguardado de una sesión anterior sin publicar),
      // se ofrece restaurarlo recién ahora que ya cargó lo publicado — así el usuario
      // elige conscientemente si lo quiere traer de vuelta en vez de perderlo en silencio.
      const draft = readLocalDraft(idproyecto);
      if (draft && (draft.overlayLayouts || draft.additionalOverlayInstances)) {
        setLocalDraftPrompt(draft);
      }
      localDraftReadyRef.current = true;
    }
  }, [idproyecto, token]);

  const restoreLocalDraft = () => {
    if (!localDraftPrompt) return;
    if (localDraftPrompt.overlayLayouts) {
      overlayLayoutsRef.current = {
        ...overlayLayoutsRef.current,
        ...localDraftPrompt.overlayLayouts,
      };
      setOverlayLayouts((prev) => ({ ...prev, ...localDraftPrompt.overlayLayouts }));
    }
    if (localDraftPrompt.additionalOverlayInstances) {
      additionalOverlayInstancesRef.current = {
        ...additionalOverlayInstancesRef.current,
        ...localDraftPrompt.additionalOverlayInstances,
      };
      setAdditionalOverlayInstances((prev) => ({
        ...prev,
        ...localDraftPrompt.additionalOverlayInstances,
      }));
    }
    if (localDraftPrompt.anchoredOverlays) {
      anchoredOverlaysRef.current = {
        ...anchoredOverlaysRef.current,
        ...localDraftPrompt.anchoredOverlays,
      };
      setAnchoredOverlays((prev) => ({ ...prev, ...localDraftPrompt.anchoredOverlays }));
    }
    setLocalDraftSavedAt(localDraftPrompt.savedAt || null);
    setLocalDraftPrompt(null);
    if (viewerInstance.current) renderHotspots();
    window.alertSuccess?.("Borrador local restaurado.");
  };

  const discardLocalDraft = () => {
    clearLocalDraft(idproyecto);
    setLocalDraftPrompt(null);
    setLocalDraftSavedAt(null);
  };

  // Autoguardado: cada cambio en la posición/lotes confirmados del overlay 2D se
  // guarda en localStorage (con un pequeño debounce) para no perder el avance si
  // el usuario cierra la pestaña sin publicar el tour.
  useEffect(() => {
    if (!localDraftReadyRef.current || !idproyecto) return undefined;
    if (localDraftTimeoutRef.current) clearTimeout(localDraftTimeoutRef.current);
    localDraftTimeoutRef.current = setTimeout(() => {
      const hasContent =
        Object.keys(overlayLayouts).length ||
        Object.keys(additionalOverlayInstances).length ||
        Object.keys(anchoredOverlays).length;
      if (!hasContent) return;
      const savedAt = Date.now();
      writeLocalDraft(idproyecto, {
        overlayLayouts,
        additionalOverlayInstances,
        anchoredOverlays,
        savedAt,
      });
      setLocalDraftSavedAt(savedAt);
    }, LOCAL_DRAFT_DEBOUNCE_MS);
    return () => {
      if (localDraftTimeoutRef.current) clearTimeout(localDraftTimeoutRef.current);
    };
  }, [idproyecto, overlayLayouts, additionalOverlayInstances, anchoredOverlays]);

  const importLayoutIntoCurrentImage = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!selectedImg) return;

    // If there's already a configured overlay, commit it as an additional instance
    // and start a fresh one at DEFAULT position.
    const existingConfig = overlayLayoutsRef.current[selectedImageId];
    if (existingConfig?.visible) {
      // Prefer the already-computed spherical snapshot (camera-independent) over rebuilding.
      // buildAnchoredOverlaySnapshot re-projects from current camera which can drift.
      const snapshot =
        anchoredOverlaysRef.current[selectedImageId] ||
        buildAnchoredOverlaySnapshot(selectedImageId, existingConfig);
      if (snapshot && hasAnchoredGeometry(snapshot)) {
        const instanceId = `inst-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newInstance = { ...snapshot, instanceId };
        const current = additionalOverlayInstancesRef.current[selectedImageId] || [];
        const updated = [...current, newInstance];
        additionalOverlayInstancesRef.current = {
          ...additionalOverlayInstancesRef.current,
          [selectedImageId]: updated,
        };
        setAdditionalOverlayInstances((prev) => ({ ...prev, [selectedImageId]: updated }));
      }
      // Clear the main slot so the new import starts completely fresh
      delete anchoredOverlaysRef.current[selectedImageId];
      setAnchoredOverlays((prev) => {
        const next = { ...prev };
        delete next[selectedImageId];
        return next;
      });
    }

    const geometry = await load2DGeometry();
    if (!geometry) return;

    const newConfig = { ...DEFAULT_LAYOUT_CONFIG, visible: true };
    const nextLayouts = { ...overlayLayoutsRef.current, [selectedImageId]: newConfig };
    overlayLayoutsRef.current = nextLayouts;
    selectedOverlayConfigRef.current = newConfig;
    setOverlayLayouts(nextLayouts);
    setLayoutEditMode(true);
    setAdvancedMode(false);
    setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
    resetPointMode();
    window.alertSuccess?.("Trazos 2D importados en esta vista 360.");
  };

  const clearAdditionalInstancesForCurrentImage = () => {
    if (!selectedImageId) return;
    additionalOverlayInstancesRef.current = Object.fromEntries(
      Object.entries(additionalOverlayInstancesRef.current).filter(
        ([imageId]) => imageId !== selectedImageId,
      ),
    );
    setAdditionalOverlayInstances((prev) => {
      const next = { ...prev };
      delete next[selectedImageId];
      return next;
    });
  };

  // Oculta/muestra UNA sola capa fija (instancia) sin tocar el resto ni el overlay
  // en vivo — para poder esconder un mapa/lote duplicado puntual sin borrar nada.
  const toggleAdditionalInstanceVisibility = (instanceId) => {
    if (!selectedImageId) return;
    setAdditionalOverlayInstances((prev) => {
      const current = prev[selectedImageId] || [];
      const updated = current.map((inst) =>
        inst.instanceId === instanceId
          ? { ...inst, visible: inst.visible === false ? true : false }
          : inst,
      );
      additionalOverlayInstancesRef.current = {
        ...additionalOverlayInstancesRef.current,
        [selectedImageId]: updated,
      };
      return { ...prev, [selectedImageId]: updated };
    });
    if (viewerInstance.current) renderHotspots();
  };

  // Elimina UNA sola capa fija (instancia), dejando intactas las demás y el overlay
  // en vivo — para borrar definitivamente solo el mapa/grupo de lotes sobrante.
  const removeAdditionalInstance = (instanceId) => {
    if (!selectedImageId) return;
    setAdditionalOverlayInstances((prev) => {
      const current = prev[selectedImageId] || [];
      const updated = current.filter((inst) => inst.instanceId !== instanceId);
      additionalOverlayInstancesRef.current = {
        ...additionalOverlayInstancesRef.current,
        [selectedImageId]: updated,
      };
      return { ...prev, [selectedImageId]: updated };
    });
    if (viewerInstance.current) renderHotspots();
  };

  // Lotes ya confirmados/fijos a la foto en esta imagen (promovidos desde "Confirmar
  // y deseleccionar"), agrupados POR INSTANCIA (en vez de aplanados en una sola lista)
  // para poder mostrar un resumen compacto por capa y permitir ocultar/eliminar una
  // capa puntual (p.ej. una duplicada) sin desplegar cada lote uno por uno.
  const fixedInstancesForCurrentImage = useMemo(() => {
    const instances = additionalOverlayInstances[selectedImageId] || [];
    const seenIds = new Set();
    return instances
      .filter((instance) => {
        if (!String(instance.instanceId || "").startsWith("fixed-")) return false;
        if (seenIds.has(instance.instanceId)) return false;
        seenIds.add(instance.instanceId);
        return true;
      })
      .map((instance, idx) => ({
        instanceId: instance.instanceId,
        visible: instance.visible !== false,
        label: `Capa fija ${idx + 1}`,
        lotes: (instance.lotPolygons || []).map((lote) => ({
          instanceId: instance.instanceId,
          loteId: String(lote.idlote ?? ""),
          nombre: lote.nombre,
          color: lote.color,
          textureMode: lote.textureMode ?? instance.textureMode ?? "solid",
          lotOpacity: lote.lotOpacity ?? instance.lotOpacity ?? 0.82,
        })),
      }));
  }, [additionalOverlayInstances, selectedImageId]);

  const [expandedFixedInstanceIds, setExpandedFixedInstanceIds] = useState(() => new Set());
  const toggleFixedInstanceExpanded = (instanceId) => {
    setExpandedFixedInstanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const updateFixedLotStyle = (instanceId, loteId, patch) => {
    setAdditionalOverlayInstances((prev) => {
      const current = prev[selectedImageId] || [];
      const updated = current.map((instance) => {
        if (instance.instanceId !== instanceId) return instance;
        return {
          ...instance,
          lotPolygons: (instance.lotPolygons || []).map((lote) =>
            String(lote.idlote ?? "") === loteId ? { ...lote, ...patch } : lote,
          ),
        };
      });
      additionalOverlayInstancesRef.current = {
        ...additionalOverlayInstancesRef.current,
        [selectedImageId]: updated,
      };
      return { ...prev, [selectedImageId]: updated };
    });
    if (viewerInstance.current) renderHotspots();
  };

  // Saca un lote ya fijado de vuelta al modo editable: convierte su polígono esférico
  // guardado en "committedSphericalPoints" (el mismo campo que usa el panel de ajuste
  // fino sobre el tour) y entra a modo zoom con el lote ya seleccionado, listo para
  // transformarlo de nuevo sin perder su posición actual.
  const reactivateFixedLot = (instanceId, loteId) => {
    const instances = additionalOverlayInstancesRef.current[selectedImageId] || [];
    const instance = instances.find((inst) => inst.instanceId === instanceId);
    const lote = instance?.lotPolygons?.find(
      (l) => String(l.idlote ?? "") === loteId,
    );
    if (!lote?.polygon?.length) return;

    pushOverlayUndoSnapshot(selectedImageId);

    const remainingLotPolygons = (instance.lotPolygons || []).filter(
      (l) => String(l.idlote ?? "") !== loteId,
    );
    const updatedInstances = remainingLotPolygons.length
      ? instances.map((inst) =>
          inst.instanceId === instanceId
            ? { ...inst, lotPolygons: remainingLotPolygons }
            : inst,
        )
      : instances.filter((inst) => inst.instanceId !== instanceId);
    additionalOverlayInstancesRef.current = {
      ...additionalOverlayInstancesRef.current,
      [selectedImageId]: updatedInstances,
    };
    setAdditionalOverlayInstances((prev) => ({
      ...prev,
      [selectedImageId]: updatedInstances,
    }));

    const nextLayouts = {
      ...overlayLayoutsRef.current,
      [selectedImageId]: {
        ...(overlayLayoutsRef.current[selectedImageId] || DEFAULT_LAYOUT_CONFIG),
        visible: true,
        lotOverrides: {
          ...(overlayLayoutsRef.current[selectedImageId]?.lotOverrides ?? {}),
          [loteId]: {
            ...(overlayLayoutsRef.current[selectedImageId]?.lotOverrides?.[loteId] ?? {}),
            anchoredFixed: false,
            committedSphericalPoints: lote.polygon,
          },
        },
      },
    };
    overlayLayoutsRef.current = nextLayouts;
    selectedOverlayConfigRef.current = nextLayouts[selectedImageId];
    setOverlayLayouts(nextLayouts);

    setLayoutEditMode(true);
    setAnchoredEditMode(true);
    groupEditBaseRef.current = { ...(nextLayouts[selectedImageId].lotOverrides ?? {}) };
    sphericalGroupEditRef.current = DEFAULT_SPHERICAL_GROUP_EDIT;
    setSphericalGroupEdit(DEFAULT_SPHERICAL_GROUP_EDIT);
    const nextSelected = new Set([loteId]);
    selectedLotIdsRef.current = nextSelected;
    setSelectedLotIds(nextSelected);

    if (viewerInstance.current) renderHotspots();
    window.alertSuccess?.("Lote reactivado — ajústalo en modo zoom y vuelve a confirmar.");
  };

  const clearAnchoredOverlayForCurrentImage = () => {
    if (!selectedImageId) return;
    anchoredOverlaysRef.current = Object.fromEntries(
      Object.entries(anchoredOverlaysRef.current).filter(
        ([imageId]) => imageId !== selectedImageId,
      ),
    );
    setAnchoredOverlays((prev) => {
      const next = { ...prev };
      delete next[selectedImageId];
      return next;
    });
    clearAdditionalInstancesForCurrentImage();
  };

  const toggleSelectedOverlayVisibility = () => {
    if (!selectedOverlayConfig) return;
    const nextVisible = !selectedOverlayConfig.visible;
    if (!nextVisible) {
      setLayoutEditMode(false);
      setAnchoredEditMode(false);
      setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
      clearGroupSelection();
      clearAnchoredOverlayForCurrentImage();
    } else {
      resetPointMode();
    }
    updateSelectedOverlayConfig({ visible: nextVisible });
  };

  const resetOverlayForCurrentImage = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!selectedImageId) return;

    const geometry = hasRenderableGeometry(projectGeometry)
      ? hydrateStoredGeometry(projectGeometry)
      : await load2DGeometry();
    if (!geometry) return;
    setProjectGeometry(geometry);

    stopOverlayDrag();
    clearAnchoredOverlayForCurrentImage();
    resetPointMode();
    setDragState(null);
    setGroupDragState(null);
    setLayoutEditMode(true);
    layoutEditModeRef.current = true;
    // Se reinicia la posición desde cero: siempre arranca en la tarjeta flotante,
    // nunca en modo zoom (ya no hay nada anclado a la foto todavía).
    setAnchoredEditMode(false);
    setAdvancedMode(false);
    setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
    alignmentModeRef.current = DEFAULT_ALIGNMENT_STATE;
    clearGroupSelection();
    const nextConfig = { ...DEFAULT_LAYOUT_CONFIG };
    const nextLayouts = {
      ...overlayLayoutsRef.current,
      [selectedImageId]: nextConfig,
    };
    overlayLayoutsRef.current = nextLayouts;
    selectedOverlayConfigRef.current = nextConfig;
    setOverlayLayouts(nextLayouts);
  };

  const reimportGeometry = async () => {
    setProjectGeometry(null);
    const geometry = await load2DGeometry(true);
    if (geometry) window.alertSuccess?.(`${geometry.lotes.length} lotes reimportados desde el plano 2D.`);
  };

  const applyLayoutToAllImages = () => {
    const base = selectedOverlayConfigRef.current || selectedOverlayConfig;
    if (!base || !imagenes.length) return;
    const { lotOverrides: _lo, alignmentWarp: _aw, ...shared } = base;
    const next = { ...overlayLayoutsRef.current };
    imagenes.forEach((img) => {
      const id = String(img.id_imagen);
      next[id] = { ...DEFAULT_LAYOUT_CONFIG, ...(next[id] || {}), ...shared, visible: true };
    });
    overlayLayoutsRef.current = next;
    setOverlayLayouts(next);
    window.alertSuccess?.(`Ajuste copiado a ${imagenes.length} vista(s).`);
  };

  const centerOverlayInViewer = () => {
    const viewer = viewerRef.current;
    const svg = overlaySvgRef.current;
    if (!viewer || !svg) return;
    const vw = viewer.clientWidth || 900;
    const vh = viewer.clientHeight || 600;
    const scale = selectedOverlayConfigRef.current?.scale ?? DEFAULT_LAYOUT_CONFIG.scale;
    const cardW = (svg.clientWidth || OVERLAY_VIEWBOX.width) * scale;
    const cardH = (svg.clientHeight || OVERLAY_VIEWBOX.height) * scale;
    updateSelectedOverlayConfig({
      x: Math.round(vw / 2 - cardW / 2),
      y: Math.round(vh / 2 - cardH / 2),
    });
  };

  const snapOverlayToPosition = (preset) => {
    const viewer = viewerRef.current;
    const svg = overlaySvgRef.current;
    if (!viewer || !svg) return;
    const vw = viewer.clientWidth || 900;
    const vh = viewer.clientHeight || 600;
    const scale = selectedOverlayConfigRef.current?.scale ?? DEFAULT_LAYOUT_CONFIG.scale;
    const cardW = (svg.clientWidth || OVERLAY_VIEWBOX.width) * scale;
    const cardH = (svg.clientHeight || OVERLAY_VIEWBOX.height) * scale;
    const pad = 12;
    const positions = {
      tl: { x: pad,                    y: pad },
      tc: { x: Math.round(vw/2-cardW/2), y: pad },
      tr: { x: Math.round(vw-cardW-pad), y: pad },
      ml: { x: pad,                    y: Math.round(vh/2-cardH/2) },
      mc: { x: Math.round(vw/2-cardW/2), y: Math.round(vh/2-cardH/2) },
      mr: { x: Math.round(vw-cardW-pad), y: Math.round(vh/2-cardH/2) },
      bl: { x: pad,                    y: Math.round(vh-cardH-pad) },
      bc: { x: Math.round(vw/2-cardW/2), y: Math.round(vh-cardH-pad) },
      br: { x: Math.round(vw-cardW-pad), y: Math.round(vh-cardH-pad) },
    };
    if (positions[preset]) updateSelectedOverlayConfig(positions[preset]);
  };

  const getPlanSourceLayoutPoint = (sourcePoint) => {
    const runtime = getCurrentOverlayRuntime();
    if (!runtime || !sourcePoint) return null;
    const svgWidth = Number(runtime.overlayWidth) || OVERLAY_VIEWBOX.width;
    const svgHeight = Number(runtime.overlayHeight) || OVERLAY_VIEWBOX.height;
    const offsetX = Number(runtime.overlayOffsetX) || 0;
    const offsetY = Number(runtime.overlayOffsetY) || 0;
    return {
      x: offsetX + (Number(sourcePoint.x) / OVERLAY_VIEWBOX.width) * svgWidth,
      y: offsetY + (Number(sourcePoint.y) / OVERLAY_VIEWBOX.height) * svgHeight,
    };
  };

  const previewAffineAlignment = (pairs) => {
    const result = computeAffineAlignment(pairs);
    if (!result) {
      setAlignmentMode((prev) => ({
        ...prev,
        result: null,
        error:
          "Los tres puntos del plano estan muy alineados o incompletos. Selecciona referencias mas separadas.",
      }));
      return;
    }

    // Aplicar la transformación con mayor precisión
    updateSelectedOverlayConfig({
      affineMatrix: result.matrix,
      alignmentWarp: {
        enabled: true,
        pairs: pairs.map((pair) => ({
          source: pair.source,
          sourceLayout: pair.sourceLayout,
          targetViewer: pair.targetViewer,
        })),
      },
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      tiltX: 0,
      tiltY: 0,
      perspectiveDepth: 900,
    });

    setAlignmentMode((prev) => ({
      ...prev,
      step: "review",
      result,
      error: null,
    }));
  };

  const startAlignmentMode = async () => {
    if (!selectedImg) return;
    const geometry = await load2DGeometry();
    if (!geometry) return;

    const currentConfig = overlayLayoutsRef.current[selectedImageId] || {};
    setOverlayLayouts((prev) => ({
      ...prev,
      [selectedImageId]: {
        ...DEFAULT_LAYOUT_CONFIG,
        ...currentConfig,
        visible: true,
      },
    }));
    setLayoutEditMode(true);
    setAdvancedMode(false);
    resetPointMode();
    setSelectedLotIds(new Set());
    selectedLotIdsRef.current = new Set();
    setAlignmentMode({
      ...DEFAULT_ALIGNMENT_STATE,
      active: true,
      step: "plan",
    });
  };

  const cancelAlignmentMode = () => {
    setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
  };

  const resetAlignmentPairs = () => {
    setAlignmentMode({
      ...DEFAULT_ALIGNMENT_STATE,
      active: true,
      step: "plan",
    });
  };

  const continueAlignmentPoints = () => {
    setAlignmentMode((prev) => ({
      ...prev,
      active: true,
      step: "plan",
      pendingPlanPoint: null,
      error: null,
    }));
  };

  const undoLastAlignmentPair = () => {
    setAlignmentMode((prev) => {
      const nextPairs = prev.pairs.slice(0, -1);
      if (nextPairs.length >= REQUIRED_AFFINE_POINTS) {
        const nextResult = computeAffineAlignment(nextPairs);
        if (nextResult) {
          updateSelectedOverlayConfig({
            affineMatrix: nextResult.matrix,
            alignmentWarp: {
              enabled: true,
              pairs: nextPairs.map((pair) => ({
                source: pair.source,
                sourceLayout: pair.sourceLayout,
                targetViewer: pair.targetViewer,
              })),
            },
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            tiltX: 0,
            tiltY: 0,
            perspectiveDepth: 900,
          });
        }
        return {
          ...prev,
          pairs: nextPairs,
          pendingPlanPoint: null,
          step: "review",
          result: nextResult,
          error: nextResult
            ? null
            : "No se pudo recalcular el ajuste con los puntos restantes.",
        };
      }

      return {
        ...prev,
        pairs: nextPairs,
        pendingPlanPoint: null,
        step: "plan",
        result: null,
        error: null,
      };
    });
  };

  const removeWorstAlignmentPair = () => {
    setAlignmentMode((prev) => {
      if (
        !prev.result?.residuals?.length ||
        prev.pairs.length <= REQUIRED_AFFINE_POINTS
      ) {
        return prev;
      }

      const worst = prev.result.residuals.reduce((max, item) =>
        item.error > max.error ? item : max,
      );
      const nextPairs = prev.pairs.filter(
        (_, index) => index !== worst.index - 1,
      );
      const nextResult = computeAffineAlignment(nextPairs);
      if (nextResult) {
        updateSelectedOverlayConfig({
          affineMatrix: nextResult.matrix,
          alignmentWarp: {
            enabled: true,
            pairs: nextPairs.map((pair) => ({
              source: pair.source,
              sourceLayout: pair.sourceLayout,
              targetViewer: pair.targetViewer,
            })),
          },
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          tiltX: 0,
          tiltY: 0,
          perspectiveDepth: 900,
        });
      }

      return {
        ...prev,
        pairs: nextPairs,
        pendingPlanPoint: null,
        step: nextResult ? "review" : "plan",
        result: nextResult,
        error: nextResult
          ? null
          : "No se pudo recalcular el ajuste sin el punto de mayor error.",
      };
    });
  };

  const handlePlanAlignmentClick = (event) => {
    const currentAlignment = alignmentModeRef.current;
    if (
      !currentAlignment?.active ||
      (currentAlignment.step !== "plan" && currentAlignment.step !== "review")
    )
      return;
    if (!overlaySvgRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    const svgPoint = getSvgPointFromClient(
      overlaySvgRef.current,
      event.clientX,
      event.clientY,
    );
    if (!svgPoint) return;

    const source = chooseSnapCandidate(
      overlaySvgRef.current,
      svgPoint,
      event.clientX,
      event.clientY,
      alignmentSnapCandidates,
    );
    const sourceLayout = getPlanSourceLayoutPoint(source);
    if (!sourceLayout) return;

    setAlignmentMode((prev) => ({
      ...prev,
      step: "viewer",
      pendingPlanPoint: {
        source,
        sourceLayout,
      },
      error: null,
    }));
  };

  const handleViewerAlignmentClick = (event) => {
    if (drawModeRef.current) return;
    const currentAlignment = alignmentModeRef.current;
    if (!currentAlignment?.active || currentAlignment.step !== "viewer") return;
    if (!viewerRef.current || !currentAlignment.pendingPlanPoint) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = viewerRef.current.getBoundingClientRect();
    const targetViewer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    if (!Number.isFinite(targetViewer.x) || !Number.isFinite(targetViewer.y))
      return;

    const nextPairs = [
      ...currentAlignment.pairs,
      {
        ...currentAlignment.pendingPlanPoint,
        targetViewer,
      },
    ];

    if (nextPairs.length >= REQUIRED_AFFINE_POINTS) {
      setAlignmentMode((prev) => ({
        ...prev,
        pairs: nextPairs,
        pendingPlanPoint: null,
        step: "plan",
      }));
      previewAffineAlignment(nextPairs);
      return;
    }

    setAlignmentMode((prev) => ({
      ...prev,
      pairs: nextPairs,
      pendingPlanPoint: null,
      step: "plan",
      result: null,
      error: null,
    }));
  };

  // Snapshot anclado de una imagen: puede venir del ref (caché en memoria de esta
  // sesión) o del estado cargado desde el backend al abrir el editor (loadStoredImages
  // sólo escribe en el estado, no en el ref, hasta que algo lo reconstruye).
  const getAnchoredOverlayForImage = (imageId = selectedImageId) =>
    anchoredOverlaysRef.current[String(imageId)] ||
    anchoredOverlays[String(imageId)] ||
    null;

  const enterLayoutEditMode = () => {
    resetPointMode();
    // Si esta vista ya tiene una posición anclada a la foto (el tour ya fue
    // publicado con los lotes ubicados), entramos directo al modo "ajuste fino
    // sobre el tour": cámara libre con zoom, lotes pegados a la foto real. Si es
    // la primera vez (sin posición previa), usamos la tarjeta flotante de siempre
    // para la alineación inicial del plano completo.
    const hasAnchored = hasAnchoredGeometry(
      getAnchoredOverlayForImage(selectedImageId),
    );
    setAnchoredEditMode(hasAnchored);
    setLayoutEditMode(true);
    // Red de seguridad: si esta vista ya tiene un plano/lotes configurados pero la
    // geometría aún no se cargó en esta sesión (p.ej. datos guardados antes de que
    // viajara embebida), la trae en segundo plano sin tocar la posición ya guardada.
    if (!hasRenderableGeometry(projectGeometry) && selectedOverlayConfig?.visible) {
      load2DGeometry(false, { silent: true });
    }
  };

  const toggleLayoutEditMode = () => {
    if (alignmentModeRef.current?.active) return;

    if (layoutEditMode) {
      // Confirma cualquier edición de bloque (grupo de lotes) pendiente antes de
      // salir, para no perder en silencio el ajuste visible en pantalla.
      commitPendingGroupEditIfAny();
      if (anchoredEditMode) {
        // Modo zoom: los lotes ya están anclados a la foto (no a la cámara), así
        // que NO se debe borrar/re-proyectar el snapshot existente — eso es lo que
        // causaba que todo "saltara" a la posición de la cámara al salir. Sólo se
        // refresca el caché para incorporar los ajustes confirmados en esta sesión.
        snapshotOverlayForImage(selectedImageId);
      } else {
        // Clear existing snapshot so persistCurrentOverlayPosition re-projects
        // with the user's new intentional position before exiting edit mode.
        delete anchoredOverlaysRef.current[String(selectedImageId)];
        persistCurrentOverlayPosition();
      }
      setLayoutEditMode(false);
      setAnchoredEditMode(false);
      setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
      return;
    }

    enterLayoutEditMode();
  };

  // Botón "Selección múltiple": permite activar la herramienta de selección por
  // rectángulo directamente, sin que el usuario tenga que entrar primero a "Editar
  // posicion" manualmente — entra al modo edición sola si todavía no está activo.
  const enableSelectionTool = () => {
    if (alignmentModeRef.current?.active || !selectedOverlayConfig?.visible) return;
    if (!layoutEditMode) enterLayoutEditMode();
    setSelectionToolActive(true);
  };

  useEffect(() => {
    loadStoredImages();
  }, [loadStoredImages]);

  useEffect(() => {
    batchItemsRef.current = batchItems;
  }, [batchItems]);

  useEffect(() => {
    imagenesRef.current = imagenes;
  }, [imagenes]);

  useEffect(() => {
    overlayLayoutsRef.current = overlayLayouts;
  }, [overlayLayouts]);

  useEffect(() => {
    selectedOverlayConfigRef.current = selectedOverlayConfig;
  }, [selectedOverlayConfig]);

  useEffect(() => {
    layoutEditModeRef.current = layoutEditMode;
  }, [layoutEditMode]);

  useEffect(() => {
    anchoredEditModeRef.current = anchoredEditMode;
  }, [anchoredEditMode]);

  useEffect(() => {
    sphericalGroupEditRef.current = sphericalGroupEdit;
  }, [sphericalGroupEdit]);

  useEffect(() => {
    alignmentModeRef.current = alignmentMode;
  }, [alignmentMode]);

  // Congela la cámara del visor 360 (sin pan ni zoom con la rueda) mientras se edita
  // la posición del overlay/lotes con la tarjeta flotante o se calibra la alineación,
  // para que el plano 2D y la vista no se muevan de forma independiente uno del otro.
  // En el modo "ajuste fino sobre el tour" (anchoredEditMode) los lotes ya están
  // anclados a la foto, así que la cámara queda libre (zoom y pan reales).
  useEffect(() => {
    const viewer = viewerInstance.current;
    if (!viewerReady || !viewer?.setOptions) return undefined;
    const shouldFreeze = (layoutEditMode && !anchoredEditMode) || alignmentMode.active;
    viewer.setOptions({
      mousemove: !shouldFreeze,
      mousewheel: !shouldFreeze,
    });
    return undefined;
  }, [viewerReady, layoutEditMode, anchoredEditMode, alignmentMode.active]);

  useEffect(() => { annotationModeRef.current = annotationMode; }, [annotationMode]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { currentPolygonPointsRef.current = currentPolygonPoints; }, [currentPolygonPoints]);
  useEffect(() => { additionalOverlayInstancesRef.current = additionalOverlayInstances; }, [additionalOverlayInstances]);

  // Re-proyectar los trazos completados cuando el visor gira (solo si hay trazos activos)
  useEffect(() => {
    if (!viewerReady) return undefined;
    const viewer = viewerInstance.current;
    if (!viewer) return undefined;

    const handlePan = () => {
      if (drawPanFrameRef.current) return;
      drawPanFrameRef.current = requestAnimationFrame(() => {
        drawPanFrameRef.current = null;
        setViewerPanTick((t) => t + 1);
      });
    };

    viewer.addEventListener('position-updated', handlePan);
    viewer.addEventListener('zoom-updated', handlePan);

    return () => {
      if (drawPanFrameRef.current) {
        cancelAnimationFrame(drawPanFrameRef.current);
        drawPanFrameRef.current = null;
      }
      try {
        viewer.removeEventListener('position-updated', handlePan);
        viewer.removeEventListener('zoom-updated', handlePan);
      } catch { /* viewer ya destruido */ }
    };
  }, [viewerReady]);

  useEffect(() => {
    overlayVisibleRef.current = !!selectedOverlayConfig?.visible;
  }, [selectedOverlayConfig?.visible]);

  useEffect(() => {
    setLayoutEditMode(false);
    setAnchoredEditMode(false);
    setDragState(null);
    setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
    setSelectedLotIds(new Set());
    selectedLotIdsRef.current = new Set();
    setGroupEdit(DEFAULT_GROUP_EDIT);
    groupEditRef.current = DEFAULT_GROUP_EDIT;
    setSphericalGroupEdit(DEFAULT_SPHERICAL_GROUP_EDIT);
    sphericalGroupEditRef.current = DEFAULT_SPHERICAL_GROUP_EDIT;
    groupEditBaseRef.current = {};
    setAnnotationMode(false);
    setAnnotationLabel("");
    setDrawMode(null);
    setCurrentPolygonPoints([]);
    currentPolygonPointsRef.current = [];
    setPolygonCursorPos(null);
    setAnnotationDesc("");
  }, [selectedImageId]);

  useEffect(() => {
    if (!selectedImg || !viewerRef.current || !viewerRuntimeReady) {
      return undefined;
    }

    setViewerReady(false);
    resetPointMode();
    const runtime = viewerRuntimeRef.current || viewerRuntimeCache;
    if (!runtime) return undefined;

    const savedCameraConfig =
      overlayLayoutsRef.current[String(selectedImg.id_imagen)];
    const restoredYaw = Number.isFinite(Number(savedCameraConfig?.yaw))
      ? Number(savedCameraConfig.yaw)
      : 0;
    const restoredPitch = Number.isFinite(Number(savedCameraConfig?.pitch))
      ? Number(savedCameraConfig.pitch)
      : 0;
    const restoredZoom = Number.isFinite(Number(savedCameraConfig?.zoomLevel))
      ? Math.max(0, Math.min(100, Number(savedCameraConfig.zoomLevel)))
      : 50;

    let viewer;
    try {
      viewer = new runtime.Viewer({
        container: viewerRef.current,
        panorama: selectedImg.imagen,
        defaultYaw: restoredYaw,
        defaultPitch: restoredPitch,
        defaultZoomLvl: restoredZoom,
        adapter: runtime.EquirectangularAdapter
          ? [
              runtime.EquirectangularAdapter,
              { resolution: 32, useXmpData: false },
            ]
          : undefined,
        rendererParameters: {
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        },
        plugins: [[runtime.MarkersPlugin, {}]],
        navbar: ["zoom", "move", "caption", "fullscreen"],
        caption: `${selectedImg.nombre} · borrador local`,
        loadingImg: "https://geohabita.com/loading.gif",
      });
    } catch (err) {
      // El contenedor puede tener ancho/alto 0 durante una resolución muy
      // pequeña (p.ej. devtools en modo responsive); evita tumbar todo el
      // dashboard si el visor 360 no logra inicializarse.
      console.error("No se pudo inicializar el visor 360:", err);
      window.alertError?.(
        "No se pudo cargar el visor 360 con esta resolución. Amplía la ventana e intenta de nuevo.",
      );
      return undefined;
    }
    const restoreViewerAutoSize = installDeferredViewerAutoSize(viewer);

    viewerInstance.current = viewer;
    const markers = viewer.getPlugin(runtime.MarkersPlugin);

    viewer.addEventListener("click", ({ data }) => {
      if (
        alignmentModeRef.current?.active ||
        (layoutEditModeRef.current && overlayVisibleRef.current)
      ) {
        return;
      }

      const yaw = data?.yaw ?? data?.longitude;
      const pitch = data?.pitch ?? data?.latitude;

      if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) {
        return;
      }

      const punto = { yaw, pitch };

      setCoords(punto);
      removeTempMarker(markers);

      markers.addMarker({
        id: "temp",
        image: TEMP_MARKER_ICON,
        size: MARKER_SIZE,
        anchor: "center center",
        position: makeMarkerPosition(punto.yaw, punto.pitch),
        tooltip: "Nuevo punto",
      });
    });

    markers.addEventListener("select-marker", (event) => {
      const marker = event?.marker || event?.detail?.marker;
      if (marker?.data?.type === "annotation") return;
      if (marker?.data?.type === "lot") {
        if (anchoredEditModeRef.current && marker.data.loteId) {
          toggleLotSelection(marker.data.loteId);
        }
        return;
      }
      if (!marker?.data?.destinoId) return;

      const destino = imagenesRef.current.find(
        (img) => img.id_imagen === marker.data.destinoId,
      );
      if (destino) {
        commitPendingGroupEditIfAny();
        persistCurrentOverlayPosition();
        setSelectedImg(destino);
      }
    });

    viewer.addEventListener("ready", () => {
      setViewerReady(true);
      renderHotspots();
    });

    return () => {
      restoreViewerAutoSize();
      viewer.destroy();
      viewerInstance.current = null;
    };
  }, [selectedImg, viewerRuntimeReady]);

  useEffect(() => {
    if (viewerReady && !dragState && !groupDragState && !anchoredGroupDragState) {
      renderHotspots();
    }
  }, [
    viewerReady,
    conexionesActuales,
    coords,
    selectedImg,
    layoutEditMode,
    anchoredEditMode,
    selectedLotIds,
    anchoredOverlays,
    overlayLayouts,
    dragState,
    groupDragState,
    anchoredGroupDragState,
    annotations,
    additionalOverlayInstances,
  ]);

  const handleBatchFiles = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.target.files || []);
    const items = files.map((file) => ({
      file,
      nombre: file.name.replace(/\.[^.]+$/, ""),
      preview: URL.createObjectURL(file),
    }));

    setBatchItems(items);
    event.target.value = "";
  };

  const updateBatchItemName = (index, value) => {
    setBatchItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, nombre: value } : item,
      ),
    );
  };

  const removeBatchItem = (index) => {
    setBatchItems((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const addBatchToDraft = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!batchItems.length) return;

    const nuevasImagenes = batchItems.map((item) => ({
      id_imagen: `draft-${crypto.randomUUID()}`,
      nombre: item.nombre?.trim() || item.file.name.replace(/\.[^.]+$/, ""),
      imagen: item.preview,
      file: item.file,
      isDraft: true,
    }));

    setImagenes((prev) => [...prev, ...nuevasImagenes]);
    setSelectedImg((prev) => prev || nuevasImagenes[0] || null);
    setBatchItems([]);
    window.alertInfo?.(
      "Imágenes en borrador. Presiona «Publicar tour» para guardarlas.",
    );
  };

  const connectToExisting = (destino, event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!hasValidCoords || !selectedImg || !destino) return;

    setConexiones((prev) => [
      ...prev,
      {
        id: `hotspot-${crypto.randomUUID()}`,
        origenId: selectedImg.id_imagen,
        destinoId: destino.id_imagen,
        destinoNombre: destino.nombre,
        yaw: coords.yaw,
        pitch: coords.pitch,
      },
    ]);

    resetPointMode();
    window.alertSuccess?.("Conexion creada en el borrador local.");
  };

  const createAndConnectImage = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (
      !hasValidCoords ||
      !selectedImg ||
      !newPointFile ||
      !newPointName.trim()
    )
      return;

    const nuevaImagen = createDraftImage(newPointFile, newPointName);

    setImagenes((prev) => [...prev, nuevaImagen]);
    setConexiones((prev) => [
      ...prev,
      {
        id: `hotspot-${crypto.randomUUID()}`,
        origenId: selectedImg.id_imagen,
        destinoId: nuevaImagen.id_imagen,
        destinoNombre: nuevaImagen.nombre,
        yaw: coords.yaw,
        pitch: coords.pitch,
      },
    ]);

    resetPointMode();
    snapshotOverlayForImage();
    setSelectedImg(nuevaImagen);
    window.alertSuccess?.(
      "Nueva vista creada y conectada en el borrador local.",
    );
  };

  const saveTourToBackend = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!imagenes.length) {
      window.alertInfo?.(
        "Agrega al menos una imagen 360 antes de subir el tour.",
      );
      return;
    }

    const draftImages = imagenes.filter((img) => img.isDraft && img.file);
    const draftIdsBeingUploaded = new Set(
      draftImages.map((img) => String(img.id_imagen)),
    );
    const canResolveImageIdOnSave = (value) => {
      const id = String(value ?? "");
      if (!id) return false;
      return !id.startsWith("draft-") || draftIdsBeingUploaded.has(id);
    };
    const resolvableConnections = conexiones.filter(
      (conexion) =>
        canResolveImageIdOnSave(conexion.origenId) &&
        canResolveImageIdOnSave(conexion.destinoId),
    );
    const skippedConnections = conexiones.length - resolvableConnections.length;
    stopOverlayDrag();
    // Confirma cualquier edición de bloque pendiente antes de publicar, para no
    // perder en silencio el ajuste visible en pantalla.
    commitPendingGroupEditIfAny();
    // If saving while in edit mode, force fresh re-projection to capture current
    // position — pero sólo en el modo tarjeta flotante. En modo zoom los lotes ya
    // están anclados a la foto y borrar el snapshot forzaría a recalcularlos según
    // la posición actual de la cámara, corrompiendo todo lo que no se tocó.
    if (layoutEditModeRef.current && !anchoredEditModeRef.current) {
      delete anchoredOverlaysRef.current[String(selectedImageId)];
    } else if (anchoredEditModeRef.current) {
      snapshotOverlayForImage(selectedImageId);
    }
    const persistedSnapshot = persistCurrentOverlayPosition();
    setLayoutEditMode(false);
    setAnchoredEditMode(false);
    setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
    layoutEditModeRef.current = false;
    alignmentModeRef.current = DEFAULT_ALIGNMENT_STATE;
    const currentConfig =
      selectedOverlayConfigRef.current || selectedOverlayConfig;
    const currentLayoutRuntime = captureCurrentLayoutRuntime();
    // Usar el snapshot guardado por persistCurrentOverlayPosition (capturado con la cámara
    // correcta cuando el usuario posicionó el overlay), sin re-proyectar ahora que la cámara
    // puede haber girado al agregar anotaciones u otras acciones.
    const currentSnapshot =
      persistedSnapshot ||
      anchoredOverlaysRef.current[String(selectedImageId)] ||
      null;
    const runtimeByImage = {
      ...(selectedImageId && currentLayoutRuntime
        ? {
            [String(selectedImageId)]: currentLayoutRuntime,
          }
        : {}),
    };
    const layoutSource = {
      ...overlayLayoutsRef.current,
      ...(selectedImageId && currentLayoutRuntime
        ? {
            [String(selectedImageId)]: {
              ...(overlayLayoutsRef.current[String(selectedImageId)] ||
                DEFAULT_LAYOUT_CONFIG),
              ...currentLayoutRuntime,
            },
          }
        : {}),
    };
    const payloadAnchoredOverlays = [
      ...Object.values(anchoredOverlaysRef.current).filter(
        (item) =>
          String(item?.imageId ?? "") !==
            String(currentSnapshot?.imageId ?? "") && hasAnchoredGeometry(item),
      ),
      ...(hasAnchoredGeometry(currentSnapshot) ? [currentSnapshot] : []),
    ];
    const overlayImageIds = new Set(
      payloadAnchoredOverlays.map((overlay) => String(overlay.imageId)),
    );
    const serializedLayouts = serializeOverlayLayouts(
      layoutSource,
      runtimeByImage,
      overlayImageIds,
    );

    if (
      currentConfig?.visible &&
      projectGeometry &&
      !payloadAnchoredOverlays.length
    ) {
      const projectCount = currentSnapshot?.projectPolygonPixels?.length || 0;
      const sphericalProjectCount =
        currentSnapshot?.projectPolygon?.length || 0;
      const lotCount = (currentSnapshot?.lotPolygons || []).length;
      window.alertError?.(
        `No se pudo anclar el overlay 2D a la esfera 360. Proyecto: ${Math.max(projectCount, sphericalProjectCount)} puntos validos, lotes: ${lotCount}. No se subio el tour. Ajusta el overlay dentro de la vista 360 e intenta otra vez.`,
      );
      return;
    }

    const formData = new FormData();
    formData.append("idproyecto", idproyecto);

    draftImages.forEach((img) => {
      formData.append("draft_ids", img.id_imagen);
      formData.append("nombres", img.nombre);
      formData.append("imagenes", img.file);
    });

    formData.append(
      "conexiones",
      JSON.stringify(
        resolvableConnections.map((conexion) => ({
          origenId: conexion.origenId,
          destinoId: conexion.destinoId,
          destinoNombre: conexion.destinoNombre,
          yaw: conexion.yaw,
          pitch: conexion.pitch,
        })),
      ),
    );

    setSavingTour(true);
    try {
      const res = await authFetch(
        buildApiUrl("/api/guardar_tour_360_completo/"),
        {
          method: "POST",
          body: formData,
          telegramContext: {
            action: `Intento de guardar tour 360 del proyecto ${idproyecto}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error(
          await getResponseErrorMessage(res, "No se pudo guardar el tour 360."),
        );
      }
      const data = await res.json().catch(() => ({}));

      if (skippedConnections > 0) {
        window.alertInfo?.(
          `${skippedConnections} conexion(es) no se enviaron porque apuntaban a imagenes temporales que no estaban en este guardado.`,
        );
      }

      const imageMap = data.image_map || {};
      const savedImagesByDraft = new Map(
        (data.imagenes || []).map((img) => [img.draft_id, img]),
      );
      // Strip SVG-only fields before saving — viewer only needs points, not pre-built path strings
      const geometryForPayload = projectGeometry
        ? {
            projectPoints: projectGeometry.projectPoints,
            lotes: (projectGeometry.lotes || []).map((lote) => {
              const payloadLote = { ...lote };
              delete payloadLote.path;
              return payloadLote;
            }),
          }
        : null;

      const remappedUserDrawings = {};
      Object.entries(userDrawings).forEach(([imgId, shapes]) => {
        const newId = remapImageId(imgId, imageMap);
        if (newId && shapes?.length) remappedUserDrawings[newId] = shapes;
      });

      const remappedAdditionalOverlays = {};
      Object.entries(additionalOverlayInstancesRef.current).forEach(([imgId, instances]) => {
        if (!instances?.length) return;
        const newId = remapImageId(imgId, imageMap);
        if (newId) remappedAdditionalOverlays[newId] = instances.map((inst) => ({ ...inst, imageId: newId }));
      });

      const resolvedOverlayPayload = {
        geometry: geometryForPayload,
        clearMissingOverlays: true,
        layouts: serializedLayouts.map((layout) => ({
          ...layout,
          imageId: remapImageId(layout.imageId, imageMap),
        })),
        anchoredOverlays: payloadAnchoredOverlays.map((overlay) => ({
          ...overlay,
          imageId: remapImageId(overlay.imageId, imageMap),
        })),
        annotations: annotations.map((a) => ({
          ...a,
          imageId: remapImageId(String(a.imageId), imageMap),
        })),
        userDrawings: remappedUserDrawings,
        additionalOverlays: remappedAdditionalOverlays,
      };

      if (
        resolvedOverlayPayload.layouts.length ||
        resolvedOverlayPayload.anchoredOverlays.length ||
        Object.keys(resolvedOverlayPayload.userDrawings).length
      ) {
        const overlayUpdateForm = new FormData();
        overlayUpdateForm.append("idproyecto", idproyecto);
        overlayUpdateForm.append("conexiones", JSON.stringify([]));
        overlayUpdateForm.append(
          "overlays_2d",
          JSON.stringify(resolvedOverlayPayload),
        );

        const overlayRes = await authFetch(
          buildApiUrl("/api/guardar_tour_360_completo/"),
          {
            method: "POST",
            body: overlayUpdateForm,
            telegramContext: {
              action: `Intento de guardar overlay 2D del tour 360 del proyecto ${idproyecto}`,
            },
          },
        );
        if (!overlayRes.ok) {
          const overlayErr = await getResponseErrorMessage(
            overlayRes,
            "No se pudo guardar el overlay 2D.",
          );
          throw new Error(overlayErr);
        }
      }

      setImagenes((prev) =>
        prev.map((img) => {
          const saved = savedImagesByDraft.get(img.id_imagen);
          if (!saved) return img;
          return {
            ...img,
            id_imagen: saved.id_imagen,
            imagen: normalizeImageUrl(saved.imagen),
            isDraft: false,
            file: null,
          };
        }),
      );

      setConexiones((prev) =>
        prev.map((conexion) => ({
          ...conexion,
          origenId: imageMap[conexion.origenId] || conexion.origenId,
          destinoId: imageMap[conexion.destinoId] || conexion.destinoId,
        })),
      );

      setOverlayLayouts((prev) => {
        const next = {};
        Object.entries(prev).forEach(([imageId, config]) => {
          next[imageMap[imageId] || imageId] = config;
        });
        return next;
      });

      setAnchoredOverlays((prev) => {
        const next = {};
        Object.entries(prev).forEach(([imageId, overlay]) => {
          const resolvedImageId = String(imageMap[imageId] || imageId);
          next[resolvedImageId] = {
            ...overlay,
            imageId: resolvedImageId,
          };
        });
        return next;
      });

      const remappedAdditionalRef = {};
      Object.entries(additionalOverlayInstancesRef.current).forEach(([imageId, instances]) => {
        const resolvedId = String(imageMap[imageId] || imageId);
        remappedAdditionalRef[resolvedId] = (instances || []).map((inst) => ({ ...inst, imageId: resolvedId }));
      });
      additionalOverlayInstancesRef.current = remappedAdditionalRef;
      setAdditionalOverlayInstances(() => ({ ...remappedAdditionalRef }));

      setSelectedImg((prev) => {
        if (!prev) return prev;
        const saved = savedImagesByDraft.get(prev.id_imagen);
        if (!saved) return prev;
        return {
          ...prev,
          id_imagen: saved.id_imagen,
          imagen: normalizeImageUrl(saved.imagen),
          isDraft: false,
          file: null,
        };
      });

      // Ya publicado: el borrador local quedaría desactualizado/redundante frente
      // a lo que ahora vive en el backend, así que se descarta para no ofrecer
      // restaurar datos viejos en la próxima sesión.
      clearLocalDraft(idproyecto);
      setLocalDraftSavedAt(null);

      window.alertSuccess?.("Tour 360 y overlay 2D guardados correctamente.");
    } catch (error) {
      console.error(error);
      window.alertError?.(error.message || "No se pudo guardar el tour 360.");
    } finally {
      setSavingTour(false);
    }
  };

  useEffect(() => {
    return () => {
      if (overlayDragFrameRef.current) {
        cancelAnimationFrame(overlayDragFrameRef.current);
      }
      if (groupDragFrameRef.current) {
        cancelAnimationFrame(groupDragFrameRef.current);
      }
      batchItemsRef.current.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
      imagenesRef.current.forEach((img) => {
        if (img.isDraft && img.imagen?.startsWith("blob:")) {
          URL.revokeObjectURL(img.imagen);
        }
      });
    };
  }, []);

  // Keyboard shortcuts while overlay is in edit mode
  useEffect(() => {
    if (!layoutEditMode || !selectedOverlayConfig?.visible) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undoOverlayConfig(); return; }
      const step = e.shiftKey ? 1 : 10;
      const scaleStep = e.shiftKey ? 0.005 : 0.02;
      const rotStep = e.shiftKey ? 0.5 : 5;
      const cfg = selectedOverlayConfigRef.current || {};
      if (e.key === "ArrowLeft")  { e.preventDefault(); updateSelectedOverlayConfig({ x: (cfg.x ?? 70) - step }); }
      if (e.key === "ArrowRight") { e.preventDefault(); updateSelectedOverlayConfig({ x: (cfg.x ?? 70) + step }); }
      if (e.key === "ArrowUp")    { e.preventDefault(); updateSelectedOverlayConfig({ y: (cfg.y ?? 70) - step }); }
      if (e.key === "ArrowDown")  { e.preventDefault(); updateSelectedOverlayConfig({ y: (cfg.y ?? 70) + step }); }
      if (e.key === "[")          { e.preventDefault(); updateSelectedOverlayConfig({ scale: Math.max(0.3, (cfg.scale ?? 0.78) - scaleStep) }); }
      if (e.key === "]")          { e.preventDefault(); updateSelectedOverlayConfig({ scale: Math.min(1.8, (cfg.scale ?? 0.78) + scaleStep) }); }
      if (e.key === ",")          { e.preventDefault(); updateSelectedOverlayConfig({ rotation: (cfg.rotation ?? 0) - rotStep }); }
      if (e.key === ".")          { e.preventDefault(); updateSelectedOverlayConfig({ rotation: (cfg.rotation ?? 0) + rotStep }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // updateSelectedOverlayConfig reads from refs internally — stable enough to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutEditMode, selectedOverlayConfig?.visible]);

  const startOverlayDrag = (event) => {
    if (alignmentModeRef.current?.active) return;
    if (!layoutEditMode || !selectedOverlayConfig?.visible) return;

    event.preventDefault();
    event.stopPropagation();

    setDragState({
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: selectedOverlayConfig.x,
      y: selectedOverlayConfig.y,
    });
  };

  const handleOverlayPointerMove = (event) => {
    if (!dragState) return;

    const deltaX = event.clientX - dragState.pointerX;
    const deltaY = event.clientY - dragState.pointerY;
    const newX = Math.round(dragState.x + deltaX);
    const newY = Math.round(dragState.y + deltaY);
    overlayDragPatchRef.current = { x: newX, y: newY };

    // Update the card transform directly via DOM — bypasses React render loop for smooth 60fps drag
    if (overlayCardRef.current) {
      const tempConfig = { ...(selectedOverlayConfigRef.current || DEFAULT_LAYOUT_CONFIG), x: newX, y: newY };
      overlayCardRef.current.style.transform = buildOverlayCssTransform(tempConfig);
      return;
    }

    if (overlayDragFrameRef.current) return;
    overlayDragFrameRef.current = requestAnimationFrame(() => {
      overlayDragFrameRef.current = null;
      const patch = overlayDragPatchRef.current;
      overlayDragPatchRef.current = null;
      if (patch) updateSelectedOverlayConfig(patch);
    });
  };

  const stopOverlayDrag = () => {
    if (overlayDragFrameRef.current) {
      cancelAnimationFrame(overlayDragFrameRef.current);
      overlayDragFrameRef.current = null;
    }
    if (overlayDragPatchRef.current) {
      updateSelectedOverlayConfig(overlayDragPatchRef.current);
      overlayDragPatchRef.current = null;
    }
    if (groupDragFrameRef.current) {
      cancelAnimationFrame(groupDragFrameRef.current);
      groupDragFrameRef.current = null;
    }
    if (groupDragPatchRef.current) {
      updateGroupEdit(groupDragPatchRef.current);
      groupDragPatchRef.current = null;
    }
    if (anchoredGroupDragFrameRef.current) {
      cancelAnimationFrame(anchoredGroupDragFrameRef.current);
      anchoredGroupDragFrameRef.current = null;
    }
    if (anchoredGroupDragPatchRef.current) {
      updateSphericalGroupEdit(anchoredGroupDragPatchRef.current);
      anchoredGroupDragPatchRef.current = null;
    }
    if (vertexDragFrameRef.current) {
      cancelAnimationFrame(vertexDragFrameRef.current);
      vertexDragFrameRef.current = null;
    }
    if (vertexDragPatchRef.current) {
      const patch = vertexDragPatchRef.current;
      vertexDragPatchRef.current = null;
      updateGroupEdit({
        vertexOffsets: {
          ...groupEditRef.current.vertexOffsets,
          [patch.key]: { dx: patch.dx, dy: patch.dy },
        },
      });
    }
    if (dragState) setDragState(null);
    if (groupDragState) setGroupDragState(null);
    if (anchoredGroupDragState) setAnchoredGroupDragState(null);
    if (vertexDragState) setVertexDragState(null);
  };

  useEffect(() => {
    if (!dragState && !groupDragState && !anchoredGroupDragState && !vertexDragState)
      return undefined;

    const handleWindowMouseMove = (event) => {
      handleOverlayPointerMove(event);
      handleGroupPointerMove(event);
      handleAnchoredGroupPointerMove(event);
      handleVertexPointerMove(event);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", stopOverlayDrag);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", stopOverlayDrag);
    };
  }, [dragState, groupDragState, anchoredGroupDragState, vertexDragState]);

  const updateGroupEdit = (patch) => {
    const next = { ...groupEditRef.current, ...patch };
    groupEditRef.current = next;
    setGroupEdit(next);
  };

  const updateSphericalGroupEdit = (patch) => {
    const next = { ...sphericalGroupEditRef.current, ...patch };
    sphericalGroupEditRef.current = next;
    setSphericalGroupEdit(next);
  };

  const clearGroupSelection = () => {
    selectedLotIdsRef.current = new Set();
    setSelectedLotIds(new Set());
    setGroupEdit(DEFAULT_GROUP_EDIT);
    groupEditRef.current = DEFAULT_GROUP_EDIT;
    setSphericalGroupEdit(DEFAULT_SPHERICAL_GROUP_EDIT);
    sphericalGroupEditRef.current = DEFAULT_SPHERICAL_GROUP_EDIT;
    groupEditBaseRef.current = {};
  };

  // "Confirmar y deseleccionar" en el panel plano (tarjeta flotante, antes de anclar
  // todo el plano a la foto): además de congelar la transformación del grupo, proyecta
  // cada lote confirmado a coordenadas esféricas (yaw/pitch) con la cámara actual y lo
  // promueve a marcador fijo real (igual que una instancia "+ Añadir mapa 2D"), para que
  // quede pegado a la foto — como en el visor público — y ya no responda a mover/zoom
  // de la cámara ni a la tarjeta flotante. Si el ocultar ("Ocultar" pasa visible:false)
  // o si la proyección falla (cámara no lista), se conserva el comportamiento anterior
  // (sólo congelar los puntos dentro del overlay flotante) para no perder el ajuste.
  const commitGroupEdit = (extraOverride = {}) => {
    const activeSelectedIds = selectedLotIdsRef.current;
    const activeGroupEdit = groupEditRef.current;
    const baseOverrides = groupEditBaseRef.current;
    if (activeSelectedIds.size === 0 || !projectGeometry) return;
    pushOverlayUndoSnapshot(selectedImageId);
    const gc = computeGroupCentroid(
      projectGeometry.lotes,
      activeSelectedIds,
      baseOverrides,
    );

    const isHidingOnly = extraOverride.visible === false;
    const fixedLotPolygons = [];
    const fixedLoteIds = new Set();
    const finalPtsByLote = {};

    projectGeometry.lotes.forEach((lote, loteIndex) => {
      const loteId = getLoteKey(lote, loteIndex);
      if (!activeSelectedIds.has(loteId)) return;
      const base = baseOverrides[loteId] ?? {};
      const basePts = applyLotSvgTransform(lote.points || [], base);
      const baseKeys = basePts.map((p) => getVertexKey(p.x, p.y));
      const finalPts = applyVertexOffsetsToPoints(
        applyGroupTransformWithTiltToPoints(basePts, gc.cx, gc.cy, activeGroupEdit),
        baseKeys,
        activeGroupEdit.vertexOffsets,
      );
      finalPtsByLote[loteId] = finalPts;

      if (isHidingOnly) return;
      const anchoredPts = finalPts
        .map((p) => convertOverlayLayoutPointToAnchored(p))
        .filter((p) => p?.spherical);
      if (anchoredPts.length >= 3) {
        fixedLoteIds.add(loteId);
        fixedLotPolygons.push({
          idlote: getLoteId(lote),
          nombre: lote.nombre,
          precio: lote.precio,
          moneda: lote.moneda,
          area_total_m2: lote.area_total_m2,
          ancho: lote.ancho,
          largo: lote.largo,
          color: lote.color,
          vendido: lote.vendido,
          textureMode:
            activeGroupEdit.textureMode ??
            base.textureMode ??
            selectedOverlayConfig?.textureMode ??
            "solid",
          lotOpacity:
            activeGroupEdit.opacity ??
            base.opacity ??
            selectedOverlayConfig?.lotOpacity ??
            0.82,
          polygon: anchoredPts.map((p) => p.spherical),
          polygonPixels: anchoredPts.map((p) => p.pixels).filter(Boolean),
        });
      }
    });

    if (fixedLotPolygons.length) {
      const instanceId = `fixed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newInstance = {
        imageId: selectedImageId,
        instanceId,
        visible: true,
        showProjectOutline: false,
        textureMode: "solid",
        lotOpacity: selectedOverlayConfig?.lotOpacity ?? 0.82,
        projectPolygon: [],
        projectPolygonPixels: [],
        lotPolygons: fixedLotPolygons,
      };
      const current = additionalOverlayInstancesRef.current[selectedImageId] || [];
      const updated = [...current, newInstance];
      additionalOverlayInstancesRef.current = {
        ...additionalOverlayInstancesRef.current,
        [selectedImageId]: updated,
      };
      setAdditionalOverlayInstances((prev) => ({
        ...prev,
        [selectedImageId]: updated,
      }));
    }

    setOverlayLayouts((prev) => {
      const cfg = prev[selectedImageId] || DEFAULT_LAYOUT_CONFIG;
      const newOverrides = { ...(cfg.lotOverrides ?? {}) };

      projectGeometry.lotes.forEach((lote, loteIndex) => {
        const loteId = getLoteKey(lote, loteIndex);
        if (!activeSelectedIds.has(loteId)) return;
        const {
          committedCardTransform: _unusedCommittedCardTransform,
          ...previousOverride
        } = newOverrides[loteId] ?? {};

        if (fixedLoteIds.has(loteId)) {
          // Promovido a marcador fijo anclado a la foto: se quita del overlay
          // flotante (anchoredFixed) en vez de quedar como committedPoints.
          newOverrides[loteId] = {
            ...previousOverride,
            anchoredFixed: true,
          };
          return;
        }

        newOverrides[loteId] = {
          ...previousOverride,
          committedPoints: finalPtsByLote[loteId],
          ...(activeGroupEdit.opacity !== null
            ? { opacity: activeGroupEdit.opacity }
            : {}),
          ...(activeGroupEdit.textureMode !== null
            ? { textureMode: activeGroupEdit.textureMode }
            : {}),
          ...extraOverride,
        };
      });
      return {
        ...prev,
        [selectedImageId]: { ...cfg, lotOverrides: newOverrides },
      };
    });

    if (viewerInstance.current) renderHotspots();
  };

  // Equivalente a commitGroupEdit pero en espacio esférico (yaw/pitch), para el modo
  // "ajuste fino sobre el tour": guarda los puntos finales ya anclados a la foto.
  const commitSphericalGroupEdit = (extraOverride = {}) => {
    const activeSelectedIds = selectedLotIdsRef.current;
    const activeSphericalGroupEdit = sphericalGroupEditRef.current;
    const baseOverrides = groupEditBaseRef.current;
    const viewer = viewerInstance.current;
    if (activeSelectedIds.size === 0 || !projectGeometry || !viewer) return;
    pushOverlayUndoSnapshot(selectedImageId);

    const cachedSnapshot =
      anchoredOverlaysRef.current[String(selectedImageId)] ||
      anchoredOverlays[String(selectedImageId)] ||
      null;

    const getLoteBaseSpherical = (lote, override, loteId) => {
      if (override.committedSphericalPoints?.length >= 3) {
        return override.committedSphericalPoints.map(([yaw, pitch]) => ({
          yaw,
          pitch,
        }));
      }
      const cachedLote = cachedSnapshot?.lotPolygons?.find(
        (l) => String(l.idlote ?? "") === loteId,
      );
      if (cachedLote?.polygon?.length >= 3) {
        return cachedLote.polygon.map(([yaw, pitch]) => ({ yaw, pitch }));
      }
      return applyLotSvgTransform(lote.points || [], override)
        .map(convertOverlayLayoutPointToAnchored)
        .filter((point) => point?.spherical)
        .map((point) => ({ yaw: point.spherical[0], pitch: point.spherical[1] }));
    };

    const allBasePoints = [];
    const basePtsByLote = {};
    projectGeometry.lotes.forEach((lote, loteIndex) => {
      const loteId = getLoteKey(lote, loteIndex);
      if (!activeSelectedIds.has(loteId)) return;
      const base = baseOverrides[loteId] ?? {};
      const pts = getLoteBaseSpherical(lote, base, loteId);
      basePtsByLote[loteId] = pts;
      allBasePoints.push(...pts);
    });
    if (!allBasePoints.length) return;
    const centroid = getSphericalCentroid(allBasePoints);

    setOverlayLayouts((prev) => {
      const cfg = prev[selectedImageId] || DEFAULT_LAYOUT_CONFIG;
      const newOverrides = { ...(cfg.lotOverrides ?? {}) };

      Object.entries(basePtsByLote).forEach(([loteId, basePts]) => {
        const finalPts = applySphericalGroupTransform(
          basePts,
          centroid.yaw,
          centroid.pitch,
          activeSphericalGroupEdit,
        );
        const previousOverride = newOverrides[loteId] ?? {};

        newOverrides[loteId] = {
          ...previousOverride,
          committedSphericalPoints: finalPts.map((p) => [p.yaw, p.pitch]),
          ...(activeSphericalGroupEdit.opacity !== null
            ? { opacity: activeSphericalGroupEdit.opacity }
            : {}),
          ...(activeSphericalGroupEdit.textureMode !== null
            ? { textureMode: activeSphericalGroupEdit.textureMode }
            : {}),
          ...extraOverride,
        };
      });
      return {
        ...prev,
        [selectedImageId]: { ...cfg, lotOverrides: newOverrides },
      };
    });
  };

  // Si hay una edición de bloque (grupo de lotes) pendiente de confirmar, la guarda
  // antes de cambiar de imagen o salir del modo edición. Sin esto, el ajuste visible
  // en pantalla (escala/rotación/inclinación del grupo) se perdía en silencio si el
  // usuario no presionaba "Confirmar y deseleccionar" explícitamente.
  const commitPendingGroupEditIfAny = () => {
    if (selectedLotIdsRef.current.size === 0) return;
    if (anchoredEditModeRef.current) commitSphericalGroupEdit();
    else commitGroupEdit();
    clearGroupSelection();
  };

  const toggleLotSelection = (loteId) => {
    setSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(loteId)) {
        next.delete(loteId);
      } else {
        if (next.size === 0) {
          // Starting a new group session — snapshot current lotOverrides as base
          groupEditBaseRef.current = {
            ...(selectedOverlayConfig?.lotOverrides ?? {}),
          };
          groupEditRef.current = DEFAULT_GROUP_EDIT;
          setGroupEdit(DEFAULT_GROUP_EDIT);
          sphericalGroupEditRef.current = DEFAULT_SPHERICAL_GROUP_EDIT;
          setSphericalGroupEdit(DEFAULT_SPHERICAL_GROUP_EDIT);
        }
        next.add(loteId);
      }
      selectedLotIdsRef.current = next;
      return next;
    });
  };

  // Selección por rectángulo (marquee), estilo Windows: se activa con el botón
  // "Selección múltiple" y se dibuja manteniendo Ctrl/Cmd + arrastrar sobre el visor.
  // El visor 360 ya está congelado (sin pan/zoom) mientras layoutEditMode está activo,
  // así que el rectángulo se dibuja en píxeles del visor, sin importar dónde esté
  // posicionado/escalado el overlay del plano 2D.
  const marqueeRef = useRef(null);

  useEffect(() => {
    if (!selectionToolActive) {
      marqueeRef.current = null;
      setMarqueeDragging(false);
      setMarqueeState(null);
    }
  }, [selectionToolActive]);

  useEffect(() => {
    if (!layoutEditMode || alignmentMode.active) setSelectionToolActive(false);
  }, [layoutEditMode, alignmentMode.active]);

  // Arrastre con click derecho para seguir mirando alrededor mientras el visor está
  // congelado (modo edición / alineación). El click izquierdo queda reservado para
  // arrastrar el overlay/lotes o, con Ctrl, para la selección por rectángulo.
  const rightDragRef = useRef(null);

  const startViewerRightDrag = (e) => {
    // Solo hace falta cuando la cámara está congelada (tarjeta flotante / alineación).
    // En anchoredEditMode la cámara ya se mueve libre con el click izquierdo normal.
    if ((!layoutEditMode || anchoredEditMode) && !alignmentMode.active) return;
    const viewer = viewerInstance.current;
    if (!viewer) return;
    e.preventDefault();
    e.stopPropagation();
    const startPos = viewer.getPosition();
    rightDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startYaw: startPos.yaw,
      startPitch: startPos.pitch,
    };

    const handleMove = (moveEvent) => {
      const drag = rightDragRef.current;
      const v = viewerInstance.current;
      if (!drag || !v) return;
      const width = viewerRef.current?.clientWidth || v.state?.size?.width || 1;
      const height = viewerRef.current?.clientHeight || v.state?.size?.height || 1;
      const hFovRad = ((Number(v.state?.hFov) || 90) * Math.PI) / 180;
      const vFovRad = ((Number(v.state?.vFov) || 70) * Math.PI) / 180;
      const dx = moveEvent.clientX - drag.startX;
      const dy = moveEvent.clientY - drag.startY;
      const yaw = drag.startYaw - (dx / width) * hFovRad;
      const pitch = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, drag.startPitch + (dy / height) * vFovRad),
      );
      v.rotate({ yaw, pitch });
    };

    const handleUp = () => {
      rightDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleViewerFrameContextMenu = (e) => {
    if (layoutEditMode || alignmentMode.active) e.preventDefault();
  };

  const handleViewerFrameMouseDownCapture = (e) => {
    if (e.button === 2) {
      startViewerRightDrag(e);
      return;
    }
    if (!selectionToolActive || !layoutEditMode || alignmentMode.active) return;
    if (!e.ctrlKey && !e.metaKey) return;
    if (!viewerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = viewerRef.current.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    marqueeRef.current = { ox, oy, cx: ox, cy: oy };
    setMarqueeState({ x: ox, y: oy, w: 0, h: 0 });
    setMarqueeDragging(true);
  };

  useEffect(() => {
    if (!marqueeDragging) return undefined;

    const handleMove = (e) => {
      if (!marqueeRef.current || !viewerRef.current) return;
      const rect = viewerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      marqueeRef.current.cx = cx;
      marqueeRef.current.cy = cy;
      const { ox, oy } = marqueeRef.current;
      setMarqueeState({
        x: Math.min(ox, cx),
        y: Math.min(oy, cy),
        w: Math.abs(cx - ox),
        h: Math.abs(cy - oy),
      });
    };

    const handleUp = () => {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      setMarqueeDragging(false);
      setMarqueeState(null);
      if (!m || !projectGeometry?.lotes) return;

      const minX = Math.min(m.ox, m.cx), maxX = Math.max(m.ox, m.cx);
      const minY = Math.min(m.oy, m.cy), maxY = Math.max(m.oy, m.cy);
      if (maxX - minX < 4 && maxY - minY < 4) return; // demasiado pequeño — se trata como click

      const config = selectedOverlayConfigRef.current || selectedOverlayConfig;
      if (!config) return;

      const toAdd = [];

      if (anchoredEditModeRef.current) {
        // Modo zoom: en vez de recalcular la posición de cada lote (matemática que
        // depende de la cámara y fallaba), leemos directo del DOM dónde quedó
        // dibujado CADA marcador del visor — es la fuente de verdad: si lo ves ahí
        // en pantalla, ahí es donde se hace el test, sin proyecciones propias.
        const viewer = viewerInstance.current;
        const markers = viewer?.getPlugin?.(viewerRuntimeRef.current?.MarkersPlugin);
        const viewerEl = viewerRef.current;
        if (!markers || !viewerEl) return;
        const viewerRect = viewerEl.getBoundingClientRect();
        markers.getMarkers().forEach((marker) => {
          if (marker?.data?.type !== "lot") return;
          const loteId = marker.data.loteId;
          if (!loteId) return;
          const el = marker.domElement;
          if (!el) return;
          const box = el.getBoundingClientRect();
          if (!box.width && !box.height) return;
          const cx = box.left + box.width / 2 - viewerRect.left;
          const cy = box.top + box.height / 2 - viewerRect.top;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
            toAdd.push(String(loteId));
          }
        });
      } else {
        const runtime = getCurrentOverlayRuntime();
        if (!runtime) return;
        projectGeometry.lotes.forEach((lote, index) => {
          const loteId = getLoteKey(lote, index);
          const override = config.lotOverrides?.[loteId] ?? {};
          // Los lotes ya confirmados/fijados a la foto se excluyen de la selección
          // por rectángulo: ya no viven en el plano flotante, así que probar su
          // posición cruda (sin transformar) producía falsos positivos que los
          // hacían "reaparecer" en su posición original al quedar atrapados en un
          // rectángulo nuevo cercano.
          if (override.visible === false || override.anchoredFixed) return;
          const basePts = override.committedPoints?.length
            ? override.committedPoints
            : applyLotSvgTransform(lote.points || [], override);
          if (!basePts.length) return;
          const centroid = getLotCentroid(basePts);
          const screenPoint = getOverlayLayoutPointScreenPosition(
            { x: centroid.cx, y: centroid.cy },
            config,
            runtime,
          );
          if (!screenPoint) return;
          if (
            screenPoint.x >= minX &&
            screenPoint.x <= maxX &&
            screenPoint.y >= minY &&
            screenPoint.y <= maxY
          ) {
            toAdd.push(loteId);
          }
        });
      }
      if (!toAdd.length) return;

      setSelectedLotIds((prev) => {
        const next = new Set(prev);
        if (next.size === 0) {
          groupEditBaseRef.current = { ...(config.lotOverrides ?? {}) };
          groupEditRef.current = DEFAULT_GROUP_EDIT;
          setGroupEdit(DEFAULT_GROUP_EDIT);
          sphericalGroupEditRef.current = DEFAULT_SPHERICAL_GROUP_EDIT;
          setSphericalGroupEdit(DEFAULT_SPHERICAL_GROUP_EDIT);
        }
        toAdd.forEach((id) => next.add(id));
        selectedLotIdsRef.current = next;
        return next;
      });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [marqueeDragging, projectGeometry, selectedOverlayConfig]);

  const startGroupDrag = (event) => {
    if (alignmentModeRef.current?.active) return;
    if (!layoutEditMode || selectedLotIds.size === 0) return;
    event.preventDefault();
    event.stopPropagation();
    setGroupDragState({
      startX: event.clientX,
      startY: event.clientY,
      baseDx: groupEditRef.current.dx,
      baseDy: groupEditRef.current.dy,
    });
  };

  // Arrastra una sola esquina del grupo seleccionado (modo plano, antes de anclar):
  // ajusta solo ese vértice — y cualquier otro lote que comparta esa misma esquina en
  // el plano original — sin tocar la escala/rotación/posición del resto del grupo.
  const startVertexDrag = (event, vertexKey) => {
    if (alignmentModeRef.current?.active) return;
    if (!layoutEditMode || selectedLotIds.size === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const current = groupEditRef.current.vertexOffsets?.[vertexKey] || { dx: 0, dy: 0 };
    setVertexDragState({
      key: vertexKey,
      startX: event.clientX,
      startY: event.clientY,
      baseDx: current.dx || 0,
      baseDy: current.dy || 0,
    });
  };

  // Arrastrar el grupo seleccionado en modo "ajuste fino sobre el tour": la
  // conversión de píxeles a yaw/pitch usa el FOV actual de la cámara, así que mover
  // el mismo tramo de mouse desplaza el lote lo mismo sin importar cuánto zoom haya.
  const startAnchoredGroupDrag = (event) => {
    if (alignmentModeRef.current?.active) return;
    if (!layoutEditMode || !anchoredEditMode || selectedLotIds.size === 0) return;
    event.preventDefault();
    event.stopPropagation();
    setAnchoredGroupDragState({
      startX: event.clientX,
      startY: event.clientY,
      baseDYaw: sphericalGroupEditRef.current.dYaw,
      baseDPitch: sphericalGroupEditRef.current.dPitch,
    });
  };

  const getWarpedViewerPointFromOverlayPoint = (point, config) => {
    const viewerElement = viewerRef.current;
    const overlaySvg = overlaySvgRef.current;
    if (!viewerElement || !overlaySvg) return null;

    const svgWidth =
      overlaySvg.clientWidth ||
      overlaySvg.viewBox?.baseVal?.width ||
      OVERLAY_VIEWBOX.width;
    const svgHeight =
      overlaySvg.clientHeight ||
      overlaySvg.viewBox?.baseVal?.height ||
      OVERLAY_VIEWBOX.height;
    const localPoint = {
      x:
        (overlaySvg.offsetLeft || 0) +
        (point.x / OVERLAY_VIEWBOX.width) * svgWidth,
      y:
        getSvgTopOffsetInParent(overlaySvg) +
        (point.y / OVERLAY_VIEWBOX.height) * svgHeight,
    };
    const perspectiveOrigin =
      viewerElement.clientWidth > 0
        ? {
            x: viewerElement.clientWidth / 2,
            y: viewerElement.clientHeight / 2,
          }
        : null;
    const viewerPoint = transformOverlayPoint(
      localPoint,
      config,
      1,
      1,
      perspectiveOrigin,
    );
    return Number.isFinite(viewerPoint.x) && Number.isFinite(viewerPoint.y)
      ? viewerPoint
      : null;
  };

  const buildScreenPathFromPoints = (points, config) =>
    (points || [])
      .map((point) => getWarpedViewerPointFromOverlayPoint(point, config))
      .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");

  const handleWarpedPlanAlignmentClick = (event, config) => {
    const currentAlignment = alignmentModeRef.current;
    if (
      !currentAlignment?.active ||
      (currentAlignment.step !== "plan" && currentAlignment.step !== "review")
    )
      return;

    event.preventDefault();
    event.stopPropagation();

    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    const candidates = alignmentSnapCandidates
      .map((candidate) => {
        const viewerPoint = getWarpedViewerPointFromOverlayPoint(
          candidate,
          config,
        );
        if (!viewerPoint) return null;
        return {
          ...candidate,
          viewerPoint,
          distance: Math.hypot(
            viewerPoint.x - clickPoint.x,
            viewerPoint.y - clickPoint.y,
          ),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance || a.priority - b.priority);

    const best = candidates[0];
    if (!best || best.distance > SNAP_THRESHOLD_PX * 1.75) {
      setAlignmentMode((prev) => ({
        ...prev,
        error:
          "Marca un vertice o centroide visible del plano para agregar otro punto.",
      }));
      return;
    }

    const source = {
      ...best,
      snapped: true,
    };
    const sourceLayout = getPlanSourceLayoutPoint(source);
    if (!sourceLayout) return;

    setAlignmentMode((prev) => ({
      ...prev,
      step: "viewer",
      pendingPlanPoint: {
        source,
        sourceLayout,
      },
      error: null,
    }));
  };

  const handleGroupPointerMove = (event) => {
    if (!groupDragState || !overlaySvgRef.current) return;
    const svgEl = overlaySvgRef.current;
    const scaleX =
      OVERLAY_VIEWBOX.width / (svgEl.clientWidth || OVERLAY_VIEWBOX.width);
    const scaleY =
      OVERLAY_VIEWBOX.height / (svgEl.clientHeight || OVERLAY_VIEWBOX.height);
    const dxSvg = (event.clientX - groupDragState.startX) * scaleX;
    const dySvg = (event.clientY - groupDragState.startY) * scaleY;
    groupDragPatchRef.current = {
      dx: groupDragState.baseDx + dxSvg,
      dy: groupDragState.baseDy + dySvg,
    };

    if (groupDragFrameRef.current) return;
    groupDragFrameRef.current = requestAnimationFrame(() => {
      groupDragFrameRef.current = null;
      const patch = groupDragPatchRef.current;
      groupDragPatchRef.current = null;
      if (patch) updateGroupEdit(patch);
    });
  };

  const handleVertexPointerMove = (event) => {
    if (!vertexDragState || !overlaySvgRef.current) return;
    const svgEl = overlaySvgRef.current;
    const scaleX =
      OVERLAY_VIEWBOX.width / (svgEl.clientWidth || OVERLAY_VIEWBOX.width);
    const scaleY =
      OVERLAY_VIEWBOX.height / (svgEl.clientHeight || OVERLAY_VIEWBOX.height);
    const dxSvg = (event.clientX - vertexDragState.startX) * scaleX;
    const dySvg = (event.clientY - vertexDragState.startY) * scaleY;
    vertexDragPatchRef.current = {
      key: vertexDragState.key,
      dx: vertexDragState.baseDx + dxSvg,
      dy: vertexDragState.baseDy + dySvg,
    };

    if (vertexDragFrameRef.current) return;
    vertexDragFrameRef.current = requestAnimationFrame(() => {
      vertexDragFrameRef.current = null;
      const patch = vertexDragPatchRef.current;
      vertexDragPatchRef.current = null;
      if (patch) {
        updateGroupEdit({
          vertexOffsets: {
            ...groupEditRef.current.vertexOffsets,
            [patch.key]: { dx: patch.dx, dy: patch.dy },
          },
        });
      }
    });
  };

  const handleAnchoredGroupPointerMove = (event) => {
    if (!anchoredGroupDragState) return;
    const viewer = viewerInstance.current;
    if (!viewer) return;
    const width = viewerRef.current?.clientWidth || 1;
    const height = viewerRef.current?.clientHeight || 1;
    const hFovRad = ((Number(viewer.state?.hFov) || 90) * Math.PI) / 180;
    const vFovRad = ((Number(viewer.state?.vFov) || 70) * Math.PI) / 180;
    const dx = event.clientX - anchoredGroupDragState.startX;
    const dy = event.clientY - anchoredGroupDragState.startY;
    anchoredGroupDragPatchRef.current = {
      dYaw: anchoredGroupDragState.baseDYaw + (dx / width) * hFovRad,
      dPitch: anchoredGroupDragState.baseDPitch - (dy / height) * vFovRad,
    };

    if (anchoredGroupDragFrameRef.current) return;
    anchoredGroupDragFrameRef.current = requestAnimationFrame(() => {
      anchoredGroupDragFrameRef.current = null;
      const patch = anchoredGroupDragPatchRef.current;
      anchoredGroupDragPatchRef.current = null;
      if (patch) updateSphericalGroupEdit(patch);
    });
  };

  const renderImportedOverlay = () => {
    const renderOverlayConfig =
      layoutEditMode || alignmentMode.active
        ? selectedOverlayConfig
        : deferredOverlayConfig || selectedOverlayConfig;
    const renderGroupEdit = deferredGroupEdit || groupEdit;
    if (!renderOverlayConfig?.visible || !projectGeometry) return null;

    const {
      opacity,
      tiltX = 0,
      tiltY = 0,
      perspectiveDepth = 900,
      textureMode = "solid",
      showShadow = true,
    } = renderOverlayConfig;

    // Mantener la perspectiva fuera del transform del SVG evita que el DOM intente
    // resolver la proyección como una matriz 2D y permite guardar con el mismo modelo matemático.
    const layerPerspective =
      perspectiveDepth > 0 && (tiltX !== 0 || tiltY !== 0)
        ? perspectiveDepth
        : undefined;
    const cardTransform = buildOverlayCssTransform(renderOverlayConfig);

    const shadowFilter = showShadow
      ? "drop-shadow(0 8px 18px rgba(0,0,0,0.62)) drop-shadow(0 2px 6px rgba(0,0,0,0.45))"
      : undefined;

    const getLoteFill = (baseColor, lotTextureMode = textureMode) => {
      if (lotTextureMode === "outline") return "none";
      return baseColor;
    };
    const projectPath = renderOverlayConfig.showProjectOutline
      ? projectGeometry.projectPath ||
        buildSvgPath(projectGeometry.projectPoints || [])
      : "";
    const hasAlignmentWarp =
      !!renderOverlayConfig.alignmentWarp?.enabled &&
      (renderOverlayConfig.alignmentWarp?.pairs || []).length >=
        REQUIRED_AFFINE_POINTS &&
      viewerRef.current?.clientWidth > 0 &&
      viewerRef.current?.clientHeight > 0;
    const viewerWidth = viewerRef.current?.clientWidth || 0;
    const viewerHeight = viewerRef.current?.clientHeight || 0;
    const warpedProjectPath =
      hasAlignmentWarp && renderOverlayConfig.showProjectOutline
        ? `${buildScreenPathFromPoints(projectGeometry.projectPoints || [], renderOverlayConfig)} Z`
        : "";
    // En anchoredEditMode los lotes ya están anclados a la foto y se editan con la
    // capa interactiva esférica — la tarjeta flotante se oculta para no duplicar.
    const showFloatingCard = layoutEditMode && !anchoredEditMode;
    return (
      <div
        className={`${styles.projectOverlayLayer} ${showFloatingCard ? styles.projectOverlayEditing : ""}${alignmentMode.active && alignmentMode.step !== "viewer" ? ` ${styles.overlayActiveForAlignment}` : ""}`}
        style={
          layerPerspective
            ? { perspective: `${layerPerspective}px` }
            : undefined
        }
      >
        <div
          ref={overlayCardRef}
          className={styles.projectOverlayCard}
          style={{
            transform: cardTransform,
            opacity: hasAlignmentWarp ? 0 : showFloatingCard ? opacity : 0,
            visibility: showFloatingCard ? "visible" : "hidden",
            pointerEvents: hasAlignmentWarp || !showFloatingCard ? "none" : undefined,
            willChange: dragState ? "transform" : undefined,
          }}
          onMouseDown={startOverlayDrag}
        >
          <svg
            ref={overlaySvgRef}
            className={styles.projectOverlaySvg}
            viewBox={`0 0 ${OVERLAY_VIEWBOX.width} ${OVERLAY_VIEWBOX.height}`}
            role="img"
            aria-label="Trazos 2D del proyecto importados al editor 360"
            style={shadowFilter ? { filter: shadowFilter } : undefined}
            onClick={handlePlanAlignmentClick}
          >
            <defs />

            {alignmentMode.active && (
              <g className={styles.alignmentPointLayer}>
                {alignmentMode.pairs.map((pair, index) => (
                  <g key={`align-pair-${index}`}>
                    <circle cx={pair.source.x} cy={pair.source.y} r="13" />
                    <text x={pair.source.x} y={pair.source.y - 18}>
                      {index + 1}
                    </text>
                  </g>
                ))}
                {alignmentMode.pendingPlanPoint?.source && (
                  <g className={styles.alignmentPendingPoint}>
                    <circle
                      cx={alignmentMode.pendingPlanPoint.source.x}
                      cy={alignmentMode.pendingPlanPoint.source.y}
                      r="15"
                    />
                    <text
                      x={alignmentMode.pendingPlanPoint.source.x}
                      y={alignmentMode.pendingPlanPoint.source.y - 20}
                    >
                      {alignmentMode.pairs.length + 1}
                    </text>
                  </g>
                )}
              </g>
            )}

            {!!projectPath && (
              <path d={projectPath} className={styles.overlayProjectGlow} />
            )}
            {!!projectPath && (
              <path d={projectPath} className={styles.overlayProjectPath} />
            )}

            {/* ── Lotes NO seleccionados ── */}
            {projectGeometry.lotes.map((lote, index) => {
              const loteId = getLoteKey(lote, index);
              const override = renderOverlayConfig.lotOverrides?.[loteId] ?? {};
              if (
                override.visible === false ||
                override.anchoredFixed ||
                selectedLotIds.has(loteId)
              )
                return null;
              // Lotes confirmados se renderizan en su propio card frozen (fuera del CSS transform del card activo).
              // Usar selectedOverlayConfig (no deferred) para evitar el flash de posición base durante el render
              // de transición al confirmar.
              const currentOverride =
                selectedOverlayConfig?.lotOverrides?.[loteId];
              const effectiveLotOpacity =
                (currentOverride || override)?.opacity ??
                renderOverlayConfig.lotOpacity;
              const lotTextureMode =
                (currentOverride || override)?.textureMode ?? textureMode;

              let lotPath = lotSvgPaths[loteId] || lote.path || buildSvgPath(lote.points || []);
              let lotTransform = undefined;
              if (override?.committedPoints?.length) {
                lotPath = buildSvgPath(override.committedPoints);
              } else {
                const svgDx = Number(override.svgDx) || 0;
                const svgDy = Number(override.svgDy) || 0;
                const svgScale = Number(override.svgScale) || 1;
                if (svgDx !== 0 || svgDy !== 0 || svgScale !== 1) {
                  const { cx, cy } = getLotCentroid(lote.points || []);
                  lotTransform = `translate(${svgDx}, ${svgDy}) translate(${cx}, ${cy}) scale(${svgScale}) translate(${-cx}, ${-cy})`;
                }
              }

              return (
                <g
                  key={`unsel-${loteId}`}
                  transform={lotTransform}
                  onClick={
                    layoutEditMode && !alignmentMode.active
                      ? (e) => {
                          e.stopPropagation();
                          toggleLotSelection(loteId);
                        }
                      : undefined
                  }
                  style={{
                    color: lote.color,
                    cursor: alignmentMode.active
                      ? "crosshair"
                      : layoutEditMode
                        ? "pointer"
                        : "default",
                  }}
                >
                  <path
                    d={lotPath}
                    fill={getLoteFill(lote.color, lotTextureMode)}
                    fillOpacity={
                      lotTextureMode === "outline"
                        ? 1
                        : lotTextureMode === "transparent"
                          ? 0.35
                          : effectiveLotOpacity
                    }
                    className={styles.overlayLotePath}
                  />
                </g>
              );
            })}

            {/* ── Lotes SELECCIONADOS — cada uno con path calculado con tilt del grupo ── */}
            {selectedLotIds.size > 0 &&
              (() => {
                const base = groupEditBaseRef.current;
                const { cx: gcx, cy: gcy } = computeGroupCentroid(
                  projectGeometry.lotes,
                  selectedLotIds,
                  base,
                );
                const groupOpacity =
                  renderGroupEdit.opacity ?? renderOverlayConfig.lotOpacity;
                const groupTexture = renderGroupEdit.textureMode ?? textureMode;
                const getGLoteFill = (color) => {
                  if (groupTexture === "outline") return "none";
                  return color;
                };

                // Vértices únicos del contorno combinado: los lotes vecinos que
                // comparten una esquina en el plano original aportan la misma clave,
                // así que solo se dibuja un puntito ahí (arrastrarlo mueve a todos).
                const vertexMap = new Map();

                const lotElements = projectGeometry.lotes.map((lote, index) => {
                  const loteId = getLoteKey(lote, index);
                  const override = base[loteId] ?? {};
                  if (!selectedLotIds.has(loteId) || override.visible === false)
                    return null;
                  const basePts = applyLotSvgTransform(
                    lote.points || [],
                    override,
                  );
                  const baseKeys = basePts.map((p) => getVertexKey(p.x, p.y));
                  const projPts = applyVertexOffsetsToPoints(
                    applyGroupTransformWithTiltToPoints(basePts, gcx, gcy, renderGroupEdit),
                    baseKeys,
                    renderGroupEdit.vertexOffsets,
                  );
                  projPts.forEach((p, i) => {
                    if (!vertexMap.has(baseKeys[i])) {
                      vertexMap.set(baseKeys[i], { x: p.x, y: p.y });
                    }
                  });
                  const projPath = buildSvgPath(projPts);
                  return (
                    <g
                      key={`sel-${loteId}`}
                      onMouseDown={startGroupDrag}
                      onClick={
                        layoutEditMode && !alignmentMode.active
                          ? (e) => {
                              e.stopPropagation();
                              toggleLotSelection(loteId);
                            }
                          : undefined
                      }
                      style={{
                        color: lote.color,
                        cursor: alignmentMode.active
                          ? "crosshair"
                          : layoutEditMode
                            ? groupDragState
                              ? "grabbing"
                              : "move"
                            : "default",
                      }}
                    >
                      {/* Glow exterior */}
                      <path
                        d={projPath}
                        fill="none"
                        stroke="#5eead4"
                        strokeWidth="10"
                        strokeLinejoin="round"
                        strokeOpacity="0.3"
                      />
                      {/* Borde de selección */}
                      <path
                        d={projPath}
                        fill="rgba(94,234,212,0.26)"
                        stroke="#5eead4"
                        strokeWidth="5"
                        strokeLinejoin="round"
                      />
                      <path
                        d={projPath}
                        fill={getGLoteFill(lote.color)}
                        fillOpacity={
                          groupTexture === "outline"
                            ? 1
                            : groupTexture === "transparent"
                              ? 0.35
                              : groupOpacity
                        }
                        className={styles.overlayLotePath}
                      />
                    </g>
                  );
                });

                const vertexHandles =
                  layoutEditMode && !alignmentMode.active
                    ? [...vertexMap.entries()].map(([key, pos]) => (
                        <circle
                          key={`vertex-${key}`}
                          cx={pos.x}
                          cy={pos.y}
                          r={vertexDragState?.key === key ? 9 : 7}
                          fill="#0f172a"
                          stroke="#5eead4"
                          strokeWidth="2.5"
                          style={{ cursor: "crosshair" }}
                          onMouseDown={(e) => startVertexDrag(e, key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ))
                    : [];

                return [...lotElements, ...vertexHandles];
              })()}
          </svg>
        </div>
      </div>
    );
  };

  const renderAlignmentViewerMarkers = () => {
    if (!alignmentMode.active) return null;
    const markers = alignmentMode.pairs
      .map((pair, index) => ({ ...pair.targetViewer, index: index + 1 }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (!markers.length) return null;

    return (
      <div className={styles.alignmentViewerPointLayer} aria-hidden="true">
        {markers.map((point) => (
          <span
            key={`viewer-align-${point.index}`}
            className={styles.alignmentViewerPoint}
            style={{ left: point.x, top: point.y }}
          >
            {point.index}
          </span>
        ))}
      </div>
    );
  };

  // Lotes seleccionados en modo "ajuste fino sobre el tour": se proyectan en vivo a
  // píxeles del visor (re-calculado cada vez que la cámara gira/hace zoom, vía
  // viewerPanTick) para poder arrastrarlos/seleccionarlos sin depender del overlay
  // flotante. void viewerPanTick fuerza a este render a usar la posición actual.
  const renderAnchoredSelectionOverlay = () => {
    void viewerPanTick;
    if (!anchoredEditMode || !viewerReady || selectedLotIds.size === 0) return null;
    if (!projectGeometry?.lotes?.length) return null;
    const viewer = viewerInstance.current;
    if (!viewer) return null;

    const config = selectedOverlayConfigRef.current || selectedOverlayConfig;
    const baseOverrides = groupEditBaseRef.current;
    const cachedSnapshot =
      anchoredOverlaysRef.current[String(selectedImageId)] ||
      anchoredOverlays[String(selectedImageId)] ||
      null;

    const getLoteBaseSpherical = (lote, override, loteId) => {
      if (override.committedSphericalPoints?.length >= 3) {
        return override.committedSphericalPoints.map(([yaw, pitch]) => ({
          yaw,
          pitch,
        }));
      }
      const cachedLote = cachedSnapshot?.lotPolygons?.find(
        (l) => String(l.idlote ?? "") === loteId,
      );
      if (cachedLote?.polygon?.length >= 3) {
        return cachedLote.polygon.map(([yaw, pitch]) => ({ yaw, pitch }));
      }
      return applyLotSvgTransform(lote.points || [], override)
        .map(convertOverlayLayoutPointToAnchored)
        .filter((point) => point?.spherical)
        .map((point) => ({ yaw: point.spherical[0], pitch: point.spherical[1] }));
    };

    const basePtsByLote = {};
    const allBasePoints = [];
    projectGeometry.lotes.forEach((lote, loteIndex) => {
      const loteId = getLoteKey(lote, loteIndex);
      if (!selectedLotIds.has(loteId)) return;
      const override = baseOverrides[loteId] ?? {};
      const pts = getLoteBaseSpherical(lote, override, loteId);
      if (pts.length >= 3) {
        basePtsByLote[loteId] = pts;
        allBasePoints.push(...pts);
      }
    });
    if (!allBasePoints.length) return null;

    const centroid = getSphericalCentroid(allBasePoints);
    const liveEdit = anchoredGroupDragPatchRef.current
      ? { ...sphericalGroupEdit, ...anchoredGroupDragPatchRef.current }
      : sphericalGroupEdit;
    const groupTexture = liveEdit.textureMode ?? config?.textureMode ?? "solid";
    const groupOpacity = liveEdit.opacity ?? config?.lotOpacity ?? 0.82;

    return (
      <svg
        className={styles.anchoredSelectionLayer}
        style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
      >
        {Object.entries(basePtsByLote).map(([loteId, basePts]) => {
          const finalPts = applySphericalGroupTransform(
            basePts,
            centroid.yaw,
            centroid.pitch,
            liveEdit,
          );
          const screenPts = finalPts
            .map(projectSphToPx)
            .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
          if (screenPts.length < 3) return null;
          const d = buildSvgPath(screenPts);
          const fill =
            groupTexture === "outline"
              ? "none"
              : (projectGeometry.lotes.find(
                  (l, idx) => getLoteKey(l, idx) === loteId,
                )?.color ?? "#22c55e");
          const fillOpacity =
            groupTexture === "outline" ? 1 : groupTexture === "transparent" ? 0.35 : groupOpacity;
          return (
            <g key={loteId}>
              <path d={d} fill="none" stroke="#5eead4" strokeWidth="10" strokeOpacity="0.3" />
              <path
                d={d}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke="#5eead4"
                strokeWidth="2.5"
                style={{
                  cursor: anchoredGroupDragState ? "grabbing" : "move",
                  pointerEvents: "auto",
                }}
                onMouseDown={startAnchoredGroupDrag}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLotSelection(loteId);
                }}
              />
            </g>
          );
        })}
      </svg>
    );
  };

  const overlayStyle = embedded
    ? {
        position: "relative",
        inset: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: 0,
        zIndex: "auto",
        display: "block",
        overflow: "visible",
      }
    : undefined;

  const contentStyle = embedded
    ? {
        width: "100%",
        maxWidth: "none",
        maxHeight: "none",
        minHeight: "auto",
        borderRadius: "24px",
        boxShadow: "none",
        border: "1px solid rgba(73, 196, 125, 0.14)",
      }
    : undefined;

  return (
    <div
      className={styles.modalOverlay}
      style={overlayStyle}
      onClick={(event) => {
        if (!embedded && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`${styles.modalContent360} ${embedded ? styles.modalContent360Embedded : ""}`}
        style={contentStyle}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal={embedded ? undefined : "true"}
        aria-labelledby="modal-360-title"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="modal-360-title">
              Tour 360 <span>#{idproyecto}</span>
            </h2>
            <p className={styles.headerText}>
              Sube vistas 360, crea hotspots y ahora importa los trazos 2D del
              proyecto para acomodarlos sobre cada imagen.
            </p>
          </div>
          {!embedded && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Cerrar modal 360"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className={styles.modalBody}>
          <div className={styles.workspace}>
            <aside className={styles.sidebar}>
              <div className={styles.sidebarSection}>
                <div className={styles.sectionTitleRow}>
                  <ImagePlus size={16} />
                  <h3>Imagenes del borrador</h3>
                </div>

                <label className={styles.btnAddFiles}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBatchFiles}
                    className={styles.hiddenInput}
                  />
                  <Upload size={20} />
                  <strong>Agregar imagenes 360</strong>
                  <span>
                    Se guardan en borrador hasta que publiques el tour.
                  </span>
                </label>

                {!!batchItems.length && (
                  <div className={styles.itemsList}>
                    {batchItems.map((item, index) => (
                      <div
                        className={styles.itemRow}
                        key={`${item.file.name}-${index}`}
                      >
                        <img
                          src={item.preview}
                          alt={item.nombre}
                          className={styles.queueThumb}
                        />
                        <input
                          value={item.nombre}
                          onChange={(event) =>
                            updateBatchItemName(index, event.target.value)
                          }
                          className={styles.inputName}
                          placeholder="Nombre de la vista"
                        />
                        <button
                          type="button"
                          className={styles.btnDel}
                          onClick={() => removeBatchItem(index)}
                          aria-label="Quitar imagen"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.btnPrimary360}
                      onClick={addBatchToDraft}
                    >
                      <Plus size={16} />
                      Guardar en borrador
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.sidebarSection}>
                <div className={styles.sectionTitleRow}>
                  <MousePointerClick size={16} />
                  <h3>Galeria</h3>
                </div>

                {!imagenes.length ? (
                  <div className={styles.emptyState}>
                    Aun no hay imagenes en el borrador.
                  </div>
                ) : (
                  <div className={styles.galleryList}>
                    {imagenes.map((img) => {
                      const imageOverlay =
                        overlayLayouts[String(img.id_imagen)];

                      return (
                        <button
                          key={img.id_imagen}
                          type="button"
                          className={`${styles.galleryItem} ${selectedImg?.id_imagen === img.id_imagen ? styles.activeItem : ""}`}
                          onClick={() => handleSelectImage(img)}
                        >
                          <img
                            src={img.imagen}
                            alt={img.nombre}
                            className={styles.galleryThumb}
                          />
                          <div className={styles.galleryMeta}>
                            <strong>{img.nombre}</strong>
                            <span>
                              {img.isDraft ? "Sin publicar" : "Publicada"}
                            </span>
                            {imageOverlay?.visible && (
                              <span className={styles.galleryOverlayTag}>
                                Con trazos 2D
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!!imagenes.length && (
                  <div className={styles.helperBox}>
                    {imagenes.length === 1
                      ? "Ya tienes la primera vista en borrador. Puedes importar trazos 2D en esta imagen o agregar otra para crear conexiones."
                      : "Selecciona una vista para importar sus trazos 2D o haz click en el visor para crear hotspots entre imagenes."}
                  </div>
                )}

                {currentImageAnnotations.length > 0 && (
                  <div>
                    <h4 style={{ margin: "12px 0 8px", fontSize: "0.94rem", color: "#6d28d9" }}>
                      Pines en esta vista ({currentImageAnnotations.length})
                    </h4>
                    <div className={styles.annotationsList}>
                      {currentImageAnnotations.map((ann) => (
                        <div key={ann.id} className={styles.annotationItem}>
                          <div className={styles.annotationItemInfo}>
                            <strong>{ann.label}</strong>
                            {ann.description && <span>{ann.description}</span>}
                          </div>
                          <button
                            type="button"
                            className={styles.btnDel}
                            onClick={() => removeAnnotation(ann.id)}
                            aria-label="Eliminar pin"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <section className={styles.viewerSection}>
              {selectedImg ? (
                <>
                  <div className={styles.viewerToolbar}>
                    <div>
                      <span className={styles.viewerBadge}>Vista activa</span>
                      <h3>{selectedImg.nombre}</h3>
                    </div>
                    <p>
                      {layoutEditMode && selectedOverlayConfig?.visible
                        ? "Modo de trazos 2D activo: arrastra el overlay y usa los controles del panel derecho."
                        : "Haz click dentro de la imagen para crear un punto en este borrador."}
                    </p>
                  </div>
                  {imagenes.length < 2 && (
                    <div className={styles.helperBox}>
                      Necesitas al menos 2 imagenes en el borrador para crear
                      una conexion entre vistas.
                    </div>
                  )}
                  <div
                    className={`${styles.viewerFrame}${alignmentMode.active && alignmentMode.step === "viewer" ? ` ${styles.viewerFrameActive}` : ""}${selectionToolActive ? ` ${styles.viewerFrameSelecting}` : ""}`}
                    onClickCapture={handleViewerAlignmentClick}
                    onMouseDownCapture={handleViewerFrameMouseDownCapture}
                    onContextMenu={handleViewerFrameContextMenu}
                  >
                    {!viewerReady && (
                      <div className={styles.viewerLoading}>
                        Cargando visor...
                      </div>
                    )}
                    <div ref={viewerRef} className={styles.viewerCanvas} />
                    {renderImportedOverlay()}
                    {renderAnchoredSelectionOverlay()}
                    {renderAlignmentViewerMarkers()}
                    {renderDrawingOverlay()}
                    {marqueeState && (
                      <div
                        className={styles.lotMarqueeBox}
                        style={{
                          left: marqueeState.x,
                          top: marqueeState.y,
                          width: marqueeState.w,
                          height: marqueeState.h,
                        }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.viewerPlaceholder}>
                  <ImagePlus size={34} />
                  <h3>Selecciona o agrega una imagen 360</h3>
                  <p>
                    La vista elegida aparecera aqui para crear hotspots y
                    superponer los trazos 2D del proyecto.
                  </p>
                </div>
              )}
            </section>

            <aside className={styles.connectionPanel}>
              <div className={styles.sectionTitleRow}>
                <Link2 size={16} />
                <h3>Conexion y trazos</h3>
              </div>

              <div className={styles.helperBox}>
                {imagenes.length} imagen(es) en borrador · {conexiones.length}{" "}
                conexion(es) creadas
              </div>

              {localDraftPrompt && (
                <div className={styles.helperBox} style={{ borderColor: "rgba(72,199,142,0.4)" }}>
                  <strong>Hay un borrador local sin publicar</strong>
                  <p style={{ margin: "4px 0 8px" }}>
                    Guardado {formatRelativeSavedAt(localDraftPrompt.savedAt)} en este navegador. ¿Lo restauras?
                  </p>
                  <div className={styles.panelActions}>
                    <button type="button" className={styles.btnPrimary360} onClick={restoreLocalDraft}>
                      <History size={14} />
                      Restaurar
                    </button>
                    <button type="button" className={styles.btnCancel} onClick={discardLocalDraft}>
                      Descartar
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                className={styles.btnPrimary360}
                onClick={saveTourToBackend}
                disabled={savingTour || !imagenes.length}
              >
                <Upload size={16} />
                {savingTour ? "Publicando..." : "Publicar tour"}
              </button>

              {localDraftSavedAt && (
                <div className={styles.helperText} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Save size={12} />
                    Borrador local guardado {formatRelativeSavedAt(localDraftSavedAt)}
                  </span>
                  <button
                    type="button"
                    className={styles.btnDel}
                    title="Borrar el borrador local guardado en este navegador"
                    onClick={discardLocalDraft}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              <div className={`${styles.panelBlock} ${styles.panelBlockExpand}`}>
                <div className={styles.sectionTitleRow}>
                  <MapIcon size={16} />
                  <h3>Trazos 2D sobre esta imagen</h3>
                </div>

                {importedOverlaySummary ? (
                  <div className={styles.overlayStats}>
                    <span>
                      {importedOverlaySummary.lotes} lotes listos para importar
                    </span>
                    <span>
                      {importedOverlaySummary.vertices} puntos del proyecto
                    </span>
                  </div>
                ) : (
                  <p className={styles.helperText}>
                    Importa el proyecto 2D para colocarlo encima de la vista
                    360, como maqueta editable.
                  </p>
                )}

                <div className={styles.panelActions}>
                  <button
                    type="button"
                    className={styles.btnPrimary360}
                    onClick={importLayoutIntoCurrentImage}
                    disabled={!selectedImg || geometryLoading}
                    title={additionalInstanceCount > 0 ? `Fija el mapa actual y añade uno nuevo (${additionalInstanceCount + 1} mapas en total tras esto)` : "Importa el plano 2D sobre esta vista 360"}
                  >
                    <MapIcon size={16} />
                    {geometryLoading ? "Importando..." : additionalInstanceCount > 0 ? `+ Añadir mapa 2D (${additionalInstanceCount} fijo${additionalInstanceCount !== 1 ? "s" : ""})` : "Importar plano 2D"}
                  </button>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={reimportGeometry}
                    disabled={geometryLoading}
                    title="Vuelve a descargar los lotes desde el plano 2D del proyecto"
                  >
                    <RotateCw size={16} />
                    {geometryLoading ? "..." : "Reimportar"}
                  </button>
                </div>
                {additionalInstanceCount > 0 && (
                  <div className={styles.panelActions}>
                    <button
                      type="button"
                      className={styles.btnCancel}
                      onClick={clearAdditionalInstancesForCurrentImage}
                      title="Elimina todos los mapas 2D fijos de esta imagen, dejando solo el actual"
                    >
                      <Trash2 size={16} />
                      Limpiar {additionalInstanceCount} mapa{additionalInstanceCount !== 1 ? "s" : ""} fijo{additionalInstanceCount !== 1 ? "s" : ""}
                    </button>
                  </div>
                )}

                {fixedInstancesForCurrentImage.length > 0 && (
                  <div className={styles.blockEditPanel}>
                    <p className={styles.blockEditCount}>
                      {fixedInstancesForCurrentImage.length} capa
                      {fixedInstancesForCurrentImage.length !== 1 ? "s" : ""} fija
                      {fixedInstancesForCurrentImage.length !== 1 ? "s" : ""} en esta foto
                    </p>
                    {fixedInstancesForCurrentImage.map((instance) => {
                      const isExpanded = expandedFixedInstanceIds.has(instance.instanceId);
                      return (
                        <div
                          key={instance.instanceId}
                          style={{
                            padding: "8px 0",
                            borderTop: "1px solid rgba(94,234,212,0.18)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              className={styles.btnCancel}
                              style={{ padding: "4px 6px" }}
                              onClick={() => toggleFixedInstanceExpanded(instance.instanceId)}
                              title={isExpanded ? "Contraer lista de lotes" : "Ver lotes de esta capa"}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <strong style={{ fontSize: "0.82rem", flex: 1 }}>
                              {instance.label} · {instance.lotes.length} lote
                              {instance.lotes.length !== 1 ? "s" : ""}
                              {!instance.visible && " (oculta)"}
                            </strong>
                            <button
                              type="button"
                              className={styles.btnCancel}
                              style={{ padding: "4px 6px" }}
                              onClick={() => toggleAdditionalInstanceVisibility(instance.instanceId)}
                              title={instance.visible ? "Ocultar solo esta capa" : "Mostrar esta capa"}
                            >
                              {instance.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button
                              type="button"
                              className={styles.btnCancel}
                              style={{ padding: "4px 6px" }}
                              onClick={() => {
                                if (window.confirm(`¿Eliminar "${instance.label}" (${instance.lotes.length} lote${instance.lotes.length !== 1 ? "s" : ""})? Esta acción no se puede deshacer.`)) {
                                  removeAdditionalInstance(instance.instanceId);
                                }
                              }}
                              title="Eliminar solo esta capa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {isExpanded && (
                            <div style={{ marginTop: 6, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                              {instance.lotes.map((lote) => (
                                <div
                                  key={`${lote.instanceId}-${lote.loteId}`}
                                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span
                                      style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: 3,
                                        background: lote.color || "#22c55e",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <strong style={{ fontSize: "0.82rem" }}>
                                      {lote.nombre || `Lote ${lote.loteId}`}
                                    </strong>
                                  </div>
                                  <div className={styles.textureSelectorRow}>
                                    {[
                                      { key: "solid", label: "Con fondo" },
                                      { key: "transparent", label: "Transparente" },
                                      { key: "outline", label: "Sin fondo" },
                                    ].map(({ key, label }) => (
                                      <button
                                        key={key}
                                        type="button"
                                        className={`${styles.textureBtn} ${lote.textureMode === key ? styles.textureBtnActive : ""}`}
                                        onClick={() =>
                                          updateFixedLotStyle(lote.instanceId, lote.loteId, {
                                            textureMode: key,
                                          })
                                        }
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.btnCancel}
                                    onClick={() => reactivateFixedLot(lote.instanceId, lote.loteId)}
                                    title="Lo saca de fijo y lo selecciona en modo zoom para volver a transformarlo"
                                  >
                                    <Move size={14} />
                                    Reactivar para editar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={styles.panelActions}>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={toggleLayoutEditMode}
                    disabled={!selectedOverlayConfig?.visible}
                  >
                    <Move size={16} />
                    {layoutEditMode
                      ? "Salir de edicion"
                      : hasAnchoredGeometry(getAnchoredOverlayForImage(selectedImageId))
                        ? "Ajuste fino (zoom)"
                        : "Editar posicion"}
                  </button>
                  {selectedOverlayConfig?.visible && imagenes.length > 1 && (
                    <button
                      type="button"
                      className={styles.btnCancel}
                      onClick={applyLayoutToAllImages}
                      title="Copia escala, rotación y opacidad del plano actual a todas las vistas"
                    >
                      <Eye size={16} />
                      Copiar a todas
                    </button>
                  )}
                  {projectGeometry?.lotes?.length > 0 && (
                    <button
                      type="button"
                      className={`${styles.btnCancel} ${selectionToolActive ? styles.btnCancelActive : ""}`}
                      onClick={() =>
                        selectionToolActive
                          ? setSelectionToolActive(false)
                          : enableSelectionTool()
                      }
                      disabled={alignmentMode.active || !selectedOverlayConfig?.visible}
                      title="Congela el visor y los lotes para seleccionar varios manteniendo Ctrl y arrastrando un rectángulo"
                    >
                      <BoxSelect size={16} />
                      {selectionToolActive ? "Selección activa" : "Selección múltiple"}
                    </button>
                  )}
                </div>

                {layoutEditMode && selectedOverlayConfig?.visible && (
                  <p
                    className={styles.helperText}
                    style={{ textAlign: "center", marginTop: -8 }}
                  >
                    Sal del modo de edición para añadir hotspots.
                  </p>
                )}

                {layoutEditMode && !anchoredEditMode && !selectionToolActive && (
                  <p
                    className={styles.helperText}
                    style={{ textAlign: "center", marginTop: -8 }}
                  >
                    El visor está congelado para no mover el plano sin querer.
                    Usa el click derecho y arrastra para mirar alrededor.
                  </p>
                )}

                {layoutEditMode && !anchoredEditMode && selectionToolActive && (
                  <p
                    className={styles.helperText}
                    style={{ textAlign: "center", marginTop: -8 }}
                  >
                    Visor y lotes congelados. Mantén Ctrl (o Cmd) y arrastra un
                    rectángulo sobre el visor para seleccionar varios lotes a la vez.
                    Usa el click derecho y arrastra para mirar alrededor.
                  </p>
                )}

                {layoutEditMode && anchoredEditMode && !selectionToolActive && (
                  <p
                    className={styles.helperText}
                    style={{ textAlign: "center", marginTop: -8 }}
                  >
                    Modo zoom: la cámara se mueve libre (arrastra con click
                    izquierdo, rueda para zoom). Click en un lote para
                    seleccionarlo y arrastra para moverlo sobre la foto.
                  </p>
                )}

                {layoutEditMode && anchoredEditMode && selectionToolActive && (
                  <p
                    className={styles.helperText}
                    style={{ textAlign: "center", marginTop: -8 }}
                  >
                    Modo zoom: cámara libre. Mantén Ctrl (o Cmd) y arrastra un
                    rectángulo sobre la foto para seleccionar varios lotes a la vez.
                  </p>
                )}


                {!layoutEditMode && !alignmentMode.active && (
                  <>
                    {selectedImg && (
                      <div className={styles.modeSwitchRow}>
                        <button
                          type="button"
                          className={`${styles.modeTab} ${!annotationMode ? styles.modeTabActive : ""}`}
                          onClick={() => {
                            setAnnotationMode(false);
                            resetPointMode();
                          }}
                        >
                          <Link2 size={13} />
                          Conexión
                        </button>
                        <button
                          type="button"
                          className={`${styles.modeTab} ${annotationMode ? styles.modeTabActive : ""}`}
                          onClick={toggleAnnotationMode}
                        >
                          <MapPin size={13} />
                          Anotar
                        </button>
                      </div>
                    )}

                    {!hasValidCoords ? (
                      selectedImg && (
                        <p
                          className={styles.helperText}
                          style={{ textAlign: "center" }}
                        >
                          {annotationMode
                            ? "Haz click en el visor para colocar un pin de anotación."
                            : "Haz click en el visor para colocar un punto nuevo."}
                        </p>
                      )
                    ) : annotationMode ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div className={styles.pointInfo}>
                          <span>Yaw: {coords.yaw.toFixed(4)}</span>
                          <span>Pitch: {coords.pitch.toFixed(4)}</span>
                        </div>
                        <input
                          type="text"
                          className={styles.inputName}
                          placeholder="Etiqueta del pin (ej: Sala de estar)"
                          value={annotationLabel}
                          onChange={(e) => setAnnotationLabel(e.target.value)}
                        />
                        <textarea
                          className={styles.inputName}
                          style={{ resize: "vertical", minHeight: 68, fontFamily: "inherit" }}
                          placeholder="Descripción (opcional)"
                          value={annotationDesc}
                          onChange={(e) => setAnnotationDesc(e.target.value)}
                          rows={3}
                        />
                        <div className={styles.panelActions}>
                          <button
                            type="button"
                            className={styles.btnCancel}
                            onClick={resetPointMode}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className={styles.btnPrimary360}
                            onClick={saveAnnotation}
                            disabled={!annotationLabel.trim()}
                          >
                            <Plus size={16} />
                            Guardar pin
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.pointInfo}>
                          <span>Yaw: {coords.yaw.toFixed(4)}</span>
                          <span>Pitch: {coords.pitch.toFixed(4)}</span>
                        </div>

                        <div>
                          <h4
                            style={{ margin: "0 0 8px", fontSize: "0.98rem" }}
                          >
                            Conectar con una imagen existente
                          </h4>
                          {!existingDestinations.length ? (
                            <p className={styles.helperText}>
                              Todavia no hay otra imagen del borrador para
                              enlazar.
                            </p>
                          ) : (
                            <div className={styles.destinationsList}>
                              {existingDestinations.map((img) => (
                                <button
                                  key={img.id_imagen}
                                  type="button"
                                  className={styles.destinationItem}
                                  onClick={(event) =>
                                    connectToExisting(img, event)
                                  }
                                >
                                  <img
                                    src={img.imagen_thumb ? normalizeImageUrl(img.imagen_thumb) : img.imagen}
                                    alt={img.nombre}
                                    className={styles.destinationThumb}
                                    loading="lazy"
                                  />
                                  <span>{img.nombre}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <h4
                            style={{ margin: "0 0 8px", fontSize: "0.98rem" }}
                          >
                            O crear una nueva imagen desde este punto
                          </h4>
                          <input
                            type="text"
                            value={newPointName}
                            onChange={(event) =>
                              setNewPointName(event.target.value)
                            }
                            className={styles.inputName}
                            placeholder="Nombre de la nueva vista"
                          />
                          <label
                            className={styles.inlineUpload}
                            style={{ marginTop: 8 }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className={styles.hiddenInput}
                              onChange={(event) =>
                                setNewPointFile(event.target.files?.[0] || null)
                              }
                            />
                            <Upload size={16} />
                            <span>
                              {newPointFile
                                ? newPointFile.name
                                : "Elegir imagen 360"}
                            </span>
                          </label>
                          <div
                            className={styles.panelActions}
                            style={{ marginTop: 8 }}
                          >
                            <button
                              type="button"
                              className={styles.btnCancel}
                              onClick={resetPointMode}
                            >
                              Cancelar punto
                            </button>
                            <button
                              type="button"
                              className={styles.btnPrimary360}
                              onClick={(event) => createAndConnectImage(event)}
                              disabled={!newPointName.trim() || !newPointFile}
                            >
                              <Plus size={16} />
                              Crear en borrador
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                  </>
                )}

                {selectedOverlayConfig ? (
                  <>
                    <div className={styles.toggleRow}>
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={toggleSelectedOverlayVisibility}
                      >
                        {selectedOverlayConfig.visible ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                        {selectedOverlayConfig.visible
                          ? "Ocultar overlay"
                          : "Mostrar overlay"}
                      </button>
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={resetOverlayForCurrentImage}
                      >
                        <RotateCw size={15} />
                        Reiniciar ajuste
                      </button>
                      {layoutEditMode && (
                        <button
                          type="button"
                          className={styles.toggleButton}
                          onClick={centerOverlayInViewer}
                          title="Centra el plano en la vista actual"
                        >
                          <Move size={15} />
                          Centrar
                        </button>
                      )}
                    </div>

                    {layoutEditMode && selectedOverlayConfig?.visible && (
                      <div className={styles.quickAdjustSection}>
                        <p className={styles.reliefSectionTitle} style={{ margin: 0 }}>
                          Posición rápida
                        </p>
                        <div className={styles.positionPresetGrid}>
                          {[
                            ["tl","↖"],["tc","↑"],["tr","↗"],
                            ["ml","←"],["mc","·"],["mr","→"],
                            ["bl","↙"],["bc","↓"],["br","↘"],
                          ].map(([key, icon]) => (
                            <button
                              key={key}
                              type="button"
                              className={`${styles.presetBtn} ${key === "mc" ? styles.presetBtnCenter : ""}`}
                              onClick={() => snapOverlayToPosition(key)}
                              title={key === "mc" ? "Centrar" : undefined}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                        <p className={styles.helperText} style={{ marginTop: 4, textAlign: "center" }}>
                          ← → ↑ ↓ mueve · [ ] escala · , . rota
                        </p>
                      </div>
                    )}

                    <div className={styles.quickAdjustSection}>
                      <p
                        className={styles.reliefSectionTitle}
                        style={{ margin: 0 }}
                      >
                        Ajuste rápido
                      </p>
                      <SliderWithInput
                        label="Tamaño del plano (%)"
                        value={selectedOverlayConfig.scale}
                        min={0.3}
                        max={1.8}
                        step={0.01}
                        numMin={30}
                        numMax={180}
                        numStep={1}
                        format={(v) => Math.round(v * 100)}
                        parse={(v) => v / 100}
                        onChange={(v) =>
                          updateSelectedOverlayConfig({ scale: v })
                        }
                        arrowStep={sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05}
                      />
                      <SliderWithInput
                        label="Rotación (°)"
                        value={selectedOverlayConfig.rotation}
                        min={-180}
                        max={180}
                        step={1}
                        onChange={(v) =>
                          updateSelectedOverlayConfig({ rotation: v })
                        }
                        arrowStep={sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5}
                      />
                    </div>

                    <button
                      type="button"
                      className={styles.toggleButton}
                      style={{ width: "100%" }}
                      onClick={() => setAdvancedMode((prev) => !prev)}
                    >
                      {advancedMode
                        ? "Ocultar ajuste fino"
                        : "Ajuste fino (opacidad, perspectiva, textura)"}
                    </button>

                    {advancedMode && (
                      <>

                        <div className={styles.sliderControl}>
                          <span className={styles.sliderLabel}>Posición manual</span>
                          <div className={styles.joystickGrid}>
                            <div />
                            <button type="button" className={styles.arrowBtn} onClick={() => updateSelectedOverlayConfig({ y: (selectedOverlayConfig.y ?? 70) - 10 })}>↑</button>
                            <div />
                            <button type="button" className={styles.arrowBtn} onClick={() => updateSelectedOverlayConfig({ x: (selectedOverlayConfig.x ?? 70) - 10 })}>←</button>
                            <div className={styles.joystickCenter}>
                              <input type="number" className={styles.numberInput} style={{ width: 44, fontSize: "0.7rem" }} step="5" value={Math.round(selectedOverlayConfig.x ?? 70)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateSelectedOverlayConfig({ x: v }); }} />
                              <input type="number" className={styles.numberInput} style={{ width: 44, fontSize: "0.7rem" }} step="5" value={Math.round(selectedOverlayConfig.y ?? 70)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateSelectedOverlayConfig({ y: v }); }} />
                            </div>
                            <button type="button" className={styles.arrowBtn} onClick={() => updateSelectedOverlayConfig({ x: (selectedOverlayConfig.x ?? 70) + 10 })}>→</button>
                            <div />
                            <button type="button" className={styles.arrowBtn} onClick={() => updateSelectedOverlayConfig({ y: (selectedOverlayConfig.y ?? 70) + 10 })}>↓</button>
                            <div />
                          </div>
                        </div>

                        <div className={styles.precisionRow}>
                          <span className={styles.precisionLabel}>Paso:</span>
                          {[
                            { key: "normal", label: "Normal" },
                            { key: "fine", label: "Fino" },
                            { key: "veryFine", label: "Muy fino" },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              className={`${styles.precisionBtn} ${sliderPrecision === key ? styles.precisionBtnActive : ""}`}
                              onClick={() => setSliderPrecision(key)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <label className={styles.rangeControl}>
                          <span>Opacidad general</span>
                          <input
                            type="range"
                            min="0.15"
                            max="1"
                            step="0.01"
                            value={selectedOverlayConfig.opacity}
                            onChange={(event) =>
                              updateSelectedOverlayConfig({
                                opacity: Number(event.target.value),
                              })
                            }
                          />
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = 0.005;
                              const v = Math.round(Math.max(0.15, selectedOverlayConfig.opacity - s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ opacity: v });
                            }}
                          >−−</button>
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05;
                              const v = Math.round(Math.max(0.15, selectedOverlayConfig.opacity - s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ opacity: v });
                            }}
                          >−</button>
                          <input
                            type="number"
                            className={styles.numberInput}
                            min="15"
                            max="100"
                            step="1"
                            value={Math.round(
                              selectedOverlayConfig.opacity * 100,
                            )}
                            onChange={(event) => {
                              const v = Number(event.target.value);
                              if (Number.isFinite(v) && v >= 15 && v <= 100)
                                updateSelectedOverlayConfig({
                                  opacity: v / 100,
                                });
                            }}
                          />
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05;
                              const v = Math.round(Math.min(1, selectedOverlayConfig.opacity + s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ opacity: v });
                            }}
                          >+</button>
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = 0.005;
                              const v = Math.round(Math.min(1, selectedOverlayConfig.opacity + s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ opacity: v });
                            }}
                          >++</button>
                        </label>

                        <label className={styles.rangeControl}>
                          <span>Relleno de lotes</span>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={selectedOverlayConfig.lotOpacity}
                            onChange={(event) =>
                              updateSelectedOverlayConfig({
                                lotOpacity: Number(event.target.value),
                              })
                            }
                          />
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = 0.005;
                              const v = Math.round(Math.max(0.1, selectedOverlayConfig.lotOpacity - s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ lotOpacity: v });
                            }}
                          >−−</button>
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05;
                              const v = Math.round(Math.max(0.1, selectedOverlayConfig.lotOpacity - s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ lotOpacity: v });
                            }}
                          >−</button>
                          <input
                            type="number"
                            className={styles.numberInput}
                            min="10"
                            max="100"
                            step="1"
                            value={Math.round(
                              selectedOverlayConfig.lotOpacity * 100,
                            )}
                            onChange={(event) => {
                              const v = Number(event.target.value);
                              if (Number.isFinite(v) && v >= 10 && v <= 100)
                                updateSelectedOverlayConfig({
                                  lotOpacity: v / 100,
                                });
                            }}
                          />
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05;
                              const v = Math.round(Math.min(1, selectedOverlayConfig.lotOpacity + s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ lotOpacity: v });
                            }}
                          >+</button>
                          <button
                            type="button"
                            className={styles.stepArrow}
                            onClick={() => {
                              const s = 0.005;
                              const v = Math.round(Math.min(1, selectedOverlayConfig.lotOpacity + s) * 1000) / 1000;
                              updateSelectedOverlayConfig({ lotOpacity: v });
                            }}
                          >++</button>
                        </label>

                        <div className={styles.toggleRow}>
                          <button
                            type="button"
                            className={styles.toggleButton}
                            onClick={() =>
                              updateSelectedOverlayConfig({
                                showProjectOutline:
                                  !selectedOverlayConfig.showProjectOutline,
                              })
                            }
                          >
                            {selectedOverlayConfig.showProjectOutline ? (
                              <EyeOff size={15} />
                            ) : (
                              <Eye size={15} />
                            )}
                            {selectedOverlayConfig.showProjectOutline
                              ? "Ocultar contorno"
                              : "Mostrar contorno"}
                          </button>
                          <button
                            type="button"
                            className={styles.toggleButton}
                            onClick={() =>
                              updateSelectedOverlayConfig({
                                showShadow: !(
                                  selectedOverlayConfig.showShadow !== false
                                ),
                              })
                            }
                          >
                            {selectedOverlayConfig.showShadow !== false ? (
                              <EyeOff size={15} />
                            ) : (
                              <Eye size={15} />
                            )}
                            {selectedOverlayConfig.showShadow !== false
                              ? "Sin sombra"
                              : "Con sombra"}
                          </button>
                        </div>

                        <div className={styles.reliefSection}>
                          <p className={styles.reliefSectionTitle}>
                            Inclinación y perspectiva
                          </p>

                          <label className={styles.rangeControl}>
                            <span title="Ajusta si el plano parece caído hacia adelante o atrás">Inclinar hacia el horizonte</span>
                            <input
                              type="range"
                              min="-60"
                              max="60"
                              step="1"
                              value={selectedOverlayConfig.tiltX ?? 0}
                              onChange={(event) =>
                                updateSelectedOverlayConfig({
                                  tiltX: Number(event.target.value),
                                })
                              }
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ tiltX: Math.max(-60, (selectedOverlayConfig.tiltX ?? 0) - s) }); }}>−−</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ tiltX: Math.max(-60, (selectedOverlayConfig.tiltX ?? 0) - s) }); }}>−</button>
                            <input
                              type="number"
                              className={styles.numberInput}
                              min="-60"
                              max="60"
                              step="1"
                              value={selectedOverlayConfig.tiltX ?? 0}
                              onChange={(event) => {
                                const v = Number(event.target.value);
                                if (Number.isFinite(v) && v >= -60 && v <= 60)
                                  updateSelectedOverlayConfig({ tiltX: v });
                              }}
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ tiltX: Math.min(60, (selectedOverlayConfig.tiltX ?? 0) + s) }); }}>+</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ tiltX: Math.min(60, (selectedOverlayConfig.tiltX ?? 0) + s) }); }}>++</button>
                          </label>

                          <label className={styles.rangeControl}>
                            <span title="Corrige si el plano parece torcido de lado">Inclinar a los lados</span>
                            <input
                              type="range"
                              min="-60"
                              max="60"
                              step="1"
                              value={selectedOverlayConfig.tiltY ?? 0}
                              onChange={(event) =>
                                updateSelectedOverlayConfig({
                                  tiltY: Number(event.target.value),
                                })
                              }
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ tiltY: Math.max(-60, (selectedOverlayConfig.tiltY ?? 0) - s) }); }}>−−</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ tiltY: Math.max(-60, (selectedOverlayConfig.tiltY ?? 0) - s) }); }}>−</button>
                            <input
                              type="number"
                              className={styles.numberInput}
                              min="-60"
                              max="60"
                              step="1"
                              value={selectedOverlayConfig.tiltY ?? 0}
                              onChange={(event) => {
                                const v = Number(event.target.value);
                                if (Number.isFinite(v) && v >= -60 && v <= 60)
                                  updateSelectedOverlayConfig({ tiltY: v });
                              }}
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ tiltY: Math.min(60, (selectedOverlayConfig.tiltY ?? 0) + s) }); }}>+</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ tiltY: Math.min(60, (selectedOverlayConfig.tiltY ?? 0) + s) }); }}>++</button>
                          </label>

                          <label className={styles.rangeControl}>
                            <span title="Valores altos reducen el efecto de perspectiva. Valores bajos lo exageran.">Intensidad de perspectiva</span>
                            <input
                              type="range"
                              min="200"
                              max="2000"
                              step="50"
                              value={
                                selectedOverlayConfig.perspectiveDepth ?? 900
                              }
                              onChange={(event) =>
                                updateSelectedOverlayConfig({
                                  perspectiveDepth: Number(event.target.value),
                                })
                              }
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateSelectedOverlayConfig({ perspectiveDepth: Math.max(200, (selectedOverlayConfig.perspectiveDepth ?? 900) - s) }); }}>−−</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 50; updateSelectedOverlayConfig({ perspectiveDepth: Math.max(200, (selectedOverlayConfig.perspectiveDepth ?? 900) - s) }); }}>−</button>
                            <input
                              type="number"
                              className={styles.numberInput}
                              min="200"
                              max="2000"
                              step="50"
                              value={
                                selectedOverlayConfig.perspectiveDepth ?? 900
                              }
                              onChange={(event) => {
                                const v = Number(event.target.value);
                                if (Number.isFinite(v) && v >= 200 && v <= 2000)
                                  updateSelectedOverlayConfig({
                                    perspectiveDepth: v,
                                  });
                              }}
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 50; updateSelectedOverlayConfig({ perspectiveDepth: Math.min(2000, (selectedOverlayConfig.perspectiveDepth ?? 900) + s) }); }}>+</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateSelectedOverlayConfig({ perspectiveDepth: Math.min(2000, (selectedOverlayConfig.perspectiveDepth ?? 900) + s) }); }}>++</button>
                          </label>
                        </div>

                        <div className={styles.reliefSection}>
                          <p className={styles.reliefSectionTitle}>
                            Estirar y deformar
                          </p>

                          <label className={styles.rangeControl}>
                            <span title="Estira el plano horizontalmente sin afectar el alto">Estirar horizontal</span>
                            <input
                              type="range"
                              min="0.5"
                              max="2"
                              step="0.01"
                              value={selectedOverlayConfig.scaleX ?? 1}
                              onChange={(event) =>
                                updateSelectedOverlayConfig({
                                  scaleX: Number(event.target.value),
                                })
                              }
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSelectedOverlayConfig({ scaleX: Math.round(Math.max(0.5, (selectedOverlayConfig.scaleX ?? 1) - s) * 1000) / 1000 }); }}>−−</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSelectedOverlayConfig({ scaleX: Math.round(Math.max(0.5, (selectedOverlayConfig.scaleX ?? 1) - s) * 1000) / 1000 }); }}>−</button>
                            <input
                              type="number"
                              className={styles.numberInput}
                              min="50"
                              max="200"
                              step="1"
                              value={Math.round((selectedOverlayConfig.scaleX ?? 1) * 100)}
                              onChange={(event) => {
                                const v = Number(event.target.value);
                                if (Number.isFinite(v) && v >= 50 && v <= 200)
                                  updateSelectedOverlayConfig({ scaleX: v / 100 });
                              }}
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSelectedOverlayConfig({ scaleX: Math.round(Math.min(2, (selectedOverlayConfig.scaleX ?? 1) + s) * 1000) / 1000 }); }}>+</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSelectedOverlayConfig({ scaleX: Math.round(Math.min(2, (selectedOverlayConfig.scaleX ?? 1) + s) * 1000) / 1000 }); }}>++</button>
                          </label>

                          <label className={styles.rangeControl}>
                            <span title="Estira el plano verticalmente sin afectar el ancho">Estirar vertical</span>
                            <input
                              type="range"
                              min="0.5"
                              max="2"
                              step="0.01"
                              value={selectedOverlayConfig.scaleY ?? 1}
                              onChange={(event) =>
                                updateSelectedOverlayConfig({
                                  scaleY: Number(event.target.value),
                                })
                              }
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSelectedOverlayConfig({ scaleY: Math.round(Math.max(0.5, (selectedOverlayConfig.scaleY ?? 1) - s) * 1000) / 1000 }); }}>−−</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSelectedOverlayConfig({ scaleY: Math.round(Math.max(0.5, (selectedOverlayConfig.scaleY ?? 1) - s) * 1000) / 1000 }); }}>−</button>
                            <input
                              type="number"
                              className={styles.numberInput}
                              min="50"
                              max="200"
                              step="1"
                              value={Math.round((selectedOverlayConfig.scaleY ?? 1) * 100)}
                              onChange={(event) => {
                                const v = Number(event.target.value);
                                if (Number.isFinite(v) && v >= 50 && v <= 200)
                                  updateSelectedOverlayConfig({ scaleY: v / 100 });
                              }}
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSelectedOverlayConfig({ scaleY: Math.round(Math.min(2, (selectedOverlayConfig.scaleY ?? 1) + s) * 1000) / 1000 }); }}>+</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSelectedOverlayConfig({ scaleY: Math.round(Math.min(2, (selectedOverlayConfig.scaleY ?? 1) + s) * 1000) / 1000 }); }}>++</button>
                          </label>

                          <label className={styles.rangeControl}>
                            <span title="Corrige bordes en forma de trapecio inclinando el eje horizontal">Sesgar horizontal</span>
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={selectedOverlayConfig.skewX ?? 0}
                              onChange={(event) =>
                                updateSelectedOverlayConfig({
                                  skewX: Number(event.target.value),
                                })
                              }
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ skewX: Math.max(-45, (selectedOverlayConfig.skewX ?? 0) - s) }); }}>−−</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ skewX: Math.max(-45, (selectedOverlayConfig.skewX ?? 0) - s) }); }}>−</button>
                            <input
                              type="number"
                              className={styles.numberInput}
                              min="-45"
                              max="45"
                              step="1"
                              value={selectedOverlayConfig.skewX ?? 0}
                              onChange={(event) => {
                                const v = Number(event.target.value);
                                if (Number.isFinite(v) && v >= -45 && v <= 45)
                                  updateSelectedOverlayConfig({ skewX: v });
                              }}
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ skewX: Math.min(45, (selectedOverlayConfig.skewX ?? 0) + s) }); }}>+</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ skewX: Math.min(45, (selectedOverlayConfig.skewX ?? 0) + s) }); }}>++</button>
                          </label>

                          <label className={styles.rangeControl}>
                            <span title="Corrige bordes en forma de trapecio inclinando el eje vertical">Sesgar vertical</span>
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={selectedOverlayConfig.skewY ?? 0}
                              onChange={(event) =>
                                updateSelectedOverlayConfig({
                                  skewY: Number(event.target.value),
                                })
                              }
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ skewY: Math.max(-45, (selectedOverlayConfig.skewY ?? 0) - s) }); }}>−−</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ skewY: Math.max(-45, (selectedOverlayConfig.skewY ?? 0) - s) }); }}>−</button>
                            <input
                              type="number"
                              className={styles.numberInput}
                              min="-45"
                              max="45"
                              step="1"
                              value={selectedOverlayConfig.skewY ?? 0}
                              onChange={(event) => {
                                const v = Number(event.target.value);
                                if (Number.isFinite(v) && v >= -45 && v <= 45)
                                  updateSelectedOverlayConfig({ skewY: v });
                              }}
                            />
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSelectedOverlayConfig({ skewY: Math.min(45, (selectedOverlayConfig.skewY ?? 0) + s) }); }}>+</button>
                            <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSelectedOverlayConfig({ skewY: Math.min(45, (selectedOverlayConfig.skewY ?? 0) + s) }); }}>++</button>
                          </label>
                        </div>

                        <div className={styles.reliefSection}>
                          <p className={styles.reliefSectionTitle}>
                            Textura de lotes
                          </p>
                          <div className={styles.textureSelectorRow}>
                            {[
                              { key: "solid", label: "Con fondo" },
                              { key: "transparent", label: "Transparente" },
                              { key: "outline", label: "Sin fondo" },
                            ].map(({ key, label }) => (
                              <button
                                key={key}
                                type="button"
                                className={`${styles.textureBtn} ${(selectedOverlayConfig.textureMode ?? "solid") === key ? styles.textureBtnActive : ""}`}
                                onClick={() =>
                                  updateSelectedOverlayConfig({
                                    textureMode: key,
                                  })
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {layoutEditMode &&
                          projectGeometry?.lotes?.length > 0 && (
                            <div className={styles.reliefSection}>
                              <p className={styles.reliefSectionTitle}>
                                {anchoredEditMode
                                  ? "Ajuste fino sobre el tour (zoom)"
                                  : "Editar por bloque"}
                              </p>

                              {selectedLotIds.size === 0 ? (
                                <p className={styles.helperText}>
                                  {anchoredEditMode
                                    ? "Click en los lotes de la foto para seleccionarlos. Arrastra el conjunto para moverlo; usa la rueda del mouse para acercar el zoom y ajustar con más precisión."
                                    : "Click en los lotes del visor para seleccionarlos. Arrastra el conjunto para moverlo."}
                                </p>
                              ) : anchoredEditMode ? (
                                <div className={styles.blockEditPanel}>
                                  <p className={styles.blockEditCount}>
                                    {selectedLotIds.size} lote
                                    {selectedLotIds.size > 1 ? "s" : ""}{" "}
                                    seleccionado
                                    {selectedLotIds.size > 1 ? "s" : ""} —
                                    arrastra sobre la foto para mover
                                  </p>

                                  <label className={styles.rangeControl}>
                                    <span>Escala grupo</span>
                                    <input
                                      type="range"
                                      min="0.3"
                                      max="3"
                                      step="0.02"
                                      value={sphericalGroupEdit.scale}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          scale: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSphericalGroupEdit({ scale: Math.round(Math.max(0.3, sphericalGroupEdit.scale - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSphericalGroupEdit({ scale: Math.round(Math.max(0.3, sphericalGroupEdit.scale - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="30"
                                      max="300"
                                      step="2"
                                      value={Math.round(sphericalGroupEdit.scale * 100)}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= 30 && v <= 300)
                                          updateSphericalGroupEdit({ scale: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSphericalGroupEdit({ scale: Math.round(Math.min(3, sphericalGroupEdit.scale + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSphericalGroupEdit({ scale: Math.round(Math.min(3, sphericalGroupEdit.scale + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span>Rotación grupo</span>
                                    <input
                                      type="range"
                                      min="-180"
                                      max="180"
                                      step="1"
                                      value={sphericalGroupEdit.rotation}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          rotation: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ rotation: Math.max(-180, sphericalGroupEdit.rotation - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ rotation: Math.max(-180, sphericalGroupEdit.rotation - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-180"
                                      max="180"
                                      step="1"
                                      value={sphericalGroupEdit.rotation}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -180 && v <= 180)
                                          updateSphericalGroupEdit({ rotation: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ rotation: Math.min(180, sphericalGroupEdit.rotation + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ rotation: Math.min(180, sphericalGroupEdit.rotation + s) }); }}>++</button>
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Inclinación y perspectiva del grupo
                                  </div>

                                  <label className={styles.rangeControl}>
                                    <span title="Ajusta si el lote parece caído hacia adelante o atrás">Inclinar hacia el horizonte</span>
                                    <input
                                      type="range"
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={sphericalGroupEdit.tiltX ?? 0}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          tiltX: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ tiltX: Math.max(-60, (sphericalGroupEdit.tiltX ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ tiltX: Math.max(-60, (sphericalGroupEdit.tiltX ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={sphericalGroupEdit.tiltX ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -60 && v <= 60)
                                          updateSphericalGroupEdit({ tiltX: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ tiltX: Math.min(60, (sphericalGroupEdit.tiltX ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ tiltX: Math.min(60, (sphericalGroupEdit.tiltX ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Corrige si el lote parece torcido de lado">Inclinar a los lados</span>
                                    <input
                                      type="range"
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={sphericalGroupEdit.tiltY ?? 0}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          tiltY: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ tiltY: Math.max(-60, (sphericalGroupEdit.tiltY ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ tiltY: Math.max(-60, (sphericalGroupEdit.tiltY ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={sphericalGroupEdit.tiltY ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -60 && v <= 60)
                                          updateSphericalGroupEdit({ tiltY: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ tiltY: Math.min(60, (sphericalGroupEdit.tiltY ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ tiltY: Math.min(60, (sphericalGroupEdit.tiltY ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Valores altos reducen el efecto de perspectiva. Valores bajos lo exageran.">Intensidad de perspectiva</span>
                                    <input
                                      type="range"
                                      min="200"
                                      max="2000"
                                      step="50"
                                      value={sphericalGroupEdit.perspectiveDepth ?? 900}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          perspectiveDepth: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateSphericalGroupEdit({ perspectiveDepth: Math.max(200, (sphericalGroupEdit.perspectiveDepth ?? 900) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 50; updateSphericalGroupEdit({ perspectiveDepth: Math.max(200, (sphericalGroupEdit.perspectiveDepth ?? 900) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="200"
                                      max="2000"
                                      step="50"
                                      value={sphericalGroupEdit.perspectiveDepth ?? 900}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= 200 && v <= 2000)
                                          updateSphericalGroupEdit({ perspectiveDepth: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 50; updateSphericalGroupEdit({ perspectiveDepth: Math.min(2000, (sphericalGroupEdit.perspectiveDepth ?? 900) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateSphericalGroupEdit({ perspectiveDepth: Math.min(2000, (sphericalGroupEdit.perspectiveDepth ?? 900) + s) }); }}>++</button>
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Estirar y deformar el grupo
                                  </div>

                                  <label className={styles.rangeControl}>
                                    <span title="Estira el grupo horizontalmente sin afectar el alto">Estirar horizontal</span>
                                    <input
                                      type="range"
                                      min="0.5"
                                      max="2"
                                      step="0.01"
                                      value={sphericalGroupEdit.scaleX ?? 1}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          scaleX: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSphericalGroupEdit({ scaleX: Math.round(Math.max(0.5, (sphericalGroupEdit.scaleX ?? 1) - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSphericalGroupEdit({ scaleX: Math.round(Math.max(0.5, (sphericalGroupEdit.scaleX ?? 1) - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="50"
                                      max="200"
                                      step="1"
                                      value={Math.round((sphericalGroupEdit.scaleX ?? 1) * 100)}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= 50 && v <= 200)
                                          updateSphericalGroupEdit({ scaleX: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSphericalGroupEdit({ scaleX: Math.round(Math.min(2, (sphericalGroupEdit.scaleX ?? 1) + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSphericalGroupEdit({ scaleX: Math.round(Math.min(2, (sphericalGroupEdit.scaleX ?? 1) + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Estira el grupo verticalmente sin afectar el ancho">Estirar vertical</span>
                                    <input
                                      type="range"
                                      min="0.5"
                                      max="2"
                                      step="0.01"
                                      value={sphericalGroupEdit.scaleY ?? 1}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          scaleY: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSphericalGroupEdit({ scaleY: Math.round(Math.max(0.5, (sphericalGroupEdit.scaleY ?? 1) - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSphericalGroupEdit({ scaleY: Math.round(Math.max(0.5, (sphericalGroupEdit.scaleY ?? 1) - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="50"
                                      max="200"
                                      step="1"
                                      value={Math.round((sphericalGroupEdit.scaleY ?? 1) * 100)}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= 50 && v <= 200)
                                          updateSphericalGroupEdit({ scaleY: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateSphericalGroupEdit({ scaleY: Math.round(Math.min(2, (sphericalGroupEdit.scaleY ?? 1) + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateSphericalGroupEdit({ scaleY: Math.round(Math.min(2, (sphericalGroupEdit.scaleY ?? 1) + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Corrige bordes en forma de trapecio inclinando el eje horizontal">Sesgar horizontal</span>
                                    <input
                                      type="range"
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={sphericalGroupEdit.skewX ?? 0}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          skewX: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ skewX: Math.max(-45, (sphericalGroupEdit.skewX ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ skewX: Math.max(-45, (sphericalGroupEdit.skewX ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={sphericalGroupEdit.skewX ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -45 && v <= 45)
                                          updateSphericalGroupEdit({ skewX: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ skewX: Math.min(45, (sphericalGroupEdit.skewX ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ skewX: Math.min(45, (sphericalGroupEdit.skewX ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Corrige bordes en forma de trapecio inclinando el eje vertical">Sesgar vertical</span>
                                    <input
                                      type="range"
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={sphericalGroupEdit.skewY ?? 0}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          skewY: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ skewY: Math.max(-45, (sphericalGroupEdit.skewY ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ skewY: Math.max(-45, (sphericalGroupEdit.skewY ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={sphericalGroupEdit.skewY ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -45 && v <= 45)
                                          updateSphericalGroupEdit({ skewY: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateSphericalGroupEdit({ skewY: Math.min(45, (sphericalGroupEdit.skewY ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateSphericalGroupEdit({ skewY: Math.min(45, (sphericalGroupEdit.skewY ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span>Opacidad grupo</span>
                                    <input
                                      type="range"
                                      min="0.1"
                                      max="1"
                                      step="0.01"
                                      value={sphericalGroupEdit.opacity ?? selectedOverlayConfig.lotOpacity}
                                      onChange={(e) =>
                                        updateSphericalGroupEdit({
                                          opacity: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; const cur = sphericalGroupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateSphericalGroupEdit({ opacity: Math.round(Math.max(0.1, cur - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; const cur = sphericalGroupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateSphericalGroupEdit({ opacity: Math.round(Math.max(0.1, cur - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="10"
                                      max="100"
                                      step="1"
                                      value={Math.round((sphericalGroupEdit.opacity ?? selectedOverlayConfig.lotOpacity) * 100)}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= 10 && v <= 100)
                                          updateSphericalGroupEdit({ opacity: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; const cur = sphericalGroupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateSphericalGroupEdit({ opacity: Math.round(Math.min(1, cur + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; const cur = sphericalGroupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateSphericalGroupEdit({ opacity: Math.round(Math.min(1, cur + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Posición del grupo (joystick)
                                  </div>
                                  <div className={styles.sliderControl}>
                                    <div className={styles.joystickGrid}>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateSphericalGroupEdit({ dPitch: sphericalGroupEdit.dPitch + 0.005 })}>↑</button>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateSphericalGroupEdit({ dYaw: sphericalGroupEdit.dYaw - 0.005 })}>←</button>
                                      <div className={styles.joystickCenter}>
                                        <input
                                          type="number"
                                          className={styles.numberInput}
                                          style={{ width: 44, fontSize: "0.7rem" }}
                                          step="0.1"
                                          title="Grados de yaw (izquierda/derecha)"
                                          value={Math.round((sphericalGroupEdit.dYaw * 180) / Math.PI * 10) / 10}
                                          onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (Number.isFinite(v)) updateSphericalGroupEdit({ dYaw: (v * Math.PI) / 180 });
                                          }}
                                        />
                                        <input
                                          type="number"
                                          className={styles.numberInput}
                                          style={{ width: 44, fontSize: "0.7rem" }}
                                          step="0.1"
                                          title="Grados de pitch (arriba/abajo)"
                                          value={Math.round((sphericalGroupEdit.dPitch * 180) / Math.PI * 10) / 10}
                                          onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (Number.isFinite(v)) updateSphericalGroupEdit({ dPitch: (v * Math.PI) / 180 });
                                          }}
                                        />
                                      </div>
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateSphericalGroupEdit({ dYaw: sphericalGroupEdit.dYaw + 0.005 })}>→</button>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateSphericalGroupEdit({ dPitch: sphericalGroupEdit.dPitch - 0.005 })}>↓</button>
                                      <div />
                                    </div>
                                    <p className={styles.helperText} style={{ textAlign: "center", marginTop: 2 }}>
                                      Valores en grados sobre la foto (también podés arrastrar el grupo directamente).
                                    </p>
                                  </div>

                                  <div className={styles.textureSelectorRow}>
                                    {[
                                      { key: "solid", label: "Con fondo" },
                                      { key: "transparent", label: "Transparente" },
                                      { key: "outline", label: "Sin fondo" },
                                    ].map(({ key, label }) => (
                                      <button
                                        key={key}
                                        type="button"
                                        className={`${styles.textureBtn} ${(sphericalGroupEdit.textureMode ?? selectedOverlayConfig.textureMode ?? "solid") === key ? styles.textureBtnActive : ""}`}
                                        onClick={() =>
                                          updateSphericalGroupEdit({ textureMode: key })
                                        }
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>

                                  <div
                                    className={styles.toggleRow}
                                    style={{ marginTop: 10 }}
                                  >
                                    <button
                                      type="button"
                                      className={styles.toggleButton}
                                      onClick={() => {
                                        commitSphericalGroupEdit({ visible: false });
                                        clearGroupSelection();
                                      }}
                                    >
                                      <EyeOff size={14} />
                                      Ocultar
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.toggleButton}
                                      onClick={() => {
                                        commitSphericalGroupEdit();
                                        clearGroupSelection();
                                      }}
                                    >
                                      Confirmar y deseleccionar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className={styles.blockEditPanel}>
                                  <p className={styles.blockEditCount}>
                                    {selectedLotIds.size} lote
                                    {selectedLotIds.size > 1 ? "s" : ""}{" "}
                                    seleccionado
                                    {selectedLotIds.size > 1 ? "s" : ""} —
                                    arrastra para mover
                                  </p>

                                  <label className={styles.rangeControl}>
                                    <span>Escala grupo</span>
                                    <input
                                      type="range"
                                      min="0.2"
                                      max="3"
                                      step="0.02"
                                      value={groupEdit.scale}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          scale: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateGroupEdit({ scale: Math.round(Math.max(0.2, groupEdit.scale - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateGroupEdit({ scale: Math.round(Math.max(0.2, groupEdit.scale - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="20"
                                      max="300"
                                      step="2"
                                      value={Math.round(groupEdit.scale * 100)}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (
                                          Number.isFinite(v) &&
                                          v >= 20 &&
                                          v <= 300
                                        )
                                          updateGroupEdit({ scale: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateGroupEdit({ scale: Math.round(Math.min(3, groupEdit.scale + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateGroupEdit({ scale: Math.round(Math.min(3, groupEdit.scale + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span>Rotación grupo</span>
                                    <input
                                      type="range"
                                      min="-180"
                                      max="180"
                                      step="1"
                                      value={groupEdit.rotation}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          rotation: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ rotation: Math.max(-180, groupEdit.rotation - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ rotation: Math.max(-180, groupEdit.rotation - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-180"
                                      max="180"
                                      step="1"
                                      value={groupEdit.rotation}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (
                                          Number.isFinite(v) &&
                                          v >= -180 &&
                                          v <= 180
                                        )
                                          updateGroupEdit({ rotation: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ rotation: Math.min(180, groupEdit.rotation + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ rotation: Math.min(180, groupEdit.rotation + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span>Opacidad grupo</span>
                                    <input
                                      type="range"
                                      min="0.1"
                                      max="1"
                                      step="0.01"
                                      value={
                                        groupEdit.opacity ??
                                        selectedOverlayConfig.lotOpacity
                                      }
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          opacity: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; const cur = groupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateGroupEdit({ opacity: Math.round(Math.max(0.1, cur - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; const cur = groupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateGroupEdit({ opacity: Math.round(Math.max(0.1, cur - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="10"
                                      max="100"
                                      step="1"
                                      value={Math.round(
                                        (groupEdit.opacity ??
                                          selectedOverlayConfig.lotOpacity) *
                                          100,
                                      )}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (
                                          Number.isFinite(v) &&
                                          v >= 10 &&
                                          v <= 100
                                        )
                                          updateGroupEdit({ opacity: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; const cur = groupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateGroupEdit({ opacity: Math.round(Math.min(1, cur + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; const cur = groupEdit.opacity ?? selectedOverlayConfig.lotOpacity; updateGroupEdit({ opacity: Math.round(Math.min(1, cur + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Posición del grupo (joystick)
                                  </div>
                                  <div className={styles.sliderControl}>
                                    <div className={styles.joystickGrid}>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ dy: groupEdit.dy - 10 })}>↑</button>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ dx: groupEdit.dx - 10 })}>←</button>
                                      <div className={styles.joystickCenter}>
                                        <input type="number" className={styles.numberInput} style={{ width: 44, fontSize: "0.7rem" }} step="5" value={Math.round(groupEdit.dx)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateGroupEdit({ dx: v }); }} />
                                        <input type="number" className={styles.numberInput} style={{ width: 44, fontSize: "0.7rem" }} step="5" value={Math.round(groupEdit.dy)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateGroupEdit({ dy: v }); }} />
                                      </div>
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ dx: groupEdit.dx + 10 })}>→</button>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ dy: groupEdit.dy + 10 })}>↓</button>
                                      <div />
                                    </div>
                                  </div>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Inclinación y perspectiva del grupo
                                  </div>

                                  <label className={styles.rangeControl}>
                                    <span title="Ajusta si el plano parece caído hacia adelante o atrás">Inclinar hacia el horizonte</span>
                                    <input
                                      type="range"
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={groupEdit.tiltX ?? 0}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          tiltX: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ tiltX: Math.max(-60, (groupEdit.tiltX ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ tiltX: Math.max(-60, (groupEdit.tiltX ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={groupEdit.tiltX ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (
                                          Number.isFinite(v) &&
                                          v >= -60 &&
                                          v <= 60
                                        )
                                          updateGroupEdit({ tiltX: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ tiltX: Math.min(60, (groupEdit.tiltX ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ tiltX: Math.min(60, (groupEdit.tiltX ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Corrige si el plano parece torcido de lado">Inclinar a los lados</span>
                                    <input
                                      type="range"
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={groupEdit.tiltY ?? 0}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          tiltY: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ tiltY: Math.max(-60, (groupEdit.tiltY ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ tiltY: Math.max(-60, (groupEdit.tiltY ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-60"
                                      max="60"
                                      step="1"
                                      value={groupEdit.tiltY ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (
                                          Number.isFinite(v) &&
                                          v >= -60 &&
                                          v <= 60
                                        )
                                          updateGroupEdit({ tiltY: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ tiltY: Math.min(60, (groupEdit.tiltY ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ tiltY: Math.min(60, (groupEdit.tiltY ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Valores altos reducen el efecto de perspectiva. Valores bajos lo exageran.">Intensidad de perspectiva</span>
                                    <input
                                      type="range"
                                      min="200"
                                      max="2000"
                                      step="50"
                                      value={groupEdit.perspectiveDepth ?? 900}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          perspectiveDepth: Number(
                                            e.target.value,
                                          ),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateGroupEdit({ perspectiveDepth: Math.max(200, (groupEdit.perspectiveDepth ?? 900) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 50; updateGroupEdit({ perspectiveDepth: Math.max(200, (groupEdit.perspectiveDepth ?? 900) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="200"
                                      max="2000"
                                      step="50"
                                      value={groupEdit.perspectiveDepth ?? 900}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (
                                          Number.isFinite(v) &&
                                          v >= 200 &&
                                          v <= 2000
                                        )
                                          updateGroupEdit({
                                            perspectiveDepth: v,
                                          });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 50; updateGroupEdit({ perspectiveDepth: Math.min(2000, (groupEdit.perspectiveDepth ?? 900) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateGroupEdit({ perspectiveDepth: Math.min(2000, (groupEdit.perspectiveDepth ?? 900) + s) }); }}>++</button>
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Estirar y deformar el grupo
                                  </div>

                                  <label className={styles.rangeControl}>
                                    <span title="Estira el grupo horizontalmente sin afectar el alto">Estirar horizontal</span>
                                    <input
                                      type="range"
                                      min="0.5"
                                      max="2"
                                      step="0.01"
                                      value={groupEdit.scaleX ?? 1}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          scaleX: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateGroupEdit({ scaleX: Math.round(Math.max(0.5, (groupEdit.scaleX ?? 1) - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateGroupEdit({ scaleX: Math.round(Math.max(0.5, (groupEdit.scaleX ?? 1) - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="50"
                                      max="200"
                                      step="1"
                                      value={Math.round((groupEdit.scaleX ?? 1) * 100)}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= 50 && v <= 200)
                                          updateGroupEdit({ scaleX: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateGroupEdit({ scaleX: Math.round(Math.min(2, (groupEdit.scaleX ?? 1) + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateGroupEdit({ scaleX: Math.round(Math.min(2, (groupEdit.scaleX ?? 1) + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Estira el grupo verticalmente sin afectar el ancho">Estirar vertical</span>
                                    <input
                                      type="range"
                                      min="0.5"
                                      max="2"
                                      step="0.01"
                                      value={groupEdit.scaleY ?? 1}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          scaleY: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateGroupEdit({ scaleY: Math.round(Math.max(0.5, (groupEdit.scaleY ?? 1) - s) * 1000) / 1000 }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateGroupEdit({ scaleY: Math.round(Math.max(0.5, (groupEdit.scaleY ?? 1) - s) * 1000) / 1000 }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="50"
                                      max="200"
                                      step="1"
                                      value={Math.round((groupEdit.scaleY ?? 1) * 100)}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= 50 && v <= 200)
                                          updateGroupEdit({ scaleY: v / 100 });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.005 : sliderPrecision === "fine" ? 0.01 : 0.05; updateGroupEdit({ scaleY: Math.round(Math.min(2, (groupEdit.scaleY ?? 1) + s) * 1000) / 1000 }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.005; updateGroupEdit({ scaleY: Math.round(Math.min(2, (groupEdit.scaleY ?? 1) + s) * 1000) / 1000 }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Corrige bordes en forma de trapecio inclinando el eje horizontal">Sesgar horizontal</span>
                                    <input
                                      type="range"
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={groupEdit.skewX ?? 0}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          skewX: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ skewX: Math.max(-45, (groupEdit.skewX ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ skewX: Math.max(-45, (groupEdit.skewX ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={groupEdit.skewX ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -45 && v <= 45)
                                          updateGroupEdit({ skewX: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ skewX: Math.min(45, (groupEdit.skewX ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ skewX: Math.min(45, (groupEdit.skewX ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Corrige bordes en forma de trapecio inclinando el eje vertical">Sesgar vertical</span>
                                    <input
                                      type="range"
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={groupEdit.skewY ?? 0}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          skewY: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ skewY: Math.max(-45, (groupEdit.skewY ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ skewY: Math.max(-45, (groupEdit.skewY ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-45"
                                      max="45"
                                      step="1"
                                      value={groupEdit.skewY ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -45 && v <= 45)
                                          updateGroupEdit({ skewY: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ skewY: Math.min(45, (groupEdit.skewY ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ skewY: Math.min(45, (groupEdit.skewY ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Esquinas (arrastra los puntitos en el visor)
                                  </div>
                                  <p className={styles.helperText} style={{ margin: 0 }}>
                                    Cada esquina del contorno se puede ajustar a mano, sin
                                    afectar el resto del grupo. Las esquinas compartidas entre
                                    lotes vecinos se mueven juntas.
                                  </p>
                                  {Object.keys(groupEdit.vertexOffsets || {}).length > 0 && (
                                    <button
                                      type="button"
                                      className={styles.btnCancel}
                                      onClick={() => updateGroupEdit({ vertexOffsets: {} })}
                                    >
                                      Restablecer esquinas
                                    </button>
                                  )}

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Más transformaciones
                                  </div>

                                  <div className={styles.textureSelectorRow}>
                                    <button
                                      type="button"
                                      className={`${styles.textureBtn} ${groupEdit.flipX ? styles.textureBtnActive : ""}`}
                                      title="Invierte el grupo como en un espejo, de izquierda a derecha"
                                      onClick={() => updateGroupEdit({ flipX: !groupEdit.flipX })}
                                    >
                                      Espejo horizontal
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.textureBtn} ${groupEdit.flipY ? styles.textureBtnActive : ""}`}
                                      title="Invierte el grupo como en un espejo, de arriba a abajo"
                                      onClick={() => updateGroupEdit({ flipY: !groupEdit.flipY })}
                                    >
                                      Espejo vertical
                                    </button>
                                  </div>

                                  <label className={styles.rangeControl}>
                                    <span title="Empuja el grupo hacia adelante o atrás en el espacio 3D, separado de la escala">Profundidad (acercar / alejar)</span>
                                    <input
                                      type="range"
                                      min="-500"
                                      max="500"
                                      step="5"
                                      value={groupEdit.dz ?? 0}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          dz: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateGroupEdit({ dz: Math.max(-500, (groupEdit.dz ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 25; updateGroupEdit({ dz: Math.max(-500, (groupEdit.dz ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-500"
                                      max="500"
                                      step="5"
                                      value={groupEdit.dz ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -500 && v <= 500)
                                          updateGroupEdit({ dz: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 5 : sliderPrecision === "fine" ? 10 : 25; updateGroupEdit({ dz: Math.min(500, (groupEdit.dz ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 5; updateGroupEdit({ dz: Math.min(500, (groupEdit.dz ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <label className={styles.rangeControl}>
                                    <span title="Curva el grupo como una lente: positivo lo abomba (ojo de pez), negativo lo hunde (cojín). Útil para igualar la curvatura de la foto 360">Curvatura de lente</span>
                                    <input
                                      type="range"
                                      min="-50"
                                      max="50"
                                      step="1"
                                      value={groupEdit.lensCurve ?? 0}
                                      onChange={(e) =>
                                        updateGroupEdit({
                                          lensCurve: Number(e.target.value),
                                        })
                                      }
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ lensCurve: Math.max(-50, (groupEdit.lensCurve ?? 0) - s) }); }}>−−</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ lensCurve: Math.max(-50, (groupEdit.lensCurve ?? 0) - s) }); }}>−</button>
                                    <input
                                      type="number"
                                      className={styles.numberInput}
                                      min="-50"
                                      max="50"
                                      step="1"
                                      value={groupEdit.lensCurve ?? 0}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (Number.isFinite(v) && v >= -50 && v <= 50)
                                          updateGroupEdit({ lensCurve: v });
                                      }}
                                    />
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = sliderPrecision === "veryFine" ? 0.5 : sliderPrecision === "fine" ? 1 : 5; updateGroupEdit({ lensCurve: Math.min(50, (groupEdit.lensCurve ?? 0) + s) }); }}>+</button>
                                    <button type="button" className={styles.stepArrow} onClick={() => { const s = 0.5; updateGroupEdit({ lensCurve: Math.min(50, (groupEdit.lensCurve ?? 0) + s) }); }}>++</button>
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Punto de pivote (ancla de inclinación)
                                  </div>
                                  <div className={styles.sliderControl}>
                                    <div className={styles.joystickGrid}>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ pivotOffsetY: (groupEdit.pivotOffsetY ?? 0) - 10 })}>↑</button>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ pivotOffsetX: (groupEdit.pivotOffsetX ?? 0) - 10 })}>←</button>
                                      <div className={styles.joystickCenter}>
                                        <input type="number" className={styles.numberInput} style={{ width: 44, fontSize: "0.7rem" }} step="5" value={Math.round(groupEdit.pivotOffsetX ?? 0)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateGroupEdit({ pivotOffsetX: v }); }} />
                                        <input type="number" className={styles.numberInput} style={{ width: 44, fontSize: "0.7rem" }} step="5" value={Math.round(groupEdit.pivotOffsetY ?? 0)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateGroupEdit({ pivotOffsetY: v }); }} />
                                      </div>
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ pivotOffsetX: (groupEdit.pivotOffsetX ?? 0) + 10 })}>→</button>
                                      <div />
                                      <button type="button" className={styles.arrowBtn} onClick={() => updateGroupEdit({ pivotOffsetY: (groupEdit.pivotOffsetY ?? 0) + 10 })}>↓</button>
                                      <div />
                                    </div>
                                    {(groupEdit.pivotOffsetX !== 0 || groupEdit.pivotOffsetY !== 0) && (
                                      <button
                                        type="button"
                                        className={styles.toggleButton}
                                        style={{ marginTop: 6 }}
                                        onClick={() => updateGroupEdit({ pivotOffsetX: 0, pivotOffsetY: 0 })}
                                      >
                                        Centrar pivote
                                      </button>
                                    )}
                                  </div>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Textura del grupo
                                  </div>
                                  <div className={styles.textureSelectorRow}>
                                    {[
                                      { key: "solid", label: "Con fondo" },
                                      { key: "transparent", label: "Transparente" },
                                      { key: "outline", label: "Sin fondo" },
                                    ].map(({ key, label }) => (
                                      <button
                                        key={key}
                                        type="button"
                                        className={`${styles.textureBtn} ${(groupEdit.textureMode ?? selectedOverlayConfig.textureMode ?? "solid") === key ? styles.textureBtnActive : ""}`}
                                        onClick={() =>
                                          updateGroupEdit({ textureMode: key })
                                        }
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>

                                  <div
                                    className={styles.toggleRow}
                                    style={{ marginTop: 10 }}
                                  >
                                    <button
                                      type="button"
                                      className={styles.toggleButton}
                                      onClick={() => {
                                        commitGroupEdit({ visible: false });
                                        clearGroupSelection();
                                      }}
                                    >
                                      <EyeOff size={14} />
                                      Ocultar
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.toggleButton}
                                      onClick={() => {
                                        commitGroupEdit();
                                        clearGroupSelection();
                                      }}
                                    >
                                      Confirmar y deseleccionar
                                    </button>
                                  </div>
                                </div>
                              )}

                              {(() => {
                                const hidden = Object.entries(
                                  selectedOverlayConfig.lotOverrides ?? {},
                                ).filter(([, v]) => v?.visible === false);
                                return hidden.length > 0 ? (
                                  <button
                                    type="button"
                                    className={styles.toggleButton}
                                    style={{ width: "100%", marginTop: 8 }}
                                    onClick={() => {
                                      const current =
                                        selectedOverlayConfig.lotOverrides ??
                                        {};
                                      const updated = { ...current };
                                      hidden.forEach(([id]) => {
                                        const { visible: _v, ...rest } =
                                          updated[id] ?? {};
                                        if (Object.keys(rest).length === 0)
                                          delete updated[id];
                                        else updated[id] = rest;
                                      });
                                      updateSelectedOverlayConfig({
                                        lotOverrides: updated,
                                      });
                                    }}
                                  >
                                    <Eye size={14} />
                                    Mostrar {hidden.length} lote
                                    {hidden.length > 1 ? "s" : ""} oculto
                                    {hidden.length > 1 ? "s" : ""}
                                  </button>
                                ) : null;
                              })()}
                            </div>
                          )}
                      </>
                    )}

                  </>
                ) : (
                  <div className={styles.emptyState}>
                    {selectedImg
                      ? "Todavia no has importado trazos 2D en esta imagen."
                      : "Primero agrega o selecciona una imagen 360."}
                  </div>
                )}
              </div>

            </aside>
          </div>

          <div className={styles.drawingSection}>
            <div className={styles.sectionTitleRow}>
              <Pencil size={16} />
              <h3>Trazar formas</h3>
            </div>

            <div className={styles.drawingSectionBody}>
              {!selectedImg ? (
                <p className={styles.helperText}>
                  Selecciona una imagen 360 para activar el modo de dibujo.
                </p>
              ) : (
                <>
                  <p className={styles.helperText}>
                    {drawMode === "polygon"
                      ? currentPolygonPoints.length === 0
                        ? "Haz clic en el visor para colocar el primer punto."
                        : currentPolygonPoints.length < 3
                        ? `${currentPolygonPoints.length} punto(s). Sigue haciendo clic para agregar más.`
                        : "Haz clic cerca del primer punto (verde) para cerrar la figura."
                      : "Activa el modo polígono y haz clic en el visor para trazar."}
                  </p>

                  <div className={styles.scenarioPicker}>
                    {DRAWING_SCENARIO_TYPES.map((scenario) => {
                      const Icon = scenario.icon;
                      const isSelected = selectedDrawingScenario === scenario.key;
                      return (
                        <button
                          key={scenario.key}
                          type="button"
                          className={`${styles.scenarioOption} ${isSelected ? styles.scenarioOptionActive : ""}`}
                          style={{ "--scenario-color": scenario.color }}
                          onClick={() => setSelectedDrawingScenario(scenario.key)}
                          title={`Agregar ${scenario.label}`}
                        >
                          <Icon size={15} />
                          <span>{scenario.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDrawingScenario === "area" && (
                    <input
                      type="text"
                      className={styles.shapeLabelInput}
                      placeholder="Nombre del área (opcional)"
                      value={drawingAreaName}
                      onChange={(e) => setDrawingAreaName(e.target.value)}
                      maxLength={60}
                    />
                  )}

                  <label className={styles.colorPickerRow}>
                    <span>Color de línea</span>
                    <span className={styles.colorPreview} style={{ background: drawingColor }} />
                    <input
                      type="color"
                      value={drawingColor}
                      onChange={(e) => setDrawingColor(e.target.value)}
                      className={styles.colorInput}
                      title="Elegir color de línea"
                    />
                  </label>

                  <div className={styles.panelActions}>
                    <button
                      type="button"
                      className={
                        drawMode === "polygon"
                          ? styles.btnPrimary360
                          : styles.btnCancel
                      }
                      onClick={() => {
                        if (drawMode === "polygon") {
                          setDrawMode(null);
                          currentPolygonPointsRef.current = [];
                          setCurrentPolygonPoints([]);
                          setPolygonCursorPos(null);
                        } else {
                          setDrawMode("polygon");
                        }
                      }}
                    >
                      <Pencil size={15} />
                      {drawMode === "polygon" ? "Salir de dibujo" : "Dibujar figura"}
                    </button>

                    {drawMode === "polygon" && currentPolygonPoints.length >= 3 && (
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={closePolygon}
                      >
                        Cerrar figura
                      </button>
                    )}
                    {drawMode === "polygon" && currentPolygonPoints.length > 0 && (
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={undoLastPoint}
                      >
                        ← Punto
                      </button>
                    )}
                  </div>

                  {(userDrawings[selectedImageId] || []).length > 0 && (
                    <div className={styles.shapeList}>
                      {(userDrawings[selectedImageId] || []).map((shape, idx) => (
                        <div key={shape.id} className={styles.shapeItem}>
                          <span className={styles.helperText}>
                            Figura {idx + 1} · {shape.points.length} puntos
                          </span>
                          <div className={styles.scenarioMiniPicker}>
                            {DRAWING_SCENARIO_TYPES.map((scenario) => {
                              const Icon = scenario.icon;
                              const isSelected =
                                (shape.scenarioKey || DEFAULT_DRAWING_SCENARIO.key) ===
                                scenario.key;
                              return (
                                <button
                                  key={scenario.key}
                                  type="button"
                                  className={`${styles.scenarioIconButton} ${isSelected ? styles.scenarioIconButtonActive : ""}`}
                                  style={{ "--scenario-color": scenario.color }}
                                  onClick={() => setShapeScenario(shape.id, scenario.key)}
                                  title={scenario.label}
                                  aria-label={scenario.label}
                                >
                                  <Icon size={14} />
                                </button>
                              );
                            })}
                          </div>
                          <label className={styles.colorPickerRow}>
                            <span>Color de línea</span>
                            <span className={styles.colorPreview} style={{ background: shape.scenarioColor || "#ffffff" }} />
                            <input
                              type="color"
                              value={shape.scenarioColor || "#ffffff"}
                              onChange={(e) => setShapeColor(shape.id, e.target.value)}
                              className={styles.colorInput}
                            />
                          </label>
                          <input
                            type="text"
                            className={styles.shapeLabelInput}
                            placeholder="Nombre del trazo (opcional)"
                            value={shape.label || ""}
                            onChange={(e) => setShapeLabel(shape.id, e.target.value)}
                            maxLength={60}
                          />
                          <label className={styles.depthLabel}>
                            Grosor
                            <input
                              type="range"
                              min={1}
                              max={16}
                              value={shape.strokeWidth ?? 4}
                              onChange={(e) =>
                                setShapeStroke(shape.id, Number(e.target.value))
                              }
                              className={styles.depthSlider}
                            />
                            <span className={styles.depthValue}>{shape.strokeWidth ?? 4}</span>
                          </label>
                          <label className={styles.depthLabel}>
                            Profundidad
                            <input
                              type="range"
                              min={0}
                              max={40}
                              value={shape.depth || 0}
                              onChange={(e) =>
                                setShapeDepth(shape.id, Number(e.target.value))
                              }
                              className={styles.depthSlider}
                            />
                            <span className={styles.depthValue}>{shape.depth || 0}</span>
                          </label>
                          <label className={styles.depthLabel} style={{ gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={shape.showShadow === true}
                              onChange={(e) => setShapeShadow(shape.id, e.target.checked)}
                              style={{ accentColor: "#0ea5e9", width: 15, height: 15 }}
                            />
                            Sombreado
                          </label>
                        </div>
                      ))}
                      <div className={styles.panelActions}>
                        <button
                          type="button"
                          className={styles.toggleButton}
                          onClick={undoLastDrawing}
                        >
                          Deshacer última
                        </button>
                        <button
                          type="button"
                          className={styles.toggleButton}
                          onClick={clearAllDrawings}
                        >
                          <Trash2 size={14} />
                          Borrar todo
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal360;
