import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import style from "./agregarInmo.module.css";

export default function Principal() {
  const [showModal, setShowModal] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);
  const [inmobiliarias, setInmobiliarias] = useState([]);
  const [idinmobiliariaEdit, setIdinmobiliariaEdit] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInmobiliarias = async () => {
      try {
        const res = await fetch(
          "https://apiinmo.y0urs.com/api/listInmobiliaria/",
        );
        const data = await res.json();
        setInmobiliarias(data);
      } catch (err) {
        console.error("Error al cargar inmobiliarias:", err);
      }
    };
    fetchInmobiliarias();
  }, []);

  const handleEdit = (idinmobiliaria) => {
    setIdinmobiliariaEdit(idinmobiliaria);
    setShowModalEdit(true);
  };

  const handleDelete = async (idinmobiliaria) => {
    const confirm = window.confirm(
      "¿Estás seguro de eliminar esta inmobiliaria?",
    );
    if (confirm) {
      try {
        const res = await fetch(
          `https://apiinmo.y0urs.com/api/deleteInmobiliaria/${idinmobiliaria}/`,
          {
            method: "PUT",
          },
        );
        if (res.ok) {
          alert("Eliminado correctamente ✅");
          setInmobiliarias(
            inmobiliarias.filter(
              (item) => item.idinmobiliaria !== idinmobiliaria,
            ),
          );
        } else {
          alert("Error al eliminar ❌");
        }
      } catch (err) {
        console.error(err);
        alert("Error de red 🚫");
      }
    }
  };

  const handleInmobiliariaAdded = (nueva) => {
    setInmobiliarias((prev) => [...prev, nueva]);
  };

  const handleInmobiliariaUpdated = (actualizada) => {
    setInmobiliarias((prev) =>
      prev.map((item) =>
        item.idinmobiliaria === actualizada.idinmobiliaria ? actualizada : item,
      ),
    );
  };

  const verInmo = (idinmobiliaria) => {
    console.log(idinmobiliaria);
    navigate(`/proyectos/${idinmobiliaria}`);
  };
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
          Gestión de Inmobiliaria
        </h1>
        <button onClick={() => setShowModal(true)} className={style.addBtn}>
          Agregar Inmobiliaria
        </button>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "20px",
          }}
        >
          <thead>
            <tr style={{ background: "#0077b6", color: "#fff" }}>
              <th className={style.tableStyle}>N°</th>
              <th className={style.tableStyle}>Nombre</th>
              <th className={style.tableStyle}>Facebook</th>
              <th className={style.tableStyle}>WhatsApp</th>
              <th className={style.tableStyle}>Página</th>
              <th className={style.tableStyle}>Latitud</th>
              <th className={style.tableStyle}>Longitud</th>
              <th className={style.tableStyle}>Descripción</th>
              <th className={style.tableStyle}>Ver</th>
              <th className={style.tableStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inmobiliarias.map((item, index) => (
              <tr
                key={item.idinmobiliaria}
                style={{ borderBottom: "1px solid #ccc" }}
              >
                <td style={{ textAlign: "center", color: "black" }}>
                  {index + 1}
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  {item.nombreinmobiliaria}
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  <a
                    href={item.facebook}
                    style={{ color: "black" }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.facebook}
                  </a>
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  {item.whatsapp}
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  <a
                    href={item.pagina}
                    style={{ color: "black" }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.pagina}
                  </a>
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  {item.latitud}
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  {item.longitud}
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  {item.descripcion}
                </td>
                <td style={{ textAlign: "center", color: "black" }}>
                  <button
                    onClick={() => verInmo(item.idinmobiliaria)}
                    className={style.addBtn}
                  >
                    👁️ Ver
                  </button>
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    onClick={() => handleEdit(item.idinmobiliaria)}
                    className={style.addBtn}
                  >
                    ✏️
                  </button>{" "}
                  <button
                    onClick={() => handleDelete(item.idinmobiliaria)}
                    className={style.removeBtn}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <InmobiliariaModal
          onClose={() => setShowModal(false)}
          onAdded={handleInmobiliariaAdded}
        />
      )}

      {showModalEdit && (
        <InmobiliariaEdit
          onClose={() => setShowModalEdit(false)}
          onUpdated={handleInmobiliariaUpdated}
          idinmobiliaria={idinmobiliariaEdit}
        />
      )}
    </div>
  );
}
