import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
};

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

const makeMarkerPosition = (yaw, pitch) => ({ yaw, pitch });

const normalizePolygonCoords = (coords = []) => {
  const normalized = coords
    .map((point) => ({
      lat: Number(point.lat ?? point.latitud),
      lng: Number(point.lng ?? point.longitud),
      orden: point.orden,
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

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
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ")} Z`
    : "";

const getLoteFill = (vendido) => {
  const value = Number(vendido);
  if (value === 1) return "#ef4444";
  if (value === 2) return "#f59e0b";
  return "#22c55e";
};

const getLoteId = (lote) => lote?.idlote ?? lote?.id ?? lote?.id_lote ?? lote?.lote_id;

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

const serializeOverlayLayouts = (overlayLayouts, runtimeByImage = {}, imageIds = null) => {
  const allowedImageIds = imageIds ? new Set([...imageIds].map(String)) : null;

  return Object.entries(overlayLayouts)
    .filter(([imageId, config]) => {
      if (allowedImageIds && !allowedImageIds.has(String(imageId))) return false;
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

const transformOverlayPoint = (point, config, baseScaleX, baseScaleY) => {
  const angle = ((Number(config?.rotation) || 0) * Math.PI) / 180;
  const scale = Number(config?.scale) || 1;
  const tx = Number(config?.x) || 0;
  const ty = Number(config?.y) || 0;
  const localX = point.x * baseScaleX;
  const localY = point.y * baseScaleY;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = localX * cos - localY * sin;
  const ry = localX * sin + localY * cos;

  return {
    x: tx + rx * scale,
    y: ty + ry * scale,
  };
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

  if (!width || !height || !Number.isFinite(viewerX) || !Number.isFinite(viewerY)) {
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
    }) || projectViewerPointWithCamera(viewer, { x: viewerX, y: viewerY }, width, height);
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

  return Number.isFinite(spherical.yaw) &&
    Number.isFinite(spherical.pitch)
    ? {
        spherical: [spherical.yaw, spherical.pitch],
        pixels: texturePoint,
      }
    : null;
};

const Modal360 = ({ idproyecto, onClose }) => {
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

  const token = localStorage.getItem("access");
  const viewerRef = useRef(null);
  const viewerInstance = useRef(null);
  const viewerRuntimeRef = useRef(null);
  const overlaySvgRef = useRef(null);
  const batchItemsRef = useRef([]);
  const imagenesRef = useRef([]);
  const anchoredOverlaysRef = useRef({});
  const layoutEditModeRef = useRef(false);
  const overlayVisibleRef = useRef(false);

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

  const selectedImageId = selectedImg?.id_imagen ? String(selectedImg.id_imagen) : "";
  const selectedOverlayConfig = selectedImageId ? overlayLayouts[selectedImageId] : null;

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

    const storedAnchoredOverlay = anchoredOverlays[String(selectedImg.id_imagen)] || null;
    const anchoredPreview =
      !layoutEditModeRef.current && selectedOverlayConfig?.visible
        ? storedAnchoredOverlay ||
          buildAnchoredOverlaySnapshot(selectedImg.id_imagen, selectedOverlayConfig)
        : storedAnchoredOverlay;

    if (anchoredPreview?.visible) {
      if (
        anchoredPreview.showProjectOutline !== false &&
        ((Array.isArray(anchoredPreview.projectPolygon) &&
          anchoredPreview.projectPolygon.length >= 3) ||
          (Array.isArray(anchoredPreview.projectPolygonPixels) &&
            anchoredPreview.projectPolygonPixels.length >= 3))
      ) {
        markers.addMarker({
          id: `overlay-project-${selectedImg.id_imagen}`,
          ...(Array.isArray(anchoredPreview.projectPolygon) &&
          anchoredPreview.projectPolygon.length >= 3
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
        const hasSpherical = Array.isArray(lote.polygon) && lote.polygon.length >= 3;
        const hasPixels = Array.isArray(lote.polygonPixels) && lote.polygonPixels.length >= 3;
        if (!hasSpherical && !hasPixels) return;
        const markerKey = lote.idlote ?? lote.nombre ?? index;
        markers.addMarker({
          id: `overlay-lote-${selectedImg.id_imagen}-${markerKey}-${index}`,
          ...(hasSpherical ? { polygon: lote.polygon } : { polygonPixels: lote.polygonPixels }),
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

    setOverlayLayouts((prev) => ({
      ...prev,
      [selectedImageId]: {
        ...(prev[selectedImageId] || DEFAULT_LAYOUT_CONFIG),
        ...patch,
      },
    }));
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
        overlaySvg?.clientWidth || overlaySvg?.viewBox?.baseVal?.width || OVERLAY_VIEWBOX.width,
      ),
      overlayHeight: Number(
        overlaySvg?.clientHeight || overlaySvg?.viewBox?.baseVal?.height || OVERLAY_VIEWBOX.height,
      ),
      overlayOffsetX: Number(overlaySvg?.offsetLeft || 0),
      overlayOffsetY: Number(overlaySvg?.offsetTop || 0),
    };
  };

  const getCurrentScreenOverlaySnapshot = (
    config = selectedOverlayConfig,
    runtime = getCurrentOverlayRuntime(),
  ) => {
    if (!config?.visible || !projectGeometry || !runtime) return null;

    const svgWidth = Number(runtime.overlayWidth) || OVERLAY_VIEWBOX.width;
    const svgHeight = Number(runtime.overlayHeight) || OVERLAY_VIEWBOX.height;
    const offsetX = Number(runtime.overlayOffsetX) || 0;
    const offsetY = Number(runtime.overlayOffsetY) || 0;

    const convertPoint = (point) => {
      const localPoint = {
        x: offsetX + (point.x / OVERLAY_VIEWBOX.width) * svgWidth,
        y: offsetY + (point.y / OVERLAY_VIEWBOX.height) * svgHeight,
      };
      const viewerPoint = transformOverlayPoint(localPoint, config, 1, 1);

      if (!Number.isFinite(viewerPoint.x) || !Number.isFinite(viewerPoint.y)) return null;
      return [viewerPoint.x, viewerPoint.y];
    };

    const projectPolygonPoints = (projectGeometry.projectPoints || [])
      .map(convertPoint)
      .filter(isValidTexturePoint);

    const lotPolygons = (projectGeometry.lotes || [])
      .map((lote) => ({
        idlote: lote.idlote,
        color: lote.color,
        vendido: lote.vendido,
        polygonPoints: (lote.points || [])
          .map(convertPoint)
          .filter(isValidTexturePoint),
      }))
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
    const screenOverlay = getCurrentScreenOverlaySnapshot(selectedOverlayConfig, runtime);

    setOverlayLayouts((prev) => ({
      ...prev,
      [String(imageId)]: {
        ...(prev[String(imageId)] || DEFAULT_LAYOUT_CONFIG),
        ...runtime,
        ...(screenOverlay ? { screenOverlay } : {}),
      },
    }));

    return {
      ...runtime,
      ...(screenOverlay ? { screenOverlay } : {}),
    };
  };

  const buildAnchoredOverlaySnapshot = (imageId = selectedImageId, config = selectedOverlayConfig) => {
    const viewer = viewerInstance.current;
    const viewerElement = viewerRef.current;
    const overlaySvg = overlaySvgRef.current;
    if (!viewer || !viewerElement || !overlaySvg || !projectGeometry || !config?.visible || !imageId) {
      return anchoredOverlays[String(imageId)] || null;
    }

    const svgMatrix = overlaySvg.getScreenCTM?.();
    const viewerRect = viewerElement.getBoundingClientRect();
    const svgLayoutWidth = overlaySvg.clientWidth || overlaySvg.viewBox?.baseVal?.width || OVERLAY_VIEWBOX.width;
    const svgLayoutHeight =
      overlaySvg.clientHeight || overlaySvg.viewBox?.baseVal?.height || OVERLAY_VIEWBOX.height;
    const svgOffsetX = overlaySvg.offsetLeft || 0;
    const svgOffsetY = overlaySvg.offsetTop || 0;

    if (!svgLayoutWidth || !svgLayoutHeight || !viewerRect.width || !viewerRect.height) {
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

      const lotPolygons = projectGeometry.lotes
        .map((lote) => {
          const anchoredPoints = (lote.points || [])
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
            polygon: anchoredPoints
              .map((point) => point.spherical)
              .filter(isValidSphericalPoint),
            polygonPixels: anchoredPoints
              .map((point) => point.pixels)
              .filter(isValidTexturePoint),
          };
        })
        .filter((lote) => lote.polygon.length >= 3 || lote.polygonPixels.length >= 3);

      return {
        imageId: String(imageId),
        visible: config.visible !== false,
        lotOpacity: config.lotOpacity,
        showProjectOutline: config.showProjectOutline !== false,
        projectPolygon: projectPolygon.length >= 3 ? projectPolygon : [],
        projectPolygonPixels:
          projectPolygonPixels.length >= 3 ? projectPolygonPixels : [],
        lotPolygons,
      };
    };

    const scoreSnapshot = (snapshot) =>
      (snapshot.projectPolygon?.length || 0) +
      (snapshot.projectPolygonPixels?.length || 0) +
      (snapshot.lotPolygons || []).reduce(
        (sum, lote) =>
          sum + Math.max(lote.polygon?.length || 0, lote.polygonPixels?.length || 0),
        0,
      );

    const convertPointFromLayout = (point) => {
      const localPoint = {
        x: svgOffsetX + (point.x / OVERLAY_VIEWBOX.width) * svgLayoutWidth,
        y: svgOffsetY + (point.y / OVERLAY_VIEWBOX.height) * svgLayoutHeight,
      };
      const viewerPoint = transformOverlayPoint(localPoint, config, 1, 1);

      if (!Number.isFinite(viewerPoint.x) || !Number.isFinite(viewerPoint.y)) return null;
      return projectViewerPointToAnchoredPoint(viewer, viewerPoint, {
        allowOutOfViewport: true,
      });
    };

    const layoutSnapshot = buildSnapshotFromConverter(convertPointFromLayout);

    if (!svgMatrix) {
      return layoutSnapshot;
    }

    const convertPointFromMatrix = (point) => {
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(svgMatrix);
      const viewerPoint = {
        x: screenPoint.x - viewerRect.left,
        y: screenPoint.y - viewerRect.top,
      };

      if (!Number.isFinite(viewerPoint.x) || !Number.isFinite(viewerPoint.y)) return null;
      return projectViewerPointToAnchoredPoint(viewer, viewerPoint, {
        allowOutOfViewport: true,
      });
    };

    const matrixSnapshot = buildSnapshotFromConverter(convertPointFromMatrix);

    return scoreSnapshot(matrixSnapshot) >= scoreSnapshot(layoutSnapshot)
      ? matrixSnapshot
      : layoutSnapshot;
  };

  const snapshotOverlayForImage = (imageId = selectedImageId, config = selectedOverlayConfig) => {
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
    if (!selectedOverlayConfig?.visible) return null;
    captureCurrentLayoutRuntime();
    return snapshotOverlayForImage();
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
    if (projectGeometry || geometryLoading) return projectGeometry;

    setGeometryLoading(true);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const projectRequest = authFetch(
        withApiBase(`https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`),
        { headers },
      );

      const lotesRequest = authFetch(
        withApiBase(`https://api.geohabita.com/api/listPuntosLoteProyecto/${idproyecto}/`),
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
          withApiBase(`https://api.geohabita.com/api/getLoteProyecto/${idproyecto}`),
          { headers },
        );

        lotesData = fallback.ok ? await fallback.json().catch(() => []) : [];
      }

      const geometry = buildImportedGeometry(projectData, lotesData);
      setProjectGeometry(geometry);

      if (!geometry) {
        window.alertInfo?.("Este proyecto aun no tiene trazos 2D listos para importar.");
      }

      return geometry;
    } catch (error) {
      console.error("Error cargando trazos 2D para 360:", error);
      window.alertError?.("No se pudieron importar los trazos 2D del proyecto.");
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
        if (!loadedGeometry && payload.geometry) loadedGeometry = payload.geometry;

        (payload.layouts || []).forEach((layout) => {
          const imageId = String(
            layout?.imageId ?? layout?.imagenId ?? layout?.id_imagen ?? "",
          );
          if (imageId) loadedLayouts[imageId] = layout;
        });

        (payload.anchoredOverlays || payload.panoramaOverlays || []).forEach((overlay) => {
          const imageId = String(
            overlay?.imageId ?? overlay?.imagenId ?? overlay?.id_imagen ?? "",
          );
          if (imageId && hasAnchoredGeometry(overlay)) {
            loadedAnchoredOverlays[imageId] = {
              ...overlay,
              imageId,
            };
          }
        });
      });

      if (loadedGeometry) setProjectGeometry((prev) => prev || loadedGeometry);
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
    window.alertSuccess?.("Trazos 2D importados en esta vista 360.");
  };

  const resetOverlayForCurrentImage = () => {
    if (!selectedImageId) return;
    setOverlayLayouts((prev) => ({
      ...prev,
      [selectedImageId]: {
        ...DEFAULT_LAYOUT_CONFIG,
      },
    }));
  };

  const toggleLayoutEditMode = () => {
    if (layoutEditMode) {
      persistCurrentOverlayPosition();
      setLayoutEditMode(false);
      return;
    }

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
    anchoredOverlaysRef.current = anchoredOverlays;
  }, [anchoredOverlays]);

  useEffect(() => {
    layoutEditModeRef.current = layoutEditMode;
  }, [layoutEditMode]);

  useEffect(() => {
    overlayVisibleRef.current = !!selectedOverlayConfig?.visible;
  }, [selectedOverlayConfig?.visible]);

  useEffect(() => {
    setLayoutEditMode(false);
    setDragState(null);
  }, [selectedImageId]);

  useEffect(() => {
    if (!selectedImg || !viewerRef.current || !viewerRuntimeReady) {
      return undefined;
    }

    setViewerReady(false);
    resetPointMode();
    const runtime = viewerRuntimeRef.current || viewerRuntimeCache;
    if (!runtime) return undefined;

    const viewer = new runtime.Viewer({
      container: viewerRef.current,
      panorama: selectedImg.imagen,
      plugins: [[runtime.MarkersPlugin, {}]],
      navbar: ["zoom", "move", "caption", "fullscreen"],
      caption: `${selectedImg.nombre} · borrador local`,
      loadingImg: "https://geohabita.com/loading.gif",
    });

    viewerInstance.current = viewer;
    const markers = viewer.getPlugin(runtime.MarkersPlugin);

    viewer.addEventListener("click", ({ data }) => {
      if (layoutEditModeRef.current && overlayVisibleRef.current) {
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

      const destino = imagenes.find((img) => img.id_imagen === marker.data.destinoId);
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
      viewer.destroy();
      viewerInstance.current = null;
    };
  }, [selectedImg, imagenes, viewerRuntimeReady]);

  useEffect(() => {
    if (viewerReady) {
      renderHotspots();
    }
  }, [
    viewerReady,
    conexionesActuales,
    coords,
    selectedImg,
    selectedOverlayConfig,
    layoutEditMode,
    anchoredOverlays,
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
      prev.map((item, idx) => (idx === index ? { ...item, nombre: value } : item)),
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
    window.alertInfo?.("Imagenes agregadas al borrador local. Aun no se enviaron al backend.");
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
    if (!hasValidCoords || !selectedImg || !newPointFile || !newPointName.trim()) return;

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
    window.alertSuccess?.("Nueva vista creada y conectada en el borrador local.");
  };

  const saveTourToBackend = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!imagenes.length) {
      window.alertInfo?.("Agrega al menos una imagen 360 antes de subir el tour.");
      return;
    }

    const draftImages = imagenes.filter((img) => img.isDraft && img.file);
    const draftIdsBeingUploaded = new Set(draftImages.map((img) => String(img.id_imagen)));
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
    const currentLayoutRuntime = captureCurrentLayoutRuntime();
    const currentSnapshot = snapshotOverlayForImage();
    const runtimeByImage = {
      ...(selectedImageId && currentLayoutRuntime
        ? {
            [String(selectedImageId)]: currentLayoutRuntime,
          }
        : {}),
    };
    const layoutSource = {
      ...overlayLayouts,
      ...(selectedImageId && currentLayoutRuntime
        ? {
            [String(selectedImageId)]: {
              ...(overlayLayouts[String(selectedImageId)] || DEFAULT_LAYOUT_CONFIG),
              ...currentLayoutRuntime,
            },
          }
        : {}),
    };
    const payloadAnchoredOverlays = [
      ...Object.values(anchoredOverlays).filter(
        (item) =>
          String(item?.imageId ?? "") !== String(currentSnapshot?.imageId ?? "") &&
          hasAnchoredGeometry(item),
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

    if (selectedOverlayConfig?.visible && projectGeometry && !payloadAnchoredOverlays.length) {
      const projectCount = currentSnapshot?.projectPolygonPixels?.length || 0;
      const sphericalProjectCount = currentSnapshot?.projectPolygon?.length || 0;
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
      const res = await authFetch(buildApiUrl("/api/guardar_tour_360_completo/"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar el tour 360");
      }

      if (skippedConnections > 0) {
        window.alertInfo?.(
          `${skippedConnections} conexion(es) no se enviaron porque apuntaban a imagenes temporales que no estaban en este guardado.`,
        );
      }

      const imageMap = data.image_map || {};
      const savedImagesByDraft = new Map(
        (data.imagenes || []).map((img) => [img.draft_id, img]),
      );
      const resolvedOverlayPayload = {
        geometry: projectGeometry,
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

      if (resolvedOverlayPayload.layouts.length || resolvedOverlayPayload.anchoredOverlays.length) {
        const overlayUpdateForm = new FormData();
        overlayUpdateForm.append("idproyecto", idproyecto);
        overlayUpdateForm.append("conexiones", JSON.stringify([]));
        overlayUpdateForm.append(
          "overlays_2d",
          JSON.stringify(resolvedOverlayPayload),
        );

        await authFetch(buildApiUrl("/api/guardar_tour_360_completo/"), {
          method: "POST",
          body: overlayUpdateForm,
        });
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
    updateSelectedOverlayConfig({
      x: Math.round(dragState.x + deltaX),
      y: Math.round(dragState.y + deltaY),
    });
  };

  const stopOverlayDrag = () => {
    if (!dragState) return;
    setDragState(null);
  };

  const renderImportedOverlay = () => {
    if (!selectedOverlayConfig?.visible || !projectGeometry) return null;

    return (
      <div
        className={`${styles.projectOverlayLayer} ${layoutEditMode ? styles.projectOverlayEditing : ""}`}
        onMouseMove={handleOverlayPointerMove}
        onMouseUp={stopOverlayDrag}
        onMouseLeave={stopOverlayDrag}
      >
        <div
          className={styles.projectOverlayCard}
          style={{
            transform: `translate(${selectedOverlayConfig.x}px, ${selectedOverlayConfig.y}px) scale(${selectedOverlayConfig.scale}) rotate(${selectedOverlayConfig.rotation}deg)`,
            opacity: layoutEditMode ? selectedOverlayConfig.opacity : 0,
            visibility: layoutEditMode ? "visible" : "hidden",
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
          >
            {selectedOverlayConfig.showProjectOutline && !!projectGeometry.projectPath && (
              <path
                d={projectGeometry.projectPath}
                className={styles.overlayProjectGlow}
              />
            )}
            {selectedOverlayConfig.showProjectOutline && !!projectGeometry.projectPath && (
              <path
                d={projectGeometry.projectPath}
                className={styles.overlayProjectPath}
              />
            )}

            {projectGeometry.lotes.map((lote, index) => (
              <g key={lote.idlote ?? lote.path ?? `lote-${index}`}>
                <path
                  d={lote.path}
                  fill={lote.color}
                  fillOpacity={selectedOverlayConfig.lotOpacity}
                  className={styles.overlayLotePath}
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={styles.modalContent360}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-360-title"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="modal-360-title">
              Tour 360 <span>#{idproyecto}</span>
            </h2>
            <p className={styles.headerText}>
              Sube vistas 360, crea hotspots y ahora importa los trazos 2D del proyecto para acomodarlos sobre cada imagen.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar modal 360"
          >
            <X size={18} />
          </button>
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
                  <span>Primero se guardan en el frontend, no en la base de datos.</span>
                </label>

                {!!batchItems.length && (
                  <div className={styles.itemsList}>
                    {batchItems.map((item, index) => (
                      <div className={styles.itemRow} key={`${item.file.name}-${index}`}>
                        <img src={item.preview} alt={item.nombre} className={styles.queueThumb} />
                        <input
                          value={item.nombre}
                          onChange={(event) => updateBatchItemName(index, event.target.value)}
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
                  <div className={styles.emptyState}>Aun no hay imagenes en el borrador.</div>
                ) : (
                  <div className={styles.galleryList}>
                    {imagenes.map((img) => {
                      const imageOverlay = overlayLayouts[String(img.id_imagen)];

                      return (
                        <button
                          key={img.id_imagen}
                          type="button"
                          className={`${styles.galleryItem} ${selectedImg?.id_imagen === img.id_imagen ? styles.activeItem : ""}`}
                          onClick={() => handleSelectImage(img)}
                        >
                          <img src={img.imagen} alt={img.nombre} className={styles.galleryThumb} />
                          <div className={styles.galleryMeta}>
                            <strong>{img.nombre}</strong>
                            <span>{img.isDraft ? "Borrador local" : "Sincronizada"}</span>
                            {imageOverlay?.visible && (
                              <span className={styles.galleryOverlayTag}>Con trazos 2D</span>
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
                      Necesitas al menos 2 imagenes en el borrador para crear una conexion entre vistas.
                    </div>
                  )}
                  <div className={styles.viewerFrame}>
                    {!viewerReady && <div className={styles.viewerLoading}>Cargando visor...</div>}
                    <div ref={viewerRef} className={styles.viewerCanvas} />
                    {renderImportedOverlay()}
                  </div>
                </>
              ) : (
                <div className={styles.viewerPlaceholder}>
                  <ImagePlus size={34} />
                  <h3>Selecciona o agrega una imagen 360</h3>
                  <p>La vista elegida aparecera aqui para crear hotspots y superponer los trazos 2D del proyecto.</p>
                </div>
              )}
            </section>

            <aside className={styles.connectionPanel}>
              <div className={styles.sectionTitleRow}>
                <Link2 size={16} />
                <h3>Conexion y trazos</h3>
              </div>

              <div className={styles.helperBox}>
                {imagenes.length} imagen(es) en borrador · {conexiones.length} conexion(es) creadas
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
                    <span>{importedOverlaySummary.lotes} lotes listos para importar</span>
                    <span>{importedOverlaySummary.vertices} puntos del proyecto</span>
                  </div>
                ) : (
                  <p className={styles.helperText}>
                    Importa el proyecto 2D para colocarlo encima de la vista 360, como maqueta editable.
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
                    disabled={!selectedOverlayConfig?.visible}
                  >
                    <Move size={16} />
                    {layoutEditMode ? "Salir de edicion" : "Editar posicion"}
                  </button>
                </div>

                {selectedOverlayConfig ? (
                  <>
                    <div className={styles.toggleRow}>
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={() =>
                          updateSelectedOverlayConfig({
                            visible: !selectedOverlayConfig.visible,
                          })
                        }
                      >
                        {selectedOverlayConfig.visible ? <EyeOff size={15} /> : <Eye size={15} />}
                        {selectedOverlayConfig.visible ? "Ocultar overlay" : "Mostrar overlay"}
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

                    <label className={styles.rangeControl}>
                      <span>Escala</span>
                      <input
                        type="range"
                        min="0.3"
                        max="1.8"
                        step="0.01"
                        value={selectedOverlayConfig.scale}
                        onChange={(event) =>
                          updateSelectedOverlayConfig({
                            scale: Number(event.target.value),
                          })
                        }
                      />
                      <strong>{Math.round(selectedOverlayConfig.scale * 100)}%</strong>
                    </label>

                    <label className={styles.rangeControl}>
                      <span>Rotacion</span>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={selectedOverlayConfig.rotation}
                        onChange={(event) =>
                          updateSelectedOverlayConfig({
                            rotation: Number(event.target.value),
                          })
                        }
                      />
                      <strong>{selectedOverlayConfig.rotation}°</strong>
                    </label>

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
                      <strong>{Math.round(selectedOverlayConfig.opacity * 100)}%</strong>
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
                      <strong>{Math.round(selectedOverlayConfig.lotOpacity * 100)}%</strong>
                    </label>

                    <div className={styles.toggleRow}>
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={() =>
                          updateSelectedOverlayConfig({
                            showProjectOutline: !selectedOverlayConfig.showProjectOutline,
                          })
                        }
                      >
                        {selectedOverlayConfig.showProjectOutline ? <EyeOff size={15} /> : <Eye size={15} />}
                        {selectedOverlayConfig.showProjectOutline ? "Ocultar contorno" : "Mostrar contorno"}
                      </button>
                    </div>

                    <p className={styles.helperText}>
                      Consejo: activa "Editar posicion", arrastra el overlay desde la vista y afina escala/rotacion hasta que coincida con la foto 360.
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

              {!hasValidCoords ? (
                <div className={styles.emptyState}>
                  {selectedImg
                    ? layoutEditMode && selectedOverlayConfig?.visible
                      ? "Sal del modo de edicion si quieres volver a poner hotspots."
                      : "Haz click en el visor para colocar un punto nuevo."
                    : "Primero agrega o selecciona una imagen 360."}
                </div>
              ) : (
                <>
                  <div className={styles.pointInfo}>
                    <span>Yaw: {coords.yaw.toFixed(4)}</span>
                    <span>Pitch: {coords.pitch.toFixed(4)}</span>
                  </div>

                  <div className={styles.panelBlock}>
                    <h4>Conectar con una imagen existente</h4>
                    {!existingDestinations.length ? (
                      <p className={styles.helperText}>Todavia no hay otra imagen del borrador para enlazar.</p>
                    ) : (
                      <div className={styles.destinationsList}>
                        {existingDestinations.map((img) => (
                          <button
                            key={img.id_imagen}
                            type="button"
                            className={styles.destinationItem}
                            onClick={(event) => connectToExisting(img, event)}
                          >
                            <img src={img.imagen} alt={img.nombre} className={styles.destinationThumb} />
                            <span>{img.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.panelBlock}>
                    <h4>O crear una nueva imagen desde este punto</h4>
                    <input
                      type="text"
                      value={newPointName}
                      onChange={(event) => setNewPointName(event.target.value)}
                      className={styles.inputName}
                      placeholder="Nombre de la nueva vista"
                    />
                    <label className={styles.inlineUpload}>
                      <input
                        type="file"
                        accept="image/*"
                        className={styles.hiddenInput}
                        onChange={(event) => setNewPointFile(event.target.files?.[0] || null)}
                      />
                      <Upload size={16} />
                      <span>{newPointFile ? newPointFile.name : "Elegir imagen 360"}</span>
                    </label>
                    <div className={styles.panelActions}>
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
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal360;
