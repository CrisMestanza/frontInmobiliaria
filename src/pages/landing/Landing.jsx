import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isAccessTokenExpired(token) {
  if (!token) return true;
  const payload = parseJwtPayload(token);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return true;
  return exp <= Math.floor(Date.now() / 1000);
}

function getAuthStatus() {
  const access = localStorage.getItem("access");
  const idInmo = (localStorage.getItem("idinmobiliaria") || "").trim();
  if (!access) return "guest";
  if (isAccessTokenExpired(access)) return "expired";
  if (!idInmo) return "incomplete";
  return "active";
}

function getRegisterDestination() {
  const status = getAuthStatus();
  if (status === "active") return "/dashboard";
  if (status === "expired" || status === "incomplete") return "/login";
  return "/register";
}

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goTo = (path) => navigate(path);
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landing-root">
      <style>{CSS}</style>
      <header className={`landing-header${scrolled ? " landing-header--solid" : ""}`}>
        <div className="landing-header-inner">
          <Link to="/" className="landing-brand">
            <img src="/geohabita.png" alt="GeoHabita" className="landing-logo" />
            <span>GeoHabita</span>
          </Link>
          <nav className="landing-nav">
            {[["inicio", "Inicio"], ["servicios", "Servicios"], ["proceso", "Cómo funciona"], ["contacto", "Contacto"]].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}>{label}</button>
            ))}
          </nav>
          <div className="landing-actions">
            <button className="landing-action" onClick={() => goTo(getRegisterDestination())}>Publicar proyecto</button>
            <button className="landing-action landing-action-secondary" onClick={() => goTo("/login")}>Iniciar sesión</button>
          </div>
        </div>
      </header>
      <main className="landing-main">
        <section className="hero-section" id="inicio">
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="hero-pill">Servicios 360° + 2D</span>
              <h1>Recorridos 360° con dron, planos y espacios para tu proyecto inmobiliario.</h1>
              <p>
                Creamos el contenido visual que tus clientes necesitan: tomas aéreas, planos integrados,
                recorrido virtual y publicación en plano interactivo. Diseño claro y resultados profesionales.
              </p>
              <div className="hero-prices">
                <div>
                  <strong>S/. 1,500</strong>
                  <span>Recorrido 360° completo</span>
                </div>
                <div>
                  <strong>S/. 120</strong>
                  <span>Publicación en plataforma 2D</span>
                </div>
              </div>
              <div className="hero-stat-grid">
                <div>
                  <strong>+200</strong>
                  <span>Proyectos mejorados</span>
                </div>
                <div>
                  <strong>48 h</strong>
                  <span>Entrega de material listo</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>Visibilidad real en el mapa</span>
                </div>
              </div>
              <p className="hero-note">
                Si ya hiciste tu recorrido 360° con nosotros, agrega la publicación 2D y convierte el recorrido en una experiencia curva completa.
              </p>
              <div className="hero-actions">
                <a className="btn-primary" href="https://wa.me/51916762676?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20el%20servicio%20de%20Recorrido%20360%C2%B0" target="_blank" rel="noreferrer">Solicitar ahora</a>
                <button className="btn-secondary" onClick={() => scrollTo("servicios")}>Ver servicios</button>
              </div>
              <p className="hero-cta-note">WhatsApp +51 916 762 676 · Respuesta rápida desde Perú</p>
            </div>
            <div className="hero-card hero-card-advanced">
              <div className="hero-card-accent">Nuevo</div>
              <div className="hero-card-top">
                <span>Tu proyecto en dos mundos</span>
                <div className="hero-card-pill">360° + Plano interactivo</div>
              </div>
              <div className="hero-card-image">
                <img src="/2.jpg" alt="Proyecto inmobiliario desde dron" />
                <div className="hero-card-image-overlay">Vista real del proyecto</div>
                <div className="hero-card-play">
                  <span>▶</span>
                  <div>Simula el recorrido 360°</div>
                </div>
              </div>
              <div className="hero-card-footer">
                <div>
                  <strong>Capturas con dron 4K</strong>
                  <p>Espacios, áreas comunes y paisaje del proyecto.</p>
                </div>
                <div>
                  <strong>Plano interactivo</strong>
                  <p>Tu oferta se publica en formato 2D para clientes que buscan en el mapa.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="section-block" id="servicios">
          <div className="section-header">
            <span className="section-label">Servicios destacados</span>
            <h2>Haz tu proyecto más fácil de vender con contenido visual y plano interactivo.</h2>
          </div>
          <div className="services-grid">
            <article className="service-card service-card-gold">
              <div className="service-icon">🚁</div>
              <h3>Recorrido 360° premium</h3>
              <p>Nos encargamos de todo: tomas de dron, recorrido virtual, planos y edición para presentar tu proyecto con impacto.</p>
              <ul>
                <li>Tomas con dron 4K</li>
                <li>Recorrido inmersivo 360°</li>
                <li>Planos integrados al tour</li>
                <li>Espacios, showrooms y áreas comunes</li>
              </ul>
            </article>
            <article className="service-card service-card-green">
              <div className="service-icon">🗺️</div>
              <h3>Publicación en plataforma 2D</h3>
              <p>Publica tu proyecto sobre un plano interactivo y permite que los clientes consulten lotes y disponibilidad desde la plataforma.</p>
              <ul>
                <li>Plano interactivo 2D</li>
                <li>Disponibilidad de lotes real</li>
                <li>Contacto directo para interesados</li>
                <li>Gestión simple desde tu cuenta</li>
              </ul>
            </article>
          </div>
          <div className="section-banner">
            <strong>¿Ya contrataste el servicio 360°?</strong>
            <p>Tu proyecto también puede aparecer en la plataforma 2D con plano interactivo, para que el cliente vea el recorrido y el plano juntos.</p>
          </div>
        </section>
        <section className="section-block section-alt" id="precios">
          <div className="section-header">
            <span className="section-label">Precios transparentes</span>
            <h2>Todo claro: S/. 1,500 por el servicio 360° y S/. 120 por la publicación 2D.</h2>
          </div>
          <div className="pricing-grid">
            <div className="price-card price-card-gold">
              <span className="price-chip">Servicio 360°</span>
              <strong>S/. 1,500</strong>
              <p>Recorrido virtual con dron, planos del proyecto y entrega lista para mostrar.</p>
            </div>
            <div className="price-card price-card-green">
              <span className="price-chip">Plataforma 2D</span>
              <strong>S/. 120</strong>
              <p>Publicación en plano interactivo para aumentar la visibilidad de tus ofertas.</p>
            </div>
          </div>
          <p className="pricing-note">Cuando eliges el recorrido 360°, también puedes agregar la publicación 2D para que tu proyecto llegue a más clientes con una experiencia completa.</p>
        </section>
        <section className="section-block cta-section" id="contacto">
          <div className="cta-card">
            <div>
              <span className="section-label">Contacto rápido</span>
              <h2>Empieza hoy y muestra tu proyecto con calidad profesional.</h2>
              <p>Agendamos la toma con dron, trabajamos tus planos y publicamos tu oferta en el mapa interactivo. Todo claro y visualmente atractivo.</p>
            </div>
            <div className="cta-actions">
              <a className="btn-primary" href="https://wa.me/51916762676?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20el%20servicio%20de%20Recorrido%20360%C2%B0" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
              <button className="btn-secondary" onClick={() => goTo(getRegisterDestination())}>Publicar en 2D</button>
            </div>
            <p className="footer-contact">O llama al +51 916 762 676</p>
          </div>
        </section>
      </main>
      <footer className="footer-section">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src="/geohabita.png" alt="GeoHabita" />
            <div>
              <strong>GeoHabita</strong>
              <p>360° y 2D para proyectos inmobiliarios modernos.</p>
            </div>
          </div>
          <div className="footer-prices">
            <span>S/. 1,500 Recorrido 360°</span>
            <span>S/. 120 Plataforma 2D</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root {
  color-scheme: light;
  font-family: 'Inter', sans-serif;
  --bg: #f4f7fb;
  --surface: #ffffff;
  --surface-soft: #f6f9fc;
  --surface-bright: #eef3f8;
  --border: #d8e2eb;
  --text: #102a43;
  --muted: #5f7d93;
  --green: #0f8f5f;
  --green-light: #d9f3e7;
  --gold: #f6b844;
  --gold-light: #fff3d9;
  --shadow: 0 32px 80px rgba(16, 42, 67, 0.08);
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
}

button,
a {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

.landing-root {
  min-height: 100vh;
  background: radial-gradient(circle at top left, rgba(15, 143, 95, 0.16), transparent 25%),
              radial-gradient(circle at 20% 10%, rgba(246, 184, 68, 0.12), transparent 30%),
              radial-gradient(circle at bottom right, rgba(15, 143, 95, 0.08), transparent 22%),
              linear-gradient(180deg, #f8fbfc 0%, #eaf0f6 100%);
  overflow-x: hidden;
}

.landing-header {
  position: sticky;
  top: 16px;
  margin: 0 24px;
  z-index: 30;
  backdrop-filter: blur(26px);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(216, 226, 235, 0.9);
  border-radius: 999px;
  box-shadow: 0 30px 80px rgba(15, 143, 95, 0.1);
  transition: background .25s ease, border-color .25s ease, box-shadow .25s ease, top .25s ease;
}

.landing-header--solid {
  background: #ffffff;
}

.landing-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 18px 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.landing-header--solid {
  top: 0;
  background: rgba(255, 255, 255, 1);
}

.landing-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.landing-logo {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.landing-brand span {
  font-weight: 700;
  color: var(--text);
  font-size: 1rem;
}

.landing-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-wrap: wrap;
}

.landing-nav button {
  border: none;
  background: rgba(255,255,255,0.7);
  color: var(--muted);
  padding: 12px 18px;
  border-radius: 999px;
  transition: background .2s ease, color .2s ease, transform .2s ease, filter .2s ease;
  filter: drop-shadow(0 4px 12px rgba(16, 42, 67, 0.05));
}

.landing-nav button:hover {
  background: var(--green-light);
  color: var(--text);
  transform: translateY(-1px);
}

.landing-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.landing-action {
  border: none;
  border-radius: 999px;
  padding: 14px 26px;
  background: linear-gradient(135deg, #0f8f5f, #14af75);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 18px 40px rgba(15, 143, 95, 0.18);
}

.landing-action-secondary {
  background: rgba(255,255,255,0.82);
  color: var(--text);
  border: 1px solid rgba(216, 226, 235, 0.95);
  box-shadow: 0 12px 30px rgba(16, 42, 67, 0.05);
}

.landing-main {
  position: relative;
  z-index: 1;
}

.hero-section {
  min-height: calc(100vh - 94px);
  padding: 110px 24px 140px;
  position: relative;
}

.hero-section::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top left, rgba(15, 143, 95, 0.06), transparent 26%),
              radial-gradient(circle at 80% 20%, rgba(246, 184, 68, 0.06), transparent 18%);
  pointer-events: none;
}

.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 48px;
  align-items: start;
  position: relative;
  z-index: 1;
}

.hero-copy {
  display: grid;
  gap: 26px;
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(3rem, 5vw, 4.8rem);
  line-height: 0.98;
  letter-spacing: -0.05em;
  color: var(--text);
}

.hero-copy p {
  margin: 0;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.85;
  max-width: 620px;
}

.hero-pill {
  display: inline-flex;
  align-items: center;
  color: var(--green);
  background: var(--green-light);
  border-radius: 999px;
  padding: 12px 20px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-prices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.hero-prices div {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 24px 28px;
  box-shadow: var(--shadow);
}

.hero-prices strong {
  display: block;
  font-size: 2.1rem;
  margin-bottom: 10px;
  color: var(--text);
}

.hero-prices span {
  color: var(--muted);
  font-size: 0.95rem;
}

.hero-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.hero-stat-grid div {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px 20px;
  box-shadow: 0 18px 40px rgba(16, 42, 67, 0.05);
}

.hero-stat-grid strong {
  display: block;
  font-size: 1.4rem;
  color: var(--text);
  margin-bottom: 8px;
}

.hero-stat-grid span {
  color: var(--muted);
}

.hero-note {
  margin: 0;
  padding: 22px 26px;
  border-radius: 26px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  line-height: 1.8;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.btn-primary,
.btn-secondary {
  border: none;
  border-radius: 999px;
  padding: 16px 28px;
  font-weight: 700;
  transition: transform .2s ease, background .2s ease, box-shadow .2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #0f8f5f, #14af75);
  color: #ffffff;
  box-shadow: 0 18px 48px rgba(15, 143, 95, 0.18);
}

.btn-primary:hover,
.btn-secondary:hover {
  transform: translateY(-2px);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.hero-card {
  position: relative;
  border-radius: 36px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 34px;
  box-shadow: var(--shadow);
  display: grid;
  gap: 22px;
  overflow: hidden;
}

.hero-card-advanced {
  transform: translateY(8px);
}

.hero-card-accent {
  align-self: flex-start;
  padding: 10px 16px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(15, 143, 95, 0.18), rgba(246, 184, 68, 0.22));
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 700;
  width: fit-content;
  letter-spacing: 0.01em;
}

.hero-cta-note {
  margin: 0;
  font-size: 0.95rem;
  color: var(--muted);
  line-height: 1.6;
}

.footer-contact {
  margin: 20px 0 0;
  font-size: 0.95rem;
  color: var(--muted);
}

.hero-card::before {
  content: "";
  position: absolute;
  inset: -24% auto auto -14%;
  width: 420px;
  height: 420px;
  background: radial-gradient(circle, rgba(15, 143, 95, 0.12), transparent 55%);
  filter: blur(42px);
}

.hero-card-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-card-top span {
  font-weight: 700;
  color: var(--text);
}

.hero-card-pill {
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 700;
}

.hero-card-image {
  position: relative;
  min-height: 380px;
  border-radius: 30px;
  background: var(--surface-bright);
  overflow: hidden;
  display: grid;
  place-items: center;
}

.hero-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-card-image-overlay {
  position: absolute;
  left: 20px;
  bottom: 20px;
  padding: 12px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 700;
  box-shadow: 0 20px 45px rgba(16, 42, 67, 0.08);
}

.hero-card-play {
  position: absolute;
  right: 20px;
  bottom: 20px;
  padding: 12px 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: rgba(16, 143, 95, 0.12);
  border: 1px solid rgba(16, 143, 95, 0.18);
  backdrop-filter: blur(8px);
  box-shadow: 0 18px 40px rgba(16, 42, 67, 0.08);
}

.hero-card-play span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: #0f8f5f;
  color: #ffffff;
  font-size: 0.95rem;
}

.hero-card-play div {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.hero-card-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  position: relative;
  z-index: 1;
}

.hero-card-footer div {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 20px 22px;
}

.hero-card-footer strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text);
}

.section-block {
  padding: 100px 24px;
}

.section-header {
  max-width: 720px;
  margin: 0 auto 42px;
  text-align: center;
  display: grid;
  gap: 18px;
}

.section-header h2 {
  margin: 0;
  font-size: clamp(2.1rem, 4vw, 3.4rem);
  line-height: 1.05;
}

.section-label {
  color: var(--green);
  font-weight: 700;
}

.services-grid,
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  max-width: 1180px;
  margin: 0 auto;
}

.service-card,
.price-card,
.cta-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 32px;
  padding: 32px;
  box-shadow: var(--shadow);
}

.service-card h3,
.price-card h3,
.cta-card h2 {
  margin: 0 0 14px;
  color: var(--text);
}

.service-card p,
.price-card p,
.cta-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.8;
}

.service-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: var(--surface-soft);
  font-size: 1.5rem;
}

.service-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.service-card li {
  position: relative;
  padding-left: 26px;
  color: var(--text);
  font-weight: 600;
}

.service-card li::before {
  content: "•";
  position: absolute;
  left: 0;
  top: 0;
  color: var(--green);
  font-size: 1.2rem;
}

.service-card-gold {
  border-color: rgba(255, 184, 0, 0.22);
}

.service-card-green {
  border-color: rgba(15, 143, 95, 0.22);
}

.section-banner {
  max-width: 900px;
  margin: 32px auto 0;
  padding: 28px 32px;
  border-radius: 30px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  text-align: center;
}

.section-banner strong {
  display: block;
  font-size: 1rem;
  margin-bottom: 10px;
  color: var(--green);
}

.section-banner p {
  margin: 0;
  color: var(--muted);
  line-height: 1.75;
}

.section-alt {
  background: #eef3f8;
}

.price-card {
  display: grid;
  gap: 18px;
}

.price-chip {
  align-self: start;
  display: inline-flex;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.price-card strong {
  font-size: 3rem;
  line-height: 1;
  color: var(--text);
}

.pricing-note {
  margin: 30px auto 0;
  max-width: 820px;
  text-align: center;
  color: var(--muted);
  line-height: 1.8;
}

.cta-section {
  padding-top: 80px;
}

.cta-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 28px;
  align-items: center;
}

.cta-card h2 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
}

.cta-actions {
  display: grid;
  gap: 16px;
}

.footer-section {
  padding: 40px 24px 60px;
}

.footer-inner {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid var(--border);
  padding-top: 24px;
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 16px;
}

.footer-brand img {
  width: 36px;
  height: 36px;
}

.footer-prices {
  display: grid;
  gap: 10px;
  color: var(--muted);
}

@media (max-width: 980px) {
  .hero-inner,
  .services-grid,
  .pricing-grid,
  .cta-card {
    grid-template-columns: 1fr;
  }

  .landing-nav {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 700px) {
  .landing-header-inner {
    padding: 16px 18px;
  }

  .hero-section {
    padding-top: 80px;
  }

  .hero-copy h1 {
    font-size: 2.7rem;
  }

  .hero-prices,
  .hero-stat-grid,
  .hero-card-footer {
    grid-template-columns: 1fr;
  }

  .hero-card-image {
    min-height: 260px;
  }

  .cta-card {
    padding: 0;
  }
}
`