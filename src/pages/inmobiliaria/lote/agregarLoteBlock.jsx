import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
// components/LoteModal.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Polygon, DrawingManager, Marker } from "@react-google-maps/api";
import styles from "../proyecto/addproyect.module.css";
import loader from "../../../components/loader";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { loadPdfFromIndexedDB } from "../../../components/utils/indexedDB";
import {
  CheckCircle2,
  Image as ImageIcon,
  Info,
  Ruler,
  RotateCw,
  Save,
  Trash2,
  X,
} from "lucide-react";

const isSamePoint = (a, b, eps = 1e-10) =>
  Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps;

const orderCoordsByAngle = (points) => {
  const center = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  center.lat /= points.length;
  center.lng /= points.length;

  return [...points].sort((a, b) => {
    const angleA = Math.atan2(a.lat - center.lat, a.lng - center.lng);
    const angleB = Math.atan2(b.lat - center.lat, b.lng - center.lng);
    return angleA - angleB;
  });
};

const normalizePolygonCoords = (coords) => {
  const normalized = (coords || [])
    .map((p) => ({
      lat: parseFloat(p.lat ?? p.latitud),
      lng: parseFloat(p.lng ?? p.longitud),
      orden: p.orden,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (normalized.length < 2) return normalized;

  const hasOrder = normalized.every(
    (p) => p.orden !== null && p.orden !== undefined,
  );
  const ordered = hasOrder
    ? [...normalized].sort((a, b) => Number(a.orden) - Number(b.orden))
    : orderCoordsByAngle(normalized);

  if (ordered.length > 2 && isSamePoint(ordered[0], ordered[ordered.length - 1])) {
    ordered.pop();
  }

  return ordered.map((p) => ({ lat: p.lat, lng: p.lng }));
};

export default function LoteModal({ onClose, idproyecto }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [proyectoCoords, setProyectoCoords] = useState([]);
  const [generatedLotes, setGeneratedLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [gridParams, setGridParams] = useState({ rows: 2, cols: 2 });
  const [rowNumbering, setRowNumbering] = useState([]);
  const [manzanaLabel, setManzanaLabel] = useState("");
  const [useRowPrice, setUseRowPrice] = useState(false);
  const manualOverridesRef = useRef({});
  const [rotationDeg, setRotationDeg] = useState(0);
  const [basePolygonCoords, setBasePolygonCoords] = useState(null);
  const [detectedAngle, setDetectedAngle] = useState(0);
  const [lotesCoords, setLotesCoords] = useState([]);
  const [baseMapStyle, setBaseMapStyle] = useState("roadmap");
  const [reliefEnabled, setReliefEnabled] = useState(false);
  const [labelsEnabled, setLabelsEnabled] = useState(true);
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

  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);

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

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,flags,currencies"
        );
        const data = await res.json();

        const parsed = data
          .map((c) => {
            const currencyKey = c.currencies ? Object.keys(c.currencies)[0] : null;
            const currency = currencyKey ? c.currencies[currencyKey] : null;

            return {
              name: c.name?.common,
              flag: c.flags?.png,
              currencySymbol: currency?.symbol || "",
              currencyName: currency?.name || "",
            };
          })
          .filter((c) => c.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        setCountries(parsed);
      } catch (err) {
        console.error("Error cargando países", err);
      }
    };

    fetchCountries();
  }, []);


  const handleCountryChange = (e) => {
    const country = countries.find(c => c.name === e.target.value);

    setSelectedCountry(country);

    setFormValues(prev => ({
      ...prev,
      [selectedLote]: {
        ...prev[selectedLote],
        pais: country?.name || "",
        moneda: country?.currencySymbol || "",
        bandera: country?.flag || ""
      }
    }));
  };

  useEffect(() => {
    if (!countries.length || !selectedLote) return;
    if (selectedCountry) return;
    const peru = countries.find(
      (c) => (c.name || "").toLowerCase() === "peru" || (c.name || "").toLowerCase() === "perú"
    );
    if (!peru) return;
    setSelectedCountry(peru);
    setFormValues((prev) => ({
      ...prev,
      [selectedLote]: {
        ...prev[selectedLote],
        pais: peru.name || "",
        moneda: peru.currencySymbol || "",
        bandera: peru.flag || "",
      },
    }));
  }, [countries, selectedLote, selectedCountry]);

  const [mapZoom, setMapZoom] = useState(17); // valor por defecto

  const fetchProyecto = useCallback(async () => {
    try {
      const [resLotes, resPuntosProyecto] = await Promise.all([
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/listPuntosLoteProyecto/${idproyecto}/`,
          ),
          { headers: { Authorization: `Bearer ${token}` } },
        ),
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`,
          ),
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);

      const data = (await resLotes.json()) || [];
      const puntosProyecto = (await resPuntosProyecto.json()) || [];

      const lotesData = data
        .map((lote) => ({
          coords: normalizePolygonCoords(lote.puntos || []),
          vendido: lote.vendido,
        }))
        .filter((lote) => lote.coords.length >= 3);
      setLotesCoords(lotesData);

      const orderedProyecto = normalizePolygonCoords(puntosProyecto);
      setProyectoCoords(orderedProyecto);

      // 🔹 CENTRAR MAPA y definir zoom
      if (lotesData.length > 0 && lotesData[0].coords.length > 0) {
        setMapCenter(lotesData[0].coords[0]);
        setMapZoom(17); // Zoom para lotes
      } else if (orderedProyecto.length > 0) {
        const centerLat =
          orderedProyecto.reduce((sum, p) => sum + p.lat, 0) /
          orderedProyecto.length;
        const centerLng =
          orderedProyecto.reduce((sum, p) => sum + p.lng, 0) /
          orderedProyecto.length;
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

  const applyMapType = useCallback(
    (map) => {
      if (!map) return;
      if (baseMapStyle === "satellite") {
        map.setMapTypeId(labelsEnabled ? "hybrid" : "satellite");
        return;
      }
      map.setMapTypeId(reliefEnabled ? "terrain" : "roadmap");
    },
    [baseMapStyle, labelsEnabled, reliefEnabled],
  );


  /**
   * 🔥 DETECTA LA ORIENTACIÓN del polígono basándose en su lado más largo
   */
  const detectPolygonOrientation = (coords) => {
    const cleanCoords = normalizePolygonCoords(coords);
    if (cleanCoords.length < 2) return 0;

    let maxLength = 0;
    let bestAngle = 0;

    // Buscar el lado más largo del polígono
    for (let i = 0; i < cleanCoords.length; i++) {
      const p1 = cleanCoords[i];
      const p2 = cleanCoords[(i + 1) % cleanCoords.length];

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
    const cleanCoords = normalizePolygonCoords(coords);
    if (!cleanCoords || cleanCoords.length === 0) return null;

    const cosA = Math.cos(-angleRad); // Negativo para rotar al sistema de coordenadas alineado
    const sinA = Math.sin(-angleRad);

    // Rotar todos los puntos al sistema de coordenadas alineado
    const rotatedPoints = cleanCoords.map((p) => {
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
      const normalizedPolygon = normalizePolygonCoords(polygonCoords);
      const baseAngleRad = detectPolygonOrientation(normalizedPolygon);

      // 2. Aplicar rotación adicional del usuario
      const totalAngleRad =
        baseAngleRad + (additionalRotationDeg * Math.PI) / 180;

      // 3. Calcular el OBB (Oriented Bounding Box)
      const obb = calculateOrientedBoundingBox(normalizedPolygon, totalAngleRad);
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
            normalizedPolygon,
          );

          if (clippedCoords && clippedCoords.length >= 3) {
            const calculatedArea = calculatePolygonArea(clippedCoords);
            const center = getPolygonCenter(clippedCoords);
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
              center,
            });
          }
        }
      }

      const applyNumbering = (items) => {
        if (!items.length) return items;

        const grouped = new Map();
        items.forEach((item) => {
          const key = item.row;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key).push(item);
        });

        const rowMeta = [...grouped.entries()].map(([rowKey, rowItems]) => {
          const avgLat =
            rowItems.reduce((acc, it) => acc + (it.center?.lat ?? 0), 0) /
            Math.max(1, rowItems.length);
          return { rowKey: Number(rowKey), avgLat };
        });

        const rowsSorted = rowMeta.sort((a, b) => b.avgLat - a.avgLat);
        rowsSorted.forEach((rowInfo, displayIdx) => {
          const rowItems = grouped
            .get(rowInfo.rowKey)
            .sort((a, b) => {
              const aLng = a.center?.lng ?? 0;
              const bLng = b.center?.lng ?? 0;
              return aLng - bLng;
            });

          const cfg = rowNumbering[displayIdx];
          const start = Number(cfg?.start);
          const end = Number(cfg?.end);
          const step =
            Number.isFinite(start) &&
            Number.isFinite(end) &&
            start > end
              ? -1
              : 1;

          const safeStart = Number.isFinite(start) ? start : 1;

          rowItems.forEach((item, idx) => {
            const value = safeStart + step * idx;
            const manualName = manualOverridesRef.current[item.id]?.nombreManual;
            if (!manualName) {
              item.nombre = manzanaLabel
                ? `Lote ${value}, Manzana ${manzanaLabel}`
                : `Lote ${value}`;
            }
            const manual = manualOverridesRef.current[item.id]?.precioManual;
            if (useRowPrice && Number.isFinite(Number(cfg?.price)) && !manual) {
              item.precio = Number(cfg.price);
            }
          });
        });

        return items;
      };

      applyNumbering(grid);
      return grid;
    },
    [googleRef, rowNumbering, manzanaLabel, useRowPrice],
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
    rowNumbering,
    rotationDeg,
    basePolygonCoords,
    isLoaded,
    handleRegenerateGrid,
  ]);

  const buildDefaultRowNumbering = useCallback((rows, cols) => {
    const next = [];
    let counter = 1;
    for (let r = 0; r < rows; r++) {
      const rowStart = counter;
      const rowEnd = counter + Math.max(0, cols - 1);
      next.push({ start: rowStart, end: rowEnd });
      counter = rowEnd + 1;
    }
    return next;
  }, []);

  useEffect(() => {
    setRowNumbering((prev) => {
      if (prev.length === gridParams.rows) return prev;
      return buildDefaultRowNumbering(gridParams.rows, gridParams.cols);
    });
  }, [gridParams.rows, gridParams.cols, buildDefaultRowNumbering]);

  useEffect(() => {
    if (!generatedLotes.length) return;
    setGeneratedLotes((prev) => {
      const items = prev.map((item) => ({ ...item }));
      const grouped = new Map();
      items.forEach((item) => {
        const key = item.row;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(item);
      });
      const rowMeta = [...grouped.entries()].map(([rowKey, rowItems]) => {
        const avgLat =
          rowItems.reduce((acc, it) => acc + (it.center?.lat ?? 0), 0) /
          Math.max(1, rowItems.length);
        return { rowKey: Number(rowKey), avgLat };
      });
      const rowsSorted = rowMeta.sort((a, b) => b.avgLat - a.avgLat);
      rowsSorted.forEach((rowInfo, displayIdx) => {
        const rowItems = grouped
          .get(rowInfo.rowKey)
          .sort((a, b) => {
            const aLng = a.center?.lng ?? 0;
            const bLng = b.center?.lng ?? 0;
            return aLng - bLng;
          });
        const cfg = rowNumbering[displayIdx];
        const start = Number(cfg?.start);
        const end = Number(cfg?.end);
        const step =
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start > end
            ? -1
            : 1;
        const safeStart = Number.isFinite(start) ? start : 1;
        rowItems.forEach((item, idx) => {
          const value = safeStart + step * idx;
          const manualName = manualOverridesRef.current[item.id]?.nombreManual;
          if (!manualName) {
            item.nombre = manzanaLabel
              ? `Lote ${value}, Manzana ${manzanaLabel}`
              : `Lote ${value}`;
          }
          const manual = manualOverridesRef.current[item.id]?.precioManual;
          if (useRowPrice && Number.isFinite(Number(cfg?.price)) && !manual) {
            item.precio = Number(cfg.price);
          }
        });
      });
      return items;
    });
  }, [rowNumbering, manzanaLabel, useRowPrice]);

  // Sincronización de formulario ocurre al seleccionar el lote,
  // evitando loops de renderizado.

  const onPolygonComplete = (poly) => {
    if (!poly) return;

    const path = poly.getPath().getArray();
    const coords = normalizePolygonCoords(
      path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
    );

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

  const pruneDuplicateDrawingControls = useCallback(() => {
    const mapDiv = mapRef.current?.getDiv?.();
    if (!mapDiv) return;

    const buttons = Array.from(mapDiv.querySelectorAll("button"));
    const rectButtons = buttons.filter((btn) => {
      const label = `${btn.getAttribute("title") || ""} ${btn.getAttribute("aria-label") || ""}`
        .toLowerCase()
        .replace(/\s+/g, " ");
      return label.includes("rect") || label.includes("rectáng");
    });

    rectButtons.forEach((btn) => {
      const control = btn.closest(".gmnoprint");
      if (control) control.remove();
    });
  }, []);

  const onMapLoad = (map) => {
    mapRef.current = map;
    pruneDuplicateDrawingControls();
  };

  const getPolygonCenter = (coords) => {
    if (!coords || coords.length === 0) return null;
    const sum = coords.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: sum.lat / coords.length,
      lng: sum.lng / coords.length,
    };
  };

  const getRowCenters = (items) => {
    const grouped = new Map();
    items.forEach((item) => {
      if (!item.center) return;
      const key = item.row;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item.center);
    });

    const rows = [...grouped.entries()].map(([rowKey, centers]) => {
      const sum = centers.reduce(
        (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
        { lat: 0, lng: 0 },
      );
      const sorted = [...centers].sort((a, b) => a.lng - b.lng);
      const minLng = sorted[0]?.lng ?? 0;
      const maxLng = sorted[sorted.length - 1]?.lng ?? 0;
      const spanLng = Math.max(0.00001, maxLng - minLng);
      const gaps = sorted
        .map((p, i) => (i === 0 ? null : p.lng - sorted[i - 1].lng))
        .filter((v) => typeof v === "number" && v > 0);
      const avgGap =
        gaps.length > 0
          ? gaps.reduce((acc, v) => acc + v, 0) / gaps.length
          : spanLng / Math.max(1, sorted.length - 1);
      const minOffset = Math.max(0.000005, avgGap * 0.2);
      const maxOffset = 0.00002;
      const offset = Math.min(Math.max(avgGap * 0.3, minOffset), maxOffset);
      return {
        row: Number(rowKey),
        avgLat: sum.lat / centers.length,
        position: {
          lat: sum.lat / centers.length,
          lng: minLng + offset,
        },
      };
    });

    return rows
      .sort((a, b) => b.avgLat - a.avgLat)
      .map((row, idx) => ({
        ...row,
        displayIndex: idx + 1,
      }));
  };

  const handleGridParamChange = (name, value) => {
    setGridParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectLote = (lote) => {
    setSelectedLote(lote.id);

    const initialForm = formValues[lote.id] || {
      tipo_inmueble: lote.tipo_inmueble ?? 1,
      nombre: lote.nombre,
      precio: lote.precio,
      descripcion: lote.descripcion,
      area_total_m2: lote.area_total_m2 ?? "",

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
      type === "number" ? (value === "" ? "" : Number(value)) : value;

    setFormValues((prev) => {
      const next = {
        ...prev,
        [selectedLote]: {
          ...prev[selectedLote],
          [name]: parsedValue,
        },
      };
      if (name === "precio") {
        next[selectedLote].precioManual = true;
        manualOverridesRef.current[selectedLote] = {
          ...(manualOverridesRef.current[selectedLote] || {}),
          precioManual: true,
        };
      }
      if (name === "nombre") {
        next[selectedLote].nombreManual = true;
        manualOverridesRef.current[selectedLote] = {
          ...(manualOverridesRef.current[selectedLote] || {}),
          nombreManual: true,
        };
      }
      return next;
    });
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

  const buildClonePayload = (source, loteFallback) => {
    const base = {
      tipo_inmueble: source?.tipo_inmueble ?? 1,
      descripcion: source?.descripcion ?? loteFallback?.descripcion ?? "",
      area_total_m2: source?.area_total_m2 ?? loteFallback?.area_total_m2 ?? "",
      ancho: source?.ancho ?? 0,
      largo: source?.largo ?? 0,
      dormitorios: source?.dormitorios ?? 0,
      banos: source?.banos ?? 0,
      cuartos: source?.cuartos ?? 0,
      cochera: source?.cochera ?? 0,
      cocina: source?.cocina ?? 0,
      sala: source?.sala ?? 0,
      patio: source?.patio ?? 0,
      jardin: source?.jardin ?? 0,
      terraza: source?.terraza ?? 0,
      azotea: source?.azotea ?? 0,
      titulo_propiedad: source?.titulo_propiedad ?? 0,
      pais: source?.pais ?? "",
      moneda: source?.moneda ?? "",
      bandera: source?.bandera ?? "",
    };

    return base;
  };

  const handleCloneToAll = () => {
    if (!selectedLote) return;

    const source = formValues[selectedLote];
    if (!source) return;

    setFormValues((prev) => {
      const next = { ...prev };

      generatedLotes.forEach((lote) => {
        const existing = next[lote.id] || {};
        const clonePayload = buildClonePayload(source, lote);

        next[lote.id] = {
          ...existing,
          ...clonePayload,
          nombre:
            existing.nombre ??
            lote.nombre ??
            `Lote ${lote.id}`,
        };
      });

      return next;
    });
  };

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("Registrando inmuebles...");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerItems, setRegisterItems] = useState([]);

  const handleRegisterAll = async () => {
    for (const l of generatedLotes) {
      if (!l.coords || l.coords.length < 3) {
        alert(`El ${l.nombre} no tiene coordenadas válidas`);
        return;
      }
    }

    setShowRegisterModal(true); // Abrir modal
    setRegisterMessage("Registrando inmuebles...");
    setIsRegistering(true);
    setRegisterItems(
      generatedLotes.map((lote) => ({
        id: lote.id,
        nombre:
          formValues[lote.id]?.nombre?.trim() ||
          lote.nombre ||
          `Lote ${lote.id}`,
      })),
    );

    const formData = new FormData();

    generatedLotes.forEach((lote, index) => {
      const overrides = formValues[lote.id] || {};
      const normalizedName =
        typeof overrides.nombre === "string" && overrides.nombre.trim()
          ? overrides.nombre.trim()
          : lote.nombre;
      const normalizedDesc =
        typeof overrides.descripcion === "string"
          ? overrides.descripcion
          : lote.descripcion ?? "";
      const normalizedPrice =
        overrides.precio !== undefined && overrides.precio !== ""
          ? overrides.precio
          : lote.precio ?? 0;

      const data = {
        tipo_inmueble: 1,
        nombre: normalizedName,
        precio: normalizedPrice,
        descripcion: normalizedDesc,
        area_total_m2:
          overrides.area_total_m2 !== undefined && overrides.area_total_m2 !== ""
            ? overrides.area_total_m2
            : lote.area_total_m2 ?? "",
        ancho: overrides.ancho ?? 0,
        largo: overrides.largo ?? 0,
        dormitorios: overrides.dormitorios ?? 0,
        banos: overrides.banos ?? 0,
        cuartos: overrides.cuartos ?? 0,
        cochera: overrides.cochera ?? 0,
        cocina: overrides.cocina ?? 0,
        sala: overrides.sala ?? 0,
        patio: overrides.patio ?? 0,
        jardin: overrides.jardin ?? 0,
        terraza: overrides.terraza ?? 0,
        azotea: overrides.azotea ?? 0,
        titulo_propiedad: overrides.titulo_propiedad ?? 0,
        pais: overrides.pais ?? lote.pais,
        moneda: overrides.moneda ?? lote.moneda,
        bandera: overrides.bandera ?? lote.bandera,
        tipo_inmueble_override: overrides.tipo_inmueble,
      };

      const lotePayload = {
        idproyecto,
        idtipoinmobiliaria: data.tipo_inmueble_override ?? data.tipo_inmueble ?? 1,
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
        pais: data.pais,
        moneda: data.moneda,
        bandera: data.bandera,
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
      const res = await authFetch(
        withApiBase("https://api.geohabita.com/api/registerLotesMasivo/"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!res.ok) throw new Error("Error en registro masivo");

      setRegisterMessage("Registro con éxito.");
      onClose();
    } catch (error) {
      console.error(error);
      setRegisterMessage("Error al registrar los inmuebles");

    } finally {
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
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Generar Lotes</h1>
            <p className={styles.subtitle}>
              Alinea lotes al polígono del proyecto y registra en un solo paso.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.gridContainer}>
            <div className={styles.leftColumn}>
              <section className={styles.sectionCard}>
                <h2 className={styles.sectionTitle}>
                  <span className="material-icons-outlined">grid_on</span>
                  Configuración
                </h2>

                <div className={styles.controlGrid}>
                  <div className={styles.controlField}>
                    <label>Filas</label>
                    <input
                      type="number"
                      value={gridParams.rows}
                      min="1"
                      max="50"
                      onChange={(e) =>
                        handleGridParamChange("rows", parseInt(e.target.value || 1))
                      }
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.controlField}>
                    <label>Columnas</label>
                    <input
                      type="number"
                      value={gridParams.cols}
                      min="1"
                      max="50"
                      onChange={(e) =>
                        handleGridParamChange("cols", parseInt(e.target.value || 1))
                      }
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.controlField}>
                    <label>Manzana</label>
                    <input
                      type="text"
                      value={manzanaLabel}
                      onChange={(e) => setManzanaLabel(e.target.value)}
                      className={styles.input}
                      placeholder="Ej: C"
                    />
                  </div>
                  <div className={styles.controlFieldWide}>
                    <label>Ajuste</label>
                    <div className={styles.rangeRow}>
                      <input
                        type="range"
                        min="-90"
                        max="90"
                        step="1"
                        value={rotationDeg}
                        onChange={(e) => setRotationDeg(parseFloat(e.target.value))}
                        className={styles.rangeInput}
                      />
                      <span className={styles.rangeValue}>
                        {rotationDeg.toFixed(0)}°
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.controlActions}>
                  <button
                    className={`${styles.submitBtn} ${styles.btnWithIcon}`}
                    onClick={handleRegenerateGrid}
                    disabled={!basePolygonCoords}
                  >
                    <RotateCw size={16} className={styles.inlineIcon} />
                    Regenerar
                  </button>

                  <button
                    className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.dangerBtn}`}
                    onClick={handleClearPolygon}
                  >
                    <Trash2 size={16} className={styles.inlineIcon} />
                    Limpiar
                  </button>
                </div>

                <div className={styles.hintBox}>
                  {!basePolygonCoords && (
                    <span className={styles.inlineRow}>
                      <Info size={16} className={styles.inlineIcon} />
                      <strong>Dibuja un polígono</strong> en el mapa para comenzar
                    </span>
                  )}
                  {basePolygonCoords && (
                    <div>
                      <span className={styles.inlineRow}>
                        <CheckCircle2 size={16} className={styles.inlineIcon} />
                        <strong>Lotes generados: {generatedLotes.length}</strong>
                        {selectedLote && ` | Seleccionado: Lote ${selectedLote}`}
                      </span>
                      <span className={`${styles.inlineRow} ${styles.hintMeta}`}>
                        <Ruler size={14} className={styles.inlineIcon} />
                        Ángulo detectado: {detectedAngle.toFixed(1)}° | Ajuste aplicado:{" "}
                        {rotationDeg}°
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {generatedLotes.length > 0 && (
                <section className={styles.sectionCard}>
                  <h2 className={styles.sectionTitle}>
                    <span className="material-icons-outlined">format_list_numbered</span>
                    Numeración por fila
                  </h2>
                  <div className={styles.controlGrid}>
                    <div className={styles.controlFieldWide}>
                      <label className={styles.inlineRow}>
                        <input
                          type="checkbox"
                          checked={useRowPrice}
                          onChange={(e) => setUseRowPrice(e.target.checked)}
                        />
                        <span>Aplicar precio fijo por fila</span>
                      </label>
                    </div>
                    {rowNumbering.map((cfg, idx) => (
                      <div key={idx} className={styles.controlFieldWide}>
                        <label>Fila {idx + 1}</label>
                        <div className={styles.rangeRow}>
                          <input
                          type="number"
                          min="1"
                          value={cfg.start}
                          onChange={(e) => {
                            const value = parseInt(e.target.value || 1, 10);
                            setRowNumbering((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, start: value } : row,
                              ),
                            );
                          }}
                          className={styles.input}
                        />
                          <span className={styles.rangeValue}>a</span>
                          <input
                            type="number"
                            min="1"
                            value={cfg.end}
                          onChange={(e) => {
                            const value = parseInt(e.target.value || 1, 10);
                            setRowNumbering((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, end: value } : row,
                              ),
                            );
                          }}
                            className={styles.input}
                          />
                          {useRowPrice && (
                            <input
                              type="number"
                              min="0"
                              value={cfg.price ?? ""}
                              onChange={(e) => {
                                const value =
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value);
                                setRowNumbering((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, price: value } : row,
                                  ),
                                );
                              }}
                              className={styles.input}
                              placeholder="Precio"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {selectedLote && (
                <section className={styles.sectionCard}>
                  <h2 className={styles.sectionTitle}>
                    <span className="material-icons-outlined">edit</span>
                    Lote {selectedLote}
                  </h2>

                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.secondaryBtn}`}
                      onClick={handleCloneToAll}
                    >
                      Clonar a todos
                    </button>
                  </div>

                  <div className={`${styles.compactGrid} ${styles.compactGridTwo}`}>
                    <div className={styles.compactField}>
                      <label>Tipo de inmueble</label>
                      <select
                        name="tipo_inmueble"
                        value={formValues[selectedLote]?.tipo_inmueble ?? 1}
                        onChange={handleTipoChange}
                        className={styles.select}
                      >
                        <option value={1}>Lote</option>
                        <option value={2}>Casa</option>
                      </select>
                    </div>
                    <div className={styles.compactField}>
                      <label>Nombre</label>
                      <input
                        name="nombre"
                        value={
                          formValues[selectedLote]?.nombreManual
                            ? formValues[selectedLote]?.nombre || ""
                            : generatedLotes.find((l) => l.id === selectedLote)
                                ?.nombre || ""
                        }
                        onChange={handleFormChange}
                        className={`${styles.input} ${styles.compactInputLg}`}
                      />
                    </div>
                  </div>

                  <div className={`${styles.compactGrid} ${styles.compactGridTwo}`}>
                    <div className={styles.compactField}>
                      <label>País y moneda</label>
                      <select
                        onChange={handleCountryChange}
                        value={selectedCountry?.name || ""}
                        className={styles.select}
                      >
                        <option value="">Seleccionar país</option>
                        {countries.map((c, i) => (
                          <option key={i} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.compactField}>
                      <label>Precio</label>
                      <div className={styles.priceRow}>
                        {selectedCountry && (
                          <img
                            src={selectedCountry.flag}
                            alt="flag"
                            className={styles.flagIcon}
                          />
                        )}
                        <span className={styles.currencyLabel}>
                          {selectedCountry?.currencySymbol || "$"}
                        </span>
                        <input
                          name="precio"
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            formValues[selectedLote]?.precioManual
                              ? formValues[selectedLote]?.precio ?? ""
                              : generatedLotes.find((l) => l.id === selectedLote)
                                  ?.precio ?? ""
                          }
                          onChange={handleFormChange}
                          className={`${styles.input} ${styles.compactInputLg}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Descripción</label>
                    <textarea
                      name="descripcion"
                      rows="3"
                      value={
                        formValues[selectedLote]?.descripcion ||
                        generatedLotes.find((l) => l.id === selectedLote)?.descripcion ||
                        ""
                      }
                      onChange={handleFormChange}
                      className={styles.textarea}
                    ></textarea>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Título de propiedad</label>
                    <select
                      name="titulo_propiedad"
                      value={formValues[selectedLote]?.titulo_propiedad ?? 0}
                      onChange={handleFormChange}
                      className={styles.select}
                    >
                      <option value="">Selecciona un valor</option>
                      <option value={0}>No</option>
                      <option value={1}>Sí</option>
                    </select>
                  </div>

                  <div className={styles.compactGrid}>
                    <div className={styles.compactField}>
                      <label>Área total (m²)</label>
                      <input
                        name="area_total_m2"
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          formValues[selectedLote]?.area_total_m2 ??
                          generatedLotes.find((l) => l.id === selectedLote)?.area_total_m2 ??
                          ""
                        }
                        onChange={handleFormChange}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.compactField}>
                      <label>Ancho (m)</label>
                      <input
                        name="ancho"
                        type="number"
                        step="0.01"
                        value={formValues[selectedLote]?.ancho || ""}
                        onChange={handleFormChange}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.compactField}>
                      <label>Largo (m)</label>
                      <input
                        name="largo"
                        type="number"
                        step="0.01"
                        value={formValues[selectedLote]?.largo || ""}
                        onChange={handleFormChange}
                        className={styles.input}
                      />
                    </div>
                  </div>

                  {esCasa && (
                    <div className={styles.compactGrid}>
                      <div className={styles.compactField}>
                        <label>Dormitorios</label>
                        <input
                          name="dormitorios"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.dormitorios ?? 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Baños</label>
                        <input
                          name="banos"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.banos ?? 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Cuartos</label>
                        <input
                          name="cuartos"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.cuartos ?? 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Cochera</label>
                        <input
                          name="cochera"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.cochera || 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Cocina</label>
                        <input
                          name="cocina"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.cocina || 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Sala</label>
                        <input
                          name="sala"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.sala || 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Patio</label>
                        <input
                          name="patio"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.patio || 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Jardín</label>
                        <input
                          name="jardin"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.jardin || 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Terraza</label>
                        <input
                          name="terraza"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.terraza || 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.compactField}>
                        <label>Azotea</label>
                        <input
                          name="azotea"
                          type="number"
                          min="0"
                          value={formValues[selectedLote]?.azotea || 0}
                          onChange={handleFormChange}
                          className={styles.input}
                        />
                      </div>
                    </div>
                  )}

                  <div className={styles.inputGroup}>
                    <label className={styles.inlineRow}>
                      <ImageIcon size={16} className={styles.inlineIcon} />
                      Imágenes del inmueble
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImagenesChange}
                      className={styles.input}
                    />
                    {formValues[selectedLote]?.imagenes?.length > 0 && (
                      <div className={styles.imagePreviewGrid}>
                        {formValues[selectedLote].imagenes.map((img, index) => (
                          <div key={index} className={styles.imagePreviewItem}>
                            <img src={img.preview} alt={`lote-${index}`} />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(selectedLote, index)}
                              className={styles.imageRemoveBtn}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className={styles.rightColumn}>
              <h2 className={styles.sectionTitle}>
                <span className="material-icons-outlined">map</span> Mapa
              </h2>
              <div className={styles.mapWrapper}>
                <GoogleMap
                  onLoad={(map) => {
                    onMapLoad(map);
                    applyMapType(map);
                  }}
                  mapContainerClassName={styles.googleMap}
                  zoom={mapZoom}
                  center={mapCenter}
                  options={{ gestureHandling: "greedy", mapTypeControl: false }}
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
                          .map((p) => ({
                            lat: p.lat(),
                            lng: p.lng(),
                          }));

                        setGeneratedLotes((prev) =>
                          prev.map((l) => (l.id === lote.id ? { ...l, coords } : l)),
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

                  {generatedLotes.map((lote) => (
                    <Marker
                      key={`label-${lote.id}`}
                      position={lote.center || getPolygonCenter(lote.coords)}
                      label={{
                        text:
                          formValues[lote.id]?.nombreManual
                            ? formValues[lote.id]?.nombre || ""
                            : lote.nombre || "",
                        color: "#0f172a",
                        fontSize: "12px",
                        fontWeight: "700",
                      }}
                      clickable={false}
                      options={{
                        icon: {
                          path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                          scale: 0,
                          fillOpacity: 0,
                          strokeOpacity: 0,
                        },
                      }}
                    />
                  ))}

                  {getRowCenters(generatedLotes).map((rowCenter) => (
                    <Marker
                      key={`row-${rowCenter.row}`}
                      position={rowCenter.position}
                      label={{
                        text: `Fila ${rowCenter.displayIndex ?? rowCenter.row + 1}`,
                        color: "#1d4ed8",
                        fontSize: "12px",
                        fontWeight: "800",
                      }}
                      clickable={false}
                      options={{
                        icon: {
                          path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                          scale: 0,
                          fillOpacity: 0,
                          strokeOpacity: 0,
                        },
                      }}
                    />
                  ))}

                  <DrawingManager
                    onLoad={(dm) => {
                      if (
                        drawingManagerRef.current &&
                        drawingManagerRef.current !== dm
                      ) {
                        drawingManagerRef.current.setMap(null);
                      }
                      drawingManagerRef.current = dm;
                      setTimeout(pruneDuplicateDrawingControls, 0);
                    }}
                    onUnmount={(dm) => {
                      dm?.setMap(null);
                      drawingManagerRef.current = null;
                    }}
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
                </GoogleMap>
                <div className={styles.mapTypeControlWrap}>
                  <div className={styles.mapTypeTabs} aria-label="Tipo de mapa">
                    <button
                      type="button"
                      className={`${styles.mapTypeBtn} ${baseMapStyle === "roadmap" ? styles.mapTypeBtnActive : ""}`}
                      onClick={() => {
                        setBaseMapStyle("roadmap");
                        applyMapType(mapRef.current);
                      }}
                      aria-pressed={baseMapStyle === "roadmap"}
                    >
                      Mapa
                    </button>
                    <button
                      type="button"
                      className={`${styles.mapTypeBtn} ${baseMapStyle === "satellite" ? styles.mapTypeBtnActive : ""}`}
                      onClick={() => {
                        setBaseMapStyle("satellite");
                        applyMapType(mapRef.current);
                      }}
                      aria-pressed={baseMapStyle === "satellite"}
                    >
                      Satelite
                    </button>
                  </div>
                  <div className={styles.mapTypeSubMenu}>
                    <span className={styles.mapTypeSubLabel}>
                      {baseMapStyle === "satellite" ? "Etiquetas" : "Relieve"}
                    </span>
                    <div className={styles.mapTypeSubRow}>
                      {baseMapStyle === "satellite" ? (
                        <>
                          <button
                            type="button"
                            className={`${styles.mapTypeSubBtn} ${labelsEnabled ? styles.mapTypeSubBtnActive : ""}`}
                            onClick={() => {
                              setLabelsEnabled(true);
                              applyMapType(mapRef.current);
                            }}
                            aria-pressed={labelsEnabled}
                          >
                            On
                          </button>
                          <button
                            type="button"
                            className={`${styles.mapTypeSubBtn} ${!labelsEnabled ? styles.mapTypeSubBtnActive : ""}`}
                            onClick={() => {
                              setLabelsEnabled(false);
                              applyMapType(mapRef.current);
                            }}
                            aria-pressed={!labelsEnabled}
                          >
                            Off
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`${styles.mapTypeSubBtn} ${reliefEnabled ? styles.mapTypeSubBtnActive : ""}`}
                            onClick={() => {
                              setReliefEnabled(true);
                              applyMapType(mapRef.current);
                            }}
                            aria-pressed={reliefEnabled}
                          >
                            On
                          </button>
                          <button
                            type="button"
                            className={`${styles.mapTypeSubBtn} ${!reliefEnabled ? styles.mapTypeSubBtnActive : ""}`}
                            onClick={() => {
                              setReliefEnabled(false);
                              applyMapType(mapRef.current);
                            }}
                            aria-pressed={!reliefEnabled}
                          >
                            Off
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.footerBar}>
            <button
              onClick={handleRegisterAll}
              className={`${styles.submitBtn} ${styles.btnWithIcon}`}
              disabled={generatedLotes.length === 0}
              style={{
                opacity: generatedLotes.length === 0 ? 0.5 : 1,
                cursor: generatedLotes.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              <Save size={16} className={styles.inlineIcon} />
              Registrar Todos ({generatedLotes.length})
            </button>
          </div>
        </div>
      </div>
      {showRegisterModal && (
        <div className={styles.modalOverlay}>
          <div
            className={styles.modalContent}
            style={{ maxWidth: "420px", maxHeight: "320px", height: "auto" }}
          >
            <div className={styles.header}>
              <div>
                <h1 className={styles.title}>Registro</h1>
                <p className={styles.subtitle}>Estado del registro masivo.</p>
              </div>
              {!isRegistering && (
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setShowRegisterModal(false)}
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              )}
            </div>
            <div className={styles.formBody} style={{ textAlign: "left" }}>
              <h3>{registerMessage}</h3>
              {registerItems.length > 0 && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    maxHeight: "140px",
                    overflowY: "auto",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "0.5rem 0.6rem",
                    background: "var(--theme-bg-soft)",
                    fontSize: "0.75rem",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "0.4rem" }}>
                    Registrando:
                  </strong>
                  {registerItems.map((item) => (
                    <div key={item.id} style={{ marginBottom: "0.25rem" }}>
                      {item.nombre}
                    </div>
                  ))}
                </div>
              )}
              {!isRegistering && (
                <button
                  className={styles.submitBtn}
                  onClick={() => setShowRegisterModal(false)}
                  style={{ marginTop: "1rem" }}
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
