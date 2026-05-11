import { withApiBase } from "../../config/api";

/**
 * Genera la URL de la imagen OG para compartir un lote o proyecto.
 * El backend debe exponer /api/og-image/proyecto/{id}/ o /api/og-image/lote/{id}/
 * que retorne una imagen PNG/JPG generada dinámicamente con:
 * - Foto principal del lote/proyecto
 * - Nombre
 * - Precio
 * - Logo de GeoHabita
 *
 * Si el backend no tiene este endpoint todavía, se usa una imagen de fallback.
 */
export const getOgImageUrl = (type, id, fallbackImage = null) => {
  if (!type || !id) return "/geohabita.png";

  const base = withApiBase("https://api.geohabita.com");
  const ogUrl = `${base}/api/og-image/${type}/${id}/`;

  // Si hay una imagen de fallback, la pasamos como query param
  // para que el backend pueda usarla si no tiene una propia
  if (fallbackImage) {
    const encoded = encodeURIComponent(fallbackImage);
    return `${ogUrl}?fallback=${encoded}`;
  }

  return ogUrl;
};

export const getSharePageUrl = (type, id) => {
  if (!type || !id) return "https://www.geohabita.com";
  const base = withApiBase("https://api.geohabita.com");
  return `${base}/share/${type}/${id}/`;
};

/**
 * Construye los metadatos OG para compartir.
 * Usado por el Web Share API y para generar tags dinámicos.
 */
export const buildShareMeta = ({
  title,
  description,
  imageUrl,
  url,
  type = "website",
}) => ({
  title: title || "GeoHabita",
  description: description || "Compra & Venta de Terrenos",
  image: imageUrl || "/geohabita.png",
  url: url || "https://www.geohabita.com",
  type,
});

/**
 * Comparte usando la Web Share API con metadatos OG.
 */
export const shareWithMeta = async (meta) => {
  const shareData = {
    title: meta.title,
    text: meta.description,
    url: meta.url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(meta.url);
      window.alertSuccess?.("Link copiado al portapapeles");
      return true;
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("No se pudo compartir:", error);
    }
  }

  // Fallback: prompt
  window.prompt("Copia el link para compartir:", meta.url);
  return false;
};
