import './index.css' 
import '@fontsource-variable/inter';
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ModelProvider } from "@/context/ModelContext";
import { NotificationContainer, useNotifications } from "@/components/Notification/Notification";
import { router } from "@/app/router";
import { waitForBackend } from "@/services/api";

function BackendReady({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = React.useState(false);
  const [isWaiting, setIsWaiting] = React.useState(true);
  const [waitTime, setWaitTime] = React.useState(0);

  React.useEffect(() => {
    const checkBackend = async () => {
      const startTime = Date.now();
      
      // Update wait time every second for user feedback
      const timer = setInterval(() => {
        setWaitTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      try {
        // Only wait up to 15 seconds to avoid long delays
        await waitForBackend(15000);
        setIsReady(true);
      } catch (err) {
        console.warn('Backend health check failed, proceeding anyway:', err);
        setIsReady(true); // Proceed anyway, retry mechanism will handle individual requests
      } finally {
        clearInterval(timer);
        setIsWaiting(false);
      }
    };

    checkBackend();
  }, []);

  if (isWaiting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient">
        <div className="text-center">
          <div className="rb-spinner mb-4 mx-auto"></div>
          <p className="text-white/80">Starting GenAI Studio...</p>
          <p className="text-white/60 text-sm mt-2">
            {waitTime > 0 ? `Waiting for backend (${waitTime}s)` : 'Waiting for backend to be ready'}
          </p>
          {waitTime > 5 && (
            <p className="text-white/40 text-xs mt-2">
              This may take a moment if using conda environment
            </p>
          )}
          {waitTime > 10 && (
            <p className="text-white/30 text-xs mt-1">
              Will proceed anyway if backend takes too long
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <React.StrictMode>
      <BackendReady>
        <ModelProvider>
          <RouterProvider router={router} />
          <NotificationContainer notifications={notifications} onClose={removeNotification} />
        </ModelProvider>
      </BackendReady>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

