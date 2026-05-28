import React, { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import ProjectModuleShell from '../../components/ProjectModuleShell.jsx';
import './Icons.css';

const IconoModal = React.lazy(() => import('../../../inmobiliaria/proyecto/icono/IconoModal.jsx'));

export default function Icons() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((p) => String(p.idproyecto) === String(projectId));

  return (
    <ProjectModuleShell
      moduleTitle="Íconos"
      moduleDescription="Coloca puntos de interés, revisa marcadores ya publicados y limpia el mapa del proyecto sin volver a una capa modal."
      moduleAccent="rose"
      rootPath="/dashboard/iconos"
      selectedProject={proyecto}
      projects={proyectos}
      onSelectProject={(id) => navigate(`/dashboard/iconos/${id}`)}
    >
      <div className="admin-workspace-body admin-embedded-shell">
        <Suspense fallback={<div className="module-inline-loading icons-inline-loading">Preparando módulo de íconos...</div>}>
          <IconoModal
            embedded
            idproyecto={Number(projectId)}
            onClose={() => navigate('/dashboard/iconos')}
          />
        </Suspense>
      </div>
    </ProjectModuleShell>
  );
}
