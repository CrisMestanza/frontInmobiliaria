// components/LoteModal.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Polygon, DrawingManager } from "@react-google-maps/api";
import style from "../agregarInmo.module.css";
import loader from "../../../components/loader";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { loadPdfFromIndexedDB } from "../../../components/utils/indexedDB";

export default function LoteModal({ onClose, idproyecto }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [proyectoCoords, setProyectoCoords] = useState([]);
  const [generatedLotes, setGeneratedLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [gridParams, setGridParams] = useState({ rows: 2, cols: 2 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [basePolygonCoords, setBasePolygonCoords] = useState(null);
  const [detectedAngle, setDetectedAngle] = useState(0);
  const [lotesCoords, setLotesCoords] = useState([]);
  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const drawnPolygonRef = useRef(null);
  const token = localStorage.getItem("access");
  const originalPdfImageRef = useRef(null);
  const [pdfImage, setPdfImage] = useState(null);
  const [overlayBounds, setOverlayBounds] = useState(null);
  const [pdfRotation, setPdfRotation] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);
  const overlayRef = useRef(null);
  const drawingManagerRef = useRef(null);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  const esCasa = formValues[selectedLote]?.tipo_inmueble === 2;
  const polygonRefs = useRef({});


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



  const handleImagenesChange = (e) => {
    if (!selectedLote) return;

    const newFiles = Array.from(e.target.files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setFormValues((prev) => ({
      ...prev,
      [selectedLote]: {
        ...prev[selectedLote],
        imagenes: [
          ...(prev[selectedLote]?.imagenes || []),
          ...newFiles,
        ],
      },
    }));

    e.target.value = ""; // reset input
  };



  const handleRemoveImage = (loteId, index) => {
    setFormValues((prev) => {
      const imgs = prev[loteId]?.imagenes || [];

      URL.revokeObjectURL(imgs[index]?.preview);

      return {
        ...prev,
        [loteId]: {
          ...prev[loteId],
          imagenes: imgs.filter((_, i) => i !== index),
        },
      };
    });
  };



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
          }
        }
      } catch (error) {
        console.warn("No hay PDF previo para este proyecto", error);
      }
    };
    loadSavedPDF();
  }, [idproyecto, isLoaded, mapCenter]);



  useEffect(() => {
    if (!mapRef.current || !googleRef.current) return;

    if (!pdfImage || !overlayBounds) {
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      return;
    }

    if (!overlayRef.current) {
      overlayRef.current = createRotatableOverlay(
        overlayBounds,
        pdfImage,
        pdfRotation,
        overlayOpacity,
      );
      overlayRef.current.setMap(mapRef.current);
      return;
    }

    overlayRef.current.updateBounds(overlayBounds);
    overlayRef.current.updateRotation(pdfRotation);
    overlayRef.current.updateOpacity(overlayOpacity);
    overlayRef.current.updateImage(pdfImage);
  }, [
    pdfImage,
    overlayBounds,
    pdfRotation,
    overlayOpacity,
    createRotatableOverlay,
  ]);

  useEffect(() => {
    loader.load().then((googleInstance) => {
      setIsLoaded(true);
      googleRef.current = googleInstance;
    });
  }, []);



  const [mapZoom, setMapZoom] = useState(17); // valor por defecto

  const fetchProyecto = useCallback(async () => {
    try {
      const resProyecto = await fetch(
        `https://apiinmo.y0urs.com/api/listPuntosLoteProyecto/${idproyecto}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await resProyecto.json();

      const lotesData = data.map((lote) => ({
        coords: lote.puntos.map((p) => ({
          lat: parseFloat(p.latitud),
          lng: parseFloat(p.longitud),
        })),
        vendido: lote.vendido,
      }));
      setLotesCoords(lotesData);

      // 🔹 Cargar polígono del proyecto
      const resPuntosProyecto = await fetch(
        `https://apiinmo.y0urs.com/api/listPuntosProyecto/${idproyecto}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const puntosProyecto = await resPuntosProyecto.json();
      const orderedProyecto = puntosProyecto
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({ lat: parseFloat(p.latitud), lng: parseFloat(p.longitud) }));
      if (orderedProyecto.length > 2) orderedProyecto.push(orderedProyecto[0]);

      setProyectoCoords(orderedProyecto);

      // 🔹 CENTRAR MAPA y definir zoom
      if (lotesData.length > 0) {
        // Centro en el primer lote
        setMapCenter(lotesData[0].coords[0]);
        setMapZoom(17); // Zoom para lotes
      } else if (orderedProyecto.length > 0) {
        // Centro en el polígono del proyecto
        const centerLat =
          orderedProyecto.reduce((sum, p) => sum + p.lat, 0) / orderedProyecto.length;
        const centerLng =
          orderedProyecto.reduce((sum, p) => sum + p.lng, 0) / orderedProyecto.length;
        setMapCenter({ lat: centerLat, lng: centerLng });
        setMapZoom(14); // Zoom para polígono
      }
    } catch (err) {
      console.error("Error cargando proyecto:", err);
    }
  }, [idproyecto, token]);



  useEffect(() => {
    if (isLoaded) fetchProyecto();
  }, [fetchProyecto, isLoaded]);

  /**
   * 🔥 DETECTA LA ORIENTACIÓN del polígono basándose en su lado más largo
   */
  const detectPolygonOrientation = (coords) => {
    if (coords.length < 2) return 0;

    let maxLength = 0;
    let bestAngle = 0;

    // Buscar el lado más largo del polígono
    for (let i = 0; i < coords.length; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % coords.length];

      // Calcular longitud del lado
      const dx = p2.lng - p1.lng;
      const dy = p2.lat - p1.lat;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > maxLength) {
        maxLength = length;
        // Calcular ángulo de este lado
        bestAngle = Math.atan2(dy, dx);
      }
    }

    return bestAngle;
  };

  /**
   * 🔥 CALCULA UN RECTÁNGULO ROTADO que envuelve perfectamente el polígono
   * Retorna las dimensiones reales a lo largo de los ejes rotados
   */
  const calculateOrientedBoundingBox = (coords, angleRad) => {
    if (!coords || coords.length === 0) return null;

    const cosA = Math.cos(-angleRad); // Negativo para rotar al sistema de coordenadas alineado
    const sinA = Math.sin(-angleRad);

    // Rotar todos los puntos al sistema de coordenadas alineado
    const rotatedPoints = coords.map((p) => {
      const x = p.lng;
      const y = p.lat;
      return {
        x: x * cosA - y * sinA,
        y: x * sinA + y * cosA,
      };
    });

    // Encontrar el bounding box en el sistema rotado
    const minX = Math.min(...rotatedPoints.map((p) => p.x));
    const maxX = Math.max(...rotatedPoints.map((p) => p.x));
    const minY = Math.min(...rotatedPoints.map((p) => p.y));
    const maxY = Math.max(...rotatedPoints.map((p) => p.y));

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Rotar el centro de vuelta al sistema original
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
      minX,
      minY,
    };
  };

  /**
   * Recorta un rectángulo al polígono usando intersecciones
   */
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

      if (insidePoints.length === 4) {
        return rectCoords;
      }

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

      // Encontrar intersecciones
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

      // Agregar vértices del polígono dentro del rectángulo
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

  /**
   * Calcula el área de un polígono en metros cuadrados
   * Usa la fórmula de área esférica para mayor precisión
   */
  const calculatePolygonArea = (coords) => {
    if (!coords || coords.length < 3 || !googleRef.current) return 0;

    try {
      const path = coords.map(
        (coord) => new googleRef.current.maps.LatLng(coord.lat, coord.lng),
      );
      const area = googleRef.current.maps.geometry.spherical.computeArea(path);
      return Math.round(area * 100) / 100; // Redondear a 2 decimales
    } catch (error) {
      console.warn("Error calculando área:", error);
      return 0;
    }
  };

  /**
   * 🔥 GENERA CUADRÍCULA ALINEADA A LOS LADOS DEL POLÍGONO
   */
  const generateGridFromPolygon = useCallback(
    (polygonCoords, rows, cols, additionalRotationDeg = 0) => {
      if (!polygonCoords || !googleRef.current) return [];

      // 1. Detectar la orientación natural del polígono
      const baseAngleRad = detectPolygonOrientation(polygonCoords);

      // 2. Aplicar rotación adicional del usuario
      const totalAngleRad =
        baseAngleRad + (additionalRotationDeg * Math.PI) / 180;

      // 3. Calcular el OBB (Oriented Bounding Box)
      const obb = calculateOrientedBoundingBox(polygonCoords, totalAngleRad);
      if (!obb) return [];

      const { centerLat, centerLng, width, height } = obb;

      // 4. Dimensiones de cada celda (FIJAS)
      const cellWidth = width / cols;
      const cellHeight = height / rows;

      const cosA = Math.cos(totalAngleRad);
      const sinA = Math.sin(totalAngleRad);

      const grid = [];
      let loteCounter = 1;

      // 5. Generar celdas en el sistema rotado
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Posiciones en el sistema local (rotado)
          const localMinX = -width / 2 + c * cellWidth;
          const localMaxX = localMinX + cellWidth;
          const localMinY = -height / 2 + r * cellHeight;
          const localMaxY = localMinY + cellHeight;

          // 4 esquinas en el sistema local
          const localCorners = [
            { x: localMinX, y: localMinY }, // SW
            { x: localMaxX, y: localMinY }, // SE
            { x: localMaxX, y: localMaxY }, // NE
            { x: localMinX, y: localMaxY }, // NW
          ];

          // Rotar de vuelta al sistema global
          const globalCorners = localCorners.map((corner) => {
            const rotatedX = corner.x * cosA - corner.y * sinA;
            const rotatedY = corner.x * sinA + corner.y * cosA;
            return {
              lat: centerLat + rotatedY,
              lng: centerLng + rotatedX,
            };
          });

          // Recortar al polígono
          const clippedCoords = clipRectangleToPolygon(
            globalCorners,
            polygonCoords,
          );

          if (clippedCoords && clippedCoords.length >= 3) {
            const calculatedArea = calculatePolygonArea(clippedCoords);
            grid.push({
              id: loteCounter++,
              coords: clippedCoords,
              nombre: `Lote ${r + 1}-${c + 1}`,
              precio: 0,
              descripcion: "",
              area_total_m2: calculatedArea > 0 ? calculatedArea : 50,
              vendido: 0,
              row: r,
              col: c,
            });
          }
        }
      }

      return grid;
    },
    [googleRef],
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

    // Detectar ángulo automáticamente
    const angle = detectPolygonOrientation(coords);
    setDetectedAngle((angle * 180) / Math.PI);
    setRotationDeg(0); // Reset rotación adicional

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
      idtipoinmobiliaria: lote.tipo_inmueble,
      nombre: lote.nombre,
      precio: lote.precio,
      descripcion: lote.descripcion,
      area_total_m2: lote.area_total_m2 || "",

      ancho: 0,
      largo: 0,

      dormitorios: 0,
      banos: 0,
      cuartos: 0,

      cochera: 0,
      cocina: 0,
      sala: 0,
      patio: 0,
      jardin: 0,
      terraza: 0,
      azotea: 0,

      titulo_propiedad: 0,
    };

    setFormValues((prev) => ({
      ...prev,
      [lote.id]: initialForm,
    }));
  };

  const handleFormChange = (e) => {
    const { name, value, type } = e.target;

    const parsedValue =
      type === "number" ? (value === "" ? 0 : Number(value)) : value;

    setFormValues((prev) => ({
      ...prev,
      [selectedLote]: {
        ...prev[selectedLote],
        [name]: parsedValue,
      },
    }));
  };
  const handleTipoChange = (e) => {
    const value = Number(e.target.value);

    setFormValues((prev) => ({
      ...prev,
      [selectedLote]: {
        ...prev[selectedLote],
        tipo_inmueble: value,

        // Si vuelve a ser LOTE, resetea campos de casa
        ...(value === 1 && {
          dormitorios: 0,
          banos: 0,
          cuartos: 0,
          cochera: 0,
          cocina: 0,
          sala: 0,
          patio: 0,
          jardin: 0,
          terraza: 0,
          azotea: 0,
        }),
      },
    }));
  };

  const [showRegisterModal, setShowRegisterModal] = useState(false);
const [registerMessage, setRegisterMessage] = useState("Registrando inmuebles...");
const [isRegistering, setIsRegistering] = useState(false);

  const handleRegisterAll = async () => {
    for (const l of generatedLotes) {
      if (!l.coords || l.coords.length < 3) {
        alert(`❌ El ${l.nombre} no tiene coordenadas válidas`);
        return; // ⬅️ salir limpio
      }
    }

setShowRegisterModal(true);      // Abrir modal
  setRegisterMessage("Registrando inmuebles...");
  setIsRegistering(true);

    const formData = new FormData();

    generatedLotes.forEach((lote, index) => {
      const data = formValues[lote.id];

      const lotePayload = {
        idproyecto,
        idtipoinmobiliaria: data.tipo_inmueble,
        nombre: data.nombre,
        precio: data.precio,
        descripcion: data.descripcion,
        area_total_m2: data.area_total_m2,

        ancho: data.ancho,
        largo: data.largo,

        dormitorios: data.dormitorios,
        banos: data.banos,
        cuartos: data.cuartos,

        cochera: data.cochera,
        cocina: data.cocina,
        sala: data.sala,
        patio: data.patio,
        jardin: data.jardin,
        terraza: data.terraza,
        azotea: data.azotea,

        titulo_propiedad: data.titulo_propiedad,

        puntos: lote.coords.map(p => ({
          latitud: p.lat,
          longitud: p.lng,
        }))

      };

      // 🔹 LOTE (JSON)
      formData.append(`lotes[${index}]`, JSON.stringify(lotePayload));

      // 🔹 IMÁGENES DEL LOTE
      data?.imagenes?.forEach((img) => {
        formData.append(`imagenes_${index}`, img.file);
      });
    });
    console.log("📦 FORMDATA ENVIADO:");
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(key, "📁 Archivo:", value.name, value.size);
      } else {
        try {
          console.log(key, JSON.parse(value));
        } catch {
          console.log(key, value);
        }
      }
    }

    try {
      const res = await fetch(
        "https://apiinmo.y0urs.com/api/registerLotesMasivo/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!res.ok) throw new Error("Error en registro masivo");

setRegisterMessage("✅ Registro con éxito!");
      onClose();
    } catch (error) {
      console.error(error);
          setRegisterMessage("❌ Error al registrar los inmuebles");

    }finally {
    setIsRegistering(false);
  }
  };




  const getColorLote = (vendido) => {
    switch (vendido) {
      case 0:
        return "#00ff00"; // libre
      case 1:
        return "#ff0000"; // vendido
      case 2:
        return "#ffff00"; // reservado
      default:
        return "#808080"; // gris
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
      <div className={style.modalContent}>
        

        <button className={style.closeBtn} onClick={onClose}>
          ✖
        </button>

        <h2 style={{ color: "black" }}>
          Generar Lotes - Alineado a Lados del Polígono
        </h2>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "0.5rem",
            alignItems: "center",
          }}
        >
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
              minWidth: "280px",
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
            <span>
              👉 <strong>Dibuja un polígono</strong> en el mapa para comenzar
            </span>
          )}
          {basePolygonCoords && (
            <div>
              <span>
                ✅ <strong>Lotes generados: {generatedLotes.length}</strong>
                {selectedLote && ` | Seleccionado: Lote ${selectedLote}`}
              </span>
              <br />
              <span style={{ fontSize: "12px", color: "#666" }}>
                📐 Ángulo detectado: {detectedAngle.toFixed(1)}° | Ajuste
                aplicado: {rotationDeg}°
              </span>
            </div>
          )}
        </div>
{showRegisterModal && (
  <div className={style.modalOverlay}>
    <div
      className={style.modalContent}
      style={{ maxWidth: "400px", textAlign: "center" }}
    >
      <h3>{registerMessage}</h3>
      {!isRegistering && (
        <button
          className={style.submitBtn}
          onClick={() => setShowRegisterModal(false)}
          style={{ marginTop: "1rem" }}
        >
          Cerrar
        </button>
      )}
    </div>
  </div>
)}
        <GoogleMap
          onLoad={onMapLoad}
          mapContainerStyle={{
            width: "100%",
            height: "480px",
            marginBottom: "1rem",
          }}
          zoom={mapZoom}
          center={mapCenter}
          options={{ gestureHandling: "greedy" }}
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
              key={i}
              paths={lote.coords}
              options={{
                strokeColor: "#333333",
                strokeWeight: 1,
                fillColor: getColorLote(lote.vendido),
                fillOpacity: 0.45,
              }}
            />
          ))}

          {generatedLotes.map((lote) => (
            <Polygon
              key={lote.id}
              paths={lote.coords}
              editable
              draggable
              onLoad={(poly) => {
                polygonRefs.current[lote.id] = poly;
              }}
              onMouseUp={() => {
                const poly = polygonRefs.current[lote.id];
                if (!poly) return;

                const coords = poly
                  .getPath()
                  .getArray()
                  .map(p => ({
                    lat: p.lat(),
                    lng: p.lng(),
                  }));

                setGeneratedLotes(prev =>
                  prev.map(l =>
                    l.id === lote.id ? { ...l, coords } : l
                  )
                );
              }}
              onClick={() => handleSelectLote(lote)}
              options={{
                strokeColor: selectedLote === lote.id ? "#ff0000" : "#008000",
                strokeWeight: 2,
                fillColor: selectedLote === lote.id ? "#ff8080" : "#00ff00",
                fillOpacity: 0.5,
                zIndex: 10,
              }}
            />
          ))}


          {!drawingManagerRef.current && (
            <DrawingManager
              onLoad={(dm) => {
                drawingManagerRef.current = dm;
              }}
              onPolygonComplete={onPolygonComplete}
              options={{
                drawingControl: true,
                drawingControlOptions: {
                  position:
                    googleRef.current?.maps.ControlPosition.TOP_CENTER || 7,
                  drawingModes: ["polygon", "rectangle"],
                },
                polygonOptions: {
                  editable: true,
                  draggable: true,
                  fillColor: "#FF00FF",
                  fillOpacity: 0.3,
                  strokeColor: "#FF00FF",
                  strokeWeight: 2,
                },
                rectangleOptions: {
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


            <h3>📝 Editar Lote {selectedLote}</h3>
            <label>Tipo de inmueble:</label>
            <select
              name="tipo_inmueble"
              value={formValues[selectedLote]?.tipo_inmueble ?? 1}
              onChange={handleTipoChange}
              className={style.input}
            >
              <option value={1}>Lote</option>
              <option value={2}>Casa</option>
            </select>

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
            <label>Precio en dolares:</label>
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

            <label>Título de propiedad:</label>
            <select
              name="titulo_propiedad"
              value={formValues[selectedLote]?.titulo_propiedad ?? 0}
              onChange={handleFormChange}
              className={style.input}
            >
              <option value="">Selecciona un valor</option>
              <option value={0}>No</option>
              <option value={1}>Sí</option>
            </select>


            <label>Área total (m²):</label>
            <input
              name="area_total_m2"
              type="number"
              min="0"
              step="0.01"
              value={
                formValues[selectedLote]?.area_total_m2 ||
                generatedLotes.find((l) => l.id === selectedLote)
                  ?.area_total_m2 ||
                ""
              }
              onChange={handleFormChange}
              className={style.input}
            />

            <label>Ancho (m):</label>
            <input
              name="ancho"
              type="number"
              step="0.01"
              value={formValues[selectedLote]?.ancho || ""}
              onChange={handleFormChange}
              className={style.input}
            />

            <label>Largo (m):</label>
            <input
              name="largo"
              type="number"
              step="0.01"
              value={formValues[selectedLote]?.largo || ""}
              onChange={handleFormChange}
              className={style.input}
            />
            {esCasa && (
              <>
                <label>Dormitorios:</label>
                <input
                  name="dormitorios"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.dormitorios ?? 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Baños:</label>
                <input
                  name="banos"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.banos ?? 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Cuartos:</label>
                <input
                  name="cuartos"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.cuartos ?? 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Cochera:</label>
                <input
                  name="cochera"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.cochera || 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Cocina:</label>
                <input
                  name="cocina"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.cocina || 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Sala:</label>
                <input
                  name="sala"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.sala || 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Patio:</label>
                <input
                  name="patio"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.patio || 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Jardín:</label>
                <input
                  name="jardin"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.jardin || 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Terraza:</label>
                <input
                  name="terraza"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.terraza || 0}
                  onChange={handleFormChange}
                  className={style.input}
                />

                <label>Azotea:</label>
                <input
                  name="azotea"
                  type="number"
                  min="0"
                  value={formValues[selectedLote]?.azotea || 0}
                  onChange={handleFormChange}
                  className={style.input}
                />
              </>
            )}


            {/* IMÁGENES DEL LOTE */}



            <h4 style={{ color: "#333" }}>📷 Imágenes del inmueble</h4>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagenesChange}
              className={style.input}
            />

            {formValues[selectedLote]?.imagenes?.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                {formValues[selectedLote].imagenes.map((img, index) => (
                  <div
                    key={index}
                    style={{
                      position: "relative",
                      width: "90px",
                      height: "90px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid #ccc",
                    }}
                  >
                    <img
                      src={img.preview}
                      alt={`lote-${index}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(selectedLote, index)}
                      style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}





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
        </div>
      </div>
    </div>
  );
}