import React, { useState, useEffect, useRef } from "react";
import {
  FaBed, FaBath, FaCar, FaTree, FaHome, FaUtensils,
  FaChair, FaSun, FaBuilding, FaBorderAll, FaCampground,
  FaRulerHorizontal, FaRulerVertical, FaRulerCombined,
  FaChevronLeft, FaChevronRight, FaFacebook, FaWhatsapp, FaGlobe
} from "react-icons/fa";
import styles from "./Proyecto.module.css";

const ProyectoSidebar = ({ inmo, proyecto, imagenes = [], onClose, walkingInfo, drivingInfo, mapRef }) => {
  const [expanded, setExpanded] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [fullscreenImgIndex, setFullscreenImgIndex] = useState(null);
  const contentRef = useRef(null);

  const nextSlide = (e) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev === imagenes.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = (e) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev === 0 ? imagenes.length - 1 : prev - 1));
  };

  const cerrarSidebar = () => {
    onClose();
    if (mapRef?.current) mapRef.current.setZoom(13);
  };

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && cerrarSidebar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop } = contentRef.current;
    if (!expanded && scrollTop > 400) setExpanded(true);
    if (expanded && scrollTop < 5) setExpanded(false);
  };

  if (!proyecto) return null;

  return (
    <>

      <div
        className={styles.overlay}
        style={{
          opacity: expanded ? 1 : 0,
          background: "rgba(15, 23, 42, 0.2)", // Más transparente para ver el fondo
          pointerEvents: (proyecto.idtipoinmobiliaria === 2 || expanded) ? "auto" : "none"
        }}
        onClick={cerrarSidebar} // Permitimos cerrar al tocar la parte de arriba
      />

      <div className={`${styles.sidebar} ${expanded ? styles.expanded : ""}`}>
        <button className={styles.closeBtn} onClick={cerrarSidebar} aria-label="Cerrar">✕</button>

        <div className={styles.splitLayout}>
          {/* SECCIÓN IMAGEN / SLIDER */}
          <div className={styles.imageSection}>
            {imagenes.length > 0 ? (
              <>
                <img
                  src={`https://apiinmo.y0urs.com${imagenes[currentImg].imagenproyecto}`}
                  alt="Propiedad"
                  className={styles.mainImage}
                  onClick={() => setFullscreenImgIndex(currentImg)}
                />
                {imagenes.length > 1 && (
                  <div className={styles.sliderControls}>
                    <button onClick={prevSlide} className={styles.navArrow}><FaChevronLeft /></button>
                    <button onClick={nextSlide} className={styles.navArrow}><FaChevronRight /></button>
                  </div>
                )}
                <div className={styles.imageBadge}>{currentImg + 1} / {imagenes.length} FOTOS</div>
              </>
            ) : (
              <div className={styles.noImage}>No hay imagenes referenciales</div>
            )}
          </div>

          {/* SECCIÓN INFORMACIÓN */}
          <div className={styles.infoSection} ref={contentRef} onScroll={handleScroll}>
            <div className={styles.primeInfo}>
              {proyecto.idtipoinmobiliaria === 2 && (
                <span className={styles.legalLabel}>
                  {proyecto.titulo_propiedad ? "✓ Cuenta con titulo" : "• No cuenta con titulo"}
                </span>
              )}
              <h1 className={styles.nombreProyecto}>{proyecto.nombreproyecto}</h1>
              <p className={styles.ubicacion}>📍 {proyecto.descripcion?.split('.')[0]}</p>

              <div className={styles.priceContainer}>
                {proyecto.idtipoinmobiliaria === 2 && (

                  <div>
                    <span className={styles.labelSmall}>Inversión</span>
                    <span className={styles.priceValue}>${proyecto.precio}</span>
                  </div>
                )}
                <a href={`https://wa.me/${inmo.whatsapp}`} target="_blank" rel="noreferrer" className={styles.contactMiniBtn}>
                  <FaWhatsapp /> Contactar
                </a>
              </div>
              {proyecto.idtipoinmobiliaria === 2 && (
                <div className={styles.quickGrid}>
                  <div className={styles.qBadge}>
                    <FaRulerCombined />
                    <div>
                      <strong>{proyecto.area_total_m2} m²</strong>
                      <span>Extensión</span>
                    </div>
                  </div>
                  <div className={styles.qBadge}>
                    <FaRulerCombined />
                    <div>
                      <strong>{proyecto.ancho} m</strong>
                      <span>Ancho</span>
                    </div>
                  </div>
                  <div className={styles.qBadge}>
                    <FaRulerCombined />
                    <div>
                      <strong>{proyecto.largo} m</strong>
                      <span>Largo</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.extraContent}>
              {/* <hr className={styles.divider} /> */}
              <br></br>
              <h3 className={styles.sectionTitle}>Descripción</h3>
              <p className={styles.fullDescription}>{proyecto.descripcion}</p>

              {proyecto.idtipoinmobiliaria === 2 && (
                <>
                  <h3 className={styles.sectionTitle}>Características</h3>
                  <div className={styles.featuresGrid}>
                    {/* Habitaciones y Baños */}
                    <div className={styles.fItem}><FaBed /> {proyecto.dormitorios} Dorm.</div>
                    <div className={styles.fItem}><FaBath /> {proyecto.banos} Baños</div>
                    <div className={styles.fItem}><FaHome /> {proyecto.cuartos} Cuartos</div>

                    {/* Áreas Internas */}
                    <div className={styles.fItem}><FaChair /> {proyecto.sala} Sala</div>
                    <div className={styles.fItem}><FaUtensils /> {proyecto.cocina} Cocina</div>
                    <div className={styles.fItem}><FaCar /> {proyecto.cochera} Cochera</div>

                    {/* Exteriores y extras (Se muestran solo si el valor es >= 1) */}
                    {proyecto.patio > 0 && <div className={styles.fItem}><FaCampground /> {proyecto.patio} Patio</div>}
                    {proyecto.jardin > 0 && <div className={styles.fItem}><FaTree /> {proyecto.jardin} Jardín</div>}
                    {proyecto.terraza > 0 && <div className={styles.fItem}><FaSun /> {proyecto.terraza} Terraza</div>}
                    {proyecto.azotea > 0 && <div className={styles.fItem}><FaBuilding /> {proyecto.azotea} Azotea</div>}
                  </div>
                </>
              )}

              <h3 className={styles.sectionTitle}>Distancia de tu ubicación o de la ubicación buscada</h3>
              <div className={styles.distanciaBox}>
                <span>🚶 {walkingInfo?.duration || "Calc..."}</span>
                <span>🚗 {drivingInfo?.duration || "Calc..."}</span>
              </div>

              <div className={styles.socialFooter}>
                <a href={inmo.facebook} target="_blank" rel="noreferrer"><FaFacebook /></a>
                <a href={inmo.pagina} target="_blank" rel="noreferrer"><FaGlobe /></a>
              </div>
            </div>
          </div>
        </div>
      </div>



      {fullscreenImgIndex !== null && (
        <div className={styles.fullscreenOverlay} onClick={() => setFullscreenImgIndex(null)}>
          {/* Botón Cerrar (opcional, ya que el fondo cierra) */}
          <button className={styles.closeFS} onClick={() => setFullscreenImgIndex(null)}>✕</button>

          {imagenes.length > 1 && (
            <>
              {/* Navegación Pantalla Completa */}
              <button
                className={`${styles.navArrowFS} ${styles.prevFS}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImgIndex(prev => (prev === 0 ? imagenes.length - 1 : prev - 1));
                }}
              >
                <FaChevronLeft />
              </button>

              <button
                className={`${styles.navArrowFS} ${styles.nextFS}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImgIndex(prev => (prev === imagenes.length - 1 ? 0 : prev + 1));
                }}
              >
                <FaChevronRight />
              </button>
            </>
          )}

          <img
            src={`https://apiinmo.y0urs.com${imagenes[fullscreenImgIndex].imagenproyecto}`}
            className={styles.fullscreenImg}
            alt="Zoom"
            onClick={(e) => e.stopPropagation()} // Evita que se cierre al tocar la imagen misma
          />

          <div className={styles.fsBadge}>
            {fullscreenImgIndex + 1} / {imagenes.length}
          </div>
        </div>
      )}
    </>
  );
};

export default ProyectoSidebar;