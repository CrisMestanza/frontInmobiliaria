import React, { useState, useEffect, useRef } from "react";
import {
  FaRulerCombined, FaRulerHorizontal, FaRulerVertical,
  FaChevronLeft, FaChevronRight, FaFacebook, FaWhatsapp, FaGlobe,
  FaMapMarkerAlt, FaCheckCircle, FaTimesCircle,
  // ESTOS SON LOS QUE FALTABAN:
  FaBed, FaBath, FaHome, FaChair, FaUtensils, FaCar,
  FaCampground, FaTree, FaSun, FaBuilding
} from "react-icons/fa";
import styles from "./Lote.module.css";

const LoteSidebarOverlay = ({ inmo, proyecto, lote, imagenes = [], onClose, walkingInfo, drivingInfo, mapRef }) => {
  console.log(lote)
  const [expanded, setExpanded] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [fullscreenImgIndex, setFullscreenImgIndex] = useState(null);
  const contentRef = useRef(null);

  const hasValue = (val) => val !== null && val !== undefined && val > 0;

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
    if (mapRef?.current) mapRef.current.setZoom(17);
  };

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && cerrarSidebar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop } = contentRef.current;
    if (!expanded && scrollTop > 200) setExpanded(true);
    if (expanded && scrollTop < 5) setExpanded(false);
  };

  if (!lote) return null;

  return (
    <>
      <div
        className={styles.overlay}
        style={{
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? "auto" : "none"
        }}
        onClick={cerrarSidebar}
      />

      <div className={`${styles.sidebar} ${expanded ? styles.expanded : ""}`}>
        <button className={styles.closeBtn} onClick={cerrarSidebar} aria-label="Cerrar">✕</button>

        <div className={styles.splitLayout}>
          <div className={styles.imageSection}>
            {imagenes.length > 0 ? (
              <>
                <img
                  src={`https://apiinmo.y0urs.com${imagenes[currentImg].imagen}`}
                  alt="Lote"
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

          <div className={styles.infoSection} ref={contentRef} onScroll={handleScroll}>
            <div className={styles.primeInfo}>
              <div className={styles.inmoCard}>
                <div className={styles.inmoHeader}>
                  <div className={styles.inmoIcon}>
                    🏢
                  </div>

                  <div>
                    <span className={styles.inmoLabel}>Inmobiliaria / Persona</span>
                    <h2 className={styles.inmoName}>
                      {inmo?.nombreinmobiliaria}
                    </h2>
                  </div>
                </div>

                {inmo?.descripcion && (
                  <p className={styles.inmoDescription}>
                    {inmo.descripcion}
                  </p>
                )}

              </div>

              <p className={styles.proyectoP}>Datos del lote</p>
              <br></br>

              <span className={styles.legalLabel}>
                {lote.titulo_propiedad === 1 ? (
                  <><FaCheckCircle /> Con título de propiedad</>
                ) : (
                  <><FaTimesCircle /> Sin título de propiedad</>
                )}
              </span>

              <h1 className={styles.nombreLote}>{lote.nombre}</h1>
              <p className={styles.ubicacion}><FaMapMarkerAlt /> Ubicación referencial</p>

              <div className={styles.priceContainer}>
                <div>
                  <span className={styles.labelSmall}>Precio del Lote en dolares</span>
                  <span className={styles.priceValue}>$. {lote.precio}</span>
                </div>
                <a
                  href={`https://wa.me/${inmo.whatsapp}?text=${encodeURIComponent(
                    `Hola, vengo de GeoHabita y estoy interesado en el proyecto *"${proyecto.nombreproyecto}"* y en el lote/inmueble *"${lote.nombre}"*`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.contactMiniBtn}
                >
                  <FaWhatsapp /> Contactar
                </a>
              </div>


              <div className={styles.quickGrid}>
                {hasValue(lote.area_total_m2) && (
                  <div className={styles.qBadge}>
                    <FaRulerCombined />
                    <div>
                      <strong>{lote.area_total_m2} m²</strong>
                      <span>Área Total</span>
                    </div>
                  </div>
                )}
                {hasValue(lote.ancho) && (
                  <div className={styles.qBadge}>
                    <FaRulerHorizontal />
                    <div>
                      <strong>{lote.ancho} m</strong>
                      <span>Ancho</span>
                    </div>
                  </div>
                )}
                {hasValue(lote.largo) && (
                  <div className={styles.qBadge}>
                    <FaRulerVertical />
                    <div>
                      <strong>{lote.largo} m</strong>
                      <span>Largo</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.extraContent}>
              <h3 className={styles.sectionTitle}>Descripción</h3>
              <p className={styles.fullDescription}>{lote.descripcion}</p>

              {/* Aquí es donde fallaban los iconos si no se importaban */}
              {lote.idtipoinmobiliaria === 2 && (
                <>
                  <h3 className={styles.sectionTitle}>Características</h3>
                  <div className={styles.featuresGrid}>
                    <div className={styles.fItem}><FaBed /> {lote.dormitorios} Dorm.</div>
                    <div className={styles.fItem}><FaBath /> {lote.banos} Baños</div>
                    <div className={styles.fItem}><FaHome /> {lote.cuartos} Cuartos</div>
                    <div className={styles.fItem}><FaChair /> {lote.sala} Sala</div>
                    <div className={styles.fItem}><FaUtensils /> {lote.cocina} Cocina</div>
                    <div className={styles.fItem}><FaCar /> {lote.cochera} Cochera</div>
                    {lote.patio > 0 && <div className={styles.fItem}><FaCampground /> {lote.patio} Patio</div>}
                    {lote.jardin > 0 && <div className={styles.fItem}><FaTree /> {lote.jardin} Jardín</div>}
                    {lote.terraza > 0 && <div className={styles.fItem}><FaSun /> {lote.terraza} Terraza</div>}
                    {lote.azotea > 0 && <div className={styles.fItem}><FaBuilding /> {lote.azotea} Azotea</div>}
                  </div>
                </>
              )}

              <h3 className={styles.sectionTitle}>Cercanía</h3>
              <div className={styles.distanciaBox}>
                <span>🚶 {walkingInfo?.duration || "---"} ({walkingInfo?.distance || ""})</span>
                <span>🚗 {drivingInfo?.duration || "---"} ({drivingInfo?.distance || ""})</span>
              </div>

              <div className={styles.socialFooter}>
                <a href={inmo.facebook} target="_blank" rel="noreferrer" className={styles.fb}><FaFacebook /></a>
                <a href={inmo.pagina} target="_blank" rel="noreferrer" className={styles.web}><FaGlobe /></a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {fullscreenImgIndex !== null && (
        <div className={styles.fullscreenOverlay} onClick={() => setFullscreenImgIndex(null)}>
          <img
            src={`https://apiinmo.y0urs.com${imagenes[fullscreenImgIndex].imagen}`}
            className={styles.fullscreenImg}
            alt="Zoom"
          />
          <div className={styles.fsBadge}>{fullscreenImgIndex + 1} / {imagenes.length}</div>
        </div>
      )}
    </>
  );
};

export default LoteSidebarOverlay;