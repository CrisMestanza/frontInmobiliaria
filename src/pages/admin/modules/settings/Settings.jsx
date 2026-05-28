// Settings — Configuración de la inmobiliaria, branding, sesión
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, LogOut, Globe } from 'lucide-react';
import { withApiBase } from '../../../../config/api.js';
import './Settings.css';

export default function SettingsPage() {
  const navigate = useNavigate();
  const nombre = localStorage.getItem('nombre');
  const nombreInmo = localStorage.getItem('nombreinmobiliaria');
  const email = localStorage.getItem('email') || localStorage.getItem('correo');
  const idInmo = localStorage.getItem('idinmobiliaria');

  const handleLogout = async () => {
    const token = localStorage.getItem('access');
    try {
      await fetch(withApiBase('https://api.geohabita.com/api/logout/'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Configuración</h2>
        <p>Datos de la inmobiliaria y preferencias</p>
      </div>

      {/* Info cards */}
      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-icon"><Building2 size={22} /></div>
          <div>
            <span className="settings-card-label">Inmobiliaria</span>
            <strong>{nombreInmo || 'Sin nombre'}</strong>
            <small>ID: {idInmo || '—'}</small>
          </div>
        </div>
        <div className="settings-card">
          <div className="settings-card-icon"><User size={22} /></div>
          <div>
            <span className="settings-card-label">Usuario</span>
            <strong>{nombre || 'Sin nombre'}</strong>
            <small>{email || 'Sin correo'}</small>
          </div>
        </div>
        <div className="settings-card">
          <div className="settings-card-icon"><Globe size={22} /></div>
          <div>
            <span className="settings-card-label">Mapa Público</span>
            <strong>/mapa/{idInmo || '...'}</strong>
            <small>Enlace compartible con clientes</small>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="settings-section">
        <h3>Acciones</h3>
        <div className="settings-actions">
          <button onClick={() => navigate('/dashboard/mapa-publico')} className="settings-action-btn">
            <Globe size={18} /> Ver Mapa Público
          </button>
          <button onClick={handleLogout} className="settings-action-btn settings-action-btn--logout">
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="settings-footer-note">
        <p>
          <strong>GeoHabita</strong> — Panel de administración inmobiliaria.
          <br />
          La configuración avanzada (branding, redes sociales, datos de contacto) se gestiona desde el backend o próximas versiones.
        </p>
      </div>
    </div>
  );
}
