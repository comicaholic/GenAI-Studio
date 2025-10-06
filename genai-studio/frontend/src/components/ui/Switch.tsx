import React from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  color?: string;          // track color when ON
  disabled?: boolean;
  size?: number;           // height in px (width auto)
  className?: string;
};

export default function Switch({ checked, onChange, color = "#3b82f6", disabled = false, size = 22, className = "" }: Props) {
  const width = Math.round(size * 1.8);
  const knob = size - 6;
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      aria-pressed={checked}
      className={`rb-hover-lift rb-press ${className}`}
      style={{
        width,
        height: size,
        borderRadius: size,
        background: checked ? color : "#111827",
        border: `1px solid ${checked ? color : "#334155"}`,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background .18s ease, border-color .18s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? width - knob - 3 : 3,
          width: knob,
          height: knob,
          borderRadius: knob,
          background: "#e5e7eb",
          transition: "left .18s ease",
          boxShadow: "0 2px 6px rgba(0,0,0,.35)",
        }}
      />
    </button>
  );
}


