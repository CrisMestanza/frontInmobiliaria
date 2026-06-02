import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  Map as MapIcon,
  MousePointerClick,
  Move,
  Plus,
  RotateCw,
  Upload,
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
  rotation: -8,
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
  for (const l of lotes) {
    if (!selectedIds.has(String(getLoteId(l) ?? ""))) continue;
    const override = lotOverrides[String(getLoteId(l) ?? "")] ?? {};
    const pts = applyLotSvgTransform(l.points || [], override);
    const { cx, cy } = getLotCentroid(pts);
    totalX += cx;
    totalY += cy;
    count++;
  }
  return count ? { cx: totalX / count, cy: totalY / count } : { cx: 0, cy: 0 };
};

const applyGroupTransformWithTiltToPoints = (points, gcx, gcy, groupEdit) => {
  const {
    scale = 1,
    rotation = 0,
    dx = 0,
    dy = 0,
    tiltX = 0,
    tiltY = 0,
    perspectiveDepth = 900,
  } = groupEdit;
  if (
    scale === 1 &&
    rotation === 0 &&
    dx === 0 &&
    dy === 0 &&
    tiltX === 0 &&
    tiltY === 0
  )
    return points;
  const r = (rotation * Math.PI) / 180;
  const rX = (tiltX * Math.PI) / 180;
  const rY = (tiltY * Math.PI) / 180;
  const pD = perspectiveDepth || 900;
  const cosR = Math.cos(r),
    sinR = Math.sin(r);
  return points.map((p) => {
    let lx = (p.x - gcx) * scale;
    let ly = (p.y - gcy) * scale;
    let x = lx * cosR - ly * sinR;
    let y = lx * sinR + ly * cosR;
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
    return { x: gcx + dx + x * factor, y: gcy + dy + y * factor };
  });
};

const DEFAULT_GROUP_EDIT = {
  scale: 1,
  rotation: 0,
  dx: 0,
  dy: 0,
  opacity: null,
  textureMode: null,
  tiltX: 0,
  tiltY: 0,
  perspectiveDepth: 900,
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
    rotation = 0,
    tiltX = 0,
    tiltY = 0,
  } = config;
  const affine = getAffineCssMatrix(config);
  const tilt =
    tiltX !== 0 || tiltY !== 0
      ? `rotateX(${tiltX}deg) rotateY(${tiltY}deg) `
      : "";
  const manual = `translate(${x}px, ${y}px) ${tilt}scale(${scale}) rotate(${rotation}deg)`;
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
  const scale = Number(config?.scale) || 1;
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

  // Step 2 – uniform scale
  x *= scale;
  y *= scale;

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
}) => (
  <label className={styles.rangeControl} title={tooltip}>
    <span>{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
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
  </label>
);

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
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [selectedLotIds, setSelectedLotIds] = useState(new Set());
  const [groupEdit, setGroupEdit] = useState(DEFAULT_GROUP_EDIT);
  const [groupDragState, setGroupDragState] = useState(null);
  const [alignmentMode, setAlignmentMode] = useState(DEFAULT_ALIGNMENT_STATE);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showAlignmentDetails, setShowAlignmentDetails] = useState(false);
  const groupEditRef = useRef(DEFAULT_GROUP_EDIT);
  const selectedLotIdsRef = useRef(new Set());
  const groupEditBaseRef = useRef({});

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
  const layoutEditModeRef = useRef(false);
  const overlayVisibleRef = useRef(false);
  const alignmentModeRef = useRef(DEFAULT_ALIGNMENT_STATE);
  const overlayDragFrameRef = useRef(null);
  const overlayDragPatchRef = useRef(null);
  const groupDragFrameRef = useRef(null);
  const groupDragPatchRef = useRef(null);

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

  const importedOverlaySummary = useMemo(() => {
    if (!projectGeometry) return null;
    return {
      lotes: projectGeometry.lotes.length,
      vertices: projectGeometry.projectCount,
    };
  }, [projectGeometry]);

  const alignmentSnapCandidates = useMemo(
    () => createAlignmentSnapCandidates(projectGeometry),
    [projectGeometry],
  );

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

  const renderHotspots = () => {
    const viewer = viewerInstance.current;
    if (!viewer || !selectedImg) return;

    const markers = viewer.getPlugin(viewerRuntimeRef.current?.MarkersPlugin);
    markers.clearMarkers();

    const storedAnchoredOverlay =
      anchoredOverlays[String(selectedImg.id_imagen)] || null;
    const overlayConfig =
      selectedOverlayConfigRef.current || selectedOverlayConfig;
    const overlayIsExplicitlyHidden = overlayConfig?.visible === false;
    const anchoredPreview = overlayIsExplicitlyHidden
      ? null
      : !layoutEditModeRef.current && overlayConfig?.visible
        ? buildAnchoredOverlaySnapshot(selectedImg.id_imagen, overlayConfig) ||
          storedAnchoredOverlay
        : storedAnchoredOverlay;

    if (anchoredPreview?.visible && !layoutEditModeRef.current) {
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
            fill: "rgba(14, 116, 44, 0.26)",
            stroke: "#14532d",
            strokeWidth: "12px",
            strokeLinejoin: "round",
          },
          zIndex: 5,
        });
      }

      (anchoredPreview.lotPolygons || []).forEach((lote, index) => {
        const hasSpherical =
          Array.isArray(lote.polygon) && lote.polygon.length >= 3;
        const hasPixels =
          Array.isArray(lote.polygonPixels) && lote.polygonPixels.length >= 3;
        if (!hasSpherical && !hasPixels) return;
        const markerKey = lote.idlote ?? lote.nombre ?? index;
        markers.addMarker({
          id: `overlay-lote-${selectedImg.id_imagen}-${markerKey}-${index}`,
          ...(hasSpherical
            ? { polygon: lote.polygon }
            : { polygonPixels: lote.polygonPixels }),
          svgStyle: {
            fill: lote.color || "#22c55e",
            fillOpacity: String(anchoredPreview.lotOpacity ?? 0.82),
            stroke: "rgba(255,255,255,0.86)",
            strokeWidth: "3px",
            strokeLinejoin: "round",
          },
          zIndex: 6,
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

  const updateSelectedOverlayConfig = (patch) => {
    if (!selectedImageId) return;

    const nextConfig = {
      ...(overlayLayoutsRef.current[selectedImageId] || DEFAULT_LAYOUT_CONFIG),
      ...patch,
    };
    const nextLayouts = {
      ...overlayLayoutsRef.current,
      [selectedImageId]: nextConfig,
    };
    overlayLayoutsRef.current = nextLayouts;
    selectedOverlayConfigRef.current = nextConfig;

    React.startTransition(() => {
      setOverlayLayouts(nextLayouts);
    });
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
      .map((lote) => {
        const loteId = String(getLoteId(lote) ?? "");
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
      const projectAnchoredPoints = (projectGeometry.projectPoints || [])
        .map(convertPoint)
        .filter((point) => point?.spherical);
      const projectPolygon = projectAnchoredPoints
        .map((point) => point.spherical)
        .filter(isValidSphericalPoint);
      const projectPolygonPixels = projectAnchoredPoints
        .map((point) => point.pixels)
        .filter(isValidTexturePoint);

      const lotOverrides = config?.lotOverrides ?? {};
      const activeGroupEdit = groupEditRef.current;
      const activeSelectedIds = selectedLotIdsRef.current;
      const baseOverrides = groupEditBaseRef.current;
      const groupCentroid =
        activeSelectedIds.size > 0
          ? computeGroupCentroid(
              projectGeometry.lotes,
              activeSelectedIds,
              baseOverrides,
            )
          : null;

      const lotPolygons = projectGeometry.lotes
        .map((lote) => {
          const loteId = String(getLoteId(lote) ?? "");
          const isSelected = activeSelectedIds.has(loteId);
          const override = loteId
            ? isSelected
              ? (baseOverrides[loteId] ?? {})
              : (lotOverrides[loteId] ?? {})
            : {};
          if (override.visible === false) return null;

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
          const anchoredPoints = transformedPoints
            .map(convertPoint)
            .filter((point) => point?.spherical);

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
              ? (activeGroupEdit.textureMode ??
                override.textureMode ??
                config.textureMode ??
                "solid")
              : (override.textureMode ?? config.textureMode ?? "solid"),
            lotOpacity: isSelected
              ? (activeGroupEdit.opacity ??
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
    return snapshotOverlayForImage(selectedImageId);
  };

  const handleSelectImage = (img) => {
    if (
      layoutEditModeRef.current ||
      !anchoredOverlaysRef.current[String(selectedImageId)]
    ) {
      persistCurrentOverlayPosition();
    }
    setSelectedImg(img);
  };

  const load2DGeometry = async () => {
    if (hasRenderableGeometry(projectGeometry)) {
      const hydrated = hydrateStoredGeometry(projectGeometry);
      if (hydrated !== projectGeometry) setProjectGeometry(hydrated);
      return hydrated;
    }
    if (geometryLoading) return hydrateStoredGeometry(projectGeometry);

    setGeometryLoading(true);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const projectRequest = authFetch(
        withApiBase(
          `https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`,
        ),
        { headers },
      );

      const lotesRequest = authFetch(
        withApiBase(
          `https://api.geohabita.com/api/listPuntosLoteProyecto/${idproyecto}/`,
        ),
        { headers },
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
          { headers },
        );

        lotesData = fallback.ok ? await fallback.json().catch(() => []) : [];
      }

      const geometry = hydrateStoredGeometry(
        buildImportedGeometry(projectData, lotesData),
      );
      setProjectGeometry(geometry);

      if (!geometry) {
        window.alertInfo?.(
          "Este proyecto aun no tiene trazos 2D listos para importar.",
        );
      }

      return geometry;
    } catch (error) {
      console.error("Error cargando trazos 2D para 360:", error);
      window.alertError?.(
        "No se pudieron importar los trazos 2D del proyecto.",
      );
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
      });

      if (loadedGeometry) {
        setProjectGeometry((prev) =>
          hasRenderableGeometry(prev)
            ? hydrateStoredGeometry(prev)
            : loadedGeometry,
        );
      }
      if (Object.keys(loadedLayouts).length) {
        setOverlayLayouts((prev) => ({ ...loadedLayouts, ...prev }));
      }
      if (Object.keys(loadedAnchoredOverlays).length) {
        setAnchoredOverlays((prev) => ({ ...loadedAnchoredOverlays, ...prev }));
      }
    } catch (error) {
      console.error("Error cargando imagenes 360 guardadas:", error);
    }
  }, [idproyecto, token]);

  const importLayoutIntoCurrentImage = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!selectedImg) return;

    const geometry = await load2DGeometry();
    if (!geometry) return;

    const currentConfig = overlayLayouts[selectedImageId] || {};
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
    setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
    resetPointMode();
    window.alertSuccess?.("Trazos 2D importados en esta vista 360.");
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
  };

  const toggleSelectedOverlayVisibility = () => {
    if (!selectedOverlayConfig) return;
    const nextVisible = !selectedOverlayConfig.visible;
    if (!nextVisible) {
      setLayoutEditMode(false);
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

  const toggleLayoutEditMode = () => {
    if (alignmentModeRef.current?.active) return;

    if (layoutEditMode) {
      persistCurrentOverlayPosition();
      setLayoutEditMode(false);
      setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
      return;
    }

    resetPointMode();
    setLayoutEditMode(true);
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
    anchoredOverlaysRef.current = anchoredOverlays;
  }, [anchoredOverlays]);

  useEffect(() => {
    layoutEditModeRef.current = layoutEditMode;
  }, [layoutEditMode]);

  useEffect(() => {
    alignmentModeRef.current = alignmentMode;
  }, [alignmentMode]);

  useEffect(() => {
    overlayVisibleRef.current = !!selectedOverlayConfig?.visible;
  }, [selectedOverlayConfig?.visible]);

  useEffect(() => {
    setLayoutEditMode(false);
    setDragState(null);
    setAlignmentMode(DEFAULT_ALIGNMENT_STATE);
    setSelectedLotIds(new Set());
    selectedLotIdsRef.current = new Set();
    setGroupEdit(DEFAULT_GROUP_EDIT);
    groupEditRef.current = DEFAULT_GROUP_EDIT;
    groupEditBaseRef.current = {};
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

    const viewer = new runtime.Viewer({
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
      if (!marker?.data?.destinoId) return;

      const destino = imagenes.find(
        (img) => img.id_imagen === marker.data.destinoId,
      );
      if (destino) {
        if (
          layoutEditModeRef.current ||
          !anchoredOverlaysRef.current[String(selectedImageId)]
        ) {
          persistCurrentOverlayPosition();
        }
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
  }, [selectedImg, imagenes, viewerRuntimeReady]);

  useEffect(() => {
    if (viewerReady && !dragState && !groupDragState) {
      renderHotspots();
    }
  }, [
    viewerReady,
    conexionesActuales,
    coords,
    selectedImg,
    layoutEditMode,
    anchoredOverlays,
    dragState,
    groupDragState,
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

    setBatchItems((prev) => [...prev, ...items]);
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
      "Imagenes agregadas al borrador local. Aun no se enviaron al backend.",
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
    persistCurrentOverlayPosition();
    const currentConfig =
      selectedOverlayConfigRef.current || selectedOverlayConfig;
    const currentLayoutRuntime = captureCurrentLayoutRuntime();
    const currentSnapshot = snapshotOverlayForImage(selectedImageId);
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
      ...Object.values(anchoredOverlays).filter(
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
      };

      if (
        resolvedOverlayPayload.layouts.length ||
        resolvedOverlayPayload.anchoredOverlays.length
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
    overlayDragPatchRef.current = {
      x: Math.round(dragState.x + deltaX),
      y: Math.round(dragState.y + deltaY),
    };

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
    if (dragState) setDragState(null);
    if (groupDragState) setGroupDragState(null);
  };

  useEffect(() => {
    if (!dragState && !groupDragState) return undefined;

    const handleWindowMouseMove = (event) => {
      handleOverlayPointerMove(event);
      handleGroupPointerMove(event);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", stopOverlayDrag);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", stopOverlayDrag);
    };
  }, [dragState, groupDragState]);

  const updateGroupEdit = (patch) => {
    const next = { ...groupEditRef.current, ...patch };
    groupEditRef.current = next;
    setGroupEdit(next);
  };

  const clearGroupSelection = () => {
    selectedLotIdsRef.current = new Set();
    setSelectedLotIds(new Set());
    setGroupEdit(DEFAULT_GROUP_EDIT);
    groupEditRef.current = DEFAULT_GROUP_EDIT;
    groupEditBaseRef.current = {};
  };

  const commitGroupEdit = (extraOverride = {}) => {
    const activeSelectedIds = selectedLotIdsRef.current;
    const activeGroupEdit = groupEditRef.current;
    const baseOverrides = groupEditBaseRef.current;
    if (activeSelectedIds.size === 0 || !projectGeometry) return;
    const gc = computeGroupCentroid(
      projectGeometry.lotes,
      activeSelectedIds,
      baseOverrides,
    );

    setOverlayLayouts((prev) => {
      const cfg = prev[selectedImageId] || DEFAULT_LAYOUT_CONFIG;
      const newOverrides = { ...(cfg.lotOverrides ?? {}) };

      projectGeometry.lotes.forEach((lote) => {
        const loteId = String(getLoteId(lote) ?? "");
        if (!activeSelectedIds.has(loteId)) return;
        const base = baseOverrides[loteId] ?? {};
        const basePts = applyLotSvgTransform(lote.points || [], base);
        const finalPts = applyGroupTransformWithTiltToPoints(
          basePts,
          gc.cx,
          gc.cy,
          activeGroupEdit,
        );
        const {
          committedCardTransform: _unusedCommittedCardTransform,
          ...previousOverride
        } = newOverrides[loteId] ?? {};

        newOverrides[loteId] = {
          ...previousOverride,
          committedPoints: finalPts,
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
        }
        next.add(loteId);
      }
      selectedLotIdsRef.current = next;
      return next;
    });
  };

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
      if (lotTextureMode === "solid") return baseColor;
      if (lotTextureMode === "outline") return "none";
      return `url(#gh-overlay-${lotTextureMode})`;
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
    return (
      <div
        className={`${styles.projectOverlayLayer} ${layoutEditMode ? styles.projectOverlayEditing : ""}${alignmentMode.active && alignmentMode.step !== "viewer" ? ` ${styles.overlayActiveForAlignment}` : ""}`}
        style={
          layerPerspective
            ? { perspective: `${layerPerspective}px` }
            : undefined
        }
      >
        <div
          className={styles.projectOverlayCard}
          style={{
            transform: cardTransform,
            opacity: hasAlignmentWarp ? 0 : layoutEditMode ? opacity : 0,
            visibility: layoutEditMode ? "visible" : "hidden",
            pointerEvents: hasAlignmentWarp ? "none" : undefined,
          }}
          onMouseDown={startOverlayDrag}
        >
          <div className={styles.projectOverlayHeader}>
            <span className={styles.overlayTitleBadge}>Trazos 2D</span>
            {layoutEditMode ? (
              <span className={styles.overlayEditHint}>
                <Move size={13} />
                Arrastra para ubicar
              </span>
            ) : (
              <span className={styles.overlayEditHint}>
                <Eye size={13} />
                Vista previa
              </span>
            )}
          </div>

          <svg
            ref={overlaySvgRef}
            className={styles.projectOverlaySvg}
            viewBox={`0 0 ${OVERLAY_VIEWBOX.width} ${OVERLAY_VIEWBOX.height}`}
            role="img"
            aria-label="Trazos 2D del proyecto importados al editor 360"
            style={shadowFilter ? { filter: shadowFilter } : undefined}
            onClick={handlePlanAlignmentClick}
          >
            <defs>
              {/* Hatch: líneas diagonales */}
              <pattern
                id="gh-overlay-hatch"
                x="0"
                y="0"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect
                  width="10"
                  height="10"
                  fill="currentColor"
                  fillOpacity="0.55"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="10"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth="3"
                />
              </pattern>
              {/* Dots: puntos */}
              <pattern
                id="gh-overlay-dots"
                x="0"
                y="0"
                width="12"
                height="12"
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width="12"
                  height="12"
                  fill="currentColor"
                  fillOpacity="0.4"
                />
                <circle
                  cx="6"
                  cy="6"
                  r="3"
                  fill="currentColor"
                  fillOpacity="0.9"
                />
              </pattern>
              {/* Cross: cuadrícula */}
              <pattern
                id="gh-overlay-cross"
                x="0"
                y="0"
                width="14"
                height="14"
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width="14"
                  height="14"
                  fill="currentColor"
                  fillOpacity="0.45"
                />
                <line
                  x1="7"
                  y1="0"
                  x2="7"
                  y2="14"
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="1.5"
                />
                <line
                  x1="0"
                  y1="7"
                  x2="14"
                  y2="7"
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="1.5"
                />
              </pattern>
            </defs>

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
              const loteId = String(getLoteId(lote) ?? index);
              const override = renderOverlayConfig.lotOverrides?.[loteId] ?? {};
              if (override.visible === false || selectedLotIds.has(loteId))
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

              let lotPath = lote.path || buildSvgPath(lote.points || []);
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
                  {lotTextureMode !== "solid" &&
                    lotTextureMode !== "outline" && (
                      <path
                        d={lotPath}
                        fill={lote.color}
                        fillOpacity={effectiveLotOpacity * 0.5}
                        className={styles.overlayLotePath}
                        strokeWidth="0"
                      />
                    )}
                  <path
                    d={lotPath}
                    fill={getLoteFill(lote.color, lotTextureMode)}
                    fillOpacity={
                      lotTextureMode === "solid" ? effectiveLotOpacity : 1
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
                  if (groupTexture === "solid") return color;
                  if (groupTexture === "outline") return "none";
                  return `url(#gh-overlay-${groupTexture})`;
                };

                return projectGeometry.lotes.map((lote, index) => {
                  const loteId = String(getLoteId(lote) ?? index);
                  const override = base[loteId] ?? {};
                  if (!selectedLotIds.has(loteId) || override.visible === false)
                    return null;
                  const basePts = applyLotSvgTransform(
                    lote.points || [],
                    override,
                  );
                  const projPts = applyGroupTransformWithTiltToPoints(
                    basePts,
                    gcx,
                    gcy,
                    renderGroupEdit,
                  );
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
                        stroke="#ffe000"
                        strokeWidth="10"
                        strokeLinejoin="round"
                        strokeOpacity="0.35"
                      />
                      {/* Borde de selección */}
                      <path
                        d={projPath}
                        fill="rgba(255,230,0,0.38)"
                        stroke="#ffe000"
                        strokeWidth="5"
                        strokeLinejoin="round"
                      />
                      {groupTexture !== "solid" &&
                        groupTexture !== "outline" && (
                          <path
                            d={projPath}
                            fill={lote.color}
                            fillOpacity={groupOpacity * 0.5}
                            className={styles.overlayLotePath}
                            strokeWidth="0"
                          />
                        )}
                      <path
                        d={projPath}
                        fill={getGLoteFill(lote.color)}
                        fillOpacity={
                          groupTexture === "solid" ? groupOpacity : 1
                        }
                        className={styles.overlayLotePath}
                      />
                    </g>
                  );
                });
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
                    Primero se guardan en el frontend, no en la base de datos.
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
                              {img.isDraft ? "Borrador local" : "Sincronizada"}
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
                    className={`${styles.viewerFrame}${alignmentMode.active && alignmentMode.step === "viewer" ? ` ${styles.viewerFrameActive}` : ""}`}
                    onClickCapture={handleViewerAlignmentClick}
                  >
                    {!viewerReady && (
                      <div className={styles.viewerLoading}>
                        Cargando visor...
                      </div>
                    )}
                    <div ref={viewerRef} className={styles.viewerCanvas} />
                    {renderImportedOverlay()}
                    {renderAlignmentViewerMarkers()}
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

              <button
                type="button"
                className={styles.btnPrimary360}
                onClick={saveTourToBackend}
                disabled={savingTour || !imagenes.length}
              >
                <Upload size={16} />
                {savingTour ? "Subiendo tour..." : "Subir tour al backend"}
              </button>

              <div className={styles.panelBlock}>
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
                  >
                    <MapIcon size={16} />
                    {geometryLoading ? "Importando..." : "Importar puntos 2D"}
                  </button>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={toggleLayoutEditMode}
                    disabled={
                      !selectedOverlayConfig?.visible || alignmentMode.active
                    }
                  >
                    <Move size={16} />
                    {alignmentMode.active
                      ? "Alineacion activa"
                      : layoutEditMode
                        ? "Salir de edicion"
                        : "Editar posicion"}
                  </button>
                </div>

                {layoutEditMode && selectedOverlayConfig?.visible && (
                  <p
                    className={styles.helperText}
                    style={{ textAlign: "center", marginTop: -8 }}
                  >
                    Sal del modo de edición para añadir hotspots.
                  </p>
                )}

                {selectedOverlayConfig?.visible && (
                  <div className={styles.alignmentPanel}>
                    <div className={styles.alignmentHeader}>
                      <strong>Modo Alinear</strong>
                      <span>
                        {alignmentMode.pairs.length} punto
                        {alignmentMode.pairs.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {!alignmentMode.active ? (
                      <p className={styles.helperText}>
                        Marca puntos iguales en el plano y en la foto 360 para
                        alinearlos. Necesitas mínimo 3 pares. Más puntos =
                        mejor precisión.
                      </p>
                    ) : (
                      <>
                        <div className={styles.alignmentSteps}>
                          <div
                            className={`${styles.alignmentStepBadge} ${alignmentMode.step !== "viewer" ? styles.alignmentStepBadgeActive : styles.alignmentStepBadgeDone}`}
                          >
                            <span
                              className={`${styles.alignmentStepNum} ${alignmentMode.step !== "viewer" ? styles.alignmentStepNumActive : styles.alignmentStepNumDone}`}
                            >
                              {alignmentMode.step !== "viewer"
                                ? alignmentMode.pairs.length + 1
                                : "✓"}
                            </span>
                            En el plano
                          </div>
                          <div
                            className={`${styles.alignmentStepBadge} ${alignmentMode.step === "viewer" ? styles.alignmentStepBadgeActive : ""}`}
                          >
                            <span
                              className={`${styles.alignmentStepNum} ${alignmentMode.step === "viewer" ? styles.alignmentStepNumActive : ""}`}
                            >
                              {alignmentMode.step === "viewer"
                                ? alignmentMode.pairs.length + 1
                                : "→"}
                            </span>
                            En el visor
                          </div>
                        </div>
                        <div className={styles.alignmentInstruction}>
                          {alignmentMode.step === "viewer" ? (
                            <>
                              <strong
                                className={styles.alignmentInstructionStrong}
                              >
                                Paso 2: Haz clic en el VISOR 360
                              </strong>
                              Busca el mismo punto que marcaste en el plano y
                              haz clic sobre él en la fotografía panorámica.
                            </>
                          ) : alignmentMode.step === "review" ? (
                            <>
                              <strong
                                className={styles.alignmentInstructionStrong}
                              >
                                Ajuste aplicado
                              </strong>
                              Revisa el resultado. Puedes añadir más puntos para
                              mejorar la precisión.
                            </>
                          ) : (
                            <>
                              <strong
                                className={styles.alignmentInstructionStrong}
                              >
                                Paso 1: Haz clic en el PLANO
                              </strong>
                              Elige una esquina de lote o intersección que
                              también puedas identificar en la foto 360.
                            </>
                          )}
                        </div>
                      </>
                    )}
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.btnPrimary360}
                        onClick={startAlignmentMode}
                        disabled={!selectedImg || geometryLoading}
                      >
                        <MousePointerClick size={16} />
                        {alignmentMode.active
                          ? "Reiniciar alineacion"
                          : "Activar Modo Alinear"}
                      </button>
                      {alignmentMode.active && (
                        <button
                          type="button"
                          className={styles.btnCancel}
                          onClick={cancelAlignmentMode}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>

                    {alignmentMode.pendingPlanPoint?.source && (
                      <div className={styles.alignmentSelectedPoint}>
                        Plano: {alignmentMode.pendingPlanPoint.source.label}
                        {alignmentMode.pendingPlanPoint.source.snapped
                          ? " · snap"
                          : " · libre"}
                      </div>
                    )}

                    {alignmentMode.error && (
                      <div className={styles.alignmentError}>
                        {alignmentMode.error}
                      </div>
                    )}

                    {alignmentMode.result && (
                      <div className={styles.alignmentResult}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            className={styles.qualityBadge}
                            data-tone={alignmentMode.result.quality.tone}
                          >
                            {alignmentMode.result.quality.tone === "good"
                              ? "✓"
                              : alignmentMode.result.quality.tone === "warn"
                                ? "⚠"
                                : "✗"}{" "}
                            Ajuste {alignmentMode.result.quality.label}
                          </span>
                          <button
                            type="button"
                            className={styles.toggleButton}
                            style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                            onClick={() =>
                              setShowAlignmentDetails((prev) => !prev)
                            }
                          >
                            {showAlignmentDetails
                              ? "Ocultar detalle"
                              : "Ver detalle"}
                          </button>
                        </div>
                        {showAlignmentDetails && (
                          <div className={styles.qualityDetails}>
                            <span>
                              {alignmentMode.result.pointCount} puntos · Error
                              promedio:{" "}
                              {alignmentMode.result.averageError.toFixed(1)} px
                              · Máximo:{" "}
                              {alignmentMode.result.maxError.toFixed(1)} px
                            </span>
                            {alignmentMode.result.residuals.map((item) => (
                              <span key={item.index}>
                                P{item.index}: {item.error.toFixed(1)} px
                              </span>
                            ))}
                          </div>
                        )}
                        <div className={styles.panelActions}>
                          <button
                            type="button"
                            className={styles.toggleButton}
                            onClick={continueAlignmentPoints}
                          >
                            <Plus size={14} />
                            Agregar otro punto
                          </button>
                          <button
                            type="button"
                            className={styles.toggleButton}
                            onClick={undoLastAlignmentPair}
                            disabled={!alignmentMode.pairs.length}
                          >
                            Deshacer ultimo
                          </button>
                        </div>
                        {alignmentMode.pairs.length >
                          REQUIRED_AFFINE_POINTS && (
                          <button
                            type="button"
                            className={styles.toggleButton}
                            onClick={removeWorstAlignmentPair}
                          >
                            Quitar punto con mas error
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.toggleButton}
                          onClick={resetAlignmentPairs}
                        >
                          Rehacer todos los puntos
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!layoutEditMode && !alignmentMode.active && (
                  <>
                    {!hasValidCoords ? (
                      selectedImg && (
                        <p
                          className={styles.helperText}
                          style={{ textAlign: "center" }}
                        >
                          Haz click en el visor para colocar un punto nuevo.
                        </p>
                      )
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
                                    src={img.imagen}
                                    alt={img.nombre}
                                    className={styles.destinationThumb}
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
                    </div>

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

                        <div className={styles.positionPair}>
                          <span className={styles.positionPairLabel}>
                            Posición
                          </span>
                          <div className={styles.positionPairCols}>
                            <div className={styles.positionPairItem}>
                              <span>X</span>
                              <button
                                type="button"
                                className={styles.arrowBtn}
                                onClick={() =>
                                  updateSelectedOverlayConfig({
                                    x: (selectedOverlayConfig.x ?? 70) - 10,
                                  })
                                }
                              >
                                ←
                              </button>
                              <input
                                type="number"
                                className={styles.numberInput}
                                step="5"
                                value={Math.round(
                                  selectedOverlayConfig.x ?? 70,
                                )}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (Number.isFinite(v))
                                    updateSelectedOverlayConfig({ x: v });
                                }}
                              />
                              <button
                                type="button"
                                className={styles.arrowBtn}
                                onClick={() =>
                                  updateSelectedOverlayConfig({
                                    x: (selectedOverlayConfig.x ?? 70) + 10,
                                  })
                                }
                              >
                                →
                              </button>
                            </div>
                            <div className={styles.positionPairItem}>
                              <span>Y</span>
                              <button
                                type="button"
                                className={styles.arrowBtn}
                                onClick={() =>
                                  updateSelectedOverlayConfig({
                                    y: (selectedOverlayConfig.y ?? 70) - 10,
                                  })
                                }
                              >
                                ↑
                              </button>
                              <input
                                type="number"
                                className={styles.numberInput}
                                step="5"
                                value={Math.round(
                                  selectedOverlayConfig.y ?? 70,
                                )}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (Number.isFinite(v))
                                    updateSelectedOverlayConfig({ y: v });
                                }}
                              />
                              <button
                                type="button"
                                className={styles.arrowBtn}
                                onClick={() =>
                                  updateSelectedOverlayConfig({
                                    y: (selectedOverlayConfig.y ?? 70) + 10,
                                  })
                                }
                              >
                                ↓
                              </button>
                            </div>
                          </div>
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
                          </label>
                          <div className={styles.presetRow}>
                            {[
                              {
                                label: "Vista aérea",
                                tiltX: -35,
                                tiltY: 0,
                                perspectiveDepth: 700,
                              },
                              {
                                label: "Perspectiva suave",
                                tiltX: -15,
                                tiltY: 0,
                                perspectiveDepth: 1200,
                              },
                              {
                                label: "Sin inclinación",
                                tiltX: 0,
                                tiltY: 0,
                                perspectiveDepth: 900,
                              },
                            ].map(({ label, ...preset }) => (
                              <button
                                key={label}
                                type="button"
                                className={styles.presetBtn}
                                onClick={() =>
                                  updateSelectedOverlayConfig(preset)
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={styles.reliefSection}>
                          <p className={styles.reliefSectionTitle}>
                            Textura de lotes
                          </p>
                          <div className={styles.textureSelectorRow}>
                            {[
                              { key: "solid", label: "Sólido" },
                              { key: "hatch", label: "Tramas" },
                              { key: "dots", label: "Puntos" },
                              { key: "cross", label: "Cruz" },
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
                                Editar por bloque
                              </p>

                              {selectedLotIds.size === 0 ? (
                                <p className={styles.helperText}>
                                  Click en los lotes del visor para
                                  seleccionarlos. Arrastra el conjunto para
                                  moverlo.
                                </p>
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
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Posición del grupo
                                  </div>
                                  <div className={styles.positionPair}>
                                    <span className={styles.positionPairLabel}>
                                      Mover
                                    </span>
                                    <div className={styles.positionPairCols}>
                                      <div className={styles.positionPairItem}>
                                        <span>X</span>
                                        <button
                                          type="button"
                                          className={styles.arrowBtn}
                                          onClick={() =>
                                            updateGroupEdit({
                                              dx: groupEdit.dx - 10,
                                            })
                                          }
                                        >
                                          ←
                                        </button>
                                        <input
                                          type="number"
                                          className={styles.numberInput}
                                          step="5"
                                          value={Math.round(groupEdit.dx)}
                                          onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (Number.isFinite(v))
                                              updateGroupEdit({ dx: v });
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className={styles.arrowBtn}
                                          onClick={() =>
                                            updateGroupEdit({
                                              dx: groupEdit.dx + 10,
                                            })
                                          }
                                        >
                                          →
                                        </button>
                                      </div>
                                      <div className={styles.positionPairItem}>
                                        <span>Y</span>
                                        <button
                                          type="button"
                                          className={styles.arrowBtn}
                                          onClick={() =>
                                            updateGroupEdit({
                                              dy: groupEdit.dy - 10,
                                            })
                                          }
                                        >
                                          ↑
                                        </button>
                                        <input
                                          type="number"
                                          className={styles.numberInput}
                                          step="5"
                                          value={Math.round(groupEdit.dy)}
                                          onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (Number.isFinite(v))
                                              updateGroupEdit({ dy: v });
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className={styles.arrowBtn}
                                          onClick={() =>
                                            updateGroupEdit({
                                              dy: groupEdit.dy + 10,
                                            })
                                          }
                                        >
                                          ↓
                                        </button>
                                      </div>
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
                                  </label>

                                  <div
                                    className={styles.reliefSectionTitle}
                                    style={{ marginTop: 10 }}
                                  >
                                    Textura del grupo
                                  </div>
                                  <div className={styles.textureSelectorRow}>
                                    {[
                                      { key: "solid", label: "Sólido" },
                                      { key: "hatch", label: "Tramas" },
                                      { key: "dots", label: "Puntos" },
                                      { key: "cross", label: "Cruz" },
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

                    <p className={styles.helperText}>
                      Consejo: usa el Modo Alinear para mayor precisión. El
                      ajuste rápido es ideal para un posicionamiento inicial.
                    </p>
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
        </div>
      </div>
    </div>
  );
};

export default Modal360;
