import React, { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import ProjectModuleShell from '../../components/ProjectModuleShell.jsx';
import './Planning.css';

const LotesModal = React.lazy(() => import('../../../inmobiliaria/lote/LotesModal.jsx'));

export default function Planning() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((p) => String(p.idproyecto) === String(projectId));
  const idproyecto = projectId ? Number(projectId) : null;

  return (
    <ProjectModuleShell
      moduleTitle="Plano"
      moduleDescription="Traza el proyecto, usa overlays PDF y administra la geometría de lotes en una vista técnica integrada al dashboard."
      moduleAccent="violet"
      rootPath="/dashboard/plano"
      selectedProject={proyecto || null}
      projects={proyectos}
      onSelectProject={(id) => navigate(`/dashboard/plano/${id}`)}
      renderProjectActions={({ proyecto: project, onEditProject }) => (
        <>
          <button
            type="button"
            className="project-module-openBtn"
            onClick={() => navigate(`/dashboard/plano/${project.idproyecto}`)}
          >
            Abrir plano
          </button>
          <button
            type="button"
            className="project-module-editLink project-module-editLink--stacked"
            onClick={() => navigate(`/dashboard/plano/${project.idproyecto}/pdf`)}
          >
            Gestionar PDF
          </button>
          <button type="button" className="project-module-editLink" onClick={onEditProject}>
            Editar proyecto
          </button>
        </>
      )}
    >
      <div className="admin-workspace-body admin-embedded-shell">
        <Suspense fallback={null}>
          <LotesModal
            idproyecto={idproyecto}
            proyectoNombre={proyecto?.nombreproyecto || 'Proyecto'}
            embedded
            onClose={() => navigate('/dashboard/plano')}
          />
        </Suspense>
      </div>
    </ProjectModuleShell>
  );
}
