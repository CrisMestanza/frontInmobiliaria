import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CircleDot, ExternalLink, Globe2, Image as ImageIcon, Layers3, MapPinned } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProjectImageCandidates, hasFinancingConfigValue } from '../../../services/adminService.js';
import './ProjectModuleShell.css';

function ProjectPickerCard({ proyecto, onOpen, accentClass, renderProjectActions }) {
  const navigate = useNavigate();
  const imageCandidates = useMemo(() => getProjectImageCandidates(proyecto), [proyecto]);
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageCandidates[imageIndex] || null;
  const stats = proyecto.lote_stats || {};
  const galleryCount = Array.isArray(proyecto.gallery_images) ? proyecto.gallery_images.length : 0;
  const financingReady = hasFinancingConfigValue(proyecto.financing_config || proyecto.financing_config_full);

  useEffect(() => {
    setImageIndex(0);
  }, [proyecto?.idproyecto, imageCandidates.length]);

  return (
    <article className={`project-module-pickerCard ${accentClass}`}>
      <div className="project-module-pickerMedia">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={proyecto.nombreproyecto}
            className="project-module-pickerImage"
            loading="lazy"
            onError={() =>
              setImageIndex((prev) =>
                prev + 1 < imageCandidates.length ? prev + 1 : prev,
              )
            }
          />
        ) : (
          <div className="project-module-pickerFallback">
            <Building2 size={28} />
          </div>
        )}
      </div>
      <div className="project-module-pickerBody">
        <div className="project-module-pickerHead">
          <div>
            <span className="project-module-pickerKicker">Proyecto listo para operar</span>
            <h3>{proyecto.nombreproyecto}</h3>
          </div>
          <span className={`project-module-pickerBadge ${proyecto.publico_mapa !== 0 ? 'is-public' : 'is-private'}`}>
            {proyecto.publico_mapa !== 0 ? 'Público' : 'Privado'}
          </span>
        </div>

        <div className="project-module-pickerMetrics">
          <div>
            <strong>{stats.total ?? 0}</strong>
            <span>Lotes</span>
          </div>
          <div>
            <strong>{proyecto.space_stats?.total ?? 0}</strong>
            <span>Espacios</span>
          </div>
          <div>
            <strong>{galleryCount}</strong>
            <span>Media</span>
          </div>
          <div>
            <strong>{financingReady ? 'OK' : 'Pend.'}</strong>
            <span>Financia</span>
          </div>
        </div>

        <div className="project-module-pickerActions">
          {renderProjectActions ? (
            renderProjectActions({
              proyecto,
              onOpenProject: () => onOpen(proyecto.idproyecto),
              onEditProject: () => navigate(`/dashboard/proyectos/${proyecto.idproyecto}/editar`),
            })
          ) : (
            <>
              <button type="button" className="project-module-openBtn" onClick={() => onOpen(proyecto.idproyecto)}>
                Abrir módulo
              </button>
              <button type="button" className="project-module-editLink" onClick={() => navigate(`/dashboard/proyectos/${proyecto.idproyecto}/editar`)}>
                Editar proyecto <ExternalLink size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ProjectModuleShell({
  moduleTitle,
  moduleDescription,
  moduleAccent = 'emerald',
  rootPath,
  selectedProject,
  projects = [],
  onSelectProject,
  renderProjectActions,
  stageClassName = '',
  children,
}) {
  const navigate = useNavigate();
  const imageCandidates = useMemo(
    () => getProjectImageCandidates(selectedProject),
    [selectedProject],
  );
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const imageSrc = imageCandidates[heroImageIndex] || null;
  const selectedStats = selectedProject?.lote_stats || {};
  const financingReady = hasFinancingConfigValue(selectedProject?.financing_config || selectedProject?.financing_config_full);
  const galleryCount = Array.isArray(selectedProject?.gallery_images) ? selectedProject.gallery_images.length : 0;

  const pickerTitle = `Gestiona ${moduleTitle.toLowerCase()} por proyecto`;

  useEffect(() => {
    setHeroImageIndex(0);
  }, [selectedProject?.idproyecto, imageCandidates.length]);

  if (!selectedProject) {
    return (
      <div className="project-module-shell">
        <section className={`project-module-hero project-module-hero--${moduleAccent}`}>
          <div className="project-module-heroCopy">
            <span className="project-module-eyebrow">{pickerTitle}</span>
            <h1 className="project-module-title">{moduleTitle}</h1>
            <p className="project-module-text">{moduleDescription}</p>
          </div>
        </section>

        {projects.length === 0 ? (
          <section className="project-module-emptyState">
            <Building2 size={30} />
            <div>
              <h3>No hay proyectos para este módulo</h3>
              <p>Crea o publica al menos un proyecto para empezar a trabajar este flujo dentro del dashboard.</p>
            </div>
            <button type="button" className="project-module-openBtn" onClick={() => navigate('/dashboard/proyectos/agregar')}>
              Crear proyecto
            </button>
          </section>
        ) : (
          <section className="project-module-pickerSection">
            <div className="project-module-sectionHead">
              <div>
                <h2>Elige un proyecto activo</h2>
                <p>Entras directo al módulo correcto sin volver a la pantalla de proyectos.</p>
              </div>
            </div>
            <div className="project-module-pickerGrid">
              {projects.map((proyecto) => (
                <ProjectPickerCard
                  key={proyecto.idproyecto}
                  proyecto={proyecto}
                  onOpen={onSelectProject}
                  accentClass={`project-module-pickerCard--${moduleAccent}`}
                  renderProjectActions={renderProjectActions}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="project-module-shell">
      <section className={`project-module-hero project-module-hero--${moduleAccent}`}>
        <div className="project-module-heroCopy">
          <button type="button" className="project-module-back" onClick={() => navigate(rootPath)}>
            <ArrowLeft size={16} /> Cambiar proyecto
          </button>
          <div className="project-module-breadcrumb">
            <button type="button" className="project-module-breadcrumbButton" onClick={() => navigate(rootPath)}>
              {moduleTitle}
            </button>
            <span className="project-module-breadcrumbDivider">&gt;</span>
            <span className="project-module-breadcrumbCurrent">{selectedProject.nombreproyecto}</span>
          </div>
          <span className="project-module-eyebrow">{moduleTitle}</span>
          <h1 className="project-module-title">{selectedProject.nombreproyecto}</h1>
          <p className="project-module-text">{moduleDescription}</p>
          <div className="project-module-chips">
            <span><Layers3 size={14} /> {selectedStats.total ?? 0} lotes</span>
            <span><MapPinned size={14} /> {selectedProject.space_stats?.total ?? 0} espacios</span>
            <span><ImageIcon size={14} /> {galleryCount} recursos</span>
            <span><Globe2 size={14} /> {selectedProject.publico_mapa !== 0 ? 'Visible en mapa' : 'Oculto del mapa'}</span>
          </div>
        </div>

        <div className="project-module-heroPanel">
          <div className="project-module-heroPreview">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={selectedProject.nombreproyecto}
                className="project-module-heroImage"
                onError={() =>
                  setHeroImageIndex((prev) =>
                    prev + 1 < imageCandidates.length ? prev + 1 : prev,
                  )
                }
              />
            ) : (
              <div className="project-module-heroFallback">
                <Building2 size={32} />
              </div>
            )}
          </div>
          <div className="project-module-heroSummary">
            <div className="project-module-summaryItem">
              <CircleDot size={16} />
              <div>
                <strong>Estado</strong>
                <span>{selectedProject.estado === 1 ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
            <div className="project-module-summaryItem">
              <CircleDot size={16} />
              <div>
                <strong>Financiamiento</strong>
                <span>{financingReady ? 'Configurado' : 'Pendiente'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`project-module-stage ${stageClassName}`.trim()}>
        {children}
      </section>
    </div>
  );
}
