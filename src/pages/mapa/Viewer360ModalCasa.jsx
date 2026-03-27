import React, { useEffect, useRef, useState } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import styles from "./Viewer360.module.css";

const API_BASE = "https://api.geohabita.com";

const Viewer360Modal = ({ images360, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const viewerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !images360 || images360.length === 0) return;

    const relativePath = images360[currentIndex]?.imagen;
    const fullUrl = relativePath?.startsWith('http') 
      ? relativePath 
      : `${API_BASE}${relativePath}`;

    const viewerInstance = new Viewer({
      container: containerRef.current,
      panorama: fullUrl,
      caption: images360[currentIndex].nombre,
      loadingImg: "https://geohabita.com/loading.gif", // Podrías usar tu logo aquí
      navbar: ['zoom', 'move', 'download', 'caption', 'fullscreen'],
    });

    viewerRef.current = viewerInstance;

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [currentIndex, images360]);

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % images360.length);
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + images360.length) % images360.length);

  return (
    <div className={styles.overlay360}>
      {/* Contenedor Principal Izquierdo: Visor */}
      <div className={styles.mainContent}>
        <div className={styles.header360}>
          <div className={styles.titleGroup}>
            <span className={styles.badge360}>360° VIRTUAL</span>
            <h3 className={styles.imageTitle}>{images360[currentIndex]?.nombre}</h3>
          </div>
          {/* Botón de cierre movido más a la izquierda con margen */}
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
            <span>Cerrar</span>
          </button>
        </div>

        <div className={styles.viewerWrapper}>
          <div className={styles.viewerContainer} ref={containerRef}></div>
          
          {images360.length > 1 && (
            <>
              <button className={`${styles.navBtn} ${styles.prev}`} onClick={prevImage}>
                <ChevronLeft size={30} />
              </button>
              <button className={`${styles.navBtn} ${styles.next}`} onClick={nextImage}>
                <ChevronRight size={30} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Panel Lateral Derecho: Galería */}
      <aside className={styles.sideGallery}>
        <div className={styles.galleryHeader}>
          <ImageIcon size={18} className={styles.greenText} />
          <span>Vistas disponibles</span>
        </div>
        <div className={styles.galleryList}>
          {images360.map((img, idx) => (
            <button
              key={img.id || idx}
              className={`${styles.galleryItem} ${idx === currentIndex ? styles.activeItem : ""}`}
              onClick={() => setCurrentIndex(idx)}
            >
              <div className={styles.thumbWrapper}>
                <img 
                  src={img.imagen?.startsWith('http') ? img.imagen : `${API_BASE}${img.imagen}`} 
                  alt={img.nombre} 
                />
                {idx === currentIndex && <div className={styles.activeBadge}>Viendo</div>}
              </div>
              <span className={styles.thumbName}>{img.nombre}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default Viewer360Modal;