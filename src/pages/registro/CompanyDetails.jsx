// src/components/Registro/CompanyDetails.jsx
import React, { useState } from "react";

const CompanyDetails = ({ onNext, onBack, formData }) => {
  const [data, setData] = useState(formData);
  const isFormValid = data.descripcion;

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
      <h3>Información Adicional</h3>
      <div className="form-row">
        <label htmlFor="descripcion">Descripción de la Inmobiliaria</label>
        <textarea
          name="descripcion"
          value={data.descripcion}
          onChange={handleChange}
          rows="5"
          maxLength={450}
          required
        />
        <span className="char-counter">
          {data.descripcion.length} / 450
        </span>
      </div>
      <div className="form-row">
        <label htmlFor="portfolioLink">Enlace al Sitio Web (opcional)</label>
        <input
          type="url"
          name="portfolioLink"
          value={data.portfolioLink}
          onChange={handleChange}
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

export default CompanyDetails;
