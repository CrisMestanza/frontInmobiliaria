import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { withApiBase } from "../../config/api.js";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

  :root {
    --primary: #0df259;
    --bg-dark: #06140b;
    --emerald-dark: #0a2414;
    --emerald-border: #124124;
    --text-light: #f1f5f9;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .geo-root {
    font-family: 'Space Grotesk', sans-serif;
    background-color: var(--bg-dark);
    color: var(--text-light);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow-x: hidden;
  }

  .geo-canvas {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .geo-bg-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(to bottom,
      rgba(6,20,11,0.55) 0%,
      rgba(6,20,11,0.15) 40%,
      rgba(6,20,11,0.15) 60%,
      rgba(6,20,11,0.75) 100%
    );
    pointer-events: none;
  }

  .geo-layout {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 100vh;
  }

  .geo-content-wrap {
    padding: 1.25rem 1.5rem;
    display: flex;
    justify-content: center;
    flex: 1;
  }
  @media (min-width: 768px)  { .geo-content-wrap { padding: 1.25rem 2.5rem; } }
  @media (min-width: 1024px) { .geo-content-wrap { padding: 1.25rem 10rem; } }

  .geo-inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 1200px;
    flex: 1;
  }

  .geo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    white-space: nowrap;
    padding: 1rem 1.5rem;
    background: rgba(10, 36, 20, 0.45);
    backdrop-filter: blur(14px);
    border-radius: 1rem;
    margin-bottom: 2rem;
    border: 1px solid var(--emerald-border);
  }

  .geo-logo { display: flex; align-items: center; gap: 0.75rem; color: #fff; text-decoration: none; }
  .geo-logo-img { width: 2rem; height: 2rem; object-fit: contain; }
  .geo-logo-text  { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.015em; }

  .geo-nav { display: flex; flex: 1; justify-content: flex-end; gap: 2rem; align-items: center; }
  .geo-nav-links { display: none; gap: 2.25rem; align-items: center; }
  @media (min-width: 768px) { .geo-nav-links { display: flex; } }

  .geo-nav-link {
    color: #cbd5e1; text-decoration: none;
    font-size: 0.875rem; font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
    transition: color 0.2s;
  }
  .geo-nav-link:hover { color: var(--primary); }

  .geo-btn-return {
    display: flex; min-width: 84px; cursor: pointer;
    align-items: center; justify-content: center;
    border-radius: 9999px; height: 2.5rem; padding: 0 1.5rem;
    background: rgba(18, 65, 36, 0.5); color: #fff;
    font-size: 0.875rem; font-weight: 700; letter-spacing: 0.015em;
    backdrop-filter: blur(4px); border: 1px solid var(--emerald-border);
    transition: background 0.2s; font-family: 'Space Grotesk', sans-serif;
  }
  .geo-btn-return:hover { background: var(--emerald-border); }

  .geo-main {
    display: flex; flex: 1; flex-direction: column;
    justify-content: center; align-items: center; padding: 2.5rem 0;
  }

  .geo-card-wrap { width: 100%; max-width: 32rem; position: relative; }

  .geo-card-glow {
    position: absolute; inset: -4px;
    background: linear-gradient(135deg, rgba(13,242,89,0.25), rgba(10,36,20,0.5));
    border-radius: 3rem; filter: blur(22px); opacity: 0.6; pointer-events: none;
  }

  .geo-card {
    position: relative; display: flex; flex-direction: column; gap: 2rem;
    background: rgba(6, 20, 11, 0.75); backdrop-filter: blur(28px);
    border: 1px solid rgba(13, 242, 89, 0.22); border-radius: 3rem;
    align-items: center; justify-content: center; padding: 2.5rem;
    box-shadow: 0 25px 50px rgba(13,242,89,0.06), 0 0 0 1px rgba(13,242,89,0.04);
  }
  @media (max-width: 767px) {
    .geo-main { padding: 1rem 0; }
    .geo-card { padding: 1.75rem 1.3rem; gap: 1.2rem; border-radius: 2rem; }
    .geo-card-header { gap: 0.75rem; }
    .geo-icon-wrap { width: 4rem; height: 4rem; margin-bottom: 0.15rem; }
    .geo-title { font-size: 1.65rem; }
    .geo-subtitle { font-size: 0.82rem; line-height: 1.45; }
  }
  @media (min-width: 768px) { .geo-card { padding: 3.5rem; } }

  .geo-card-header { display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center; }

  .geo-icon-wrap {
    width: 5rem; height: 5rem; border-radius: 9999px;
    background: var(--emerald-dark); border: 1px solid rgba(13,242,89,0.3);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 0.5rem; box-shadow: 0 0 30px rgba(13,242,89,0.2);
  }
  .geo-icon-wrap .material-symbols-outlined { font-size: 2.5rem; color: var(--primary); }

  .geo-badge {
    display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px;
    background: rgba(13,242,89,0.1); border: 1px solid rgba(13,242,89,0.2); margin-bottom: 0.5rem;
  }
  .geo-badge-text {
    color: var(--primary); font-family: 'JetBrains Mono', monospace;
    font-size: 0.625rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em;
  }

  .geo-title {
    color: #fff; font-size: 2rem; font-weight: 900;
    line-height: 1.2; letter-spacing: -0.033em; font-family: 'Space Grotesk', sans-serif;
  }
  @media (min-width: 768px) { .geo-title { font-size: 2.25rem; } }

  .geo-subtitle { color: #94a3b8; font-size: 0.875rem; font-weight: 400; line-height: 1.6; max-width: 24rem; }
  @media (min-width: 768px) { .geo-subtitle { font-size: 1rem; } }

  .geo-form { width: 100%; display: flex; flex-direction: column; gap: 1rem; }

  .geo-form-labels { display: flex; justify-content: space-between; padding: 0 0.5rem; }
  .geo-form-label-text {
    color: rgba(13,242,89,0.7); font-family: 'JetBrains Mono', monospace;
    font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.15em;
  }

  .geo-input-wrap { position: relative; display: flex; flex-direction: column; width: 100%; height: 3.5rem; }
  @media (min-width: 768px) { .geo-input-wrap { height: 4rem; } }

  .geo-input-inner {
    display: flex; width: 100%; flex: 1; align-items: stretch;
    border-bottom: 2px solid rgba(13,242,89,0.3);
    background: rgba(10,36,20,0.3); border-radius: 0.5rem 0.5rem 0 0; transition: border-color 0.2s;
  }
  .geo-input-wrap:focus-within .geo-input-inner { border-color: rgba(13,242,89,0.6); }

  .geo-input-icon {
    color: rgba(13,242,89,0.7); display: flex; align-items: center;
    justify-content: center; padding-left: 1rem; padding-right: 0.5rem;
  }
  .geo-input-icon .material-symbols-outlined { font-size: 1.25rem; }

  .geo-input {
    display: flex; width: 100%; flex: 1; background: transparent; border: none;
    outline: none; color: #fff; padding: 0 0.5rem;
    font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; transition: all 0.2s;
  }
  @media (min-width: 768px) { .geo-input { font-size: 1rem; } }
  .geo-input::placeholder { color: rgba(13,242,89,0.4); }

  .geo-input-line {
    position: absolute; bottom: 0; left: 0; height: 2px; width: 0;
    background: var(--primary); box-shadow: 0 0 10px rgba(13,242,89,0.8);
    transition: width 0.3s ease-out;
  }
  .geo-input-wrap:focus-within .geo-input-line { width: 100%; }

  .geo-btn-submit {
    margin-top: 1rem; display: flex; width: 100%; cursor: pointer;
    align-items: center; justify-content: center; border-radius: 9999px;
    height: 3rem; padding: 0 1.25rem; background: var(--primary);
    color: var(--bg-dark); font-size: 1rem; font-weight: 700;
    letter-spacing: 0.02em; text-transform: uppercase;
    font-family: 'Space Grotesk', sans-serif; border: none;
    transition: all 0.2s; box-shadow: 0 0 20px rgba(13,242,89,0.3);
  }
  @media (min-width: 768px) { .geo-btn-submit { height: 3.5rem; } }
  .geo-btn-submit:hover { background: rgba(13,242,89,0.9); transform: scale(1.02); box-shadow: 0 0 30px rgba(13,242,89,0.5); }
  .geo-btn-submit:active { transform: scale(0.95); }
  .geo-btn-submit-inner { display: flex; align-items: center; gap: 0.5rem; }
  .geo-btn-submit .material-symbols-outlined { font-size: 1.25rem; }

  .geo-btn-submit:disabled {
    cursor: not-allowed;
    opacity: 0.72;
    transform: none;
    box-shadow: none;
  }

  .geo-alert {
    border: 1px solid rgba(13,242,89,0.25);
    border-radius: 0.85rem;
    padding: 0.7rem 0.9rem;
    font-size: 0.79rem;
    line-height: 1.45;
    font-family: 'JetBrains Mono', monospace;
  }
  .geo-alert-ok { background: rgba(11,64,33,0.55); color: #86efac; }
  .geo-alert-error { background: rgba(81,22,22,0.45); color: #fecaca; border-color: rgba(248,113,113,0.35); }

  .geo-inline-link {
    border: none;
    background: transparent;
    color: var(--primary);
    cursor: pointer;
    text-decoration: underline;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
  }

  .geo-profile-card {
    border: 1px solid rgba(13,242,89,0.25);
    border-radius: 0.85rem;
    background: rgba(9, 27, 14, 0.5);
    padding: 0.9rem 1rem;
    display: grid;
    gap: 0.55rem;
  }
  .geo-profile-title {
    color: #86efac;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-family: 'JetBrains Mono', monospace;
  }
  .geo-profile-row {
    color: #d1fae5;
    font-size: 0.82rem;
    line-height: 1.4;
    word-break: break-word;
  }

  .geo-divider { width: 100%; border-top: 1px solid rgba(13,242,89,0.2); padding-top: 1.5rem; margin-top: 0.5rem; text-align: center; }
  .geo-help-text { color: #64748b; font-size: 0.75rem; font-family: 'JetBrains Mono', monospace; }
  .geo-help-link { color: var(--primary); text-decoration: none; }
  .geo-help-link:hover { text-decoration: underline; }

  .geo-footer {
    display: flex; flex-direction: column; gap: 1.5rem; padding: 2rem 1.25rem;
    text-align: center; position: relative; z-index: 10;
    border-top: 1px solid rgba(18,65,36,0.5); margin-top: auto;
  }
  .geo-footer-links { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2rem; }
  .geo-footer-link { color: #64748b; text-decoration: none; font-size: 0.875rem; font-family: 'JetBrains Mono', monospace; transition: color 0.2s; }
  .geo-footer-link:hover { color: var(--primary); }
  .geo-footer-copy { color: #475569; font-size: 0.75rem; font-family: 'JetBrains Mono', monospace; line-height: 1.5; opacity: 0.7; }
`;

// ─── Neural Network Canvas ────────────────────────────────────────────────────
function NeuralCanvas() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({ nodes: [], mouse: { x: -9999, y: -9999 } });

  const PRIMARY = "13, 242, 89";
  const NODE_COUNT = 72;
  const MAX_DIST = 160;
  const MOUSE_RADIUS = 120;

  const initNodes = useCallback((w, h) => {
    return Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.5) * 0.42,
      r: Math.random() * 1.8 + 0.8,
      phase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w, h;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      stateRef.current.nodes = initNodes(w, h);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      stateRef.current.mouse = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const onLeave = () => {
      stateRef.current.mouse = { x: -9999, y: -9999 };
    };
    window.addEventListener("mousemove", onMouse);
    canvas.addEventListener("mouseleave", onLeave);

    let tick = 0;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      tick++;
      ctx.clearRect(0, 0, w, h);

      const { nodes, mouse } = stateRef.current;

      // Move nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) {
          n.vx *= -1;
          n.x = Math.max(0, Math.min(w, n.x));
        }
        if (n.y < 0 || n.y > h) {
          n.vy *= -1;
          n.y = Math.max(0, Math.min(h, n.y));
        }
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          const dx = a.x - b.x,
            dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_DIST) continue;

          const mda = Math.hypot(mouse.x - a.x, mouse.y - a.y);
          const mdb = Math.hypot(mouse.x - b.x, mouse.y - b.y);
          const mouseBoost = mda < MOUSE_RADIUS || mdb < MOUSE_RADIUS ? 2.5 : 1;
          const alpha = (1 - dist / MAX_DIST) * 0.25 * mouseBoost;

          // Edge line
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${PRIMARY}, ${alpha})`;
          ctx.lineWidth = mouseBoost > 1 ? 0.85 : 0.45;
          ctx.stroke();

          // Travelling pulse dot
          if (dist < MAX_DIST * 0.9) {
            const pulseT = (tick * 0.007 + a.phase) % 1;
            const px = a.x + (b.x - a.x) * pulseT;
            const py = a.y + (b.y - a.y) * pulseT;
            ctx.beginPath();
            ctx.arc(px, py, 1.3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${PRIMARY}, ${Math.min(1, alpha * 2.2)})`;
            ctx.fill();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const md = Math.hypot(mouse.x - n.x, mouse.y - n.y);
        const hover = md < MOUSE_RADIUS;
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.028 + n.phase);

        // Glow halo
        const grd = ctx.createRadialGradient(
          n.x,
          n.y,
          0,
          n.x,
          n.y,
          hover ? 16 : 9,
        );
        grd.addColorStop(0, `rgba(${PRIMARY}, ${hover ? 0.4 : 0.14 * pulse})`);
        grd.addColorStop(1, `rgba(${PRIMARY}, 0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, hover ? 16 : 9, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(n.x, n.y, hover ? n.r * 2.4 : n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PRIMARY}, ${hover ? 1 : 0.5 + 0.4 * pulse})`;
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [initNodes]);

  return <canvas ref={canvasRef} className="geo-canvas" />;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function GeoHabitaRecovery() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");
  const [paso, setPaso] = useState(1);
  const [focusedField, setFocusedField] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [perfilVerificado, setPerfilVerificado] = useState(null);

  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = styles;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  const postRecovery = async (path, payload) => {
    const res = await fetch(withApiBase(`https://api.geohabita.com${path}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data?.message || "No se pudo completar la solicitud.");
    }

    return data;
  };

  const limpiarMensajes = () => {
    setErrorMsg("");
    setOkMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    limpiarMensajes();
    setLoading(true);

    try {
      if (paso === 1) {
        setPerfilVerificado(null);
        setResetToken("");
        await postRecovery("/api/recovery/request-code/", {
          correo: email.trim(),
        });
        setOkMsg(
          "Te enviamos un código de verificación a tu correo. Revisa tu bandeja de entrada.",
        );
        setPaso(2);
      } else if (paso === 2) {
        const verifyData = await postRecovery("/api/recovery/verify-code/", {
          correo: email.trim(),
          codigo: codigo.trim(),
        });
        setPerfilVerificado({
          usuario: verifyData?.usuario ?? null,
          inmobiliaria: verifyData?.inmobiliaria ?? null,
        });
        setResetToken(verifyData?.reset_token || "");
        setOkMsg("Código verificado. Revisa tus datos y cambia tu contraseña.");
        setPaso(3);
      } else {
        if (!resetToken) {
          throw new Error(
            "Debes verificar tu código antes de cambiar la contraseña.",
          );
        }
        if (nuevaClave.length < 8) {
          throw new Error("La contraseña debe tener al menos 8 caracteres.");
        }
        if (nuevaClave !== confirmarClave) {
          throw new Error("Las contraseñas no coinciden.");
        }

        await postRecovery("/api/recovery/reset-password/", {
          correo: email.trim(),
          reset_token: resetToken,
          password: nuevaClave,
        });
        setOkMsg("Contraseña actualizada. Serás redirigido a iniciar sesión.");
        setTimeout(() => navigate("/login"), 1200);
      }
    } catch (err) {
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const getPasoTitulo = () => {
    if (paso === 1) return "Recupera tu contraseña";
    if (paso === 2) return "Verifica tu código";
    return "Crea tu nueva contraseña";
  };

  const getPasoSubtitulo = () => {
    if (paso === 1)
      return "Ingresa tu correo y te enviaremos un código de recuperación.";
    if (paso === 2)
      return "Escribe el código recibido en tu correo para continuar.";
    return "Define una contraseña nueva y segura para tu cuenta.";
  };

  return (
    <div className="geo-root">
      <NeuralCanvas />
      <div className="geo-bg-overlay" />

      <div className="geo-layout">
        <div className="geo-content-wrap">
          <div className="geo-inner">
            <header className="geo-header">
              <Link className="geo-logo" to="/login">
                <img
                  className="geo-logo-img"
                  src="/habitasinfondo.png"
                  alt="GeoHabita"
                />
                <h2 className="geo-logo-text">GeoHabita</h2>
              </Link>
              <nav className="geo-nav">
                <div className="geo-nav-links">
                  <Link className="geo-nav-link" to="/login">
                    //Inicio
                  </Link>
                  <Link className="geo-nav-link" to="/login">
                    //Mapa
                  </Link>
                </div>
                <button
                  className="geo-btn-return"
                  type="button"
                  onClick={() => navigate("/login")}
                >
                  Iniciar sesión
                </button>
              </nav>
            </header>

            <main className="geo-main">
              <div className="geo-card-wrap">
                <div className="geo-card-glow" />
                <div className="geo-card">
                  <div className="geo-card-header">
                    <div className="geo-icon-wrap">
                      <span className="material-symbols-outlined">vpn_key</span>
                    </div>
                    <div className="geo-badge">
                      <span className="geo-badge-text">
                        Recuperación de acceso
                      </span>
                    </div>
                    <h1 className="geo-title">{getPasoTitulo()}</h1>
                    <p className="geo-subtitle">{getPasoSubtitulo()}</p>
                  </div>

                  <form className="geo-form" onSubmit={handleSubmit}>
                    <div className="geo-form-labels">
                      <span className="geo-form-label-text">
                        Paso {paso} de 3
                      </span>
                      <span className="geo-form-label-text">
                        Estado: {loading ? "Procesando" : "Listo"}
                      </span>
                    </div>

                    {paso === 1 && (
                      <div className="geo-input-wrap">
                        <div className="geo-input-inner">
                          <div className="geo-input-icon">
                            <span className="material-symbols-outlined">
                              mail
                            </span>
                          </div>
                          <input
                            className="geo-input"
                            type="email"
                            placeholder="Ingresa tu correo de usuario"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setFocusedField("email")}
                            onBlur={() => setFocusedField("")}
                            required
                          />
                        </div>
                        <div
                          className="geo-input-line"
                          style={{
                            width:
                              focusedField === "email" || email ? "100%" : "0",
                          }}
                        />
                      </div>
                    )}

                    {paso === 2 && (
                      <div className="geo-input-wrap">
                        <div className="geo-input-inner">
                          <div className="geo-input-icon">
                            <span className="material-symbols-outlined">
                              pin
                            </span>
                          </div>
                          <input
                            className="geo-input"
                            type="text"
                            placeholder="Ingresa el código de 6 dígitos"
                            value={codigo}
                            onChange={(e) =>
                              setCodigo(
                                e.target.value.replace(/\D/g, "").slice(0, 6),
                              )
                            }
                            onFocus={() => setFocusedField("codigo")}
                            onBlur={() => setFocusedField("")}
                            required
                          />
                        </div>
                        <div
                          className="geo-input-line"
                          style={{
                            width:
                              focusedField === "codigo" || codigo
                                ? "100%"
                                : "0",
                          }}
                        />
                      </div>
                    )}

                    {paso === 3 && (
                      <>
                        <div className="geo-profile-card">
                          <div className="geo-profile-title">
                            Datos verificados
                          </div>
                          <div className="geo-profile-row">
                            <strong>Usuario:</strong>{" "}
                            {perfilVerificado?.usuario?.nombre || "Sin nombre"}
                          </div>
                          <div className="geo-profile-row">
                            <strong>Correo:</strong>{" "}
                            {perfilVerificado?.usuario?.correo || email}
                          </div>
                          <div className="geo-profile-row">
                            <strong>Inmobiliaria:</strong>{" "}
                            {perfilVerificado?.inmobiliaria
                              ?.nombreinmobiliaria ||
                              "Sin inmobiliaria asociada"}
                          </div>
                          <div className="geo-profile-row">
                            <strong>Contacto Inmobiliaria:</strong>{" "}
                            {perfilVerificado?.inmobiliaria?.correo ||
                              "No disponible"}
                          </div>
                        </div>
                        <div className="geo-input-wrap">
                          <div className="geo-input-inner">
                            <div className="geo-input-icon">
                              <span className="material-symbols-outlined">
                                lock
                              </span>
                            </div>
                            <input
                              className="geo-input"
                              type="password"
                              placeholder="Nueva contraseña"
                              value={nuevaClave}
                              onChange={(e) => setNuevaClave(e.target.value)}
                              onFocus={() => setFocusedField("nueva")}
                              onBlur={() => setFocusedField("")}
                              required
                            />
                          </div>
                          <div
                            className="geo-input-line"
                            style={{
                              width:
                                focusedField === "nueva" || nuevaClave
                                  ? "100%"
                                  : "0",
                            }}
                          />
                        </div>
                        <div className="geo-input-wrap">
                          <div className="geo-input-inner">
                            <div className="geo-input-icon">
                              <span className="material-symbols-outlined">
                                verified_user
                              </span>
                            </div>
                            <input
                              className="geo-input"
                              type="password"
                              placeholder="Confirma tu contraseña"
                              value={confirmarClave}
                              onChange={(e) =>
                                setConfirmarClave(e.target.value)
                              }
                              onFocus={() => setFocusedField("confirmar")}
                              onBlur={() => setFocusedField("")}
                              required
                            />
                          </div>
                          <div
                            className="geo-input-line"
                            style={{
                              width:
                                focusedField === "confirmar" || confirmarClave
                                  ? "100%"
                                  : "0",
                            }}
                          />
                        </div>
                      </>
                    )}

                    {errorMsg && (
                      <div className="geo-alert geo-alert-error">
                        {errorMsg}
                      </div>
                    )}
                    {okMsg && (
                      <div className="geo-alert geo-alert-ok">{okMsg}</div>
                    )}

                    <button
                      className="geo-btn-submit"
                      type="submit"
                      disabled={loading}
                    >
                      <span className="geo-btn-submit-inner">
                        <span className="material-symbols-outlined">
                          {paso === 1
                            ? "send"
                            : paso === 2
                              ? "verified"
                              : "lock_reset"}
                        </span>
                        {loading
                          ? "Procesando..."
                          : paso === 1
                            ? "Enviar código"
                            : paso === 2
                              ? "Verificar código"
                              : "Restablecer contraseña"}
                      </span>
                    </button>

                    {paso === 2 && (
                      <button
                        type="button"
                        className="geo-inline-link"
                        onClick={() => {
                          setPaso(1);
                          setPerfilVerificado(null);
                          setResetToken("");
                          limpiarMensajes();
                        }}
                      >
                        Cambiar correo
                      </button>
                    )}
                  </form>

                  <div className="geo-divider">
                    <p className="geo-help-text">
                      ¿Necesitas ayuda?{" "}
                      <Link className="geo-help-link" to="/login">
                        Contactar a 916 762 676
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </main>

            <footer className="geo-footer">
              <div className="geo-footer-links">
                <Link className="geo-footer-link" to="/login">
                  Inicio
                </Link>
                <Link className="geo-footer-link" to="/login">
                  Mapa
                </Link>
                <Link className="geo-footer-link" to="/login">
                  Iniciar sesión
                </Link>
              </div>
              <p className="geo-footer-copy">
                GeoHabita // Recuperación segura de contraseña por código
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
