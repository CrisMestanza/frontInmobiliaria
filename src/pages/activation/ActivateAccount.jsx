import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { withApiBase } from "../../config/api.js";
import { getResponseErrorMessage } from "../../utils/apiErrors.js";

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
        if (!res.ok) {
          setMessage(await getResponseErrorMessage(res, "No se pudo activar la cuenta."));
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
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
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "var(--theme-bg-main)", color: "var(--theme-text-main)" }}>
      <div style={{ width: "100%", maxWidth: "520px", border: "1px solid var(--theme-border-color)", borderRadius: "12px", padding: "24px", background: "var(--theme-bg-surface-raised)", boxShadow: "var(--theme-shadow-md)" }}>
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
                if (!res.ok) {
                  setMessage(
                    await getResponseErrorMessage(
                      res,
                      "No se pudo reenviar el correo de activacion.",
                    ),
                  );
                  return;
                }
                const data = await res.json().catch(() => ({}));
                setMessage(data?.message || "Si el correo esta pendiente de activacion, enviaremos un nuevo enlace.");
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
              style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--theme-border-color)", background: "var(--theme-bg-soft)", color: "var(--theme-text-main)" }}
            />
            <button
              type="submit"
              disabled={resendLoading}
              style={{ padding: "10px 14px", borderRadius: "8px", border: "none", background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", cursor: "pointer" }}
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
