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
    kind.includes("juegos")
  ) {
    return "green";
  }

  if (kind.includes("piscina")) {
    return "water";
  }

  if (kind.includes("ciclov")) {
    return "lane";
  }

  if (kind.includes("cancha") || kind.includes("losa")) {
    return "court";
  }

  return "civic";
};

const getPatternSvg = (kind, color, opacity = 0.58) => {
  const stroke = rgba(color, opacity);
  const softStroke = rgba(color, opacity * 0.72);
  const white = "rgba(255,255,255,0.88)";

  const variants = {
    green: `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <path d="M11 5.2c1.8-2.3 4.6-2.8 6.2-.9 1.3 1.6 1.1 4.4-1 6.2-1.9 1.7-4.2 2.6-5.2 5.7-.8-3.2-2.7-4.2-4.6-5.9C4.4 8.7 4 6.2 5.6 4.5c1.5-1.6 3.8-1.4 5.4.7Z" fill="${stroke}" />
        <path d="M11 6.2v9.2" stroke="${white}" stroke-width="1.2" stroke-linecap="round" opacity=".82" />
      </svg>
    `,
    water: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="20" viewBox="0 0 24 20">
        <path d="M2 7.5c2.1 2 3.9 2 6 0s3.9-2 6 0 3.9 2 6 0" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M2 12.5c2.1 2 3.9 2 6 0s3.9-2 6 0 3.9 2 6 0" fill="none" stroke="${softStroke}" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `,
    lane: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path d="M4 19L18.5 4.5" stroke="${softStroke}" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M13.5 4.5h5v5" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    court: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3" fill="none" stroke="${stroke}" stroke-width="1.7"/>
        <path d="M12 4.2v15.6" stroke="${softStroke}" stroke-width="1.4"/>
        <circle cx="12" cy="12" r="2.7" fill="none" stroke="${softStroke}" stroke-width="1.2"/>
      </svg>
    `,
    civic: `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <rect x="6.1" y="6.1" width="9.8" height="9.8" rx="2.3" fill="${stroke}" />
        <path d="M11 4.2v13.6M4.2 11h13.6" stroke="${white}" stroke-width="1.1" opacity=".78" stroke-linecap="round"/>
      </svg>
    `,
  };

  return svgToDataUrl((variants[kind] || variants.civic).trim());
};

export const getSpacePatternPreviewStyle = (espacio, color) => {
  const kind = getSpacePatternKind(espacio);
  const icon = getPatternSvg(kind, color, 0.7);
  return {
    backgroundColor: rgba(color, 0.16),
    backgroundImage: `url("${icon}")`,
    backgroundSize: kind === "lane" ? "16px 16px" : "18px 18px",
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
  const baseCols = kind === "lane" ? 4 : kind === "court" ? 4 : 5;
  const cols = clamp(Math.round(baseCols * Math.max(0.8, Math.min(aspect, 1.4))), 3, 6);
  const rows = clamp(Math.round((latSpan / lngSpan) * cols * 1.6), 2, 5);
  const stepLng = lngSpan / (cols + 1);
  const stepLat = latSpan / (rows + 1);
  const points = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      const stagger = row % 2 === 0 ? stepLng * 0.28 : 0;
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

  const maxMarkers = kind === "green" ? 18 : 14;
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
    kind === "lane" ? 15 : kind === "court" ? 16 : kind === "water" ? 16 : 14;

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
