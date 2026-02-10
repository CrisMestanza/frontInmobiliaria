// components/LoteModal.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Polygon, DrawingManager } from "@react-google-maps/api";
import style from "../agregarInmoPDF.module.css";
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
  const [movePrecision, setMovePrecision] = useState("normal");
  const moveIntervalRef = useRef(null);
  const [zoomPrecision, setZoomPrecision] = useState("normal");
  const zoomIntervalRef = useRef(null);
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

  useEffect(() => {
    loader.load().then((googleInstance) => {
      setIsLoaded(true);
      googleRef.current = googleInstance;
    });
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, []);

  const fetchProyecto = useCallback(async () => {
    try {
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/listPuntosProyecto/${idproyecto}`,
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

      const resLotes = await fetch(
        `https://apiinmo.y0urs.com/api/getLoteProyecto/${idproyecto}`,
      );
      const lotes = await resLotes.json();

      const lotesData = [];
      for (const lote of lotes) {
        const resPuntos = await fetch(
          `https://apiinmo.y0urs.com/api/listPuntos/${lote.idlote}`,
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

          originalPdfImageRef.current = imageUrl;
          setPdfImage(imageUrl);

          const savedMeta = localStorage.getItem(`pdf_meta_${idproyecto}`);

          if (savedMeta) {
            const meta = JSON.parse(savedMeta);

            setOverlayBounds(meta.bounds);
            setOverlayOpacity(meta.opacity || 0.6);
            setPdfRotation(meta.rotation || 0);

            console.log("✅ PDF cargado con metadatos:", meta);
          } else {
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
              "PDF cargado sin metadatos, usando valores por defecto",
            );
          }

          console.log("PDF cargado desde IndexedDB");
        }
      } catch (error) {
        console.warn("No se pudo cargar PDF guardado:", error);
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

        const pdfBlob = new Blob([typedArray], { type: "application/pdf" });
        await savePdfToIndexedDB(idproyecto, pdfBlob);
        console.log("✅ PDF guardado en IndexedDB");

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

  const startMove = (direction) => {
    if (isPDFLocked) return;

    handleMove(direction, movePrecision);

    moveIntervalRef.current = setInterval(() => {
      handleMove(direction, movePrecision);
    }, 120);
  };

  const stopMove = () => {
    if (moveIntervalRef.current) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
  };

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
        (c) => new googleRef.current.maps.LatLng(c.lat, c.lng),
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
            basePolygon,
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
          centerLng,
        );

        if (
          !googleRef.current.maps.geometry.poly.containsLocation(
            centerPoint,
            basePolygon,
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
                Math.abs(pt.lng - intersection.lng) < 0.0000001,
            );
            if (!isDuplicate) {
              clippedPoints.push(intersection);
            }
          }
        }
      }

      const rectPolygon = new googleRef.current.maps.Polygon({
        paths: rectCoords.map(
          (c) => new googleRef.current.maps.LatLng(c.lat, c.lng),
        ),
      });

      polygonCoords.forEach((coord) => {
        const point = new googleRef.current.maps.LatLng(coord.lat, coord.lng);
        if (
          googleRef.current.maps.geometry.poly.containsLocation(
            point,
            rectPolygon,
          )
        ) {
          const isDuplicate = clippedPoints.some(
            (pt) =>
              Math.abs(pt.lat - coord.lat) < 0.0000001 &&
              Math.abs(pt.lng - coord.lng) < 0.0000001,
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
            polygonCoords,
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
    [],
  );

  const handleRegenerateGrid = useCallback(() => {
    if (!basePolygonCoords) return;

    const grid = generateGridFromPolygon(
      basePolygonCoords,
      gridParams.rows,
      gridParams.cols,
      rotationDeg,
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
        overlayOpacity,
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

  // const onPolygonComplete = (poly) => {
  //   if (!poly) return;

  //   const path = poly.getPath().getArray();
  //   const coords = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));

  //   if (drawnPolygonRef.current) {
  //     drawnPolygonRef.current.setMap(null);
  //   }
  //   drawnPolygonRef.current = poly;
  //   poly.setMap(null);

  //   const angle = detectPolygonOrientation(coords);
  //   setDetectedAngle((angle * 180) / Math.PI);
  //   setRotationDeg(0);

  //   setBasePolygonCoords(coords);
  // };

  const onMapLoad = (map) => {
    mapRef.current = map;
  };

  // const handleGridParamChange = (name, value) => {
  //   setGridParams((prev) => ({ ...prev, [name]: value }));
  // };

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

  const handleSaveChanges = () => {
    if (pdfImage && overlayBounds) {
      const pdfMeta = {
        bounds: overlayBounds,
        opacity: overlayOpacity,
        rotation: pdfRotation,
      };
      localStorage.setItem(`pdf_meta_${idproyecto}`, JSON.stringify(pdfMeta));
    }
    alert("Cambios guardados");
    onClose();
  };

  // const handleClearPolygon = () => {
  //   setBasePolygonCoords(null);
  //   setGeneratedLotes([]);
  //   setSelectedLote(null);
  //   setRotationDeg(0);
  //   setDetectedAngle(0);
  //   if (drawnPolygonRef.current) {
  //     drawnPolygonRef.current.setMap(null);
  //     drawnPolygonRef.current = null;
  //   }
  // };

  const handleZoom = (direction, intensity = "normal") => {
    if (!overlayBounds) return;

    const factors = {
      normal: 0.1,
      fine: 0.05,
      veryFine: 0.02,
    };

    const factor = factors[intensity] || factors.normal;
    const scaleFactor = direction === "in" ? 1 - factor : 1 + factor;

    const centerLat = (overlayBounds.north + overlayBounds.south) / 2;
    const centerLng = (overlayBounds.east + overlayBounds.west) / 2;
    const latSpan = overlayBounds.north - overlayBounds.south;
    const lngSpan = overlayBounds.east - overlayBounds.west;

    const newLatSpan = latSpan * scaleFactor;
    const newLngSpan = lngSpan * scaleFactor;

    const newBounds = {
      north: centerLat + newLatSpan / 2,
      south: centerLat - newLatSpan / 2,
      east: centerLng + newLngSpan / 2,
      west: centerLng - newLngSpan / 2,
    };

    setOverlayBounds(newBounds);
  };

  const handleMove = (direction, intensity = "normal") => {
    if (!overlayBounds) return;

    const factors = {
      normal: 0.05,
      fine: 0.025,
      veryFine: 0.005,
    };

    const factor = factors[intensity] || factors.normal;
    const latSpan = overlayBounds.north - overlayBounds.south;
    const lngSpan = overlayBounds.east - overlayBounds.west;

    let latDelta = 0;
    let lngDelta = 0;

    switch (direction) {
      case "up":
        latDelta = latSpan * factor;
        break;
      case "down":
        latDelta = -latSpan * factor;
        break;
      case "left":
        lngDelta = -lngSpan * factor;
        break;
      case "right":
        lngDelta = lngSpan * factor;
        break;
    }

    const newBounds = {
      north: overlayBounds.north + latDelta,
      south: overlayBounds.south + latDelta,
      east: overlayBounds.east + lngDelta,
      west: overlayBounds.west + lngDelta,
    };

    setOverlayBounds(newBounds);
  };

  const startZoom = (direction) => {
    if (isPDFLocked) return;

    handleZoom(direction, zoomPrecision);

    zoomIntervalRef.current = setInterval(() => {
      handleZoom(direction, zoomPrecision);
    }, 120);
  };

  const stopZoom = () => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
  };

  if (!isLoaded || !mapCenter) return <div>Cargando mapa...</div>;

  return (
    <div className={style.modalOverlay}>
      <div className={style.modalContainer}>
        <div className={style.container}>
          {/* HEADER */}
          <header className={style.header}>
            <div className={style.logoArea}>
              <div className={style.iconBox}>
                <span className="material-icons-round">layers</span>
              </div>
              <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>
                Ajustar PDF del Proyecto
              </h1>
            </div>
            <div className={style.headerActions}>
              <button
                className={style.btnSecondary}
                onClick={() =>
                  alert(
                    "Añade un PDF y ajústalo (posición, escala, rotación y opacidad) hasta que coincida con el proyecto. Luego guarda los cambios.",
                  )
                }
              >
                <span className="material-icons-round">help_outline</span> Ayuda
              </button>
              <button className={style.btnPrimary} onClick={handleSaveChanges}>
                <span className="material-icons-round">save</span> Guardar
                Cambios
              </button>
              <button
                onClick={onClose}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "8px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>
          </header>

          <main className={style.main}>
            {/* SIDEBAR */}
            <aside className={style.sidebar}>
              {/* SECCIÓN PDF */}
              <div className={style.section}>
                <h2 className={style.sectionTitle}>
                  <span className="material-icons-round">picture_as_pdf</span>{" "}
                  Superposición PDF
                </h2>
                {!pdfImage ? (
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePDFUpload}
                    className={style.inputNumber}
                  />
                ) : (
                  <div className={style.controlGroup}>
                    <div>
                      <div className={style.labelRow}>
                        <label className={style.label}>Opacidad</label>
                        <span className={style.valueDisplay}>
                          {(overlayOpacity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={overlayOpacity}
                        onChange={(e) =>
                          setOverlayOpacity(parseFloat(e.target.value))
                        }
                        className={style.rangeInput}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                      }}
                    >
                      <button
                        className={style.btnSecondary}
                        onClick={() => setIsPDFLocked(!isPDFLocked)}
                      >
                        <span className="material-icons-round">
                          {isPDFLocked ? "lock" : "lock_open"}
                        </span>
                        {isPDFLocked ? "Fijado" : "Fijar"}
                      </button>
                      <button
                        className={`${style.btnSecondary} ${style.btnDanger}`}
                        onClick={handleDeletePDF}
                      >
                        <span className="material-icons-round">
                          delete_outline
                        </span>{" "}
                        Quitar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* TRANSFORMACIÓN */}
              {pdfImage && !isPDFLocked && (
                <div className={style.section}>
                  <h2 className={style.sectionTitle}>
                    <span className="material-icons-round">open_with</span>{" "}
                    Transformación
                  </h2>
                  <div className={style.controlGroup}>
                    {/* CONTROLES DE ESCALA/ZOOM */}
                    <div className={style.compactControlBox}>
                      <div className={style.compactControlHeader}>
                        <span className="material-icons-round">zoom_in</span>
                        <span>Zoom</span>
                      </div>

                      <div className={style.precisionSelector}>
                        <button
                          className={`${style.precisionBtn} ${
                            zoomPrecision === "normal" ? style.active : ""
                          }`}
                          onClick={() => setZoomPrecision("normal")}
                          disabled={isPDFLocked}
                        >
                          Normal
                        </button>
                        <button
                          className={`${style.precisionBtn} ${
                            zoomPrecision === "fine" ? style.active : ""
                          }`}
                          onClick={() => setZoomPrecision("fine")}
                          disabled={isPDFLocked}
                        >
                          Fino
                        </button>
                        <button
                          className={`${style.precisionBtn} ${
                            zoomPrecision === "veryFine" ? style.active : ""
                          }`}
                          onClick={() => setZoomPrecision("veryFine")}
                          disabled={isPDFLocked}
                        >
                          Muy Fino
                        </button>
                      </div>

                      {/* Controles de Zoom */}
                      <div className={style.zoomControl}>
                        <button
                          className={style.zoomBtn}
                          onMouseDown={() => startZoom("out")}
                          onMouseUp={stopZoom}
                          onMouseLeave={stopZoom}
                          disabled={isPDFLocked}
                          title="Alejar zoom"
                        >
                          <span className="material-icons-round">remove</span>
                        </button>
                        <div className={style.zoomLabel}>Zoom</div>
                        <button
                          className={style.zoomBtn}
                          onMouseDown={() => startZoom("in")}
                          onMouseUp={stopZoom}
                          onMouseLeave={stopZoom}
                          disabled={isPDFLocked}
                          title="Acercar zoom"
                        >
                          <span className="material-icons-round">add</span>
                        </button>
                      </div>
                    </div>

                    {/* CONTROLES DE MOVIMIENTO */}
                    <div className={style.compactControlBox}>
                      <div className={style.compactControlHeader}>
                        <span className="material-icons-round">open_with</span>
                        <span>Mover Plano</span>
                      </div>

                      {/* Selector de precisión */}
                      <div className={style.precisionSelector}>
                        <button
                          className={`${style.precisionBtn} ${
                            movePrecision === "normal" ? style.active : ""
                          }`}
                          onClick={() => setMovePrecision("normal")}
                          disabled={isPDFLocked}
                        >
                          Normal
                        </button>
                        <button
                          className={`${style.precisionBtn} ${
                            movePrecision === "fine" ? style.active : ""
                          }`}
                          onClick={() => setMovePrecision("fine")}
                          disabled={isPDFLocked}
                        >
                          Fino
                        </button>
                        <button
                          className={`${style.precisionBtn} ${
                            movePrecision === "veryFine" ? style.active : ""
                          }`}
                          onClick={() => setMovePrecision("veryFine")}
                          disabled={isPDFLocked}
                        >
                          Muy Fino
                        </button>
                      </div>

                      {/* Joystick */}
                      <div className={style.dpad}>
                        <button
                          className={style.joystickBtn}
                          onMouseDown={() => startMove("up")}
                          onMouseUp={stopMove}
                          onMouseLeave={stopMove}
                          disabled={isPDFLocked}
                          title="Mover arriba"
                        >
                          <span className="material-icons-round">
                            expand_less
                          </span>
                        </button>

                        <div className={style.middleRow}>
                          <button
                            className={style.joystickBtn}
                            onMouseDown={() => startMove("left")}
                            onMouseUp={stopMove}
                            onMouseLeave={stopMove}
                            disabled={isPDFLocked}
                            title="Mover izquierda"
                          >
                            <span className="material-icons-round">
                              chevron_left
                            </span>
                          </button>

                          <div className={style.centerDot}></div>

                          <button
                            className={style.joystickBtn}
                            onMouseDown={() => startMove("right")}
                            onMouseUp={stopMove}
                            onMouseLeave={stopMove}
                            disabled={isPDFLocked}
                            title="Mover derecha"
                          >
                            <span className="material-icons-round">
                              chevron_right
                            </span>
                          </button>
                        </div>

                        <button
                          className={style.joystickBtn}
                          onMouseDown={() => startMove("down")}
                          onMouseUp={stopMove}
                          onMouseLeave={stopMove}
                          disabled={isPDFLocked}
                          title="Mover abajo"
                        >
                          <span className="material-icons-round">
                            expand_more
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* ROTACIÓN */}
                    <div>
                      <div className={style.labelRow}>
                        <label className={style.label}>Rotación</label>
                        <button
                          onClick={() => setPdfRotation(0)}
                          className={`${style.btnSecondary} ${style.btnCompact}`}
                        >
                          RESET
                        </button>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={pdfRotation}
                        onChange={(e) =>
                          setPdfRotation(parseInt(e.target.value))
                        }
                        className={style.rangeInput}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: "8px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          className={`${style.btnSecondary} ${style.btnCompact}`}
                          onClick={() => rotatePDF(-1)}
                        >
                          -1°
                        </button>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: "bold",
                            fontFamily: "monospace",
                          }}
                        >
                          {pdfRotation}°
                        </span>
                        <button
                          className={`${style.btnSecondary} ${style.btnCompact}`}
                          onClick={() => rotatePDF(1)}
                        >
                          +1°
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GENERACIÓN DE LOTES */}
              {/* <div className={style.section}>
                <h2 className={style.sectionTitle}>
                  <span className="material-icons-round">grid_view</span>{" "}
                  Generación de Lotes
                </h2>
                <div className={style.controlGroup}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <label
                        className={style.label}
                        style={{ fontSize: "12px" }}
                      >
                        Filas
                      </label>
                      <input
                        type="number"
                        value={gridParams.rows}
                        onChange={(e) =>
                          handleGridParamChange(
                            "rows",
                            parseInt(e.target.value),
                          )
                        }
                        className={style.inputNumber}
                      />
                    </div>
                    <div>
                      <label
                        className={style.label}
                        style={{ fontSize: "12px" }}
                      >
                        Columnas
                      </label>
                      <input
                        type="number"
                        value={gridParams.cols}
                        onChange={(e) =>
                          handleGridParamChange(
                            "cols",
                            parseInt(e.target.value),
                          )
                        }
                        className={style.inputNumber}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={style.label}>Ángulo de Ajuste</label>
                    <input
                      type="range"
                      min="-45"
                      max="45"
                      value={rotationDeg}
                      onChange={(e) => setRotationDeg(parseInt(e.target.value))}
                      className={style.rangeInput}
                    />
                  </div>
                  <button
                    className={style.btnPrimary}
                    style={{ width: "100%" }}
                    onClick={handleRegenerateGrid}
                  >
                    <span className="material-icons-round">refresh</span>{" "}
                    Regenerar Cuadrícula
                  </button>
                  <button
                    className={style.btnSecondary}
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={handleClearPolygon}
                  >
                    <span className="material-icons-round">clear_all</span>{" "}
                    Limpiar Mapa
                  </button>
                </div>
              </div> */}

              {/* TIP */}
              <div
                style={{
                  marginTop: "auto",
                  padding: "24px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  <span
                    className="material-icons-round"
                    style={{ color: "#f59e0b", fontSize: "16px" }}
                  >
                    lightbulb
                  </span>
                  <p>
                    Sube un PDF y ajústalo (posición, escala, rotación y
                    opacidad) hasta alinearlo con el proyecto. Luego guarda los
                    cambios.
                  </p>
                </div>
              </div>
            </aside>

            {/* MAPA AREA */}
            <section className={style.mapSection}>
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={mapCenter}
                zoom={19}
                onLoad={onMapLoad}
                options={{
                  mapTypeId: "satellite",
                  tilt: 0,
                  fullscreenControl: false,
                  streetViewControl: false,
                }}
              >
                {/* <DrawingManager
                  onPolygonComplete={onPolygonComplete}
                  options={{
                    drawingControl: !basePolygonCoords,
                    polygonOptions: {
                      fillColor: "#0ea5e9",
                      fillOpacity: 0.3,
                      strokeWeight: 2,
                      strokeColor: "#0ea5e9",
                      editable: true,
                    },
                  }}
                /> */}

                {proyectoCoords.length > 0 && (
                  <Polygon
                    paths={proyectoCoords}
                    options={{
                      fillColor: "transparent",
                      strokeColor: "#ffffff",
                      strokeOpacity: 0.8,
                      strokeWeight: 3,
                      clickable: false,
                    }}
                  />
                )}

                {generatedLotes.map((lote) => (
                  <Polygon
                    key={lote.id}
                    paths={lote.coords}
                    onClick={() => handleSelectLote(lote)}
                    options={{
                      fillColor:
                        selectedLote === lote.id ? "#0ea5e9" : "#22c55e",
                      fillOpacity: selectedLote === lote.id ? 0.6 : 0.3,
                      strokeColor: "#ffffff",
                      strokeWeight: 1,
                    }}
                  />
                ))}
              </GoogleMap>

            </section>
          </main>

          {/* FOOTER BAR */}
          <footer className={style.footer}>
            <div className={style.footerLeft}>
              <span className={style.footerItem}>
                <span className={style.statusDot}></span>
                Motor de Calco Listo
              </span>
              {mapCenter && (
                <span className={style.footerItem}>
                  Lat: {mapCenter.lat.toFixed(6)} Lng:{" "}
                  {mapCenter.lng.toFixed(6)}
                </span>
              )}
            </div>
            <div style={{ letterSpacing: "2px" }}>V2.4.1 STABLE</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
