import { useState, useEffect, useRef } from "react";

export default function GeoHabita() {
  const [scrolled, setScrolled] = useState(false);
  const carouselRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const brands = [
    "TerraNova",
    "GrupoRoble",
    "Urbana",
    "EcoLotes",
    "SurEstate",
    "Vanguardia",
    "Habitat",
  ];

  return (
    <div className="gh-root">
      <style>{styles}</style>

      {/* Fixed BG */}
      <div className="gh-bg-fixed" />

      {/* Header */}
      <header className={`gh-header${scrolled ? " gh-header--scrolled" : ""}`}>
        <div className="gh-header-inner">
          <div className="gh-logo">
            <div className="gh-logo-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <span className="gh-logo-name">GeoHabita</span>
          </div>
          <nav className="gh-nav">
            <a href="#" className="gh-nav-link">
              Inicio
            </a>
            <a href="#features" className="gh-nav-link">
              Plataforma
            </a>
            <a href="#pricing" className="gh-nav-link">
              Precios
            </a>
            <a href="#" className="gh-nav-link">
              Nosotros
            </a>
          </nav>
          <div className="gh-header-actions">
            <a href="#" className="gh-link-plain">
              Iniciar Sesión
            </a>
            <button className="gh-btn-primary">Publicar proyecto</button>
          </div>
        </div>
      </header>

      <main className="gh-main">
        {/* Hero */}
        <section className="gh-hero">
          <div className="gh-hero-glow gh-hero-glow--tr" />
          <div className="gh-hero-glow gh-hero-glow--bl" />
          <div className="gh-hero-content">
            <div className="gh-badge">
              <span className="gh-badge-dot" />
              Mapa Interactivo v2.0
            </div>
            <h1 className="gh-hero-title">
              La nueva era de
              <br />
              <span className="gh-gradient-text">gestión inmobiliaria</span>
            </h1>
            <p className="gh-hero-sub">
              Explora terrenos y propiedades con tecnología geoespacial de
              vanguardia. Visualiza, vende y gestiona tu inventario con
              precisión milimétrica.
            </p>
            <div className="gh-hero-btns">
              <button className="gh-btn-glow">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="20"
                  height="20"
                >
                  <path d="M3 11l19-9-9 19-2-8-8-2z" />
                </svg>
                Ver proyectos
              </button>
              <button className="gh-btn-outline">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="20"
                  height="20"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                Ver Demo
              </button>
            </div>
          </div>

          {/* Hero Map Visual */}
          <div className="gh-hero-visual">
            <div className="gh-map-card">
              <div className="gh-map-scanline" />
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDqzlmrbsjBMaLgAiBRtwG39nT76IWG7NSURccufEKOLXd11voXnlnyjLWEoIHkse3Q1iYiISNcajU9AJEaDT7V0f7Bt5h_CjmgJvaRq05HS0frRdPzw-ieJba8PfAIm6Sc3svsgcTP4J2lOTQJ1B693YDaV5b1yzfkoTKqrFuLW5zEx9V9BrJPILMFalT8lOlhXUVKnE2umkqNdRwj1M45eV8ymjVqPbpcwjbghug-RfAuVCkbSZwT0rSmm63mBpSxMQad487CBAQ"
                alt="Mapa satelital de lotes"
                className="gh-map-img"
              />
              <div className="gh-map-overlay" />
              {/* Floating badges */}
              <div className="gh-lot-badge gh-lot-badge--available">
                <div className="gh-lot-badge-icon gh-lot-badge-icon--green">
                  ✓
                </div>
                <div>
                  <div className="gh-lot-badge-label">Lote A-12</div>
                  <div className="gh-lot-badge-status">Disponible</div>
                </div>
              </div>
              <div className="gh-lot-badge gh-lot-badge--sold">
                <div className="gh-lot-badge-icon gh-lot-badge-icon--red">
                  🔒
                </div>
                <div>
                  <div className="gh-lot-badge-label">Lote B-04</div>
                  <div className="gh-lot-badge-status">Vendido</div>
                </div>
              </div>
              {/* Mini stats */}
              <div className="gh-map-stats">
                <div className="gh-map-stat">
                  <span className="gh-map-stat-val">+2,000</span>
                  <span className="gh-map-stat-key">Lotes</span>
                </div>
                <div className="gh-map-stat-divider" />
                <div className="gh-map-stat">
                  <span className="gh-map-stat-val gh-map-stat-val--green">
                    +45%
                  </span>
                  <span className="gh-map-stat-key">Más Leads</span>
                </div>
                <div className="gh-map-stat-divider" />
                <div className="gh-map-stat">
                  <span className="gh-map-stat-val">24/7</span>
                  <span className="gh-map-stat-key">Online</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brand Carousel */}
        <section className="gh-carousel-section">
          <p className="gh-carousel-label">
            Inmobiliarias que confían en nosotros
          </p>
          <div className="gh-carousel-track-wrap">
            <div className="gh-carousel-fade gh-carousel-fade--left" />
            <div className="gh-carousel-fade gh-carousel-fade--right" />
            <div className="gh-carousel-track" ref={carouselRef}>
              {[...brands, ...brands].map((b, i) => (
                <div key={i} className="gh-brand-item">
                  <div className="gh-brand-dot" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What is GeoHabita */}
        <section className="gh-section" id="features">
          <div className="gh-section-inner gh-what-grid">
            <div className="gh-what-left">
              <h2 className="gh-section-title">
                ¿Qué es
                <br />
                GeoHabita?
              </h2>
              <p className="gh-section-body">
                La plataforma líder en visualización y gestión inmobiliaria
                basada en mapas interactivos. Simplificamos la compra y venta de
                terrenos conectando la realidad física con datos digitales.
              </p>
              <a href="#" className="gh-link-arrow">
                Conoce nuestra historia
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="16"
                  height="16"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
            <div className="gh-feature-grid">
              {[
                {
                  icon: "🗺️",
                  color: "blue",
                  title: "Basado en mapas",
                  desc: "Ubicación exacta con coordenadas georreferenciadas y límites precisos para certeza total.",
                },
                {
                  icon: "🌐",
                  color: "green",
                  title: "Visualización real",
                  desc: "Visualiza el entorno, topografía y características del terreno antes de la primera visita.",
                },
                {
                  icon: "📦",
                  color: "purple",
                  title: "Inventario digital",
                  desc: "Gestiona disponibilidad, estados y precios en tiempo real. Adiós a las hojas de cálculo.",
                },
                {
                  icon: "🤝",
                  color: "orange",
                  title: "Contacto directo",
                  desc: "Conecta compradores calificados con desarrolladores sin fricción ni intermediarios.",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className={`gh-feature-card gh-feature-card--${f.color}`}
                >
                  <div
                    className={`gh-feature-icon gh-feature-icon--${f.color}`}
                  >
                    {f.icon}
                  </div>
                  <h3 className="gh-feature-title">{f.title}</h3>
                  <p className="gh-feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="gh-benefits-section">
          <div className="gh-section-inner">
            <div className="gh-benefits-header">
              <h2 className="gh-section-title gh-text-center">
                Beneficios para el ecosistema
              </h2>
              <p className="gh-section-body gh-text-center gh-muted">
                Una plataforma diseñada para maximizar el valor tanto para quien
                busca como para quien ofrece.
              </p>
            </div>
            <div className="gh-benefits-grid">
              <div className="gh-benefit-card">
                <div className="gh-benefit-bg-deco" />
                <div className="gh-benefit-head">
                  <div className="gh-benefit-icon">🔍</div>
                  <h3 className="gh-benefit-title">Para Compradores</h3>
                </div>
                <ul className="gh-checklist">
                  <li>
                    <span className="gh-check">✓</span> Encuentra exactamente lo
                    que buscas visualmente en el mapa.
                  </li>
                  <li>
                    <span className="gh-check">✓</span> Evita visitas
                    innecesarias con datos precisos y fotos reales.
                  </li>
                  <li>
                    <span className="gh-check">✓</span> Precios transparentes y
                    disponibilidad actualizada al instante.
                  </li>
                </ul>
              </div>
              <div className="gh-benefit-card gh-benefit-card--dark">
                <div className="gh-benefit-head">
                  <div className="gh-benefit-icon gh-benefit-icon--outline">
                    🏢
                  </div>
                  <h3 className="gh-benefit-title">Para Inmobiliarias</h3>
                </div>
                <ul className="gh-checklist">
                  <li>
                    <span className="gh-check">✓</span> Sube y administra tu
                    inventario masivo fácilmente.
                  </li>
                  <li>
                    <span className="gh-check">✓</span> Llega a clientes con una
                    experiencia visual superior.
                  </li>
                  <li>
                    <span className="gh-check">✓</span> Analíticas de visitas y
                    control total de leads (CRM).
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="gh-section">
          <div className="gh-section-inner">
            <div className="gh-benefits-header">
              <span className="gh-overline">Proceso Simplificado</span>
              <h2 className="gh-section-title gh-text-center">
                Cómo funciona GeoHabita
              </h2>
            </div>
            <div className="gh-steps-grid">
              <div className="gh-steps-line" />
              {[
                {
                  n: "1",
                  title: "Regístrate",
                  desc: "Crea tu cuenta profesional en segundos y configura tu perfil de empresa.",
                },
                {
                  n: "2",
                  title: "Sube al mapa",
                  desc: "Dibuja tus lotes o importa tus archivos CAD/GIS directamente sobre nuestro mapa satelital.",
                },
                {
                  n: "3",
                  title: "Recibe clientes",
                  desc: "Tu proyecto se vuelve visible para miles de interesados. Gestiona solicitudes en tiempo real.",
                },
              ].map((s, i) => (
                <div key={i} className="gh-step">
                  <div className="gh-step-num">{s.n}</div>
                  <h3 className="gh-step-title">{s.title}</h3>
                  <p className="gh-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Feature */}
        <section className="gh-dashboard-section">
          <div className="gh-section-inner gh-dashboard-grid">
            <div className="gh-dashboard-visual">
              <div className="gh-browser-frame">
                <div className="gh-browser-bar">
                  <span className="gh-browser-dot" />
                  <span className="gh-browser-dot" />
                  <span className="gh-browser-dot" />
                </div>
                <div className="gh-browser-content">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkMnx3g24iNxFpy-zjI1Dl4toad-Gfoogt_U324zDjTS5cUt_fmDZHcsMlwJonmrwFAT-Nb8PjLiSWlKMJrnYpPtdOn10TsQCT6rIbqK92-2ykvNFm3TZbaRH90geGG87vbFBrNfwgZbxZHfIHdaDJg5IvSPkl_T9qGRRlj99UEK7wIljnIXkLxReLOxNwYP5txvaKIdWVqDngXewNYYE9TWiTHBS8Q6AIsTLxxjDh7MAepErAqFbZ3dBjZfPZkpFWk4w9zaQK96o"
                    alt="Dashboard"
                    className="gh-browser-img"
                  />
                  <div className="gh-browser-widget">
                    <div className="gh-widget-bar" />
                    <div className="gh-widget-line" />
                    <div className="gh-widget-line gh-widget-line--short" />
                    <button className="gh-widget-btn">Reservar Lote</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="gh-dashboard-text">
              <h2 className="gh-section-title">
                Control total de
                <br />
                tu proyecto
              </h2>
              <div className="gh-feature-rows">
                {[
                  {
                    icon: "🛰️",
                    title: "Geolocalización Satelital",
                    desc: "Integra vistas satelitales actualizadas para mostrar el progreso de obras y el contexto real del entorno.",
                  },
                  {
                    icon: "📊",
                    title: "Gestión en Tiempo Real",
                    desc: "Cambia el estado de un lote de 'Disponible' a 'Vendido' desde tu celular al instante. Sincronización automática.",
                  },
                  {
                    icon: "🔗",
                    title: "Inventario Conectado",
                    desc: "Tu equipo de ventas siempre trabajará sobre datos actualizados, eliminando errores y dobles reservas.",
                  },
                ].map((f, i) => (
                  <div key={i} className="gh-feature-row">
                    <div className="gh-feature-row-icon">{f.icon}</div>
                    <div>
                      <h4 className="gh-feature-row-title">{f.title}</h4>
                      <p className="gh-feature-row-desc">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Banner */}
        <section className="gh-stats-section">
          <div className="gh-stats-bg" />
          <div className="gh-section-inner">
            <h2 className="gh-stats-title">Caso de Éxito: Tarapoto, Perú</h2>
            <p className="gh-stats-sub">
              Nuestro lanzamiento inicial ha transformado la forma de vender
              terrenos en la selva peruana.
            </p>
            <div className="gh-stats-grid">
              {[
                { val: "+2,000", label: "Lotes Mapeados" },
                { val: "15", label: "Proyectos Activos" },
                { val: "45%", label: "Aumento en Leads" },
                { val: "24/7", label: "Disponibilidad" },
              ].map((s, i) => (
                <div key={i} className="gh-stat-item">
                  <div className="gh-stat-val">{s.val}</div>
                  <div className="gh-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Precision Mapping */}
        <section className="gh-section">
          <div className="gh-section-inner gh-mapping-grid">
            <div>
              <h2 className="gh-section-title">
                Precisión
                <br />a Gran Escala
              </h2>
              <p className="gh-section-body gh-muted">
                Nuestra integración LiDAR permite una precisión a nivel
                milimétrico en planificación urbana y gestión de activos.
                Visualiza zonas antes de que sean construidas.
              </p>
              <div className="gh-cards-stacked">
                <div className="gh-info-card">
                  <div className="gh-info-card-icon">📐</div>
                  <div>
                    <h4 className="gh-info-card-title">Análisis Multi-Capa</h4>
                    <p className="gh-info-card-desc">
                      Superpone datos demográficos, ambientales y financieros en
                      tiempo real.
                    </p>
                  </div>
                </div>
                <div className="gh-info-card">
                  <div className="gh-info-card-icon">📈</div>
                  <div>
                    <h4 className="gh-info-card-title">ROI Predictivo</h4>
                    <p className="gh-info-card-desc">
                      Pronóstico IA para apreciación de valor de propiedad a 5,
                      10 y 20 años.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="gh-growth-card">
              <div className="gh-growth-header">
                <span className="gh-growth-label">Índice de Crecimiento</span>
                <span className="gh-growth-pct">+12.4%</span>
              </div>
              <div className="gh-chart">
                {[40, 55, 30, 75, 100, 50].map((h, i) => (
                  <div
                    key={i}
                    className={`gh-bar${i === 4 ? " gh-bar--peak" : ""}`}
                    style={{ height: `${h}%` }}
                  >
                    {i === 4 && <div className="gh-bar-dot" />}
                  </div>
                ))}
              </div>
              <div className="gh-chart-labels">
                {["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"].map((q) => (
                  <span key={q}>{q}</span>
                ))}
              </div>
              <div className="gh-growth-features">
                {[
                  "Habitat Scanning",
                  "Eficiencia Térmica",
                  "Smart Contracts",
                ].map((f, i) => (
                  <div key={i} className="gh-growth-feat">
                    <span className="gh-growth-feat-dot" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="gh-section" id="pricing">
          <div className="gh-section-inner">
            <div className="gh-benefits-header">
              <h2 className="gh-section-title gh-text-center">
                Planes flexibles
              </h2>
              <p className="gh-section-body gh-text-center gh-muted">
                Elige la opción que mejor se adapte al tamaño de tu
                inmobiliaria.
              </p>
            </div>
            <div className="gh-pricing-grid">
              {[
                {
                  name: "Independiente",
                  price: "Gratis",
                  period: "",
                  desc: "Para propietarios de 1 o 2 lotes que desean probar la plataforma.",
                  features: [
                    "Hasta 3 lotes",
                    "Visibilidad básica",
                    "Soporte por email",
                  ],
                  btn: "Empezar ahora",
                  featured: false,
                },
                {
                  name: "Inmobiliaria",
                  price: "$49",
                  period: "/mes",
                  desc: "Para proyectos medianos en desarrollo activo.",
                  features: [
                    "Hasta 200 lotes",
                    "Panel de administración",
                    "Soporte prioritario",
                    "CRM de leads",
                  ],
                  btn: "Seleccionar Plan",
                  featured: true,
                },
                {
                  name: "Enterprise",
                  price: "Demo",
                  period: "",
                  desc: "Para desarrolladores de múltiples proyectos a gran escala.",
                  features: [
                    "Lotes ilimitados",
                    "API personalizada",
                    "Marca blanca",
                    "SLA garantizado",
                  ],
                  btn: "Contactar Ventas",
                  featured: false,
                },
              ].map((p, i) => (
                <div
                  key={i}
                  className={`gh-price-card${p.featured ? " gh-price-card--featured" : ""}`}
                >
                  {p.featured && <div className="gh-price-badge">POPULAR</div>}
                  <h3 className="gh-price-name">{p.name}</h3>
                  <div className="gh-price-amount">
                    <span className="gh-price-val">{p.price}</span>
                    <span className="gh-price-period">{p.period}</span>
                  </div>
                  <p className="gh-price-desc">{p.desc}</p>
                  <ul className="gh-price-features">
                    {p.features.map((f, j) => (
                      <li key={j}>
                        <span className="gh-check">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`gh-price-btn${p.featured ? " gh-price-btn--featured" : ""}`}
                  >
                    {p.btn}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="gh-cta-section">
          <div className="gh-cta-glow gh-cta-glow--l" />
          <div className="gh-cta-glow gh-cta-glow--r" />
          <div className="gh-cta-box">
            <div className="gh-cta-scanline" />
            <h2 className="gh-cta-title">
              Lleva tu proyecto
              <br />
              al siguiente nivel
            </h2>
            <p className="gh-cta-sub">
              Deja de perder ventas por planos difíciles de entender. Moderniza
              tu presentación hoy mismo y destaca sobre la competencia.
            </p>
            <div className="gh-cta-form">
              <input
                className="gh-cta-input"
                type="email"
                placeholder="Tu email profesional"
              />
              <button className="gh-btn-glow">Solicitar Acceso</button>
            </div>
            <div className="gh-cta-actions">
              <button className="gh-btn-whatsapp">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="20"
                  height="20"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Contactar por WhatsApp
              </button>
              <button className="gh-btn-white">Publicar Propiedad</button>
            </div>
            <p className="gh-cta-note">
              Spots limitados para el cohort Q2 2025.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="gh-footer">
        <div className="gh-footer-inner">
          <div className="gh-footer-brand">
            <div className="gh-logo">
              <div className="gh-logo-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <span className="gh-logo-name">GeoHabita</span>
            </div>
            <p className="gh-footer-tagline">
              Plataforma de visualización y gestión geoespacial para el sector
              inmobiliario moderno. Transformando datos en ventas.
            </p>
          </div>
          <div className="gh-footer-links-grid">
            {[
              {
                title: "Plataforma",
                links: [
                  "Explorar Mapa",
                  "Proyectos",
                  "Precios",
                  "Para Agentes",
                ],
              },
              {
                title: "Empresa",
                links: ["Nosotros", "Blog", "Carreras", "Contacto"],
              },
              { title: "Legal", links: ["Términos", "Privacidad", "Cookies"] },
            ].map((col, i) => (
              <div key={i} className="gh-footer-col">
                <h4 className="gh-footer-col-title">{col.title}</h4>
                {col.links.map((l) => (
                  <a key={l} href="#" className="gh-footer-link">
                    {l}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="gh-footer-bottom">
          <span>© 2025 GeoHabita Inc. Todos los derechos reservados.</span>
          <span>Tarapoto, Perú — Operación Global</span>
        </div>
      </footer>
    </div>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --gh-green: #06f957;
    --gh-green-dim: rgba(6,249,87,0.15);
    --gh-green-glow: rgba(6,249,87,0.3);
    --gh-bg: #0b1a10;
    --gh-bg2: #0f2316;
    --gh-surface: #162f21;
    --gh-surface2: #1a3828;
    --gh-border: rgba(6,249,87,0.12);
    --gh-border2: rgba(6,249,87,0.06);
    --gh-text: #e8f5ed;
    --gh-muted: #7aab8a;
    --gh-font: 'Space Grotesk', sans-serif;
    --gh-mono: 'JetBrains Mono', monospace;
  }

  .gh-root {
    font-family: var(--gh-font);
    background-color: var(--gh-bg);
    color: var(--gh-text);
    min-height: 100vh;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #1f4a33 #0f2316;
  }

  .gh-root::-webkit-scrollbar { width: 6px; }
  .gh-root::-webkit-scrollbar-track { background: var(--gh-bg); }
  .gh-root::-webkit-scrollbar-thumb { background: #1f4a33; border-radius: 3px; }
  .gh-root::-webkit-scrollbar-thumb:hover { background: var(--gh-green); }

  /* Fixed BG */
  .gh-bg-fixed {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(ellipse 80% 60% at 70% 20%, rgba(6,249,87,0.04) 0%, transparent 60%),
                radial-gradient(ellipse 60% 60% at 20% 80%, rgba(6,249,87,0.03) 0%, transparent 60%),
                var(--gh-bg);
  }

  /* HEADER */
  .gh-header {
    position: sticky; top: 0; z-index: 100;
    background: rgba(11,26,16,0.75);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--gh-border2);
    transition: border-color 0.3s, background 0.3s;
  }
  .gh-header--scrolled {
    background: rgba(11,26,16,0.95);
    border-color: var(--gh-border);
  }
  .gh-header-inner {
    max-width: 1280px; margin: 0 auto; padding: 0 24px;
    height: 72px; display: flex; align-items: center; gap: 32px;
  }
  .gh-logo { display: flex; align-items: center; gap: 10px; }
  .gh-logo-icon {
    width: 36px; height: 36px; border-radius: 8px;
    background: var(--gh-green-dim); border: 1px solid var(--gh-green);
    display: flex; align-items: center; justify-content: center;
    color: var(--gh-green);
  }
  .gh-logo-name { font-size: 1.2rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
  .gh-nav { display: flex; align-items: center; gap: 32px; margin-left: auto; }
  .gh-nav-link { color: #8ab99a; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
  .gh-nav-link:hover { color: var(--gh-green); }
  .gh-header-actions { display: flex; align-items: center; gap: 16px; }
  .gh-link-plain { color: #8ab99a; font-size: 0.9rem; font-weight: 600; text-decoration: none; transition: color 0.2s; }
  .gh-link-plain:hover { color: #fff; }

  /* Buttons */
  .gh-btn-primary {
    background: #fff; color: #0b1a10; font-weight: 700; font-size: 0.875rem;
    padding: 10px 20px; border-radius: 10px; border: none; cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }
  .gh-btn-primary:hover { background: #d4ffe3; transform: translateY(-1px); }
  .gh-btn-glow {
    background: var(--gh-green); color: #0b1a10; font-weight: 700; font-size: 0.95rem;
    padding: 14px 28px; border-radius: 12px; border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 0 24px var(--gh-green-glow);
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .gh-btn-glow:hover { background: #2dfb6b; transform: translateY(-2px); box-shadow: 0 0 40px var(--gh-green-glow); }
  .gh-btn-outline {
    background: var(--gh-surface); color: #fff; font-weight: 700; font-size: 0.95rem;
    padding: 14px 28px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: border-color 0.2s, color 0.2s, transform 0.2s;
  }
  .gh-btn-outline:hover { border-color: var(--gh-green); color: var(--gh-green); transform: translateY(-2px); }

  /* MAIN */
  .gh-main { position: relative; z-index: 1; }

  /* HERO */
  .gh-hero {
    max-width: 1280px; margin: 0 auto; padding: 80px 24px 60px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
  }
  @media (max-width: 900px) {
    .gh-hero { grid-template-columns: 1fr; padding: 48px 24px 40px; }
    .gh-nav { display: none; }
  }
  .gh-hero-glow {
    position: absolute; width: 600px; height: 600px; border-radius: 50%; pointer-events: none;
    filter: blur(120px); z-index: 0;
  }
  .gh-hero-glow--tr { top: -100px; right: -100px; background: rgba(6,249,87,0.06); }
  .gh-hero-glow--bl { bottom: -100px; left: -100px; background: rgba(6,249,87,0.04); }
  .gh-hero-content { display: flex; flex-direction: column; gap: 24px; position: relative; }

  .gh-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(6,249,87,0.08); border: 1px solid rgba(6,249,87,0.2);
    color: var(--gh-green); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; padding: 6px 14px; border-radius: 100px;
    width: fit-content;
  }
  .gh-badge-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--gh-green);
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

  .gh-hero-title {
    font-size: clamp(2.8rem, 5vw, 4.5rem); font-weight: 800; line-height: 1.08;
    letter-spacing: -0.04em; color: #fff;
  }
  .gh-gradient-text {
    background: linear-gradient(135deg, var(--gh-green) 0%, #a8ffca 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .gh-hero-sub { font-size: 1.1rem; color: var(--gh-muted); line-height: 1.7; max-width: 480px; }
  .gh-hero-btns { display: flex; gap: 16px; flex-wrap: wrap; }

  /* Map Visual */
  .gh-hero-visual { position: relative; }
  .gh-map-card {
    border-radius: 20px; overflow: hidden; position: relative;
    border: 1px solid var(--gh-border);
    box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 40px rgba(6,249,87,0.05);
    background: var(--gh-surface);
  }
  .gh-map-scanline {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--gh-green), transparent);
    z-index: 5; opacity: 0.6;
  }
  .gh-map-img { width: 100%; height: 340px; object-fit: cover; display: block; }
  .gh-map-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 40%, var(--gh-bg) 100%);
    pointer-events: none;
  }
  .gh-lot-badge {
    position: absolute; display: flex; align-items: center; gap: 10px;
    background: rgba(11,26,16,0.92); backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
    padding: 10px 14px; z-index: 10;
  }
  .gh-lot-badge--available { top: 20px; left: 20px; animation: float 4s ease-in-out infinite; }
  .gh-lot-badge--sold { bottom: 80px; right: 20px; }
  @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .gh-lot-badge-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
  .gh-lot-badge-icon--green { background: rgba(6,249,87,0.15); }
  .gh-lot-badge-icon--red { background: rgba(239,68,68,0.15); }
  .gh-lot-badge-label { font-size: 0.7rem; color: var(--gh-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
  .gh-lot-badge-status { font-size: 0.95rem; font-weight: 700; color: #fff; }

  .gh-map-stats {
    position: absolute; bottom: 20px; left: 20px; right: 20px; z-index: 10;
    background: rgba(11,26,16,0.92); backdrop-filter: blur(12px);
    border: 1px solid var(--gh-border); border-radius: 12px;
    display: flex; align-items: center; justify-content: space-around; padding: 14px;
  }
  .gh-map-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .gh-map-stat-val { font-size: 1.1rem; font-weight: 800; color: #fff; }
  .gh-map-stat-val--green { color: var(--gh-green); }
  .gh-map-stat-key { font-size: 0.68rem; color: var(--gh-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .gh-map-stat-divider { width: 1px; height: 32px; background: var(--gh-border); }

  /* CAROUSEL */
  .gh-carousel-section {
    border-top: 1px solid var(--gh-border2); border-bottom: 1px solid var(--gh-border2);
    background: rgba(15,35,22,0.6); padding: 32px 0; overflow: hidden;
    position: relative;
  }
  .gh-carousel-label {
    text-align: center; font-size: 0.72rem; font-weight: 700; color: rgba(6,249,87,0.4);
    letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 20px;
  }
  .gh-carousel-track-wrap { position: relative; overflow: hidden; }
  .gh-carousel-fade {
    position: absolute; top: 0; bottom: 0; width: 100px; z-index: 2;
  }
  .gh-carousel-fade--left { left: 0; background: linear-gradient(90deg, rgba(11,26,16,1), transparent); }
  .gh-carousel-fade--right { right: 0; background: linear-gradient(-90deg, rgba(11,26,16,1), transparent); }
  .gh-carousel-track {
    display: flex; width: fit-content;
    animation: carousel-scroll 40s linear infinite;
  }
  @keyframes carousel-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .gh-brand-item {
    display: flex; align-items: center; gap: 8px;
    padding: 0 32px; font-size: 1.1rem; font-weight: 700; color: #4a7a5a;
    white-space: nowrap; transition: color 0.3s;
  }
  .gh-brand-item:hover { color: var(--gh-green); }
  .gh-brand-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gh-border); }

  /* SECTIONS */
  .gh-section { padding: 96px 0; position: relative; }
  .gh-section-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
  .gh-section-title { font-size: clamp(2rem, 3.5vw, 3rem); font-weight: 800; letter-spacing: -0.04em; color: #fff; line-height: 1.1; margin-bottom: 20px; }
  .gh-section-body { font-size: 1.05rem; color: var(--gh-muted); line-height: 1.7; margin-bottom: 32px; }
  .gh-text-center { text-align: center; }
  .gh-muted { color: var(--gh-muted) !important; }
  .gh-overline { display: block; text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--gh-green); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px; }

  /* WHAT GRID */
  .gh-what-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 64px; align-items: start; }
  @media (max-width: 900px) { .gh-what-grid { grid-template-columns: 1fr; } }
  .gh-what-left { position: sticky; top: 100px; }
  .gh-link-arrow {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--gh-green); font-weight: 700; font-size: 0.9rem; text-decoration: none;
    transition: gap 0.2s;
  }
  .gh-link-arrow:hover { gap: 10px; }

  .gh-feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 600px) { .gh-feature-grid { grid-template-columns: 1fr; } }
  .gh-feature-card {
    padding: 28px; border-radius: 20px; background: var(--gh-surface);
    border: 1px solid var(--gh-border2); transition: border-color 0.3s, transform 0.3s;
  }
  .gh-feature-card:hover { border-color: var(--gh-border); transform: translateY(-4px); }
  .gh-feature-icon { font-size: 1.8rem; margin-bottom: 16px; }
  .gh-feature-title { font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 8px; }
  .gh-feature-desc { font-size: 0.875rem; color: var(--gh-muted); line-height: 1.6; }

  /* BENEFITS */
  .gh-benefits-section { padding: 96px 0; background: rgba(15,35,22,0.5); }
  .gh-benefits-header { text-align: center; margin-bottom: 56px; }
  .gh-benefits-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 1280px; margin: 0 auto; padding: 0 24px; }
  @media (max-width: 700px) { .gh-benefits-grid { grid-template-columns: 1fr; } }
  .gh-benefit-card {
    padding: 48px; border-radius: 24px; background: var(--gh-bg);
    border: 1px solid var(--gh-border2); position: relative; overflow: hidden;
    transition: border-color 0.3s;
  }
  .gh-benefit-card:hover { border-color: var(--gh-border); }
  .gh-benefit-card--dark { background: var(--gh-surface); }
  .gh-benefit-bg-deco {
    position: absolute; top: -80px; right: -80px; width: 200px; height: 200px;
    background: rgba(6,249,87,0.04); border-radius: 50%;
  }
  .gh-benefit-head { display: flex; align-items: center; gap: 20px; margin-bottom: 32px; }
  .gh-benefit-icon { font-size: 2rem; padding: 16px; border-radius: 16px; background: var(--gh-green-dim); border: 1px solid var(--gh-border); }
  .gh-benefit-icon--outline { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
  .gh-benefit-title { font-size: 1.6rem; font-weight: 800; color: #fff; }
  .gh-checklist { list-style: none; display: flex; flex-direction: column; gap: 20px; }
  .gh-checklist li { display: flex; align-items: flex-start; gap: 12px; color: #c8e8d4; font-size: 1rem; line-height: 1.5; }
  .gh-check { color: var(--gh-green); font-weight: 900; flex-shrink: 0; margin-top: 2px; }

  /* STEPS */
  .gh-steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; position: relative; margin-top: 56px; }
  @media (max-width: 700px) { .gh-steps-grid { grid-template-columns: 1fr; } }
  .gh-steps-line {
    display: none;
    position: absolute; top: 56px; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--gh-surface2), transparent);
    z-index: 0;
  }
  @media (min-width: 700px) { .gh-steps-line { display: block; } }
  .gh-step { display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; z-index: 1; }
  .gh-step-num {
    width: 112px; height: 112px; border-radius: 24px;
    background: var(--gh-bg); border: 1px solid var(--gh-surface2);
    display: flex; align-items: center; justify-content: center;
    font-size: 3rem; font-weight: 900; color: var(--gh-surface2);
    margin-bottom: 24px; transition: border-color 0.3s, color 0.3s, transform 0.3s;
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  }
  .gh-step:hover .gh-step-num { border-color: var(--gh-green); color: var(--gh-green); transform: scale(1.08); }
  .gh-step-title { font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 12px; }
  .gh-step-desc { font-size: 0.875rem; color: var(--gh-muted); line-height: 1.6; padding: 0 16px; }

  /* DASHBOARD */
  .gh-dashboard-section { padding: 96px 0; background: rgba(15,35,22,0.4); }
  .gh-dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
  @media (max-width: 900px) { .gh-dashboard-grid { grid-template-columns: 1fr; } }

  .gh-browser-frame { border-radius: 16px; overflow: hidden; border: 1px solid var(--gh-border); box-shadow: 0 32px 80px rgba(0,0,0,0.5); }
  .gh-browser-bar { height: 40px; background: #0a1a0f; border-bottom: 1px solid var(--gh-border2); display: flex; align-items: center; padding: 0 16px; gap: 8px; }
  .gh-browser-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--gh-surface2); }
  .gh-browser-content { position: relative; }
  .gh-browser-img { width: 100%; display: block; }
  .gh-browser-widget {
    position: absolute; top: 20px; right: 20px;
    background: rgba(11,26,16,0.95); backdrop-filter: blur(12px);
    border: 1px solid var(--gh-border); border-radius: 12px;
    padding: 16px; width: 180px;
  }
  .gh-widget-bar { height: 10px; width: 60px; background: var(--gh-green); border-radius: 4px; margin-bottom: 10px; }
  .gh-widget-line { height: 8px; background: var(--gh-surface2); border-radius: 4px; margin-bottom: 6px; }
  .gh-widget-line--short { width: 66%; }
  .gh-widget-btn {
    width: 100%; margin-top: 10px; padding: 8px; border-radius: 8px;
    background: var(--gh-green); color: #0b1a10; font-size: 0.8rem; font-weight: 700;
    border: none; cursor: pointer; transition: background 0.2s;
  }
  .gh-widget-btn:hover { background: #2dfb6b; }

  .gh-feature-rows { display: flex; flex-direction: column; gap: 32px; }
  .gh-feature-row { display: flex; gap: 20px; align-items: flex-start; }
  .gh-feature-row-icon {
    font-size: 1.5rem; width: 56px; height: 56px; border-radius: 16px;
    background: var(--gh-green-dim); border: 1px solid var(--gh-border);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: background 0.3s, border-color 0.3s;
  }
  .gh-feature-row:hover .gh-feature-row-icon { background: var(--gh-green); border-color: var(--gh-green); }
  .gh-feature-row-title { font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 6px; }
  .gh-feature-row-desc { font-size: 0.875rem; color: var(--gh-muted); line-height: 1.6; }

  /* STATS */
  .gh-stats-section { padding: 96px 0; position: relative; overflow: hidden; text-align: center; }
  .gh-stats-bg {
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(6,249,87,0.07) 0%, rgba(11,26,16,0.98) 60%),
                radial-gradient(ellipse 100% 100% at 0% 0%, rgba(6,249,87,0.08), transparent);
    border-top: 1px solid var(--gh-border); border-bottom: 1px solid var(--gh-border);
  }
  .gh-stats-title { font-size: clamp(1.8rem, 3vw, 2.8rem); font-weight: 800; color: #fff; margin-bottom: 16px; position: relative; }
  .gh-stats-sub { color: rgba(6,249,87,0.7); font-size: 1rem; margin-bottom: 64px; position: relative; }
  .gh-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; position: relative; }
  @media (max-width: 700px) { .gh-stats-grid { grid-template-columns: repeat(2, 1fr); } }
  .gh-stat-item { padding: 24px; border-left: 1px solid rgba(6,249,87,0.1); }
  .gh-stat-item:first-child { border-left: none; }
  .gh-stat-val { font-size: clamp(2.5rem, 4vw, 4rem); font-weight: 900; color: #fff; margin-bottom: 8px; letter-spacing: -0.04em; }
  .gh-stat-label { font-size: 0.72rem; font-weight: 700; color: rgba(6,249,87,0.6); text-transform: uppercase; letter-spacing: 0.15em; }

  /* MAPPING */
  .gh-mapping-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
  @media (max-width: 900px) { .gh-mapping-grid { grid-template-columns: 1fr; } }
  .gh-cards-stacked { display: flex; flex-direction: column; gap: 16px; }
  .gh-info-card {
    display: flex; gap: 16px; padding: 20px 24px; border-radius: 16px;
    background: var(--gh-surface); border: 1px solid var(--gh-border2);
    transition: border-color 0.3s, transform 0.3s;
  }
  .gh-info-card:hover { border-color: var(--gh-border); transform: translateX(6px); }
  .gh-info-card-icon {
    font-size: 1.4rem; width: 44px; height: 44px; border-radius: 10px;
    background: var(--gh-green-dim); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .gh-info-card-title { font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .gh-info-card-desc { font-size: 0.825rem; color: var(--gh-muted); line-height: 1.5; }

  /* Chart */
  .gh-growth-card {
    background: var(--gh-surface); border: 1px solid var(--gh-border);
    border-radius: 20px; padding: 28px;
    box-shadow: 0 0 40px rgba(6,249,87,0.05);
  }
  .gh-growth-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .gh-growth-label { font-size: 0.75rem; color: var(--gh-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
  .gh-growth-pct { color: var(--gh-green); font-weight: 800; font-size: 1rem; }
  .gh-chart { height: 100px; display: flex; align-items: flex-end; gap: 8px; margin-bottom: 8px; }
  .gh-bar { flex: 1; background: rgba(6,249,87,0.2); border-radius: 4px 4px 0 0; position: relative; transition: background 0.3s; }
  .gh-bar:hover { background: rgba(6,249,87,0.4); }
  .gh-bar--peak { background: rgba(6,249,87,0.8) !important; }
  .gh-bar-dot {
    position: absolute; top: -6px; right: 50%; transform: translateX(50%);
    width: 10px; height: 10px; background: #fff; border-radius: 50%;
    box-shadow: 0 0 12px var(--gh-green);
  }
  .gh-chart-labels { display: flex; justify-content: space-between; }
  .gh-chart-labels span { font-size: 0.65rem; color: var(--gh-muted); font-family: var(--gh-mono); }
  .gh-growth-features { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; border-top: 1px solid var(--gh-border2); padding-top: 20px; }
  .gh-growth-feat { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #8ab99a; }
  .gh-growth-feat-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gh-green); flex-shrink: 0; }

  /* PRICING */
  .gh-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1100px; margin: 48px auto 0; }
  @media (max-width: 800px) { .gh-pricing-grid { grid-template-columns: 1fr; } }
  .gh-price-card {
    padding: 40px; border-radius: 24px; background: var(--gh-surface);
    border: 1px solid var(--gh-border2); display: flex; flex-direction: column; position: relative;
    transition: border-color 0.3s, transform 0.3s;
  }
  .gh-price-card:hover { border-color: var(--gh-border); transform: translateY(-4px); }
  .gh-price-card--featured {
    border: 2px solid var(--gh-green);
    box-shadow: 0 0 40px rgba(6,249,87,0.1);
    transform: translateY(-12px);
  }
  .gh-price-card--featured:hover { transform: translateY(-16px); }
  .gh-price-badge {
    position: absolute; top: 0; right: 24px;
    background: var(--gh-green); color: #0b1a10;
    font-size: 0.65rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;
    padding: 4px 12px; border-radius: 0 0 8px 8px;
  }
  .gh-price-name { font-size: 1.3rem; font-weight: 700; color: #fff; margin-bottom: 20px; }
  .gh-price-amount { display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px; }
  .gh-price-val { font-size: 3rem; font-weight: 900; color: #fff; letter-spacing: -0.04em; }
  .gh-price-period { font-size: 0.9rem; color: var(--gh-muted); }
  .gh-price-desc { font-size: 0.875rem; color: var(--gh-muted); line-height: 1.5; margin-bottom: 28px; }
  .gh-price-features { list-style: none; display: flex; flex-direction: column; gap: 14px; flex: 1; margin-bottom: 32px; }
  .gh-price-features li { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: #b8d8c4; }
  .gh-price-btn {
    width: 100%; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 0.95rem;
    cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #fff;
    transition: background 0.2s, border-color 0.2s, transform 0.2s;
  }
  .gh-price-btn:hover { background: rgba(255,255,255,0.06); transform: translateY(-2px); }
  .gh-price-btn--featured { background: var(--gh-green); color: #0b1a10; border-color: var(--gh-green); }
  .gh-price-btn--featured:hover { background: #2dfb6b; }

  /* CTA */
  .gh-cta-section {
    padding: 96px 24px; position: relative; overflow: hidden;
  }
  .gh-cta-glow {
    position: absolute; width: 500px; height: 500px; border-radius: 50%;
    filter: blur(100px); pointer-events: none;
  }
  .gh-cta-glow--l { left: -100px; top: -100px; background: rgba(6,249,87,0.05); }
  .gh-cta-glow--r { right: -100px; bottom: -100px; background: rgba(6,249,87,0.05); }
  .gh-cta-box {
    max-width: 820px; margin: 0 auto; text-align: center;
    background: rgba(15,35,22,0.8); backdrop-filter: blur(20px);
    border: 1px solid var(--gh-border); border-radius: 28px;
    padding: 64px 48px; position: relative; overflow: hidden;
  }
  .gh-cta-scanline {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--gh-green), transparent);
    opacity: 0.5;
  }
  .gh-cta-title { font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 900; color: #fff; margin-bottom: 20px; letter-spacing: -0.04em; line-height: 1.1; }
  .gh-cta-sub { font-size: 1.05rem; color: var(--gh-muted); line-height: 1.7; margin-bottom: 40px; }
  .gh-cta-form { display: flex; gap: 12px; max-width: 480px; margin: 0 auto 32px; flex-wrap: wrap; justify-content: center; }
  .gh-cta-input {
    flex: 1; min-width: 200px; height: 52px; padding: 0 18px; border-radius: 12px;
    background: rgba(11,26,16,0.8); border: 1px solid var(--gh-border); color: #fff;
    font-size: 0.95rem; font-family: var(--gh-font); outline: none;
    transition: border-color 0.2s;
  }
  .gh-cta-input:focus { border-color: var(--gh-green); }
  .gh-cta-input::placeholder { color: var(--gh-muted); }
  .gh-cta-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .gh-btn-whatsapp {
    display: inline-flex; align-items: center; gap: 8px;
    background: #16a34a; color: #fff; font-weight: 700; font-size: 0.95rem;
    padding: 14px 24px; border-radius: 12px; border: none; cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }
  .gh-btn-whatsapp:hover { background: #15803d; transform: translateY(-2px); }
  .gh-btn-white {
    background: #fff; color: #0b1a10; font-weight: 700; font-size: 0.95rem;
    padding: 14px 24px; border-radius: 12px; border: none; cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }
  .gh-btn-white:hover { background: #d4ffe3; transform: translateY(-2px); }
  .gh-cta-note { margin-top: 24px; font-size: 0.78rem; color: rgba(120,160,130,0.6); font-family: var(--gh-mono); }

  /* FOOTER */
  .gh-footer { background: #080f0c; border-top: 1px solid var(--gh-border2); padding: 64px 0 0; position: relative; z-index: 1; }
  .gh-footer-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px 48px; display: grid; grid-template-columns: 1fr 2fr; gap: 64px; }
  @media (max-width: 700px) { .gh-footer-inner { grid-template-columns: 1fr; } }
  .gh-footer-tagline { color: var(--gh-muted); font-size: 0.875rem; line-height: 1.6; margin-top: 16px; }
  .gh-footer-links-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
  .gh-footer-col { display: flex; flex-direction: column; gap: 12px; }
  .gh-footer-col-title { font-size: 0.8rem; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
  .gh-footer-link { color: var(--gh-muted); font-size: 0.875rem; text-decoration: none; transition: color 0.2s; }
  .gh-footer-link:hover { color: var(--gh-green); }
  .gh-footer-bottom {
    max-width: 1280px; margin: 0 auto; padding: 20px 24px;
    border-top: 1px solid var(--gh-border2);
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.8rem; color: rgba(120,160,130,0.4); flex-wrap: wrap; gap: 8px;
  }
`;
