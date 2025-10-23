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

  // Listen for global header toggle events
  React.useEffect(() => {
    const onToggleLeft = () => setLeftOpen((v) => !v);
    const onToggleRight = () => setRightOpen((v) => !v);
    window.addEventListener("layout:toggle-left", onToggleLeft as EventListener);
    window.addEventListener("layout:toggle-right", onToggleRight as EventListener);
    return () => {
      window.removeEventListener("layout:toggle-left", onToggleLeft as EventListener);
      window.removeEventListener("layout:toggle-right", onToggleRight as EventListener);
    };
  }, []);

  React.useEffect(() => { if (!left) setLeftOpen(false); }, [left]);
  React.useEffect(() => { if (!right) setRightOpen(false); }, [right]);

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: "100dvh" }}>
      {/* Sticky header (56px) */}
      

      {/* Body row */}
      <div style={{ display: "flex", minHeight: 0 }}>
        {/* Fixed LeftRail — NO GAP */}
        <LeftRail />

        {/* Center (only scrollable area) */}
        <div
          style={{
            marginLeft: 56, // matches LeftRail width
            position: "relative",
            width: "100%",
            padding: 16,
            background: "#0f172a",
            color: "#e2e8f0",
            // Reserve space for floating sidebars so content "conforms"
            paddingLeft: leftOpen && left ? leftWidth + 24 : 16,
            paddingRight: rightOpen && right ? rightWidth + 24 : 16,
          }}
        >
          {/* Overlaid LEFT panel */}
          {leftOpen && left ? (
            <aside
              style={{
                position: "fixed",
                top: 68, // header (56) + gap
                left: 80,
                height: "calc(100dvh - 56px)",
                width: leftWidth,
                overflow: "auto",
                background: "#0b1220",
                borderRight: "1px solid #334155",
                boxShadow: "0 8px 24px rgba(0,0,0,.4)",
                borderRadius: 12,
                padding: 12,
                zIndex: 40,
                transition: "transform .18s ease, opacity .18s ease",
                transform: leftOpen ? "translateX(0)" : "translateX(-8px)",
                opacity: leftOpen ? 1 : 0,
              }}
            >
              <div style={{ display: "grid", gap: 12 }}>{left}</div>
            </aside>
          ) : null}

          {/* Overlaid RIGHT panel */}
          {rightOpen && right ? (
            <aside
              style={{
                position: "fixed",
                top: 68, // header (56) + gap
                right: 8,
                height: "calc(100dvh - 56px)",
                width: rightWidth,
                overflow: "auto",
                background: "#0b1220",
                borderLeft: "1px solid #334155",
                boxShadow: "0 8px 24px rgba(0,0,0,.4)",
                borderRadius: 12,
                padding: 12,
                zIndex: 40,
                transition: "transform .18s ease, opacity .18s ease",
                transform: rightOpen ? "translateX(0)" : "translateX(8px)",
                opacity: rightOpen ? 1 : 0,
              }}
            >
              <div style={{ display: "grid", gap: 12 }}>{right}</div>
            </aside>
          ) : null}

          {/* Center content */}
          <main
            style={{
              height: "calc(100dvh - 56px)",
              overflow: "auto",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#0b1220",
            }}
          >
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
