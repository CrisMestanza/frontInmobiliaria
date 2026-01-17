// components/LoteModal.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Polygon, DrawingManager } from "@react-google-maps/api";
import style from "../agregarInmo.module.css";
import loader from "../../../components/loader";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  savePdfToIndexedDB,
  loadPdfFromIndexedDB,
  deletePdfFromIndexedDB,
} from "../../../components/utils/indexedDB";

export default function LoteModal({ onClose, idproyecto }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const token = localStorage.getItem("access");
  const [mapCenter, setMapCenter] = useState(null);
  const [proyectoCoords, setProyectoCoords] = useState([]);
  const [generatedLotes, setGeneratedLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [gridParams, setGridParams] = useState({ rows: 3, cols: 2 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [basePolygonCoords, setBasePolygonCoords] = useState(null);
  const [detectedAngle, setDetectedAngle] = useState(0);
  const [lotesCoords, setLotesCoords] = useState([]);

  // Estados para PDF overlay
  const [pdfImage, setPdfImage] = useState(null);
  const [overlayBounds, setOverlayBounds] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);
  const [isPDFLocked, setIsPDFLocked] = useState(false);
  const [pdfRotation, setPdfRotation] = useState(0);

  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const drawnPolygonRef = useRef(null);
  const fileInputRef = useRef(null);
  const originalPdfImageRef = useRef(null);
  const overlayRef = useRef(null);

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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
              this.bounds.west
            )
          );
          const ne = overlayProjection.fromLatLngToDivPixel(
            new googleRef.current.maps.LatLng(
              this.bounds.north,
              this.bounds.east
            )
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
    []
  );

  useEffect(() => {
    loader.load().then((googleInstance) => {
      setIsLoaded(true);
      googleRef.current = googleInstance;
    });
  }, []);

  const fetchProyecto = useCallback(async () => {
    try {
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/listPuntosProyecto/${idproyecto}`
      );
      const puntosProyecto = await res.json();
      if (!puntosProyecto || !puntosProyecto.length) return;

      const center = {
        lat: parseFloat(puntosProyecto[0].latitud),
        lng: parseFloat(puntosProyecto[0].longitud),
      };
      setMapCenter(center);

      const coords = puntosProyecto.map((p) => ({
        lat: parseFloat(p.latitud),
        lng: parseFloat(p.longitud),
      }));
      setProyectoCoords(coords);

      // Cargar lotes existentes
      const resLotes = await fetch(
        `https://apiinmo.y0urs.com/api/getLoteProyecto/${idproyecto}`
      );
      const lotes = await resLotes.json();

      const lotesData = [];
      for (const lote of lotes) {
        const resPuntos = await fetch(
          `https://apiinmo.y0urs.com/api/listPuntos/${lote.idlote}`
        );
        const puntos = await resPuntos.json();
        if (!puntos.length) continue;

        const coords = puntos
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({
            lat: parseFloat(p.latitud),
            lng: parseFloat(p.longitud),
          }));

        if (coords.length > 2) coords.push(coords[0]);
        lotesData.push({ coords, vendido: lote.vendido });
      }
      setLotesCoords(lotesData);
    } catch (err) {
      console.error("Error cargando proyecto:", err);
    }
  }, [idproyecto]);

  useEffect(() => {
    if (isLoaded) fetchProyecto();
  }, [fetchProyecto, isLoaded]);

  // ============ CARGAR PDF GUARDADO AL ABRIR EL MODAL ============
  // Reemplaza el useEffect de "CARGAR PDF GUARDADO" (línea ~175 aproximadamente)
  useEffect(() => {
    const loadSavedPDF = async () => {
      if (!isLoaded || !mapCenter) return;

      try {
        const pdfBlob = await loadPdfFromIndexedDB(idproyecto);

        if (pdfBlob) {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          const typedArray = new Uint8Array(arrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const page = await pdf.getPage(1);

          const scale = 2.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const imageUrl = canvas.toDataURL("image/png");

          // 🔥 SIEMPRE guardar la imagen original sin rotar
          originalPdfImageRef.current = imageUrl;
          setPdfImage(imageUrl);

          // Cargar metadatos desde localStorage
          const savedMeta = localStorage.getItem(`pdf_meta_${idproyecto}`);

          if (savedMeta) {
            const meta = JSON.parse(savedMeta);

            // 🔥 Restaurar bounds, opacidad y rotación desde los metadatos
            setOverlayBounds(meta.bounds);
            setOverlayOpacity(meta.opacity || 0.6);
            setPdfRotation(meta.rotation || 0);

            console.log("✅ PDF cargado con metadatos:", meta);
          } else {
            // Si no hay metadatos, usar valores predeterminados
            setPdfRotation(0);

            const centerLat = mapCenter.lat;
            const centerLng = mapCenter.lng;
            const aspectRatio = viewport.height / viewport.width;
            const widthDegrees = 0.002;
            const heightDegrees = widthDegrees * aspectRatio;

            setOverlayBounds({
              north: centerLat + heightDegrees / 2,
              south: centerLat - heightDegrees / 2,
              east: centerLng + widthDegrees / 2,
              west: centerLng - widthDegrees / 2,
            });

            console.log(
              "ℹ️ PDF cargado sin metadatos, usando valores por defecto"
            );
          }

          console.log("✅ PDF cargado desde IndexedDB");
        }
      } catch (error) {
        console.warn("⚠️ No se pudo cargar PDF guardado:", error);
      }
    };

    loadSavedPDF();
  }, [idproyecto, isLoaded, mapCenter]);

  // ============ GUARDAR METADATOS DEL PDF AUTOMÁTICAMENTE ============
  useEffect(() => {
    if (pdfImage && overlayBounds) {
      const pdfMeta = {
        bounds: overlayBounds,
        opacity: overlayOpacity,
        rotation: pdfRotation,
      };
      localStorage.setItem(`pdf_meta_${idproyecto}`, JSON.stringify(pdfMeta));
    }
  }, [pdfImage, overlayBounds, pdfRotation, overlayOpacity, idproyecto]);

  // ============ FUNCIONES PDF ============
  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Por favor selecciona un archivo PDF válido");
      return;
    }

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        const typedArray = new Uint8Array(event.target.result);

        // Guardar PDF en IndexedDB
        const pdfBlob = new Blob([typedArray], { type: "application/pdf" });
        await savePdfToIndexedDB(idproyecto, pdfBlob);
        console.log("✅ PDF guardado en IndexedDB");

        // Renderizar PDF
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        const page = await pdf.getPage(1);

        const scale = 2.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const imageUrl = canvas.toDataURL("image/png");
        setPdfImage(imageUrl);
        originalPdfImageRef.current = imageUrl;
        setPdfRotation(0);

        // Inicializar bounds usando mapCenter como referencia
        const centerLat = mapCenter?.lat || -6.4882;
        const centerLng = mapCenter?.lng || -76.365629;

        const aspectRatio = viewport.height / viewport.width;
        const widthDegrees = 0.002;
        const heightDegrees = widthDegrees * aspectRatio;

        setOverlayBounds({
          north: centerLat + heightDegrees / 2,
          south: centerLat - heightDegrees / 2,
          east: centerLng + widthDegrees / 2,
          west: centerLng - widthDegrees / 2,
        });

        setIsPDFLocked(false);
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error al procesar PDF:", error);
      alert("Error al cargar PDF");
    }
  };

  const adjustOverlaySize = (scaleChange) => {
    if (!overlayBounds || isPDFLocked) return;

    const centerLat = (overlayBounds.north + overlayBounds.south) / 2;
    const centerLng = (overlayBounds.east + overlayBounds.west) / 2;

    const currentHeight = overlayBounds.north - overlayBounds.south;
    const currentWidth = overlayBounds.east - overlayBounds.west;

    const newHeight = currentHeight * scaleChange;
    const newWidth = currentWidth * scaleChange;

    setOverlayBounds({
      north: centerLat + newHeight / 2,
      south: centerLat - newHeight / 2,
      east: centerLng + newWidth / 2,
      west: centerLng - newWidth / 2,
    });
  };

  const moveOverlay = (latDelta, lngDelta) => {
    if (!overlayBounds || isPDFLocked) return;

    setOverlayBounds((prev) => ({
      north: prev.north + latDelta,
      south: prev.south + latDelta,
      east: prev.east + lngDelta,
      west: prev.west + lngDelta,
    }));
  };

  // const adjustBoundsForRotation = (currentBounds, rotationDegrees) => {
  //   const centerLat = (currentBounds.north + currentBounds.south) / 2;
  //   const centerLng = (currentBounds.east + currentBounds.west) / 2;

  //   const currentHeight = currentBounds.north - currentBounds.south;
  //   const currentWidth = currentBounds.east - currentBounds.west;

  //   // Para rotaciones de 90° y 270°, intercambiamos ancho y alto
  //   const normalizedRotation = ((rotationDegrees % 360) + 360) % 360;
  //   const isRightAngle = Math.abs(normalizedRotation % 180) === 90;

  //   let newHeight, newWidth;

  //   if (isRightAngle) {
  //     newHeight = currentWidth;
  //     newWidth = currentHeight;
  //   } else {
  //     newHeight = currentHeight;
  //     newWidth = currentWidth;
  //   }

  //   return {
  //     north: centerLat + newHeight / 2,
  //     south: centerLat - newHeight / 2,
  //     east: centerLng + newWidth / 2,
  //     west: centerLng - newWidth / 2,
  //   };
  // };

  const rotatePDF = (degrees) => {
    if (isPDFLocked) return;
    const newRotation = (pdfRotation + degrees) % 360;
    setPdfRotation(newRotation);
  };
  const handleDeletePDF = async () => {
    if (
      confirm("¿Seguro que deseas eliminar definitivamente el PDF guardado?")
    ) {
      try {
        await deletePdfFromIndexedDB(idproyecto);
        localStorage.removeItem(`pdf_meta_${idproyecto}`);

        setPdfImage(null);
        setOverlayBounds(null);
        setIsPDFLocked(false);
        setPdfRotation(0);
        originalPdfImageRef.current = null;

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        alert("✅ PDF eliminado permanentemente.");
        console.log("🗑️ PDF eliminado de IndexedDB");
      } catch (error) {
        console.error("Error al eliminar PDF:", error);
        alert("Error al eliminar el PDF");
      }
    }
  };

  // ============ FUNCIONES CUADRÍCULA ============
  const detectPolygonOrientation = (coords) => {
    if (coords.length < 2) return 0;

    let maxLength = 0;
    let bestAngle = 0;

    for (let i = 0; i < coords.length; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % coords.length];

      const dx = p2.lng - p1.lng;
      const dy = p2.lat - p1.lat;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > maxLength) {
        maxLength = length;
        bestAngle = Math.atan2(dy, dx);
      }
    }

    return bestAngle;
  };

  const calculateOrientedBoundingBox = (coords, angleRad) => {
    if (!coords || coords.length === 0) return null;

    const cosA = Math.cos(-angleRad);
    const sinA = Math.sin(-angleRad);

    const rotatedPoints = coords.map((p) => {
      const x = p.lng;
      const y = p.lat;
      return {
        x: x * cosA - y * sinA,
        y: x * sinA + y * cosA,
      };
    });

    const minX = Math.min(...rotatedPoints.map((p) => p.x));
    const maxX = Math.max(...rotatedPoints.map((p) => p.x));
    const minY = Math.min(...rotatedPoints.map((p) => p.y));
    const maxY = Math.max(...rotatedPoints.map((p) => p.y));

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const cosB = Math.cos(angleRad);
    const sinB = Math.sin(angleRad);
    const centerLng = centerX * cosB - centerY * sinB;
    const centerLat = centerX * sinB + centerY * cosB;

    return {
      centerLat,
      centerLng,
      width,
      height,
      angleRad,
    };
  };

  const clipRectangleToPolygon = (rectCoords, polygonCoords) => {
    if (!googleRef.current) return null;

    try {
      const polygonPath = polygonCoords.map(
        (c) => new googleRef.current.maps.LatLng(c.lat, c.lng)
      );
      const basePolygon = new googleRef.current.maps.Polygon({
        paths: polygonPath,
      });

      const insidePoints = [];
      rectCoords.forEach((coord) => {
        const point = new googleRef.current.maps.LatLng(coord.lat, coord.lng);
        if (
          googleRef.current.maps.geometry.poly.containsLocation(
            point,
            basePolygon
          )
        ) {
          insidePoints.push(coord);
        }
      });

      if (insidePoints.length === 4) return rectCoords;

      if (insidePoints.length === 0) {
        const centerLat =
          rectCoords.reduce((sum, c) => sum + c.lat, 0) / rectCoords.length;
        const centerLng =
          rectCoords.reduce((sum, c) => sum + c.lng, 0) / rectCoords.length;
        const centerPoint = new googleRef.current.maps.LatLng(
          centerLat,
          centerLng
        );

        if (
          !googleRef.current.maps.geometry.poly.containsLocation(
            centerPoint,
            basePolygon
          )
        ) {
          return null;
        }
      }

      const clippedPoints = [...insidePoints];

      for (let i = 0; i < rectCoords.length; i++) {
        const p1 = rectCoords[i];
        const p2 = rectCoords[(i + 1) % rectCoords.length];

        for (let j = 0; j < polygonCoords.length; j++) {
          const q1 = polygonCoords[j];
          const q2 = polygonCoords[(j + 1) % polygonCoords.length];

          const intersection = getLineIntersection(p1, p2, q1, q2);
          if (intersection) {
            const isDuplicate = clippedPoints.some(
              (pt) =>
                Math.abs(pt.lat - intersection.lat) < 0.0000001 &&
                Math.abs(pt.lng - intersection.lng) < 0.0000001
            );
            if (!isDuplicate) {
              clippedPoints.push(intersection);
            }
          }
        }
      }

      const rectPolygon = new googleRef.current.maps.Polygon({
        paths: rectCoords.map(
          (c) => new googleRef.current.maps.LatLng(c.lat, c.lng)
        ),
      });

      polygonCoords.forEach((coord) => {
        const point = new googleRef.current.maps.LatLng(coord.lat, coord.lng);
        if (
          googleRef.current.maps.geometry.poly.containsLocation(
            point,
            rectPolygon
          )
        ) {
          const isDuplicate = clippedPoints.some(
            (pt) =>
              Math.abs(pt.lat - coord.lat) < 0.0000001 &&
              Math.abs(pt.lng - coord.lng) < 0.0000001
          );
          if (!isDuplicate) {
            clippedPoints.push(coord);
          }
        }
      });

      if (clippedPoints.length >= 3) {
        return sortPointsCounterClockwise(clippedPoints);
      }

      return null;
    } catch (error) {
      console.warn("Error en clipRectangleToPolygon:", error);
      return null;
    }
  };

  const getLineIntersection = (p1, p2, q1, q2) => {
    const x1 = p1.lng,
      y1 = p1.lat;
    const x2 = p2.lng,
      y2 = p2.lat;
    const x3 = q1.lng,
      y3 = q1.lat;
    const x4 = q2.lng,
      y4 = q2.lat;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        lat: y1 + t * (y2 - y1),
        lng: x1 + t * (x2 - x1),
      };
    }

    return null;
  };

  const sortPointsCounterClockwise = (points) => {
    const center = {
      lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
      lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
    };

    return points.sort((a, b) => {
      const angleA = Math.atan2(a.lat - center.lat, a.lng - center.lng);
      const angleB = Math.atan2(b.lat - center.lat, b.lng - center.lng);
      return angleA - angleB;
    });
  };

  const generateGridFromPolygon = useCallback(
    (polygonCoords, rows, cols, additionalRotationDeg = 0) => {
      if (!polygonCoords || !googleRef.current) return [];

      const baseAngleRad = detectPolygonOrientation(polygonCoords);
      const totalAngleRad =
        baseAngleRad + (additionalRotationDeg * Math.PI) / 180;

      const obb = calculateOrientedBoundingBox(polygonCoords, totalAngleRad);
      if (!obb) return [];

      const { centerLat, centerLng, width, height } = obb;

      const cellWidth = width / cols;
      const cellHeight = height / rows;

      const cosA = Math.cos(totalAngleRad);
      const sinA = Math.sin(totalAngleRad);

      const grid = [];
      let loteCounter = 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const localMinX = -width / 2 + c * cellWidth;
          const localMaxX = localMinX + cellWidth;
          const localMinY = -height / 2 + r * cellHeight;
          const localMaxY = localMinY + cellHeight;

          const localCorners = [
            { x: localMinX, y: localMinY },
            { x: localMaxX, y: localMinY },
            { x: localMaxX, y: localMaxY },
            { x: localMinX, y: localMaxY },
          ];

          const globalCorners = localCorners.map((corner) => {
            const rotatedX = corner.x * cosA - corner.y * sinA;
            const rotatedY = corner.x * sinA + corner.y * cosA;
            return {
              lat: centerLat + rotatedY,
              lng: centerLng + rotatedX,
            };
          });

          const clippedCoords = clipRectangleToPolygon(
            globalCorners,
            polygonCoords
          );

          if (clippedCoords && clippedCoords.length >= 3) {
            grid.push({
              id: loteCounter++,
              coords: clippedCoords,
              // nombre: `Lote ${r + 1}-${c + 1}`,
              nombre: `Lote ${loteCounter}, Manzana `,
              precio: 0,
              descripcion: "",
              vendido: 0,
              row: r,
              col: c,
            });
          }
        }
      }

      return grid;
    },
    []
  );

  const handleRegenerateGrid = useCallback(() => {
    if (!basePolygonCoords) return;

    const grid = generateGridFromPolygon(
      basePolygonCoords,
      gridParams.rows,
      gridParams.cols,
      rotationDeg
    );
    setGeneratedLotes(grid);
  }, [
    basePolygonCoords,
    gridParams.rows,
    gridParams.cols,
    rotationDeg,
    generateGridFromPolygon,
  ]);

  useEffect(() => {
    if (!isLoaded || !googleRef.current || !mapRef.current) return;

    if (!pdfImage || !overlayBounds) {
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      return;
    }

    // Crear o actualizar el overlay
    if (overlayRef.current) {
      overlayRef.current.updateImage(pdfImage);
      overlayRef.current.updateBounds(overlayBounds);
      overlayRef.current.updateRotation(pdfRotation);
      overlayRef.current.updateOpacity(overlayOpacity);
    } else {
      const newOverlay = createRotatableOverlay(
        overlayBounds,
        pdfImage,
        pdfRotation,
        overlayOpacity
      );
      if (newOverlay) {
        newOverlay.setMap(mapRef.current);
        overlayRef.current = newOverlay;
      }
    }

    return () => {
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
    };
  }, [
    isLoaded,
    pdfImage,
    overlayBounds,
    pdfRotation,
    overlayOpacity,
    createRotatableOverlay,
  ]);

  useEffect(() => {
    if (basePolygonCoords && isLoaded && googleRef.current) {
      handleRegenerateGrid();
    }
  }, [
    gridParams.rows,
    gridParams.cols,
    rotationDeg,
    basePolygonCoords,
    isLoaded,
    handleRegenerateGrid,
  ]);

  const onPolygonComplete = (poly) => {
    if (!poly) return;

    const path = poly.getPath().getArray();
    const coords = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));

    if (drawnPolygonRef.current) {
      drawnPolygonRef.current.setMap(null);
    }
    drawnPolygonRef.current = poly;
    poly.setMap(null);

    const angle = detectPolygonOrientation(coords);
    setDetectedAngle((angle * 180) / Math.PI);
    setRotationDeg(0);

    setBasePolygonCoords(coords);
  };

  const onMapLoad = (map) => {
    mapRef.current = map;
  };

  const handleGridParamChange = (name, value) => {
    setGridParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectLote = (lote) => {
    setSelectedLote(lote.id);
    const initialForm = formValues[lote.id] || {
      nombre: lote.nombre,
      precio: lote.precio,
      descripcion: lote.descripcion,
    };
    setFormValues((prev) => ({
      ...prev,
      [lote.id]: initialForm,
    }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [selectedLote]: {
        ...prev[selectedLote],
        [name]: name === "vendido" ? parseInt(value) : value,
      },
    }));
  };

  const opcionesEstado = [
    { value: 0, label: "Disponible" },
    { value: 1, label: "Vendido" },
    { value: 2, label: "Reservado" },
  ];

  const handleRegisterAll = async () => {
    if (generatedLotes.length === 0) {
      alert("No hay lotes generados.");
      return;
    }

    const lotesToSend = generatedLotes.map((lote) => ({
      ...lote,
      nombre: formValues[lote.id]?.nombre || lote.nombre,
      precio: formValues[lote.id]?.precio || lote.precio,
      descripcion: formValues[lote.id]?.descripcion || lote.descripcion,
      vendido:
        formValues[lote.id]?.vendido !== undefined
          ? formValues[lote.id].vendido
          : lote.vendido,
      puntos: lote.coords,
      idproyecto,
    }));

    try {
      const res = await fetch(
        "https://apiinmo.y0urs.com/api/registerLotesMasivo/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(lotesToSend),
        }
      );

      if (res.ok) {
        alert("Lotes registrados exitosamente");
        onClose();
      } else {
        console.error(await res.text());
        alert("Error al registrar lotes");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red");
    }
  };

  const getColorLote = (vendido) => {
    switch (vendido) {
      case 0:
        return "#00ff00";
      case 1:
        return "#ff0000";
      case 2:
        return "#ffff00";
      default:
        return "#808080";
    }
  };

  const handleClearPolygon = () => {
    setBasePolygonCoords(null);
    setGeneratedLotes([]);
    setSelectedLote(null);
    setRotationDeg(0);
    setDetectedAngle(0);
    if (drawnPolygonRef.current) {
      drawnPolygonRef.current.setMap(null);
      drawnPolygonRef.current = null;
    }
  };

  if (!isLoaded || !mapCenter) return <div>Cargando mapa...</div>;

  return (
    <div className={style.modalOverlay}>
      <div
        className={style.modalContent}
        style={{ maxWidth: "95vw", width: "1400px" }}
      >
        <button className={style.closeBtn} onClick={onClose}>
          ×
        </button>

        <h2 style={{ color: "black" }}>Generar Lotes con Plano PDF</h2>

        {/* CONTROLES PDF */}
        {pdfImage && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              backgroundColor: isPDFLocked ? "#e8f5e9" : "#fff3cd",
              borderRadius: "8px",
              border: isPDFLocked ? "2px solid #4CAF50" : "2px solid #ff9800",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "1rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <strong>
                {isPDFLocked ? "✅ PDF Fijado" : "🔧 Ajustando PDF"}
              </strong>

              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <label>Opacidad:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={overlayOpacity}
                  onChange={(e) =>
                    setOverlayOpacity(parseFloat(e.target.value))
                  }
                  style={{ width: "120px" }}
                />
                <span>{(overlayOpacity * 100).toFixed(0)}%</span>
              </div>

              <button
                onClick={() => setIsPDFLocked(!isPDFLocked)}
                className={style.submitBtn}
                style={{ backgroundColor: isPDFLocked ? "#ff9800" : "#4CAF50" }}
              >
                {isPDFLocked ? "Mostrar Botones" : "Ocultar Botones"}
              </button>

              <button
                onClick={() => {
                  setPdfImage(null);
                  setOverlayBounds(null);
                  setIsPDFLocked(false);
                  setPdfRotation(0);
                  originalPdfImageRef.current = null;
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className={style.submitBtn}
                style={{ backgroundColor: "#f44336" }}
              >
                🗑️ Quitar PDF
              </button>

              <button
                onClick={handleDeletePDF}
                className={style.submitBtn}
                style={{ backgroundColor: "#d32f2f", color: "white" }}
              >
                🗑️ Eliminar definitivamente
              </button>
            </div>

            {!isPDFLocked && (
              <>
                {/* === PANEL DE TAMAÑO === */}
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "10px",
                  }}
                >
                  <div style={{ marginBottom: "0.75rem", textAlign: "center" }}>
                    <strong style={{ fontSize: "16px" }}>
                      Ajuste de Tamaño
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <button
                      onClick={() => adjustOverlaySize(1.1)}
                      className={style.submitBtn}
                      style={{
                        backgroundColor: "#1976d2",
                        color: "white",
                        borderRadius: "10px",
                        width: "120px",
                      }}
                    >
                      ➕ Agrandar
                    </button>
                    <button
                      onClick={() => adjustOverlaySize(0.9)}
                      className={style.submitBtn}
                      style={{
                        backgroundColor: "#1976d2",
                        color: "white",
                        borderRadius: "10px",
                        width: "120px",
                      }}
                    >
                      ➖ Reducir
                    </button>
                    <button
                      onClick={() => adjustOverlaySize(1.05)}
                      className={style.submitBtn}
                      style={{
                        backgroundColor: "#64b5f6",
                        color: "white",
                        borderRadius: "10px",
                        width: "100px",
                      }}
                    >
                      + Fino
                    </button>
                    <button
                      onClick={() => adjustOverlaySize(0.95)}
                      className={style.submitBtn}
                      style={{
                        backgroundColor: "#64b5f6",
                        color: "white",
                        borderRadius: "10px",
                        width: "100px",
                      }}
                    >
                      - Fino
                    </button>
                    <button
                      onClick={() => adjustOverlaySize(1.02)}
                      className={style.submitBtn}
                      style={{
                        backgroundColor: "#90caf9",
                        color: "white",
                        borderRadius: "10px",
                        width: "110px",
                      }}
                    >
                      + Muy fino
                    </button>

                    <button
                      onClick={() => adjustOverlaySize(0.98)}
                      className={style.submitBtn}
                      style={{
                        backgroundColor: "#90caf9",
                        color: "white",
                        borderRadius: "10px",
                        width: "110px",
                      }}
                    >
                      - Muy fino
                    </button>
                  </div>
                </div>

                {/* === PANEL DE POSICIÓN === */}
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-evenly",
                      flexWrap: "wrap",
                      gap: "1.5rem",
                      textAlign: "center",
                    }}
                  >
                    {/* === Movimiento Normal === */}
                    <div>
                      <strong
                        style={{ display: "block", marginBottom: "0.5rem" }}
                      >
                        Posición del PDF
                      </strong>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 55px)",
                          gridTemplateRows: "repeat(3, 55px)",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <button
                          onClick={() => moveOverlay(0.0005, 0)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "2",
                            gridRow: "1",
                            backgroundColor: "#1976d2",
                            color: "white",
                            borderRadius: "50%",
                            fontSize: "20px",
                          }}
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={() => moveOverlay(0, -0.0005)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "1",
                            gridRow: "2",
                            backgroundColor: "#1976d2",
                            color: "white",
                            borderRadius: "50%",
                            fontSize: "20px",
                          }}
                        >
                          ⬅️
                        </button>
                        <div
                          style={{
                            gridColumn: "2",
                            gridRow: "2",
                            backgroundColor: "#e3f2fd",
                            borderRadius: "50%",
                            width: "45px",
                            height: "45px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontWeight: "bold",
                            color: "#1565c0",
                          }}
                        >
                          PDF
                        </div>
                        <button
                          onClick={() => moveOverlay(0, 0.0005)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "3",
                            gridRow: "2",
                            backgroundColor: "#1976d2",
                            color: "white",
                            borderRadius: "50%",
                            fontSize: "20px",
                          }}
                        >
                          ➡️
                        </button>
                        <button
                          onClick={() => moveOverlay(-0.0005, 0)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "2",
                            gridRow: "3",
                            backgroundColor: "#1976d2",
                            color: "white",
                            borderRadius: "50%",
                            fontSize: "20px",
                          }}
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>

                    {/* === Movimiento Fino === */}
                    <div>
                      <strong
                        style={{ display: "block", marginBottom: "0.5rem" }}
                      >
                        Fino
                      </strong>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 45px)",
                          gridTemplateRows: "repeat(3, 45px)",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <button
                          onClick={() => moveOverlay(0.0001, 0)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "2",
                            gridRow: "1",
                            backgroundColor: "#64b5f6",
                            borderRadius: "50%",
                          }}
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={() => moveOverlay(0, -0.0001)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "1",
                            gridRow: "2",
                            backgroundColor: "#64b5f6",
                            borderRadius: "50%",
                          }}
                        >
                          ⬅️
                        </button>
                        <div
                          style={{
                            gridColumn: "2",
                            gridRow: "2",
                            backgroundColor: "#e3f2fd",
                            borderRadius: "50%",
                            width: "45px",
                            height: "45px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontWeight: "bold",
                            color: "#1565c0",
                          }}
                        >
                          PDF
                        </div>
                        <button
                          onClick={() => moveOverlay(0, 0.0001)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "3",
                            gridRow: "2",
                            backgroundColor: "#64b5f6",
                            borderRadius: "50%",
                          }}
                        >
                          ➡️
                        </button>
                        <button
                          onClick={() => moveOverlay(-0.0001, 0)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "2",
                            gridRow: "3",
                            backgroundColor: "#64b5f6",
                            borderRadius: "50%",
                          }}
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>

                    {/* === Movimiento Muy Fino === */}
                    <div>
                      <strong
                        style={{ display: "block", marginBottom: "0.5rem" }}
                      >
                        Muy Fino
                      </strong>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 40px)",
                          gridTemplateRows: "repeat(3, 40px)",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <button
                          onClick={() => moveOverlay(0.00005, 0)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "2",
                            gridRow: "1",
                            backgroundColor: "#bbdefb",
                            borderRadius: "50%",
                          }}
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={() => moveOverlay(0, -0.00005)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "1",
                            gridRow: "2",
                            backgroundColor: "#bbdefb",
                            borderRadius: "50%",
                          }}
                        >
                          ⬅️
                        </button>
                        <div
                          style={{
                            gridColumn: "2",
                            gridRow: "2",
                            backgroundColor: "#e3f2fd",
                            borderRadius: "50%",
                            width: "45px",
                            height: "45px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontWeight: "bold",
                            color: "#1565c0",
                          }}
                        >
                          PDF
                        </div>
                        <button
                          onClick={() => moveOverlay(0, 0.00005)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "3",
                            gridRow: "2",
                            backgroundColor: "#bbdefb",
                            borderRadius: "50%",
                          }}
                        >
                          ➡️
                        </button>
                        <button
                          onClick={() => moveOverlay(-0.00005, 0)}
                          className={style.submitBtn}
                          style={{
                            gridColumn: "2",
                            gridRow: "3",
                            backgroundColor: "#bbdefb",
                            borderRadius: "50%",
                          }}
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* === PANEL DE ROTACIÓN === */}
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      marginBottom: "0.5rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <strong style={{ fontSize: "16px" }}>Rotación</strong>
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "#1976d2",
                      }}
                    >
                      {pdfRotation}°
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <button
                      onClick={() => rotatePDF(90)}
                      className={style.submitBtn}
                    >
                      ↻ 90°
                    </button>
                    <button
                      onClick={() => rotatePDF(45)}
                      className={style.submitBtn}
                    >
                      ↻ 45°
                    </button>
                    <button
                      onClick={() => rotatePDF(15)}
                      className={style.submitBtn}
                    >
                      ↻ 15°
                    </button>
                    <button
                      onClick={() => rotatePDF(5)}
                      className={style.submitBtn}
                    >
                      ↻ 5°
                    </button>
                    <button
                      onClick={() => rotatePDF(1)}
                      className={style.submitBtn}
                    >
                      ↻ 1°
                    </button>
                    <button
                      onClick={() => rotatePDF(-1)}
                      className={style.submitBtn}
                    >
                      ↺ 1°
                    </button>
                    <button
                      onClick={() => rotatePDF(-5)}
                      className={style.submitBtn}
                    >
                      ↺ 5°
                    </button>
                    <button
                      onClick={() => rotatePDF(-15)}
                      className={style.submitBtn}
                    >
                      ↺ 15°
                    </button>
                    <button
                      onClick={() => rotatePDF(-45)}
                      className={style.submitBtn}
                    >
                      ↺ 45°
                    </button>
                    <button
                      onClick={() => rotatePDF(-90)}
                      className={style.submitBtn}
                    >
                      ↺ 90°
                    </button>
                    <button
                      onClick={() => {
                        setPdfRotation(0);
                      }}
                      className={style.submitBtn}
                      style={{ backgroundColor: "#ff9800", color: "white" }}
                    >
                      🔄 Restablecer
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.5rem",
                    backgroundColor: "#e3f2fd",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "#1976d2",
                  }}
                >
                  💡 <strong>Consejo:</strong> Usa los controles "Fino" y "Muy
                  Fino" para ajustes precisos. Cuando termines de ajustar,
                  presiona "🔒 Fijar PDF" para continuar con los lotes.
                </div>
              </>
            )}
          </div>
        )}

        {/* CONTROLES CUADRÍCULA */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "0.5rem",
            alignItems: "center",
          }}
        >
          {!pdfImage && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={style.submitBtn}
              type="button"
            >
              📄 Subir Plano PDF
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePDFUpload}
            style={{ display: "none" }}
          />

          <div>
            <label>Filas:</label>
            <input
              type="number"
              value={gridParams.rows}
              min="1"
              max="50"
              onChange={(e) =>
                handleGridParamChange("rows", parseInt(e.target.value || 1))
              }
              className={style.input}
              style={{ width: "4rem", marginLeft: "0.5rem" }}
            />
          </div>

          <div>
            <label>Columnas:</label>
            <input
              type="number"
              value={gridParams.cols}
              min="1"
              max="50"
              onChange={(e) =>
                handleGridParamChange("cols", parseInt(e.target.value || 1))
              }
              className={style.input}
              style={{ width: "4rem", marginLeft: "0.5rem" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minWidth: "250px",
            }}
          >
            <label>Ajuste:</label>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={rotationDeg}
              onChange={(e) => setRotationDeg(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <div
              style={{
                width: "3.5rem",
                textAlign: "right",
                fontWeight: "bold",
              }}
            >
              {rotationDeg.toFixed(0)}°
            </div>
          </div>

          <button
            className={style.submitBtn}
            onClick={handleRegenerateGrid}
            disabled={!basePolygonCoords}
          >
            🔄 Regenerar
          </button>

          <button
            className={style.submitBtn}
            onClick={handleClearPolygon}
            style={{ backgroundColor: "#ff6b6b" }}
          >
            🗑️ Limpiar
          </button>
        </div>

        <div
          style={{ marginBottom: "0.5rem", color: "#333", fontSize: "14px" }}
        >
          {!basePolygonCoords && (
            <div>
              <span>
                ✏️ Dibuja un polígono en el mapa para comenzar, en base a ese
                polígono puedes generar filas y columnas y ajustar su ángulo,
                luego presionar con la manito "✋" para seleccionar y editar los
                lotes.
              </span>
              <br />
              <span>
                ⟳ Si cargaste un pdf anteriormente, espera a que cargue
              </span>
              <br />
              <span>⏳ La carga depende del tamaño del PDF subido</span>
            </div>
          )}

          {basePolygonCoords && (
            <div>
              <span>
                <strong>Lotes generados: {generatedLotes.length}</strong>
                {selectedLote && ` | Seleccionado: Lote ${selectedLote}`}
              </span>
              <br />
              <span style={{ fontSize: "12px", color: "#666" }}>
                Ángulo detectado: {detectedAngle.toFixed(1)}° | Ajuste:{" "}
                {rotationDeg}°
              </span>
            </div>
          )}
        </div>

        {/* MAPA */}
        <GoogleMap
          onLoad={onMapLoad}
          mapContainerStyle={{
            width: "100%",
            height: "500px",
            marginBottom: "1rem",
          }}
          zoom={18}
          center={mapCenter}
          options={{
            gestureHandling: "greedy",
            // mapTypeId: pdfImage ? "satellite" : "roadmap",
            zoomControl: true,
            // streetViewControl: false,
            // mapTypeControl: false,
            // fullscreenControl: false,
          }}
        >
          {proyectoCoords.length > 0 && (
            <Polygon
              paths={proyectoCoords}
              options={{
                strokeColor: "#0000FF",
                strokeWeight: 2,
                fillColor: "#0000FF",
                fillOpacity: 0.1,
                clickable: false,
                zIndex: 0,
              }}
            />
          )}

          {basePolygonCoords && (
            <Polygon
              paths={basePolygonCoords}
              options={{
                strokeColor: "#FF00FF",
                strokeWeight: 3,
                fillOpacity: 0.15,
                fillColor: "#FF00FF",
                clickable: false,
                zIndex: 1,
              }}
            />
          )}

          {lotesCoords.map((lote, i) => (
            <Polygon
              key={`existing-${i}`}
              paths={lote.coords}
              options={{
                strokeColor: "#333333",
                strokeWeight: 1,
                fillColor: getColorLote(lote.vendido),
                fillOpacity: 0.45,
                clickable: false,
                zIndex: 2,
              }}
            />
          ))}

          {generatedLotes.map((lote) => (
            <Polygon
              key={lote.id}
              paths={lote.coords}
              onClick={() => handleSelectLote(lote)}
              onMouseUp={(e) => {
                const polygon = e.overlay || e?.domEvent?.target;
                if (!polygon || !polygon.getPath) return;

                try {
                  const path = polygon.getPath();
                  const coords = [];
                  for (let i = 0; i < path.getLength(); i++) {
                    const point = path.getAt(i);
                    coords.push({ lat: point.lat(), lng: point.lng() });
                  }
                  setGeneratedLotes((prev) =>
                    prev.map((l) => (l.id === lote.id ? { ...l, coords } : l))
                  );
                } catch (error) {
                  console.warn("Error al actualizar coordenadas:", error);
                }
              }}
              options={{
                strokeColor: selectedLote === lote.id ? "#ff0000" : "#008000",
                strokeWeight: 2,
                fillColor: selectedLote === lote.id ? "#ff8080" : "#00ff00",
                fillOpacity: 0.5,
                editable: true,
                draggable: true,
                zIndex: 10,
                clickable: true,
              }}
            />
          ))}

          {!isPDFLocked && (
            <DrawingManager
              onPolygonComplete={onPolygonComplete}
              options={{
                drawingControl: true,
                drawingControlOptions: {
                  position:
                    googleRef.current?.maps.ControlPosition.TOP_CENTER || 7,
                  drawingModes: ["polygon"],
                },
                polygonOptions: {
                  editable: true,
                  draggable: true,
                  fillColor: "#FF00FF",
                  fillOpacity: 0.3,
                  strokeColor: "#FF00FF",
                  strokeWeight: 2,
                },
              }}
            />
          )}
        </GoogleMap>

        {selectedLote && (
          <div className={style.formContainer}>
            <h3>Editar Lote {selectedLote}</h3>

            <label>Nombre:</label>
            <input
              name="nombre"
              value={
                formValues[selectedLote]?.nombre ||
                generatedLotes.find((l) => l.id === selectedLote)?.nombre ||
                ""
              }
              onChange={handleFormChange}
              className={style.input}
            />
            <label>Precio:</label>
            <input
              name="precio"
              type="number"
              min="0"
              step="0.01"
              value={
                formValues[selectedLote]?.precio ||
                generatedLotes.find((l) => l.id === selectedLote)?.precio ||
                ""
              }
              onChange={handleFormChange}
              className={style.input}
            />

            <label>Estado:</label>
            <select
              name="vendido"
              value={
                formValues[selectedLote]?.vendido !== undefined
                  ? formValues[selectedLote]?.vendido
                  : generatedLotes.find((l) => l.id === selectedLote)
                      ?.vendido ?? 0
              }
              onChange={handleFormChange}
              className={style.input}
              style={{ padding: "0.5rem", cursor: "pointer" }}
            >
              {opcionesEstado.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>

            <label>Descripción:</label>
            <textarea
              name="descripcion"
              rows="3"
              value={
                formValues[selectedLote]?.descripcion ||
                generatedLotes.find((l) => l.id === selectedLote)
                  ?.descripcion ||
                ""
              }
              onChange={handleFormChange}
              className={style.input}
            ></textarea>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            onClick={handleRegisterAll}
            className={style.submitBtn}
            disabled={generatedLotes.length === 0}
            style={{
              opacity: generatedLotes.length === 0 ? 0.5 : 1,
              cursor: generatedLotes.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            💾 Registrar Todos ({generatedLotes.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `¿Replicar los datos de este lote a los ${
                    generatedLotes.length - 1
                  } lotes restantes?`
                )
              ) {
                const currentData = formValues[selectedLote] || {
                  nombre: generatedLotes.find((l) => l.id === selectedLote)
                    ?.nombre,
                  precio: generatedLotes.find((l) => l.id === selectedLote)
                    ?.precio,
                  descripcion: generatedLotes.find((l) => l.id === selectedLote)
                    ?.descripcion,
                };

                const newFormValues = {};
                generatedLotes.forEach((lote) => {
                  if (lote.id !== selectedLote) {
                    newFormValues[lote.id] = {
                      nombre: lote.nombre, // Mantiene el nombre original de cada lote
                      precio: currentData.precio, // Replica el precio
                      descripcion: currentData.descripcion, // Replica la descripción
                    };
                  } else {
                    newFormValues[lote.id] = currentData; // Mantiene los datos del lote actual
                  }
                });

                setFormValues(newFormValues);
                alert(
                  `✅ Datos replicados a ${
                    generatedLotes.length - 1
                  } lotes. Solo cambia los nombres si es necesario.`
                );
              }
            }}
            className={style.submitBtn}
          >
            📋 Replicar precio y descripción a todos los lotes
          </button>
        </div>
      </div>
    </div>
  );
}
