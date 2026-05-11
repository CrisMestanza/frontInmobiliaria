import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";


const logoGH = "/habitasinfondo.png";
gsap.registerPlugin(useGSAP);

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

function drawMapBg(canvas) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";

  const bg = isDark ? "#030d06" : "#f0f9f0";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const zoneColor = isDark ? "#0a1f0e" : "#d4edda";
  const strokeColor = isDark
    ? "rgba(56,210,100,0.09)"
    : "rgba(0,150,60,0.07)";

  const zones = [
    [0.03, 0.04, 0.3, 0.2],
    [0.35, 0.02, 0.22, 0.24],
    [0.6, 0.05, 0.2, 0.17],
    [0.82, 0.03, 0.16, 0.22],
    [0.04, 0.27, 0.18, 0.26],
    [0.25, 0.3, 0.22, 0.2],
    [0.62, 0.25, 0.18, 0.26],
    [0.82, 0.28, 0.16, 0.2],
    [0.04, 0.57, 0.24, 0.22],
    [0.32, 0.6, 0.2, 0.2],
    [0.55, 0.54, 0.22, 0.24],
    [0.8, 0.58, 0.17, 0.24],
    [0.04, 0.8, 0.28, 0.17],
    [0.56, 0.8, 0.22, 0.17],
    [0.8, 0.82, 0.17, 0.15],
  ];

  zones.forEach(([x, y, w, h]) => {
    ctx.fillStyle = zoneColor;
    roundRect(ctx, x * W, y * H, w * W, h * H, 3);
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.strokeStyle = isDark
      ? `rgba(56,210,100,${0.02 + i * 0.005})`
      : `rgba(0,150,60,${0.015 + i * 0.004})`;
    ctx.lineWidth = 0.6;
    for (let x = 0; x <= W; x += 8) {
      const y =
        (i / 9) * H +
        Math.sin(x / 80 + i * 1.3) * 14 +
        Math.sin(x / 40 + i) * 6;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  [
    [0.33, 0, 0.33, 1],
    [0.6, 0, 0.6, 1],
    [0, 0.25, 1, 0.25],
    [0, 0.53, 1, 0.53],
    [0, 0.78, 1, 0.78],
  ].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.strokeStyle = isDark
      ? "rgba(56,210,100,0.05)"
      : "rgba(0,150,60,0.04)";
    ctx.lineWidth = 2.5;
    ctx.moveTo(x1 * W, y1 * H);
    ctx.lineTo(x2 * W, y2 * H);
    ctx.stroke();
  });

  const vg = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.15,
    W / 2,
    H / 2,
    H * 0.85,
  );
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, isDark ? "rgba(3,13,6,0.85)" : "rgba(240,249,240,0.85)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export default function NotFound() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drawMapBg(canvas);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".nf-shell", {
        autoAlpha: 0,
        y: 28,
        duration: 0.75,
      })
        .from(
          ".nf-grid-glow, .nf-code, .nf-title, .nf-subtitle",
          {
            autoAlpha: 0,
            y: 18,
            stagger: 0.08,
            duration: 0.55,
          },
          "-=0.42",
        )
        .from(
          ".nf-route-card",
          {
            autoAlpha: 0,
            scale: 0.9,
            y: 14,
            stagger: 0.1,
            duration: 0.5,
          },
          "-=0.28",
        )
        .from(
          ".nf-btn",
          {
            autoAlpha: 0,
            y: 10,
            stagger: 0.08,
            duration: 0.45,
          },
          "-=0.2",
        );

      gsap.to(".nf-grid-glow", {
        rotate: 360,
        duration: 18,
        repeat: -1,
        ease: "none",
      });
      gsap.to(".nf-route-card", {
        yPercent: -8,
        duration: 2.8,
        ease: "sine.inOut",
        stagger: 0.18,
        repeat: -1,
        yoyo: true,
      });
      gsap.to(".nf-beam", {
        opacity: 0.9,
        scaleX: 1.08,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
    { scope: containerRef },
  );

  return (
    <>
      <style>{notFoundStyles}</style>
      <div ref={containerRef} className="nf-container">
        <canvas ref={canvasRef} className="nf-canvas" />
        <div className="nf-grid-glow" />
        <div className="nf-beam" />
        <div className="nf-noise" />

        <div className="nf-shell">
          <div className="nf-route-card nf-route-card-a">
            <span>Lat 404.00</span>
            <strong>Ruta perdida</strong>
          </div>
          <div className="nf-route-card nf-route-card-b">
            <span>GeoHabita</span>
            <strong>Sin coincidencias</strong>
          </div>

          <div className="nf-content">
          <div className="nf-logo-wrap">
            <div className="nf-ring-outer" />
            <div className="nf-ring-inner" />
            <img src={logoGH} alt="GeoHabita" className="nf-logo" />
            <div className="nf-shimmer" />
          </div>

          <div className="nf-code">404</div>
          <h1 className="nf-title">Página no encontrada</h1>
          <p className="nf-subtitle">
            El lote o proyecto que buscas no existe, fue movido o la URL es
            incorrecta.
          </p>

          <div className="nf-actions">
            <Link to="/" className="nf-btn nf-btn-primary">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
              >
                <path d="M12 22s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              Ir al Mapa
            </Link>
            <Link to="/inicio" className="nf-btn nf-btn-secondary">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
              >
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V20h14V9.5" />
                <path d="M10 20v-6h4v6" />
              </svg>
              Ir a Inicio
            </Link>
          </div>

          <div className="nf-coords">
            — GeoHabita · Compra &amp; Venta de Terrenos —
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

const notFoundStyles = `
.nf-container {
  position: fixed;
  inset: 0;
  background: var(--theme-bg-main, #030d06);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 9990;
}

.nf-shell {
  position: relative;
  z-index: 20;
  width: min(92vw, 760px);
  min-height: 560px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nf-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.nf-grid-glow {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(56,210,100,0.18), transparent 55%),
    repeating-linear-gradient(
      0deg,
      rgba(127,255,176,0.08) 0,
      rgba(127,255,176,0.08) 1px,
      transparent 1px,
      transparent 22px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(127,255,176,0.08) 0,
      rgba(127,255,176,0.08) 1px,
      transparent 1px,
      transparent 22px
    );
  opacity: 0.72;
  filter: blur(0.4px);
}

.nf-noise {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(rgba(255,255,255,0.06) 0.7px, transparent 0.7px);
  background-size: 18px 18px;
  opacity: 0.18;
  pointer-events: none;
}

.nf-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 6;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(56,210,100,0.5) 40%, rgba(100,255,150,0.8) 50%, rgba(56,210,100,0.5) 60%, transparent);
  filter: blur(1px);
  animation: nfBeam 4s linear infinite;
}

@keyframes nfBeam {
  0%   { top: -3px; opacity: 0; }
  3%   { opacity: 0.7; }
  97%  { opacity: 0.4; }
  100% { top: 100%; opacity: 0; }
}

.nf-content {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: min(100%, 560px);
  padding: 38px 28px 64px;
  border-radius: 30px;
  border: 1px solid rgba(56,210,100,0.16);
  background:
    linear-gradient(180deg, rgba(7,18,10,0.9), rgba(4,10,6,0.84));
  box-shadow:
    0 24px 70px rgba(0,0,0,0.46),
    inset 0 1px 0 rgba(255,255,255,0.06);
  backdrop-filter: blur(16px);
}

.nf-route-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 144px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(127,255,176,0.18);
  background: rgba(6,16,9,0.78);
  box-shadow: 0 18px 40px rgba(0,0,0,0.28);
  backdrop-filter: blur(12px);
}

.nf-route-card span {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(127,255,176,0.5);
}

.nf-route-card strong {
  font-size: 15px;
  color: rgba(255,255,255,0.9);
}

.nf-route-card-a {
  top: 36px;
  left: -12px;
}

.nf-route-card-b {
  right: -16px;
  bottom: 84px;
}

.nf-logo-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.nf-ring-outer {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  border: 1.5px dashed rgba(56,210,100,0.2);
  animation: nfSpin 14s linear infinite;
}

.nf-ring-inner {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px solid rgba(56,210,100,0.12);
  animation: nfPulse 2.8s ease-in-out infinite;
}

@keyframes nfSpin {
  to { transform: rotate(360deg); }
}

@keyframes nfPulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%      { opacity: 0.8; transform: scale(1.06); }
}

.nf-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 0 18px rgba(56,210,100,0.45));
  animation: nfLogoIn 1s 0.3s cubic-bezier(.34,1.56,.64,1) forwards;
  opacity: 0;
  transform: scale(0.5);
}

@keyframes nfLogoIn {
  0%   { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}

.nf-shimmer {
  position: absolute;
  inset: -16px;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  animation: nfShimmerFade 1s 1.2s ease forwards;
}

.nf-shimmer::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -75%;
  width: 50%;
  height: 200%;
  background: linear-gradient(105deg, transparent 40%, rgba(180,255,200,0.3) 50%, transparent 60%);
  animation: nfShimmerSlide 0.8s 1.2s ease forwards;
}

@keyframes nfShimmerFade {
  0% { opacity: 0; }
  20% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes nfShimmerSlide {
  0% { left: -75%; }
  100% { left: 125%; }
}

.nf-code {
  font-family: 'DM Mono', 'Courier New', monospace;
  font-size: 72px;
  font-weight: 700;
  color: transparent;
  background: linear-gradient(135deg, #1a8040, #38d264, #7fffb0);
  -webkit-background-clip: text;
  background-clip: text;
  line-height: 1;
  letter-spacing: -2px;
  animation: nfCodeIn 0.8s 0.5s cubic-bezier(.34,1.56,.64,1) forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes nfCodeIn {
  0%   { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

.nf-title {
  font-family: 'Syne', 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--theme-text-main, #fff);
  margin: 0;
  letter-spacing: -0.5px;
}

.nf-subtitle {
  font-size: 13px;
  color: var(--theme-text-muted, rgba(255,255,255,0.45));
  margin: 0;
  max-width: 380px;
  text-align: center;
  line-height: 1.6;
}

.nf-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.nf-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.25s ease;
  border: 1px solid transparent;
}

.nf-btn-primary {
  background: linear-gradient(135deg, #106e2e, #1a8040);
  color: #fff;
  border-color: rgba(56,210,100,0.4);
  box-shadow: 0 4px 20px rgba(0,201,95,0.2);
}

.nf-btn-primary:hover {
  background: linear-gradient(135deg, #15803d, #22c55e);
  box-shadow: 0 6px 28px rgba(0,201,95,0.35);
  transform: translateY(-1px);
}

.nf-btn-secondary {
  background: transparent;
  color: var(--theme-text-main, #e5e7eb);
  border-color: var(--theme-border-color, rgba(56,210,100,0.2));
}

.nf-btn-secondary:hover {
  border-color: rgba(56,210,100,0.4);
  background: rgba(56,210,100,0.05);
}

.nf-coords {
  position: absolute;
  bottom: 22px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: var(--theme-text-muted, rgba(56,210,100,0.15));
  letter-spacing: 2px;
}

@media (max-width: 768px) {
  .nf-shell {
    min-height: 100vh;
  }
  .nf-content {
    padding: 28px 20px 58px;
    border-radius: 26px;
  }
  .nf-route-card {
    display: none;
  }
  .nf-code {
    font-size: 56px;
  }
  .nf-title {
    font-size: 20px;
  }
  .nf-logo-wrap {
    width: 96px;
    height: 96px;
  }
  .nf-logo {
    width: 80px;
    height: 80px;
  }
}
`;
