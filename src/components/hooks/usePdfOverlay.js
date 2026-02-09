// hooks/usePdfOverlay.js
import { useState, useEffect, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { loadPdfFromIndexedDB } from "../utils/indexedDB";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Hook para cargar y gestionar el overlay del PDF en el mapa
 * @param {number} idproyecto - ID del proyecto
 * @param {object} googleRef - Referencia a Google Maps
 * @param {object} mapRef - Referencia al mapa
 * @param {boolean} isLoaded - Si Google Maps está cargado
 * @returns {object} - Estado y funciones del PDF overlay
 */
export const usePdfOverlay = (idproyecto, googleRef, mapRef, isLoaded) => {
  const [pdfImage, setPdfImage] = useState(null);
  const [overlayBounds, setOverlayBounds] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);
  const [pdfRotation, setPdfRotation] = useState(0);
  const overlayRef = useRef(null);
  const originalPdfImageRef = useRef(null);

  /**
   * Clase para crear overlay rotatable en Google Maps
   */
  const createRotatableOverlay = useCallback(
    (bounds, image, rotation, opacity) => {
      if (!googleRef.current) return null;

      class RotatableOverlay extends googleRef.current.maps.OverlayView {
        constructor() {
          super();
          this.bounds = bounds;
          this.image = image;
          this.rotation = rotation;
          this.opacity = opacity;
          this.div = null;
        }

        onAdd() {
          const div = document.createElement("div");
          div.style.borderStyle = "none";
          div.style.borderWidth = "0px";
          div.style.position = "absolute";
          div.style.transformOrigin = "center center";

          const img = document.createElement("img");
          img.src = this.image;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.opacity = this.opacity;
          img.style.position = "absolute";
          div.appendChild(img);

          this.div = div;
          const panes = this.getPanes();
          panes.overlayLayer.appendChild(div);
        }

        draw() {
          const overlayProjection = this.getProjection();
          if (!overlayProjection || !this.div) return;

          const sw = overlayProjection.fromLatLngToDivPixel(
            new googleRef.current.maps.LatLng(
              this.bounds.south,
              this.bounds.west,
            ),
          );
          const ne = overlayProjection.fromLatLngToDivPixel(
            new googleRef.current.maps.LatLng(
              this.bounds.north,
              this.bounds.east,
            ),
          );

          if (this.div) {
            const width = ne.x - sw.x;
            const height = sw.y - ne.y;
            const centerX = (sw.x + ne.x) / 2;
            const centerY = (sw.y + ne.y) / 2;

            this.div.style.left = centerX - width / 2 + "px";
            this.div.style.top = centerY - height / 2 + "px";
            this.div.style.width = width + "px";
            this.div.style.height = height + "px";
            this.div.style.transform = `rotate(${this.rotation}deg)`;
          }
        }

        onRemove() {
          if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
        }

        updateBounds(newBounds) {
          this.bounds = newBounds;
          this.draw();
        }

        updateRotation(newRotation) {
          this.rotation = newRotation;
          this.draw();
        }

        updateOpacity(newOpacity) {
          this.opacity = newOpacity;
          if (this.div) {
            const img = this.div.querySelector("img");
            if (img) img.style.opacity = newOpacity;
          }
        }

        updateImage(newImage) {
          this.image = newImage;
          if (this.div) {
            const img = this.div.querySelector("img");
            if (img) img.src = newImage;
          }
        }
      }

      return new RotatableOverlay();
    },
    [],
  );

  /**
   * Cargar PDF guardado desde IndexedDB
   */
  const loadSavedPDF = useCallback(async () => {
    if (!isLoaded || !mapRef.current) return;

    try {
      const pdfBlob = await loadPdfFromIndexedDB(idproyecto);

      if (pdfBlob) {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        const page = await pdf.getPage(1);

        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        const imageData = canvas.toDataURL("image/png");

        // Guardar imagen original
        originalPdfImageRef.current = imageData;

        // Cargar configuración guardada
        const savedSettings = localStorage.getItem(`pdfSettings_${idproyecto}`);
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);

          setPdfImage(imageData);
          setOverlayBounds(settings.bounds);
          setOverlayOpacity(settings.opacity || 0.6);
          setPdfRotation(settings.rotation || 0);

          // Crear overlay con configuración guardada
          if (overlayRef.current) {
            overlayRef.current.setMap(null);
          }

          const overlay = createRotatableOverlay(
            settings.bounds,
            imageData,
            settings.rotation || 0,
            settings.opacity || 0.6,
          );

          overlay.setMap(mapRef.current);
          overlayRef.current = overlay;

          console.log(
            "✅ PDF cargado desde IndexedDB con configuración guardada",
          );
        } else {
          console.log("⚠️ PDF encontrado pero sin configuración guardada");
        }
      }
    } catch (error) {
      console.error("❌ Error al cargar PDF guardado:", error);
    }
  }, [idproyecto, isLoaded, createRotatableOverlay]);

  // Cargar PDF al montar el componente
  useEffect(() => {
    loadSavedPDF();

    // Cleanup
    return () => {
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
      }
    };
  }, [loadSavedPDF]);

  /**
   * Actualizar opacidad del overlay
   */
  const updateOpacity = useCallback((newOpacity) => {
    setOverlayOpacity(newOpacity);
    if (overlayRef.current) {
      overlayRef.current.updateOpacity(newOpacity);
    }
  }, []);

  /**
   * Actualizar rotación del overlay
   */
  const updateRotation = useCallback((newRotation) => {
    setPdfRotation(newRotation);
    if (overlayRef.current) {
      overlayRef.current.updateRotation(newRotation);
    }
  }, []);

  /**
   * Actualizar bounds del overlay
   */
  const updateBounds = useCallback((newBounds) => {
    setOverlayBounds(newBounds);
    if (overlayRef.current) {
      overlayRef.current.updateBounds(newBounds);
    }
  }, []);

  return {
    pdfImage,
    overlayBounds,
    overlayOpacity,
    pdfRotation,
    overlayRef,
    originalPdfImageRef,
    setPdfImage,
    setOverlayBounds,
    setOverlayOpacity,
    setPdfRotation,
    updateOpacity,
    updateRotation,
    updateBounds,
    loadSavedPDF,
    createRotatableOverlay,
  };
};
