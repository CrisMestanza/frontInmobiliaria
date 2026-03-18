import { withApiBase } from "../../config/api.js";
import { authFetch } from "../../config/authFetch.js";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import GeoHabitaLoader from "../../components/GeoHabitaLoader";
const ProyectoModal = React.lazy(
  () => import("../inmobiliaria/proyecto/agregarProyecto"),
);
const LotesModal = React.lazy(() => import("../inmobiliaria/lote/LotesModal"));
const EditLoteModal = React.lazy(() => import("../inmobiliaria/lote/editLote"));
const EditProyectoModal = React.lazy(
  () => import("../inmobiliaria/proyecto/editProyecto"),
);
const IconoModal = React.lazy(
  () => import("../inmobiliaria/proyecto/icono/IconoModal"),
);
import ThemeSwitch from "../../components/ThemeSwitch";
import { useTheme } from "../../context/ThemeContext";

const proyectoImagesCache = new Map();
const proyectoImagesInflight = new Map();

const CardProyecto = ({
  proyecto,
  loteStats,
  onViewLotes,
  onEdit,
  onIcon,
  onDelete,
  onTogglePublic,
  isUpdatingPublic,
}) => {
  const [imagenes, setImagenes] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const key = proyecto.idproyecto;
    const cached = proyectoImagesCache.get(key);
    if (cached) {
      setImagenes(cached);
      return undefined;
    }

    const inflight = proyectoImagesInflight.get(key);
    const load =
      inflight ||
      fetch(
        withApiBase(
          `https://api.geohabita.com/api/list_imagen_proyecto/${key}`,
        ),
      )
        .then((res) => res.json())
        .then((data) => {
          const normalized = Array.isArray(data) ? data : [];
          proyectoImagesCache.set(key, normalized);
          proyectoImagesInflight.delete(key);
          return normalized;
        })
        .catch((err) => {
          proyectoImagesInflight.delete(key);
          console.error("Error cargando imágenes:", err);
          return [];
        });

    proyectoImagesInflight.set(key, load);
    load.then((imgs) => {
      if (active) setImagenes(imgs);
    });

    return () => {
      active = false;
    };
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
    return path.startsWith("http")
      ? path
      : withApiBase(`https://api.geohabita.com${path}`);
  };

  const currentImg = getImageUrl();

  const estadosMap = { 0: "Vendido", 1: "Disponible", 2: "Agotado" };
  const isPublic = proyecto.publico_mapa !== 0;

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
            <span className="card-loading-text">Cargando imagen...</span>
          </div>
        )}
        <div className="card-gradient-overlay" />
        <div className="estado-badge">
          {estadosMap[proyecto.estado] || "ACTIVO"}
        </div>
        <button
          type="button"
          className={`public-toggle ${isPublic ? "" : "public-toggle--off"}`}
          onClick={() => onTogglePublic?.(proyecto, !isPublic)}
          disabled={isUpdatingPublic}
          title={
            isPublic
              ? "Visible en mapa público"
              : "Oculto del mapa público"
          }
        >
          <span className="public-toggle-dot" />
          <span className="public-toggle-label">
            {isUpdatingPublic ? "Guardando..." : isPublic ? "Público" : "Privado"}
          </span>
        </button>
        <div className="card-info-content">
          <h3 className="card-title">{proyecto.nombreproyecto}</h3>
          <div className="card-location">
            <MapPin size={14} /> {proyecto.latitud}, {proyecto.longitud}
          </div>
          <div className="card-lote-stats">
            <span className="stat-chip stat-chip-total">
              {loteStats?.total ?? 0} Total
            </span>
            <span className="stat-chip stat-chip-available">
              {loteStats?.disponible ?? 0} Disp.
            </span>
            <span className="stat-chip stat-chip-reserved">
              {loteStats?.reservado ?? 0} Res.
            </span>
            <span className="stat-chip stat-chip-sold">
              {loteStats?.vendido ?? 0} Vend.
            </span>
          </div>
          <div className="card-footer">
            <div className="card-actions-left">
              <button
                onClick={() => onViewLotes(proyecto.idproyecto)}
                className="btn-gestionar-unidades"
                title="Ver Lotes"
                aria-label="Gestionar inmuebles"
              >
                <Layers size={16} />
                <span className="btn-action-text">Gestionar</span>
              </button>

              <button
                onClick={() => onEdit(proyecto.idproyecto)}
                className="btn-gestionar-unidades"
                title="Editar"
                aria-label="Editar proyecto"
              >
                <Edit size={16} />
                <span className="btn-action-text">Editar</span>
              </button>
              <button
                onClick={() => onIcon(proyecto.idproyecto)}
                className="btn-gestionar-unidades"
                title="Íconos"
                aria-label="Agregar iconos"
              >
                <MapPlus size={16} />
                <span className="btn-action-text">Íconos</span>
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

const PanelInmo = ({ setAppLoading }) => {
  const { isDark, toggleTheme } = useTheme();
  const [resumen, setResumen] = useState(null);
  const [clicks, setClicks] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [sortKey, setSortKey] = useState("nombre");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showRedes, setShowRedes] = useState(false);
  const token = localStorage.getItem("access");
  const nombre = localStorage.getItem("nombre");
  const nombreInmo = localStorage.getItem("nombreinmobiliaria");
  const idInmo = localStorage.getItem("idinmobiliaria");

  const [showModal, setShowModal] = useState(false);
  const [showLotes, setShowLotes] = useState(false);
  const [showModalEditProyecto, setShowModalEditProyecto] = useState(false);
  const [showIconoModal, setShowIconoModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [showEditLote, setShowEditLote] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [publicoUpdating, setPublicoUpdating] = useState({});
  const tutorialScrollRef = useRef(null);
  const [tutorialScroll, setTutorialScroll] = useState({
    left: false,
    right: false,
  });

  const mapUrl = `${window.location.origin}/mapa/${idInmo}`;
  const publicBase =
    import.meta.env.BASE_URL === "./" ? "/" : import.meta.env.BASE_URL;
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
      const [resProy, resClicks] = await Promise.all([
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/getProyectoInmo/${idInmo}`,
          ),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
        authFetch(
          withApiBase(
            `https://api.geohabita.com/api/dashboard_clicks_inmobiliaria/${idInmo}/`,
          ),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      ]);

      const proyectosData = resProy.ok ? await resProy.json() : [];
      const cleanProyectos = Array.isArray(proyectosData) ? proyectosData : [];
      setProyectos(cleanProyectos);

      if (resClicks.ok) setClicks(await resClicks.json());

      setResumen({
        proyectosActivos: cleanProyectos.length,
        lotesDisponibles: 0,
        lotesReservados: 0,
        lotesVendidos: 0,
      });

      const loadLotes = async () => {
        setLotesLoading(true);
        const lotesResponses = await Promise.all(
          cleanProyectos.map((proy) =>
            authFetch(
              withApiBase(
                `https://api.geohabita.com/api/getLoteProyecto/${proy.idproyecto}`,
              ),
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            )
              .then((res) => (res.ok ? res.json() : []))
              .catch(() => []),
          ),
        );
        const lotesAcumulados = lotesResponses.flatMap((data) =>
          Array.isArray(data) ? data : [],
        );
        setLotes(lotesAcumulados);

        setResumen({
          proyectosActivos: cleanProyectos.length,
          lotesDisponibles: lotesAcumulados.filter(
            (l) => String(l.vendido) === "0",
          ).length,
          lotesReservados: lotesAcumulados.filter(
            (l) => String(l.vendido) === "2",
          ).length,
          lotesVendidos: lotesAcumulados.filter(
            (l) => String(l.vendido) === "1",
          ).length,
        });
        setLotesLoading(false);
      };

      await loadLotes();
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
    document.body.classList.add("panel-inmo-body");
    return () => {
      document.body.classList.remove("panel-inmo-body");
    };
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
    const doLogout = async () => {
      try {
        await authFetch(withApiBase("https://api.geohabita.com/api/logout/"), {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (err) {
        console.error("Error al cerrar sesión:", err);
      } finally {
        localStorage.clear();
        window.location.href = "/";
      }
    };
    doLogout();
  };

  const handleDeleteProyecto = async (idproyecto) => {
    try {
      const res = await authFetch(
        withApiBase(
          `https://api.geohabita.com/api/deleteProyecto/${idproyecto}/`,
        ),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        window.alertError?.("No se pudo eliminar el proyecto ❌");
        return;
      }

      setProyectos((prev) => prev.filter((p) => p.idproyecto !== idproyecto));
      setLotes((prev) => prev.filter((l) => l.idproyecto !== idproyecto));
      window.alertSuccess?.("Proyecto eliminado ✅");
      fetchData();
    } catch (err) {
      console.error("Error eliminando proyecto:", err);
      window.alertError?.("Error de red al eliminar proyecto 🚫");
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleTogglePublicoMapa = async (proyecto, nextValue) => {
    if (!proyecto?.idproyecto) return;
    const id = proyecto.idproyecto;
    const nextPublico = nextValue ? 1 : 0;

    setPublicoUpdating((prev) => ({ ...prev, [id]: true }));
    setProyectos((prev) =>
      prev.map((p) =>
        p.idproyecto === id ? { ...p, publico_mapa: nextPublico } : p,
      ),
    );

    try {
      const res = await authFetch(
        withApiBase(`https://api.geohabita.com/api/updateProyecto/${id}/`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ publico_mapa: nextPublico }),
        },
      );
      if (!res.ok) {
        throw new Error("No se pudo actualizar visibilidad.");
      }
    } catch (error) {
      console.error(error);
      setProyectos((prev) =>
        prev.map((p) =>
          p.idproyecto === id ? { ...p, publico_mapa: proyecto.publico_mapa } : p,
        ),
      );
      window.alertError?.("No se pudo actualizar la visibilidad.");
    } finally {
      setPublicoUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const totalLotes = lotes.length;
  const totalContactos = clicks?.total_clicks_contactos || 0;
  const totalInteres = clicks?.total_clicks_proyectos || 0;
  const engagementRate = useMemo(() => {
    if (!proyectos.length) return 0;
    return Math.round((totalContactos / proyectos.length) * 10) / 10;
  }, [totalContactos, proyectos.length]);

  const proyectoNombrePorId = useMemo(() => {
    const map = new Map();
    proyectos.forEach((p) => map.set(p.idproyecto, p.nombreproyecto));
    return map;
  }, [proyectos]);

  const lotesStatsPorProyecto = useMemo(() => {
    const map = new Map();
    lotes.forEach((l) => {
      const id = l.idproyecto;
      if (!map.has(id)) {
        map.set(id, { total: 0, disponible: 0, reservado: 0, vendido: 0 });
      }
      const stats = map.get(id);
      stats.total += 1;
      const v = Number(l.vendido);
      if (v === 0) stats.disponible += 1;
      else if (v === 2) stats.reservado += 1;
      else if (v === 1) stats.vendido += 1;
    });
    return map;
  }, [lotes]);

  const getEstadoLote = (vendido) => {
    const value = Number(vendido);
    if (value === 0) return { label: "Disponible", className: "status-available" };
    if (value === 2) return { label: "Reservado", className: "status-reserved" };
    if (value === 1) return { label: "Vendido", className: "status-sold" };
    return { label: "Sin estado", className: "status-unknown" };
  };

  const parseDateSafe = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isNewLote = (lote) => {
    const date =
      parseDateSafe(lote.created_at) ||
      parseDateSafe(lote.fecha_creacion) ||
      parseDateSafe(lote.fecha_registro) ||
      parseDateSafe(lote.createdAt) ||
      parseDateSafe(lote.fecha);
    if (!date) return false;
    const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  };

  const handleEstadoChange = async (idlote, nuevoEstado) => {
    try {
      const res = await authFetch(
        withApiBase(
          `https://api.geohabita.com/api/updateLoteVendido/${idlote}/`,
        ),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ vendido: nuevoEstado }),
        },
      );
      if (res.ok) {
        fetchData();
      } else {
        window.alertError?.("No se pudo actualizar el estado ❌");
      }
    } catch (err) {
      console.error(err);
      window.alertError?.("Error al actualizar el estado 🚫");
    }
  };
  useEffect(() => {
    if (!setAppLoading) return;
    setAppLoading(loading);
  }, [loading, setAppLoading]);

  // if (loading) return <Loader />;
  if (loading && !setAppLoading) return <GeoHabitaLoader autoHide={false} />;

  const redes = [
    { nombre: "Whatsapp", icono: <FaWhatsapp color="green" /> },
    { nombre: "Facebook", icono: <FaFacebook color="#1877f2" /> },
    { nombre: "Web", icono: <FaGlobe color="#0077b6" /> },
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredLotes = lotes.filter((l) => {
    const proyectoNombre = proyectoNombrePorId.get(l.idproyecto) || "";
    const matchesSearch =
      !normalizedSearch ||
      l.nombre?.toLowerCase().includes(normalizedSearch) ||
      l.descripcion?.toLowerCase().includes(normalizedSearch) ||
      proyectoNombre.toLowerCase().includes(normalizedSearch);
    const matchesStatus =
      statusFilter === "all" || String(l.vendido) === statusFilter;
    const matchesProject =
      projectFilter === "all" || String(l.idproyecto) === projectFilter;
    const priceValue = Number(l.precio ?? 0);
    const areaValue = Number(l.area_total_m2 ?? 0);
    const minPrice = priceMin === "" ? null : Number(priceMin);
    const maxPrice = priceMax === "" ? null : Number(priceMax);
    const minArea = areaMin === "" ? null : Number(areaMin);
    const maxArea = areaMax === "" ? null : Number(areaMax);
    const matchesPrice =
      (minPrice === null || priceValue >= minPrice) &&
      (maxPrice === null || priceValue <= maxPrice);
    const matchesArea =
      (minArea === null || areaValue >= minArea) &&
      (maxArea === null || areaValue <= maxArea);
    return (
      matchesSearch &&
      matchesStatus &&
      matchesProject &&
      matchesPrice &&
      matchesArea
    );
  });
  const sortedLotes = [...filteredLotes].sort((a, b) => {
    if (sortKey === "precio-asc") return Number(a.precio ?? 0) - Number(b.precio ?? 0);
    if (sortKey === "precio-desc") return Number(b.precio ?? 0) - Number(a.precio ?? 0);
    if (sortKey === "area-asc") return Number(a.area_total_m2 ?? 0) - Number(b.area_total_m2 ?? 0);
    if (sortKey === "area-desc") return Number(b.area_total_m2 ?? 0) - Number(a.area_total_m2 ?? 0);
    if (sortKey === "estado") return Number(a.vendido ?? 0) - Number(b.vendido ?? 0);
    return String(a.nombre || "").localeCompare(String(b.nombre || ""));
  });

  return (
    <div className="panel-inmo-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">
            <Home size={24} />
          </div>
          <div>
            <h1 className="brand-title">{nombreInmo}</h1>
            <p className="brand-subtitle">Gestión Inmobiliaria</p>
          </div>
        </div>
        <div className="header-user">
          <ThemeSwitch
            checked={isDark}
            onChange={toggleTheme}
            className="theme-switch-horizontal"
          />
          <div className="user-info">
            <div className="user-avatar">
              <User size={20} />
            </div>
            <span className="user-greeting">Bienvenid@,</span>
            <span className="user-name">{nombre}</span>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={18} /> Salir
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {/* <section className="dashboard-hero-card">
          <div className="dashboard-hero-copy">
            <p className="dashboard-hero-eyebrow">Panel Comercial</p>
            <h2>Impulsa tus conversiones con una vista clara del negocio</h2>
            <p>
              Monitorea inventario, interés y contactos en tiempo real para
              tomar decisiones más rápidas.
            </p>
          </div>
          <div className="dashboard-hero-metrics">
            <div className="hero-metric">
              <span className="hero-metric-label">Inventario total</span>
              <strong>{totalLotes}</strong>
            </div>
            <div className="hero-metric">
              <span className="hero-metric-label">Interacciones</span>
              <strong>{totalInteres}</strong>
            </div>
            <div className="hero-metric">
              <span className="hero-metric-label">Contactos / proyecto</span>
              <strong>{engagementRate}</strong>
            </div>
          </div>
        </section> */}
        {/* {Videos} */}
        <div className="tutorial-section">
          <h3 className="tutorial-title">
            Videotutoriales para aprender de GeoHabita
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
              Enlace Exclusivo de tus Proyectos
            </label>
            <div className="link-input-wrapper">
              <input className="input-styled" readOnly value={mapUrl} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mapUrl);
                  window.alertSuccess?.("Copiado");
                }}
                className="btn-copy share-action-btn"
              >
                <Copy size={18} />
                <span className="share-btn-text">Copiar</span>
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
                      .then(() => window.alertSuccess?.("Enlace compartido"))
                      .catch((error) =>
                        console.log("Error al compartir:", error),
                      );
                  } else {
                    navigator.clipboard.writeText(mapUrl);
                    window.alertInfo?.(
                      "El navegador no soporta compartir. Enlace copiado al portapapeles.",
                    );
                  }
                }}
                className="btn-share share-action-btn"
              >
                <Share2Icon size={18} />
                <span className="share-btn-text">Compartir</span>
              </button>
              <button
                onClick={() => {
                  window.open(mapUrl, "_blank");
                }}
                className="btn-map share-action-btn"
              >
                <MapPin size={18} />
                <span className="share-btn-text">Ver en Mapa</span>
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
            <div className="stat-value stat-value-green">
              {resumen?.lotesDisponibles} <CheckCircleIcon size={24} />
            </div>
          </div>
          <div className="stat-box accent-yellow">
            <div className="stat-label">Lotes Reservados</div>
            <div className="stat-value stat-value-yellow">
              {resumen?.lotesReservados} <ClockFading size={24} />
            </div>
          </div>
          <div className="stat-box accent-red">
            <div className="stat-label">Lotes Vendidos</div>
            <div className="stat-value stat-value-red">
              {resumen?.lotesVendidos} <TagIcon size={24} />
            </div>
          </div>
          <div className="stat-box accent-blue">
            <div className="stat-label">Interés en Proyectos</div>
            <div className="stat-value stat-value-blue">
              {clicks?.total_clicks_proyectos || 0}
              <ChartSplineIcon size={24} />
            </div>
          </div>
          <div className="stat-box accent-black contact-card">
            <div className="stat-label">Contactos</div>
            <div className="stat-value stat-value-black">
              {clicks?.total_clicks_contactos || 0}
              <MessageCircleHeartIcon size={24} />
            </div>
            <button
              onClick={() => setShowRedes(!showRedes)}
              className="contact-toggle-btn"
            >
              {showRedes ? (
                <ChevronUpIcon size={18} />
              ) : (
                <ChevronDownIcon size={18} />
              )}
            </button>

            {showRedes && (
              <div className="contact-details">
                {redes.map((rs) => {
                  const red = clicks?.detalle_contactos?.find(
                    (r) => r.redSocial === rs.nombre,
                  );
                  return (
                    <div key={rs.nombre} className="contact-row">
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
            <h2 className="section-title">Mis Proyectos</h2>
            <button onClick={() => setShowModal(true)} className="btn-copy">
              <PlusCircle size={18} /> Agregar inmuebles
            </button>
          </div>
          <div className="projects-grid">
            {proyectos.map((p) => (
              <CardProyecto
                key={p.idproyecto}
                proyecto={p}
                loteStats={lotesStatsPorProyecto.get(p.idproyecto)}
                onViewLotes={setShowLotes}
                onEdit={setShowModalEditProyecto}
                onIcon={setShowIconoModal}
                onDelete={setProjectToDelete}
                onTogglePublic={handleTogglePublicoMapa}
                isUpdatingPublic={!!publicoUpdating[p.idproyecto]}
              />
            ))}
          </div>
        </section>

        {/* TABLA */}
        <section className="table-section">
          <div className="table-header">
            <h2 className="table-title">Listado de Lotes</h2>
            <select
              className="input-styled table-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="all">Todos</option>
              <option value="0">Disponible</option>
              <option value="2">Reservado</option>
              <option value="1">Vendido</option>
            </select>
            <select
              className="input-styled table-filter-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filtrar por proyecto"
            >
              <option value="all">Todos los proyectos</option>
              {proyectos.map((p) => (
                <option key={p.idproyecto} value={String(p.idproyecto)}>
                  {p.nombreproyecto}
                </option>
              ))}
            </select>
            <select
              className="input-styled table-filter-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              aria-label="Ordenar lotes"
            >
              <option value="nombre">Nombre (A-Z)</option>
              <option value="precio-asc">Precio ↑</option>
              <option value="precio-desc">Precio ↓</option>
              <option value="area-asc">Área ↑</option>
              <option value="area-desc">Área ↓</option>
              <option value="estado">Estado</option>
            </select>
            <button
              type="button"
              className="btn-advanced-filters"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
            >
              {showAdvancedFilters ? "Ocultar filtros" : "Filtros avanzados"}
            </button>
            {lotesLoading && (
              <span className="table-loading">Cargando lotes...</span>
            )}
          </div>
          <div className="table-search-row">
            <div className="table-search-wrap">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="input-styled table-search-input"
              />
              <Search size={18} className="table-search-icon" />
            </div>
          </div>
          <div
            className={`table-filters ${showAdvancedFilters ? "is-open" : ""}`}
          >
            <div className="filter-group">
              <label className="filter-label">Precio (S/.)</label>
              <div className="filter-inputs">
                <input
                  type="number"
                  min="0"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="input-styled filter-input"
                  placeholder="Min"
                />
                <input
                  type="number"
                  min="0"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="input-styled filter-input"
                  placeholder="Max"
                />
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label">Área (m²)</label>
              <div className="filter-inputs">
                <input
                  type="number"
                  min="0"
                  value={areaMin}
                  onChange={(e) => setAreaMin(e.target.value)}
                  className="input-styled filter-input"
                  placeholder="Min"
                />
                <input
                  type="number"
                  min="0"
                  value={areaMax}
                  onChange={(e) => setAreaMax(e.target.value)}
                  className="input-styled filter-input"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="table-main">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Proyecto</th>
                  <th>Descripción</th>
                  <th>Área m²</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th className="th-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedLotes.map((lote) => {
                  const estadoMeta = getEstadoLote(lote.vendido);
                  const proyectoNombre =
                    proyectoNombrePorId.get(lote.idproyecto) || "—";
                  const areaValue =
                    lote.area_total_m2 !== undefined && lote.area_total_m2 !== ""
                      ? Number(lote.area_total_m2).toLocaleString()
                      : "—";
                  const isNew = isNewLote(lote);
                  return (
                    <tr
                      key={lote.idlote}
                      className={`lote-row lote-row-${String(lote.vendido)}`}
                    >
                      <td className="td-bold">
                        <span className="lote-name">
                          {lote.nombre}
                          {isNew && <span className="new-badge">Nuevo</span>}
                        </span>
                      </td>
                      <td>{proyectoNombre}</td>
                      <td>{lote.descripcion}</td>
                      <td>{areaValue}</td>
                      <td className="td-price">
                        S/. {lote.precio?.toLocaleString()}
                      </td>
                      <td>
                        <div className="status-select-wrap">
                          <select
                            className={`status-select ${estadoMeta.className}`}
                            value={String(lote.vendido)}
                            onChange={(e) =>
                              handleEstadoChange(
                                lote.idlote,
                                Number(e.target.value),
                              )
                            }
                          >
                            <option value="0">Disponible</option>
                            <option value="2">Reservado</option>
                            <option value="1">Vendido</option>
                          </select>
                        </div>
                      </td>
                      <td className="td-right">
                        <button
                          className="btn-icon-small"
                          title="Editar lote"
                          onClick={() => {
                            setSelectedLote(lote);
                            setShowEditLote(true);
                          }}
                        >
                          <Edit size={18} />
                        </button>
                        <button className="btn-icon-small" title="Eliminar">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODALES ORIGINALES */}
      {showModal && (
        <Suspense fallback={<Loader />}>
          <ProyectoModal
            onClose={() => {
              setShowModal(false);
              fetchData();
            }}
            idinmobiliaria={idInmo}
          />
        </Suspense>
      )}
      {showLotes && (
        <Suspense fallback={<Loader />}>
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
        </Suspense>
      )}
      {showModalEditProyecto && (
        <Suspense fallback={<Loader />}>
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
        </Suspense>
      )}
      {showIconoModal && (
        <Suspense fallback={<Loader />}>
          <IconoModal
            onClose={() => setShowIconoModal(false)}
            idproyecto={showIconoModal}
          />
        </Suspense>
      )}
      {showEditLote && selectedLote && (
        <Suspense fallback={<Loader />}>
          <EditLoteModal
            onClose={() => {
              setShowEditLote(false);
              setSelectedLote(null);
              fetchData();
            }}
            idproyecto={selectedLote.idproyecto}
            lote={selectedLote}
            visible={showEditLote}
          />
        </Suspense>
      )}
      {projectToDelete && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProjectToDelete(null);
          }}
        >
          <div className="confirm-card" role="dialog" aria-modal="true">
            <h3>Eliminar proyecto</h3>
            <p>
              Esta acción eliminará el proyecto y sus datos relacionados. No se
              puede deshacer.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn confirm-btn-cancel"
                onClick={() => setProjectToDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn-danger"
                onClick={() => handleDeleteProyecto(projectToDelete)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelInmo;
