import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EquirectangularAdapter, Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { Vector3 } from "three";
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
    <radialGradient id="floor" cx="50%" cy="52%" r="64%">
      <stop offset="0%" stop-color="#f8fafc" stop-opacity=".92"/>
      <stop offset="58%" stop-color="#e5e7eb" stop-opacity=".58"/>
      <stop offset="100%" stop-color="#cbd5e1" stop-opacity=".18"/>
    </radialGradient>
    <linearGradient id="beam" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc" stop-opacity=".08"/>
      <stop offset="30%" stop-color="#f8fafc" stop-opacity=".3"/>
      <stop offset="100%" stop-color="#f8fafc" stop-opacity=".04"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#000" flood-opacity=".38"/>
    </filter>
  </defs>
  <g opacity=".78">
    <path d="M37 4h44l13 54H24L37 4z" fill="url(#beam)" filter="url(#soft)"/>
    <path d="M53 4h12l4 54H49L53 4z" fill="#f8fafc" opacity=".16"/>
    <path d="M73 4h6l11 54H77L73 4z" fill="#f8fafc" opacity=".12"/>
    <path d="M39 4h6L31 58H20L39 4z" fill="#f8fafc" opacity=".1"/>
  </g>
  <g filter="url(#shadow)">
    <ellipse cx="59" cy="56" rx="55" ry="20" fill="url(#floor)"/>
    <ellipse cx="59" cy="56" rx="39" ry="13" fill="#e5e7eb" opacity=".18"/>
    <path d="M30 56c17-9 41-9 58 0" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round" opacity=".55"/>
    <ellipse cx="59" cy="56" rx="54" ry="19" fill="none" stroke="#f8fafc" stroke-width="2" opacity=".42"/>
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
const shouldPrioritizeThumb = (idx, currentIndex) =>
  Math.abs(idx - currentIndex) <= GALLERY_PRELOAD_RANGE;

const getFetchPriority = (idx, currentIndex) =>
  idx === currentIndex ? "high" : shouldPrioritizeThumb(idx, currentIndex) ? "auto" : "low";

const getLoadingMode = (idx, currentIndex) =>
  shouldPrioritizeThumb(idx, currentIndex) ? "eager" : "lazy";

const formatMoney = (lote) => {
  const precio = lote?.precio;
  if (precio === null || precio === undefined || precio === "") return "Consultar";
  const numeric = Number(precio);
  const value = Number.isFinite(numeric) ? numeric.toLocaleString("es-PE") : precio;
  return `${lote?.moneda || ""} ${value}`.trim();
};

const hasDisplayValue = (value) => value !== null && value !== undefined && value !== "";
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
const getLoteId = (lote) => lote?.idlote ?? lote?.id ?? lote?.id_lote ?? lote?.lote_id;
const getProjectId = (img) =>
  img?.idproyecto?.idproyecto ?? img?.idproyecto_id ?? img?.idproyecto ?? img?.proyecto?.idproyecto;

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

const buildAnchoredOverlayFromLayout = (viewer, geometry, layout, imageId, containerWidth) => {
  if (!viewer || !geometry || !layout || !imageId || !containerWidth) return null;

  const currentViewerWidth = viewer?.state?.size?.width || containerWidth;
  const currentViewerHeight = viewer?.state?.size?.height || 0;
  const savedViewerWidth = Number(layout.viewerWidth) || currentViewerWidth;
  const savedViewerHeight = Number(layout.viewerHeight) || currentViewerHeight || savedViewerWidth;
  const scaleX = savedViewerWidth ? currentViewerWidth / savedViewerWidth : 1;
  const scaleY = savedViewerHeight ? currentViewerHeight / savedViewerHeight : scaleX;

  const fallbackCardWidth = Math.min(savedViewerWidth - 36, Math.min(savedViewerWidth * 0.62, 760));
  const svgWidth = Number(layout.overlayWidth) || fallbackCardWidth;
  const svgHeight =
    Number(layout.overlayHeight) || (svgWidth / OVERLAY_VIEWBOX.width) * OVERLAY_VIEWBOX.height;
  const overlayOffsetX = Number(layout.overlayOffsetX) || 0;
  const overlayOffsetY = Number(layout.overlayOffsetY) || OVERLAY_HEADER_OFFSET;

  if (!Number.isFinite(svgWidth) || !Number.isFinite(svgHeight) || svgWidth <= 0 || svgHeight <= 0) {
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
        polygon: anchoredPoints.map((point) => point.spherical).filter(isValidSphericalPoint),
        polygonPixels: anchoredPoints.map((point) => point.pixels).filter(isValidTexturePoint),
      };
    })
    .filter((lote) => lote.polygon.length >= 3 || lote.polygonPixels.length >= 3);

  if (projectPolygon.length < 3 && projectPolygonPixels.length < 3 && !lotPolygons.length) return null;

  return {
    imageId: String(imageId),
    visible: layout.visible !== false,
    lotOpacity: layout.lotOpacity ?? 0.82,
    showProjectOutline: layout.showProjectOutline !== false,
    projectPolygon: projectPolygon.length >= 3 ? projectPolygon : [],
    projectPolygonPixels: projectPolygonPixels.length >= 3 ? projectPolygonPixels : [],
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
  if (!viewer || !overlay?.visible || !imageId || !containerWidth || !containerHeight) return null;

  const savedWidth = Number(overlay.viewerWidth) || containerWidth;
  const savedHeight = Number(overlay.viewerHeight) || containerHeight || savedWidth;
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
        polygon: anchoredPoints.map((point) => point.spherical).filter(isValidSphericalPoint),
        polygonPixels: anchoredPoints.map((point) => point.pixels).filter(isValidTexturePoint),
      };
    })
    .filter((lote) => lote.polygon.length >= 3 || lote.polygonPixels.length >= 3);

  if (projectPolygon.length < 3 && projectPolygonPixels.length < 3 && !lotPolygons.length) return null;

  return {
    imageId: String(imageId),
    visible: true,
    lotOpacity: overlay.lotOpacity ?? layout?.lotOpacity ?? 0.82,
    showProjectOutline: overlay.showProjectOutline !== false,
    projectPolygon: projectPolygon.length >= 3 ? projectPolygon : [],
    projectPolygonPixels: projectPolygonPixels.length >= 3 ? projectPolygonPixels : [],
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
    const imageId = String(item?.imageId ?? item?.imagenId ?? item?.id_imagen ?? "");
    if (!imageId) return acc;
    acc[imageId] = item;
    return acc;
  }, {});

  const layouts = layoutsRaw.reduce((acc, item) => {
    const imageId = String(item?.imageId ?? item?.imagenId ?? item?.id_imagen ?? "");
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

const Viewer360Modal = ({ images360 = [], onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hotspots, setHotspots] = useState([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerLoadMessage, setViewerLoadMessage] = useState("Preparando recorrido 360...");
  const [travelingTo, setTravelingTo] = useState("");
  const [computedOverlay, setComputedOverlay] = useState(null);
  const [selectedLoteInfo, setSelectedLoteInfo] = useState(null);
  const [loteInfoLoading, setLoteInfoLoading] = useState(false);
  const [loteInfoError, setLoteInfoError] = useState("");
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
  const currentAnchoredOverlay = useMemo(() => {
    const imageKey = String(currentImageId ?? "");
    if (!imageKey) return null;

    for (const entry of overlayBundles) {
      const directMatch = entry.bundle?.anchored?.[imageKey];
      if (directMatch) return directMatch;
    }

    const sameRowBundle = overlayBundles.find((entry) => entry.imageId === imageKey)?.bundle;
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
      overlayBundles.find((entry) => entry.bundle?.layouts?.[imageKey])?.bundle ||
      overlayBundles.find((entry) => entry.bundle?.geometry)?.bundle ||
      null
    );
  }, [currentImageId, overlayBundles]);
  const travelToImageById = useCallback((id, label) => {
    const index = normalizedImages.findIndex((img) => String(getImageId(img)) === String(id));
    if (index < 0) return;

    window.clearTimeout(travelTimerRef.current);
    setTravelingTo(label || normalizedImages[index]?.nombre || "otra vista");
    travelTimerRef.current = window.setTimeout(() => {
      setCurrentIndex(index);
      window.setTimeout(() => setTravelingTo(""), 180);
    }, 720);
  }, [normalizedImages]);

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
      const res = await fetch(buildApiUrl(`/api/mapa/lote_detalle/${loteId}/`), {
        signal: controller.signal,
      });
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

    const urls = [`/api/getLoteProyecto/${key}`, `/api/listPuntosLoteProyecto/${key}/`];

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
              (!!inlineLote?.nombre && normalizeText(lote.nombre) === normalizeText(inlineLote.nombre))
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
            (lote) => normalizeText(lote.nombre) === normalizeText(inlineLote.nombre),
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
    setCurrentIndex((prev) => (prev - 1 + normalizedImages.length) % normalizedImages.length);
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
      if (active) setViewerLoadMessage("La primera vista es pesada, ya casi está lista...");
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
  }, [currentImage, currentImageId, currentOverlayBundle, openLoteFromMarker, travelToImageById]);

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
  }, [viewerReady, currentAnchoredOverlay, currentOverlayBundle, currentImageId]);

  useEffect(() => {
    if (!viewerReady || !viewerRef.current) return;

    const markers = viewerRef.current.getPlugin(MarkersPlugin);
    markers.clearMarkers();

    const overlayToRender = currentAnchoredOverlay?.visible ? currentAnchoredOverlay : computedOverlay;

    if (overlayToRender?.visible) {
      const hasProjectSpherical = isValidPolygonPixels(overlayToRender.projectPolygon);
      const hasProjectPixels = isValidPolygonPixels(overlayToRender.projectPolygonPixels);
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
        markers.addMarker({
          id: `overlay-lote-${currentImageId}-${markerKey}-${index}`,
          ...(hasSpherical ? { polygon: lote.polygon } : { polygonPixels: lote.polygonPixels }),
          tooltip: lote.nombre || `Lote ${lote.idlote}`,
          data: {
            type: "lote",
            idlote: loteId,
            lote: {
              ...lote,
              idlote: loteId,
            },
          },
          svgStyle: {
            fill: lote.color || "#22c55e",
            fillOpacity: String(overlayToRender.lotOpacity ?? 0.82),
            stroke: "rgba(255,255,255,0.86)",
            strokeWidth: "3px",
            strokeLinejoin: "round",
          },
          zIndex: 6,
        });
      });
    }

    hotspots.forEach((hotspot) => {
      if (!Number.isFinite(Number(hotspot.yaw)) || !Number.isFinite(Number(hotspot.pitch))) return;

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
      });
    });
  }, [viewerReady, hotspots, currentAnchoredOverlay, computedOverlay, currentImageId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key === "ArrowRight") nextImage();
      if (event.key === "ArrowLeft") prevImage();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextImage, onClose, prevImage]);

  if (!normalizedImages.length) return null;

  const selectedLote = selectedLoteInfo?.lote;

  return (
    <div className={styles.overlay360}>
      <div className={styles.mainContent}>
        <div className={styles.header360}>
          <div className={styles.titleGroup}>
            <span className={styles.badge360}>
              <Sparkles size={14} /> Tour 360 virtual
            </span>
            <h3 className={styles.imageTitle}>{currentImage?.nombre}</h3>
            <p className={styles.imageSubtitle}>
              Explora la vista y pulsa los puntos verdes para moverte por el recorrido.
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
            <span>Cerrar</span>
          </button>
        </div>

        <div className={styles.viewerWrapper}>
          {!viewerReady && <div className={styles.loading360}>{viewerLoadMessage}</div>}
          <div className={styles.viewerContainer} ref={containerRef} />
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
              {hotspots.length} punto{hotspots.length === 1 ? "" : "s"} disponible{hotspots.length === 1 ? "" : "s"}
            </div>
          )}

          {normalizedImages.length > 1 && (
            <>
              <button type="button" className={`${styles.navBtn} ${styles.prev}`} onClick={prevImage}>
                <ChevronLeft size={30} />
              </button>
              <button type="button" className={`${styles.navBtn} ${styles.next}`} onClick={nextImage}>
                <ChevronRight size={30} />
              </button>
            </>
          )}

        </div>
      </div>

      <aside className={styles.sideGallery}>
        <div className={styles.galleryHeader}>
          <ImageIcon size={18} className={styles.greenText} />
          <div>
            <span>Vistas disponibles</span>
            <small>{normalizedImages.length} ambientes</small>
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
                {idx === currentIndex && <div className={styles.activeBadge}>Viendo</div>}
              </div>
              <span className={styles.thumbName}>{img.nombre}</span>
            </button>
          ))}
        </div>

        {selectedLoteInfo && (
          <div className={styles.loteInfoPanel}>
            <div className={styles.loteInfoHeader}>
              <div>
                <span className={styles.loteInfoBadge}>Lote seleccionado</span>
                <h4>{selectedLote?.nombre || `Lote ${selectedLote?.idlote || ""}`}</h4>
              </div>
              <button
                type="button"
                className={styles.loteInfoClose}
                onClick={() => {
                  setSelectedLoteInfo(null);
                  setLoteInfoError("");
                }}
                aria-label="Cerrar informacion del lote"
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
                <div className={styles.loteInfoPrice}>
                  <Tag size={17} />
                  <strong>{formatMoney(selectedLote)}</strong>
                  <span>Precio</span>
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
                </div>
              </>
            )}
          </div>
        )}

        <div className={styles.hotspotsPanel}>
          <div className={styles.hotspotsHeader}>
            <Route size={16} />
            <span>Puntos de esta vista</span>
          </div>

          {hotspotsLoading ? (
            <div className={styles.emptyHotspots}>Cargando puntos...</div>
          ) : hotspots.length === 0 ? (
            <div className={styles.emptyHotspots}>Esta vista no tiene puntos conectados.</div>
          ) : (
            <div className={styles.hotspotsList}>
              {hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className={styles.hotspotItem}
                  onClick={() => travelToImageById(hotspot.destino?.id_imagen, hotspot.destino?.nombre)}
                >
                  <div className={styles.hotspotIconWrap}>
                    <MapPinned size={16} />
                  </div>
                  <div>
                    <strong>{hotspot.destino?.nombre || "Vista conectada"}</strong>
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
