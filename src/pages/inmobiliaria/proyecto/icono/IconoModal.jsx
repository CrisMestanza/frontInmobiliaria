import { withApiBase } from "../../../../config/api.js";
import { authFetch } from "../../../../config/authFetch.js";
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

export default function IconoModal({ onClose, idproyecto }) {
  const mapRef = useRef(null);
  const proyectoPolygonRef = useRef(null);
  const lotesPolygonsRef = useRef([]);
  const [map, setMap] = useState(null);
  const [iconosDisponibles, setIconosDisponibles] = useState([]);
  const iconosDisponiblesRef = useRef([]);
  const [iconosMapa, setIconosMapa] = useState([]);
  const [draggedIcono, setDraggedIcono] = useState(null);
  const [iconosLoading, setIconosLoading] = useState(true);
  const token = localStorage.getItem("access");

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
              `https://api.geohabita.com/api/list_iconos_proyecto/${idproyecto}`,
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

    await authFetch(withApiBase("https://api.geohabita.com/api/add_iconos_proyecto/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    alert("Íconos guardados.");
    onClose();
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
      setIconosMapa((prev) =>
        prev.filter((ic) => ic.idiconoproyecto !== idiconoproyecto),
      );
    } catch (error) {
      console.error("Error eliminando ícono:", error);
    }
  };
  return (
    <div className={style.modalOverlay}>
      <div className={style.modalContent}>
        <button className={style.closeBtn} onClick={onClose}>
          <X size={16} />
        </button>
        <h2 className={style.iconModalTitle}>Arrastra los Íconos a tu Proyecto</h2>
        {iconosLoading && (
          <p className={style.iconLoading}>Cargando proyecto en el mapa...</p>
        )}
        <div className={style.iconPalette}>
          {iconosDisponibles.map((ico) => (
            <img
              key={ico.idicono}
              src={withApiBase(`https://api.geohabita.com${ico.imagen}`)}
              alt={ico.nombre}
              title={ico.nombre}
              draggable
              onDragStart={() => setDraggedIcono(ico)}
              className={style.iconPaletteItem}
            />
          ))}
        </div>
        {/* Lista de íconos ya registrados */}
        <div className={style.iconSection}>
          <h3 className={style.iconSectionTitle}>
            Íconos registrados en este proyecto:
          </h3>
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
                <div key={idx} className={style.iconRegisteredItemWrap}>
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
        </div>

        <div
          ref={mapRef}
          className={style.iconMap}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        />
        <button className={style.submitBtn} onClick={handleGuardar}>
          Guardar Íconos
        </button>
      </div>
    </div>
  );
}
