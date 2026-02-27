import { withApiBase } from "../../config/api.js";
import React, { useEffect, useState } from "react";
import { Marker } from "@react-google-maps/api";
import axios from "axios";

export default function ProyectoMarker({ onClick, proyecto }) {
  const [proyectos, setProyectos] = useState([]);

  useEffect(() => {
    async function fetchProyectos() {
      try {
        const res = await axios.get(
          withApiBase("https://api.geohabita.com/api/listProyectos"),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access")}`,
            },
          },
        );
        setProyectos(res.data);
      } catch (err) {
        console.error("Error cargando proyectos:", err);
      }
    }

    fetchProyectos();
  }, []);

  return (
    <Marker
      key={proyecto.idproyecto}
      position={{
        lat: parseFloat(proyecto.latitud),
        lng: parseFloat(proyecto.longitud),
      }}
      onClick={() => onClick(proyecto)}
      icon={{
        url:
          proyecto.estado === 1 && proyecto.idtipoinmobiliaria === 1
            ? "/proyectoicono.png" // icono principal
            : "/loteicono.png", // icono alternativo
        scaledSize: { width: 50, height: 50 },
      }}
    />
  );
}
