import React, { useEffect, useRef, useState } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { X, ChevronLeft, ChevronRight, Map as MapIcon } from "lucide-react";
import styles from "./Viewer360.module.css";

const API_BASE = "https://api.geohabita.com";

const Viewer360Modal = ({ images360, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showList, setShowList] = useState(false);
  const viewerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // 1. Evitar que se ejecute si no hay contenedor o imágenes
    if (!containerRef.current || !images360 || images360.length === 0) return;

    const relativePath = images360[currentIndex]?.imagen;
    const fullUrl = relativePath?.startsWith('http') 
      ? relativePath 
      : `${API_BASE}${relativePath}`;

    console.log("🚀 Cargando:", fullUrl);

    // 2. Crear instancia (Versión limpia sin opciones desconocidas)
    const viewerInstance = new Viewer({
      container: containerRef.current,
      panorama: fullUrl,
      caption: images360[currentIndex].nombre,
      loadingImg: "https://geohabita.com/loading.gif",
      navbar: ['zoom', 'move', 'download', 'caption', 'fullscreen'],
    });

    viewerRef.current = viewerInstance;

    // 3. Cleanup: Solo destruir si el componente realmente se desmonta
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [currentIndex]); // Solo depende de currentIndex para recargar la imagen

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % images360.length);
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + images360.length) % images360.length);

  return (
    <div className={styles.overlay360}>
      <div className={styles.header360}>
        <div className={styles.titleGroup}>
          <span className={styles.badge360}>360°</span>
          <h3 className={styles.imageTitle}>{images360[currentIndex]?.nombre}</h3>
        </div>
        <button onClick={onClose} className={styles.closeBtn}><X size={24} /></button>
      </div>

      <div className={styles.viewerContainer} ref={containerRef} style={{ height: '80vh', width: '100%' }}></div>

      {images360.length > 1 && (
        <>
          <button className={`${styles.navBtn} ${styles.prev}`} onClick={prevImage}><ChevronLeft size={30} /></button>
          <button className={`${styles.navBtn} ${styles.next}`} onClick={nextImage}><ChevronRight size={30} /></button>
        </>
      )}
      
      {/* ... (resto del código del selector de lista igual) */}
    </div>
  );
};

export default Viewer360Modal;