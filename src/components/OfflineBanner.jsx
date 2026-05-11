import React, { useEffect, useState } from "react";

const OFFLINE_PROJECTS_KEY = "geohabita_offline_projects";

/**
 * Banner que aparece cuando el usuario está sin conexión.
 * Además expone helpers para cachear proyectos offline vía IndexedDB.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <>
      <style>{bannerStyles}</style>
      <div className="ob-banner" role="alert" aria-live="polite">
        <span className="ob-dot" />
        <span className="ob-text">
          Sin conexión — los datos pueden estar desactualizados.
        </span>
      </div>
    </>
  );
}

/**
 * Guarda una lista de proyectos en IndexedDB para acceso offline.
 */
export async function cacheProjectsOffline(projects) {
  if (!Array.isArray(projects)) return;
  try {
    const { openDB } = await import("idb");
    const db = await openDB("geohabita_offline", 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("projects")) {
          d.createObjectStore("projects");
        }
      },
    });
    const tx = db.transaction("projects", "readwrite");
    await Promise.all([
      ...projects.map((p) => tx.store.put(p, String(p.idproyecto))),
      tx.done,
    ]);
    db.close();
  } catch {
    // IndexedDB no disponible (modo incógnito, etc.)
  }
}

/**
 * Recupera proyectos cacheados offline.
 */
export async function getOfflineProjects() {
  try {
    const { openDB } = await import("idb");
    const db = await openDB("geohabita_offline", 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("projects")) {
          d.createObjectStore("projects");
        }
      },
    });
    const projects = await db.getAll("projects");
    db.close();
    return projects;
  } catch {
    return [];
  }
}

/**
 * Hook que devuelve si hay conexión y los proyectos offline.
 */
export function useOfflineStatus() {
  const [online, setOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );

  useEffect(() => {
    const goOffline = () => setOnline(false);
    const goOnline = () => setOnline(true);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return { online };
}

const bannerStyles = `
.ob-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  background: #f59e0b;
  color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 2px 12px rgba(245, 158, 11, 0.3);
}

.ob-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0f172a;
  animation: obPulse 1.5s ease-in-out infinite;
}

@keyframes obPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.3; transform: scale(1.5); }
}

.ob-text {
  line-height: 1.4;
}
`;
