import { Moon, Sun } from "lucide-react";
import styles from "./ThemeSwitch.module.css";

export default function ThemeSwitch({ checked, onChange, className = "" }) {
  return (
    <button
      type="button"
      className={`${styles.switch} ${checked ? styles.switchOn : ""} ${className}`}
      onClick={onChange}
      aria-label={checked ? "Activar modo claro" : "Activar modo oscuro"}
      aria-pressed={checked}
      title={checked ? "Modo oscuro activo" : "Modo claro activo"}
    >
      <span className={styles.track}>
        <span className={styles.thumb}>
          {checked ? (
            <Moon className={styles.icon} aria-hidden="true" />
          ) : (
            <Sun className={styles.icon} aria-hidden="true" />
          )}
        </span>
      </span>
      <span className={styles.label}>{checked ? "Dark" : "Light"}</span>
    </button>
  );
}
