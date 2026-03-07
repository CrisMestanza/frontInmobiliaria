// src/components/Registro/PersonalDetails.jsx
import React, { useState } from "react";

const PersonalDetails = ({ onNext, formData }) => {
  const [data, setData] = useState({
    ...formData,
    whatsappCountryCode: formData.whatsappCountryCode || "51",
    phoneNumber: (formData.phoneNumber || "").replace(/\D/g, ""),
    companyRuc: (formData.companyRuc || "").replace(/\D/g, ""),
  });
  const phoneDigits = (data.phoneNumber || "").replace(/\D/g, "");
  const documentDigits = (data.companyRuc || "").replace(/\D/g, "");
  const documentIsValid =
    documentDigits.length === 8 || documentDigits.length === 11;
  const phoneIsValid = phoneDigits.length >= 7 && phoneDigits.length <= 15;
  const isFormValid =
    (data.companyName || "").trim() &&
    documentIsValid &&
    phoneIsValid &&
    (data.email || "").trim();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phoneNumber" || name === "whatsappCountryCode" || name === "companyRuc") {
      setData({ ...data, [name]: value.replace(/\D/g, "") });
      return;
    }
    setData({ ...data, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid) {
      onNext({
        ...data,
        companyRuc: documentDigits,
        phoneNumber: phoneDigits,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-step">
      <h3>Datos de la Inmobiliaria</h3>
      <div className="form-row">
        <label htmlFor="companyName">Razón Social o Nombre Comercial</label>
        <input
          type="text"
          name="companyName"
          value={data.companyName}
          onChange={handleChange}
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor="companyRuc">RUC o DNI</label>
        <input
          type="text"
          name="companyRuc"
          value={data.companyRuc}
          onChange={handleChange}
          inputMode="numeric"
          pattern="^([0-9]{8}|[0-9]{11})$"
          placeholder="Solo números"
          required
        />
        {documentDigits.length > 0 && !documentIsValid ? (
          <span className="error-message">El DNI debe tener 8 dígitos o el RUC 11 dígitos.</span>
        ) : null}
      </div>
      <div className="form-row">
        <label>Código del país y Teléfono</label>
        <p>Se recomienda poner número personal, no bussines para que le lleguen mensajes 
          personalizados por los clientes
        </p>

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
            required
          />
          <input
            type="tel"
            name="phoneNumber"
            value={data.phoneNumber}
            onChange={handleChange}
            placeholder="987654321"
            className="phone-number"
            required
            inputMode="numeric"
            minLength={7}
            maxLength={15}
            pattern="^[0-9]{7,15}$"
          />
        </div>
        {phoneDigits.length > 0 && !phoneIsValid ? (
          <span className="error-message">Ingresa un número válido (7 a 15 dígitos).</span>
        ) : null}
      </div>
      <div className="form-row">
        <label htmlFor="email">Correo Electrónico</label>
        <input
          type="email"
          name="email"
          value={data.email}
          onChange={handleChange}
          required
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="next-btn" disabled={!isFormValid}>
          Siguiente
        </button>
      </div>
    </form>
  );
};

export default PersonalDetails;
