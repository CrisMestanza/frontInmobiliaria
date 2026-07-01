// Leads — Contactos y leads con métricas por canal y por proyecto
import React, { useMemo } from 'react';
import { MessageCircleHeart, TrendingUp, Users, BarChart3, Star } from 'lucide-react';
import { FaWhatsapp, FaFacebook, FaGlobe } from 'react-icons/fa';
import { useAdmin } from '../../AdminContext';
import './Leads.css';

const CANALES = [
  { nombre: 'WhatsApp', Icono: FaWhatsapp, color: '#25d366', bg: 'rgba(37,211,102,0.1)', borderColor: 'rgba(37,211,102,0.28)' },
  { nombre: 'Facebook', Icono: FaFacebook, color: '#1877f2', bg: 'rgba(24,119,242,0.1)', borderColor: 'rgba(24,119,242,0.28)' },
  { nombre: 'Web', Icono: FaGlobe, color: '#0077b6', bg: 'rgba(0,119,182,0.1)', borderColor: 'rgba(0,119,182,0.28)' },
];

export default function Leads() {
  const { clicks, proyectos, totalContactos, totalInteres, engagementRate } = useAdmin();

  const canalData = useMemo(() => CANALES.map((canal) => {
    const found = clicks?.detalle_contactos?.find((r) => r.redSocial === canal.nombre);
    const total = found?.total || 0;
    const pct = totalContactos > 0 ? Math.round((total / totalContactos) * 100) : 0;
    return { ...canal, total, pct };
  }), [clicks, totalContactos]);

  const sortedProyectos = useMemo(() =>
    [...proyectos].sort((a, b) => (b.total_contactos || 0) - (a.total_contactos || 0)),
    [proyectos]
  );

  const topProject = sortedProyectos[0];

  return (
    <div className="leads-page">
      <div className="leads-header">
        <div>
          <h2>Leads y Contactos</h2>
          <p>Interacciones recibidas desde el mapa público de GeoHabita</p>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="leads-hero-grid">
        <div className="leads-hero-card">
          <div className="leads-hero-icon"><MessageCircleHeart size={26} /></div>
          <div className="leads-hero-body">
            <span className="leads-hero-label">Total de contactos</span>
            <strong className="leads-hero-value">{totalContactos}</strong>
            <span className="leads-hero-sub">{proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {totalInteres != null && (
          <div className="leads-hero-card leads-hero-card--interest">
            <div className="leads-hero-icon"><TrendingUp size={26} /></div>
            <div className="leads-hero-body">
              <span className="leads-hero-label">Interés en proyectos</span>
              <strong className="leads-hero-value">{totalInteres}</strong>
              <span className="leads-hero-sub">visitas e interacciones</span>
            </div>
          </div>
        )}

        {topProject && (topProject.total_contactos || 0) > 0 && (
          <div className="leads-hero-card leads-hero-card--top">
            <div className="leads-hero-icon"><Star size={26} /></div>
            <div className="leads-hero-body">
              <span className="leads-hero-label">Proyecto destacado</span>
              <strong className="leads-hero-value">{topProject.total_contactos}</strong>
              <span className="leads-hero-sub">{topProject.nombreproyecto}</span>
            </div>
          </div>
        )}
      </div>

      {/* Canal breakdown */}
      <div className="leads-section">
        <h3 className="leads-section-title"><BarChart3 size={15} /> Por canal de contacto</h3>
        <div className="leads-canales-grid">
          {canalData.map(({ nombre, Icono, color, bg, borderColor, total, pct }) => (
            <div key={nombre} className="leads-canal-card" style={{ background: bg, borderColor }}>
              <div className="leads-canal-header">
                <Icono size={19} color={color} />
                <span className="leads-canal-name" style={{ color }}>{nombre}</span>
                <strong className="leads-canal-count" style={{ color }}>{total}</strong>
              </div>
              <div className="leads-canal-bar-track">
                <div className="leads-canal-bar-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="leads-canal-pct">{pct}% del total</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-project breakdown */}
      <div className="leads-section">
        <h3 className="leads-section-title"><Users size={15} /> Contactos por proyecto</h3>
        {proyectos.length === 0 ? (
          <p className="leads-empty-msg">No hay proyectos registrados aún.</p>
        ) : (
          <div className="leads-project-list">
            {sortedProyectos.map((p, i) => {
              const pct = totalContactos > 0
                ? Math.min(100, ((p.total_contactos || 0) / totalContactos) * 100)
                : 0;
              const isTop = i === 0 && (p.total_contactos || 0) > 0;
              return (
                <div key={p.idproyecto} className={`leads-project-row${isTop ? ' leads-project-row--top' : ''}`}>
                  <span className="leads-project-rank">#{i + 1}</span>
                  <div className="leads-project-info">
                    <strong>{p.nombreproyecto}</strong>
                    <span>{p.total_contactos ?? 0} contacto{(p.total_contactos ?? 0) !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="leads-project-bar-wrap">
                    <div className="leads-project-bar">
                      <div className="leads-project-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="leads-project-pct">{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
