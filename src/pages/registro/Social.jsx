// src/components/Registro/Social.jsx
import React, { useState } from "react";
import "./Registro.css";

const Social = ({ onNext, onBack, formData }) => {
  const [data, setData] = useState({
    ...formData,
    whatsappCountryCode: formData.whatsappCountryCode || "",
    whatsappNumber: formData.whatsappNumber || "",
  });

  const isFormValid =
    data.facebookLink ||
    data.tiktokUsername ||
    (data.whatsappCountryCode && data.whatsappNumber);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData({ ...data, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid) {
      const fullWhatsappNumber = `+${data.whatsappCountryCode}${data.whatsappNumber}`;
      const formattedData = {
        ...data,
        whatsappNumber: fullWhatsappNumber,
        tiktokLink: data.tiktokUsername
          ? `https://www.tiktok.com/@${data.tiktokUsername.replace(/^@/, "")}`
          : "",
      };
      onNext(formattedData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-step">
      <h3>Redes Sociales</h3>
      <div className="form-row">
        <label htmlFor="facebookLink">Enlace a Facebook</label>
        <input
          type="url"
          name="facebookLink"
          value={data.facebookLink}
          onChange={handleChange}
          placeholder="https://www.facebook.com/usuario"
        />
      </div>
      <div className="form-row">
        <label>Código del país y Número de WhatsApp</label>
        <div className="input-group whatsapp-input-group">
          <span className="plus-sign">+</span>
          <input
            type="text"
            name="whatsappCountryCode"
            value={data.whatsappCountryCode}
            onChange={handleChange}
            placeholder="51"
            className="country-code"
          />
          <input
            type="tel"
            name="whatsappNumber"
            value={data.whatsappNumber}
            onChange={handleChange}
            placeholder="987654321"
            className="phone-number"
          />
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="tiktokUsername">Nombre de usuario de TikTok</label>
        <input
          type="text"
          name="tiktokUsername"
          value={data.tiktokUsername}
          onChange={handleChange}
          placeholder="@usuario"
        />
      </div>
      <div className="form-actions">
        <button type="button" className="back-btn" onClick={onBack}>
          Atrás
        </button>
        <button type="submit" className="next-btn" disabled={!isFormValid}>
          Siguiente
        </button>
      </div>
    </form>
  );
};

export default Social;
