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
  MapPinned,
  Maximize2,
  MessageCircle,
  Minimize2,
  Phone,
  Ruler,
  Navigation,
  Route,
  Share2,
  Tag,
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
const OVERLAY_VIEWBOX = { width: 1200, height: 780 };
const OVERLAY_HEADER_OFFSET = 42;

const HOTSPOT_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="118" height="78" viewBox="0 0 118 78">
  <defs>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#000" flood-opacity=".34"/>
    </filter>
    <linearGradient id="head" x1="49" x2="69" y1="14" y2="34">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="58%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#dbeafe"/>
    </linearGradient>
    <linearGradient id="stick" x1="57" x2="61" y1="34" y2="66">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dbeafe"/>
    </linearGradient>
  </defs>
  <ellipse cx="59" cy="69" rx="11" ry="3" fill="rgba(15,23,42,.28)"/>
  <g filter="url(#shadow)">
    <rect x="57" y="32" width="4" height="35" rx="2" fill="url(#stick)" stroke="rgba(15,23,42,.2)" stroke-width=".8"/>
    <circle cx="59" cy="24" r="13" fill="url(#head)" stroke="rgba(15,23,42,.3)" stroke-width="1.6"/>
    <circle cx="59" cy="24" r="6" fill="#ffffff" opacity=".96"/>
    <path d="M53.5 17.5c2.4-2.1 6.1-2.8 9.2-1.6" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".88"/>
  </g>
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
const LOT_LABEL_MIN_ZOOM = 10;
const LOT_LABELS_ENABLED = false;
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
  const hex = String(value || "").trim().replace("#", "");
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
      Math.round(parseInt(normalized.slice(start, start + 2), 16) * (1 - amount)),
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

const getLoteSvgStyle = ({
  status,
  isSelected,
  overlayOpacity,
  loteColor,
  availableVariant = 0,
}) => {
  const availableTone =
    status.key === "available" ? getAvailableLoteTone(availableVariant) : null;
  const baseFill =
    status.key === "available"
      ? availableTone?.fill || status.fill
      : loteColor || status.fill;
  const derivedStroke =
    darkenHexColor(baseFill, 0.34) || availableTone?.stroke || status.stroke;
  if (isSelected) {
      return {
        fill: "#22d3ee",
        fillOpacity: "0.88",
        stroke: "#0f766e",
        strokeWidth: "3.5px",
        strokeLinejoin: "round",
        strokeOpacity: "1",
      };
  }

  if (status.key === "sold") {
    return {
      fill: baseFill,
      fillOpacity: "0.76",
      stroke: derivedStroke,
      strokeWidth: "2.4px",
      strokeLinejoin: "round",
      strokeOpacity: "0.94",
      strokeDasharray: "8 5",
    };
  }

  if (status.key === "reserved") {
    return {
      fill: baseFill,
      fillOpacity: "0.78",
      stroke: derivedStroke,
      strokeWidth: "2.5px",
      strokeLinejoin: "round",
      strokeOpacity: "0.98",
      strokeDasharray: "14 6",
    };
  }

  return {
    fill: baseFill,
    fillOpacity: String(Math.min(Number(overlayOpacity ?? 0.82), 0.82)),
    stroke: derivedStroke,
    strokeWidth: "2.2px",
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
const getProjectRecord = (img) => {
  if (img?.idproyecto && typeof img.idproyecto === "object") return img.idproyecto;
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
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-6) + xi;
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

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
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
  const rawName = String(lote?.nombre || `Lote ${getLoteId(lote) || ""}`).trim();
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
  const area = hasDisplayValue(lote?.area_total_m2) ? `${lote.area_total_m2} m²` : "";
  return `
    <div class="gh-lot-tooltip-card">
      <div class="gh-lot-tooltip-name">${String(lote?.nombre || `Lote ${getLoteId(lote) || ""}`)}</div>
      <div class="gh-lot-tooltip-meta">
        ${area ? `<span>${area}</span>` : ""}
        <span>${status.label}</span>
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
  const lotLabelsZoomTimerRef = useRef(null);
  const lotLabelsZoomingRef = useRef(false);
  const travelTimerRef = useRef(null);
  const loteInfoCacheRef = useRef(new Map());
  const loteInfoAbortRef = useRef(null);
  const projectLotesCacheRef = useRef(new Map());
  const previousGallerySheetStateRef = useRef(null);
  const galleryTouchStartY = useRef(0);
  const galleryTouchDeltaY = useRef(0);
  const galleryTouchStartTop = useRef(0);

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
      Number(viewerFinancingConfig?.max_initial_amount || viewerFinancingPrice || 0) ||
        viewerFinancingPrice,
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
    if (!viewerFinancingConfig || !viewerFinancingPrice) return null;
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
    const monthlyAdminFee = Number(viewerFinancingConfig?.monthly_admin_fee || 0);
    const insuranceMonthly = Number(viewerFinancingConfig?.insurance_monthly || 0);
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
      area:
        hasDisplayValue(record?.area_total_m2) ? `${record.area_total_m2} m2` : "",
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
      .sort((a, b) => a.centroid.y - b.centroid.y || a.centroid.x - b.centroid.x);

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
  const lotLabelsData = useMemo(
    () => {
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
    },
    [availableLotVariantById, currentImageId, lotesForHud, selectedLoteId],
  );
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

    const urls = [`/api/listPuntosLoteProyecto/${key}/`];

    const token = localStorage.getItem("access");
    if (token) {
      urls.push(`/api/getLoteProyecto/${key}`);
    }

    for (const url of urls) {
      const init =
        url.includes("/api/getLoteProyecto/") && token
          ? {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          : undefined;
      const res = await fetch(buildApiUrl(url), init);
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

  const getGalleryAnchors = useCallback(() => {
    if (typeof window === "undefined") {
      return { expandedTop: 120, midTop: 420, collapsedTop: 0 };
    }
    const vh = window.innerHeight;
    const expandedTop = Math.max(84, vh * 0.14);
    const midTop = vh * 0.56;
    const collapsedTop = vh - 86;
    return {
      expandedTop,
      midTop: Math.min(Math.max(midTop, expandedTop + 90), collapsedTop - 90),
      collapsedTop,
    };
  }, []);

  const getLoteAnchors = useCallback(() => {
    if (typeof window === "undefined") {
      return { expandedTop: 72, midTop: 360, collapsedTop: 0 };
    }
    const vh = window.innerHeight;
    const expandedTop = Math.max(64, vh * 0.1);
    const midTop = vh * 0.34;
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
    if (!containerRef.current || !currentImage || !viewerRuntimeReady) {
      return undefined;
    }

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
      const runtime = viewerRuntimeRef.current || (await loadViewerRuntime());
      if (!active || !runtime) return;

      const imageKey = String(currentImageId ?? "");
      const initialLayout = currentOverlayBundle?.layouts?.[imageKey];
      const initialYaw = Number(initialLayout?.yaw);
      const initialPitch = Number(initialLayout?.pitch);
      const initialZoom = Number(initialLayout?.zoomLevel);
      const viewerOptions = {
        container: containerRef.current,
        panorama: currentImage.imagen,
        caption: currentImage.nombre,
        adapter: [runtime.EquirectangularAdapter, { resolution: VIEWER_RESOLUTION }],
        defaultZoomLvl: Number.isFinite(initialZoom) ? initialZoom : 35,
        moveSpeed: VIEWER_MOVE_SPEED,
        fisheye: false,
        loadingImg: VIEWER_LOADING_ICON,
        loadingTxt: "Cargando vista 360...",
        navbar: ["zoom", "move", "caption"],
        plugins: [[runtime.MarkersPlugin, {}]],
      };

      if (Number.isFinite(initialYaw)) {
        viewerOptions.defaultYaw = initialYaw;
      }

      if (Number.isFinite(initialPitch)) {
        viewerOptions.defaultPitch = initialPitch;
      }

      viewerInstance = new runtime.Viewer(viewerOptions);

      viewerRef.current = viewerInstance;
      const markers = viewerInstance.getPlugin(runtime.MarkersPlugin);

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
        setViewerReady(true);
      });
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
    viewerRuntimeReady,
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

    const markers = viewerRef.current.getPlugin(
      viewerRuntimeRef.current?.MarkersPlugin,
    );
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
          ...(hasProjectPixels
            ? { polygonPixels: overlayToRender.projectPolygonPixels }
            : { polygon: overlayToRender.projectPolygon }),
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
        const availableVariant =
          availableLotVariantById[String(loteId ?? `idx-${index}`)] ?? 0;
        markers.addMarker({
          id: `overlay-lote-${currentImageId}-${markerKey}-${index}`,
          ...(hasPixels
            ? { polygonPixels: lote.polygonPixels }
            : { polygon: lote.polygon }),
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
            overlayOpacity: overlayToRender.lotOpacity,
            loteColor: lote.color,
            availableVariant,
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
  }, [
    viewerReady,
    hotspots,
    overlayToRender,
    currentImageId,
    selectedLoteId,
    availableLotVariantById,
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
            const polygonSpherical = viewer.dataHelper.textureCoordsToSphericalCoords({
              textureX: Number(point[0]),
              textureY: Number(point[1]),
            });
            return viewer.dataHelper.sphericalCoordsToViewerCoords(polygonSpherical);
          })
          .filter(
            (point) =>
              Number.isFinite(point?.x) && Number.isFinite(point?.y),
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

        const polygonAsArrays = projectedPolygon.map((point) => [point.x, point.y]);
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
            projectedHeight / (lineCount === 3 ? 4.65 : lineCount === 2 ? 3.6 : 2.45),
            Math.sqrt(projectedArea) * 0.07,
            safeRadius * 0.46,
          ),
          4.6,
          label.isSelected ? 15 : 13,
        );
        const areaFontSize = Math.max(4.1, titleFontSize * 0.3);
        const blockFontSize = Math.max(4.1, titleFontSize * 0.26);
        const opacity = label.isSelected ? 1 : clamp(projectedArea / 2400, 0.82, 1);
        group.setAttribute("display", "inline");
        group.setAttribute("opacity", String(opacity));
        group.setAttribute("transform", `translate(${anchor.x} ${anchor.y}) rotate(${angle})`);
        group.setAttribute(
          "class",
          label.isSelected ? styles.lotLabelSelected : styles.lotLabel,
        );

        titleNode.setAttribute("font-size", String(titleFontSize));
        titleNode.setAttribute(
          "y",
          lineCount === 3 ? String(-titleFontSize * 0.64) : lineCount === 2 ? "-1.5" : "0",
        );

        if (areaNode) {
          areaNode.setAttribute("font-size", String(areaFontSize));
          areaNode.setAttribute(
            "y",
            lineCount === 3 ? String(titleFontSize * 0.1) : String(titleFontSize * 0.68),
          );
          areaNode.textContent = canShowArea ? label.labelLines.area || "" : "";
          areaNode.setAttribute("display", canShowArea ? "inline" : "none");
        }

        if (blockNode) {
          blockNode.setAttribute("font-size", String(blockFontSize));
          blockNode.setAttribute("y", String(titleFontSize * 0.96));
          blockNode.textContent = canShowBlock ? label.labelLines.block || "" : "";
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
      const hudTargets = overlayRef.current?.querySelectorAll(".viewer-hud-enter");
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

      const panelTargets = overlayRef.current?.querySelectorAll(".viewer-panel-enter");
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
        { autoAlpha: 0, x: isMobileView ? 0 : 34, y: isMobileView ? 34 : 0, scale: 0.985 },
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

  if (!normalizedImages.length) return null;
  const selectedLoteStatus = selectedLote
    ? getLoteStatusMeta(selectedLote.vendido)
    : null;

  const onGallerySheetTouchStart = (e) => {
    if (!isMobileView) return;
    galleryTouchStartY.current = e.targetTouches[0].clientY;
    galleryTouchDeltaY.current = 0;
    galleryTouchStartTop.current = gallerySheetTop ?? getGalleryAnchors().midTop;
    setIsGalleryDragging(true);
    e.stopPropagation();
  };

  const onGallerySheetTouchMove = (e) => {
    if (!isMobileView || !galleryTouchStartY.current) return;
    galleryTouchDeltaY.current =
      e.targetTouches[0].clientY - galleryTouchStartY.current;
    setGalleryTopAndMode(galleryTouchStartTop.current + galleryTouchDeltaY.current);
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
    galleryNestedScrollableTarget.current = contentScrollable ? contentEl : sheetEl;
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
    loteNestedScrollableTarget.current = contentScrollable ? contentEl : sheetEl;
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
  const mobileWatermarkTop = isMobileView
    ? Math.max(
        12,
        Number(
          selectedLoteInfo && loteSheetTop !== null
            ? loteSheetTop
            : gallerySheetTop ?? 0,
        ) - 42,
      )
    : 0;

  return (
    <div className={styles.overlay360} ref={overlayRef}>
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
            <h3 className={styles.imageTitle}>{projectName}</h3>
            <p className={styles.imageSubtitle}>Explora la vista y el contenido</p>
            <div className={styles.headerStats}>
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
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={toggleFullscreen}
              className={styles.closeBtn}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{isFullscreen ? "Salir" : "Pantalla completa"}</span>
            </button>
            <button type="button" onClick={onClose} className={styles.closeBtn}>
              <X size={20} />
              <span>Cerrar</span>
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
                    className={label.isSelected ? styles.lotLabelSelected : styles.lotLabel}
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
            <div className={`${styles.hotspotHint} viewer-hud-enter`}>
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

            {loteInfoLoading ? (
              <div className={styles.loteInfoState}>Cargando lote...</div>
            ) : loteInfoError ? (
              <div className={styles.loteInfoState}>{loteInfoError}</div>
            ) : (
              <>
                <div className={styles.loteDrawerHero} data-lote-hero>
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
                  <h5>{selectedLote?.nombre || "Lote seleccionado"}</h5>
                  <p>{projectName}</p>
                  <div className={styles.loteDrawerPriceBlock}>
                    <small>Precio actual</small>
                    <strong>{formatMoney(selectedLote)}</strong>
                  </div>
                </div>

                <div className={styles.loteActionButtons}>
                  <button
                    type="button"
                    className={styles.actionBtnWhatsApp}
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
                    <MessageCircle size={18} />
                    <span>
                      <strong>WhatsApp</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtnCall}
                    data-lote-action
                    onClick={() => {
                      if (contactPhone) {
                        window.location.href = `tel:${contactPhone}`;
                      }
                    }}
                  >
                    <Phone size={18} />
                    <span>
                      <strong>Llamar</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtnShare}
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
                        navigator.clipboard.writeText(
                          `${shareData.text} ${window.location.href}`,
                        );
                        alert("Enlace copiado al portapapeles");
                      }
                    }}
                  >
                    <Share2 size={18} />
                    <span>
                      <strong>Compartir</strong>
                    </span>
                  </button>
                </div>

                <div className={styles.loteDrawerMeta} data-lote-card>
                  <div className={styles.loteMetaCard}>
                    <Building2 size={16} />
                    <div className={styles.loteMetaCardBody}>
                      <span>Proyecto</span>
                      <strong>
                        {selectedLoteInfo?.proyecto?.nombreproyecto ||
                          projectName ||
                          "GeoHabita 360"}
                      </strong>
                    </div>
                  </div>
                  <div className={styles.loteMetaCard}>
                    <Building2 size={16} />
                    <div className={styles.loteMetaCardBody}>
                      <span>Inmobiliaria</span>
                      <strong>
                        {selectedLoteInfo?.inmobiliaria?.nombreinmobiliaria ||
                          "Consultar"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className={styles.loteInfoGrid} data-lote-card>
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
                    <strong>{formatPricePerSquareMeter(selectedLote) || "Consultar"}</strong>
                    <span>Precio por m2</span>
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
                          if (!viewerFinancingWhatsappHref) e.preventDefault();
                        }}
                      >
                        <MessageCircle size={16} />
                        <span>Lo quiero</span>
                      </a>
                    </div>

                    <div className={styles.viewerFinancingGrid}>
                      <div>
                        <span>Inicial</span>
                        <strong>
                          {formatCurrencyMoney(
                            viewerFinancingScenario.initial,
                            viewerFinancingCurrency,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Meses</span>
                        <strong>{viewerFinancingScenario.months}</strong>
                      </div>
                      <div>
                        <span>Total estimado</span>
                        <strong>
                          {formatCurrencyMoney(
                            viewerFinancingScenario.totalPaid,
                            viewerFinancingCurrency,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.viewerFinancingFields}>
                      <label>
                        <span>Inicial</span>
                        <input
                          type="number"
                          min={viewerFinancingMinInitial}
                          max={viewerFinancingMaxInitial}
                          step="100"
                          value={viewerFinancingInitial}
                          onChange={(e) =>
                            setViewerFinancingInitial(Number(e.target.value) || 0)
                          }
                        />
                      </label>
                      <label>
                        <span>Meses</span>
                        <input
                          type="number"
                          min={viewerFinancingMinMonths}
                          max={viewerFinancingMaxMonths}
                          step="1"
                          value={viewerFinancingMonths}
                          onChange={(e) =>
                            setViewerFinancingMonths(Number(e.target.value) || 0)
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className={styles.loteInsightStrip} data-lote-card>
                  <div className={styles.loteInsightCopy}>
                    <small>Lectura rápida</small>
                    <strong>
                      {selectedLoteStatus?.label || "Disponible"} para contacto inmediato
                    </strong>
                    <p>
                      {selectedLoteInfo?.inmobiliaria?.nombreinmobiliaria ||
                        "La inmobiliaria"}{" "}
                      puede atender este lote directamente desde la experiencia 360.
                    </p>
                  </div>
                </div>

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
            <h3 className={styles.mobileHeaderTitle}>
              {projectName}
            </h3>
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
        <div className={styles.galleryHeader}>
          <ImageIcon size={18} className={styles.greenText} />
          <div>
            <span>Vistas disponibles</span>
            <small>{normalizedImages.length} ambientes</small>
          </div>
        </div>
        <div
          className={`${styles.sideGalleryBody} ${isMobileView && gallerySheetMode === "collapsed" ? styles.mobileHiddenContent : ""}`}
          ref={sideGalleryBodyRef}
          onTouchStart={onGalleryNestedTouchStart}
          onTouchMove={onGalleryNestedTouchMove}
          onTouchEnd={onGalleryNestedTouchEnd}
        >
        <div className={styles.projectSidebarPanel}>
          <div className={styles.projectSidebarIntro}>
            <small>Proyecto actual</small>
            <h4>{projectName}</h4>
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
        </div>
      </aside>
    </div>
  );
};

export default Viewer360Modal;
