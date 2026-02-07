import React, { useState, useEffect, useRef } from "react"; // IMPORTANTE: faltaban estos

const CustomSelect = ({ label, value, options, onChange, placeholder, styles }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        <div className={styles.customOptionsList}>
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