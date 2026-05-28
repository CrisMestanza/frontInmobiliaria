import React from "react";

export function Button({ children, className, variant = "default", ...props }) {
  const base =
    "px-4 py-2 rounded-xl font-medium flex items-center justify-center transition";
  const styles = {
    default: "gh-btn-default",
    outline: "gh-btn-outline",
  };

  return (
    <button className={`${base} ${styles[variant]} ${className || ""}`} {...props}>
      {children}
    </button>
  );
}
