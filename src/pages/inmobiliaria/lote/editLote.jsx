import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
// components/editLote.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import style from "../proyecto/addproyect.module.css";
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
    area_total_m2: "",
    ancho: "",
    largo: "",
    dormitorios: 0,
    banos: 0,
    cuartos: 0,
    titulo_propiedad: 0,
    cochera: 0,
    cocina: 0,
    sala: 0,
    patio: 0,
    jardin: 0,
    terraza: 0,
    azotea: 0,
    pais: "",
    moneda: "",
    bandera: "",
  });

  const [tipos, setTipos] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [otherLotesCoords, setOtherLotesCoords] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const token = localStorage.getItem("access");
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polyInstance = useRef(null);
  const otherPolysRef = useRef([]);
  const pathListenersRef = useRef([]);
  const fileInputRef = useRef(null);
  const isCasa = Number(form.idtipoinmobiliaria) === 2;

  const visibleExistingImages = useMemo(
    () =>
      existingImages.filter((img) => {
        const id = Number(img?.idimagenes ?? img?.idimagen ?? img?.id);
        return Number.isFinite(id) ? !removedImageIds.includes(id) : true;
      }),
    [existingImages, removedImageIds],
  );

  const normalizePolygonCoords = (coords = []) =>
    coords
      .map((p) => ({
        lat: parseFloat(p.latitud ?? p.lat),
        lng: parseFloat(p.longitud ?? p.lng),
        orden: p.orden,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((p) => ({ lat: p.lat, lng: p.lng }));

  // 1) Cargar puntos del lote y rellenar form
  useEffect(() => {
    if (!lote) return;

    const fetchData = async () => {
      try {
        const [resPuntos, resImagenes] = await Promise.all([
          authFetch(
            withApiBase(`https://api.geohabita.com/api/listPuntos/${lote.idlote}`),
          ),
          authFetch(
            withApiBase(`https://api.geohabita.com/api/list_imagen/${lote.idlote}`),
          ),
        ]);
        const puntos = await resPuntos.json();
        const imagenes = await resImagenes.json();

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
          area_total_m2: lote.area_total_m2 ?? "",
          ancho: lote.ancho ?? "",
          largo: lote.largo ?? "",
          dormitorios: lote.dormitorios ?? 0,
          banos: lote.banos ?? 0,
          cuartos: lote.cuartos ?? 0,
          titulo_propiedad: lote.titulo_propiedad ?? 0,
          cochera: lote.cochera ?? 0,
          cocina: lote.cocina ?? 0,
          sala: lote.sala ?? 0,
          patio: lote.patio ?? 0,
          jardin: lote.jardin ?? 0,
          terraza: lote.terraza ?? 0,
          azotea: lote.azotea ?? 0,
          pais: lote.pais ?? "",
          moneda: lote.moneda ?? "",
          bandera: lote.bandera ?? "",
        });
        setExistingImages(Array.isArray(imagenes) ? imagenes : []);
        setRemovedImageIds([]);
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
      if (!mapRef.current) return;

      // traer puntos del proyecto para centrar/dibujar
      const [resProyecto, resLotes] = await Promise.all([
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`,
          ),
        ),
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/listPuntosLoteProyecto/${idproyecto}/`,
          ),
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);
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

      // Dibujar otros lotes (baja opacidad)
      const lotesData = (await resLotes.json()) || [];
      const other = lotesData
        .filter((l) => l.idlote !== lote?.idlote)
        .map((l) => ({
          idlote: l.idlote,
          coords: normalizePolygonCoords(l.puntos || []),
        }))
        .filter((l) => l.coords.length >= 3);
      setOtherLotesCoords(other);
    } catch (err) {
      console.error("initMap error:", err);
    }
  }, [idproyecto, token, lote?.idlote]);

  useEffect(() => {
    if (!visible) return;
    initMap();
    return () => {
      // cleanup básico al desmontar
      if (polyInstance.current) {
        polyInstance.current.setMap(null);
        polyInstance.current = null;
      }
      otherPolysRef.current.forEach((p) => p.setMap(null));
      otherPolysRef.current = [];
      pathListenersRef.current.forEach((l) =>
        window.google?.maps?.event?.removeListener?.(l)
      );
      pathListenersRef.current = [];
      mapInstance.current = null;
    };
  }, [initMap, visible]);

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

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    // limpiar previos
    otherPolysRef.current.forEach((p) => p.setMap(null));
    otherPolysRef.current = [];

    otherLotesCoords.forEach((loteItem) => {
      const poly = new window.google.maps.Polygon({
        paths: loteItem.coords,
        map: mapInstance.current,
        strokeColor: "#94a3b8",
        strokeWeight: 1,
        strokeOpacity: 0.35,
        fillColor: "#94a3b8",
        fillOpacity: 0.12,
        clickable: false,
      });
      otherPolysRef.current.push(poly);
    });
  }, [mapReady, otherLotesCoords]);

  // cargar tipos de inmobiliaria
  useEffect(() => {
    const fetchTipos = async () => {
      try {
        const res = await authFetch(
          withApiBase("https://api.geohabita.com/api/listTipoInmobiliaria/")
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
    const id = Number(image?.idimagenes ?? image?.idimagen ?? image?.id);
    if (!Number.isFinite(id)) {
      setExistingImages((prev) => prev.filter((img) => img !== image));
      return;
    }
    setRemovedImageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  useEffect(
    () => () => {
      form.imagenes.forEach((img) => {
        if (img?.preview) URL.revokeObjectURL(img.preview);
      });
    },
    [form.imagenes],
  );

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
      formData.append("area_total_m2", form.area_total_m2);
      formData.append("ancho", form.ancho);
      formData.append("largo", form.largo);
      formData.append("dormitorios", form.dormitorios);
      formData.append("banos", form.banos);
      formData.append("cuartos", form.cuartos);
      formData.append("titulo_propiedad", form.titulo_propiedad);
      formData.append("cochera", form.cochera);
      formData.append("cocina", form.cocina);
      formData.append("sala", form.sala);
      formData.append("patio", form.patio);
      formData.append("jardin", form.jardin);
      formData.append("terraza", form.terraza);
      formData.append("azotea", form.azotea);
      formData.append("pais", form.pais);
      formData.append("moneda", form.moneda);
      formData.append("bandera", form.bandera);
      formData.append("imagenes_eliminadas", JSON.stringify(removedImageIds));

      form.imagenes.forEach((img) => {
        if (img?.file) formData.append("imagenes", img.file);
      });

      const res = await authFetch(
        withApiBase(`https://api.geohabita.com/api/updateLote/${lote.idlote}/`),
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
        <div className={style.header}>
          <div>
            <h1 className={style.title}>Editar Lote</h1>
            <p className={style.subtitle}>
              Actualiza datos, ubicación y recursos del lote seleccionado.
            </p>
          </div>
          <button className={style.closeBtn} onClick={onClose}>
            ✖
          </button>
        </div>

        <form className={style.formBody} onSubmit={handleSubmit}>
          <div className={style.gridContainer}>
            <div className={style.leftColumn}>
              <section className={style.sectionCard}>
                <h2 className={style.sectionTitle}>
                  <span className="material-icons-outlined">edit</span>
                  Detalles del lote
                </h2>

                <div className={style.inputGroup}>
                  <label>Tipo</label>
                  <select
                    name="idtipoinmobiliaria"
                    value={form.idtipoinmobiliaria}
                    onChange={handleTipoChange}
                    className={style.select}
                  >
                    {tipos.map((t) => (
                      <option key={t.idtipoinmobiliaria} value={t.idtipoinmobiliaria}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={style.inputGroup}>
                  <label>Nombre</label>
                  <input
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    className={style.input}
                  />
                </div>

                <div className={style.inputGroup}>
                  <label>Precio</label>
                  <input
                    name="precio"
                    type="number"
                    value={form.precio}
                    onChange={handleChange}
                    className={style.input}
                  />
                </div>

                <div className={style.inputGroup}>
                  <label>Descripción</label>
                  <textarea
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    className={style.textarea}
                  />
                </div>

                <div className={style.compactGrid}>
                  <div className={style.compactField}>
                    <label>Área total (m²)</label>
                    <input
                      name="area_total_m2"
                      value={form.area_total_m2}
                      onChange={handleChange}
                      className={style.input}
                    />
                  </div>
                  <div className={style.compactField}>
                    <label>Ancho (m)</label>
                    <input
                      name="ancho"
                      type="number"
                      step="0.01"
                      value={form.ancho}
                      onChange={handleChange}
                      className={style.input}
                    />
                  </div>
                  <div className={style.compactField}>
                    <label>Largo (m)</label>
                    <input
                      name="largo"
                      type="number"
                      step="0.01"
                      value={form.largo}
                      onChange={handleChange}
                      className={style.input}
                    />
                  </div>
                </div>

                <div className={style.compactGrid}>
                  <div className={style.compactField}>
                    <label>País</label>
                    <input
                      name="pais"
                      value={form.pais}
                      onChange={handleChange}
                      className={style.input}
                    />
                  </div>
                  <div className={style.compactField}>
                    <label>Moneda</label>
                    <input
                      name="moneda"
                      value={form.moneda}
                      onChange={handleChange}
                      className={style.input}
                    />
                  </div>
                  <div className={style.compactField}>
                    <label>Bandera (URL)</label>
                    <input
                      name="bandera"
                      value={form.bandera}
                      onChange={handleChange}
                      className={style.input}
                    />
                  </div>
                </div>

                <div className={style.inputGroup}>
                  <label>Título de propiedad</label>
                  <select
                    name="titulo_propiedad"
                    value={form.titulo_propiedad}
                    onChange={handleChange}
                    className={style.select}
                  >
                    <option value={0}>No</option>
                    <option value={1}>Sí</option>
                  </select>
                </div>

                {isCasa && (
                  <div className={style.compactGrid}>
                    <div className={style.compactField}>
                      <label>Dormitorios</label>
                      <input
                        name="dormitorios"
                        type="number"
                        min="0"
                        value={form.dormitorios}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Baños</label>
                      <input
                        name="banos"
                        type="number"
                        min="0"
                        value={form.banos}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Cuartos</label>
                      <input
                        name="cuartos"
                        type="number"
                        min="0"
                        value={form.cuartos}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Cochera</label>
                      <input
                        name="cochera"
                        type="number"
                        min="0"
                        value={form.cochera}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Cocina</label>
                      <input
                        name="cocina"
                        type="number"
                        min="0"
                        value={form.cocina}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Sala</label>
                      <input
                        name="sala"
                        type="number"
                        min="0"
                        value={form.sala}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Patio</label>
                      <input
                        name="patio"
                        type="number"
                        min="0"
                        value={form.patio}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Jardín</label>
                      <input
                        name="jardin"
                        type="number"
                        min="0"
                        value={form.jardin}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Terraza</label>
                      <input
                        name="terraza"
                        type="number"
                        min="0"
                        value={form.terraza}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                    <div className={style.compactField}>
                      <label>Azotea</label>
                      <input
                        name="azotea"
                        type="number"
                        min="0"
                        value={form.azotea}
                        onChange={handleChange}
                        className={style.input}
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className={style.sectionCard}>
                <h2 className={style.sectionTitle}>
                  <span className="material-icons-outlined">image</span>
                  Imágenes
                </h2>

                <div className={style.inputGroup}>
                  <label>Imágenes actuales</label>
                  {visibleExistingImages.length === 0 ? (
                    <p style={{ marginTop: "6px", marginBottom: "6px" }}>
                      No hay imágenes actuales.
                    </p>
                  ) : (
                    <div className={style.imagePreviewGrid}>
                      {visibleExistingImages.map((img, i) => {
                        const src = withApiBase(
                          `https://api.geohabita.com${img.imagen || ""}`,
                        );
                        const key = img.idimagenes || img.idimagen || img.id || i;
                        return (
                          <div className={style.imagePreviewItem} key={key}>
                            <img src={src} alt={`Actual ${i + 1}`} />
                            <button
                              type="button"
                              className={style.imageRemoveBtn}
                              onClick={() => removeExistingImage(img)}
                              title="Quitar imagen actual"
                            >
                              ✖
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={style.inputGroup}>
                  <label>Agregar imágenes nuevas</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleImagenesChange}
                    className={style.input}
                  />
                  {form.imagenes.length > 0 && (
                    <div className={style.imagePreviewGrid}>
                      {form.imagenes.map((img, i) => (
                        <div className={style.imagePreviewItem} key={`new-${i}`}>
                          <img src={img.preview} alt={`Nueva ${i + 1}`} />
                          <button
                            type="button"
                            className={style.imageRemoveBtn}
                            onClick={() => removeNewImage(i)}
                          >
                            ✖
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div className={style.actionRow}>
                <button type="submit" className={style.submitBtn}>
                  Guardar Cambios
                </button>
              </div>
            </div>

            <div className={style.rightColumn}>
              <h2 className={style.sectionTitle}>
                <span className="material-icons-outlined">map</span>
                Mapa
              </h2>
              <div className={style.mapWrapper}>
                <div ref={mapRef} className={style.googleMap} />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
