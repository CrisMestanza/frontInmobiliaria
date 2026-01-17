import React, { useEffect, useState } from "react";
import style from "./lotesModal.module.css";
import InmobiliariaModal from "./agregarLoteBlock";
import LoteBlockModal from "./agregarLote";
import EditLote from "./editLote";
import LotePDF from "./agregarLotePDF";

const LotesModal = ({ idproyecto, proyectoNombre, onClose }) => {
  const [lotes, setLotes] = useState([]);
  const [showModalBlock, setShowModalBlock] = useState(false);
  const [showModalLote, setShowModalLote] = useState(false);
  const [showModalLotePDF, setShowModalLotePDF] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const token = localStorage.getItem("access");
  useEffect(() => {
    // Bloquear scroll al abrir
    document.body.style.overflow = "hidden";

    // Restaurar scroll al cerrar
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resLotes = await fetch(
          `https://apiinmo.y0urs.com/api/getLoteProyecto/${idproyecto}`
        );
        const dataLotes = await resLotes.json();
        setLotes(dataLotes);
      } catch (err) {
        console.error("Error cargando proyecto/lotes:", err);
      }
    };
    fetchData();
  }, [idproyecto]);

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
        }
      );
      if (res.ok) {
        const data = await res.json();
        setLotes((prev) =>
          prev.map((l) =>
            l.idlote === idlote ? { ...l, vendido: data.vendido } : l
          )
        );
      } else {
        alert("Error al cambiar estado ❌");
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Error de red ❌");
    }
  };

  const handleDelete = async (idlote) => {
    if (!window.confirm("¿Seguro que deseas eliminar este lote?")) return;
    const token = localStorage.getItem("access");
    try {
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/deleteLote/${idlote}/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        setLotes((prev) => prev.filter((l) => l.idlote !== idlote));
      } else {
        alert("Error al eliminar ❌");
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const opcionesEstado = [
    { value: 0, label: "Disponible" },
    { value: 1, label: "Vendido" },
    { value: 2, label: "Reservado" },
  ];

  const refreshLotes = async () => {
    try {
      const resLotes = await fetch(
        `https://apiinmo.y0urs.com/api/getLoteProyecto/${idproyecto}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const dataLotes = await resLotes.json();
      setLotes(dataLotes);
    } catch (err) {
      console.error("Error recargando lotes:", err);
    }
  };

  return (
    <div className={style.overlay}>
      <div className={style.modal}>
        <button className={style.closeBtn} onClick={onClose}>
          ❌
        </button>
        <h2 className={style.title}>{proyectoNombre}</h2>
        <button
          className={style.btnAdd}
          onClick={() => setShowModalBlock(true)}
        >
          + Agregar Lotes por Bloques
        </button>
        <button
          className={style.btnAdd1}
          onClick={() => setShowModalLote(true)}
        >
          + Agregar Lotes Irregulares
        </button>
        <button
          className={style.btnAdd2}
          onClick={() => setShowModalLotePDF(true)}
        >
          + Agregar Lotes PDF
        </button>

        <table className={style.table}>
          <thead>
            <tr>
              <th>N°</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lotes.length > 0 ? (
              lotes.map((lote, index) => (
                <tr
                  key={lote.idlote}
                  className={
                    Number(lote.vendido) === 0
                      ? style["vendido-0"]
                      : Number(lote.vendido) === 1
                      ? style["vendido-1"]
                      : Number(lote.vendido) === 2
                      ? style["vendido-2"]
                      : style["vendido-default"]
                  }
                >
                  <td>{index + 1}</td>
                  <td>{lote.nombre}</td>
                  <td>{lote.descripcion}</td>
                  <td>S/.{lote.precio}</td>
                  <td>
                    <div className="select-wrapper">
                      <select
                        value={lote.vendido}
                        onChange={(e) =>
                          handleEstadoChange(
                            lote.idlote,
                            parseInt(e.target.value)
                          )
                        }
                        disabled={lote.vendido === 1}
                      >
                        {opcionesEstado.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => {
                        setSelectedLote(lote);
                        setShowModalEdit(true);
                      }}
                      disabled={lote.vendido === 1}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDelete(lote.idlote)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center" }}>
                  No hay lotes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {showModalBlock && (
          <InmobiliariaModal
            onClose={() => {
              setShowModalBlock(false);
              refreshLotes(); // 🔥 Refresca después de cerrar
            }}
            idproyecto={idproyecto}
          />
        )}
        {showModalLote && (
          <LoteBlockModal
            onClose={() => {
              setShowModalLote(false);
              refreshLotes(); // 🔥 Refresca después de cerrar
            }}
            idproyecto={idproyecto}
          />
        )}
        {showModalLotePDF && (
          <LotePDF
            onClose={() => {
              setShowModalLotePDF(false);
              refreshLotes(); // 🔥 Refresca después de cerrar
            }}
            idproyecto={idproyecto}
          />
        )}
        <EditLote
          onClose={() => {
            setShowModalEdit(false);
            refreshLotes(); // 🔥 Refresca después de editar
          }}
          idproyecto={idproyecto}
          lote={selectedLote}
          visible={showModalEdit}
        />
      </div>
    </div>
  );
};

export default LotesModal;
