import React, { Profiler, useEffect, useRef, useState } from "react";
import "./PanelInmo.css";
import {
  PlusCircle,
  Home,
  Layers,
  LogOut,
  Copy,
  Link,
  ExternalLink,
  Eye,
  Edit,
  MapPin,
  Trash2,
  Search,
  Smile,
  Globe,
  ExternalLinkIcon,
  Link2,
  Link2Icon,
  Share,
  Share2Icon,
  PersonStanding,
  User,
  Check,
  CheckCheck,
  CheckCheckIcon,
  CheckCircle,
  CheckCircle2,
  CheckCircle2Icon,
  CheckCircleIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDownIcon,
  ChevronUpIcon,
  Timer,
  TimerIcon,
  TimerReset,
  ClockFading,
  TagIcon,
  FoldersIcon,
  ChartSplineIcon,
  MessageCircle,
  MessageCircleHeartIcon,
  LogsIcon,
  LogInIcon,
  MapIcon,
  PointerIcon,
  PointerOffIcon,
  PinIcon,
  MapPinIcon,
  MapPlus,
} from "lucide-react";
import { FaWhatsapp, FaFacebook, FaGlobe } from "react-icons/fa";

import Loader from "../../components/Loading";
import ProyectoModal from "../inmobiliaria/proyecto/agregarProyecto";
import LotesModal from "../inmobiliaria/lote/LotesModal";
import EditProyectoModal from "../inmobiliaria/proyecto/editProyecto";
import IconoModal from "../inmobiliaria/proyecto/icono/IconoModal";

const CardProyecto = ({ proyecto, onViewLotes, onEdit, onIcon, onDelete }) => {
  const [imagenes, setImagenes] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch(
      `https://apiinmo.y0urs.com/api/list_imagen_proyecto/${proyecto.idproyecto}`,
    )
      .then((res) => res.json())
      .then((data) => {
        setImagenes(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Error cargando imágenes:", err));
  }, [proyecto.idproyecto]);
  useEffect(() => {
    if (imagenes.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % imagenes.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [imagenes]);
  const getImageUrl = () => {
    if (imagenes.length === 0) return null;
    const path = imagenes[index].imagenproyecto;
    if (!path) return null;
    return path.startsWith("http") ? path : `https://apiinmo.y0urs.com${path}`;
  };

  const currentImg = getImageUrl();

  const estadosMap = { 0: "Vendido", 1: "Disponible", 2: "Agotado" };

  return (
    <div className="proyecto-card">
      <div className="card-image-container">
        {currentImg ? (
          <img
            src={currentImg}
            alt={proyecto.nombreproyecto}
            className="img-carousel"
          />
        ) : (
          <div className="no-image-placeholder">
            <Globe size={48} opacity={0.2} />
            <span style={{ fontSize: "10px" }}>Cargando imagen...</span>
          </div>
        )}
        <div className="card-gradient-overlay" />
        <div className="estado-badge">
          {estadosMap[proyecto.estado] || "ACTIVO"}
        </div>
        <div className="card-info-content">
          <h3 className="card-title">{proyecto.nombreproyecto}</h3>
          <div className="card-location">
            <MapPin size={14} /> {proyecto.latitud}, {proyecto.longitud}
          </div>
          <div className="card-footer">
            <div className="card-actions-left">
              <button
                onClick={() => onViewLotes(proyecto.idproyecto)}
                className="btn-icon-overlay"
                title="Ver Lotes"
              >
                <Eye size={16} />
              </button>
              <button
                onClick={() => onEdit(proyecto.idproyecto)}
                className="btn-icon-overlay"
                title="Editar"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => onIcon(proyecto.idproyecto)}
                className="btn-icon-overlay"
                title="Íconos"
              >
                <MapPlus size={16} />
              </button>
            </div>
            <button
              onClick={() => onDelete && onDelete(proyecto.idproyecto)}
              className="btn-icon-overlay btn-danger"
              title="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PanelInmo = () => {
  const [resumen, setResumen] = useState(null);
  const [clicks, setClicks] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRedes, setShowRedes] = useState(false);
  const token = localStorage.getItem("access");
  const nombre = localStorage.getItem("nombre");
  const nombreInmo = localStorage.getItem("nombreinmobiliaria");
  const idInmo = localStorage.getItem("idinmobiliaria");

  const [showModal, setShowModal] = useState(false);
  const [showLotes, setShowLotes] = useState(false);
  const [showModalEditProyecto, setShowModalEditProyecto] = useState(false);
  const [showIconoModal, setShowIconoModal] = useState(false);
  const tutorialScrollRef = useRef(null);
  const [tutorialScroll, setTutorialScroll] = useState({
    left: false,
    right: false,
  });

  const mapUrl = `${window.location.origin}/mapa/${idInmo}`;
  const publicBase = import.meta.env.BASE_URL;
  const tutoriales = [
    {
      href: "https://www.youtube.com/watch?v=lZNPDIBqyCg",
      titulo: "Agregar proyectos de lotes, casas y departamentos",
      descripcion: "Crea proyectos completos paso a paso en GeoHabita.",
      imagen: `${publicBase}1.jpg`,
    },
    {
      href: "https://www.youtube.com/watch?v=PEvwYZO2BtU",
      titulo: "Agregar PDF para trazado, después de crear proyecto",
      descripcion: "Sube planos en PDF para dibujar lotes correctamente.",
      imagen: `${publicBase}2.jpg`,
    },
    {
      href: "https://www.youtube.com/watch?v=gzZHYnXD_5Q",
      titulo: "Registrar Casa Individual en el Mapa",
      descripcion: "Agrega propiedades individuales fácilmente.",
      imagen: `${publicBase}3.jpg`,
    },
    {
      href: "https://www.youtube.com/watch?v=zOIoX1ZvAM0",
      titulo: "Agregar lotes, después de crear el proyecto",
      descripcion: "Aprende a añadir más lotes cuando tu proyecto ya existe.",
      imagen: `${publicBase}4.jpg`,
    },
    {
      href: "https://www.youtube.com/watch?v=JHP9YWTIgJs",
      titulo: "Registro de Proyecto de Departamentos",
      descripcion:
        "Aprende paso a paso cómo crear y configurar un proyecto inmobiliario de departamentos dentro de GeoHabita.",
      imagen: `${publicBase}5.jpg`,
    },
  ];

  const updateTutorialScrollState = () => {
    const container = tutorialScrollRef.current;
    if (!container) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    setTutorialScroll({
      left: container.scrollLeft > 4,
      right: maxScroll - container.scrollLeft > 4,
    });
  };

  const scrollTutorials = (direction) => {
    const container = tutorialScrollRef.current;
    if (!container) return;

    const step = Math.max(container.clientWidth * 0.82, 260);
    container.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  const fetchData = async () => {
    if (!token || !idInmo) {
      window.location.href = "/";
      return;
    }
    try {
      setLoading(true);
      const resProy = await fetch(
        `https://apiinmo.y0urs.com/api/getProyectoInmo/${idInmo}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const proyectosData = await resProy.json();
      const cleanProyectos = Array.isArray(proyectosData) ? proyectosData : [];
      setProyectos(cleanProyectos);

      let lotesAcumulados = [];
      for (let proy of cleanProyectos) {
        const resLotes = await fetch(
          `https://apiinmo.y0urs.com/api/getLoteProyecto/${proy.idproyecto}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (resLotes.ok) {
          const dataLotes = await resLotes.json();
          lotesAcumulados = [
            ...lotesAcumulados,
            ...(Array.isArray(dataLotes) ? dataLotes : []),
          ];
        }
      }
      setLotes(lotesAcumulados);

      setResumen({
        proyectosActivos: cleanProyectos.length,
        lotesDisponibles: lotesAcumulados.filter(
          (l) => String(l.estado) === "1",
        ).length,
        lotesReservados: lotesAcumulados.filter(
          (l) => String(l.vendido) === "2",
        ).length,
        lotesVendidos: lotesAcumulados.filter((l) => String(l.vendido) === "1")
          .length,
      });

      const resClicks = await fetch(
        `https://apiinmo.y0urs.com/api/dashboard_clicks_inmobiliaria/${idInmo}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (resClicks.ok) setClicks(await resClicks.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const container = tutorialScrollRef.current;
    if (!container) return;

    updateTutorialScrollState();
    container.addEventListener("scroll", updateTutorialScrollState);
    window.addEventListener("resize", updateTutorialScrollState);

    return () => {
      container.removeEventListener("scroll", updateTutorialScrollState);
      window.removeEventListener("resize", updateTutorialScrollState);
    };
  }, [tutoriales.length]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const handleDeleteProyecto = async (idproyecto) => {
    if (!window.confirm("¿Seguro que deseas eliminar este proyecto?")) return;

    try {
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/deleteProyecto/${idproyecto}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        alert("No se pudo eliminar el proyecto ❌");
        return;
      }

      setProyectos((prev) => prev.filter((p) => p.idproyecto !== idproyecto));
      setLotes((prev) => prev.filter((l) => l.idproyecto !== idproyecto));
      alert("Proyecto eliminado ✅");
      fetchData();
    } catch (err) {
      console.error("Error eliminando proyecto:", err);
      alert("Error de red al eliminar proyecto 🚫");
    }
  };

  if (loading) return <Loader />;

  const redes = [
    { nombre: "Whatsapp", icono: <FaWhatsapp color="green" /> },
    { nombre: "Facebook", icono: <FaFacebook color="#1877f2" /> },
    { nombre: "Web", icono: <FaGlobe color="#0077b6" /> },
  ];

  return (
    <div className="panel-inmo-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">
            <Home size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>
              {nombreInmo}
            </h1>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Gestión Inmobiliaria
            </p>
          </div>
        </div>
        <div className="header-user">
          <div className="user-info">
            <div
              style={{
                background: "#f1f5f9",
                padding: "5px",
                borderRadius: "50%",
              }}
            >
              <User size={20} />
            </div>
            <span style={{ fontSize: "0.875rem", fontWeight: "400" }}>
              Bienvenid@,
            </span>
            <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>
              {nombre}
            </span>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={18} /> Salir
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {/* {Videos} */}
        <div className="tutorial-section">
          <h3 className="tutorial-title">
            Videotutoriales para Aprender a Gestionar tus Proyectos en GeoHabita
          </h3>

          <div className="tutorial-carousel-wrapper">
            <button
              type="button"
              className={`tutorial-nav tutorial-nav-left ${tutorialScroll.left ? "is-visible" : ""}`}
              onClick={() => scrollTutorials("left")}
              aria-label="Deslizar tutoriales a la izquierda"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="tutorial-grid" ref={tutorialScrollRef}>
              {tutoriales.map((tutorial) => (
                <a
                  key={tutorial.href}
                  href={tutorial.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tutorial-card"
                  style={{ "--tutorial-bg": `url(${tutorial.imagen})` }}
                >
                  <div className="tutorial-content">
                    <h4>{tutorial.titulo}</h4>
                    <p>{tutorial.descripcion}</p>
                  </div>
                </a>
              ))}
            </div>

            <button
              type="button"
              className={`tutorial-nav tutorial-nav-right ${tutorialScroll.right ? "is-visible" : ""}`}
              onClick={() => scrollTutorials("right")}
              aria-label="Deslizar tutoriales a la derecha"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {/* ENLACE COMPARTIR */}
        <section className="link-share-card">
          <div className="link-icon-box">
            <Link size={32} />
          </div>
          <div className="input-group">
            <label className="link-label">
              Copia o comparte este enlace con tus clientes para acceder
              exclusivamente a tus proyectos
            </label>
            <div className="link-input-wrapper">
              <input className="input-styled" readOnly value={mapUrl} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mapUrl);
                  alert("Copiado");
                }}
                className="btn-copy"
              >
                <Copy size={18} /> Copiar
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: "GeoHabita",
                        text: "Accede a mis proyectos en GeoHabita",
                        url: mapUrl,
                      })
                      .then(() => alert("Enlace compartido"))
                      .catch((error) =>
                        console.log("Error al compartir:", error),
                      );
                  } else {
                    navigator.clipboard.writeText(mapUrl);
                    alert(
                      "El navegador no soporta compartir. Enlace copiado al portapapeles.",
                    );
                  }
                }}
                className="btn-share"
              >
                <Share2Icon size={18} /> Compartir
              </button>
              <button
                onClick={() => {
                  window.open(mapUrl, "_blank");
                }}
                className="btn-map"
              >
                <MapPin size={18} /> Ver en Mapa
              </button>
            </div>
          </div>
        </section>
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-label">Proyectos</div>
            <div className="stat-value">
              {proyectos.length} <FoldersIcon size={24} color="#cbd5e1" />
            </div>
          </div>
          <div className="stat-box accent-green">
            <div className="stat-label">Lotes Disponibles</div>
            <div
              className="stat-value"
              style={{ color: "var(--accent-green)" }}
            >
              {resumen?.lotesDisponibles} <CheckCircleIcon size={24} />
            </div>
          </div>
          <div className="stat-box accent-yellow">
            <div className="stat-label">Lotes Reservados</div>
            <div
              className="stat-value"
              style={{ color: "var(--accent-yellow)" }}
            >
              {resumen?.lotesReservados} <ClockFading size={24} />
            </div>
          </div>
          <div className="stat-box accent-red">
            <div className="stat-label">Lotes Vendidos</div>
            <div className="stat-value" style={{ color: "var(--accent-red)" }}>
              {resumen?.lotesVendidos} <TagIcon size={24} />
            </div>
          </div>
          <div className="stat-box accent-blue">
            <div className="stat-label">Interés en Proyectos</div>
            <div className="stat-value" style={{ color: "var(--accent-blue)" }}>
              {clicks?.total_clicks_proyectos || 0}
              <ChartSplineIcon size={24} />
            </div>
          </div>
          <div
            className="stat-box accent-black"
            style={{ position: "relative" }}
          >
            <div className="stat-label">Contactos</div>
            <div
              className="stat-value"
              style={{ color: "var(--accent-black)" }}
            >
              {clicks?.total_clicks_contactos || 0}
              <MessageCircleHeartIcon size={24} />
            </div>
            <button
              onClick={() => setShowRedes(!showRedes)}
              style={{
                position: "absolute",
                top: "10px",
                right: "15px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              {showRedes ? (
                <ChevronUpIcon size={18} />
              ) : (
                <ChevronDownIcon size={18} />
              )}
            </button>

            {showRedes && (
              <div style={{ fontSize: "0.9rem", marginTop: "6px" }}>
                {redes.map((rs) => {
                  const red = clicks?.detalle_contactos?.find(
                    (r) => r.redSocial === rs.nombre,
                  );
                  return (
                    <div
                      key={rs.nombre}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "3px",
                      }}
                    >
                      {rs.icono}
                      <span>
                        <strong>{rs.nombre}:</strong> {red ? red.total : 0}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* GALERÍA */}
        <section>
          <div className="section-header">
            <h2 style={{ fontWeight: "800", fontSize: "1.25rem", margin: 0 }}>
              Mis Proyectos
            </h2>
            <button onClick={() => setShowModal(true)} className="btn-copy">
              <PlusCircle size={18} /> Nuevo Proyecto
            </button>
          </div>
          <div className="projects-grid">
            {proyectos.map((p) => (
              <CardProyecto
                key={p.idproyecto}
                proyecto={p}
                onViewLotes={setShowLotes}
                onEdit={setShowModalEditProyecto}
                onIcon={setShowIconoModal}
                onDelete={handleDeleteProyecto}
              />
            ))}
          </div>
        </section>

        {/* TABLA */}
        <section className="table-section">
          <div
            style={{
              padding: "1.5rem",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontWeight: "bold", margin: 0 }}>Listado de Lotes</h2>
            <div style={{ position: "relative" }}>
              <input
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="input-styled"
                style={{ paddingLeft: "2.5rem", width: "250px" }}
              />
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "10px",
                  color: "#94a3b8",
                }}
              />
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Descripción</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lotes
                  .filter((l) =>
                    l.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
                  )
                  .map((lote) => (
                    <tr key={lote.idlote}>
                      <td style={{ fontWeight: "bold" }}>{lote.nombre}</td>
                      <td>{lote.descripcion}</td>
                      <td
                        style={{
                          fontWeight: "bold",
                          color: "var(--accent-green)",
                        }}
                      >
                        S/. {lote.precio?.toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${String(lote.estado) === "1" ? "status-available" : "status-sold"}`}
                        >
                          {String(lote.estado) === "1"
                            ? "Disponible"
                            : "Vendido"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn-icon-small">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODALES ORIGINALES */}
      {showModal && (
        <ProyectoModal
          onClose={() => {
            setShowModal(false);
            // fetchData();
          }}
          idinmobiliaria={idInmo}
        />
      )}
      {showLotes && (
        <LotesModal
          idproyecto={showLotes}
          proyectoNombre={
            proyectos.find((p) => p.idproyecto === showLotes)?.nombreproyecto
          }
          onClose={() => {
            setShowLotes(false);
            // fetchData();
          }}
        />
      )}
      {showModalEditProyecto && (
        <EditProyectoModal
          onClose={() => {
            setShowModalEditProyecto(null);
            // fetchData();
          }}
          idinmobiliaria={idInmo}
          proyecto={proyectos.find(
            (p) => p.idproyecto === showModalEditProyecto,
          )}
        />
      )}
      {showIconoModal && (
        <IconoModal
          onClose={() => setShowIconoModal(false)}
          idproyecto={showIconoModal}
        />
      )}
    </div>
  );
};

export default PanelInmo;
