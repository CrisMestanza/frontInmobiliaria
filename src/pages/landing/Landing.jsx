import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/* ─── LIVE NOTIFICATIONS ──────────────────────────────────────── */
const NOTIFICATIONS = [
  { lot: "A-07", action: "reservado", time: "hace 2 min", city: "Tarapoto" },
  { lot: "C-14", action: "vendido", time: "hace 5 min", city: "Moyobamba" },
  { lot: "B-03", action: "consultado", time: "hace 8 min", city: "Tarapoto" },
  { lot: "D-21", action: "reservado", time: "hace 11 min", city: "Lamas" },
  { lot: "A-19", action: "vendido", time: "hace 15 min", city: "Tarapoto" },
];

const IMG = {
  heroMap:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDqzlmrbsjBMaLgAiBRtwG39nT76IWG7NSURccufEKOLXd11voXnlnyjLWEoIHkse3Q1iYiISNcajU9AJEaDT7V0f7Bt5h_CjmgJvaRq05HS0frRdPzw-ieJba8PfAIm6Sc3svsgcTP4J2lOTQJ1B693YDaV5b1yzfkoTKqrFuLW5zEx9V9BrJPILMFalT8lOlhXUVKnE2umkqNdRwj1M45eV8ymjVqPbpcwjbghug-RfAuVCkbSZwT0rSmm63mBpSxMQad487CBAQ",
  dashboard: "/dashboard.png",
  topoPattern: "https://wallpaperaccess.com/full/6501599.jpg",
  buyerBg:
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1600&q=80",
  buyerCouple:
    "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=900&q=80",
  realEstateBg:
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&q=80",
};

function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );
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
  const now = Math.floor(Date.now() / 1000);
  return exp <= now;
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
  const authStatus = getAuthStatus();
  if (authStatus === "active") return "/dashboard";
  if (authStatus === "expired" || authStatus === "incomplete") return "/login";
  return "/register";
}

function getDashboardDestination() {
  return getAuthStatus() === "active" ? "/dashboard" : "/login";
}

function GreenIcon({
  name = "globe",
  size = 22,
  className = "",
  strokeWidth = 1.5,
}) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: size,
    height: size,
    className,
    "aria-hidden": "true",
  };

  switch (name) {
    case "folder":
      return (
        <svg {...props}>
          <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 7V6a2 2 0 0 1 2-2h4l2 2h3" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...props}>
          <path d="M8 16l-1 5 5-1 7-7a5 5 0 0 0-7-7z" />
          <circle cx="14.5" cy="9.5" r="1.2" />
          <path d="M5 19l-2 2M9 15l-3 3" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...props}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <rect x="9" y="2" width="6" height="4" rx="1" />
          <path d="M8 11h8M8 15h8" />
        </svg>
      );
    case "phone":
      return (
        <svg {...props}>
          <path d="M4 5c0 8 7 15 15 15l2-4-4-2-2 2a11 11 0 0 1-7-7l2-2-2-4z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props}>
          <path d="M3 20h18" />
          <rect x="6" y="11" width="3" height="7" rx="1" />
          <rect x="11" y="8" width="3" height="10" rx="1" />
          <rect x="16" y="5" width="3" height="13" rx="1" />
        </svg>
      );
    case "hourglass":
      return (
        <svg {...props}>
          <path d="M7 3h10M7 21h10M8 3c0 4 3 5 4 6-1 1-4 2-4 6M16 3c0 4-3 5-4 6 1 1 4 2 4 6" />
        </svg>
      );
    case "help":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.5 9a2.5 2.5 0 1 1 3.9 2l-1 1v1" />
          <circle cx="12" cy="17" r="0.8" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.2-4.2" />
        </svg>
      );
    case "ruler":
      return (
        <svg {...props}>
          <rect x="3" y="8" width="18" height="8" rx="2" />
          <path d="M7 8v3M10 8v2M13 8v3M16 8v2" />
        </svg>
      );
    case "buildings":
      return (
        <svg {...props}>
          <rect x="3" y="10" width="8" height="10" rx="1" />
          <rect x="13" y="6" width="8" height="14" rx="1" />
          <path d="M6 13h2M6 16h2M16 9h2M16 12h2M16 15h2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "mobile":
      return (
        <svg {...props}>
          <rect x="8" y="2.5" width="8" height="19" rx="2" />
          <circle cx="12" cy="17.5" r="0.8" />
        </svg>
      );
    case "pin":
      return (
        <svg {...props}>
          <path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "map":
      return (
        <svg {...props}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...props}>
          <path d="M13 2L6 13h5l-1 9 8-12h-5z" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case "handshake":
      return (
        <svg {...props}>
          <path d="M3 9l4-3 4 3 2-1 4 3-4 4-2-1-2 2-4-3z" />
          <path d="M10 10l1 1M12 11l1 1M14 12l1 1" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props}>
          <path d="M3 12l9 9 9-9V5H14z" />
          <circle cx="16.5" cy="7.5" r="1" />
        </svg>
      );
    case "home":
      return (
        <svg {...props}>
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case "layers":
      return (
        <svg {...props}>
          <path d="M12 4l8 4-8 4-8-4z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 16l8 4 8-4" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="16.5" cy="9" r="2.5" />
          <path d="M3.5 19a6.5 6.5 0 0 1 11 0" />
          <path d="M14 19a4.8 4.8 0 0 1 7 0" />
        </svg>
      );
    case "satellite":
      return (
        <svg {...props}>
          <path d="M5 19l4-4M15 9l4-4" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M2 14l4 4M18 6l4 4M11 11l2 2" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 1 1 8 0v3" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
      );
    case "xmark":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      );
    case "alert":
      return (
        <svg {...props}>
          <path d="M12 3l9 16H3z" />
          <path d="M12 9v5" />
          <circle cx="12" cy="17" r="0.8" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...props}>
          <path d="M8 4h8v3a4 4 0 0 1-8 0z" />
          <path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3" />
          <path d="M12 10v4M9 20h6M10 14h4" />
        </svg>
      );
    case "menu":
      return (
        <svg {...props}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "login":
      return (
        <svg {...props}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
        </svg>
      );
    case "globe":
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
}

/* ─── COUNTER HOOK ────────────────────────────────────────────── */
function useCountUp(target, duration = 1800, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return val;
}

/* ─── INTERSECTION OBSERVER ───────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ─── PARALLAX HOOK — more noticeable ────────────────────────── */
function useParallax(speed = 0.5) {
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.innerHeight / 2 - rect.top - rect.height / 2;
      setOffset(scrolled * speed);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [speed]);
  return [ref, offset];
}

/* ─── STAT ITEM ───────────────────────────────────────────────── */
function StatItem({ val, suffix = "", label, trigger }) {
  const numeric = parseInt(val.replace(/[^0-9]/g, "")) || 0;
  const count = useCountUp(numeric, 1600, trigger);
  const prefix = val.startsWith("+") ? "+" : "";
  const isText = isNaN(parseInt(val));
  return (
    <div className="gh-stat-item">
      <div className="gh-stat-val">
        {isText ? val : `${prefix}${count.toLocaleString()}${suffix}`}
      </div>
      <div className="gh-stat-label">{label}</div>
    </div>
  );
}

/* ─── INTERACTIVE SVG LOT MAP ─────────────────────────────────── */
const LOT_DATA = [
  { id: "A-01", x: 40, y: 62, w: 78, h: 52, status: "sold" },
  { id: "A-02", x: 128, y: 62, w: 68, h: 52, status: "available" },
  { id: "A-03", x: 206, y: 62, w: 88, h: 52, status: "reserved" },
  { id: "A-04", x: 304, y: 62, w: 72, h: 52, status: "available" },
  { id: "B-01", x: 40, y: 128, w: 92, h: 58, status: "available" },
  { id: "B-02", x: 142, y: 128, w: 62, h: 58, status: "sold" },
  { id: "B-03", x: 214, y: 128, w: 82, h: 58, status: "sold" },
  { id: "B-04", x: 306, y: 128, w: 70, h: 58, status: "reserved" },
  { id: "C-01", x: 40, y: 200, w: 72, h: 54, status: "available" },
  { id: "C-02", x: 122, y: 200, w: 78, h: 54, status: "available" },
  { id: "C-03", x: 210, y: 200, w: 68, h: 54, status: "sold" },
  { id: "C-04", x: 288, y: 200, w: 88, h: 54, status: "available" },
];

const STATUS_COLOR = {
  available: {
    fill: "rgba(6,249,87,0.28)",
    stroke: "#06f957",
    label: "Disponible",
  },
  sold: { fill: "rgba(239,68,68,0.28)", stroke: "#ef4444", label: "Vendido" },
  reserved: {
    fill: "rgba(251,191,36,0.28)",
    stroke: "#fbbf24",
    label: "Reservado",
  },
};

function LotMap() {
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("all");
  return (
    <div className="gh-lotmap">
      <div className="gh-lotmap-filters">
        {["all", "available", "sold", "reserved"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`gh-filter-btn${filter === f ? " gh-filter-btn--active" : ""} gh-filter-btn--${f}`}
          >
            {f === "all" ? "Todos" : STATUS_COLOR[f]?.label}
          </button>
        ))}
      </div>
      <div className="gh-lotmap-wrap">
        <img src={IMG.heroMap} alt="mapa" className="gh-lotmap-bg" />
        <div className="gh-lotmap-overlay" />
        <svg
          viewBox="0 30 430 240"
          className="gh-lotmap-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="0"
            y1="120"
            x2="430"
            y2="120"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="8"
          />
          <line
            x1="0"
            y1="192"
            x2="430"
            y2="192"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="8"
          />
          <line
            x1="0"
            y1="56"
            x2="430"
            y2="56"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="8"
          />
          <line
            x1="30"
            y1="30"
            x2="30"
            y2="280"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="8"
          />
          <line
            x1="390"
            y1="30"
            x2="390"
            y2="280"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="8"
          />
          {LOT_DATA.map((lot) => {
            const c = STATUS_COLOR[lot.status];
            const hidden = filter !== "all" && lot.status !== filter;
            const isActive = active?.id === lot.id;
            return (
              <g
                key={lot.id}
                style={{
                  cursor: "pointer",
                  opacity: hidden ? 0.12 : 1,
                  transition: "opacity 0.3s",
                }}
                onClick={() => setActive(isActive ? null : lot)}
              >
                <rect
                  x={lot.x}
                  y={lot.y}
                  width={lot.w}
                  height={lot.h}
                  fill={c.fill}
                  stroke={isActive ? "#fff" : c.stroke}
                  strokeWidth={isActive ? 2.5 : 2}
                  rx="3"
                  style={{
                    filter: isActive
                      ? `drop-shadow(0 0 10px ${c.stroke})`
                      : `drop-shadow(0 0 4px ${c.stroke}60)`,
                    transition: "all 0.2s",
                  }}
                />
                <text
                  x={lot.x + lot.w / 2}
                  y={lot.y + lot.h / 2 - 4}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="8"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {lot.id}
                </text>
                <text
                  x={lot.x + lot.w / 2}
                  y={lot.y + lot.h / 2 + 8}
                  textAnchor="middle"
                  fill={c.stroke}
                  fontSize="6.5"
                  fontFamily="monospace"
                >
                  {c.label}
                </text>
              </g>
            );
          })}
        </svg>
        {active && (
          <div className="gh-lot-popup">
            <div className="gh-lot-popup-header">
              <span className="gh-lot-popup-id">{active.id}</span>
              <button
                onClick={() => setActive(null)}
                className="gh-lot-popup-close"
              >
                ✕
              </button>
            </div>
            <div
              className={`gh-lot-popup-status gh-lot-popup-status--${active.status}`}
            >
              {STATUS_COLOR[active.status].label}
            </div>
            <div className="gh-lot-popup-details">
              <div className="gh-lot-popup-row">
                <span>Área</span>
                <strong>{((active.w * active.h) / 10).toFixed(0)} m²</strong>
              </div>
              <div className="gh-lot-popup-row">
                <span>Precio</span>
                <strong>${(active.w * active.h * 12).toLocaleString()}</strong>
              </div>
              <div className="gh-lot-popup-row">
                <span>Proyecto</span>
                <strong>Tarapoto Norte</strong>
              </div>
            </div>
            {active.status === "available" && (
              <button className="gh-lot-popup-btn">Reservar este lote →</button>
            )}
          </div>
        )}
        <div className="gh-lotmap-legend">
          {Object.entries(STATUS_COLOR).map(([k, v]) => (
            <div key={k} className="gh-legend-item">
              <div className="gh-legend-dot" style={{ background: v.stroke }} />
              <span>{v.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="gh-lotmap-footer">
        <span className="gh-lotmap-footer-label">
          <GreenIcon name="satellite" size={16} />
          Vista satelital · Tarapoto, San Martín, Perú
        </span>
        <span className="gh-lotmap-available">
          {LOT_DATA.filter((l) => l.status === "available").length} lotes
          disponibles
        </span>
      </div>
    </div>
  );
}

/* ─── LIVE FEED ───────────────────────────────────────────────── */
function LiveFeed() {
  const [current, setCurrent] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => {
      setVis(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % NOTIFICATIONS.length);
        setVis(true);
      }, 400);
    }, 4000);
    return () => clearInterval(iv);
  }, []);
  const n = NOTIFICATIONS[current];
  const color =
    n.action === "vendido"
      ? "#ef4444"
      : n.action === "reservado"
        ? "#fbbf24"
        : "#06f957";
  return (
    <div
      className="gh-livefeed"
      style={{ opacity: vis ? 1 : 0, transition: "opacity 0.4s" }}
    >
      <div className="gh-livefeed-dot" style={{ background: color }} />
      <span>
        <strong>Lote {n.lot}</strong> {n.action} en {n.city} ·{" "}
        <span className="gh-livefeed-time">{n.time}</span>
      </span>
    </div>
  );
}

/* ─── TESTIMONIALS ────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    name: "María Rodríguez",
    role: "Directora Comercial, TerraNova",
    text: "GeoHabita transformó completamente cómo presentamos proyectos. Los clientes entienden el mapa en segundos y las consultas aumentaron un 60%.",
    avatar: "MR",
  },
  {
    name: "Carlos Vásquez",
    role: "CEO, EcoLotes Perú",
    text: "Antes tardábamos semanas en actualizar el inventario de lotes. Ahora lo hacemos en minutos desde el celular. Es como control de ventas en tiempo real.",
    avatar: "CV",
  },
  {
    name: "Ana Torres",
    role: "Gerente de Ventas, Urbana SAC",
    text: "Nuestros vendedores van a las visitas con el mapa en el teléfono. Los compradores ya llegan sabiendo qué lote quieren. Mucho más eficiente.",
    avatar: "AT",
  },
];

function Testimonials() {
  const [idx, setIdx] = useState(0);
  const go = (d) =>
    setIdx((i) => (i + d + TESTIMONIALS.length) % TESTIMONIALS.length);
  const t = TESTIMONIALS[idx];
  return (
    <div className="gh-testimonials">
      <div className="gh-testimonial-card">
        <div className="gh-testimonial-quote">"</div>
        <p className="gh-testimonial-text">{t.text}</p>
        <div className="gh-testimonial-author">
          <div className="gh-testimonial-avatar">{t.avatar}</div>
          <div>
            <div className="gh-testimonial-name">{t.name}</div>
            <div className="gh-testimonial-role">{t.role}</div>
          </div>
        </div>
      </div>
      <div className="gh-testimonial-nav">
        <button onClick={() => go(-1)} className="gh-tnav-btn">
          ←
        </button>
        <div className="gh-tnav-dots">
          {TESTIMONIALS.map((_, i) => (
            <div
              key={i}
              className={`gh-tnav-dot${i === idx ? " gh-tnav-dot--active" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
        <button onClick={() => go(1)} className="gh-tnav-btn">
          →
        </button>
      </div>
    </div>
  );
}

/* ─── CURSOR GLOW ─────────────────────────────────────────────── */
function CursorGlow() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  useEffect(() => {
    const move = (e) => {
      if (dotRef.current) {
        dotRef.current.style.left = e.clientX + "px";
        dotRef.current.style.top = e.clientY + "px";
      }
      if (ringRef.current) {
        ringRef.current.style.left = e.clientX + "px";
        ringRef.current.style.top = e.clientY + "px";
      }
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return (
    <>
      <div ref={dotRef} className="gh-cursor-dot" />
      <div ref={ringRef} className="gh-cursor-ring" />
    </>
  );
}

/* ─── REDESIGNED COMPARISON SECTION ──────────────────────────── */
function ComparisonSection() {
  const [ref, inView] = useInView(0.1);

  const rows = [
    {
      icon: "clipboard",
      trad: "Planos en papel, difíciles de leer",
      geo: "Mapa interactivo satelital preciso",
    },
    {
      icon: "phone",
      trad: "Llamadas para consultar disponibilidad",
      geo: "Disponibilidad en tiempo real 24/7",
    },
    {
      icon: "calendar",
      trad: "Visitas físicas obligatorias",
      geo: "Explora virtualmente desde cualquier lugar",
    },
    {
      icon: "chart",
      trad: "Excel para gestión de inventario",
      geo: "Panel intuitivo desde el móvil",
    },
    {
      icon: "hourglass",
      trad: "Semanas para actualizar inventario",
      geo: "Actualización instantánea con un clic",
    },
    {
      icon: "help",
      trad: "Precios opacos sin transparencia",
      geo: "Precios visibles y transparentes",
    },
  ];

  return (
    <section className="gh-compare-section" ref={ref}>
      <div className="gh-compare-label-row">
        <span className="gh-overline" style={{ color: "var(--green)" }}>
          Comparación
        </span>
      </div>
      <h2 className="gh-section-title gh-text-center">
        La diferencia es <span className="gh-gradient-text">visible</span>
      </h2>
      <p
        className="gh-section-body gh-text-center gh-muted"
        style={{ maxWidth: 540, margin: "0 auto 56px" }}
      >
        Elige el camino que convierte más, mucho más rápido.
      </p>

      {/* Header row */}
      <div className={`gh-cmp-header-row ${inView ? "gh-fade-up" : ""}`}>
        <div className="gh-cmp-col-label gh-cmp-col-label--trad">
          <div className="gh-cmp-header-badge gh-cmp-header-badge--trad">
            <span className="gh-cmp-header-icon">
              <GreenIcon name="folder" />
            </span>
            <div>
              <div className="gh-cmp-header-title">Método Tradicional</div>
              <div className="gh-cmp-header-sub">Lento · Opaco · Limitado</div>
            </div>
          </div>
        </div>
        <div className="gh-cmp-divider-head" />
        <div className="gh-cmp-col-label gh-cmp-col-label--geo">
          <div className="gh-cmp-header-badge gh-cmp-header-badge--geo">
            <span className="gh-cmp-header-icon">
              <GreenIcon name="rocket" />
            </span>
            <div>
              <div className="gh-cmp-header-title">GeoHabita</div>
              <div className="gh-cmp-header-sub">Rápido · Claro · Poderoso</div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison rows */}
      <div className="gh-cmp-rows">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`gh-cmp-row ${inView ? "gh-cmp-row--visible" : ""}`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="gh-cmp-cell gh-cmp-cell--trad">
              <span className="gh-cmp-x-icon">
                <GreenIcon name="xmark" size={15} />
              </span>
              <span className="gh-cmp-cell-text">{row.trad}</span>
            </div>
            <div className="gh-cmp-center">
              <div className="gh-cmp-icon-bubble">
                <GreenIcon name={row.icon} size={18} />
              </div>
            </div>
            <div className="gh-cmp-cell gh-cmp-cell--geo">
              <span className="gh-cmp-cell-text">{row.geo}</span>
              <span className="gh-cmp-check-icon">
                <GreenIcon name="check" size={15} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom score */}
      <div
        className={`gh-cmp-scores ${inView ? "gh-fade-up" : ""}`}
        style={{ animationDelay: "0.6s" }}
      >
        <div className="gh-cmp-score gh-cmp-score--trad">
          <span className="gh-cmp-score-val">
            <GreenIcon name="alert" size={17} />
            Baja conversión
          </span>
          <span className="gh-cmp-score-sub">
            Hasta 3× menos leads calificados
          </span>
        </div>
        <div className="gh-cmp-score-vs">VS</div>
        <div className="gh-cmp-score gh-cmp-score--geo">
          <span className="gh-cmp-score-val">
            <GreenIcon name="trophy" size={17} />
            Alta conversión
          </span>
          <span className="gh-cmp-score-sub">+45% más leads calificados</span>
        </div>
      </div>
    </section>
  );
}

/* ─── BUYER SECTION ───────────────────────────────────────────── */
function BuyerSection({ onExploreProjects }) {
  const [parallaxRef, parallaxOffset] = useParallax(0.45);
  const [ref, inView] = useInView(0.15);

  return (
    <section className="gh-buyer-section" ref={ref}>
      <div className="gh-buyer-bg-wrap" ref={parallaxRef}>
        <img
          src={IMG.buyerBg}
          alt=""
          className="gh-buyer-bg-img"
          style={{ transform: `translateY(${parallaxOffset}px) scale(1.2)` }}
        />
        <div className="gh-buyer-bg-overlay" />
      </div>
      <div className="gh-buyer-inner">
        <div className={`gh-buyer-text ${inView ? "gh-fade-up" : ""}`}>
          <span className="gh-overline gh-overline--light">
            Para Compradores
          </span>
          <h2 className="gh-buyer-title">
            Inteligencia para el
            <br />
            <em>comprador moderno</em>
          </h2>
          <p className="gh-buyer-sub">
            Ya no compras a ciegas. GeoHabita te da toda la información que
            necesitas para tomar la mejor decisión desde donde estés.
          </p>
          <div className="gh-buyer-benefits">
            {[
              {
                icon: "search",
                title: "Búsqueda visual",
                desc: "Encuentra tu lote ideal directamente en el mapa, filtrando por zona, precio y disponibilidad.",
              },
              {
                icon: "ruler",
                title: "Datos precisos",
                desc: "Área exacta en m², precio, orientación y acceso vial antes de la primera visita.",
              },
              {
                icon: "buildings",
                title: "Contexto real",
                desc: "Vista satelital del entorno: servicios cercanos, accesos, topografía y más.",
              },
              {
                icon: "shield",
                title: "Reserva segura",
                desc: "Reserva tu lote con un clic y recibe confirmación inmediata. Sin llamadas, sin filas.",
              },
              {
                icon: "chart",
                title: "Transparencia total",
                desc: "Historial de precios y comparativas del mercado. Compra con datos, no con promesas.",
              },
              {
                icon: "mobile",
                title: "Desde tu celular",
                desc: "Explora proyectos completos desde cualquier dispositivo. La feria inmobiliaria en tu bolsillo.",
              },
            ].map((b, i) => (
              <div
                key={i}
                className="gh-buyer-benefit"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="gh-buyer-benefit-icon">
                  <GreenIcon name={b.icon} size={18} />
                </div>
                <div>
                  <h4 className="gh-buyer-benefit-title">{b.title}</h4>
                  <p className="gh-buyer-benefit-desc">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            className="gh-btn-glow gh-buyer-cta"
            onClick={onExploreProjects}
          >
            Explorar Proyectos →
          </button>
        </div>
        <div className={`gh-buyer-visual ${inView ? "gh-fade-up-delay" : ""}`}>
          <div className="gh-buyer-img-stack">
            <div className="gh-buyer-img-bg-card" />
            <div className="gh-buyer-img-wrap">
              <img
                src={IMG.buyerCouple}
                alt="Pareja comprando casa"
                className="gh-buyer-img"
              />
              <div className="gh-buyer-img-overlay" />
              <div className="gh-buyer-badge gh-buyer-badge--1">
                <span className="gh-buyer-badge-icon">
                  <GreenIcon name="pin" size={16} />
                </span>
                <div>
                  <div className="gh-buyer-badge-title">Lote A-12</div>
                  <div className="gh-buyer-badge-val">Disponible · 320 m²</div>
                </div>
              </div>
              <div className="gh-buyer-badge gh-buyer-badge--2">
                <span className="gh-buyer-badge-icon">
                  <GreenIcon name="check" size={16} />
                </span>
                <div>
                  <div className="gh-buyer-badge-title">Reservado</div>
                  <div className="gh-buyer-badge-val">
                    hace 2 min · Tarapoto
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="gh-buyer-stat-row">
            {[
              ["98%", "Satisfacción"],
              ["< 3min", "Para explorar"],
              ["0 sorpresas", "Garantizado"],
            ].map(([v, l], i) => (
              <div key={i} className="gh-buyer-stat">
                <span className="gh-buyer-stat-val">{v}</span>
                <span className="gh-buyer-stat-label">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── REAL ESTATE SECTION ─────────────────────────────────────── */
function RealEstateSection({ onPublishProject }) {
  const [parallaxRef, parallaxOffset] = useParallax(0.4);
  const [ref, inView] = useInView(0.1);
  const [activeCard, setActiveCard] = useState(0);

  const features = [
    {
      icon: "map",
      title: "Mapa Interactivo",
      desc: "Publica tu proyecto sobre mapa satelital real. Tus clientes entienden tu inventario en segundos.",
      metric: "+60% consultas",
    },
    {
      icon: "bolt",
      title: "Actualización Instantánea",
      desc: "Cambia el estado de cualquier lote a 'Vendido' desde tu celular. El mundo lo ve en segundos.",
      metric: "0 errores de stock",
    },
    {
      icon: "chart",
      title: "CRM de Leads",
      desc: "Captura, califica y gestiona tus prospectos automáticamente. Nunca más pierdas un lead caliente.",
      metric: "3× más cierres",
    },
    {
      icon: "target",
      title: "Analíticas Avanzadas",
      desc: "Descubre qué lotes generan más interés, de dónde vienen tus visitantes y cuándo convierten.",
      metric: "Decisiones data-driven",
    },
    {
      icon: "handshake",
      title: "Red de Compradores",
      desc: "Accede a miles de compradores activos que buscan exactamente lo que tú ofreces.",
      metric: "+2,000 compradores/mes",
    },
    {
      icon: "tag",
      title: "Marca Blanca",
      desc: "Presenta GeoHabita con tu propia marca. Profesionalismo que impresiona desde el primer clic.",
      metric: "Tu imagen, amplificada",
    },
  ];

  return (
    <section className="gh-realestate-section" ref={ref}>
      <div className="gh-realestate-bg-wrap" ref={parallaxRef}>
        <img
          src={IMG.realEstateBg}
          alt=""
          className="gh-realestate-bg-img"
          style={{ transform: `translateY(${parallaxOffset}px) scale(1.2)` }}
        />
        <div className="gh-realestate-bg-overlay" />
        <div className="gh-realestate-bg-grid" />
      </div>
      <div className="gh-realestate-inner">
        <div className={`gh-realestate-header ${inView ? "gh-fade-up" : ""}`}>
          <span className="gh-overline gh-overline--green">
            Para Inmobiliarias & Vendedores
          </span>
          <h2 className="gh-realestate-title">
            Tu proyecto merece
            <br />
            <span className="gh-gradient-text">una vitrina del siglo XXI</span>
          </h2>
          <p className="gh-realestate-sub">
            Deja de competir con PDF y fotos pixeladas. Las inmobiliarias
            líderes ya venden diferente.
          </p>
        </div>
        <div className="gh-realestate-content">
          <div className="gh-realestate-cards">
            {features.map((f, i) => (
              <div
                key={i}
                className={`gh-re-card ${activeCard === i ? "gh-re-card--active" : ""}`}
                onClick={() => setActiveCard(i)}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="gh-re-card-top">
                  <span className="gh-re-card-icon">
                    <GreenIcon name={f.icon} size={20} />
                  </span>
                  <span className="gh-re-card-metric">{f.metric}</span>
                </div>
                <h4 className="gh-re-card-title">{f.title}</h4>
                <p className="gh-re-card-desc">{f.desc}</p>
                <div className="gh-re-card-arrow">→</div>
              </div>
            ))}
          </div>
          <div
            className={`gh-realestate-roi ${inView ? "gh-fade-up-delay" : ""}`}
          >
            <div className="gh-roi-card">
              <div className="gh-roi-header">
                <span className="gh-roi-label">ROI Promedio GeoHabita</span>
                <span className="gh-roi-period">vs. Método Tradicional</span>
              </div>
              <div className="gh-roi-chart">
                {[
                  {
                    label: "Tiempo de venta",
                    trad: 25,
                    geo: 85,
                    tradVal: "8 sem",
                    geoVal: "2 sem",
                  },
                  {
                    label: "Leads calificados",
                    trad: 30,
                    geo: 92,
                    tradVal: "12/mes",
                    geoVal: "54/mes",
                  },
                  {
                    label: "Tasa de cierre",
                    trad: 20,
                    geo: 78,
                    tradVal: "8%",
                    geoVal: "31%",
                  },
                  {
                    label: "Satisfacción cliente",
                    trad: 55,
                    geo: 97,
                    tradVal: "3.2★",
                    geoVal: "4.9★",
                  },
                ].map((row, i) => (
                  <div key={i} className="gh-roi-row">
                    <span className="gh-roi-row-label">{row.label}</span>
                    <div className="gh-roi-bars">
                      <div className="gh-roi-bar-wrap">
                        <div
                          className="gh-roi-bar gh-roi-bar--trad"
                          style={{ width: `${row.trad}%` }}
                        >
                          <span className="gh-roi-bar-val">{row.tradVal}</span>
                        </div>
                      </div>
                      <div className="gh-roi-bar-wrap">
                        <div
                          className="gh-roi-bar gh-roi-bar--geo"
                          style={{ width: `${row.geo}%` }}
                        >
                          <span className="gh-roi-bar-val">{row.geoVal}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="gh-roi-legend">
                <span className="gh-roi-leg gh-roi-leg--trad">Tradicional</span>
                <span className="gh-roi-leg gh-roi-leg--geo">GeoHabita</span>
              </div>
              <div className="gh-roi-cta-area">
                <p className="gh-roi-cta-text">
                  Únete a +120 inmobiliarias que ya publican en GeoHabita
                </p>
                <button className="gh-btn-glow" onClick={onPublishProject}>
                  Publicar mi proyecto →
                </button>
              </div>
            </div>
            <div className="gh-re-trust-badges">
              {[
                {
                  icon: "trophy",
                  text: "Mejor Plataforma Inmobiliaria 2024",
                },
                { icon: "shield", text: "Datos 100% seguros y encriptados" },
                { icon: "globe", text: "Visible en toda Latinoamérica" },
              ].map((b, i) => (
                <div key={i} className="gh-re-trust-badge">
                  <span className="gh-re-trust-icon">
                    <GreenIcon name={b.icon} size={16} />
                  </span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PLANS ───────────────────────────────────────────────────── */
const PLANS = [
  {
    name: "Independiente",
    monthly: 0,
    yearly: 0,
    desc: "Para propietarios de 1 o 2 lotes.",
    features: ["Hasta 3 lotes", "Visibilidad básica", "Soporte por email"],
    btn: "Empezar ahora",
    featured: false,
  },
  {
    name: "Inmobiliaria",
    monthly: 49,
    yearly: 39,
    desc: "Para proyectos medianos en desarrollo.",
    features: [
      "Hasta 200 lotes",
      "Panel de administración",
      "Soporte prioritario",
      "CRM de leads",
      "Analytics avanzado",
    ],
    btn: "Seleccionar Plan",
    featured: true,
  },
  {
    name: "Enterprise",
    monthly: null,
    yearly: null,
    desc: "Para desarrolladores a gran escala.",
    features: [
      "Lotes ilimitados",
      "API personalizada",
      "Marca blanca",
      "SLA 99.9%",
      "Onboarding dedicado",
    ],
    btn: "Contactar Ventas",
    featured: false,
  },
];

/* ─── SCROLL REVEAL WRAPPER ───────────────────────────────────── */
function ScrollReveal({ children, delay = 0, className = "" }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`gh-scroll-reveal ${inView ? "gh-scroll-reveal--visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── WHAT IS GEOHABITA — REDESIGNED ─────────────────────────── */
function WhatIsSection({ id }) {
  const [ref, inView] = useInView(0.1);

  const features = [
    {
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          width="22"
          height="22"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      tag: "GEOESPACIAL",
      title: "Basado en mapas",
      desc: "Ubicación exacta con coordenadas georreferenciadas y límites precisos para certeza total.",
      stat: "±0.1m precisión",
    },
    {
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          width="22"
          height="22"
        >
          <path d="M1 6s+2-2 5-2 5.5 2 8 2 5-2 5-2V22s-2 2-5 2-5.5-2-8-2-5 2-5 2z" />
          <line x1="1" y1="13" x2="22" y2="13" />
        </svg>
      ),
      tag: "INMERSIVO",
      title: "Visualización real",
      desc: "Visualiza el entorno, topografía y características del terreno antes de la primera visita.",
      stat: "Vista satelital HD",
    },
    {
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          width="22"
          height="22"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
          <path d="M7 8h10M7 12h6" />
        </svg>
      ),
      tag: "TIEMPO REAL",
      title: "Inventario digital",
      desc: "Gestiona disponibilidad, estados y precios en tiempo real. Adiós a las hojas de cálculo.",
      stat: "Sync instantáneo",
    },
    {
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          width="22"
          height="22"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      tag: "CONEXIÓN",
      title: "Contacto directo",
      desc: "Conecta compradores calificados con desarrolladores sin fricción ni intermediarios.",
      stat: "+20 usuarios",
    },
  ];

  return (
    <section className="gh-what-section" ref={ref} id={id}>
      <div className="gh-what-bg-glow" />
      <div className="gh-section-inner">
        <div className="gh-what-intro">
          <div
            className={`gh-what-text-block ${inView ? "gh-slide-in-left" : ""}`}
          >
            <span className="gh-overline">Plataforma</span>
            <h2 className="gh-section-title">
              ¿Qué es
              <br />
              GeoHabita?
            </h2>
            <p className="gh-section-body">
              La plataforma líder en visualización y gestión inmobiliaria basada
              en mapas interactivos. Conectamos la realidad física con datos
              digitales para transformar cómo se venden los terrenos.
            </p>
            <a href="#" className="gh-link-arrow">
              Conoce nuestra historia →
            </a>
          </div>
          <div
            className={`gh-what-terminal ${inView ? "gh-slide-in-right" : ""}`}
          >
            <div className="gh-terminal-bar">
              <span className="gh-tdot gh-tdot--r" />
              <span className="gh-tdot gh-tdot--y" />
              <span className="gh-tdot gh-tdot--g" />
              <span className="gh-terminal-title">geohabita.api · v2.0.1</span>
            </div>
            <div className="gh-terminal-body">
              <div className="gh-terminal-line">
                <span className="gh-t-prompt">$</span>{" "}
                <span className="gh-t-cmd">fetch</span>{" "}
                <span className="gh-t-str">/lotes/disponibles</span>
              </div>
              <div className="gh-terminal-line gh-t-output">
                <span className="gh-t-key">status</span>:{" "}
                <span className="gh-t-val">"200 OK"</span>
              </div>
              <div className="gh-terminal-line gh-t-output">
                <span className="gh-t-key">total</span>:{" "}
                <span className="gh-t-num">2047</span>
              </div>
              <div className="gh-terminal-line gh-t-output">
                <span className="gh-t-key">disponibles</span>:{" "}
                <span className="gh-t-green">894</span>
              </div>
              <div className="gh-terminal-line gh-t-output">
                <span className="gh-t-key">precisión</span>:{" "}
                <span className="gh-t-green">"±0.1m GPS"</span>
              </div>
              <div className="gh-terminal-line">
                <span className="gh-t-prompt">$</span>{" "}
                <span className="gh-t-cmd">update</span>{" "}
                <span className="gh-t-str">lote/A-07</span>{" "}
                <span className="gh-t-key">--status</span>{" "}
                <span className="gh-t-green">vendido</span>
              </div>
              <div className="gh-terminal-line gh-t-output">
                <span className="gh-t-key gh-inline-key-icon">
                  <GreenIcon name="check" size={14} /> Actualizado
                </span>{" "}
                <span className="gh-t-muted">
                  en 0.3s · visible globalmente
                </span>
              </div>
              <div className="gh-terminal-cursor">▋</div>
            </div>
          </div>
        </div>

        <div className="gh-what-features">
          {features.map((f, i) => (
            <ScrollReveal key={i} delay={i * 90}>
              <div className="gh-what-feat-card">
                <div className="gh-what-feat-top">
                  <div className="gh-what-feat-icon-wrap">{f.icon}</div>
                  <span className="gh-what-feat-tag">{f.tag}</span>
                </div>
                <h3 className="gh-what-feat-title">{f.title}</h3>
                <p className="gh-what-feat-desc">{f.desc}</p>
                <div className="gh-what-feat-stat">
                  <span className="gh-what-feat-stat-dot" />
                  {f.stat}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── MAIN ────────────────────────────────────────────────────── */
export default function GeoHabita() {
  const [scrolled, setScrolled] = useState(false);
  // const [yearly, setYearly] = useState(false);
  const [statsRef, statsInView] = useInView(0.3);
  const [heroParallaxRef, heroParallaxOffset] = useParallax(0.5);
  const navigate = useNavigate();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const brands = [
    "TerraNova",
    "GrupoRoble",
    "Urbana",
    "EcoLotes",
    "SurEstate",
    "Vanguardia",
    "Habitat",
    "ProLotes",
  ];

  const goToLogin = () => navigate("/login");
  const goToMap = () => navigate("/");
  const goToRegister = () => navigate(getRegisterDestination());
  const goToDashboard = () => navigate(getDashboardDestination());
  const scrollToSection = (id) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navItems = [
    { id: "inicio", label: "Inicio", icon: "home" },
    { id: "plataforma", label: "Plataforma", icon: "layers" },
    // { id: "precios", label: "Precios", icon: "tag" },
    { id: "nosotros", label: "Nosotros", icon: "users" },
    { id: "iniciar-sesion", label: "Iniciar Sesión", icon: "login" },
  ];

  return (
    <div className="gh-root">
      <style>{CSS}</style>
      <CursorGlow />

      {/* HEADER */}
      <header className={`gh-header${scrolled ? " gh-header--scrolled" : ""}`}>
        <div className="gh-header-inner">
          <div className="gh-logo">
            <img
              src="/geohabita.png"
              alt="Logo GeoHabita"
              className="gh-logo-image"
            />
            <span className="gh-logo-name">GeoHabita</span>
          </div>
          <LiveFeed />
          <nav className="gh-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className="gh-nav-link gh-nav-link-btn"
                onClick={() =>
                  item.id === "iniciar-sesion"
                    ? goToLogin()
                    : scrollToSection(item.id)
                }
              >
                <span className="gh-nav-link-icon">
                  <GreenIcon name={item.icon} size={14} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="gh-header-actions">
            <button
              className="gh-btn-primary"
              onClick={goToDashboard}
              aria-label="Publicar proyecto"
            >
              <span className="gh-btn-primary-label">Publicar proyecto</span>
              <span className="gh-btn-primary-icon">
                <GreenIcon name="tag" size={16} />
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="gh-main">
        {/* HERO with parallax */}
        <section className="gh-hero" id="inicio">
          <div className="gh-hero-bg" ref={heroParallaxRef}>
            <img
              src={IMG.heroMap}
              alt=""
              className="gh-hero-bg-img"
              style={{
                transform: `translateY(${heroParallaxOffset * 0.6}px) scale(1.2)`,
              }}
            />
            <div className="gh-hero-bg-overlay" />
            <div className="gh-scanline" />
            <div className="gh-grid-overlay" />
          </div>
          <div className="gh-hero-inner">
            <div className="gh-hero-content">
              <div className="gh-badge">
                <span className="gh-badge-dot" />
                Mapa Interactivo · En vivo
              </div>
              <h1 className="gh-hero-title">
                La nueva era de
                <br />
                <span className="gh-gradient-text">gestión inmobiliaria</span>
              </h1>
              <p className="gh-hero-sub">
                Explora terrenos con tecnología geoespacial de vanguardia.
                Visualiza, vende y gestiona tu inventario con precisión
                milimétrica.
              </p>
              <div className="gh-hero-btns">
                <button className="gh-btn-glow" onClick={goToRegister}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    width="18"
                    height="18"
                  >
                    <path d="M3 11l19-9-9 19-2-8-8-2z" />
                  </svg>
                  Regístrate
                </button>
                <button className="gh-btn-outline" onClick={goToDashboard}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="18"
                    height="18"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                  Dashboard
                </button>
              </div>
              <div className="gh-hero-quickstats">
                {[
                  { v: "+200", l: "Lotes" },
                  { v: "10", l: "Proyectos" },
                  { v: "21%", l: "Más leads" },
                ].map((s, i) => (
                  <div key={i} className="gh-qs-item">
                    <span className="gh-qs-val">{s.v}</span>
                    <span className="gh-qs-label">{s.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="gh-hero-visual">
              <div className="gh-map-card">
                <div className="gh-map-topbar">
                  <span className="gh-map-topbar-dot gh-dot-red" />
                  <span className="gh-map-topbar-dot gh-dot-yellow" />
                  <span className="gh-map-topbar-dot gh-dot-green" />
                  <span className="gh-map-topbar-title">
                    Mapa de Proyectos · Vista Satelital
                  </span>
                  <span className="gh-map-live">LIVE</span>
                </div>
                <div className="gh-map-img-wrap">
                  <img
                    src={IMG.heroMap}
                    alt="Mapa satelital"
                    className="gh-map-img"
                  />
                  <div className="gh-map-img-overlay" />
                  <div className="gh-map-radar" />
                  <div className="gh-lot-badge gh-lot-badge--a">
                    <div className="gh-lbadge-icon gh-lbadge-green">
                      <GreenIcon name="check" size={14} />
                    </div>
                    <div>
                      <div className="gh-lbadge-label">Lote A-12</div>
                      <div className="gh-lbadge-val">Disponible</div>
                    </div>
                  </div>
                  <div className="gh-lot-badge gh-lot-badge--b">
                    <div className="gh-lbadge-icon gh-lbadge-red">
                      <GreenIcon name="lock" size={14} />
                    </div>
                    <div>
                      <div className="gh-lbadge-label">Lote B-04</div>
                      <div className="gh-lbadge-val gh-red">Vendido</div>
                    </div>
                  </div>
                  <div className="gh-lot-badge gh-lot-badge--c">
                    <div className="gh-lbadge-icon gh-lbadge-yellow">
                      <GreenIcon name="hourglass" size={14} />
                    </div>
                    <div>
                      <div className="gh-lbadge-label">Lote C-08</div>
                      <div className="gh-lbadge-val gh-yellow">Reservado</div>
                    </div>
                  </div>
                </div>
                <div className="gh-map-footer-stats">
                  {[
                    { v: "200", l: "Lotes totales" },
                    { v: "89", l: "Disponibles" },
                    { v: "24/7", l: "Actualizado" },
                  ].map((s, i) => (
                    <div key={i} className="gh-mfstat">
                      <span className="gh-mfstat-v">{s.v}</span>
                      <span className="gh-mfstat-l">{s.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CAROUSEL */}
        <section className="gh-carousel-section">
          <p className="gh-carousel-label">
            Inmobiliarias que confían en nosotros
          </p>
          <div className="gh-carousel-track-wrap">
            <div className="gh-cf-left" />
            <div className="gh-cf-right" />
            <div className="gh-carousel-track">
              {[...brands, ...brands].map((b, i) => (
                <div key={i} className="gh-brand-item">
                  <div className="gh-brand-dot" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT IS — REDESIGNED */}
        <WhatIsSection id="plataforma" />

        {/* INTERACTIVE LOT MAP */}
        <section className="gh-lotmap-section">
          <div className="gh-topo-bg">
            <img src={IMG.topoPattern} alt="" className="gh-topo-img" />
            <div className="gh-topo-overlay" />
          </div>
          <div className="gh-section-inner">
            <div className="gh-benefits-header">
              <span className="gh-overline">Demo en Vivo</span>
              <h2 className="gh-section-title gh-text-center">
                Explora lotes en tiempo real
              </h2>
              <p className="gh-section-body gh-text-center gh-muted">
                Haz clic sobre cualquier lote para ver detalles, precio y
                disponibilidad instantánea.
              </p>
            </div>
            <LotMap />
          </div>
        </section>

        {/* COMPARISON SECTION — REDESIGNED */}
        <section className="gh-section gh-section--dark" id="precios">
          <div className="gh-section-inner">
            <ComparisonSection />
          </div>
        </section>

        {/* BUYER SECTION */}
        <BuyerSection onExploreProjects={goToMap} />

        {/* REAL ESTATE SECTION */}
        <RealEstateSection onPublishProject={goToDashboard} />

        {/* HOW IT WORKS */}
        <section className="gh-section">
          <div className="gh-section-inner">
            <div className="gh-benefits-header">
              <span className="gh-overline">Proceso simplificado</span>
              <h2 className="gh-section-title gh-text-center">
                Cómo funciona GeoHabita
              </h2>
            </div>
            <div className="gh-steps-grid">
              <div className="gh-steps-connector" />
              {[
                {
                  n: "1",
                  title: "Regístrate",
                  desc: "Crea tu cuenta profesional en segundos y configura tu perfil de empresa.",
                  icon: "user",
                },
                {
                  n: "2",
                  title: "Sube al mapa",
                  desc: "Dibuja tus lotes o importa archivos CAD/GIS directamente sobre el mapa satelital.",
                  icon: "pin",
                },
                {
                  n: "3",
                  title: "Recibe clientes",
                  desc: "Tu proyecto se vuelve visible para miles. Gestiona solicitudes en tiempo real.",
                  icon: "mobile",
                },
              ].map((s, i) => (
                <ScrollReveal key={i} delay={i * 120}>
                  <div className="gh-step">
                    <div className="gh-step-num">
                      <span className="gh-step-emoji">
                        <GreenIcon name={s.icon} size={20} />
                      </span>
                      <span className="gh-step-n">{s.n}</span>
                    </div>
                    <h3 className="gh-step-title">{s.title}</h3>
                    <p className="gh-step-desc">{s.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="gh-dashboard-section">
          <div className="gh-dash-bg">
            <img src={IMG.dashboard} alt="" className="gh-dash-bg-img" />
            <div className="gh-dash-bg-overlay" />
          </div>
          <div className="gh-section-inner gh-dashboard-grid">
            <div className="gh-dashboard-visual">
              <div className="gh-browser-frame">
                <div className="gh-browser-bar">
                  <span className="gh-bdot" />
                  <span className="gh-bdot" />
                  <span className="gh-bdot" />
                  <span className="gh-browser-url">
                    geohabita.com/dashboard
                  </span>
                </div>
                <div className="gh-browser-content">
                  <img
                    src={IMG.dashboard}
                    alt="Dashboard"
                    className="gh-browser-img"
                  />
                  <div className="gh-browser-widget">
                    <div className="gh-bw-bar" />
                    <div className="gh-bw-line" />
                    <div className="gh-bw-line gh-bw-line--short" />
                    <button className="gh-widget-btn">Reservar Lote</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="gh-dashboard-text">
              <span className="gh-overline">Control total</span>
              <h2 className="gh-section-title">
                Tu proyecto,
                <br />
                tu control
              </h2>
              <div className="gh-feature-rows">
                {[
                  {
                    icon: "satellite",
                    title: "Geolocalización Satelital",
                    desc: "Integra vistas actualizadas para mostrar el progreso de obras, distribución de proyecto y el contexto real del entorno.",
                  },
                  {
                    icon: "chart",
                    title: "Gestión en Tiempo Real",
                    desc: "Cambia el estado de un lote de 'Disponible' a 'Reservado' o 'Vendido' desde tu celular al instante.",
                  },
                  {
                    icon: "globe",
                    title: "Inventario Conectado",
                    desc: "Tu equipo siempre podrá trabajar sobre datos actualizados, eliminando errores y dobles reservas.",
                  },
                ].map((f, i) => (
                  <div key={i} className="gh-feature-row">
                    <div className="gh-feature-row-icon">
                      <GreenIcon name={f.icon} size={18} />
                    </div>
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

        {/* STATS */}
        <section className="gh-stats-section" ref={statsRef}>
          <div className="gh-stats-satbg">
            <img src={IMG.heroMap} alt="" className="gh-stats-satimg" />
            <div className="gh-stats-satoverlay" />
          </div>
          <div className="gh-section-inner">
            <span
              className="gh-overline"
              style={{
                display: "block",
                textAlign: "center",
                marginBottom: "14px",
              }}
            >
              Resultados reales
            </span>
            <h2 className="gh-stats-title">Caso de Éxito: Tarapoto, Perú</h2>
            <p className="gh-stats-sub">
              Nuestro lanzamiento inicial transformó la forma de vender terrenos
              en la selva peruana.
            </p>
            <div className="gh-stats-grid">
              <StatItem
                val="+200"
                suffix=""
                label="Lotes Mapeados"
                trigger={statsInView}
              />
              <StatItem
                val="8"
                label="Proyectos Activos"
                trigger={statsInView}
              />
              <StatItem
                val="21"
                suffix="%"
                label="Aumento en Leads"
                trigger={statsInView}
              />
              <StatItem
                val="Siempre"
                label="Disponibilidad"
                trigger={statsInView}
              />
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        {/* <section className="gh-section">
          <div className="gh-section-inner">
            <div className="gh-benefits-header">
              <span className="gh-overline">Clientes reales</span>
              <h2 className="gh-section-title gh-text-center">
                Lo que dicen nuestros usuarios
              </h2>
            </div>
            <Testimonials />
          </div>
        </section> */}

        {/* PRECISION / CHART */}
        <section className="gh-section">
          <div className="gh-section-inner gh-mapping-grid">
            <div>
              <span className="gh-overline">Tecnología</span>
              <h2 className="gh-section-title">
                Precisión
                <br />a Gran Escala
              </h2>
              <p className="gh-section-body gh-muted">
                Nuestra integración LiDAR permite precisión milimétrica en
                planificación urbana. Visualiza zonas antes de que sean
                construidas.
              </p>
              <div className="gh-cards-stacked">
                {[
                  {
                    icon: "ruler",
                    title: "Análisis Multi-Capa",
                    desc: "Superpone datos demográficos, ambientales y financieros en tiempo real.",
                  },
                  {
                    icon: "chart",
                    title: "ROI Predictivo (Proximamente)",
                    desc: "Pronóstico IA para apreciación de valor a 5, 10 y 20 años.",
                  },
                ].map((c, i) => (
                  <div key={i} className="gh-info-card">
                    <div className="gh-info-card-icon">
                      <GreenIcon name={c.icon} size={18} />
                    </div>
                    <div>
                      <h4 className="gh-info-card-title">{c.title}</h4>
                      <p className="gh-info-card-desc">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="gh-growth-card">
              <div className="gh-growth-header">
                <span className="gh-growth-label">
                  Índice de Crecimiento · Tarapoto
                </span>
                <span className="gh-growth-pct">+12.4%</span>
              </div>
              <div className="gh-chart">
                {[40, 55, 30, 75, 100, 60, 85].map((h, i) => (
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
                {["E", "F", "M", "A", "M", "J", "J"].map((q) => (
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

        {/* PRICING */}
        {/* <section className="gh-section gh-section--alt" id="pricing">
          <div className="gh-section-inner">
            <div className="gh-benefits-header">
              <span className="gh-overline">Planes</span>
              <h2 className="gh-section-title gh-text-center">
                Planes flexibles
              </h2>
              <div className="gh-billing-toggle">
                <span className={!yearly ? "gh-bt-active" : ""}>Mensual</span>
                <button
                  className="gh-toggle"
                  onClick={() => setYearly(!yearly)}
                >
                  <div
                    className={`gh-toggle-thumb${yearly ? " gh-toggle-thumb--on" : ""}`}
                  />
                </button>
                <span className={yearly ? "gh-bt-active" : ""}>
                  Anual <span className="gh-bt-save">-20%</span>
                </span>
              </div>
            </div>
            <div className="gh-pricing-grid">
              {PLANS.map((p, i) => (
                <div
                  key={i}
                  className={`gh-price-card${p.featured ? " gh-price-card--featured" : ""}`}
                >
                  {p.featured && <div className="gh-price-badge">POPULAR</div>}
                  <h3 className="gh-price-name">{p.name}</h3>
                  <div className="gh-price-amount">
                    {p.monthly === null ? (
                      <span className="gh-price-val">Demo</span>
                    ) : p.monthly === 0 ? (
                      <span className="gh-price-val">Gratis</span>
                    ) : (
                      <>
                        <span className="gh-price-val">
                          ${yearly ? p.yearly : p.monthly}
                        </span>
                        <span className="gh-price-period">/mes</span>
                      </>
                    )}
                  </div>
                  <p className="gh-price-desc">{p.desc}</p>
                  <ul className="gh-price-features">
                    {p.features.map((f, j) => (
                      <li key={j}>
                        <span className="gh-check">
                          <GreenIcon name="check" size={13} />
                        </span>
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
        </section> */}

        {/* CTA */}
        <section className="gh-cta-section" id="iniciar-sesion">
          <div className="gh-cta-topobg">
            <img src={IMG.topoPattern} alt="" className="gh-cta-topoimg" />
            <div className="gh-cta-topooverlay" />
          </div>
          <div className="gh-cta-box">
            <div className="gh-cta-scanline" />
            <h2 className="gh-cta-title">
              Lleva tu proyecto
              <br />
              al siguiente nivel
            </h2>
            <p className="gh-cta-sub">
              Deja de perder ventas por planos difíciles de entender. Moderniza
              tu presentación hoy mismo.
            </p>
            {/* <div className="gh-cta-form">
              <input
                className="gh-cta-input"
                type="email"
                placeholder="Tu email profesional"
              />
              <button className="gh-btn-glow">Solicitar Acceso</button>
            </div> */}
            <div className="gh-cta-actions">
              <button className="gh-btn-whatsapp">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="18"
                  height="18"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Contactar por WhatsApp
              </button>
              <button className="gh-btn-white" onClick={goToDashboard}>
                Publicar Propiedad
              </button>
            </div>
            <p className="gh-cta-note">
              ★ GeoHabita es la plataforma de visualización geoespacial líder
              para el sector inmobiliario. Transforma tus datos en ventas con
              tecnología de vanguardia. Solicita acceso hoy mismo.
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="gh-footer" id="nosotros">
        <div className="gh-footer-inner">
          <div className="gh-footer-brand">
            <div className="gh-logo">
              <img
                src="/geohabita.png"
                alt="Logo GeoHabita"
                className="gh-logo-image"
              />
              <span className="gh-logo-name">GeoHabita</span>
            </div>
            <p className="gh-footer-tagline">
              Plataforma de visualización geoespacial para el sector
              inmobiliario moderno. Transformando datos en ventas.
            </p>
            <div className="gh-footer-socials">
              <a href="#" className="gh-social">
                in
              </a>
              <a href="#" className="gh-social">
                tw
              </a>
              <a href="#" className="gh-social">
                ig
              </a>
            </div>
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
          <span>© 2025 GeoHabita</span>
          <span>Todos los derechos reservados</span>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  CSS                                                            */
/* ═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

:root{
  --green:#06f957;
  --green-dim:rgba(6,249,87,0.08);
  --green-border:rgba(6,249,87,0.2);
  --green-faint:rgba(6,249,87,0.07);
  --bg:#070f09;
  --surface:rgba(12,24,14,0.9);
  --surface2:rgba(20,36,22,0.8);
  --border:rgba(6,249,87,0.1);
  --text:rgba(220,255,230,0.88);
  --muted:rgba(100,160,115,0.7);
  --font:'Syne',sans-serif;
  --mono:'Space Mono',monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font);overflow-x:hidden}
img{display:block;max-width:100%}
button{cursor:none}
#inicio,#plataforma,#precios,#nosotros,#iniciar-sesion{scroll-margin-top:92px}
.gh-root{width:100%;max-width:100%;background:var(--bg);overflow-x:clip}
.gh-main{width:100%;max-width:100%;overflow-x:clip}

/* SCROLL REVEAL */
.gh-scroll-reveal{opacity:0;transform:translateY(28px);transition:opacity 0.65s ease,transform 0.65s ease}
.gh-scroll-reveal--visible{opacity:1;transform:none}

/* FADE ANIMATIONS */
@keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes fadeRight{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}
@keyframes fadeLeft{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@keyframes cmpRowIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}
.gh-fade-up{animation:fadeUp 0.7s ease forwards}
.gh-fade-up-delay{animation:fadeUp 0.7s 0.2s ease both}
.gh-slide-in-left{animation:fadeRight 0.75s ease forwards}
.gh-slide-in-right{animation:fadeLeft 0.75s ease forwards}

/* CURSOR */
.gh-cursor-dot{position:fixed;width:8px;height:8px;background:var(--green);border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);transition:transform 0.1s}
.gh-cursor-ring{position:fixed;width:28px;height:28px;border:1.5px solid rgba(6,249,87,0.45);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);transition:left 0.12s ease,top 0.12s ease}

/* HEADER */
.gh-header{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 28px;transition:background 0.4s,box-shadow 0.4s,backdrop-filter 0.4s}
.gh-header--scrolled{background:rgba(7,15,9,0.92);backdrop-filter:blur(20px);box-shadow:0 1px 0 var(--green-faint)}
.gh-header-inner{max-width:1360px;margin:0 auto;display:flex;align-items:center;gap:32px;height:68px;width:100%;min-width:0}
.gh-logo{display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0}
.gh-logo-icon{width:32px;height:32px;border-radius:8px;background:var(--green-dim);border:1px solid var(--green-border);display:flex;align-items:center;justify-content:center;color:var(--green)}
.gh-logo-image{width:34px;height:34px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(6,249,87,0.4))}
.gh-logo-name{font-weight:800;font-size:1.05rem;color:#fff;letter-spacing:-0.02em;white-space:nowrap}
.gh-nav{display:flex;align-items:center;gap:4px;margin-left:auto;min-width:0}
.gh-nav-link{padding:8px 14px;border-radius:8px;color:var(--muted);font-size:0.88rem;font-weight:500;text-decoration:none;transition:color 0.2s,background 0.2s}
.gh-nav-link:hover{color:#fff;background:rgba(255,255,255,0.05)}
.gh-nav-link-btn{display:inline-flex;align-items:center;gap:8px;background:none;border:none}
.gh-nav-link-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--green)}
.gh-header-actions{display:flex;align-items:center;gap:12px;flex-shrink:0}
.gh-link-plain{color:var(--muted);font-size:0.9rem;text-decoration:none;transition:color 0.2s;font-weight:500}
.gh-link-button{background:none;border:none;padding:0}
.gh-link-plain:hover{color:#fff}
.gh-btn-primary{background:var(--green);color:var(--bg);font-weight:700;font-size:0.88rem;padding:9px 18px;border-radius:9px;border:none;font-family:var(--font);transition:background 0.2s,transform 0.15s;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.gh-btn-primary:hover{background:#2dfb6b;transform:translateY(-1px)}
.gh-btn-primary-icon{display:none;line-height:0}
.gh-btn-primary-icon svg{display:block}

/* LIVEFEED */
.gh-livefeed{display:flex;align-items:center;gap:8px;background:rgba(6,249,87,0.06);border:1px solid rgba(6,249,87,0.14);border-radius:40px;padding:6px 14px;font-size:0.78rem;color:var(--muted);font-family:var(--mono);flex-shrink:0}
.gh-livefeed-dot{width:7px;height:7px;border-radius:50%;animation:blink 1.2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
.gh-livefeed-time{color:var(--muted);opacity:0.65}

/* MAIN */
.gh-main{padding-top:68px}

/* HERO */
.gh-hero{position:relative;min-height:92vh;display:flex;align-items:center;overflow:hidden}
.gh-hero-bg{position:absolute;inset:0;z-index:0;overflow:hidden}
.gh-hero-bg-img{width:100%;height:130%;object-fit:cover;opacity:0.28;will-change:transform}
.gh-hero-bg-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(7,15,9,0.97) 0%,rgba(7,15,9,0.82) 40%,rgba(7,15,9,0.6) 100%)}
.gh-scanline{position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--green),transparent);opacity:0.4;animation:scanline 3s ease-in-out infinite}
@keyframes scanline{0%{top:0;opacity:0.4}100%{top:100%;opacity:0}}
.gh-grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(6,249,87,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(6,249,87,0.04) 1px,transparent 1px);background-size:60px 60px}
.gh-hero-inner{position:relative;z-index:1;max-width:1360px;margin:0 auto;padding:80px 28px;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;width:100%}
.gh-hero-content{display:flex;flex-direction:column;gap:22px}
.gh-badge{display:inline-flex;align-items:center;gap:8px;background:var(--green-dim);border:1px solid var(--green-border);border-radius:40px;padding:6px 14px;font-size:0.78rem;color:var(--green);font-family:var(--mono);width:fit-content}
.gh-badge-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:blink 1.2s infinite}
.gh-hero-title{font-size:clamp(2.4rem,5vw,4rem);font-weight:800;color:#fff;line-height:1.05;letter-spacing:-0.04em}
.gh-gradient-text{background:linear-gradient(135deg,var(--green),#4dff91);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.gh-hero-sub{font-size:1.05rem;color:var(--muted);line-height:1.75;max-width:520px}
.gh-hero-btns{display:flex;gap:14px;flex-wrap:wrap}
.gh-btn-glow{display:inline-flex;align-items:center;gap:8px;background:var(--green);color:var(--bg);font-weight:700;font-size:0.92rem;padding:13px 22px;border-radius:11px;border:none;font-family:var(--font);transition:background 0.2s,box-shadow 0.2s,transform 0.15s;box-shadow:0 0 24px rgba(6,249,87,0.28)}
.gh-btn-glow:hover{background:#2dfb6b;box-shadow:0 0 40px rgba(6,249,87,0.45);transform:translateY(-2px)}
.gh-btn-outline{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;font-weight:600;font-size:0.92rem;padding:13px 22px;border-radius:11px;border:1px solid rgba(255,255,255,0.18);font-family:var(--font);transition:background 0.2s,transform 0.15s}
.gh-btn-outline:hover{background:rgba(255,255,255,0.06);transform:translateY(-2px)}
.gh-hero-quickstats{display:flex;gap:28px;flex-wrap:wrap}
.gh-qs-item{display:flex;flex-direction:column;gap:3px}
.gh-qs-val{font-size:1.35rem;font-weight:800;color:#fff;font-family:var(--mono);letter-spacing:-0.02em}
.gh-qs-label{font-size:0.74rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em}

/* MAP CARD */
.gh-hero-visual{position:relative}
.gh-map-card{background:rgba(10,22,12,0.92);border:1px solid var(--green-border);border-radius:18px;overflow:hidden;box-shadow:0 0 80px rgba(6,249,87,0.08),0 40px 100px rgba(0,0,0,0.6);backdrop-filter:blur(20px)}
.gh-map-topbar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border)}
.gh-map-topbar-dot{width:10px;height:10px;border-radius:50%}
.gh-dot-red{background:#ef4444}.gh-dot-yellow{background:#fbbf24}.gh-dot-green{background:var(--green)}
.gh-map-topbar-title{font-size:0.76rem;color:var(--muted);font-family:var(--mono);flex:1;text-align:center}
.gh-map-live{font-size:0.7rem;color:var(--green);font-family:var(--mono);animation:blink 1.4s infinite}
.gh-map-img-wrap{position:relative;height:220px;overflow:hidden}
.gh-map-img{width:100%;height:100%;object-fit:cover}
.gh-map-img-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 60%,rgba(10,22,12,0.9))}
.gh-map-radar{position:absolute;top:50%;left:50%;width:80px;height:80px;border:2px solid rgba(6,249,87,0.3);border-radius:50%;transform:translate(-50%,-50%);animation:radar 2s ease-out infinite}
@keyframes radar{0%{width:20px;height:20px;opacity:1}100%{width:120px;height:120px;opacity:0}}
.gh-lot-badge{position:absolute;display:flex;align-items:center;gap:8px;background:rgba(7,15,9,0.9);border:1px solid var(--border);border-radius:10px;padding:8px 12px;backdrop-filter:blur(12px);font-size:0.72rem}
.gh-lot-badge--a{top:14px;left:14px;animation:float 3s ease-in-out infinite}
.gh-lot-badge--b{top:14px;right:14px;animation:float 3s 1s ease-in-out infinite}
.gh-lot-badge--c{bottom:30px;right:14px;animation:float 3s 0.5s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.gh-lbadge-icon{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700}
.gh-lbadge-icon svg{display:block}
.gh-lbadge-green{background:rgba(6,249,87,0.15);color:var(--green)}
.gh-lbadge-red{background:rgba(239,68,68,0.15);color:#ef4444}
.gh-lbadge-yellow{background:rgba(251,191,36,0.15);color:#fbbf24}
.gh-lbadge-label{color:#fff;font-weight:700;font-size:0.72rem}
.gh-lbadge-val{font-size:0.65rem;color:var(--muted)}
.gh-red{color:#ef4444 !important}
.gh-yellow{color:#fbbf24 !important}
.gh-map-footer-stats{display:flex;justify-content:space-around;padding:14px 16px;border-top:1px solid var(--border)}
.gh-mfstat{display:flex;flex-direction:column;align-items:center;gap:2px}
.gh-mfstat-v{font-size:0.9rem;font-weight:800;color:#fff;font-family:var(--mono)}
.gh-mfstat-l{font-size:0.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em}

/* CAROUSEL */
.gh-carousel-section{padding:58px 0;border-top:1px solid rgba(6,249,87,0.22);border-bottom:1px solid rgba(6,249,87,0.22);overflow:hidden;background:radial-gradient(circle at 50% 50%,rgba(6,249,87,0.2),rgba(6,249,87,0.09) 45%,rgba(6,249,87,0.18));box-shadow:inset 0 0 80px rgba(6,249,87,0.2)}
.gh-carousel-label{text-align:center;font-size:0.88rem;color:#d2ffe2;text-transform:uppercase;letter-spacing:0.19em;font-family:var(--mono);margin-bottom:28px;text-shadow:0 0 16px rgba(6,249,87,0.45)}
.gh-carousel-track-wrap{position:relative;overflow:hidden;padding:12px 0}
.gh-cf-left,.gh-cf-right{position:absolute;top:0;bottom:0;width:80px;z-index:2;pointer-events:none}
.gh-cf-left{left:0;background:linear-gradient(90deg,rgba(8,28,13,0.95),transparent)}
.gh-cf-right{right:0;background:linear-gradient(-90deg,rgba(8,28,13,0.95),transparent)}
.gh-carousel-track{display:flex;width:max-content;animation:scroll 18s linear infinite}
@keyframes scroll{to{transform:translateX(-50%)}}
.gh-brand-item{display:flex;align-items:center;gap:12px;margin:0 10px;padding:11px 18px;font-size:1.02rem;font-weight:800;color:#d8ffe6;white-space:nowrap;font-family:var(--mono);text-shadow:0 0 14px rgba(6,249,87,0.45);background:rgba(8,25,12,0.88);border:1px solid rgba(6,249,87,0.26);border-radius:999px;box-shadow:0 0 24px rgba(6,249,87,0.12)}
.gh-brand-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 14px rgba(6,249,87,0.85)}

/* SECTIONS */
.gh-section{padding:100px 0;position:relative}
.gh-section--alt{background:rgba(6,249,87,0.015)}
.gh-section--dark{background:rgba(0,5,2,0.6)}
.gh-section-inner{max-width:1360px;margin:0 auto;padding:0 28px}
.gh-section-title{font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;color:#fff;line-height:1.1;letter-spacing:-0.04em;margin-bottom:16px}
.gh-section-body{font-size:1rem;color:var(--muted);line-height:1.75;margin-bottom:20px}
.gh-overline{font-size:0.7rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.18em;font-family:var(--mono);display:block;margin-bottom:12px}
.gh-overline--light{color:rgba(255,255,255,0.6)}
.gh-overline--green{color:var(--green)}
.gh-text-center{text-align:center}
.gh-muted{color:var(--muted) !important}
.gh-link-arrow{color:var(--green);font-size:0.9rem;font-weight:600;text-decoration:none;transition:gap 0.2s}
.gh-link-arrow:hover{opacity:0.8}
.gh-check{color:var(--green);font-weight:700;margin-right:6px}
.gh-check svg{display:block}

/* ─── WHAT IS SECTION — REDESIGNED ──────────────────────────── */
.gh-what-section{padding:100px 0;position:relative;overflow:hidden;background:var(--bg)}
.gh-what-bg-glow{position:absolute;top:50%;left:30%;transform:translate(-50%,-50%);width:700px;height:700px;background:radial-gradient(circle,rgba(6,249,87,0.05) 0%,transparent 70%);pointer-events:none;z-index:0}
.gh-what-intro{display:grid;grid-template-columns:1fr 1.1fr;gap:72px;align-items:center;margin-bottom:72px;position:relative;z-index:1}
.gh-what-text-block{display:flex;flex-direction:column;gap:18px}

/* Terminal */
.gh-what-terminal{background:rgba(5,12,7,0.95);border:1px solid rgba(6,249,87,0.25);border-radius:16px;overflow:hidden;box-shadow:0 0 60px rgba(6,249,87,0.07),0 30px 80px rgba(0,0,0,0.5);font-family:var(--mono)}
.gh-terminal-bar{display:flex;align-items:center;gap:7px;padding:11px 16px;background:rgba(6,249,87,0.04);border-bottom:1px solid rgba(6,249,87,0.12)}
.gh-tdot{width:10px;height:10px;border-radius:50%}
.gh-tdot--r{background:rgba(239,68,68,0.7)}
.gh-tdot--y{background:rgba(251,191,36,0.7)}
.gh-tdot--g{background:rgba(6,249,87,0.7)}
.gh-terminal-title{font-size:0.68rem;color:var(--muted);flex:1;text-align:center}
.gh-terminal-body{padding:20px 24px;display:flex;flex-direction:column;gap:6px;min-height:200px}
.gh-terminal-line{font-size:0.78rem;line-height:1.7;display:flex;align-items:baseline;gap:8px}
.gh-t-prompt{color:var(--green);font-weight:700;flex-shrink:0}
.gh-t-cmd{color:#7dd3fc}
.gh-t-str{color:#fbbf24}
.gh-t-key{color:var(--muted)}
.gh-t-val{color:#e2e8f0}
.gh-t-num{color:#f97316}
.gh-t-green{color:var(--green)}
.gh-t-muted{color:rgba(100,160,115,0.5)}
.gh-t-output{padding-left:16px;color:var(--muted)}
.gh-terminal-cursor{color:var(--green);animation:blink 1s step-end infinite;font-size:0.85rem}
.gh-inline-key-icon{display:inline-flex;align-items:center;gap:6px}

/* Feature cards - redesigned */
.gh-what-features{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;position:relative;z-index:1}
.gh-what-feat-card{background:rgba(8,18,10,0.85);border:1px solid rgba(6,249,87,0.1);border-radius:16px;padding:24px;transition:border-color 0.3s,transform 0.3s,box-shadow 0.3s;position:relative;overflow:hidden}
.gh-what-feat-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(6,249,87,0.04) 0%,transparent 60%);opacity:0;transition:opacity 0.3s}
.gh-what-feat-card:hover{border-color:rgba(6,249,87,0.3);transform:translateY(-6px);box-shadow:0 20px 40px rgba(0,0,0,0.3),0 0 30px rgba(6,249,87,0.06)}
.gh-what-feat-card:hover::before{opacity:1}
.gh-what-feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.gh-what-feat-icon-wrap{width:44px;height:44px;border-radius:11px;background:rgba(6,249,87,0.09);border:1px solid rgba(6,249,87,0.18);display:flex;align-items:center;justify-content:center;color:var(--green);flex-shrink:0}
.gh-what-feat-tag{font-size:0.58rem;font-weight:700;color:rgba(6,249,87,0.5);letter-spacing:0.12em;font-family:var(--mono);background:rgba(6,249,87,0.06);border:1px solid rgba(6,249,87,0.12);padding:3px 8px;border-radius:4px}
.gh-what-feat-title{font-size:0.98rem;font-weight:700;color:#fff;margin-bottom:8px;letter-spacing:-0.02em}
.gh-what-feat-desc{font-size:0.8rem;color:var(--muted);line-height:1.6;margin-bottom:16px}
.gh-what-feat-stat{display:flex;align-items:center;gap:7px;font-size:0.72rem;color:var(--green);font-family:var(--mono);font-weight:700}
.gh-what-feat-stat-dot{width:5px;height:5px;border-radius:50%;background:var(--green);flex-shrink:0}

/* LOT MAP */
.gh-lotmap-section{padding:96px 0;position:relative;overflow:hidden}
.gh-topo-bg{position:absolute;inset:0;z-index:0}
.gh-topo-img{width:100%;height:100%;object-fit:cover;opacity:0.16;filter:hue-rotate(85deg) saturate(0.9)}
.gh-topo-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(6,17,10,0.72),rgba(6,17,10,0.55),rgba(6,17,10,0.72))}
.gh-lotmap{position:relative;z-index:1;background:rgba(12,30,17,0.92);border:1px solid rgba(6,249,87,0.26);border-radius:20px;overflow:hidden;backdrop-filter:blur(16px);box-shadow:0 0 60px rgba(6,249,87,0.16)}
.gh-lotmap-filters{display:flex;gap:8px;padding:16px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.gh-filter-btn{padding:6px 16px;border-radius:40px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:0.8rem;font-family:var(--mono);cursor:none;transition:all 0.2s}
.gh-filter-btn--active,.gh-filter-btn:hover{border-color:var(--green-border);color:var(--green);background:var(--green-dim)}
.gh-lotmap-wrap{position:relative}
.gh-lotmap-bg{width:100%;height:340px;object-fit:cover;opacity:0.72}
.gh-lotmap-overlay{position:absolute;inset:0;background:rgba(7,15,9,0.2)}
.gh-lotmap-svg{position:absolute;inset:0;width:100%;height:100%}
.gh-lot-popup{position:absolute;top:14px;right:14px;width:200px;background:rgba(7,15,9,0.97);border:1px solid var(--green-border);border-radius:12px;padding:14px;backdrop-filter:blur(20px);z-index:10}
.gh-lot-popup-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.gh-lot-popup-id{font-family:var(--mono);font-weight:700;color:#fff;font-size:0.95rem}
.gh-lot-popup-close{background:none;border:none;color:var(--muted);font-size:0.9rem;cursor:none}
.gh-lot-popup-status{font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;font-family:var(--mono);padding:3px 8px;border-radius:5px;width:fit-content;margin-bottom:12px}
.gh-lot-popup-status--available{background:rgba(6,249,87,0.12);color:var(--green)}
.gh-lot-popup-status--sold{background:rgba(239,68,68,0.12);color:#ef4444}
.gh-lot-popup-status--reserved{background:rgba(251,191,36,0.12);color:#fbbf24}
.gh-lot-popup-details{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.gh-lot-popup-row{display:flex;justify-content:space-between;font-size:0.8rem;color:var(--muted)}
.gh-lot-popup-row strong{color:#fff;font-family:var(--mono)}
.gh-lot-popup-btn{width:100%;padding:9px;background:var(--green);color:var(--bg);border:none;border-radius:8px;font-size:0.8rem;font-weight:700;font-family:var(--font);cursor:none;transition:background 0.2s}
.gh-lot-popup-btn:hover{background:#2dfb6b}
.gh-lotmap-legend{position:absolute;bottom:14px;left:14px;display:flex;gap:12px;background:rgba(7,15,9,0.85);border:1px solid var(--border);border-radius:8px;padding:7px 12px;backdrop-filter:blur(12px)}
.gh-legend-item{display:flex;align-items:center;gap:5px;font-size:0.7rem;color:var(--muted);font-family:var(--mono)}
.gh-legend-dot{width:8px;height:8px;border-radius:50%}
.gh-lotmap-footer{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--muted);font-family:var(--mono);flex-wrap:wrap;gap:8px}
.gh-lotmap-footer-label{display:inline-flex;align-items:center;gap:7px;color:#cbffd9}
.gh-lotmap-available{color:var(--green);font-weight:700}
.gh-benefits-header{display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:52px}

/* ─── COMPARISON SECTION — REDESIGNED ───────────────────────── */
.gh-compare-section{padding:34px 0}
.gh-compare-label-row{text-align:center;margin-bottom:8px}

/* Header row */
.gh-cmp-header-row{display:grid;grid-template-columns:1fr 80px 1fr;gap:0;margin-bottom:22px;opacity:0}
.gh-cmp-header-row.gh-fade-up{opacity:1}
.gh-cmp-col-label{display:flex;align-items:center}
.gh-cmp-col-label--trad{justify-content:flex-end;padding-right:16px}
.gh-cmp-col-label--geo{justify-content:flex-start;padding-left:16px}
.gh-cmp-header-badge{display:flex;align-items:center;gap:14px;padding:18px 24px;border-radius:14px}
.gh-cmp-header-badge--trad{background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(57,10,10,0.5));border:1px solid rgba(239,68,68,0.3)}
.gh-cmp-header-badge--geo{background:linear-gradient(135deg,rgba(6,249,87,0.24),rgba(8,30,14,0.72));border:1px solid rgba(6,249,87,0.45);box-shadow:0 0 40px rgba(6,249,87,0.2)}
.gh-cmp-header-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--green)}
.gh-cmp-header-title{font-size:0.9rem;font-weight:800;color:#fff;letter-spacing:-0.02em}
.gh-cmp-header-sub{font-size:0.7rem;color:#c4fbd6;font-family:var(--mono)}
.gh-cmp-divider-head{display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:rgba(6,249,87,0.3);font-family:var(--mono);letter-spacing:0.1em}

/* Comparison rows */
.gh-cmp-rows{display:flex;flex-direction:column;gap:10px}
.gh-cmp-row{display:grid;grid-template-columns:1fr 80px 1fr;gap:0;opacity:0;transform:translateY(10px);transition:opacity 0.5s ease,transform 0.5s ease}
.gh-cmp-row--visible{opacity:1;transform:none}
.gh-cmp-cell{display:flex;align-items:center;gap:12px;padding:16px 20px;border-radius:11px;font-size:0.87rem;transition:all 0.25s}
.gh-cmp-cell--trad{background:rgba(33,10,10,0.84);border:1px solid rgba(239,68,68,0.24);justify-content:flex-end;text-align:right;flex-direction:row-reverse}
.gh-cmp-cell--trad:hover{background:rgba(239,68,68,0.16);border-color:rgba(239,68,68,0.4)}
.gh-cmp-cell--geo{background:rgba(9,26,12,0.86);border:1px solid rgba(6,249,87,0.28)}
.gh-cmp-cell--geo:hover{background:rgba(6,249,87,0.13);border-color:rgba(6,249,87,0.52)}
.gh-cmp-cell-text{color:var(--text);flex:1}
.gh-cmp-x-icon{width:24px;height:24px;border-radius:50%;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);display:flex;align-items:center;justify-content:center;color:#ef4444;flex-shrink:0;line-height:1}
.gh-cmp-check-icon{width:24px;height:24px;border-radius:50%;background:rgba(6,249,87,0.15);border:1px solid rgba(6,249,87,0.35);display:flex;align-items:center;justify-content:center;color:var(--green);flex-shrink:0;line-height:1}
.gh-cmp-center{display:flex;align-items:center;justify-content:center}
.gh-cmp-icon-bubble{width:48px;height:48px;border-radius:50%;background:rgba(12,28,15,0.98);border:1px solid rgba(6,249,87,0.36);display:flex;align-items:center;justify-content:center;color:var(--green);box-shadow:0 0 26px rgba(6,249,87,0.24);flex-shrink:0;z-index:1}

/* Score bar */
.gh-cmp-scores{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-top:28px;opacity:0}
.gh-cmp-scores.gh-fade-up{opacity:1}
.gh-cmp-score{padding:18px 24px;border-radius:14px;display:flex;flex-direction:column;gap:5px}
.gh-cmp-score--trad{background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(30,8,8,0.68));border:1px solid rgba(239,68,68,0.3)}
.gh-cmp-score--geo{background:linear-gradient(135deg,rgba(6,249,87,0.24),rgba(10,32,16,0.78));border:1px solid rgba(6,249,87,0.42);box-shadow:0 0 36px rgba(6,249,87,0.18)}
.gh-cmp-score-val{font-weight:800;color:#fff;font-size:0.95rem;display:inline-flex;align-items:center;gap:8px}
.gh-cmp-score-sub{font-size:0.74rem;color:var(--muted);font-family:var(--mono)}
.gh-cmp-score-vs{font-size:1.5rem;font-weight:900;color:rgba(6,249,87,0.3);font-family:var(--mono);text-align:center}

/* ─── BUYER SECTION ──────────────────────────────────────────── */
.gh-buyer-section{position:relative;overflow:hidden;padding:120px 0;min-height:800px;display:flex;align-items:center}
.gh-buyer-bg-wrap{position:absolute;inset:-30% 0;z-index:0;overflow:hidden}
.gh-buyer-bg-img{width:100%;height:130%;object-fit:cover;opacity:0.18;will-change:transform}
.gh-buyer-bg-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(7,15,9,0.97) 0%,rgba(7,15,9,0.88) 60%,rgba(7,15,9,0.75) 100%)}
.gh-buyer-inner{position:relative;z-index:1;max-width:1360px;margin:0 auto;padding:0 28px;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;width:100%}
.gh-buyer-title{font-size:clamp(2rem,4vw,3.2rem);font-weight:800;color:#fff;line-height:1.1;letter-spacing:-0.04em;margin-bottom:18px}
.gh-buyer-title em{font-style:normal;background:linear-gradient(90deg,var(--green),#4dff91);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.gh-buyer-sub{font-size:1rem;color:var(--muted);line-height:1.75;margin-bottom:36px}
.gh-buyer-benefits{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:36px}
.gh-buyer-benefit{display:flex;gap:12px;align-items:flex-start;background:rgba(12,24,14,0.7);border:1px solid var(--border);border-radius:12px;padding:14px;transition:border-color 0.3s,transform 0.3s;backdrop-filter:blur(8px)}
.gh-buyer-benefit:hover{border-color:var(--green-border);transform:translateY(-3px)}
.gh-buyer-benefit-icon{flex-shrink:0;width:32px;height:32px;background:var(--green-dim);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--green)}
.gh-buyer-benefit-title{font-size:0.85rem;font-weight:700;color:#fff;margin-bottom:3px}
.gh-buyer-benefit-desc{font-size:0.76rem;color:var(--muted);line-height:1.55}
.gh-buyer-cta{margin-top:4px}
.gh-buyer-visual{display:flex;flex-direction:column;gap:22px}
.gh-buyer-img-stack{position:relative}
.gh-buyer-img-bg-card{position:absolute;top:20px;left:20px;right:-20px;bottom:-20px;background:linear-gradient(135deg,rgba(6,249,87,0.12),rgba(6,249,87,0.04));border:1px solid rgba(6,249,87,0.18);border-radius:20px}
.gh-buyer-img-wrap{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--green-border);box-shadow:0 30px 80px rgba(0,0,0,0.5)}
.gh-buyer-img{width:100%;height:340px;object-fit:cover}
.gh-buyer-img-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 60%,rgba(7,15,9,0.8))}
.gh-buyer-badge{position:absolute;display:flex;align-items:center;gap:8px;background:rgba(7,15,9,0.92);border:1px solid var(--green-border);border-radius:10px;padding:8px 14px;backdrop-filter:blur(14px);font-size:0.75rem}
.gh-buyer-badge--1{top:18px;left:18px;animation:float 3.5s ease-in-out infinite}
.gh-buyer-badge--2{bottom:22px;right:18px;animation:float 3.5s 1.5s ease-in-out infinite}
.gh-buyer-badge-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--green)}
.gh-buyer-badge-title{font-weight:700;color:#fff;font-size:0.78rem}
.gh-buyer-badge-val{font-size:0.68rem;color:var(--muted);font-family:var(--mono)}
.gh-buyer-stat-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;position:relative;z-index:1}
.gh-buyer-stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 22px;text-align:center;flex:1;min-width:90px}
.gh-buyer-stat-val{display:block;font-size:1.1rem;font-weight:800;color:#fff;font-family:var(--mono);letter-spacing:-0.02em}
.gh-buyer-stat-label{font-size:0.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em}

/* ─── REAL ESTATE SECTION ────────────────────────────────────── */
.gh-realestate-section{position:relative;overflow:hidden;padding:120px 0;min-height:900px}
.gh-realestate-bg-wrap{position:absolute;inset:-30% 0;z-index:0;overflow:hidden}
.gh-realestate-bg-img{width:100%;height:130%;object-fit:cover;opacity:0.12;will-change:transform;filter:saturate(0.4)}
.gh-realestate-bg-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,15,9,0.95) 0%,rgba(7,15,9,0.85) 50%,rgba(7,15,9,0.97) 100%)}
.gh-realestate-bg-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(6,249,87,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(6,249,87,0.035) 1px,transparent 1px);background-size:50px 50px}
.gh-realestate-inner{position:relative;z-index:1;max-width:1360px;margin:0 auto;padding:0 28px;width:100%}
.gh-realestate-header{text-align:center;margin-bottom:64px}
.gh-realestate-title{font-size:clamp(2rem,4vw,3.2rem);font-weight:800;color:#fff;line-height:1.1;letter-spacing:-0.04em;margin-bottom:18px}
.gh-realestate-sub{font-size:1.05rem;color:var(--muted);line-height:1.7;max-width:560px;margin:0 auto}
.gh-realestate-content{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.gh-realestate-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gh-re-card{background:rgba(12,24,14,0.8);border:1px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all 0.3s;backdrop-filter:blur(12px)}
.gh-re-card:hover,.gh-re-card--active{border-color:var(--green-border);background:rgba(6,249,87,0.05);transform:translateY(-3px);box-shadow:0 0 30px rgba(6,249,87,0.07)}
.gh-re-card-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.gh-re-card-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--green)}
.gh-re-card-metric{font-size:0.62rem;font-weight:700;color:var(--green);font-family:var(--mono);background:var(--green-dim);border:1px solid var(--green-border);padding:3px 7px;border-radius:5px;text-align:right}
.gh-re-card-title{font-size:0.9rem;font-weight:700;color:#fff;margin-bottom:6px}
.gh-re-card-desc{font-size:0.78rem;color:var(--muted);line-height:1.55;margin-bottom:10px}
.gh-re-card-arrow{color:var(--green);font-size:0.9rem;opacity:0;transition:opacity 0.2s}
.gh-re-card:hover .gh-re-card-arrow,.gh-re-card--active .gh-re-card-arrow{opacity:1}
.gh-realestate-roi{display:flex;flex-direction:column;gap:20px}
.gh-roi-card{background:rgba(10,22,12,0.92);border:1px solid var(--green-border);border-radius:20px;padding:32px;box-shadow:0 0 60px rgba(6,249,87,0.06);backdrop-filter:blur(20px)}
.gh-roi-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
.gh-roi-label{font-size:0.78rem;font-weight:700;color:#fff;font-family:var(--mono)}
.gh-roi-period{font-size:0.68rem;color:var(--muted);font-family:var(--mono)}
.gh-roi-chart{display:flex;flex-direction:column;gap:14px;margin-bottom:20px}
.gh-roi-row{display:flex;flex-direction:column;gap:5px}
.gh-roi-row-label{font-size:0.74rem;color:var(--muted);font-family:var(--mono)}
.gh-roi-bars{display:flex;flex-direction:column;gap:4px}
.gh-roi-bar-wrap{height:22px;background:rgba(255,255,255,0.04);border-radius:4px;overflow:hidden}
.gh-roi-bar{height:100%;border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;transition:width 1.2s ease;min-width:40px}
.gh-roi-bar--trad{background:rgba(239,68,68,0.3);border:1px solid rgba(239,68,68,0.2)}
.gh-roi-bar--geo{background:linear-gradient(90deg,rgba(6,249,87,0.3),rgba(6,249,87,0.6));border:1px solid rgba(6,249,87,0.25)}
.gh-roi-bar-val{font-size:0.62rem;font-weight:700;color:#fff;font-family:var(--mono);white-space:nowrap}
.gh-roi-legend{display:flex;gap:18px;margin-bottom:22px}
.gh-roi-leg{display:flex;align-items:center;gap:6px;font-size:0.72rem;color:var(--muted);font-family:var(--mono)}
.gh-roi-leg::before{content:'';width:10px;height:10px;border-radius:3px;flex-shrink:0}
.gh-roi-leg--trad::before{background:rgba(239,68,68,0.4)}
.gh-roi-leg--geo::before{background:rgba(6,249,87,0.6)}
.gh-roi-cta-area{border-top:1px solid var(--border);padding-top:20px}
.gh-roi-cta-text{font-size:0.82rem;color:var(--muted);margin-bottom:14px;line-height:1.55}
.gh-re-trust-badges{display:flex;flex-direction:column;gap:10px}
.gh-re-trust-badge{display:flex;align-items:center;gap:10px;background:rgba(12,24,14,0.7);border:1px solid var(--border);border-radius:10px;padding:12px 16px;font-size:0.82rem;color:var(--muted);backdrop-filter:blur(8px);transition:border-color 0.3s}
.gh-re-trust-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--green)}
.gh-re-trust-badge:hover{border-color:var(--green-border);color:var(--text)}

/* STEPS */
.gh-steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;position:relative}
.gh-steps-connector{position:absolute;top:28px;left:18%;right:18%;height:1px;background:linear-gradient(90deg,transparent,var(--green-border),var(--green-border),transparent);z-index:0}
.gh-step{text-align:center;position:relative;z-index:1;background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:32px 24px;transition:border-color 0.3s}
.gh-step:hover{border-color:var(--green-border)}
.gh-step-num{width:56px;height:56px;border-radius:50%;background:var(--green-dim);border:1px solid var(--green-border);margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;position:relative}
.gh-step-n{position:absolute;bottom:-3px;right:-3px;width:18px;height:18px;background:var(--green);color:var(--bg);border-radius:50%;font-size:0.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:var(--mono)}
.gh-step-emoji{display:inline-flex;align-items:center;justify-content:center;color:var(--green)}
.gh-step-title{font-size:1rem;font-weight:700;color:#fff;margin-bottom:10px}
.gh-step-desc{font-size:0.84rem;color:var(--muted);line-height:1.6}

/* DASHBOARD */
.gh-dashboard-section{padding:100px 0;position:relative;overflow:hidden}
.gh-dash-bg{position:absolute;inset:0;z-index:0}
.gh-dash-bg-img{width:100%;height:100%;object-fit:cover;opacity:0.1}
.gh-dash-bg-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,15,9,0.98),rgba(7,15,9,0.85))}
.gh-dashboard-grid{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.gh-browser-frame{background:rgba(10,20,12,0.95);border:1px solid var(--green-border);border-radius:14px;overflow:hidden;box-shadow:0 0 60px rgba(6,249,87,0.07)}
.gh-browser-bar{display:flex;align-items:center;gap:8px;padding:11px 16px;border-bottom:1px solid var(--border);background:rgba(5,12,6,0.9)}
.gh-bdot{width:10px;height:10px;border-radius:50%;background:var(--border)}
.gh-browser-url{font-size:0.72rem;color:var(--muted);font-family:var(--mono);flex:1;text-align:center}
.gh-browser-content{position:relative}
.gh-browser-img{width:100%;opacity:0.7}
.gh-browser-widget{position:absolute;bottom:18px;right:18px;background:rgba(7,15,9,0.92);border:1px solid var(--green-border);border-radius:10px;padding:12px;width:130px;backdrop-filter:blur(14px)}
.gh-bw-bar{height:8px;border-radius:4px;background:var(--green-dim);border:1px solid var(--green-border);margin-bottom:8px}
.gh-bw-line{height:5px;border-radius:3px;background:var(--surface2);margin-bottom:5px}
.gh-bw-line--short{width:60%}
.gh-widget-btn{width:100%;padding:7px;background:var(--green);color:var(--bg);border:none;border-radius:6px;font-size:0.68rem;font-weight:700;font-family:var(--font);cursor:none;margin-top:6px}
.gh-feature-rows{display:flex;flex-direction:column;gap:16px;margin-top:24px}
.gh-feature-row{display:flex;gap:14px;align-items:flex-start;padding:18px 20px;border-radius:12px;border:1px solid var(--border);background:var(--surface);transition:border-color 0.3s}
.gh-feature-row:hover{border-color:var(--green-border)}
.gh-feature-row-icon{width:38px;height:38px;border-radius:9px;background:var(--green-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--green)}
.gh-feature-row-title{font-size:0.9rem;font-weight:700;color:#fff;margin-bottom:4px}
.gh-feature-row-desc{font-size:0.81rem;color:var(--muted);line-height:1.55}

/* STATS */
.gh-stats-section{padding:80px 0;position:relative;overflow:hidden;text-align:center}
.gh-stats-satbg{position:absolute;inset:0;z-index:0}
.gh-stats-satimg{width:100%;height:100%;object-fit:cover;opacity:0.14}
.gh-stats-satoverlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(7,15,9,0.88),rgba(7,15,9,0.75),rgba(7,15,9,0.88))}
.gh-stats-title{font-size:clamp(1.5rem,3vw,2.2rem);font-weight:800;color:#fff;margin-bottom:12px;letter-spacing:-0.04em;position:relative;z-index:1}
.gh-stats-sub{font-size:0.95rem;color:var(--muted);max-width:560px;margin:0 auto 52px;line-height:1.7;position:relative;z-index:1}
.gh-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;max-width:900px;margin:0 auto;position:relative;z-index:1}
.gh-stat-item{background:rgba(10,22,12,0.82);border:1px solid var(--green-border);border-radius:16px;padding:30px 20px;backdrop-filter:blur(12px);transition:transform 0.3s}
.gh-stat-item:hover{transform:translateY(-4px)}
.gh-stat-val{font-size:2.2rem;font-weight:900;color:#fff;letter-spacing:-0.04em;font-family:var(--mono);margin-bottom:8px}
.gh-stat-label{font-size:0.68rem;font-weight:700;color:rgba(6,249,87,0.55);text-transform:uppercase;letter-spacing:0.15em}

/* TESTIMONIALS */
.gh-testimonials{display:flex;flex-direction:column;align-items:center;gap:28px;max-width:700px;margin:0 auto}
.gh-testimonial-card{background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:44px 48px;position:relative;transition:border-color 0.3s;width:100%}
.gh-testimonial-card:hover{border-color:var(--green-border)}
.gh-testimonial-quote{font-size:5rem;line-height:1;color:var(--green);opacity:0.22;position:absolute;top:20px;left:32px;font-family:serif}
.gh-testimonial-text{font-size:1.05rem;color:var(--text);line-height:1.8;margin-bottom:28px;position:relative;z-index:1}
.gh-testimonial-author{display:flex;align-items:center;gap:14px}
.gh-testimonial-avatar{width:44px;height:44px;border-radius:50%;background:var(--green-dim);border:1px solid var(--green-border);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:800;color:var(--green);flex-shrink:0;font-family:var(--mono)}
.gh-testimonial-name{font-size:0.9rem;font-weight:700;color:#fff}
.gh-testimonial-role{font-size:0.77rem;color:var(--muted)}
.gh-testimonial-nav{display:flex;align-items:center;gap:18px}
.gh-tnav-btn{width:40px;height:40px;border-radius:50%;background:var(--surface);border:1px solid var(--border);color:var(--muted);font-size:1rem;cursor:none;transition:all 0.2s;font-family:var(--font)}
.gh-tnav-btn:hover{border-color:var(--green);color:var(--green)}
.gh-tnav-dots{display:flex;gap:8px}
.gh-tnav-dot{width:8px;height:8px;border-radius:50%;background:var(--surface2);cursor:none;transition:all 0.2s}
.gh-tnav-dot--active{background:var(--green);width:22px;border-radius:4px}

/* CHART */
.gh-mapping-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start}
.gh-cards-stacked{display:flex;flex-direction:column;gap:14px}
.gh-info-card{display:flex;gap:14px;padding:18px 22px;border-radius:14px;background:var(--surface);border:1px solid var(--border);transition:border-color 0.3s,transform 0.3s}
.gh-info-card:hover{border-color:var(--green-border);transform:translateX(6px)}
.gh-info-card-icon{width:42px;height:42px;border-radius:10px;background:var(--green-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--green)}
.gh-info-card-title{font-size:0.92rem;font-weight:700;color:#fff;margin-bottom:3px}
.gh-info-card-desc{font-size:0.8rem;color:var(--muted);line-height:1.55}
.gh-growth-card{background:var(--surface);border:1px solid var(--green-border);border-radius:20px;padding:26px;box-shadow:0 0 50px rgba(6,249,87,0.04)}
.gh-growth-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}
.gh-growth-label{font-size:0.7rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;font-family:var(--mono)}
.gh-growth-pct{color:var(--green);font-weight:800;font-size:1rem;font-family:var(--mono)}
.gh-chart{height:100px;display:flex;align-items:flex-end;gap:7px;margin-bottom:7px}
.gh-bar{flex:1;background:rgba(6,249,87,0.18);border-radius:4px 4px 0 0;position:relative;transition:background 0.3s}
.gh-bar:hover{background:rgba(6,249,87,0.35)}
.gh-bar--peak{background:rgba(6,249,87,0.8)!important}
.gh-bar-dot{position:absolute;top:-6px;right:50%;transform:translateX(50%);width:10px;height:10px;background:#fff;border-radius:50%;box-shadow:0 0 12px var(--green)}
.gh-chart-labels{display:flex;justify-content:space-between}
.gh-chart-labels span{font-size:0.61rem;color:var(--muted);font-family:var(--mono)}
.gh-growth-features{display:flex;flex-direction:column;gap:9px;margin-top:18px;border-top:1px solid var(--border);padding-top:18px}
.gh-growth-feat{display:flex;align-items:center;gap:8px;font-size:0.84rem;color:var(--muted)}
.gh-growth-feat-dot{width:5px;height:5px;border-radius:50%;background:var(--green);flex-shrink:0}

/* BILLING */
.gh-billing-toggle{display:flex;align-items:center;gap:14px;justify-content:center;margin-top:20px;font-size:0.9rem;color:var(--muted)}
.gh-bt-active{color:#fff;font-weight:700}
.gh-bt-save{background:rgba(6,249,87,0.15);color:var(--green);font-size:0.68rem;font-weight:700;padding:2px 7px;border-radius:5px;font-family:var(--mono)}
.gh-toggle{width:44px;height:24px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);position:relative;cursor:none;transition:background 0.3s}
.gh-toggle-thumb{width:18px;height:18px;border-radius:50%;background:var(--muted);position:absolute;top:2px;left:2px;transition:transform 0.3s,background 0.3s}
.gh-toggle-thumb--on{transform:translateX(20px);background:var(--green)}

/* PRICING */
.gh-pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;max-width:1100px;margin:48px auto 0;align-items:start}
.gh-price-card{padding:38px;border-radius:22px;background:var(--surface);border:1px solid var(--border);display:flex;flex-direction:column;position:relative;transition:border-color 0.3s,transform 0.3s}
.gh-price-card:hover{border-color:var(--green-border);transform:translateY(-4px)}
.gh-price-card--featured{border:1.5px solid var(--green);box-shadow:0 0 50px rgba(6,249,87,0.08);transform:translateY(-10px)}
.gh-price-card--featured:hover{transform:translateY(-14px)}
.gh-price-badge{position:absolute;top:0;right:22px;background:var(--green);color:var(--bg);font-size:0.6rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;padding:4px 11px;border-radius:0 0 8px 8px;font-family:var(--mono)}
.gh-price-name{font-size:1.25rem;font-weight:800;color:#fff;margin-bottom:18px}
.gh-price-amount{display:flex;align-items:baseline;gap:3px;margin-bottom:11px}
.gh-price-val{font-size:2.8rem;font-weight:900;color:#fff;letter-spacing:-0.04em;font-family:var(--mono)}
.gh-price-period{font-size:0.85rem;color:var(--muted)}
.gh-price-desc{font-size:0.84rem;color:var(--muted);line-height:1.5;margin-bottom:26px}
.gh-price-features{list-style:none;display:flex;flex-direction:column;gap:12px;flex:1;margin-bottom:28px}
.gh-price-features li{display:flex;align-items:center;gap:9px;font-size:0.88rem;color:#a8c8b8}
.gh-price-btn{width:100%;padding:13px;border-radius:11px;font-weight:700;font-size:0.9rem;cursor:none;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#fff;font-family:var(--font);transition:all 0.2s}
.gh-price-btn:hover{background:rgba(255,255,255,0.05);transform:translateY(-2px)}
.gh-price-btn--featured{background:var(--green);color:var(--bg);border-color:var(--green)}
.gh-price-btn--featured:hover{background:#2dfb6b}

/* CTA */
.gh-cta-section{padding:100px 24px;position:relative;overflow:hidden}
.gh-cta-topobg{position:absolute;inset:0;z-index:0}
.gh-cta-topoimg{width:100%;height:100%;object-fit:cover;opacity:0.16;filter:hue-rotate(80deg) saturate(0.5)}
.gh-cta-topooverlay{position:absolute;inset:0;background:radial-gradient(ellipse 80% 80% at 50% 50%,rgba(7,15,9,0.72),rgba(7,15,9,0.97))}
.gh-cta-box{max-width:840px;margin:0 auto;text-align:center;background:rgba(12,26,15,0.88);backdrop-filter:blur(24px);border:1px solid var(--green-border);border-radius:28px;padding:64px 48px;position:relative;overflow:hidden;z-index:1}
.gh-cta-scanline{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--green),transparent);opacity:0.5}
.gh-cta-title{font-size:clamp(2rem,4vw,3.2rem);font-weight:900;color:#fff;margin-bottom:18px;letter-spacing:-0.04em;line-height:1.08}
.gh-cta-sub{font-size:1.02rem;color:var(--muted);line-height:1.7;margin-bottom:36px}
.gh-cta-form{display:flex;gap:11px;max-width:500px;margin:0 auto 28px;flex-wrap:wrap;justify-content:center}
.gh-cta-input{flex:1;min-width:200px;height:50px;padding:0 16px;border-radius:11px;background:rgba(7,15,9,0.8);border:1px solid var(--border);color:#fff;font-size:0.92rem;font-family:var(--font);outline:none;transition:border-color 0.2s}
.gh-cta-input:focus{border-color:var(--green)}
.gh-cta-input::placeholder{color:var(--muted)}
.gh-cta-actions{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.gh-btn-whatsapp{display:inline-flex;align-items:center;gap:8px;background:#16a34a;color:#fff;font-weight:700;font-size:0.9rem;padding:13px 22px;border-radius:11px;border:none;cursor:none;font-family:var(--font);transition:background 0.2s,transform 0.2s}
.gh-btn-whatsapp:hover{background:#15803d;transform:translateY(-2px)}
.gh-btn-white{background:#fff;color:var(--bg);font-weight:700;font-size:0.9rem;padding:13px 22px;border-radius:11px;border:none;cursor:none;font-family:var(--font);transition:background 0.2s,transform 0.2s}
.gh-btn-white:hover{background:#d4ffe3;transform:translateY(-2px)}
.gh-cta-note{margin-top:22px;font-size:0.73rem;color:rgba(90,138,106,0.5);font-family:var(--mono)}

/* FOOTER */
.gh-footer{background:#050c07;border-top:1px solid var(--green-faint);padding:64px 0 0;position:relative;z-index:1}
.gh-footer-inner{max-width:1360px;margin:0 auto;padding:0 28px 48px;display:grid;grid-template-columns:1fr 2fr;gap:64px}
.gh-footer-tagline{color:var(--muted);font-size:0.84rem;line-height:1.65;margin-top:14px}
.gh-footer-socials{display:flex;gap:10px;margin-top:18px}
.gh-social{width:34px;height:34px;border-radius:8px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:var(--muted);text-decoration:none;transition:all 0.2s}
.gh-social:hover{border-color:var(--green-border);color:var(--green)}
.gh-footer-links-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.gh-footer-col{display:flex;flex-direction:column;gap:11px}
.gh-footer-col-title{font-size:0.73rem;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px;font-family:var(--mono)}
.gh-footer-link{color:var(--muted);font-size:0.84rem;text-decoration:none;transition:color 0.2s}
.gh-footer-link:hover{color:var(--green)}
.gh-footer-bottom{max-width:1360px;margin:0 auto;padding:18px 28px;border-top:1px solid var(--green-faint);display:flex;justify-content:space-between;align-items:center;font-size:0.73rem;color:rgba(90,138,106,0.35);flex-wrap:wrap;gap:8px;font-family:var(--mono)}

/* ─── RESPONSIVE ─────────────────────────────────────────────── */
@media(max-width:1100px){
  .gh-what-intro{grid-template-columns:1fr}
  .gh-what-terminal{display:none}
  .gh-what-features{grid-template-columns:repeat(2,1fr)}
  .gh-realestate-content{grid-template-columns:1fr}
  .gh-cmp-header-row{grid-template-columns:1fr 60px 1fr}
  .gh-cmp-row{grid-template-columns:1fr 60px 1fr}
  .gh-cmp-icon-bubble{width:36px;height:36px;font-size:0.9rem}
}
@media(max-width:900px){
  .gh-header{padding:0 14px}
  .gh-header-inner{gap:10px;height:auto;min-height:68px;padding:8px 0;flex-wrap:wrap}
  .gh-nav{order:3;width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px}
  .gh-nav-link{font-size:0.78rem;padding:7px 10px;white-space:nowrap}
  .gh-nav-link-icon{width:14px;height:14px}
  .gh-btn-primary{font-size:0.76rem;padding:8px 11px}
  .gh-btn-primary-label{display:none}
  .gh-btn-primary-icon{display:inline-flex}
  .gh-hero-inner{grid-template-columns:1fr;padding-top:40px;padding-bottom:40px}
  .gh-hero-visual{display:none}
  .gh-dashboard-grid{grid-template-columns:1fr}
  .gh-mapping-grid{grid-template-columns:1fr}
  .gh-header-actions{display:flex;margin-left:auto}
  .gh-livefeed{display:none}
  .gh-footer-inner{grid-template-columns:1fr}
  .gh-buyer-inner{grid-template-columns:1fr}
  .gh-buyer-benefits{grid-template-columns:1fr 1fr}
  .gh-realestate-cards{grid-template-columns:1fr 1fr}
  .gh-cmp-header-row{grid-template-columns:1fr 48px 1fr;gap:0}
  .gh-cmp-row{grid-template-columns:1fr 48px 1fr}
  .gh-cmp-cell{padding:10px 12px;font-size:0.78rem}
  .gh-cmp-icon-bubble{width:32px;height:32px;font-size:0.8rem}
  .gh-cmp-scores{grid-template-columns:1fr auto 1fr;gap:10px}
  .gh-what-features{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:700px){
  .gh-steps-grid{grid-template-columns:1fr}
  .gh-steps-connector{display:none}
  .gh-stats-grid{grid-template-columns:repeat(2,1fr)}
  .gh-pricing-grid{grid-template-columns:1fr}
  .gh-price-card--featured{transform:none}
  .gh-what-features{grid-template-columns:1fr 1fr}
  .gh-footer-links-grid{grid-template-columns:1fr 1fr}
  .gh-cta-box{padding:36px 22px}
  .gh-testimonial-card{padding:28px 22px}
  .gh-buyer-img{height:240px}
  .gh-buyer-benefits{grid-template-columns:1fr}
  .gh-realestate-cards{grid-template-columns:1fr}
  .gh-cmp-header-row{display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);gap:6px}
  .gh-cmp-col-label--trad,.gh-cmp-col-label--geo{padding:0}
  .gh-cmp-header-badge{width:100%;min-width:0;padding:10px 8px;gap:8px}
  .gh-cmp-header-title{font-size:0.7rem;line-height:1.2}
  .gh-cmp-header-sub{font-size:0.58rem;line-height:1.2}
  .gh-cmp-row{grid-template-columns:1fr 28px 1fr;gap:8px}
  .gh-cmp-cell{padding:10px 10px;font-size:0.72rem;gap:6px}
  .gh-cmp-cell-text{display:block;font-size:0.68rem;line-height:1.35}
  .gh-cmp-icon-bubble{width:26px;height:26px}
  .gh-cmp-scores{grid-template-columns:1fr 1fr;gap:10px}
  .gh-cmp-score-vs{display:none}
  .gh-cmp-score{padding:12px}
  .gh-cmp-score-val{font-size:0.78rem}
  .gh-cmp-score-sub{font-size:0.62rem}
}
@media(max-width:480px){
  .gh-header-inner{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;row-gap:8px;align-items:center}
  .gh-logo{min-width:0}
  .gh-logo-name{display:block;font-size:0.9rem}
  .gh-header-actions{display:flex;width:auto;min-width:0;gap:8px;justify-content:flex-end}
  .gh-btn-primary{font-size:0.72rem;padding:8px;white-space:nowrap;min-width:36px;width:36px;height:36px;border-radius:10px}
  .gh-btn-primary-label{display:none}
  .gh-btn-primary-icon{display:inline-flex}
  .gh-nav{grid-column:1 / -1;width:100%;max-width:100%;overflow-x:auto}
  .gh-what-features{grid-template-columns:1fr}
  .gh-cmp-header-row{grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr);gap:4px}
  .gh-cmp-header-badge{padding:8px 6px;gap:6px}
  .gh-cmp-header-icon svg{width:14px;height:14px}
  .gh-cmp-header-title{font-size:0.62rem}
  .gh-cmp-header-sub{font-size:0.52rem}
  .gh-cmp-row{grid-template-columns:1fr 24px 1fr;gap:6px}
  .gh-cmp-cell{padding:9px 8px}
  .gh-cmp-cell-text{font-size:0.62rem}
  .gh-cmp-icon-bubble{width:22px;height:22px}
  .gh-cmp-check-icon,.gh-cmp-x-icon{width:18px;height:18px}
  .gh-cmp-scores{grid-template-columns:1fr 1fr}
  .gh-hero-title{font-size:2rem}
  .gh-stats-grid{grid-template-columns:1fr 1fr}
}
`;
