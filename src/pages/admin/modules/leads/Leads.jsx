// Leads — Contactos y leads. Shows metrics and prepared structure for future backend support.
import React from 'react';
import { MessageCircleHeart } from 'lucide-react';
import { FaWhatsapp, FaFacebook, FaGlobe } from 'react-icons/fa';
import { useAdmin } from '../../AdminContext';
import './Leads.css';

const canales = [
  { nombre: 'WhatsApp', icono: <FaWhatsapp color="green" size={20} /> },
  { nombre: 'Facebook', icono: <FaFacebook color="#1877f2" size={20} /> },
  { nombre: 'Web', icono: <FaGlobe color="#0077b6" size={20} /> },
];

export default function Leads() {
  const { clicks, proyectos, totalContactos } = useAdmin();

  return (
    <div className="leads-page">
      <div className="leads-header">
        <div>
          <h2>Leads y Contactos</h2>
          <p>Interacciones y contactos recibidos desde el mapa público</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="leads-summary">
        <div className="leads-summary-card leads-summary--total">
          <MessageCircleHeart size={28} />
          <div>
            <strong>{totalContactos}</strong>
            <span>Contactos totales</span>
          </div>
        </div>
        {canales.map((canal) => {
          const red = clicks?.detalle_contactos?.find((r) => r.redSocial === canal.nombre);
          return (
            <div key={canal.nombre} className="leads-summary-card">
              {canal.icono}
              <div>
                <strong>{red?.total || 0}</strong>
                <span>{canal.nombre}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-project breakdown */}
      <div className="leads-section">
        <h3>Contactos por proyecto</h3>
        {proyectos.length === 0 ? (
          <p className="leads-empty-msg">No hay proyectos registrados aún.</p>
        ) : (
          <div className="leads-project-list">
            {proyectos.map((p) => (
              <div key={p.idproyecto} className="leads-project-row">
                <div className="leads-project-info">
                  <strong>{p.nombreproyecto}</strong>
                  <span>{p.total_contactos ?? 0} contactos</span>
                </div>
                <div className="leads-project-bar">
                  <div
                    className="leads-project-bar-fill"
                    style={{ width: `${Math.min(100, ((p.total_contactos || 0) / Math.max(1, totalContactos)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prepared notice */}
      <div className="leads-notice">
        <p>
          <strong>Nota:</strong> El listado detallado de leads por canal y fecha estará disponible cuando el backend exponga el endpoint correspondiente.
          Por ahora puedes ver el resumen de contactos desde el panel de métricas.
        </p>
      </div>
    </div>
  );
}
