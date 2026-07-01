import { withApiBase } from "../../config/api.js";
import { formatLocalDateForApi, formatLocalTimeForApi } from "../../utils/dateTime.js";
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
  FaCheckCircle,
  FaTimesCircle,
  FaQuestionCircle,
  FaCalculator,
  FaPiggyBank,
  FaTint,
  FaBolt,
  FaLightbulb,
  FaDrawPolygon,
  FaBroadcastTower,
  FaRoad,
  FaMapMarkedAlt,
} from "react-icons/fa";
import styles from "./Proyecto.module.css";
import AmortizationChart from "../../components/AmortizationChart";
import { buildInverseFinancingOptions } from "../../components/utils/financing";
import useImagePanZoom from "../../components/useImagePanZoom";

import { FaChevronDown } from "react-icons/fa";

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

const projectUtilityFields = [
  {
    key: "agua",
    label: "Agua",
    icon: FaTint,
    accent: "utilityAqua",
  },
  {
    key: "desague",
    label: "Desagüe",
    icon: FaDrawPolygon,
    accent: "utilityCyan",
  },
  {
    key: "luz",
    label: "Red eléctrica",
    icon: FaBolt,
    accent: "utilityGold",
  },
  {
    key: "alumbrado_publico",
    label: "Alumbrado",
    icon: FaLightbulb,
    accent: "utilityAmber",
  },
  {
    key: "postes_luz",
    label: "Postería",
    icon: FaBroadcastTower,
    accent: "utilitySky",
  },
  {
    key: "veredas",
    label: "Veredas",
    icon: FaRoad,
    accent: "utilitySlate",
  },
];

const getUtilityStatus = (value) => {
  if (value === true || value === 1 || value === "1") {
    return {
      label: "Disponible",
      className: "utilityStatusYes",
      icon: <FaCheckCircle />,
    };
  }

  if (value === false || value === 0 || value === "0") {
    return {
      label: "No disponible",
      className: "utilityStatusNo",
      icon: <FaTimesCircle />,
    };
  }

  return {
    label: "No especificado",
    className: "utilityStatusUnknown",
    icon: <FaQuestionCircle />,
  };
};

const ProyectoSidebar = ({
  inmo,
  proyecto,
  selectedLote,
  lotes = [],
  imagenes,
  espacios = [],
  onClose,
  onSelectLote,
  walkingInfo,
  drivingInfo,
  hasRealPosition = false,
  onRequestLocation,
  mapHeaderOffsetPx = 0,
  forceCompactForLote = false,
  isLoading = false,
}) => {
  // 360
  const [show360, setShow360] = useState(false);
  const [images360, setImages360] = useState([]);
  const [images360Status, setImages360Status] = useState("idle");

  const [expanded] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [fullscreenImgIndex, setFullscreenImgIndex] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const [sheetMode, setSheetMode] = useState("mid");
  const [mobileSheetTop, setMobileSheetTop] = useState(null);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const sidebarRef = useRef(null);
  const inmoFooterRef = useRef(null);
  const contentRef = useRef(null);
  const mobileTopHeaderRef = useRef(null);
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
  const images360CacheRef = useRef(new Map());
  const imagesPending = imagenes === null;
  const validImages = useMemo(() => {
    const imageItems = Array.isArray(imagenes) ? imagenes : [];
    return imageItems.filter((img) => {
      const src = img?.imagenproyecto;
      if (typeof src !== "string") return false;
      const trimmed = src.trim();
      if (!trimmed) return false;
      return !trimmed.toLowerCase().includes("no hay imagenes referenciales");
    });
  }, [imagenes]);

  useEffect(() => {
    setShow360(false);
    setImages360([]);
    setImages360Status("idle");
  }, [proyecto?.idproyecto]);

  const loadImages360 = useCallback(async () => {
    const projectId = proyecto?.idproyecto;
    if (!projectId) return [];

    const cached = images360CacheRef.current.get(projectId);
    if (cached) {
      setImages360(cached);
      setImages360Status("ready");
      return cached;
    }

    setImages360Status("loading");
    try {
      const res = await fetch(
        withApiBase(
          `https://api.geohabita.com/api/get_imagen_360_casa/${projectId}/`,
        ),
      );
      const data = res.ok ? await res.json() : [];
      const normalized = Array.isArray(data) ? data : [];
      images360CacheRef.current.set(projectId, normalized);
      setImages360(normalized);
      setImages360Status("ready");
      return normalized;
    } catch (err) {
      console.error("Error cargando 360:", err);
      setImages360Status("error");
      return [];
    }
  }, [proyecto?.idproyecto]);

  const handleOpen360 = useCallback(async () => {
    const loadedImages = images360.length ? images360 : await loadImages360();
    if (loadedImages.length) {
      setShow360(true);
      return;
    }
    window.alert("Este proyecto no cuenta con vista 360° disponible.");
  }, [images360, loadImages360]);

  useEffect(() => {
    if (proyecto?.idproyecto) {
      loadImages360();
    }
  }, [proyecto?.idproyecto, loadImages360]);

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
    return withApiBase(
      `https://api.geohabita.com/share/proyecto/${proyectoId}/`,
    );
  }, [inmo, proyecto]);
  const projectNameWords = useMemo(
    () =>
      String(proyecto?.nombreproyecto || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    [proyecto?.nombreproyecto],
  );
  const isCasaProject = Number(proyecto?.idtipoinmobiliaria) === 2;
  const financingConfig = useMemo(
    () => parseFinancingConfig(proyecto?.financing_config),
    [proyecto?.financing_config],
  );
  const selectedLotePrice = Number(selectedLote?.precio || 0);
  const shouldUseLoteDrivenFinancing = !isCasaProject;
  const financingTarget = useMemo(() => {
    if (shouldUseLoteDrivenFinancing) {
      if (selectedLote && selectedLotePrice > 0) {
        return {
          type: "lote",
          label: selectedLote?.nombre || "Lote seleccionado",
          price: selectedLotePrice,
        };
      }
      return null;
    }
    const projectPrice = Number(proyecto?.precio || 0);
    if (projectPrice > 0) {
      return {
        type: "proyecto",
        label: proyecto?.nombreproyecto || "Proyecto",
        price: projectPrice,
      };
    }
    return null;
  }, [
    proyecto?.nombreproyecto,
    proyecto?.precio,
    selectedLote,
    selectedLotePrice,
    shouldUseLoteDrivenFinancing,
  ]);
  const financingCurrency =
    selectedLote?.moneda || proyecto?.moneda || financingConfig?.currency || "S/";
  const financingPrice = Number(
    financingTarget?.price ||
      financingConfig?.price_reference ||
      proyecto?.precio ||
      0,
  );
  const configuredMinInitial = Number(
    financingConfig?.min_initial_amount ??
      financingConfig?.default_initial_amount ??
      0,
  ) || 0;
  const financingMinInitial = Math.max(
    0,
    financingPrice > 0 && configuredMinInitial > financingPrice
      ? Math.round(financingPrice * 0.1)
      : configuredMinInitial || Math.round(financingPrice * 0.1),
  );
  const financingMaxInitial = Math.max(
    financingMinInitial + 100,
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
  const [geoCotizadorMode, setGeoCotizadorMode] = useState("cash");
  const [geoCotizadorAmount, setGeoCotizadorAmount] = useState("");

  useEffect(() => {
    setFinancingInitial(financingDefaultInitial);
    setFinancingMonths(financingDefaultMonths);
    setGeoCotizadorAmount("");
    setGeoCotizadorMode("cash");
  }, [financingDefaultInitial, financingDefaultMonths, proyecto?.idproyecto]);

  const financingScenario = useMemo(() => {
    if (!financingPrice || !financingTarget) return null;
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
    const graceMonths = Math.max(0, Number(financingConfig?.grace_months || 0));
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
    const interestEstimate = totalPaid - financingPrice;
    const upfrontTotal = initial + originationFee;
    const suggestedIncome = monthlyEstimate * 3;

    return {
      initial,
      months,
      annualRate,
      monthlyAdminFee,
      insuranceMonthly,
      originationFee,
      balloonPayment,
      graceMonths,
      monthlyEstimate,
      totalPaid,
      interestEstimate,
      upfrontTotal,
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
  const projectLots = useMemo(
    () =>
      (Array.isArray(lotes) ? lotes : []).filter(
        (lot) =>
          lot && Number(lot.vendido) === 0 && Number(lot.precio || 0) > 0,
      ),
    [lotes],
  );
  const geoCotizadorMatches = useMemo(() => {
    const amount = Number(geoCotizadorAmount || 0);
    if (!amount || !projectLots.length) return [];

    if (geoCotizadorMode === "cash") {
      return projectLots
        .filter((lot) => Number(lot.precio || 0) <= amount)
        .sort(
          (a, b) =>
            Math.abs(amount - Number(a.precio || 0)) -
            Math.abs(amount - Number(b.precio || 0)),
        )
        .slice(0, 8)
        .map((lot) => ({
          lote: lot,
          kind: "cash",
          label: "Contado",
          amountLabel: formatMoney(lot.precio, lot.moneda || financingCurrency),
          helper: "Precio total del lote",
        }));
    }

    return projectLots
      .map((lot) => {
        const options = buildInverseFinancingOptions({
          price: Number(lot.precio || 0),
          budget: amount,
          annualRate: Number(financingConfig?.annual_interest_rate || 0),
          minInitial: financingMinInitial,
          maxInitial: Math.min(financingMaxInitial, Number(lot.precio || 0)),
          minMonths: financingMinMonths,
          maxMonths: financingMaxMonths,
          monthlyAdminFee: Number(financingConfig?.monthly_admin_fee || 0),
          insuranceMonthly: Number(financingConfig?.insurance_monthly || 0),
          originationFeePct: Number(financingConfig?.origination_fee_pct || 0),
          balloonPct: Number(financingConfig?.balloon_payment_pct || 0),
          currency: financingCurrency,
        });
        if (!options.length) return null;
        return {
          lote: lot,
          option: options[0],
          kind: "credit",
          label: "Credito",
          amountLabel: formatMoney(
            options[0].monthlyEstimate,
            lot.moneda || financingCurrency,
          ),
          helper: `Inicial ${formatMoney(options[0].initial, lot.moneda || financingCurrency)} · ${options[0].months} meses`,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          Number(a.option?.gapToBudget || 0) -
          Number(b.option?.gapToBudget || 0),
      )
      .slice(0, 8);
  }, [
    financingConfig,
    financingCurrency,
    financingMaxInitial,
    financingMinInitial,
    financingMinMonths,
    financingMaxMonths,
    geoCotizadorAmount,
    geoCotizadorMode,
    projectLots,
  ]);
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

  const carouselSwipeDistance = 40;
  const showNextFullscreenImage = useCallback(() => {
    setFullscreenImgIndex((prev) =>
      prev === validImages.length - 1 ? 0 : prev + 1,
    );
  }, [validImages.length]);

  const showPrevFullscreenImage = useCallback(() => {
    setFullscreenImgIndex((prev) =>
      prev === 0 ? validImages.length - 1 : prev - 1,
    );
  }, [validImages.length]);
  const fullscreenPanZoom = useImagePanZoom({
    onSwipeNext: validImages.length > 1 ? showNextFullscreenImage : undefined,
    onSwipePrev: validImages.length > 1 ? showPrevFullscreenImage : undefined,
  });

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
      setCurrentImg((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
    } else {
      setCurrentImg((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
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

  const closeFullscreen = useCallback(() => {
    setFullscreenImgIndex(null);
    fullscreenPanZoom.reset();
  }, [fullscreenPanZoom]);

  const scrollToInmoFooter = useCallback(() => {
    inmoFooterRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const registrarClickContacto = async (redSocial) => {
    try {
      await fetch(
        withApiBase("https://api.geohabita.com/api/registerClickContactos/"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idproyecto: proyecto.idproyecto,
            dia: formatLocalDateForApi(),
            hora: formatLocalTimeForApi(),
            redSocial: redSocial,
          }),
        },
      );
    } catch (error) {
      console.error("Error registrando click:", error);
    }
  };

  useEffect(() => {
    if (!validImages.length) return undefined;

    const indexesToPreload = new Set([currentImg, prevImgIndex, nextImgIndex]);
    const preloadVisibleImages = () => {
      indexesToPreload.forEach((index) => {
        const img = validImages[index];
        if (!img?.imagenproyecto) return;
        const image = new Image();
        image.decoding = "async";
        image.src = withApiBase(
          `https://api.geohabita.com${img.imagenproyecto}`,
        );
      });
    };

    if (typeof window !== "undefined" && window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(preloadVisibleImages, {
        timeout: 900,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(preloadVisibleImages, 120);
    return () => window.clearTimeout(timer);
  }, [validImages, currentImg, prevImgIndex, nextImgIndex]);
  useEffect(() => {
    fullscreenPanZoom.reset();
  }, [fullscreenImgIndex, fullscreenPanZoom.reset]);

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
    const esc = (e) => {
      if (e.key !== "Escape") return;
      if (fullscreenImgIndex !== null) {
        closeFullscreen();
        return;
      }
      cerrarSidebar();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [cerrarSidebar, closeFullscreen, fullscreenImgIndex]);

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
        )
        .fromTo(
          "[data-gsap='utility']",
          {
            autoAlpha: 0,
            y: 24,
            scale: 0.9,
            rotateX: -12,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            stagger: 0.06,
            duration: 0.55,
            ease: "power3.out",
          },
          "-=0.35",
        );
      gsap.to("[data-gsap='utility-icon']", {
        y: -3,
        duration: 1.9,
        stagger: 0.08,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
    {
      scope: sidebarRef,
      dependencies: [isLoading, isMobileView, proyecto?.idproyecto],
      revertOnUpdate: true,
    },
  );

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

  const clampSheetTop = useCallback(
    (top) => {
      const { expandedTop, collapsedTop } = getSheetAnchors();
      return Math.min(Math.max(top, expandedTop), collapsedTop);
    },
    [getSheetAnchors],
  );

  const getModeByTop = useCallback(
    (top) => {
      const { expandedTop, collapsedTop } = getSheetAnchors();
      if (top <= expandedTop + 24) return "expanded";
      if (top >= collapsedTop - 24) return "collapsed";
      return "mid";
    },
    [getSheetAnchors],
  );

  const setSheetTopAndMode = useCallback(
    (nextTop) => {
      const safeTop = clampSheetTop(nextTop);
      setMobileSheetTop(safeTop);
      setSheetMode(getModeByTop(safeTop));
    },
    [clampSheetTop, getModeByTop],
  );

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
    return;
  };

  useEffect(() => {
    if (!isMobileView) return;
    const headerEl = mobileTopHeaderRef.current;
    const contentEl = contentRef.current;
    if (headerEl) {
      headerEl.addEventListener("touchmove", onSheetTouchMove, {
        passive: false,
      });
    }
    if (contentEl) {
      contentEl.addEventListener("touchmove", onNestedTouchMove, {
        passive: false,
      });
    }
    return () => {
      if (headerEl) {
        headerEl.removeEventListener("touchmove", onSheetTouchMove);
      }
      if (contentEl) {
        contentEl.removeEventListener("touchmove", onNestedTouchMove);
      }
    };
  });

  if (!proyecto) return null;

  const overlayActive = false;

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
        className={`${styles.sidebar} ${expanded ? styles.expanded : ""} ${isMobileView ? styles.mobileSidebar : ""} ${sheetMode === "collapsed" ? styles.mobileCollapsed : ""} ${sheetMode === "expanded" ? styles.mobileExpanded : ""} ${!isMobileView && !isLoading && !imagesPending && validImages.length === 0 ? styles.sidebarNoMedia : ""}`}
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
            ref={mobileTopHeaderRef}
            className={styles.mobileTopHeader}
            onTouchStart={onSheetTouchStart}
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
          className={`${styles.splitLayout} ${sheetMode === "collapsed" ? styles.mobileHiddenContent : ""}`}
        >
          {/* SECCIÓN IMAGEN / SLIDER */}
          <div className={styles.imageSection} data-gsap="media">
            {isLoading || imagesPending ? (
              <div className={styles.skeletonImage} />
            ) : validImages.length === 0 ? null : isMobileView ? (
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
                      src={withApiBase(
                        `https://api.geohabita.com${validImages[currentImg].imagenproyecto}`,
                      )}
                      alt="Propiedad"
                      className={styles.mobileSingleImage}
                      onClick={() => setFullscreenImgIndex(currentImg)}
                      loading="eager"
                      decoding="async"
                      fetchpriority="high"
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
                        src={withApiBase(
                          `https://api.geohabita.com${validImages[0].imagenproyecto}`,
                        )}
                        alt="Imagen 1"
                        className={styles.mobileDualImage}
                        loading="eager"
                        decoding="async"
                        fetchpriority="high"
                      />
                    </button>
                    <button
                      className={styles.mobileDualItem}
                      onClick={() => setFullscreenImgIndex(1)}
                      aria-label="Ver imagen 2"
                    >
                      <img
                        src={withApiBase(
                          `https://api.geohabita.com${validImages[1].imagenproyecto}`,
                        )}
                        alt="Imagen 2"
                        className={styles.mobileDualImage}
                        loading="eager"
                        decoding="async"
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
                        src={withApiBase(
                          `https://api.geohabita.com${validImages[prevImgIndex].imagenproyecto}`,
                        )}
                        alt="Anterior"
                        className={styles.mobileSideImage}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                    <img
                      key={currentImg}
                      src={withApiBase(
                        `https://api.geohabita.com${validImages[currentImg].imagenproyecto}`,
                      )}
                      alt="Propiedad"
                      className={styles.mobileMainImage}
                      onClick={() => setFullscreenImgIndex(currentImg)}
                      loading="eager"
                      decoding="async"
                      fetchpriority="high"
                    />
                    <button
                      className={`${styles.mobileSideSlide} ${styles.mobileSideRight}`}
                      onClick={nextSlide}
                      aria-label="Imagen siguiente"
                    >
                      <img
                        src={withApiBase(
                          `https://api.geohabita.com${validImages[nextImgIndex].imagenproyecto}`,
                        )}
                        alt="Siguiente"
                        className={styles.mobileSideImage}
                        loading="lazy"
                        decoding="async"
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
                  src={withApiBase(
                    `https://api.geohabita.com${validImages[currentImg].imagenproyecto}`,
                  )}
                  alt="Propiedad"
                  className={styles.mainImage}
                  onClick={() => setFullscreenImgIndex(currentImg)}
                  loading="eager"
                  decoding="async"
                  fetchpriority="high"
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

          {/* SECCIÓN INFORMACIÓN */}
          <div
            className={styles.infoSection}
            ref={contentRef}
            onScroll={handleScroll}
            onTouchStart={onNestedTouchStart}
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
                  <div
                    className={`${styles.inmoCard} ${isMobileView && validImages.length > 0 ? styles.mobileInmoCard : ""}`}
                    data-gsap="card"
                  >
                    <div className={styles.inmoHeader}>
                      <div className={styles.inmoIcon}>
                        <FaBuilding />
                      </div>

                      <div className={styles.inmoIdentity}>
                        <span className={styles.inmoLabel}>
                          Inmobiliaria / Persona
                        </span>
                        <h2 className={styles.inmoName}>
                          {inmo?.nombreinmobiliaria}
                        </h2>
                        <button
                          type="button"
                          className={styles.inmoMicroTag}
                          onClick={scrollToInmoFooter}
                        >
                          Ver más
                        </button>
                      </div>
                    </div>
                  </div>

                  {images360.length > 0 && (
                    <button
                      onClick={handleOpen360}
                      className={styles.btn360}
                      data-gsap="action"
                      disabled={images360Status === "loading"}
                    >
                      <span className={styles.btn360Orbit}>
                        <FaGlobe className={styles.icon360} />
                      </span>
                      <span className={styles.btn360Text}>
                        <small>GeoHabita recomienda</small>
                        <strong>
                          {images360Status === "loading"
                            ? "Cargando tour 360..."
                            : "Visualizar en 360°"}
                        </strong>
                      </span>
                      <span className={styles.btn360Ping} aria-hidden="true" />
                    </button>
                  )}
                  <p className={styles.proyectoP}>Proyecto</p>
                  {proyecto.idtipoinmobiliaria === 2 && (
                    <span
                      className={`${styles.legalLabel} ${!proyecto.titulo_propiedad ? styles.legalLabelDanger : ""}`}
                    >
                      {proyecto.titulo_propiedad
                        ? "✓ Cuenta con titulo"
                        : "• No cuenta con titulo"}
                    </span>
                  )}

                  <h1 className={styles.nombreProyecto}>
                    {projectNameWords.length > 0
                      ? projectNameWords.map((word, index) => (
                          <span
                            key={`${word}-${index}`}
                            className={styles.nombreProyectoWord}
                          >
                            {word}
                          </span>
                        ))
                      : proyecto.nombreproyecto}
                  </h1>
                  {/* <p className={styles.ubicacion}>📍 {proyecto.descripcion?.split('.')[0]}</p> */}
                  {isMobileView ? (
                    <div className={styles.mobileMetricsBox} data-gsap="metric">
                      {hasRealPosition ? (
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
                      ) : (
                        <button
                          type="button"
                          className={styles.locationCtaBtn}
                          onClick={onRequestLocation}
                        >
                          <FaMapMarkedAlt className={styles.locationCtaIcon} />
                          Para ver el tiempo y distancia a este proyecto, debes
                          activar tu ubicación
                        </button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={styles.desktopMetricsBox}
                      data-gsap="metric"
                    >
                      {hasRealPosition ? (
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
                      ) : (
                        <button
                          type="button"
                          className={styles.locationCtaBtn}
                          onClick={onRequestLocation}
                        >
                          <FaMapMarkedAlt className={styles.locationCtaIcon} />
                          Para ver el tiempo y distancia a este proyecto, debes
                          activar tu ubicación
                        </button>
                      )}
                    </div>
                  )}

                  <div
                    className={`${styles.priceContainer} ${isCasaProject || proyecto.precio > 0 ? styles.housePriceContainer : ""}`}
                    data-gsap="card"
                  >
                    {proyecto.precio > 0 && (
                      <div className={styles.priceRow}>
                        <img
                          src={proyecto.bandera}
                          className={styles.flagIcon}
                          alt="Bandera"
                          loading="lazy"
                          decoding="async"
                        />

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
                          className={`${styles.mobileContactBtn} ${styles.mobileCallBtn} ${!phoneNumber ? styles.mobileDisabledBtn : ""}`}
                          data-gsap="action"
                          onClick={() => registrarClickContacto("Llamada")}
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
                          className={`${styles.mobileContactBtn} ${styles.mobileShareBtn}`}
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

                        <a
                          href={facebookHref}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.mobileContactBtn} ${styles.mobileFacebookBtn}`}
                          data-gsap="action"
                          onClick={() => registrarClickContacto("Facebook")}
                        >
                          <span className={styles.contactIconWrap}>
                            <FaFacebook />
                          </span>
                          <span className={styles.contactTextWrap}>
                            <small>Ver Perfil</small>
                            <strong>Facebook</strong>
                          </span>
                        </a>

                        <a
                          href={webHref}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.mobileContactBtn} ${styles.mobileWebBtn}`}
                          data-gsap="action"
                          onClick={() => registrarClickContacto("Web")}
                        >
                          <span className={styles.contactIconWrap}>
                            <FaGlobe />
                          </span>
                          <span className={styles.contactTextWrap}>
                            <small>Ver Más</small>
                            <strong>Web</strong>
                          </span>
                        </a>
                      </div>
                    ) : (
                      <div className={styles.pantallaContactos}>
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
                          className={`${styles.contactMiniBtn} ${styles.contactCallBtn}`}
                          data-gsap="action"
                          onClick={() => registrarClickContacto("Llamada")}
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

                        <a
                          href={facebookHref}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.contactMiniBtn} ${styles.contactFacebookBtn}`}
                          data-gsap="action"
                          onClick={() => registrarClickContacto("Facebook")}
                        >
                          <span className={styles.contactIconWrap}>
                            <FaFacebook />
                          </span>
                          <span className={styles.contactTextWrap}>
                            <small>Ver Perfil</small>
                            <strong>Facebook</strong>
                          </span>
                        </a>

                        <a
                          href={webHref}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.contactMiniBtn} ${styles.contactWebBtn}`}
                          data-gsap="action"
                          onClick={() => registrarClickContacto("Web")}
                        >
                          <span className={styles.contactIconWrap}>
                            <FaGlobe />
                          </span>
                          <span className={styles.contactTextWrap}>
                            <small>Ver Más</small>
                            <strong>Web</strong>
                          </span>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className={styles.utilitiesCard} data-gsap="card">
                    <div className={styles.utilitiesHero}>
                      <div className={styles.utilitiesHeroCopy}>
                        <span className={styles.utilitiesKicker}>
                          GeoHabita presenta
                        </span>
                        <h3 className={styles.utilitiesTitle}>
                          Servicios del Proyecto
                        </h3>
                      </div>
                    </div>

                    <div className={styles.utilitiesGrid}>
                      {projectUtilityFields.map((field) => {
                        const status = getUtilityStatus(proyecto?.[field.key]);
                        const UtilityIcon = field.icon;
                        return (
                          <article
                            key={field.key}
                            className={`${styles.utilityPanel} ${styles[field.accent]} ${styles[status.className]}`}
                            data-gsap="utility"
                          >
                            <div className={styles.utilityPanelTop}>
                              <div className={styles.utilityIdentity}>
                                <span
                                  className={styles.utilityOrb}
                                  data-gsap="utility-icon"
                                >
                                  <UtilityIcon />
                                </span>
                                <div className={styles.utilityBody}>
                                  <strong className={styles.utilityTitle}>
                                    {field.label}
                                  </strong>
                                </div>
                              </div>
                              <span
                                className={`${styles.utilityChip} ${styles[status.className]}`}
                                title={status.label}
                                aria-label={status.label}
                              >
                                {status.icon}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  {shouldUseLoteDrivenFinancing && projectLots.length > 0 && (
                    <div className={styles.geoCotizadorCard} data-gsap="card">
                      <div className={styles.geoCotizadorHeader}>
                        <div>
                          <span className={styles.financingKicker}>
                            <FaCalculator /> GeoCotizador
                          </span>
                          <h3>
                            Quieres ver que lote calza con tu presupuesto?
                          </h3>
                        </div>
                        <div className={styles.financingMiniMeta}>
                          <FaPiggyBank />
                          {projectLots.length} lotes
                        </div>
                      </div>

                      <div className={styles.geoCotizadorModeRow}>
                        <button
                          type="button"
                          className={`${styles.geoCotizadorModeBtn} ${geoCotizadorMode === "cash" ? styles.geoCotizadorModeBtnActive : ""}`}
                          onClick={() => setGeoCotizadorMode("cash")}
                        >
                          Contado
                        </button>
                        {/* <button
                          type="button"
                          className={`${styles.geoCotizadorModeBtn} ${geoCotizadorMode === "credit" ? styles.geoCotizadorModeBtnActive : ""}`}
                          onClick={() => setGeoCotizadorMode("credit")}
                        >
                          Credito
                        </button> */}
                      </div>

                      <div className={styles.financingBudgetInputShell}>
                        <span className={styles.financingInputPrefix}>
                          {financingCurrency}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={geoCotizadorAmount}
                          onChange={(e) =>
                            setGeoCotizadorAmount(e.target.value)
                          }
                          placeholder={
                            geoCotizadorMode === "cash"
                              ? "Cual es tu presupuesto?"
                              : "Cuanto puedes pagar al mes"
                          }
                        />
                      </div>

                      {geoCotizadorAmount && geoCotizadorMatches.length > 0 ? (
                        <div className={styles.geoCotizadorMatchGrid}>
                          {geoCotizadorMatches.map((match) => {
                            const isActive =
                              Number(selectedLote?.idlote) ===
                              Number(match.lote.idlote);
                            return (
                              <button
                                key={`${match.kind}-${match.lote.idlote}`}
                                type="button"
                                className={`${styles.geoCotizadorMatchCard} ${isActive ? styles.geoCotizadorMatchCardActive : ""}`}
                                onClick={() => {
                                  onSelectLote?.(match.lote);
                                  if (match.option) {
                                    setFinancingInitial(
                                      Math.round(match.option.initial),
                                    );
                                    setFinancingMonths(match.option.months);
                                  }
                                }}
                              >
                                <div className={styles.geoCotizadorMatchTop}>
                                  <strong>
                                    {match.lote.nombre ||
                                      `Lote ${match.lote.idlote}`}
                                  </strong>
                                  <span>{match.label}</span>
                                </div>
                                <div className={styles.geoCotizadorMatchValue}>
                                  {match.amountLabel}
                                </div>
                                <p>{match.helper}</p>
                              </button>
                            );
                          })}
                        </div>
                      ) : geoCotizadorAmount ? (
                        <p className={styles.financingBudgetEmpty}>
                          No encontramos lotes que encajen con ese presupuesto.
                        </p>
                      ) : (
                        <p className={styles.geoCotizadorHint}>
                          Elige contado para comparar precios fijos o credito
                          para estimar la cuota mensual.
                        </p>
                      )}
                    </div>
                  )}

                  {financingConfig && financingConfig.enabled !== false && (
                  <div className={styles.financingCard} data-gsap="card">
                    <div className={styles.financingHeader}>
                      <div>
                        <span className={styles.financingKicker}>
                          <FaCalculator /> Geosimulador financiero
                        </span>
                        <h3>
                          {financingTarget
                            ? `Financiamiento para ${financingTarget.label}`
                            : "Selecciona un lote"}
                        </h3>
                      </div>
                      <div className={styles.financingMiniMeta}>
                        <FaPiggyBank />
                        {financingTarget
                          ? formatMoney(financingPrice, financingCurrency)
                          : "Precio al elegir lote"}
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
                            <span>Cuota estimada</span>
                            <strong>
                              {formatMoney(
                                financingScenario.monthlyEstimate,
                                financingCurrency,
                              )}
                            </strong>
                          </div>
                        </div>

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

                        <AmortizationChart
                          principal={Math.max(
                            financingPrice - (financingScenario?.initial || 0),
                            0,
                          )}
                          annualRate={financingScenario?.annualRate || 0}
                          months={financingScenario?.months || 0}
                          currency={financingCurrency}
                        />

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
                    ) : shouldUseLoteDrivenFinancing ? (
                      <div className={styles.financingEmptyState}>
                        <div className={styles.financingEmptyOrb}>
                          <FaMapMarkedAlt />
                        </div>
                        <div>
                          <strong>
                            Selecciona un lote para cotizar precio y
                            financiamiento
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.financingNote}>
                        La inmobiliaria todavía no configuró este plan.
                      </p>
                    )}
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
                  <div className={styles.aboutCard}>
                    <div className={styles.aboutHeader}>
                      <h3 className={styles.sectionTitle}>
                        Acerca del Proyecto
                      </h3>
                    </div>
                    <p className={styles.fullDescription}>
                      {proyecto.descripcion}
                    </p>
                  </div>

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
                      {/* <h3 className={styles.sectionTitle}>
                        Distancia (actual o buscada)
                      </h3> */}
                      {/* <div className={styles.distanciaBox}>
                        <span>🚶 {walkingInfo?.duration || "Calc..."}</span>
                        <span>🚗 {drivingInfo?.duration || "Calc..."}</span>
                      </div> */}
                    </>
                  )}

                  <div
                    ref={inmoFooterRef}
                    className={styles.inmoCardFooter}
                    data-gsap="card"
                  >
                    <div className={styles.inmoFooterIntro}>
                      <span className={styles.inmoLabel}>
                        Inmobiliaria / Persona
                      </span>
                      <h3 className={styles.inmoFooterName}>
                        {inmo?.nombreinmobiliaria}
                      </h3>
                      {inmo?.descripcion && (
                        <p className={styles.inmoFooterDescription}>
                          {inmo.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {fullscreenImgIndex !== null && validImages.length > 0 && (
        <div
          className={styles.fullscreenOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeFullscreen();
            }
          }}
        >
          <button
            type="button"
            className={styles.closeFsBtn}
            onClick={(e) => {
              e.stopPropagation();
              closeFullscreen();
            }}
            aria-label="Cerrar visor"
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
                  showPrevFullscreenImage();
                }}
              >
                <FaChevronLeft />
              </button>

              <button
                className={`${styles.navArrowFS} ${styles.nextFS}`}
                onClick={(e) => {
                  e.stopPropagation();
                  showNextFullscreenImage();
                }}
              >
                <FaChevronRight />
              </button>
            </>
          )}

          <div
            ref={fullscreenPanZoom.stageRef}
            className={styles.fullscreenStage}
            onClick={(e) => {
              e.stopPropagation();
              if (fullscreenPanZoom.consumeSuppressedClick()) {
                e.preventDefault();
                return;
              }
            }}
            {...fullscreenPanZoom.bind}
          >
            <img
              ref={fullscreenPanZoom.imageRef}
              src={withApiBase(
                `https://api.geohabita.com${validImages[fullscreenImgIndex].imagenproyecto}`,
              )}
              className={styles.fullscreenImg}
              alt="Zoom"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `translate3d(${fullscreenPanZoom.offsetX}px, ${fullscreenPanZoom.offsetY}px, 0) scale(${fullscreenPanZoom.scale})`,
              }}
            />
          </div>

          <div className={styles.fsBadge}>
            {fullscreenImgIndex + 1} / {validImages.length}
          </div>

          <div className={styles.fsHint}>
            Pellizca o usa la rueda para zoom. Arrastra para moverte.
          </div>

          <button
            type="button"
            className={styles.fsResetBtn}
            onClick={(e) => {
              e.stopPropagation();
              fullscreenPanZoom.reset();
            }}
          >
            Reset
          </button>
        </div>
      )}
      {show360 && (
        <Suspense
          fallback={
            <div className={styles.loadingOverlayInline}>
              Cargando vista 360...
            </div>
          }
        >
          <Viewer360Modal
            images360={images360}
            projectName={proyecto?.nombreproyecto || ""}
            onClose={() => setShow360(false)}
          />
        </Suspense>
      )}
    </>
  );
};

export default ProyectoSidebar;
