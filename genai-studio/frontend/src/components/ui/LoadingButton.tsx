import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  spinnerSize?: number;
};

export default function LoadingButton({ isLoading, spinnerSize=14, children, disabled, className="", ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      className={`rb-hover-lift rb-press ${className}`}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #334155",
        background: "#1e293b",
        color: "#e2e8f0",
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {isLoading && (
        <span
          className="rb-spin"
          style={{
            width: spinnerSize,
            height: spinnerSize,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,.35)",
            borderTopColor: "#e2e8f0",
            display: "inline-block",
          }}
        />
      )}
      <span>{children}</span>
    </button>
  );
}


