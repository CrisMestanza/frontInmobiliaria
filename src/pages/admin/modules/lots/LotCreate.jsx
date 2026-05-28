import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import AgregarLote from '../../../inmobiliaria/lote/agregarLote.jsx';
import AdminWorkspaceBreadcrumb from '../../components/AdminWorkspaceBreadcrumb.jsx';

export default function LotCreate() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((item) => String(item.idproyecto) === String(projectId));

  return (
    <div className="admin-workspace">
      <div className="admin-workspace-head">
        <div>
          <AdminWorkspaceBreadcrumb
            backLabel="Lotes"
            currentLabel="Nuevo lote manual"
            onBack={() => navigate(`/dashboard/lotes/${projectId}`)}
          />
          <p className="admin-workspace-text">
            Registra un lote individual dentro de <strong>{proyecto?.nombreproyecto || 'este proyecto'}</strong> con polígono, ficha y galería propia.
          </p>
        </div>
      </div>

      <div className="admin-workspace-body admin-embedded-shell">
        <AgregarLote
          embedded
          idproyecto={Number(projectId)}
          onClose={() => navigate(`/dashboard/lotes/${projectId}`)}
        />
      </div>
    </div>
  );
}
