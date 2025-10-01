import React from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import RouteError from "@/app/RouteError";
import HomePage from "@/pages/Home/HomePage";
import OCRPage from "@/pages/OCR/OCRPage";
import PromptEvalPage from "@/pages/PromptEval/PromptEvalPage";
import ChatPage from "@/pages/Chat/ChatPage";
import ModelsPage from "@/pages/Models/ModelsPage";
import AnalyticsPage from "@/pages/Analytics/AnalyticsPage";
import SettingsPage from "@/pages/Settings/SettingsPage";
import CustomPagesIndex from "@/pages/Custom/CustomPagesIndex";
import LeftRail from "@/components/LeftRail/LeftRail";
import BackgroundOperationsIndicator from "@/components/BackgroundOperations/BackgroundOperationsIndicator";

function AppShell() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: 56 }}>
        <header style={{ height: 48, borderBottom: "1px solid #334155", display: "grid", gridTemplateColumns: "1fr minmax(420px, 640px) 1fr", alignItems: "center", background: "#0f172a", color: "#e2e8f0" }}>
          <div />
          <div style={{ justifySelf: "center" }}>
            <strong>GenAI Assessment Studio</strong>
            <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8" }}>Testing Platform</span>
          </div>
          <div />
          <div />
        </header>

        <main style={{ flex: 1, overflow: "auto", background: "#0f172a", color: "#e2e8f0" }}>
          <Outlet />
        </main>
      </div>
      
      <BackgroundOperationsIndicator />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "ocr", element: <OCRPage />, errorElement: <RouteError /> },
      { path: "prompt", element: <PromptEvalPage />, errorElement: <RouteError /> },
      { path: "chat", element: <ChatPage />, errorElement: <RouteError /> },
      { path: "models", element: <ModelsPage />, errorElement: <RouteError /> },
      { path: "analytics", element: <AnalyticsPage />, errorElement: <RouteError /> },
      { path: "settings", element: <SettingsPage />, errorElement: <RouteError /> },
      { path: "custom/*", element: <CustomPagesIndex />, errorElement: <RouteError /> },
    ],
  },
  {
    path: "*",
    element: <RouteError />,
  },
]);

