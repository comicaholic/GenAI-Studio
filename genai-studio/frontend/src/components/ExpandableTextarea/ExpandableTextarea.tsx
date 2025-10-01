import React from "react";

type Props = {
  editable?: boolean;
  value?: string;
  initialValue?: string;
  onChange?: (v: string) => void;
};

export default function ExpandableTextarea({
  editable = false,
  value,
  initialValue = "",
  onChange,
}: Props) {
  const [local, setLocal] = React.useState(initialValue);
  const controlled = value !== undefined;
  const current = controlled ? value! : local;

  // height state (default 140px, up to 600px)
  const [height, setHeight] = React.useState(140);
  const [hover, setHover] = React.useState(false);

  return (
    <div
      style={{ width: "100%", position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <textarea
        value={current}
        readOnly={!editable}
        onChange={(e) => {
          if (editable) {
            if (controlled) {
              onChange?.(e.target.value);
            } else {
              setLocal(e.target.value);
              onChange?.(e.target.value);
            }
          }
        }}
        style={{
          width: "100%",
          height,
          resize: "none", // we control it with slider
          border: "1px solid #334155",
          borderRadius: 8,
          padding: 10,
          fontFamily: "monospace",
          fontSize: 13,
          boxSizing: "border-box",
          background: "#1e293b",
          color: "#e2e8f0",
        }}
      />
      {hover && (
        <div style={{ marginTop: 6, textAlign: "center" }}>
          <input
            type="range"
            min={100}
            max={600}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ width: "80%" }}
          />
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {height}px
          </div>
        </div>
      )}
    </div>
  );
}

