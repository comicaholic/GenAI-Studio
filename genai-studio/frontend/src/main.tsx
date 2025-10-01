// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ModelProvider } from "@/context/ModelContext";
import { NotificationContainer, useNotifications } from "@/components/Notification/Notification";
import { router } from "@/app/router";

function App() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <React.StrictMode>
      <ModelProvider>
        <RouterProvider router={router} />
        <NotificationContainer notifications={notifications} onClose={removeNotification} />
      </ModelProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

