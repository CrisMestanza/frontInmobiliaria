import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
import { getResponseErrorMessage } from "../../../utils/apiErrors.js";
// components/LoteModal.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, Polygon, DrawingManager } from "@react-google-maps/api";
import style from "../proyecto/addproyect.module.css";
import loader from "../../../components/loader";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { loadPdfFromIndexedDB } from "../../../components/utils/indexedDB";

const DEFAULT_MAP_CENTER = { lat: -6.4882, lng: -76.365629 };

const hasGoogleMapConstructor = () =>
  typeof window !== "undefined" &&
  typeof window.google?.maps?.Map === "function";

const loadGoogleMapsApi = async () => {
  if (hasGoogleMapConstructor()) return window.google;

  await loader.importLibrary("maps");
  await Promise.all([
    loader.importLibrary("drawing"),
    loader.importLibrary("geometry"),
    loader.importLibrary("places"),
  ]);

  if (!hasGoogleMapConstructor()) {
    await loader.load();
  }

  if (!hasGoogleMapConstructor()) {
    throw new Error("Google Maps API no expuso google.maps.Map.");
  }

  return window.google;
};

export default function LoteModal({ onClose, idproyecto, embedded = false }) {
  const [form, setForm] = useState({
    idtipoinmobiliaria: 0,
    nombre: "",
    precio: 0,
    latitud: "",
    longitud: "",
    descripcion: "",
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
    puntos: [],
    imagenes: [],
    vendido: 0,
  });

  const [tipos, setTipos] = useState([]);
  const [mapCenter, setMapCenter] = useState(null);
  const [proyectoCoords, setProyectoCoords] = useState([]);
  const [lotesCoords, setLotesCoords] = useState([]);
  const [baseMapStyle, setBaseMapStyle] = useState("roadmap");
  const [reliefEnabled, setReliefEnabled] = useState(false);
  const [labelsEnabled, setLabelsEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const token = localStorage.getItem("access");
  const isCasa = form.idtipoinmobiliaria === 2;
  const originalPdfImageRef = useRef(null);
  const [pdfImage, setPdfImage] = useState(null);
  const [overlayBounds, setOverlayBounds] = useState(null);
  const [pdfRotation, setPdfRotation] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);
  const overlayRef = useRef(null);
  const proyectoCoordsRef = useRef([]);
  const fileInputRef = useRef(null);

  const pruneDuplicateDrawingControls = useCallback(() => {
    const mapDiv = mapRef.current?.getDiv?.();
    if (!mapDiv) return;

    const buttons = Array.from(mapDiv.querySelectorAll("button"));
    const rectButtons = buttons.filter((btn) => {
      const label = `${btn.getAttribute("title") || ""} ${btn.getAttribute("aria-label") || ""}`
        .toLowerCase()
        .replace(/\s+/g, " ");
      return label.includes("rect") || label.includes("rectáng");
    });

    rectButtons.forEach((btn) => {
      const control = btn.closest(".gmnoprint");
      if (control) control.remove();
    });
  }, []);

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

  const createRotatableOverlay = useCallback(
    (bounds, image, rotation, opacity) => {
      if (!googleRef.current) return null;

      class RotatableOverlay extends googleRef.current.maps.OverlayView {
        constructor() {
          super();
          this.bounds = bounds;
          this.image = image;
          this.rotation = rotation;
          this.opacity = opacity;
          this.div = null;
        }

        onAdd() {
          const div = document.createElement("div");
          div.style.borderStyle = "none";
          div.style.borderWidth = "0px";
          div.style.position = "absolute";
          div.style.transformOrigin = "center center";

          const img = document.createElement("img");
          img.src = this.image;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.opacity = this.opacity;
          img.style.position = "absolute";
          div.appendChild(img);

          this.div = div;
          const panes = this.getPanes();
          panes.overlayLayer.appendChild(div);
        }

        draw() {
          const overlayProjection = this.getProjection();
          if (!overlayProjection || !this.div) return;

          const sw = overlayProjection.fromLatLngToDivPixel(
            new googleRef.current.maps.LatLng(
              this.bounds.south,
              this.bounds.west,
            ),
          );
          const ne = overlayProjection.fromLatLngToDivPixel(
            new googleRef.current.maps.LatLng(
              this.bounds.north,
              this.bounds.east,
            ),
          );

          const width = ne.x - sw.x;
          const height = sw.y - ne.y;
          const centerX = (sw.x + ne.x) / 2;
          const centerY = (sw.y + ne.y) / 2;

          this.div.style.left = centerX - width / 2 + "px";
          this.div.style.top = centerY - height / 2 + "px";
          this.div.style.width = width + "px";
          this.div.style.height = height + "px";
          this.div.style.transform = `rotate(${this.rotation}deg)`;
        }

        onRemove() {
          if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
        }

        updateBounds(newBounds) {
          this.bounds = newBounds;
          this.draw();
        }

        updateRotation(newRotation) {
          this.rotation = newRotation;
          this.draw();
        }

        updateOpacity(newOpacity) {
          this.opacity = newOpacity;
          if (this.div) {
            const img = this.div.querySelector("img");
            if (img) img.style.opacity = newOpacity;
          }
        }

        updateImage(newImage) {
          this.image = newImage;
          if (this.div) {
            const img = this.div.querySelector("img");
            if (img) img.src = newImage;
          }
        }
      }

      return new RotatableOverlay();
    },
    [],
  );

  //  cargar Google Maps desde loader.js
  useEffect(() => {
    let active = true;
    loadGoogleMapsApi()
      .then((googleInstance) => {
        if (!active) return;
        setIsLoaded(true);
        googleRef.current = googleInstance;
      })
      .catch((error) => {
        console.error("Error cargando Google Maps:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadSavedPDF = async () => {
      if (!isLoaded || !mapCenter) return;
      try {
        const pdfBlob = await loadPdfFromIndexedDB(idproyecto);
        if (pdfBlob) {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          const typedArray = new Uint8Array(arrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const page = await pdf.getPage(1);

          const scale = 2.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const imageUrl = canvas.toDataURL("image/png");
          originalPdfImageRef.current = imageUrl;
          setPdfImage(imageUrl);

          const savedMeta = localStorage.getItem(`pdf_meta_${idproyecto}`);
          if (savedMeta) {
            const meta = JSON.parse(savedMeta);
            setOverlayBounds(meta.bounds);
            setOverlayOpacity(meta.opacity || 0.6);
            setPdfRotation(meta.rotation || 0);
          } else {
            setPdfRotation(0);
            const centerLat = mapCenter.lat;
            const centerLng = mapCenter.lng;
            const aspectRatio = viewport.height / viewport.width;
            const widthDegrees = 0.002;
            const heightDegrees = widthDegrees * aspectRatio;

            setOverlayBounds({
              north: centerLat + heightDegrees / 2,
              south: centerLat - heightDegrees / 2,
              east: centerLng + widthDegrees / 2,
              west: centerLng - widthDegrees / 2,
            });
          }
        }
      } catch (error) {
        console.warn("No hay PDF previo para este proyecto", error);
      }
    };
    loadSavedPDF();
  }, [idproyecto, isLoaded, mapCenter]);

  useEffect(() => {
    if (!mapRef.current || !googleRef.current) return;

    if (!pdfImage || !overlayBounds) {
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      return;
    }

    if (!overlayRef.current) {
      overlayRef.current = createRotatableOverlay(
        overlayBounds,
        pdfImage,
        pdfRotation,
        overlayOpacity,
      );
      overlayRef.current.setMap(mapRef.current);
      return;
    }

    overlayRef.current.updateBounds(overlayBounds);
    overlayRef.current.updateRotation(pdfRotation);
    overlayRef.current.updateOpacity(overlayOpacity);
    overlayRef.current.updateImage(pdfImage);
  }, [
    pdfImage,
    overlayBounds,
    pdfRotation,
    overlayOpacity,
    createRotatableOverlay,
  ]);
  useEffect(() => {
    proyectoCoordsRef.current = proyectoCoords;
  }, [proyectoCoords]);

  // 👉 cargar puntos del proyecto y lotes
  // const fetchProyecto = useCallback(async () => {
  //   try {
  //     const resProyecto = await fetch(
  //       https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}
  //     );
  //     const puntosProyecto = await resProyecto.json();

  //     if (!puntosProyecto.length) return;

  //     setMapCenter({
  //       lat: parseFloat(puntosProyecto[0].latitud),
  //       lng: parseFloat(puntosProyecto[0].longitud),
  //     });

  //     setProyectoCoords(
  //       puntosProyecto.map((p) => ({
  //         lat: parseFloat(p.latitud),
  //         lng: parseFloat(p.longitud),
  //       }))
  //     );

  //     // cargar lotes
  //     const resLotes = await fetch(
  //       https://api.geohabita.com/api/getLoteProyecto/${idproyecto}
  //     );
  //     const lotes = await resLotes.json();

  //     const lotesData = [];
  //     for (const lote of lotes) {
  //       const resPuntos = await fetch(
  //         https://api.geohabita.com/api/listPuntos/${lote.idlote}
  //       );
  //       const puntos = await resPuntos.json();
  //       if (!puntos.length) continue;

  //       const coords = puntos
  //         .sort((a, b) => a.orden - b.orden)
  //         .map((p) => ({
  //           lat: parseFloat(p.latitud),
  //           lng: parseFloat(p.longitud),
  //         }));

  //       if (coords.length > 2) coords.push(coords[0]); // cerrar polígono
  //       lotesData.push({ coords, vendido: lote.vendido });
  //     }
  //     setLotesCoords(lotesData);
  //   } catch (err) {
  //     console.error("Error cargando proyecto/lotes:", err);
  //   }
  // }, [idproyecto]);
  useEffect(() => {
    if (!isCasa) {
      setForm((prev) => ({
        ...prev,
        dormitorios: 0,
        banos: 0,
        cuartos: 0,
        cochera: 0,
        cocina: 0,
        sala: 0,
        patio: 0,
        jardin: 0,
        terraza: 0,
        azotea: 0,
      }));
    }
  }, [isCasa]);

  const fetchProyecto = useCallback(async () => {
    try {
      // 🔹 Polígono del proyecto (siempre debe cargarse, incluso sin lotes)
      const resPuntosProyecto = await authFetch(
        withApiBase(`https://api.geohabita.com/api/listPuntosProyecto/${idproyecto}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const puntosProyecto = await resPuntosProyecto.json();
      const orderedProyecto = puntosProyecto
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({
          lat: parseFloat(p.latitud),
          lng: parseFloat(p.longitud),
        }));

      if (!orderedProyecto.length) {
        setMapCenter(DEFAULT_MAP_CENTER);
        setProyectoCoords([]);
      } else {
        // centro del mapa tomando el primer punto del proyecto
        setMapCenter(orderedProyecto[0]);

        if (orderedProyecto.length > 2) {
          orderedProyecto.push(orderedProyecto[0]); // cerrar polígono
        }
        setProyectoCoords(orderedProyecto);
      }

      // 🔹 Lotes ya registrados (puede venir vacío en proyecto nuevo)
      const resProyecto = await authFetch(
        withApiBase(`https://api.geohabita.com/api/listPuntosLoteProyecto/${idproyecto}/`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await resProyecto.json();

      // 🔹 Lotes con sus coordenadas ya incluidas
      const lotesData = data.map((lote) => ({
        coords: (lote.puntos || [])
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({
          lat: parseFloat(p.latitud),
          lng: parseFloat(p.longitud),
        })),
        vendido: lote.vendido,
      }));

      setLotesCoords(lotesData);
    } catch (err) {
      console.error("Error cargando proyecto/lotes:", err);
      setMapCenter((prev) => prev || DEFAULT_MAP_CENTER);
    }
  }, [idproyecto, token]);

  useEffect(() => {
    if (isLoaded) {
      fetchProyecto();
    }
  }, [fetchProyecto, isLoaded]);

  const applyMapType = useCallback(
    (map) => {
      if (!map) return;
      if (baseMapStyle === "satellite") {
        map.setMapTypeId(labelsEnabled ? "hybrid" : "satellite");
        return;
      }
      map.setMapTypeId(reliefEnabled ? "terrain" : "roadmap");
    },
    [baseMapStyle, labelsEnabled, reliefEnabled],
  );

  // 👉 cargar tipos de inmobiliaria
  useEffect(() => {
    const fetchTipos = async () => {
      try {
        const res = await authFetch(
          withApiBase(`https://api.geohabita.com/api/listTipoInmobiliaria/`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        setTipos(data);
        if (data.length > 0) {
          setForm((prev) => ({
            ...prev,
            idtipoinmobiliaria: parseInt(data[0].idtipoinmobiliaria, 10),
          }));
        }
      } catch (err) {
        console.error("Error al cargar tipos:", err);
      }
    };
    fetchTipos();
  }, [token]);

  const getColorLote = (vendido) => {
    switch (vendido) {
      case 0:
        return "#00ff00"; // libre
      case 1:
        return "#ff0000"; // vendido
      case 2:
        return "#ffff00"; // reservado
      default:
        return "#808080"; // gris
    }
  };

  // 👉 cuando el usuario termina de dibujar un lote
  const onPolygonComplete = (polygon) => {
    const currentProyectoCoords = proyectoCoordsRef.current || [];
    if (currentProyectoCoords.length < 3) {
      alert("El polígono del proyecto aún no está listo.");
      polygon.setMap(null);
      return;
    }
    const path = polygon.getPath().getArray();
    const loteCoords = path.map((c, i) => ({
      latitud: c.lat(),
      longitud: c.lng(),
      orden: i + 1,
    }));

    // validar dentro del proyecto
    const proyectoPolygon = new window.google.maps.Polygon({
      paths: currentProyectoCoords,
    });

    const isInside = loteCoords.every((coord) =>
      window.google.maps.geometry.poly.containsLocation(
        new window.google.maps.LatLng(coord.latitud, coord.longitud),
        proyectoPolygon
      )
    );

    if (!isInside) {
      alert("El lote debe estar dentro del proyecto ❌");
      polygon.setMap(null);
      return;
    }

    setForm((prev) => ({
      ...prev,
      puntos: loteCoords,
      latitud: loteCoords[0]?.latitud || "",
      longitud: loteCoords[0]?.longitud || "",
      vendido: 0,
    }));
  };

  // 👉 handlers de formulario
  const handleTipoChange = (e) =>
    setForm({ ...form, idtipoinmobiliaria: parseInt(e.target.value, 10) });

  const handleChange = (e) => {
    const { name, value } = e.target;

    const intFields = [
      "dormitorios",
      "banos",
      "cuartos",
      "cochera",
      "cocina",
      "sala",
      "patio",
      "jardin",
      "terraza",
      "azotea",
      "titulo_propiedad",
    ];

    const floatFields = ["precio", "ancho", "largo"];

    // 👉 normaliza coma a punto
    const normalizedValue =
      typeof value === "string" ? value.replace(",", ".") : value;

    setForm({
      ...form,
      [name]: intFields.includes(name)
        ? parseInt(normalizedValue, 10) || 0
        : floatFields.includes(name)
          ? parseFloat(normalizedValue) || 0
          : value,
    });
  };


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

  useEffect(() => {
    return () => {
      form.imagenes.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  }, [form.imagenes]);

  // 👉 enviar datos al backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("idproyecto", idproyecto);
    formData.append("idtipoinmobiliaria", form.idtipoinmobiliaria.toString());
    formData.append("nombre", form.nombre);
    formData.append("precio", form.precio.toString());
    formData.append("latitud", form.latitud);
    formData.append("longitud", form.longitud);
    formData.append("descripcion", form.descripcion);
    formData.append("area_total_m2", form.area_total_m2);
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
    formData.append("ancho", form.ancho);
    formData.append("largo", form.largo);
    formData.append("puntos", JSON.stringify(form.puntos));
    formData.append("vendido", form.vendido.toString());
    form.imagenes.forEach((img) => {
      formData.append("imagenes", img.file);
    });
    console.log("Enviando formulario:", form);
    try {
      const res = await authFetch(withApiBase("https://api.geohabita.com/api/registerLote/"), {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        telegramContext: {
          action: `Intento de registrar lote: ${form.nombre || "sin nombre"} en proyecto ${idproyecto}`,
        },
      });

      if (res.ok) {
        if (window.alertSuccess) window.alertSuccess("Lote registrado.");
        else alert("Lote registrado.");
        onClose();
      } else {
        const message = await getResponseErrorMessage(
          res,
          "No se pudo registrar el lote. Revisa los datos ingresados.",
        );
        console.error(message);
        if (window.alertError) window.alertError(message);
        else alert(message);
      }
    } catch (err) {
      console.error(err);
      const message =
        err?.message || "No se pudo conectar con el servidor para registrar el lote.";
      if (window.alertError) window.alertError(message);
      else alert(message);
    }
  };

  const effectiveMapCenter = mapCenter || DEFAULT_MAP_CENTER;

  const overlayStyle = embedded
    ? {
        position: "relative",
        inset: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: 0,
        zIndex: "auto",
        alignItems: "stretch",
        display: "block",
        overflow: "visible",
      }
    : undefined;

  const contentStyle = embedded
    ? {
        width: "100%",
        maxWidth: "none",
        minHeight: "auto",
        height: "auto",
        maxHeight: "none",
        borderRadius: "24px",
        boxShadow: "none",
        overflow: "visible",
        border: "1px solid rgba(148, 163, 184, 0.16)",
      }
    : undefined;

  return (
    <div className={style.modalOverlay} style={overlayStyle}>
      <div className={style.modalContent} style={contentStyle}>
        {!embedded && (
          <button className={style.closeBtn} onClick={onClose}>
            ✖
          </button>
        )}
        <div className={style.header}>
          <div>
            <h1 className={style.title}>Registrar lote manual</h1>
            <p className={style.subtitle}>
              Crea un lote individual dentro del proyecto, define su polígono y carga su ficha comercial sin salir del dashboard.
            </p>
          </div>
        </div>

        <form className={style.formBody} onSubmit={handleSubmit}>
          <div className={style.gridContainer}>
            <div className={style.leftColumn}>
              <section className={style.sectionCard}>
                <h2 className={style.sectionTitle}>
                  <span className="material-icons-outlined">inventory_2</span>
                  Detalles del lote
                </h2>

                <div className={style.inputGroup}>
                  <label>Tipo</label>
                  <select
                    name="idtipoinmobiliaria"
                    value={form.idtipoinmobiliaria}
                    onChange={handleTipoChange}
                    className={style.select}
                    required
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
                    required
                  />
                </div>

                <div className={style.inputGroup}>
                  <label>Precio</label>
                  <input
                    name="precio"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precio}
                    onChange={handleChange}
                    className={style.input}
                    required
                  />
                </div>

                <div className={style.inputGroup}>
                  <label>Descripción</label>
                  <textarea
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    className={style.textarea}
                    rows="3"
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
                      type="number"
                      step="0.01"
                      min="0"
                      name="ancho"
                      value={form.ancho}
                      onChange={handleChange}
                      className={style.input}
                      required
                    />
                  </div>
                  <div className={style.compactField}>
                    <label>Largo (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="largo"
                      value={form.largo}
                      onChange={handleChange}
                      className={style.input}
                      required
                    />
                  </div>
                </div>

                <div className={style.compactGrid}>
                  <div className={style.compactField}>
                    <label>Latitud</label>
                    <input
                      name="latitud"
                      value={form.latitud}
                      readOnly
                      className={style.input}
                    />
                  </div>
                  <div className={style.compactField}>
                    <label>Longitud</label>
                    <input
                      name="longitud"
                      value={form.longitud}
                      readOnly
                      className={style.input}
                    />
                  </div>
                  <div className={style.compactField}>
                    <label>Título de propiedad</label>
                    <select
                      name="titulo_propiedad"
                      value={form.titulo_propiedad}
                      onChange={handleChange}
                      className={style.select}
                    >
                      <option value="1">Sí</option>
                      <option value="0">No</option>
                    </select>
                  </div>
                </div>

                {isCasa && (
                  <div className={style.compactGrid}>
                    <div className={style.compactField}>
                      <label>Dormitorios</label>
                      <input name="dormitorios" type="number" min="0" value={form.dormitorios} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Baños</label>
                      <input name="banos" type="number" min="0" value={form.banos} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Cuartos</label>
                      <input name="cuartos" type="number" min="0" value={form.cuartos} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Cochera</label>
                      <input name="cochera" type="number" min="0" value={form.cochera} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Cocina</label>
                      <input name="cocina" type="number" min="0" value={form.cocina} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Sala</label>
                      <input name="sala" type="number" min="0" value={form.sala} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Patio</label>
                      <input name="patio" type="number" min="0" value={form.patio} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Jardín</label>
                      <input name="jardin" type="number" min="0" value={form.jardin} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Terraza</label>
                      <input name="terraza" type="number" min="0" value={form.terraza} onChange={handleChange} className={style.input} />
                    </div>
                    <div className={style.compactField}>
                      <label>Azotea</label>
                      <input name="azotea" type="number" min="0" value={form.azotea} onChange={handleChange} className={style.input} />
                    </div>
                  </div>
                )}
              </section>

              <section className={style.sectionCard}>
                <h2 className={style.sectionTitle}>
                  <span className="material-icons-outlined">collections</span>
                  Imágenes
                </h2>

                <div className={style.imageUploadContainer}>
                  {form.imagenes.length > 0 ? (
                    <div className={style.mainImageWrapper}>
                      <div className={style.mainImagePreview}>
                        <img src={form.imagenes[0].preview} alt="Principal" />
                        <button type="button" className={style.removeMainImage} onClick={() => removeImagen(0)}>
                          <span className="material-icons-outlined">close</span>
                        </button>
                      </div>
                      <p className={style.imageCounter}>Fotos - {form.imagenes.length}/10</p>
                    </div>
                  ) : null}

                  <div className={style.uploadSection}>
                    <div className={style.uploadBox} onClick={() => fileInputRef.current?.click()}>
                      <span className="material-icons-outlined">add_photo_alternate</span>
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

                    {form.imagenes.length > 1 && (
                      <div className={style.thumbnailGrid}>
                        {form.imagenes.slice(1).map((img, i) => (
                          <div key={i + 1} className={style.thumbnailItem}>
                            <img src={img.preview} alt={`Foto ${i + 2}`} />
                            <button type="button" onClick={() => removeImagen(i + 1)} className={style.removeThumbnail}>
                              <span className="material-icons-outlined">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <div className={style.actionRow}>
                <button type="button" className={style.cancelBtn} onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className={style.submitBtn}>
                  Guardar lote
                  <span className="material-icons-outlined">arrow_forward</span>
                </button>
              </div>
            </div>

            <div className={style.rightColumn}>
              <h2 className={style.sectionTitle}>
                <span className="material-icons-outlined">map</span> Ubicación y polígono
              </h2>

              <div className={style.mapWrapper}>
                <p className={style.mapHint}>
                  Usa la herramienta de polígono para dibujar el nuevo lote dentro del proyecto. El sistema valida que no se salga del perímetro.
                </p>
                <div className={style.mapContainerWrap}>
                  {isLoaded ? (
                    <GoogleMap
                      mapContainerClassName={style.googleMap}
                      zoom={16}
                      center={effectiveMapCenter}
                      options={{ gestureHandling: "greedy", mapTypeControl: false }}
                      onLoad={(map) => {
                        mapRef.current = map;
                        applyMapType(map);
                        pruneDuplicateDrawingControls();
                      }}
                    >
                      {proyectoCoords.length > 0 && (
                        <Polygon
                          paths={proyectoCoords}
                          options={{
                            strokeColor: "#1d4ed8",
                            strokeWeight: 2,
                            fillColor: "#1d4ed8",
                            fillOpacity: 0.12,
                          }}
                        />
                      )}

                      {lotesCoords.map((lote, i) => (
                        <Polygon
                          key={i}
                          paths={lote.coords}
                          options={{
                            strokeColor: "#334155",
                            strokeWeight: 1,
                            fillColor: getColorLote(lote.vendido),
                            fillOpacity: 0.35,
                          }}
                        />
                      ))}

                      <DrawingManager
                        onLoad={(dm) => {
                          if (drawingManagerRef.current && drawingManagerRef.current !== dm) {
                            drawingManagerRef.current.setMap(null);
                          }
                          drawingManagerRef.current = dm;
                          setTimeout(pruneDuplicateDrawingControls, 0);
                        }}
                        onUnmount={(dm) => {
                          dm?.setMap(null);
                          drawingManagerRef.current = null;
                        }}
                        onPolygonComplete={onPolygonComplete}
                        options={{
                          drawingControl: true,
                          drawingControlOptions: {
                            drawingModes: ["polygon"],
                          },
                          polygonOptions: {
                            editable: true,
                            draggable: true,
                          },
                        }}
                      />
                    </GoogleMap>
                  ) : (
                    <div className={style.mapLoadingState}>Cargando mapa...</div>
                  )}
                  {isLoaded && (
                  <div className={style.mapTypeControlWrap}>
                    <div className={style.mapTypeTabs} aria-label="Tipo de mapa">
                      <button
                        type="button"
                        className={`${style.mapTypeBtn} ${baseMapStyle === "roadmap" ? style.mapTypeBtnActive : ""}`}
                        onClick={() => {
                          setBaseMapStyle("roadmap");
                          applyMapType(mapRef.current);
                        }}
                        aria-pressed={baseMapStyle === "roadmap"}
                      >
                        Mapa
                      </button>
                      <button
                        type="button"
                        className={`${style.mapTypeBtn} ${baseMapStyle === "satellite" ? style.mapTypeBtnActive : ""}`}
                        onClick={() => {
                          setBaseMapStyle("satellite");
                          applyMapType(mapRef.current);
                        }}
                        aria-pressed={baseMapStyle === "satellite"}
                      >
                        Satélite
                      </button>
                    </div>
                    <div className={style.mapTypeSubMenu}>
                      <span className={style.mapTypeSubLabel}>
                        {baseMapStyle === "satellite" ? "Etiquetas" : "Relieve"}
                      </span>
                      <div className={style.mapTypeSubRow}>
                        {baseMapStyle === "satellite" ? (
                          <>
                            <button
                              type="button"
                              className={`${style.mapTypeSubBtn} ${labelsEnabled ? style.mapTypeSubBtnActive : ""}`}
                              onClick={() => {
                                setLabelsEnabled(true);
                                applyMapType(mapRef.current);
                              }}
                              aria-pressed={labelsEnabled}
                            >
                              On
                            </button>
                            <button
                              type="button"
                              className={`${style.mapTypeSubBtn} ${!labelsEnabled ? style.mapTypeSubBtnActive : ""}`}
                              onClick={() => {
                                setLabelsEnabled(false);
                                applyMapType(mapRef.current);
                              }}
                              aria-pressed={!labelsEnabled}
                            >
                              Off
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`${style.mapTypeSubBtn} ${reliefEnabled ? style.mapTypeSubBtnActive : ""}`}
                              onClick={() => {
                                setReliefEnabled(true);
                                applyMapType(mapRef.current);
                              }}
                              aria-pressed={reliefEnabled}
                            >
                              On
                            </button>
                            <button
                              type="button"
                              className={`${style.mapTypeSubBtn} ${!reliefEnabled ? style.mapTypeSubBtnActive : ""}`}
                              onClick={() => {
                                setReliefEnabled(false);
                                applyMapType(mapRef.current);
                              }}
                              aria-pressed={!reliefEnabled}
                            >
                              Off
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
