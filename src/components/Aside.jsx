// components/Aside.jsx
import React from "react";
import { Link } from "react-router-dom";
import styles from "./aside.module.css";
import {
  FaMapMarkedAlt,
  FaUser,
  FaPlus,
  FaSignInAlt,
  FaHome,
} from "react-icons/fa";

export default function Aside() {
  return (
    <aside className={styles.aside}>
      <div className={styles.content}>
        <h2 className={styles.title}>
          Bienvenido al Panel de <span className={styles.brand}>Habita</span>
        </h2>
        <FaUser className={styles.icon} />

        <nav className={styles.nav}>
          <Link to="/agregar" className={styles.link}>
            <FaPlus className={styles.linkIcon} />
            <span>Agregar</span>
          </Link>

          <Link to="/login" className={styles.link}>
            <FaSignInAlt className={styles.linkIcon} />
            <span>Login</span>
          </Link>

          <Link to="/" className={styles.link}>
            <FaMapMarkedAlt className={styles.linkIcon} />
            <span>Ver Mapa</span>
          </Link>

          <Link to="/panel" className={styles.link}>
            <FaHome className={styles.linkIcon} />
            <span>Panel</span>
          </Link>
        </nav>
      </div>

      <div className={styles.footer}>
        &copy; 2025 <span className={styles.brand}>y0urs</span>
      </div>
    </aside>
  );
}
