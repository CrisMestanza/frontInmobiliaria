import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import EditProyectoModal from '../../../inmobiliaria/proyecto/editProyecto.jsx';
import AdminWorkspaceBreadcrumb from '../../components/AdminWorkspaceBreadcrumb.jsx';

export default function ProjectEdit() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((item) => String(item.idproyecto) === String(projectId));

  if (!proyecto) {
    return (
      <div className="admin-workspace">
        <div className="admin-workspace-head">
          <div>
            <h1 className="admin-workspace-title">Proyecto no encontrado</h1>
            <p className="admin-workspace-text">No se encontró el proyecto solicitado o aún no terminó de cargar.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-workspace">
      <div className="admin-workspace-head">
        <div>
          <AdminWorkspaceBreadcrumb
            backLabel="Proyectos"
            currentLabel="Editar proyecto"
            onBack={() => navigate('/dashboard/proyectos')}
          />
          <p className="admin-workspace-text">
            Ajusta información general, imágenes y geometría del proyecto <strong>{proyecto.nombreproyecto}</strong>.
          </p>
        </div>
      </div>

      <div className="admin-workspace-body admin-embedded-shell">
        <EditProyectoModal
          embedded
          proyecto={proyecto}
          idinmobiliaria={localStorage.getItem('idinmobiliaria')}
          onClose={() => navigate('/dashboard/proyectos')}
        />
      </div>
    </div>
  );
}
