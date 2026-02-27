import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
// src/pages/inmobiliaria/proyecto/editProyecto.jsx
import React, { useState, useRef, useEffect } from "react";
import { GoogleMap, DrawingManager, Polygon } from "@react-google-maps/api";
import loader from "../../../components/loader";
import "./Proyecto.css";

const defaultCenter = { lat: -6.4882, lng: -76.365629 };
const token = localStorage.getItem("access");
export default function EditProyectoModal({
  onClose,
  proyecto,
  idinmobiliaria,
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef(null);

  const [form, setForm] = useState({
    idproyecto: proyecto?.idproyecto || "",
    idinmobiliaria,
    nombreproyecto: proyecto?.nombreproyecto || "",
    descripcion: proyecto?.descripcion || "",
    latitud: proyecto?.latitud || "",
    longitud: proyecto?.longitud || "",
    puntos: proyecto?.puntos || [],
    imagenes: [], // nuevas imágenes
  });

  useEffect(() => {
    if (!proyecto?.idproyecto) return;

    const fetchPuntos = async () => {
      try {
        const res = await authFetch(
          withApiBase(`https://api.geohabita.com/api/listPuntosProyecto/${proyecto.idproyecto}`)
        );
        const data = await res.json();

        // data debe ser un array de puntos [{latitud, longitud, orden}, ...]
        setForm((prev) => ({
          ...prev,
          puntos: data.map((p) => ({
            latitud: parseFloat(p.latitud),
            longitud: parseFloat(p.longitud),
            orden: p.orden,
          })),
          latitud: data[0]?.latitud || "",
          longitud: data[0]?.longitud || "",
        }));
      } catch (err) {
        console.error("Error cargando puntos:", err);
      }
    };

    fetchPuntos();
  }, [proyecto?.idproyecto]);

  useEffect(() => {
    // Bloquear scroll al abrir
    document.body.style.overflow = "hidden";

    // Cargar Google Maps con el loader centralizado
    loader
      .load()
      .then(() => setIsLoaded(true))
      .catch((err) => console.error("Error cargando Google Maps:", err));

    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // 📌 Manejo de inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // 📌 Polígono
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
      const updatedPuntos = path.getArray().map((point, i) => ({
        latitud: point.lat(),
        longitud: point.lng(),
        orden: i + 1,
      }));
      setForm((prev) => ({ ...prev, puntos: updatedPuntos }));
    };

    window.google.maps.event.addListener(path, "insert_at", updatePath);
    window.google.maps.event.addListener(path, "remove_at", updatePath);
    window.google.maps.event.addListener(path, "set_at", updatePath);
  };

  // 📌 Imágenes
  const handleImagenesChange = (e) => {
    const newFiles = Array.from(e.target.files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setForm({ ...form, imagenes: [...form.imagenes, ...newFiles] });
  };

  const removeImagen = (index) => {
    const imagenes = [...form.imagenes];
    URL.revokeObjectURL(imagenes[index].preview);
    imagenes.splice(index, 1);
    setForm({ ...form, imagenes });
  };

  // 📌 Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("idinmobiliaria", idinmobiliaria);
      formData.append("nombreproyecto", form.nombreproyecto);
      formData.append("descripcion", form.descripcion);
      formData.append("latitud", form.latitud);
      formData.append("longitud", form.longitud);
      formData.append("puntos", JSON.stringify(form.puntos));

      form.imagenes.forEach((img) => {
        formData.append("imagenes", img.file);
      });

      const res = await authFetch(
        withApiBase(`https://api.geohabita.com/api/updateProyecto/${form.idproyecto}/`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (res.ok) {
        alert("✅ Proyecto actualizado con éxito");
        onClose();
      } else {
        const data = await res.json();
        console.error(data);
        alert("❌ Error al actualizar proyecto");
      }
    } catch (err) {
      console.error(err);
      alert("🚫 Error de red");
    }
  };

  if (!isLoaded) return <h2>Cargando mapa...</h2>;

  return (
    <div className="modalOverlay">
      <div className="modalContent">
        <button className="closeBtn" onClick={onClose}>
          ✖
        </button>

        <form className="formContainer" onSubmit={handleSubmit}>
          <h2>Editar Proyecto</h2>

          <label>Nombre del Proyecto</label>
          <input
            name="nombreproyecto"
            value={form.nombreproyecto}
            onChange={handleChange}
            className="input"
            required
          />

          <label>Descripción</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            className="input"
            required
          />

          <label>Ubicación y Área</label>
          <p className="help-text">
            Modifica o vuelve a dibujar el polígono que representa tu proyecto.
          </p>
          <div className="mapContainer">
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={
                form.latitud && form.longitud
                  ? {
                      lat: parseFloat(form.latitud),
                      lng: parseFloat(form.longitud),
                    }
                  : defaultCenter
              }
              zoom={14}
              onLoad={(map) => (mapRef.current = map)}
              options={{ gestureHandling: "greedy" }}
            >
              <DrawingManager
                options={{
                  drawingControl: true,
                  drawingControlOptions: {
                    position: window.google.maps.ControlPosition.TOP_CENTER,
                    drawingModes: ["polygon"],
                  },
                }}
                onPolygonComplete={handlePolygonComplete}
              />
              {form.puntos.length > 0 && (
                <Polygon
                  paths={form.puntos.map((p) => ({
                    lat: parseFloat(p.latitud),
                    lng: parseFloat(p.longitud),
                  }))}
                  options={{
                    fillColor: "#4caf50",
                    strokeColor: "#2e7d32",
                    editable: true, // mejor aquí
                    draggable: false,
                  }}
                  onMouseUp={(e, polygon) => {
                    const path = e.overlay?.getPath?.() || polygon.getPath();
                    if (!path) return;

                    const updatedPuntos = [];
                    for (let i = 0; i < path.getLength(); i++) {
                      updatedPuntos.push({
                        latitud: path.getAt(i).lat(),
                        longitud: path.getAt(i).lng(),
                        orden: i + 1,
                      });
                    }
                    setForm((prev) => ({ ...prev, puntos: updatedPuntos }));
                  }}
                />
              )}
            </GoogleMap>
          </div>

          <label>Imágenes Referenciales</label>
          <input
            type="file"
            multiple
            onChange={handleImagenesChange}
            className="input"
          />
          <div className="previewContainer">
            {form.imagenes.map((img, i) => (
              <div key={i} className="previewItem">
                <img src={img.preview} alt={`preview-${i}`} />
                <button
                  type="button"
                  className="removeBtn"
                  onClick={() => removeImagen(i)}
                >
                  ❌
                </button>
              </div>
            ))}
          </div>

          <button type="submit" className="submitBtn">
            Guardar Cambios
          </button>
        </form>
      </div>
    </div>
  );
}
