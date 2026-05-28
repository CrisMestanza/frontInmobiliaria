import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Globe, Image, SquarePen } from 'lucide-react';
import { useAdmin } from '../../AdminContext';
import { resolveProjectImageUrl } from '../../../../services/adminService.js';
import ProjectModuleShell from '../../components/ProjectModuleShell.jsx';
import './Media.css';

const getProjectImages = (proyecto) => {
  if (!proyecto) return [];
  const candidates = [
    proyecto.hero_image_resolved,
    ...(Array.isArray(proyecto.gallery_images) ? proyecto.gallery_images : []),
    proyecto.hero_image,
    proyecto.imagenproyecto,
    proyecto.imagen,
    proyecto.portada,
  ]
    .map(resolveProjectImageUrl)
    .filter(Boolean);

  return Array.from(new Set(candidates));
};

export default function Media() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { proyectos, handleTogglePublic } = useAdmin();

  const proyecto = proyectos.find((p) => String(p.idproyecto) === String(projectId));
  const imageCandidates = useMemo(() => getProjectImages(proyecto), [proyecto]);

  if (!proyecto) {
    return (
      <ProjectModuleShell
        moduleTitle="Tours y Media"
        moduleDescription="Separa la gestión de galería del editor 360 para entrar directo al flujo que necesitas por proyecto."
        moduleAccent="cyan"
        rootPath="/dashboard/media"
        selectedProject={null}
        projects={proyectos}
        onSelectProject={(id) => navigate(`/dashboard/media/${id}`)}
        renderProjectActions={({ proyecto: project, onEditProject }) => (
          <>
            <button
              type="button"
              className="project-module-openBtn"
              onClick={() => navigate(`/dashboard/media/${project.idproyecto}`)}
            >
              Abrir media
            </button>
            <button
              type="button"
              className="project-module-editLink project-module-editLink--stacked"
              onClick={() => navigate(`/dashboard/media/${project.idproyecto}/tour360`)}
            >
              Abrir tour 360
            </button>
            <button type="button" className="project-module-editLink" onClick={onEditProject}>
              Editar proyecto
            </button>
          </>
        )}
      />
    );
  }

  const heroImage = imageCandidates[0] || null;
  const galleryPreview = imageCandidates.slice(0, 8);
  const galleryCount = imageCandidates.length;
  const hasHero = !!heroImage;
  const isPublic = proyecto.publico_mapa !== 0;
  return (
    <ProjectModuleShell
      moduleTitle="Media"
      moduleDescription="Gestiona solo los recursos visuales del proyecto: portada, galería y visibilidad pública."
      moduleAccent="cyan"
      rootPath="/dashboard/media"
      selectedProject={proyecto}
      projects={proyectos}
      onSelectProject={(id) => navigate(`/dashboard/media/${id}`)}
      renderProjectActions={({ proyecto: project, onEditProject }) => (
        <>
          <button
            type="button"
            className="project-module-openBtn"
            onClick={() => navigate(`/dashboard/media/${project.idproyecto}`)}
          >
            Abrir media
          </button>
          <button
            type="button"
            className="project-module-editLink project-module-editLink--stacked"
            onClick={() => navigate(`/dashboard/media/${project.idproyecto}/tour360`)}
          >
            Abrir tour 360
          </button>
          <button type="button" className="project-module-editLink" onClick={onEditProject}>
            Editar proyecto
          </button>
        </>
      )}
    >
      <div className="media-page">
        <section className="media-galleryPanel media-galleryPanel--expanded">
          <div className="media-panelHead media-panelHead--gallery">
            <div>
              <span className="media-eyebrow media-eyebrow--soft">Galería visual</span>
              <h3>Portada y recursos del proyecto</h3>
              <p>
                {galleryCount > 0
                  ? `Mostrando ${Math.min(galleryCount, galleryPreview.length)} de ${galleryCount} imágenes disponibles.`
                  : 'Todavía no hay recursos cargados para este proyecto.'}
              </p>
            </div>
            <div className="media-actionRow">
              <button
                onClick={() => navigate(`/dashboard/proyectos/${projectId}/editar`)}
                className="media-actionBtn media-actionBtn--primary"
              >
                <SquarePen size={18} /> Editar imágenes
              </button>
              <button
                onClick={() => handleTogglePublic(proyecto, !isPublic)}
                className="media-actionBtn media-actionBtn--ghost"
              >
                {isPublic ? <EyeOff size={18} /> : <Eye size={18} />}
                {isPublic ? 'Ocultar del mapa público' : 'Publicar en mapa'}
              </button>
              <button
                onClick={() => navigate(`/dashboard/media/${projectId}/tour360`)}
                className="media-actionBtn media-actionBtn--secondary"
              >
                <Globe size={18} /> Abrir tour 360
              </button>
            </div>
          </div>

          {hasHero ? (
            <div className="media-featuredVisual">
              <img src={heroImage} alt={proyecto.nombreproyecto} className="media-featuredImage" />
              <div className="media-featuredOverlay">
                <span className="media-featuredBadge">Portada actual</span>
                <span className={`media-visibilityBadge ${isPublic ? 'is-public' : 'is-private'}`}>
                  {isPublic ? 'Visible en mapa' : 'Oculto del mapa'}
                </span>
              </div>
            </div>
          ) : null}

          <section className="media-galleryPanel">
            {galleryCount > 0 ? (
              <div className="media-galleryGrid">
                {galleryPreview.map((img, i) => (
                  <article key={`${img}-${i}`} className={`media-galleryItem ${i === 0 ? 'is-featured' : ''}`}>
                    <img src={img} alt={`${proyecto.nombreproyecto} imagen ${i + 1}`} loading="lazy" />
                    <div className="media-galleryOverlay">
                      <span>{i === 0 ? 'Portada actual' : `Imagen ${i + 1}`}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="media-emptyState">
                <Image size={32} />
                <div>
                  <strong>Sin imágenes cargadas</strong>
                  <span>Entra a editar proyecto para subir portada y galería.</span>
                </div>
                <button
                  type="button"
                  className="media-actionBtn media-actionBtn--secondary"
                  onClick={() => navigate(`/dashboard/proyectos/${projectId}/editar`)}
                >
                  Ir al editor
                </button>
              </div>
            )}
          </section>
        </section>
      </div>
    </ProjectModuleShell>
  );
}
