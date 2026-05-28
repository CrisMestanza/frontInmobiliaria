import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProyectoModal from '../../../inmobiliaria/proyecto/agregarProyecto.jsx';
import AdminWorkspaceBreadcrumb from '../../components/AdminWorkspaceBreadcrumb.jsx';

export default function ProjectCreate() {
  const navigate = useNavigate();

  return (
    <div className="admin-workspace">
      <div className="admin-workspace-head">
        <div>
          <AdminWorkspaceBreadcrumb
            backLabel="Proyectos"
            currentLabel="Agregar proyecto"
            onBack={() => navigate('/dashboard/proyectos')}
          />
          <p className="admin-workspace-text">
            Crea un nuevo proyecto inmobiliario con su ubicación, galería y servicios sin salir del dashboard.
          </p>
        </div>
      </div>

      <div className="admin-workspace-body admin-embedded-shell">
        <ProyectoModal
          embedded
          idinmobiliaria={localStorage.getItem('idinmobiliaria')}
          onClose={(options) => {
            navigate('/dashboard/proyectos');
          }}
        />
      </div>
    </div>
  );
}
