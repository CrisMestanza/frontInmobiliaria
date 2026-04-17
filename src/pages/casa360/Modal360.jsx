import React, { useEffect, useMemo, useRef, useState } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import {
  ImagePlus,
  Link2,
  MousePointerClick,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { authFetch } from "../../config/authFetch.js";
import { withApiBase } from "../../config/api.js";
import styles from "./modal360.module.css";

const MARKER_SIZE = { width: 34, height: 34 };
const buildApiUrl = (path) => withApiBase(`https://api.geohabita.com${path}`);
const normalizeImageUrl = (url) => {
  if (!url) return "";
  return url.startsWith("http") ? url : buildApiUrl(url);
};

const TEMP_MARKER_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <circle cx="17" cy="17" r="10" fill="#22c55e" fill-opacity="0.9"/>
  <circle cx="17" cy="17" r="4" fill="#ffffff"/>
  <circle cx="17" cy="17" r="15" fill="none" stroke="#22c55e" stroke-width="2" stroke-opacity="0.55"/>
</svg>
`)}`;

const HOTSPOT_MARKER_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <circle cx="17" cy="17" r="9" fill="#0f172a" fill-opacity="0.95"/>
  <circle cx="17" cy="17" r="3.5" fill="#86efac"/>
  <circle cx="17" cy="17" r="14" fill="none" stroke="#86efac" stroke-width="2" stroke-opacity="0.55"/>
</svg>
`)}`;

const createDraftImage = (file, nombre) => ({
  id_imagen: `draft-${crypto.randomUUID()}`,
  nombre: nombre?.trim() || file.name.replace(/\.[^.]+$/, ""),
  imagen: URL.createObjectURL(file),
  file,
  isDraft: true,
});

const removeTempMarker = (markers) => {
  if (!markers) return;
  try {
    markers.removeMarker("temp");
  } catch {
    // El marker temporal aun no existe.
  }
};

const makeMarkerPosition = (yaw, pitch) => ({ yaw, pitch });

const Modal360 = ({ idproyecto, onClose }) => {
  const [imagenes, setImagenes] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [selectedImg, setSelectedImg] = useState(null);
  const [coords, setCoords] = useState(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [newPointName, setNewPointName] = useState("");
  const [newPointFile, setNewPointFile] = useState(null);
  const [savingTour, setSavingTour] = useState(false);

  const viewerRef = useRef(null);
  const viewerInstance = useRef(null);
  const batchItemsRef = useRef([]);
  const imagenesRef = useRef([]);

  const existingDestinations = useMemo(() => {
    if (!selectedImg) return [];
    return imagenes.filter((img) => img.id_imagen !== selectedImg.id_imagen);
  }, [imagenes, selectedImg]);

  const conexionesActuales = useMemo(() => {
    if (!selectedImg) return [];
    return conexiones.filter((item) => item.origenId === selectedImg.id_imagen);
  }, [conexiones, selectedImg]);

  const hasValidCoords =
    Number.isFinite(coords?.yaw) && Number.isFinite(coords?.pitch);

  const resetPointMode = () => {
    setCoords(null);
    setNewPointName("");
    setNewPointFile(null);
    const markers = viewerInstance.current?.getPlugin(MarkersPlugin);
    removeTempMarker(markers);
  };

  const renderHotspots = () => {
    const viewer = viewerInstance.current;
    if (!viewer || !selectedImg) return;

    const markers = viewer.getPlugin(MarkersPlugin);
    markers.clearMarkers();

    conexionesActuales.forEach((hotspot) => {
      markers.addMarker({
        id: hotspot.id,
        image: HOTSPOT_MARKER_ICON,
        size: MARKER_SIZE,
        anchor: "center center",
        position: makeMarkerPosition(hotspot.yaw, hotspot.pitch),
        tooltip: hotspot.destinoNombre || "Ir",
        data: { destinoId: hotspot.destinoId },
      });
    });
  };

  useEffect(() => {
    batchItemsRef.current = batchItems;
  }, [batchItems]);

  useEffect(() => {
    imagenesRef.current = imagenes;
  }, [imagenes]);

  useEffect(() => {
    if (!selectedImg || !viewerRef.current) return undefined;

    setViewerReady(false);
    resetPointMode();

    const viewer = new Viewer({
      container: viewerRef.current,
      panorama: selectedImg.imagen,
      plugins: [[MarkersPlugin, {}]],
      navbar: ["zoom", "move", "caption", "fullscreen"],
      caption: `${selectedImg.nombre} · borrador local`,
      loadingImg: "https://geohabita.com/loading.gif",
    });

    viewerInstance.current = viewer;
    const markers = viewer.getPlugin(MarkersPlugin);

    viewer.addEventListener("click", ({ data }) => {
      const yaw = data?.yaw ?? data?.longitude;
      const pitch = data?.pitch ?? data?.latitude;

      if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) {
        return;
      }

      const punto = { yaw, pitch };

      setCoords(punto);
      removeTempMarker(markers);

      markers.addMarker({
        id: "temp",
        image: TEMP_MARKER_ICON,
        size: MARKER_SIZE,
        anchor: "center center",
        position: makeMarkerPosition(punto.yaw, punto.pitch),
        tooltip: "Nuevo punto",
      });
    });

    markers.addEventListener("select-marker", (event) => {
      const marker = event?.marker || event?.detail?.marker;
      if (!marker?.data?.destinoId) return;

      const destino = imagenes.find((img) => img.id_imagen === marker.data.destinoId);
      if (destino) {
        setSelectedImg(destino);
      }
    });

    viewer.addEventListener("ready", () => {
      setViewerReady(true);
      renderHotspots();
    });

    return () => {
      viewer.destroy();
      viewerInstance.current = null;
    };
  }, [selectedImg]);

  useEffect(() => {
    if (viewerReady) {
      renderHotspots();
    }
  }, [viewerReady, conexionesActuales]);

  const handleBatchFiles = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.target.files || []);
    const items = files.map((file) => ({
      file,
      nombre: file.name.replace(/\.[^.]+$/, ""),
      preview: URL.createObjectURL(file),
    }));

    setBatchItems((prev) => [...prev, ...items]);
    event.target.value = "";
  };

  const updateBatchItemName = (index, value) => {
    setBatchItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, nombre: value } : item)),
    );
  };

  const removeBatchItem = (index) => {
    setBatchItems((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const addBatchToDraft = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!batchItems.length) return;

    const nuevasImagenes = batchItems.map((item) => ({
      id_imagen: `draft-${crypto.randomUUID()}`,
      nombre: item.nombre?.trim() || item.file.name.replace(/\.[^.]+$/, ""),
      imagen: item.preview,
      file: item.file,
      isDraft: true,
    }));

    setImagenes((prev) => [...prev, ...nuevasImagenes]);
    setSelectedImg((prev) => prev || nuevasImagenes[0] || null);
    setBatchItems([]);
    window.alertInfo?.("Imagenes agregadas al borrador local. Aun no se enviaron al backend.");
  };

  const connectToExisting = (destino, event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!hasValidCoords || !selectedImg || !destino) return;

    setConexiones((prev) => [
      ...prev,
      {
        id: `hotspot-${crypto.randomUUID()}`,
        origenId: selectedImg.id_imagen,
        destinoId: destino.id_imagen,
        destinoNombre: destino.nombre,
        yaw: coords.yaw,
        pitch: coords.pitch,
      },
    ]);

    resetPointMode();
    window.alertSuccess?.("Conexion creada en el borrador local.");
  };

  const createAndConnectImage = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!hasValidCoords || !selectedImg || !newPointFile || !newPointName.trim()) return;

    const nuevaImagen = createDraftImage(newPointFile, newPointName);

    setImagenes((prev) => [...prev, nuevaImagen]);
    setConexiones((prev) => [
      ...prev,
      {
        id: `hotspot-${crypto.randomUUID()}`,
        origenId: selectedImg.id_imagen,
        destinoId: nuevaImagen.id_imagen,
        destinoNombre: nuevaImagen.nombre,
        yaw: coords.yaw,
        pitch: coords.pitch,
      },
    ]);

    resetPointMode();
    setSelectedImg(nuevaImagen);
    window.alertSuccess?.("Nueva vista creada y conectada en el borrador local.");
  };

  const saveTourToBackend = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!imagenes.length) {
      window.alertInfo?.("Agrega al menos una imagen 360 antes de subir el tour.");
      return;
    }

    const draftImages = imagenes.filter((img) => img.isDraft && img.file);
    if (!draftImages.length) {
      window.alertInfo?.("No hay imagenes nuevas para subir.");
      return;
    }

    const formData = new FormData();
    formData.append("idproyecto", idproyecto);

    draftImages.forEach((img) => {
      formData.append("draft_ids", img.id_imagen);
      formData.append("nombres", img.nombre);
      formData.append("imagenes", img.file);
    });

    formData.append(
      "conexiones",
      JSON.stringify(
        conexiones.map((conexion) => ({
          origenId: conexion.origenId,
          destinoId: conexion.destinoId,
          destinoNombre: conexion.destinoNombre,
          yaw: conexion.yaw,
          pitch: conexion.pitch,
        })),
      ),
    );

    setSavingTour(true);
    try {
      const res = await authFetch(buildApiUrl("/api/guardar_tour_360_completo/"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar el tour 360");
      }

      const imageMap = data.image_map || {};
      const savedImagesByDraft = new Map(
        (data.imagenes || []).map((img) => [img.draft_id, img]),
      );

      setImagenes((prev) =>
        prev.map((img) => {
          const saved = savedImagesByDraft.get(img.id_imagen);
          if (!saved) return img;
          return {
            ...img,
            id_imagen: saved.id_imagen,
            imagen: normalizeImageUrl(saved.imagen),
            isDraft: false,
            file: null,
          };
        }),
      );

      setConexiones((prev) =>
        prev.map((conexion) => ({
          ...conexion,
          origenId: imageMap[conexion.origenId] || conexion.origenId,
          destinoId: imageMap[conexion.destinoId] || conexion.destinoId,
        })),
      );

      setSelectedImg((prev) => {
        if (!prev) return prev;
        const saved = savedImagesByDraft.get(prev.id_imagen);
        if (!saved) return prev;
        return {
          ...prev,
          id_imagen: saved.id_imagen,
          imagen: normalizeImageUrl(saved.imagen),
          isDraft: false,
          file: null,
        };
      });

      window.alertSuccess?.("Tour 360 guardado en el backend correctamente.");
    } catch (error) {
      console.error(error);
      window.alertError?.(error.message || "No se pudo guardar el tour 360.");
    } finally {
      setSavingTour(false);
    }
  };

  useEffect(() => {
    return () => {
      batchItemsRef.current.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
      imagenesRef.current.forEach((img) => {
        if (img.isDraft && img.imagen?.startsWith("blob:")) {
          URL.revokeObjectURL(img.imagen);
        }
      });
    };
  }, []);

  return (
    <div
      className={styles.modalOverlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={styles.modalContent360}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-360-title"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="modal-360-title">
              Tour 360 <span>#{idproyecto}</span>
            </h2>
            <p className={styles.headerText}>
              Editor en frontend: todo se queda en borrador local hasta conectar el backend.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar modal 360"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.workspace}>
            <aside className={styles.sidebar}>
              <div className={styles.sidebarSection}>
                <div className={styles.sectionTitleRow}>
                  <ImagePlus size={16} />
                  <h3>Imagenes del borrador</h3>
                </div>

                <label className={styles.btnAddFiles}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBatchFiles}
                    className={styles.hiddenInput}
                  />
                  <Upload size={20} />
                  <strong>Agregar imagenes 360</strong>
                  <span>Primero se guardan en el frontend, no en la base de datos.</span>
                </label>

                {!!batchItems.length && (
                  <div className={styles.itemsList}>
                    {batchItems.map((item, index) => (
                      <div className={styles.itemRow} key={`${item.file.name}-${index}`}>
                        <img src={item.preview} alt={item.nombre} className={styles.queueThumb} />
                        <input
                          value={item.nombre}
                          onChange={(event) => updateBatchItemName(index, event.target.value)}
                          className={styles.inputName}
                          placeholder="Nombre de la vista"
                        />
                        <button
                          type="button"
                          className={styles.btnDel}
                          onClick={() => removeBatchItem(index)}
                          aria-label="Quitar imagen"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.btnPrimary360}
                      onClick={addBatchToDraft}
                    >
                      <Plus size={16} />
                      Guardar en borrador
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.sidebarSection}>
                <div className={styles.sectionTitleRow}>
                  <MousePointerClick size={16} />
                  <h3>Galeria</h3>
                </div>

                {!imagenes.length ? (
                  <div className={styles.emptyState}>Aun no hay imagenes en el borrador.</div>
                ) : (
                  <div className={styles.galleryList}>
                    {imagenes.map((img) => (
                      <button
                        key={img.id_imagen}
                        type="button"
                        className={`${styles.galleryItem} ${selectedImg?.id_imagen === img.id_imagen ? styles.activeItem : ""}`}
                        onClick={() => setSelectedImg(img)}
                      >
                        <img src={img.imagen} alt={img.nombre} className={styles.galleryThumb} />
                        <div className={styles.galleryMeta}>
                          <strong>{img.nombre}</strong>
                          <span>{img.isDraft ? "Borrador local" : "Sincronizada"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!!imagenes.length && (
                  <div className={styles.helperBox}>
                    {imagenes.length === 1
                      ? "Ya tienes la primera vista en borrador. Agrega una segunda para empezar a crear conexiones."
                      : "Selecciona una vista, haz click en el visor y conecta ese punto con otra imagen del borrador."}
                  </div>
                )}
              </div>
            </aside>

            <section className={styles.viewerSection}>
              {selectedImg ? (
                <>
                  <div className={styles.viewerToolbar}>
                    <div>
                      <span className={styles.viewerBadge}>Vista activa</span>
                      <h3>{selectedImg.nombre}</h3>
                    </div>
                    <p>Haz click dentro de la imagen para crear un punto en este borrador.</p>
                  </div>
                  {imagenes.length < 2 && (
                    <div className={styles.helperBox}>
                      Necesitas al menos 2 imagenes en el borrador para crear una conexion entre vistas.
                    </div>
                  )}
                  <div className={styles.viewerFrame}>
                    {!viewerReady && <div className={styles.viewerLoading}>Cargando visor...</div>}
                    <div ref={viewerRef} className={styles.viewerCanvas} />
                  </div>
                </>
              ) : (
                <div className={styles.viewerPlaceholder}>
                  <ImagePlus size={34} />
                  <h3>Selecciona o agrega una imagen 360</h3>
                  <p>La vista elegida aparecera aqui para que puedas crear hotspots en local.</p>
                </div>
              )}
            </section>

            <aside className={styles.connectionPanel}>
              <div className={styles.sectionTitleRow}>
                <Link2 size={16} />
                <h3>Conexion del punto</h3>
              </div>

              <div className={styles.helperBox}>
                {imagenes.length} imagen(es) en borrador · {conexiones.length} conexion(es) creadas
              </div>

              <button
                type="button"
                className={styles.btnPrimary360}
                onClick={saveTourToBackend}
                disabled={savingTour || !imagenes.length}
              >
                <Upload size={16} />
                {savingTour ? "Subiendo tour..." : "Subir tour al backend"}
              </button>

              {!hasValidCoords ? (
                <div className={styles.emptyState}>
                  {selectedImg
                    ? "Haz click en el visor para colocar un punto nuevo."
                    : "Primero agrega o selecciona una imagen 360."}
                </div>
              ) : (
                <>
                  <div className={styles.pointInfo}>
                    <span>Yaw: {coords.yaw.toFixed(4)}</span>
                    <span>Pitch: {coords.pitch.toFixed(4)}</span>
                  </div>

                  <div className={styles.panelBlock}>
                    <h4>Conectar con una imagen existente</h4>
                    {!existingDestinations.length ? (
                      <p className={styles.helperText}>Todavia no hay otra imagen del borrador para enlazar.</p>
                    ) : (
                      <div className={styles.destinationsList}>
                        {existingDestinations.map((img) => (
                          <button
                            key={img.id_imagen}
                            type="button"
                            className={styles.destinationItem}
                            onClick={(event) => connectToExisting(img, event)}
                          >
                            <img src={img.imagen} alt={img.nombre} className={styles.destinationThumb} />
                            <span>{img.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.panelBlock}>
                    <h4>O crear una nueva imagen desde este punto</h4>
                    <input
                      type="text"
                      value={newPointName}
                      onChange={(event) => setNewPointName(event.target.value)}
                      className={styles.inputName}
                      placeholder="Nombre de la nueva vista"
                    />
                    <label className={styles.inlineUpload}>
                      <input
                        type="file"
                        accept="image/*"
                        className={styles.hiddenInput}
                        onChange={(event) => setNewPointFile(event.target.files?.[0] || null)}
                      />
                      <Upload size={16} />
                      <span>{newPointFile ? newPointFile.name : "Elegir imagen 360"}</span>
                    </label>
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.btnCancel}
                        onClick={resetPointMode}
                      >
                        Cancelar punto
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary360}
                        onClick={(event) => createAndConnectImage(event)}
                        disabled={!newPointName.trim() || !newPointFile}
                      >
                        <Plus size={16} />
                        Crear en borrador
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal360;
