// AdminLayout — sidebar + header + Outlet for nested /dashboard routes
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Blocks,
  DraftingCompass,
  Trees,
  MapPinned,
  BadgeDollarSign,
  Orbit,
  MessageSquareShare,
  Radar,
  SlidersHorizontal,
  LogOut,
  User,
  Menu,
  X,
} from 'lucide-react';
import { LayoutGroup } from 'framer-motion';
import ThemeSwitch from '../../components/ThemeSwitch';
import { useTheme } from '../../context/ThemeContext';
import { useAdmin } from './AdminContext';
import { withApiBase } from '../../config/api.js';
import AdminSidebarNavItem from './components/AdminSidebarNavItem';
import '../panel/PanelInmo.css';
import './AdminLayout.css';

const navItems = [
  { to: '/dashboard/resumen', label: 'Resumen', description: 'Salud comercial y alertas', icon: LayoutDashboard, accent: 'emerald' },
  { to: '/dashboard/proyectos', label: 'Proyectos', description: 'Portafolio y publicación', icon: Building2, accent: 'sky' },
  { to: '/dashboard/lotes', label: 'Lotes', description: 'Inventario y estados', icon: Blocks, accent: 'amber' },
  { to: '/dashboard/plano', label: 'Plano', description: 'Trazado y masterplan', icon: DraftingCompass, accent: 'violet' },
  { to: '/dashboard/espacios', label: 'Espacios', description: 'Parques, áreas y POIs', icon: Trees, accent: 'green' },
  { to: '/dashboard/iconos', label: 'Íconos', description: 'Marcadores del proyecto', icon: MapPinned, accent: 'rose' },
  { to: '/dashboard/financiamiento', label: 'Financiamiento', description: 'Reglas comerciales', icon: BadgeDollarSign, accent: 'blue' },
  { to: '/dashboard/media', label: 'Tours y Media', description: '360 y recursos visuales', icon: Orbit, accent: 'cyan' },
  { to: '/dashboard/leads', label: 'Leads', description: 'Interés y contactos', icon: MessageSquareShare, accent: 'orange' },
  { to: '/dashboard/mapa-publico', label: 'Mapa Público', description: 'Enlace y visibilidad', icon: Radar, accent: 'teal' },
  { to: '/dashboard/configuracion', label: 'Configuración', description: 'Perfil y sesión', icon: SlidersHorizontal, accent: 'slate' },
];

export default function AdminLayout({ setAppLoading }) {
  const { isDark, toggleTheme } = useTheme();
  const { loading } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileOverlayRef = useRef(null);
  const navRef = useRef(null);
  const wheelLockRef = useRef(false);
  const wheelDeltaRef = useRef(0);
  const publicBase = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL;
  const logoSrc = `${publicBase}${isDark ? 'geohabitalight.png' : 'geohabita.png'}`;

  const nombre = localStorage.getItem('nombre');
  const nombreInmo = localStorage.getItem('nombreinmobiliaria');

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setAppLoading?.(loading);
  }, [loading, setAppLoading]);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Close mobile sidebar on overlay click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileSidebarOpen && mobileOverlayRef.current === e.target) {
        setMobileSidebarOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return undefined;

    let frameId = null;

    const clampActiveItemIntoView = (behavior = 'auto') => {
      const activeLink = navEl.querySelector('.admin-sidebar-link--active');
      if (!activeLink) return;

      const navRect = navEl.getBoundingClientRect();
      const activeRect = activeLink.getBoundingClientRect();
      const topInset = 24;
      const bottomInset = 132;
      const activeTop = activeRect.top - navRect.top + navEl.scrollTop;
      const activeBottom = activeRect.bottom - navRect.top + navEl.scrollTop;
      const visibleTop = navEl.scrollTop + topInset;
      const visibleBottom = navEl.scrollTop + navEl.clientHeight - bottomInset;

      if (activeTop < visibleTop) {
        navEl.scrollTo({
          top: Math.max(0, activeTop - topInset),
          behavior,
        });
        return;
      }

      if (activeBottom > visibleBottom) {
        const nextTop = activeBottom - navEl.clientHeight + bottomInset;
        const maxTop = navEl.scrollHeight - navEl.clientHeight;
        navEl.scrollTo({
          top: Math.min(maxTop, Math.max(0, nextTop)),
          behavior,
        });
      }
    };

    const scheduleClamp = (behavior = 'auto') => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        clampActiveItemIntoView(behavior);
      });
    };

    const handleScroll = () => {
      scheduleClamp('auto');
    };

    scheduleClamp('auto');
    navEl.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      navEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [location.pathname, sidebarOpen, mobileSidebarOpen]);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return undefined;

    const threshold = 42;
    const releaseLock = () => {
      wheelLockRef.current = false;
      wheelDeltaRef.current = 0;
    };

    const handleWheel = (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (wheelLockRef.current) {
        event.preventDefault();
        return;
      }

      const currentIndex = navItems.findIndex(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
      );
      if (currentIndex === -1) return;

      wheelDeltaRef.current += event.deltaY;
      const isAtFirst = currentIndex === 0;
      const isAtLast = currentIndex === navItems.length - 1;
      const isTryingPastStart = event.deltaY < 0 && isAtFirst;
      const isTryingPastEnd = event.deltaY > 0 && isAtLast;

      if (isTryingPastStart || isTryingPastEnd) {
        wheelDeltaRef.current = 0;
        event.preventDefault();
        return;
      }

      if (Math.abs(wheelDeltaRef.current) < threshold) {
        event.preventDefault();
        return;
      }

      const direction = wheelDeltaRef.current > 0 ? 1 : -1;
      const nextIndex = currentIndex + direction;

      wheelDeltaRef.current = 0;
      event.preventDefault();

      if (nextIndex < 0 || nextIndex >= navItems.length) {
        return;
      }

      wheelLockRef.current = true;
      navigate(navItems[nextIndex].to);
      window.setTimeout(releaseLock, 260);
    };

    navEl.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      navEl.removeEventListener('wheel', handleWheel);
      releaseLock();
    };
  }, [location.pathname, navigate]);

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

  const currentItem = navItems.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/'),
  );
  const currentNavLabel = currentItem?.label;

  return (
    <div className={`admin-layout ${isDark ? 'dark' : ''} ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside
        className={`admin-sidebar ${mobileSidebarOpen ? 'admin-sidebar--mobile-open' : ''}`}
      >
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logoWrap">
            <img src={logoSrc} alt="GeoHabita" className="admin-sidebar-logoImage" />
          </div>
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand-name">{nombreInmo || 'GeoHabita'}</span>
            <span className="admin-sidebar-brand-sub">GeoHabita Admin</span>
          </div>
        </div>

        <LayoutGroup id="admin-sidebar-nav">
          <nav ref={navRef} className="admin-sidebar-nav">
            {navItems.map((item) => (
              <AdminSidebarNavItem
                key={item.to}
                item={item}
                pathname={location.pathname}
                isCollapsed={!sidebarOpen}
              />
            ))}
            <div className="admin-sidebar-navSpacer" aria-hidden="true" />
          </nav>
        </LayoutGroup>
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div ref={mobileOverlayRef} className="admin-sidebar-overlay" />
      )}

      {/* Main area */}
      <div className="admin-main">
        {/* Top bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-mobile-menu-btn"
              onClick={() => setMobileSidebarOpen((prev) => !prev)}
              aria-label="Menú"
            >
              {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <button
              className="admin-desktop-collapse-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title="Colapsar menú"
            >
              <Menu size={20} />
            </button>
            {currentNavLabel && (
              <span className="admin-breadcrumb">{currentNavLabel}</span>
            )}
          </div>
          <div className="admin-topbar-right">
            <ThemeSwitch checked={isDark} onChange={toggleTheme} className="theme-switch-horizontal" />
            <div className="admin-topbar-account">
              <div className="admin-sidebar-user admin-topbar-user">
                <div className="admin-sidebar-avatar">
                  <User size={18} />
                </div>
                <div className="admin-sidebar-user-info">
                  <span className="admin-sidebar-user-name">{nombre || 'Usuario'}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="admin-sidebar-logout admin-topbar-logout" title="Cerrar sesión">
                <LogOut size={16} />
                <span className="admin-sidebar-link-label">Salir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="admin-content">
          <div className="admin-route-stage">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
