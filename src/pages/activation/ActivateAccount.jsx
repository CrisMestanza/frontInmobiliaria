import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { withApiBase } from "../../config/api.js";

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Validando enlace...");
  const [ok, setOk] = useState(false);
  const [correo, setCorreo] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const uid = searchParams.get("uid");
    const token = searchParams.get("token");

    if (!uid || !token) {
      setMessage("El enlace de activación es inválido.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(
          withApiBase("https://api.geohabita.com/api/activation/confirm/"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, token }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data?.message || "No se pudo activar la cuenta.");
          setLoading(false);
          return;
        }
        setOk(true);
        setMessage(data?.message || "Cuenta activada correctamente.");
      } catch (_error) {
        setMessage("Error de conexión al activar la cuenta.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [searchParams]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "520px", border: "1px solid #d1d5db", borderRadius: "12px", padding: "24px", background: "#fff" }}>
        <h1 style={{ marginTop: 0 }}>Activación de cuenta</h1>
        <p>{loading ? "Procesando..." : message}</p>
        {!loading && !ok ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!correo.trim() || resendLoading) return;
              setResendLoading(true);
              try {
                const res = await fetch(
                  withApiBase("https://api.geohabita.com/api/activation/resend/"),
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ correo: correo.trim() }),
                  },
                );
                const data = await res.json().catch(() => ({}));
                setMessage(
                  data?.message ||
                    "Si el correo está pendiente de activación, enviaremos un nuevo enlace.",
                );
              } catch (_error) {
                setMessage("No se pudo reenviar el correo de activación.");
              } finally {
                setResendLoading(false);
              }
            }}
            style={{ display: "grid", gap: "8px", marginBottom: "12px" }}
          >
            <label htmlFor="correo">Reenviar activación</label>
            <input
              id="correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu_correo@dominio.com"
              required
              style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db" }}
            />
            <button
              type="submit"
              disabled={resendLoading}
              style={{ padding: "10px 14px", borderRadius: "8px", border: "none", background: "#17a16e", color: "#fff", cursor: "pointer" }}
            >
              {resendLoading ? "Enviando..." : "Reenviar enlace"}
            </button>
          </form>
        ) : null}
        {!loading ? (
          <Link to="/login">
            {ok ? "Ir a iniciar sesión" : "Volver a iniciar sesión"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
