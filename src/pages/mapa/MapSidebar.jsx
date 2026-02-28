import { withApiBase } from "../../config/api.js";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  FaRulerCombined, FaRulerHorizontal, FaRulerVertical,
  FaChevronLeft, FaChevronRight, FaFacebook, FaWhatsapp, FaGlobe,
  FaMapMarkerAlt, FaCheckCircle, FaTimesCircle,
  // ESTOS SON LOS QUE FALTABAN:
  FaBed, FaBath, FaHome, FaChair, FaUtensils, FaCar,
  FaCampground, FaTree, FaSun, FaBuilding, FaPhoneAlt,
} from "react-icons/fa";
import styles from "./Lote.module.css";

const LoteSidebarOverlay = ({
  inmo,
  proyecto,
  lote,
  imagenes = [],
  onClose,
  walkingInfo,
  drivingInfo,
  mapHeaderOffsetPx = 0,
}) => {
  const validImages = useMemo(
    () =>
      imagenes.filter((img) => {
        const src = img?.imagen;
        return typeof src === "string" && src.trim().length > 0;
      }),
    [imagenes],
  );
  const phoneNumber = useMemo(() => {
    const raw =
      inmo?.telefono ||
      inmo?.celular ||
      inmo?.whatsapp ||
      inmo?.telefono1 ||
      "";
    return String(raw).replace(/[^\d+]/g, "");
  }, [inmo]);
  const whatsappHref = inmo?.whatsapp
    ? `https://wa.me/${inmo.whatsapp}?text=${encodeURIComponent(
        `Hola, vengo de GeoHabita y estoy interesado en el proyecto *"${proyecto?.nombreproyecto || ""}"* y en el lote/inmueble *"${lote?.nombre || ""}"*`,
      )}`
    : undefined;
  const facebookHref = inmo?.facebook || undefined;
  const webHref = inmo?.pagina || undefined;
  const [expanded, setExpanded] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [fullscreenImgIndex, setFullscreenImgIndex] = useState(null);
  const contentRef = useRef(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const [sheetMode, setSheetMode] = useState("mid");
  const [mobileSheetTop, setMobileSheetTop] = useState(null);
  const [isSheetDragging, setIsSheetDragging] = useState(false);

  const galleryRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleGalleryScroll = () => {
    if (!galleryRef.current) return;

    const container = galleryRef.current;
    const center = container.scrollLeft + container.offsetWidth / 2;

    // Buscamos cuál imagen está más cerca del centro del contenedor
    const children = Array.from(container.children);
    let closestIndex = 0;
    let minDistance = Infinity;

    children.forEach((child, index) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(center - childCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };
  const sidebarRef = useRef(null);
  const touchStartX = useRef(0);
  const sheetTouchStartY = useRef(0);
  const sheetTouchDeltaY = useRef(0);
  const sheetTouchStartTop = useRef(0);
  const nestedTouchStartY = useRef(0);
  const nestedTouchDeltaY = useRef(0);
  const nestedScrollableTarget = useRef(null);

  const getSheetAnchors = useCallback(() => {
    if (typeof window === "undefined") {
      return { expandedTop: 0, midTop: 360, collapsedTop: 0 };
    }
    const vh = window.innerHeight;
    const headerTop = Math.max(0, Number(mapHeaderOffsetPx) || 0);
    const available = Math.max(220, vh - headerTop);
    const collapsedHeight = 74;
    const expandedTop = headerTop;
    const midTop = headerTop + available * 0.5;
    const collapsedTop = vh - collapsedHeight;

    return {
      expandedTop,
      midTop: Math.min(Math.max(midTop, expandedTop + 70), collapsedTop - 70),
      collapsedTop,
    };
  }, [mapHeaderOffsetPx]);

  const clampSheetTop = (top) => {
    const { expandedTop, collapsedTop } = getSheetAnchors();
    return Math.min(Math.max(top, expandedTop), collapsedTop);
  };

  const getModeByTop = (top) => {
    const { expandedTop, collapsedTop } = getSheetAnchors();
    if (top <= expandedTop + 24) return "expanded";
    if (top >= collapsedTop - 24) return "collapsed";
    return "mid";
  };

  const setSheetTopAndMode = (nextTop) => {
    const safeTop = clampSheetTop(nextTop);
    setMobileSheetTop(safeTop);
    setSheetMode(getModeByTop(safeTop));
  };

  useEffect(() => {
    if (!isMobileView || typeof window === "undefined") {
      setMobileSheetTop(null);
      return;
    }
    const { midTop } = getSheetAnchors();
    setMobileSheetTop(midTop);
    setSheetMode("mid");
  }, [isMobileView, lote?.idlote, getSheetAnchors]);

  const stepSheetUp = () => {
    const { expandedTop, midTop } = getSheetAnchors();
    const currentTop = mobileSheetTop ?? midTop;
    if (currentTop > midTop + 12) {
      setSheetTopAndMode(midTop);
      return;
    }
    setSheetTopAndMode(expandedTop);
  };

  const stepSheetDown = () => {
    const { midTop, collapsedTop } = getSheetAnchors();
    const currentTop = mobileSheetTop ?? midTop;
    if (currentTop < midTop - 12) {
      setSheetTopAndMode(midTop);
      return;
    }
    setSheetTopAndMode(collapsedTop);
  };

  const onSheetTouchStart = (e) => {
    if (!isMobileView) return;
    sheetTouchStartY.current = e.targetTouches[0].clientY;
    sheetTouchDeltaY.current = 0;
    sheetTouchStartTop.current = mobileSheetTop ?? getSheetAnchors().midTop;
    setIsSheetDragging(true);
    e.stopPropagation();
  };

  const onSheetTouchMove = (e) => {
    if (!isMobileView || !sheetTouchStartY.current) return;
    sheetTouchDeltaY.current =
      e.targetTouches[0].clientY - sheetTouchStartY.current;
    setSheetTopAndMode(sheetTouchStartTop.current + sheetTouchDeltaY.current);
    e.preventDefault();
    e.stopPropagation();
  };


  const onSheetTouchEnd = () => {
    if (!isMobileView) return;
    if (mobileSheetTop !== null) {
      setSheetMode(getModeByTop(mobileSheetTop));
    }
    setIsSheetDragging(false);
    sheetTouchStartY.current = 0;
    sheetTouchDeltaY.current = 0;
    sheetTouchStartTop.current = 0;
  };

  const onNestedTouchStart = (e) => {
    if (!isMobileView) return;
    nestedTouchStartY.current = e.targetTouches[0].clientY;
    nestedTouchDeltaY.current = 0;
    const contentEl = contentRef.current;
    const sidebarEl = sidebarRef.current;
    const contentScrollable =
      !!contentEl && contentEl.scrollHeight > contentEl.clientHeight + 2;
    nestedScrollableTarget.current = contentScrollable ? contentEl : sidebarEl;
    e.stopPropagation();
  };

  const onNestedTouchMove = (e) => {
    if (!isMobileView || !nestedTouchStartY.current) return;
    nestedTouchDeltaY.current =
      e.targetTouches[0].clientY - nestedTouchStartY.current;

    const scrollEl = nestedScrollableTarget.current;
    const atTop = (scrollEl?.scrollTop || 0) <= 0;
    const atBottom =
      !!scrollEl &&
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
    const sheetAtTop = (sidebarRef.current?.scrollTop || 0) <= 0;

    if (nestedTouchDeltaY.current > 0 && atTop && sheetAtTop) {
      e.preventDefault();
    }
    if (nestedTouchDeltaY.current < 0 && atBottom) {
      e.preventDefault();
    }
  };

  const onNestedTouchEnd = () => {
    if (!isMobileView) return;
    const scrollEl = nestedScrollableTarget.current;
    const atTop = (scrollEl?.scrollTop || 0) <= 0;
    const atBottom =
      !!scrollEl &&
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
    const sheetAtTop = (sidebarRef.current?.scrollTop || 0) <= 0;

    if (nestedTouchDeltaY.current > 50 && atTop && sheetAtTop) {
      stepSheetDown();
    }
    if (nestedTouchDeltaY.current < -40 && atBottom) {
      stepSheetUp();
    }

    nestedTouchStartY.current = 0;
    nestedTouchDeltaY.current = 0;
    nestedScrollableTarget.current = null;
  };

  const hasValue = (val) => val !== null && val !== undefined && val > 0;

  const nextSlide = (e) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = (e) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const cerrarSidebar = useCallback(() => {
    onClose();
  }, [onClose]);

  const registrarClickContacto = async (redSocial) => {
    try {
      await fetch(withApiBase("https://api.geohabita.com/api/registerClickContactos/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idproyecto: proyecto?.idproyecto ?? null,
          dia: new Date().toISOString().split("T")[0],
          hora: new Date().toLocaleTimeString(),
          redSocial,
        }),
      });
    } catch (error) {
      console.error("Error registrando click de contacto:", error);
    }
  };

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && cerrarSidebar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [cerrarSidebar]);

  useEffect(() => {
    if (validImages.length === 0) return;

    validImages.forEach((img) => {
      const image = new Image();
      image.src = withApiBase(`https://api.geohabita.com${img.imagen}`);
    });
  }, [validImages]);
  useEffect(() => {
    if (currentImg >= validImages.length) {
      setCurrentImg(0);
    }
    if (fullscreenImgIndex !== null && fullscreenImgIndex >= validImages.length) {
      setFullscreenImgIndex(validImages.length > 0 ? 0 : null);
    }
  }, [validImages, currentImg, fullscreenImgIndex]);
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
          opacity: isMobileView ? 0 : expanded ? 1 : 0,
          background: isMobileView ? "transparent" : "rgba(15, 23, 42, 0.2)",
          pointerEvents: isMobileView ? "none" : expanded ? "auto" : "none",
        }}
        onClick={isMobileView ? undefined : cerrarSidebar}
      />

      <div
        ref={sidebarRef}
        className={`
    ${styles.sidebar}
    ${expanded ? styles.expanded : ""}
    ${isMobileView ? styles.mobileSidebar : ""}
    ${sheetMode === "collapsed" ? styles.mobileCollapsed : ""}
    ${sheetMode === "expanded" ? styles.mobileExpanded : ""}
  `}
        style={
          isMobileView && mobileSheetTop !== null
            ? {
                top: `${mobileSheetTop}px`,
                height: `calc(100dvh - ${mobileSheetTop}px)`,
                transition: isSheetDragging
                  ? "none"
                  : "top 0.22s cubic-bezier(0.22, 1, 0.36, 1), height 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
              }
            : undefined
        }
      >

        {isMobileView && (
          <div
            className={styles.mobileTopHeader}
            onTouchStart={onSheetTouchStart}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
          >
            <h3 className={styles.mobileHeaderTitle}>
              {lote.nombre}
            </h3>
            <button
              className={styles.mobileHeaderClose}
              onClick={cerrarSidebar}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <div className={styles.mobileDragHandle} />
          </div>
        )}


        <button className={styles.closeBtn} onClick={cerrarSidebar} aria-label="Cerrar">✕</button>

        <div
          className={`${styles.splitLayout} ${sheetMode === "collapsed" ? styles.mobileHiddenContent : ""}`}
        >

          <div className={styles.imageSection}>
            {validImages.length > 0 ? (
              isMobileView ? (
                <div
                  className={styles.mobileHorizontalGallery}
                  ref={galleryRef}
                  onScroll={handleGalleryScroll}
                >
                  {validImages.map((img, index) => (
                    <div
                      key={index}
                      className={styles.galleryItem}
                    >
                      <img
                        src={withApiBase(`https://api.geohabita.com${img.imagen}`)}
                        alt="Lote"
                        className={`${styles.mobileGalleryImage} ${activeIndex === index ? styles.activeImage : ""
                          }`}
                        onClick={() => setFullscreenImgIndex(index)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <>

                  <img
                    key={currentImg}
                    src={withApiBase(`https://api.geohabita.com${validImages[currentImg].imagen}`)}
                    alt="Lote"
                    className={styles.mainImage}
                    fetchpriority="high" // Le dice al navegador que esta es la prioridad #1
                    onClick={() => setFullscreenImgIndex(currentImg)}
                  />


                  {validImages.map((img, index) => (
                    <img
                      key={index}
                      src={withApiBase(`https://api.geohabita.com${img.imagen}`)}
                      loading="lazy" // Solo carga cuando el usuario hace scroll hacia ella
                      className={styles.mobileGalleryImage}
                    // ... rest
                    />
                  ))}
                  {validImages.length > 1 && (
                    <div className={styles.sliderControls}>
                      <button onClick={prevSlide} className={styles.navArrow}>
                        <FaChevronLeft />
                      </button>
                      <button onClick={nextSlide} className={styles.navArrow}>
                        <FaChevronRight />
                      </button>
                    </div>
                  )}
                  <div className={styles.imageBadge}>
                    {currentImg + 1} / {validImages.length} FOTOS
                  </div>
                </>
              )
            ) : (
              <div className={styles.noImage}>
                No hay imagenes referenciales
              </div>
            )}
          </div>

          <div
            className={styles.infoSection}
            ref={contentRef}
            onScroll={handleScroll}
            onTouchStart={onNestedTouchStart}
            onTouchMove={onNestedTouchMove}
            onTouchEnd={onNestedTouchEnd}
          >
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

                <div className={styles.pantallaCelul}>

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.contactMiniBtn}
                    onClick={() => registrarClickContacto("Whatsapp")}
                  >
                    <FaWhatsapp /> Contactar
                  </a>

                  <a
                    href={phoneNumber ? `tel:${phoneNumber}` : undefined}
                    className={`${styles.mobileContactBtn} ${styles.mobileCallBtn} ${!phoneNumber ? styles.mobileDisabledBtn : ""}`}
                    onClick={() => registrarClickContacto("Llamada")}
                    aria-disabled={!phoneNumber}
                    onMouseDown={(e) => {
                      if (!phoneNumber) e.preventDefault();
                    }}
                  >
                    <FaPhoneAlt /> Llamar
                  </a>
                </div>
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
                <a href={facebookHref} target="_blank" rel="noreferrer" className={styles.fb} onClick={() => registrarClickContacto("Facebook")}><FaFacebook /></a>
                <a href={webHref} target="_blank" rel="noreferrer" className={styles.web} onClick={() => registrarClickContacto("Web")}><FaGlobe /></a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VISOR PANTALLA COMPLETA INTERACTIVO */}
      {fullscreenImgIndex !== null && validImages.length > 0 && (
        <div
          className={styles.fullscreenOverlay}
          onClick={() => setFullscreenImgIndex(null)}
          // Eventos para Swipe en celular
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX.current - touchEndX;
            if (Math.abs(diff) > 50) { // Sensibilidad
              if (diff > 0) {
                // Swipe Izquierda -> Siguiente
                setFullscreenImgIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
              } else {
                // Swipe Derecha -> Anterior
                setFullscreenImgIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
              }
            }
          }}
        >
          {/* Botón Anterior */}
          <button
            className={`${styles.navArrowFullscreen} ${styles.arrowLeft}`}
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenImgIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
            }}
          >
            <FaChevronLeft />
          </button>

          <img
            src={withApiBase(`https://api.geohabita.com${validImages[fullscreenImgIndex].imagen}`)}
            className={styles.fullscreenImg}
            alt="Zoom"
            onClick={(e) => e.stopPropagation()} // Evita que se cierre al tocar la imagen
          />

          {/* Botón Siguiente */}
          <button
            className={`${styles.navArrowFullscreen} ${styles.arrowRight}`}
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenImgIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
            }}
          >
            <FaChevronRight />
          </button>

          <div className={styles.fsBadge}>{fullscreenImgIndex + 1} / {validImages.length}</div>

          <button
            className={styles.closeFsBtn}
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenImgIndex(null);
            }}
            aria-label="Cerrar visor"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};

export default LoteSidebarOverlay;
