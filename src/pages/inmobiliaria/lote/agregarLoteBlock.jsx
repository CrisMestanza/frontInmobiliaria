import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
import { getResponseErrorMessage } from "../../../utils/apiErrors.js";
// components/LoteModal.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Polygon, DrawingManager, Marker } from "@react-google-maps/api";
import {
  area as turfArea,
  difference as turfDifference,
  featureCollection,
  intersect as turfIntersect,
  kinks as turfKinks,
  polygon as turfPolygon,
  union as turfUnion,
  unkinkPolygon as turfUnkinkPolygon,
} from "@turf/turf";
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
  Scissors,
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

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return await response.blob();
};

const getNextTempLoteId = (items) =>
  (items || []).reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;

const getCoordsBounds = (coords) => {
  const valid = normalizePolygonCoords(coords);
  if (!valid.length) return null;

  return valid.reduce(
    (acc, point) => ({
      minLat: Math.min(acc.minLat, point.lat),
      maxLat: Math.max(acc.maxLat, point.lat),
      minLng: Math.min(acc.minLng, point.lng),
      maxLng: Math.max(acc.maxLng, point.lng),
    }),
    {
      minLat: valid[0].lat,
      maxLat: valid[0].lat,
      minLng: valid[0].lng,
      maxLng: valid[0].lng,
    },
  );
};

const toClosedRing = (coords) => {
  const normalized = normalizePolygonCoords(coords).map((point) => [point.lng, point.lat]);
  if (normalized.length < 3) return [];
  const [firstLng, firstLat] = normalized[0];
  const [lastLng, lastLat] = normalized[normalized.length - 1];
  if (Math.abs(firstLng - lastLng) > 1e-10 || Math.abs(firstLat - lastLat) > 1e-10) {
    normalized.push([firstLng, firstLat]);
  }
  return normalized;
};

const ringToCoords = (ring) =>
  (ring || [])
    .slice(0, -1)
    .map(([lng, lat]) => ({ lat, lng }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

const clipPolygonAgainstHalfPlane = (coords, axis, threshold, keepLess) => {
  const input = normalizePolygonCoords(coords);
  if (input.length < 3) return [];

  const inside = (point) =>
    keepLess ? point[axis] <= threshold + 1e-10 : point[axis] >= threshold - 1e-10;

  const intersection = (start, end) => {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-12) {
      return { lat: start.lat, lng: start.lng };
    }
    const t = (threshold - start[axis]) / delta;
    return {
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    };
  };

  const output = [];
  for (let i = 0; i < input.length; i += 1) {
    const current = input[i];
    const previous = input[(i + input.length - 1) % input.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside) {
      if (!previousInside) {
        output.push(intersection(previous, current));
      }
      output.push(current);
    } else if (previousInside) {
      output.push(intersection(previous, current));
    }
  }

  return normalizePolygonCoords(output);
};

const splitPolygonByAxis = (coords, axis) => {
  const bounds = getCoordsBounds(coords);
  if (!bounds) return null;

  const threshold =
    axis === "lng"
      ? (bounds.minLng + bounds.maxLng) / 2
      : (bounds.minLat + bounds.maxLat) / 2;

  const first = clipPolygonAgainstHalfPlane(coords, axis, threshold, true);
  const second = clipPolygonAgainstHalfPlane(coords, axis, threshold, false);

  if (first.length < 3 || second.length < 3) {
    return null;
  }

  return [first, second];
};

const polygonFromCoords = (coords) => {
  const ring = toClosedRing(coords);
  return ring.length >= 4 ? turfPolygon([ring]) : null;
};

const largestPolygonCoordsFromUnion = (feature) => {
  if (!feature?.geometry) return null;
  if (feature.geometry.type === "Polygon") {
    return normalizePolygonCoords(ringToCoords(feature.geometry.coordinates[0]));
  }
  if (feature.geometry.type !== "MultiPolygon") return null;

  const candidates = feature.geometry.coordinates
    .map((polygonCoords) => normalizePolygonCoords(ringToCoords(polygonCoords[0])))
    .filter((coords) => coords.length >= 3);

  if (!candidates.length) return null;

  return candidates.sort((a, b) => {
    const featureA = polygonFromCoords(a);
    const featureB = polygonFromCoords(b);
    return turfArea(featureB) - turfArea(featureA);
  })[0];
};

const getLargestFeatureFromCollection = (featureCollectionInput) => {
  const features = Array.isArray(featureCollectionInput?.features)
    ? featureCollectionInput.features.filter((feature) => feature?.geometry)
    : [];
  if (!features.length) return null;

  return features.sort((a, b) => turfArea(b) - turfArea(a))[0];
};

const polygonHasSelfIntersection = (coords) => {
  const polygonFeature = polygonFromCoords(coords);
  if (!polygonFeature) return false;
  try {
    return (turfKinks(polygonFeature)?.features?.length || 0) > 0;
  } catch {
    return false;
  }
};

const normalizeSelfIntersectingCoords = (coords) => {
  const polygonFeature = polygonFromCoords(coords);
  if (!polygonFeature) return null;

  if (!polygonHasSelfIntersection(coords)) {
    return normalizePolygonCoords(coords);
  }

  try {
    const unkinked = turfUnkinkPolygon(polygonFeature);
    const largest = getLargestFeatureFromCollection(unkinked);
    if (!largest?.geometry) return null;
    if (largest.geometry.type === "Polygon") {
      return normalizePolygonCoords(ringToCoords(largest.geometry.coordinates[0]));
    }
    if (largest.geometry.type === "MultiPolygon") {
      return largestPolygonCoordsFromUnion(largest);
    }
    return null;
  } catch {
    return null;
  }
};

const getDataUrlDimensions = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("No se pudo leer el tamaño de la imagen del PDF."));
    };
    img.src = dataUrl;
  });

export default function LoteModal({ onClose, idproyecto, embedded = false }) {
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
  const [isExtractingLotes, setIsExtractingLotes] = useState(false);
  const [extractionSummary, setExtractionSummary] = useState("");
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [detectionStatus, setDetectionStatus] = useState("Listo para iniciar");
  const [detectionEta, setDetectionEta] = useState("00:00");
  const [detectionAccepted, setDetectionAccepted] = useState(false);
  const detectionIntervalRef = useRef(null);
  const detectionStartedAtRef = useRef(0);
  const detectionProgressRef = useRef(0);
  const [selectedLoteIds, setSelectedLoteIds] = useState([]);
  const [reviewModeEnabled, setReviewModeEnabled] = useState(false);
  const [reviewSummary, setReviewSummary] = useState("");
  const overlayRef = useRef(null);
  const drawingManagerRef = useRef(null);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  const esCasa = formValues[selectedLote]?.tipo_inmueble === 2;
  const polygonRefs = useRef({});
  const nextGeneratedLoteIdRef = useRef(1);

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

  const recalculateLote = useCallback((lote) => {
    const coords =
      normalizeSelfIntersectingCoords(lote.coords) ||
      normalizePolygonCoords(lote.coords);
    return {
      ...lote,
      coords,
      center: getPolygonCenter(coords),
      area_total_m2:
        lote.area_total_m2 !== undefined && lote.area_total_m2 !== ""
          ? lote.area_total_m2
          : calculatePolygonArea(coords),
    };
  }, []);

  const syncSelectionWithLotes = useCallback((nextLotes, nextSelected = null) => {
    const validIds = new Set(nextLotes.map((item) => item.id));
    setSelectedLoteIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      if (nextSelected !== null) {
        return nextSelected.filter((id) => validIds.has(id));
      }
      return filtered;
    });
    setSelectedLote((prev) => {
      if (nextSelected?.length) return nextSelected[0];
      return validIds.has(prev) ? prev : nextLotes[0]?.id ?? null;
    });
  }, []);

  const sanitizeGeneratedLotesGeometry = useCallback((items) => {
    const overlapToleranceArea = 0.05;
    const sanitized = [];
    let trimmedOverlaps = 0;
    let fixedSelfIntersections = 0;
    let droppedInvalid = 0;

    items.forEach((item) => {
      const normalizedCoords =
        normalizeSelfIntersectingCoords(item.coords) ||
        normalizePolygonCoords(item.coords);
      if (!normalizedCoords || normalizedCoords.length < 3) {
        droppedInvalid += 1;
        return;
      }

      if (polygonHasSelfIntersection(item.coords)) {
        fixedSelfIntersections += 1;
      }

      let currentFeature = polygonFromCoords(normalizedCoords);
      if (!currentFeature) {
        droppedInvalid += 1;
        return;
      }

      for (const accepted of sanitized) {
        if (!currentFeature) break;

        const acceptedFeature = polygonFromCoords(accepted.coords);
        if (!acceptedFeature) continue;

        try {
          const overlap = turfIntersect(featureCollection([currentFeature, acceptedFeature]));
          const overlapArea = overlap ? turfArea(overlap) : 0;
          if (overlapArea <= overlapToleranceArea) {
            continue;
          }

          const diff = turfDifference(featureCollection([currentFeature, acceptedFeature]));
          if (!diff?.geometry) {
            currentFeature = null;
            trimmedOverlaps += 1;
            break;
          }

          const nextCoords = largestPolygonCoordsFromUnion(diff);
          if (!nextCoords || nextCoords.length < 3) {
            currentFeature = null;
            trimmedOverlaps += 1;
            break;
          }

          currentFeature = polygonFromCoords(nextCoords);
          trimmedOverlaps += 1;
        } catch (error) {
          console.warn("No se pudo recortar solape entre lotes:", error);
        }
      }

      if (!currentFeature?.geometry) {
        droppedInvalid += 1;
        return;
      }

      const finalCoords = largestPolygonCoordsFromUnion(currentFeature);
      if (!finalCoords || finalCoords.length < 3) {
        droppedInvalid += 1;
        return;
      }

      sanitized.push({
        ...item,
        coords: finalCoords,
      });
    });

    return {
      items: sanitized,
      stats: {
        trimmedOverlaps,
        fixedSelfIntersections,
        droppedInvalid,
      },
    };
  }, []);

  const updateGeneratedLotes = useCallback((updater, selectionOverride = null) => {
    setGeneratedLotes((prev) => {
      const nextRaw = typeof updater === "function" ? updater(prev) : updater;
      const { items: sanitizedItems, stats } = sanitizeGeneratedLotesGeometry(nextRaw);
      const next = sanitizedItems.map(recalculateLote);
      nextGeneratedLoteIdRef.current = getNextTempLoteId(next);
      if (stats.trimmedOverlaps || stats.fixedSelfIntersections || stats.droppedInvalid) {
        setReviewSummary(
          `Geometría ajustada: ${stats.trimmedOverlaps} solape(s) recortado(s), ${stats.fixedSelfIntersections} lote(s) reparado(s), ${stats.droppedInvalid} descartado(s).`,
        );
      }
      queueMicrotask(() => syncSelectionWithLotes(next, selectionOverride));
      return next;
    });
  }, [recalculateLote, sanitizeGeneratedLotesGeometry, syncSelectionWithLotes]);

  const isLoteSelected = useCallback(
    (loteId) => selectedLoteIds.includes(loteId),
    [selectedLoteIds],
  );

  const clearDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  const startDetectionAnimation = useCallback(() => {
    clearDetectionInterval();
    detectionStartedAtRef.current = Date.now();
    detectionProgressRef.current = 4;
    setDetectionProgress(4);
    setDetectionStatus("Preparando extracción...");
    setDetectionEta("00:00");
    detectionIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - detectionStartedAtRef.current;
      const current = detectionProgressRef.current;
      const next = current < 88 ? Math.min(88, current + (current < 30 ? 11 : current < 60 ? 7 : 3)) : current;
      detectionProgressRef.current = next;
      setDetectionProgress(next);
      setDetectionStatus((current) => {
        if (elapsedMs < 1200) return "Validando PDF...";
        if (elapsedMs < 2400) return "Analizando contraste...";
        if (elapsedMs < 4200) return "Detectando lotes...";
        return "Afinando resultados...";
      });
      const progress = Math.max(4, Math.min(88, next));
      const estimatedTotal = Math.max(2200, Math.round((elapsedMs / progress) * 100));
      const remaining = Math.max(0, estimatedTotal - elapsedMs);
      const mins = String(Math.floor(remaining / 60000)).padStart(2, "0");
      const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
      setDetectionEta(`${mins}:${secs}`);
    }, 320);
  }, [clearDetectionInterval, detectionProgress]);

  const stopDetectionAnimation = useCallback(() => {
    clearDetectionInterval();
    detectionProgressRef.current = 0;
    setDetectionEta("00:00");
    setDetectionStatus("Listo");
  }, [clearDetectionInterval]);

  const handleOpenDetectionModal = () => {
    if (!pdfImage || !overlayBounds) {
      alert("Primero carga y acomoda el PDF del proyecto.");
      return;
    }
    setDetectionAccepted(false);
    setShowDetectionModal(true);
  };

  const handleConfirmDetection = async () => {
    setDetectionAccepted(true);
    startDetectionAnimation();
    try {
      await handleExtractLotes();
      setDetectionProgress(100);
      setDetectionStatus("Extracción finalizada");
    } finally {
      window.setTimeout(() => {
        stopDetectionAnimation();
        setDetectionProgress(0);
        setDetectionAccepted(false);
        setShowDetectionModal(false);
      }, 450);
    }
  };

  const toggleLoteSelection = useCallback((loteId, forceMultiSelect = false) => {
    setSelectedLoteIds((prev) => {
      if (reviewModeEnabled || forceMultiSelect) {
        return prev.includes(loteId)
          ? prev.filter((id) => id !== loteId)
          : [...prev, loteId];
      }
      return [loteId];
    });
  }, [reviewModeEnabled]);

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
    updateGeneratedLotes(grid);
  }, [
    basePolygonCoords,
    gridParams.rows,
    gridParams.cols,
    rotationDeg,
    generateGridFromPolygon,
    updateGeneratedLotes,
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
    updateGeneratedLotes((prev) => {
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
  }, [rowNumbering, manzanaLabel, useRowPrice, updateGeneratedLotes]);

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

  const isPointInsideProject = useCallback(
    (point) => {
      if (!googleRef.current || !proyectoCoords?.length) return true;
      const projectPolygon = new googleRef.current.maps.Polygon({
        paths: proyectoCoords,
      });
      return googleRef.current.maps.geometry.poly.containsLocation(
        new googleRef.current.maps.LatLng(point.lat, point.lng),
        projectPolygon,
      );
    },
    [proyectoCoords],
  );

  const isPolygonMostlyInsideProject = useCallback(
    (coords) => {
      if (!Array.isArray(coords) || coords.length < 3) return false;
      const insideCount = coords.filter((point) => isPointInsideProject(point)).length;
      return insideCount >= Math.max(2, Math.ceil(coords.length * 0.6));
    },
    [isPointInsideProject],
  );

  const imagePointToMapLatLng = useCallback(
    (point, imageWidth, imageHeight) => {
      if (!overlayBounds || !imageWidth || !imageHeight) return null;

      const centerLat = (overlayBounds.north + overlayBounds.south) / 2;
      const centerLng = (overlayBounds.east + overlayBounds.west) / 2;
      const latSpan = overlayBounds.north - overlayBounds.south;
      const lngSpan = overlayBounds.east - overlayBounds.west;

      const normalizedX = point.x / imageWidth - 0.5;
      const normalizedY = point.y / imageHeight - 0.5;

      const vectorScreen = {
        x: normalizedX * lngSpan,
        y: normalizedY * latSpan,
      };

      const angleRad = (Number(pdfRotation) * Math.PI) / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      const rotatedX = vectorScreen.x * cosA - vectorScreen.y * sinA;
      const rotatedY = vectorScreen.x * sinA + vectorScreen.y * cosA;

      return {
        lat: centerLat - rotatedY,
        lng: centerLng + rotatedX,
      };
    },
    [overlayBounds, pdfRotation],
  );

  const mapLatLngToImagePoint = useCallback(
    (point, imageWidth, imageHeight) => {
      if (!overlayBounds || !imageWidth || !imageHeight) return null;

      const centerLat = (overlayBounds.north + overlayBounds.south) / 2;
      const centerLng = (overlayBounds.east + overlayBounds.west) / 2;
      const latSpan = overlayBounds.north - overlayBounds.south;
      const lngSpan = overlayBounds.east - overlayBounds.west;
      if (!latSpan || !lngSpan) return null;

      const rotatedX = point.lng - centerLng;
      const rotatedY = centerLat - point.lat;

      const angleRad = (Number(pdfRotation) * Math.PI) / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      const vectorX = rotatedX * cosA + rotatedY * sinA;
      const vectorY = -rotatedX * sinA + rotatedY * cosA;

      const normalizedX = vectorX / lngSpan;
      const normalizedY = vectorY / latSpan;

      return {
        x: Math.round((normalizedX + 0.5) * imageWidth),
        y: Math.round((normalizedY + 0.5) * imageHeight),
      };
    },
    [overlayBounds, pdfRotation],
  );

  const buildDetectedRowMeta = useCallback((items) => {
    if (!items.length) return { items: [], rowCount: 0, maxCols: 0 };

    const heights = items
      .map((item) => {
        const lats = item.coords.map((point) => point.lat);
        return Math.max(...lats) - Math.min(...lats);
      })
      .filter((value) => Number.isFinite(value) && value > 0);

    const averageHeight =
      heights.length > 0
        ? heights.reduce((sum, value) => sum + value, 0) / heights.length
        : 0.00004;
    const rowThreshold = Math.max(averageHeight * 0.7, 0.00002);

    const sorted = [...items].sort((a, b) => {
      const latDiff = (b.center?.lat ?? 0) - (a.center?.lat ?? 0);
      if (Math.abs(latDiff) > rowThreshold) return latDiff;
      return (a.center?.lng ?? 0) - (b.center?.lng ?? 0);
    });

    const rows = [];
    sorted.forEach((item) => {
      const row = rows.find(
        (candidate) => Math.abs(candidate.anchorLat - (item.center?.lat ?? 0)) <= rowThreshold,
      );
      if (row) {
        row.items.push(item);
        row.anchorLat =
          row.items.reduce((sum, current) => sum + (current.center?.lat ?? 0), 0) /
          row.items.length;
      } else {
        rows.push({
          anchorLat: item.center?.lat ?? 0,
          items: [item],
        });
      }
    });

    const normalizedRows = rows
      .sort((a, b) => b.anchorLat - a.anchorLat)
      .map((row) =>
        row.items.sort((a, b) => (a.center?.lng ?? 0) - (b.center?.lng ?? 0)),
      );

    const withRows = normalizedRows.flatMap((rowItems, rowIndex) =>
      rowItems.map((item, colIndex) => ({
        ...item,
        row: rowIndex,
        col: colIndex,
      })),
    );

    return {
      items: withRows,
      rowCount: normalizedRows.length,
      maxCols: normalizedRows.reduce(
        (max, rowItems) => Math.max(max, rowItems.length),
        0,
      ),
    };
  }, []);

  const handleExtractLotes = useCallback(async () => {
    if (!pdfImage || !overlayBounds) {
      alert("Primero carga y acomoda el PDF del proyecto.");
      return;
    }

    try {
      setIsExtractingLotes(true);
      setExtractionSummary("");

      const overlayBlob = await dataUrlToBlob(pdfImage);
      const originalPdfBlob = await loadPdfFromIndexedDB(idproyecto);
      const { width: imageWidth, height: imageHeight } =
        await getDataUrlDimensions(pdfImage);
      const formData = new FormData();
      formData.append("idproyecto", String(idproyecto));
      formData.append("overlay_image", overlayBlob, `proyecto-${idproyecto}-overlay.png`);
      if (originalPdfBlob) {
        formData.append("overlay_pdf", originalPdfBlob, `proyecto-${idproyecto}.pdf`);
        formData.append("image_width", String(imageWidth));
        formData.append("image_height", String(imageHeight));
      }
      const projectPolygonImage = proyectoCoords
        .map((point) => mapLatLngToImagePoint(point, imageWidth, imageHeight))
        .filter(Boolean);
      if (projectPolygonImage.length >= 3) {
        formData.append("project_polygon", JSON.stringify(projectPolygonImage));
      }

      const response = await authFetch(
        withApiBase("https://api.geohabita.com/api/extractLotesFromOverlay/"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(
          await getResponseErrorMessage(response, "No se pudo extraer lotes del plano."),
        );
      }
      const payload = await response.json().catch(() => ({}));
      const roiApplied = Boolean(payload?.debug?.roi_applied);
      const detectedPolygons = Array.isArray(payload?.polygons) ? payload.polygons : [];

      const extractedItems = detectedPolygons
        .map((polygon, index) => {
          const coords = normalizePolygonCoords(
            (polygon.points || [])
              .map((point) => imagePointToMapLatLng(point, imageWidth, imageHeight))
              .filter(Boolean),
          );
          const center = getPolygonCenter(coords);
          const mostlyInside = isPolygonMostlyInsideProject(coords);
          if (
            !center ||
            coords.length < 3 ||
            (!roiApplied && !mostlyInside)
          ) {
            return null;
          }

          return {
            id: index + 1,
            nombre: `Lote ${index + 1}`,
            precio: 0,
            descripcion: "",
            area_total_m2: "",
            vendido: 0,
            coords,
            center,
            confidence: polygon.confidence,
          };
        })
        .filter(Boolean);

      if (!extractedItems.length) {
        const debugMessage = payload?.debug
          ? ` Debug: ${JSON.stringify(payload.debug)}`
          : "";
        throw new Error(
          `No se detectaron lotes válidos dentro del polígono del proyecto.${debugMessage}`,
        );
      }

      const rowMeta = buildDetectedRowMeta(extractedItems);
      const generated = rowMeta.items.map((item, index) => ({
        ...item,
        id: index + 1,
        nombre: `Lote ${index + 1}`,
      }));

      setBasePolygonCoords(null);
      setGeneratedLotes(generated);
      nextGeneratedLoteIdRef.current = getNextTempLoteId(generated);
      setSelectedLote(generated[0]?.id ?? null);
      setSelectedLoteIds(generated[0] ? [generated[0].id] : []);
      setFormValues({});
      manualOverridesRef.current = {};
      setReviewSummary("");
      const extractedRows = Math.max(1, rowMeta.rowCount);
      const extractedCols = Math.max(1, rowMeta.maxCols);
      const defaultRowNumbering = [];
      let counter = 1;
      for (let rowIndex = 0; rowIndex < extractedRows; rowIndex += 1) {
        const rowStart = counter;
        const rowEnd = counter + Math.max(0, extractedCols - 1);
        defaultRowNumbering.push({ start: rowStart, end: rowEnd });
        counter = rowEnd + 1;
      }
      setRowNumbering(defaultRowNumbering);
      setGridParams({
        rows: extractedRows,
        cols: extractedCols,
      });
      setExtractionSummary(
        `Detectados ${generated.length} lotes desde el PDF calibrado.`,
      );
    } catch (error) {
      console.error("Error extrayendo lotes:", error);
      setExtractionSummary(error.message || "No se pudo extraer lotes.");
      alert(error.message || "No se pudo extraer lotes.");
    } finally {
      setIsExtractingLotes(false);
    }
  }, [
    pdfImage,
    overlayBounds,
    idproyecto,
    token,
    proyectoCoords,
    imagePointToMapLatLng,
    mapLatLngToImagePoint,
    isPointInsideProject,
    isPolygonMostlyInsideProject,
    buildDetectedRowMeta,
  ]);

  const handleSelectLote = (lote, nativeEvent = null) => {
    setSelectedLote(lote.id);
    const multiSelectRequested = Boolean(
      nativeEvent?.ctrlKey || nativeEvent?.metaKey || nativeEvent?.shiftKey,
    );
    toggleLoteSelection(lote.id, multiSelectRequested);

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

  const handleDeleteSelectedLotes = () => {
    if (!selectedLoteIds.length) return;

    const selectedIds = new Set(selectedLoteIds);
    updateGeneratedLotes(
      (prev) => prev.filter((lote) => !selectedIds.has(lote.id)),
      [],
    );
    setFormValues((prev) => {
      const next = { ...prev };
      selectedLoteIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setReviewSummary(`Se eliminaron ${selectedLoteIds.length} lotes de la revisión.`);
  };

  const handleMergeSelectedLotes = () => {
    if (selectedLoteIds.length !== 2) {
      alert("Selecciona exactamente 2 lotes para unir.");
      return;
    }

    const [firstId, secondId] = selectedLoteIds;
    const first = generatedLotes.find((item) => item.id === firstId);
    const second = generatedLotes.find((item) => item.id === secondId);
    if (!first || !second) return;

    try {
      const features = [polygonFromCoords(first.coords), polygonFromCoords(second.coords)].filter(Boolean);
      if (features.length !== 2) {
        throw new Error("Los lotes seleccionados no tienen una geometría válida para unir.");
      }
      const mergedFeature = turfUnion(
        featureCollection(features),
      );
      const mergedCoords = largestPolygonCoordsFromUnion(mergedFeature);
      if (!mergedCoords || mergedCoords.length < 3) {
        throw new Error("No se pudo construir un polígono unido válido.");
      }

      const mergedLote = recalculateLote({
        ...first,
        coords: mergedCoords,
      });

      updateGeneratedLotes(
        (prev) =>
          prev
            .filter((item) => item.id !== secondId)
            .map((item) => (item.id === firstId ? mergedLote : item)),
        [firstId],
      );
      setFormValues((prev) => {
        const next = { ...prev };
        delete next[secondId];
        return next;
      });
      setReviewSummary(`Se unieron los lotes ${firstId} y ${secondId}.`);
    } catch (error) {
      console.error("Error uniendo lotes:", error);
      alert(error.message || "No se pudieron unir esos lotes.");
    }
  };

  const handleSplitSelectedLote = (axis) => {
    if (selectedLoteIds.length !== 1) {
      alert("Selecciona un solo lote para dividir.");
      return;
    }

    const loteId = selectedLoteIds[0];
    const lote = generatedLotes.find((item) => item.id === loteId);
    if (!lote) return;

    const pieces = splitPolygonByAxis(lote.coords, axis);
    if (!pieces) {
      alert("No se pudo dividir ese lote con este eje. Ajusta los vértices o prueba el otro corte.");
      return;
    }

    const newId = nextGeneratedLoteIdRef.current;
    const firstPiece = recalculateLote({
      ...lote,
      coords: pieces[0],
    });
    const secondPiece = recalculateLote({
      ...lote,
      id: newId,
      nombre: `${lote.nombre} B`,
      coords: pieces[1],
    });

    updateGeneratedLotes(
      (prev) =>
        prev.flatMap((item) => {
          if (item.id !== loteId) return [item];
          return [
            { ...firstPiece, nombre: lote.nombre },
            secondPiece,
          ];
        }),
      [loteId, newId],
    );
    setReviewSummary(
      `Se dividió el lote ${loteId} con un corte ${axis === "lng" ? "vertical" : "horizontal"}.`,
    );
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

        puntos: lote.coords.map((p, pointIndex) => ({
          latitud: p.lat,
          longitud: p.lng,
          orden: pointIndex + 1,
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

      if (!res.ok) {
        throw new Error(
          await getResponseErrorMessage(
            res,
            "No se pudieron registrar los inmuebles seleccionados.",
          ),
        );
      }

      setRegisterMessage("Registro con exito.");
      onClose();
    } catch (error) {
      console.error(error);
      setRegisterMessage(error?.message || "Error al registrar los inmuebles");

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
    setSelectedLoteIds([]);
    setRotationDeg(0);
    setDetectedAngle(0);
    setReviewSummary("");
    if (drawnPolygonRef.current) {
      drawnPolygonRef.current.setMap(null);
      drawnPolygonRef.current = null;
    }
  };


  if (!isLoaded || !mapCenter) return <div>Cargando mapa...</div>;




  const overlayStyle = embedded
    ? {
        position: "relative",
        inset: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: 0,
        zIndex: "auto",
        alignItems: "stretch",
        display: "block",
        overflow: "visible",
      }
    : undefined;

  const contentStyle = embedded
    ? {
        width: "100%",
        maxWidth: "none",
        minHeight: "auto",
        height: "auto",
        maxHeight: "none",
        borderRadius: "24px",
        boxShadow: "none",
        overflow: "visible",
        border: "1px solid rgba(148, 163, 184, 0.16)",
      }
    : undefined;

  return (
    <div className={styles.modalOverlay} style={overlayStyle}>
      {showDetectionModal && (
        <div
          className={styles.extractionModalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowDetectionModal(false);
            }
          }}
        >
          <div className={styles.extractionModal}>
            <div className={styles.extractionModalHeader}>
              <div className={styles.extractionLogoWrap}>
                <img src="/geohabita.png" alt="GeoHabita" className={styles.extractionLogo} />
              </div>
              <div>
                <span className={styles.extractionEyebrow}>Detección Inteligente</span>
                <h2>Extraer lotes desde PDF</h2>
                <p>
                  Esta herramienta no es 100% precisa. Recomendamos usar un PDF con poco color, lotes claramente visibles y sin transparencias que oculten los bordes.
                </p>
              </div>
            </div>

            {!detectionAccepted ? (
              <>
                <div className={styles.extractionTips}>
                  <strong>Antes de continuar</strong>
                  <ul>
                    <li>Usa el PDF más limpio posible, con contraste alto.</li>
                    <li>Evita fondos cargados o marcas que confundan bordes.</li>
                    <li>Si el plano tiene muchas capas, la detección puede requerir ajuste manual.</li>
                    <li>Verifica que el proyecto tenga un PDF vinculado y bien calibrado.</li>
                  </ul>
                </div>
                <div className={styles.extractionActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setShowDetectionModal(false)}>
                    Cancelar
                  </button>
                  <button type="button" className={styles.submitBtn} onClick={handleConfirmDetection}>
                    Aceptar y detectar
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.extractionProgressPanel}>
                <div className={styles.extractionProgressTop}>
                  <div>
                    <strong>{detectionStatus}</strong>
                    <span>Tiempo estimado: {detectionEta}</span>
                  </div>
                  <span className={styles.extractionProgressPct}>{detectionProgress}%</span>
                </div>
                <div className={styles.extractionProgressBar}>
                  <div className={styles.extractionProgressFill} style={{ width: `${detectionProgress}%` }} />
                </div>
                <div className={styles.extractionProgressNotes}>
                  <span>GeoHabita</span>
                  <span>Escaneando bordes</span>
                  <span>Validando polígonos</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={styles.modalContent} style={contentStyle}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Generar Lotes</h1>
            <p className={styles.subtitle}>
              Alinea lotes al polígono del proyecto y registra en un solo paso.
            </p>
          </div>
            {!embedded && (
              <button type="button" className={styles.closeBtn} onClick={onClose}>
                <span className="material-icons-outlined">close</span>
              </button>
            )}
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

                <section className={styles.intelligenceCard}>
                  <div>
                    <span className={styles.intelligenceEyebrow}>Detección Inteligente</span>
                    <h3>Extraer lotes automáticamente desde el PDF</h3>
                    <p>
                      Esta herramienta acelera la generación, pero requiere un PDF limpio y lotes bien contrastados para funcionar mejor.
                    </p>
                  </div>
                  <button
                    className={`${styles.submitBtn} ${styles.btnWithIcon}`}
                    onClick={handleOpenDetectionModal}
                    disabled={!pdfImage || !overlayBounds || isExtractingLotes}
                    type="button"
                  >
                    <ImageIcon size={16} className={styles.inlineIcon} />
                    {isExtractingLotes ? "Extrayendo..." : "Extraer lotes"}
                  </button>
                </section>

                <div className={styles.controlActions}>
                  <button
                    className={`${styles.submitBtn} ${styles.btnWithIcon}`}
                    onClick={handleRegenerateGrid}
                    disabled={!basePolygonCoords}
                    type="button"
                  >
                    <RotateCw size={16} className={styles.inlineIcon} />
                    Regenerar
                  </button>

                  <button
                    className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.dangerBtn}`}
                    onClick={handleClearPolygon}
                    type="button"
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
                      {extractionSummary && (
                        <span className={`${styles.inlineRow} ${styles.hintMeta}`}>
                          <Info size={14} className={styles.inlineIcon} />
                          {extractionSummary}
                        </span>
                      )}
                    </div>
                  )}
                  {!basePolygonCoords && extractionSummary && (
                    <span className={`${styles.inlineRow} ${styles.hintMeta}`}>
                      <Info size={14} className={styles.inlineIcon} />
                      {extractionSummary}
                    </span>
                  )}
                </div>
              </section>

              {generatedLotes.length > 0 && (
                <section className={styles.sectionCard}>
                  <h2 className={styles.sectionTitle}>
                    <span className="material-icons-outlined">handyman</span>
                    Revisión rápida
                  </h2>

                  <div className={styles.reviewToolbar}>
                    <button
                      type="button"
                      className={`${styles.submitBtn} ${styles.btnWithIcon} ${reviewModeEnabled ? styles.secondaryBtn : ""}`}
                      onClick={() => setReviewModeEnabled((prev) => !prev)}
                    >
                      {reviewModeEnabled ? "Modo selección activo" : "Activar selección múltiple"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.secondaryBtn}`}
                      onClick={() => {
                        setSelectedLoteIds([]);
                        setReviewSummary("Selección limpiada.");
                      }}
                    >
                      Limpiar selección
                    </button>
                  </div>

                  <div className={styles.reviewInfoCard}>
                    <strong>{selectedLoteIds.length} lote(s) seleccionado(s)</strong>
                    <span>
                      Haz clic en el mapa para seleccionar. Con `Ctrl`, `Cmd` o `Shift` también puedes sumar lotes aunque el modo múltiple esté apagado.
                    </span>
                    <span>
                      Si activas `selección múltiple`, cada clic agrega o quita lotes. Los seleccionados quedan editables para mover vértices.
                    </span>
                    <span>
                      `Dividir vertical` y `Dividir horizontal` hacen un corte limpio al centro del lote seleccionado.
                    </span>
                    {reviewSummary && <span>{reviewSummary}</span>}
                  </div>

                  <div className={styles.reviewSelectionGrid}>
                    {generatedLotes.map((lote) => (
                      <button
                        key={`pick-${lote.id}`}
                        type="button"
                        className={`${styles.reviewChip} ${isLoteSelected(lote.id) ? styles.reviewChipActive : ""}`}
                        onClick={() => {
                          setSelectedLote(lote.id);
                          toggleLoteSelection(lote.id, true);
                        }}
                      >
                        {formValues[lote.id]?.nombreManual
                          ? formValues[lote.id]?.nombre || `Lote ${lote.id}`
                          : lote.nombre || `Lote ${lote.id}`}
                      </button>
                    ))}
                  </div>

                  <div className={styles.reviewToolbar}>
                    <button
                      type="button"
                      className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.dangerBtn}`}
                      onClick={handleDeleteSelectedLotes}
                      disabled={!selectedLoteIds.length}
                    >
                      <Trash2 size={16} className={styles.inlineIcon} />
                      Eliminar seleccionados
                    </button>
                    <button
                      type="button"
                      className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.secondaryBtn}`}
                      onClick={handleMergeSelectedLotes}
                      disabled={selectedLoteIds.length !== 2}
                    >
                      Unir 2 lotes
                    </button>
                    <button
                      type="button"
                      className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.secondaryBtn}`}
                      onClick={() => handleSplitSelectedLote("lng")}
                      disabled={selectedLoteIds.length !== 1}
                    >
                      <Scissors size={16} className={styles.inlineIcon} />
                      Dividir vertical
                    </button>
                    <button
                      type="button"
                      className={`${styles.submitBtn} ${styles.btnWithIcon} ${styles.secondaryBtn}`}
                      onClick={() => handleSplitSelectedLote("lat")}
                      disabled={selectedLoteIds.length !== 1}
                    >
                      <Scissors size={16} className={styles.inlineIcon} />
                      Dividir horizontal
                    </button>
                  </div>
                </section>
              )}

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
                      editable={isLoteSelected(lote.id)}
                      draggable={isLoteSelected(lote.id)}
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

                        updateGeneratedLotes((prev) =>
                          prev.map((l) => (l.id === lote.id ? { ...l, coords } : l)),
                        );
                      }}
                      onClick={(event) => handleSelectLote(lote, event?.domEvent)}
                      options={{
                        strokeColor: isLoteSelected(lote.id)
                          ? "#dc2626"
                          : selectedLote === lote.id
                            ? "#2563eb"
                            : "#008000",
                        strokeWeight: isLoteSelected(lote.id) ? 3 : 2,
                        fillColor: isLoteSelected(lote.id)
                          ? "#fca5a5"
                          : selectedLote === lote.id
                            ? "#93c5fd"
                            : "#00ff00",
                        fillOpacity: isLoteSelected(lote.id) ? 0.6 : 0.45,
                        zIndex: isLoteSelected(lote.id) ? 12 : 10,
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
