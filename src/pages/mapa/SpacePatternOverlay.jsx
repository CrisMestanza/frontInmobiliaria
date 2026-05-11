import React, { useMemo } from "react";
import { Marker } from "@react-google-maps/api";

const clamp = (value, min, max) =>
  Math.min(Math.max(Number(value) || 0, min), max);

const svgToDataUrl = (svg) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const hexToRgb = (hex) => {
  const raw = String(hex || "")
    .trim()
    .replace("#", "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : raw.slice(0, 6);

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { r: 34, g: 197, b: 94 };
  }

  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgba = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getSpacePatternKind = (espacio) => {
  const kind = String(
    espacio?.tipoespacio?.slug || espacio?.tipoespacio?.nombre || "",
  )
    .toLowerCase()
    .trim();

  if (
    kind.includes("parque") ||
    kind.includes("area-verde") ||
    kind.includes("área verde") ||
    kind.includes("juegos") ||
    kind.includes("jardin") ||
    kind.includes("jardín")
  ) {
    return "green";
  }

  if (kind.includes("piscina")) {
    return "water";
  }

  if (kind.includes("ciclov")) {
    return "lane";
  }

  if (
    kind.includes("cancha") ||
    kind.includes("losa") ||
    kind.includes("sintetica") ||
    kind.includes("sintética") ||
    kind.includes("deport")
  ) {
    return "court";
  }

  return "civic";
};

const getPatternSvg = (kind, color, opacity = 0.58) => {
  const stroke = rgba(color, opacity);
  const softStroke = rgba(color, opacity * 0.72);
  const white = "rgba(255,255,255,0.88)";
  const whiteSoft = "rgba(255,255,255,0.62)";
  const darkSoft = "rgba(15,23,42,0.12)";

  const variants = {
    green: `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <rect width="28" height="28" fill="none"/>
        <path d="M7 22c1.4-3.1 3.8-5.5 7-7.1 3.3 1.7 5.7 4 7 7.1" fill="none" stroke="${softStroke}" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M14 5.6c2.1-2.8 5.5-3.4 7.5-1.1 1.7 1.9 1.3 5-1.1 7.1-2.3 1.9-5.1 3-6.4 6.7-1-3.7-3.4-4.9-5.8-6.9-2.4-2-2.9-5.4-1-7.3 1.9-2 4.7-1.7 6.8 1.5Z" fill="${stroke}"/>
        <path d="M14 7v11.1" stroke="${white}" stroke-width="1.2" stroke-linecap="round" opacity=".9"/>
        <path d="M10.5 11.3c1.6-.2 2.8-.9 3.5-2M17.3 10.8c-1.2-.1-2.3-.6-3.1-1.5" stroke="${whiteSoft}" stroke-width="1.05" stroke-linecap="round"/>
        <circle cx="6.2" cy="8.2" r="1" fill="${whiteSoft}"/>
        <circle cx="21.6" cy="18.8" r="1.1" fill="${whiteSoft}"/>
      </svg>
    `,
    water: `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="22" viewBox="0 0 28 22">
        <path d="M2 7c2.4 2.2 4.5 2.2 6.9 0 2.3-2.2 4.5-2.2 6.8 0 2.4 2.2 4.5 2.2 6.9 0" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M2 12.2c2.4 2.2 4.5 2.2 6.9 0 2.3-2.2 4.5-2.2 6.8 0 2.4 2.2 4.5 2.2 6.9 0" fill="none" stroke="${softStroke}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M4 17.2c1.8 1.5 3.4 1.5 5.2 0 1.8-1.5 3.4-1.5 5.2 0 1.8 1.5 3.4 1.5 5.2 0 1.8-1.5 3.4-1.5 5.2 0" fill="none" stroke="${whiteSoft}" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    `,
    lane: `
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
        <path d="M4.5 20.5 20.8 4.8" stroke="${softStroke}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M10.6 20.8 22 9.6" stroke="${whiteSoft}" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="2.4 3"/>
        <path d="M15.2 4.8H22v6.8" fill="none" stroke="${stroke}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    court: `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <rect x="3.5" y="3.5" width="21" height="21" rx="3.4" fill="${rgba(color, opacity * 0.2)}" stroke="${stroke}" stroke-width="1.7"/>
        <path d="M5 8.6h18M5 14h18M5 19.4h18" stroke="${rgba(color, opacity * 0.18)}" stroke-width="1.2"/>
        <path d="M14 3.8v20.4" stroke="${white}" stroke-width="1.35"/>
        <circle cx="14" cy="14" r="3.1" fill="none" stroke="${white}" stroke-width="1.2"/>
        <rect x="6.6" y="7.1" width="14.8" height="13.8" rx="1.6" fill="none" stroke="${whiteSoft}" stroke-width="1.05"/>
        <path d="M8.2 10.1c1.7-.9 3.8-1.4 5.8-1.4M19.8 17.9c-1.7.9-3.8 1.4-5.8 1.4" stroke="${darkSoft}" stroke-width="0.8" stroke-linecap="round"/>
      </svg>
    `,
    civic: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="2.6" fill="${stroke}" />
        <path d="M12 4.4v15.2M4.4 12h15.2" stroke="${white}" stroke-width="1.1" opacity=".78" stroke-linecap="round"/>
        <path d="M7.2 7.2h9.6v9.6H7.2z" fill="none" stroke="${whiteSoft}" stroke-width=".9" opacity=".9"/>
      </svg>
    `,
  };

  return svgToDataUrl((variants[kind] || variants.civic).trim());
};

export const getSpacePatternPreviewStyle = (espacio, color) => {
  const kind = getSpacePatternKind(espacio);
  const icon = getPatternSvg(kind, color, 0.7);
  return {
    backgroundColor:
      kind === "green"
        ? rgba(color, 0.18)
        : kind === "court"
          ? rgba(color, 0.22)
          : rgba(color, 0.16),
    backgroundImage: `url("${icon}")`,
    backgroundSize:
      kind === "lane"
        ? "17px 17px"
        : kind === "court"
          ? "22px 22px"
          : kind === "green"
            ? "20px 20px"
            : "18px 18px",
    backgroundRepeat: "repeat",
    backgroundPosition: "center",
    border: `1px solid ${rgba(color, 0.34)}`,
  };
};

const pointInPolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || 1e-9) + xi;

    if (intersects) inside = !inside;
  }
  return inside;
};

const buildPatternPoints = (path, kind) => {
  if (!Array.isArray(path) || path.length < 3) return [];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  path.forEach((point) => {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  });

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  if (!(latSpan > 0) || !(lngSpan > 0)) return [];

  const aspect = lngSpan / latSpan;
  const baseCols = kind === "lane" ? 5 : kind === "court" ? 3 : kind === "green" ? 4 : 5;
  const cols = clamp(Math.round(baseCols * Math.max(0.8, Math.min(aspect, 1.4))), 3, 6);
  const rows = clamp(Math.round((latSpan / lngSpan) * cols * (kind === "court" ? 1.2 : 1.6)), 2, 5);
  const stepLng = lngSpan / (cols + 1);
  const stepLat = latSpan / (rows + 1);
  const points = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      const stagger = kind === "court" ? 0 : row % 2 === 0 ? stepLng * 0.28 : 0;
      const candidate = {
        lat: maxLat - stepLat * row,
        lng: minLng + stepLng * col + stagger,
      };

      if (
        candidate.lng < maxLng - stepLng * 0.15 &&
        pointInPolygon(candidate, path)
      ) {
        points.push(candidate);
      }
    }
  }

  const maxMarkers = kind === "green" ? 16 : kind === "court" ? 8 : 14;
  if (points.length <= maxMarkers) return points;

  const step = points.length / maxMarkers;
  return Array.from({ length: maxMarkers }, (_, index) => points[Math.floor(index * step)]).filter(Boolean);
};

const SpacePatternOverlay = ({
  path = [],
  espacio,
  color = "#22c55e",
  visible = true,
  emphasized = false,
}) => {
  const kind = useMemo(() => getSpacePatternKind(espacio), [espacio]);
  const points = useMemo(() => buildPatternPoints(path, kind), [path, kind]);
  const iconUrl = useMemo(
    () => getPatternSvg(kind, color, emphasized ? 0.82 : 0.58),
    [color, emphasized, kind],
  );

  if (!visible || !points.length || !window.google?.maps?.Size) return null;

  const size =
    kind === "lane" ? 16 : kind === "court" ? 19 : kind === "water" ? 16 : kind === "green" ? 17 : 14;

  return (
    <>
      {points.map((position, index) => (
        <Marker
          key={`space-pattern-${espacio?.idespacio || "x"}-${index}`}
          position={position}
          icon={{
            url: iconUrl,
            scaledSize: new window.google.maps.Size(size, size),
            anchor: new window.google.maps.Point(size / 2, size / 2),
          }}
          clickable={false}
          zIndex={11}
          opacity={emphasized ? 0.96 : 0.82}
          optimized
        />
      ))}
    </>
  );
};

export default React.memo(SpacePatternOverlay);
