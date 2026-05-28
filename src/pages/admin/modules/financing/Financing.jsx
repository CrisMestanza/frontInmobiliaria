import React, { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from '../../AdminContext';
import ProjectModuleShell from '../../components/ProjectModuleShell.jsx';
import './Financing.css';

const FinancingModal = React.lazy(() => import('../../../inmobiliaria/proyecto/FinancingModal.jsx'));

export default function Financing() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { proyectos, refreshOverview } = useAdmin();

  const proyecto = proyectos.find((p) => String(p.idproyecto) === String(projectId));

  return (
    <ProjectModuleShell
      moduleTitle="Financiamiento"
      moduleDescription="Ajusta iniciales, meses, tasas y reglas comerciales por proyecto dentro de una pantalla de trabajo más clara."
      moduleAccent="blue"
      rootPath="/dashboard/financiamiento"
      selectedProject={proyecto}
      projects={proyectos}
      onSelectProject={(id) => navigate(`/dashboard/financiamiento/${id}`)}
    >
      <div className="admin-workspace-body admin-embedded-shell">
        <Suspense fallback={<div className="module-inline-loading financing-inline-loading">Cargando configuración financiera...</div>}>
          <FinancingModal
            embedded
            proyecto={proyecto}
            onClose={({ refreshed }) => {
              if (refreshed) refreshOverview();
              navigate('/dashboard/financiamiento');
            }}
          />
        </Suspense>
      </div>
    </ProjectModuleShell>
  );
}
