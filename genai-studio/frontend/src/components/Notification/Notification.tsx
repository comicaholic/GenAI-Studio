import React, { useState, useEffect } from "react";

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number;
}

interface NotificationProps {
  notification: Notification;
  onClose: (id: string) => void;
}

function NotificationItem({ notification, onClose }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10);
    
    // Auto-close after duration
    if (notification.duration !== 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, notification.duration || 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(notification.id), 300);
  };

  const getIcon = () => {
    switch (notification.type) {
      case "success": return "✅";
      case "error": return "❌";
      case "warning": return "⚠️";
      case "info": return "ℹ️";
      default: return "ℹ️";
    }
  };

  const getStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 1000,
      minWidth: 300,
      maxWidth: 400,
      padding: 16,
      borderRadius: 8,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      transform: isVisible ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.3s ease-in-out",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
    };

    switch (notification.type) {
      case "success":
        return { ...baseStyles, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#065f46" };
      case "error":
        return { ...baseStyles, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" };
      case "warning":
        return { ...baseStyles, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" };
      case "info":
        return { ...baseStyles, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" };
      default:
        return { ...baseStyles, background: "#f9fafb", border: "1px solid #d1d5db", color: "#374151" };
    }
  };

  return (
    <div style={getStyles()}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{getIcon()}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
          {notification.title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          {notification.message}
        </div>
      </div>
      <button
        onClick={handleClose}
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: 16,
          padding: 0,
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

export function NotificationContainer({ notifications, onClose }: NotificationContainerProps) {
  return (
    <div style={{ position: "fixed", top: 0, right: 0, zIndex: 1000 }}>
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            position: "absolute",
            top: index * 80 + 20,
            right: 20,
          }}
        >
          <NotificationItem notification={notification} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, "id">) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showSuccess = (title: string, message: string, duration?: number) => {
    addNotification({ type: "success", title, message, duration });
  };

  const showError = (title: string, message: string, duration?: number) => {
    addNotification({ type: "error", title, message, duration });
  };

  const showWarning = (title: string, message: string, duration?: number) => {
    addNotification({ type: "warning", title, message, duration });
  };

  const showInfo = (title: string, message: string, duration?: number) => {
    addNotification({ type: "info", title, message, duration });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}




