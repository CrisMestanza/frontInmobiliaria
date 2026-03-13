import { withApiBase } from "../../config/api.js";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  FaBed,
  FaBath,
  FaCar,
  FaTree,
  FaHome,
  FaUtensils,
  FaChair,
  FaSun,
  FaBuilding,
  FaBorderAll,
  FaCampground,
  FaRulerHorizontal,
  FaRulerVertical,
  FaRulerCombined,
  FaChevronLeft,
  FaChevronRight,
  FaFacebook,
  FaWhatsapp,
  FaGlobe,
  FaVectorSquare,
  FaArrowsAltH,
  FaArrowsAltV,
  FaPhoneAlt,
  FaShareAlt,
  FaWalking,
} from "react-icons/fa";
import styles from "./Proyecto.module.css";
import { FaChevronDown } from "react-icons/fa";

const ProyectoSidebar = ({
  inmo,
  proyecto,
  imagenes = [],
  onClose,
  walkingInfo,
  drivingInfo,
  mapHeaderOffsetPx = 0,
  forceCompactForLote = false,
  isLoading = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [fullscreenImgIndex, setFullscreenImgIndex] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const [sheetMode, setSheetMode] = useState("mid");
  const [mobileSheetTop, setMobileSheetTop] = useState(null);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const sidebarRef = useRef(null);
  const contentRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const carouselTouchStartX = useRef(0);
  const carouselTouchEndX = useRef(0);
  const sheetTouchStartY = useRef(0);
  const sheetTouchDeltaY = useRef(0);
  const sheetTouchStartTop = useRef(0);
  const nestedTouchStartY = useRef(0);
  const nestedTouchDeltaY = useRef(0);
  const nestedStartAtTop = useRef(false);
  const nestedStartAtBottom = useRef(false);
  const nestedScrollableTarget = useRef(null);
  const previousSheetStateRef = useRef(null);
  const validImages = useMemo(
    () =>
      imagenes.filter((img) => {
        const src = img?.imagenproyecto;
        if (typeof src !== "string") return false;
        const trimmed = src.trim();
        if (!trimmed) return false;
        return !trimmed.toLowerCase().includes("no hay imagenes referenciales");
      }),
    [imagenes],
  );

  const mensajeWhatsapp = encodeURIComponent(
    `Hola, vengo desde GeoHabita.\n` +
    `Estoy interesado en el proyecto *"${proyecto.nombreproyecto}"*.\n` +
    `Me gustaría recibir más información sobre disponibilidad, valor y formas de pago.\n` +
    `¡Quedo atento(a)!`,
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

  const parseMinutes = (durationText) => {
    if (!durationText) return "---";
    const hMatch = durationText.match(/(\d+)\s*h/i);
    const mMatch = durationText.match(/(\d+)\s*min/i);
    if (hMatch || mMatch) {
      const total = Number(hMatch?.[1] || 0) * 60 + Number(mMatch?.[1] || 0);
      return total > 0 ? `${total}` : "---";
    }
    const n = durationText.match(/[\d.,]+/);
    if (!n) return "---";
    return `${Math.round(Number(n[0].replace(",", ".")))}`;
  };

  const parseKm = (distanceText) => {
    if (!distanceText) return "---";
    const n = distanceText.match(/[\d.,]+/);
    if (!n) return "---";
    return n[0].replace(",", ".");
  };

  const carMinutes = parseMinutes(drivingInfo?.duration);
  const walkMinutes = parseMinutes(walkingInfo?.duration);
  const carKm = parseKm(drivingInfo?.distance);
  const walkKm = parseKm(walkingInfo?.distance);
  const whatsappHref = inmo?.whatsapp
    ? `https://wa.me/${inmo.whatsapp}?text=${mensajeWhatsapp}`
    : undefined;
  const facebookHref = inmo?.facebook || undefined;
  const webHref = inmo?.pagina || undefined;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const inmoId =
      inmo?.idinmobiliaria ||
      proyecto?.idinmobiliaria ||
      proyecto?.idinmobiliaria_id;
    const proyectoId = proyecto?.idproyecto;
    if (!inmoId || !proyectoId) return "";
    return `${window.location.origin}/mapa/${inmoId}?proyecto=${proyectoId}`;
  }, [inmo, proyecto]);

  const handleShare = async () => {
    if (!shareUrl) return;
    const title = `GeoHabita · ${proyecto?.nombreproyecto || "Proyecto"}`;
    const text = `Mira este proyecto en GeoHabita`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        window.alert("Link copiado");
        return;
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("No se pudo compartir el enlace", error);
      }
    }
    window.prompt("Copia el link para compartir:", shareUrl);
  };


  const prevImgIndex =
    validImages.length > 0
      ? currentImg === 0
        ? validImages.length - 1
        : currentImg - 1
      : 0;
  const nextImgIndex =
    validImages.length > 0
      ? currentImg === validImages.length - 1
        ? 0
        : currentImg + 1
      : 0;

  const minSwipeDistance = 50;
  const carouselSwipeDistance = 40;
  const onTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    touchStartX.current = 0;
    touchEndX.current = 0;

    if (Math.abs(distance) < minSwipeDistance) return;

    if (distance > 0) {
      // 👉 Swipe izquierda (siguiente)
      setFullscreenImgIndex((prev) =>
        prev === validImages.length - 1 ? 0 : prev + 1,
      );
    } else {
      // 👈 Swipe derecha (anterior)
      setFullscreenImgIndex((prev) =>
        prev === 0 ? validImages.length - 1 : prev - 1,
      );
    }
  };

  const onCarouselTouchStart = (e) => {
    if (!isMobileView) return;
    carouselTouchStartX.current = e.targetTouches[0].clientX;
    carouselTouchEndX.current = e.targetTouches[0].clientX;
  };

  const onCarouselTouchMove = (e) => {
    if (!isMobileView) return;
    carouselTouchEndX.current = e.targetTouches[0].clientX;
  };

  const onCarouselTouchEnd = () => {
    if (!isMobileView || validImages.length < 2) return;
    const distance = carouselTouchStartX.current - carouselTouchEndX.current;
    carouselTouchStartX.current = 0;
    carouselTouchEndX.current = 0;

    if (Math.abs(distance) < carouselSwipeDistance) return;

    if (distance > 0) {
      setCurrentImg((prev) =>
        prev === validImages.length - 1 ? 0 : prev + 1,
      );
    } else {
      setCurrentImg((prev) =>
        prev === 0 ? validImages.length - 1 : prev - 1,
      );
    }
  };

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idproyecto: proyecto.idproyecto,
          dia: new Date().toISOString().split("T")[0], // YYYY-MM-DD
          hora: new Date().toLocaleTimeString(), // HH:MM:SS
          redSocial: redSocial,
        }),
      });
      console.log(`Click registrado en ${redSocial}`);
    } catch (error) {
      console.error("Error registrando click:", error);
    }
  };

  useEffect(() => {
    validImages.forEach((img) => {
      const image = new Image();
      image.src = withApiBase(`https://api.geohabita.com${img.imagenproyecto}`);
    });
  }, [validImages]);

  useEffect(() => {
    if (currentImg >= validImages.length) {
      setCurrentImg(0);
    }
    if (
      fullscreenImgIndex !== null &&
      fullscreenImgIndex >= validImages.length
    ) {
      setFullscreenImgIndex(validImages.length > 0 ? 0 : null);
    }
  }, [validImages, currentImg, fullscreenImgIndex]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && cerrarSidebar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [cerrarSidebar]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobileView(mobile);
      if (!mobile) {
        setSheetMode("mid");
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const getSheetAnchors = useCallback(() => {
    if (typeof window === "undefined") {
      return { expandedTop: 0, midTop: 360, collapsedTop: 0 };
    }
    const vh = window.innerHeight;
    const headerTop = Math.max(0, Number(mapHeaderOffsetPx) || 0);
    const available = Math.max(220, vh - headerTop);
    const collapsedHeight = 74;
    const expandedTop = headerTop;
    // Abre un poco mas alto que antes (mid mas grande de alto).
    const midTop = headerTop + available * 0.5;
    const collapsedTop = vh - collapsedHeight;

    return {
      expandedTop,
      midTop: Math.min(Math.max(midTop, expandedTop + 70), collapsedTop - 70),
      collapsedTop,
    };
  }, [mapHeaderOffsetPx]);

  const clampSheetTop = useCallback((top) => {
    const { expandedTop, collapsedTop } = getSheetAnchors();
    return Math.min(Math.max(top, expandedTop), collapsedTop);
  }, [getSheetAnchors]);

  const getModeByTop = useCallback((top) => {
    const { expandedTop, collapsedTop } = getSheetAnchors();
    if (top <= expandedTop + 24) return "expanded";
    if (top >= collapsedTop - 24) return "collapsed";
    return "mid";
  }, [getSheetAnchors]);

  const setSheetTopAndMode = useCallback((nextTop) => {
    const safeTop = clampSheetTop(nextTop);
    setMobileSheetTop(safeTop);
    setSheetMode(getModeByTop(safeTop));
  }, [clampSheetTop, getModeByTop]);

  useEffect(() => {
    if (!isMobileView || typeof window === "undefined") {
      setMobileSheetTop(null);
      return;
    }
    const { midTop } = getSheetAnchors();
    setMobileSheetTop(midTop);
    setSheetMode("mid");
  }, [isMobileView, proyecto?.idproyecto, getSheetAnchors]);

  useEffect(() => {
    if (!isMobileView) {
      previousSheetStateRef.current = null;
      return;
    }

    if (forceCompactForLote) {
      if (!previousSheetStateRef.current) {
        const { midTop } = getSheetAnchors();
        previousSheetStateRef.current = {
          top: mobileSheetTop ?? midTop,
        };
      }
      const { collapsedTop } = getSheetAnchors();
      setSheetTopAndMode(collapsedTop);
      return;
    }

    if (previousSheetStateRef.current) {
      setSheetTopAndMode(previousSheetStateRef.current.top);
      previousSheetStateRef.current = null;
    }
  }, [
    forceCompactForLote,
    isMobileView,
    mobileSheetTop,
    getSheetAnchors,
    setSheetTopAndMode,
  ]);

  const onSheetTouchStart = (e) => {
    if (!isMobileView) return;
    sheetTouchStartY.current = e.targetTouches[0].clientY;
    sheetTouchDeltaY.current = 0;
    sheetTouchStartTop.current =
      mobileSheetTop ?? getSheetAnchors().midTop;
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

  const onNestedTouchStart = (e) => {
    if (!isMobileView) return;
    nestedTouchStartY.current = e.targetTouches[0].clientY;
    nestedTouchDeltaY.current = 0;
    const contentEl = contentRef.current;
    const sidebarEl = sidebarRef.current;
    const contentScrollable =
      !!contentEl && contentEl.scrollHeight > contentEl.clientHeight + 2;
    const target = contentScrollable ? contentEl : sidebarEl;
    nestedScrollableTarget.current = target;
    if (target) {
      nestedStartAtTop.current = target.scrollTop <= 0;
      nestedStartAtBottom.current =
        target.scrollTop + target.clientHeight >= target.scrollHeight - 2;
    } else {
      nestedStartAtTop.current = false;
      nestedStartAtBottom.current = false;
    }
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
    nestedStartAtTop.current = false;
    nestedStartAtBottom.current = false;
    nestedScrollableTarget.current = null;
  };

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop } = contentRef.current;
    if (!expanded && scrollTop > 400) setExpanded(true);
    if (expanded && scrollTop < 5) setExpanded(false);
  };

  if (!proyecto) return null;

  const overlayActive = isMobileView ? false : expanded;
  // console.log("Proyecto:", proyecto);
  // console.log("Precio:", proyecto.precio);
  // console.log("Moneda:", proyecto.moneda);
  // console.log("isMobileView:", isMobileView);

  return (
    <>
      <div
        className={styles.overlay}
        style={{
          opacity: overlayActive ? 1 : 0,
          background: isMobileView ? "transparent" : "rgba(15, 23, 42, 0.2)",
          pointerEvents: isMobileView
            ? "none"
            : overlayActive
              ? "auto"
              : "none",
        }}
        onClick={isMobileView ? undefined : cerrarSidebar}
      />

      <div
        ref={sidebarRef}
        className={`${styles.sidebar} ${expanded ? styles.expanded : ""} ${isMobileView ? styles.mobileSidebar : ""} ${sheetMode === "collapsed" ? styles.mobileCollapsed : ""} ${sheetMode === "expanded" ? styles.mobileExpanded : ""}`}
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
              {proyecto.nombreproyecto}
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

        <button
          className={styles.closeBtn}
          onClick={cerrarSidebar}
          aria-label="Cerrar"
        >
          ✕
        </button>

        <div
          className={`${styles.splitLayout} ${validImages.length === 0 ? styles.noImageLayout : ""} ${sheetMode === "collapsed" ? styles.mobileHiddenContent : ""}`}
        >
          {/* SECCIÓN IMAGEN / SLIDER */}
          {isLoading ? (
            <div className={styles.skeletonImage} />
          ) : validImages.length  == 0 ? (
            <div className={styles.noImage}>
              <p>No hay imágenes disponibles</p>
            </div>
          ) : (
            <div className={styles.imageSection}>
            {isMobileView ? (
              <div
                className={styles.mobileCarouselWrap}
                onTouchStart={onCarouselTouchStart}
                onTouchMove={onCarouselTouchMove}
                onTouchEnd={onCarouselTouchEnd}
              >
                {validImages.length === 1 && (
                  <div className={styles.mobileSingleWrap}>
                    <img
                      key={currentImg}
                      src={withApiBase(`https://api.geohabita.com${validImages[currentImg].imagenproyecto}`)}
                      alt="Propiedad"
                      className={styles.mobileSingleImage}
                      onClick={() => setFullscreenImgIndex(currentImg)}
                    />
                  </div>
                )}

                {validImages.length === 2 && (
                  <div className={styles.mobileDualTrack}>
                    <button
                      className={styles.mobileDualItem}
                      onClick={() => setFullscreenImgIndex(0)}
                      aria-label="Ver imagen 1"
                    >
                      <img
                        src={withApiBase(`https://api.geohabita.com${validImages[0].imagenproyecto}`)}
                        alt="Imagen 1"
                        className={styles.mobileDualImage}
                      />
                    </button>
                    <button
                      className={styles.mobileDualItem}
                      onClick={() => setFullscreenImgIndex(1)}
                      aria-label="Ver imagen 2"
                    >
                      <img
                        src={withApiBase(`https://api.geohabita.com${validImages[1].imagenproyecto}`)}
                        alt="Imagen 2"
                        className={styles.mobileDualImage}
                      />
                    </button>
                  </div>
                )}

                {validImages.length >= 3 && (
                  <div className={styles.mobileCarouselTrack}>
                    <button
                      className={`${styles.mobileSideSlide} ${styles.mobileSideLeft}`}
                      onClick={prevSlide}
                      aria-label="Imagen anterior"
                    >
                      <img
                        src={withApiBase(`https://api.geohabita.com${validImages[prevImgIndex].imagenproyecto}`)}
                        alt="Anterior"
                        className={styles.mobileSideImage}
                      />
                    </button>
                    <img
                      key={currentImg}
                      src={withApiBase(`https://api.geohabita.com${validImages[currentImg].imagenproyecto}`)}
                      alt="Propiedad"
                      className={styles.mobileMainImage}
                      onClick={() => setFullscreenImgIndex(currentImg)}
                    />
                    <button
                      className={`${styles.mobileSideSlide} ${styles.mobileSideRight}`}
                      onClick={nextSlide}
                      aria-label="Imagen siguiente"
                    >
                      <img
                        src={withApiBase(`https://api.geohabita.com${validImages[nextImgIndex].imagenproyecto}`)}
                        alt="Siguiente"
                        className={styles.mobileSideImage}
                      />
                    </button>
                  </div>
                )}

                {validImages.length >= 3 && (
                  <div className={styles.mobileDots}>
                    {validImages.map((_, idx) => (
                      <button
                        key={`dot-${idx}`}
                        className={`${styles.mobileDot} ${idx === currentImg ? styles.mobileDotActive : ""}`}
                        onClick={() => setCurrentImg(idx)}
                        aria-label={`Ir a imagen ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <img
                  key={currentImg}
                  src={withApiBase(`https://api.geohabita.com${validImages[currentImg].imagenproyecto}`)}
                  alt="Propiedad"
                  className={styles.mainImage}
                  onClick={() => setFullscreenImgIndex(currentImg)}
                />
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
            )}
            </div>
          )}

          {/* SECCIÓN INFORMACIÓN */}
          <div
            className={styles.infoSection}
            ref={contentRef}
            onScroll={handleScroll}
            onTouchStart={onNestedTouchStart}
            onTouchMove={onNestedTouchMove}
            onTouchEnd={onNestedTouchEnd}
          >
            {isLoading ? (
              <div className={styles.skeletonStack}>
                <div className={styles.skeletonLine} style={{ width: "65%" }} />
                <div className={styles.skeletonLine} style={{ width: "45%" }} />
                <div className={styles.skeletonLine} style={{ width: "80%" }} />
                <div className={styles.skeletonCard} />
                <div className={styles.skeletonLine} style={{ width: "60%" }} />
                <div className={styles.skeletonLine} style={{ width: "70%" }} />
                <div className={styles.skeletonLine} style={{ width: "50%" }} />
              </div>
            ) : (
              <>
                {/* FLECHA SCROLL */}
                {!isMobileView && !expanded && (
                  <div
                    className={styles.scrollHint}
                    onClick={() =>
                      contentRef.current?.scrollTo({ top: 500, behavior: "smooth" })
                    }
                  >
                    <FaChevronDown />
                    <span>Desliza</span>
                  </div>
                )}

                <div className={styles.primeInfo}>
              <div
                className={`${styles.inmoCard} ${isMobileView && validImages.length > 0 ? styles.mobileInmoCard : ""}`}
              >
                <div className={styles.inmoHeader}>
                  <div className={styles.inmoIcon}>🏢</div>

                  <div>
                    <span className={styles.inmoLabel}>
                      Inmobiliaria / Persona
                    </span>
                    <h2 className={styles.inmoName}>
                      {inmo?.nombreinmobiliaria}
                    </h2>
                  </div>
                </div>

                {inmo?.descripcion && (
                  <p className={styles.inmoDescription}>{inmo.descripcion}</p>
                )}
              </div>

              <p className={styles.proyectoP}>Proyecto</p>
              <br></br>
              {proyecto.idtipoinmobiliaria === 2 && (
                <span className={styles.legalLabel}>
                  {proyecto.titulo_propiedad
                    ? "✓ Cuenta con titulo"
                    : "• No cuenta con titulo"}
                </span>
              )}

              <h1 className={styles.nombreProyecto}>
                {proyecto.nombreproyecto}
              </h1>
              {/* <p className={styles.ubicacion}>📍 {proyecto.descripcion?.split('.')[0]}</p> */}
              {isMobileView && (
                <div className={styles.mobileMetricsBox}>
                  <div className={styles.mobileMetricsRow}>
                    <div className={styles.mobileMetricGroup}>
                      <div className={styles.mobileMetricItem}>
                        <span className={styles.mobileMetricValue}>
                          {carMinutes}
                        </span>
                        <span className={styles.mobileMetricUnit}>MIN</span>
                        <FaCar className={styles.mobileMetricIcon} />
                      </div>
                      <div className={styles.mobileMetricItem}>
                        <span className={styles.mobileMetricValue}>
                          {carKm}
                        </span>
                        <span className={styles.mobileMetricUnit}>KM</span>
                      </div>
                    </div>
                    <div className={styles.mobileMetricDivider}></div>
                    <div className={styles.mobileMetricGroup}>
                      <div className={styles.mobileMetricItem}>
                        <span className={styles.mobileMetricValue}>
                          {walkMinutes}
                        </span>
                        <span className={styles.mobileMetricUnit}>MIN</span>
                        <FaWalking className={styles.mobileMetricIcon} />
                      </div>
                      <div className={styles.mobileMetricItem}>
                        <span className={styles.mobileMetricValue}>
                          {walkKm}
                        </span>
                        <span className={styles.mobileMetricUnit}>KM</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.priceContainer}>
                {proyecto.precio > 0 && (
                  <div className={styles.priceRow}>

                    <img src={proyecto.bandera} className={styles.flagIcon} alt="Bandera"/>

                    <span className={styles.labelSmall}>
                      Precio de venta del inmueble:
                    </span>

                    <br></br>

                    <span className={styles.priceValue}>
                     {proyecto.moneda} {proyecto.precio}
                    </span>

                  </div>
                )}
                
                {isMobileView ? (
                  <div className={styles.mobileContactRow}>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className={`${styles.mobileContactBtn} ${styles.mobileWhatsappBtn}`}
                      onClick={() => registrarClickContacto("Whatsapp")}
                    >
                      <FaWhatsapp />
                      WhatsApp
                    </a>
                   
                    <a
                      href={phoneNumber ? `tel:${phoneNumber}` : undefined}
                      className={`${styles.mobileContactBtn} ${styles.mobileCallBtn} ${!phoneNumber ? styles.mobileDisabledBtn : ""}`}
                      onClick={() => registrarClickContacto("Llamada")}
                    >
                      <FaPhoneAlt /> Llamar
                    </a>

                    <button
                      type="button"
                      className={styles.mobileContactBtn}
                      onClick={handleShare}
                      disabled={!shareUrl}
                    >
                      <FaShareAlt /> Compartir
                    </button>
                  </div>
                ) : (
                  <div className={styles.pantallaContactos}>

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
                    >
                      <FaPhoneAlt /> Llamar
                    </a>

                    <button
                      type="button"
                      className={styles.contactMiniBtn}
                      onClick={handleShare}
                      disabled={!shareUrl}
                    >
                      <FaShareAlt /> Compartir
                    </button>
                  </div>
                )}
              </div>
              {isMobileView && (
                <div className={styles.mobileSocialRow}>
                  <a
                    href={facebookHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => registrarClickContacto("Facebook")}
                  >
                    <FaFacebook />
                  </a>
                  <a
                    href={webHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => registrarClickContacto("Web")}
                  >
                    <FaGlobe />
                  </a>
                </div>
              )}
              {proyecto.area_total_m2 > 0 && (
                <div className={styles.quickGrid}>
                  <div className={styles.qBadge}>
                    <FaRulerCombined />
                    <div>
                      <strong>{proyecto.area_total_m2} m²</strong>
                      <span>Área Total</span>
                    </div>
                  </div>

                  <div className={styles.qBadge}>
                    <FaRulerHorizontal />
                    <div>
                      <strong>{proyecto.ancho} m</strong>
                      <span>Ancho</span>
                    </div>
                  </div>

                  <div className={styles.qBadge}>
                    <FaRulerVertical />
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
              <h3 className={styles.sectionTitle}>Acerca del Proyecto</h3>
              <p className={styles.fullDescription}>{proyecto.descripcion}</p>

              {proyecto.idtipoinmobiliaria === 2 && (
                <>
                  <h3 className={styles.sectionTitle}>Características</h3>
                  <div className={styles.featuresGrid}>
                    {/* Habitaciones y Baños */}
                    <div className={styles.fItem}>
                      <FaBed /> {proyecto.dormitorios} Dorm.
                    </div>
                    <div className={styles.fItem}>
                      <FaBath /> {proyecto.banos} Baños
                    </div>
                    <div className={styles.fItem}>
                      <FaHome /> {proyecto.cuartos} Cuartos
                    </div>

                    {/* Áreas Internas */}
                    <div className={styles.fItem}>
                      <FaChair /> {proyecto.sala} Sala
                    </div>
                    <div className={styles.fItem}>
                      <FaUtensils /> {proyecto.cocina} Cocina
                    </div>
                    <div className={styles.fItem}>
                      <FaCar /> {proyecto.cochera} Cochera
                    </div>

                    {/* Exteriores y extras (Se muestran solo si el valor es >= 1) */}
                    {proyecto.patio > 0 && (
                      <div className={styles.fItem}>
                        <FaCampground /> {proyecto.patio} Patio
                      </div>
                    )}
                    {proyecto.jardin > 0 && (
                      <div className={styles.fItem}>
                        <FaTree /> {proyecto.jardin} Jardín
                      </div>
                    )}
                    {proyecto.terraza > 0 && (
                      <div className={styles.fItem}>
                        <FaSun /> {proyecto.terraza} Terraza
                      </div>
                    )}
                    {proyecto.azotea > 0 && (
                      <div className={styles.fItem}>
                        <FaBuilding /> {proyecto.azotea} Azotea
                      </div>
                    )}
                  </div>
                </>
              )}

              {!isMobileView && (
                <>
                  <h3 className={styles.sectionTitle}>
                    Distancia (actual o buscada)
                  </h3>
                  <div className={styles.distanciaBox}>
                    <span>🚶 {walkingInfo?.duration || "Calc..."}</span>
                    <span>🚗 {drivingInfo?.duration || "Calc..."}</span>
                  </div>

                  <div className={styles.socialFooter}>
                    <a
                      href={facebookHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => registrarClickContacto("Facebook")}
                    >
                      <FaFacebook />
                    </a>
                    <a
                      href={webHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => registrarClickContacto("Web")}
                    >
                      <FaGlobe />
                    </a>
                  </div>
                </>
              )}
            </div>
              </>
            )}
          </div>
        </div>
      </div>

      {fullscreenImgIndex !== null && validImages.length > 0 && (
        <div
          className={styles.fullscreenOverlay}mobileSidebar
          onClick={() => setFullscreenImgIndex(null)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Botón Cerrar (opcional, ya que el fondo cierra) */}
          <button
            className={styles.closeBtn}
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenImgIndex(null);
            }}
          >
            ✕
          </button>

          {validImages.length > 1 && (
            <>
              {/* Navegación Pantalla Completa */}
              <button
                className={`${styles.navArrowFS} ${styles.prevFS}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImgIndex((prev) =>
                    prev === 0 ? validImages.length - 1 : prev - 1,
                  );
                }}
              >
                <FaChevronLeft />
              </button>

              <button
                className={`${styles.navArrowFS} ${styles.nextFS}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImgIndex((prev) =>
                    prev === validImages.length - 1 ? 0 : prev + 1,
                  );
                }}
              >
                <FaChevronRight />
              </button>
            </>
          )}

          <img
            src={withApiBase(`https://api.geohabita.com${validImages[fullscreenImgIndex].imagenproyecto}`)}
            className={styles.fullscreenImg}
            alt="Zoom"
            onClick={(e) => e.stopPropagation()} // Evita que se cierre al tocar la imagen misma
          />

          <div className={styles.fsBadge}>
            {fullscreenImgIndex + 1} / {validImages.length}
          </div>
        </div>
      )}
    </>
  );
};

export default ProyectoSidebar;
