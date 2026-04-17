import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EquirectangularAdapter, Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MapPinned,
  Navigation,
  Route,
  Sparkles,
} from "lucide-react";
import { withApiBase } from "../../config/api.js";
import styles from "./Viewer360.module.css";

const API_BASE = "https://api.geohabita.com";
const MARKER_SIZE = { width: 118, height: 78 };

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

const Viewer360Modal = ({ images360 = [], onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hotspots, setHotspots] = useState([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerLoadMessage, setViewerLoadMessage] = useState("Preparando recorrido 360...");
  const [travelingTo, setTravelingTo] = useState("");
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const travelTimerRef = useRef(null);

  const normalizedImages = useMemo(
    () => (Array.isArray(images360) ? images360.map(normalizeImage) : []),
    [images360],
  );

  const currentImage = normalizedImages[currentIndex];
  const currentImageId = getImageId(currentImage);

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
        console.error("Error cargando hotspots 360:", error);
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

      viewerInstance = new Viewer({
        container: containerRef.current,
        panorama: currentImage.imagen,
        caption: currentImage.nombre,
        adapter: [EquirectangularAdapter, { resolution: VIEWER_RESOLUTION }],
        defaultZoomLvl: 35,
        moveSpeed: VIEWER_MOVE_SPEED,
        fisheye: false,
        loadingImg: VIEWER_LOADING_ICON,
        loadingTxt: "Cargando vista 360...",
        navbar: ["zoom", "move", "caption", "fullscreen"],
        plugins: [[MarkersPlugin, {}]],
      });

      viewerRef.current = viewerInstance;
      const markers = viewerInstance.getPlugin(MarkersPlugin);

      markers.addEventListener("select-marker", (event) => {
        const marker = event?.marker || event?.detail?.marker;
        const destinoId = marker?.data?.destinoId;
        if (destinoId) travelToImageById(destinoId, marker?.data?.destinoNombre);
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
  }, [currentImage, travelToImageById]);

  useEffect(() => {
    if (!viewerReady || !viewerRef.current) return;

    const markers = viewerRef.current.getPlugin(MarkersPlugin);
    markers.clearMarkers();

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
  }, [viewerReady, hotspots]);

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
