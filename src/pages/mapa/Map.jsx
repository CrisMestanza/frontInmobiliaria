import { withApiBase } from "../../config/api.js";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import {
  GoogleMap,
  Marker,
  MarkerClusterer,
  DirectionsRenderer,
} from "@react-google-maps/api";
import ProyectoSidebar from "./MapSidebarProyecto";
import MapSidebar from "./MapSidebar";
import PolygonOverlay from "./PolygonOverlay";
import SpacePatternOverlay, {
  getSpacePatternPreviewStyle,
} from "./SpacePatternOverlay";
import CustomSelect from "./CustomSelect";
import styles from "./Mapa.module.css";
import ChatBotPanel from "../mybot/ChatBotPanel";
import loader from "../../components/loader";
import GeoHabitaLoader from "../../components/GeoHabitaLoader";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ThemeSwitch from "../../components/ThemeSwitch";
import { useTheme } from "../../context/ThemeContext";

const defaultCenter = { lat: -6.487753, lng: -76.359871 };
const LIBRARIES = ["places"];
const GEOLOCATION_ONBOARDING_DONE_KEY = "geoHabitaGeolocationOnboardingDone";

const RANGOS_PRECIO = [
  { label: "$. 5,000 - 15,000", value: "5000-15000" },
  { label: "$. 15,001 - 35,000", value: "15001-35000" },
  { label: "$. 35,001 - 80,000", value: "35001-80000" },
  { label: "$. 80,001 - 150,000", value: "80001-150000" },
  { label: "$. 150,001 - 250,000", value: "150001-250000" },
  { label: "$. 250,001 - más", value: "250001-999999999" },
];

const LotesOverlay = ({
  lotes,
  selectedLote,
  hoveredLote,
  mapZoom = 13,
  isMobile = false,
  enableHalos = true,
  onLoteClick,
  onLoteMouseOver,
  onLoteMouseOut,
}) => {
  const darkenColor = (hex, amount = 0.2) => {
    let c = hex.replace("#", "");
    if (c.length === 8) c = c.substring(0, 6);
    let num = parseInt(c, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));
    return `rgb(${r},${g},${b})`;
  };

  const getStatusMeta = (estado) => {
    switch (estado) {
      case 0:
        return {
          label: "Disponible",
          color: "#00c95f",
          accent: "#6ee7b7",
        };
      case 1:
        return {
          label: "Vendido",
          color: "#ef4444",
          accent: "#fca5a5",
        };
      case 2:
        return {
          label: "Reservado",
          color: "#f59e0b",
          accent: "#fde68a",
        };
      default:
        return {
          label: "No definido",
          color: "#64748b",
          accent: "#cbd5e1",
        };
    }
  };

  const getColorLote = (estado, hovered) => {
    let baseColor;
    switch (estado) {
      case 0:
        baseColor = "#00c95f";
        break;
      case 1:
        baseColor = "#ef4444";
        break;
      case 2:
        baseColor = "#f59e0b";
        break;
      default:
        baseColor = "#64748b";
    }
    if (estado === 1 || estado === 2 || !hovered) {
      return baseColor;
    }
    return darkenColor(baseColor, 0.3);
  };

  return (
    <>
      {lotes.map((lote) => {
        const isLibre = lote.vendido === 0;
        const hasSelected = !!selectedLote?.lote?.idlote;
        const isSelected = selectedLote?.lote?.idlote === lote.idlote;
        const isHovered = hoveredLote === lote.idlote;
        const isDimmed = hasSelected && !isSelected;
        const status = getStatusMeta(lote.vendido);
        const showQuickLabel = isSelected;
        const strokeBaseColor = getColorLote(lote.vendido, isHovered);
        const haloScale = isMobile ? 0.45 : 1;
        const baseHaloOpacity = isMobile ? 0.18 : 0.24;
        const selectedHaloOpacity = isMobile ? 0.32 : 0.5;
        const hoveredHaloOpacity = isMobile ? 0.26 : 0.4;

        return (
          <PolygonOverlay
            key={lote.idlote}
            puntos={lote.puntos}
            path={lote.polygonPath}
            labelPosition={lote.polygonCenter}
            color={strokeBaseColor}
            onClick={isLibre ? () => onLoteClick(lote) : undefined}
            onMouseOver={
              isLibre ? () => onLoteMouseOver(lote.idlote) : undefined
            }
            onMouseOut={isLibre ? onLoteMouseOut : undefined}
            label={
              showQuickLabel
                ? {
                    text: lote.nombre,
                  }
                : null
            }
            options={{
              zIndex: isSelected ? 14 : isHovered ? 13 : 10,
              clickable: isLibre,
              draggable: false,
              editable: false,
              fillOpacity: isSelected
                ? 0.4
                : isHovered
                  ? 0.26
                  : isDimmed
                    ? 0.05
                    : 0.2,
              strokeOpacity: isSelected
                ? 1
                : isHovered
                  ? 0.92
                  : isDimmed
                    ? 0.22
                    : 0.82,
              strokeWeight: isSelected
                ? mapZoom >= 16
                  ? 4
                  : 3.4
                : isHovered
                  ? mapZoom >= 16
                    ? 3.5
                    : 3
                  : mapZoom >= 16
                    ? 2.7
                    : 2.2,
              strokeColor: strokeBaseColor,
              haloColor: enableHalos ? status.color : undefined,
              haloOpacity: isSelected
                ? selectedHaloOpacity
                : isHovered
                  ? hoveredHaloOpacity
                  : isDimmed
                    ? baseHaloOpacity * 0.5
                    : baseHaloOpacity,
              haloWeight:
                (isSelected ? 8 : isHovered ? 6 : isDimmed ? 3 : 5) * haloScale,
            }}
            mapZoom={mapZoom}
          />
        );
      })}
    </>
  );
};

const MemoizedLotesOverlay = React.memo(LotesOverlay);

function MyMap() {
  const { isDark, toggleTheme } = useTheme();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoaded, setIsLoaded] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.google?.maps?.Map &&
      !!window.google?.maps?.places?.Autocomplete,
  );
  const [loadError, setLoadError] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(defaultCenter);
  const [tiposInmo, setTiposInmo] = useState([]);
  const [selectedTipo, setSelectedTipo] = useState("");
  const [selectedRango, setSelectedRango] = useState("");
  const [proyecto, setProyecto] = useState([]);
  const [selectedProyecto, setselectedProyecto] = useState(null);
  const [lotesProyecto, setLotesProyecto] = useState([]);
  const [lotesProyectoBase, setLotesProyectoBase] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [routeMode, setRouteMode] = useState(null);
  const [directions, setDirections] = useState(null);
  const [imagenesProyecto, setImagenesProyecto] = useState(null);
  const [imagenesLote, setImagenesLote] = useState([]);
  const [isProyectoLoading, setIsProyectoLoading] = useState(false);
  const [isLoteLoading, setIsLoteLoading] = useState(false);
  const [puntos, setPuntos] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [hoveredLote, setHoveredLote] = useState(null);
  const [iconosProyecto, setIconosProyecto] = useState([]);
  const [espaciosProyecto, setEspaciosProyecto] = useState([]);
  const [showSpacesLayer, setShowSpacesLayer] = useState(true);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [hoveredSpace, setHoveredSpace] = useState(null);
  const [walkingInfo, setWalkingInfo] = useState(null);
  const [drivingInfo, setDrivingInfo] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [activeAnuncioIndex, setActiveAnuncioIndex] = useState(0);
  const [prevAnuncioIndex, setPrevAnuncioIndex] = useState(null);
  const [isAnuncioAnimating, setIsAnuncioAnimating] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 950 : false,
  );
  const [isDesktopSidebarViewport, setIsDesktopSidebarViewport] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true),
  );
  const [baseMapStyle, setBaseMapStyle] = useState("roadmap");
  const [labelsEnabled, setLabelsEnabled] = useState(true);
  const [reliefEnabled, setReliefEnabled] = useState(false);
  const [mapTypeMenuFor, setMapTypeMenuFor] = useState(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [overlayZoom, setOverlayZoom] = useState(13);
  const [isMapZooming, setIsMapZooming] = useState(false);
  const [mapIntroHintVisible, setMapIntroHintVisible] = useState(false);

  const mapRef = useRef(null);
  const mapTypeListenerRef = useRef(null);
  const mapTypeControlRef = useRef(null);
  const headerRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const boundsDebounceRef = useRef(null);
  const anuncioTimeoutRef = useRef(null);
  const mapIntroHintTimeoutRef = useRef(null);
  const previousMapZoomRef = useRef(mapZoom);
  const isMapZoomingRef = useRef(false);
  const initialViewportHandledRef = useRef(false);
  const [mapHeaderOffsetPx, setMapHeaderOffsetPx] = useState(() =>
    typeof window !== "undefined" ? (window.innerWidth <= 550 ? 66 : 80) : 80,
  );
  const cacheRef = useRef({
    mapProjects: new Map(),
    projectDetail: new Map(),
    projectImages: new Map(),
    loteImages: new Map(),
  });
  const inflightRef = useRef({
    mapProjects: new Map(),
    projectDetail: new Map(),
    projectImages: new Map(),
    loteImages: new Map(),
  });
  const projectDetailAbortRef = useRef(null);
  const projectImagesAbortRef = useRef(null);
  const loteImagesAbortRef = useRef(null);
  const prefetchAbortRef = useRef(null);
  const prefetchIdleRef = useRef(null);
  const pendingShareFocusRef = useRef(null);
  const pendingProjectsRef = useRef(null);
  const pendingGeolocationRef = useRef(null);
  // const inmoId = null;
  const { inmoId } = useParams();
  const [searchParams] = useSearchParams();
  const sharedLoadRef = useRef(null);
  const [filtroBotActivo, setFiltroBotActivo] = useState(false);

  // Usuario
  const [hasSearchedLocation, setHasSearchedLocation] = useState(false);
  const PREFETCH_DETAIL_LIMIT = 8;
  const PREFETCH_IDLE_TIMEOUT = 700;
  const anuncioSlides = useMemo(
    () => [
      {
        text: "Anuncia tu propiedad",
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2L2 7v15h20V7L12 2zm0 2.18L20 8v12H4V8l8-3.82zM7 13h10v2H7z" />
          </svg>
        ),
      },
      {
        text: "Publica tus proyectos",
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10-1h8v9h-8v-9z" />
          </svg>
        ),
      },
      {
        text: "Gestiona tus lotes",
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 3h8v8H3V3zm10 10h8v8h-8v-8zM3 13h8v8H3v-8zm10-10h8v8h-8V3z" />
          </svg>
        ),
      },
      {
        text: "Administra tus proyectos",
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a7 7 0 0 0-7 7v2H3v11h18V11h-2V9a7 7 0 0 0-7-7zm-5 9V9a5 5 0 0 1 10 0v2H7zm2 4h6v2H9v-2z" />
          </svg>
        ),
      },
    ],
    [],
  );
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const anuncioTextWidthPx = useMemo(() => {
    const activeText = anuncioSlides[activeAnuncioIndex]?.text || "";
    // En móvil usamos el texto activo para evitar espacio lateral sobrante.
    return Math.max(128, Math.ceil(activeText.length * 8.2) + 6);
  }, [anuncioSlides, activeAnuncioIndex]);
  const anuncioButtonWidthPx = useMemo(
    () => Math.max(184, anuncioTextWidthPx + 42),
    [anuncioTextWidthPx],
  );
  const getCacheKey = (prefix, id) => `${prefix}_${id}`;
  const parsePositiveInt = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  };
  const sharedProyectoId =
    parsePositiveInt(searchParams.get("proyecto")) ??
    parsePositiveInt(searchParams.get("proyectoId")) ??
    parsePositiveInt(searchParams.get("p"));
  const sharedLoteId =
    parsePositiveInt(searchParams.get("lote")) ??
    parsePositiveInt(searchParams.get("loteId")) ??
    parsePositiveInt(searchParams.get("l"));
  const hasShareParams = Boolean(sharedProyectoId || sharedLoteId);
  const [shareFocusActive, setShareFocusActive] = useState(hasShareParams);
  const [shareResolveStatus, setShareResolveStatus] = useState(
    hasShareParams ? "pending" : "idle",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const shouldShowShareLoader =
    hasShareParams &&
    (shareResolveStatus === "pending" || isProyectoLoading || isLoteLoading);

  const normalizeNumber = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  };

  const normalizePuntosWithOrder = (puntos = []) => {
    const normalized = puntos
      .map((p) => {
        const lat = normalizeNumber(p.latitud ?? p.lat);
        const lng = normalizeNumber(p.longitud ?? p.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          ...p,
          latitud: lat,
          longitud: lng,
          orden:
            p.orden !== null && p.orden !== undefined ? Number(p.orden) : null,
        };
      })
      .filter(Boolean);

    if (normalized.length < 2) return normalized;

    const hasOrder = normalized.every((p) => p.orden !== null);
    if (hasOrder) {
      return [...normalized].sort((a, b) => a.orden - b.orden);
    }

    const center = normalized.reduce(
      (acc, p) => ({ lat: acc.lat + p.latitud, lng: acc.lng + p.longitud }),
      { lat: 0, lng: 0 },
    );
    center.lat /= normalized.length;
    center.lng /= normalized.length;

    return [...normalized].sort((a, b) => {
      const angleA = Math.atan2(
        a.latitud - center.lat,
        a.longitud - center.lng,
      );
      const angleB = Math.atan2(
        b.latitud - center.lat,
        b.longitud - center.lng,
      );
      return angleA - angleB;
    });
  };

  const buildPolygonPath = (puntos = []) =>
    puntos
      .map((p) => ({
        lat: normalizeNumber(p.latitud ?? p.lat),
        lng: normalizeNumber(p.longitud ?? p.lng),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const calculatePolygonCentroid = (path = []) => {
    if (!Array.isArray(path) || path.length < 3) return null;

    let area = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < path.length; i += 1) {
      const j = (i + 1) % path.length;
      const xi = path[i].lng;
      const yi = path[i].lat;
      const xj = path[j].lng;
      const yj = path[j].lat;
      const factor = xi * yj - xj * yi;
      area += factor;
      cx += (xi + xj) * factor;
      cy += (yi + yj) * factor;
    }

    if (!area) return path[0] || null;

    const normalizedArea = area * 0.5;
    return {
      lat: cy / (6 * normalizedArea),
      lng: cx / (6 * normalizedArea),
    };
  };

  const normalizePolygonPoints = (puntos = []) => {
    const ordered = normalizePuntosWithOrder(puntos);
    const path = buildPolygonPath(ordered);
    return {
      puntos: ordered,
      polygonPath: path,
      polygonCenter: calculatePolygonCentroid(path),
    };
  };

  const normalizeLoteDetalle = (lote) => {
    if (!lote) return null;
    const geometry = normalizePolygonPoints(lote.puntos || []);
    return {
      ...lote,
      ...geometry,
    };
  };

  const normalizeEspacioDetalle = (espacio) => {
    if (!espacio) return null;
    const geometry = normalizePolygonPoints(espacio.puntos || []);
    return {
      ...espacio,
      ...geometry,
      centerLat: normalizeNumber(espacio.centro_lat),
      centerLng: normalizeNumber(espacio.centro_lng),
      tipoespacio: espacio.tipoespacio || {},
    };
  };

  const normalizeProyectoShape = (proyectoDetalle, puntosProyecto = []) => {
    const geometry = normalizePolygonPoints(puntosProyecto);
    return {
      proyecto: proyectoDetalle,
      puntos: geometry.puntos,
      polygonPath: geometry.polygonPath,
      polygonCenter: geometry.polygonCenter,
    };
  };

  const resolveIconUrl = (rawUrl) => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith("http")) return rawUrl;
    return withApiBase(`https://api.geohabita.com${rawUrl}`);
  };

  const normalizeIconos = (items = []) =>
    items
      .map((ico) => {
        const lat = normalizeNumber(
          ico.latitud ?? ico.lat ?? ico.latitude ?? ico.y,
        );
        const lng = normalizeNumber(
          ico.longitud ?? ico.lng ?? ico.longitude ?? ico.x,
        );
        const detalle = ico.icono_detalle || ico.icono || ico.detalle || {};
        const rawUrl = detalle.imagen || ico.imagen || ico.url;
        const iconUrl = resolveIconUrl(rawUrl);
        return {
          ...ico,
          latitud: lat,
          longitud: lng,
          iconUrl,
          iconName: detalle.nombre || ico.nombre || "Ícono",
        };
      })
      .filter(
        (ico) =>
          Number.isFinite(ico.latitud) &&
          Number.isFinite(ico.longitud) &&
          !!ico.iconUrl,
      );

  const normalizeProyectoImagenes = (items = []) =>
    Array.isArray(items) ? items.filter((img) => !!img?.imagenproyecto) : [];

  const normalizeLoteImagenes = (items = []) =>
    Array.isArray(items) ? items.filter((img) => !!img?.imagen) : [];

  const readSessionCache = (key) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) {
        sessionStorage.removeItem(key);
        return null;
      }
      return parsed.data ?? null;
    } catch {
      return null;
    }
  };

  const writeSessionCache = (key, data) => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // ignore storage errors
    }
  };

  const getCached = (bucket, id, prefix) => {
    const mem = cacheRef.current[bucket].get(id);
    if (mem) return mem;
    const fromSession = readSessionCache(getCacheKey(prefix, id));
    if (fromSession) {
      cacheRef.current[bucket].set(id, fromSession);
      return fromSession;
    }
    return null;
  };

  const setCached = (bucket, id, prefix, data) => {
    cacheRef.current[bucket].set(id, data);
    writeSessionCache(getCacheKey(prefix, id), data);
  };

  const loadMapProjects = async ({
    tipo = "",
    rango = "",
    inmo = "",
    signal,
  } = {}) => {
    const query = new URLSearchParams();
    if (tipo) query.set("tipo", String(tipo));
    if (rango) query.set("rango", String(rango));
    if (inmo) query.set("inmo", String(inmo));
    const cacheKey = query.toString() || "all";
    const cached = getCached("mapProjects", cacheKey, "map_projects");
    if (cached) return cached;

    const inflight = inflightRef.current.mapProjects.get(cacheKey);
    if (inflight) return inflight;

    const url = withApiBase(
      `https://api.geohabita.com/api/mapa/proyectos/${query.toString() ? `?${query.toString()}` : ""}`,
    );
    const request = fetch(url, { signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const normalized = Array.isArray(data) ? data : [];
        setCached("mapProjects", cacheKey, "map_projects", normalized);
        return normalized;
      })
      .finally(() => {
        inflightRef.current.mapProjects.delete(cacheKey);
      });

    inflightRef.current.mapProjects.set(cacheKey, request);
    return request;
  };

  const loadProyectoDetalle = async (idproyecto, signal) => {
    const cached = getCached("projectDetail", idproyecto, "project_detail");
    if (cached) return cached;

    const inflight = inflightRef.current.projectDetail.get(idproyecto);
    if (inflight) return inflight;

    const url = withApiBase(
      `https://api.geohabita.com/api/mapa/proyecto_detalle/${idproyecto}/`,
    );
    const request = fetch(url, { signal })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar detalle de proyecto");
        return res.json();
      })
      .then((data) => {
        setCached("projectDetail", idproyecto, "project_detail", data);
        return data;
      })
      .finally(() => {
        inflightRef.current.projectDetail.delete(idproyecto);
      });

    inflightRef.current.projectDetail.set(idproyecto, request);
    return request;
  };

  const loadProyectoImagenes = async (idproyecto, signal) => {
    const cached = getCached("projectImages", idproyecto, "project_images");
    if (cached) return cached;

    const inflight = inflightRef.current.projectImages.get(idproyecto);
    if (inflight) return inflight;

    const url = withApiBase(
      `https://api.geohabita.com/api/list_imagen_proyecto/${idproyecto}`,
    );
    const request = fetch(url, { signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const normalized = Array.isArray(data) ? data : [];
        setCached("projectImages", idproyecto, "project_images", normalized);
        return normalized;
      })
      .finally(() => {
        inflightRef.current.projectImages.delete(idproyecto);
      });

    inflightRef.current.projectImages.set(idproyecto, request);
    return request;
  };

  const loadLoteImagenes = async (idlote, signal) => {
    const cached = getCached("loteImages", idlote, "lote_images");
    if (cached) return cached;

    const inflight = inflightRef.current.loteImages.get(idlote);
    if (inflight) return inflight;

    const url = withApiBase(
      `https://api.geohabita.com/api/list_imagen/${idlote}`,
    );
    const request = fetch(url, { signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const normalized = Array.isArray(data) ? data : [];
        setCached("loteImages", idlote, "lote_images", normalized);
        return normalized;
      })
      .finally(() => {
        inflightRef.current.loteImages.delete(idlote);
      });

    inflightRef.current.loteImages.set(idlote, request);
    return request;
  };

  const updateBoundsFromMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    setMapBounds({
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    });
  }, []);

  const scheduleBoundsUpdate = useCallback(() => {
    if (boundsDebounceRef.current) {
      clearTimeout(boundsDebounceRef.current);
    }
    boundsDebounceRef.current = setTimeout(() => {
      updateBoundsFromMap();
    }, 120);
  }, [updateBoundsFromMap]);

  useEffect(() => {
    return () => {
      if (boundsDebounceRef.current) {
        clearTimeout(boundsDebounceRef.current);
      }
      if (mapTypeListenerRef.current) {
        mapTypeListenerRef.current.remove();
        mapTypeListenerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapTypeMenuFor) return undefined;
    const handleOutside = (event) => {
      const node = mapTypeControlRef.current;
      if (!node || node.contains(event.target)) return;
      setMapTypeMenuFor(null);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [mapTypeMenuFor]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const measureHeaderOffset = () => {
      const el = headerRef.current;
      if (!el) {
        setMapHeaderOffsetPx(window.innerWidth <= 550 ? 66 : 80);
        return;
      }
      const styles = window.getComputedStyle(el);
      const isHidden =
        styles.display === "none" ||
        styles.visibility === "hidden" ||
        Number(styles.opacity) === 0;
      if (isHidden) {
        setMapHeaderOffsetPx(0);
        return;
      }
      setMapHeaderOffsetPx(Math.round(el.getBoundingClientRect().height));
    };

    const onResize = () => {
      setIsMobileViewport(window.innerWidth <= 950);
      setIsDesktopSidebarViewport(window.innerWidth >= 1024);
      measureHeaderOffset();
    };

    measureHeaderOffset();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isSidebarOpen = !!(selectedProyecto || selectedLote);
  const shouldShrinkMapForSidebar = isDesktopSidebarViewport && isSidebarOpen;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const t = setTimeout(() => {
      window.google.maps.event.trigger(map, "resize");
    }, 220);

    return () => clearTimeout(t);
  }, [shouldShrinkMapForSidebar]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAnuncioIndex((current) => {
        const next = (current + 1) % anuncioSlides.length;
        setPrevAnuncioIndex(current);
        setIsAnuncioAnimating(true);
        if (anuncioTimeoutRef.current) clearTimeout(anuncioTimeoutRef.current);
        anuncioTimeoutRef.current = setTimeout(() => {
          setIsAnuncioAnimating(false);
          setPrevAnuncioIndex(null);
        }, 560);
        return next;
      });
    }, 2800);

    return () => {
      clearInterval(interval);
      if (anuncioTimeoutRef.current) clearTimeout(anuncioTimeoutRef.current);
    };
  }, [anuncioSlides.length]);

  const getProjectIconUrl = (p) => {
    const tipoInmo = Number(p.idtipoinmobiliaria);
    const estado = Number(p.estado);

    if (filtroBotActivo) {
      return p.iconoTipo === "casa"
        ? "https://cdn-icons-png.freepik.com/512/11130/11130373.png"
        : "/proyectoicono.png";
    }

    return estado === 1 && tipoInmo === 1
      ? "/proyectoicono.png"
      : "https://cdn-icons-png.freepik.com/512/11130/11130373.png";
  };

  const clusterOptions = useMemo(() => {
    return {
      averageCenter: true,
      enableRetinaIcons: true,
      gridSize: isMobileViewport ? 38 : 46,
      maxZoom: 17,
      minimumClusterSize: 2,
      styles: [
        {
          url: "/proyectoicono.png",
          width: 56,
          height: 56,
          textColor: "#ffffff",
          textSize: 12,
          anchorText: [-2, 0],
        },
        {
          url: "/proyectoicono.png",
          width: 64,
          height: 64,
          textColor: "#ffffff",
          textSize: 13,
          anchorText: [-2, 0],
        },
        {
          url: "/proyectoicono.png",
          width: 72,
          height: 72,
          textColor: "#ffffff",
          textSize: 14,
          anchorText: [-2, 0],
        },
      ],
      calculator: (markers) => {
        const count = markers.length;
        if (count < 10) return { text: String(count), index: 1, title: `${count} proyectos` };
        if (count < 40) return { text: String(count), index: 2, title: `${count} proyectos` };
        return { text: String(count), index: 3, title: `${count} proyectos` };
      },
    };
  }, [isMobileViewport]);

  const getSpaceColor = useCallback((espacio) => {
    const raw = espacio?.tipoespacio?.color;
    return typeof raw === "string" && raw.trim() ? raw : "#22c55e";
  }, []);

  const getSpaceVisualStyle = useCallback(
    (espacio) => {
      const color = getSpaceColor(espacio);
      const kind = String(
        espacio?.tipoespacio?.slug || espacio?.tipoespacio?.nombre || "",
      )
        .toLowerCase()
        .trim();

      if (
        kind.includes("parque") ||
        kind.includes("area-verde") ||
        kind.includes("área verde")
      ) {
        return {
          fillColor: color,
          fillOpacity: selectedSpace?.idespacio === espacio.idespacio ? 0.34 : 0.26,
          strokeColor: "#166534",
          strokeWeight: selectedSpace?.idespacio === espacio.idespacio ? 3.4 : 2.6,
          haloColor: "#86efac",
          haloOpacity: selectedSpace?.idespacio === espacio.idespacio ? 0.36 : 0.24,
          haloWeight: selectedSpace?.idespacio === espacio.idespacio ? 8 : 6,
          zIndex: selectedSpace?.idespacio === espacio.idespacio ? 7 : 5,
        };
      }

      return {
        fillColor: color,
        fillOpacity: selectedSpace?.idespacio === espacio.idespacio ? 0.34 : 0.22,
        strokeColor: color,
        strokeWeight: selectedSpace?.idespacio === espacio.idespacio ? 3 : 2,
        haloColor: color,
        haloOpacity: selectedSpace?.idespacio === espacio.idespacio ? 0.34 : 0.22,
        haloWeight: selectedSpace?.idespacio === espacio.idespacio ? 7 : 5,
        zIndex: selectedSpace?.idespacio === espacio.idespacio ? 7 : 5,
      };
    },
    [getSpaceColor, selectedSpace],
  );

  const getSpaceIconUrl = useCallback((espacio) => {
    const color = getSpaceColor(espacio);
    const text = String(
      espacio?.tipoespacio?.nombre?.slice(0, 2) ||
        espacio?.nombre?.slice(0, 2) ||
        "E",
    )
      .toUpperCase()
      .replace(/\s+/g, "")
      .slice(0, 2);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="${color}" fill-opacity="0.92" />
        <circle cx="22" cy="22" r="18" fill="none" stroke="#ffffff" stroke-width="2.5" />
        <text x="22" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${text}</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, [getSpaceColor]);

  const preloadImage = useCallback((url) => {
    if (!url || typeof window === "undefined") return;
    const img = new Image();
    img.src = url;
  }, []);

  const focusMapOnLocation = useCallback((location, viewport = null) => {
    if (!location) return;

    setCurrentPosition(location);
    setHasSearchedLocation(true);

    const map = mapRef.current;
    if (!map) return;

    if (viewport) {
      map.fitBounds(viewport);
      return;
    }

    map.panTo(location);
    map.setZoom(17);
    setMapZoom(17);
    setOverlayZoom(17);
  }, []);

  const geocodeSearchQuery = useCallback(async () => {
    const rawQuery = inputRef.current?.value ?? searchQuery;
    const query = String(rawQuery || "").trim();
    if (!query || !window.google?.maps?.Geocoder) return;

    try {
      const geocoder = new window.google.maps.Geocoder();
      const results = await geocoder.geocode({ address: query });
      const place = results?.results?.[0];
      const geometry = place?.geometry;
      if (!geometry?.location) return;

      const location = {
        lat: geometry.location.lat(),
        lng: geometry.location.lng(),
      };
      focusMapOnLocation(location, geometry.viewport || null);
    } catch (error) {
      console.error("No se pudo geocodificar la búsqueda:", error);
    }
  }, [focusMapOnLocation, searchQuery]);

  const isSelectedProjectCasa = useMemo(() => {
    if (!selectedProyecto) return false;
    if (filtroBotActivo) return selectedProyecto.iconoTipo === "casa";
    const tipoInmo = Number(selectedProyecto.idtipoinmobiliaria);
    const estado = Number(selectedProyecto.estado);
    return !(estado === 1 && tipoInmo === 1);
  }, [selectedProyecto, filtroBotActivo]);

  const visibleSpaceLegend = useMemo(() => {
    const typeMap = new Map();
    espaciosProyecto.forEach((espacio) => {
      const tipo = espacio?.tipoespacio || {};
      const key =
        tipo.slug ||
        tipo.idtipoespacio ||
        tipo.nombre ||
        espacio?.idespacio ||
        Math.random();
      if (!typeMap.has(key)) {
        typeMap.set(key, {
          key,
          nombre: tipo.nombre || "Espacio",
          color: getSpaceColor(espacio),
          total: 0,
        });
      }
      typeMap.get(key).total += 1;
    });
    return Array.from(typeMap.values()).sort(
      (a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre),
    );
  }, [espaciosProyecto, getSpaceColor]);

  const activeSpaceCard = selectedSpace || hoveredSpace;

  const visibleProyectos = useMemo(() => {
    if (shareFocusActive && (selectedProyecto || selectedLote)) {
      return [];
    }

    const filtered = proyecto.filter((p) => {
      if (
        selectedProyecto &&
        ((puntos.length > 0 && selectedProyecto.idproyecto === p.idproyecto) ||
          selectedProyecto.idproyecto === p.idproyecto)
      ) {
        return false;
      }

      const lat = normalizeNumber(p.latitud);
      const lng = normalizeNumber(p.longitud);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

      if (!mapBounds) return true;

      return (
        lat <= mapBounds.north &&
        lat >= mapBounds.south &&
        lng <= mapBounds.east &&
        lng >= mapBounds.west
      );
    });

    return filtered;
  }, [proyecto, selectedProyecto, puntos.length, mapBounds, shareFocusActive]);

  useEffect(() => {
    if (!isLoaded || visibleProyectos.length === 0) return undefined;

    if (prefetchIdleRef.current) {
      if (typeof window !== "undefined" && window.cancelIdleCallback) {
        window.cancelIdleCallback(prefetchIdleRef.current);
      } else {
        clearTimeout(prefetchIdleRef.current);
      }
      prefetchIdleRef.current = null;
    }

    const schedule = (cb) => {
      if (typeof window !== "undefined" && window.requestIdleCallback) {
        return window.requestIdleCallback(cb, {
          timeout: PREFETCH_IDLE_TIMEOUT,
        });
      }
      return setTimeout(cb, 220);
    };

    prefetchIdleRef.current = schedule(() => {
      if (prefetchAbortRef.current) {
        prefetchAbortRef.current.abort();
      }
      const controller = new AbortController();
      prefetchAbortRef.current = controller;

      const candidates = visibleProyectos.slice(0, PREFETCH_DETAIL_LIMIT);
      candidates.forEach((p) => {
        const id = p?.idproyecto;
        if (!id) return;
        const cached = getCached("projectDetail", id, "project_detail");
        if (cached) return;
        loadProyectoDetalle(id, controller.signal).catch(() => null);
      });
    });

    return () => {
      if (prefetchIdleRef.current) {
        if (typeof window !== "undefined" && window.cancelIdleCallback) {
          window.cancelIdleCallback(prefetchIdleRef.current);
        } else {
          clearTimeout(prefetchIdleRef.current);
        }
        prefetchIdleRef.current = null;
      }
      if (prefetchAbortRef.current) {
        prefetchAbortRef.current.abort();
        prefetchAbortRef.current = null;
      }
    };
  }, [
    isLoaded,
    visibleProyectos,
    PREFETCH_DETAIL_LIMIT,
    PREFETCH_IDLE_TIMEOUT,
  ]);

  // ✅ FIX: Load Google Maps API properly with all required libraries
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        // Check if already loaded
        if (
          window.google?.maps?.places?.Autocomplete &&
          window.google?.maps?.Map
        ) {
          console.log("Google Maps API ya está cargada");
          setIsLoaded(true);
          return;
        }

        console.log("Cargando Google Maps API...");
        await loader.load();

        // Wait a bit to ensure all libraries are initialized
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify critical APIs are available
        if (!window.google?.maps?.Map) {
          throw new Error("google.maps.Map no está disponible");
        }
        if (!window.google?.maps?.places?.Autocomplete) {
          throw new Error("google.maps.places.Autocomplete no está disponible");
        }

        console.log("Google Maps API cargada correctamente");
        setIsLoaded(true);
      } catch (error) {
        console.error("Error al cargar Google Maps API:", error);
        setLoadError(error);
      }
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    preloadImage("/proyectoicono.png");
    preloadImage("https://cdn-icons-png.freepik.com/512/11130/11130373.png");
  }, [preloadImage]);

  useEffect(() => {
    return () => {
      if (mapIntroHintTimeoutRef.current) {
        clearTimeout(mapIntroHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Solo intentar geolocalizar una vez por usuario para evitar recentrados inesperados.
    let onboardingDone = false;
    try {
      onboardingDone =
        localStorage.getItem(GEOLOCATION_ONBOARDING_DONE_KEY) === "1";
    } catch {
      onboardingDone = false;
    }

    if (onboardingDone || hasSearchedLocation || inmoId) return;

    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const nextPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        try {
          localStorage.setItem(GEOLOCATION_ONBOARDING_DONE_KEY, "1");
        } catch {
          // ignore storage errors
        }
        if (selectedProyecto || selectedLote || shareFocusActive) {
          pendingGeolocationRef.current = nextPosition;
          return;
        }
        setCurrentPosition(nextPosition);
      },
      () => {
        console.warn("Permiso de ubicación denegado.");
        try {
          localStorage.setItem(GEOLOCATION_ONBOARDING_DONE_KEY, "1");
        } catch {
          // ignore storage errors
        }
      },
    );
  }, [
    hasSearchedLocation,
    inmoId,
    selectedProyecto,
    selectedLote,
    shareFocusActive,
  ]);

  useEffect(() => {
    if (hasSearchedLocation) {
      pendingGeolocationRef.current = null;
      return;
    }
    if (selectedProyecto || selectedLote || shareFocusActive) return;
    if (!pendingGeolocationRef.current) return;
    setCurrentPosition(pendingGeolocationRef.current);
    pendingGeolocationRef.current = null;
  }, [hasSearchedLocation, selectedProyecto, selectedLote, shareFocusActive]);

  const filterLotesByRango = useCallback((lotesSource, rango) => {
    if (!rango) return lotesSource;
    const [min, max] = String(rango).split("-").map(Number);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return lotesSource;
    return lotesSource.filter((l) => {
      const price = Number(l?.precio);
      return Number.isFinite(price) && price >= min && price <= max;
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) return undefined;
    const controller = new AbortController();

    const run = async () => {
      try {
        const data = await loadMapProjects({
          tipo: selectedTipo || "",
          rango: selectedRango || "",
          inmo: inmoId || "",
          signal: controller.signal,
        });
          if (!controller.signal.aborted) {
          if (hasShareParams && shareResolveStatus === "pending") {
            pendingProjectsRef.current = data;
          } else {
            setProyecto(data);
          }
          if (
            !hasSearchedLocation &&
            data.length > 0 &&
            mapRef.current &&
            window.google?.maps
          ) {
            const shouldSkipInitialFit =
              !initialViewportHandledRef.current &&
              !selectedTipo &&
              !selectedRango &&
              !inmoId &&
              !hasSearchedLocation;
            if (shouldSkipInitialFit) {
              initialViewportHandledRef.current = true;
              return;
            }
            if (
              hasShareParams &&
              (shareFocusActive || shareResolveStatus === "pending")
            ) {
              initialViewportHandledRef.current = true;
              return;
            }

            const bounds = new window.google.maps.LatLngBounds();
            data.forEach((p) => {
              const lat = normalizeNumber(p.latitud);
              const lng = normalizeNumber(p.longitud);
              if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                bounds.extend({ lat, lng });
              }
            });
            if (!bounds.isEmpty()) {
              mapRef.current.fitBounds(bounds);
            }
          }
          initialViewportHandledRef.current = true;
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Error cargando marcadores de mapa:", error);
        }
      }
    };

    run();
    return () => controller.abort();
  }, [
    selectedTipo,
    selectedRango,
    inmoId,
    isLoaded,
    hasShareParams,
    shareResolveStatus,
    shareFocusActive,
    hasSearchedLocation,
  ]);

  useEffect(() => {
    if (!sharedProyectoId && !sharedLoteId) return;

    const key = `${inmoId || "all"}:${sharedProyectoId || "none"}:${sharedLoteId || "none"}`;
    if (sharedLoadRef.current === key) return;
    sharedLoadRef.current = key;

    if (!shareFocusActive) {
      setShareFocusActive(true);
    }
    setShareResolveStatus("pending");

    openSharedSelection(sharedProyectoId, sharedLoteId);
  }, [inmoId, sharedProyectoId, sharedLoteId]);

  useEffect(() => {
    if (!hasShareParams) {
      if (shareFocusActive) setShareFocusActive(false);
      if (shareResolveStatus !== "idle") setShareResolveStatus("idle");
      return;
    }
    if (
      shareResolveStatus === "resolved" &&
      shareFocusActive &&
      !selectedProyecto &&
      !selectedLote
    ) {
      setShareFocusActive(false);
    }
    if (
      shareResolveStatus === "resolved" &&
      pendingProjectsRef.current &&
      (!selectedProyecto || !shareFocusActive)
    ) {
      setProyecto(pendingProjectsRef.current);
      pendingProjectsRef.current = null;
    }
  }, [
    hasShareParams,
    shareFocusActive,
    selectedProyecto,
    selectedLote,
    shareResolveStatus,
  ]);

  useEffect(() => {
    if (!isLoaded || !inmoId) return;
    if (hasSearchedLocation) return;
    if (
      hasShareParams &&
      (shareFocusActive || shareResolveStatus === "pending")
    ) {
      return;
    }
    if (!mapRef.current || !window.google?.maps || !proyecto.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    proyecto.forEach((p) => {
      const lat = normalizeNumber(p.latitud);
      const lng = normalizeNumber(p.longitud);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        bounds.extend({ lat, lng });
      }
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds);
      updateBoundsFromMap();
    }
  }, [
    isLoaded,
    inmoId,
    proyecto,
    updateBoundsFromMap,
    hasSearchedLocation,
    hasShareParams,
    shareFocusActive,
    shareResolveStatus,
  ]);

  useEffect(() => {
    const idlote = selectedLote?.lote?.idlote;
    if (!idlote) {
      setImagenesLote([]);
      return undefined;
    }

    if (loteImagesAbortRef.current) {
      loteImagesAbortRef.current.abort();
    }
    const controller = new AbortController();
    loteImagesAbortRef.current = controller;

    loadLoteImagenes(idlote, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setImagenesLote(data);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Error cargando imágenes:", err);
        }
      });

    return () => controller.abort();
  }, [selectedLote]);

  useEffect(() => {
    const idproyecto = selectedProyecto?.idproyecto;
    if (!idproyecto) {
      setImagenesProyecto(null);
      return undefined;
    }

    if (projectImagesAbortRef.current) {
      projectImagesAbortRef.current.abort();
    }
    const controller = new AbortController();
    projectImagesAbortRef.current = controller;
    setImagenesProyecto(null);

    loadProyectoImagenes(idproyecto, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setImagenesProyecto(data);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Error cargando imágenes:", err);
        }
      });

    return () => controller.abort();
  }, [selectedProyecto]);

  useEffect(() => {
    if (!selectedProyecto) return;
    setLotesProyecto(filterLotesByRango(lotesProyectoBase, selectedRango));
  }, [selectedProyecto, selectedRango, lotesProyectoBase, filterLotesByRango]);

  useEffect(() => {
    fetch(withApiBase("https://api.geohabita.com/api/listTipoInmobiliaria/"))
      .then((res) => res.json())
      .then(setTiposInmo)
      .catch(console.error);
  }, []);

  const handleTipoChange = (tipoId) => {
    // Convertimos a número porque el value del select siempre viene como string
    const idNumerico = tipoId === "" ? "" : Number(tipoId);

    if (selectedTipo === idNumerico) {
      setSelectedTipo("");
    } else {
      setSelectedTipo(idNumerico);
      setSelectedRango(""); // Resetea el otro filtro
    }
    setFiltroBotActivo(false);
  };

  const handleRangoChange = (rango) => {
    if (selectedRango === rango) {
      // Si vuelve a hacer clic en el mismo rango → deseleccionar
      setSelectedRango("");
    } else {
      setSelectedRango(rango);
      // 🔹 Cuando se selecciona un rango, se borra el tipo
      setSelectedTipo("");
    }

    // 🔹 Además, desactivar el filtro del bot
    setFiltroBotActivo(false);
  };

  useEffect(() => {
    // El filtro de resultados del bot invalida selección manual.
    if (!filtroBotActivo) return;
    if (selectedTipo || selectedRango) {
      setFiltroBotActivo(false);
    }
  }, [filtroBotActivo, selectedTipo, selectedRango]);

  const calculateInfo = (mode, proyecto) => {
    if (!window.google?.maps?.DirectionsService) {
      console.warn("DirectionsService no disponible");
      return;
    }

    const lat = normalizeNumber(proyecto.latitud);
    const lng = normalizeNumber(proyecto.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: currentPosition,
        destination: {
          lat,
          lng,
        },
        travelMode: mode,
      },
      (result, status) => {
        if (status === "OK") {
          const leg = result.routes[0].legs[0];
          const info = {
            distance: leg.distance.text,
            duration: leg.duration.text,
          };
          if (mode === "WALKING") setWalkingInfo(info);
          if (mode === "DRIVING") setDrivingInfo(info);
        }
      },
    );
  };

  const handleLoteClick = (lote) => {
    if (isMobile()) {
      setShowFilters(false);
    }

    if (mapRef.current && window.google?.maps) {
      const lat = normalizeNumber(lote.latitud);
      const lng = normalizeNumber(lote.longitud);

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const map = mapRef.current;
        const target = { lat, lng };
        const currentBounds = map.getBounds();
        const targetLatLng = new window.google.maps.LatLng(lat, lng);

        if (!currentBounds || !currentBounds.contains(targetLatLng)) {
          map.panTo(target);
        }

        const currentZoom = map.getZoom() ?? 0;
        if (currentZoom < 13) {
          map.setZoom(14);
        }
      }
    }

    setSelectedLote({
      lote: lote, // ✅ YA incluye puntos
      inmo: selectedProyecto?.inmo ?? null,
    });
  };

  const isMobile = () => window.innerWidth <= 768;

  const resolveMapTypeId = useCallback((style, labels, relief) => {
    if (style === "satellite") {
      return labels ? "hybrid" : "satellite";
    }
    return relief ? "terrain" : "roadmap";
  }, []);

  const getProjectIconSize = useCallback((zoom, isMobile = false) => {
    const safeZoom = Number.isFinite(zoom) ? zoom : 13;
    const base = Math.max(22, Math.min(34, Math.round(safeZoom * 2)));
    return Math.max(18, Math.round(base * (isMobile ? 0.85 : 1)));
  }, []);

  const applyMapType = useCallback(
    (style, labels, relief) => {
      const nextType = resolveMapTypeId(style, labels, relief);
      const map = mapRef.current;
      if (map && typeof map.setMapTypeId === "function") {
        map.setMapTypeId(nextType);
      }
    },
    [resolveMapTypeId],
  );

  const handleSetBaseMapStyle = useCallback(
    (nextStyle) => {
      setBaseMapStyle(nextStyle);
      applyMapType(nextStyle, labelsEnabled, reliefEnabled);
      setMapTypeMenuFor((prev) => (prev === nextStyle ? null : nextStyle));
    },
    [applyMapType, labelsEnabled, reliefEnabled],
  );

  const handleSetSatelliteLabels = useCallback(
    (next) => {
      setLabelsEnabled(next);
      if (baseMapStyle === "satellite") {
        applyMapType("satellite", next, reliefEnabled);
      }
    },
    [applyMapType, baseMapStyle, reliefEnabled],
  );

  const handleSetMapRelief = useCallback(
    (next) => {
      setReliefEnabled(next);
      if (baseMapStyle === "roadmap") {
        applyMapType("roadmap", labelsEnabled, next);
      }
    },
    [applyMapType, baseMapStyle, labelsEnabled],
  );

  const getProjectMobilePadding = useCallback(() => {
    if (typeof window === "undefined") {
      return { top: 16, right: 16, bottom: 16, left: 16 };
    }
    const header = Math.max(0, Number(mapHeaderOffsetPx) || 0);
    const vh = window.innerHeight;
    const available = Math.max(220, vh - header);
    const midTop = header + available * 0.5;
    const coveredBottom = Math.max(0, vh - midTop);
    return {
      top: 16,
      right: 16,
      bottom: Math.round(coveredBottom + 16),
      left: 16,
    };
  }, [mapHeaderOffsetPx]);

  const fitBoundsForProjectFocus = useCallback(
    (map, bounds) => {
      if (!map || !bounds) return;
      if (isMobile()) {
        map.fitBounds(bounds, getProjectMobilePadding());
        return;
      }
      map.fitBounds(bounds);
    },
    [getProjectMobilePadding],
  );

  const centerPointForProjectFocus = useCallback(
    (map, target) => {
      if (!map || !target || !window.google?.maps) return;
      if (!isMobile()) {
        map.panTo(target);
        return;
      }
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(target);
      bounds.extend(target);
      map.fitBounds(bounds, getProjectMobilePadding());
      window.google.maps.event.addListenerOnce(map, "idle", () => {
        const currentZoom = map.getZoom() ?? 0;
        if (currentZoom > 17) {
          map.setZoom(17);
        }
      });
    },
    [getProjectMobilePadding],
  );

  const focusMapForShare = useCallback(
    ({ map, proyectoDetalle, dataPuntos, loteTarget }) => {
      if (!map || !window.google?.maps) return;

      if (loteTarget) {
        const lotePoints = normalizePuntosWithOrder(loteTarget.puntos || []);
        if (lotePoints.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          lotePoints.forEach((p) =>
            bounds.extend({
              lat: Number(p.latitud),
              lng: Number(p.longitud),
            }),
          );
          fitBoundsForProjectFocus(map, bounds);
          window.google.maps.event.addListenerOnce(map, "idle", () => {
            const currentZoom = map.getZoom() ?? 0;
            if (currentZoom > 0) {
              map.setZoom(Math.max(currentZoom - 2, 12));
            }
          });
          return;
        }

        const lat = normalizeNumber(loteTarget.latitud);
        const lng = normalizeNumber(loteTarget.longitud);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.panTo({ lat, lng });
          map.setZoom(14);
          return;
        }
      }

      if (dataPuntos.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        dataPuntos.forEach((p) =>
          bounds.extend({
            lat: Number(p.latitud),
            lng: Number(p.longitud),
          }),
        );
        fitBoundsForProjectFocus(map, bounds);
        return;
      }

      const lat = normalizeNumber(proyectoDetalle?.latitud);
      const lng = normalizeNumber(proyectoDetalle?.longitud);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        centerPointForProjectFocus(map, { lat, lng });
      }
    },
    [centerPointForProjectFocus, fitBoundsForProjectFocus],
  );

  const resolveShareTarget = async (proyectoId, loteId, signal) => {
    if (proyectoId || !loteId) {
      return { proyectoId, loteId, inmoIdFromLote: null };
    }
    try {
      const res = await fetch(
        withApiBase(`https://api.geohabita.com/api/list_lote_id/${loteId}`),
        { signal },
      );
      if (!res.ok) return { proyectoId: null, loteId, inmoIdFromLote: null };
      const data = await res.json();
      const loteInfo = Array.isArray(data) ? data[0] : data;
      const resolvedProyectoId =
        parsePositiveInt(loteInfo?.idproyecto) ??
        parsePositiveInt(loteInfo?.idproyecto_id) ??
        parsePositiveInt(loteInfo?.proyectos?.idproyecto);
      const resolvedInmoId =
        parsePositiveInt(loteInfo?.inmobiliaria?.idinmobiliaria) ??
        parsePositiveInt(loteInfo?.proyectos?.idinmobiliaria) ??
        parsePositiveInt(loteInfo?.proyectos?.idinmobiliaria_id);
      return {
        proyectoId: resolvedProyectoId,
        loteId,
        inmoIdFromLote: resolvedInmoId,
      };
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("No se pudo resolver lote compartido", error);
      }
      return { proyectoId: null, loteId, inmoIdFromLote: null };
    }
  };

  const fetchJsonWithRetry = async (
    url,
    { signal, retries = 2, timeoutMs = 12000 } = {},
  ) => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
        return data;
      } catch (err) {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
        lastError = err;
        if (signal?.aborted) throw err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          continue;
        }
      }
    }
    throw lastError;
  };

  const loadProyectoDetalleWithRetry = async (idproyecto, signal) => {
    try {
      return await loadProyectoDetalle(idproyecto, signal);
    } catch (error) {
      const url = withApiBase(
        `https://api.geohabita.com/api/mapa/proyecto_detalle/${idproyecto}/`,
      );
      return await fetchJsonWithRetry(url, { signal });
    }
  };

  const loadInmobiliariaWithRetry = async (idinmobiliaria, signal) => {
    if (!idinmobiliaria) return null;
    const url = withApiBase(
      `https://api.geohabita.com/api/getInmobiliaria/${idinmobiliaria}`,
    );
    try {
      const data = await fetchJsonWithRetry(url, { signal });
      if (Array.isArray(data)) return data[0] ?? null;
      return data ?? null;
    } catch {
      return null;
    }
  };

  const loadLoteDetalleShareWithRetry = async (idlote, signal) => {
    if (!idlote) return null;
    const url = withApiBase(
      `https://api.geohabita.com/api/mapa/lote_detalle/${idlote}/`,
    );
    try {
      return await fetchJsonWithRetry(url, { signal });
    } catch {
      return null;
    }
  };

  const loadProyectoShareWithRetry = async (idproyecto, signal) => {
    if (!idproyecto) return null;
    const url = withApiBase(
      `https://api.geohabita.com/api/mapa/proyecto_share/${idproyecto}/`,
    );
    try {
      return await fetchJsonWithRetry(url, { signal });
    } catch {
      return null;
    }
  };

  const openSharedSelection = async (proyectoIdRaw, loteIdRaw) => {
    if (!proyectoIdRaw && !loteIdRaw) return;

    if (projectDetailAbortRef.current) {
      projectDetailAbortRef.current.abort();
    }
    const controller = new AbortController();
    projectDetailAbortRef.current = controller;

    setIsProyectoLoading(!!proyectoIdRaw || !!loteIdRaw);
    setIsLoteLoading(!!loteIdRaw);

    const resolved = await resolveShareTarget(
      proyectoIdRaw,
      loteIdRaw,
      controller.signal,
    );
    if (controller.signal.aborted) return;

    let proyectoId = resolved.proyectoId;
    const loteId = resolved.loteId;

    if (loteId) {
      const loteDetalle = await loadLoteDetalleShareWithRetry(
        loteId,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      const quickProyecto = loteDetalle?.proyecto ?? null;
      const quickInmo = loteDetalle?.inmobiliaria ?? null;
      const quickLote = normalizeLoteDetalle(loteDetalle?.lote ?? null);
      const bundledProjectImages = normalizeProyectoImagenes(
        loteDetalle?.imagenes_proyecto || [],
      );
      const bundledLoteImages = normalizeLoteImagenes(
        loteDetalle?.imagenes_lote || [],
      );

      if (!proyectoId && quickProyecto?.idproyecto) {
        proyectoId = Number(quickProyecto.idproyecto);
      }

      if (
        inmoId &&
        quickInmo?.idinmobiliaria &&
        String(inmoId) !== String(quickInmo.idinmobiliaria)
      ) {
        console.warn("Link compartido no coincide con la inmobiliaria actual.");
        setShareResolveStatus("failed");
        setIsProyectoLoading(false);
        setIsLoteLoading(false);
        return;
      }

      if (quickProyecto) {
        setselectedProyecto({
          ...quickProyecto,
          inmo: quickInmo,
        });
        if (bundledProjectImages.length) {
          setImagenesProyecto(bundledProjectImages);
          setCached(
            "projectImages",
            quickProyecto.idproyecto,
            "project_images",
            bundledProjectImages,
          );
        }
      }
      if (quickLote) {
        setSelectedLote({
          lote: quickLote,
          inmo: quickInmo,
        });
        setLotesProyectoBase([quickLote]);
        setLotesProyecto([quickLote]);
        if (bundledLoteImages.length) {
          setImagenesLote(bundledLoteImages);
          setCached("loteImages", quickLote.idlote, "lote_images", bundledLoteImages);
        }
        setIsLoteLoading(false);
        if (mapRef.current) {
          focusMapForShare({
            map: mapRef.current,
            proyectoDetalle: quickProyecto,
            dataPuntos: [],
            loteTarget: quickLote,
          });
          pendingShareFocusRef.current = null;
        } else {
          pendingShareFocusRef.current = {
            proyectoDetalle: quickProyecto,
            dataPuntos: [],
            loteTarget: quickLote,
          };
        }
      }
    } else if (proyectoId) {
      const proyectoShare = await loadProyectoShareWithRetry(
        proyectoId,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      const quickProyecto = proyectoShare?.proyecto ?? null;
      const quickInmo = proyectoShare?.inmobiliaria ?? null;
      const quickPuntos = normalizePuntosWithOrder(proyectoShare?.puntos || []);
      const bundledProjectImages = normalizeProyectoImagenes(
        proyectoShare?.imagenes_proyecto || [],
      );

      if (
        inmoId &&
        quickInmo?.idinmobiliaria &&
        String(inmoId) !== String(quickInmo.idinmobiliaria)
      ) {
        console.warn("Proyecto compartido no pertenece a esta inmobiliaria.");
        setShareResolveStatus("failed");
        return;
      }

      if (quickProyecto) {
        setselectedProyecto({
          ...quickProyecto,
          inmo: quickInmo,
        });
        if (bundledProjectImages.length) {
          setImagenesProyecto(bundledProjectImages);
          setCached(
            "projectImages",
            quickProyecto.idproyecto,
            "project_images",
            bundledProjectImages,
          );
        }
      }
      setPuntos(quickPuntos);
      setIsProyectoLoading(false);
      if (mapRef.current) {
        focusMapForShare({
          map: mapRef.current,
          proyectoDetalle: quickProyecto,
          dataPuntos: quickPuntos,
          loteTarget: null,
        });
        pendingShareFocusRef.current = null;
      } else {
        pendingShareFocusRef.current = {
          proyectoDetalle: quickProyecto,
          dataPuntos: quickPuntos,
          loteTarget: null,
        };
      }
    }

    if (!proyectoId) {
      setShareResolveStatus("failed");
      setIsProyectoLoading(false);
      setIsLoteLoading(false);
      return;
    }

    if (
      inmoId &&
      resolved.inmoIdFromLote &&
      String(inmoId) !== String(resolved.inmoIdFromLote)
    ) {
      console.warn("Link compartido no coincide con la inmobiliaria actual.");
      setShareResolveStatus("failed");
      setIsProyectoLoading(false);
      setIsLoteLoading(false);
      return;
    }

    try {
      setRouteMode(null);
      setDirections(null);
      setWalkingInfo(null);
      setDrivingInfo(null);
      setSelectedLote(null);
        setLotesProyecto([]);
        setLotesProyectoBase([]);
        setPuntos([]);
        setIconosProyecto([]);
        setEspaciosProyecto([]);
        setSelectedSpace(null);
        setHoveredSpace(null);
      setFiltroBotActivo(false);
      setSelectedTipo("");
      setSelectedRango("");

      const detail = await loadProyectoDetalleWithRetry(
        proyectoId,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      const dataPuntos = normalizeProyectoShape(
        detail?.proyecto ?? { idproyecto: proyectoId },
        detail?.puntos || [],
      ).puntos;
      const lotesConPuntos = (detail?.lotes || [])
        .map((lote) => normalizeLoteDetalle(lote))
        .filter(Boolean);
      const dataIconos = normalizeIconos(detail?.iconos || []);
      const dataEspacios = (detail?.espacios || [])
        .map((espacio) => normalizeEspacioDetalle(espacio))
        .filter(Boolean);
      const bundledProjectImages = normalizeProyectoImagenes(
        detail?.imagenes_proyecto || [],
      );
      let inmoData = detail?.inmobiliaria ?? null;
      const proyectoDetalle = detail?.proyecto ?? { idproyecto: proyectoId };

      if (
        inmoId &&
        inmoData?.idinmobiliaria &&
        String(inmoId) !== String(inmoData.idinmobiliaria)
      ) {
        console.warn("Proyecto compartido no pertenece a esta inmobiliaria.");
        setShareResolveStatus("failed");
        setIsProyectoLoading(false);
        setIsLoteLoading(false);
        return;
      }

      if (!inmoData && inmoId) {
        inmoData = await loadInmobiliariaWithRetry(inmoId, controller.signal);
        if (controller.signal.aborted) return;
      }

      if (bundledProjectImages.length) {
        setImagenesProyecto(bundledProjectImages);
        setCached(
          "projectImages",
          proyectoId,
          "project_images",
          bundledProjectImages,
        );
      } else {
        const projectImages = await loadProyectoImagenes(
          proyectoId,
          controller.signal,
        ).catch(() => null);
        if (projectImages) setImagenesProyecto(projectImages);
      }
      if (loteId) {
        const loteImages = await loadLoteImagenes(loteId, controller.signal).catch(
          () => null,
        );
        if (loteImages) {
          setImagenesLote(loteImages);
        }
      }

      setPuntos(dataPuntos);

      setLotesProyectoBase(lotesConPuntos);
      setLotesProyecto(lotesConPuntos);
      setIconosProyecto(dataIconos);
      setEspaciosProyecto(dataEspacios);
      setSelectedSpace(null);
      setHoveredSpace(null);

      setselectedProyecto({
        ...proyectoDetalle,
        inmo: inmoData,
      });
      setIsProyectoLoading(false);

      if (loteId) {
        const target = lotesConPuntos.find(
          (l) => Number(l.idlote) === Number(loteId),
        );
        if (target) {
          setSelectedLote({
            lote: target,
            inmo: inmoData,
          });
          setIsLoteLoading(false);
          if (mapRef.current) {
            focusMapForShare({
              map: mapRef.current,
              proyectoDetalle,
              dataPuntos,
              loteTarget: target,
            });
            pendingShareFocusRef.current = null;
          } else {
            pendingShareFocusRef.current = {
              proyectoDetalle,
              dataPuntos,
              loteTarget: target,
            };
          }
          setShareResolveStatus("resolved");
          setIsProyectoLoading(false);
          setIsLoteLoading(false);
          return;
        }
      }

      if (mapRef.current) {
        focusMapForShare({
          map: mapRef.current,
          proyectoDetalle,
          dataPuntos,
          loteTarget: null,
        });
        pendingShareFocusRef.current = null;
      } else {
        pendingShareFocusRef.current = {
          proyectoDetalle,
          dataPuntos,
          loteTarget: null,
        };
      }
      setShareResolveStatus("resolved");
      setIsProyectoLoading(false);
      setIsLoteLoading(false);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Error cargando proyecto compartido:", err);
      }
      setShareResolveStatus("failed");
      setIsProyectoLoading(false);
      setIsLoteLoading(false);
    }
  };

  const handleMarkerClick = async (proyecto) => {
    if (isMobile()) {
      setShowFilters(false);
    }
    try {
      setRouteMode(null);
      setDirections(null);
      setWalkingInfo(null);
      setDrivingInfo(null);
      setLotesProyecto([]);
      setLotesProyectoBase([]);
      setPuntos([]);
      setIconosProyecto([]);
      setEspaciosProyecto([]);
      setSelectedSpace(null);
      setHoveredSpace(null);

      const quickLat = normalizeNumber(proyecto.latitud);
      const quickLng = normalizeNumber(proyecto.longitud);
      if (
        mapRef.current &&
        Number.isFinite(quickLat) &&
        Number.isFinite(quickLng)
      ) {
        centerPointForProjectFocus(mapRef.current, {
          lat: quickLat,
          lng: quickLng,
        });
      }

      setselectedProyecto({
        ...proyecto,
        inmo: null,
      });

      const fecha = new Date().toISOString().split("T")[0];
      const hora = new Date().toLocaleTimeString("en-GB", { hour12: false });

      const clickPayload = JSON.stringify({
        idproyecto: proyecto.idproyecto,
        fecha,
        hora,
      });
      const clickUrl = withApiBase(
        "https://api.geohabita.com/api/registerClickProyecto/",
      );
      const clickOrigin = new URL(clickUrl, window.location.origin).origin;
      if (clickOrigin === window.location.origin && navigator.sendBeacon) {
        navigator.sendBeacon(
          clickUrl,
          new Blob([clickPayload], { type: "application/json" }),
        );
      } else {
        fetch(clickUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: clickPayload,
          keepalive: true,
          credentials: "omit",
          mode: "cors",
        }).catch(() => null);
      }

      calculateInfo("WALKING", proyecto);
      calculateInfo("DRIVING", proyecto);

      if (projectDetailAbortRef.current) {
        projectDetailAbortRef.current.abort();
      }
      const controller = new AbortController();
      projectDetailAbortRef.current = controller;

      const detail = await loadProyectoDetalleWithRetry(
        proyecto.idproyecto,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      const projectShape = normalizeProyectoShape(
        detail?.proyecto ?? proyecto,
        detail?.puntos || [],
      );
      const dataPuntos = projectShape.puntos;
      const lotesConPuntos = (detail?.lotes || [])
        .map((lote) => normalizeLoteDetalle(lote))
        .filter(Boolean);
      const dataIconos = normalizeIconos(detail?.iconos || []);
      const dataEspacios = (detail?.espacios || [])
        .map((espacio) => normalizeEspacioDetalle(espacio))
        .filter(Boolean);
      const bundledProjectImages = normalizeProyectoImagenes(
        detail?.imagenes_proyecto || [],
      );
      let inmoData = detail?.inmobiliaria ?? null;
      const proyectoDetalle = detail?.proyecto ?? proyecto;

      if (!inmoData && inmoId) {
        inmoData = await loadInmobiliariaWithRetry(inmoId, controller.signal);
        if (controller.signal.aborted) return;
      }

      if (bundledProjectImages.length) {
        setImagenesProyecto(bundledProjectImages);
        setCached(
          "projectImages",
          proyecto.idproyecto,
          "project_images",
          bundledProjectImages,
        );
      } else {
        const projectImages = await loadProyectoImagenes(
          proyecto.idproyecto,
          controller.signal,
        ).catch(() => null);
        if (projectImages) {
          setImagenesProyecto(projectImages);
        }
      }

      setPuntos(dataPuntos);
      if (dataPuntos.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        dataPuntos.forEach((p) =>
          bounds.extend({
            lat: Number(p.latitud),
            lng: Number(p.longitud),
          }),
        );
        fitBoundsForProjectFocus(mapRef.current, bounds);
      }

      const lotesFiltered = filterLotesByRango(lotesConPuntos, selectedRango);
      setLotesProyectoBase(lotesConPuntos);
      setLotesProyecto(lotesFiltered);
      setIconosProyecto(dataIconos);
      setEspaciosProyecto(dataEspacios);
      setSelectedSpace(null);
      setHoveredSpace(null);

      setselectedProyecto({
        ...proyectoDetalle,
        inmo: inmoData,
      });

      // Ajuste final: primero se abre sidebar (viewport reducido) y luego
      // reenfocamos con la misma lógica base que ya funcionaba.
      setTimeout(() => {
        const map = mapRef.current;
        if (!map || !window.google?.maps) return;

        window.google.maps.event.trigger(map, "resize");

        if (dataPuntos.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          dataPuntos.forEach((p) =>
            bounds.extend({
              lat: Number(p.latitud),
              lng: Number(p.longitud),
            }),
          );
          fitBoundsForProjectFocus(map, bounds);
          return;
        }

        const lat = normalizeNumber(proyectoDetalle.latitud);
        const lng = normalizeNumber(proyectoDetalle.longitud);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          centerPointForProjectFocus(map, { lat, lng });
        }
      }, 260);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Error cargando inmobiliaria:", err);
      }
    }
  };

  useEffect(() => {
    if (!isLoaded || !selectedProyecto || !isMobile()) return;
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const t = setTimeout(() => {
      window.google.maps.event.trigger(map, "resize");

      if (puntos.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        puntos.forEach((p) =>
          bounds.extend({
            lat: Number(p.latitud),
            lng: Number(p.longitud),
          }),
        );
        fitBoundsForProjectFocus(map, bounds);
        return;
      }

      const lat = normalizeNumber(selectedProyecto.latitud);
      const lng = normalizeNumber(selectedProyecto.longitud);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        centerPointForProjectFocus(map, { lat, lng });
      }
    }, 140);

    return () => clearTimeout(t);
  }, [
    isLoaded,
    selectedProyecto,
    puntos,
    baseMapStyle,
    labelsEnabled,
    reliefEnabled,
    fitBoundsForProjectFocus,
    centerPointForProjectFocus,
  ]);

  // ✅ FIX: Initialize Autocomplete only when Google Maps is fully loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      if (!window.google?.maps?.places?.Autocomplete) {
        console.error("Autocomplete no está disponible");
        return;
      }

      const autocomplete = new window.google.maps.places.Autocomplete(
        inputRef.current,
      );
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          setSearchQuery(place.formatted_address || place.name || "");
          focusMapOnLocation(location, place.geometry.viewport || null);
        }
      });
    } catch (error) {
      console.error("Error inicializando Autocomplete:", error);
    }
  }, [focusMapOnLocation, isLoaded]);

  if (loadError) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Error al cargar Google Maps</h2>
        <p>{loadError.message || JSON.stringify(loadError)}</p>
        <button onClick={() => window.location.reload()}>
          Recargar página
        </button>
      </div>
    );
  }

  if (!isLoaded) {
    return <GeoHabitaLoader autoHide={false} />;
  }

  return (
    <div className={styles.container}>
      <header ref={headerRef} className={`${styles.cabecera} `}>
        {/* Logo a la izquierda fuera de la barra central */}
        <Link to="/" className={styles.logoContainer} aria-label="Ir a inicio">
          <img
            src="/habitasinfondo.png"
            alt="GeoHabita Logo"
            className={styles.logo}
          />
          <span className={styles.brandName}>
            <span className={styles.geo}>Geo</span>
            <span className={styles.habita}>Habita</span>
          </span>
        </Link>

        {/* BARRA CENTRAL (PASTILLA) */}
        <div
          className={`${styles.topBar} ${isSearchFocused ? styles.topBarExpanded : ""}`}
        >
          <div className={styles.searchSection}>
            <span className={styles.searchLabel}>UBICACIÓN</span>
            <input
              ref={inputRef}
              className={`${styles.searchInput} ${isSearchFocused ? styles.searchInputFocused : ""}`}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Buscar Lugar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  geocodeSearchQuery();
                }
              }}
              onBlur={() => setIsSearchFocused(false)}
            />
          </div>
          {
            <>
              {/* SELECT PERSONALIZADO: TIPO */}
              <CustomSelect
                label="QUIERO VER"
                value={selectedTipo}
                placeholder="Cualquier tipo"
                styles={styles}
                options={tiposInmo.map((t) => ({
                  label: t.nombre,
                  value: t.idtipoinmobiliaria,
                }))}
                onChange={(val) => handleTipoChange(val)}
              />

              <div className={styles.divider}></div>

              {/* SELECT PERSONALIZADO: PRESUPUESTOS */}
              <CustomSelect
                label="PRESUPUESTOS"
                value={selectedRango}
                placeholder="Sin límite"
                styles={styles}
                options={RANGOS_PRECIO}
                onChange={(val) => handleRangoChange(val)}
              />
            </>
          }
          {/* BOTÓN LUPA */}
          <button
            type="button"
            className={styles.searchButton}
            onClick={geocodeSearchQuery}
          >
            <svg
              viewBox="0 0 32 32"
              style={{
                display: "block",
                fill: "none",
                height: "16px",
                width: "16px",
                stroke: "currentColor",
                strokeWidth: "4",
                overflow: "visible",
              }}
            >
              <path d="m13 24c6.0751322 0 11-4.9248678 11-11s-4.9248678-11-11-11-11 4.9248678-11 11 4.9248678 11 11 11zm8-3 9 9"></path>
            </svg>
          </button>
        </div>
        {/* Botones de la derecha (User / Menu) */}
        <div className={styles.rightActions}>
          <ThemeSwitch checked={isDark} onChange={toggleTheme} />
          {!isMobileViewport && (
            <Link to="/inicio" className={styles.anunciaPropiedad}>
              <span className={styles.anuncioSweep} aria-hidden="true" />
              <span className={styles.anuncioIconViewport}>
                {prevAnuncioIndex !== null && isAnuncioAnimating && (
                  <span
                    className={`${styles.anuncioItem} ${styles.anuncioLeave}`}
                  >
                    {anuncioSlides[prevAnuncioIndex].icon}
                  </span>
                )}
                <span
                  className={`${styles.anuncioItem} ${isAnuncioAnimating ? styles.anuncioEnter : styles.anuncioStatic}`}
                >
                  {anuncioSlides[activeAnuncioIndex].icon}
                </span>
              </span>
              <span className={styles.anuncioTextViewport}>
                {prevAnuncioIndex !== null && isAnuncioAnimating && (
                  <span
                    className={`${styles.anuncioItem} ${styles.anuncioLeave}`}
                  >
                    {anuncioSlides[prevAnuncioIndex].text}
                  </span>
                )}
                <span
                  className={`${styles.anuncioItem} ${isAnuncioAnimating ? styles.anuncioEnter : styles.anuncioStatic}`}
                >
                  {anuncioSlides[activeAnuncioIndex].text}
                </span>
              </span>
            </Link>
          )}
        </div>
        {isMobileViewport && (
          <div className={styles.mobileThemeControl}>
            <ThemeSwitch checked={isDark} onChange={toggleTheme} />
          </div>
        )}
      </header>

      <div
        className={`${styles.mapViewport} ${shouldShrinkMapForSidebar ? styles.mapViewportWithSidebar : ""}`}
        style={{ "--map-header-offset": `${mapHeaderOffsetPx}px` }}
      >
        {shouldShowShareLoader && <GeoHabitaLoader autoHide={false} />}
        {inmoId && !selectedProyecto && !selectedLote && (
          <button
            type="button"
            className={styles.backToAll}
            aria-label="Ver todos los proyectos"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Ir al Mapa Completo
          </button>
        )}
        {mapIntroHintVisible && (
          <button
            type="button"
            className={styles.mapIntroHint}
            onClick={() => setMapIntroHintVisible(false)}
            aria-label="Ocultar sugerencia para alejar el mapa"
          >
            <span className={styles.mapIntroHintIcon} aria-hidden="true">
              -
            </span>
            <span className={styles.mapIntroHintText}>
              <strong>Aleja el mapa</strong>
              <small>Descubre mas proyectos alrededor</small>
            </span>
          </button>
        )}
        <GoogleMap
          mapContainerClassName={styles.map}
          center={currentPosition}
          zoom={mapZoom}
          onLoad={(map) => {
            mapRef.current = map;
            const initialZoom = map.getZoom() ?? 13;
            previousMapZoomRef.current = initialZoom;
            setMapZoom(initialZoom);
            setOverlayZoom(initialZoom);
            map.setMapTypeId(
              resolveMapTypeId(baseMapStyle, labelsEnabled, reliefEnabled),
            );
            if (mapTypeListenerRef.current) {
              mapTypeListenerRef.current.remove();
            }
            mapTypeListenerRef.current = map.addListener(
              "maptypeid_changed",
              () => {
                const currentType = map.getMapTypeId();
                if (currentType === "hybrid") {
                  setBaseMapStyle("satellite");
                  setLabelsEnabled(true);
                  return;
                }
                if (currentType === "satellite") {
                  setBaseMapStyle("satellite");
                  setLabelsEnabled(false);
                  return;
                }
                if (currentType === "terrain") {
                  setBaseMapStyle("roadmap");
                  setReliefEnabled(true);
                  return;
                }
                if (currentType === "roadmap") {
                  setBaseMapStyle("roadmap");
                  setReliefEnabled(false);
                }
              },
            );
            updateBoundsFromMap();
            setOverlayZoom(initialZoom);
            setMapIntroHintVisible(true);
            if (mapIntroHintTimeoutRef.current) {
              clearTimeout(mapIntroHintTimeoutRef.current);
            }
            mapIntroHintTimeoutRef.current = setTimeout(() => {
              setMapIntroHintVisible(false);
            }, 4000);
            if (pendingShareFocusRef.current) {
              focusMapForShare({
                map,
                proyectoDetalle: pendingShareFocusRef.current.proyectoDetalle,
                dataPuntos: pendingShareFocusRef.current.dataPuntos || [],
                loteTarget: pendingShareFocusRef.current.loteTarget || null,
              });
              pendingShareFocusRef.current = null;
            }
          }}
          onZoomChanged={() => {
            const nextZoom = mapRef.current?.getZoom();
            if (Number.isFinite(nextZoom)) {
              if (
                mapIntroHintVisible &&
                Number.isFinite(previousMapZoomRef.current) &&
                nextZoom < previousMapZoomRef.current
              ) {
                setMapIntroHintVisible(false);
              }
              previousMapZoomRef.current = nextZoom;
              if (!isMapZoomingRef.current) {
                isMapZoomingRef.current = true;
                setIsMapZooming(true);
              }
            }
          }}
          onIdle={() => {
            const nextZoom = mapRef.current?.getZoom();
            if (Number.isFinite(nextZoom)) {
              setMapZoom(nextZoom);
              setOverlayZoom(nextZoom);
            }
            if (isMapZoomingRef.current) {
              isMapZoomingRef.current = false;
              setIsMapZooming(false);
            }
            scheduleBoundsUpdate();
          }}
          options={{
            gestureHandling: "greedy",
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          {puntos.length === 0 && <Marker position={currentPosition} />}

          {visibleProyectos.length > 0 && (
            <MarkerClusterer
              options={clusterOptions}
            >
              {(clusterer) => (
                <>
                  {visibleProyectos.map((p) => (
                    <Marker
                      key={p.idproyecto}
                      clusterer={clusterer}
                      position={{
                        lat: Number(p.latitud),
                        lng: Number(p.longitud),
                      }}
                      icon={{
                        url: getProjectIconUrl(p),
                        scaledSize: new window.google.maps.Size(40, 40),
                      }}
                      title={p.nombreproyecto}
                      onClick={() => handleMarkerClick(p)}
                    />
                  ))}
                </>
              )}
            </MarkerClusterer>
          )}

          {iconosProyecto.map((ico) => (
            <Marker
              key={
                ico.idiconoproyecto ??
                ico.idicono ??
                `${ico.iconUrl}-${ico.latitud}-${ico.longitud}`
              }
              position={{
                lat: Number(ico.latitud),
                lng: Number(ico.longitud),
              }}
              icon={{
                url: ico.iconUrl,
                scaledSize: new window.google.maps.Size(
                  getProjectIconSize(mapZoom, isMobileViewport),
                  getProjectIconSize(mapZoom, isMobileViewport),
                ),
                anchor: new window.google.maps.Point(
                  Math.round(getProjectIconSize(mapZoom, isMobileViewport) / 2),
                  Math.round(getProjectIconSize(mapZoom, isMobileViewport)),
                ),
              }}
              title={ico.iconName}
              zIndex={9}
              clickable={false}
            />
          ))}

          {puntos.length > 0 && (
            <PolygonOverlay
              puntos={puntos}
              color={isSelectedProjectCasa ? "#00e5ff" : "#106e2eff"}
              showLados={false}
              options={{
                clickable: false,
                fillColor: "transparent",
                strokeWeight: isSelectedProjectCasa ? 3.6 : 2,
                strokeOpacity: isSelectedProjectCasa ? 0.95 : 0.9,
                haloColor: isSelectedProjectCasa ? "#7cf8ff" : undefined,
                haloOpacity: isSelectedProjectCasa ? 0.5 : undefined,
                haloWeight: isSelectedProjectCasa ? 8 : undefined,
              }}
            />
          )}

          {selectedProyecto &&
            showSpacesLayer &&
            espaciosProyecto.map((espacio) => (
              <React.Fragment key={espacio.idespacio}>
                <PolygonOverlay
                  puntos={espacio.puntos}
                  path={espacio.polygonPath}
                  labelPosition={
                    espacio.polygonCenter ||
                    (Number.isFinite(espacio.centerLat) &&
                    Number.isFinite(espacio.centerLng)
                      ? { lat: espacio.centerLat, lng: espacio.centerLng }
                      : null)
                  }
                  color={getSpaceColor(espacio)}
                  label={
                    overlayZoom >= 15 || espacio.destacado
                      ? { text: espacio.nombre }
                      : null
                  }
                  onClick={() => setSelectedSpace(espacio)}
                  onMouseOver={() => setHoveredSpace(espacio)}
                  onMouseOut={() => setHoveredSpace(null)}
                  options={{
                    clickable: true,
                    strokeOpacity: 0.9,
                    ...getSpaceVisualStyle(espacio),
                  }}
                  mapZoom={overlayZoom}
                />
                <SpacePatternOverlay
                  path={espacio.polygonPath || []}
                  espacio={espacio}
                  color={getSpaceColor(espacio)}
                  visible={overlayZoom >= 14 || selectedSpace?.idespacio === espacio.idespacio}
                  emphasized={
                    selectedSpace?.idespacio === espacio.idespacio ||
                    hoveredSpace?.idespacio === espacio.idespacio
                  }
                />
                {(espacio.polygonCenter ||
                  (Number.isFinite(espacio.centerLat) &&
                    Number.isFinite(espacio.centerLng))) && (
                  <Marker
                    position={
                      espacio.polygonCenter ||
                      { lat: espacio.centerLat, lng: espacio.centerLng }
                    }
                    icon={{
                      url: getSpaceIconUrl(espacio),
                      scaledSize: new window.google.maps.Size(32, 32),
                    }}
                    title={`${espacio.tipoespacio?.nombre || "Espacio"} · ${espacio.nombre}`}
                    zIndex={12}
                    clickable
                    onClick={() => setSelectedSpace(espacio)}
                  />
                )}
              </React.Fragment>
            ))}

          {selectedProyecto && lotesProyecto.length > 0 && (
            <MemoizedLotesOverlay
              lotes={lotesProyecto}
              selectedLote={selectedLote}
              hoveredLote={hoveredLote}
              mapZoom={overlayZoom}
              isMobile={isMobileViewport}
              enableHalos={!isMapZooming}
              onLoteClick={handleLoteClick}
              onLoteMouseOver={setHoveredLote}
              onLoteMouseOut={() => setHoveredLote(null)}
            />
          )}

          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>

        {selectedProyecto && espaciosProyecto.length > 0 && (
          <div className={styles.spaceLayerControl}>
            <button
              type="button"
              className={`${styles.spaceLayerToggle} ${showSpacesLayer ? styles.spaceLayerToggleActive : ""}`}
              onClick={() => {
                setShowSpacesLayer((prev) => !prev);
                setHoveredSpace(null);
                if (showSpacesLayer) setSelectedSpace(null);
              }}
            >
              <span className={styles.spaceLayerToggleDot} />
              <span>
                {showSpacesLayer ? "Ocultar Espacios" : "Mostrar Espacios"}
              </span>
            </button>

            {showSpacesLayer && visibleSpaceLegend.length > 0 && (
              <div className={styles.spaceLegend}>
                <strong className={styles.spaceLegendTitle}>Leyenda</strong>
                {visibleSpaceLegend.map((item) => (
                  <div
                    key={`space-legend-${item.key}-${item.nombre}`}
                    className={styles.spaceLegendItem}
                  >
                    <span
                      className={styles.spaceLegendSwatch}
                      style={getSpacePatternPreviewStyle(
                        {
                          tipoespacio: {
                            slug: item.key,
                            nombre: item.nombre,
                          },
                        },
                        item.color,
                      )}
                    />
                    <span className={styles.spaceLegendName}>{item.nombre}</span>
                    <span className={styles.spaceLegendCount}>{item.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showSpacesLayer && activeSpaceCard && (
          <div className={styles.spaceInfoCard}>
            <div className={styles.spaceInfoHead}>
              <div>
                <span className={styles.spaceInfoKicker}>
                  {activeSpaceCard?.tipoespacio?.nombre || "Espacio"}
                </span>
                <strong>{activeSpaceCard?.nombre || "Espacio del proyecto"}</strong>
              </div>
              {selectedSpace && (
                <button
                  type="button"
                  className={styles.spaceInfoClose}
                  onClick={() => setSelectedSpace(null)}
                  aria-label="Cerrar detalle del espacio"
                >
                  ×
                </button>
              )}
            </div>
            <div className={styles.spaceInfoMetrics}>
              <span>
                {Math.round(Number(activeSpaceCard?.area_m2 || 0)).toLocaleString("es-PE")} m²
              </span>
              {Number(activeSpaceCard?.destacado) === 1 && <span>Destacado</span>}
            </div>
            {activeSpaceCard?.descripcion ? (
              <p className={styles.spaceInfoDescription}>
                {activeSpaceCard.descripcion}
              </p>
            ) : (
              <p className={styles.spaceInfoDescription}>
                Espacio trazado dentro del masterplan del proyecto.
              </p>
            )}
          </div>
        )}

        <div
          ref={mapTypeControlRef}
          className={styles.customMapTypeControl}
          role="group"
          aria-label="Tipo de mapa"
        >
          <div className={styles.mapTypeTabs}>
            <button
              type="button"
              className={`${styles.mapTypeBtn} ${baseMapStyle === "roadmap" ? styles.mapTypeBtnActive : ""}`}
              onClick={() => handleSetBaseMapStyle("roadmap")}
              aria-pressed={baseMapStyle === "roadmap"}
            >
              Mapa
            </button>
            <button
              type="button"
              className={`${styles.mapTypeBtn} ${baseMapStyle === "satellite" ? styles.mapTypeBtnActive : ""}`}
              onClick={() => handleSetBaseMapStyle("satellite")}
              aria-pressed={baseMapStyle === "satellite"}
            >
              Satelite
            </button>
          </div>

          {mapTypeMenuFor === "roadmap" && (
            <div className={styles.mapTypeSubMenu}>
              <span className={styles.mapTypeSubLabel}>Relieve</span>
              <div className={styles.mapTypeSubRow}>
                <button
                  type="button"
                  className={`${styles.mapTypeSubBtn} ${reliefEnabled ? styles.mapTypeSubBtnActive : ""}`}
                  onClick={() => handleSetMapRelief(true)}
                  aria-pressed={reliefEnabled}
                >
                  Activado
                </button>
                <button
                  type="button"
                  className={`${styles.mapTypeSubBtn} ${!reliefEnabled ? styles.mapTypeSubBtnActive : ""}`}
                  onClick={() => handleSetMapRelief(false)}
                  aria-pressed={!reliefEnabled}
                >
                  Desactivado
                </button>
              </div>
            </div>
          )}

          {mapTypeMenuFor === "satellite" && (
            <div className={styles.mapTypeSubMenu}>
              <span className={styles.mapTypeSubLabel}>Etiquetas</span>
              <div className={styles.mapTypeSubRow}>
                <button
                  type="button"
                  className={`${styles.mapTypeSubBtn} ${labelsEnabled ? styles.mapTypeSubBtnActive : ""}`}
                  onClick={() => handleSetSatelliteLabels(true)}
                  aria-pressed={labelsEnabled}
                >
                  Activado
                </button>
                <button
                  type="button"
                  className={`${styles.mapTypeSubBtn} ${!labelsEnabled ? styles.mapTypeSubBtnActive : ""}`}
                  onClick={() => handleSetSatelliteLabels(false)}
                  aria-pressed={!labelsEnabled}
                >
                  Desactivado
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedProyecto && !selectedLote && (
        <Link
          to="/inicio"
          className={styles.mobileAnunciaPropiedad}
          style={{ width: `${anuncioButtonWidthPx}px` }}
        >
          <span className={styles.anuncioSweep} aria-hidden="true" />
          <span className={styles.anuncioIconViewport}>
            {prevAnuncioIndex !== null && isAnuncioAnimating && (
              <span className={`${styles.anuncioItem} ${styles.anuncioLeave}`}>
                {anuncioSlides[prevAnuncioIndex].icon}
              </span>
            )}
            <span
              className={`${styles.anuncioItem} ${isAnuncioAnimating ? styles.anuncioEnter : styles.anuncioStatic}`}
            >
              {anuncioSlides[activeAnuncioIndex].icon}
            </span>
          </span>
          <span
            className={styles.anuncioTextViewport}
            style={{ width: `${anuncioTextWidthPx}px` }}
          >
            {prevAnuncioIndex !== null && isAnuncioAnimating && (
              <span className={`${styles.anuncioItem} ${styles.anuncioLeave}`}>
                {anuncioSlides[prevAnuncioIndex].text}
              </span>
            )}
            <span
              className={`${styles.anuncioItem} ${isAnuncioAnimating ? styles.anuncioEnter : styles.anuncioStatic}`}
            >
              {anuncioSlides[activeAnuncioIndex].text}
            </span>
          </span>
        </Link>
      )}

      {selectedProyecto && (
        <ProyectoSidebar
          inmo={selectedProyecto?.inmo}
          proyecto={selectedProyecto}
          selectedLote={selectedLote?.lote || null}
          imagenes={imagenesProyecto}
          espacios={espaciosProyecto}
          walkingInfo={walkingInfo}
          drivingInfo={drivingInfo}
          mapHeaderOffsetPx={mapHeaderOffsetPx}
          forceCompactForLote={!!selectedLote}
          isLoading={isProyectoLoading}
          mapRef={mapRef}
          onClose={async () => {
            if (mapRef.current && window.google?.maps) {
              const map = mapRef.current;

              // 🔹 Si tienes posición actual
              map.panTo(currentPosition);

              // 🔹 Zoom 17
              map.setZoom(13);
            }
            setselectedProyecto(null);
            setDirections(null);
            setWalkingInfo(null);
            setDrivingInfo(null);
            setRouteMode(null);
            setImagenesProyecto(null);
            setPuntos([]);
            setLotesProyecto([]);
            setLotesProyectoBase([]);
            setIconosProyecto([]);
            setEspaciosProyecto([]);
            setSelectedSpace(null);
            setHoveredSpace(null);
            setSelectedLote(null); // 🔥 CLAVE
          }}
        />
      )}

      {selectedLote && (
        <MapSidebar
          lote={selectedLote.lote}
          inmo={selectedLote.inmo}
          imagenes={imagenesLote}
          proyecto={selectedProyecto}
          walkingInfo={walkingInfo}
          drivingInfo={drivingInfo}
          mapHeaderOffsetPx={mapHeaderOffsetPx}
          isLoading={isLoteLoading}
          mapRef={mapRef}
          onClose={() => {
            setSelectedLote(null);
            setImagenesLote([]);
            setLotesProyecto((prev) => [...prev]);
          }}
        />
      )}
    </div>
  );
}

export default React.memo(MyMap);
