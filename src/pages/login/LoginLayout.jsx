import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import "bootstrap/dist/css/bootstrap.min.css";

const LoginLayout = () => {
  const [loading, setLoading] = useState(false);
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
            data.inmobiliaria.idinmobiliaria
          );
          localStorage.setItem(
            "nombreinmobiliaria",
            data.inmobiliaria.nombreinmobiliaria
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
    <section className="vh-100">
      <div className="container-fluid h-custom">
        <div className="row d-flex justify-content-center align-items-center h-100">
          <div className="col-md-9 col-lg-6 col-xl-5">
            <img
              src="https://mdbcdn.b-cdn.net/img/Photos/new-templates/bootstrap-login-form/draw2.webp"
              className="img-fluid"
              alt="Login"
            />
          </div>

          <div className="col-md-8 col-lg-6 col-xl-4 offset-xl-1">
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="form-outline mb-4">
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-control form-control-lg"
                  placeholder="Ingresa tu correo"
                  required
                />
                <label className="form-label" htmlFor="email">
                  Correo electrónico
                </label>
              </div>

              {/* Password */}
              <div className="form-outline mb-3">
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-control form-control-lg"
                  placeholder="Ingresa tu contraseña"
                  required
                />
                <label className="form-label" htmlFor="password">
                  Contraseña
                </label>
              </div>

              <div className="text-center text-lg-start mt-4 pt-2">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ paddingLeft: "2.5rem", paddingRight: "2.5rem" }}
                  disabled={loading}
                >
                  {loading ? "Ingresando..." : "Iniciar sesión"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoginLayout;
