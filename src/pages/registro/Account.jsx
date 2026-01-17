// src/components/Registro/UserDetails.jsx
import React, { useState } from "react";

const UserDetails = ({ onNext, onBack, formData }) => {
  const [data, setData] = useState({
    nombre: "",
    correo: "",
    password: "",
    confirmarpassword: "",
    ...formData,
  });
  const [errors, setErrors] = useState({});

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isFormValid =
    data.nombre &&
    data.correo &&
    data.password &&
    data.confirmarpassword &&
    data.password === data.confirmarpassword &&
    Object.keys(errors).every((key) => !errors[key]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkPasswordValidity = (password) => {
    if (!password) return "";
    if (password.length < 8) return "Debe tener al menos 8 caracteres";
    if (!/(?=.*[A-Z])/.test(password))
      return "Debe incluir al menos una mayúscula";
    if (!/(?=.*[0-9])/.test(password)) return "Debe incluir al menos un número";
    if (!/(?=.*[!@#$%^&*()_+=[\]{};':"\\|,.<>/?])/.test(password))
      return "Debe incluir un carácter especial";
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newData = { ...data, [name]: value };
    setData(newData);

    const newErrors = { ...errors };

    if (name === "nombre") {
      newErrors.nombre = value ? "" : "El nombre es requerido";
    }

    if (name === "correo") {
      if (!value) newErrors.correo = "El correo es requerido";
      else if (!validateEmail(value))
        newErrors.correo = "El formato del correo no es válido";
      else newErrors.correo = "";
    }

    if (name === "password") {
      newErrors.password = checkPasswordValidity(value);
      if (newData.confirmarpassword && value !== newData.confirmarpassword) {
        newErrors.confirmarpassword = "Las contraseñas no coinciden";
      } else {
        newErrors.confirmarpassword = "";
      }
    }

    if (name === "confirmarpassword") {
      if (!value) newErrors.confirmarpassword = "Debe confirmar la contraseña";
      else if (newData.password !== value)
        newErrors.confirmarpassword = "Las contraseñas no coinciden";
      else newErrors.confirmarpassword = "";
    }

    setErrors(newErrors);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid) {
      const userData = {
        nombre: data.nombre,
        correo: data.correo,
        password: data.password,
        estado: 1,
      };
      onNext(userData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-step">
      <h3>Información del Usuario</h3>

      <div className="form-row">
        <label htmlFor="nombre">Nombre Completo</label>
        <input
          type="text"
          name="nombre"
          value={data.nombre}
          onChange={handleChange}
          required
          className={errors.nombre ? "error" : ""}
        />
        {errors.nombre && (
          <span className="error-message">{errors.nombre}</span>
        )}
      </div>

      <div className="form-row">
        <label htmlFor="correo">Correo Electrónico</label>
        <input
          type="email"
          name="correo"
          value={data.correo}
          onChange={handleChange}
          required
          className={errors.correo ? "error" : ""}
        />
        {errors.correo && (
          <span className="error-message">{errors.correo}</span>
        )}
      </div>

      <div className="form-row">
        <label htmlFor="password">Contraseña</label>
        <div className="password-input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={data.password}
            onChange={handleChange}
            required
            className={errors.password ? "error" : ""}
          />
          <span
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "👁️" : "🙈"}
          </span>
        </div>
        {errors.password && (
          <span className="error-message">{errors.password}</span>
        )}
      </div>

      <div className="form-row">
        <label htmlFor="confirmarpassword">Confirmar Contraseña</label>
        <div className="password-input-wrapper">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmarpassword"
            value={data.confirmarpassword}
            onChange={handleChange}
            required
            className={errors.confirmarpassword ? "error" : ""}
          />
          <span
            className="toggle-password"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? "👁️" : "🙈"}
          </span>
        </div>
        {errors.confirmarpassword && (
          <span className="error-message">{errors.confirmarpassword}</span>
        )}
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

export default UserDetails;
