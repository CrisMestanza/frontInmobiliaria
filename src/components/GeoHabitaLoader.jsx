import { useEffect, useRef, useState } from "react";
import logoGH from "/habitasinfondo.png"; // ← cambia esta ruta a tu logo

const LOTES = [
  [6, 3, 84, 54],
  [8, 19, 70, 46],
  [5, 61, 100, 40],
  [6, 78, 58, 50],
  [5, 85, 66, 44],
  [5, 92, 54, 46],
  [66, 2, 78, 54],
  [70, 17, 64, 44],
  [62, 68, 92, 52],
  [68, 80, 66, 48],
  [34, 1, 46, 58],
  [38, 88, 54, 64],
  [20, 57, 58, 42],
  [74, 50, 72, 44],
  [12, 42, 52, 38],
];

const TERM_MESSAGES = [
  "> Escaneando parcelas...",
  "> Cargando coordenadas GPS...",
  "> Verificando lotes...",
  "> Conectando con el servidor...",
  "> Todo listo ✓",
];

const PROGRESS_STEPS = [
  [350, 28, "Escaneando parcelas..."],
  [750, 52, "Cargando coordenadas..."],
  [1250, 74, "Verificando lotes..."],
  [1800, 90, "Conectando servidor..."],
  [2300, 100, "¡Listo!"],
];

/* ── Canvas map drawing ── */
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

function drawMap(canvas) {
  const cx = canvas.getContext("2d");
  const W = canvas.width,
    H = canvas.height;
  cx.fillStyle = "#030d06";
  cx.fillRect(0, 0, W, H);

  const zones = [
    [0.03, 0.04, 0.3, 0.2, "#0a1f0e"],
    [0.35, 0.02, 0.22, 0.24, "#091b0d"],
    [0.6, 0.05, 0.2, 0.17, "#0c2110"],
    [0.82, 0.03, 0.16, 0.22, "#081808"],
    [0.04, 0.27, 0.18, 0.26, "#0b2010"],
    [0.25, 0.3, 0.22, 0.2, "#091c0e"],
    [0.62, 0.25, 0.18, 0.26, "#0a1f0e"],
    [0.82, 0.28, 0.16, 0.2, "#0d2312"],
    [0.04, 0.57, 0.24, 0.22, "#091c0e"],
    [0.32, 0.6, 0.2, 0.2, "#0b2010"],
    [0.55, 0.54, 0.22, 0.24, "#0a1f0e"],
    [0.8, 0.58, 0.17, 0.24, "#091b0d"],
    [0.04, 0.8, 0.28, 0.17, "#0c2110"],
    [0.56, 0.8, 0.22, 0.17, "#091c0e"],
    [0.8, 0.82, 0.17, 0.15, "#0a1f0e"],
  ];
  zones.forEach(([x, y, w, h, c]) => {
    cx.fillStyle = c;
    roundRect(cx, x * W, y * H, w * W, h * H, 3);
    cx.fill();
    cx.strokeStyle = "rgba(56,210,100,0.09)";
    cx.lineWidth = 0.8;
    cx.stroke();
  });

  for (let i = 0; i < 9; i++) {
    cx.beginPath();
    cx.strokeStyle = `rgba(56,210,100,${0.02 + i * 0.005})`;
    cx.lineWidth = 0.6;
    for (let x = 0; x <= W; x += 8) {
      const y =
        (i / 9) * H +
        Math.sin(x / 80 + i * 1.3) * 14 +
        Math.sin(x / 40 + i) * 6;
      x === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
    }
    cx.stroke();
  }

  [
    [0.33, 0, 0.33, 1],
    [0.6, 0, 0.6, 1],
    [0, 0.25, 1, 0.25],
    [0, 0.53, 1, 0.53],
    [0, 0.78, 1, 0.78],
  ].forEach(([x1, y1, x2, y2]) => {
    cx.beginPath();
    cx.strokeStyle = "rgba(56,210,100,0.05)";
    cx.lineWidth = 2.5;
    cx.moveTo(x1 * W, y1 * H);
    cx.lineTo(x2 * W, y2 * H);
    cx.stroke();
  });

  cx.strokeStyle = "rgba(56,210,100,0.055)";
  cx.lineWidth = 0.5;
  for (let x = 52; x < W; x += 52) {
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x, H);
    cx.stroke();
  }
  for (let y = 52; y < H; y += 52) {
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(W, y);
    cx.stroke();
  }

  cx.fillStyle = "rgba(56,210,100,0.07)";
  cx.font = "7px monospace";
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++) {
      cx.fillText(`L${r * 5 + c + 1}`, c * (W / 5) + 4, r * (H / 3) + 12);
    }

  const vg = cx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.15,
    W / 2,
    H / 2,
    H * 0.85,
  );
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "rgba(3,13,6,0.85)");
  cx.fillStyle = vg;
  cx.fillRect(0, 0, W, H);
}

/* ── Component ── */
export default function GeoHabitaLoader({ onFinish, autoHide = true }) {
  const canvasRef = useRef(null);
  const [pct, setPct] = useState(0);
  const [pstat, setPstat] = useState("Iniciando...");
  const [termText, setTermText] = useState("_");
  const [visible, setVisible] = useState(true);

  /* Map canvas */
  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drawMap(canvas);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* Progress bar */
  useEffect(() => {
    const timers = PROGRESS_STEPS.map(([ms, v, s]) =>
      setTimeout(() => {
        setPct(v);
        setPstat(s);
      }, ms),
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!autoHide) return undefined;
    const hide = setTimeout(() => {
      setVisible(false);
      onFinish?.();
    }, 3200);
    return () => clearTimeout(hide);
  }, [autoHide, onFinish]);

  /* Typewriter */
  useEffect(() => {
    let mi = 0,
      ci = 0,
      typing = true,
      tid;
    const step = () => {
      if (mi >= TERM_MESSAGES.length) return;
      const msg = TERM_MESSAGES[mi];
      if (typing) {
        setTermText(msg.slice(0, ci + 1) + "█");
        ci++;
        if (ci >= msg.length) {
          typing = false;
          tid = setTimeout(step, 700);
          return;
        }
      } else {
        mi++;
        ci = 0;
        typing = true;
        if (mi < TERM_MESSAGES.length) setTermText("");
      }
      tid = setTimeout(step, typing ? 55 : 0);
    };
    const init = setTimeout(step, 1900);
    return () => {
      clearTimeout(init);
      clearTimeout(tid);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{styles}</style>
      <div className="gh-loader">
        <canvas ref={canvasRef} className="gh-canvas" />
        <div className="gh-beam" />

        {/* Lotes iluminados */}
        <div className="gh-lw">
          {LOTES.map(([t, l, w, h], i) => (
            <div
              key={i}
              className="gh-lt"
              style={{
                top: `${t}%`,
                left: `${l}%`,
                width: w,
                height: h,
                "--d": `${(0.85 + Math.random() * 0.5).toFixed(2)}s`,
                "--dl": `${(0.08 + i * 0.11).toFixed(2)}s`,
              }}
            />
          ))}
        </div>

        <div className="gh-mid">
          {/* Logo */}
          <div className="gh-lc">
            <div className="gh-ring-rot" />
            <div className="gh-ring-rot2" />
            <div className="gh-rg1" />
            <div className="gh-rg2" />
            <div className="gh-bracket gh-br-tl" />
            <div className="gh-bracket gh-br-tr" />
            <div className="gh-bracket gh-br-bl" />
            <div className="gh-bracket gh-br-br" />
            <img className="gh-logo" src={logoGH} alt="GeoHabita" />
            <div className="gh-shimmer" />
            <div className="gh-pin">📍</div>
          </div>

          {/* Marca */}
          <div className="gh-brand">
            <div className="gh-bname">
              Geo<em>Habita</em>
            </div>
            <div className="gh-btag">Compra &amp; Venta de Terrenos</div>
          </div>

          {/* Terminal */}
          <div className="gh-term">{termText}</div>

          {/* Progreso */}
          <div className="gh-pw">
            <div className="gh-pb">
              <div className="gh-pbf" style={{ width: `${pct}%` }} />
            </div>
            <div className="gh-pfoot">
              <span>{pstat}</span>
              <span>{pct}%</span>
            </div>
          </div>
        </div>

        <div className="gh-coords">
          -6.4847° S · -76.3747° W · San Martín, Perú
        </div>
      </div>
    </>
  );
}

/* ─── Usage in App.jsx ────────────────────────────────────────
import GeoHabitaLoader from './GeoHabitaLoader';

function App() {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <GeoHabitaLoader onFinish={() => setLoaded(true)} />}
      {loaded && <YourWebsite />}
    </>
  );
}
─────────────────────────────────────────────────────────────── */

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');

.gh-loader {
  position: fixed; inset: 0; z-index: 9999;
  background: #030d06;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.gh-loader::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 5;
  background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px);
}
.gh-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

.gh-beam {
  position: absolute; left: 0; right: 0; height: 3px; z-index: 6; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(56,210,100,0.7) 40%, rgba(100,255,150,1) 50%, rgba(56,210,100,0.7) 60%, transparent);
  filter: blur(1px);
  animation: ghBeam 3.5s linear infinite;
}
@keyframes ghBeam {
  0%   { top: -3px; opacity: 0; }
  3%   { opacity: 1; }
  97%  { opacity: 0.7; }
  100% { top: 100%; opacity: 0; }
}

.gh-lw { position: absolute; inset: 0; pointer-events: none; z-index: 7; }
.gh-lt {
  position: absolute; opacity: 0;
  border: 1px solid transparent; background: transparent;
  animation: ghLtOn var(--d, 1s) var(--dl, 0s) ease-out forwards;
}
@keyframes ghLtOn {
  0%   { opacity: 0; background: transparent; border-color: transparent; }
  30%  { opacity: 1; background: rgba(56,210,100,0.25); border-color: rgba(56,210,100,0.9); box-shadow: 0 0 10px rgba(56,210,100,0.4), inset 0 0 8px rgba(56,210,100,0.2); }
  65%  { opacity: 0.7; background: rgba(56,210,100,0.08); border-color: rgba(56,210,100,0.4); }
  100% { opacity: 0.3; background: rgba(56,210,100,0.03); border-color: rgba(56,210,100,0.18); }
}

.gh-mid { position: relative; z-index: 20; display: flex; flex-direction: column; align-items: center; gap: 22px; }

.gh-lc { position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; }

.gh-ring-rot {
  position: absolute; inset: -18px; border-radius: 50%;
  border: 1.5px dashed rgba(56,210,100,0.3);
  animation: ghSpin 12s linear infinite;
}
.gh-ring-rot2 {
  position: absolute; inset: -32px; border-radius: 50%;
  border: 1px dashed rgba(56,210,100,0.15);
  animation: ghSpinR 18s linear infinite;
}
@keyframes ghSpin  { to { transform: rotate(360deg); } }
@keyframes ghSpinR { to { transform: rotate(-360deg); } }

.gh-rg1, .gh-rg2 {
  position: absolute; border-radius: 50%;
  border: 1px solid rgba(56,210,100,0.12);
  animation: ghRPulse 2.6s ease-in-out infinite;
}
.gh-rg1 { inset: -8px; }
.gh-rg2 { inset: -48px; border-color: rgba(56,210,100,0.06); animation-delay: .8s; }
@keyframes ghRPulse {
  0%, 100% { opacity: .4; transform: scale(1); }
  50%      { opacity: 1;  transform: scale(1.05); }
}

.gh-logo {
  width: 118px; height: 118px; object-fit: contain; opacity: 0;
  animation: ghLogoBuild 1.2s .5s cubic-bezier(.34,1.56,.64,1) forwards;
}
@keyframes ghLogoBuild {
  0%   { opacity: 0; transform: scale(0.3) rotate(-20deg); filter: blur(20px) drop-shadow(0 0 0px transparent); }
  40%  { opacity: .8; transform: scale(1.12) rotate(4deg); filter: blur(3px) drop-shadow(0 0 30px rgba(56,210,100,0.8)); }
  65%  { transform: scale(.95) rotate(-1deg); filter: blur(0) drop-shadow(0 0 22px rgba(56,210,100,0.6)); }
  100% { opacity: 1; transform: scale(1) rotate(0); filter: drop-shadow(0 0 16px rgba(56,210,100,0.5)); }
}

.gh-shimmer {
  position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none;
  opacity: 0; animation: ghShimmerFade 1s 1.6s ease forwards;
}
.gh-shimmer::after {
  content: ''; position: absolute; top: -50%; left: -75%; width: 50%; height: 200%;
  background: linear-gradient(105deg, transparent 40%, rgba(180,255,200,0.35) 50%, transparent 60%);
  animation: ghShimmerSlide .7s 1.6s ease forwards;
}
@keyframes ghShimmerFade  { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ghShimmerSlide { 0% { left: -75%; } 100% { left: 125%; } }

.gh-bracket { position: absolute; width: 20px; height: 20px; opacity: 0; animation: ghBracketIn .4s ease forwards; }
.gh-bracket::before, .gh-bracket::after { content: ''; position: absolute; background: #38d264; }
.gh-br-tl { top: -18px; left: -18px; animation-delay: 1.3s; }
.gh-br-tl::before { width: 2px; height: 20px; top: 0; left: 0; }
.gh-br-tl::after  { width: 20px; height: 2px; top: 0; left: 0; }
.gh-br-tr { top: -18px; right: -18px; animation-delay: 1.35s; }
.gh-br-tr::before { width: 2px; height: 20px; top: 0; right: 0; }
.gh-br-tr::after  { width: 20px; height: 2px; top: 0; right: 0; }
.gh-br-bl { bottom: -18px; left: -18px; animation-delay: 1.4s; }
.gh-br-bl::before { width: 2px; height: 20px; bottom: 0; left: 0; }
.gh-br-bl::after  { width: 20px; height: 2px; bottom: 0; left: 0; }
.gh-br-br { bottom: -18px; right: -18px; animation-delay: 1.45s; }
.gh-br-br::before { width: 2px; height: 20px; bottom: 0; right: 0; }
.gh-br-br::after  { width: 20px; height: 2px; bottom: 0; right: 0; }
@keyframes ghBracketIn { 0% { opacity: 0; transform: scale(1.6); } 100% { opacity: 1; transform: scale(1); } }

.gh-pin {
  position: absolute; top: -14px; right: -14px; font-size: 22px; opacity: 0;
  filter: drop-shadow(0 2px 8px rgba(56,210,100,0.8));
  animation: ghPinIn .5s 1.7s cubic-bezier(.34,1.56,.64,1) forwards;
}
@keyframes ghPinIn {
  0%   { opacity: 0; transform: translateY(-30px) scale(0); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.gh-brand { opacity: 0; text-align: center; animation: ghFadeUp .7s 1.5s ease forwards; }
.gh-bname { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; color: #fff; letter-spacing: -1px; }
.gh-bname em { color: #38d264; font-style: normal; }
.gh-btag { font-size: 10px; color: rgba(56,210,100,0.6); letter-spacing: 4px; text-transform: uppercase; margin-top: 4px; }

.gh-term {
  font-family: 'DM Mono', monospace; font-size: 10.5px; height: 16px;
  color: rgba(56,210,100,0.5); letter-spacing: 1px;
  opacity: 0; animation: ghFadeUp .5s 1.75s ease forwards;
}

.gh-pw { width: 210px; opacity: 0; animation: ghFadeUp .5s 1.9s ease forwards; }
.gh-pb { height: 3px; background: rgba(56,210,100,0.1); border-radius: 3px; overflow: hidden; position: relative; }
.gh-pbf { height: 100%; background: linear-gradient(90deg, #1a8040, #38d264, #7fffb0); border-radius: 3px; transition: width .6s cubic-bezier(.4,0,.2,1); }
.gh-pb::after {
  content: ''; position: absolute; top: 0; left: -30%; width: 30%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: ghPbShine 2s 2.1s ease-in-out infinite;
}
@keyframes ghPbShine { 0% { left: -30%; } 100% { left: 130%; } }
.gh-pfoot { display: flex; justify-content: space-between; margin-top: 7px; font-family: 'DM Mono', monospace; font-size: 9.5px; color: rgba(255,255,255,0.2); letter-spacing: 1px; }

.gh-coords {
  position: absolute; bottom: 14px; left: 0; right: 0; text-align: center;
  font-family: 'DM Mono', monospace; font-size: 9px;
  color: rgba(56,210,100,0.22); letter-spacing: 3px;
  opacity: 0; animation: ghFadeUp .5s 2.1s ease forwards;
}

@keyframes ghFadeUp {
  0%   { opacity: 0; transform: translateY(14px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;
