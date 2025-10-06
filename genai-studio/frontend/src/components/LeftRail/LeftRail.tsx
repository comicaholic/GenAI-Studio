import React from "react";
import { Link, useLocation } from "react-router-dom";
import { IconHome, IconDoc, IconBolt, IconGraph, IconSettings } from "@/components/icons/icons";

export default function LeftRail() {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: "home", label: "Home", title: "Home" },
    { path: "/ocr", icon: "doc", label: "OCR Evaluation", title: "OCR Evaluation" },
    { path: "/prompt", icon: "bolt", label: "Prompt Evaluation", title: "Prompt Evaluation" },
    { path: "/chat", icon: "chat", label: "Chat", title: "Chat" },
    { path: "/models", icon: "bot", label: "My Models", title: "My Models" },
    { path: "/analytics", icon: "graph", label: "Analytics", title: "Application Analytics" },
    { path: "/settings", icon: "settings", label: "Settings", title: "Settings" },
    { path: "/custom", icon: "wrench", label: "Custom", title: "Custom Pages" },
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
            <span className="shrink-0 opacity-80">{item.icon==="home"?<IconHome/>:item.icon==="doc"?<IconDoc/>:item.icon==="bolt"?<IconBolt/>:item.icon==="graph"?<IconGraph/>:item.icon==="settings"?<IconSettings/>:null}</span>
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
