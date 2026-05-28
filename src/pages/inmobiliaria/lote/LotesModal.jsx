import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpDown,
  Blocks,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import style from "./lotesModal.module.css";
import InmobiliariaModal from "./agregarLoteBlock";
import LoteBlockModal from "./agregarLote";
import ModalPortal from "../../../components/ModalPortal";
import EditLote from "./editLote";
import LotePDF from "./agregarLotePDF";

const formatCurrency = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "S/. 0";
  return `S/. ${amount.toLocaleString("es-PE")}`;
};

const formatArea = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Sin área";
  return `${amount.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m²`;
};

const getStatusMeta = (status) => {
  if (Number(status) === 1) {
    return { label: "Vendido", badgeClass: style.statusSold };
  }
  if (Number(status) === 2) {
    return { label: "Reservado", badgeClass: style.statusReserved };
  }
  return { label: "Disponible", badgeClass: style.statusAvailable };
};

const LotesModal = ({ idproyecto, proyectoNombre, onClose, embedded = false }) => {
  const navigate = useNavigate();
  const [lotes, setLotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModalBlock, setShowModalBlock] = useState(false);
  const [showModalLote, setShowModalLote] = useState(false);
  const [showModalLotePDF, setShowModalLotePDF] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [priceSort, setPriceSort] = useState("id");
  const token = localStorage.getItem("access");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const navigateToPlanningGenerate = () => {
    navigate(`/dashboard/plano/${idproyecto}/generar`);
  };

  const navigateToPlanningPdf = () => {
    navigate(`/dashboard/plano/${idproyecto}/pdf`);
  };

  const navigateToEditLote = (idlote) => {
    navigate(`/dashboard/lotes/${idproyecto}/${idlote}/editar`);
  };

  useEffect(() => {
    if (embedded) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [embedded]);

  const fetchData = async ({ initial = false } = {}) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const resLotes = await authFetch(
        withApiBase(`https://api.geohabita.com/api/getLoteProyecto/${idproyecto}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
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

  const stats = {
    total: lotes.length,
    disponibles: lotes.filter((l) => Number(l.vendido) === 0).length,
    reservados: lotes.filter((l) => Number(l.vendido) === 2).length,
    vendidos: lotes.filter((l) => Number(l.vendido) === 1).length,
  };

  const soldProgress = stats.total > 0 ? Math.round((stats.vendidos / stats.total) * 100) : 0;

  const filteredLotes = lotes.filter((l) => {
    const term = searchTerm.toLowerCase();
    return (
      l.nombre?.toLowerCase().includes(term) ||
      l.descripcion?.toLowerCase().includes(term)
    );
  });

  const sortedLotes = [...filteredLotes].sort((a, b) => {
    if (priceSort === "asc") {
      return Number(a.precio ?? 0) - Number(b.precio ?? 0);
    }
    if (priceSort === "desc") {
      return Number(b.precio ?? 0) - Number(a.precio ?? 0);
    }
    return Number(a.idlote ?? 0) - Number(b.idlote ?? 0);
  });

  const handleEstadoChange = async (idlote, nuevoEstado) => {
    try {
      const res = await authFetch(
        withApiBase(`https://api.geohabita.com/api/updateLoteVendido/${idlote}/`),
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
      const res = await authFetch(
        withApiBase(`https://api.geohabita.com/api/deleteLote/${idlote}/`),
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

  const overlayStyle = embedded
    ? {
        position: "relative",
        inset: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: 0,
        minHeight: "auto",
        display: "block",
        overflow: "visible",
      }
    : undefined;

  const modalStyle = embedded
    ? {
        width: "100%",
        maxWidth: "none",
        minHeight: "auto",
        maxHeight: "none",
        borderRadius: "24px",
        boxShadow: "none",
        overflow: "visible",
        border: "1px solid rgba(148, 163, 184, 0.16)",
      }
    : undefined;

  return (
    <div className={style.modalTheme}>
      <div className={style.overlay} style={overlayStyle}>
        <div className={style.modal} style={modalStyle}>
          <header className={style.header}>
            <div className={style.headerMain}>
              <div className={style.headerCopy}>
                <nav className={style.breadcrumb}>
                  Lotes <span>/</span> <strong>{proyectoNombre}</strong>
                </nav>
                <div className={style.titleContainer}>
                  <div className={style.titleBadge}>Inventario de lotes</div>
                  <h1 className={style.title}>{proyectoNombre}</h1>
                </div>
                <p className={style.subtitle}>
                  Gestiona disponibilidad, precios y estados del proyecto desde una sola vista operativa.
                </p>
                {(refreshing || loading) && (
                  <div className={style.refreshingText}>
                    <RefreshCw size={14} className={style.refreshingIcon} />
                    {loading ? "Cargando lotes..." : "Actualizando lotes..."}
                  </div>
                )}
              </div>
              {!embedded && (
                <button className={style.closeBtn} onClick={onClose} aria-label="Cerrar">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className={style.headerSummary}>
              <div className={style.statsGrid}>
                <div className={`${style.statCard} ${style.statBlue}`}>
                  <p className={style.statLabel}>Total de lotes</p>
                  <div className={style.statValue}>
                    <Blocks size={16} />
                    {stats.total}
                  </div>
                </div>
                <div className={`${style.statCard} ${style.statGreen}`}>
                  <p className={style.statLabel}>Disponibles</p>
                  <div className={style.statValue}>
                    <CheckCircle2 size={16} />
                    {stats.disponibles}
                  </div>
                </div>
                <div className={`${style.statCard} ${style.statAmber}`}>
                  <p className={style.statLabel}>Reservados</p>
                  <div className={style.statValue}>
                    <Clock3 size={16} />
                    {stats.reservados}
                  </div>
                </div>
                <div className={`${style.statCard} ${style.statSlate}`}>
                  <p className={style.statLabel}>Vendidos</p>
                  <div className={style.statValue}>
                    <Tag size={16} />
                    {stats.vendidos}
                  </div>
                </div>
              </div>

              <div className={style.searchPanel}>
                <label className={style.searchPanelLabel}>Buscar en el inventario</label>
                <div className={style.searchContainer}>
                  <span className={style.searchIcon} aria-hidden="true">
                    <Search size={14} />
                  </span>
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
              </div>
            </div>
          </header>

          <div className={style.actionsBar}>
            <div className={style.actionsMeta}>
              <span className={style.actionsTitle}>Herramientas de registro</span>
              <p className={style.actionsText}>
                Agrega lotes por bloque, crea un lote manual o carga el plano PDF para el calcado del proyecto.
              </p>
            </div>
            <div className={style.btnGroup}>
              <button
                className={`${style.actionBtn} ${style.btnPrimary}`}
                onClick={() => (embedded ? navigateToPlanningGenerate() : setShowModalBlock(true))}
              >
                <Plus size={14} className={style.actionIcon} />
                <span className={style.btnDot}></span>
                Agregar lotes
              </button>
              <button
                className={`${style.actionBtn} ${style.btnSecondary}`}
                onClick={() => navigate(`/dashboard/lotes/${idproyecto}/nuevo`)}
              >
                <Plus size={14} className={style.actionIcon} />
                Nuevo lote manual
              </button>
              <button
                className={`${style.actionBtn} ${style.btnGhost}`}
                onClick={() => {
                  if (embedded) {
                    navigateToPlanningPdf();
                    return;
                  }
                  setShowModalLotePDF(true);
                }}
              >
                <FileText size={14} className={style.actionIcon} />
                Añadir plano PDF
              </button>
            </div>
          </div>

          <section className={style.tableSection}>
            <div className={style.tableHeader}>
              <div>
                <span className={style.tableEyebrow}>Listado general de lotes</span>
                <h2 className={style.tableTitle}>Control detallado del inventario</h2>
              </div>
              <div className={style.tableTools}>
                <span className={style.tableToolBadge}>
                  <CircleDollarSign size={14} />
                  Orden actual: {priceSort === "asc" ? "Precio ascendente" : priceSort === "desc" ? "Precio descendente" : "Registro"}
                </span>
                <span className={style.tableToolBadge}>
                  <Settings2 size={14} />
                  {filteredLotes.length} visibles
                </span>
              </div>
            </div>

            <div className={style.tableContainer}>
              <table className={style.table}>
                <thead>
                  <tr>
                    <th>Nº lote / Descripción</th>
                    <th className={style.thPrice}>
                      <div className={style.sortHeader}>
                        Precio
                        <div className={style.sortButtons}>
                          <button
                            type="button"
                            title="Ordenar por precio ascendente"
                            onClick={() => setPriceSort("asc")}
                            className={`${style.sortBtn} ${priceSort === "asc" ? style.sortBtnActive : ""}`}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            title="Ordenar por precio descendente"
                            onClick={() => setPriceSort("desc")}
                            className={`${style.sortBtn} ${priceSort === "desc" ? style.sortBtnActive : ""}`}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            title="Ordenar por registro"
                            onClick={() => setPriceSort("id")}
                            className={`${style.sortBtn} ${priceSort === "id" ? style.sortBtnActive : ""}`}
                          >
                            <ArrowUpDown size={14} />
                          </button>
                        </div>
                      </div>
                    </th>
                    <th className={style.thCenter}>Área (m²)</th>
                    <th className={style.thCenter}>Estado</th>
                    <th className={style.thRight}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className={style.emptyCell}>
                        <div className={style.emptyState}>
                          <div className={style.emptyTitle}>Cargando lotes del proyecto</div>
                          <div className={style.emptySubtitle}>
                            Estamos preparando la tabla para que puedas gestionar el inventario.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : sortedLotes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={style.emptyCell}>
                        <div className={style.emptyState}>
                          <div className={style.emptyTitle}>No hay lotes para mostrar</div>
                          <div className={style.emptySubtitle}>
                            Prueba cambiar la búsqueda o agrega nuevos lotes.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedLotes.map((lote, index) => {
                      const statusMeta = getStatusMeta(lote.vendido);

                      return (
                        <tr key={lote.idlote} className={style.rowHover}>
                          <td>
                            <div className={style.loteCell}>
                              <span className={style.rowIndex}>{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <div className={style.loteName}>{lote.nombre}</div>
                                <div className={style.loteDesc}>
                                  {lote.descripcion || "Lote sin descripción adicional."}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className={style.rowPrice}>{formatCurrency(lote.precio)}</td>
                          <td className={style.tdCenter}>
                            <span className={style.areaValue}>{formatArea(lote.area_total_m2)}</span>
                          </td>
                          <td className={style.tdCenter}>
                            <div className={style.statusCell}>
                              <div className={style.statusSelect}>
                                <select
                                  className={`${style.badge} ${style.statusSelectInput} ${style["badge-" + lote.vendido]}`}
                                  value={lote.vendido}
                                  onChange={(e) => handleEstadoChange(lote.idlote, parseInt(e.target.value, 10))}
                                >
                                  <option value={0}>Disponible</option>
                                  <option value={1}>Vendido</option>
                                  <option value={2}>Reservado</option>
                                </select>
                                <span className={style.selectChevron} aria-hidden="true">
                                  ▾
                                </span>
                              </div>
                              <span className={`${style.statusHint} ${statusMeta.badgeClass}`}>
                                {statusMeta.label}
                              </span>
                            </div>
                          </td>
                          <td className={style.tdRight}>
                            <button
                              className={`${style.iconBtn} ${style.iconBtnEdit}`}
                              onClick={() => {
                                if (embedded) {
                                  navigateToEditLote(lote.idlote);
                                  return;
                                }
                                setSelectedLote(lote);
                                setShowModalEdit(true);
                              }}
                              aria-label="Editar lote"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className={`${style.iconBtn} ${style.iconBtnDelete}`}
                              onClick={() => handleDelete(lote.idlote)}
                              aria-label="Eliminar lote"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className={style.tableFooter}>
              <p className={style.tableFooterText}>
                Mostrando <strong>{sortedLotes.length}</strong> de <strong>{stats.total}</strong> lotes del proyecto.
              </p>
            </div>
          </section>

          <section className={style.bottomGrid}>
            <article className={style.insightCard}>
              <div className={style.insightContent}>
                <span className={style.insightEyebrow}>Avance de ventas</span>
                <h3 className={style.insightTitle}>Capacidad vendida del proyecto</h3>
                <p className={style.insightText}>
                  El proyecto tiene {soldProgress}% de lotes vendidos sobre el inventario total registrado.
                </p>
                <div className={style.progressTrack}>
                  <div className={style.progressFill} style={{ width: `${soldProgress}%` }} />
                </div>
                <p className={style.progressMeta}>
                  Vendidos: <strong>{stats.vendidos}</strong> de <strong>{stats.total}</strong> lotes
                </p>
              </div>
            </article>

            <article className={style.mapCard}>
              <div className={style.mapBadge}>
                <Blocks size={24} />
              </div>
              <div className={style.mapCopy}>
                <span className={style.insightEyebrow}>Visualización espacial</span>
                <h3 className={style.insightTitle}>Revisa la ubicación exacta de cada lote</h3>
                <p className={style.insightText}>
                  Salta al módulo de plano para trazar, revisar geometría o seguir cargando el proyecto sobre el mapa.
                </p>
                <button type="button" className={style.mapLinkBtn} onClick={navigateToPlanningGenerate}>
                  Abrir plano interactivo
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          </section>

          {!embedded && showModalBlock && (
            <InmobiliariaModal
              onClose={() => {
                setShowModalBlock(false);
                fetchData({ initial: false });
              }}
              idproyecto={idproyecto}
            />
          )}

          {!embedded && showModalLote && (
            <LoteBlockModal
              onClose={() => {
                setShowModalLote(false);
                fetchData({ initial: false });
              }}
              idproyecto={idproyecto}
            />
          )}

          {!embedded && showModalLotePDF && (
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

          {!embedded && (
            <EditLote
              onClose={() => {
                setShowModalEdit(false);
                fetchData({ initial: false });
              }}
              idproyecto={idproyecto}
              lote={selectedLote}
              visible={showModalEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LotesModal;
