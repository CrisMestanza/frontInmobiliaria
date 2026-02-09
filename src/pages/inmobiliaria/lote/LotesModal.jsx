import React, { useEffect, useState } from "react";
import style from "./lotesModal.module.css";
import InmobiliariaModal from "./agregarLoteBlock";
import LoteBlockModal from "./agregarLote";
import ModalPortal from "../../../components/ModalPortal";
import EditLote from "./editLote";
import LotePDF from "./agregarLotePDF";
import Loader from "../../../components/Loading";
const LotesModal = ({ idproyecto, proyectoNombre, onClose }) => {
  const [lotes, setLotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModalBlock, setShowModalBlock] = useState(false);
  const [showModalLote, setShowModalLote] = useState(false);
  const [showModalLotePDF, setShowModalLotePDF] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const token = localStorage.getItem("access");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const fetchData = async ({ initial = false } = {}) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const resLotes = await fetch(
        `https://apiinmo.y0urs.com/api/getLoteProyecto/${idproyecto}`,
      );
      if (!resLotes.ok) {
        throw new Error("Error al obtener lotes");
      }
      const dataLotes = await resLotes.json();
      setLotes(Array.isArray(dataLotes) ? dataLotes : []);
    } catch (err) {
      console.error("Error cargando lotes:", err);
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData({ initial: true });
  }, [idproyecto]);

  // Cálculos de estadísticas
  const stats = {
    total: lotes.length,
    disponibles: lotes.filter((l) => Number(l.vendido) === 0).length,
    reservados: lotes.filter((l) => Number(l.vendido) === 2).length,
    vendidos: lotes.filter((l) => Number(l.vendido) === 1).length,
  };

  const filteredLotes = lotes.filter(
    (l) =>
      l.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleEstadoChange = async (idlote, nuevoEstado) => {
    try {
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/updateLoteVendido/${idlote}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ vendido: nuevoEstado }),
        },
      );
      if (res.ok) {
        fetchData();
      } else {
        alert("Error al cambiar estado ❌");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (idlote) => {
    if (!window.confirm("¿Seguro que deseas eliminar este lote?")) return;
    try {
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/deleteLote/${idlote}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className={style.modalTheme}>
      <div className={style.overlay}>
        <div className={style.modal}>
          {/* HEADER */}
          <header className={style.header}>
            <nav className={style.breadcrumb}>
              Proyectos <span>/</span> <strong>{proyectoNombre}</strong>
            </nav>
            <div className={style.titleContainer}>
              <div className={style.titleBadge}>Lotes</div>
              <h1 className={style.title}>{proyectoNombre}</h1>
            </div>
            <p className={style.subtitle}>
              Administra disponibilidad, precios y estados.
            </p>
            {refreshing && (
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Actualizando lotes...
              </div>
            )}
            <button className={style.closeBtn} onClick={onClose}>
              ✕
            </button>
          </header>

          {/* STATS CARDS */}
          <div className={style.statsGrid}>
            <div className={style.statCard}>
              <p className={style.statLabel}>Total de Lotes</p>
              <div className={style.statValue}>
                {stats.total}{" "}
                <span
                  className={`${style.statBadge}`}
                  style={{ background: "#eff6ff", color: "#1e40af" }}
                >
                  100%
                </span>
              </div>
            </div>
            <div className={style.statCard}>
              <p className={style.statLabel}>Disponibles</p>
              <div className={style.statValue}>
                {stats.disponibles}{" "}
                <span
                  className={`${style.statBadge}`}
                  style={{ background: "#ecfdf5", color: "#065f46" }}
                >
                  Activos
                </span>
              </div>
            </div>
            <div className={style.statCard}>
              <p className={style.statLabel}>Reservados</p>
              <div className={style.statValue}>
                {stats.reservados}{" "}
                <span
                  className={`${style.statBadge}`}
                  style={{ background: "#fffbeb", color: "#92400e" }}
                >
                  En proceso
                </span>
              </div>
            </div>
            <div className={style.statCard}>
              <p className={style.statLabel}>Vendidos</p>
              <div className={style.statValue}>
                {stats.vendidos}{" "}
                <span
                  className={`${style.statBadge}`}
                  style={{ background: "#f1f5f9", color: "#475569" }}
                >
                  Cerrados
                </span>
              </div>
            </div>
          </div>

          {/* ACTIONS BAR */}
          <div className={style.actionsBar}>
            <div className={style.searchContainer}>
              <span className={style.searchIcon}>⌕</span>
              <input
                className={style.searchInput}
                placeholder="Buscar lote o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className={style.searchCount}>
                {filteredLotes.length}/{stats.total}
              </span>
            </div>

            <div className={style.btnGroup}>
              <button
                className={`${style.actionBtn} ${style.btnPrimary}`}
                onClick={() => setShowModalBlock(true)}
              >
                <span className={style.btnDot}></span> Lotes por Bloques
              </button>
              <button
                className={`${style.actionBtn} ${style.btnSecondary}`}
                onClick={() => setShowModalLote(true)}
              >
                Lotes Irregulares
              </button>
              <button
                className={`${style.actionBtn} ${style.btnGhost}`}
                onClick={() => {
                  console.log("CLICK PDF");
                  setShowModalLotePDF(true);
                }}
              >
                PDF para Calcado
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className={style.tableContainer}>
            <table className={style.table}>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Lote / Descripción</th>
                  <th>Precio</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={style.emptyCell}>
                      <div className={style.emptyState}>
                        <div className={style.emptyTitle}>
                          No hay lotes para mostrar
                        </div>
                        <div className={style.emptySubtitle}>
                          Prueba cambiar la busqueda o agrega nuevos lotes.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLotes.map((lote, index) => (
                    <tr key={lote.idlote} className={style.rowHover}>
                      <td style={{ color: "#94a3b8", fontWeight: "500" }}>
                        {index + 1}
                      </td>
                      <td>
                        <div className={style.loteName}>{lote.nombre}</div>
                        <div className={style.loteDesc}>{lote.descripcion}</div>
                      </td>
                      <td style={{ fontWeight: "600" }}>S/. {lote.precio}</td>
                      <td style={{ textAlign: "center" }}>
                        <select
                          className={`${style.badge} ${style["badge-" + lote.vendido]}`}
                          value={lote.vendido}
                          onChange={(e) =>
                            handleEstadoChange(
                              lote.idlote,
                              parseInt(e.target.value),
                            )
                          }
                          disabled={lote.vendido === 1}
                          style={{
                            border: "none",
                            cursor: "pointer",
                            appearance: "none",
                          }}
                        >
                          <option value={0}>Disponible</option>
                          <option value={1}>Vendido</option>
                          <option value={2}>Reservado</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className={`${style.iconBtn} ${style.iconBtnEdit}`}
                          onClick={() => {
                            setSelectedLote(lote);
                            setShowModalEdit(true);
                          }}
                          disabled={lote.vendido === 1}
                        >
                          ✏️
                        </button>
                        <button
                          className={`${style.iconBtn} ${style.iconBtnDelete}`}
                          onClick={() => handleDelete(lote.idlote)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* LEGEND */}
          <footer className={style.legend}>
            <div className={style.legendItem}>
              <span
                className={style.dot}
                style={{ background: "#10b981" }}
              ></span>{" "}
              Disponible
            </div>
            <div className={style.legendItem}>
              <span
                className={style.dot}
                style={{ background: "#f59e0b" }}
              ></span>{" "}
              Reservado
            </div>
            <div className={style.legendItem}>
              <span
                className={style.dot}
                style={{ background: "#94a3b8" }}
              ></span>{" "}
              Vendido
            </div>
          </footer>

          {/* MODALS HIJOS */}
          {showModalBlock && (
            <InmobiliariaModal
              onClose={() => {
                setShowModalBlock(false);
                fetchData({ initial: false });
              }}
              idproyecto={idproyecto}
            />
          )}
          {showModalLote && (
            <LoteBlockModal
              onClose={() => {
                setShowModalLote(false);
                fetchData({ initial: false });
              }}
              idproyecto={idproyecto}
            />
          )}
          {showModalLotePDF && (
            <ModalPortal>
              <LotePDF
                onClose={() => {
                  setShowModalLotePDF(false);
                  fetchData({ initial: false });
                }}
                idproyecto={idproyecto}
              />
            </ModalPortal>
          )}

          <EditLote
            onClose={() => {
              setShowModalEdit(false);
              fetchData({ initial: false });
            }}
            idproyecto={idproyecto}
            lote={selectedLote}
            visible={showModalEdit}
          />
        </div>
      </div>
    </div>
  );
};

export default LotesModal;
