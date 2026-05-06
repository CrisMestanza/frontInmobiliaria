import { withApiBase } from "../../../../config/api.js";
import { authFetch } from "../../../../config/authFetch.js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import { X, MapPinned, Save, Trash2, Undo2, Plus, Shapes } from "lucide-react";
import { usePdfOverlay } from "../../../../components/hooks/usePdfOverlay.js";
import styles from "./EspaciosModal.module.css";

const defaultCenter = { lat: -6.4882, lng: -76.365629 };
const GOOGLE_MAPS_LIBRARIES = ["drawing", "places", "geometry"];
const GOOGLE_MAPS_API_KEY = "AIzaSyA0dsaDHTO3rx48cyq61wbhItaZ_sWcV94";

const normalizePolygonCoords = (coords = []) => {
  const normalized = coords
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
  if (hasOrder) {
    return normalized
      .sort((a, b) => Number(a.orden) - Number(b.orden))
      .map((p) => ({ lat: p.lat, lng: p.lng }));
  }

  const center = normalized.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  center.lat /= normalized.length;
  center.lng /= normalized.length;

  return normalized
    .sort((a, b) => {
      const angleA = Math.atan2(a.lat - center.lat, a.lng - center.lng);
      const angleB = Math.atan2(b.lat - center.lat, b.lng - center.lng);
      return angleA - angleB;
    })
    .map((p) => ({ lat: p.lat, lng: p.lng }));
};

const normalizeSpace = (space) => ({
  ...space,
  polygon: normalizePolygonCoords(space?.puntos || []),
});

const getSpaceColor = (space) => {
  const raw = space?.tipoespacio?.color;
  return typeof raw === "string" && raw.trim() ? raw : "#22c55e";
};

const getSpaceKind = (space) =>
  String(space?.tipoespacio?.slug || space?.tipoespacio?.nombre || "")
    .toLowerCase()
    .trim();

const getSpacePolygonStyle = (space, isActive = false) => {
  const color = getSpaceColor(space);
  const kind = getSpaceKind(space);

  if (
    kind.includes("parque") ||
    kind.includes("area-verde") ||
    kind.includes("área verde")
  ) {
    return {
      fillColor: color,
      fillOpacity: isActive ? 0.3 : 0.24,
      strokeColor: "#166534",
      strokeWeight: isActive ? 3 : 2.3,
      zIndex: isActive ? 7 : 5,
    };
  }

  return {
    fillColor: color,
    fillOpacity: isActive ? 0.28 : 0.2,
    strokeColor: color,
    strokeWeight: isActive ? 3 : 2,
    zIndex: isActive ? 7 : 5,
  };
};

export default function EspaciosModal({ onClose, idproyecto }) {
  const token = localStorage.getItem("access");
  const googleRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const polygonListenersRef = useRef([]);
  const {
    isLoaded: apiLoaded,
    loadError,
  } = useJsApiLoader({
    id: "espacios-modal-map",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [tipos, setTipos] = useState([]);
  const [projectCoords, setProjectCoords] = useState([]);
  const [lotesCoords, setLotesCoords] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [form, setForm] = useState({
    idespacio: null,
    idtipoespacio: "",
    nombre: "",
    descripcion: "",
    visible_mapa: 1,
    destacado: 0,
    puntos: [],
  });

  const mapsReady =
    apiLoaded && typeof window !== "undefined" && typeof window.google?.maps?.Map === "function";

  const { loadSavedPDF } = usePdfOverlay(idproyecto, googleRef, mapRef, mapsReady);

  const center = useMemo(() => {
    if (form.puntos.length > 0) return form.puntos[0];
    if (projectCoords.length > 0) return projectCoords[0];
    return defaultCenter;
  }, [form.puntos, projectCoords]);

  const clearPolygonListeners = useCallback(() => {
    polygonListenersRef.current.forEach((listener) => {
      window.google?.maps?.event?.removeListener(listener);
    });
    polygonListenersRef.current = [];
  }, []);

  const syncPuntosFromPolygon = useCallback(() => {
    const polygon = polygonRef.current;
    if (!polygon) return;
    const path = polygon.getPath();
    const updated = [];
    for (let i = 0; i < path.getLength(); i += 1) {
      updated.push({
        lat: path.getAt(i).lat(),
        lng: path.getAt(i).lng(),
      });
    }
    setForm((prev) => ({ ...prev, puntos: updated }));
  }, []);

  const handlePolygonLoad = useCallback(
    (polygon) => {
      clearPolygonListeners();
      polygonRef.current = polygon;
      const path = polygon.getPath();
      polygonListenersRef.current = [
        window.google.maps.event.addListener(path, "insert_at", syncPuntosFromPolygon),
        window.google.maps.event.addListener(path, "remove_at", syncPuntosFromPolygon),
        window.google.maps.event.addListener(path, "set_at", syncPuntosFromPolygon),
      ];
    },
    [clearPolygonListeners, syncPuntosFromPolygon],
  );

  const resetForm = useCallback(() => {
    setForm({
      idespacio: null,
      idtipoespacio: "",
      nombre: "",
      descripcion: "",
      visible_mapa: 1,
      destacado: 0,
      puntos: [],
    });
    setIsDrawing(false);
  }, []);

  const handleSelectSpace = useCallback((space) => {
    setForm({
      idespacio: space.idespacio,
      idtipoespacio: String(space?.tipoespacio?.idtipoespacio || ""),
      nombre: space.nombre || "",
      descripcion: space.descripcion || "",
      visible_mapa: Number(space.visible_mapa ?? 1),
      destacado: Number(space.destacado ?? 0),
      puntos: (space.polygon || []).map((p) => ({ lat: p.lat, lng: p.lng })),
    });
    setIsDrawing(false);
    if (mapRef.current && space.polygon?.length && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      space.polygon.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [detailRes, tiposRes, spacesRes] = await Promise.all([
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/mapa/proyecto_detalle/${idproyecto}/`,
          ),
        ),
        authFetch(withApiBase("https://api.geohabita.com/api/list_tipos_espacio/")),
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/list_espacios_proyecto/${idproyecto}/?include_hidden=1`,
          ),
        ),
      ]);

      const detail = detailRes.ok ? await detailRes.json() : {};
      const tiposData = tiposRes.ok ? await tiposRes.json() : [];
      const spacesData = spacesRes.ok ? await spacesRes.json() : [];

      const normalizedSpaces = Array.isArray(spacesData)
        ? spacesData.map(normalizeSpace)
        : [];
      const normalizedLotes = Array.isArray(detail?.lotes)
        ? detail.lotes
            .map((lote) => ({
              ...lote,
              polygon: normalizePolygonCoords(lote.puntos || []),
            }))
            .filter((lote) => lote.polygon.length >= 3)
        : [];

      setProjectCoords(normalizePolygonCoords(detail?.puntos || []));
      setLotesCoords(normalizedLotes);
      setSpaces(normalizedSpaces);
      setTipos(Array.isArray(tiposData) ? tiposData : []);
    } catch (error) {
      console.error("Error cargando espacios:", error);
    } finally {
      setLoading(false);
    }
  }, [idproyecto]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
      clearPolygonListeners();
    };
  }, [clearPolygonListeners]);

  useEffect(() => {
    if (!mapsReady) return;
    googleRef.current = window.google;
    fetchData();
    loadSavedPDF();
  }, [fetchData, mapsReady, loadSavedPDF]);

  const handleMapClick = (e) => {
    if (!isDrawing) return;
    const nextPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setForm((prev) => ({ ...prev, puntos: [...prev.puntos, nextPoint] }));
  };

  const handleUndo = () => {
    setForm((prev) => ({ ...prev, puntos: prev.puntos.slice(0, -1) }));
  };

  const handleClear = () => {
    setForm((prev) => ({ ...prev, puntos: [] }));
  };

  const drawPointCount = form.puntos.length;
  const canSaveSpace =
    Boolean(form.idtipoespacio) && Boolean(form.nombre.trim()) && drawPointCount >= 3;
  const areaPreviewM2 = useMemo(() => {
    if (!mapsReady || drawPointCount < 3 || !window.google?.maps?.geometry?.spherical) {
      return 0;
    }
    const area = window.google.maps.geometry.spherical.computeArea(
      form.puntos.map((point) => new window.google.maps.LatLng(point.lat, point.lng)),
    );
    return Number.isFinite(area) ? area : 0;
  }, [drawPointCount, form.puntos, mapsReady]);
  const drawStatusText = isDrawing
    ? drawPointCount === 0
      ? "Haz clic en el mapa para colocar el primer punto."
      : drawPointCount < 3
        ? `Llevas ${drawPointCount} punto${drawPointCount === 1 ? "" : "s"}. Necesitas al menos 3 para cerrar el espacio.`
        : `Polígono listo con ${drawPointCount} puntos. Puedes ajustar los vértices o guardar.`
    : "Activa Dibujar para empezar a trazar el espacio sobre el mapa.";

  const handleSave = async () => {
    if (!form.idtipoespacio || !form.nombre.trim() || form.puntos.length < 3) {
      window.alertInfo?.("Completa tipo, nombre y polígono del espacio.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        idproyecto,
        idtipoespacio: Number(form.idtipoespacio),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        visible_mapa: Number(form.visible_mapa),
        destacado: Number(form.destacado),
        puntos: form.puntos.map((p, index) => ({
          latitud: p.lat,
          longitud: p.lng,
          orden: index + 1,
        })),
      };

      const url = form.idespacio
        ? withApiBase(
            `https://api.geohabita.com/api/update_espacio/${form.idespacio}/`,
          )
        : withApiBase("https://api.geohabita.com/api/register_espacio/");

      const res = await authFetch(url, {
        method: form.idespacio ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        console.error("Error guardando espacio:", error);
        window.alertError?.("No se pudo guardar el espacio.");
        return;
      }
      window.alertSuccess?.("Espacio guardado.");
      resetForm();
      setHasChanges(true);
      fetchData();
    } catch (error) {
      console.error(error);
      window.alertError?.("Error de red al guardar el espacio.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.idespacio) return;
    const ok = window.confirm("¿Eliminar este espacio?");
    if (!ok) return;
    try {
      const res = await authFetch(
        withApiBase(`https://api.geohabita.com/api/delete_espacio/${form.idespacio}/`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        window.alertError?.("No se pudo eliminar el espacio.");
        return;
      }
      window.alertSuccess?.("Espacio eliminado.");
      resetForm();
      setHasChanges(true);
      fetchData();
    } catch (error) {
      console.error(error);
      window.alertError?.("Error de red al eliminar el espacio.");
    }
  };

  if (loadError) {
    return <div className={styles.modalOverlay}>Error cargando mapa.</div>;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button
          className={styles.closeBtn}
          onClick={() => onClose?.({ refreshed: hasChanges })}
        >
          <X size={18} />
        </button>
        <div className={styles.header}>
          <div>
            <h2>Espacios del Proyecto</h2>
            <p>Traza parques, colegios, áreas verdes y demás espacios del masterplan.</p>
          </div>
        </div>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sectionHead}>
              <Shapes size={16} />
              <strong>Espacios existentes</strong>
            </div>
            <div className={styles.spaceList}>
              {spaces.map((space) => (
                <button
                  type="button"
                  key={space.idespacio}
                  className={`${styles.spaceItem} ${form.idespacio === space.idespacio ? styles.spaceItemActive : ""}`}
                  onClick={() => handleSelectSpace(space)}
                >
                  <span
                    className={styles.spaceSwatch}
                    style={{ background: getSpaceColor(space) }}
                  />
                  <div className={styles.spaceMeta}>
                    <strong>{space.nombre}</strong>
                    <small>
                      {space.tipoespacio?.nombre || "Espacio"} · {space.area_m2 || 0} m²
                    </small>
                  </div>
                </button>
              ))}
              {!spaces.length && !loading && (
                <p className={styles.emptyState}>Aún no hay espacios registrados.</p>
              )}
            </div>
            {!!spaces.length && (
              <p className={styles.spaceHint}>
                {spaces.filter((space) => Number(space.visible_mapa) === 1).length} visibles
                en mapa · {spaces.length} registrados
              </p>
            )}
            <div className={styles.formSection}>
              <div className={styles.sectionHead}>
                <MapPinned size={16} />
                <strong>{form.idespacio ? "Editar espacio" : "Nuevo espacio"}</strong>
              </div>
              <label>
                Tipo
                <select
                  value={form.idtipoespacio}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, idtipoespacio: e.target.value }))
                  }
                >
                  <option value="">Selecciona un tipo</option>
                  {tipos.map((tipo) => (
                    <option key={tipo.idtipoespacio} value={tipo.idtipoespacio}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nombre
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Ej. Parque Central"
                />
              </label>
              <label>
                Descripción
                <textarea
                  rows="3"
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  placeholder="Opcional"
                />
              </label>
              <div className={styles.inlineOptions}>
                <label className={styles.inlineCheck}>
                  <input
                    type="checkbox"
                    checked={Number(form.visible_mapa) === 1}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        visible_mapa: e.target.checked ? 1 : 0,
                      }))
                    }
                  />
                  Visible
                </label>
                <label className={styles.inlineCheck}>
                  <input
                    type="checkbox"
                    checked={Number(form.destacado) === 1}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        destacado: e.target.checked ? 1 : 0,
                      }))
                    }
                  />
                  Destacado
                </label>
              </div>
              <p className={styles.optionHint}>
                <strong>Visible</strong>: aparece en el mapa público del proyecto.
                <br />
                <strong>Destacado</strong>: se prioriza visualmente dentro del proyecto
                y ayuda a resaltarlo frente a otros espacios.
              </p>
              <div className={styles.areaPreviewCard}>
                <span>Área calculada automáticamente</span>
                <strong>
                  {areaPreviewM2 > 0
                    ? `${areaPreviewM2.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} m²`
                    : "Traza 3 puntos o más para calcular"}
                </strong>
              </div>
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${isDrawing ? styles.actionBtnActive : ""}`}
                  onClick={() => setIsDrawing((prev) => !prev)}
                >
                  <Plus size={16} />
                  {isDrawing ? "Dibujando" : "Dibujar"}
                </button>
                <button type="button" className={styles.actionBtn} onClick={handleUndo}>
                  <Undo2 size={16} />
                  Deshacer
                </button>
                <button type="button" className={styles.actionBtn} onClick={handleClear}>
                  <Trash2 size={16} />
                  Limpiar
                </button>
              </div>
              <p className={styles.drawHint}>{drawStatusText}</p>
              <div className={styles.footerActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    resetForm();
                    setIsDrawing(true);
                  }}
                >
                  Nuevo
                </button>
                {form.idespacio ? (
                  <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
                    Eliminar
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={saving || !canSaveSpace}
                >
                  <Save size={16} />
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </aside>

          <div className={styles.mapWrap}>
            {mapsReady ? (
              <GoogleMap
                mapContainerClassName={styles.map}
                center={center}
                zoom={17}
                onLoad={(map) => {
                  mapRef.current = map;
                  if (projectCoords.length && window.google?.maps) {
                    const bounds = new window.google.maps.LatLngBounds();
                    projectCoords.forEach((p) => bounds.extend(p));
                    map.fitBounds(bounds);
                  }
                }}
                onClick={handleMapClick}
                options={{
                  gestureHandling: "greedy",
                  streetViewControl: false,
                  mapTypeControl: true,
                  fullscreenControl: true,
                }}
              >
                {projectCoords.length > 0 && (
                  <Polygon
                    paths={projectCoords}
                    options={{
                      fillColor: "#1d4ed8",
                      fillOpacity: 0.08,
                      strokeColor: "#1d4ed8",
                      strokeWeight: 2.2,
                      clickable: false,
                      zIndex: 2,
                    }}
                  />
                )}
                {lotesCoords.map((lote) => (
                  <Polygon
                    key={`lote-${lote.idlote}`}
                    paths={lote.polygon}
                    options={{
                      fillColor:
                        Number(lote.vendido) === 1
                          ? "#ef4444"
                          : Number(lote.vendido) === 2
                            ? "#f59e0b"
                            : "#22c55e",
                      fillOpacity: 0.12,
                      strokeColor: "#334155",
                      strokeWeight: 1,
                      clickable: false,
                      zIndex: 3,
                    }}
                  />
                ))}
                {spaces
                  .filter((space) => space.idespacio !== form.idespacio)
                  .map((space) => (
                    <Polygon
                      key={`space-${space.idespacio}`}
                      paths={space.polygon}
                      options={getSpacePolygonStyle(space)}
                      onClick={() => handleSelectSpace(space)}
                    />
                  ))}
                {form.puntos.length > 0 && (
                  <Polygon
                    onLoad={handlePolygonLoad}
                    onUnmount={() => {
                      clearPolygonListeners();
                      polygonRef.current = null;
                    }}
                    paths={form.puntos}
                    options={{
                      ...getSpacePolygonStyle(
                        {
                          tipoespacio:
                            tipos.find(
                              (tipo) =>
                                String(tipo.idtipoespacio) === String(form.idtipoespacio),
                            ) || {},
                        },
                        true,
                      ),
                      editable: true,
                      draggable: false,
                    }}
                  />
                )}
                {form.puntos.map((point, index) => (
                  <Marker
                    key={`draft-point-${index}`}
                    position={point}
                    label={`${index + 1}`}
                  />
                ))}
              </GoogleMap>
            ) : null}
            {(loading || !mapsReady) && (
              <div className={styles.loadingOverlay}>
                {mapsReady ? "Cargando proyecto..." : "Cargando mapa..."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
