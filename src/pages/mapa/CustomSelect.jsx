import React, { useState, useEffect, useRef } from "react";

const CustomSelect = ({ label, value, options, onChange, placeholder, styles }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth <= 768;

    if (isMobile) {
      const width = viewportWidth - 20;
      const left = (viewportWidth - width) / 2;
      setMenuStyle({
        position: "fixed",
        top: `${rect.bottom + 8}px`,
        left: `${left}px`,
        width: `${width}px`,
        zIndex: 12000,
      });
      return;
    }

    setMenuStyle({});
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onResizeOrScroll = () => updateMenuPosition();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={styles.searchSection} ref={containerRef}>
      <span className={styles.searchLabel}>{label}</span>
      <div className={styles.customTrigger} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.triggerText}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`${styles.arrow} ${isOpen ? styles.arrowUp : ""}`}>▾</span>
      </div>

      {isOpen && (
        <div className={styles.customOptionsList} style={menuStyle} ref={menuRef}>
          <div className={styles.customOption} onClick={() => { onChange(""); setIsOpen(false); }}>
            {placeholder}
          </div>
          {options.map((opt) => (
            <div 
              key={opt.value} 
              className={`${styles.customOption} ${value === opt.value ? styles.selectedOpt : ""}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
