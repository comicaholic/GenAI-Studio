// frontend/src/components/BackgroundPages/BackgroundPages.tsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageState } from '@/stores/pageState';
import HomePage from '@/pages/Home/HomePage';
import OCRPage from '@/pages/OCR/OCRPage';
import PromptEvalPage from '@/pages/PromptEval/PromptEvalPage';
import ChatPage from '@/pages/Chat/ChatPage';
import ModelsPage from '@/pages/Models/ModelsPage';
import AnalyticsPage from '@/pages/Analytics/AnalyticsPage';
import SettingsPage from '@/pages/Settings/SettingsPage';
import CustomPagesIndex from '@/pages/Custom/CustomPagesIndex';

// Map of routes to their components
const PAGE_COMPONENTS = {
  '/': HomePage,
  '/ocr': OCRPage,
  '/prompt': PromptEvalPage,
  '/chat': ChatPage,
  '/models': ModelsPage,
  '/analytics': AnalyticsPage,
  '/settings': SettingsPage,
} as const;

// Helper function to get the base route for custom routes
const getBaseRoute = (pathname: string): string => {
  if (pathname.startsWith('/custom')) {
    return '/custom';
  }
  return pathname;
};

interface BackgroundPagesProps {
  children: React.ReactNode;
}

export default function BackgroundPages({ children }: BackgroundPagesProps) {
  const location = useLocation();
  const { setActivePage, isPageAlive, backgroundStateEnabled } = usePageState();

  // Update active page when location changes
  useEffect(() => {
    const baseRoute = getBaseRoute(location.pathname);
    setActivePage(baseRoute);
    
    // Debug logging
    console.log('BackgroundPages: Route changed to', baseRoute, 'Background enabled:', backgroundStateEnabled);
  }, [location.pathname, setActivePage, backgroundStateEnabled]);

  // If background state management is disabled, just render the current page
  if (!backgroundStateEnabled) {
    return <>{children}</>;
  }

  // Render all alive pages, but only show the active one
  return (
    <>
      {Object.entries(PAGE_COMPONENTS).map(([path, Component]) => {
        const isAlive = isPageAlive(path);
        const isActive = getBaseRoute(location.pathname) === path;
        
        if (!isAlive) {
          return null;
        }

        return (
          <div
            key={path}
            style={{
              display: isActive ? 'block' : 'none',
              width: '100%',
              height: '100%',
            }}
          >
            <Component />
          </div>
        );
      })}
      
      {/* Handle custom routes */}
      {location.pathname.startsWith('/custom') && (
        <div
          style={{
            display: isPageAlive('/custom') ? 'block' : 'none',
            width: '100%',
            height: '100%',
          }}
        >
          <CustomPagesIndex />
        </div>
      )}
    </>
  );
}
