import React from "react";
import styles from "./addproyect.module.css";

const basicFieldGroups = [
  {
    name: "price_reference",
    label: "Monto guía del simulador",
    step: "0.01",
    placeholder: "Opcional. Ej. 85000",
    help: "Úsalo solo si quieres mostrar una simulación general del proyecto. Si cada lote maneja precios distintos, puedes dejarlo en 0.",
  },
  {
    name: "default_initial_amount",
    label: "Inicial por defecto",
    step: "0.01",
    placeholder: "Ej. 18000",
    help: "Es la inicial sugerida cuando el cliente abre el simulador.",
  },
  {
    name: "min_initial_amount",
    label: "Inicial mínima",
    step: "0.01",
    placeholder: "Ej. 10000",
    help: "Monto mínimo permitido para la separación o cuota inicial.",
  },
  {
    name: "max_initial_amount",
    label: "Inicial máxima",
    step: "0.01",
    placeholder: "Ej. 40000",
    help: "Útil para evitar que el cliente supere la lógica comercial establecida.",
  },
  {
    name: "default_months",
    label: "Meses por defecto",
    step: "1",
    placeholder: "Ej. 36",
    help: "Plazo inicial sugerido en el simulador.",
  },
  {
    name: "min_months",
    label: "Meses mínimos",
    step: "1",
    placeholder: "Ej. 12",
    help: "Define el plazo más corto que sí quieres ofrecer.",
  },
  {
    name: "max_months",
    label: "Meses máximos",
    step: "1",
    placeholder: "Ej. 60",
    help: "Define el plazo más largo permitido en tu propuesta comercial.",
  },
  {
    name: "annual_interest_rate",
    label: "Tasa anual (%)",
    step: "0.01",
    placeholder: "Ej. 8.5",
    help: "Si no aplicas interés, puedes dejarlo en 0.",
  },
];

export default function FinancingEditor({
  value,
  onChange,
  currencyOptions = [],
  fallbackCurrency = "S/",
}) {
  const presets = (value.presets || []).slice(0, 3);
  const financingEnabled = value.enabled !== false;

  const handleFieldChange = (name, rawValue) => {
    const nextValue =
      name === "enabled"
        ? Boolean(rawValue)
        : name === "notes" || name === "currency"
          ? rawValue
          : rawValue === ""
            ? ""
            : Number(rawValue);
    onChange((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const handlePresetChange = (index, key, rawValue) => {
    onChange((prev) => ({
      ...prev,
      presets: (prev.presets || []).map((preset, presetIndex) =>
        presetIndex === index
          ? {
              ...preset,
              [key]:
                key === "label"
                  ? rawValue
                  : rawValue === ""
                    ? ""
                    : Number(rawValue),
            }
          : preset,
      ),
    }));
  };

  const handleToggleEnabled = () => {
    onChange((prev) => ({
      ...prev,
      enabled: !(prev.enabled !== false),
    }));
  };

  const handleAddPreset = () => {
    onChange((prev) => {
      const nextPresets = [...(prev.presets || [])];
      if (nextPresets.length >= 3) return prev;
      nextPresets.push({
        label: "",
        months: "",
        initial_amount: "",
      });
      return {
        ...prev,
        enabled: true,
        presets: nextPresets,
      };
    });
  };

  const handleRemovePreset = (index) => {
    onChange((prev) => ({
      ...prev,
      presets: (prev.presets || []).filter((_, presetIndex) => presetIndex !== index),
    }));
  };

  return (
    <section>
      <h2 className={styles.sectionTitle}>
        <span className="material-icons-outlined">payments</span>{" "}
        Financiamiento
      </h2>

      <div className={styles.sectionCard}>
        <div className={styles.financingToggleCard}>
          <div>
            <strong>Mostrar financiamiento en este proyecto</strong>
            <span>
              Puedes dejar el módulo sin financiamiento ni planes rápidos. Si lo activas, defines límites y hasta 3 escenarios comerciales.
            </span>
          </div>
          <button
            type="button"
            className={`${styles.utilitySwitch} ${financingEnabled ? styles.utilitySwitchActive : ""}`}
            onClick={handleToggleEnabled}
            aria-pressed={financingEnabled}
          >
            <span className={styles.utilitySwitchCopy}>
              <strong>{financingEnabled ? "Activado" : "Desactivado"}</strong>
              <small>{financingEnabled ? "El cliente verá simulación y presets si existen." : "No se mostrará financiamiento."}</small>
            </span>
            <span className={`${styles.switchTrack} ${financingEnabled ? styles.switchTrackActive : ""}`}>
              <span className={styles.switchThumb} />
            </span>
          </button>
        </div>

        {!financingEnabled ? (
          <div className={styles.financingPresetEmpty}>
            El proyecto se guardará sin financiamiento visible. Puedes activarlo después cuando realmente quieras usar simulación o planes rápidos.
          </div>
        ) : (
          <>
        <div className={styles.controlGrid}>
          <div className={styles.controlField}>
            <label>Moneda</label>
            <select
              className={styles.select}
              value={value.currency || fallbackCurrency}
              onChange={(e) => handleFieldChange("currency", e.target.value)}
            >
              {[fallbackCurrency, ...currencyOptions]
                .filter(Boolean)
                .filter((item, index, arr) => arr.indexOf(item) === index)
                .map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className={styles.compactGrid}>
          {basicFieldGroups.map((field) => (
            <div key={field.name} className={styles.compactField}>
              <label htmlFor={`financing-${field.name}`}>{field.label}</label>
              <input
                id={`financing-${field.name}`}
                type="number"
                min="0"
                step={field.step}
                className={`${styles.input} ${styles.compactInput}`}
                value={value[field.name]}
                placeholder={field.placeholder}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
              />
              <small className={styles.financingFieldHint}>{field.help}</small>
            </div>
          ))}
        </div>

        <div className={styles.actionRow}>
          <div className={styles.hintBox}>
            <strong>Qué verá el cliente</strong>
            <span>
              Ajustará inicial y meses dentro de tus límites, y el sistema
              calculará cuota estimada, total pagado e ingreso sugerido.
            </span>
            <span className={styles.hintMeta}>
              Los cargos, seguros, pago final, gracia y comisiones avanzadas
              siguen desactivados en esta versión simplificada.
            </span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.financingPresetHeader}>
            <div>
              <label>Planes rápidos</label>
              <small className={styles.financingFieldHint}>
                Puedes usar de 0 a 3 planes. Si no agregas ninguno, el proyecto seguirá teniendo financiamiento general sin atajos visibles.
              </small>
            </div>
            <span className={styles.financingPresetHeaderMeta}>
              {presets.length}/3 planes
            </span>
          </div>

          <div className={styles.financingPresetActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleAddPreset}
              disabled={presets.length >= 3}
            >
              Agregar plan
            </button>
          </div>

          {presets.length > 0 ? (
            <div className={styles.financingPresetGrid}>
              {presets.map((preset, index) => (
                <div key={`preset-${index}`} className={styles.financingPresetCard}>
                  <div className={styles.financingPresetCardHead}>
                    <span className={styles.financingPresetTag}>Plan {index + 1}</span>
                    <div className={styles.financingPresetCardTitleRow}>
                      <strong>{preset.label || `Escenario ${index + 1}`}</strong>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => handleRemovePreset(index)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  <div className={styles.compactField}>
                    <label htmlFor={`preset-label-${index}`}>Etiqueta</label>
                    <input
                      id={`preset-label-${index}`}
                      className={`${styles.input} ${styles.compactInput}`}
                      value={preset.label}
                      placeholder="Ej. Cuota flexible"
                      onChange={(e) =>
                        handlePresetChange(index, "label", e.target.value)
                      }
                    />
                  </div>
                  <div className={styles.compactGridTwo}>
                    <div className={styles.compactField}>
                      <label htmlFor={`preset-months-${index}`}>Meses</label>
                      <input
                        id={`preset-months-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        className={`${styles.input} ${styles.compactInput}`}
                        value={preset.months}
                        placeholder="36"
                        onChange={(e) =>
                          handlePresetChange(index, "months", e.target.value)
                        }
                      />
                    </div>
                    <div className={styles.compactField}>
                      <label htmlFor={`preset-initial-${index}`}>Inicial</label>
                      <input
                        id={`preset-initial-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={`${styles.input} ${styles.compactInput}`}
                        value={preset.initial_amount}
                        placeholder="18000"
                        onChange={(e) =>
                          handlePresetChange(index, "initial_amount", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.financingPresetEmpty}>
              Este proyecto no tiene planes rápidos configurados. Puedes guardarlo sin ellos o agregar presets desde la configuración base.
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="financing-notes">Indicaciones visibles para el equipo</label>
          <textarea
            id="financing-notes"
            rows="3"
            className={styles.textarea}
            value={value.notes || ""}
            placeholder="Ej. El cliente puede negociar la inicial dentro del rango establecido y elegir entre 24, 36 o 48 meses."
            onChange={(e) => handleFieldChange("notes", e.target.value)}
          />
          <small className={styles.financingFieldHint}>
            Usa este campo para dejar claro cómo debe entenderse la propuesta comercial.
          </small>
        </div>
          </>
        )}
      </div>
    </section>
  );
}
