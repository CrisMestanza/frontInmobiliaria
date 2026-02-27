// src/components/Registro/PersonalDetails.jsx
import React, { useState } from "react";

const PersonalDetails = ({ onNext, formData }) => {
  const [data, setData] = useState(formData);
  const isFormValid = data.companyName && data.phoneNumber && data.email;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData({ ...data, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid) {
      onNext(data);
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
          required
        />
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
          />
          <input
            type="tel"
            name="phoneNumber"
            value={data.phoneNumber}
            onChange={handleChange}
            placeholder="987654321"
            className="phone-number"
          />
        </div>
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
