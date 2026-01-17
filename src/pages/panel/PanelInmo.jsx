import React, { useEffect, useState } from "react";
import "./PanelInmo.css";
import {
  PlusCircle,
  Home,
  Layers,
  LogOut,
  MousePointerClick,
  MessageCircle,
} from "lucide-react";
import { FaWhatsapp, FaFacebook, FaGlobe } from "react-icons/fa";
import ProyectoModal from "../inmobiliaria/proyecto/agregarProyecto";
import LotesModal from "../inmobiliaria/lote/LotesModal";
import EditProyectoModal from "../inmobiliaria/proyecto/editProyecto";
import IconoModal from "../inmobiliaria/proyecto/icono/IconoModal";
const PanelInmo = () => {
  const [resumen, setResumen] = useState(null);
  const [clicks, setClicks] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("access");
  const nombre = localStorage.getItem("nombre");
  const nombreInmo = localStorage.getItem("nombreinmobiliaria");
  const idInmo = localStorage.getItem("idinmobiliaria");
  const [showModal, setShowModal] = useState(false);
  const [showLotes, setShowLotes] = useState(false);
  const [showModalEditProyecto, setShowModalEditProyecto] = useState(false);
  const [showIconoModal, setShowIconoModal] = useState(false);
  const mapUrl = `${window.location.origin}/mapa/${idInmo}`;
  const handleDelete = async (idproyecto) => {
    if (!window.confirm("¿Seguro que deseas eliminar este Proyecto?")) return;
    const token = localStorage.getItem("access");
    try {
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/deleteProyecto/${idproyecto}/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        // ✅ Refrescar datos después de eliminar
        await fetchData();
      } else {
        alert("Error al eliminar ❌");
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const fetchData = async () => {
    if (!token || !idInmo) {
      window.location.href = "/";
      return;
    }

    try {
      setLoading(true);
      const resProy = await fetch(
        `https://apiinmo.y0urs.com/api/getProyectoInmo/${idInmo}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!resProy.ok) {
        if (resProy.status === 401) {
          console.log("❌ 401 Unauthorized - Limpiando localStorage");
          localStorage.clear();
          window.location.href = "/";
          return;
        }
        throw new Error(`HTTP error! status: ${resProy.status}`);
      }

      const dataProy = await resProy.json();

      const proyectosData = Array.isArray(dataProy) ? dataProy : [];
      setProyectos(proyectosData);

      let lotesAcumulados = [];

      for (let proy of proyectosData) {
        const resLotes = await fetch(
          `https://apiinmo.y0urs.com/api/getLoteProyecto/${proy.idproyecto}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (resLotes.ok) {
          const dataLotes = await resLotes.json();
          lotesAcumulados = [
            ...lotesAcumulados,
            ...(Array.isArray(dataLotes) ? dataLotes : []),
          ];
        }
      }
      setLotes(lotesAcumulados);

      const resumenCalculado = {
        proyectosActivos: proyectosData.filter((p) => p.estado === 1).length,
        lotesDisponibles: lotesAcumulados.filter((l) => l.vendido === 0).length,
        lotesReservados: lotesAcumulados.filter((l) => l.vendido === 2).length,
        lotesVendidos: lotesAcumulados.filter((l) => l.vendido === 1).length,
      };
      setResumen(resumenCalculado);

      // 🆕 Obtener datos de clics (opcional, no bloquea el resto)
      try {
        const resClicks = await fetch(
          `https://apiinmo.y0urs.com/api/dashboard_clicks_inmobiliaria/${idInmo}/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (resClicks.ok) {
          const dataClicks = await resClicks.json();
          setClicks(dataClicks);
        }
      } catch (err) {
        console.warn("Error:", err);
        // No hacemos nada, los clicks son opcionales
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
      // Solo limpiamos si realmente no hay datos
      if (proyectos.length === 0) setProyectos([]);
      if (lotes.length === 0) setLotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  if (loading) {
    return <p className="loading-text">Cargando dashboard...</p>;
  }

  const redes = [
    { nombre: "Whatsapp", icono: <FaWhatsapp color="green" /> },
    { nombre: "Facebook", icono: <FaFacebook color="#1877f2" /> },
    { nombre: "Página", icono: <FaGlobe color="#0077b6" /> },
  ];

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h1 className="panel-title">
          <Home size={30} className="home-icon" /> Dashboard de {nombreInmo}
        </h1>
        <div className="user-controls">
          <span className="welcome-message">Bienvenido, {nombre}</span>
          <button className="btn btn-logout" onClick={handleLogout}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </div>
      <div className="link-compartir-section">
        <h3>🔗 Enlace Público del Mapa Filtrado</h3>
        <p>
          Comparte este enlace con tus clientes para que solo vean los proyectos
          de tu Inmobiliaria {nombreInmo}
        </p>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            value={mapUrl}
            readOnly
            style={{
              flexGrow: 1,
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
          <button
            className="btn btn-secondary"
            onClick={() => {
              navigator.clipboard.writeText(mapUrl);
              alert("Enlace copiado al portapapeles.");
            }}
          >
            Copiar
          </button>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Ver Mapa
          </a>
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="resumen-grid">
          <div className="resumen-card active-projects">
            <Home className="icon" />
            <h3>Proyectos</h3>
            <p>{proyectos.length}</p>
          </div>
          <div className="resumen-card available-lots">
            <Layers className="icon" />
            <h3>Lotes Disponibles</h3>
            <p>{resumen.lotesDisponibles}</p>
          </div>
          <div className="resumen-card reserved-lots">
            <Layers className="icon" />
            <h3>Lotes Reservados</h3>
            <p>{resumen.lotesReservados}</p>
          </div>
          <div className="resumen-card sold-lots">
            <Layers className="icon" />
            <h3>Lotes Vendidos</h3>
            <p>{resumen.lotesVendidos}</p>
          </div>
          <div className="resumen-card clicks-proyectos">
            <MousePointerClick className="icon" />
            <h3>Clicks en Proyectos</h3>
            <p>{clicks?.total_clicks_proyectos || 0}</p>
          </div>

          <div className="resumen-card clicks-contactos">
            <MessageCircle className="icon" />
            <h3>Clicks en Contactos</h3>
            <p>{clicks?.total_clicks_contactos || 0}</p>

            {/* 🔸 Subdetalle con íconos de red social */}
            <div style={{ fontSize: "0.9rem", marginTop: "6px" }}>
              {redes.map((rs) => {
                const red = clicks?.detalle_contactos?.find(
                  (r) => r.redSocial === rs.nombre
                );
                return (
                  <div
                    key={rs.nombre}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "3px",
                    }}
                  >
                    {rs.icono}
                    <span>
                      <strong>{rs.nombre}:</strong> {red ? red.total : 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Proyectos */}
      <div className="proyectos-section">
        <div className="section-header">
          <h2 className="section-title">📂 Proyectos</h2>
          <button onClick={() => setShowModal(true)} className="btn-add">
            <PlusCircle size={22} />
          </button>
        </div>

        <div className="proyectos-grid">
          {proyectos.map((p) => (
            <div key={p.idproyecto} className="proyecto-card">
              {/* Encabezado */}
              <div className="card-header">
                <h3 className="card-title">{p.nombreproyecto}</h3>
                <span
                  className={`estado-badge ${(p.estado || "")
                    .toString()
                    .toLowerCase()}`}
                >
                  {p.estado}
                </span>
              </div>

              {/* Cuerpo */}
              <div className="card-body">
                <p className="card-description">
                  {p.descripcion || "Sin descripción disponible"}
                </p>
                <p className="card-location">
                  📍 <strong>Ubicación:</strong> {p.latitud}, {p.longitud}
                </p>
              </div>

              {/* Footer con acciones */}
              <div className="card-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setShowLotes(p.idproyecto)}
                >
                  Ver Lotes
                </button>
                <button
                  className="btn-edit"
                  onClick={() => setShowModalEditProyecto(p.idproyecto)}
                >
                  Editar
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowIconoModal(p.idproyecto)}
                >
                  Íconos
                </button>
                <button
                  className="btn-terciary"
                  onClick={() => handleDelete(p.idproyecto)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lotes */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">📋 Lotes ({lotes.length})</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Proyecto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote, i) => (
                <tr key={lote.idlote} className={i % 2 === 0 ? "even" : "odd"}>
                  <td>{lote.nombre}</td>
                  <td>{lote.descripcion}</td>
                  <td className="price-cell">S/. {lote.precio?.toFixed(2)}</td>
                  <td>
                    <span
                      className={`estado ${
                        String(lote.estado) === "1" ? "disponible" : "vendido"
                      }`}
                    >
                      {String(lote.estado) === "1"
                        ? "Disponible"
                        : "No disponible"}
                    </span>
                  </td>
                  <td>
                    {proyectos.find((p) => p.idproyecto === lote.idproyecto)
                      ?.nombreproyecto || "N/A"}
                  </td>
                  <td>
                    <button className="btn-secondary">👁️ Ver</button>
                    <button className="btn-edit">✏️ Editar</button>
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        if (
                          window.confirm(
                            `¿Seguro que quieres eliminar el lote "${lote.nombre}"?`
                          )
                        ) {
                          try {
                            const res = await fetch(
                              `https://apiinmo.y0urs.com/api/deleteLote/${lote.idlote}/`,
                              {
                                method: "PUT",
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                },
                              }
                            );
                            if (res.ok) {
                              // ✅ Refrescar datos después de eliminar
                              await fetchData();
                            }
                          } catch (err) {
                            console.error("Error eliminando lote:", err);
                          }
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {showModal && (
            <ProyectoModal
              onClose={() => {
                setShowModal(false);
                fetchData(); // ✅ Refrescar al cerrar modal
              }}
              idinmobiliaria={idInmo}
            />
          )}
          {showLotes && (
            <LotesModal
              idproyecto={showLotes}
              proyectoNombre={
                proyectos.find((p) => p.idproyecto === showLotes)
                  ?.nombreproyecto
              }
              onClose={() => {
                setShowLotes(false);
                fetchData(); // ✅ Refrescar al cerrar modal
              }}
            />
          )}
          {showModalEditProyecto && (
            <EditProyectoModal
              onClose={() => {
                setShowModalEditProyecto(null);
                fetchData(); // ✅ Refrescar al cerrar modal
              }}
              idinmobiliaria={idInmo}
              proyecto={proyectos.find(
                (p) => p.idproyecto === showModalEditProyecto
              )}
            />
          )}
          {showIconoModal && (
            <IconoModal
              onClose={() => setShowIconoModal(false)}
              idproyecto={showIconoModal}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelInmo;
