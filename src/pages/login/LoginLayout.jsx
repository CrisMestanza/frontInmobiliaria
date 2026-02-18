import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { Link } from "react-router-dom";
const LoginLayout = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const correo = e.target.email.value;
    const password = e.target.password.value;

    if (!correo || !password) {
      alert("Por favor ingresa correo y contraseña");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("https://apiinmo.y0urs.com/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, password }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        localStorage.setItem("idusuario", data.usuario.idusuario);
        localStorage.setItem("correo", data.usuario.correo);
        localStorage.setItem("nombre", data.usuario.nombre);

        if (data.inmobiliaria) {
          localStorage.setItem(
            "idinmobiliaria",
            data.inmobiliaria.idinmobiliaria,
          );
          localStorage.setItem(
            "nombreinmobiliaria",
            data.inmobiliaria.nombreinmobiliaria,
          );
        } else {
          localStorage.setItem("idinmobiliaria", "");
          localStorage.setItem("nombreinmobiliaria", "");
        }

        navigate("/dashboard");
      } else {
        alert(data.detail || "Credenciales incorrectas");
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inmo-login-scope">
      <div className="inmo-login-container">
        {/* Sección de Imagen (Hero) */}
        <div className="inmo-login-hero-section">
          <div className="inmo-login-hero-overlay"></div>
          <div className="inmo-login-hero-img"></div>
          <div className="inmo-login-hero-content">
            <div className="inmo-login-brand-box">
              <span className="material-symbols-outlined inmo-login-logo-icon">
                domain
              </span>
              <span className="inmo-login-brand-name">GeoHabita</span>
            </div>
            <h2 className="inmo-login-hero-text">
              Plataforma diseñada para la{" "}
              <span className="inmo-login-italic">Gestión Inmobiliaria</span>
            </h2>
          </div>
        </div>

        {/* Sección del Formulario */}
        <div className="inmo-login-form-section">
          <div className="inmo-login-form-card">
            {/* Logo solo para móviles */}
            <div className="inmo-login-mobile-header">
              <span className="material-symbols-outlined inmo-login-logo-icon-sm">
                domain
              </span>
              <span className="inmo-login-brand-name-sm">GeoHabita</span>
            </div>

            <div className="inmo-login-header-text">
              <h1 className="inmo-login-title">Bienvenido</h1>
              <p className="inmo-login-subtitle">
                Ingresa tus credenciales para acceder a tu Panel Administrativo
              </p>
            </div>

            <form onSubmit={handleSubmit} className="inmo-login-form-element">
              <div className="inmo-login-field">
                <label className="inmo-login-label">Email</label>
                <input
                  type="email"
                  name="email"
                  className="inmo-login-input"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="inmo-login-field">
                <div className="inmo-login-label-row">
                  <label className="inmo-login-label">Contraseña</label>
                  <a href="#" className="inmo-login-link-sm">
                    Olvidó su Contraseña? Contactar a 916 762 676
                  </a>
                </div>
                <div className="inmo-login-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="inmo-login-input"
                    placeholder="Enter your password"
                    required
                  />
                  <div
                    className="inmo-login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="inmo-login-btn-submit"
                disabled={loading}
              >
                {loading ? "Iniciando..." : "Inicia Sesión"}
              </button>
            </form>

            {/* <div className="inmo-login-divider">
              <span>O continua con...</span>
            </div>

            <div className="inmo-login-social-row">
              <button type="button" className="inmo-login-social-btn">
                <svg className="inmo-login-svg-icon" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#ffffff"
                  ></path>
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#ffffff"
                  ></path>
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#ffffff"
                  ></path>
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                    fill="#ffffff"
                  ></path>
                </svg>
                <span>Google</span>
              </button>
              <button type="button" className="inmo-login-social-btn">
                <svg
                  className="inmo-login-svg-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.05 20.28c-.96.95-2.04 1.9-3.4 1.9-1.32 0-1.76-.81-3.28-.81-1.55 0-2.01.81-3.28.81-1.31 0-2.58-1.13-3.6-2.61-2.09-3.03-2.65-8.58-1.12-11.23C3.12 7.01 4.5 5.61 6.13 5.56c1.23-.04 2.05.68 2.81.68.76 0 1.83-.84 3.24-.7 1.41.14 2.51.65 3.28 1.76-3.03 1.83-2.54 5.92.51 7.18-.58 1.41-1.34 2.82-2.92 5.8zM12.03 5.25c-.02-2.39 1.97-4.41 4.31-4.43.21 2.48-2.31 4.67-4.31 4.43z"></path>
                </svg>
                <span>Apple</span>
              </button>
            </div> */}

            <p className="inmo-login-footer">
              ¿No tiene una cuenta?{" "}
              <Link to="/register" className="inmo-login-link-bold">
                Crear cuenta inmobiliaria
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginLayout;
