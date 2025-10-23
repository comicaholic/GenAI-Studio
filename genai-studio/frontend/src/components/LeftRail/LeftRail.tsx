import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconHome, IconDoc, IconBolt, IconGraph, IconSettings, IconChat, IconBot } from "@/components/icons/icons";
import DownloadManager from "@/components/DownloadManager/DownloadManager";
import { api } from "@/services/api";

export default function LeftRail() {
  const location = useLocation();
  const [isDownloadManagerOpen, setIsDownloadManagerOpen] = useState(false);
  const [activeDownloadsCount, setActiveDownloadsCount] = useState(0);

  const navItems = [
    { path: "/", icon: "home", label: "Home", title: "Home", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
    { path: "/ocr", icon: "doc", label: "OCR Evaluation", title: "OCR Evaluation", gradient: "linear-gradient(135deg, #10b981, #059669)" },
    { path: "/prompt", icon: "bolt", label: "Prompt Evaluation", title: "Prompt Evaluation", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
    { path: "/chat", icon: "chat", label: "Chat", title: "Chat", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
    { path: "/models", icon: "bot", label: "My Models", title: "My Models", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
    { path: "/analytics", icon: "graph", label: "Analytics", title: "Application Analytics", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
    { path: "/settings", icon: "settings", label: "Settings", title: "Settings", gradient: "linear-gradient(135deg, #6b7280, #4b5563)" },
  ];

  const loadActiveDownloads = async () => {
    try {
      const response = await api.get("/models/download/queue");
      const activeCount = response.data.active?.length || 0;
      setActiveDownloadsCount(activeCount);
    } catch (error) {
      console.error("Failed to load active downloads:", error);
    }
  };

  useEffect(() => {
    loadActiveDownloads();
    const interval = setInterval(loadActiveDownloads, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav style={styles.container}>
      {/* Logo Section */}
      <div style={styles.logoSection}>
        <div 
          style={styles.logoContainer}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0, 0, 0, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
          }}
        >
          <img 
            src="/assets/GenAi_Studio_logo.png" 
            alt="GenAI Studio Logo" 
            style={styles.logoImage}
          />
        </div>
      </div>
      
      <div style={styles.navItems}>
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
              <div style={{
                ...styles.iconContainer,
                background: isActive ? item.gradient : "transparent",
                border: isActive ? "none" : "1px solid #475569"
              }}>
                <span className="shrink-0 opacity-80">
                  {item.icon==="home"?<IconHome/>:item.icon==="doc"?<IconDoc/>:item.icon==="bolt"?<IconBolt/>:item.icon==="chat"?<IconChat/>:item.icon==="bot"?<IconBot/>:item.icon==="graph"?<IconGraph/>:item.icon==="settings"?<IconSettings/>:null}
                </span>
              </div>
              {isActive && (
                <div style={{
                  position: "absolute",
                  left: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 4,
                  height: 20,
                  background: item.gradient,
                  borderRadius: "0 2px 2px 0"
                }} />
              )}
            </Link>
          );
        })}
      </div>

      {/* Download Manager Button */}
      {activeDownloadsCount > 0 && (
        <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <button
            onClick={() => setIsDownloadManagerOpen(true)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              border: "none",
              borderRadius: 12,
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              position: "relative"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
            </svg>
            Downloads ({activeDownloadsCount})
            <div style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              background: "#ef4444",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: "bold",
              color: "white",
              animation: "pulse 2s infinite"
            }}>
              {activeDownloadsCount}
            </div>
          </button>
        </div>
      )}

      {/* Download Manager Modal */}
      <DownloadManager 
        isOpen={isDownloadManagerOpen} 
        onClose={() => setIsDownloadManagerOpen(false)} 
      />
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 64,
    height: "100vh",
    borderRight: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
    background: "#0f172a",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 100,
    boxShadow: "2px 0 8px rgba(0, 0, 0, 0.1)",
  },
  logoSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px 8px",
    borderBottom: "1px solid #334155",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
  },
  logoContainer: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
    transition: "all 0.3s ease",
  },
  logoImage: {
    width: 40,
    height: 40,
    objectFit: "contain",
    filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
  },
  navItems: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "16px 8px",
  },
  navItem: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 12,
    textDecoration: "none",
    color: "#94a3b8",
    fontSize: 20,
    transition: "all 0.2s ease",
    border: "1px solid transparent",
  },
  activeItem: {
    color: "#ffffff",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
};
