import { withApiBase } from "../../../config/api.js";
import React, { useState, useRef, useEffect } from "react";
import { GoogleMap, Polygon, Marker } from "@react-google-maps/api";
import loader from "../../../components/loader";
import styles from "./addproyect.module.css";

const defaultCenter = { lat: -6.4882, lng: -76.365629 };

export default function ProyectoModal({ onClose, idinmobiliaria }) {
  const token = localStorage.getItem("access");
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tipo, setTipo] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    tipo_registro: "",
    idinmobiliaria,
    idtipoinmobiliaria: "",
    nombreproyecto: "",
    descripcion: "",
    latitud: "",
    longitud: "",
    puntos: [],
    imagenes: [],

    precio: "",
    area_total_m2: "",
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
    ancho: 0,
    largo: 0,

  });
  const isCasa = parseInt(form.idtipoinmobiliaria, 10) === 2;
  const casaDimensionFields = [
    { name: "area_total_m2", label: "Area total", step: "0.01" },
    { name: "ancho", label: "Ancho", step: "0.01", required: true },
    { name: "largo", label: "Largo", step: "0.01", required: true },
  ];
  const casaAmbienteFields = [
    { name: "dormitorios", label: "Dormitorios" },
    { name: "banos", label: "Baños" },
    { name: "cuartos", label: "Cuartos" },
    { name: "cochera", label: "Cochera" },
    { name: "cocina", label: "Cocina" },
    { name: "sala", label: "Sala" },
    { name: "patio", label: "Patio" },
    { name: "jardin", label: "Jardín" },
    { name: "terraza", label: "Terraza" },
    { name: "azotea", label: "Azotea" },
  ];


  // useEffect(() => {
  //   if (!isCasa) {
  //     setForm((prev) => ({
  //       ...prev,
  //       dormitorios: 0,
  //       banos: 0,
  //       cuartos: 0,
  //       cochera: 0,
  //       cocina: 0,
  //       sala: 0,
  //       patio: 0,
  //       jardin: 0,
  //       terraza: 0,
  //       azotea: 0,
  //       precio: 0,
  //       area_total_m2: 0,
  //       ancho: 0,
  //       largo: 0,
  //     }));
  //   }
  // }, [isCasa]);

  const mapRef = useRef(null);
  const fileInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const isLoteUnico = form.tipo_registro === "lote_unico";

  useEffect(() => {
    if (form.tipo_registro === "lote_unico") {
      setForm(prev => ({
        ...prev,
        idtipoinmobiliaria: 1 // 👈 Forzamos ID 1 cuando es lote único
      }));
    }
  }, [form.tipo_registro]);
  // Cargar Google Maps
  useEffect(() => {
    loader
      .load()
      .then(() => setIsLoaded(true))
      .catch(() => setLoadError(true));
  }, []);

  // Cargar Tipos
  useEffect(() => {
    fetch(withApiBase("https://api.geohabita.com/api/listTipoInmobiliaria/"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setTipo(data))
      .catch((err) => console.error("Error tipos:", err));
  }, [token]);

  // Configurar Autocomplete con supresión de warning
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    const initAutocomplete = async () => {
      try {
        // Importar places library (esto suprime el warning)
        await window.google.maps.importLibrary("places");

        const input = document.getElementById("autocomplete-input");
        if (!input) {
          console.error("❌ Input no encontrado");
          return;
        }

        // Crear Autocomplete
        const autocomplete = new window.google.maps.places.Autocomplete(input, {
          fields: ["geometry", "name", "formatted_address"],
        });

        autocompleteRef.current = autocomplete;

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          console.log("📍 Lugar seleccionado:", place);

          if (place.geometry && place.geometry.location) {
            const loc = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };

            console.log("✅ Navegando a:", loc);

            if (mapRef.current) {
              mapRef.current.panTo(loc);
              mapRef.current.setZoom(17);
            }

            setForm((prev) => ({
              ...prev,
              latitud: loc.lat,
              longitud: loc.lng,
            }));
          }
        });

        console.log("✅ Autocomplete inicializado correctamente");
      } catch (error) {
        console.error("❌ Error al inicializar autocomplete:", error);
      }
    };

    initAutocomplete();
  }, [isLoaded]);

  // --- Lógica de Dibujo Manual ---
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
  };

  const clearPolygon = () => {
    setForm((prev) => ({ ...prev, puntos: [] }));
    setIsDrawing(false);
  };

  const undoLastPoint = () => {
    setForm((prev) => ({
      ...prev,
      puntos: prev.puntos.slice(0, -1),
    }));
  };

  const handleChange = (e) => {
    console.log("Valor ", e.target.name)
    console.log(e.target.name, e.target.value)
    const { name, value } = e.target;

    const intFields = [
      "dormitorios", "banos", "cuartos", "cochera", "cocina",
      "sala", "patio", "jardin", "terraza", "azotea", "titulo_propiedad",
    ];

    const floatFields = ["precio", "ancho", "largo", "area_total_m2"]; // Añadí area_total aquí

    const normalizedValue = typeof value === "string" ? value.replace(",", ".") : value;

    setForm({
      ...form,
      [name]: intFields.includes(name)
        ? (parseInt(normalizedValue, 10) || 0) // Si es NaN, pone 0
        : floatFields.includes(name)
          ? (parseFloat(normalizedValue) || 0) // Si es NaN, pone 0
          : value,
    });
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación del polígono
    if (form.puntos.length < 3) {
      alert(
        "Por favor, delimite el área del proyecto con al menos 3 puntos en el mapa."
      );
      return;
    }
    setIsSubmitting(true);

    // 🔒 Normalización de datos (CLAVE)
    const normalizedForm = {
      ...form,
      dormitorios: Number(form.dormitorios) || 0,
      banos: Number(form.banos) || 0,
      cuartos: Number(form.cuartos) || 0,
      cochera: Number(form.cochera) || 0,
      cocina: Number(form.cocina) || 0,
      sala: Number(form.sala) || 0,
      patio: Number(form.patio) || 0,
      jardin: Number(form.jardin) || 0,
      terraza: Number(form.terraza) || 0,
      azotea: Number(form.azotea) || 0,
      precio: Number(form.precio) || 0,
      area_total_m2: Number(form.area_total_m2) || 0,
      ancho: Number(form.ancho) || 0,
      largo: Number(form.largo) || 0,
    };

    console.log("Dormitorios normalizado:", normalizedForm.dormitorios);

    const formData = new FormData();

    // 📦 Construcción segura del FormData
    Object.keys(normalizedForm).forEach((key) => {
      if (key === "puntos") {
        formData.append(key, JSON.stringify(normalizedForm[key]));
      } else if (key === "imagenes") {
        normalizedForm.imagenes.forEach((img) => {
          if (img?.file) {
            formData.append("imagenes", img.file);
          }
        });
      } else {
        formData.append(key, normalizedForm[key]);
      }
    });

    // 🧪 Debug FINAL (úsalo solo mientras pruebas)
    console.log("📤 FormData enviado:");
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }

    try {
      const res = await fetch(
        withApiBase("https://api.geohabita.com/api/registerProyecto/"),
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${token}`,
            // ❌ NO pongas Content-Type con FormData
          },
        }
      );

      if (res.ok) {
        setSuccess(true);

        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
        }, 500);
      } else {
        setIsSubmitting(false);
        alert("⚠️ Error en registro");
      }

    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
      alert("🚫 Error de red");
    }

  };

  if (loadError) return <div className={styles.loaderMsg}>Error de mapa</div>;
  if (!isLoaded) return <div className={styles.loaderMsg}>Cargando...</div>;



  return (

    <div className={styles.modalOverlay}>
      {isSubmitting && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingModal}>
            {!success ? (
              <>
                <span className="material-icons-outlined styles.spinner">
                  autorenew
                </span>
                <h3>Subiendo proyecto...</h3>
                <p>Por favor espera, estamos procesando la información</p>
              </>
            ) : (
              <>
                <span className={styles.successIcon}>
                  <span className="material-icons-outlined">check_circle</span>
                </span>
                <h3>¡Proyecto subido con éxito!</h3>
                <p>Tu proyecto ya fue registrado correctamente</p>
              </>
            )}
          </div>
        </div>
      )}
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Registrar Proyecto Inmobiliario</h1>
            <p className={styles.subtitle}>
              Completa la información detallada para publicar tu nuevo proyecto.
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
                <h4 class="info-title">¿Qué opción debo seleccionar?</h4>
                <p className={styles.smallInfo}>
                  • <strong>Único lote:</strong><br />Selecciona “Lote único” en <strong>Agregar proyecto o lote único</strong>.<br /><br />

                  • <strong>Casa única:</strong> 
                  <br />
                  Selecciona “Proyecto” y luego “Casa única” en <strong>Tipo de proyecto</strong>.<br /><br />

                  • <strong>Conjunto lotes/casas/departamentos:</strong>
                  <br />
                   Selecciona “Proyecto” y luego “Conjunto de Lotes / Casas / Departamentos” en <strong>Tipo de proyecto</strong>.
                </p>

                <h2 className={styles.sectionTitle}>
                  <span className="material-icons-outlined">info</span>{" "}
                  Información
                </h2>

                <div className={styles.inputGroup}>
                  <label>Agregar proyecto o lote único</label>
                  <select
                    name="tipo_registro"
                    value={form.tipo_registro}
                    onChange={handleChange}
                    className={styles.select}
                    required
                  >
                    <option value="">Seleccione...</option>
                    <option value="proyecto">Proyecto</option>
                    <option value="lote_unico">Lote único</option>
                  </select>
                </div>

                {!isLoteUnico && (
                  <div className={styles.inputGroup}>
                    <label>Tipo de Proyecto o casa única</label>
                    <select
                      name="idtipoinmobiliaria"
                      value={form.idtipoinmobiliaria}
                      onChange={handleChange}
                      className={styles.select}
                      required
                    >
                      <option value="">Seleccione...</option>
                      {tipo.map((t) => {
                        let nombrePersonalizado = t.nombre;

                        if (t.nombre === "LOTE") {
                          nombrePersonalizado = "Conjunto Lotes/Casas/Departamentos";
                        }

                        if (t.nombre === "CASA") {
                          nombrePersonalizado = "Casa única";
                        }

                        return (
                          <option
                            key={t.idtipoinmobiliaria}
                            value={t.idtipoinmobiliaria}
                          >
                            {nombrePersonalizado}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                <div className={styles.inputGroup}>
                  <label>Nombre</label>
                  <input
                    name="nombreproyecto"
                    value={form.nombreproyecto}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Descripción</label>
                  <textarea
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    className={styles.textarea}
                    rows="4"
                    required
                  />
                </div>

                {isLoteUnico && (
                  <>
                    <div className={styles.inputGroup}>
                      <label>¿Cuenta con título de propiedad?</label>
                      <select
                        name="titulo_propiedad"
                        value={form.titulo_propiedad}
                        onChange={handleChange}
                        className={styles.select}
                      >
                        <option value={0}>No</option>
                        <option value={1}>Sí</option>
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label>Precio en dólares</label>
                      <input
                        type="number"
                        step="0.01"
                        name="precio"
                        value={form.precio}
                        onChange={handleChange}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.compactGrid}>
                      <div className={styles.compactField}>
                        <label>Área total (m²)</label>
                        <input
                          type="number"
                          step="0.01"
                          name="area_total_m2"
                          value={form.area_total_m2}
                          onChange={handleChange}
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.compactField}>
                        <label>Ancho</label>
                        <input
                          type="number"
                          step="0.01"
                          name="ancho"
                          value={form.ancho}
                          onChange={handleChange}
                          className={styles.input}
                        />
                      </div>

                      <div className={styles.compactField}>
                        <label>Largo</label>
                        <input
                          type="number"
                          step="0.01"
                          name="largo"
                          value={form.largo}
                          onChange={handleChange}
                          className={styles.input}
                        />
                      </div>
                    </div>
                  </>
                )}

                {isCasa && (
                  <>
                    <div className={styles.inputGroup}>
                      <label>¿Cuenta con título de propiedad?</label>
                      <select
                        name="titulo_propiedad"
                        value={form.titulo_propiedad}
                        onChange={handleChange}
                        className={styles.select}
                        required
                      >
                        <option value={0}>No</option>
                        <option value={1}>Sí</option>
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label>Precio en dolares:</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="precio"
                        value={form.precio}
                        onChange={handleChange}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.compactGrid}>
                      {casaDimensionFields.map((field) => (
                        <div key={field.name} className={styles.compactField}>
                          <label htmlFor={field.name}>{field.label}</label>
                          <input
                            id={field.name}
                            type="number"
                            min="0"
                            step={field.step}
                            name={field.name}
                            value={form[field.name]}
                            onChange={handleChange}
                            className={`${styles.input} ${styles.compactInput}`}
                            required={field.required}
                          />
                        </div>
                      ))}
                    </div>

                    <div className={styles.compactGrid}>
                      {casaAmbienteFields.map((field) => (
                        <div key={field.name} className={styles.compactField}>
                          <label htmlFor={field.name}>{field.label}</label>
                          <input
                            id={field.name}
                            type="number"
                            min="0"
                            name={field.name}
                            value={form[field.name]}
                            onChange={handleChange}
                            className={`${styles.input} ${styles.compactInput}`}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}


              </section>

              <section>
                <h2 className={styles.sectionTitle}>
                  <span className="material-icons-outlined">collections</span>{" "}
                  Imágenes
                </h2>
                <div className={styles.imageUploadContainer}>
                  {/* Mostrar primera imagen grande si existe */}
                  {form.imagenes.length > 0 ? (
                    <div className={styles.mainImageWrapper}>
                      <div className={styles.mainImagePreview}>
                        <img src={form.imagenes[0].preview} alt="Principal" />
                        <button
                          type="button"
                          className={styles.removeMainImage}
                          onClick={() => removeImagen(0)}
                        >
                          <span className="material-icons-outlined">close</span>
                        </button>
                      </div>
                      <p className={styles.imageCounter}>
                        Fotos - {form.imagenes.length}/10
                      </p>
                    </div>
                  ) : null}

                  {/* Botón de subir y miniaturas */}
                  <div className={styles.uploadSection}>
                    <div
                      className={styles.uploadBox}
                      onClick={() => fileInputRef.current.click()}
                    >
                      <span className="material-icons-outlined">
                        add_photo_alternate
                      </span>
                      <p>Agregar foto</p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        accept="image/*"
                        onChange={handleImagenesChange}
                        hidden
                      />
                    </div>

                    {/* Miniaturas de imágenes adicionales */}
                    {form.imagenes.length > 1 && (
                      <div className={styles.thumbnailGrid}>
                        {form.imagenes.slice(1).map((img, i) => (
                          <div key={i + 1} className={styles.thumbnailItem}>
                            <img src={img.preview} alt={`Foto ${i + 2}`} />
                            <button
                              type="button"
                              onClick={() => removeImagen(i + 1)}
                              className={styles.removeThumbnail}
                            >
                              <span className="material-icons-outlined">
                                close
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className={styles.rightColumn}>
              <h2 className={styles.sectionTitle}>
                <span className="material-icons-outlined">map</span> Ubicación y
                Polígono
              </h2>

              <div className={styles.mapWrapper}>
                {/* Input de búsqueda simple y directo */}
                <div className={styles.searchWrapper}>
                  <input
                    id="autocomplete-input"
                    type="text"
                    placeholder="Buscar ubicación..."
                    className={styles.mapSearchInput}
                  />
                </div>

                <GoogleMap
                  mapContainerClassName={styles.googleMap}
                  center={defaultCenter}
                  zoom={14}
                  onLoad={(map) => (mapRef.current = map)}
                  onClick={handleMapClick}
                  options={{
                    disableDefaultUI: false,
                    streetViewControl: false,
                    mapTypeControl: false,
                    gestureHandling: "greedy",
                  }}
                >
                  {/* Dibujo del polígono en tiempo real */}
                  {form.puntos.length > 0 && (
                    <Polygon
                      paths={form.puntos.map((p) => ({
                        lat: p.latitud,
                        lng: p.longitud,
                      }))}
                      options={{
                        fillColor: "#1E40AF",
                        fillOpacity: 0.35,
                        strokeColor: "#1E40AF",
                        strokeWeight: 3,
                      }}
                    />
                  )}

                  {/* Marcadores de los vértices */}
                  {form.puntos.map((p, idx) => (
                    <Marker
                      key={idx}
                      position={{ lat: p.latitud, lng: p.longitud }}
                      label={`${idx + 1}`}
                    />
                  ))}

                  {/* Botonera Flotante del Mapa */}
                  <div className={styles.mapControls}>
                    {form.puntos.length > 0 ? (
                      <button
                        type="button"
                        className={`${styles.mapBtn} ${isDrawing ? styles.mapBtnActive : ""}`}
                        onClick={() => setIsDrawing(!isDrawing)}
                        title={isDrawing ? "Finalizar dibujo" : "Editar área"}
                        aria-label={
                          isDrawing ? "Finalizar dibujo" : "Editar área"
                        }
                      >
                        <span className="material-icons-outlined">
                          {isDrawing ? "check_circle" : "edit_location_alt"}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`${styles.mapBtn} ${isDrawing ? styles.mapBtnActive : ""}`}
                        onClick={() => setIsDrawing(true)}
                        title="Dibujar área"
                        aria-label="Dibujar área"
                      >
                        <span className="material-icons-outlined">
                          edit_location_alt
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      className={styles.mapBtn}
                      onClick={undoLastPoint}
                      disabled={form.puntos.length === 0}
                      title="Deshacer último punto"
                    >
                      <span className="material-icons-outlined">undo</span>
                      {/* Deshacer */}
                    </button>

                    <button
                      type="button"
                      className={styles.mapBtn}
                      onClick={clearPolygon}
                      disabled={form.puntos.length === 0}
                      title="Eliminar todos los puntos"
                    >
                      <span className="material-icons-outlined">delete</span>
                      {/* Limpiar Todo */}
                    </button>
                  </div>
                </GoogleMap>
              </div>
              <p className={styles.mapHint}>
                {isDrawing ? (
                  `Haz clic en el mapa para añadir vértices (${form.puntos.length} puntos). Usa 'Deshacer' para eliminar el último punto.`
                ) : (
                  <>
                    Presiona el botón{" "}
                    <span className="material-icons-outlined">
                      edit_location_alt
                    </span>{" "}
                    para trazar el polígono del proyecto
                  </>
                )}
              </p>
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.submitBtn}>
              Guardar Proyecto{" "}
              <span className="material-icons-outlined">arrow_forward</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
