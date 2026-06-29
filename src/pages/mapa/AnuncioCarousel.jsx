import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./Mapa.module.css";

const ANUNCIO_SLIDES = [
  {
    text: "Anuncia tu propiedad",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 10.25 12 4.75l7.5 5.5v8.75a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75v-8.75Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9 14.25h6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    text: "Publica tus proyectos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 18.25V7.75A1.75 1.75 0 0 1 6.75 6h10.5A1.75 1.75 0 0 1 19 7.75v10.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M8.5 12h7M8.5 15.5h5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M9.25 3.75v4.5M14.75 3.75v4.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    text: "Gestiona tus lotes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.75 6.25h14.5v11.5H4.75z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 6.25v11.5M14.5 6.25v11.5M4.75 12h14.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    text: "Administra tus proyectos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6.25 5.75h11.5A1.75 1.75 0 0 1 19.5 7.5v9a1.75 1.75 0 0 1-1.75 1.75H6.25A1.75 1.75 0 0 1 4.5 16.5v-9a1.75 1.75 0 0 1 1.75-1.75Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M8.25 9.25h7.5M8.25 12.25h7.5M8.25 15.25h4.25"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const AnuncioCarousel = React.memo(function AnuncioCarousel({ to, className, style }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const ctaRef = useRef(null);
  const animTimeoutRef = useRef(null);

  // Rotate slides every 2.8s — isolated here so Map.jsx never re-renders on tick
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % ANUNCIO_SLIDES.length;
        setPrevIndex(current);
        setIsAnimating(true);
        if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false);
          setPrevIndex(null);
        }, 560);
        return next;
      });
    }, 2800);

    return () => {
      clearInterval(interval);
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  const textWidthPx = useMemo(() => {
    const activeText = ANUNCIO_SLIDES[activeIndex]?.text || "";
    return Math.max(128, Math.ceil(activeText.length * 8.2) + 6);
  }, [activeIndex]);

  const buttonWidthPx = useMemo(() => Math.max(184, textWidthPx + 42), [textWidthPx]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ reduceMotion: "(prefers-reduced-motion: reduce)" }, (context) => {
        const { reduceMotion } = context.conditions;
        if (reduceMotion) return undefined;

        const cta = ctaRef.current;
        if (!cta) return undefined;

        const orbPrimary = cta.querySelector(`.${styles.anuncioFxOrbPrimary}`);
        const orbSecondary = cta.querySelector(`.${styles.anuncioFxOrbSecondary}`);
        const beam = cta.querySelector(`.${styles.anuncioFxBeam}`);
        const outline = cta.querySelector(`.${styles.anuncioFxOutline}`);
        const skyline = cta.querySelector(`.${styles.anuncioFxSkyline}`);
        const parcels = cta.querySelector(`.${styles.anuncioFxParcels}`);
        const content = cta.querySelector(`.${styles.anuncioContent}`);
        const icon = cta.querySelector(`.${styles.anuncioIconViewport}`);
        const text = cta.querySelector(`.${styles.anuncioTextViewport}`);

        gsap.set(cta, { transformPerspective: 900, transformOrigin: "50% 50%" });
        gsap.set([orbPrimary, orbSecondary, beam, outline, skyline, parcels], {
          transformOrigin: "50% 50%",
          willChange: "transform, opacity, filter",
        });

        const idleTl = gsap.timeline({ repeat: -1, defaults: { ease: "sine.inOut" } });
        idleTl
          .to(cta, { y: -5.5, scale: 1.032, rotateX: -4.5, rotateY: 6, boxShadow: "0 28px 46px rgba(15, 145, 98, 0.34), 0 12px 26px rgba(15, 23, 42, 0.16), 0 0 30px rgba(53, 227, 160, 0.26)", duration: 1.6 }, 0)
          .to(content, { y: -2.5, duration: 1.45 }, 0)
          .to(orbPrimary, { xPercent: 20, yPercent: -24, scale: 1.24, opacity: 0.98, duration: 1.75 }, 0)
          .to(orbSecondary, { xPercent: -18, yPercent: 16, scale: 1.22, opacity: 0.76, duration: 1.8 }, 0.1)
          .to(beam, { xPercent: 184, rotation: 11, opacity: 0.96, duration: 1.55, ease: "power3.out" }, 0)
          .to(outline, { scale: 1.024, opacity: 0.9, duration: 1.9 }, 0)
          .to(skyline, { x: 14, y: -2, opacity: 0.88, duration: 1.65 }, 0)
          .to(parcels, { x: -12, y: 2, opacity: 0.72, duration: 1.65 }, 0.05)
          .to(icon, { y: -2, rotate: -7, scale: 1.14, duration: 1.2 }, 0.1)
          .to(text, { x: 3, letterSpacing: "0.03em", textShadow: "0 3px 18px rgba(8, 113, 74, 0.28)", duration: 1.3 }, 0.1)
          .to(cta, { y: 0, scale: 1, rotateX: 0.8, rotateY: -1.2, boxShadow: "0 16px 28px rgba(15, 145, 98, 0.2), 0 6px 14px rgba(15, 23, 42, 0.1), 0 0 16px rgba(53, 227, 160, 0.12)", duration: 1.45 }, ">")
          .to(content, { y: 0, duration: 1.45 }, "<")
          .to(orbPrimary, { xPercent: -18, yPercent: 16, scale: 0.92, opacity: 0.44, duration: 1.6 }, "<")
          .to(orbSecondary, { xPercent: 18, yPercent: -16, scale: 0.94, opacity: 0.3, duration: 1.6 }, "<")
          .to(beam, { xPercent: -154, rotation: -11, opacity: 0.12, duration: 1.55, ease: "power1.inOut" }, "<")
          .to(outline, { scale: 0.978, opacity: 0.4, duration: 1.9 }, "<")
          .to(skyline, { x: -12, y: 1.5, opacity: 0.52, duration: 1.6 }, "<")
          .to(parcels, { x: 14, y: 0, opacity: 0.28, duration: 1.6 }, "<")
          .to(icon, { y: 0, rotate: 5, scale: 1, duration: 1.2 }, "<")
          .to(text, { x: 0, letterSpacing: "0em", textShadow: "0 0 0 rgba(6, 78, 59, 0)", duration: 1.2 }, "<");

        const burst = gsap.timeline({ paused: true });
        burst
          .to(cta, { scale: 1.075, rotateX: -12, rotateY: 16, y: -5, duration: 0.34, ease: "power4.out" }, 0)
          .to([orbPrimary, orbSecondary], { scale: 1.62, opacity: 1, duration: 0.34, stagger: 0.03, ease: "power4.out" }, 0)
          .to(beam, { xPercent: 220, opacity: 1, duration: 0.44, ease: "power3.out" }, 0)
          .to(outline, { scale: 1.08, opacity: 1, duration: 0.38, ease: "power3.out" }, 0)
          .to(skyline, { y: -5, scaleX: 1.06, opacity: 1, duration: 0.34, ease: "power3.out" }, 0)
          .to(parcels, { y: 4, opacity: 0.92, duration: 0.34, ease: "power3.out" }, 0);

        const resetBurst = () => {
          gsap.to(cta, { scale: 1, rotateX: 0, rotateY: 0, y: 0, duration: 0.42, ease: "power3.out", overwrite: "auto" });
        };

        const onEnter = () => burst.restart();
        const onLeave = () => { burst.pause(0); resetBurst(); };

        cta.addEventListener("pointerenter", onEnter);
        cta.addEventListener("pointerleave", onLeave);

        return () => {
          cta.removeEventListener("pointerenter", onEnter);
          cta.removeEventListener("pointerleave", onLeave);
          idleTl.kill();
          burst.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: ctaRef },
  );

  const computedStyle = useMemo(
    () => ({ width: `${buttonWidthPx}px`, ...style }),
    [buttonWidthPx, style],
  );

  return (
    <Link ref={ctaRef} to={to} className={className} style={computedStyle}>
      <span className={styles.anuncioFxOrbPrimary} aria-hidden="true" />
      <span className={styles.anuncioFxOrbSecondary} aria-hidden="true" />
      <span className={styles.anuncioFxBeam} aria-hidden="true" />
      <span className={styles.anuncioFxOutline} aria-hidden="true" />
      <span className={styles.anuncioFxSkyline} aria-hidden="true" />
      <span className={styles.anuncioFxParcels} aria-hidden="true" />
      <span className={styles.anuncioSweep} aria-hidden="true" />
      <span className={styles.anuncioContent}>
        <span className={styles.anuncioIconViewport}>
          {prevIndex !== null && isAnimating && (
            <span className={`${styles.anuncioItem} ${styles.anuncioLeave}`}>
              {ANUNCIO_SLIDES[prevIndex].icon}
            </span>
          )}
          <span
            className={`${styles.anuncioItem} ${isAnimating ? styles.anuncioEnter : styles.anuncioStatic}`}
          >
            {ANUNCIO_SLIDES[activeIndex].icon}
          </span>
        </span>
        <span
          className={styles.anuncioTextViewport}
          style={{ width: `${textWidthPx}px` }}
        >
          {prevIndex !== null && isAnimating && (
            <span className={`${styles.anuncioItem} ${styles.anuncioLeave}`}>
              {ANUNCIO_SLIDES[prevIndex].text}
            </span>
          )}
          <span
            className={`${styles.anuncioItem} ${isAnimating ? styles.anuncioEnter : styles.anuncioStatic}`}
          >
            {ANUNCIO_SLIDES[activeIndex].text}
          </span>
        </span>
      </span>
    </Link>
  );
});

export default AnuncioCarousel;
