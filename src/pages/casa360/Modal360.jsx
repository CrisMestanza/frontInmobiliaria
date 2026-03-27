import React, { useState } from "react";
import { X, Plus, Trash2, Upload } from "lucide-react";
import styles from "./modal360.module.css";

const Modal360 = ({ idproyecto, idlote = null, onClose }) => {
  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const newItems = files.map((file) => ({
      file,
      nombre: file.name.split(".")[0],
    }));
    setItems([...items, ...newItems]);
  };

  const updateNombre = (index, val) => {
    const copy = [...items];
    copy[index].nombre = val;
    setItems(copy);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (items.length === 0) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("idproyecto", idproyecto);
    
    if (idlote) {
      formData.append("idlote", idlote);
    }

    items.forEach((item) => {
      formData.append("imagenes", item.file); 
      formData.append("nombres", item.nombre);
    });

    try {
      // Nota: He añadido la "/" al final por si tu Django la espera (evita redirecciones GET)
      const response = await fetch("https://api.geohabita.com/api/guardar_imagen_360_casa/", {
        method: "POST",
        body: formData,
        // No incluyas headers de Content-Type aquí
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Imágenes subidas con éxito");
        onClose();
      } else {
        alert("Error: " + (data.error || "No se pudo subir"));
      }
    } catch (error) {
      console.error("Error en la petición:", error);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent360}>
        <div className={styles.modalHeader}>
          <h2>Imágenes 360 - Proyecto #{idproyecto}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20}/>
          </button>
        </div>

        <div className={styles.modalBody}>
          <input
            type="file"
            multiple
            accept="image/*"
            id="file360"
            onChange={handleFileChange}
            hidden
          />
          <label htmlFor="file360" className={styles.btnAddFiles}>
            <Plus size={20} /> Seleccionar Panorámicas
          </label>

          <div className={styles.itemsList}>
            {items.length === 0 && (
              <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                No hay archivos seleccionados
              </p>
            )}
            {items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <span className={styles.fileNamePreview} title={item.file.name}>
                  {item.file.name}
                </span>
                <input
                  type="text"
                  className={styles.inputName}
                  value={item.nombre}
                  onChange={(e) => updateNombre(idx, e.target.value)}
                  placeholder="Nombre de la vista"
                />
                <button onClick={() => removeItem(idx)} className={styles.btnDel} type="button">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose} disabled={loading} type="button">
            Cancelar
          </button>
          <button 
            onClick={handleUpload} 
            className={styles.btnPrimary360} 
            disabled={loading || items.length === 0}
            type="button"
          >
            {loading ? "Subiendo..." : (
              <>
                <Upload size={18} /> 
                Guardar {items.length > 0 ? `(${items.length})` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal360;