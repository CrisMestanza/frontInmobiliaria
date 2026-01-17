import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Aside from "../../../components/Aside";
import InmobiliariaModal from "./agregarLote";
import IconoModal from "../proyecto/icono/IconoModal";
import style from "../agregarInmo.module.css";

export default function LotesList() {
  const { idproyecto } = useParams();
  const navigate = useNavigate();
  const [lotes, setLotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showIconoModal, setShowIconoModal] = useState(false);
  const token = localStorage.getItem("access");
  useEffect(() => {
    const fetchLotes = async () => {
      try {
        const res = await fetch(
          `https://apiinmo.y0urs.com/api/getLoteProyecto/${idproyecto}`
        );
        const data = await res.json();
        setLotes(data);
      } catch (err) {
        console.error("Error al cargar lotes:", err);
      }
    };
    fetchLotes();
  }, [idproyecto]);

  return (
    <div className={style.principal}>
      <Aside />
      <div
        style={{
          flexGrow: 1,
          padding: "40px",
          overflowY: "auto",
          background: "#fff",
        }}
      >
        <h1 style={{ color: "black", textAlign: "center" }}>
          Gestión de Proyecto
        </h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "fit-content",
          }}
        >
          <button onClick={() => navigate(-1)} className={style.addBtn}>
            ⬅ Volver
          </button>
          <button onClick={() => setShowModal(true)} className={style.addBtn}>
            Agregar registro
          </button>
        </div>
        <button
          onClick={() => setShowIconoModal(true)}
          className={style.addBtn}
        >
          Agregar íconos
        </button>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "20px",
          }}
        >
          <thead style={{ color: "black" }}>
            <tr style={{ background: "#0077b6", color: "#fff" }}>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                N°
              </th>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                Nombre
              </th>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                Descripción
              </th>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                Precio
              </th>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                Latitud
              </th>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                Longitud
              </th>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                Tipo
              </th>
              <th className={style.tableStyle} style={{ padding: "10px" }}>
                Accionesa
              </th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote, index) => (
              <tr key={lote.idlote} style={{ borderBottom: "1px solid #ccc" }}>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {index + 1}
                </td>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {lote.nombre}
                </td>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {lote.descripcion}
                </td>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {lote.precio}
                </td>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {lote.latitud}
                </td>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {lote.longitud}
                </td>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {lote.tipoinmobiliaria?.nombre}
                </td>
                <td
                  style={{
                    padding: "10px",
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  <button
                    onClick={() => handleEdit(item.idproyecto)}
                    className={style.addBtn}
                  >
                    ✏️
                  </button>{" "}
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          "¿Seguro que quieres eliminar este lote?"
                        )
                      ) {
                        await fetch(
                          `https://apiinmo.y0urs.com/api/deleteLote/${lote.idlote}/`,
                          {
                            method: "PUT",
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          }
                        );
                        // recargar lista
                        setLotes(lotes.filter((l) => l.idlote !== lote.idlote));
                      }
                    }}
                    className={style.removeBtn}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {showModal && (
          <InmobiliariaModal
            onClose={() => setShowModal(false)}
            idproyecto={idproyecto}
          />
        )}
        {showIconoModal && (
          <IconoModal
            onClose={() => setShowIconoModal(false)}
            idproyecto={idproyecto}
          />
        )}
      </div>
    </div>
  );
}
