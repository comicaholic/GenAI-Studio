import React from "react";
import LeftRail from "@/components/LeftRail/LeftRail";

/**
 * Three-column app shell
 * - Fixed LeftRail (no gap to the content)
 * - Sticky header area (tiny collapse buttons + centered ModelSelector)
 * - Left/Right panels are sticky, do not scroll
 * - ONLY the center (main) column scrolls
 * - Optional topNotice (yellow banner) sits under the selector and never overlaps content
 */
type Props = {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  topNotice?: React.ReactNode; // e.g. GROQ_API_KEY banner

  defaultLeftOpen?: boolean;
  defaultRightOpen?: boolean;
  leftWidth?: number;
  rightWidth?: number;
};

export default function LayoutShell({
  title,
  left,
  right,
  children,
  topNotice,
  defaultLeftOpen = true,
  defaultRightOpen = true,
  leftWidth = 320,
  rightWidth = 360,
}: Props) {
  const [leftOpen, setLeftOpen] = React.useState(Boolean(left) && defaultLeftOpen);
  const [rightOpen, setRightOpen] = React.useState(Boolean(right) && defaultRightOpen);

  React.useEffect(() => { if (!left) setLeftOpen(false); }, [left]);
  React.useEffect(() => { if (!right) setRightOpen(false); }, [right]);

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: "100dvh" }}>
      {/* Sticky header (56px) */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          height: 56,
          background: "#0b1220",
          borderBottom: "1px solid #1f2a3a",
          display: "flex",
          alignItems: "center",
          paddingInline: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          {/* Left collapse (24x24) */}
          {left ? (
            <button
              onClick={() => setLeftOpen(v => !v)}
              title={leftOpen ? "Hide left panel" : "Show left panel"}
              style={btnIcon}
            >
              {leftOpen ? "‹" : "›"}
            </button>
          ) : <div style={{ width: 24, height: 24 }} />}

          {/* Title (optional) */}
          {title ? <div style={{ color: "#e2e8f0", fontSize: 14, opacity: 0.9 }}>{title}</div> : null}

          {/* Center spacer (global ModelSelector lives in top app header) */}
          <div style={{ flex: 1 }} />

          {/* Right collapse (24x24) */}
          {right ? (
            <button
              onClick={() => setRightOpen(v => !v)}
              title={rightOpen ? "Hide right panel" : "Show right panel"}
              style={btnIcon}
            >
              {rightOpen ? "›" : "‹"}
            </button>
          ) : <div style={{ width: 24, height: 24 }} />}
        </div>
      </header>

      {/* Body row */}
      <div style={{ display: "flex", minHeight: 0 }}>
        {/* Fixed LeftRail — NO GAP */}
        <LeftRail />

        {/* Content grid; only center scrolls */}
        <div
          style={{
            marginLeft: 56,                // matches LeftRail width
            display: "grid",
            gridTemplateColumns: `${leftOpen ? `${leftWidth}px` : "0px"} 1fr ${rightOpen ? `${rightWidth}px` : "0px"}`,
            gap: 16,
            width: "100%",
            padding: 16,
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          {/* LEFT (sticky, independent scroll) */}
          {leftOpen ? (
            <aside style={sideStickyLeft}>
              <div style={{ display: "grid", gap: 12 }}>{left}</div>
            </aside>
          ) : <div />}

          {/* CENTER (the ONLY scrollable column) */}
          <main
            style={{
              height: "auto",
              overflow: "auto",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#0b1220",
            }}
          >
            {/* Optional yellow banner (never overlays content) */}
            {topNotice ? (
              <div
                role="status"
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 9,
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #f59e0b",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 12,
                }}
              >
                {topNotice}
              </div>
            ) : null}

            {children}
          </main>

          {/* RIGHT (sticky, independent scroll) */}
          {rightOpen ? (
            <aside style={sideStickyRight}>
              <div style={{ display: "grid", gap: 12 }}>{right}</div>
            </aside>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}

const btnIcon: React.CSSProperties = {
  height: 24,
  width: 24,
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#e2e8f0",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  padding: 0,
};

const sideStickyLeft: React.CSSProperties = {
  position: "sticky",
  top: 0,
  alignSelf: "start",
  height: "calc(100dvh - 56px)",
  overflow: "auto",
  paddingRight: 4,
};

const sideStickyRight: React.CSSProperties = {
  position: "sticky",
  top: 0,
  alignSelf: "start",
  height: "calc(100dvh - 56px)",
  overflow: "hidden",
  paddingLeft: 4,
};
