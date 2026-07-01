// PublicMap — Centraliza enlace público, compartir en redes y visibilidad de proyectos
import React, { useState } from 'react';
import { Link, Copy, ExternalLink, MapPin, Globe, EyeOff, Share2, CheckCircle2, Lightbulb } from 'lucide-react';
import { FaWhatsapp, FaFacebook } from 'react-icons/fa';
import { useAdmin } from '../../AdminContext';
import './PublicMap.css';

const TIPS = [
  'Comparte tu enlace por WhatsApp en grupos de clientes potenciales.',
  'Publica el enlace en tu bio de Facebook o Instagram.',
  'Envíalo a agentes inmobiliarios de tu zona para ampliar tu red.',
  'Agrégalo a tus correos como parte de tu firma profesional.',
];

export default function PublicMap() {
  const { proyectos } = useAdmin();
  const idInmo = localStorage.getItem('idinmobiliaria');
  const nombreInmo = localStorage.getItem('nombreinmobiliaria');
  const mapUrl = `${window.location.origin}/mapa/${idInmo}`;
  const [copied, setCopied] = useState(false);

  const publicProjects = proyectos.filter((p) => p.publico_mapa !== 0);
  const hiddenProjects = proyectos.filter((p) => p.publico_mapa === 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(mapUrl);
    setCopied(true);
    window.alertSuccess?.('Enlace copiado');
    setTimeout(() => setCopied(false), 2200);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`¡Hola! Te comparto el mapa de proyectos de ${nombreInmo || 'GeoHabita'}: ${mapUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(mapUrl)}`, '_blank');
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator.share({ title: nombreInmo || 'GeoHabita', url: mapUrl }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="publicmap-page">
      <div className="publicmap-header">
        <div>
          <h2>Mapa Público</h2>
          <p>Comparte tu portafolio de proyectos con clientes en tiempo real</p>
        </div>
      </div>

      {/* Share card */}
      <div className="publicmap-share-card">
        <div className="publicmap-share-top">
          <div className="publicmap-share-icon"><Link size={22} /></div>
          <div className="publicmap-share-content">
            <label>Tu enlace exclusivo</label>
            {nombreInmo && <span className="publicmap-inmo-name">{nombreInmo}</span>}
          </div>
        </div>
        <div className="publicmap-url-row">
          <input
            className="publicmap-url-input"
            readOnly
            value={mapUrl}
            onClick={(e) => e.target.select()}
          />
          <button onClick={handleCopy} className={`publicmap-btn publicmap-btn--copy${copied ? ' publicmap-btn--copied' : ''}`}>
            {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button onClick={() => window.open(mapUrl, '_blank')} className="publicmap-btn publicmap-btn--open">
            <ExternalLink size={15} /> Ver mapa
          </button>
        </div>
        <div className="publicmap-social-row">
          <span className="publicmap-social-label">Compartir en:</span>
          <button onClick={shareWhatsApp} className="publicmap-social-btn publicmap-social-btn--wa">
            <FaWhatsapp size={15} /> WhatsApp
          </button>
          <button onClick={shareFacebook} className="publicmap-social-btn publicmap-social-btn--fb">
            <FaFacebook size={15} /> Facebook
          </button>
          <button onClick={shareNative} className="publicmap-social-btn publicmap-social-btn--share">
            <Share2 size={15} /> Más opciones
          </button>
        </div>
      </div>

      {/* Visibility summary */}
      <div className="publicmap-visibility">
        <h3 className="publicmap-section-title">Visibilidad de proyectos</h3>
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
        <h3 className="publicmap-section-title">Proyectos y su estado público</h3>
        <div className="publicmap-projects-list">
          {proyectos.length === 0 ? (
            <p className="publicmap-empty">No hay proyectos registrados.</p>
          ) : (
            proyectos.map((p) => {
              const thumb = p.hero_image_resolved || p.imagenproyecto || p.imagen;
              return (
                <div
                  key={p.idproyecto}
                  className={`publicmap-project-row${p.publico_mapa === 0 ? ' publicmap-project-row--hidden' : ''}`}
                >
                  {thumb && (
                    <div className="publicmap-project-thumb">
                      <img src={thumb} alt={p.nombreproyecto} />
                    </div>
                  )}
                  <div className="publicmap-project-info">
                    <strong>{p.nombreproyecto}</strong>
                    <span>{p.publico_mapa !== 0 ? 'Visible en el mapa público' : 'No aparece en el mapa público'}</span>
                  </div>
                  <span className={`publicmap-badge${p.publico_mapa !== 0 ? ' publicmap-badge--public' : ' publicmap-badge--hidden'}`}>
                    {p.publico_mapa !== 0 ? 'Público' : 'Oculto'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="publicmap-tips">
        <h3 className="publicmap-section-title"><Lightbulb size={15} /> Tips para difundir tu mapa</h3>
        <ul className="publicmap-tips-list">
          {TIPS.map((tip, i) => (
            <li key={i} className="publicmap-tip-item">
              <span className="publicmap-tip-dot" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
