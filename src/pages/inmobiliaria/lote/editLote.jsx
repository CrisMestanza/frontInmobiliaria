// components/editLote.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import style from "../agregarInmo.module.css";
import loader from "../../../components/loader";

export default function EditLote({ onClose, idproyecto, lote, visible }) {
  const [form, setForm] = useState({
    idtipoinmobiliaria: 0,
    nombre: "",
    precio: 0,
    latitud: "",
    longitud: "",
    descripcion: "",
    puntos: [],
    imagenes: [],
    vendido: 0,
  });

  const [tipos, setTipos] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const token = localStorage.getItem("access");
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polyInstance = useRef(null);
  const pathListenersRef = useRef([]);

  // 1) Cargar puntos del lote y rellenar form
  useEffect(() => {
    if (!lote) return;

    const fetchData = async () => {
      try {
        const resPuntos = await fetch(
          `https://api.geohabita.com/api/listPuntos/${lote.idlote}`
        );
        const puntos = await resPuntos.json();

        const nuevosPuntos = (puntos || []).map((p, i) => ({
          latitud: p.latitud,
          longitud: p.longitud,
          orden: i + 1,
        }));

        setForm({
          idtipoinmobiliaria: lote.idtipoinmobiliaria ?? 0,
          nombre: lote.nombre ?? "",
          precio: lote.precio ?? 0,
          latitud: puntos[0]?.latitud ?? "",
          longitud: puntos[0]?.longitud ?? "",
          descripcion: lote.descripcion ?? "",
          puntos: nuevosPuntos,
          imagenes: [],
          vendido: lote.vendido ?? 0,
        });
      } catch (err) {
        console.error("Error cargando puntos del lote:", err);
      }
    };

    fetchData();
  }, [lote]);

  // 2) Inicializar mapa (only once)
  const initMap = useCallback(async () => {
    try {
      await loader.load();

      // traer puntos del proyecto para centrar/dibujar
      const resProyecto = await fetch(
        `https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`
      );
      const puntosProyecto = await resProyecto.json();
      if (!puntosProyecto || puntosProyecto.length === 0) {
        console.warn("No hay puntos del proyecto para centrar el mapa");
        return;
      }

      const centerLat = parseFloat(puntosProyecto[0].latitud);
      const centerLng = parseFloat(puntosProyecto[0].longitud);

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 16,
        center: { lat: centerLat, lng: centerLng },
        gestureHandling: "greedy",
      });
      mapInstance.current = map;
      setMapReady(true);

      // dibujar polígono del proyecto (solo visual)
      const proyectoCoords = puntosProyecto.map((p) => ({
        lat: parseFloat(p.latitud),
        lng: parseFloat(p.longitud),
      }));
      new window.google.maps.Polygon({
        paths: proyectoCoords,
        map,
        strokeColor: "#0000FF",
        strokeWeight: 2,
        fillColor: "#0000FF",
        fillOpacity: 0.15,
      });
    } catch (err) {
      console.error("initMap error:", err);
    }
  }, [idproyecto]);

  useEffect(() => {
    initMap();
    return () => {
      // cleanup básico al desmontar
      if (polyInstance.current) {
        polyInstance.current.setMap(null);
        polyInstance.current = null;
      }
      pathListenersRef.current.forEach((l) =>
        window.google?.maps?.event?.removeListener?.(l)
      );
      pathListenersRef.current = [];
      mapInstance.current = null;
    };
  }, [initMap]);

  // 3) Dibujar/actualizar polígono del lote cuando tengamos puntos y mapa listo
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    if (!form.puntos || form.puntos.length === 0) return;

    // Dibujar lote aquí
    const loteCoords = form.puntos.map((p) => ({
      lat: parseFloat(p.latitud),
      lng: parseFloat(p.longitud),
    }));

    if (!loteCoords.length) return;

    if (polyInstance.current) {
      polyInstance.current.setMap(null);
    }

    polyInstance.current = new window.google.maps.Polygon({
      paths: loteCoords,
      map: mapInstance.current,
      // editable: true,
      // draggable: true,
      strokeColor: "#333333",
      strokeWeight: 1,
      fillColor: "#00ff00",
      fillOpacity: 0.45,
    });

    const bounds = new window.google.maps.LatLngBounds();
    loteCoords.forEach((c) =>
      bounds.extend(new window.google.maps.LatLng(c.lat, c.lng))
    );
    mapInstance.current.fitBounds(bounds);
  }, [mapReady, form.puntos]);

  // cargar tipos de inmobiliaria
  useEffect(() => {
    const fetchTipos = async () => {
      try {
        const res = await fetch(
          "https://api.geohabita.com/api/listTipoInmobiliaria/"
        );
        const data = await res.json();
        setTipos(data || []);
      } catch (err) {
        console.error("Error tipos:", err);
      }
    };
    fetchTipos();
  }, []);

  const handleTipoChange = (e) =>
    setForm({ ...form, idtipoinmobiliaria: parseInt(e.target.value, 10) });
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("idtipoinmobiliaria", form.idtipoinmobiliaria);
      formData.append("nombre", form.nombre);
      formData.append("precio", form.precio);
      formData.append("latitud", form.latitud);
      formData.append("longitud", form.longitud);
      formData.append("descripcion", form.descripcion);
      formData.append("puntos", JSON.stringify(form.puntos));
      formData.append("vendido", form.vendido);

      const res = await fetch(
        `https://api.geohabita.com/api/updateLote/${lote.idlote}/`,
        {
          method: "PUT",
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        alert("Lote actualizado ✅");
        onClose();
      } else {
        const errBody = await res.text().catch(() => null);
        console.error("update error:", res.status, errBody);
        alert("Error al actualizar ❌");
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Error de red al actualizar");
    }
  };

  return (
    <div
      className={style.modalOverlay}
      style={{ display: visible ? "flex" : "none" }}
    >
      <div className={style.modalContent}>
        <button className={style.closeBtn} onClick={onClose}>
          ✖
        </button>
        <form className={style.formContainer} onSubmit={handleSubmit}>
          <h2 style={{ color: "var(--theme-text-main)" }}>Editar Lote</h2>
          <div
            ref={mapRef}
            style={{ width: "100%", height: "300px", marginBottom: "1rem" }}
          />
          <label>Tipo:</label>
          <select
            name="idtipoinmobiliaria"
            value={form.idtipoinmobiliaria}
            onChange={handleTipoChange}
            className={style.input}
          >
            {tipos.map((t) => (
              <option key={t.idtipoinmobiliaria} value={t.idtipoinmobiliaria}>
                {t.nombre}
              </option>
            ))}
          </select>
          <label>Nombre:</label>
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            className={style.input}
          />
          <label>Precio:</label>
          <input
            name="precio"
            type="number"
            value={form.precio}
            onChange={handleChange}
            className={style.input}
          />
          <label>Descripción:</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            className={style.input}
          />
          <button type="submit" className={style.submitBtn}>
            Guardar Cambios
          </button>
        </form>
      </div>
    </div>
  );
}
