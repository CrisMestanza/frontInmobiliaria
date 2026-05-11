import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateAmortizationSchedule, formatMoney } from "./utils/financing";

/* ─── Layout constants ─── */
const PAD = { top: 28, right: 22, bottom: 38, left: 62 };
const MIN_H = 220;

/* ─── Theme helpers ─── */
const readIsDark = () =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "dark";

const themeColors = (dark) => ({
  bg: dark ? "rgba(15,23,42,0.00)" : "rgba(255,255,255,0.00)",
  grid: dark ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.18)",
  text: dark ? "rgba(226,232,240,0.58)" : "rgba(51,65,85,0.58)",
  textBold: dark ? "rgba(248,250,252,0.92)" : "rgba(15,23,42,0.9)",
  balanceLine: "#22c55e",
  balanceFill: dark ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.18)",
  interestLine: "#f59e0b",
  interestFill: dark ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.16)",
  capitalFill: dark ? "#22c55e" : "#15803d",
  principalLine: dark ? "rgba(148,163,184,0.4)" : "rgba(71,85,105,0.32)",
  totalPaidLine: dark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.13)",
  dot: "#22c55e",
  dotInner: "#ffffff",
  tooltipBg: dark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.97)",
  tooltipBorder: dark ? "rgba(56,210,100,0.25)" : "rgba(0,201,95,0.20)",
  brandBadge: dark ? "rgba(34,197,94,0.16)" : "rgba(15,118,110,0.08)",
  brandBadgeText: dark ? "rgba(134,239,172,0.88)" : "rgba(15,118,110,0.78)",
});

/* ─── Drawing helpers ─── */
const round = (v, d = 0) => Number(v.toFixed(d));

const drawGrid = (ctx, cw, ch, maxVal, cols) => {
  const lines = 5;
  ctx.strokeStyle = cols.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (let i = 0; i <= lines; i++) {
    const y = PAD.top + (ch / lines) * i;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cw, y);
    ctx.stroke();
    ctx.fillStyle = cols.text;
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    const val = maxVal - (maxVal / lines) * i;
    ctx.fillText(val >= 1000 ? `${round(val / 1000, 0)}k` : Math.round(val), PAD.left - 8, y + 3);
  }
};

const drawArea = (ctx, points, baselineY, cw, ch, maxVal, totalPoints, color) => {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(PAD.left, baselineY);
  points.forEach((s, i) => {
    const x = PAD.left + (i / Math.max(totalPoints - 1, 1)) * cw;
    const y = PAD.top + ch - (s.balance / maxVal) * ch;
    ctx.lineTo(x, y);
  });
  const lastX = PAD.left + ((points.length - 1) / Math.max(totalPoints - 1, 1)) * cw;
  ctx.lineTo(lastX, baselineY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

const drawLine = (ctx, points, cw, ch, maxVal, totalPoints, color, width = 2.5) => {
  if (!points.length) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  points.forEach((s, i) => {
    const x = PAD.left + (i / Math.max(totalPoints - 1, 1)) * cw;
    const y = PAD.top + ch - (s.balance / maxVal) * ch;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
};

const drawDashedHLine = (ctx, y, cw, color, dash = [6, 4]) => {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash(dash);
  ctx.moveTo(PAD.left, y);
  ctx.lineTo(PAD.left + cw, y);
  ctx.stroke();
  ctx.setLineDash([]);
};

const drawDot = (ctx, x, y, color, inner = "#fff", r = 4.5) => {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = inner;
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
};

/* ══════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function AmortizationChart({
  principal,
  annualRate,
  months,
  currency = "S/",
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [chartMode, setChartMode] = useState("balance");
  const animFrameRef = useRef(null);
  const drawRef = useRef(null);           // stable draw function
  const themeRef = useRef(readIsDark());   // avoids triggering re-renders

  /* ── Derive data ── */
  const safePrincipal = Math.max(Number(principal) || 0, 0);
  const safeMonths = Math.max(1, Math.round(Number(months) || 1));
  const safeRate = Math.max(0, Number(annualRate) || 0);

  const schedule = useMemo(
    () => generateAmortizationSchedule(safePrincipal, safeRate, safeMonths),
    [safePrincipal, safeRate, safeMonths],
  );

  const maxVal = useMemo(() => {
    if (!schedule.length) return 1;
    if (chartMode === "balance") return Math.max(safePrincipal, 1);
    return Math.max(...schedule.map((s) => s.payment), 1);
  }, [schedule, chartMode, safePrincipal]);

  /* ── Stable draw function (stored in ref) ── */
  const buildDrawFn = useCallback(() => {
    const dark = themeRef.current;
    const cols = themeColors(dark);

    return (progress = 1) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = Math.max(MIN_H, rect.height || MIN_H);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const cw = w - PAD.left - PAD.right;
      const ch = h - PAD.top - PAD.bottom;
      ctx.clearRect(0, 0, w, h);

      if (!schedule.length) {
        ctx.fillStyle = cols.text;
        ctx.font = "13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Sin datos para mostrar", w / 2, h / 2);
        return;
      }

      const total = schedule.length;
      const sliceCount = Math.round(total * progress);
      const pts = schedule.slice(0, Math.max(1, sliceCount));

      /* Grid */
      drawGrid(ctx, cw, ch, maxVal, cols);

      ctx.save();
      ctx.strokeStyle = dark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(PAD.left, PAD.top, cw, ch);
      ctx.restore();

      if (chartMode === "balance") {
        /* ═══ BALANCE MODE ═══ */
        /* 1. Principal reference line (top) */
        const principalY = PAD.top + ch - (safePrincipal / maxVal) * ch;
        drawDashedHLine(ctx, principalY, cw, cols.principalLine, [4, 4]);

        /* 2. Interest accumulation area */
        const interestPts = pts.map((s, i) => {
          const cumInterest = schedule.slice(0, i + 1).reduce((a, b) => a + b.interest, 0);
          return { ...s, balance: Math.min(cumInterest, maxVal) };
        });
        drawArea(ctx, interestPts, PAD.top + ch, cw, ch, maxVal, total, cols.interestFill);
        drawLine(ctx, interestPts, cw, ch, maxVal, total, cols.interestLine, 1.8);

        /* 3. Balance area + line */
        drawArea(ctx, pts, PAD.top + ch, cw, ch, maxVal, total, cols.balanceFill);
        drawLine(ctx, pts, cw, ch, maxVal, total, cols.balanceLine, 2.8);

        /* 4. End dot */
        if (pts.length > 0 && progress >= 0.95) {
          const last = pts[pts.length - 1];
          const lx = PAD.left + ((pts.length - 1) / Math.max(total - 1, 1)) * cw;
          const ly = PAD.top + ch - (last.balance / maxVal) * ch;
          drawDot(ctx, lx, ly, cols.dot, cols.dotInner);
        }

        /* 5. Start dot */
        if (pts.length > 0) {
          const first = pts[0];
          const fx = PAD.left;
          const fy = PAD.top + ch - (first.balance / maxVal) * ch;
          drawDot(ctx, fx, fy, cols.dot, cols.dotInner, 3.5);
        }

        /* 6. Halfway marker */
        const midIdx = Math.floor(total / 2);
        if (midIdx < pts.length && progress > 0.45) {
          const ms = pts[midIdx];
          const mx = PAD.left + (midIdx / Math.max(total - 1, 1)) * cw;
          const my = PAD.top + ch - (ms.balance / maxVal) * ch;
          ctx.beginPath();
          ctx.fillStyle = cols.textBold;
          ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        /* ═══ BAR MODE ═══ */
        const maxBars = Math.min(pts.length, 48);
        const step = Math.max(1, Math.floor(pts.length / maxBars));
        const barW = Math.max(2, (cw / maxBars) * 0.72);
        for (let i = 0; i < maxBars; i++) {
          const idx = i * step;
          if (idx >= pts.length) break;
          const s = pts[idx];
          const bx = PAD.left + (idx / Math.max(total - 1, 1)) * cw - barW / 2;
          const capH = (s.capital / maxVal) * ch;
          const intH = (s.interest / maxVal) * ch;
          ctx.fillStyle = cols.capitalFill;
          ctx.fillRect(bx, PAD.top + ch - capH, barW, capH);
          ctx.fillStyle = cols.interestLine;
          ctx.fillRect(bx, PAD.top + ch - capH - intH, barW, intH);
        }
      }

      /* ═══ X axis ═══ */
      ctx.fillStyle = cols.text;
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "center";
      const xSteps = 6;
      for (let i = 0; i <= xSteps; i++) {
        const month = Math.max(1, Math.round((i / xSteps) * total));
        const x = PAD.left + (i / xSteps) * cw;
        ctx.fillText(`${month}m`, x, h - 5);
      }

      /* ═══ Title ═══ */
      ctx.fillStyle = cols.textBold;
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "left";
      const titleText = chartMode === "balance"
        ? "Trayectoria del saldo · GeoHabita Amortizador"
        : "Capital vs. interés mensual · GeoHabita Amortizador";
      ctx.fillText(titleText, PAD.left, 14);

      /* ═══ GeoHabita watermark brand badge (bottom-right) ═══ */
      const badgeW = 106;
      const badgeH = 22;
      const badgeX = w - PAD.right - badgeW;
      const badgeY = h - badgeH - 5;
      ctx.fillStyle = cols.brandBadge;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fill();
      ctx.fillStyle = cols.brandBadgeText;
      ctx.font = "600 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GeoHabita · Amortiza", badgeX + badgeW / 2, badgeY + 15);
    };
  }, [schedule, chartMode, maxVal]);

  /* Keep drawRef current without triggering effects */
  drawRef.current = buildDrawFn();

  /* ── Theme observer (no re-renders) ── */
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      const dark = readIsDark();
      if (dark !== themeRef.current) {
        themeRef.current = dark;
        drawRef.current?.(1);
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  /* ── Resize observer ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawRef.current?.(1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  /* ── Animate once on data change ── */
  useEffect(() => {
    let start = null;
    let done = false;
    const duration = 700;

    const animate = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      drawRef.current?.(eased);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        done = true;
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [schedule, chartMode]);

  /* ── Mouse tooltip ── */
  const handleMouseMove = useCallback(
    (e) => {
      const container = containerRef.current;
      if (!container || !schedule.length) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cw = rect.width - PAD.left - PAD.right;
      const ch = rect.height - PAD.top - PAD.bottom;
      if (x < PAD.left || x > PAD.left + cw || y < PAD.top || y > PAD.top + ch) {
        setTooltip(null);
        return;
      }
      const ratio = (x - PAD.left) / cw;
      const idx = Math.round(ratio * (schedule.length - 1));
      const s = schedule[Math.max(0, Math.min(schedule.length - 1, idx))];
      if (!s) { setTooltip(null); return; }
      const tx = PAD.left + (idx / Math.max(schedule.length - 1, 1)) * cw;
      setTooltip({
        x: Math.min(Math.max(tx, 90), rect.width - 90),
        y: Math.max(PAD.top, y - 80),
        data: s,
      });
    },
    [schedule],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  /* ── Empty state ── */
  if (!safePrincipal || !safeMonths) {
    return (
      <div className="amortization-empty">
        <p>Ajusta la inicial y el plazo para visualizar la amortización.</p>
      </div>
    );
  }

  const lastData = schedule[schedule.length - 1];
  const totalIntereses = schedule.reduce((a, s) => a + s.interest, 0);
  const totalPagado = schedule.reduce((a, s) => a + s.payment, 0);
  const firstInterest = schedule[0]?.interest || 0;
  const lastInterest = schedule[schedule.length - 1]?.interest || 0;
  const capitalHalfMonth =
    schedule.find((item) => item.balance <= safePrincipal * 0.5)?.month ||
    safeMonths;
  const capitalDominantMonth =
    schedule.find((item) => item.capital >= item.interest)?.month || 1;
  const milestones = [
    {
      label: "Capital supera al interés",
      value: `Mes ${capitalDominantMonth}`,
      tone: "green",
    },
    {
      label: "Saldo baja a la mitad",
      value: `Mes ${capitalHalfMonth}`,
      tone: "amber",
    },
    {
      label: "Crédito liquidado",
      value: `Mes ${lastData?.month || safeMonths}`,
      tone: "slate",
    },
  ];

  return (
    <div className="amortization-wrapper">
      <div className="amortization-hero">
        <div className="amortization-hero-copy">
          <span className="amortization-kicker">GeoHabita presenta</span>
          <h4 className="amortization-title">GeoHabita Amortizador</h4>
          <p className="amortization-subtitle">
            Explora cómo cae el saldo y cómo cada cuota se divide entre capital e interés.
          </p>
        </div>
        <div className="amortization-hero-badge">
          <span>Financiamiento</span>
          <strong>{safeMonths} meses</strong>
        </div>
      </div>

      <div className="amortization-header">
        <div className="amortization-header-top">
          <div className="amortization-mode-tabs">
            <button
              type="button"
              className={`amortization-mode-btn${chartMode === "balance" ? " active" : ""}`}
              onClick={() => setChartMode("balance")}
            >
              Saldo
            </button>
            <button
              type="button"
              className={`amortization-mode-btn${chartMode === "bars" ? " active" : ""}`}
              onClick={() => setChartMode("bars")}
            >
              Desglose
            </button>
          </div>
          <div className="amortization-header-inline-meta">
            <span>{safeRate}% anual</span>
            <span>{safeMonths} meses</span>
          </div>
        </div>
        <div className="amortization-summary">
          <div className="amortization-summary-item">
            <span className="amortization-summary-label">Cuota mensual</span>
            <strong className="amortization-summary-value amortization-value-green">
              {formatMoney(lastData?.payment || 0, currency)}
            </strong>
          </div>
          <div className="amortization-summary-item">
            <span className="amortization-summary-label">Total intereses</span>
            <strong className="amortization-summary-value amortization-value-amber">
              {formatMoney(totalIntereses, currency)}
            </strong>
          </div>
          <div className="amortization-summary-item">
            <span className="amortization-summary-label">Total pagado</span>
            <strong className="amortization-summary-value">
              {formatMoney(totalPagado, currency)}
            </strong>
          </div>
        </div>
      </div>

      <div className="amortization-insight-row">
        <div className="amortization-insight-pill">
          <span>Interés inicial</span>
          <strong>{formatMoney(firstInterest, currency)}</strong>
        </div>
        <div className="amortization-insight-pill">
          <span>Interés final</span>
          <strong>{formatMoney(lastInterest, currency)}</strong>
        </div>
        <div className="amortization-insight-pill">
          <span>Estructura</span>
          <strong>{safeMonths} meses</strong>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="amortization-chart-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ position: "relative", width: "100%", height: 232 }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        {tooltip && (
          <div
            className="amortization-tooltip"
            style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
          >
            <div className="amortization-tooltip-header">Mes {tooltip.data.month}</div>
            <div className="amortization-tooltip-row"><span>Cuota</span><strong>{formatMoney(tooltip.data.payment, currency)}</strong></div>
            <div className="amortization-tooltip-row amortization-tooltip-interest"><span>Interés</span><strong>{formatMoney(tooltip.data.interest, currency)}</strong></div>
            <div className="amortization-tooltip-row amortization-tooltip-capital"><span>Capital</span><strong>{formatMoney(tooltip.data.capital, currency)}</strong></div>
            <div className="amortization-tooltip-row"><span>Saldo</span><strong>{formatMoney(tooltip.data.balance, currency)}</strong></div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="amortization-legend">
        <div className="amortization-legend-item">
          <span className="amortization-legend-dot" style={{ background: "#106e2e" }} />Capital
        </div>
        <div className="amortization-legend-item">
          <span className="amortization-legend-dot" style={{ background: "#f59e0b" }} />Interés
        </div>
        <div className="amortization-legend-item">
          <span className="amortization-legend-dot" style={{ background: "#22c55e" }} />Saldo
        </div>
      </div>

      <div className="amortization-milestones">
        {milestones.map((milestone) => (
          <div
            key={milestone.label}
            className={`amortization-milestone amortization-milestone-${milestone.tone}`}
          >
            <span>{milestone.label}</span>
            <strong>{milestone.value}</strong>
          </div>
        ))}
      </div>

      <style>{amortizationStyles}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════════════ */
const amortizationStyles = `
.amortization-wrapper {
  margin-top: 20px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 0% 0%, rgba(34,197,94,0.2), transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(20,184,166,0.16), transparent 30%),
    linear-gradient(180deg, rgba(15,23,42,0.84), rgba(2,6,23,0.92));
  border: 1px solid color-mix(in srgb, var(--theme-border-color, rgba(56,210,100,0.14)) 72%, rgba(34,197,94,0.32));
  padding: 14px 14px 12px;
  overflow: hidden;
  box-shadow:
    0 24px 44px rgba(2,6,23,0.34),
    inset 0 1px 0 rgba(255,255,255,0.06);
  position: relative;
}
.amortization-wrapper::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.06), transparent 28%),
    linear-gradient(180deg, transparent 62%, rgba(255,255,255,0.03));
  pointer-events: none;
}
.amortization-hero {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.amortization-hero-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.amortization-kicker {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 800;
  color: rgba(134,239,172,0.84);
}
.amortization-title {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.15;
  color: #f8fafc;
}
.amortization-subtitle {
  margin: 0;
  max-width: 48ch;
  font-size: 11px;
  line-height: 1.35;
  color: rgba(226,232,240,0.68);
}
.amortization-hero-badge {
  display: grid;
  gap: 2px;
  min-width: 84px;
  padding: 8px 10px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(34,197,94,0.18), rgba(20,184,166,0.12));
  border: 1px solid rgba(134,239,172,0.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}
.amortization-hero-badge span {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(226,232,240,0.56);
}
.amortization-hero-badge strong {
  font-size: 14px;
  color: #f8fafc;
}
.amortization-header {
  position: relative;
  z-index: 1;
  display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px;
}
.amortization-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.amortization-mode-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.amortization-header-inline-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.amortization-header-inline-meta span {
  font-size: 10px;
  font-weight: 700;
  color: rgba(226,232,240,0.62);
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}
.amortization-mode-btn {
  border: 1px solid rgba(134,239,172,0.16);
  background: rgba(255,255,255,0.03);
  color: rgba(226,232,240,0.66);
  font-size: 10px; font-weight: 700;
  padding: 6px 11px; border-radius: 999px;
  cursor: pointer; transition: all 0.25s ease;
  backdrop-filter: blur(10px);
}
.amortization-mode-btn.active {
  background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(20,184,166,0.12));
  border-color: rgba(74,222,128,0.42);
  color: #bbf7d0;
  box-shadow: 0 10px 20px -16px rgba(34,197,94,0.8);
}
.amortization-mode-btn:hover:not(.active) {
  border-color: rgba(134,239,172,0.34); color: rgba(255,255,255,0.9);
}
.amortization-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.amortization-summary-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 9px 10px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.07);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.amortization-summary-label {
  font-size: 9px; color: rgba(226,232,240,0.56);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.amortization-summary-value { font-size: 13px; font-weight: 800; color: #f8fafc; }
.amortization-value-green { color: #38d264; }
.amortization-value-amber { color: #f59e0b; }
.amortization-insight-row {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}
.amortization-insight-pill {
  border-radius: 14px;
  padding: 9px 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
  border: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.amortization-insight-pill span {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(226,232,240,0.58);
}
.amortization-insight-pill strong {
  font-size: 12px;
  font-weight: 800;
  color: #f8fafc;
}
.amortization-chart-container {
  position: relative;
  z-index: 1;
  border-radius: 18px;
  cursor: crosshair;
  background:
    radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 52%),
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025));
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.04),
    0 20px 30px -28px rgba(15,23,42,0.9);
}
.amortization-tooltip {
  position: absolute; pointer-events: none;
  background: rgba(15,23,42,0.96);
  border: 1px solid rgba(56,210,100,0.25);
  border-radius: 10px; padding: 8px 10px;
  min-width: 150px; backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 10;
}
.amortization-tooltip-header { font-size: 11px; font-weight: 700; color: #38d264; margin-bottom: 6px; letter-spacing: 0.5px; }
.amortization-tooltip-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; color: rgba(255,255,255,0.65); margin-bottom: 2px; gap: 10px;
}
.amortization-tooltip-row strong { font-weight: 600; color: rgba(255,255,255,0.9); font-size: 11px; }
.amortization-tooltip-interest strong { color: #f59e0b; }
.amortization-tooltip-capital strong { color: #106e2e; }
.amortization-legend {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.amortization-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  font-weight: 700;
  color: rgba(226,232,240,0.62);
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}
.amortization-legend-dot { width: 9px; height: 9px; border-radius: 999px; display: inline-block; }
.amortization-milestones {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.amortization-milestone {
  border-radius: 14px;
  padding: 9px 10px;
  border: 1px solid rgba(255,255,255,0.07);
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.amortization-milestone span { font-size: 9px; color: rgba(226,232,240,0.56); }
.amortization-milestone strong { font-size: 12px; color: #f8fafc; }
.amortization-milestone-green strong { color: #38d264; }
.amortization-milestone-amber strong { color: #f59e0b; }
.amortization-milestone-slate strong { color: #cbd5e1; }
.amortization-empty {
  padding: 30px 16px;
  text-align: center;
  color: rgba(226,232,240,0.45);
  font-size: 13px;
}

[data-theme="light"] .amortization-wrapper {
  background:
    radial-gradient(circle at 0% 0%, rgba(34,197,94,0.12), transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(56,189,248,0.1), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,245,249,0.97));
  border-color: rgba(15,23,42,0.08);
  box-shadow:
    0 22px 40px rgba(15,23,42,0.09),
    inset 0 1px 0 rgba(255,255,255,0.6);
}
[data-theme="light"] .amortization-wrapper::before {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.72), transparent 30%),
    linear-gradient(180deg, transparent 68%, rgba(255,255,255,0.45));
}
[data-theme="light"] .amortization-kicker {
  color: #0d7a3e;
}
[data-theme="light"] .amortization-title {
  color: #0f172a;
}
[data-theme="light"] .amortization-subtitle {
  color: rgba(51,65,85,0.72);
}
[data-theme="light"] .amortization-hero-badge {
  background: linear-gradient(135deg, rgba(16,185,129,0.14), rgba(59,130,246,0.08));
  border-color: rgba(16,185,129,0.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
}
[data-theme="light"] .amortization-hero-badge span {
  color: rgba(15,23,42,0.48);
}
[data-theme="light"] .amortization-hero-badge strong {
  color: #0f172a;
}
[data-theme="light"] .amortization-mode-btn {
  color: rgba(15,23,42,0.62);
  border-color: rgba(15,23,42,0.1);
  background: rgba(255,255,255,0.72);
}
[data-theme="light"] .amortization-mode-btn.active {
  background: linear-gradient(135deg, rgba(16,185,129,0.14), rgba(14,165,233,0.08));
  border-color: rgba(0,201,95,0.24);
  color: #0d7a3e;
}
[data-theme="light"] .amortization-summary-item,
[data-theme="light"] .amortization-insight-pill,
[data-theme="light"] .amortization-chart-container,
[data-theme="light"] .amortization-legend-item,
[data-theme="light"] .amortization-milestone {
  background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(248,250,252,0.94));
  border-color: rgba(15,23,42,0.07);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.76);
}
[data-theme="light"] .amortization-summary-label { color: rgba(51,65,85,0.58); }
[data-theme="light"] .amortization-summary-value { color: #1f2937; }
[data-theme="light"] .amortization-insight-pill span { color: rgba(51,65,85,0.56); }
[data-theme="light"] .amortization-insight-pill strong { color: #0f172a; }
[data-theme="light"] .amortization-chart-container {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    0 18px 28px -24px rgba(15,23,42,0.28);
}
[data-theme="light"] .amortization-tooltip { background: rgba(255,255,255,0.97); border-color: rgba(0,201,95,0.25); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
[data-theme="light"] .amortization-tooltip-row { color: rgba(0,0,0,0.6); }
[data-theme="light"] .amortization-tooltip-row strong { color: rgba(0,0,0,0.85); }
[data-theme="light"] .amortization-tooltip-header { color: #0d7a3e; }
[data-theme="light"] .amortization-legend-item { color: rgba(51,65,85,0.68); }
[data-theme="light"] .amortization-milestone span { color: rgba(51,65,85,0.58); }
[data-theme="light"] .amortization-milestone strong { color: #0f172a; }
[data-theme="light"] .amortization-empty { color: rgba(0,0,0,0.4); }

@media (max-width: 640px) {
  .amortization-wrapper {
    border-radius: 20px;
    padding: 12px 12px 11px;
  }
  .amortization-hero {
    flex-direction: column;
  }
  .amortization-subtitle {
    display: none;
  }
  .amortization-hero-badge {
    width: 100%;
    min-width: 0;
  }
  .amortization-header-top {
    align-items: stretch;
  }
  .amortization-header-inline-meta {
    width: 100%;
  }
  .amortization-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .amortization-summary-item { min-width: 0; }
  .amortization-insight-row { grid-template-columns: 1fr; }
  .amortization-milestones { grid-template-columns: 1fr; }
}
`;
