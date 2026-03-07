import { withApiBase } from "../../config/api.js";
// src/components/Registro/Summary.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Summary.css";
const Summary = ({ onBack, formData }) => {
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const navigate = useNavigate();

  const parseError = (data) => {
    if (!data) return "No se pudo completar el registro.";
    if (typeof data.message === "string") return data.message;
    const firstKey = Object.keys(data)[0];
    if (!firstKey) return "No se pudo completar el registro.";
    const value = data[firstKey];
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length) return value[0];
    if (value && typeof value === "object") {
      const nestedKey = Object.keys(value)[0];
      const nestedValue = value[nestedKey];
      if (Array.isArray(nestedValue) && nestedValue.length) return nestedValue[0];
      if (typeof nestedValue === "string") return nestedValue;
    }
    return "No se pudo completar el registro.";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setServerMessage("");

    const payload = {
      usuario: {
        correo: formData.correo,
        password: formData.password,
        nombre: formData.nombre,
        estado: 0,
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
        },
      );
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setServerMessage(
          data?.message ||
            "Tu cuenta fue creada. Revisa tu correo para activarla.",
        );
      } else {
        alert(parseError(data));
      }
    } catch (error) {
      console.error("❌ Error de red:", error);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
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
        {serverMessage ? (
          <button
            type="button"
            className="next-btn"
            onClick={() => navigate("/login")}
          >
            Ir a iniciar sesión
          </button>
        ) : null}
      </div>
      {serverMessage ? <p>{serverMessage}</p> : null}
    </div>
  );
};

export default Summary;
