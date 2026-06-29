import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Building2,
  Home,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pencil,
  Phone,
  Plus,
  Ruler,
  Church,
  Goal,
  Landmark,
  Navigation,
  Route,
  Share2,
  Store,
  Tag,
  Trash2,
  Trees,
  Volleyball,
  Waves,
  CheckCircle2,
} from "lucide-react";
import { withApiBase } from "../../config/api.js";
import styles from "./Viewer360.module.css";

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

const API_BASE = "https://api.geohabita.com";
const MARKER_SIZE = { width: 118, height: 78 };
const ANNOTATION_MARKER_SIZE = { width: 44, height: 62 };
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

const OVERLAY_VIEWBOX = { width: 1200, height: 780 };
const OVERLAY_HEADER_OFFSET = 42;

// Pano loader lot data — format: [top%, left%, width%, height%, delay-s]
// Mirroring GeoHabitaLoader's LOTES style, grouped in realistic subdivision clusters
const PANO_LOTS = [
  // Zone A — top-left
  [3, 2, 10, 7, 0.0],
  [3, 14, 8, 7, 0.15],
  [11, 2, 10, 7, 0.3],
  [11, 14, 8, 7, 0.45],
  [19, 2, 10, 6, 0.6],
  [19, 14, 8, 6, 0.75],
  // Zone B — top-right
  [4, 72, 10, 8, 0.2],
  [4, 84, 11, 8, 0.35],
  [14, 72, 10, 7, 0.5],
  [14, 84, 11, 6, 0.1],
  [22, 72, 10, 6, 0.65],
  [22, 84, 11, 8, 0.8],
  // Zone C — center (flanks the core spinner)
  [34, 41, 9, 7, 0.25],
  [34, 52, 7, 7, 0.4],
  [43, 41, 9, 7, 0.55],
  [43, 52, 7, 7, 0.7],
  // Zone D — bottom-left
  [72, 5, 9, 7, 0.08],
  [72, 16, 11, 7, 0.23],
  [81, 5, 9, 6, 0.38],
  [81, 16, 11, 6, 0.53],
  // Zone E — bottom-right
  [74, 75, 8, 6, 0.13],
  [74, 85, 10, 6, 0.28],
  [82, 75, 8, 7, 0.43],
  [82, 85, 10, 5, 0.58],
  // Scattered singletons
  [7, 29, 7, 5, 0.18],
  [7, 58, 8, 6, 0.33],
  [57, 30, 7, 6, 0.48],
  [57, 62, 6, 5, 0.63],
  [42, 92, 6, 5, 0.78],
  [47, 2, 7, 5, 0.93],
];

// Darker zone blocks behind each lot cluster — like GeoHabitaLoader's zone fills
const PANO_ZONES = [
  [1, 1, 24, 31], // Zone A
  [1, 68, 25, 30], // Zone B
  [30, 37, 22, 25], // Zone C
  [68, 1, 23, 22], // Zone D
  [70, 71, 24, 22], // Zone E
];

// Road separators between clusters (% of overlay area)
const PANO_ROADS = [
  { x: 0, y: 31, w: 100, h: 0.35 },
  { x: 0, y: 67, w: 100, h: 0.35 },
  { x: 27, y: 0, w: 0.35, h: 32 },
  { x: 63, y: 0, w: 0.35, h: 68 },
];

// Inline SVG icons for space area labels (per scenario type)
const SPACE_LABEL_ICONS = {
  parque: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 22V13"/><path d="M12 13C8 13 5 10 5 6.5S8.5 2 12 2s7 1.5 7 4.5S16 13 12 13z"/></svg>`,
  area: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
  manzana: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>`,
  via: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 20 L10 4 M14 4 L19 20"/><line x1="7" y1="14" x2="17" y2="14"/></svg>`,
  iglesia: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="8"/><line x1="9" y1="5" x2="15" y2="5"/><path d="M6 22V12l6-4 6 4v10H6z"/></svg>`,
  parquedep: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5 12h14M12 5v14"/></svg>`,
  comercio: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
};

const HOTSPOT_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="118" height="78" viewBox="0 0 118 78">
  <defs>
    <filter id="sh" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".42"/>
    </filter>
    <radialGradient id="badge" cx="36%" cy="28%">
      <stop offset="0%" stop-color="#1a6633"/>
      <stop offset="100%" stop-color="#052e16"/>
    </radialGradient>
    <linearGradient id="stem" gradientUnits="userSpaceOnUse" x1="59" y1="34" x2="59" y2="68">
      <stop offset="0%" stop-color="#22c55e" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#14532d" stop-opacity=".7"/>
    </linearGradient>
  </defs>
  <circle cx="59" cy="22" r="21" fill="rgba(34,197,94,0.14)"/>
  <ellipse cx="59" cy="70" rx="8" ry="2" fill="rgba(0,0,0,0.22)"/>
  <rect x="56.5" y="34" width="5" height="34" rx="2.5" fill="url(#stem)"/>
  <g filter="url(#sh)">
    <circle cx="59" cy="22" r="17" fill="url(#badge)" stroke="rgba(74,222,128,0.9)" stroke-width="2"/>
  </g>
  <circle cx="59" cy="22" r="12" fill="none" stroke="rgba(187,247,208,0.18)" stroke-width="5"/>
  <path d="M55 14 L63 22 L55 30" fill="none" stroke="rgba(255,255,255,0.96)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
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

const GALLERY_PRELOAD_RANGE = 2;
const VIEWER_RESOLUTION = 64;
const VIEWER_MOVE_SPEED = 1.75;
const LOT_LABEL_MIN_ZOOM = 10;
const LOT_LABELS_ENABLED = false;

const DRAWING_SCENARIO_TYPES = [
  { key: "area", label: "Area libre", icon: MapIcon, color: "#0ea5e9" },
  { key: "lote", label: "Lote", icon: Home, color: "#16a34a" },
  { key: "parque", label: "Parque", icon: Trees, color: "#22c55e" },
  { key: "loza", label: "Loza deportiva", icon: Volleyball, color: "#22d3ee" },
  { key: "cancha", label: "Cancha deportiva", icon: Goal, color: "#4ade80" },
  { key: "piscina", label: "Piscina", icon: Waves, color: "#06b6d4" },
  { key: "plaza", label: "Plaza", icon: Landmark, color: "#f59e0b" },
  { key: "iglesia", label: "Iglesia", icon: Church, color: "#e2e8f0" },
  { key: "comercio", label: "Comercio", icon: Store, color: "#8b5cf6" },
];

const DEFAULT_DRAWING_SCENARIO = DRAWING_SCENARIO_TYPES[0];

const getDrawingScenario = (key) =>
  DRAWING_SCENARIO_TYPES.find((item) => item.key === key) ||
  DEFAULT_DRAWING_SCENARIO;

const renderCourtIcon = () => null;

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

const parseFinancingConfig = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isFinancingConfigured = (config) => {
  if (!config) return false;
  // Require explicit months range AND either an interest rate or minimum initial amount
  const hasMonths = Number(config.max_months) > 1;
  const hasRate = Number(config.annual_interest_rate) > 0;
  const hasInitial =
    Number(config.max_initial_amount) > 0 ||
    Number(config.default_initial_amount) > 0;
  return hasMonths && (hasRate || hasInitial);
};

const formatCurrencyMoney = (value, currency = "S/") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} 0.00`;
  return `${currency} ${amount.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const calcPayment = (principal, annualRate, months) => {
  const safePrincipal = Math.max(Number(principal) || 0, 0);
  const safeMonths = Math.max(1, Math.round(Number(months) || 1));
  const monthlyRate = Math.max(0, Number(annualRate) || 0) / 12 / 100;
  if (!monthlyRate) return safePrincipal / safeMonths;
  return (
    (safePrincipal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -safeMonths))
  );
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
const darkenHexColor = (value, amount = 0.24) => {
  const hex = String(value || "")
    .trim()
    .replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex.slice(0, 6);

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return value;
  }

  const toChannel = (start) =>
    Math.max(
      0,
      Math.round(
        parseInt(normalized.slice(start, start + 2), 16) * (1 - amount),
      ),
    )
      .toString(16)
      .padStart(2, "0");

  return `#${toChannel(0)}${toChannel(2)}${toChannel(4)}`;
};

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
const getAvailableLoteTone = (variant = 0) =>
  variant % 2 === 0
    ? {
        fill: "#7ed957",
        shadow: "#4f9a2f",
        glow: "rgba(126, 217, 87, 0.34)",
        stroke: darkenHexColor("#7ed957", 0.36),
      }
    : {
        fill: "#37b24d",
        shadow: "#247a33",
        glow: "rgba(55, 178, 77, 0.32)",
        stroke: darkenHexColor("#37b24d", 0.34),
      };

const TEXTURE_STROKE_VARIANTS = {
  hatch: { strokeDasharray: "6 3", strokeWidth: "2.8px" },
  dots: { strokeDasharray: "2 6", strokeWidth: "2.8px" },
  cross: { strokeDasharray: "10 4", strokeWidth: "2.8px" },
  solid: {},
  outline: { strokeWidth: "2.5px" },
};

const getLoteSvgStyle = ({
  status,
  isSelected,
  overlayOpacity,
  loteColor,
  availableVariant = 0,
  textureMode = "solid",
  showShadow = true,
}) => {
  const availableTone =
    status.key === "available" ? getAvailableLoteTone(availableVariant) : null;
  const baseFill =
    status.key === "available"
      ? availableTone?.fill || status.fill
      : loteColor || status.fill;
  const derivedStroke =
    darkenHexColor(baseFill, 0.34) || availableTone?.stroke || status.stroke;

  const textureMod = TEXTURE_STROKE_VARIANTS[textureMode] ?? {};
  // Una sola sombra (en vez de dos apiladas) para el caso general: con hasta un
  // centenar de lotes visibles a la vez, dos filtros drop-shadow por polígono
  // duplican el costo de repintado en cada frame de paneo/zoom. El lote
  // seleccionado (uno solo a la vez) sí puede pagarse la sombra doble.
  const shadowFilter = showShadow
    ? "drop-shadow(0px 3px 6px rgba(0,0,0,0.45))"
    : undefined;
  const textureFillOpacity =
    textureMode !== "solid" && textureMode !== "outline" ? "0.55" : null;

  if (textureMode === "outline") {
    return {
      fill: "none",
      fillOpacity: "0",
      stroke: isSelected ? "#0f766e" : "rgba(255,255,255,0.9)",
      strokeWidth: isSelected ? "3.5px" : "2.5px",
      strokeLinejoin: "round",
      strokeOpacity: "1",
      ...(shadowFilter ? { filter: shadowFilter } : {}),
    };
  }

  if (textureMode === "transparent") {
    if (isSelected) {
      return {
        fill: "#11e69f",
        fillOpacity: "0.90",
        stroke: "#14da8e",
        strokeWidth: "3px",
        strokeLinejoin: "round",
        strokeOpacity: "1",
      };
    }
    // Sin drop-shadow: una sombra detrás de un relleno translúcido se ve como un
    // halo oscuro que opaca el efecto "transparente" que se está pidiendo.
    const tFill = loteColor || status.fill;
    return {
      fill: tFill,
      fillOpacity: "0.35",
      stroke: darkenHexColor(tFill, 0.34) || status.stroke,
      strokeWidth: "2.2px",
      strokeLinejoin: "round",
      strokeOpacity: "0.95",
    };
  }

  if (isSelected) {
    return {
      fill: "#ffffff",
      fillOpacity: "0.88",
      stroke: "#7c3aed",
      strokeWidth: "3px",
      strokeLinejoin: "round",
      strokeOpacity: "1",
    };
  }

  if (status.key === "sold") {
    return {
      fill: baseFill,
      fillOpacity: textureFillOpacity ?? "0.76",
      stroke: derivedStroke,
      strokeWidth: textureMod.strokeWidth ?? "2.4px",
      strokeLinejoin: "round",
      strokeOpacity: "0.94",
      strokeDasharray: textureMod.strokeDasharray ?? "8 5",
      ...(shadowFilter ? { filter: shadowFilter } : {}),
    };
  }

  if (status.key === "reserved") {
    return {
      fill: baseFill,
      fillOpacity: textureFillOpacity ?? "0.78",
      stroke: derivedStroke,
      strokeWidth: textureMod.strokeWidth ?? "2.5px",
      strokeLinejoin: "round",
      strokeOpacity: "0.98",
      strokeDasharray: textureMod.strokeDasharray ?? "14 6",
      ...(shadowFilter ? { filter: shadowFilter } : {}),
    };
  }

  return {
    fill: baseFill,
    fillOpacity:
      textureFillOpacity ??
      String(Math.min(Number(overlayOpacity ?? 0.82), 0.82)),
    stroke: derivedStroke,
    strokeWidth: textureMod.strokeWidth ?? "2.2px",
    strokeLinejoin: "round",
    strokeOpacity: "0.95",
    ...(textureMod.strokeDasharray
      ? { strokeDasharray: textureMod.strokeDasharray }
      : {}),
    ...(shadowFilter ? { filter: shadowFilter } : {}),
  };
};

const waitForNextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

const MEDIA_PREFIX = `${API_BASE}/media/`;
const MEDIA_PROXY = `${API_BASE}/api/360media/`;

const MAX_BLOB_CACHE = 8;

const addToBlobCache = (cache, key, blobUrl) => {
  if (cache.size >= MAX_BLOB_CACHE) {
    const oldestKey = cache.keys().next().value;
    const oldestUrl = cache.get(oldestKey);
    URL.revokeObjectURL(oldestUrl);
    cache.delete(oldestKey);
  }
  cache.set(key, blobUrl);
};

const warmUpImage = (src, timeout = 8000) =>
  new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const mediaSuffix = src.startsWith(MEDIA_PREFIX)
      ? src.slice(MEDIA_PREFIX.length)
      : null;
    const fetchSrc = mediaSuffix
      ? import.meta.env.DEV
        ? `/dev-media-proxy/${mediaSuffix}`
        : `${MEDIA_PROXY}${mediaSuffix}`
      : src;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeout);
    fetch(fetchSrc, { signal: controller.signal })
      .then((res) =>
        res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`)),
      )
      .then((blob) => {
        window.clearTimeout(timer);
        resolve(URL.createObjectURL(blob));
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(null);
      });
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
  imagen: normalizeUrl(img.imagen_thumb || img.imagen),
  imagen_original: normalizeUrl(img.imagen),
});
const getProjectRecord = (img) => {
  if (img?.idproyecto && typeof img.idproyecto === "object")
    return img.idproyecto;
  if (img?.proyecto && typeof img.proyecto === "object") return img.proyecto;
  return {};
};
const getProjectNameCandidate = (img) =>
  img?.idproyecto?.nombreproyecto ||
  img?.proyecto?.nombreproyecto ||
  img?.proyecto_nombre ||
  img?.nombre_proyecto ||
  img?.nombreproyecto ||
  img?.project_name ||
  "";
const inferProjectName = (images = [], currentImage = null) => {
  const candidates = [currentImage, ...images].filter(Boolean);
  for (const item of candidates) {
    const name = String(getProjectNameCandidate(item) || "").trim();
    if (name) return name;
  }
  return String(currentImage?.nombre || images[0]?.nombre || "").trim();
};
const formatProjectMoney = (record) => {
  if (!record || !hasDisplayValue(record?.precio)) return "";
  const numeric = Number(record.precio);
  const value = Number.isFinite(numeric)
    ? numeric.toLocaleString("es-PE")
    : record.precio;
  return `${record?.moneda || ""} ${value}`.trim();
};
const formatPricePerSquareMeter = (lote) => {
  const price = Number(lote?.precio);
  const area = Number(lote?.area_total_m2);
  if (!Number.isFinite(price) || !Number.isFinite(area) || area <= 0) return "";
  return `${lote?.moneda || ""} ${(price / area).toLocaleString("es-PE", {
    maximumFractionDigits: 2,
  })}/m2`.trim();
};
const getDeveloperName = (record, fallback = null) =>
  record?.idinmobiliaria?.nombreinmobiliaria ||
  record?.inmobiliaria?.nombreinmobiliaria ||
  record?.nombreinmobiliaria ||
  fallback?.nombreinmobiliaria ||
  "";
const truncateText = (value, max = 150) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
};

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

const projectViewerPointWithCamera = (
  viewer,
  viewerPoint,
  width,
  height,
  Vector3Ctor,
) => {
  const camera = viewer?.renderer?.camera;
  if (!camera || !width || !height || !Vector3Ctor) return null;

  const ndcX = (Number(viewerPoint.x) / width) * 2 - 1;
  const ndcY = 1 - (Number(viewerPoint.y) / height) * 2;
  const direction = new Vector3Ctor(ndcX, ndcY, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();

  return viewer.dataHelper.vector3ToSphericalCoords(direction);
};

const transformOverlayPoint = (point, config, perspectiveOrigin = null) => {
  const angle = ((config?.rotation || 0) * Math.PI) / 180;
  const scale = config?.scale || 1;
  const tx = config?.x || 0;
  const ty = config?.y || 0;
  const tiltXRad = ((Number(config?.tiltX) || 0) * Math.PI) / 180;
  const tiltYRad = ((Number(config?.tiltY) || 0) * Math.PI) / 180;
  const pD = Number(config?.perspectiveDepth) || 900;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  let x = point.x * cos - point.y * sin;
  let y = point.x * sin + point.y * cos;
  let z = 0;
  x *= scale;
  y *= scale;

  if (tiltYRad !== 0) {
    const cY = Math.cos(tiltYRad),
      sY = Math.sin(tiltYRad);
    const nx = x * cY + z * sY;
    z = -x * sY + z * cY;
    x = nx;
  }
  if (tiltXRad !== 0) {
    const cX = Math.cos(tiltXRad),
      sX = Math.sin(tiltXRad);
    const ny = y * cX - z * sX;
    z = y * sX + z * cX;
    y = ny;
  }

  const hasTilt = tiltXRad !== 0 || tiltYRad !== 0;
  const factor = hasTilt ? pD / (pD - z) : 1;
  const ox = perspectiveOrigin?.x ?? 0;
  const oy = perspectiveOrigin?.y ?? 0;

  return {
    x: ox + (x + tx - ox) * factor,
    y: oy + (y + ty - oy) * factor,
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
      viewerRuntimeCache?.Vector3,
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
  const overlayOffsetY =
    layout?.overlayOffsetY != null
      ? Number(layout.overlayOffsetY)
      : OVERLAY_HEADER_OFFSET;

  if (
    !Number.isFinite(svgWidth) ||
    !Number.isFinite(svgHeight) ||
    svgWidth <= 0 ||
    svgHeight <= 0
  ) {
    return null;
  }

  const perspectiveOrigin =
    savedViewerWidth > 0 && savedViewerHeight > 0
      ? { x: savedViewerWidth / 2, y: savedViewerHeight / 2 }
      : null;

  const convertPoint = (point) => {
    const localPoint = {
      x: overlayOffsetX + (point.x / OVERLAY_VIEWBOX.width) * svgWidth,
      y: overlayOffsetY + (point.y / OVERLAY_VIEWBOX.height) * svgHeight,
    };
    const savedViewerPoint = transformOverlayPoint(
      localPoint,
      layout,
      perspectiveOrigin,
    );
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
    textureMode: layout.textureMode ?? "solid",
    showShadow: layout.showShadow !== false,
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
    textureMode: overlay.textureMode ?? layout?.textureMode ?? "solid",
    showShadow: overlay.showShadow !== false,
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

  const additionalOverlays =
    candidate.additionalOverlays &&
    typeof candidate.additionalOverlays === "object" &&
    !Array.isArray(candidate.additionalOverlays)
      ? candidate.additionalOverlays
      : {};

  return {
    geometry: candidate.geometry || null,
    layouts,
    layoutsList: layoutsRaw,
    anchored,
    anchoredList: anchoredRaw,
    annotations: Array.isArray(candidate.annotations)
      ? candidate.annotations
      : [],
    userDrawings:
      candidate.userDrawings && typeof candidate.userDrawings === "object"
        ? candidate.userDrawings
        : {},
    additionalOverlays,
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getPolygonBounds = (polygon = []) =>
  polygon.reduce(
    (acc, point) => {
      const x = Number(point?.[0] || 0);
      const y = Number(point?.[1] || 0);
      acc.minX = Math.min(acc.minX, x);
      acc.maxX = Math.max(acc.maxX, x);
      acc.minY = Math.min(acc.minY, y);
      acc.maxY = Math.max(acc.maxY, y);
      return acc;
    },
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    },
  );

const getPolygonSignedArea = (polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    area += Number(x1) * Number(y2) - Number(x2) * Number(y1);
  }
  return area / 2;
};

const computePolygonVisualCentroid = (polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return computePolygonCentroid(polygon);
  }

  const signedArea = getPolygonSignedArea(polygon);
  if (Math.abs(signedArea) < 1e-6) {
    return computePolygonCentroid(polygon);
  }

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const factor = Number(x1) * Number(y2) - Number(x2) * Number(y1);
    cx += (Number(x1) + Number(x2)) * factor;
    cy += (Number(y1) + Number(y2)) * factor;
  }

  return {
    x: cx / (6 * signedArea),
    y: cy / (6 * signedArea),
  };
};

const isPointInPolygon = (point, polygon = []) => {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = Number(polygon[i]?.[0]);
    const yi = Number(polygon[i]?.[1]);
    const xj = Number(polygon[j]?.[0]);
    const yj = Number(polygon[j]?.[1]);

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-6) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
};

const getPointToSegmentDistance = (point, start, end) => {
  const px = Number(point?.x || 0);
  const py = Number(point?.y || 0);
  const x1 = Number(start?.[0] || 0);
  const y1 = Number(start?.[1] || 0);
  const x2 = Number(end?.[0] || 0);
  const y2 = Number(end?.[1] || 0);
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (!dx && !dy) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = clamp(
    ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
};

const getDistanceToPolygonEdges = (point, polygon = []) => {
  if (!polygon.length) return 0;
  let minDistance = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    minDistance = Math.min(
      minDistance,
      getPointToSegmentDistance(point, start, end),
    );
  }
  return Number.isFinite(minDistance) ? minDistance : 0;
};

const computePolygonLabelAnchor = (polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return computePolygonCentroid(polygon);
  }

  const centroid = computePolygonVisualCentroid(polygon);
  if (isPointInPolygon(centroid, polygon)) {
    return centroid;
  }

  const bounds = getPolygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const candidates = [
    centroid,
    {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    },
    computePolygonCentroid(polygon),
  ];

  for (let gx = 1; gx <= 5; gx += 1) {
    for (let gy = 1; gy <= 5; gy += 1) {
      candidates.push({
        x: bounds.minX + (width * gx) / 6,
        y: bounds.minY + (height * gy) / 6,
      });
    }
  }

  let bestPoint = candidates[0];
  let bestScore = -Infinity;
  candidates.forEach((candidate) => {
    if (!isPointInPolygon(candidate, polygon)) return;
    const edgeDistance = getDistanceToPolygonEdges(candidate, polygon);
    if (edgeDistance > bestScore) {
      bestScore = edgeDistance;
      bestPoint = candidate;
    }
  });

  return bestPoint;
};

const computeScreenPolygonArea = (polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
};

const computeLongestEdgeAngle = (polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length < 2) return 0;

  let longestLength = 0;
  let angle = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const dx = Number(next?.x || 0) - Number(current?.x || 0);
    const dy = Number(next?.y || 0) - Number(current?.y || 0);
    const length = Math.hypot(dx, dy);
    if (length > longestLength) {
      longestLength = length;
      angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    }
  }

  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
};

const buildLoteLabelLines = (lote) => {
  const rawName = String(
    lote?.nombre || `Lote ${getLoteId(lote) || ""}`,
  ).trim();
  const normalizedName = rawName.replace(/\s+/g, " ").trim();
  const manzanaMatch = normalizedName.match(/^(.*?)(,?\s*manzana\s+.+)$/i);
  const number = manzanaMatch?.[1]?.trim() || normalizedName;
  const block = manzanaMatch?.[2]?.replace(/^,\s*/, "").trim() || "";
  const area = hasDisplayValue(lote?.area_total_m2)
    ? `${lote.area_total_m2} m²`
    : "";

  return {
    number,
    area,
    block,
    rawName,
  };
};

const buildLoteTooltipContent = (lote, status) => {
  const area = hasDisplayValue(lote?.area_total_m2)
    ? `${lote.area_total_m2} m²`
    : "";
  const name = String(lote?.nombre || `Lote ${getLoteId(lote) || ""}`).replace(
    /</g,
    "&lt;",
  );
  const statusColor =
    status.key === "available"
      ? "#22c55e"
      : status.key === "reserved"
        ? "#f59e0b"
        : "#ef4444";
  return `
    <div class="gh-lot-tooltip-card">
      <div class="gh-lot-tooltip-header">
        <div class="gh-lot-tooltip-logo-wrap">
          <img class="gh-lot-tooltip-logo" src="/habitasinfondo.png" alt="GeoHabita" />
        </div>
        <div class="gh-lot-tooltip-title">
          <span class="gh-lot-tooltip-name">${name}</span>
          ${area ? `<span class="gh-lot-tooltip-area">${area}</span>` : ""}
        </div>
      </div>
      <div class="gh-lot-tooltip-footer">
        <span class="gh-lot-tooltip-dot" style="background:${statusColor};box-shadow:0 0 6px ${statusColor}88"></span>
        <span class="gh-lot-tooltip-status-label" style="color:${statusColor}">${status.label}</span>
        <span class="gh-lot-tooltip-cta">Ver detalles →</span>
      </div>
    </div>
  `;
};

gsap.registerPlugin(useGSAP);

const Viewer360Modal = ({
  images360 = [],
  onClose,
  projectName: providedProjectName = "",
}) => {
  const isClient = typeof window !== "undefined";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hotspots, setHotspots] = useState([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerPanTick, setViewerPanTick] = useState(0);
  const [viewerRuntimeReady, setViewerRuntimeReady] = useState(false);
  const [viewerLoadMessage, setViewerLoadMessage] = useState(
    "Preparando recorrido 360...",
  );
  const [travelingTo, setTravelingTo] = useState("");
  const [computedOverlay, setComputedOverlay] = useState(null);
  const [selectedLoteInfo, setSelectedLoteInfo] = useState(null);
  const [loteInfoLoading, setLoteInfoLoading] = useState(false);
  const [loteInfoError, setLoteInfoError] = useState("");
  const [isMobileView, setIsMobileView] = useState(() =>
    isClient ? window.innerWidth <= 768 : false,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gallerySheetMode, setGallerySheetMode] = useState("mid");
  const [gallerySheetTop, setGallerySheetTop] = useState(null);
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);
  const [loteSheetMode, setLoteSheetMode] = useState("mid");
  const [loteSheetTop, setLoteSheetTop] = useState(null);
  const [isLoteSheetDragging, setIsLoteSheetDragging] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPanoramaLoading, setIsPanoramaLoading] = useState(false);
  const overlayRef = useRef(null);
  const sideGalleryRef = useRef(null);
  const sideGalleryBodyRef = useRef(null);
  const loteDrawerRef = useRef(null);
  const loteDrawerBodyRef = useRef(null);
  const lotLabelsLayerRef = useRef(null);
  const lotLabelGroupRefs = useRef(new Map());
  const lotLabelTitleRefs = useRef(new Map());
  const lotLabelAreaRefs = useRef(new Map());
  const lotLabelBlockRefs = useRef(new Map());
  const viewerRef = useRef(null);
  const viewerRuntimeRef = useRef(null);
  const containerRef = useRef(null);
  const lotLabelsFrameRef = useRef(null);
  const drawPanFrameRef = useRef(null);
  const lotLabelsZoomTimerRef = useRef(null);
  const lotLabelsZoomingRef = useRef(false);
  const travelTimerRef = useRef(null);
  const hotspotsCacheRef = useRef(new Map());
  const hotspotsAbortRef = useRef(null);
  const grafoAbortRef = useRef(null);
  const loteInfoCacheRef = useRef(new Map());
  const loteInfoAbortRef = useRef(null);
  const projectLotesCacheRef = useRef(new Map());
  const previousGallerySheetStateRef = useRef(null);
  const galleryTouchStartY = useRef(0);
  const galleryTouchDeltaY = useRef(0);
  const galleryTouchStartTop = useRef(0);
  const preloadBlobsRef = useRef(new Map());
  const preloadPendingRef = useRef(new Set());
  const openLoteFromMarkerRef = useRef(null);
  const travelToImageByIdRef = useRef(null);
  const lastShownSrcRef = useRef(null);
  const lastCenteredLoteRef = useRef(null);
  const currentOpenLoteIdRef = useRef(null);
  const currentCenteringAnimationRef = useRef(null);

  const [shareCopied, setShareCopied] = useState(false);

  const [drawMode, setDrawMode] = useState(null);
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState([]);
  const [polygonCursorPos, setPolygonCursorPos] = useState(null);
  const [userDrawings, setUserDrawings] = useState({});
  const drawModeRef = useRef(null);
  const currentPolygonPointsRef = useRef([]);
  const drawOverlayRef = useRef(null);

  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationLabel, setAnnotationLabel] = useState("");
  const [annotationDesc, setAnnotationDesc] = useState("");
  const [pendingAnnotCoords, setPendingAnnotCoords] = useState(null);
  const [localAnnotations, setLocalAnnotations] = useState({});
  const annotationModeRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadViewerRuntime()
      .then((runtime) => {
        if (!active) return;
        viewerRuntimeRef.current = runtime;
        setViewerRuntimeReady(true);
      })
      .catch((error) => {
        console.error("No se pudo cargar el runtime 360:", error);
        if (active) {
          setViewerLoadMessage("No se pudo cargar la vista 360.");
        }
      });

    return () => {
      active = false;
    };
  }, []);
  const galleryNestedTouchStartY = useRef(0);
  const galleryNestedTouchDeltaY = useRef(0);
  const galleryNestedScrollableTarget = useRef(null);
  const loteTouchStartY = useRef(0);
  const loteTouchDeltaY = useRef(0);
  const loteTouchStartTop = useRef(0);
  const loteNestedTouchStartY = useRef(0);
  const loteNestedTouchDeltaY = useRef(0);
  const loteNestedScrollableTarget = useRef(null);

  const normalizedImages = useMemo(
    () => (Array.isArray(images360) ? images360.map(normalizeImage) : []),
    [images360],
  );
  const viewerProjectId = useMemo(
    () => (normalizedImages.length > 0 ? getProjectId(normalizedImages[0]) : null),
    [normalizedImages],
  );
  const overlayBundles = useMemo(
    () => collectOverlayBundles(normalizedImages),
    [normalizedImages],
  );
  const currentImage = normalizedImages[currentIndex];
  const currentImageId = getImageId(currentImage);
  const currentProjectRecord = useMemo(
    () => getProjectRecord(currentImage),
    [currentImage],
  );
  const projectName =
    String(providedProjectName || "").trim() ||
    inferProjectName(normalizedImages, currentImage) ||
    "Proyecto no identificado";
  const currentAnchoredOverlay = useMemo(() => {
    const imageKey = String(currentImageId ?? "");
    if (!imageKey) return null;

    for (const entry of overlayBundles) {
      const directMatch = entry.bundle?.anchored?.[imageKey];
      if (directMatch) return directMatch;
    }

    return null;
  }, [currentImageId, overlayBundles]);

  const currentAdditionalOverlays = useMemo(() => {
    const imageKey = String(currentImageId ?? "");
    if (!imageKey) return [];
    for (const entry of overlayBundles) {
      const instances = entry.bundle?.additionalOverlays?.[imageKey];
      if (Array.isArray(instances) && instances.length) return instances;
    }
    return [];
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
  const currentImageAnnotations = useMemo(() => {
    const imageKey = String(currentImageId ?? "");
    if (!imageKey) return [];
    const seen = new Set();
    const result = [];
    for (const entry of overlayBundles) {
      for (const ann of entry.bundle?.annotations || []) {
        if (!ann?.id || !ann?.label || seen.has(ann.id)) continue;
        seen.add(ann.id);
        if (String(ann.imageId) === imageKey) result.push(ann);
      }
    }
    return result;
  }, [overlayBundles, currentImageId]);
  const savedDrawings = useMemo(() => {
    const key = String(currentImageId ?? "");
    if (!key) return [];
    for (const entry of overlayBundles) {
      const drawings = entry.bundle?.userDrawings?.[key];
      if (Array.isArray(drawings) && drawings.length) return drawings;
    }
    return [];
  }, [overlayBundles, currentImageId]);

  const lotesForHud = useMemo(
    () => overlayToRender?.lotPolygons || [],
    [overlayToRender],
  );
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
  const viewerFinancingConfig = useMemo(
    () => parseFinancingConfig(selectedLoteInfo?.proyecto?.financing_config),
    [selectedLoteInfo?.proyecto?.financing_config],
  );
  const viewerFinancingCurrency =
    viewerFinancingConfig?.currency ||
    selectedLote?.moneda ||
    selectedLoteInfo?.proyecto?.moneda ||
    "S/";
  const viewerFinancingPrice = Number(selectedLote?.precio || 0);
  const viewerFinancingMinInitial = Math.max(
    0,
    Number(
      viewerFinancingConfig?.min_initial_amount ??
        viewerFinancingConfig?.default_initial_amount ??
        0,
    ) || Math.round(viewerFinancingPrice * 0.1),
  );
  const viewerFinancingMaxInitial = Math.max(
    viewerFinancingMinInitial,
    Math.min(
      Number(
        viewerFinancingConfig?.max_initial_amount || viewerFinancingPrice || 0,
      ) || viewerFinancingPrice,
      viewerFinancingPrice || Number.MAX_SAFE_INTEGER,
    ),
  );
  const viewerFinancingMinMonths = Math.max(
    1,
    Number(viewerFinancingConfig?.min_months || 1),
  );
  const viewerFinancingMaxMonths = Math.max(
    viewerFinancingMinMonths,
    Number(viewerFinancingConfig?.max_months || 60),
  );
  const viewerDefaultInitial = clamp(
    viewerFinancingConfig?.default_initial_amount ?? viewerFinancingMinInitial,
    viewerFinancingMinInitial,
    viewerFinancingMaxInitial,
  );
  const viewerDefaultMonths = clamp(
    viewerFinancingConfig?.default_months ?? 36,
    viewerFinancingMinMonths,
    viewerFinancingMaxMonths,
  );
  const [viewerFinancingInitial, setViewerFinancingInitial] =
    useState(viewerDefaultInitial);
  const [viewerFinancingMonths, setViewerFinancingMonths] =
    useState(viewerDefaultMonths);
  useEffect(() => {
    setViewerFinancingInitial(viewerDefaultInitial);
    setViewerFinancingMonths(viewerDefaultMonths);
  }, [viewerDefaultInitial, viewerDefaultMonths, selectedLoteId]);
  const viewerFinancingScenario = useMemo(() => {
    if (!viewerFinancingConfig || !viewerFinancingPrice || !isFinancingConfigured(viewerFinancingConfig)) return null;
    const initial = clamp(
      viewerFinancingInitial,
      viewerFinancingMinInitial,
      viewerFinancingMaxInitial,
    );
    const months = clamp(
      viewerFinancingMonths,
      viewerFinancingMinMonths,
      viewerFinancingMaxMonths,
    );
    const annualRate = Number(viewerFinancingConfig?.annual_interest_rate || 0);
    const monthlyAdminFee = Number(
      viewerFinancingConfig?.monthly_admin_fee || 0,
    );
    const insuranceMonthly = Number(
      viewerFinancingConfig?.insurance_monthly || 0,
    );
    const financedBase = Math.max(viewerFinancingPrice - initial, 0);
    const monthlyEstimate =
      calcPayment(financedBase, annualRate, months) +
      monthlyAdminFee +
      insuranceMonthly;
    const totalPaid = initial + monthlyEstimate * months;
    return { initial, months, annualRate, monthlyEstimate, totalPaid };
  }, [
    viewerFinancingConfig,
    viewerFinancingPrice,
    viewerFinancingInitial,
    viewerFinancingMonths,
    viewerFinancingMinInitial,
    viewerFinancingMaxInitial,
    viewerFinancingMinMonths,
    viewerFinancingMaxMonths,
  ]);
  const contactPhone =
    selectedLoteInfo?.inmobiliaria?.telefono ||
    selectedLoteInfo?.inmobiliaria?.celular ||
    "";
  const cleanContactPhone = String(contactPhone).replace(/\D/g, "");
  const viewerFinancingWhatsappHref =
    viewerFinancingScenario && cleanContactPhone
      ? `https://wa.me/${cleanContactPhone}?text=${encodeURIComponent(
          `Hola, quiero este lote del visor 360.\n\nProyecto: "${selectedLoteInfo?.proyecto?.nombreproyecto || projectName}"\nLote: "${selectedLote?.nombre || "Lote"}"\nInicial: ${formatCurrencyMoney(viewerFinancingScenario.initial, viewerFinancingCurrency)}\nPlazo: ${viewerFinancingScenario.months} meses\nCuota estimada: ${formatCurrencyMoney(viewerFinancingScenario.monthlyEstimate, viewerFinancingCurrency)}\nTotal estimado: ${formatCurrencyMoney(viewerFinancingScenario.totalPaid, viewerFinancingCurrency)}`,
        )}`
      : undefined;
  const shareText = `Mira este lote: ${selectedLote?.nombre || "Lote"} en ${selectedLoteInfo?.proyecto?.nombreproyecto || projectName || "GeoHabita"}. Precio: ${formatMoney(selectedLote)}`;
  const projectSidebarInfo = useMemo(() => {
    const record = currentProjectRecord || {};
    return {
      description: truncateText(record?.descripcion, 180),
      price: formatProjectMoney(record),
      area: hasDisplayValue(record?.area_total_m2)
        ? `${record.area_total_m2} m2`
        : "",
      dimensions:
        hasDisplayValue(record?.ancho) && hasDisplayValue(record?.largo)
          ? `${record.ancho}m x ${record.largo}m`
          : "",
      developer: getDeveloperName(record, selectedLoteInfo?.inmobiliaria),
    };
  }, [currentProjectRecord, selectedLoteInfo]);
  const availableLotVariantById = useMemo(() => {
    const availableItems = lotesForHud
      .map((lote, index) => {
        const polygon = lote?.polygonPixels || [];
        if (!isValidPolygonPixels(polygon)) return null;
        const centroid = computePolygonLabelAnchor(polygon);
        const bounds = getPolygonBounds(polygon);
        return {
          id: String(getLoteId(lote) ?? `idx-${index}`),
          vendido: Number(lote?.vendido),
          centroid,
          width: Math.max(1, bounds.maxX - bounds.minX),
          height: Math.max(1, bounds.maxY - bounds.minY),
        };
      })
      .filter((item) => item && item.vendido === 0)
      .sort(
        (a, b) => a.centroid.y - b.centroid.y || a.centroid.x - b.centroid.x,
      );

    if (!availableItems.length) return {};

    const avgHeight =
      availableItems.reduce((sum, item) => sum + item.height, 0) /
      availableItems.length;
    const rowThreshold = Math.max(18, avgHeight * 0.7);
    const rows = [];

    availableItems.forEach((item) => {
      const lastRow = rows[rows.length - 1];
      if (!lastRow || Math.abs(item.centroid.y - lastRow.y) > rowThreshold) {
        rows.push({ y: item.centroid.y, items: [item] });
      } else {
        lastRow.items.push(item);
        lastRow.y =
          lastRow.items.reduce((sum, rowItem) => sum + rowItem.centroid.y, 0) /
          lastRow.items.length;
      }
    });

    return rows.reduce((acc, row, rowIndex) => {
      row.items
        .sort((a, b) => a.centroid.x - b.centroid.x)
        .forEach((item, colIndex) => {
          acc[item.id] = (rowIndex + colIndex) % 2;
        });
      return acc;
    }, {});
  }, [lotesForHud]);
  const lotLabelsData = useMemo(() => {
    if (!LOT_LABELS_ENABLED) return [];

    return lotesForHud
      .map((lote, index) => {
        const polygonPixels = lote?.polygonPixels || [];
        if (!isValidPolygonPixels(polygonPixels)) return null;

        const loteId = getLoteId(lote) ?? `idx-${index}`;
        const labelLines = buildLoteLabelLines(lote);
        return {
          id: `lot-label-${currentImageId}-${loteId}-${index}`,
          loteId: String(loteId),
          lote,
          status: getLoteStatusMeta(lote?.vendido),
          availableVariant: availableLotVariantById[String(loteId)] ?? 0,
          anchor: computePolygonLabelAnchor(polygonPixels),
          polygonPixels,
          labelLines,
          isSelected: String(loteId) === selectedLoteId,
        };
      })
      .filter(Boolean);
  }, [availableLotVariantById, currentImageId, lotesForHud, selectedLoteId]);
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
    const hasFallback = hasUsefulLoteInfo(fallbackLote);
    // Show fallback data immediately so the panel renders without waiting for API
    setLoteInfoLoading(!hasFallback);
    setSelectedLoteInfo({
      lote: hasFallback
        ? { ...fallbackLote, idlote: getLoteId(fallbackLote) ?? loteId }
        : { idlote: loteId, nombre: `Lote ${loteId}` },
      proyecto: null,
      inmobiliaria: null,
    });

    try {
      const res = await fetch(
        buildApiUrl(`/api/mapa/lote_detalle/${loteId}/`),
        {
          signal: controller.signal,
          cache: "no-store",
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

    const urls = [`/api/listPuntosLoteProyecto/${key}/`];

    const token = localStorage.getItem("access");
    if (token) {
      urls.push(`/api/getLoteProyecto/${key}`);
    }

    for (const url of urls) {
      const init = {
        cache: "no-store",
        ...(url.includes("/api/getLoteProyecto/") && token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {}),
      };
      const res = await fetch(buildApiUrl(url), init);
      if (!res.ok) continue;
      const data = await res.json().catch(() => []);
      const lotes = Array.isArray(data) ? data : [];
      if (lotes.length) return lotes;
    }

    return [];
  }, []);

  const openLoteFromMarker = useCallback(
    async (markerData) => {
      const inlineLote = markerData?.lote || null;
      const inlineId = getLoteId(inlineLote) ?? markerData?.idlote;

      if (inlineId) {
        // Tag this invocation so stale continuations after await can bail out
        const token = String(inlineId);
        currentOpenLoteIdRef.current = token;

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
          if (currentOpenLoteIdRef.current !== token) return;
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
          if (currentOpenLoteIdRef.current !== token) return;
          fallbackLote = inlineLote;
        }

        if (currentOpenLoteIdRef.current !== token) return;
        loadLoteInfo(inlineId, fallbackLote);
        return;
      }

      if (inlineLote?.nombre) {
        const token = `name:${inlineLote.nombre}`;
        currentOpenLoteIdRef.current = token;

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
          if (currentOpenLoteIdRef.current !== token) return;
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
          if (currentOpenLoteIdRef.current !== token) return;
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

  const getGalleryAnchors = useCallback(() => {
    if (typeof window === "undefined") {
      return { expandedTop: 120, midTop: 380, collapsedTop: 0 };
    }
    const vh = window.innerHeight;
    const expandedTop = Math.max(84, vh * 0.14);
    const midTop = vh * 0.48;
    const collapsedTop = vh - 86;
    return {
      expandedTop,
      midTop: Math.min(Math.max(midTop, expandedTop + 90), collapsedTop - 90),
      collapsedTop,
    };
  }, []);

  const getLoteAnchors = useCallback(() => {
    if (typeof window === "undefined") {
      return { expandedTop: 72, midTop: 320, collapsedTop: 0 };
    }
    const vh = window.innerHeight;
    const expandedTop = Math.max(64, vh * 0.1);
    const midTop = vh * 0.42;
    const collapsedTop = vh - 86;
    return {
      expandedTop,
      midTop: Math.min(Math.max(midTop, expandedTop + 110), collapsedTop - 90),
      collapsedTop,
    };
  }, []);

  const clampSheetTop = useCallback((top, anchors) => {
    return Math.min(Math.max(top, anchors.expandedTop), anchors.collapsedTop);
  }, []);

  const getModeByTop = useCallback((top, anchors) => {
    if (top <= anchors.expandedTop + 24) return "expanded";
    if (top >= anchors.collapsedTop - 24) return "collapsed";
    return "mid";
  }, []);

  const setGalleryTopAndMode = useCallback(
    (nextTop) => {
      const anchors = getGalleryAnchors();
      const safeTop = clampSheetTop(nextTop, anchors);
      setGallerySheetTop(safeTop);
      setGallerySheetMode(getModeByTop(safeTop, anchors));
    },
    [clampSheetTop, getGalleryAnchors, getModeByTop],
  );

  const setLoteTopAndMode = useCallback(
    (nextTop) => {
      const anchors = getLoteAnchors();
      const safeTop = clampSheetTop(nextTop, anchors);
      setLoteSheetTop(safeTop);
      setLoteSheetMode(getModeByTop(safeTop, anchors));
    },
    [clampSheetTop, getLoteAnchors, getModeByTop],
  );

  const stepGalleryUp = useCallback(() => {
    const anchors = getGalleryAnchors();
    const currentTop = gallerySheetTop ?? anchors.midTop;
    if (currentTop > anchors.midTop + 12) {
      setGalleryTopAndMode(anchors.midTop);
      return;
    }
    setGalleryTopAndMode(anchors.expandedTop);
  }, [gallerySheetTop, getGalleryAnchors, setGalleryTopAndMode]);

  const stepGalleryDown = useCallback(() => {
    const anchors = getGalleryAnchors();
    const currentTop = gallerySheetTop ?? anchors.midTop;
    if (currentTop < anchors.midTop - 12) {
      setGalleryTopAndMode(anchors.midTop);
      return;
    }
    setGalleryTopAndMode(anchors.collapsedTop);
  }, [gallerySheetTop, getGalleryAnchors, setGalleryTopAndMode]);

  const stepLoteUp = useCallback(() => {
    const anchors = getLoteAnchors();
    const currentTop = loteSheetTop ?? anchors.midTop;
    if (currentTop > anchors.midTop + 12) {
      setLoteTopAndMode(anchors.midTop);
      return;
    }
    setLoteTopAndMode(anchors.expandedTop);
  }, [getLoteAnchors, loteSheetTop, setLoteTopAndMode]);

  const stepLoteDown = useCallback(() => {
    const anchors = getLoteAnchors();
    const currentTop = loteSheetTop ?? anchors.midTop;
    if (currentTop < anchors.midTop - 12) {
      setLoteTopAndMode(anchors.midTop);
      return;
    }
    setLoteTopAndMode(anchors.collapsedTop);
  }, [getLoteAnchors, loteSheetTop, setLoteTopAndMode]);

  const toggleFullscreen = useCallback(async () => {
    const modal = overlayRef.current;
    if (!modal) return;
    if (document.fullscreenElement === modal) {
      await document.exitFullscreen?.();
      return;
    }
    await modal.requestFullscreen?.();
  }, []);

  useEffect(() => {
    if (normalizedImages.length < 2) return;
    const range = GALLERY_PRELOAD_RANGE;
    const indexes = new Set();
    for (let i = 1; i <= range; i += 1) {
      indexes.add((currentIndex + i) % normalizedImages.length);
      indexes.add(
        (currentIndex - i + normalizedImages.length) % normalizedImages.length,
      );
    }
    indexes.forEach((idx) => {
      const src = normalizedImages[idx]?.imagen_original;
      if (
        !src ||
        preloadBlobsRef.current.has(src) ||
        preloadPendingRef.current.has(src)
      )
        return;
      preloadPendingRef.current.add(src);
      warmUpImage(src, 120000).then((blobUrl) => {
        preloadPendingRef.current.delete(src);
        if (blobUrl) addToBlobCache(preloadBlobsRef.current, src, blobUrl);
      });
    });
  }, [currentIndex, normalizedImages]);

  useEffect(
    () => () => {
      preloadBlobsRef.current.forEach((url) => URL.revokeObjectURL(url));
      preloadBlobsRef.current.clear();
      preloadPendingRef.current.clear();
    },
    [],
  );

  useEffect(() => () => window.clearTimeout(travelTimerRef.current), []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === overlayRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isMobileView) {
      setGallerySheetTop(null);
      setLoteSheetTop(null);
      return;
    }
    setGalleryTopAndMode(getGalleryAnchors().midTop);
  }, [currentImageId, getGalleryAnchors, isMobileView, setGalleryTopAndMode]);

  useEffect(() => {
    if (!isMobileView || !selectedLoteId) return;
    setLoteTopAndMode(getLoteAnchors().midTop);
  }, [getLoteAnchors, isMobileView, selectedLoteId, setLoteTopAndMode]);

  useEffect(() => {
    if (!isMobileView) {
      previousGallerySheetStateRef.current = null;
      return;
    }

    if (selectedLoteInfo) {
      if (!previousGallerySheetStateRef.current) {
        const anchors = getGalleryAnchors();
        previousGallerySheetStateRef.current = {
          top: gallerySheetTop ?? anchors.midTop,
        };
      }
      setGalleryTopAndMode(getGalleryAnchors().collapsedTop);
      return;
    }

    if (previousGallerySheetStateRef.current) {
      setGalleryTopAndMode(previousGallerySheetStateRef.current.top);
      previousGallerySheetStateRef.current = null;
    }
  }, [
    gallerySheetTop,
    getGalleryAnchors,
    isMobileView,
    selectedLoteInfo,
    setGalleryTopAndMode,
  ]);

  useEffect(() => {
    setSelectedLoteInfo(null);
    setLoteInfoError("");
  }, [currentImageId]);

  useEffect(
    () => () => {
      hotspotsAbortRef.current?.abort();
      loteInfoAbortRef.current?.abort();
      grafoAbortRef.current?.abort();
    },
    [],
  );

  // Pre-populate the hotspot cache for ALL images in one request instead of N.
  // This eliminates sequential HTTP calls when navigating between panoramas.
  useEffect(() => {
    if (!viewerProjectId) return undefined;
    grafoAbortRef.current?.abort();
    const controller = new AbortController();
    grafoAbortRef.current = controller;

    fetch(buildApiUrl(`/api/get_tour_grafo_completo/${viewerProjectId}/`), {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!Array.isArray(data)) return;
        data.forEach((img) => {
          const key = String(img.id_imagen);
          if (hotspotsCacheRef.current.has(key)) return;
          const normalized = Array.isArray(img.hotspots)
            ? img.hotspots.map((item) => ({
                ...item,
                destino: item.destino
                  ? { ...item.destino, imagen: normalizeUrl(item.destino.imagen) }
                  : null,
              }))
            : [];
          hotspotsCacheRef.current.set(key, normalized);
        });
        // If the current image's hotspots just became available, apply them now.
        if (currentImageId != null) {
          const cached = hotspotsCacheRef.current.get(String(currentImageId));
          if (cached) {
            setHotspots(cached);
            setHotspotsLoading(false);
          }
        }
      })
      .catch(() => null);

    return () => {
      controller.abort();
    };
  }, [viewerProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentImageId) {
      setHotspots([]);
      return undefined;
    }

    const cacheKey = String(currentImageId);
    const cachedHotspots = hotspotsCacheRef.current.get(cacheKey);
    if (cachedHotspots) {
      setHotspots(cachedHotspots);
      setHotspotsLoading(false);
      return undefined;
    }

    let active = true;
    hotspotsAbortRef.current?.abort();
    const controller = new AbortController();
    hotspotsAbortRef.current = controller;
    setHotspotsLoading(true);

    fetch(buildApiUrl(`/api/get_hotspots_por_imagen/${currentImageId}/`), {
      signal: controller.signal,
    })
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
        hotspotsCacheRef.current.set(cacheKey, normalized);
        setHotspots(normalized);
      })
      .catch((error) => {
        if (!active) return;
        if (error?.name === "AbortError") return;
        console.warn("No se pudieron cargar hotspots 360:", error);
        setHotspots([]);
      })
      .finally(() => {
        if (active) setHotspotsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [currentImageId]);

  useEffect(() => {
    openLoteFromMarkerRef.current = openLoteFromMarker;
  }, [openLoteFromMarker]);
  useEffect(() => {
    travelToImageByIdRef.current = travelToImageById;
  }, [travelToImageById]);
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);
  useEffect(() => {
    currentPolygonPointsRef.current = currentPolygonPoints;
  }, [currentPolygonPoints]);
  useEffect(() => {
    annotationModeRef.current = annotationMode;
  }, [annotationMode]);
  useEffect(() => {
    setDrawMode(null);
    currentPolygonPointsRef.current = [];
    setCurrentPolygonPoints([]);
    setPolygonCursorPos(null);
    setAnnotationMode(false);
    annotationModeRef.current = false;
    setPendingAnnotCoords(null);
    setAnnotationLabel("");
    setAnnotationDesc("");
  }, [currentImageId]);

  useEffect(() => {
    if (!containerRef.current || !viewerRuntimeReady) return undefined;

    let active = true;
    let viewerInstance = null;
    let readyFallbackTimer = null;
    setViewerReady(false);
    lastShownSrcRef.current = null;
    setViewerLoadMessage("Cargando imagen 360...");

    const markViewerAsReady = () => {
      if (readyFallbackTimer) {
        window.clearTimeout(readyFallbackTimer);
        readyFallbackTimer = null;
      }
      const root = containerRef.current;
      if (root) {
        root.querySelectorAll("*").forEach((el) => {
          el.style.filter = "none";
          el.style.colorScheme = "dark";
        });
      }
      if (active) setViewerReady(true);
    };

    const initViewer = async () => {
      await waitForNextFrame();
      if (!active || !containerRef.current) return;
      const runtime = viewerRuntimeRef.current || (await loadViewerRuntime());
      if (!active || !runtime) return;

      const firstImage = currentImage;
      const imageKey = String(currentImageId ?? "");
      const initialLayout = currentOverlayBundle?.layouts?.[imageKey];
      const initialYaw = Number(initialLayout?.yaw);
      const initialPitch = Number(initialLayout?.pitch);
      const initialZoom = Number(initialLayout?.zoomLevel);

      const fullKey = firstImage?.imagen_original;
      const thumbKey = firstImage?.imagen;

      // Mostrar inmediatamente: full-res si ya está en caché, si no el thumbnail
      const cachedFull = fullKey ? preloadBlobsRef.current.get(fullKey) : null;
      let firstSrc =
        cachedFull ||
        preloadBlobsRef.current.get(thumbKey) ||
        thumbKey ||
        fullKey;

      const safeZoom = Number.isFinite(initialZoom)
        ? Math.max(40, Math.min(70, initialZoom))
        : 50;

      const viewerOptions = {
        container: containerRef.current,
        panorama: firstSrc,
        caption: firstImage?.nombre,
        adapter: [
          runtime.EquirectangularAdapter,
          { resolution: VIEWER_RESOLUTION, useXmpData: false },
        ],
        defaultZoomLvl: safeZoom,
        defaultPitch: 0,
        moveSpeed: VIEWER_MOVE_SPEED,
        fisheye: false,
        loadingImg: null,
        loadingTxt: "",
        maxFps: 60,
        navbar: ["zoom", "move", "caption"],
        plugins: [[runtime.MarkersPlugin, {}]],
        rendererParameters: {
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
        },
      };

      if (Number.isFinite(initialYaw)) viewerOptions.defaultYaw = initialYaw;

      viewerInstance = new runtime.Viewer(viewerOptions);
      viewerRef.current = viewerInstance;
      lastShownSrcRef.current = firstSrc;

      // Carga full-res en segundo plano y actualiza silenciosamente
      if (!cachedFull && fullKey && fullKey !== firstSrc) {
        warmUpImage(fullKey, 120000).then((blobUrl) => {
          if (!active || !viewerRef.current) return;
          const upgradeSrc = blobUrl || fullKey;
          if (blobUrl) addToBlobCache(preloadBlobsRef.current, fullKey, blobUrl);
          if (lastShownSrcRef.current !== upgradeSrc) {
            viewerRef.current
              .setPanorama(upgradeSrc, { transition: false })
              .then(() => {
                lastShownSrcRef.current = upgradeSrc;
              })
              .catch(() => {});
          }
        });
      }

      const markers = viewerInstance.getPlugin(runtime.MarkersPlugin);
      markers.addEventListener("select-marker", (event) => {
        const marker = event?.marker || event?.detail?.marker;
        const markerData = marker?.data || marker?.config?.data || {};
        if (markerData.type === "lote") {
          openLoteFromMarkerRef.current?.(markerData);
          return;
        }
        const destinoId = markerData.destinoId;
        if (destinoId)
          travelToImageByIdRef.current?.(destinoId, markerData.destinoNombre);
      });

      viewerInstance.addEventListener("ready", markViewerAsReady);
      viewerInstance.addEventListener("panorama-loaded", markViewerAsReady);

      readyFallbackTimer = window.setTimeout(() => {
        if (!active || !containerRef.current) return;
        if (containerRef.current.querySelector("canvas")) {
          markViewerAsReady();
        }
      }, 2500);
    };

    initViewer();

    return () => {
      active = false;
      if (readyFallbackTimer) window.clearTimeout(readyFallbackTimer);
      viewerInstance?.destroy();
      viewerRef.current = null;
      lastShownSrcRef.current = null;
    };
  }, [viewerRuntimeReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady || !currentImage) return;

    const fullKey = currentImage.imagen_original;
    const thumbKey = currentImage.imagen;

    // Mostrar inmediatamente: full-res si está en caché, si no el thumbnail
    const cachedFull = fullKey ? preloadBlobsRef.current.get(fullKey) : null;
    const src =
      cachedFull ||
      preloadBlobsRef.current.get(thumbKey) ||
      thumbKey ||
      fullKey;

    if (!src || src === lastShownSrcRef.current) return;
    lastShownSrcRef.current = src;

    setIsPanoramaLoading(true);

    Promise.resolve(
      viewer.setPanorama(src, {
        caption: currentImage.nombre,
        transition: true,
      }),
    )
      .then(() => {
        setViewerReady(true);
        setIsPanoramaLoading(false);
        // Si mostramos thumbnail, actualizar a full-res en segundo plano
        if (!cachedFull && fullKey && fullKey !== src) {
          warmUpImage(fullKey, 120000).then((blobUrl) => {
            if (!viewerRef.current) return;
            const upgradeSrc = blobUrl || fullKey;
            if (blobUrl) addToBlobCache(preloadBlobsRef.current, fullKey, blobUrl);
            if (lastShownSrcRef.current !== upgradeSrc) {
              viewerRef.current
                .setPanorama(upgradeSrc, { transition: false })
                .then(() => {
                  lastShownSrcRef.current = upgradeSrc;
                })
                .catch(() => {});
            }
          });
        }
      })
      .catch((error) => {
        setIsPanoramaLoading(false);
        console.warn("No se pudo cambiar la vista 360:", error);
        setViewerLoadMessage("No se pudo cargar la imagen 360.");
      });
  }, [currentImage?.imagen_original, viewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    const handlePsvClick = (e) => {
      if (!annotationModeRef.current) return;
      const { yaw, pitch } = e.data;
      if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
      setPendingAnnotCoords({ yaw, pitch });
      setAnnotationLabel("");
      setAnnotationDesc("");
    };
    viewer.addEventListener("click", handlePsvClick);
    return () => {
      viewer.removeEventListener("click", handlePsvClick);
    };
  }, [viewerReady]);

  // Preload prev/next scenes into blob cache for instant transitions
  useEffect(() => {
    if (!normalizedImages.length) return;
    const adjacent = [
      normalizedImages[(currentIndex + 1) % normalizedImages.length],
      normalizedImages[
        (currentIndex - 1 + normalizedImages.length) % normalizedImages.length
      ],
    ];
    adjacent.forEach((img) => {
      const key = img?.imagen_original || img?.imagen;
      if (
        key &&
        !preloadBlobsRef.current.has(key) &&
        !preloadPendingRef.current.has(key)
      ) {
        preloadPendingRef.current.add(key);
        warmUpImage(key, 60000)
          .then((blobUrl) => {
            preloadPendingRef.current.delete(key);
            if (blobUrl) addToBlobCache(preloadBlobsRef.current, key, blobUrl);
          })
          .catch(() => {
            preloadPendingRef.current.delete(key);
          });
      }
    });
  }, [currentIndex, normalizedImages]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    const tick = () => {
      if (drawPanFrameRef.current) {
        window.cancelAnimationFrame(drawPanFrameRef.current);
      }
      drawPanFrameRef.current = window.requestAnimationFrame(() => {
        drawPanFrameRef.current = null;
        setViewerPanTick((n) => n + 1);
      });
    };
    viewer.addEventListener("position-updated", tick);
    viewer.addEventListener("zoom-updated", tick);
    return () => {
      viewer.removeEventListener("position-updated", tick);
      viewer.removeEventListener("zoom-updated", tick);
      if (drawPanFrameRef.current) {
        window.cancelAnimationFrame(drawPanFrameRef.current);
        drawPanFrameRef.current = null;
      }
    };
  }, [viewerReady]);

  const saveLocalAnnotation = useCallback(() => {
    if (!pendingAnnotCoords || !annotationLabel.trim()) return;
    const key = String(currentImageId);
    const newAnn = {
      id: `local-${Date.now()}`,
      yaw: pendingAnnotCoords.yaw,
      pitch: pendingAnnotCoords.pitch,
      label: annotationLabel.trim(),
      description: annotationDesc.trim(),
    };
    setLocalAnnotations((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newAnn],
    }));
    setPendingAnnotCoords(null);
    setAnnotationLabel("");
    setAnnotationDesc("");
  }, [pendingAnnotCoords, annotationLabel, annotationDesc, currentImageId]);

  const removeLocalAnnotation = useCallback(
    (annId) => {
      const key = String(currentImageId);
      setLocalAnnotations((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((a) => a.id !== annId),
      }));
    },
    [currentImageId],
  );

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

    setComputedOverlay(screenOverlayAsAnchored || fallbackOverlay);
  }, [
    viewerReady,
    currentAnchoredOverlay,
    currentOverlayBundle,
    currentImageId,
  ]);

  useEffect(() => {
    if (!viewerReady || !viewerRef.current) return;

    const markers = viewerRef.current.getPlugin(
      viewerRuntimeRef.current?.MarkersPlugin,
    );
    markers.clearMarkers();

    // Don't add new-scene markers until the panorama texture is fully loaded
    if (isPanoramaLoading) return;

    // Render space/drawing overlays as stable PSV polygon markers (synced with WebGL)
    const spaceKey = String(currentImageId ?? "");
    const allSpaceShapesSeen = new Set();
    const allSpaceShapes = [
      ...savedDrawings,
      ...((spaceKey && userDrawings[spaceKey]) || []),
    ].filter((s) => {
      if (!s?.id) return true;
      if (allSpaceShapesSeen.has(s.id)) return false;
      allSpaceShapesSeen.add(s.id);
      return true;
    });
    // Stroke pattern per scenario type — gives each area type a visual texture
    const SPACE_DASH = {
      area: "12 5 2 5",
      parque: "8 3",
      manzana: "none",
      via: "4 3",
      iglesia: "10 4 2 4",
      parquedep: "8 4",
      comercio: "6 3 2 3",
    };
    // Containment-based project contour detection using 2D canvas coords (no spherical wraparound).
    // The project contour is the shape whose 2D polygon contains at least one other shape's centroid.
    const shapesFor2D = allSpaceShapes.filter(
      (s) =>
        s.points &&
        s.points.length >= 3 &&
        s.sphericalPoints &&
        s.sphericalPoints.length >= 3,
    );
    const centroids2D = shapesFor2D.map((s) => ({
      x: s.points.reduce((acc, p) => acc + p.x, 0) / s.points.length,
      y: s.points.reduce((acc, p) => acc + p.y, 0) / s.points.length,
    }));
    const pointInPoly2D = (x, y, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x,
          yi = poly[i].y;
        const xj = poly[j].x,
          yj = poly[j].y;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
      return inside;
    };
    const projectContourIds = new Set(
      shapesFor2D
        .filter((shape, i) =>
          shapesFor2D.some(
            (_, j) =>
              i !== j &&
              pointInPoly2D(centroids2D[j].x, centroids2D[j].y, shape.points),
          ),
        )
        .map((s) => s.id),
    );

    allSpaceShapes.forEach((shape) => {
      if (!shape.sphericalPoints || shape.sphericalPoints.length < 3) return;
      const isProjectContour = projectContourIds.has(shape.id);
      const scenario = getDrawingScenario(shape.scenarioKey);
      const color =
        shape.scenarioColor || (shape.scenarioKey ? scenario.color : "#22c55e");
      const label = shape.label || shape.scenarioLabel || scenario.label;
      const safeLabel = label ? String(label).replace(/</g, "&lt;") : "";
      const dash = SPACE_DASH[shape.scenarioKey] || "none";

      markers.addMarker({
        id: `space-${shape.id}`,
        polygon: shape.sphericalPoints,
        className: `gh-space-marker gh-space-${shape.scenarioKey || "default"}`,
        svgStyle: {
          fill: color,
          fillOpacity: "0.18",
          stroke: color,
          strokeWidth: "2.8px",
          strokeDasharray: dash,
          strokeLinejoin: "round",
          strokeOpacity: "0.88",
        },
        zIndex: 4,
      });

      // Label at polygon centroid — skip for project contour (it's the outer boundary, not a space)
      if (safeLabel && !isProjectContour) {
        const pts = shape.sphericalPoints;
        const n = pts.length;

        // Angular extent check: skip labels for degenerate/invisible areas
        const pitches = pts.map((p) => p.pitch);
        const pitchSpan = Math.max(...pitches) - Math.min(...pitches);
        const yaws = pts.map((p) => p.yaw);
        const yawSpan = Math.max(...yaws) - Math.min(...yaws);
        if (pitchSpan < 0.04 && yawSpan < 0.04) return; // too small to label

        const sinSum = pts.reduce((s, p) => s + Math.sin(p.yaw), 0);
        const cosSum = pts.reduce((s, p) => s + Math.cos(p.yaw), 0);
        const centroid = {
          yaw: Math.atan2(sinSum / n, cosSum / n),
          pitch: pts.reduce((s, p) => s + p.pitch, 0) / n,
        };
        const iconSvg =
          SPACE_LABEL_ICONS[shape.scenarioKey] || SPACE_LABEL_ICONS.area;
        markers.addMarker({
          id: `space-label-${shape.id}`,
          html: `<div class="gh-space-label gh-space-label-${shape.scenarioKey || "default"}">
            <span class="gh-space-label-icon">${iconSvg}</span>
            <span class="gh-space-label-text">${safeLabel}</span>
          </div>`,
          position: centroid,
          anchor: "center center",
          zIndex: 5,
        });
      }
    });

    if (overlayToRender?.visible) {
      const overlayTextureMode = overlayToRender.textureMode ?? "solid";
      const overlayShowShadow = overlayToRender.showShadow !== false;

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
          className: "gh-project-outline-marker",
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

      (overlayToRender.lotPolygons || []).forEach((lote, index) => {
        const hasSpherical = isValidPolygonPixels(lote.polygon);
        const hasPixels = isValidPolygonPixels(lote.polygonPixels);
        if (!hasSpherical && !hasPixels) return;
        const loteId = getLoteId(lote);
        const markerKey = loteId ?? lote.nombre ?? index;
        const isSelected = String(loteId ?? "") === selectedLoteId;
        const status = getLoteStatusMeta(lote.vendido);
        const availableVariant =
          availableLotVariantById[String(loteId ?? `idx-${index}`)] ?? 0;
        markers.addMarker({
          id: `overlay-lote-${currentImageId}-${markerKey}-${index}`,
          ...(hasSpherical
            ? { polygon: lote.polygon }
            : { polygonPixels: lote.polygonPixels }),
          tooltip: {
            content: buildLoteTooltipContent(lote, status),
            className: `gh-lot-tooltip gh-lot-tooltip-${status.key}`,
            trigger: "hover",
          },
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
            overlayOpacity: lote.lotOpacity ?? overlayToRender.lotOpacity,
            loteColor: lote.color,
            availableVariant,
            textureMode: lote.textureMode ?? overlayTextureMode,
            showShadow: overlayShowShadow,
          }),
          zIndex: isSelected ? 9 : 6,
        });
      });
    }

    // Render additional committed overlay instances (multi-import from editor)
    const seenAdditionalIds = new Set();
    const uniqueAdditionalOverlays = currentAdditionalOverlays.filter(
      (inst, idx) => {
        const id = inst?.instanceId ?? idx;
        if (seenAdditionalIds.has(id)) return false;
        seenAdditionalIds.add(id);
        return true;
      },
    );
    uniqueAdditionalOverlays.forEach((instance, instanceIdx) => {
      if (!instance) return;
      const instId = instance.instanceId || instanceIdx;
      const hasSphProj = isValidPolygonPixels(instance.projectPolygon);
      const hasPxProj = isValidPolygonPixels(instance.projectPolygonPixels);
      if (instance.showProjectOutline !== false && (hasSphProj || hasPxProj)) {
        markers.addMarker({
          id: `overlay-project-extra-${currentImageId}-${instId}`,
          ...(hasSphProj
            ? { polygon: instance.projectPolygon }
            : { polygonPixels: instance.projectPolygonPixels }),
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
        const hasSph = isValidPolygonPixels(lote.polygon);
        const hasPx = isValidPolygonPixels(lote.polygonPixels);
        if (!hasSph && !hasPx) return;
        const loteId = getLoteId(lote);
        const mKey = loteId ?? lote.nombre ?? lotIdx;
        const isSelected = String(loteId ?? "") === selectedLoteId;
        const status = getLoteStatusMeta(lote.vendido);
        const availableVariant =
          availableLotVariantById[String(loteId ?? `idx-${lotIdx}`)] ?? 0;
        markers.addMarker({
          id: `overlay-lote-extra-${currentImageId}-${instId}-${mKey}-${lotIdx}`,
          ...(hasSph
            ? { polygon: lote.polygon }
            : { polygonPixels: lote.polygonPixels }),
          tooltip: {
            content: buildLoteTooltipContent(lote, status),
            className: `gh-lot-tooltip gh-lot-tooltip-${status.key}`,
            trigger: "hover",
          },
          className: `gh-portal-lot-marker gh-lot-${status.key} ${isSelected ? "gh-lot-selected" : ""}`,
          data: {
            type: "lote",
            idlote: loteId,
            lote: { ...lote, idlote: loteId },
          },
          svgStyle: getLoteSvgStyle({
            status,
            isSelected,
            overlayOpacity: lote.lotOpacity ?? instance.lotOpacity,
            loteColor: lote.color,
            availableVariant,
            textureMode: lote.textureMode ?? instance.textureMode ?? "solid",
            showShadow: instance.showShadow !== false,
          }),
          zIndex: isSelected ? 9 : 6,
        });
      });
    });

    hotspots.forEach((hotspot) => {
      if (
        !Number.isFinite(Number(hotspot.yaw)) ||
        !Number.isFinite(Number(hotspot.pitch))
      )
        return;

      const destName = (hotspot.destino?.nombre || "Vista conectada").replace(
        /</g,
        "&lt;",
      );
      markers.addMarker({
        id: `hotspot-${hotspot.id}`,
        image: HOTSPOT_ICON,
        size: MARKER_SIZE,
        anchor: "center center",
        position: {
          yaw: Number(hotspot.yaw),
          pitch: Number(hotspot.pitch),
        },
        tooltip: {
          content: `<div class="gh-hotspot-tip">
            <div class="gh-hotspot-tip-icon">
              <img class="gh-hotspot-logo" src="/habitasinfondo.png" alt="GeoHabita" />
            </div>
            <div class="gh-hotspot-tip-body">
              <strong>${destName}</strong>
              <span>Toca para navegar</span>
            </div>
          </div>`,
          className: "gh-hotspot-tooltip-wrap",
          trigger: "hover",
        },
        data: {
          destinoId: hotspot.destino?.id_imagen,
          destinoNombre: hotspot.destino?.nombre,
        },
        className: "gh-portal-hotspot-marker",
      });
    });

    currentImageAnnotations.forEach((ann) => {
      if (
        !Number.isFinite(Number(ann.yaw)) ||
        !Number.isFinite(Number(ann.pitch))
      )
        return;

      const safeLabel = String(ann.label ?? "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const safeDesc = ann.description
        ? String(ann.description).replace(/</g, "&lt;").replace(/>/g, "&gt;")
        : "";
      markers.addMarker({
        id: `ann-${ann.id}`,
        html: `<div class="gh-local-ann-marker"><div class="gh-local-ann-hbar"><span class="gh-local-ann-label">${safeLabel}</span></div><div class="gh-local-ann-vline"></div></div>`,
        size: { width: 180, height: 52 },
        anchor: "bottom center",
        position: { yaw: Number(ann.yaw), pitch: Number(ann.pitch) },
        tooltip: safeDesc
          ? `<strong>${safeLabel}</strong><br><span style="font-size:0.84em;opacity:0.82">${safeDesc}</span>`
          : undefined,
        data: { type: "annotation" },
      });
    });

    const localAnns = localAnnotations[String(currentImageId)] || [];
    localAnns.forEach((ann) => {
      if (!Number.isFinite(ann.yaw) || !Number.isFinite(ann.pitch)) return;
      const label = ann.label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const desc = ann.description
        ? ann.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        : "";
      markers.addMarker({
        id: ann.id,
        html: `<div class="gh-local-ann-marker"><div class="gh-local-ann-hbar"><span class="gh-local-ann-label">${label}</span></div><div class="gh-local-ann-vline"></div></div>`,
        size: { width: 180, height: 52 },
        anchor: "bottom center",
        position: { yaw: ann.yaw, pitch: ann.pitch },
        tooltip: desc
          ? `<strong>${label}</strong><br><span style="font-size:0.84em;opacity:0.82">${desc}</span>`
          : undefined,
        data: { type: "localAnnotation" },
      });
    });
  }, [
    viewerReady,
    isPanoramaLoading,
    hotspots,
    overlayToRender,
    currentAdditionalOverlays,
    currentImageId,
    savedDrawings,
    userDrawings,
    selectedLoteId,
    availableLotVariantById,
    currentImageAnnotations,
    localAnnotations,
  ]);

  // Auto-center the viewer on the selected lot, offset for the sidebar on desktop.
  useEffect(() => {
    if (!viewerReady || !viewerRef.current || !selectedLoteId) return;
    if (lastCenteredLoteRef.current === selectedLoteId) return;
    lastCenteredLoteRef.current = selectedLoteId;

    // Find the selected lot's spherical polygon [[yaw,pitch],...]
    let targetPolygon = null;
    const searchLots = (lotPolygons) => {
      if (!Array.isArray(lotPolygons)) return;
      for (const lote of lotPolygons) {
        if (
          String(getLoteId(lote) ?? "") === selectedLoteId &&
          isValidPolygonPixels(lote.polygon)
        ) {
          targetPolygon = lote.polygon;
          return;
        }
      }
    };
    if (overlayToRender?.lotPolygons) searchLots(overlayToRender.lotPolygons);
    if (!targetPolygon) {
      for (const inst of currentAdditionalOverlays) {
        if (targetPolygon) break;
        searchLots(inst?.lotPolygons);
      }
    }
    if (!targetPolygon) return;

    // Spherical centroid — sin/cos averaging for yaw to handle wraparound
    const n = targetPolygon.length;
    const sinSum = targetPolygon.reduce(
      (s, p) => s + Math.sin(Number(p[0])),
      0,
    );
    const cosSum = targetPolygon.reduce(
      (s, p) => s + Math.cos(Number(p[0])),
      0,
    );
    const pitchSum = targetPolygon.reduce((s, p) => s + Number(p[1]), 0);
    const centroidYaw = Math.atan2(sinSum / n, cosSum / n);
    const centroidPitch = pitchSum / n;

    // On desktop the lot info panel is ~360 px wide on the right side.
    // Shift the camera right by half that width converted to radians so the
    // lot ends up centred in the visible (non-panel) area.
    const viewer = viewerRef.current;
    const containerW = containerRef.current?.clientWidth || 800;
    const containerH = containerRef.current?.clientHeight || window.innerHeight;
    const hFovDeg = viewer?.state?.hFov ?? 90;
    const hFovRad = hFovDeg * (Math.PI / 180);
    const sidebarPx =
      !isMobileView && selectedLoteId ? Math.min(360, containerW - 48) : 0;
    const yawOffset = (sidebarPx / 2) * (hFovRad / containerW);

    // On mobile the lot sheet slides up from the bottom. Tilt the camera
    // downward (negative pitch in PSV's positive-up convention) so the lot
    // appears in the center of the visible map area above the sheet instead
    // of the full-viewport center.
    let pitchOffset = 0;
    if (isMobileView) {
      const sheetTop = getLoteAnchors().midTop;
      const vFovRad =
        2 * Math.atan(Math.tan(hFovRad / 2) * (containerH / containerW));
      // (containerH/2 - sheetTop/2) is the pixel distance from viewport center
      // to visible-area center. Dividing by containerH gives a fraction of vFov.
      pitchOffset =
        ((containerH / 2 - sheetTop / 2) / containerH) * vFovRad;
    }

    currentCenteringAnimationRef.current?.cancel?.();
    const animation = viewer.animate({
      yaw: centroidYaw + yawOffset,
      // Subtract: PSV pitch is positive-upward, so reducing pitch tilts the
      // camera downward, which raises the lot into the visible area above the sheet.
      pitch: centroidPitch - pitchOffset,
      speed: "4rpm",
    });
    currentCenteringAnimationRef.current = animation ?? null;
    animation?.catch?.(() => {});
  }, [
    selectedLoteId,
    viewerReady,
    overlayToRender,
    currentAdditionalOverlays,
    isMobileView,
    getLoteAnchors,
  ]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const layer = lotLabelsLayerRef.current;
    if (!viewerReady || !viewer || !layer) return undefined;

    const hideLabels = () => {
      lotLabelGroupRefs.current.forEach((group) => {
        group.setAttribute("display", "none");
      });
    };

    const updateLabels = () => {
      lotLabelsFrameRef.current = null;
      if (lotLabelsZoomingRef.current) {
        hideLabels();
        return;
      }

      const viewportWidth = viewer?.state?.size?.width || 0;
      const viewportHeight = viewer?.state?.size?.height || 0;
      const zoomLevel =
        typeof viewer.getZoomLevel === "function"
          ? Number(viewer.getZoomLevel())
          : Number(viewer?.state?.zoomLevel || 0);

      lotLabelsData.forEach((label) => {
        const group = lotLabelGroupRefs.current.get(label.id);
        const titleNode = lotLabelTitleRefs.current.get(label.id);
        const areaNode = lotLabelAreaRefs.current.get(label.id);
        const blockNode = lotLabelBlockRefs.current.get(label.id);
        if (!group || !titleNode) return;

        if (zoomLevel < LOT_LABEL_MIN_ZOOM && !label.isSelected) {
          group.setAttribute("display", "none");
          return;
        }

        const projectedPolygon = label.polygonPixels
          .map((point) => {
            const polygonSpherical =
              viewer.dataHelper.textureCoordsToSphericalCoords({
                textureX: Number(point[0]),
                textureY: Number(point[1]),
              });
            return viewer.dataHelper.sphericalCoordsToViewerCoords(
              polygonSpherical,
            );
          })
          .filter(
            (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y),
          );

        if (projectedPolygon.length < 3) {
          group.setAttribute("display", "none");
          return;
        }

        const bounds = projectedPolygon.reduce(
          (acc, point) => {
            acc.minX = Math.min(acc.minX, point.x);
            acc.maxX = Math.max(acc.maxX, point.x);
            acc.minY = Math.min(acc.minY, point.y);
            acc.maxY = Math.max(acc.maxY, point.y);
            return acc;
          },
          {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
          },
        );

        const projectedWidth = bounds.maxX - bounds.minX;
        const projectedHeight = bounds.maxY - bounds.minY;
        const projectedArea = computeScreenPolygonArea(projectedPolygon);
        const titleLength = Math.max(
          3,
          label.labelLines.number.length,
          label.labelLines.block.length,
          label.labelLines.area.length,
        );
        const isInViewport =
          bounds.maxX >= 0 &&
          bounds.maxY >= 0 &&
          bounds.minX <= viewportWidth &&
          bounds.minY <= viewportHeight;

        if (
          !isInViewport ||
          projectedWidth < 10 ||
          projectedHeight < 8 ||
          projectedArea < 40
        ) {
          group.setAttribute("display", "none");
          return;
        }

        const polygonAsArrays = projectedPolygon.map((point) => [
          point.x,
          point.y,
        ]);
        const anchor = computePolygonLabelAnchor(polygonAsArrays);
        const safeRadius = getDistanceToPolygonEdges(anchor, polygonAsArrays);
        const rawAngle = computeLongestEdgeAngle(projectedPolygon);
        const angle = rawAngle;
        const canShowArea = !!label.labelLines.area;
        const canShowBlock = !!label.labelLines.block;
        const lineCount = 1 + Number(canShowArea) + Number(canShowBlock);
        const titleFontSize = clamp(
          Math.min(
            projectedWidth / (titleLength * 0.84),
            projectedHeight /
              (lineCount === 3 ? 4.65 : lineCount === 2 ? 3.6 : 2.45),
            Math.sqrt(projectedArea) * 0.07,
            safeRadius * 0.46,
          ),
          4.6,
          label.isSelected ? 15 : 13,
        );
        const areaFontSize = Math.max(4.1, titleFontSize * 0.3);
        const blockFontSize = Math.max(4.1, titleFontSize * 0.26);
        const opacity = label.isSelected
          ? 1
          : clamp(projectedArea / 2400, 0.82, 1);
        group.setAttribute("display", "inline");
        group.setAttribute("opacity", String(opacity));
        group.setAttribute(
          "transform",
          `translate(${anchor.x} ${anchor.y}) rotate(${angle})`,
        );
        group.setAttribute(
          "class",
          label.isSelected ? styles.lotLabelSelected : styles.lotLabel,
        );

        titleNode.setAttribute("font-size", String(titleFontSize));
        titleNode.setAttribute(
          "y",
          lineCount === 3
            ? String(-titleFontSize * 0.64)
            : lineCount === 2
              ? "-1.5"
              : "0",
        );

        if (areaNode) {
          areaNode.setAttribute("font-size", String(areaFontSize));
          areaNode.setAttribute(
            "y",
            lineCount === 3
              ? String(titleFontSize * 0.1)
              : String(titleFontSize * 0.68),
          );
          areaNode.textContent = canShowArea ? label.labelLines.area || "" : "";
          areaNode.setAttribute("display", canShowArea ? "inline" : "none");
        }

        if (blockNode) {
          blockNode.setAttribute("font-size", String(blockFontSize));
          blockNode.setAttribute("y", String(titleFontSize * 0.96));
          blockNode.textContent = canShowBlock
            ? label.labelLines.block || ""
            : "";
          blockNode.setAttribute("display", canShowBlock ? "inline" : "none");
        }
      });
    };

    const scheduleLabelsUpdate = () => {
      if (lotLabelsFrameRef.current) return;
      lotLabelsFrameRef.current = window.requestAnimationFrame(updateLabels);
    };

    const scheduleLabelsAfterZoom = () => {
      lotLabelsZoomingRef.current = true;
      hideLabels();
      window.clearTimeout(lotLabelsZoomTimerRef.current);
      lotLabelsZoomTimerRef.current = window.setTimeout(() => {
        lotLabelsZoomingRef.current = false;
        scheduleLabelsUpdate();
      }, 140);
    };

    scheduleLabelsUpdate();
    viewer.addEventListener("render", scheduleLabelsUpdate);
    viewer.addEventListener("position-updated", scheduleLabelsUpdate);
    viewer.addEventListener("zoom-updated", scheduleLabelsAfterZoom);
    viewer.addEventListener("size-updated", scheduleLabelsUpdate);
    window.addEventListener("resize", scheduleLabelsUpdate);

    return () => {
      if (lotLabelsFrameRef.current) {
        window.cancelAnimationFrame(lotLabelsFrameRef.current);
        lotLabelsFrameRef.current = null;
      }
      window.clearTimeout(lotLabelsZoomTimerRef.current);
      lotLabelsZoomingRef.current = false;
      viewer.removeEventListener("render", scheduleLabelsUpdate);
      viewer.removeEventListener("position-updated", scheduleLabelsUpdate);
      viewer.removeEventListener("zoom-updated", scheduleLabelsAfterZoom);
      viewer.removeEventListener("size-updated", scheduleLabelsUpdate);
      window.removeEventListener("resize", scheduleLabelsUpdate);
    };
  }, [lotLabelsData, viewerReady]);

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
      const hudTargets =
        overlayRef.current?.querySelectorAll(".viewer-hud-enter");
      if (hudTargets?.length) {
        gsap.fromTo(
          hudTargets,
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
      }

      const panelTargets = overlayRef.current?.querySelectorAll(
        ".viewer-panel-enter",
      );
      if (panelTargets?.length) {
        gsap.fromTo(
          panelTargets,
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
      }
    }, overlayRef);
    return () => ctx.revert();
  }, [currentImageId]);

  useGSAP(
    () => {
      if (!loteDrawerRef.current || !selectedLoteId) return;
      const hero = loteDrawerRef.current.querySelector("[data-lote-hero]");
      const cards = loteDrawerRef.current.querySelectorAll(
        "[data-lote-card], [data-lote-action]",
      );
      const tl = gsap.timeline({
        defaults: { ease: "expo.out", overwrite: "auto" },
      });

      tl.fromTo(
        loteDrawerRef.current,
        {
          autoAlpha: 0,
          x: isMobileView ? 0 : 34,
          y: isMobileView ? 34 : 0,
          scale: 0.985,
        },
        { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.58 },
      );

      if (hero) {
        tl.fromTo(
          hero,
          { autoAlpha: 0, y: 24, scale: 0.96 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 },
          "-=0.34",
        );
      }

      if (cards.length) {
        tl.fromTo(
          cards,
          { autoAlpha: 0, y: 26, scale: 0.94 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.48,
            stagger: 0.06,
          },
          "-=0.28",
        );
      }
    },
    {
      scope: loteDrawerRef,
      dependencies: [selectedLoteId, isMobileView],
      revertOnUpdate: true,
    },
  );

  const shareProjectId = useMemo(() => {
    for (const img of normalizedImages) {
      const id = getProjectId(img);
      if (id) return String(id);
    }
    return null;
  }, [normalizedImages]);

  const handleShare = useCallback(() => {
    if (!shareProjectId) return;
    const url = `${window.location.origin}/visor360/${shareProjectId}`;
    if (navigator.share) {
      navigator
        .share({ title: projectName || "Vista 360°", url })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2000);
        })
        .catch(() => {});
    }
  }, [shareProjectId, projectName]);

  if (!normalizedImages.length) return null;
  const selectedLoteStatus = selectedLote
    ? getLoteStatusMeta(selectedLote.vendido)
    : null;

  const onGallerySheetTouchStart = (e) => {
    if (!isMobileView) return;
    galleryTouchStartY.current = e.targetTouches[0].clientY;
    galleryTouchDeltaY.current = 0;
    galleryTouchStartTop.current =
      gallerySheetTop ?? getGalleryAnchors().midTop;
    setIsGalleryDragging(true);
    e.stopPropagation();
  };

  const onGallerySheetTouchMove = (e) => {
    if (!isMobileView || !galleryTouchStartY.current) return;
    galleryTouchDeltaY.current =
      e.targetTouches[0].clientY - galleryTouchStartY.current;
    setGalleryTopAndMode(
      galleryTouchStartTop.current + galleryTouchDeltaY.current,
    );
    e.preventDefault();
    e.stopPropagation();
  };

  const onGallerySheetTouchEnd = () => {
    if (!isMobileView) return;
    if (gallerySheetTop !== null) {
      setGallerySheetMode(getModeByTop(gallerySheetTop, getGalleryAnchors()));
    }
    setIsGalleryDragging(false);
    galleryTouchStartY.current = 0;
    galleryTouchDeltaY.current = 0;
    galleryTouchStartTop.current = 0;
  };

  const onGalleryNestedTouchStart = (e) => {
    if (!isMobileView) return;
    galleryNestedTouchStartY.current = e.targetTouches[0].clientY;
    galleryNestedTouchDeltaY.current = 0;
    const contentEl = sideGalleryBodyRef.current;
    const sheetEl = sideGalleryRef.current;
    const contentScrollable =
      !!contentEl && contentEl.scrollHeight > contentEl.clientHeight + 2;
    galleryNestedScrollableTarget.current = contentScrollable
      ? contentEl
      : sheetEl;
    e.stopPropagation();
  };

  const onGalleryNestedTouchMove = (e) => {
    if (!isMobileView || !galleryNestedTouchStartY.current) return;
    galleryNestedTouchDeltaY.current =
      e.targetTouches[0].clientY - galleryNestedTouchStartY.current;
    const scrollEl = galleryNestedScrollableTarget.current;
    const atTop = (scrollEl?.scrollTop || 0) <= 0;
    const atBottom =
      !!scrollEl &&
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
    const sheetAtTop = (sideGalleryRef.current?.scrollTop || 0) <= 0;

    if (galleryNestedTouchDeltaY.current > 0 && atTop && sheetAtTop) {
      e.preventDefault();
    }
    if (galleryNestedTouchDeltaY.current < 0 && atBottom) {
      e.preventDefault();
    }
  };

  const onGalleryNestedTouchEnd = () => {
    if (!isMobileView) return;
    const scrollEl = galleryNestedScrollableTarget.current;
    const atTop = (scrollEl?.scrollTop || 0) <= 0;
    const atBottom =
      !!scrollEl &&
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
    const sheetAtTop = (sideGalleryRef.current?.scrollTop || 0) <= 0;

    if (galleryNestedTouchDeltaY.current > 50 && atTop && sheetAtTop) {
      stepGalleryDown();
    }
    if (galleryNestedTouchDeltaY.current < -40 && atBottom) {
      stepGalleryUp();
    }

    galleryNestedTouchStartY.current = 0;
    galleryNestedTouchDeltaY.current = 0;
    galleryNestedScrollableTarget.current = null;
  };

  const onLoteSheetTouchStart = (e) => {
    if (!isMobileView) return;
    loteTouchStartY.current = e.targetTouches[0].clientY;
    loteTouchDeltaY.current = 0;
    loteTouchStartTop.current = loteSheetTop ?? getLoteAnchors().midTop;
    setIsLoteSheetDragging(true);
    e.stopPropagation();
  };

  const onLoteSheetTouchMove = (e) => {
    if (!isMobileView || !loteTouchStartY.current) return;
    loteTouchDeltaY.current =
      e.targetTouches[0].clientY - loteTouchStartY.current;
    setLoteTopAndMode(loteTouchStartTop.current + loteTouchDeltaY.current);
    e.preventDefault();
    e.stopPropagation();
  };

  const onLoteSheetTouchEnd = () => {
    if (!isMobileView) return;
    if (loteSheetTop !== null) {
      setLoteSheetMode(getModeByTop(loteSheetTop, getLoteAnchors()));
    }
    setIsLoteSheetDragging(false);
    loteTouchStartY.current = 0;
    loteTouchDeltaY.current = 0;
    loteTouchStartTop.current = 0;
  };

  const onLoteNestedTouchStart = (e) => {
    if (!isMobileView) return;
    loteNestedTouchStartY.current = e.targetTouches[0].clientY;
    loteNestedTouchDeltaY.current = 0;
    const contentEl = loteDrawerBodyRef.current;
    const sheetEl = loteDrawerRef.current;
    const contentScrollable =
      !!contentEl && contentEl.scrollHeight > contentEl.clientHeight + 2;
    loteNestedScrollableTarget.current = contentScrollable
      ? contentEl
      : sheetEl;
    e.stopPropagation();
  };

  const onLoteNestedTouchMove = (e) => {
    if (!isMobileView || !loteNestedTouchStartY.current) return;
    loteNestedTouchDeltaY.current =
      e.targetTouches[0].clientY - loteNestedTouchStartY.current;
    const scrollEl = loteNestedScrollableTarget.current;
    const atTop = (scrollEl?.scrollTop || 0) <= 0;
    const atBottom =
      !!scrollEl &&
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
    const sheetAtTop = (loteDrawerRef.current?.scrollTop || 0) <= 0;

    if (loteNestedTouchDeltaY.current > 0 && atTop && sheetAtTop) {
      e.preventDefault();
    }
    if (loteNestedTouchDeltaY.current < 0 && atBottom) {
      e.preventDefault();
    }
  };

  const onLoteNestedTouchEnd = () => {
    if (!isMobileView) return;
    const scrollEl = loteNestedScrollableTarget.current;
    const atTop = (scrollEl?.scrollTop || 0) <= 0;
    const atBottom =
      !!scrollEl &&
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
    const sheetAtTop = (loteDrawerRef.current?.scrollTop || 0) <= 0;

    if (loteNestedTouchDeltaY.current > 50 && atTop && sheetAtTop) {
      stepLoteDown();
    }
    if (loteNestedTouchDeltaY.current < -40 && atBottom) {
      stepLoteUp();
    }

    loteNestedTouchStartY.current = 0;
    loteNestedTouchDeltaY.current = 0;
    loteNestedScrollableTarget.current = null;
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
    if (pts.length < 3 || !currentImageId) return;
    const key = String(currentImageId);
    setUserDrawings((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] || []),
        {
          id: `draw-${crypto.randomUUID()}`,
          type: "polygon",
          points: [...pts],
          depth: 0,
          strokeWidth: 4,
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
    if (!currentImageId) return;
    const key = String(currentImageId);
    setUserDrawings((prev) => {
      const list = prev[key] || [];
      if (!list.length) return prev;
      return { ...prev, [key]: list.slice(0, -1) };
    });
  };

  const clearAllDrawings = () => {
    if (!currentImageId) return;
    currentPolygonPointsRef.current = [];
    setCurrentPolygonPoints([]);
    setPolygonCursorPos(null);
    setUserDrawings((prev) => ({ ...prev, [String(currentImageId)]: [] }));
  };

  const setShapeDepth = (shapeId, depth) => {
    if (!currentImageId) return;
    const key = String(currentImageId);
    setUserDrawings((prev) => ({
      ...prev,
      [key]: (prev[key] || []).map((s) =>
        s.id === shapeId ? { ...s, depth } : s,
      ),
    }));
  };

  const setShapeStroke = (shapeId, strokeWidth) => {
    if (!currentImageId) return;
    const key = String(currentImageId);
    setUserDrawings((prev) => ({
      ...prev,
      [key]: (prev[key] || []).map((s) =>
        s.id === shapeId ? { ...s, strokeWidth } : s,
      ),
    }));
  };

  const toP = (v) => `${(v * 100).toFixed(3)}%`;

  const drawSegment = (
    x1,
    y1,
    x2,
    y2,
    sw,
    shadowW,
    dash,
    key,
    color = "white",
  ) => (
    <g key={key}>
      <line
        x1={toP(x1)}
        y1={toP(y1)}
        x2={toP(x2)}
        y2={toP(y2)}
        stroke="rgba(0,0,0,0.65)"
        strokeWidth={shadowW}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      <line
        x1={toP(x1)}
        y1={toP(y1)}
        x2={toP(x2)}
        y2={toP(y2)}
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </g>
  );

  const renderCompletedShape = (shape) => {
    if (!shape.points || shape.points.length < 2) return null;
    let pts = shape.points;
    if (shape.sphericalPoints?.length >= 3) {
      const viewer = viewerRef.current;
      const el = drawOverlayRef.current;
      if (viewer && el && el.clientWidth && el.clientHeight) {
        const camPos = viewer.getPosition();
        const camYaw = camPos?.yaw ?? 0;
        const camPitch = camPos?.pitch ?? 0;
        // Camera direction unit vector (spherical → Cartesian)
        const cx = Math.cos(camPitch) * Math.sin(camYaw);
        const cy = Math.sin(camPitch);
        const cz = Math.cos(camPitch) * Math.cos(camYaw);

        const projected = shape.sphericalPoints.map(({ yaw, pitch }) => {
          try {
            // Hemisphere check: dot product > 0 means point is in front of camera
            const px = Math.cos(pitch) * Math.sin(yaw);
            const py = Math.sin(pitch);
            const pz = Math.cos(pitch) * Math.cos(yaw);
            if (px * cx + py * cy + pz * cz <= 0.04) return null; // behind camera

            const pos = viewer.dataHelper.sphericalCoordsToViewerCoords({
              yaw,
              pitch,
            });
            if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y))
              return null;
            const nx = pos.x / el.clientWidth;
            const ny = pos.y / el.clientHeight;
            if (nx < -0.5 || nx > 1.5 || ny < -0.5 || ny > 1.5) return null;
            return { x: nx, y: ny };
          } catch {
            return null;
          }
        });
        // Render partial polygon: need at least 3 valid vertices
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
      shape.label ||
      shape.scenarioLabel ||
      (shape.scenarioKey ? scenario.label : "");
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
    {
      let maxLen = 0;
      for (let i = 0; i < pxPts.length; i++) {
        const a = pxPts[i];
        const b = pxPts[(i + 1) % pxPts.length];
        const dx2 = b.x - a.x;
        const dy2 = b.y - a.y;
        const len = Math.hypot(dx2, dy2);
        if (len > maxLen) {
          maxLen = len;
          polyAngle = (Math.atan2(dy2, dx2) * 180) / Math.PI;
        }
      }
    }
    // Dimensiones en el marco local rotado del polígono
    const rad = (-polyAngle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const local = pxPts.map((p) => ({
      x: (p.x - lx) * cosA - (p.y - ly) * sinA,
      y: (p.x - lx) * sinA + (p.y - ly) * cosA,
    }));
    const localXs = local.map((p) => p.x);
    const localYs = local.map((p) => p.y);
    const localW = Math.max(...localXs) - Math.min(...localXs);
    const localH = Math.max(...localYs) - Math.min(...localYs);

    const courtIcon = renderCourtIcon(
      shape.scenarioKey,
      lx,
      ly,
      localW,
      localH,
      polyAngle,
    );
    const hideLabel = shape.scenarioKey === "area" && !shape.label?.trim();
    const labelY = courtIcon ? ly - localH * 0.28 : ly;
    const hasLabelIcon = shape.scenarioKey !== "area";
    const pillW = Math.max(
      68,
      displayScenarioLabel.length * 8.5 + (hasLabelIcon ? 50 : 22),
    );
    const pillH = 28;
    const pillHalf = pillW / 2;
    const labelIconX = -pillHalf + 9;
    const labelTextX = hasLabelIcon ? -pillHalf + 34 : 0;

    const pxPoints = pxPts.map((p) => `${p.x},${p.y}`).join(" ");

    return (
      <g key={shape.id}>
        {/* Sombra base solo cuando hay etiqueta visible */}
        {shape.showShadow && !hideLabel && (
          <polygon points={pxPoints} fill="rgba(0,0,0,0.22)" stroke="none" />
        )}
        {depth > 0 &&
          pts.map((p, i) => {
            const next = pts[(i + 1) % n];
            const bx = p.x + dx;
            const by = p.y + dy;
            const bnx = next.x + dx;
            const bny = next.y + dy;
            return (
              <g key={`back-${i}`}>
                {drawSegment(
                  bx,
                  by,
                  bnx,
                  bny,
                  sw - 1,
                  shadowW - 1,
                  undefined,
                  `bl-${i}`,
                  scenarioColor,
                )}
                {drawSegment(
                  p.x,
                  p.y,
                  bx,
                  by,
                  Math.max(1, sw - 2),
                  shadowW - 2,
                  "5 3",
                  `ed-${i}`,
                  scenarioColor,
                )}
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
              x={-pillHalf + 2}
              y={-pillH / 2 + 3}
              width={pillW}
              height={pillH}
              rx={pillH / 2}
              ry={pillH / 2}
              fill="rgba(0,0,0,0.30)"
            />
            {/* Pastilla principal */}
            <rect
              x={-pillHalf}
              y={-pillH / 2}
              width={pillW}
              height={pillH}
              rx={pillH / 2}
              ry={pillH / 2}
              fill="rgba(10,14,26,0.78)"
              stroke={scenarioColor}
              strokeWidth="1.5"
              strokeOpacity="0.70"
            />
            {hasLabelIcon && (
              <ScenarioIcon
                x={labelIconX}
                y={-10}
                width={20}
                height={20}
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
        {pts
          .slice(0, -1)
          .map((p, i) =>
            drawSegment(
              p.x,
              p.y,
              pts[i + 1].x,
              pts[i + 1].y,
              2.5,
              5,
              "8 5",
              `seg-${i}`,
            ),
          )}
        {cursorPos &&
          drawSegment(
            last.x,
            last.y,
            cursorPos.x,
            cursorPos.y,
            1.5,
            3.5,
            "5 4",
            "preview",
          )}
        {isNearFirst &&
          drawSegment(
            cursorPos.x,
            cursorPos.y,
            pts[0].x,
            pts[0].y,
            2,
            3.5,
            "4 3",
            "close-preview",
          )}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={toP(p.x)}
            cy={toP(p.y)}
            r={i === 0 && isNearFirst ? 10 : 7}
            fill={
              i === 0
                ? isNearFirst
                  ? "rgba(80,230,120,0.95)"
                  : "white"
                : "white"
            }
            stroke={
              i === 0
                ? isNearFirst
                  ? "rgba(0,130,60,0.9)"
                  : "rgba(0,0,0,0.65)"
                : "rgba(0,0,0,0.65)"
            }
            strokeWidth="2.5"
          />
        ))}
      </g>
    );
  };

  const renderDrawingOverlay = () => {
    const key = String(currentImageId ?? "");
    const imgDrawings = (key && userDrawings[key]) || [];
    // Shapes with sphericalPoints are rendered as stable PSV polygon markers; skip them here
    const allShapes = [...savedDrawings, ...imgDrawings].filter(
      (s) => !s.sphericalPoints || s.sphericalPoints.length < 3,
    );
    if (!drawMode && !allShapes.length && !currentPolygonPoints.length)
      return null;
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
          data-tick={viewerPanTick}
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {allShapes.map((shape) => renderCompletedShape(shape))}
          {isActive &&
            renderInProgressPolygon(currentPolygonPoints, polygonCursorPos)}
        </svg>
      </div>
    );
  };

  const mobileWatermarkTop = isMobileView
    ? Math.max(
        12,
        Number(
          selectedLoteInfo && loteSheetTop !== null
            ? loteSheetTop
            : (gallerySheetTop ?? 0),
        ) - 42,
      )
    : 0;


  return (
    <div
      className={`${styles.overlay360} ${isSidebarCollapsed ? styles.overlay360Collapsed : ""}`}
      ref={overlayRef}
      data-theme="dark"
    >
      {isMobileView && (
        <div
          className={styles.mobileFloatingWatermark}
          style={{ top: `${mobileWatermarkTop}px` }}
        >
          <img src="/habitasinfondo.png" alt="GeoHabita" />
          <span>GeoHabita</span>
        </div>
      )}
      <div className={styles.mainContent}>
        <div className={`${styles.header360} viewer-hud-enter`}>
          <div className={styles.titleGroup}>
            {!isMobileView && (
              <div className={styles.badge360}>
                <CheckCircle2 size={13} />
                <span>GeoHabita 360°</span>
              </div>
            )}
            <h3 className={styles.imageTitle}>{projectName}</h3>
            {lotesSummary.total > 0 && (
              <div className={styles.headerStats}>
                <div className={styles.brandStat}>
                  <span className={styles.statValue}>{lotesSummary.total}</span>
                  <span className={styles.statLabel}>Total</span>
                </div>
                <div className={styles.brandStat}>
                  <span
                    className={styles.statValue}
                    style={{ color: "#22c55e" }}
                  >
                    {lotesSummary.available}
                  </span>
                  <span className={styles.statLabel}>Disponibles</span>
                </div>
                {lotesSummary.reserved > 0 && (
                  <div className={styles.brandStat}>
                    <span
                      className={styles.statValue}
                      style={{ color: "#f59e0b" }}
                    >
                      {lotesSummary.reserved}
                    </span>
                    <span className={styles.statLabel}>Reservados</span>
                  </div>
                )}
                {lotesSummary.sold > 0 && (
                  <div className={styles.brandStat}>
                    <span
                      className={styles.statValue}
                      style={{ color: "#ef4444" }}
                    >
                      {lotesSummary.sold}
                    </span>
                    <span className={styles.statLabel}>Vendidos</span>
                  </div>
                )}
              </div>
            )}
            {!isMobileView && normalizedImages.length > 1 && (
              <div className={styles.headerMeta}>
                <span className={styles.headerMetaPill}>
                  {normalizedImages.length} escenas 360°
                </span>
              </div>
            )}
          </div>
          <div className={styles.headerActions}>
            {shareProjectId && (
              <button
                type="button"
                onClick={handleShare}
                className={styles.iconBtn}
                title={
                  shareCopied ? "¡Enlace copiado!" : "Compartir vista 360°"
                }
              >
                {shareCopied ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Share2 size={18} />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={styles.iconBtn}
              title={
                isFullscreen
                  ? "Salir de pantalla completa"
                  : "Pantalla completa"
              }
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={styles.iconBtnClose}
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.viewerWrapper}>
          {!viewerReady && (
            <div className={styles.loading360}>{viewerLoadMessage}</div>
          )}
          <div className={styles.viewerContainer} ref={containerRef} />
          {LOT_LABELS_ENABLED && (
            <div className={styles.lotLabelsLayer} ref={lotLabelsLayerRef}>
              <svg className={styles.lotLabelsSvg} aria-hidden="true">
                {lotLabelsData.map((label) => (
                  <g
                    key={label.id}
                    ref={(node) => {
                      if (node) {
                        lotLabelGroupRefs.current.set(label.id, node);
                      } else {
                        lotLabelGroupRefs.current.delete(label.id);
                      }
                    }}
                    opacity="0"
                    display="none"
                    className={
                      label.isSelected
                        ? styles.lotLabelSelected
                        : styles.lotLabel
                    }
                  >
                    <text
                      ref={(node) => {
                        if (node) {
                          lotLabelTitleRefs.current.set(label.id, node);
                        } else {
                          lotLabelTitleRefs.current.delete(label.id);
                        }
                      }}
                      className={styles.lotLabelTitle}
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {label.labelLines.number}
                    </text>
                    <text
                      ref={(node) => {
                        if (node) {
                          lotLabelAreaRefs.current.set(label.id, node);
                        } else {
                          lotLabelAreaRefs.current.delete(label.id);
                        }
                      }}
                      className={styles.lotLabelArea}
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      display={label.labelLines.area ? "inline" : "none"}
                    >
                      {label.labelLines.area || ""}
                    </text>
                    <text
                      ref={(node) => {
                        if (node) {
                          lotLabelBlockRefs.current.set(label.id, node);
                        } else {
                          lotLabelBlockRefs.current.delete(label.id);
                        }
                      }}
                      className={styles.lotLabelBlock}
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      display={label.labelLines.block ? "inline" : "none"}
                    >
                      {label.labelLines.block || ""}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
          <div className={`${styles.viewerHud} viewer-hud-enter`}>
            <div className={styles.viewerWatermark}>
              <img src="/habitasinfondo.png" alt="GeoHabita" />
              <span>GeoHabita</span>
            </div>
          </div>

          {((isPanoramaLoading && viewerReady) || !!travelingTo) && (
            <div className={styles.panoLoader}>
              {/* Aerial subdivision map background — inspired by GeoHabitaLoader */}
              <div className={styles.panoLoaderMap}>
                {PANO_ZONES.map(([t, l, w, h], i) => (
                  <div
                    key={`z-${i}`}
                    className={styles.panoLoaderZone}
                    style={{
                      top: `${t}%`,
                      left: `${l}%`,
                      width: `${w}%`,
                      height: `${h}%`,
                    }}
                  />
                ))}
                {PANO_ROADS.map((road, i) => (
                  <div
                    key={`road-${i}`}
                    className={styles.panoLoaderRoad}
                    style={{
                      left: `${road.x}%`,
                      top: `${road.y}%`,
                      width: `${road.w}%`,
                      height: `${road.h}%`,
                    }}
                  />
                ))}
                {PANO_LOTS.map(([t, l, w, h, d], i) => (
                  <div
                    key={`lot-${i}`}
                    className={styles.panoLoaderLotCell}
                    style={{
                      top: `${t}%`,
                      left: `${l}%`,
                      width: `${w}%`,
                      height: `${h}%`,
                      animationDelay: `${d}s, ${d + 1.4}s`,
                    }}
                  />
                ))}
                <div className={styles.panoLoaderBeam} />
              </div>
              {/* Central spinner + branding */}
              <div className={styles.panoLoaderCore}>
                <div className={styles.panoLoaderRing}>
                  <div className={styles.panoLoaderLogo}>
                    <img src="/habitasinfondo.png" alt="GeoHabita" />
                  </div>
                </div>
                <div className={styles.panoLoaderBrand}>
                  <span className={styles.panoLoaderBrandName}>
                    Geo<em>Habita</em>
                  </span>
                  <span className={styles.panoLoaderBrand360}>360°</span>
                </div>
                <p className={styles.panoLoaderText}>
                  {travelingTo
                    ? `Navegando a ${travelingTo}`
                    : "Cargando vista"}
                </p>
              </div>
            </div>
          )}

          {normalizedImages.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.navBtn} ${styles.prev}`}
                onClick={prevImage}
                title={
                  normalizedImages[
                    (currentIndex - 1 + normalizedImages.length) %
                      normalizedImages.length
                  ]?.nombre || "Anterior"
                }
              >
                <ChevronLeft size={22} />
                <span className={styles.navBtnLabel}>
                  {normalizedImages[
                    (currentIndex - 1 + normalizedImages.length) %
                      normalizedImages.length
                  ]?.nombre || "Anterior"}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.navBtn} ${styles.next}`}
                onClick={nextImage}
                title={
                  normalizedImages[(currentIndex + 1) % normalizedImages.length]
                    ?.nombre || "Siguiente"
                }
              >
                <span className={styles.navBtnLabel}>
                  {normalizedImages[
                    (currentIndex + 1) % normalizedImages.length
                  ]?.nombre || "Siguiente"}
                </span>
                <ChevronRight size={22} />
              </button>
            </>
          )}
          {normalizedImages.length > 1 && (
            <div className={styles.tourDots}>
              {normalizedImages.map((img, idx) => (
                <button
                  key={getImageId(img) || idx}
                  type="button"
                  className={`${styles.tourDot} ${idx === currentIndex ? styles.tourDotActive : ""}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={img.nombre || `Escena ${idx + 1}`}
                  title={img.nombre || `Escena ${idx + 1}`}
                />
              ))}
            </div>
          )}
          {renderDrawingOverlay()}
        </div>

        {selectedLoteInfo && (
          <aside
            className={`${styles.loteDrawer} ${isMobileView ? styles.mobileSheet : ""} ${isMobileView && loteSheetMode === "collapsed" ? styles.mobileCollapsed : ""} ${isMobileView && loteSheetMode === "expanded" ? styles.mobileExpanded : ""} viewer-panel-enter`}
            ref={loteDrawerRef}
            style={
              isMobileView && loteSheetTop !== null
                ? {
                    top: `${loteSheetTop}px`,
                    height: `calc(100dvh - ${loteSheetTop}px)`,
                    transition: isLoteSheetDragging
                      ? "none"
                      : "top 0.22s cubic-bezier(0.22, 1, 0.36, 1), height 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
                  }
                : undefined
            }
          >
            {isMobileView && (
              <div
                className={styles.mobileTopHeader}
                onTouchStart={onLoteSheetTouchStart}
                onTouchMove={onLoteSheetTouchMove}
                onTouchEnd={onLoteSheetTouchEnd}
              >
                <h3 className={styles.mobileHeaderTitle}>
                  {selectedLote?.nombre || "Lote seleccionado"}
                </h3>
                <button
                  type="button"
                  className={styles.mobileHeaderClose}
                  onClick={() => {
                    setSelectedLoteInfo(null);
                    setLoteInfoError("");
                  }}
                  aria-label="Cerrar lote"
                >
                  <X size={16} />
                </button>
                <div className={styles.mobileDragHandle} />
              </div>
            )}
            {!isMobileView && (
              <button
                type="button"
                className={styles.loteDrawerCloseFloating}
                onClick={() => {
                  setSelectedLoteInfo(null);
                  setLoteInfoError("");
                }}
                aria-label="Cerrar lote"
              >
                <X size={16} />
              </button>
            )}
            <div
              className={`${styles.loteDrawerContent} ${isMobileView && loteSheetMode === "collapsed" ? styles.mobileHiddenContent : ""}`}
              ref={loteDrawerBodyRef}
              onTouchStart={onLoteNestedTouchStart}
              onTouchMove={onLoteNestedTouchMove}
              onTouchEnd={onLoteNestedTouchEnd}
            >
              {/* <div className={styles.loteDrawerHeader} /> */}

              {loteInfoLoading && !selectedLoteInfo?.lote ? (
                <div className={styles.loteInfoState}>Cargando lote...</div>
              ) : (
                <>
                  {loteInfoError && (
                    <div className={styles.loteEnrichError}>
                      {loteInfoError}
                    </div>
                  )}
                  {/* ── Hero: status + nombre + precio centrado ── */}
                  <div className={styles.loteHeroNew} data-lote-hero>
                    <span
                      className={styles.loteStatusChip}
                      style={{
                        "--lot-status-color":
                          selectedLoteStatus?.fill || "#22c55e",
                      }}
                    >
                      {selectedLoteStatus?.label || "Disponible"}
                    </span>
                    <h5 className={styles.loteHeroName}>
                      {selectedLote?.nombre || "Lote seleccionado"}
                    </h5>
                    <div className={styles.loteHeroPrice}>
                      {formatMoney(selectedLote)}
                    </div>
                  </div>

                  {/* ── Botones de acción ── */}
                  <div className={styles.loteActionRowNew}>
                    <button
                      type="button"
                      className={styles.actionBtnWa}
                      data-lote-action
                      onClick={() => {
                        if (cleanContactPhone) {
                          window.open(
                            `https://wa.me/${cleanContactPhone}?text=Hola, estoy interesado en el lote ${selectedLote?.nombre}`,
                            "_blank",
                          );
                        }
                      }}
                    >
                      <MessageCircle size={17} />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtnPhone}
                      data-lote-action
                      onClick={() => {
                        if (contactPhone) {
                          window.location.href = `tel:${contactPhone}`;
                        }
                      }}
                    >
                      <Phone size={17} />
                      <span>Llamar</span>
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtnShareNew}
                      data-lote-action
                      onClick={() => {
                        const shareData = {
                          title: `Lote ${selectedLote?.nombre} - GeoHabita`,
                          text: shareText,
                          url: window.location.href,
                        };
                        if (navigator.share) {
                          navigator.share(shareData);
                        } else {
                          navigator.clipboard
                            .writeText(
                              `${shareData.text} ${window.location.href}`,
                            )
                            .catch(() => {});
                        }
                      }}
                    >
                      <Share2 size={17} />
                      <span>Compartir</span>
                    </button>
                  </div>

                  {/* ── Métricas de área ── */}
                  <div className={styles.loteMetricsGrid} data-lote-card>
                    <div className={styles.loteMetricCell}>
                      <div className={styles.loteMetricIcon} style={{ "--mc": "#22d3ee" }}>
                        <Ruler size={14} />
                      </div>
                      <span className={styles.loteMetricVal}>
                        {hasDisplayValue(selectedLote?.area_total_m2)
                          ? `${selectedLote.area_total_m2} m²`
                          : "—"}
                      </span>
                      <span className={styles.loteMetricLbl}>Área total</span>
                    </div>
                    <div className={styles.loteMetricCell}>
                      <div className={styles.loteMetricIcon} style={{ "--mc": "#a78bfa" }}>
                        <Ruler size={14} />
                      </div>
                      <span className={styles.loteMetricVal}>
                        {hasDisplayValue(selectedLote?.ancho)
                          ? `${selectedLote.ancho} m`
                          : "—"}
                      </span>
                      <span className={styles.loteMetricLbl}>Ancho</span>
                    </div>
                    <div className={styles.loteMetricCell}>
                      <div className={styles.loteMetricIcon} style={{ "--mc": "#fb923c" }}>
                        <Ruler size={14} />
                      </div>
                      <span className={styles.loteMetricVal}>
                        {hasDisplayValue(selectedLote?.largo)
                          ? `${selectedLote.largo} m`
                          : "—"}
                      </span>
                      <span className={styles.loteMetricLbl}>Largo</span>
                    </div>
                    <div className={styles.loteMetricCell}>
                      <div className={styles.loteMetricIcon} style={{ "--mc": "#4ade80" }}>
                        <Tag size={14} />
                      </div>
                      <span className={styles.loteMetricVal}>
                        {formatPricePerSquareMeter(selectedLote) || "—"}
                      </span>
                      <span className={styles.loteMetricLbl}>Por m²</span>
                    </div>
                  </div>

                  {viewerFinancingScenario && (
                    <div className={styles.viewerFinancingCard} data-lote-card>
                      <div className={styles.viewerFinancingHead}>
                        <div>
                          <span className={styles.viewerFinancingKicker}>
                            Simulador financiero
                          </span>
                          <strong>
                            {formatCurrencyMoney(
                              viewerFinancingScenario.monthlyEstimate,
                              viewerFinancingCurrency,
                            )}
                          </strong>
                          <p>Cuota estimada mensual</p>
                        </div>
                        <a
                          href={viewerFinancingWhatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.viewerFinancingCta} ${!viewerFinancingWhatsappHref ? styles.viewerFinancingCtaDisabled : ""}`}
                          aria-disabled={!viewerFinancingWhatsappHref}
                          onClick={(e) => {
                            if (!viewerFinancingWhatsappHref)
                              e.preventDefault();
                          }}
                        >
                          <MessageCircle size={16} />
                          <span>Lo quiero</span>
                        </a>
                      </div>

                      {/* Resumen de cuotas */}
                      <div className={styles.finSummaryRow}>
                        <div className={styles.finSummaryCell}>
                          <span>Inicial</span>
                          <strong>
                            {formatCurrencyMoney(
                              viewerFinancingScenario.initial,
                              viewerFinancingCurrency,
                            )}
                          </strong>
                        </div>
                        <div className={styles.finSummaryCell}>
                          <span>Plazo</span>
                          <strong>{viewerFinancingScenario.months} m.</strong>
                        </div>
                        <div className={styles.finSummaryCell}>
                          <span>Total est.</span>
                          <strong>
                            {formatCurrencyMoney(
                              viewerFinancingScenario.totalPaid,
                              viewerFinancingCurrency,
                            )}
                          </strong>
                        </div>
                      </div>

                      {/* Sliders interactivos */}
                      <div className={styles.finSliders}>
                        <label className={styles.finSliderLabel}>
                          <div className={styles.finSliderRow}>
                            <span>Inicial</span>
                            <strong>
                              {formatCurrencyMoney(
                                viewerFinancingInitial,
                                viewerFinancingCurrency,
                              )}
                            </strong>
                          </div>
                          <input
                            type="range"
                            className={styles.finSliderInput}
                            min={viewerFinancingMinInitial}
                            max={viewerFinancingMaxInitial}
                            step={Math.max(
                              100,
                              Math.round(
                                (viewerFinancingMaxInitial -
                                  viewerFinancingMinInitial) /
                                  100,
                              ),
                            )}
                            value={clamp(
                              viewerFinancingInitial,
                              viewerFinancingMinInitial,
                              viewerFinancingMaxInitial,
                            )}
                            onChange={(e) =>
                              setViewerFinancingInitial(
                                Number(e.target.value),
                              )
                            }
                          />
                        </label>
                        <label className={styles.finSliderLabel}>
                          <div className={styles.finSliderRow}>
                            <span>Plazo</span>
                            <strong>{viewerFinancingMonths} meses</strong>
                          </div>
                          <input
                            type="range"
                            className={styles.finSliderInput}
                            min={viewerFinancingMinMonths}
                            max={viewerFinancingMaxMonths}
                            step="1"
                            value={clamp(
                              viewerFinancingMonths,
                              viewerFinancingMinMonths,
                              viewerFinancingMaxMonths,
                            )}
                            onChange={(e) =>
                              setViewerFinancingMonths(
                                Number(e.target.value),
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* ── Inmobiliaria (al final) ── */}
                  {selectedLoteInfo?.inmobiliaria?.nombreinmobiliaria && (
                    <div className={styles.loteInmoRow} data-lote-card>
                      <Building2 size={14} />
                      <span>{selectedLoteInfo.inmobiliaria.nombreinmobiliaria}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      <aside
        className={`${styles.sideGallery} ${isMobileView ? styles.mobileSheet : ""} ${isMobileView && gallerySheetMode === "collapsed" ? styles.mobileCollapsed : ""} ${isMobileView && gallerySheetMode === "expanded" ? styles.mobileExpanded : ""}`}
        ref={sideGalleryRef}
        style={
          isMobileView && gallerySheetTop !== null
            ? {
                top: `${gallerySheetTop}px`,
                height: `calc(100dvh - ${gallerySheetTop}px)`,
                transition: isGalleryDragging
                  ? "none"
                  : "top 0.22s cubic-bezier(0.22, 1, 0.36, 1), height 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
              }
            : undefined
        }
      >
        {isMobileView && (
          <div
            className={styles.mobileTopHeader}
            onTouchStart={onGallerySheetTouchStart}
            onTouchMove={onGallerySheetTouchMove}
            onTouchEnd={onGallerySheetTouchEnd}
          >
            <h3 className={styles.mobileHeaderTitle}>{projectName}</h3>
            <button
              type="button"
              className={styles.mobileHeaderClose}
              onClick={onClose}
              aria-label="Cerrar visor"
            >
              <X size={16} />
            </button>
            <div className={styles.mobileDragHandle} />
          </div>
        )}
        <div
          className={`${styles.galleryHeader} ${isSidebarCollapsed ? styles.galleryHeaderCollapsed : ""}`}
        >
          {!isSidebarCollapsed && (
            <>
              <ImageIcon size={18} className={styles.greenText} />
              <div>
                <span>Vistas disponibles</span>
                <small>{normalizedImages.length} ambientes</small>
              </div>
            </>
          )}
          {!isMobileView && (
            <button
              type="button"
              className={styles.sideCollapseBtn}
              onClick={() => setIsSidebarCollapsed((v) => !v)}
              aria-label={
                isSidebarCollapsed ? "Expandir galería" : "Contraer galería"
              }
              title={
                isSidebarCollapsed ? "Expandir galería" : "Contraer galería"
              }
            >
              {isSidebarCollapsed ? (
                <ChevronLeft size={15} />
              ) : (
                <ChevronRight size={15} />
              )}
            </button>
          )}
        </div>
        {isSidebarCollapsed && !isMobileView ? (
          <div
            className={styles.sideGalleryCollapsedIcon}
            onClick={() => setIsSidebarCollapsed(false)}
            title="Expandir galería"
          >
            <ImageIcon size={18} />
            <span className={styles.sideGalleryCollapsedLabel}>Galería</span>
          </div>
        ) : (
          <div
            className={`${styles.sideGalleryBody} ${isMobileView && gallerySheetMode === "collapsed" ? styles.mobileHiddenContent : ""}`}
            ref={sideGalleryBodyRef}
            onTouchStart={onGalleryNestedTouchStart}
            onTouchMove={onGalleryNestedTouchMove}
            onTouchEnd={onGalleryNestedTouchEnd}
          >
            <div className={styles.projectSidebarPanel}>
              <div className={styles.sidebarBrandRow}>
                <img
                  src="/habitasinfondo.png"
                  alt="GeoHabita"
                  className={styles.sidebarBrandLogo}
                />
                <span className={styles.sidebarBrandTag}>Proyecto</span>
              </div>
              <div className={styles.projectSidebarIntro}>
                <h4>{projectName}</h4>
                {lotesSummary.total > 0 && (
                  <div className={styles.sidebarLotStats}>
                    <div className={styles.sidebarLotStat}>
                      <span
                        className={styles.sidebarStatVal}
                        style={{ color: "#22c55e" }}
                      >
                        {lotesSummary.available}
                      </span>
                      <span className={styles.sidebarStatLbl}>Disponibles</span>
                    </div>
                    {lotesSummary.reserved > 0 && (
                      <div className={styles.sidebarLotStat}>
                        <span
                          className={styles.sidebarStatVal}
                          style={{ color: "#f59e0b" }}
                        >
                          {lotesSummary.reserved}
                        </span>
                        <span className={styles.sidebarStatLbl}>
                          Reservados
                        </span>
                      </div>
                    )}
                    {lotesSummary.sold > 0 && (
                      <div className={styles.sidebarLotStat}>
                        <span
                          className={styles.sidebarStatVal}
                          style={{ color: "#ef4444" }}
                        >
                          {lotesSummary.sold}
                        </span>
                        <span className={styles.sidebarStatLbl}>Vendidos</span>
                      </div>
                    )}
                  </div>
                )}
                {projectSidebarInfo.description && (
                  <p>{projectSidebarInfo.description}</p>
                )}
              </div>
              <div className={styles.projectSidebarGrid}>
                {projectSidebarInfo.price && (
                  <div className={styles.projectSidebarCard}>
                    <span>Desde</span>
                    <strong>{projectSidebarInfo.price}</strong>
                  </div>
                )}
                {projectSidebarInfo.area && (
                  <div className={styles.projectSidebarCard}>
                    <span>Área</span>
                    <strong>{projectSidebarInfo.area}</strong>
                  </div>
                )}
                {projectSidebarInfo.dimensions && (
                  <div className={styles.projectSidebarCard}>
                    <span>Dimensión</span>
                    <strong>{projectSidebarInfo.dimensions}</strong>
                  </div>
                )}
                {projectSidebarInfo.developer && (
                  <div className={styles.projectSidebarCard}>
                    <span>Inmobiliaria</span>
                    <strong>{projectSidebarInfo.developer}</strong>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.sidebarDivider} />
            <div className={styles.sidebarSectionLabel}>
              <ImageIcon size={14} />
              <span>Ambientes 360°</span>
              <span className={styles.sidebarSectionCount}>
                {normalizedImages.length}
              </span>
            </div>
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

            <div className={styles.sidebarDivider} />
            <div className={styles.hotspotsPanel}>
              <div className={styles.hotspotsHeader}>
                <Navigation size={15} />
                <span>Recorrido 360°</span>
                {hotspots.length > 0 && (
                  <span className={styles.hotspotsCount}>
                    {hotspots.length}
                  </span>
                )}
              </div>

              {hotspotsLoading ? (
                <div className={styles.emptyHotspots}>
                  Cargando conexiones...
                </div>
              ) : hotspots.length === 0 ? (
                <div className={styles.emptyHotspots}>
                  Sin conexiones en esta vista.
                </div>
              ) : (
                <div className={styles.hotspotsList}>
                  {hotspots.map((hotspot, idx) => (
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
                        <span className={styles.hotspotIdx}>{idx + 1}</span>
                      </div>
                      <div className={styles.hotspotItemBody}>
                        <strong>
                          {hotspot.destino?.nombre || "Vista conectada"}
                        </strong>
                        <span>
                          <Navigation
                            size={10}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                              marginRight: 3,
                            }}
                          />
                          Navegar a esta vista
                        </span>
                      </div>
                      <ChevronRight
                        size={14}
                        className={styles.hotspotChevron}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default Viewer360Modal;
