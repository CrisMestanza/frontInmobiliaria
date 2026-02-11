import React, { Profiler, useEffect, useState } from "react";
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
        <div className="estado-badge">
          {estadosMap[proyecto.estado] || "ACTIVO"}
        </div>
        {currentImg ? (
          <img
            src={currentImg}
            alt={proyecto.nombreproyecto}
            className="img-carousel"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="no-image-placeholder">
            <Globe size={48} opacity={0.2} />
            <span style={{ fontSize: "10px" }}>Cargando imagen...</span>
          </div>
        )}
      </div>
      <div className="card-info-content">
        <h3
          className="card-title"
          style={{ margin: "10px 0", fontSize: "1.1rem" }}
        >
          {proyecto.nombreproyecto}
        </h3>
        <div
          className="card-location"
          style={{
            marginBottom: "15px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "0.85rem",
            color: "#666",
          }}
        >
          <MapPin size={14} /> {proyecto.latitud}, {proyecto.longitud}
        </div>
        <div
          className="card-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "10px",
            borderTop: "1px solid #eee",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => onViewLotes(proyecto.idproyecto)}
              className="btn-icon-small"
              title="Ver Lotes"
              style={{ padding: "6px", borderRadius: "4px" }}
            >
              <Eye size={16} />
            </button>
            <button
              onClick={() => onEdit(proyecto.idproyecto)}
              className="btn-icon-small"
              title="Editar"
              style={{ padding: "6px", borderRadius: "4px" }}
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => onIcon(proyecto.idproyecto)}
              className="btn-icon-small"
              title="Íconos"
              style={{ padding: "6px", borderRadius: "4px" }}
            >
              <MapPlus size={16} />
            </button>
          </div>
          <button
            onClick={() => onDelete && onDelete(proyecto.idproyecto)}
            className="btn-icon-small"
            title="Eliminar"
            style={{ padding: "6px", borderRadius: "4px" }}
          >
            <Trash2 size={16} />
          </button>
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

  const mapUrl = `${window.location.origin}/mapa/${idInmo}`;

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

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
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
            <h2 style={{ fontWeight: "800", fontSize: "1.25rem" }}>
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
                // onDelete={handleDeleteProyecto}
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
