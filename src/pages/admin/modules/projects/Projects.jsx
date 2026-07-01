// Projects — Project cards grid, create/edit/delete, visibility toggle
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Home,
  EyeOff,
  Trash2,
  MapPin,
  Layers,
  CheckCircle2,
  ClockFading,
  TagIcon,
  MessageCircle,
  Search,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useAdmin } from "../../AdminContext";
import {
  hasFinancingConfigValue,
  getProjectImageCandidates,
} from "../../../../services/adminService.js";
import { useTheme } from "../../../../context/ThemeContext";
import "./Projects.css";

function GeohabitaFallbackLogo() {
  const { isDark } = useTheme();
  const publicBase = import.meta.env.BASE_URL === "./" ? "/" : import.meta.env.BASE_URL;
  const logoSrc = `${publicBase}${isDark ? "geohabitalight.png" : "geohabita.png"}`;
  return <img src={logoSrc} alt="GeoHabita" className="no-image-placeholder-logo" />;
}

// ProjectCard component (extracted from PanelInmo CardProyecto)
function ProjectCard({
  proyecto,
  loteStats,
  onDelete,
  onTogglePublic,
}) {
  const imageCandidates = useMemo(() => {
    return getProjectImageCandidates(proyecto);
  }, [proyecto]);

  const [imageIndex, setImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const spaceStats = proyecto.space_stats || {};
  const imageSrc = imageFailed ? null : imageCandidates[imageIndex] || null;

  const isPublic = proyecto.publico_mapa !== 0;
  const totalLotes = loteStats?.total ?? 0;
  const lotesDisponibles = loteStats?.disponible ?? 0;
  const lotesReservados = loteStats?.reservado ?? 0;
  const lotesVendidos = loteStats?.vendido ?? 0;
  const totalContactos = proyecto.total_contactos ?? 0;
  const isFinancingConfigured = hasFinancingConfigValue(
    proyecto.financing_config || proyecto.financing_config_full,
  );
  const projectType =
    proyecto.tipoproyecto || proyecto.tipo_proyecto || "Proyecto";

  React.useEffect(() => {
    setImageIndex(0);
    setImageFailed(false);
  }, [proyecto.idproyecto, imageCandidates.length]);

  return (
    <div className="proyecto-card">
      <div className="card-image-container">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={proyecto.nombreproyecto}
            className="img-carousel"
            onError={() =>
              setImageIndex((prev) => {
                if (prev + 1 < imageCandidates.length) return prev + 1;
                setImageFailed(true);
                return prev;
              })
            }
          />
        ) : (
          <div className="no-image-placeholder">
            <GeohabitaFallbackLogo />
            <span className="card-loading-text">Sin imagen de portada</span>
          </div>
        )}
        <div className="estado-badge">
          {proyecto.estado === 1 ? "ACTIVO" : "INACTIVO"}
        </div>
        <button
          type="button"
          className={`public-toggle ${isPublic ? "" : "public-toggle--off"}`}
          onClick={() => onTogglePublic?.(proyecto, !isPublic)}
          title={
            isPublic ? "Visible en mapa público" : "Oculto del mapa público"
          }
        >
          <span className="public-toggle-dot">
            {!isPublic && <EyeOff size={11} strokeWidth={2.4} />}
          </span>
          <span className="public-toggle-label">
            {isPublic ? "Público" : "Incógnito"}
          </span>
        </button>
        <div className="card-image-fade" />
      </div>

      <div className="card-info-content">
        <div className="card-info-panel">
          <div className="card-title-row">
            <div className="card-title-block">
              <h3 className="card-title">{proyecto.nombreproyecto}</h3>
              <div className="card-meta-line">
                <span>{projectType}</span>
                <span className="card-meta-separator" />
                <span>
                  {isFinancingConfigured
                    ? "Financiamiento activo"
                    : "Financiamiento pendiente"}
                </span>
              </div>
            </div>
            <div className="card-header-actions">
              <div className="card-minor-metric card-minor-metric-visits">
                <div className="card-minor-metric-copy">
                  <strong>{proyecto.total_clicks ?? 0}</strong>
                  <span>Vistas</span>
                </div>
              </div>
              <button
                onClick={() => onDelete(proyecto.idproyecto)}
                className="btn-icon-overlay btn-danger"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="card-location">
            <MapPin size={14} />
            <span>
              {proyecto.latitud || "—"}, {proyecto.longitud || "—"}
            </span>
          </div>

          <div className="card-body-grid">
            <div className="card-overview-grid">
              <div className="card-overview-pill">
                <span className="card-overview-icon">
                  <Layers size={15} />
                </span>
                <span className="card-overview-copy">
                  <span className="card-overview-label">Lotes</span>
                  <strong>{totalLotes}</strong>
                </span>
              </div>
              <div className="card-overview-pill card-overview-pill--green">
                <span className="card-overview-icon">
                  <CheckCircle2 size={15} />
                </span>
                <span className="card-overview-copy">
                  <span className="card-overview-label">Disponibles</span>
                  <strong>{lotesDisponibles}</strong>
                </span>
              </div>
              <div className="card-overview-pill card-overview-pill--amber">
                <span className="card-overview-icon">
                  <ClockFading size={15} />
                </span>
                <span className="card-overview-copy">
                  <span className="card-overview-label">Reservados</span>
                  <strong>{lotesReservados}</strong>
                </span>
              </div>
              <div className="card-overview-pill card-overview-pill--red">
                <span className="card-overview-icon">
                  <TagIcon size={15} />
                </span>
                <span className="card-overview-copy">
                  <span className="card-overview-label">Vendidos</span>
                  <strong>{lotesVendidos}</strong>
                </span>
              </div>
              <div className="card-overview-pill card-overview-pill--blue">
                <span className="card-overview-icon">
                  <MessageCircle size={15} />
                </span>
                <span className="card-overview-copy">
                  <span className="card-overview-label">Contactos</span>
                  <strong>{totalContactos}</strong>
                </span>
              </div>
              <div className="card-overview-pill card-overview-pill--dark">
                <span className="card-overview-icon">
                  <ArrowUpRight size={15} />
                </span>
                <span className="card-overview-copy">
                  <span className="card-overview-label">Vistas</span>
                  <strong>{proyecto.total_clicks ?? 0}</strong>
                </span>
              </div>
            </div>

            <div className="card-meta-strip">
              <div className="card-meta-card card-meta-card--space">
                <span className="card-meta-kicker">Espacios</span>
                <div className="card-meta-inline">
                  <strong>{spaceStats?.total ?? 0}</strong>
                  <small>
                    {Math.round(
                      Number(spaceStats?.area_total || 0),
                    ).toLocaleString("es-PE")}{" "}
                    m²
                  </small>
                </div>
              </div>
              <div className="card-meta-card card-meta-card--finance">
                <span className="card-meta-kicker">Financiamiento</span>
                <div className="card-meta-inline">
                  <strong>
                    {isFinancingConfigured ? "Activo" : "Pendiente"}
                  </strong>
                  <small>
                    {isFinancingConfigured
                      ? "Listo para cotizar"
                      : "Sin reglas aún"}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const {
    proyectos,
    loading,
    error,
    lotesStatsPorProyecto,
    handleTogglePublic,
    handleDeleteProject,
    refreshOverview,
  } = useAdmin();

  const [projectToDelete, setProjectToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return proyectos;
    const term = searchTerm.toLowerCase();
    return proyectos.filter((p) =>
      p.nombreproyecto?.toLowerCase().includes(term),
    );
  }, [proyectos, searchTerm]);

  if (loading && proyectos.length === 0) {
    return (
      <div className="projects-empty">
        <Home size={48} opacity={0.3} />
        <p>Cargando proyectos...</p>
      </div>
    );
  }

  if (error && proyectos.length === 0) {
    return (
      <div className="projects-empty">
        <Home size={48} opacity={0.3} />
        <p style={{ color: 'var(--color-danger, #e53e3e)', fontSize: '0.85rem', maxWidth: 360, textAlign: 'center' }}>
          Error al cargar proyectos: {error.message || String(error)}
        </p>
        <button className="btn-copy" style={{ marginTop: 12 }} onClick={refreshOverview}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div>
          <h2 className="projects-title">Mis Proyectos</h2>
          <p className="projects-subtitle">
            Gestiona proyectos, visibilidad, lotes y más
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard/proyectos/agregar")}
          className="btn-copy"
        >
          <PlusCircle size={18} /> Agregar inmuebles
        </button>
      </div>

      {proyectos.length > 3 && (
        <div className="projects-search">
          <Search size={18} className="projects-search-icon" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar proyecto..."
            className="input-styled projects-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="projects-search-clear"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className="projects-grid">
        {filteredProjects.length === 0 ? (
          <div className="projects-empty">
            <Home size={48} opacity={0.3} />
            <p>
              {searchTerm
                ? "Sin resultados para esta búsqueda"
                : "Aún no tienes proyectos. Crea el primero."}
            </p>
          </div>
        ) : (
          filteredProjects.map((p) => (
            <ProjectCard
              key={p.idproyecto}
              proyecto={p}
              loteStats={lotesStatsPorProyecto.get(p.idproyecto)}
              onDelete={setProjectToDelete}
              onTogglePublic={handleTogglePublic}
            />
          ))
        )}
      </div>
      {projectToDelete && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProjectToDelete(null);
          }}
        >
          <div className="confirm-card" role="dialog">
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
                onClick={() => {
                  handleDeleteProject(projectToDelete);
                  setProjectToDelete(null);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
