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



// If you have a ModelSelector, import it here and render in the header.

// Height constants (keep header small and tidy)
const HEADER_H = 48; // 12 * 4px

function AppShell() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 grid grid-rows-[auto,1fr]">
      {/* ============== TOP BAR (sticky) ============== */}
      <header
        className="z-30 row-start-1 row-end-2 flex h-12 items-center justify-between
                   border-b border-neutral-200/70 dark:border-neutral-800/70
                   bg-white/90 dark:bg-neutral-900/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-3"
        style={{ height: HEADER_H }}
      ><div></div>
        <div className="flex items-center gap-2">
          {/* Collapse buttons are small, see .icon-btn-sm in index.css */}
          {/* If you had left toggle here, render it with className="icon-btn-sm" */}
          <strong className="text-sm">GenAI Assessment Studio</strong>
        </div>
        <div className="flex items-center gap-2">
          {/* <ModelSelector />  <- stays visible */}
          {/* <button className="icon-btn-sm" aria-label="Toggle right panel">…</button> */}
        </div>
      </header>

      {/* ============== BODY (three columns) ============== */}
      <div className="row-start-2 row-end-3 grid h-[calc(100vh-48px)] grid-cols-[56px,1fr]">
        {/* Left rail (icons) — fixed 56px. No margins/gaps. */}
        <div className="col-start-1 col-end-2 h-full border-r border-neutral-200/60 dark:border-neutral-800/60 bg-[#0B1B2C]">
          <LeftRail />
        </div>

        {/* Main scroll container — only THIS scrolls */}
        <main className="col-start-1 col-end-3 min-w-0 h-full overflow-y-auto">
          <div className="px-4 py-5">
            <Outlet />
          </div>
        </main>
      </div>
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

