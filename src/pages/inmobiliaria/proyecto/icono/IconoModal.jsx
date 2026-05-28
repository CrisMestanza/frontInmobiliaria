import { withApiBase } from "../../../../config/api.js";
import { authFetch } from "../../../../config/authFetch.js";
import { getResponseErrorMessage } from "../../../../utils/apiErrors.js";
// components/IconoModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import style from "../../agregarInmo.module.css";
import loader from "../../../../components/loader";

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

const getIconKey = (icono, fallback) => {
  const id =
    icono?.idiconoproyecto ??
    icono?.idicono ??
    icono?.idiconos ??
    icono?.icono_detalle?.idicono ??
    icono?.icono_detalle?.idiconos;
  const lat = Number.parseFloat(icono?.latitud);
  const lng = Number.parseFloat(icono?.longitud);

  return [
    icono?.saved ? "saved" : "draft",
    id ?? "icon",
    Number.isFinite(lat) ? lat.toFixed(6) : "lat",
    Number.isFinite(lng) ? lng.toFixed(6) : "lng",
    fallback,
  ].join("-");
};

export default function IconoModal({ onClose, idproyecto, embedded = false }) {
  const mapRef = useRef(null);
  const proyectoPolygonRef = useRef(null);
  const lotesPolygonsRef = useRef([]);
  const [map, setMap] = useState(null);
  const [iconosDisponibles, setIconosDisponibles] = useState([]);
  const iconosDisponiblesRef = useRef([]);
  const [iconosMapa, setIconosMapa] = useState([]);
  const [draggedIcono, setDraggedIcono] = useState(null);
  const [iconosLoading, setIconosLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem("access");
  const iconQueryBustRef = useRef(Date.now());

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

  const loadGoogleMapsScript = useCallback(() => {
    return loader
      .load()
      .then(() => {
        return window.google.maps;
      })
      .catch((error) => {
        console.error("Error al cargar la API con tu loader:", error);
        throw error; // Propaga el error para que initMap falle
      });
  }, []);

  const initMap = useCallback(async () => {
    try {
      await loadGoogleMapsScript();
      if (!mapRef.current) return;

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 16,
        center: {
          lat: -6.4882,
          lng: -76.365629,
        },
        gestureHandling: "greedy",
      });

      const overlay = new window.google.maps.OverlayView();
      overlay.onAdd = function () {};
      overlay.draw = function () {};
      overlay.onRemove = function () {};
      overlay.setMap(mapInstance);

      setMap({ mapInstance, overlay });
    } catch (error) {
      console.error("Error initializing the map:", error);
    }
  }, [loadGoogleMapsScript]);

  useEffect(() => {
    if (!map) return;
    const loadProjectGeometries = async () => {
      try {
        setIconosLoading(true);
        const resProyecto = await authFetch(
          withApiBase(`https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const puntosProyecto = await resProyecto.json();
        const proyectoCoords = normalizePolygonCoords(puntosProyecto);
        if (!proyectoCoords.length) return;

        // Centrar mapa rápido con puntos del proyecto
        const bounds = new window.google.maps.LatLngBounds();
        proyectoCoords.forEach((p) => bounds.extend(p));
        if (!bounds.isEmpty()) {
          map.mapInstance.fitBounds(bounds);
        } else {
          map.mapInstance.setCenter(proyectoCoords[0]);
        }

        if (proyectoPolygonRef.current) {
          proyectoPolygonRef.current.setMap(null);
        }
        lotesPolygonsRef.current.forEach((polygon) => polygon.setMap(null));
        lotesPolygonsRef.current = [];

        const proyectoPolygon = new window.google.maps.Polygon({
          paths: proyectoCoords,
          map: map.mapInstance,
          strokeColor: "#0000FF",
          strokeWeight: 2,
          fillColor: "#0000FF",
          fillOpacity: 0.15,
        });
        proyectoPolygonRef.current = proyectoPolygon;

        const iconosCatalogoPromise =
          iconosDisponiblesRef.current.length === 0
            ? authFetch(withApiBase("https://api.geohabita.com/api/listIconos/"))
            : null;

        const [resLotes, resIconosProyecto, resIconosCatalogo] =
          await Promise.all([
          authFetch(
            withApiBase(
              `https://api.geohabita.com/api/listPuntosLoteProyecto/${idproyecto}/`,
            ),
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          ),
          authFetch(
            withApiBase(
              `https://api.geohabita.com/api/list_iconos_proyecto/${idproyecto}?t=${iconQueryBustRef.current}`,
            ),
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          ),
          iconosCatalogoPromise,
        ]);

        const lotesConPuntos = await resLotes.json();
        const iconosRegistrados = await resIconosProyecto.json();
        if (resIconosCatalogo) {
          const data = await resIconosCatalogo.json();
          iconosDisponiblesRef.current = data;
          setIconosDisponibles(data);
        }

        const lotesPolygons = lotesConPuntos
          .map((lote) => {
            const loteCoords = normalizePolygonCoords(lote.puntos || []);

            if (!loteCoords.length) return null;

            return new window.google.maps.Polygon({
              paths: loteCoords,
              map: map.mapInstance,
              strokeColor: "#333",
              strokeWeight: 1,
              fillColor: getColorLote(lote.vendido),
              fillOpacity: 0.45,
            });
          })
          .filter(Boolean);

        lotesPolygonsRef.current = lotesPolygons;

        setIconosMapa((prev) => {
          prev.forEach((ic) => ic.marker?.setMap(null));

          return iconosRegistrados
            .map((ico) => {
              const iconoDetalle =
                ico.icono_detalle ||
                iconosDisponiblesRef.current.find(
                  (i) =>
                    i.idicono === ico.idicono ||
                    i.idicono === ico.idiconos,
                );

              if (!iconoDetalle?.imagen) return null;

              const marker = new window.google.maps.Marker({
                position: {
                  lat: parseFloat(ico.latitud),
                  lng: parseFloat(ico.longitud),
                },
                map: map.mapInstance,
                icon: {
                  url: withApiBase(
                    `https://api.geohabita.com${iconoDetalle.imagen}`,
                  ),
                  scaledSize: new window.google.maps.Size(40, 40),
                },
                draggable: true,
                title: iconoDetalle.nombre,
              });

              marker.addListener("rightclick", () => {
                handleDeleteIcono(ico.idiconoproyecto, marker);
              });

              return {
                idicono: ico.idicono,
                idiconoproyecto: ico.idiconoproyecto,
                latitud: ico.latitud,
                longitud: ico.longitud,
                marker,
                icono_detalle: iconoDetalle,
                saved: true,
              };
            })
            .filter(Boolean);
        });
      } catch (error) {
        console.error("Error loading project geometry:", error);
      } finally {
        setIconosLoading(false);
      }
    };
    loadProjectGeometries();
  }, [map, idproyecto, token]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedIcono || !map || !proyectoPolygonRef.current) return;

    const projection = map.overlay.getProjection();
    const pixelPoint = new window.google.maps.Point(
      e.nativeEvent.offsetX,
      e.nativeEvent.offsetY
    );
    const latLng = projection.fromContainerPixelToLatLng(pixelPoint);

    // Validar si está dentro del polígono
    if (
      !window.google.maps.geometry.poly.containsLocation(
        latLng,
        proyectoPolygonRef.current
      )
    ) {
      alert("Solo puedes colocar íconos dentro del proyecto.");
      return;
    }

    // Crear marker
    const marker = new window.google.maps.Marker({
      position: latLng,
      map: map.mapInstance,
      icon: {
        url: withApiBase(`https://api.geohabita.com${draggedIcono.imagen}`),
        scaledSize: new window.google.maps.Size(40, 40),
      },
      draggable: true,
    });

    // Objeto listo para enviar al backend
    const payloadIcono = {
      idicono:
        draggedIcono.idicono ??
        draggedIcono.idiconos ??
        draggedIcono?.idicono?.idicono,
      latitud: latLng.lat(),
      longitud: latLng.lng(),
      marker,
      icono_detalle: {
        idicono: draggedIcono.idicono ?? draggedIcono.idiconos,
        nombre: draggedIcono.nombre,
        imagen: draggedIcono.imagen,
      },
      saved: false,
    };

    setIconosMapa((prev) => {
      const existe = prev.some(
        (ic) =>
          ic.idicono === payloadIcono.idicono &&
          ic.latitud === payloadIcono.latitud &&
          ic.longitud === payloadIcono.longitud
      );
      if (existe) return prev;
      return [...prev, payloadIcono];
    });

    // Actualizar coordenadas si se mueve
    window.google.maps.event.addListener(marker, "dragend", (ev) => {
      const newLatLng = ev.latLng;
      if (
        !window.google.maps.geometry.poly.containsLocation(
          newLatLng,
          proyectoPolygonRef.current
        )
      ) {
        alert("No puedes mover el ícono fuera del proyecto.");
        marker.setPosition(latLng);
      } else {
        setIconosMapa((prev) =>
          prev.map((ic) =>
            ic === payloadIcono
              ? {
                  ...ic,
                  latitud: newLatLng.lat(),
                  longitud: newLatLng.lng(),
                }
              : ic
          )
        );
        payloadIcono.latitud = newLatLng.lat();
        payloadIcono.longitud = newLatLng.lng();
      }
    });

    marker.addListener("rightclick", () => {
      setIconosMapa((prev) => {
        marker.setMap(null);
        return prev.filter((ic) => ic !== payloadIcono);
      });
    });
  };

  useEffect(() => {
    const fetchIconos = async () => {
      const res = await authFetch(withApiBase("https://api.geohabita.com/api/listIconos/"));
      const data = await res.json();
      iconosDisponiblesRef.current = data;
      setIconosDisponibles(data);
    };
    fetchIconos();
  }, []);

  const handleGuardar = async () => {
    setSaving(true);
    const payload = iconosMapa
      .filter((icono) => !icono.saved)
      .map((icono) => ({
        idproyecto,
        idicono: icono.idicono,
        latitud: parseFloat(icono.latitud),
        longitud: parseFloat(icono.longitud),
        estado: 1,
      }))
      .filter(
        (icono, idx, arr) =>
          idx ===
          arr.findIndex(
            (i) =>
              i.idicono === icono.idicono &&
              i.latitud === icono.latitud &&
              i.longitud === icono.longitud
          )
      );

    try {
      if (payload.length) {
        const response = await authFetch(
          withApiBase("https://api.geohabita.com/api/add_iconos_proyecto/"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(
            await getResponseErrorMessage(response, "No se pudieron guardar los iconos."),
          );
        }
      }

      if (window.alertSuccess) window.alertSuccess("Iconos guardados.");
      else alert("Iconos guardados.");
      onClose?.({ refreshed: true });
    } catch (error) {
      console.error(error);
      const message = error?.message || "Ocurrio un error al guardar los iconos.";
      if (window.alertError) window.alertError(message);
      else alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIcono = async (idiconoproyecto, marker) => {
    if (!idiconoproyecto) return;
    const ok = window.confirm("¿Eliminar este ícono?");
    if (!ok) return;
    try {
      await authFetch(
        withApiBase(
          `https://api.geohabita.com/api/delete_icono_proyecto/${idiconoproyecto}/`,
        ),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (marker) marker.setMap(null);
      iconQueryBustRef.current = Date.now();
      setIconosMapa((prev) =>
        prev.filter((ic) => ic.idiconoproyecto !== idiconoproyecto),
      );
    } catch (error) {
      console.error("Error eliminando ícono:", error);
    }
  };
  const overlayStyle = embedded
    ? {
        position: "relative",
        inset: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: 0,
        zIndex: "auto",
        display: "block",
        overflow: "visible",
      }
    : undefined;

  const contentStyle = embedded
    ? {
        width: "100%",
        maxWidth: "none",
        minHeight: "auto",
        maxHeight: "none",
        borderRadius: "24px",
        boxShadow: "none",
        overflow: "visible",
        border: "1px solid rgba(148, 163, 184, 0.16)",
      }
    : undefined;

  return (
    <div className={style.modalOverlay} style={overlayStyle}>
      <div className={`${style.modalContent} ${style.iconModalContent}`} style={contentStyle}>
        {!embedded && (
          <button className={style.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        )}
        <div className={style.iconHero}>
          <div>
            <h2 className={style.iconModalTitle}>Íconos del proyecto</h2>
            <p className={style.iconHeroText}>
              Arrastra los íconos al mapa para ubicarlos dentro del proyecto y usa clic derecho para eliminarlos.
            </p>
          </div>
          {iconosLoading ? (
            <p className={style.iconLoading}>Cargando proyecto en el mapa...</p>
          ) : (
            <div className={style.iconHeroStats}>
              <span>{iconosDisponibles.length} disponibles</span>
              <span>{iconosMapa.length} en proyecto</span>
              <span>{iconosMapa.filter((ico) => !ico.saved).length} pendientes</span>
            </div>
          )}
        </div>

        <div className={style.iconWorkspace}>
          <section className={style.iconSectionCard}>
            <h3 className={style.iconSectionTitle}>Paleta disponible</h3>
            <p className={style.iconSectionHelp}>Selecciona y arrastra los íconos que quieras ubicar dentro del proyecto.</p>
            <div className={style.iconPalette}>
              {iconosDisponibles.map((ico, idx) => (
                <button
                  key={getIconKey(ico, idx)}
                  type="button"
                  className={style.iconPaletteButton}
                  title={ico.nombre}
                  draggable
                  onDragStart={() => setDraggedIcono(ico)}
                >
                  <img
                    src={withApiBase(`https://api.geohabita.com${ico.imagen}`)}
                    alt={ico.nombre}
                    className={style.iconPaletteItem}
                  />
                  <span>{ico.nombre}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={style.iconSectionCard}>
            <div className={style.iconRegisteredHead}>
              <div>
                <h3 className={style.iconSectionTitle}>
                  Íconos registrados
                </h3>
                <p className={style.iconSectionHelp}>Revisa lo ya colocado y elimina lo que no corresponda antes de guardar.</p>
              </div>
              <button className={style.submitBtn} onClick={handleGuardar} disabled={saving}>
                {saving ? "Guardando..." : "Guardar íconos"}
              </button>
            </div>
            <div className={style.iconRegisteredList}>
              {iconosMapa.map((ico, idx) => {
                const iconoDetalle =
                  ico.icono_detalle ||
                  iconosDisponibles.find(
                    (i) =>
                      i.idicono === ico.idicono ||
                      i.idicono === ico.idiconos,
                  );

                if (!iconoDetalle?.imagen) return null;

                return (
                  <div key={getIconKey(ico, idx)} className={style.iconRegisteredCard}>
                    <div className={style.iconRegisteredItemWrap}>
                      <img
                        src={withApiBase(
                          `https://api.geohabita.com${iconoDetalle.imagen}`,
                        )}
                        alt={iconoDetalle.nombre}
                        title={iconoDetalle.nombre}
                        className={style.iconRegisteredItem}
                      />
                      {!ico.saved && (
                        <span className={style.iconDraftBadge}>Nuevo</span>
                      )}
                    </div>
                    <div className={style.iconRegisteredMeta}>
                      <strong>{iconoDetalle.nombre}</strong>
                      <span>{ico.saved ? "Guardado" : "Pendiente por guardar"}</span>
                    </div>
                    <button
                      type="button"
                      className={style.iconRemoveBtn}
                      onClick={() => {
                        if (ico.saved) {
                          handleDeleteIcono(ico.idiconoproyecto, ico.marker);
                        } else {
                          ico.marker?.setMap(null);
                          setIconosMapa((prev) => prev.filter((i) => i !== ico));
                        }
                      }}
                      title="Eliminar ícono"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {!iconosMapa.length && (
                <p className={style.iconEmpty}>No hay íconos aún</p>
              )}
            </div>
          </section>

          <div className={style.iconMapPanel}>
            <div className={style.iconMapTopbar}>
              <div>
                <strong>Mapa del proyecto</strong>
                <span>Suelta aquí los íconos para registrarlos sobre el masterplan.</span>
              </div>
              <span className={style.iconMapBadge}>Arrastra y suelta aquí</span>
            </div>
            <div
              ref={mapRef}
              className={style.iconMap}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
