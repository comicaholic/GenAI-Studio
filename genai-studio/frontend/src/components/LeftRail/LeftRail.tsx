import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function LeftRail() {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: "🏠", label: "Home", title: "Home" },
    { path: "/ocr", icon: "📄", label: "OCR Evaluation", title: "OCR Evaluation" },
    { path: "/prompt", icon: "✏️", label: "Prompt Evaluation", title: "Prompt Evaluation" },
    { path: "/chat", icon: "💬", label: "Chat", title: "Chat" },
    { path: "/models", icon: "🤖", label: "My Models", title: "My Models" },
    { path: "/analytics", icon: "📊", label: "Analytics", title: "Application Analytics" },
    { path: "/settings", icon: "⚙️", label: "Settings", title: "Settings" },
    { path: "/custom", icon: "🔧", label: "Custom", title: "Custom Pages" },
  ];

  return (
    <nav style={styles.container}>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            title={item.title}
            style={{
              ...styles.navItem,
              ...(isActive ? styles.activeItem : {}),
            }}
          >
            <span style={styles.icon}>{item.icon}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 56,
    height: "100vh",
    borderRight: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: 8,
    background: "#0f172a",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 100,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 8,
    textDecoration: "none",
    color: "#e2e8f0",
    fontSize: 20,
    transition: "all 0.2s ease",
    border: "1px solid transparent",
  },
  activeItem: {
    background: "#1e293b",
    color: "#ffffff",
    border: "1px solid #334155",
  },
  icon: {
    fontSize: 18,
  },
};
