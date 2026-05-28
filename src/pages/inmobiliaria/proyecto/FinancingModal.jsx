import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
import { getResponseErrorMessage } from "../../../utils/apiErrors.js";
import React, { useMemo, useState } from "react";
import styles from "./addproyect.module.css";
import FinancingEditor from "./FinancingEditor.jsx";
import {
  parseFinancingConfigState,
  serializeFinancingConfigState,
} from "./financingConfig.js";

const token = localStorage.getItem("access");

export default function FinancingModal({ onClose, proyecto, embedded = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const financingBaseState = useMemo(
    () =>
      parseFinancingConfigState(
        proyecto?.financing_config,
        proyecto?.precio,
        proyecto?.moneda || "S/",
      ),
    [proyecto?.financing_config, proyecto?.precio, proyecto?.moneda],
  );
  const [financingState, setFinancingState] = useState(financingBaseState);

  const currency = proyecto?.moneda || "S/";
  const projectPrice = Number(
    financingState?.price_reference || proyecto?.precio || 0,
  );
  const projectName = proyecto?.nombreproyecto || "Proyecto";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proyecto?.idproyecto) return;

    setIsSubmitting(true);
    try {
      const res = await authFetch(
        withApiBase(
          `https://api.geohabita.com/api/updateProyecto/${proyecto.idproyecto}/`,
        ),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            financing_config: serializeFinancingConfigState(
              financingState,
              proyecto?.precio,
              currency,
            ),
          }),
        },
      );

      if (!res.ok) {
        const message = await getResponseErrorMessage(
          res,
          "No se pudo guardar la configuracion de financiamiento.",
        );
        console.error("Error guardando financiamiento:", message);
        if (window.alertError) window.alertError(message);
        else alert(message);
        return;
      }

      if (window.alertSuccess) window.alertSuccess("Financiamiento actualizado con exito");
      else alert("Financiamiento actualizado con exito");
      onClose?.({ refreshed: true });
    } catch (error) {
      console.error("Error de red guardando financiamiento:", error);
      const message =
        error?.message ||
        "No se pudo conectar con el servidor para guardar el financiamiento.";
      if (window.alertError) window.alertError(message);
      else alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const overlayStyle = embedded
    ? {
        position: "relative",
        inset: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: 0,
        zIndex: "auto",
        alignItems: "stretch",
        display: "block",
        overflow: "visible",
      }
    : undefined;

  const contentStyle = embedded
    ? {
        width: "100%",
        maxWidth: "none",
        height: "auto",
        maxHeight: "none",
        minHeight: "auto",
        borderRadius: "24px",
        boxShadow: "none",
        overflow: "visible",
        border: "1px solid rgba(148, 163, 184, 0.16)",
      }
    : undefined;

  return (
    <div className={styles.modalOverlay} style={overlayStyle}>
      <div className={`${styles.modalContent} ${styles.financingModalContent}`} style={contentStyle}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Configurar financiamiento</h1>
            <p className={styles.subtitle}>
              Define solo las reglas comerciales del proyecto, sin mapa ni edición general.
            </p>
          </div>
          {!embedded && (
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              <span className="material-icons-outlined">close</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          <div className={styles.leftColumn}>
            <div className={styles.financingIntroCard}>
              <div>
                <h2 className={styles.financingIntroTitle}>{projectName}</h2>
                <p className={styles.financingIntroText}>
                  Crea una lógica clara para que la inmobiliaria controle iniciales,
                  meses permitidos y escenarios mostrados al cliente. La cifra
                  mostrada abajo es solo un monto guía para simulaciones
                  generales del proyecto, no el precio exacto de cada lote. Si
                  tus lotes tienen precios muy distintos, puedes dejar ese monto
                  en 0 y usar solo reglas de iniciales y plazos.
                </p>
              </div>

              <div className={styles.financingIntroGrid}>
                <div className={styles.financingIntroPill}>
                  <span>Moneda</span>
                  <strong>{currency}</strong>
                </div>
                <div className={styles.financingIntroPill}>
                  <span>Monto guía</span>
                  <strong>
                    {projectPrice
                      ? `${currency} ${projectPrice.toLocaleString("es-PE")}`
                      : "Pendiente"}
                  </strong>
                </div>
                <div className={styles.financingIntroPill}>
                  <span>Estado</span>
                  <strong>
                    {financingState?.enabled === false ? "Desactivado" : "Activo"}
                  </strong>
                </div>
              </div>
            </div>

            <FinancingEditor
              value={financingState}
              onChange={setFinancingState}
              fallbackCurrency={currency}
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Guardar Financiamiento"}
              <span className="material-icons-outlined">save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
