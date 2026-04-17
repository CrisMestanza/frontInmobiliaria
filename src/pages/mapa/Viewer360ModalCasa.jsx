import React, { useEffect, useMemo, useRef, useState } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
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
const MARKER_SIZE = { width: 42, height: 42 };

const HOTSPOT_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
  <defs>
    <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <circle cx="21" cy="21" r="16" fill="#22c55e" fill-opacity="0.22"/>
  <circle cx="21" cy="21" r="11" fill="#07130c" stroke="#86efac" stroke-width="2" filter="url(#glow)"/>
  <path d="M18 14l10 7-10 7V14z" fill="#86efac"/>
</svg>
`)}`;

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
  const viewerRef = useRef(null);
  const containerRef = useRef(null);

  const normalizedImages = useMemo(
    () => (Array.isArray(images360) ? images360.map(normalizeImage) : []),
    [images360],
  );

  const currentImage = normalizedImages[currentIndex];
  const currentImageId = getImageId(currentImage);

  const goToImageById = (id) => {
    const index = normalizedImages.findIndex((img) => String(getImageId(img)) === String(id));
    if (index >= 0) {
      setCurrentIndex(index);
    }
  };

  const nextImage = () => {
    if (!normalizedImages.length) return;
    setCurrentIndex((prev) => (prev + 1) % normalizedImages.length);
  };

  const prevImage = () => {
    if (!normalizedImages.length) return;
    setCurrentIndex((prev) => (prev - 1 + normalizedImages.length) % normalizedImages.length);
  };

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

    setViewerReady(false);

    const viewerInstance = new Viewer({
      container: containerRef.current,
      panorama: currentImage.imagen,
      caption: currentImage.nombre,
      loadingImg: "https://geohabita.com/loading.gif",
      navbar: ["zoom", "move", "caption", "fullscreen"],
      plugins: [[MarkersPlugin, {}]],
    });

    viewerRef.current = viewerInstance;
    const markers = viewerInstance.getPlugin(MarkersPlugin);

    markers.addEventListener("select-marker", (event) => {
      const marker = event?.marker || event?.detail?.marker;
      const destinoId = marker?.data?.destinoId;
      if (destinoId) goToImageById(destinoId);
    });

    viewerInstance.addEventListener("ready", () => {
      setViewerReady(true);
    });

    return () => {
      viewerInstance.destroy();
      viewerRef.current = null;
    };
  }, [currentImage]);

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
  }, [normalizedImages.length]);

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
          {!viewerReady && <div className={styles.loading360}>Preparando recorrido 360...</div>}
          <div className={styles.viewerContainer} ref={containerRef} />

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
                <img src={img.imagen} alt={img.nombre} />
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
                  onClick={() => goToImageById(hotspot.destino?.id_imagen)}
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
