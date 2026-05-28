import React from "react";

export function Card({ children, className }) {
  return (
    <div
      className={`border rounded-xl shadow-sm ${className || ""}`}
      style={{
        background: "var(--theme-bg-surface-raised)",
        borderColor: "var(--theme-border-color)",
        color: "var(--theme-text-main)",
        boxShadow: "var(--theme-shadow-sm)",
      }}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className }) {
  return <div className={`p-4 ${className || ""}`}>{children}</div>;
}
