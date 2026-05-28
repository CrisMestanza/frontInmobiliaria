import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import LotesModal from '../../../inmobiliaria/lote/LotesModal.jsx';

export default function LotProjectList() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { proyectos } = useAdmin();

  const proyecto = proyectos.find((item) => String(item.idproyecto) === String(projectId));

  return (
    <div className="admin-embedded-shell">
        <LotesModal
          embedded
          idproyecto={Number(projectId)}
          proyectoNombre={proyecto?.nombreproyecto || 'Proyecto'}
          onClose={() => navigate('/dashboard/lotes')}
        />
    </div>
  );
}
