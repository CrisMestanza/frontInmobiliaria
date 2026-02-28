import React from "react";
import { Polygon } from "@react-google-maps/api";
import LabelOverlay from "./LabelOverlay";

const parseOrder = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getCoordsWithFallbackOrder = (puntos = []) => {
  const normalized = puntos
    .map((p) => ({
      ...p,
      lat: parseFloat(p.latitud),
      lng: parseFloat(p.longitud),
      _orden: parseOrder(p.orden),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (normalized.length < 2) return [];

  const hasCompleteOrder = normalized.every((p) => p._orden !== null);
  if (hasCompleteOrder) {
    return normalized.sort((a, b) => a._orden - b._orden);
  }

  // Fallback robusto: ordenar por angulo alrededor del centroide simple.
  const center = normalized.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  center.lat /= normalized.length;
  center.lng /= normalized.length;

  return normalized.sort((a, b) => {
    const angleA = Math.atan2(a.lat - center.lat, a.lng - center.lng);
    const angleB = Math.atan2(b.lat - center.lat, b.lng - center.lng);
    return angleA - angleB;
  });
};

const calcularCentroide = (path) => {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length; // siguiente punto
    const xi = path[i].lng;
    const yi = path[i].lat;
    const xj = path[j].lng;
    const yj = path[j].lat;

    const factor = xi * yj - xj * yi;
    area += factor;
    cx += (xi + xj) * factor;
    cy += (yi + yj) * factor;
  }

  area *= 0.5;
  cx = cx / (6 * area);
  cy = cy / (6 * area);

  return { lat: cy, lng: cx };
};

// 🔹 Función para oscurecer un color HEX
const darkenColor = (hex, amount = 0.2) => {
  let c = hex.replace("#", "");
  if (c.length === 8) c = c.substring(0, 6); // quitar alpha si hay

  let num = parseInt(c, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));

  return `rgb(${r},${g},${b})`;
};

const PolygonOverlay = ({
  puntos,
  color = "#0000FF",
  onClick,
  onMouseOver,
  onMouseOut,
  showLados = false,
  label,
  hovered,
  options = {},
}) => {
  if (!puntos || puntos.length < 2) return null;

  // 🔹 Aseguramos un orden valido aun si "orden" viene null.
  const puntosOrdenados = getCoordsWithFallbackOrder(puntos);
  if (puntosOrdenados.length < 2) return null;

  const path = puntosOrdenados.map((p) => ({
    lat: p.lat,
    lng: p.lng,
  }));

  // if (path.length > 2) {
  //   path.push(path[0]);
  // }

  const centroide = path.length > 2 ? calcularCentroide(path) : null;

  const defaultOptions = {
    fillColor: hovered ? darkenColor(color, 0.3) : color,
    fillOpacity: 0.35,
    strokeColor: color,
    strokeOpacity: 1,
    strokeWeight: 2,
    clickable: true,
    zIndex: 2,
  };

  const combinedOptions = {
    ...defaultOptions,
    ...options, // Las opciones pasadas desde el padre sobrescriben las predeterminadas
    fillColor:
      options.fillColor !== undefined
        ? options.fillColor
        : defaultOptions.fillColor,
  };

  return (
    <>
      <Polygon
        path={path}
        // options={{
        //   fillColor: hovered ? darkenColor(color, 0.3) : color,
        //   fillOpacity: 0.35,
        //   strokeColor: color,
        //   strokeOpacity: 1,
        //   strokeWeight: 2,
        //   clickable: true,
        //   zIndex: 2,
        // }}
        options={combinedOptions}
        onClick={onClick}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
      />

      {label && centroide && <LabelOverlay position={centroide} text={label} />}

      {showLados &&
        puntosOrdenados.map((p, i) => {
          const start = path[i];
          const end = path[i + 1] || path[0];
          const midLat = (start.lat + end.lat) / 2;
          const midLng = (start.lng + end.lng) / 2;

          return (
            <LabelOverlay
              key={i}
              position={{ lat: midLat, lng: midLng }}
              text={`${p.lado_metros ?? ""} m`}
            />
          );
        })}
    </>
  );
};

export default PolygonOverlay;
