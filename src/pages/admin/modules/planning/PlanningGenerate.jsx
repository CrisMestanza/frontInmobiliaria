import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import AgregarLoteBlock from '../../../inmobiliaria/lote/agregarLoteBlock.jsx';
import AdminWorkspaceBreadcrumb from '../../components/AdminWorkspaceBreadcrumb.jsx';

export default function PlanningGenerate() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((item) => String(item.idproyecto) === String(projectId));

  return (
    <div className="admin-workspace">
      <div className="admin-workspace-head">
        <div>
          <AdminWorkspaceBreadcrumb
            backLabel="Plano"
            currentLabel="Generar lotes"
            onBack={() => navigate(`/dashboard/plano/${projectId}`)}
          />
          <p className="admin-workspace-text">
            Genera lotes por bloque sobre <strong>{proyecto?.nombreproyecto || 'el proyecto seleccionado'}</strong>, revisa geometría y registra el conjunto sin salir del dashboard.
          </p>
        </div>
      </div>

      <div className="admin-workspace-body admin-embedded-shell">
        <AgregarLoteBlock
          embedded
          idproyecto={Number(projectId)}
          onClose={() => navigate(`/dashboard/plano/${projectId}`)}
        />
      </div>
    </div>
  );
}
