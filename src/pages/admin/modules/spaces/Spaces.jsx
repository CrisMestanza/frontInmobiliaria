import React, { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import ProjectModuleShell from '../../components/ProjectModuleShell.jsx';
import './Spaces.css';

const EspaciosModal = React.lazy(() => import('../../../inmobiliaria/proyecto/espacio/EspaciosModal.jsx'));

export default function Spaces() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((p) => String(p.idproyecto) === String(projectId));

  return (
    <ProjectModuleShell
      moduleTitle="Espacios"
      moduleDescription="Gestiona parques, áreas verdes y elementos del masterplan desde una vista dedicada, sin romper el flujo del dashboard."
      moduleAccent="emerald"
      rootPath="/dashboard/espacios"
      selectedProject={proyecto}
      projects={proyectos}
      onSelectProject={(id) => navigate(`/dashboard/espacios/${id}`)}
      stageClassName="spaces-module-stage"
    >
      <div className="admin-workspace-body admin-embedded-shell">
        <Suspense fallback={<div className="module-inline-loading spaces-inline-loading">Cargando editor de espacios...</div>}>
          <EspaciosModal
            embedded
            idproyecto={Number(projectId)}
            onClose={() => navigate('/dashboard/espacios')}
          />
        </Suspense>
      </div>
    </ProjectModuleShell>
  );
}
