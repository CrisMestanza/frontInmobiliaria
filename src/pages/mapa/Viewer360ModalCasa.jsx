import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EquirectangularAdapter, Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { Vector3 } from "three";
import gsap from "gsap";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MapPinned,
  Ruler,
  Navigation,
  Route,
  Sparkles,
  Tag,
} from "lucide-react";
import { withApiBase } from "../../config/api.js";
import styles from "./Viewer360.module.css";

const API_BASE = "https://api.geohabita.com";
const MARKER_SIZE = { width: 118, height: 78 };
const OVERLAY_VIEWBOX = { width: 1200, height: 780 };
const OVERLAY_HEADER_OFFSET = 42;

const HOTSPOT_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="118" height="78" viewBox="0 0 118 78">
  <defs>
    <radialGradient id="portalCore" cx="50%" cy="50%" r="52%">
      <stop offset="0%" stop-color="#ecfeff" stop-opacity="1"/>
      <stop offset="38%" stop-color="#67e8f9" stop-opacity=".94"/>
      <stop offset="72%" stop-color="#22c55e" stop-opacity=".86"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="portalRing" cx="50%" cy="50%" r="56%">
      <stop offset="58%" stop-color="#86efac" stop-opacity="0"/>
      <stop offset="78%" stop-color="#22d3ee" stop-opacity=".88"/>
      <stop offset="100%" stop-color="#ecfeff" stop-opacity=".18"/>
    </radialGradient>
    <linearGradient id="beam" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#ecfeff" stop-opacity=".82"/>
      <stop offset="45%" stop-color="#67e8f9" stop-opacity=".24"/>
      <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="#000" flood-opacity=".46"/>
    </filter>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <ellipse cx="59" cy="57" rx="47" ry="12" fill="rgba(8,47,73,.88)"/>
    <ellipse cx="59" cy="57" rx="38" ry="9" fill="rgba(34,211,238,.18)"/>
  </g>
  <g filter="url(#glow)">
    <ellipse cx="59" cy="43" rx="30" ry="18" fill="url(#portalCore)"/>
    <ellipse cx="59" cy="43" rx="36" ry="24" fill="url(#portalRing)"/>
    <ellipse cx="59" cy="43" rx="17" ry="10" fill="#ecfeff" opacity=".82"/>
  </g>
  <path d="M33 10l26 33 26-33" fill="none" stroke="url(#beam)" stroke-width="4" stroke-linecap="round" opacity=".9"/>
  <path d="M44 17l15 19 15-19" fill="none" stroke="#ecfeff" stroke-width="2.2" stroke-linecap="round" opacity=".92"/>
</svg>
`)}`;

const VIEWER_LOADING_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="20" x2="76" y1="20" y2="76">
      <stop offset="0%" stop-color="#dcfce7"/>
      <stop offset="100%" stop-color="#22c55e"/>
    </linearGradient>
    <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <circle cx="48" cy="48" r="34" fill="#04110b" stroke="rgba(255,255,255,0.18)" stroke-width="6"/>
    <path d="M48 14a34 34 0 0 1 34 34" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 48 48" to="360 48 48" dur="1s" repeatCount="indefinite"/>
    </path>
    <path d="M42 33l20 15-20 15V33z" fill="url(#g)"/>
  </g>
</svg>
`)}`;

const GALLERY_PRELOAD_RANGE = 1;
const VIEWER_RESOLUTION = 32;
const VIEWER_MOVE_SPEED = 1.75;
const shouldPrioritizeThumb = (idx, currentIndex) =>
  Math.abs(idx - currentIndex) <= GALLERY_PRELOAD_RANGE;

const getFetchPriority = (idx, currentIndex) =>
  idx === currentIndex
    ? "high"
    : shouldPrioritizeThumb(idx, currentIndex)
      ? "auto"
      : "low";

const getLoadingMode = (idx, currentIndex) =>
  shouldPrioritizeThumb(idx, currentIndex) ? "eager" : "lazy";

const formatMoney = (lote) => {
  const precio = lote?.precio;
  if (precio === null || precio === undefined || precio === "")
    return "Consultar";
  const numeric = Number(precio);
  const value = Number.isFinite(numeric)
    ? numeric.toLocaleString("es-PE")
    : precio;
  return `${lote?.moneda || ""} ${value}`.trim();
};

const hasDisplayValue = (value) =>
  value !== null && value !== undefined && value !== "";
const hasUsefulLoteInfo = (lote) =>
  !!lote &&
  [
    lote.nombre,
    lote.precio,
    lote.area_total_m2,
    lote.ancho,
    lote.largo,
    lote.moneda,
  ].some(hasDisplayValue);
const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("es-PE");
const getLoteId = (lote) =>
  lote?.idlote ?? lote?.id ?? lote?.id_lote ?? lote?.lote_id;
const getProjectId = (img) =>
  img?.idproyecto?.idproyecto ??
  img?.idproyecto_id ??
  img?.idproyecto ??
  img?.proyecto?.idproyecto;
const getLoteStatusMeta = (vendido) => {
  switch (Number(vendido)) {
    case 1:
      return {
        key: "sold",
        label: "Vendido",
        shortLabel: "VD",
        fill: "#ef4444",
        shadow: "#7f1d1d",
        glow: "rgba(239, 68, 68, 0.34)",
        stroke: "rgba(254, 242, 242, 0.96)",
      };
    case 2:
      return {
        key: "reserved",
        label: "Reservado",
        shortLabel: "RS",
        fill: "#f59e0b",
        shadow: "#92400e",
        glow: "rgba(245, 158, 11, 0.34)",
        stroke: "rgba(255, 251, 235, 0.96)",
      };
    default:
      return {
        key: "available",
        label: "Disponible",
        shortLabel: "DP",
        fill: "#22c55e",
        shadow: "#166534",
        glow: "rgba(34, 197, 94, 0.3)",
        stroke: "rgba(240, 253, 244, 0.96)",
      };
  }
};
const normalizeDegrees = (degrees) => ((degrees % 360) + 360) % 360;
const yawToDegrees = (yaw) => normalizeDegrees((Number(yaw) * 180) / Math.PI);
const getCompassLabel = (degrees) => {
  const value = normalizeDegrees(degrees);
  if (value < 22.5 || value >= 337.5) return "N";
  if (value < 67.5) return "NE";
  if (value < 112.5) return "E";
  if (value < 157.5) return "SE";
  if (value < 202.5) return "S";
  if (value < 247.5) return "SO";
  if (value < 292.5) return "O";
  return "NO";
};
const getLoteSvgStyle = ({ status, isSelected, overlayOpacity, loteColor }) => {
  const baseFill = loteColor || status.fill;
  if (isSelected) {
    return {
      fill: "#22d3ee",
      fillOpacity: "0.88",
      stroke: "#ecfeff",
      strokeWidth: "5px",
      strokeLinejoin: "round",
      strokeOpacity: "1",
    };
  }

  if (status.key === "sold") {
    return {
      fill: baseFill,
      fillOpacity: "0.76",
      stroke: status.stroke,
      strokeWidth: "3.6px",
      strokeLinejoin: "round",
      strokeOpacity: "0.94",
      strokeDasharray: "8 5",
    };
  }

  if (status.key === "reserved") {
    return {
      fill: baseFill,
      fillOpacity: "0.78",
      stroke: status.stroke,
      strokeWidth: "4px",
      strokeLinejoin: "round",
      strokeOpacity: "0.98",
      strokeDasharray: "14 6",
    };
  }

  return {
    fill: baseFill,
    fillOpacity: String(Math.min(Number(overlayOpacity ?? 0.82), 0.74)),
    stroke: status.stroke,
    strokeWidth: "3.4px",
    strokeLinejoin: "round",
    strokeOpacity: "0.95",
  };
};

const waitForNextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

const warmUpImage = (src, timeout = 2500) =>
  new Promise((resolve) => {
    if (!src) {
      resolve();
      return;
    }

    const image = new Image();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    const timer = window.setTimeout(finish, timeout);

    image.decoding = "async";
    image.fetchPriority = "high";
    image.onload = () => {
      window.clearTimeout(timer);
      if (image.decode) {
        image.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      finish();
    };
    image.src = src;
  });

const buildApiUrl = (path) => withApiBase(`${API_BASE}${path}`);
const getImageId = (img) => img?.id_imagen ?? img?.id;
const normalizeUrl = (url) => {
  if (!url) return "";
  return url.startsWith("http") ? url : withApiBase(`${API_BASE}${url}`);
};

const normalizeImage = (img) => ({
  ...img,
  id_imagen: getImageId(img),
  imagen: normalizeUrl(img.imagen),
});

const tryParseJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isValidPolygonPixels = (polygon) =>
  Array.isArray(polygon) &&
  polygon.length >= 3 &&
  polygon.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1])),
  );

const isValidTexturePoint = (point) =>
  Array.isArray(point) &&
  point.length === 2 &&
  Number.isFinite(Number(point[0])) &&
  Number.isFinite(Number(point[1]));

const isValidSphericalPoint = isValidTexturePoint;

const projectViewerPointWithCamera = (viewer, viewerPoint, width, height) => {
  const camera = viewer?.renderer?.camera;
  if (!camera || !width || !height) return null;

  const ndcX = (Number(viewerPoint.x) / width) * 2 - 1;
  const ndcY = 1 - (Number(viewerPoint.y) / height) * 2;
  const direction = new Vector3(ndcX, ndcY, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();

  return viewer.dataHelper.vector3ToSphericalCoords(direction);
};

const transformOverlayPoint = (point, config) => {
  const angle = ((config?.rotation || 0) * Math.PI) / 180;
  const scale = config?.scale || 1;
  const tx = config?.x || 0;
  const ty = config?.y || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = point.x * cos - point.y * sin;
  const ry = point.x * sin + point.y * cos;

  return {
    x: tx + rx * scale,
    y: ty + ry * scale,
  };
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

const buildAnchoredOverlayFromLayout = (
  viewer,
  geometry,
  layout,
  imageId,
  containerWidth,
) => {
  if (!viewer || !geometry || !layout || !imageId || !containerWidth)
    return null;

  const currentViewerWidth = viewer?.state?.size?.width || containerWidth;
  const currentViewerHeight = viewer?.state?.size?.height || 0;
  const savedViewerWidth = Number(layout.viewerWidth) || currentViewerWidth;
  const savedViewerHeight =
    Number(layout.viewerHeight) || currentViewerHeight || savedViewerWidth;
  const scaleX = savedViewerWidth ? currentViewerWidth / savedViewerWidth : 1;
  const scaleY = savedViewerHeight
    ? currentViewerHeight / savedViewerHeight
    : scaleX;

  const fallbackCardWidth = Math.min(
    savedViewerWidth - 36,
    Math.min(savedViewerWidth * 0.62, 760),
  );
  const svgWidth = Number(layout.overlayWidth) || fallbackCardWidth;
  const svgHeight =
    Number(layout.overlayHeight) ||
    (svgWidth / OVERLAY_VIEWBOX.width) * OVERLAY_VIEWBOX.height;
  const overlayOffsetX = Number(layout.overlayOffsetX) || 0;
  const overlayOffsetY = Number(layout.overlayOffsetY) || OVERLAY_HEADER_OFFSET;

  if (
    !Number.isFinite(svgWidth) ||
    !Number.isFinite(svgHeight) ||
    svgWidth <= 0 ||
    svgHeight <= 0
  ) {
    return null;
  }

  const convertPoint = (point) => {
    const localPoint = {
      x: overlayOffsetX + (point.x / OVERLAY_VIEWBOX.width) * svgWidth,
      y: overlayOffsetY + (point.y / OVERLAY_VIEWBOX.height) * svgHeight,
    };
    const savedViewerPoint = transformOverlayPoint(localPoint, layout);
    const viewerPoint = {
      x: savedViewerPoint.x * scaleX,
      y: savedViewerPoint.y * scaleY,
    };
    return projectViewerPointToAnchoredPoint(viewer, viewerPoint, {
      allowOutOfViewport: true,
    });
  };

  const projectAnchoredPoints = (geometry.projectPoints || [])
    .map(convertPoint)
    .filter((point) => point?.spherical);
  const projectPolygon = projectAnchoredPoints
    .map((point) => point.spherical)
    .filter(isValidSphericalPoint);
  const projectPolygonPixels = projectAnchoredPoints
    .map((point) => point.pixels)
    .filter(isValidTexturePoint);

  const lotPolygons = (geometry.lotes || [])
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
    .filter(
      (lote) => lote.polygon.length >= 3 || lote.polygonPixels.length >= 3,
    );

  if (
    projectPolygon.length < 3 &&
    projectPolygonPixels.length < 3 &&
    !lotPolygons.length
  )
    return null;

  return {
    imageId: String(imageId),
    visible: layout.visible !== false,
    lotOpacity: layout.lotOpacity ?? 0.82,
    showProjectOutline: layout.showProjectOutline !== false,
    projectPolygon: projectPolygon.length >= 3 ? projectPolygon : [],
    projectPolygonPixels:
      projectPolygonPixels.length >= 3 ? projectPolygonPixels : [],
    lotPolygons,
  };
};

const buildAnchoredOverlayFromScreenOverlay = (
  viewer,
  layout,
  imageId,
  containerWidth,
  containerHeight,
) => {
  const overlay = layout?.screenOverlay;
  if (
    !viewer ||
    !overlay?.visible ||
    !imageId ||
    !containerWidth ||
    !containerHeight
  )
    return null;

  const savedWidth = Number(overlay.viewerWidth) || containerWidth;
  const savedHeight =
    Number(overlay.viewerHeight) || containerHeight || savedWidth;
  const scaleX = savedWidth ? containerWidth / savedWidth : 1;
  const scaleY = savedHeight ? containerHeight / savedHeight : scaleX;

  const convertPolygon = (polygon) =>
    (polygon || [])
      .map((point) =>
        Array.isArray(point) && point.length === 2
          ? projectViewerPointToAnchoredPoint(
              viewer,
              {
                x: Number(point[0]) * scaleX,
                y: Number(point[1]) * scaleY,
              },
              { allowOutOfViewport: true },
            )
          : null,
      )
      .filter((point) => point?.spherical);

  const projectAnchoredPoints = convertPolygon(overlay.projectPolygonPoints);
  const projectPolygon = projectAnchoredPoints
    .map((point) => point.spherical)
    .filter(isValidSphericalPoint);
  const projectPolygonPixels = projectAnchoredPoints
    .map((point) => point.pixels)
    .filter(isValidTexturePoint);
  const lotPolygons = (overlay.lotPolygons || [])
    .map((lote) => {
      const anchoredPoints = convertPolygon(lote.polygonPoints);

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
    .filter(
      (lote) => lote.polygon.length >= 3 || lote.polygonPixels.length >= 3,
    );

  if (
    projectPolygon.length < 3 &&
    projectPolygonPixels.length < 3 &&
    !lotPolygons.length
  )
    return null;

  return {
    imageId: String(imageId),
    visible: true,
    lotOpacity: overlay.lotOpacity ?? layout?.lotOpacity ?? 0.82,
    showProjectOutline: overlay.showProjectOutline !== false,
    projectPolygon: projectPolygon.length >= 3 ? projectPolygon : [],
    projectPolygonPixels:
      projectPolygonPixels.length >= 3 ? projectPolygonPixels : [],
    lotPolygons,
  };
};

const normalizeOverlayBundle = (rawOverlay) => {
  const candidate = tryParseJson(rawOverlay);
  if (!candidate || typeof candidate !== "object") return null;

  const anchoredRaw = Array.isArray(candidate.anchoredOverlays)
    ? candidate.anchoredOverlays
    : Array.isArray(candidate.panoramaOverlays)
      ? candidate.panoramaOverlays
      : [];
  const layoutsRaw = Array.isArray(candidate.layouts) ? candidate.layouts : [];

  const anchored = anchoredRaw.reduce((acc, item) => {
    const imageId = String(
      item?.imageId ?? item?.imagenId ?? item?.id_imagen ?? "",
    );
    if (!imageId) return acc;
    acc[imageId] = item;
    return acc;
  }, {});

  const layouts = layoutsRaw.reduce((acc, item) => {
    const imageId = String(
      item?.imageId ?? item?.imagenId ?? item?.id_imagen ?? "",
    );
    if (!imageId) return acc;
    acc[imageId] = item;
    return acc;
  }, {});

  return {
    geometry: candidate.geometry || null,
    layouts,
    layoutsList: layoutsRaw,
    anchored,
    anchoredList: anchoredRaw,
  };
};

const collectOverlayBundles = (images = []) =>
  images
    .map((img) => ({
      imageId: String(getImageId(img) ?? ""),
      bundle: normalizeOverlayBundle(
        img?.overlays_2d ??
          img?.overlay_2d ??
          img?.overlay2d ??
          img?.tour_overlay ??
          img?.tour_data,
      ),
    }))
    .filter((item) => item.bundle);
const computePolygonCentroid = (polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length === 0) return { x: 0, y: 0 };
  const total = polygon.reduce(
    (acc, point) => {
      acc.x += Number(point?.[0] || 0);
      acc.y += Number(point?.[1] || 0);
      return acc;
    },
    { x: 0, y: 0 },
  );
  return {
    x: total.x / polygon.length,
    y: total.y / polygon.length,
  };
};

const Viewer360Modal = ({ images360 = [], onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hotspots, setHotspots] = useState([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerLoadMessage, setViewerLoadMessage] = useState(
    "Preparando recorrido 360...",
  );
  const [travelingTo, setTravelingTo] = useState("");
  const [computedOverlay, setComputedOverlay] = useState(null);
  const [selectedLoteInfo, setSelectedLoteInfo] = useState(null);
  const [loteInfoLoading, setLoteInfoLoading] = useState(false);
  const [loteInfoError, setLoteInfoError] = useState("");
  const [viewerDirection, setViewerDirection] = useState({
    yaw: 0,
    pitch: 0,
    zoom: 35,
  });
  const overlayRef = useRef(null);
  const hudRef = useRef(null);
  const experiencePanelRef = useRef(null);
  const loteDrawerRef = useRef(null);
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const travelTimerRef = useRef(null);
  const loteInfoCacheRef = useRef(new Map());
  const loteInfoAbortRef = useRef(null);
  const projectLotesCacheRef = useRef(new Map());

  const normalizedImages = useMemo(
    () => (Array.isArray(images360) ? images360.map(normalizeImage) : []),
    [images360],
  );
  const overlayBundles = useMemo(
    () => collectOverlayBundles(normalizedImages),
    [normalizedImages],
  );
  const currentImage = normalizedImages[currentIndex];
  const currentImageId = getImageId(currentImage);
  const projectName =
    currentImage?.idproyecto?.nombreproyecto ||
    currentImage?.proyecto?.nombreproyecto ||
    currentImage?.nombre_proyecto ||
    currentImage?.nombreproyecto ||
    currentImage?.nombre ||
    "Proyecto no identificado";
  const currentAnchoredOverlay = useMemo(() => {
    const imageKey = String(currentImageId ?? "");
    if (!imageKey) return null;

    for (const entry of overlayBundles) {
      const directMatch = entry.bundle?.anchored?.[imageKey];
      if (directMatch) return directMatch;
    }

    const sameRowBundle = overlayBundles.find(
      (entry) => entry.imageId === imageKey,
    )?.bundle;
    if (sameRowBundle?.anchoredList?.[0]) {
      return sameRowBundle.anchoredList[0];
    }

    for (const entry of overlayBundles) {
      if (entry.bundle?.anchoredList?.[0]) {
        return entry.bundle.anchoredList[0];
      }
    }

    return null;
  }, [currentImageId, overlayBundles]);
  const currentOverlayBundle = useMemo(() => {
    const imageKey = String(currentImageId ?? "");
    if (!imageKey) return null;

    return (
      overlayBundles.find((entry) => entry.imageId === imageKey)?.bundle ||
      overlayBundles.find((entry) => entry.bundle?.layouts?.[imageKey])
        ?.bundle ||
      overlayBundles.find((entry) => entry.bundle?.geometry)?.bundle ||
      null
    );
  }, [currentImageId, overlayBundles]);
  const overlayToRender = currentAnchoredOverlay?.visible
    ? currentAnchoredOverlay
    : computedOverlay;
  const lotesForHud = overlayToRender?.lotPolygons || [];
  const lotesSummary = useMemo(
    () =>
      lotesForHud.reduce(
        (acc, lote) => {
          const status = getLoteStatusMeta(lote?.vendido);
          acc.total += 1;
          acc[status.key] += 1;
          return acc;
        },
        { total: 0, available: 0, reserved: 0, sold: 0 },
      ),
    [lotesForHud],
  );
  const selectedLote = selectedLoteInfo?.lote;
  const selectedLoteId = String(getLoteId(selectedLote) ?? "");
  const currentDirectionDeg = yawToDegrees(viewerDirection.yaw);
  const currentDirectionLabel = getCompassLabel(currentDirectionDeg);
  const minimapData = useMemo(() => {
    const polygons = lotesForHud
      .map((lote) => {
        const polygon = lote?.polygonPixels || [];
        if (!Array.isArray(polygon) || polygon.length < 3) return null;
        return {
          ...lote,
          polygon,
          status: getLoteStatusMeta(lote?.vendido),
        };
      })
      .filter(Boolean);

    if (!polygons.length) return null;

    const projectPolygon =
      Array.isArray(overlayToRender?.projectPolygonPixels) &&
      overlayToRender.projectPolygonPixels.length >= 3
        ? overlayToRender.projectPolygonPixels
        : [];
    const allPoints = [
      ...polygons.flatMap((lote) => lote.polygon),
      ...projectPolygon,
    ];
    if (!allPoints.length) return null;

    const xs = allPoints.map((point) => Number(point[0]));
    const ys = allPoints.map((point) => Number(point[1]));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const pad = 18;
    const size = 220;
    const scale = Math.min((size - pad * 2) / width, (size - pad * 2) / height);
    const offsetX = (size - width * scale) / 2;
    const offsetY = (size - height * scale) / 2;
    const normalizePoint = (point) => [
      offsetX + (Number(point[0]) - minX) * scale,
      offsetY + (Number(point[1]) - minY) * scale,
    ];

    return {
      size,
      projectPath: projectPolygon.length
        ? projectPolygon
            .map(normalizePoint)
            .map((point) => point.join(","))
            .join(" ")
        : "",
      polygons: polygons.map((lote) => {
        const normalizedPolygon = lote.polygon.map(normalizePoint);
        return {
          ...lote,
          path: normalizedPolygon.map((point) => point.join(",")).join(" "),
          shadowPath: normalizedPolygon
            .map(([x, y]) => `${x + 3.5},${y + 5.5}`)
            .join(" "),
          centroid: computePolygonCentroid(normalizedPolygon),
          isSelected: String(getLoteId(lote) ?? "") === selectedLoteId,
        };
      }),
    };
  }, [lotesForHud, overlayToRender, selectedLoteId]);
  const travelToImageById = useCallback(
    (id, label) => {
      const index = normalizedImages.findIndex(
        (img) => String(getImageId(img)) === String(id),
      );
      if (index < 0) return;

      window.clearTimeout(travelTimerRef.current);
      setTravelingTo(label || normalizedImages[index]?.nombre || "otra vista");
      travelTimerRef.current = window.setTimeout(() => {
        setCurrentIndex(index);
        window.setTimeout(() => setTravelingTo(""), 180);
      }, 720);
    },
    [normalizedImages],
  );

  const loadLoteInfo = useCallback(async (idlote, fallbackLote = null) => {
    const loteId = String(idlote ?? "");
    if (!loteId) return;

    loteInfoAbortRef.current?.abort();
    setLoteInfoError("");

    const cached = loteInfoCacheRef.current.get(loteId);
    if (cached) {
      setSelectedLoteInfo(cached);
      setLoteInfoLoading(false);
      return;
    }

    const controller = new AbortController();
    loteInfoAbortRef.current = controller;
    setLoteInfoLoading(true);
    setSelectedLoteInfo({
      lote: fallbackLote || { idlote: loteId, nombre: `Lote ${loteId}` },
      proyecto: null,
      inmobiliaria: null,
    });

    try {
      const res = await fetch(
        buildApiUrl(`/api/mapa/lote_detalle/${loteId}/`),
        {
          signal: controller.signal,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cargar el lote.");
      }

      const normalized = {
        lote: data?.lote || { idlote: loteId, nombre: `Lote ${loteId}` },
        proyecto: data?.proyecto || null,
        inmobiliaria: data?.inmobiliaria || null,
      };
      loteInfoCacheRef.current.set(loteId, normalized);
      setSelectedLoteInfo(normalized);
    } catch (error) {
      if (error.name === "AbortError") return;
      if (hasUsefulLoteInfo(fallbackLote)) {
        const fallbackInfo = {
          lote: { ...fallbackLote, idlote: getLoteId(fallbackLote) ?? loteId },
          proyecto: null,
          inmobiliaria: null,
        };
        loteInfoCacheRef.current.set(loteId, fallbackInfo);
        setSelectedLoteInfo(fallbackInfo);
        setLoteInfoError("");
        return;
      }
      setLoteInfoError(
        error instanceof TypeError
          ? "No se pudo cargar el detalle completo del lote."
          : error.message || "No se pudo cargar el lote.",
      );
    } finally {
      if (!controller.signal.aborted) setLoteInfoLoading(false);
    }
  }, []);

  const loadProjectLotes = useCallback(async (projectId) => {
    const key = String(projectId ?? "");
    if (!key) return [];

    const cached = projectLotesCacheRef.current.get(key);
    if (cached) return cached;

    const urls = [
      `/api/getLoteProyecto/${key}`,
      `/api/listPuntosLoteProyecto/${key}/`,
    ];

    for (const url of urls) {
      const res = await fetch(buildApiUrl(url));
      if (!res.ok) continue;
      const data = await res.json().catch(() => []);
      const lotes = Array.isArray(data) ? data : [];
      if (lotes.length) {
        projectLotesCacheRef.current.set(key, lotes);
        return lotes;
      }
    }

    projectLotesCacheRef.current.set(key, []);
    return [];
  }, []);

  const openLoteFromMarker = useCallback(
    async (markerData) => {
      const inlineLote = markerData?.lote || null;
      const inlineId = getLoteId(inlineLote) ?? markerData?.idlote;

      if (inlineId) {
        setSelectedLoteInfo({
          lote: inlineLote || { idlote: inlineId, nombre: `Lote ${inlineId}` },
          proyecto: null,
          inmobiliaria: null,
        });
        setLoteInfoLoading(true);
        setLoteInfoError("");

        let fallbackLote = inlineLote;
        try {
          const projectId = getProjectId(currentImage);
          const lotes = await loadProjectLotes(projectId);
          const match = lotes.find((lote) => {
            const loteId = getLoteId(lote);
            return (
              String(loteId ?? "") === String(inlineId) ||
              (!!inlineLote?.nombre &&
                normalizeText(lote.nombre) === normalizeText(inlineLote.nombre))
            );
          });
          if (match) {
            fallbackLote = {
              ...inlineLote,
              ...match,
              idlote: getLoteId(match) ?? inlineId,
            };
          }
        } catch {
          fallbackLote = inlineLote;
        }

        loadLoteInfo(inlineId, fallbackLote);
        return;
      }

      if (inlineLote?.nombre) {
        setSelectedLoteInfo({
          lote: inlineLote,
          proyecto: null,
          inmobiliaria: null,
        });
        setLoteInfoLoading(true);
        setLoteInfoError("");

        try {
          const projectId = getProjectId(currentImage);
          const lotes = await loadProjectLotes(projectId);
          const match = lotes.find(
            (lote) =>
              normalizeText(lote.nombre) === normalizeText(inlineLote.nombre),
          );
          const matchId = getLoteId(match);
          if (matchId) {
            loadLoteInfo(matchId, { ...inlineLote, ...match, idlote: matchId });
            return;
          }
          setLoteInfoLoading(false);
        } catch {
          setLoteInfoLoading(false);
        }
      }
    },
    [currentImage, loadLoteInfo, loadProjectLotes],
  );

  const nextImage = useCallback(() => {
    if (!normalizedImages.length) return;
    setCurrentIndex((prev) => (prev + 1) % normalizedImages.length);
  }, [normalizedImages.length]);

  const prevImage = useCallback(() => {
    if (!normalizedImages.length) return;
    setCurrentIndex(
      (prev) => (prev - 1 + normalizedImages.length) % normalizedImages.length,
    );
  }, [normalizedImages.length]);

  useEffect(() => {
    if (normalizedImages.length < 2) return undefined;

    const adjacentIndexes = [
      (currentIndex + 1) % normalizedImages.length,
      (currentIndex - 1 + normalizedImages.length) % normalizedImages.length,
    ];
    const preloaders = adjacentIndexes
      .map((idx) => normalizedImages[idx]?.imagen)
      .filter(Boolean)
      .map((src) => {
        const image = new Image();
        image.decoding = "async";
        image.src = src;
        return image;
      });

    return () => {
      preloaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [currentIndex, normalizedImages]);

  useEffect(() => () => window.clearTimeout(travelTimerRef.current), []);

  useEffect(() => {
    setSelectedLoteInfo(null);
    setLoteInfoError("");
  }, [currentImageId]);

  useEffect(
    () => () => {
      loteInfoAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!currentImageId) {
      setHotspots([]);
      return undefined;
    }

    let active = true;
    setHotspotsLoading(true);

    fetch(buildApiUrl(`/api/get_hotspots_por_imagen/${currentImageId}/`))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        const normalized = Array.isArray(data)
          ? data.map((item) => ({
              ...item,
              destino: item.destino
                ? {
                    ...item.destino,
                    imagen: normalizeUrl(item.destino.imagen),
                  }
                : null,
            }))
          : [];
        setHotspots(normalized);
      })
      .catch((error) => {
        if (!active) return;
        console.warn("No se pudieron cargar hotspots 360:", error);
        setHotspots([]);
      })
      .finally(() => {
        if (active) setHotspotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentImageId]);

  useEffect(() => {
    if (!containerRef.current || !currentImage) return undefined;

    let active = true;
    let viewerInstance = null;
    let slowTimer = null;
    setViewerReady(false);
    setViewerLoadMessage("Cargando imagen 360...");
    slowTimer = window.setTimeout(() => {
      if (active)
        setViewerLoadMessage(
          "La primera vista es pesada, ya casi está lista...",
        );
    }, 3200);

    const createViewer = async () => {
      await waitForNextFrame();
      await warmUpImage(currentImage.imagen);
      if (!active || !containerRef.current) return;

      const imageKey = String(currentImageId ?? "");
      const initialLayout = currentOverlayBundle?.layouts?.[imageKey];
      const initialYaw = Number(initialLayout?.yaw);
      const initialPitch = Number(initialLayout?.pitch);
      const initialZoom = Number(initialLayout?.zoomLevel);
      const viewerOptions = {
        container: containerRef.current,
        panorama: currentImage.imagen,
        caption: currentImage.nombre,
        adapter: [EquirectangularAdapter, { resolution: VIEWER_RESOLUTION }],
        defaultZoomLvl: Number.isFinite(initialZoom) ? initialZoom : 35,
        moveSpeed: VIEWER_MOVE_SPEED,
        fisheye: false,
        loadingImg: VIEWER_LOADING_ICON,
        loadingTxt: "Cargando vista 360...",
        navbar: ["zoom", "move", "caption", "fullscreen"],
        plugins: [[MarkersPlugin, {}]],
      };

      if (Number.isFinite(initialYaw)) {
        viewerOptions.defaultYaw = initialYaw;
      }

      if (Number.isFinite(initialPitch)) {
        viewerOptions.defaultPitch = initialPitch;
      }

      viewerInstance = new Viewer(viewerOptions);

      viewerRef.current = viewerInstance;
      const markers = viewerInstance.getPlugin(MarkersPlugin);
      const updateViewerDirection = () => {
        const position = viewerInstance.getPosition?.();
        const zoomLevel = viewerInstance.getZoomLevel?.();
        setViewerDirection({
          yaw: Number(position?.yaw) || 0,
          pitch: Number(position?.pitch) || 0,
          zoom: Number(zoomLevel) || 35,
        });
      };

      markers.addEventListener("select-marker", (event) => {
        const marker = event?.marker || event?.detail?.marker;
        const markerData = marker?.data || marker?.config?.data || {};
        if (markerData.type === "lote") {
          openLoteFromMarker(markerData);
          return;
        }

        const destinoId = markerData.destinoId;
        if (destinoId) travelToImageById(destinoId, markerData.destinoNombre);
      });

      viewerInstance.addEventListener("ready", () => {
        window.clearTimeout(slowTimer);
        updateViewerDirection();
        setViewerReady(true);
      });
      viewerInstance.addEventListener(
        "position-updated",
        updateViewerDirection,
      );
      viewerInstance.addEventListener("zoom-updated", updateViewerDirection);
    };

    createViewer();

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
      viewerInstance?.destroy();
      viewerRef.current = null;
    };
  }, [
    currentImage,
    currentImageId,
    currentOverlayBundle,
    openLoteFromMarker,
    travelToImageById,
  ]);

  useEffect(() => {
    if (!viewerReady || !viewerRef.current || currentAnchoredOverlay?.visible) {
      setComputedOverlay(null);
      return;
    }

    const imageKey = String(currentImageId ?? "");
    const geometry = currentOverlayBundle?.geometry;
    const layout = currentOverlayBundle?.layouts?.[imageKey];
    const containerWidth = containerRef.current?.clientWidth || 0;
    const containerHeight = containerRef.current?.clientHeight || 0;

    const fallbackOverlay = buildAnchoredOverlayFromLayout(
      viewerRef.current,
      geometry,
      layout,
      imageKey,
      containerWidth,
    );
    const screenOverlayAsAnchored = buildAnchoredOverlayFromScreenOverlay(
      viewerRef.current,
      layout,
      imageKey,
      containerWidth,
      containerHeight,
    );

    setComputedOverlay(fallbackOverlay || screenOverlayAsAnchored);
  }, [
    viewerReady,
    currentAnchoredOverlay,
    currentOverlayBundle,
    currentImageId,
  ]);

  useEffect(() => {
    if (!viewerReady || !viewerRef.current) return;

    const markers = viewerRef.current.getPlugin(MarkersPlugin);
    markers.clearMarkers();

    if (overlayToRender?.visible) {
      const hasProjectSpherical = isValidPolygonPixels(
        overlayToRender.projectPolygon,
      );
      const hasProjectPixels = isValidPolygonPixels(
        overlayToRender.projectPolygonPixels,
      );
      if (
        overlayToRender.showProjectOutline !== false &&
        (hasProjectSpherical || hasProjectPixels)
      ) {
        markers.addMarker({
          id: `overlay-project-${currentImageId}`,
          ...(hasProjectSpherical
            ? { polygon: overlayToRender.projectPolygon }
            : { polygonPixels: overlayToRender.projectPolygonPixels }),
          svgStyle: {
            fill: "rgba(14, 116, 44, 0.26)",
            stroke: "#14532d",
            strokeWidth: "12px",
            strokeLinejoin: "round",
          },
          zIndex: 5,
        });
      }

      (overlayToRender.lotPolygons || []).forEach((lote, index) => {
        const hasSpherical = isValidPolygonPixels(lote.polygon);
        const hasPixels = isValidPolygonPixels(lote.polygonPixels);
        if (!hasSpherical && !hasPixels) return;
        const loteId = getLoteId(lote);
        const markerKey = loteId ?? lote.nombre ?? index;
        const isSelected = String(loteId ?? "") === selectedLoteId;
        const status = getLoteStatusMeta(lote.vendido);
        markers.addMarker({
          id: `overlay-lote-${currentImageId}-${markerKey}-${index}`,
          ...(hasSpherical
            ? { polygon: lote.polygon }
            : { polygonPixels: lote.polygonPixels }),
          tooltip: `${lote.nombre || `Lote ${lote.idlote}`} · ${status.label}`,
          className: `gh-portal-lot-marker gh-lot-${status.key} ${isSelected ? "gh-lot-selected" : ""}`,
          data: {
            type: "lote",
            idlote: loteId,
            lote: {
              ...lote,
              idlote: loteId,
            },
          },
          svgStyle: getLoteSvgStyle({
            status,
            isSelected,
            overlayOpacity: overlayToRender.lotOpacity,
            loteColor: lote.color,
          }),
          zIndex: isSelected ? 9 : 6,
        });
      });
    }

    hotspots.forEach((hotspot) => {
      if (
        !Number.isFinite(Number(hotspot.yaw)) ||
        !Number.isFinite(Number(hotspot.pitch))
      )
        return;

      markers.addMarker({
        id: `hotspot-${hotspot.id}`,
        image: HOTSPOT_ICON,
        size: MARKER_SIZE,
        anchor: "center center",
        position: {
          yaw: Number(hotspot.yaw),
          pitch: Number(hotspot.pitch),
        },
        tooltip: hotspot.destino?.nombre || "Ir a vista",
        data: {
          destinoId: hotspot.destino?.id_imagen,
          destinoNombre: hotspot.destino?.nombre,
        },
        className: "gh-portal-hotspot-marker",
      });
    });
  }, [viewerReady, hotspots, overlayToRender, currentImageId, selectedLoteId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key === "ArrowRight") nextImage();
      if (event.key === "ArrowLeft") prevImage();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextImage, onClose, prevImage]);

  useEffect(() => {
    if (!overlayRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".viewer-hud-enter",
        { autoAlpha: 0, y: 20, scale: 0.96 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.72,
          stagger: 0.08,
          ease: "power3.out",
          overwrite: "auto",
        },
      );
      gsap.fromTo(
        ".viewer-panel-enter",
        { autoAlpha: 0, x: 22, scale: 0.98 },
        {
          autoAlpha: 1,
          x: 0,
          scale: 1,
          duration: 0.82,
          stagger: 0.1,
          ease: "expo.out",
          overwrite: "auto",
        },
      );
    }, overlayRef);
    return () => ctx.revert();
  }, [currentImageId]);

  useEffect(() => {
    if (!loteDrawerRef.current || !selectedLoteId) return;
    gsap.fromTo(
      loteDrawerRef.current,
      { autoAlpha: 0, x: 34, scale: 0.985 },
      {
        autoAlpha: 1,
        x: 0,
        scale: 1,
        duration: 0.58,
        ease: "expo.out",
        overwrite: "auto",
      },
    );
  }, [selectedLoteId]);

  if (!normalizedImages.length) return null;
  const selectedLoteStatus = selectedLote
    ? getLoteStatusMeta(selectedLote.vendido)
    : null;

  return (
    <div className={styles.overlay360} ref={overlayRef}>
      <div className={styles.mainContent}>
        <div className={styles.header360}>
          <div className={styles.titleGroup}>
            {/* <span className={styles.badge360}>
              <Sparkles size={14} /> Tour 360 virtual
            </span> */}
            <h3 className={styles.imageTitle}>{projectName}</h3>
            {/* <p className={styles.imageSubtitle}>
              Explora la vista y el recorrido.
            </p> */}
            {currentImage?.idproyecto?.nombreproyecto && (
              <p className={styles.projectName}>
                {currentImage.idproyecto.nombreproyecto}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
            <span>Cerrar</span>
          </button>
        </div>

        <div className={styles.viewerWrapper}>
          {!viewerReady && (
            <div className={styles.loading360}>{viewerLoadMessage}</div>
          )}
          <div className={styles.viewerContainer} ref={containerRef} />
          <div className={styles.viewerHud} ref={hudRef}>
            {/* <div className={`${styles.hudCluster} viewer-hud-enter`}>
              <div className={styles.hudPill}>
                <Sparkles size={15} />
                <span>{currentIndex + 1}/{normalizedImages.length} escenas</span>
              </div>
              <div className={styles.hudPill}>
                <Route size={15} />
                <span>{hotspots.length} conexiones</span>
              </div>
              <div className={styles.hudPill}>
                <Tag size={15} />
                <span>{lotesSummary.total} lotes visibles</span>
              </div>
            </div> */}

            {/* <div className={styles.brandLogo}>
              <img src="/habitasinfondo.png" alt="GeoHabita" />
              <span>GeoHabita</span>
            </div> */}
            {/* <img
              src="/habitasinfondo.png"
              alt="GeoHabita Logo"
              className={styles.logo}
            /> */}
            {/* <span className={styles.brandName}>
              <span className={styles.geo}>Geo</span>
              <span className={styles.habita}>Habita</span>
            </span> */}
            <div className={`${styles.orientationCard} viewer-hud-enter`}>
              <div className={styles.orientationDial}>
                <div
                  className={styles.orientationNeedle}
                  style={{
                    transform: `translate(-50%, -100%) rotate(${currentDirectionDeg}deg)`,
                  }}
                />
                <span className={styles.orientationCenter}>
                  {currentDirectionLabel}
                </span>
              </div>
              <div className={styles.orientationMeta}>
                <strong>{Math.round(currentDirectionDeg)}°</strong>
                {/* <span>Direccion actual</span> */}
              </div>
            </div>
          </div>

          {/* GeoHabita branding and stats above viewer */}
          <div className={`${styles.geoHabitaBranding} viewer-hud-enter`}>
            <div className={styles.brandStats}>
              <div className={styles.brandStat}>
                <span className={styles.statValue}>{lotesSummary.total}</span>
                <span className={styles.statLabel}>Experiencia virtual</span>
              </div>
              <div className={styles.brandStat}>
                <span className={styles.statValue} style={{ color: "#22c55e" }}>
                  {lotesSummary.available}
                </span>
                <span className={styles.statLabel}>Disponibles</span>
              </div>
              <div className={styles.brandStat}>
                <span className={styles.statValue} style={{ color: "#f59e0b" }}>
                  {lotesSummary.reserved}
                </span>
                <span className={styles.statLabel}>Reservados</span>
              </div>
              <div className={styles.brandStat}>
                <span className={styles.statValue} style={{ color: "#ef4444" }}>
                  {lotesSummary.sold}
                </span>
                <span className={styles.statLabel}>Vendidos</span>
              </div>
            </div>
          </div>

          {travelingTo && (
            <div className={styles.travelOverlay}>
              <div className={styles.travelTunnel} />
              <div className={styles.travelTarget}>
                <Navigation size={18} />
                Entrando a {travelingTo}
              </div>
            </div>
          )}

          {hotspots.length > 0 && (
            <div className={styles.hotspotHint}>
              <Navigation size={16} />
              {hotspots.length} punto{hotspots.length === 1 ? "" : "s"}{" "}
              disponible{hotspots.length === 1 ? "" : "s"}
            </div>
          )}

          {normalizedImages.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.navBtn} ${styles.prev}`}
                onClick={prevImage}
              >
                <ChevronLeft size={30} />
              </button>
              <button
                type="button"
                className={`${styles.navBtn} ${styles.next}`}
                onClick={nextImage}
              >
                <ChevronRight size={30} />
              </button>
            </>
          )}
        </div>

        {selectedLoteInfo && (
          <aside
            className={`${styles.loteDrawer} viewer-panel-enter`}
            ref={loteDrawerRef}
          >
            <div className={styles.loteDrawerHeader}>
              <div>
                <h4>
                  {selectedLote?.nombre || `Lote ${selectedLote?.idlote || ""}`}
                </h4>
                <p>
                  {selectedLoteInfo?.proyecto?.nombreproyecto ||
                    currentImage?.nombre ||
                    "Seleccionado desde panorama 360"}
                </p>
              </div>
              <button
                type="button"
                className={styles.loteDrawerClose}
                onClick={() => {
                  setSelectedLoteInfo(null);
                  setLoteInfoError("");
                }}
                aria-label="Cerrar lote"
              >
                <X size={16} />
              </button>
            </div>

            {loteInfoLoading ? (
              <div className={styles.loteInfoState}>Cargando lote...</div>
            ) : loteInfoError ? (
              <div className={styles.loteInfoState}>{loteInfoError}</div>
            ) : (
              <>
                <div className={styles.loteDrawerHero}>
                  <div className={styles.loteDrawerStatusWrap}>
                    <span
                      className={styles.loteStatusChip}
                      style={{
                        "--lot-status-color":
                          selectedLoteStatus?.fill || "#22c55e",
                      }}
                    >
                      {selectedLoteStatus?.label || "Disponible"}
                    </span>
                    <span className={styles.loteInfoAssist}>
                      Seleccionado desde overlay 360
                    </span>
                  </div>
                  <div className={styles.loteDrawerPriceBlock}>
                    <small>Precio actual</small>
                    <strong>{formatMoney(selectedLote)}</strong>
                  </div>
                </div>

                <div className={styles.loteDrawerMeta}>
                  <div className={styles.loteMetaCard}>
                    <span>Proyecto</span>
                    <strong>
                      {selectedLoteInfo?.proyecto?.nombreproyecto ||
                        "GeoHabita 360"}
                    </strong>
                  </div>
                  <div className={styles.loteMetaCard}>
                    <span>Inmobiliaria</span>
                    <strong>
                      {selectedLoteInfo?.inmobiliaria?.nombreinmobiliaria ||
                        "Consultar"}
                    </strong>
                  </div>
                </div>

                <div className={styles.loteInfoGrid}>
                  <div>
                    <Ruler size={15} />
                    <strong>
                      {hasDisplayValue(selectedLote?.area_total_m2)
                        ? `${selectedLote.area_total_m2} m2`
                        : "Consultar"}
                    </strong>
                    <span>Area total</span>
                  </div>
                  <div>
                    <Ruler size={15} />
                    <strong>
                      {hasDisplayValue(selectedLote?.ancho)
                        ? `${selectedLote.ancho} m`
                        : "Consultar"}
                    </strong>
                    <span>Ancho</span>
                  </div>
                  <div>
                    <Ruler size={15} />
                    <strong>
                      {hasDisplayValue(selectedLote?.largo)
                        ? `${selectedLote.largo} m`
                        : "Consultar"}
                    </strong>
                    <span>Largo</span>
                  </div>
                  <div>
                    <Tag size={15} />
                    <strong>{selectedLote?.idlote || "N/A"}</strong>
                    <span>ID lote</span>
                  </div>
                </div>

                <div className={styles.loteActionButtons}>
                  <button
                    type="button"
                    className={styles.actionBtnWhatsApp}
                    onClick={() => {
                      const phone =
                        selectedLoteInfo?.inmobiliaria?.telefono ||
                        selectedLoteInfo?.inmobiliaria?.celular;
                      if (phone) {
                        const cleanPhone = phone.replace(/\D/g, "");
                        window.open(
                          `https://wa.me/${cleanPhone}?text=Hola, estoy interesado en el lote ${selectedLote?.nombre}`,
                          "_blank",
                        );
                      }
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtnCall}
                    onClick={() => {
                      const phone =
                        selectedLoteInfo?.inmobiliaria?.telefono ||
                        selectedLoteInfo?.inmobiliaria?.celular;
                      if (phone) {
                        window.location.href = `tel:${phone}`;
                      }
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="currentColor"
                    >
                      <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                    </svg>
                    Llamar
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtnShare}
                    onClick={() => {
                      const shareData = {
                        title: `Lote ${selectedLote?.nombre} - GeoHabita`,
                        text: `Mira este lote: ${selectedLote?.nombre} en ${selectedLoteInfo?.proyecto?.nombreproyecto || "GeoHabita"}. Precio: ${formatMoney(selectedLote)}`,
                        url: window.location.href,
                      };
                      if (navigator.share) {
                        navigator.share(shareData);
                      } else {
                        navigator.clipboard.writeText(
                          `${shareData.text} ${window.location.href}`,
                        );
                        alert("Enlace copiado al portapapeles");
                      }
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="currentColor"
                    >
                      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                    </svg>
                    Compartir
                  </button>
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      <aside className={styles.sideGallery}>
        <div className={styles.galleryHeader}>
          <ImageIcon size={18} className={styles.greenText} />
          <div>
            <span>Vistas disponibles</span>
            <small>{normalizedImages.length} ambientes</small>
          </div>
        </div>

        {/* <div
          className={`${styles.experiencePanel} viewer-panel-enter`}
          ref={experiencePanelRef}
        >
          <div className={styles.experienceHeader}>
            <Navigation size={16} />
            <span>Experiencia virtual</span>
          </div>
          <div className={styles.experienceStats}>
            <div className={styles.experienceStat}>
              <strong>{lotesSummary.available}</strong>
              <span>Disponibles</span>
            </div>
            <div className={styles.experienceStat}>
              <strong>{lotesSummary.reserved}</strong>
              <span>Reservados</span>
            </div>
            <div className={styles.experienceStat}>
              <strong>{lotesSummary.sold}</strong>
              <span>Vendidos</span>
            </div>
          </div>
          <div className={styles.lotLegend}>
            <div className={styles.lotLegendItem}>
              <span
                className={styles.lotLegendSwatch}
                style={{ "--legend-color": "#22c55e", "--legend-dash": "none" }}
              />
              <small>Disponible</small>
            </div>
            <div className={styles.lotLegendItem}>
              <span
                className={styles.lotLegendSwatch}
                style={{ "--legend-color": "#f59e0b", "--legend-dash": "14 6" }}
              />
              <small>Reservado</small>
            </div>
            <div className={styles.lotLegendItem}>
              <span
                className={styles.lotLegendSwatch}
                style={{ "--legend-color": "#ef4444", "--legend-dash": "8 5" }}
              />
              <small>Vendido</small>
            </div>
          </div>
        </div> */}

        <div className={styles.galleryList}>
          {normalizedImages.map((img, idx) => (
            <button
              key={getImageId(img) || idx}
              type="button"
              className={`${styles.galleryItem} ${idx === currentIndex ? styles.activeItem : ""}`}
              onClick={() => setCurrentIndex(idx)}
            >
              <div className={styles.thumbWrapper}>
                {(viewerReady || idx === currentIndex) && (
                  <img
                    src={img.imagen}
                    alt={img.nombre}
                    loading={getLoadingMode(idx, currentIndex)}
                    decoding="async"
                    fetchPriority={getFetchPriority(idx, currentIndex)}
                  />
                )}
                {idx === currentIndex && (
                  <div className={styles.activeBadge}>Viendo</div>
                )}
              </div>
              <span className={styles.thumbName}>{img.nombre}</span>
            </button>
          ))}
        </div>

        <div className={styles.hotspotsPanel}>
          <div className={styles.hotspotsHeader}>
            <Route size={16} />
            <span>Puntos de esta vista</span>
          </div>

          {hotspotsLoading ? (
            <div className={styles.emptyHotspots}>Cargando puntos...</div>
          ) : hotspots.length === 0 ? (
            <div className={styles.emptyHotspots}>
              Esta vista no tiene puntos conectados.
            </div>
          ) : (
            <div className={styles.hotspotsList}>
              {hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className={styles.hotspotItem}
                  onClick={() =>
                    travelToImageById(
                      hotspot.destino?.id_imagen,
                      hotspot.destino?.nombre,
                    )
                  }
                >
                  <div className={styles.hotspotIconWrap}>
                    <MapPinned size={16} />
                  </div>
                  <div>
                    <strong>
                      {hotspot.destino?.nombre || "Vista conectada"}
                    </strong>
                    <span>Ir al punto seleccionado</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default Viewer360Modal;
