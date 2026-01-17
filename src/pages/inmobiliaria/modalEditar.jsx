import { useState, useEffect } from "react";
import axios from "axios";
import style from "./agregarInmo.module.css";

export default function InmobiliariaEdit({
  onClose,
  onUpdated,
  idinmobiliaria,
}) {
  const [nombreinmobiliaria, setNombreinmobiliaria] = useState("");
  const [facebook, setFacebook] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pagina, setPagina] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Cargar datos actuales
  useEffect(() => {
    const fetchInmobiliaria = async () => {
      try {
        const res = await fetch(
          `https://apiinmo.y0urs.com/api/getImobiliaria/${idinmobiliaria}`
        );
        const data = await res.json();
        if (data.length > 0) {
          const info = data[0];
          setNombreinmobiliaria(info.nombreinmobiliaria);
          setFacebook(info.facebook);
          setWhatsapp(info.whatsapp);
          setPagina(info.pagina);
          setLatitud(info.latitud);
          setLongitud(info.longitud);
          setDescripcion(info.descripcion);
        }
      } catch (err) {
        console.error("Error al cargar la inmobiliaria:", err);
      }
    };
    fetchInmobiliaria();
  }, [idinmobiliaria]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.put(
        `https://apiinmo.y0urs.com/api/updateInmobiliaria/${idinmobiliaria}/`,
        {
          nombreinmobiliaria,
          facebook,
          whatsapp,
          pagina,
          latitud,
          longitud,
          descripcion,
        }
      );

      if (res.status === 200) {
        alert("Inmobiliaria actualizada ✅");
        onUpdated(res.data);
        onClose();
      } else {
        alert("Error al actualizar ❌");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red 🚫");
    }
  };

  return (
    <div className={style.modalOverlay}>
      <div className={style.modalContent}>
        <button className={style.closeBtn} onClick={onClose}>
          ✖
        </button>
        <form className={style.formContainer} onSubmit={handleSubmit}>
          <h2 style={{ color: "black" }}>Editar Inmobiliaria</h2>

          <label>Nombre:</label>
          <input
            value={nombreinmobiliaria}
            onChange={(e) => setNombreinmobiliaria(e.target.value)}
            className={style.input}
          />

          <label>Facebook:</label>
          <input
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            className={style.input}
          />

          <label>WhatsApp:</label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={style.input}
          />

          <label>Página:</label>
          <input
            value={pagina}
            onChange={(e) => setPagina(e.target.value)}
            className={style.input}
          />

          <label>Latitud:</label>
          <input
            value={latitud}
            onChange={(e) => setLatitud(e.target.value)}
            className={style.input}
          />

          <label>Longitud:</label>
          <input
            value={longitud}
            onChange={(e) => setLongitud(e.target.value)}
            className={style.input}
          />

          <label>Descripción:</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className={style.input}
          ></textarea>

          <button type="submit" className={style.submitBtn}>
            {" "}
            Guardar Cambios{" "}
          </button>
        </form>
      </div>
    </div>
  );
}
