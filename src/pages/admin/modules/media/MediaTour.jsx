import React, { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Image, LayoutPanelTop } from 'lucide-react';
import { useAdmin } from '../../AdminContext';
import ProjectModuleShell from '../../components/ProjectModuleShell.jsx';
import './Media.css';

const Modal360 = React.lazy(() => import('../../../casa360/Modal360.jsx'));

export default function MediaTour() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((p) => String(p.idproyecto) === String(projectId));
  const galleryCount = Array.isArray(proyecto?.gallery_images) ? proyecto.gallery_images.length : 0;

  return (
    <ProjectModuleShell
      moduleTitle="Tour 360"
      moduleDescription="Editor dedicado para vistas 360, hotspots y overlays 2D, sin mezclarlo con la gestión de galería del proyecto."
      moduleAccent="cyan"
      rootPath="/dashboard/media"
      selectedProject={proyecto || null}
      projects={proyectos}
      onSelectProject={(id) => navigate(`/dashboard/media/${id}/tour360`)}
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
      {!proyecto ? null : (
        <div className="media-page media-tour-page">
          <section className="media-tourIntro">
            <div className="media-tourIntroCopy">
              <span className="media-eyebrow">Editor 360 dedicado</span>
              <h2 className="media-title">Recorrido inmersivo del proyecto</h2>
              <p className="media-copy">
                Esta pantalla concentra únicamente el trabajo del tour 360: vistas, hotspots y overlay 2D, en un stage más amplio y limpio.
              </p>
            </div>
            <div className="media-tourIntroStats">
              <span><Globe size={16} /> Tour 360</span>
              <span><Image size={16} /> {galleryCount} recursos base</span>
              <span><LayoutPanelTop size={16} /> Overlay y hotspots</span>
            </div>
          </section>

          <section className="media-tourStage">
            <Suspense fallback={<div className="media-tourLoading">Cargando editor 360...</div>}>
              <Modal360 embedded idproyecto={Number(projectId)} onClose={() => navigate(`/dashboard/media/${projectId}`)} />
            </Suspense>
          </section>
        </div>
      )}
    </ProjectModuleShell>
  );
}
