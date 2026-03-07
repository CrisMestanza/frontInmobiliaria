import React, { useEffect, useMemo, useState } from "react";
import "./GlobalAlertOverlay.css";

const toMessage = (value) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "Mensaje del sistema";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "Mensaje del sistema";
    }
  }
  return String(value);
};

const TYPE_META = {
  success: { icon: "check_circle" },
  error: { icon: "error" },
  warning: { icon: "warning" },
  info: { icon: "info" },
};

const detectType = (message) => {
  const text = (message || "").toLowerCase();
  if (
    text.includes("error") ||
    text.includes("incorrect") ||
    text.includes("fall") ||
    text.includes("no se pudo") ||
    text.includes("inval") ||
    text.includes("❌") ||
    text.includes("🚫")
  ) {
    return "error";
  }
  if (
    text.includes("exito") ||
    text.includes("correctamente") ||
    text.includes("guardad") ||
    text.includes("registrad") ||
    text.includes("eliminad") ||
    text.includes("copiad") ||
    text.includes("✅")
  ) {
    return "success";
  }
  if (text.includes("aviso") || text.includes("⚠️") || text.includes("advert")) {
    return "warning";
  }
  return "info";
};

const GlobalAlertOverlay = () => {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const nativeAlert = window.alert.bind(window);
    const pushAlert = (message, type) => {
      const normalizedMessage = toMessage(message);
      setQueue((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          message: normalizedMessage,
          type: type || detectType(normalizedMessage),
        },
      ]);
    };

    window.alert = (message) => {
      pushAlert(message);
    };
    window.alertSuccess = (message) => pushAlert(message, "success");
    window.alertError = (message) => pushAlert(message, "error");
    window.alertWarning = (message) => pushAlert(message, "warning");
    window.alertInfo = (message) => pushAlert(message, "info");

    return () => {
      window.alert = nativeAlert;
      delete window.alertSuccess;
      delete window.alertError;
      delete window.alertWarning;
      delete window.alertInfo;
    };
  }, []);

  const current = useMemo(() => queue[0] || null, [queue]);

  const closeCurrent = () => {
    setQueue((prev) => prev.slice(1));
  };

  if (!current) return null;
  const meta = TYPE_META[current.type] || TYPE_META.info;

  return (
    <div
      className="global-alert-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCurrent();
      }}
      role="presentation"
    >
      <div
        className={`global-alert-card global-alert-${current.type || "info"}`}
        role="alertdialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="global-alert-close"
          onClick={closeCurrent}
          aria-label="Cerrar alerta"
        >
          x
        </button>
        <div className="global-alert-icon-wrap" aria-hidden="true">
          <span className="material-symbols-outlined global-alert-icon">
            {meta.icon}
          </span>
        </div>
        <p className="global-alert-message">{current.message}</p>
      </div>
    </div>
  );
};

export default GlobalAlertOverlay;
