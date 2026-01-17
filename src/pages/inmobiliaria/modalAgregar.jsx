import { useState } from "react";
import axios from "axios";
import style from "./agregarInmo.module.css";

export default function InmobiliariaModal({ onClose, onAdded }) {
  const [nombreinmobiliaria, setNombreinmobiliaria] = useState("");
  const [facebook, setFacebook] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pagina, setPagina] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      nombreinmobiliaria,
      facebook,
      whatsapp,
      pagina,
      latitud,
      longitud,
      descripcion,
    };

    try {
      const res = await axios.post(
        "https://apiinmo.y0urs.com/api/registerInmobiliaria/",
        data
      );

      if (res.status === 200 || res.status === 201) {
        alert("Inmobiliaria registrada ✅");

        // 🔑 Notifica al padre y pasa el objeto creado
        onAdded(res.data);

        onClose();
      } else {
        console.error(res.data);
        alert("Error al registrar ❌");
      }
    } catch (err) {
      if (err.response) {
        console.error(err.response.data);
        alert("Error en datos ❌");
      } else {
        console.error(err);
        alert("Error de red 🚫");
      }
    }
  };

  return (
    <div className={style.modalOverlay}>
      <div className={style.modalContent}>
        <button className={style.closeBtn} onClick={onClose}>
          ✖
        </button>
        <form className={style.formContainer} onSubmit={handleSubmit}>
          <h2 style={{ color: "black" }}>Registrar Inmobiliaria</h2>

          <label>Nombre:</label>
          <input
            name="nombreinmobiliaria"
            value={nombreinmobiliaria}
            onChange={(e) => setNombreinmobiliaria(e.target.value)}
            className={style.input}
          />

          <label>Facebook:</label>
          <input
            name="facebook"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            className={style.input}
          />

          <label>WhatsApp:</label>
          <input
            name="whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={style.input}
          />

          <label>Página:</label>
          <input
            name="pagina"
            value={pagina}
            onChange={(e) => setPagina(e.target.value)}
            className={style.input}
          />

          <label>Latitud:</label>
          <input
            name="latitud"
            value={latitud}
            onChange={(e) => setLatitud(e.target.value)}
            className={style.input}
          />

          <label>Longitud:</label>
          <input
            name="longitud"
            value={longitud}
            onChange={(e) => setLongitud(e.target.value)}
            className={style.input}
          />

          <label>Descripción:</label>
          <textarea
            name="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className={style.input}
          ></textarea>

          <button type="submit" className={style.submitBtn}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
