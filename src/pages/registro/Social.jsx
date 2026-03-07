// src/components/Registro/Social.jsx
import React, { useState } from "react";
import "./Registro.css";

const FACEBOOK_PREFIX = "https://www.facebook.com/";

const normalizeFacebookPath = (value) =>
  (value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
    .replace(/^\/+/, "");

const Social = ({ onNext, onBack, formData }) => {
  const [data, setData] = useState({
    ...formData,
    facebookPath: normalizeFacebookPath(formData.facebookLink),
    whatsappCountryCode: (formData.whatsappCountryCode || "51").replace(/\D/g, ""),
    whatsappNumber: (formData.whatsappNumber || "").replace(/\D/g, ""),
  });
  const facebookPath = (data.facebookPath || "").trim();
  const whatsappCode = (data.whatsappCountryCode || "").replace(/\D/g, "");
  const whatsappDigits = (data.whatsappNumber || "").replace(/\D/g, "");
  const whatsappHasValue = whatsappCode.length > 0 || whatsappDigits.length > 0;
  const whatsappValid =
    !whatsappHasValue ||
    (whatsappCode.length >= 1 &&
      whatsappCode.length <= 4 &&
      whatsappDigits.length >= 7 &&
      whatsappDigits.length <= 15);

  const isFormValid = facebookPath.length > 0 && whatsappValid;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "whatsappCountryCode" || name === "whatsappNumber") {
      setData({ ...data, [name]: value.replace(/\D/g, "") });
      return;
    }
    setData({ ...data, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid) {
      const formattedData = {
        ...data,
        facebookLink: `${FACEBOOK_PREFIX}${facebookPath}`,
        whatsappNumber:
          whatsappCode && whatsappDigits
            ? `+${whatsappCode}${whatsappDigits}`
            : "",
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
        <div className="input-group url-prefix-group">
          <span className="url-prefix">{FACEBOOK_PREFIX}</span>
          <input
            type="text"
            name="facebookPath"
            value={data.facebookPath || ""}
            onChange={handleChange}
            placeholder="tuperfil"
            required
          />
        </div>
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
            inputMode="numeric"
            pattern="^[0-9]{1,4}$"
          />
          <input
            type="tel"
            name="whatsappNumber"
            value={data.whatsappNumber}
            onChange={handleChange}
            placeholder="987654321"
            className="phone-number"
            inputMode="numeric"
            pattern="^[0-9]{7,15}$"
          />
        </div>
        {whatsappHasValue && !whatsappValid ? (
          <span className="error-message">WhatsApp debe tener código de país y número válido (7 a 15 dígitos).</span>
        ) : null}
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
