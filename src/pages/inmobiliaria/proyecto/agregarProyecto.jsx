import React, { useState, useRef, useEffect } from "react";
import { GoogleMap, DrawingManager, Polygon } from "@react-google-maps/api";
import loader from "../../../components/loader";
import style from "../agregarInmo.module.css";

const defaultCenter = { lat: -6.4882, lng: -76.365629 };

export default function ProyectoModal({ onClose, idinmobiliaria }) {
  const token = localStorage.getItem("access");
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [tipo, setTipo] = useState([]);
  const [form, setForm] = useState({
    idinmobiliaria,
    idtipoinmobiliaria: "",
    nombreproyecto: "",
    descripcion: "",
    latitud: "",
    longitud: "",
    puntos: [],
    imagenes: [],
    precio: "",
  });

  const mapRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  // 🗺️ Cargar Google Maps con loader
  useEffect(() => {
    loader
      .load()
      .then(() => setIsLoaded(true))
      .catch((err) => {
        console.error("Error al cargar Google Maps:", err);
        setLoadError(true);
      });
  }, []);

  // 🔒 Bloquear scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "auto");
  }, []);

  // 🔍 Configurar Autocomplete
  const onMapLoad = (map) => {
    mapRef.current = map;

    setTimeout(() => {
      if (!inputRef.current || autocompleteRef.current) return;

      try {
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: ["geometry", "name", "formatted_address"],
            componentRestrictions: { country: "pe" },
          }
        );

        autocomplete.bindTo("bounds", map);

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;

          const location = place.geometry.location;
          map.panTo(location);
          map.setZoom(17);

          setForm((prev) => ({
            ...prev,
            latitud: location.lat(),
            longitud: location.lng(),
          }));
        });

        autocompleteRef.current = autocomplete;
      } catch (error) {
        console.error("Error al inicializar Autocomplete:", error);
      }
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(
          autocompleteRef.current
        );
      }
    };
  }, []);

  // 🔄 Cargar tipos de inmobiliaria
  useEffect(() => {
    const fetchTipos = async () => {
      try {
        const res = await fetch(
          "https://apiinmo.y0urs.com/api/listTipoInmobiliaria/",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        setTipo(data);
      } catch (err) {
        console.error("Error al cargar tipos:", err);
      }
    };
    fetchTipos();
  }, [token]);

  // 📌 Manejo de inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // 📍 Polígono
  const handlePolygonComplete = (polygon) => {
    const path = polygon.getPath();
    const puntos = path.getArray().map((point, i) => ({
      latitud: point.lat(),
      longitud: point.lng(),
      orden: i + 1,
    }));

    setForm((prev) => ({
      ...prev,
      puntos,
      latitud: puntos[0]?.latitud || "",
      longitud: puntos[0]?.longitud || "",
    }));

    polygon.setEditable(true);

    const updatePath = () => {
      const updated = path.getArray().map((p, i) => ({
        latitud: p.lat(),
        longitud: p.lng(),
        orden: i + 1,
      }));
      setForm((prev) => ({ ...prev, puntos: updated }));
    };

    window.google.maps.event.addListener(path, "insert_at", updatePath);
    window.google.maps.event.addListener(path, "remove_at", updatePath);
    window.google.maps.event.addListener(path, "set_at", updatePath);
  };

  // 🖼️ Imágenes
  const handleImagenesChange = (e) => {
    const files = Array.from(e.target.files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setForm({ ...form, imagenes: [...form.imagenes, ...files] });
  };

  const removeImagen = (index) => {
    const imgs = [...form.imagenes];
    URL.revokeObjectURL(imgs[index].preview);
    imgs.splice(index, 1);
    setForm({ ...form, imagenes: imgs });
  };

  // 📤 Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("idinmobiliaria", idinmobiliaria);
      formData.append("idtipoinmobiliaria", form.idtipoinmobiliaria);
      formData.append("nombreproyecto", form.nombreproyecto);
      formData.append("descripcion", form.descripcion);
      formData.append("latitud", form.latitud);
      formData.append("longitud", form.longitud);
      formData.append("puntos", JSON.stringify(form.puntos));

      if (form.idtipoinmobiliaria === "2" && form.precio) {
        formData.append("precio", parseFloat(form.precio));
      }

      form.imagenes.forEach((img) => formData.append("imagenes", img.file));

      const res = await fetch("https://apiinmo.y0urs.com/api/registerProyecto/", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 201 || res.status === 200) {
        alert("✅ Proyecto registrado con éxito");
        onClose();
      } else {
        const errorText = await res.text();
        console.error("Respuesta del servidor:", errorText);
        alert(`⚠️ Error al registrar proyecto (${res.status})`);
      }

    } catch (err) {
      console.error(err);
      alert("🚫 Error de red");
    }
  };

  if (loadError) return <h2>Error cargando el mapa</h2>;
  if (!isLoaded) return <h2>Cargando mapa...</h2>;

  return (
    <div className={style.modalOverlay}>
      <div className={style.modalContent}>
        <button className={style.closeBtn} onClick={onClose}>
          ✖
        </button>

        <form className={style.formContainer} onSubmit={handleSubmit}>
          <h2 style={{ color: "black" }}>Registrar Proyecto</h2>

          {/* Select tipo */}
          <h3 style={{ color: "black" }}>¿Agregarás lotes o casa?</h3>
          <select
            className={style.input}
            name="idtipoinmobiliaria"
            value={form.idtipoinmobiliaria}
            onChange={handleChange}
            required
          >
            <option value="">Seleccione un tipo</option>
            {tipo.map((item) => (
              <option
                key={item.idtipoinmobiliaria}
                value={item.idtipoinmobiliaria}
              >
                {item.nombre}
              </option>
            ))}
          </select>

          {form.idtipoinmobiliaria && (
            <>
              {form.idtipoinmobiliaria === "2" && (
                <>
                  <h3 style={{ color: "black" }}>Precio</h3>
                  <input
                    name="precio"
                    type="number"
                    step="0.01"
                    value={form.precio}
                    onChange={handleChange}
                    className={style.input}
                    required
                  />
                </>
              )}

              <h3 style={{ color: "black" }}>Nombre del Proyecto</h3>
              <input
                name="nombreproyecto"
                value={form.nombreproyecto}
                onChange={handleChange}
                className={style.input}
                required
              />

              <h3 style={{ color: "black" }}>Descripción</h3>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className={style.input}
                required
              />

              <h3 style={{ color: "black" }}>Ubicación y Área</h3>
              <p style={{ fontSize: "14px", color: "gray" }}>
                Busca una ubicación o dibuja el polígono del proyecto.
              </p>

              {/* 🗺️ Mapa con buscador */}
              <div style={{ height: "400px", marginBottom: "20px" }}>
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={defaultCenter}
                  zoom={13}
                  onLoad={onMapLoad}
                  options={{
                    gestureHandling: "greedy",
                    mapTypeControl: true,
                    streetViewControl: false,
                    fullscreenControl: true,
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="🔍 Buscar ubicación..."
                    style={{
                      position: "absolute",
                      top: "10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 10,
                      width: "60%",
                      maxWidth: "400px",
                      padding: "10px 15px",
                      borderRadius: "8px",
                      border: "2px solid #1976d2",
                      fontSize: "14px",
                      backgroundColor: "white",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    }}
                  />

                  <DrawingManager
                    options={{
                      drawingControl: true,
                      drawingControlOptions: {
                        position: window.google.maps.ControlPosition.RIGHT_TOP,
                        drawingModes: ["polygon"],
                      },
                      polygonOptions: {
                        fillColor: "#2196f3",
                        fillOpacity: 0.4,
                        strokeColor: "#1976d2",
                        strokeWeight: 2,
                        editable: true,
                      },
                    }}
                    onPolygonComplete={handlePolygonComplete}
                  />

                  {form.puntos.length > 0 && (
                    <Polygon
                      paths={form.puntos.map((p) => ({
                        lat: p.latitud,
                        lng: p.longitud,
                      }))}
                      options={{
                        fillColor: "#2196f3",
                        fillOpacity: 0.4,
                        strokeColor: "#1976d2",
                        strokeWeight: 2,
                        editable: true,
                      }}
                    />
                  )}
                </GoogleMap>
              </div>

              <h3 style={{ color: "black" }}>Imágenes Referenciales</h3>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImagenesChange}
                className={style.input}
              />
              <div className={style.previewContainer}>
                {form.imagenes.map((img, i) => (
                  <div key={i} className={style.previewItem}>
                    <img src={img.preview} alt={`preview-${i}`} />
                    <button
                      type="button"
                      className={style.removeBtn}
                      onClick={() => removeImagen(i)}
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>

              <button type="submit" className={style.submitBtn}>
                Guardar Proyecto
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
