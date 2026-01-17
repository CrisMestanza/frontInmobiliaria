import React, { useEffect, useState } from "react";
import { Marker } from "@react-google-maps/api";
import axios from "axios";

function calcularCentroide(puntos) {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < puntos.length; i++) {
    const j = (i + 1) % puntos.length; // siguiente punto (cierra polígono)
    const xi = puntos[i].longitud;
    const yi = puntos[i].latitud;
    const xj = puntos[j].longitud;
    const yj = puntos[j].latitud;

    const factor = xi * yj - xj * yi;
    area += factor;
    cx += (xi + xj) * factor;
    cy += (yi + yj) * factor;
  }

  area *= 0.5;
  cx = cx / (6 * area);
  cy = cy / (6 * area);

  return { lat: cy, lng: cx };
}

export default function ProyectoMarker({ proyecto, onClick }) {
  const [centroide, setCentroide] = useState(null);

  useEffect(() => {
    async function fetchPuntos() {
      try {
        const res = await axios.get(
          `https://apiinmo.y0urs.com/api/listPuntosProyecto/${proyecto.idproyecto}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access")}`,
            },
          }
        );
        const puntos = res.data;

        if (puntos.length > 0) {
          setCentroide(calcularCentroide(puntos));
        }
      } catch (err) {
        console.error("Error cargando puntos del proyecto:", err);
      }
    }

    fetchPuntos();
  }, [proyecto.idproyecto]);

  if (!centroide) return null;

  return (
    <Marker
      key={proyecto.idproyecto}
      position={centroide}
      onClick={() => onClick(proyecto)}
      icon={{
        url:
          proyecto.estado === 1 && proyecto.idtipoinmobiliaria === 1
            ? "/proyectoicono.png"
            : "https://cdn-icons-png.freepik.com/512/11130/11130373.png",
        scaledSize: { width: 60, height: 60 },
      }}
    />
  );
}
