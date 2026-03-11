import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polygon } from "@react-google-maps/api";
import loader from "../../../components/loader";
import styles from "./addproyect.module.css";

const defaultCenter = { lat: -6.4882, lng: -76.365629 };
const token = localStorage.getItem("access");

const normalizePoint = (p, index) => ({
  latitud: Number(p?.latitud),
  longitud: Number(p?.longitud),
  orden: Number(p?.orden ?? index + 1),
});

export default function EditProyectoModal({ onClose, proyecto, idinmobiliaria }) {
  const [isLoaded, setIsLoaded] = useState(() =>
    typeof window !== "undefined" && !!window.google?.maps?.Map,
  );
  const [loadError, setLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [existingImages, setExistingImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [baseMapStyle, setBaseMapStyle] = useState("roadmap");
  const [reliefEnabled, setReliefEnabled] = useState(false);
  const [labelsEnabled, setLabelsEnabled] = useState(true);

  const [form, setForm] = useState({
    idproyecto: proyecto?.idproyecto || "",
    idinmobiliaria,
    nombreproyecto: proyecto?.nombreproyecto || "",
    descripcion: proyecto?.descripcion || "",
    latitud: proyecto?.latitud || "",
    longitud: proyecto?.longitud || "",
    puntos: [],
    imagenes: [],
  });

  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const polygonListenersRef = useRef([]);
  const autocompleteRef = useRef(null);
  const fileInputRef = useRef(null);
  const puntosDirtyRef = useRef(false);

  const visibleExistingImages = useMemo(
    () =>
      existingImages.filter((img) => {
        const id = Number(img?.idimagenesp ?? img?.idimagenproyecto ?? img?.idimagen ?? img?.id);
        return Number.isFinite(id) ? !removedImageIds.includes(id) : true;
      }),
    [existingImages, removedImageIds],
  );

  const syncPuntosFromPolygon = useCallback(() => {
    const polygon = polygonRef.current;
    if (!polygon) return;
    const path = polygon.getPath();
    const updated = [];
    for (let i = 0; i < path.getLength(); i += 1) {
      updated.push({
        latitud: path.getAt(i).lat(),
        longitud: path.getAt(i).lng(),
        orden: i + 1,
      });
    }
    setForm((prev) => ({
      ...prev,
      puntos: updated,
      latitud: updated[0]?.latitud || "",
      longitud: updated[0]?.longitud || "",
    }));
    puntosDirtyRef.current = true;
  }, []);

  const getPolygonPoints = useCallback(() => {
    const polygon = polygonRef.current;
    if (!polygon) return form.puntos;
    const path = polygon.getPath();
    const updated = [];
    for (let i = 0; i < path.getLength(); i += 1) {
      updated.push({
        latitud: path.getAt(i).lat(),
        longitud: path.getAt(i).lng(),
        orden: i + 1,
      });
    }
    return updated;
  }, [form.puntos]);

  const clearPolygonListeners = () => {
    polygonListenersRef.current.forEach((listener) => {
      window.google?.maps?.event?.removeListener(listener);
    });
    polygonListenersRef.current = [];
  };

  const proyectoId = proyecto?.idproyecto;

  useEffect(() => {
    if (!proyectoId) return;
    let cancelled = false;
    puntosDirtyRef.current = false;

    const loadProyectoData = async () => {
      try {
        const [puntosRes, imagesRes] = await Promise.all([
          authFetch(
            withApiBase(
              `https://api.geohabita.com/api/listPuntosProyecto/${proyectoId}`,
            ),
          ),
          authFetch(
            withApiBase(
              `https://api.geohabita.com/api/list_imagen_proyecto/${proyectoId}`,
            ),
          ),
        ]);

        const puntosData = (await puntosRes.json()) || [];
        const imagesData = (await imagesRes.json()) || [];
        if (cancelled) return;

        const puntos = Array.isArray(puntosData)
          ? puntosData
              .map(normalizePoint)
              .filter((p) => !Number.isNaN(p.latitud) && !Number.isNaN(p.longitud))
              .sort((a, b) => a.orden - b.orden)
          : [];

        setForm((prev) => ({
          ...prev,
          idproyecto: proyectoId,
          idinmobiliaria,
          nombreproyecto: proyecto?.nombreproyecto || "",
          descripcion: proyecto?.descripcion || "",
          puntos: puntosDirtyRef.current ? prev.puntos : puntos,
          latitud: puntosDirtyRef.current
            ? prev.latitud
            : puntos[0]?.latitud || proyecto?.latitud || "",
          longitud: puntosDirtyRef.current
            ? prev.longitud
            : puntos[0]?.longitud || proyecto?.longitud || "",
        }));
        setExistingImages(Array.isArray(imagesData) ? imagesData : []);
        setRemovedImageIds([]);
      } catch (err) {
        console.error("Error cargando datos del proyecto:", err);
      }
    };

    loadProyectoData();
    return () => {
      cancelled = true;
    };
  }, [proyectoId, idinmobiliaria]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (window.google?.maps?.Map) {
      setIsLoaded(true);
    } else {
      loader
        .load()
        .then(() => setIsLoaded(true))
        .catch((err) => {
          console.error("Error cargando Google Maps:", err);
          setLoadError(true);
        });
    }
    return () => {
      document.body.style.overflow = "auto";
      clearPolygonListeners();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !window.google) return;
    const input = document.getElementById("autocomplete-edit-proyecto");
    if (!input || !window.google.maps?.places?.Autocomplete) return;

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      fields: ["geometry", "name", "formatted_address"],
    });
    autocompleteRef.current = autocomplete;

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place?.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(17);
      setForm((prev) => ({ ...prev, latitud: lat, longitud: lng }));
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isLoaded]);

  const applyMapType = useCallback(
    (map, baseStyle, labels, relief) => {
      if (!map) return;
      if (baseStyle === "satellite") {
        map.setMapTypeId(labels ? "hybrid" : "satellite");
        return;
      }
      map.setMapTypeId(relief ? "terrain" : "roadmap");
    },
    [],
  );

  useEffect(() => {
    applyMapType(mapRef.current, baseMapStyle, labelsEnabled, reliefEnabled);
  }, [applyMapType, baseMapStyle, labelsEnabled, reliefEnabled]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const latestPuntos = getPolygonPoints();
    setForm((prev) => ({
      ...prev,
      [name]: value,
      puntos: latestPuntos,
      latitud: latestPuntos[0]?.latitud || prev.latitud,
      longitud: latestPuntos[0]?.longitud || prev.longitud,
    }));
  };

  const handleMapClick = (e) => {
    if (!isDrawing) return;
    const newPoint = {
      latitud: e.latLng.lat(),
      longitud: e.latLng.lng(),
      orden: form.puntos.length + 1,
    };
    setForm((prev) => ({
      ...prev,
      puntos: [...prev.puntos, newPoint],
      latitud: prev.puntos.length === 0 ? newPoint.latitud : prev.latitud,
      longitud: prev.puntos.length === 0 ? newPoint.longitud : prev.longitud,
    }));
    puntosDirtyRef.current = true;
  };

  const clearPolygon = () => {
    setForm((prev) => ({ ...prev, puntos: [] }));
    setIsDrawing(true);
    puntosDirtyRef.current = true;
  };

  const undoLastPoint = () => {
    setForm((prev) => ({ ...prev, puntos: prev.puntos.slice(0, -1) }));
    puntosDirtyRef.current = true;
  };

  const onPolygonLoad = (polygon) => {
    clearPolygonListeners();
    polygonRef.current = polygon;
    const path = polygon.getPath();
    polygonListenersRef.current = [
      window.google.maps.event.addListener(path, "insert_at", syncPuntosFromPolygon),
      window.google.maps.event.addListener(path, "remove_at", syncPuntosFromPolygon),
      window.google.maps.event.addListener(path, "set_at", syncPuntosFromPolygon),
    ];
  };

  const onPolygonUnmount = () => {
    clearPolygonListeners();
    polygonRef.current = null;
  };

  const handleImagenesChange = (e) => {
    const files = Array.from(e.target.files || []).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setForm((prev) => ({ ...prev, imagenes: [...prev.imagenes, ...files] }));
    e.target.value = "";
  };

  const removeNewImage = (index) => {
    const images = [...form.imagenes];
    URL.revokeObjectURL(images[index]?.preview);
    images.splice(index, 1);
    setForm((prev) => ({ ...prev, imagenes: images }));
  };

  const removeExistingImage = (image) => {
    const id = Number(image?.idimagenesp ?? image?.idimagenproyecto ?? image?.idimagen ?? image?.id);
    if (!Number.isFinite(id)) {
      setExistingImages((prev) => prev.filter((img) => img !== image));
      return;
    }
    setRemovedImageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const latestPuntos = getPolygonPoints();
    if (latestPuntos.length < 3) {
      alert("El polígono debe tener al menos 3 puntos.");
      return;
    }

    setIsSubmitting(true);
    try {
      setForm((prev) => ({
        ...prev,
        puntos: latestPuntos,
        latitud: latestPuntos[0]?.latitud || prev.latitud,
        longitud: latestPuntos[0]?.longitud || prev.longitud,
      }));
      const formData = new FormData();
      formData.append("idinmobiliaria", idinmobiliaria);
      formData.append("nombreproyecto", form.nombreproyecto);
      formData.append("descripcion", form.descripcion);
      formData.append("latitud", latestPuntos[0]?.latitud ?? form.latitud);
      formData.append("longitud", latestPuntos[0]?.longitud ?? form.longitud);
      formData.append("puntos", JSON.stringify(latestPuntos));
      formData.append("imagenes_eliminadas", JSON.stringify(removedImageIds));

      form.imagenes.forEach((img) => {
        if (img?.file) formData.append("imagenes", img.file);
      });

      const res = await authFetch(
        withApiBase(`https://api.geohabita.com/api/updateProyecto/${form.idproyecto}/`),
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      if (res.ok) {
        alert("Proyecto actualizado con éxito");
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Error actualizando proyecto:", err);
        alert("Error al actualizar proyecto");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) return <div className={styles.loaderMsg}>Error de mapa</div>;
  if (!isLoaded) return <div className={styles.loaderMsg}>Cargando...</div>;

  const center =
    form.puntos.length > 0
      ? { lat: Number(form.puntos[0].latitud), lng: Number(form.puntos[0].longitud) }
      : form.latitud && form.longitud
        ? { lat: Number(form.latitud), lng: Number(form.longitud) }
        : defaultCenter;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Editar Proyecto Inmobiliario</h1>
            <p className={styles.subtitle}>
              Actualiza datos del proyecto, imágenes y área del polígono.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          <div className={styles.gridContainer}>
            <div className={styles.leftColumn}>
              <section>
                <h2 className={styles.sectionTitle}>
                  <span className="material-icons-outlined">edit_note</span>
                  Información
                </h2>

                <div className={styles.inputGroup}>
                  <label>Nombre</label>
                  <input
                    name="nombreproyecto"
                    value={form.nombreproyecto}
                    onChange={handleChange}
                    className={`${styles.input} ${styles.primaryCompactInput}`}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Descripción</label>
                  <textarea
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    className={`${styles.textarea} ${styles.primaryCompactTextarea}`}
                    rows="3"
                    required
                  />
                </div>
              </section>

              <section>
                <h2 className={styles.sectionTitle}>
                  <span className="material-icons-outlined">collections</span>
                  Imágenes
                </h2>

                <p className={styles.imageSectionLabel}>Imágenes actuales</p>
                {visibleExistingImages.length === 0 ? (
                  <p className={styles.noExistingImages}>No hay imágenes actuales.</p>
                ) : (
                  <div className={styles.existingImagesGrid}>
                    {visibleExistingImages.map((img, i) => {
                      const src = withApiBase(
                        `https://api.geohabita.com${img.imagenproyecto || img.imagen || ""}`,
                      );
                      const key = img.idimagenesp || img.idimagenproyecto || img.idimagen || img.id || i;
                      return (
                        <div className={styles.existingImageItem} key={key}>
                          <img src={src} alt={`Actual ${i + 1}`} />
                          <button
                            type="button"
                            className={styles.removeThumbnail}
                            onClick={() => removeExistingImage(img)}
                            title="Quitar imagen actual"
                          >
                            <span className="material-icons-outlined">close</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={styles.uploadSection} style={{ marginTop: "0.7rem" }}>
                  <div
                    className={styles.uploadBox}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="material-icons-outlined">add_photo_alternate</span>
                    <p>Agregar imágenes nuevas</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="image/*"
                      onChange={handleImagenesChange}
                      hidden
                    />
                  </div>

                  {form.imagenes.length > 0 && (
                    <div className={styles.thumbnailGrid}>
                      {form.imagenes.map((img, i) => (
                        <div key={i} className={styles.thumbnailItem}>
                          <img src={img.preview} alt={`Nueva ${i + 1}`} />
                          <button
                            type="button"
                            className={styles.removeThumbnail}
                            onClick={() => removeNewImage(i)}
                          >
                            <span className="material-icons-outlined">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className={styles.rightColumn}>
              <h2 className={styles.sectionTitle}>
                <span className="material-icons-outlined">map</span>
                Ubicación y Polígono
              </h2>

              <div className={styles.mapWrapper}>
                <div className={styles.searchWrapper}>
                  <input
                    id="autocomplete-edit-proyecto"
                    type="text"
                    placeholder="Buscar ubicación..."
                    className={styles.mapSearchInput}
                  />
                </div>

                <GoogleMap
                  mapContainerClassName={styles.googleMap}
                  center={center}
                  zoom={14}
                  onLoad={(map) => {
                    mapRef.current = map;
                    applyMapType(map, baseMapStyle, labelsEnabled, reliefEnabled);
                  }}
                  onClick={handleMapClick}
                  options={{
                    disableDefaultUI: false,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                    gestureHandling: "greedy",
                  }}
                >
                  {form.puntos.length > 0 && (
                    <Polygon
                      onLoad={onPolygonLoad}
                      onUnmount={onPolygonUnmount}
                      paths={form.puntos.map((p) => ({
                        lat: Number(p.latitud),
                        lng: Number(p.longitud),
                      }))}
                      options={{
                        fillColor: "#1E40AF",
                        fillOpacity: 0.3,
                        strokeColor: "#1E40AF",
                        strokeWeight: 3,
                        editable: true,
                        draggable: false,
                      }}
                    />
                  )}

                  {form.puntos.map((p, idx) => (
                    <Marker
                      key={idx}
                      position={{ lat: Number(p.latitud), lng: Number(p.longitud) }}
                      label={`${idx + 1}`}
                    />
                  ))}

                  <div className={styles.mapControls}>
                    <button
                      type="button"
                      className={`${styles.mapBtn} ${isDrawing ? styles.mapBtnActive : ""}`}
                      onClick={() => setIsDrawing((prev) => !prev)}
                      title={isDrawing ? "Finalizar dibujo" : "Agregar puntos"}
                    >
                      <span className="material-icons-outlined">
                        {isDrawing ? "check_circle" : "edit_location_alt"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.mapBtn}
                      onClick={undoLastPoint}
                      disabled={form.puntos.length === 0}
                      title="Deshacer último punto"
                    >
                      <span className="material-icons-outlined">undo</span>
                    </button>
                    <button
                      type="button"
                      className={styles.mapBtn}
                      onClick={clearPolygon}
                      disabled={form.puntos.length === 0}
                      title="Eliminar polígono"
                    >
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                </GoogleMap>
                <div className={styles.mapTypeControlWrap}>
                  <div className={styles.mapTypeTabs} aria-label="Tipo de mapa">
                    <button
                      type="button"
                      className={`${styles.mapTypeBtn} ${baseMapStyle === "roadmap" ? styles.mapTypeBtnActive : ""}`}
                      onClick={() => setBaseMapStyle("roadmap")}
                      aria-pressed={baseMapStyle === "roadmap"}
                    >
                      Mapa
                    </button>
                    <button
                      type="button"
                      className={`${styles.mapTypeBtn} ${baseMapStyle === "satellite" ? styles.mapTypeBtnActive : ""}`}
                      onClick={() => setBaseMapStyle("satellite")}
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
                            onClick={() => setLabelsEnabled(true)}
                            aria-pressed={labelsEnabled}
                          >
                            On
                          </button>
                          <button
                            type="button"
                            className={`${styles.mapTypeSubBtn} ${!labelsEnabled ? styles.mapTypeSubBtnActive : ""}`}
                            onClick={() => setLabelsEnabled(false)}
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
                            onClick={() => setReliefEnabled(true)}
                            aria-pressed={reliefEnabled}
                          >
                            On
                          </button>
                          <button
                            type="button"
                            className={`${styles.mapTypeSubBtn} ${!reliefEnabled ? styles.mapTypeSubBtnActive : ""}`}
                            onClick={() => setReliefEnabled(false)}
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

              <p className={styles.mapHint}>
                Arrastra vértices para ajustar el polígono. También puedes activar
                el modo dibujo para agregar puntos nuevos.
              </p>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              <span className="material-icons-outlined">save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
