import React, { PropsWithChildren, useState } from "react";
import ModelSelector from "@/components/TopBar/ModelSelector";

export default function AppShell({
  children, left, right,
}: PropsWithChildren<{ left?: React.ReactNode; right?: React.ReactNode }>) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div style={{display:"flex", flexDirection:"column", height:"100vh"}}>
      {/* Top bar */}
      <div
        style={{
          height: 48,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 12,
          padding: "0 12px",
          borderBottom: "1px solid #eee",
          background: "#0f172a",
          color: "#e2e8f0",
        }}
      >
        {/* Left group */}
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <button
            onClick={() => setLeftOpen((v) => !v)}
            title="Toggle left panel"
            style={{
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e2e8f0",
              padding: "6px 10px",
              borderRadius: 8,
            }}
          >
            {leftOpen ? "⟨" : "⟩"}
          </button>
          <strong>GenAI Studio</strong>
        </div>

        {/* CENTER group — the selector stays centered */}
        <div style={{display:"flex", justifyContent:"center"}}>
          <ModelSelector />
        </div>

        {/* Right group */}
        <div style={{display:"flex", justifyContent:"flex-end", alignItems:"center", gap:8}}>
          <button
            onClick={() => setRightOpen((v) => !v)}
            title="Toggle right panel"
            style={{
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e2e8f0",
              padding: "6px 10px",
              borderRadius: 8,
            }}
          >
            {rightOpen ? "⟨" : "⟩"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{display:"flex", flex:1, minHeight:0}}>
        {leftOpen && (
          <aside style={{width:300, borderRight:"1px solid #334155", padding:12, overflow:"auto", background: "#1e293b", color: "#e2e8f0"}}>
            {left}
          </aside>
        )}
        <main style={{flex:1, padding:16, overflow:"auto", background: "#0f172a", color: "#e2e8f0"}}>{children}</main>
        {rightOpen && (
          <aside style={{width:340, borderLeft:"1px solid #334155", padding:12, overflow:"auto", background: "#1e293b", color: "#e2e8f0"}}>
            {right}
          </aside>
        )}
      </div>
    </div>
  );
}
