// PublicMap — Centralize public map link, sharing, visibility status
import React from 'react';
import { Link, Copy, ExternalLink, MapPin, Globe, EyeOff } from 'lucide-react';
import { useAdmin } from '../../AdminContext';
import './PublicMap.css';

export default function PublicMap() {
  const { proyectos } = useAdmin();
  const idInmo = localStorage.getItem('idinmobiliaria');
  const nombreInmo = localStorage.getItem('nombreinmobiliaria');
  const mapUrl = `${window.location.origin}/mapa/${idInmo}`;

  const publicProjects = proyectos.filter((p) => p.publico_mapa !== 0);
  const hiddenProjects = proyectos.filter((p) => p.publico_mapa === 0);

  return (
    <div className="publicmap-page">
      <div className="publicmap-header">
        <div>
          <h2>Mapa Público</h2>
          <p>Enlace que puedes compartir con tus clientes para que exploren tus proyectos</p>
        </div>
      </div>

      {/* Share card */}
      <div className="publicmap-share-card">
        <div className="publicmap-share-icon"><Link size={28} /></div>
        <div className="publicmap-share-content">
          <label>Tu enlace exclusivo — {nombreInmo}</label>
          <div className="publicmap-url-row">
            <input className="publicmap-url-input" readOnly value={mapUrl} />
            <button onClick={() => { navigator.clipboard.writeText(mapUrl); window.alertSuccess?.('Copiado'); }} className="publicmap-btn publicmap-btn--copy">
              <Copy size={16} /> Copiar
            </button>
            <button onClick={() => window.open(mapUrl, '_blank')} className="publicmap-btn publicmap-btn--open">
              <ExternalLink size={16} /> Abrir
            </button>
          </div>
        </div>
      </div>

      {/* Visibility summary */}
      <div className="publicmap-visibility">
        <h3>Visibilidad de proyectos</h3>
        <div className="publicmap-vis-grid">
          <div className="publicmap-vis-card publicmap-vis--public">
            <Globe size={22} />
            <div>
              <strong>{publicProjects.length}</strong>
              <span>Visibles en mapa</span>
            </div>
          </div>
          <div className="publicmap-vis-card publicmap-vis--hidden">
            <EyeOff size={22} />
            <div>
              <strong>{hiddenProjects.length}</strong>
              <span>Ocultos del mapa</span>
            </div>
          </div>
          <div className="publicmap-vis-card publicmap-vis--total">
            <MapPin size={22} />
            <div>
              <strong>{proyectos.length}</strong>
              <span>Total proyectos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project list */}
      <div className="publicmap-projects">
        <h3>Proyectos y su estado público</h3>
        <div className="publicmap-projects-list">
          {proyectos.length === 0 ? (
            <p className="publicmap-empty">No hay proyectos registrados.</p>
          ) : (
            proyectos.map((p) => (
              <div key={p.idproyecto} className={`publicmap-project-row ${p.publico_mapa !== 0 ? '' : 'publicmap-project-row--hidden'}`}>
                <div className="publicmap-project-info">
                  <strong>{p.nombreproyecto}</strong>
                  <span>{p.publico_mapa !== 0 ? '🌐 Visible' : '🔒 Oculto'}</span>
                </div>
                <span className={`publicmap-badge ${p.publico_mapa !== 0 ? 'publicmap-badge--public' : 'publicmap-badge--hidden'}`}>
                  {p.publico_mapa !== 0 ? 'Público' : 'Incógnito'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
