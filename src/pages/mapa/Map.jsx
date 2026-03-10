import { withApiBase } from "../../config/api.js";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import ProyectoSidebar from "./MapSidebarProyecto";
import MapSidebar from "./MapSidebar";
import PolygonOverlay from "./PolygonOverlay";
import CustomSelect from "./CustomSelect";
import styles from "./Mapa.module.css";
import ChatBotPanel from "../mybot/ChatBotPanel";
import loader from "../../components/loader";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import ThemeSwitch from "../../components/ThemeSwitch";
import { useTheme } from "../../context/ThemeContext";

const defaultCenter = { lat: -6.49935, lng: -76.371809 };
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

        return (
          <PolygonOverlay
            key={lote.idlote}
            puntos={lote.puntos}
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
              haloColor: status.color,
              haloOpacity: isSelected
                ? 0.5
                : isHovered
                  ? 0.4
                  : isDimmed
                    ? 0.12
                    : 0.24,
              haloWeight: isSelected ? 8 : isHovered ? 6 : isDimmed ? 3 : 5,
            }}
            mapZoom={mapZoom}
          />
        );
      })}
    </>
  );
};

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
  const [imagenesProyecto, setImagenesProyecto] = useState([]);
  const [imagenesLote, setImagenesLote] = useState([]);
  const [puntos, setPuntos] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [hoveredLote, setHoveredLote] = useState(null);
  const [iconosProyecto, setIconosProyecto] = useState([]);
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

  const mapRef = useRef(null);
  const mapTypeListenerRef = useRef(null);
  const mapTypeControlRef = useRef(null);
  const headerRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const boundsDebounceRef = useRef(null);
  const anuncioTimeoutRef = useRef(null);
  const initialViewportHandledRef = useRef(false);
  const [mapHeaderOffsetPx, setMapHeaderOffsetPx] = useState(() =>
    typeof window !== "undefined" ? (window.innerWidth <= 550 ? 66 : 80) : 80,
  );
  const cacheRef = useRef({
    mapProjects: new Map(),
    projectDetail: new Map(),
  });
  const inflightRef = useRef({
    mapProjects: new Map(),
    projectDetail: new Map(),
  });
  // const inmoId = null;
  const { inmoId } = useParams();
  const [filtroBotActivo, setFiltroBotActivo] = useState(false);

  // Usuario
  const [hasSearchedLocation, setHasSearchedLocation] = useState(false);
  const MAX_VISIBLE_MARKERS = 250;
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

  const loadProyectoDetalle = async (idproyecto) => {
    const cached = getCached("projectDetail", idproyecto, "project_detail");
    if (cached) return cached;

    const inflight = inflightRef.current.projectDetail.get(idproyecto);
    if (inflight) return inflight;

    const url = withApiBase(
      `https://api.geohabita.com/api/mapa/proyecto_detalle/${idproyecto}/`,
    );
    const request = fetch(url)
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

  const isSelectedProjectCasa = useMemo(() => {
    if (!selectedProyecto) return false;
    if (filtroBotActivo) return selectedProyecto.iconoTipo === "casa";
    const tipoInmo = Number(selectedProyecto.idtipoinmobiliaria);
    const estado = Number(selectedProyecto.estado);
    return !(estado === 1 && tipoInmo === 1);
  }, [selectedProyecto, filtroBotActivo]);

  const visibleProyectos = useMemo(() => {
    const filtered = proyecto.filter((p) => {
      if (
        selectedProyecto &&
        ((puntos.length > 0 && selectedProyecto.idproyecto === p.idproyecto) ||
          selectedProyecto.idproyecto === p.idproyecto)
      ) {
        return false;
      }

      const lat = parseFloat(p.latitud);
      const lng = parseFloat(p.longitud);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

      if (!mapBounds) return true;

      return (
        lat <= mapBounds.north &&
        lat >= mapBounds.south &&
        lng <= mapBounds.east &&
        lng >= mapBounds.west
      );
    });

    if (filtered.length <= MAX_VISIBLE_MARKERS) return filtered;
    return filtered.slice(0, MAX_VISIBLE_MARKERS);
  }, [proyecto, selectedProyecto, puntos.length, mapBounds]);

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
        setCurrentPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        try {
          localStorage.setItem(GEOLOCATION_ONBOARDING_DONE_KEY, "1");
        } catch {
          // ignore storage errors
        }
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
  }, [hasSearchedLocation, inmoId]);

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
          setProyecto(data);
          if (data.length > 0 && mapRef.current && window.google?.maps) {
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

            const bounds = new window.google.maps.LatLngBounds();
            data.forEach((p) => {
              const lat = parseFloat(p.latitud);
              const lng = parseFloat(p.longitud);
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
  }, [selectedTipo, selectedRango, inmoId, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !inmoId) return;
    if (!mapRef.current || !window.google?.maps || !proyecto.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    proyecto.forEach((p) => {
      const lat = parseFloat(p.latitud);
      const lng = parseFloat(p.longitud);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        bounds.extend({ lat, lng });
      }
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds);
      updateBoundsFromMap();
    }
  }, [isLoaded, inmoId, proyecto, updateBoundsFromMap]);

  useEffect(() => {
    if (selectedLote) {
      fetch(
        withApiBase(
          `https://api.geohabita.com/api/list_imagen/${selectedLote.lote.idlote}`,
        ),
      )
        .then((res) => res.json())
        .then((data) => setImagenesLote(data))
        .catch((err) => console.error("Error cargando imágenes:", err));
    } else {
      setImagenesLote([]);
    }
  }, [selectedLote]);

  useEffect(() => {
    if (selectedProyecto?.idproyecto) {
      fetch(
        withApiBase(
          `https://api.geohabita.com/api/list_imagen_proyecto/${selectedProyecto.idproyecto}`,
        ),
      )
        .then((res) => res.json())
        .then((data) => setImagenesProyecto(data))
        .catch((err) => console.error("Error cargando imágenes:", err));
    } else {
      setImagenesProyecto([]);
    }
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

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: currentPosition,
        destination: {
          lat: parseFloat(proyecto.latitud),
          lng: parseFloat(proyecto.longitud),
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
      const lat = parseFloat(lote.latitud);
      const lng = parseFloat(lote.longitud);

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const map = mapRef.current;
        const target = { lat, lng };
        const currentBounds = map.getBounds();
        const targetLatLng = new window.google.maps.LatLng(lat, lng);

        if (!currentBounds || !currentBounds.contains(targetLatLng)) {
          map.panTo(target);
        }

        const currentZoom = map.getZoom() ?? 0;
        if (currentZoom < 17) {
          map.setZoom(18);
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
      if (navigator.sendBeacon) {
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
        }).catch(() => null);
      }

      calculateInfo("WALKING", proyecto);
      calculateInfo("DRIVING", proyecto);

      const detail = await loadProyectoDetalle(proyecto.idproyecto);
      const dataPuntos = Array.isArray(detail?.puntos) ? detail.puntos : [];
      const lotesConPuntos = Array.isArray(detail?.lotes) ? detail.lotes : [];
      const dataIconos = Array.isArray(detail?.iconos) ? detail.iconos : [];
      const inmoData = detail?.inmobiliaria ?? null;
      const proyectoDetalle = detail?.proyecto ?? proyecto;

      setPuntos(dataPuntos);
      if (dataPuntos.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        dataPuntos.forEach((p) =>
          bounds.extend({
            lat: parseFloat(p.latitud),
            lng: parseFloat(p.longitud),
          }),
        );
        fitBoundsForProjectFocus(mapRef.current, bounds);
      }

      const lotesFiltered = filterLotesByRango(lotesConPuntos, selectedRango);
      setLotesProyectoBase(lotesConPuntos);
      setLotesProyecto(lotesFiltered);
      setIconosProyecto(dataIconos);

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
              lat: parseFloat(p.latitud),
              lng: parseFloat(p.longitud),
            }),
          );
          fitBoundsForProjectFocus(map, bounds);
          return;
        }

        const lat = parseFloat(proyectoDetalle.latitud);
        const lng = parseFloat(proyectoDetalle.longitud);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          centerPointForProjectFocus(map, { lat, lng });
        }
      }, 260);
    } catch (err) {
      console.error("Error cargando inmobiliaria:", err);
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
            lat: parseFloat(p.latitud),
            lng: parseFloat(p.longitud),
          }),
        );
        fitBoundsForProjectFocus(map, bounds);
        return;
      }

      const lat = parseFloat(selectedProyecto.latitud);
      const lng = parseFloat(selectedProyecto.longitud);
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

          setCurrentPosition(location);
          setHasSearchedLocation(true); // ✅ CLAVE

          if (mapRef.current) {
            if (place.geometry.viewport) {
              mapRef.current.fitBounds(place.geometry.viewport);
            } else {
              mapRef.current.panTo(location);
              mapRef.current.setZoom(17);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error inicializando Autocomplete:", error);
    }
  }, [isLoaded]);

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
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Cargando mapa...</h2>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header ref={headerRef} className={`${styles.cabecera} `}>
        {/* Logo a la izquierda fuera de la barra central */}
        <div className={styles.logoContainer}>
          <img
            src="/habitasinfondo.png"
            alt="GeoHabita Logo"
            className={styles.logo}
          />
          <span className={styles.brandName}>
            <span className={styles.geo}>Geo</span>
            <span className={styles.habita}>Habita</span>
          </span>
        </div>

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
          <button className={styles.searchButton}>
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
        <GoogleMap
          mapContainerClassName={styles.map}
          center={currentPosition}
          zoom={13}
          onLoad={(map) => {
            mapRef.current = map;
            setMapZoom(map.getZoom() ?? 13);
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
          }}
          onZoomChanged={() => {
            const nextZoom = mapRef.current?.getZoom();
            if (Number.isFinite(nextZoom)) {
              setMapZoom(nextZoom);
            }
          }}
          onIdle={scheduleBoundsUpdate}
          options={{
            gestureHandling: "greedy",
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          {puntos.length === 0 && <Marker position={currentPosition} />}

          {visibleProyectos.map((p) => (
            <Marker
              key={p.idproyecto}
              position={{
                lat: parseFloat(p.latitud),
                lng: parseFloat(p.longitud),
              }}
              icon={{
                url: getProjectIconUrl(p),
                scaledSize: new window.google.maps.Size(40, 40),
              }}
              title={p.nombreproyecto}
              onClick={() => handleMarkerClick(p)}
            />
          ))}

          {iconosProyecto.map((ico) => (
            <Marker
              key={ico.idiconoproyecto}
              position={{
                lat: parseFloat(ico.latitud),
                lng: parseFloat(ico.longitud),
              }}
              icon={{
                url: withApiBase(
                  `https://api.geohabita.com${ico.icono_detalle.imagen}`,
                ),
                scaledSize: new window.google.maps.Size(40, 40),
              }}
              title={ico.icono_detalle.nombre}
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

          {selectedProyecto && lotesProyecto.length > 0 && (
            <LotesOverlay
              lotes={lotesProyecto}
              selectedLote={selectedLote}
              hoveredLote={hoveredLote}
              mapZoom={mapZoom}
              onLoteClick={handleLoteClick}
              onLoteMouseOver={setHoveredLote}
              onLoteMouseOut={() => setHoveredLote(null)}
            />
          )}

          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>

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
          imagenes={imagenesProyecto}
          walkingInfo={walkingInfo}
          drivingInfo={drivingInfo}
          mapHeaderOffsetPx={mapHeaderOffsetPx}
          forceCompactForLote={!!selectedLote}
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
            setImagenesProyecto([]);
            setPuntos([]);
            setLotesProyecto([]);
            setLotesProyectoBase([]);
            setIconosProyecto([]);
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
