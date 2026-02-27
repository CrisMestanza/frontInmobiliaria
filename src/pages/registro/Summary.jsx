import { withApiBase } from "../../config/api.js";
// src/components/Registro/Summary.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Summary.css";
const Summary = ({ onBack, formData }) => {
  const [loading] = useState(false);
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      usuario: {
        correo: formData.correo,
        password: formData.password,
        nombre: formData.nombre,
        estado: 1,
      },
      nombreinmobiliaria: formData.companyName,
      telefono: formData.phoneNumber,
      RUC: formData.companyRuc,
      correo: formData.email,
      descripcion: formData.descripcion,
      pagina: formData.portfolioLink,
      facebook: formData.facebookLink,
      whatsapp: formData.whatsappNumber,
      tiktok: formData.tiktokUsername,
      estado: 1,
    };

    try {
      const response = await fetch(
        withApiBase("https://api.geohabita.com/api/register_inmobiliaria_usuario/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        alert("Registro exitoso!");
        navigate("/login");
      } else {
        alert("Error al registrar. Revisa la consola.");
      }
    } catch (error) {
      console.error("❌ Error de red:", error);
      alert("Error de conexión con el servidor");
    }
  };

  return (
    <div className="form-step summary-step">
      <h3>Resumen de Datos</h3>
      <div className="summary-section">
        <h4>Datos de Cuenta de Usuario</h4>
        <p>
          <strong>Nombre:</strong> {formData.nombre}
        </p>
        <p>
          <strong>Correo Electrónico:</strong> {formData.correo}
        </p>
      </div>
      <div className="summary-section">
        <h4>Información de Contacto</h4>
        <p>
          <strong>Razón Social:</strong> {formData.companyName}
        </p>
        <p>
          <strong>RUC:</strong> {formData.companyRuc}
        </p>
        <p>
          <strong>Teléfono:</strong> {formData.phoneNumber}
        </p>
        <p>
          <strong>Correo Electrónico:</strong> {formData.email}
        </p>
      </div>
      <div className="summary-section">
        <h4>Información Adicional</h4>
        <p>
          <strong>Descripción:</strong> {formData.descripcion}
        </p>
        <p>
          <strong>Enlace a Sitio Web:</strong>{" "}
          {formData.portfolioLink || "No proporcionado"}
        </p>
      </div>
      <div className="summary-section">
        <h4>Redes Sociales</h4>
        <p>
          <strong>Facebook:</strong>{" "}
          {formData.facebookLink || "No proporcionado"}
        </p>
        <p>
          <strong>Whatsapp:</strong>{" "}
          {formData.whatsappNumber || "No proporcionado"}
        </p>
        <p>
          <strong>Tiktok:</strong>{" "}
          {formData.tiktokUsername || "No proporcionado"}
        </p>
      </div>
      <div className="form-actions">
        <button type="button" className="back-btn" onClick={onBack}>
          Editar
        </button>
        <button
          type="submit"
          className="submit-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Registrando..." : "Registrarme"}
        </button>
      </div>
    </div>
  );
};

export default Summary;
