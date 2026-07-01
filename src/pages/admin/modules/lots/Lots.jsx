import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Blocks, FolderOpen, PlusCircle, Search } from 'lucide-react';
import { useAdmin } from '../../AdminContext';
import { getProjectImageCandidates } from '../../../../services/adminService.js';
import { useTheme } from '../../../../context/ThemeContext';
import './Lots.css';

function GeohabitaFallbackLogo() {
  const { isDark } = useTheme();
  const publicBase = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL;
  const logoSrc = `${publicBase}${isDark ? 'geohabitalight.png' : 'geohabita.png'}`;
  return <img src={logoSrc} alt="GeoHabita" className="lots-project-fallbackLogo" />;
}

function LotProjectCard({ proyecto, onOpenProject }) {
  const imageCandidates = useMemo(() => getProjectImageCandidates(proyecto), [proyecto]);
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageCandidates[imageIndex] || null;

  React.useEffect(() => {
    setImageIndex(0);
  }, [proyecto?.idproyecto, imageCandidates.length]);

  return (
    <article className="lots-project-card">
      <div className="lots-project-media">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={proyecto.nombreproyecto}
            className="lots-project-image"
            loading="lazy"
            onError={() =>
              setImageIndex((prev) =>
                prev + 1 < imageCandidates.length ? prev + 1 : prev,
              )
            }
          />
        ) : (
          <div className="lots-project-fallback">
            <GeohabitaFallbackLogo />
          </div>
        )}
      </div>

      <div className="lots-project-body">
        <div className="lots-project-head">
          <div>
            <span className="lots-project-kicker">Proyecto disponible</span>
            <h3>{proyecto.nombreproyecto}</h3>
          </div>
          <span className={`lots-project-badge ${proyecto.estado === 1 ? 'is-active' : 'is-inactive'}`}>
            {proyecto.estado === 1 ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <p className="lots-project-description">
          {proyecto.descripcion?.trim() || 'Ingresa al flujo de lotes para visualizar inventario, estados y registrar nuevos lotes dentro de este proyecto.'}
        </p>

        <div className="lots-project-actions">
          <button
            type="button"
            className="lots-project-btn lots-project-btn-primary"
            onClick={() => onOpenProject(proyecto.idproyecto)}
          >
            <FolderOpen size={16} />
            Ver lotes
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Lots() {
  const navigate = useNavigate();
  const { proyectos, loading } = useAdmin();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return proyectos;
    return proyectos.filter((proyecto) =>
      proyecto.nombreproyecto?.toLowerCase().includes(term) ||
      proyecto.descripcion?.toLowerCase().includes(term),
    );
  }, [proyectos, searchTerm]);

  return (
    <div className="lots-selector-page">
      <section className="lots-selector-hero">
        <div className="lots-selector-copy">
          <span className="lots-selector-eyebrow">Gestion por proyecto</span>
          <h1 className="lots-selector-title">Lotes</h1>
          <p className="lots-selector-text">
            Selecciona un proyecto para abrir su tabla de lotes y desde ahi registrar nuevos lotes o editar los existentes.
          </p>
        </div>
        <div className="lots-selector-search">
          <Search size={17} className="lots-selector-searchIcon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar proyecto..."
            className="lots-selector-searchInput"
          />
        </div>
      </section>

      {loading && (
        <section className="lots-selector-empty">
          <Blocks size={28} />
          <div>
            <h3>Cargando proyectos...</h3>
            <p>Estamos preparando el modulo de lotes.</p>
          </div>
        </section>
      )}

      {!loading && filteredProjects.length === 0 && (
        <section className="lots-selector-empty">
          <Blocks size={28} />
          <div>
            <h3>No hay proyectos para gestionar lotes</h3>
            <p>Crea un proyecto o cambia la busqueda para continuar.</p>
          </div>
          <button type="button" className="lots-project-btn lots-project-btn-primary" onClick={() => navigate('/dashboard/proyectos/agregar')}>
            <PlusCircle size={16} />
            Crear proyecto
          </button>
        </section>
      )}

      {!loading && filteredProjects.length > 0 && (
        <section className="lots-project-grid">
          {filteredProjects.map((proyecto) => (
            <LotProjectCard
              key={proyecto.idproyecto}
              proyecto={proyecto}
              onOpenProject={(projectId) => navigate(`/dashboard/lotes/${projectId}`)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
