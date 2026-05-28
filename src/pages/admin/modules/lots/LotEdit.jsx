import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EditLote from '../../../inmobiliaria/lote/editLote.jsx';
import { fetchLoteDetail } from '../../../../services/lotsService.js';
import AdminWorkspaceBreadcrumb from '../../components/AdminWorkspaceBreadcrumb.jsx';

export default function LotEdit() {
  const navigate = useNavigate();
  const { projectId, loteId } = useParams();
  const [lote, setLote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchLoteDetail(loteId);
        if (!cancelled) {
          setLote(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [loteId]);

  return (
    <div className="admin-workspace">
      <div className="admin-workspace-head">
        <div>
          <AdminWorkspaceBreadcrumb
            backLabel="Lotes"
            currentLabel="Editar lote"
            onBack={() => navigate(`/dashboard/lotes/${projectId}`)}
          />
          <p className="admin-workspace-text">
            Ajusta datos, geometría e imágenes del lote seleccionado desde una vista dedicada del dashboard.
          </p>
        </div>
      </div>

      <div className="admin-workspace-body admin-embedded-shell">
        {loading && <div className="projects-empty"><p>Cargando lote...</p></div>}
        {!loading && error && <div className="projects-empty"><p>No se pudo cargar el lote.</p></div>}
        {!loading && lote && (
          <EditLote
            embedded
            visible
            idproyecto={Number(projectId)}
            lote={lote}
            onClose={() => navigate(`/dashboard/lotes/${projectId}`)}
          />
        )}
      </div>
    </div>
  );
}
