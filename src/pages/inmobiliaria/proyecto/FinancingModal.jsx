import { withApiBase } from "../../../config/api.js";
import { authFetch } from "../../../config/authFetch.js";
import React, { useMemo, useState } from "react";
import styles from "./addproyect.module.css";
import FinancingEditor from "./FinancingEditor.jsx";
import {
  parseFinancingConfigState,
  serializeFinancingConfigState,
} from "./financingConfig.js";

const token = localStorage.getItem("access");

export default function FinancingModal({ onClose, proyecto }) {
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
        const error = await res.json().catch(() => ({}));
        console.error("Error guardando financiamiento:", error);
        alert("No se pudo guardar la lógica de financiamiento.");
        return;
      }

      alert("Financiamiento actualizado con éxito");
      onClose?.({ refreshed: true });
    } catch (error) {
      console.error("Error de red guardando financiamiento:", error);
      alert("Error de red al guardar financiamiento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${styles.financingModalContent}`}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Configurar financiamiento</h1>
            <p className={styles.subtitle}>
              Define solo las reglas comerciales del proyecto, sin mapa ni edición general.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <span className="material-icons-outlined">close</span>
          </button>
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
