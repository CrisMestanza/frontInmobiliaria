import React, { useEffect, useState, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api.js";
import GeoHabitaLoader from "../../components/GeoHabitaLoader.jsx";

const Viewer360Modal = React.lazy(() => import("../mapa/Viewer360ModalCasa"));

const errorStyle = {
  background: "#030d06",
  color: "#e2fbe8",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100dvh",
  fontFamily: "sans-serif",
  gap: 16,
};

export default function Visor360Page() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState("loading");
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (!projectId) { setStatus("error"); return; }
    fetch(`${API_BASE_URL}/api/get_imagen_360_casa/${projectId}/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (!list.length) { setStatus("empty"); return; }
        const name =
          list[0]?.idproyecto?.nombreproyecto ||
          list[0]?.proyecto?.nombreproyecto ||
          list[0]?.nombre_proyecto ||
          "";
        setProjectName(name);
        setImages(list);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [projectId]);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  if (status === "loading") {
    return <GeoHabitaLoader autoHide={false} />;
  }

  if (status !== "ready") {
    return (
      <div style={errorStyle}>
        <p style={{ margin: 0 }}>
          {status === "empty"
            ? "Este proyecto no tiene vista 360° disponible."
            : "No se pudo cargar el visor 360."}
        </p>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 24px",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Ir al inicio
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<GeoHabitaLoader autoHide={false} />}>
      <Viewer360Modal
        images360={images}
        projectName={projectName}
        onClose={handleClose}
      />
    </Suspense>
  );
}
