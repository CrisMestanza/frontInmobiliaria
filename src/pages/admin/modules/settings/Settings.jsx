// Settings — Configuración de la inmobiliaria, branding, sesión
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, LogOut, Globe, Save } from 'lucide-react';
import { withApiBase } from '../../../../config/api.js';
import { fetchInmobiliaria, updateInmobiliaria } from '../../../../services/adminService.js';
import './Settings.css';

const EMPTY_FORM = {
  nombreinmobiliaria: '',
  correo: '',
  telefono: '',
  whatsapp: '',
  facebook: '',
  tiktok: '',
  pagina: '',
  descripcion: '',
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const nombre = localStorage.getItem('nombre');
  const idInmo = localStorage.getItem('idinmobiliaria');

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    if (!idInmo) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInmobiliaria(idInmo);
        if (cancelled || !data) return;
        setForm({
          nombreinmobiliaria: data.nombreinmobiliaria || '',
          correo: data.correo || '',
          telefono: data.telefono || '',
          whatsapp: data.whatsapp || '',
          facebook: data.facebook || '',
          tiktok: data.tiktok || '',
          pagina: data.pagina || '',
          descripcion: data.descripcion || '',
        });
      } catch (err) {
        console.error('Error cargando datos de la inmobiliaria:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idInmo]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!idInmo) return;
    setSaving(true);
    setFormError('');
    setFormSuccess(false);
    try {
      const updated = await updateInmobiliaria(idInmo, form);
      localStorage.setItem('nombreinmobiliaria', updated.nombreinmobiliaria || form.nombreinmobiliaria || '');
      setFormSuccess(true);
    } catch (err) {
      console.error('Error actualizando la inmobiliaria:', err);
      setFormError(err?.message || 'No se pudo actualizar la inmobiliaria.');
    } finally {
      setSaving(false);
    }
  };

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

      <div className="settings-layout">
        <div className="settings-main">
          <form className="settings-formCard" onSubmit={handleSubmit}>
            <div className="settings-formCardHead">
              <h3>Datos de la inmobiliaria</h3>
              <p>Corrige aquí la información con la que te ven tus clientes en el mapa público.</p>
            </div>

            {loading ? (
              <p className="settings-formLoading">Cargando datos...</p>
            ) : (
              <>
                {formError && <div className="settings-formAlert settings-formAlert--error">{formError}</div>}
                {formSuccess && (
                  <div className="settings-formAlert settings-formAlert--success">Datos actualizados correctamente ✅</div>
                )}

                <div className="settings-formGrid">
                  <label className="settings-field">
                    <span>Nombre comercial</span>
                    <input
                      type="text"
                      value={form.nombreinmobiliaria}
                      onChange={handleChange('nombreinmobiliaria')}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Correo</span>
                    <input
                      type="email"
                      value={form.correo}
                      onChange={handleChange('correo')}
                      required
                      maxLength={50}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Teléfono</span>
                    <input
                      type="text"
                      value={form.telefono}
                      onChange={handleChange('telefono')}
                      required
                      maxLength={15}
                    />
                  </label>
                  <label className="settings-field">
                    <span>WhatsApp</span>
                    <input
                      type="text"
                      value={form.whatsapp}
                      onChange={handleChange('whatsapp')}
                      maxLength={100}
                      placeholder="Opcional"
                    />
                  </label>
                  <label className="settings-field">
                    <span>Facebook</span>
                    <input
                      type="text"
                      value={form.facebook}
                      onChange={handleChange('facebook')}
                      maxLength={100}
                      placeholder="https://facebook.com/tu-pagina"
                    />
                  </label>
                  <label className="settings-field">
                    <span>TikTok</span>
                    <input
                      type="text"
                      value={form.tiktok}
                      onChange={handleChange('tiktok')}
                      maxLength={100}
                      placeholder="https://tiktok.com/@tu-usuario"
                    />
                  </label>
                  <label className="settings-field settings-field--full">
                    <span>Página web</span>
                    <input
                      type="text"
                      value={form.pagina}
                      onChange={handleChange('pagina')}
                      maxLength={200}
                      placeholder="https://tu-sitio.com"
                    />
                  </label>
                  <label className="settings-field settings-field--full">
                    <span>Descripción</span>
                    <textarea
                      value={form.descripcion}
                      onChange={handleChange('descripcion')}
                      required
                      maxLength={450}
                      rows={4}
                    />
                  </label>
                </div>

                <div className="settings-formActions">
                  <button type="submit" className="settings-action-btn settings-action-btn--primary" disabled={saving}>
                    <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <aside className="settings-side">
          <div className="settings-grid">
            <div className="settings-card">
              <div className="settings-card-icon"><Building2 size={22} /></div>
              <div>
                <span className="settings-card-label">Inmobiliaria</span>
                <strong>{form.nombreinmobiliaria || 'Sin nombre'}</strong>
                <small>ID: {idInmo || '—'}</small>
              </div>
            </div>
            <div className="settings-card">
              <div className="settings-card-icon"><User size={22} /></div>
              <div>
                <span className="settings-card-label">Usuario</span>
                <strong>{nombre || 'Sin nombre'}</strong>
                <small>{form.correo || 'Sin correo'}</small>
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

          <div className="settings-footer-note">
            <p>
              <strong>GeoHabita</strong> — Panel de administración inmobiliaria.
              <br />
              Estos datos se muestran a tus clientes en el mapa público y en tus proyectos.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
