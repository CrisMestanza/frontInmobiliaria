// Overview — Dashboard landing page with metrics, alerts, share link, tutorials
import React, { Suspense, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, CheckCircle2, ClockFading, TagIcon, ChartSpline,
  MessageCircleHeart, FoldersIcon, ChevronLeft, ChevronRight,
  Link, Copy, Share2Icon, MapPin, AlertTriangle,
} from 'lucide-react';
import { FaWhatsapp, FaFacebook, FaGlobe } from 'react-icons/fa';
import { useAdmin } from '../../AdminContext';
import { hasFinancingConfigValue } from '../../../../services/adminService.js';
import './Overview.css';

const redes = [
  { nombre: 'Whatsapp', icono: <FaWhatsapp color="green" /> },
  { nombre: 'Facebook', icono: <FaFacebook color="#1877f2" /> },
  { nombre: 'Web', icono: <FaGlobe color="#0077b6" /> },
];

const tutoriales = (publicBase) => [
  { href: 'https://www.youtube.com/watch?v=lZNPDIBqyCg', titulo: 'Agregar proyectos de lotes, casas y departamentos', descripcion: 'Crea proyectos completos paso a paso en GeoHabita.', imagen: `${publicBase}1.jpg` },
  { href: 'https://www.youtube.com/watch?v=PEvwYZO2BtU', titulo: 'Agregar PDF para trazado, después de crear proyecto', descripcion: 'Sube planos en PDF para dibujar lotes correctamente.', imagen: `${publicBase}2.jpg` },
  { href: 'https://www.youtube.com/watch?v=gzZHYnXD_5Q', titulo: 'Registrar Casa Individual en el Mapa', descripcion: 'Agrega propiedades individuales fácilmente.', imagen: `${publicBase}3.jpg` },
  { href: 'https://www.youtube.com/watch?v=zOIoX1ZvAM0', titulo: 'Agregar lotes, después de crear el proyecto', descripcion: 'Aprende a añadir más lotes cuando tu proyecto ya existe.', imagen: `${publicBase}4.jpg` },
  { href: 'https://www.youtube.com/watch?v=JHP9YWTIgJs', titulo: 'Registro de Proyecto de Departamentos', descripcion: 'Aprende paso a paso cómo crear y configurar un proyecto inmobiliario de departamentos dentro de GeoHabita.', imagen: `${publicBase}5.jpg` },
];

export default function Overview() {
  const navigate = useNavigate();
  const {
    resumen, clicks, proyectos, loading, error,
    totalLotes, totalContactos, totalInteres, engagementRate,
    lotesStatsPorProyecto, refreshOverview,
  } = useAdmin();

  const idInmo = localStorage.getItem('idinmobiliaria');
  const nombreInmo = localStorage.getItem('nombreinmobiliaria');
  const mapUrl = `${window.location.origin}/mapa/${idInmo}`;
  const publicBase = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL;
  const [showRedes, setShowRedes] = useState(false);

  const loteBreakdown = useMemo(() => {
    const disponible = Number(resumen?.lotesDisponibles || 0);
    const reservado = Number(resumen?.lotesReservados || 0);
    const vendido = Number(resumen?.lotesVendidos || 0);
    const total = Math.max(disponible + reservado + vendido, 1);
    return {
      disponible, reservado, vendido,
      pctDisponible: (disponible / total) * 100,
      pctReservado: (reservado / total) * 100,
      pctVendido: (vendido / total) * 100,
    };
  }, [resumen]);

  const tutorialScrollRef = useRef(null);
  const [tutorialScroll, setTutorialScroll] = useState({ left: false, right: false });

  const updateTutorialScrollState = useCallback(() => {
    const container = tutorialScrollRef.current;
    if (!container) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    setTutorialScroll({
      left: container.scrollLeft > 4,
      right: maxScroll - container.scrollLeft > 4,
    });
  }, []);

  const scrollTutorials = (direction) => {
    const container = tutorialScrollRef.current;
    if (!container) return;
    const step = Math.max(container.clientWidth * 0.82, 260);
    container.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  };

  useEffect(() => {
    const container = tutorialScrollRef.current;
    if (!container) return;
    updateTutorialScrollState();
    container.addEventListener('scroll', updateTutorialScrollState);
    window.addEventListener('resize', updateTutorialScrollState);
    return () => {
      container.removeEventListener('scroll', updateTutorialScrollState);
      window.removeEventListener('resize', updateTutorialScrollState);
    };
  }, [updateTutorialScrollState]);

  // Alertas
  const alertas = useMemo(() => {
    const items = [];
    proyectos.forEach((p) => {
      const stats = lotesStatsPorProyecto.get(p.idproyecto);
      if (!p.hero_image_resolved && !p.imagenproyecto && !p.imagen) {
        items.push({ type: 'warn', text: `${p.nombreproyecto}: sin imagen de portada`, id: `img-${p.idproyecto}` });
      }
      if (!hasFinancingConfigValue(p.financing_config || p.financing_config_full)) {
        items.push({ type: 'info', text: `${p.nombreproyecto}: sin financiamiento configurado`, id: `fin-${p.idproyecto}` });
      }
      if (p.publico_mapa === 0) {
        items.push({ type: 'warn', text: `${p.nombreproyecto}: oculto del mapa público`, id: `pub-${p.idproyecto}` });
      }
      if (stats && stats.total === 0) {
        items.push({ type: 'warn', text: `${p.nombreproyecto}: sin lotes registrados`, id: `lot-${p.idproyecto}` });
      }
    });
    return items.slice(0, 8);
  }, [proyectos, lotesStatsPorProyecto]);

  if (loading) {
    return (
      <div className="projects-empty">
        <p>Cargando resumen del dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="projects-empty">
        <p style={{ color: 'var(--color-danger, #e53e3e)', fontSize: '0.85rem', maxWidth: 400, textAlign: 'center' }}>
          Error al cargar el dashboard: {error.message || String(error)}
        </p>
        <button className="btn-copy" style={{ marginTop: 12 }} onClick={refreshOverview}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="overview">
      {/* Hero */}
      <section className="overview-hero">
        <div className="overview-hero-text">
          <span className="overview-hero-eyebrow">Resumen comercial</span>
          <h2>Hola{nombreInmo ? `, ${nombreInmo}` : ''} 👋</h2>
          <p>Así está tu portafolio en GeoHabita hoy.</p>
        </div>
        <div className="overview-hero-link">
          <div className="link-icon-box"><Link size={20} /></div>
          <div className="input-group">
            <label className="link-label">Enlace exclusivo de tus proyectos</label>
            <div className="link-input-wrapper">
              <input className="input-styled" readOnly value={mapUrl} />
              <button onClick={() => { navigator.clipboard.writeText(mapUrl); window.alertSuccess?.('Copiado'); }} className="btn-copy share-action-btn"><Copy size={18} /><span className="share-btn-text">Copiar</span></button>
              <button onClick={() => { navigator.share ? navigator.share({ title: 'GeoHabita', text: 'Accede a mis proyectos en GeoHabita', url: mapUrl }).then(() => window.alertSuccess?.('Enlace compartido')).catch(() => {}) : navigator.clipboard.writeText(mapUrl); }} className="btn-share share-action-btn"><Share2Icon size={18} /><span className="share-btn-text">Compartir</span></button>
              <button onClick={() => window.open(mapUrl, '_blank')} className="btn-map share-action-btn"><MapPin size={18} /><span className="share-btn-text">Ver Mapa</span></button>
            </div>
          </div>
        </div>
      </section>

      {/* Bento stats */}
      <div className="bento-grid">
        <div className="bento-feature">
          <div className="bento-feature-top">
            <span className="stat-label">Lotes Disponibles</span>
            <CheckCircle2 size={22} />
          </div>
          <div className="bento-feature-value">{loteBreakdown.disponible}</div>
          <div className="bento-proportion-bar">
            <span style={{ width: `${loteBreakdown.pctDisponible}%`, background: '#22c55e' }} />
            <span style={{ width: `${loteBreakdown.pctReservado}%`, background: '#eab308' }} />
            <span style={{ width: `${loteBreakdown.pctVendido}%`, background: '#ef4444' }} />
          </div>
          <div className="bento-feature-legend">
            <span><i className="bento-dot" style={{ background: '#22c55e' }} />Disponible {loteBreakdown.disponible}</span>
            <span><i className="bento-dot" style={{ background: '#eab308' }} />Reservado {loteBreakdown.reservado}</span>
            <span><i className="bento-dot" style={{ background: '#ef4444' }} />Vendido {loteBreakdown.vendido}</span>
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Proyectos</div>
          <div className="stat-value">{proyectos.length} <FoldersIcon size={24} color="#cbd5e1" /></div>
        </div>
        <div className="stat-box accent-blue">
          <div className="stat-label">Interés en Proyectos</div>
          <div className="stat-value stat-value-blue">{totalInteres} <ChartSpline size={24} /></div>
        </div>
        <div className="stat-box accent-yellow">
          <div className="stat-label">Lotes Reservados</div>
          <div className="stat-value stat-value-yellow">{resumen?.lotesReservados || 0} <ClockFading size={24} /></div>
        </div>
        <div className="stat-box accent-red">
          <div className="stat-label">Lotes Vendidos</div>
          <div className="stat-value stat-value-red">{resumen?.lotesVendidos || 0} <TagIcon size={24} /></div>
        </div>

        <div className="stat-box accent-black contact-card bento-wide">
          <div className="stat-label">Contactos</div>
          <div className="stat-value stat-value-black">{totalContactos} <MessageCircleHeart size={24} /></div>
          <button onClick={() => setShowRedes(!showRedes)} className="contact-toggle-btn">
            {showRedes ? '▲' : '▼'}
          </button>
          {showRedes && (
            <div className="contact-details">
              {redes.map((rs) => {
                const red = clicks?.detalle_contactos?.find((r) => r.redSocial === rs.nombre);
                return (
                  <div key={rs.nombre} className="contact-row">
                    {rs.icono} <span><strong>{rs.nombre}:</strong> {red ? red.total : 0}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <section className="overview-actions">
        <h3 className="overview-section-title">Accesos rápidos</h3>
        <div className="quick-actions-grid">
          <button onClick={() => navigate('/dashboard/proyectos')} className="quick-action-card quick-action-card--projects">
            <span className="quick-action-icon"><FoldersIcon size={20} /></span>
            <div>
              <strong>Gestionar Proyectos</strong>
              <span>Portafolio, edición y publicación</span>
            </div>
          </button>
          <button onClick={() => navigate('/dashboard/lotes')} className="quick-action-card quick-action-card--lots">
            <span className="quick-action-icon"><Layers size={20} /></span>
            <div>
              <strong>Ver todos los lotes</strong>
              <span>Inventario, precio y estado</span>
            </div>
          </button>
          <button onClick={() => navigate('/dashboard/mapa-publico')} className="quick-action-card quick-action-card--map">
            <span className="quick-action-icon"><MapPin size={20} /></span>
            <div>
              <strong>Mapa Público</strong>
              <span>Visibilidad, enlace y difusión</span>
            </div>
          </button>
          <button onClick={() => navigate('/dashboard/leads')} className="quick-action-card quick-action-card--leads">
            <span className="quick-action-icon"><MessageCircleHeart size={20} /></span>
            <div>
              <strong>Leads y Contactos</strong>
              <span>Interés comercial y seguimiento</span>
            </div>
          </button>
          <a href="https://wa.me/51925545624" target="_blank" rel="noopener noreferrer" className="quick-action-card quick-action-card--support">
            <span className="quick-action-icon"><FaWhatsapp size={20} /></span>
            <div>
              <strong>Soporte GeoHabita</strong>
              <span>Escríbenos, estamos para ayudarte</span>
            </div>
          </a>
        </div>
      </section>

      {/* Alerts */}
      {alertas.length > 0 && (
        <section className="overview-alerts">
          <h3 className="overview-section-title"><AlertTriangle size={16} /> Alertas y recomendaciones</h3>
          <div className="alerts-grid">
            {alertas.map((a) => (
              <div key={a.id} className={`alert-chip alert-chip--${a.type}`}>
                <AlertTriangle size={13} />
                {a.text}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tutorials */}
      <section className="tutorial-section">
        <h3 className="overview-section-title">Videotutoriales para aprender de GeoHabita</h3>
        <div className="tutorial-carousel-wrapper">
          <button type="button" className={`tutorial-nav tutorial-nav-left ${tutorialScroll.left ? 'is-visible' : ''}`} onClick={() => scrollTutorials('left')} aria-label="Deslizar izquierda"><ChevronLeft size={18} /></button>
          <div className="tutorial-grid" ref={tutorialScrollRef}>
            {tutoriales(publicBase).map((tutorial) => (
              <a key={tutorial.href} href={tutorial.href} target="_blank" rel="noopener noreferrer" className="tutorial-card" style={{ '--tutorial-bg': `url(${tutorial.imagen})` }}>
                <div className="tutorial-content">
                  <h4>{tutorial.titulo}</h4>
                  <p>{tutorial.descripcion}</p>
                </div>
              </a>
            ))}
          </div>
          <button type="button" className={`tutorial-nav tutorial-nav-right ${tutorialScroll.right ? 'is-visible' : ''}`} onClick={() => scrollTutorials('right')} aria-label="Deslizar derecha"><ChevronRight size={18} /></button>
        </div>
      </section>
    </div>
  );
}
