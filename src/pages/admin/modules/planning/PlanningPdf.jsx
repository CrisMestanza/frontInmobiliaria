import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import AgregarLotePDF from '../../../inmobiliaria/lote/agregarLotePDF.jsx';
import AdminWorkspaceBreadcrumb from '../../components/AdminWorkspaceBreadcrumb.jsx';

export default function PlanningPdf() {
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
            currentLabel="Ajustar PDF"
            onBack={() => navigate(`/dashboard/plano/${projectId}`)}
          />
          <p className="admin-workspace-text">
            Alinea el plano PDF del proyecto <strong>{proyecto?.nombreproyecto || ''}</strong> para usarlo como referencia visual del trazado.
          </p>
        </div>
      </div>

      <div className="admin-workspace-body admin-embedded-shell">
        <AgregarLotePDF
          embedded
          idproyecto={Number(projectId)}
          onClose={() => navigate(`/dashboard/plano/${projectId}`)}
        />
      </div>
    </div>
  );
}
