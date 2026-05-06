import { withApiBase } from "../../config/api.js";
import React, {
  Suspense,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  FaRulerCombined,
  FaRulerHorizontal,
  FaRulerVertical,
  FaChevronLeft,
  FaChevronRight,
  FaFacebook,
  FaWhatsapp,
  FaGlobe,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaTimesCircle,
  // ESTOS SON LOS QUE FALTABAN:
  FaBed,
  FaBath,
  FaHome,
  FaChair,
  FaUtensils,
  FaCar,
  FaCampground,
  FaTree,
  FaSun,
  FaBuilding,
  FaPhoneAlt,
  FaShareAlt,
  FaWalking,
  FaCalculator,
  FaPiggyBank,
} from "react-icons/fa";
import styles from "./Lote.module.css";
const Viewer360Modal = React.lazy(() => import("./Viewer360ModalCasa"));

gsap.registerPlugin(useGSAP);

const parseFinancingConfig = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const formatMoney = (value, currency = "S/") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} 0.00`;
  return `${currency} ${amount.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const clamp = (value, min, max) =>
  Math.min(Math.max(Number(value) || 0, min), max);

const getRangeStyle = (value, min, max) => {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const rawMax = Number.isFinite(Number(max)) ? Number(max) : safeMin + 1;
  const safeMax = rawMax <= safeMin ? safeMin + 1 : rawMax;
  const current = clamp(value, safeMin, safeMax);
  const progress = ((current - safeMin) / (safeMax - safeMin)) * 100;
  return { "--financing-range-progress": `${progress}%` };
};

const calcPayment = (principal, annualRate, months) => {
  const safePrincipal = Math.max(Number(principal) || 0, 0);
  const safeMonths = Math.max(1, Math.round(Number(months) || 1));
  const monthlyRate = Math.max(0, Number(annualRate) || 0) / 12 / 100;
  if (!monthlyRate) return safePrincipal / safeMonths;
  return (
    (safePrincipal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -safeMonths))
  );
};

const LoteSidebarOverlay = ({
  inmo,
  proyecto,
  lote,
  imagenes = [],
  onClose,
  walkingInfo,
  drivingInfo,
  mapHeaderOffsetPx = 0,
  isLoading = false,
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
  const whatsappHref = inmo?.whatsapp
    ? `https://wa.me/${inmo.whatsapp}?text=${encodeURIComponent(
        `Hola, vengo de GeoHabita y estoy interesado en el proyecto *"${proyecto?.nombreproyecto || ""}"* y en el lote/inmueble *"${lote?.nombre || ""}"*`,
      )}`
    : undefined;
  const facebookHref = inmo?.facebook || undefined;
  const webHref = inmo?.pagina || undefined;
  const [show360, setShow360] = useState(false);
  const [images360, setImages360] = useState([]);
  const [images360Status, setImages360Status] = useState("idle");
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
  const carMinutes = parseMinutes(drivingInfo?.duration);
  const walkMinutes = parseMinutes(walkingInfo?.duration);
  const carKm = parseKm(drivingInfo?.distance);
  const walkKm = parseKm(walkingInfo?.distance);

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
      await fetch(
        withApiBase("https://api.geohabita.com/api/registerClickContactos/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idproyecto: proyecto?.idproyecto ?? null,
            dia: new Date().toISOString().split("T")[0],
            hora: new Date().toLocaleTimeString(),
            redSocial,
          }),
        },
      );
    } catch (error) {
      console.error("Error registrando click de contacto:", error);
    }
  };

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const inmoId =
      inmo?.idinmobiliaria ||
      proyecto?.idinmobiliaria ||
      proyecto?.idinmobiliaria_id;
    const proyectoId = proyecto?.idproyecto;
    const loteId = lote?.idlote;
    if (!inmoId || !proyectoId || !loteId) return "";
    return `${window.location.origin}/mapa/${inmoId}?proyecto=${proyectoId}&lote=${loteId}`;
  }, [inmo, proyecto, lote]);

  const handleShare = async () => {
    if (!shareUrl) return;
    const title = `GeoHabita · ${lote?.nombre || "Lote"}`;
    const text = `Mira este lote en ${proyecto?.nombreproyecto || "GeoHabita"}`;
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

  const financingConfig = useMemo(
    () => parseFinancingConfig(proyecto?.financing_config),
    [proyecto?.financing_config],
  );
  const financingCurrency =
    financingConfig?.currency || lote?.moneda || proyecto?.moneda || "S/";
  const financingPrice = Number(lote?.precio || 0);
  const financingMinInitial = Math.max(
    0,
    Number(
      financingConfig?.min_initial_amount ??
        financingConfig?.default_initial_amount ??
        0,
    ) || Math.round(financingPrice * 0.1),
  );
  const financingMaxInitial = Math.max(
    financingMinInitial,
    Math.min(
      Number(financingConfig?.max_initial_amount || financingPrice || 0) ||
        financingPrice,
      financingPrice || Number.MAX_SAFE_INTEGER,
    ),
  );
  const financingMinMonths = Math.max(
    1,
    Number(financingConfig?.min_months || 1),
  );
  const financingMaxMonths = Math.max(
    financingMinMonths,
    Number(financingConfig?.max_months || 60),
  );
  const financingDefaultInitial = clamp(
    financingConfig?.default_initial_amount ?? financingMinInitial,
    financingMinInitial,
    financingMaxInitial,
  );
  const financingDefaultMonths = clamp(
    financingConfig?.default_months ?? 36,
    financingMinMonths,
    financingMaxMonths,
  );
  const [financingInitial, setFinancingInitial] = useState(
    financingDefaultInitial,
  );
  const [financingMonths, setFinancingMonths] = useState(
    financingDefaultMonths,
  );

  useEffect(() => {
    setFinancingInitial(financingDefaultInitial);
    setFinancingMonths(financingDefaultMonths);
  }, [financingDefaultInitial, financingDefaultMonths, lote?.idlote]);

  const financingScenario = useMemo(() => {
    if (!financingConfig || !financingPrice) return null;
    const initial = clamp(
      financingInitial,
      financingMinInitial,
      financingMaxInitial,
    );
    const months = clamp(
      financingMonths,
      financingMinMonths,
      financingMaxMonths,
    );
    const annualRate = Number(financingConfig?.annual_interest_rate || 0);
    const monthlyAdminFee = Number(financingConfig?.monthly_admin_fee || 0);
    const insuranceMonthly = Number(financingConfig?.insurance_monthly || 0);
    const originationFeePct = Number(financingConfig?.origination_fee_pct || 0);
    const balloonPct = Number(financingConfig?.balloon_payment_pct || 0);
    const financedBase = Math.max(financingPrice - initial, 0);
    const originationFee = (financingPrice * originationFeePct) / 100;
    const balloonPayment = (financedBase * balloonPct) / 100;
    const principalForInstallments = Math.max(
      financedBase + originationFee - balloonPayment,
      0,
    );
    const baseMonthly = calcPayment(
      principalForInstallments,
      annualRate,
      months,
    );
    const monthlyEstimate = baseMonthly + monthlyAdminFee + insuranceMonthly;
    const totalPaid = initial + monthlyEstimate * months + balloonPayment;
    const suggestedIncome = monthlyEstimate * 3;

    return {
      initial,
      months,
      annualRate,
      monthlyAdminFee,
      insuranceMonthly,
      monthlyEstimate,
      totalPaid,
      suggestedIncome,
    };
  }, [
    financingConfig,
    financingPrice,
    financingInitial,
    financingMonths,
    financingMinInitial,
    financingMaxInitial,
    financingMinMonths,
    financingMaxMonths,
  ]);

  const financingPresets = useMemo(() => {
    const presets = Array.isArray(financingConfig?.presets)
      ? financingConfig.presets
      : [];
    if (presets.length) return presets;
    return [
      {
        label: "36 meses",
        months: 36,
        initial_amount: financingDefaultInitial,
      },
      {
        label: "48 meses",
        months: 48,
        initial_amount: financingDefaultInitial,
      },
      {
        label: "60 meses",
        months: 60,
        initial_amount: financingDefaultInitial,
      },
    ];
  }, [financingConfig, financingDefaultInitial]);
  const financingWhatsAppHref =
    financingScenario && phoneNumber
      ? `https://wa.me/${phoneNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
          `Hola, me interesa el financiamiento del lote "${lote?.nombre || ""}" del proyecto "${proyecto?.nombreproyecto || ""}".\n\nInicial: ${formatMoney(financingScenario.initial, financingCurrency)}\nPlazo: ${financingScenario.months} meses\nCuota estimada: ${formatMoney(financingScenario.monthlyEstimate, financingCurrency)}\nTotal estimado: ${formatMoney(financingScenario.totalPaid, financingCurrency)}\n\nQuiero más información sobre este plan.`,
        )}`
      : undefined;
  const loadImages360 = useCallback(async () => {
    const projectId = proyecto?.idproyecto;
    if (!projectId) return [];
    if (images360.length) return images360;
    setImages360Status("loading");
    try {
      const response = await fetch(
        withApiBase(
          `https://api.geohabita.com/api/get_imagen_360_casa/${projectId}/`,
        ),
      );
      const data = await response.json().catch(() => []);
      const normalized = Array.isArray(data) ? data : [];
      setImages360(normalized);
      setImages360Status("ready");
      return normalized;
    } catch (error) {
      console.error("No se pudo cargar la vista 360 del lote:", error);
      setImages360Status("error");
      return [];
    }
  }, [images360, proyecto?.idproyecto]);
  const handleOpen360 = useCallback(async () => {
    const loadedImages = images360.length ? images360 : await loadImages360();
    if (loadedImages.length) {
      setShow360(true);
      return;
    }
    window.alert("Este proyecto no cuenta con vista 360° disponible.");
  }, [images360, loadImages360]);
  const handleScrollToInmoDetails = useCallback(() => {
    const target = document.getElementById("lote-inmo-detalle");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
    if (
      fullscreenImgIndex !== null &&
      fullscreenImgIndex >= validImages.length
    ) {
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
    return;
  };

  useGSAP(
    () => {
      if (isLoading) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        sidebarRef.current,
        {
          autoAlpha: 0,
          y: isMobileView ? 80 : 40,
          x: isMobileView ? 0 : 20,
          scale: isMobileView ? 0.98 : 0.94,
          rotateX: isMobileView ? 0 : 8,
          filter: "blur(10px)",
        },
        {
          autoAlpha: 1,
          y: 0,
          x: 0,
          scale: 1,
          rotateX: 0,
          filter: "blur(0px)",
          duration: 0.75,
          ease: "expo.out",
        },
      )
        .fromTo(
          "[data-gsap='media']",
          {
            autoAlpha: 0,
            x: isMobileView ? 0 : -56,
            y: isMobileView ? 24 : 0,
            scale: 1.08,
            rotateZ: isMobileView ? 0 : -2,
            filter: "blur(12px)",
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            rotateZ: 0,
            filter: "blur(0px)",
            duration: 0.8,
            ease: "expo.out",
          },
          "-=0.55",
        )
        .fromTo(
          "[data-gsap='card'], [data-gsap='metric'], [data-gsap='action']",
          {
            autoAlpha: 0,
            y: 34,
            scale: 0.92,
            rotateX: -18,
            transformOrigin: "50% 100%",
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            duration: 0.7,
            stagger: 0.09,
            ease: "back.out(1.9)",
          },
          "-=0.5",
        );
      gsap.to("[data-gsap='metric']", {
        boxShadow: "0 22px 60px rgba(16, 110, 46, 0.18)",
        duration: 1.6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
    {
      scope: sidebarRef,
      dependencies: [isLoading, isMobileView, lote?.idlote],
      revertOnUpdate: true,
    },
  );

  if (!lote) return null;

  return (
    <>
      <div
        className={styles.overlay}
        style={{
          opacity: 0,
          background: "transparent",
          pointerEvents: "none",
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
            <h3 className={styles.mobileHeaderTitle}>{lote.nombre}</h3>
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
          className={`${styles.splitLayout} ${sheetMode === "collapsed" ? styles.mobileHiddenContent : ""}`}
        >
          <div className={styles.imageSection} data-gsap="media">
            {isLoading ? (
              <div className={styles.skeletonImage} />
            ) : validImages.length > 0 ? (
              isMobileView ? (
                <div
                  className={styles.mobileHorizontalGallery}
                  ref={galleryRef}
                  onScroll={handleGalleryScroll}
                >
                  {validImages.map((img, index) => (
                    <div key={index} className={styles.galleryItem}>
                      <img
                        src={withApiBase(
                          `https://api.geohabita.com${img.imagen}`,
                        )}
                        alt="Lote"
                        className={`${styles.mobileGalleryImage} ${
                          activeIndex === index ? styles.activeImage : ""
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
                    src={withApiBase(
                      `https://api.geohabita.com${validImages[currentImg].imagen}`,
                    )}
                    alt="Lote"
                    className={styles.mainImage}
                    fetchpriority="high"
                    onClick={() => setFullscreenImgIndex(currentImg)}
                  />

                  {validImages.map((img, index) => (
                    <img
                      key={index}
                      src={withApiBase(
                        `https://api.geohabita.com${img.imagen}`,
                      )}
                      loading="lazy"
                      className={styles.mobileGalleryImage}
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
            ) : null}
          </div>

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
                <div className={styles.primeInfo}>
                  <div className={styles.inmoCard} data-gsap="card">
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
                    <button
                      type="button"
                      className={styles.inmoMoreBtn}
                      onClick={handleScrollToInmoDetails}
                    >
                      Ver más
                    </button>
                  </div>

                  <p className={styles.proyectoP}>Datos del lote</p>
                  <br></br>

                  <span
                    className={`${styles.legalLabel} ${lote.titulo_propiedad === 1 ? "" : styles.legalLabelDanger}`}
                  >
                    {lote.titulo_propiedad === 1 ? (
                      <>
                        <FaCheckCircle /> Con título de propiedad
                      </>
                    ) : (
                      <>
                        <FaTimesCircle /> Sin título de propiedad
                      </>
                    )}
                  </span>
                  <h1 className={styles.nombreLote}>{lote.nombre}</h1>
                  <p className={styles.ubicacion}>
                    <FaMapMarkerAlt /> Ubicación referencial
                  </p>

                  <div className={styles.priceContainer} data-gsap="card">
                    <div style={{ display: "block", marginRight: "3px" }}>
                      <img
                        src={lote.bandera}
                        alt=""
                        className={styles.flagIcon}
                      />
                      <span className={styles.labelSmall}>
                        {" "}
                        Precio del Lote:
                      </span>
                      <span className={styles.priceValue}>
                        {lote.moneda} {lote.precio}
                      </span>
                    </div>

                    <div className={styles.pantallaCelul}>
                      <button
                        type="button"
                        className={styles.btn360}
                        onClick={handleOpen360}
                        disabled={images360Status === "loading"}
                      >
                        <span className={styles.btn360Orbit}>
                          <span className={styles.icon360}>360</span>
                        </span>
                        <span className={styles.btn360Text}>
                          <small>
                            {images360Status === "loading"
                              ? "Cargando vista"
                              : "Explora el proyecto"}
                          </small>
                          <strong>Visualizar en 360</strong>
                        </span>
                        <span className={styles.btn360Ping} />
                      </button>

                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className={`${styles.contactMiniBtn} ${styles.contactWhatsappBtn}`}
                        data-gsap="action"
                        onClick={() => registrarClickContacto("Whatsapp")}
                      >
                        <span className={styles.contactIconWrap}>
                          <FaWhatsapp />
                        </span>
                        <span className={styles.contactTextWrap}>
                          <small>Respuesta rápida</small>
                          <strong>Contactar</strong>
                        </span>
                      </a>

                      <a
                        href={phoneNumber ? `tel:${phoneNumber}` : undefined}
                        className={`${styles.contactMiniBtn} ${styles.contactCallBtn} ${styles.mobileContactBtn} ${styles.mobileCallBtn} ${!phoneNumber ? styles.mobileDisabledBtn : ""}`}
                        data-gsap="action"
                        onClick={() => registrarClickContacto("Llamada")}
                        aria-disabled={!phoneNumber}
                        onMouseDown={(e) => {
                          if (!phoneNumber) e.preventDefault();
                        }}
                      >
                        <span className={styles.contactIconWrap}>
                          <FaPhoneAlt />
                        </span>
                        <span className={styles.contactTextWrap}>
                          <small>Atención directa</small>
                          <strong>Llamar</strong>
                        </span>
                      </a>

                      <button
                        type="button"
                        className={`${styles.contactMiniBtn} ${styles.contactShareBtn}`}
                        data-gsap="action"
                        onClick={handleShare}
                        disabled={!shareUrl}
                      >
                        <span className={styles.contactIconWrap}>
                          <FaShareAlt />
                        </span>
                        <span className={styles.contactTextWrap}>
                          <small>Enviar enlace</small>
                          <strong>Compartir</strong>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className={styles.quickGrid} data-gsap="card">
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

                  <div className={styles.financingCard} data-gsap="card">
                    <div className={styles.financingHeader}>
                      <div>
                        <span className={styles.financingKicker}>
                          <FaCalculator /> Geosimulador financiero
                        </span>
                        <h3>{`Financiamiento para ${lote.nombre}`}</h3>
                      </div>
                      <div className={styles.financingMiniMeta}>
                        <FaPiggyBank />
                        {formatMoney(financingPrice, financingCurrency)}
                      </div>
                    </div>

                    {financingScenario ? (
                      <>
                        <div className={styles.financingPrimary}>
                          <div>
                            <span>Inicial</span>
                            <strong>
                              {formatMoney(
                                financingScenario.initial,
                                financingCurrency,
                              )}
                            </strong>
                          </div>
                          <div>
                            <span>Meses</span>
                            <strong>{financingScenario.months}</strong>
                          </div>
                          <div>
                            <span>Saldo a financiar</span>
                            <strong>
                              {formatMoney(
                                Math.max(
                                  financingPrice - financingScenario.initial,
                                  0,
                                ),
                                financingCurrency,
                              )}
                            </strong>
                          </div>
                        </div>

                        {/* <div className={styles.financingSparkRow}>
                          <div className={styles.financingSparkCard}>
                            <span className={styles.financingSparkIcon}>
                              <FaPiggyBank />
                            </span>
                            <div>
                              <small>Enganche actual</small>
                              <strong>
                                {Math.round(
                                  (financingScenario.initial /
                                    Math.max(financingPrice, 1)) *
                                    100,
                                )}
                                %
                              </strong>
                            </div>
                          </div>
                          <div className={styles.financingSparkCard}>
                            <span className={styles.financingSparkIcon}>
                              <FaCalculator />
                            </span>
                            <div>
                              <small>Total estimado</small>
                              <strong>
                                {formatMoney(
                                  financingScenario.totalPaid,
                                  financingCurrency,
                                )}
                              </strong>
                            </div>
                          </div>
                        </div> */}

                        <div className={styles.financingAdjustHeader}>
                          <div>
                            <span className={styles.financingSectionEyebrow}>
                              Ajusta tu plan
                            </span>
                            <p className={styles.financingSectionNote}>
                              Usa un plan rápido o personaliza inicial y plazo.
                            </p>
                          </div>
                        </div>

                        <div className={styles.financingPresets}>
                          {financingPresets.map((preset) => (
                            <button
                              key={`${preset.months}-${preset.initial_amount}`}
                              type="button"
                              className={`${styles.financingPresetBtn} ${Number(preset.months) === financingScenario.months ? styles.financingPresetBtnActive : ""}`}
                              onClick={() => {
                                if (preset.initial_amount !== undefined) {
                                  setFinancingInitial(
                                    clamp(
                                      preset.initial_amount,
                                      financingMinInitial,
                                      financingMaxInitial,
                                    ),
                                  );
                                }
                                if (preset.months !== undefined) {
                                  setFinancingMonths(
                                    clamp(
                                      preset.months,
                                      financingMinMonths,
                                      financingMaxMonths,
                                    ),
                                  );
                                }
                              }}
                            >
                              <small>Plan rápido</small>
                              <strong>
                                {formatMoney(
                                  calcPayment(
                                    Math.max(
                                      financingPrice -
                                        clamp(
                                          preset.initial_amount ??
                                            financingInitial,
                                          financingMinInitial,
                                          financingMaxInitial,
                                        ),
                                      0,
                                    ),
                                    financingScenario.annualRate,
                                    clamp(
                                      preset.months ?? financingMonths,
                                      financingMinMonths,
                                      financingMaxMonths,
                                    ),
                                  ) +
                                    financingScenario.monthlyAdminFee +
                                    financingScenario.insuranceMonthly,
                                  financingCurrency,
                                )}
                              </strong>
                              <span>
                                {preset.label || `${preset.months} meses`}
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className={styles.financingControls}>
                          <label className={styles.financingField}>
                            <div className={styles.financingFieldHeader}>
                              <span className={styles.financingFieldTitle}>
                                Inicial
                              </span>
                              <small className={styles.financingFieldHint}>
                                Cuánto pagarías al inicio.
                              </small>
                            </div>
                            <div className={styles.financingInputShell}>
                              <span className={styles.financingInputPrefix}>
                                {financingCurrency}
                              </span>
                              <input
                                type="number"
                                min={financingMinInitial}
                                max={financingMaxInitial}
                                step="100"
                                value={financingInitial}
                                onChange={(e) =>
                                  setFinancingInitial(
                                    Number(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                            <input
                              type="range"
                              min={financingMinInitial}
                              max={financingMaxInitial}
                              step="100"
                              value={clamp(
                                financingInitial,
                                financingMinInitial,
                                financingMaxInitial,
                              )}
                              onChange={(e) =>
                                setFinancingInitial(Number(e.target.value) || 0)
                              }
                              className={styles.financingRange}
                              style={getRangeStyle(
                                financingInitial,
                                financingMinInitial,
                                financingMaxInitial,
                              )}
                            />
                            <div className={styles.financingRangeMeta}>
                              <span>
                                Min{" "}
                                {formatMoney(
                                  financingMinInitial,
                                  financingCurrency,
                                )}
                              </span>
                              <strong>
                                {formatMoney(
                                  clamp(
                                    financingInitial,
                                    financingMinInitial,
                                    financingMaxInitial,
                                  ),
                                  financingCurrency,
                                )}
                              </strong>
                              <span>
                                Max{" "}
                                {formatMoney(
                                  financingMaxInitial,
                                  financingCurrency,
                                )}
                              </span>
                            </div>
                          </label>

                          <label className={styles.financingField}>
                            <div className={styles.financingFieldHeader}>
                              <span className={styles.financingFieldTitle}>
                                Meses
                              </span>
                              <small className={styles.financingFieldHint}>
                                Define el plazo total de pago.
                              </small>
                            </div>
                            <div className={styles.financingInputShell}>
                              <span
                                className={styles.financingInputPrefixPlain}
                              >
                                plazo
                              </span>
                              <input
                                type="number"
                                min={financingMinMonths}
                                max={financingMaxMonths}
                                step="1"
                                value={financingMonths}
                                onChange={(e) =>
                                  setFinancingMonths(
                                    Number(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                            <input
                              type="range"
                              min={financingMinMonths}
                              max={financingMaxMonths}
                              step="1"
                              value={clamp(
                                financingMonths,
                                financingMinMonths,
                                financingMaxMonths,
                              )}
                              onChange={(e) =>
                                setFinancingMonths(Number(e.target.value) || 0)
                              }
                              className={styles.financingRange}
                              style={getRangeStyle(
                                financingMonths,
                                financingMinMonths,
                                financingMaxMonths,
                              )}
                            />
                            <div className={styles.financingRangeMeta}>
                              <span>Min {financingMinMonths}</span>
                              <strong>
                                {clamp(
                                  financingMonths,
                                  financingMinMonths,
                                  financingMaxMonths,
                                )}{" "}
                                meses
                              </strong>
                              <span>Max {financingMaxMonths}</span>
                            </div>
                          </label>
                        </div>

                        <div className={styles.financingActionRow}>
                          <button
                            type="button"
                            className={styles.financingPayBtn}
                          >
                            <span className={styles.financingPayCopy}>
                              <small>Precio a pagar</small>
                              <strong>
                                {formatMoney(
                                  financingScenario.monthlyEstimate,
                                  financingCurrency,
                                )}
                              </strong>
                              <span>Cuota estimada mensual</span>
                            </span>
                          </button>

                          <a
                            href={financingWhatsAppHref}
                            target="_blank"
                            rel="noreferrer"
                            className={`${styles.financingWhatsAppBtn} ${!financingWhatsAppHref ? styles.financingWhatsAppBtnDisabled : ""}`}
                            aria-disabled={!financingWhatsAppHref}
                            onClick={(e) => {
                              if (!financingWhatsAppHref) e.preventDefault();
                            }}
                          >
                            <FaWhatsapp />
                            <span className={styles.financingWhatsAppCopy}>
                              <small>Enviar Financiamiento</small>
                              <strong>Lo quiero</strong>
                            </span>
                          </a>
                        </div>

                        <p className={styles.financingNote}>
                          Meses permitidos: {financingMinMonths} a{" "}
                          {financingMaxMonths}
                          {" · "}
                          Inicial permitida:{" "}
                          {formatMoney(
                            financingMinInitial,
                            financingCurrency,
                          )}{" "}
                          a{" "}
                          {formatMoney(financingMaxInitial, financingCurrency)}
                          {" · "}
                          Tasa anual: {financingScenario.annualRate}% · Ingreso
                          sugerido:{" "}
                          {formatMoney(
                            financingScenario.suggestedIncome,
                            financingCurrency,
                          )}
                        </p>
                      </>
                    ) : (
                      <p className={styles.financingNote}>
                        La inmobiliaria todavía no configuró este plan.
                      </p>
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
                        <div className={styles.fItem}>
                          <FaBed /> {lote.dormitorios} Dorm.
                        </div>
                        <div className={styles.fItem}>
                          <FaBath /> {lote.banos} Baños
                        </div>
                        <div className={styles.fItem}>
                          <FaHome /> {lote.cuartos} Cuartos
                        </div>
                        <div className={styles.fItem}>
                          <FaChair /> {lote.sala} Sala
                        </div>
                        <div className={styles.fItem}>
                          <FaUtensils /> {lote.cocina} Cocina
                        </div>
                        <div className={styles.fItem}>
                          <FaCar /> {lote.cochera} Cochera
                        </div>
                        {lote.patio > 0 && (
                          <div className={styles.fItem}>
                            <FaCampground /> {lote.patio} Patio
                          </div>
                        )}
                        {lote.jardin > 0 && (
                          <div className={styles.fItem}>
                            <FaTree /> {lote.jardin} Jardín
                          </div>
                        )}
                        {lote.terraza > 0 && (
                          <div className={styles.fItem}>
                            <FaSun /> {lote.terraza} Terraza
                          </div>
                        )}
                        {lote.azotea > 0 && (
                          <div className={styles.fItem}>
                            <FaBuilding /> {lote.azotea} Azotea
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <h3 className={styles.sectionTitle}>Cercanía</h3>
                  <div className={styles.distanciaBox} data-gsap="metric">
                    <div className={styles.metricGroup}>
                      <div className={styles.metricItem}>
                        <span className={styles.metricValue}>{carMinutes}</span>
                        <span className={styles.metricUnit}>MIN</span>
                        <FaCar className={styles.metricIcon} />
                      </div>
                      <div className={styles.metricItem}>
                        <span className={styles.metricValue}>{carKm}</span>
                        <span className={styles.metricUnit}>KM</span>
                      </div>
                    </div>
                    <div className={styles.metricDivider} />
                    <div className={styles.metricGroup}>
                      <div className={styles.metricItem}>
                        <span className={styles.metricValue}>
                          {walkMinutes}
                        </span>
                        <span className={styles.metricUnit}>MIN</span>
                        <FaWalking className={styles.metricIcon} />
                      </div>
                      <div className={styles.metricItem}>
                        <span className={styles.metricValue}>{walkKm}</span>
                        <span className={styles.metricUnit}>KM</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.socialFooter}>
                    <a
                      href={facebookHref}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.fb}
                      onClick={() => registrarClickContacto("Facebook")}
                    >
                      <FaFacebook />
                    </a>
                    <a
                      href={webHref}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.web}
                      onClick={() => registrarClickContacto("Web")}
                    >
                      <FaGlobe />
                    </a>
                  </div>

                  <div className={styles.aboutCard} id="lote-inmo-detalle">
                    <span className={styles.aboutBadge}>Inmobiliaria</span>
                    <h3 className={styles.sectionTitle}>Sobre quien publica</h3>
                    {inmo?.descripcion ? (
                      <p className={styles.inmoDescription}>
                        {inmo.descripcion}
                      </p>
                    ) : (
                      <p className={styles.inmoDescription}>
                        Información comercial del proyecto y atención directa
                        con la inmobiliaria.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {show360 && (
        <Suspense fallback={null}>
          <Viewer360Modal
            images360={images360}
            projectName={proyecto?.nombreproyecto || "GeoHabita 360"}
            onClose={() => setShow360(false)}
          />
        </Suspense>
      )}

      {/* VISOR PANTALLA COMPLETA INTERACTIVO */}
      {fullscreenImgIndex !== null && validImages.length > 0 && (
        <div
          className={styles.fullscreenOverlay}
          onClick={() => setFullscreenImgIndex(null)}
          // Eventos para Swipe en celular
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX.current - touchEndX;
            if (Math.abs(diff) > 50) {
              // Sensibilidad
              if (diff > 0) {
                // Swipe Izquierda -> Siguiente
                setFullscreenImgIndex((prev) =>
                  prev === validImages.length - 1 ? 0 : prev + 1,
                );
              } else {
                // Swipe Derecha -> Anterior
                setFullscreenImgIndex((prev) =>
                  prev === 0 ? validImages.length - 1 : prev - 1,
                );
              }
            }
          }}
        >
          {/* Botón Anterior */}
          <button
            className={`${styles.navArrowFullscreen} ${styles.arrowLeft}`}
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenImgIndex((prev) =>
                prev === 0 ? validImages.length - 1 : prev - 1,
              );
            }}
          >
            <FaChevronLeft />
          </button>

          <img
            src={withApiBase(
              `https://api.geohabita.com${validImages[fullscreenImgIndex].imagen}`,
            )}
            className={styles.fullscreenImg}
            alt="Zoom"
            onClick={(e) => e.stopPropagation()} // Evita que se cierre al tocar la imagen
          />

          {/* Botón Siguiente */}
          <button
            className={`${styles.navArrowFullscreen} ${styles.arrowRight}`}
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenImgIndex((prev) =>
                prev === validImages.length - 1 ? 0 : prev + 1,
              );
            }}
          >
            <FaChevronRight />
          </button>

          <div className={styles.fsBadge}>
            {fullscreenImgIndex + 1} / {validImages.length}
          </div>

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
