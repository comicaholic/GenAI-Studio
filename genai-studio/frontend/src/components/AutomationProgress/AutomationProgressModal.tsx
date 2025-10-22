import React, { useState, useEffect } from 'react';
import { automationStore, AutomationProgress } from '@/stores/automationStore';
import { useNotifications } from '@/components/Notification/Notification';

interface AutomationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AutomationProgressModal({ isOpen, onClose }: AutomationProgressModalProps) {
  const [progress, setProgress] = useState<AutomationProgress[]>([]);
  const { showSuccess, showError } = useNotifications();

  useEffect(() => {
    if (!isOpen) return;
    
    const unsubscribe = automationStore.subscribe(() => {
      setProgress(automationStore.getProgress());
    });
    
    // Initial load
    setProgress(automationStore.getProgress());
    
    return unsubscribe;
  }, [isOpen]);

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <div className="rb-spin" style={{ width: 16, height: 16, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} />
        );
      case 'completed':
        return (
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
        );
      case 'error':
        return (
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ocr':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
        );
      case 'prompt':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
        );
      case 'chat':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,3C17.5,3 22,6.58 22,11C22,15.42 17.5,19 12,19C10.76,19 9.57,18.82 8.47,18.5C7.55,19.75 6.16,20.5 4.5,20.5C4.5,20.5 2,20 2,17.5C2,15.5 3.75,14 5.91,13.5C4.84,12.5 4.16,11.25 4.16,10C4.16,6.58 8.5,3 12,3Z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const getProgressPercentage = (automation: AutomationProgress) => {
    const totalRuns = automation.config.runs?.length || 1;
    const currentRun = automation.currentRunIndex + 1;
    return Math.min((currentRun / totalRuns) * 100, 100);
  };

  const handleRemoveAutomation = (id: string) => {
    automationStore.removeAutomation(id);
  };

  const handleClearCompleted = () => {
    automationStore.clearCompleted();
    showSuccess("Cleared", "All completed automations have been cleared");
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90vw",
          maxWidth: "800px",
          maxHeight: "80vh",
          background: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 16,
          padding: 24,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
            </svg>
            Automation Progress
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            {progress.some(p => p.status === 'completed' || p.status === 'error') && (
              <button
                onClick={handleClearCompleted}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Clear Completed
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 24,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Progress List */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {progress.length === 0 ? (
            <div style={{ 
              textAlign: "center", 
              padding: 40, 
              color: "#94a3b8",
              background: "#1e293b",
              borderRadius: 12,
              border: "1px solid #334155"
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ marginBottom: 16, opacity: 0.5 }}>
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
              </svg>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No Active Automations</div>
              <div style={{ fontSize: 14 }}>Start an automation to see progress here</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {progress.map((automation) => {
                const progressPercent = getProgressPercentage(automation);
                const currentRun = automation.config.runs?.[automation.currentRunIndex];
                
                return (
                  <div
                    key={automation.id}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      padding: 20,
                      transition: "all 0.3s ease",
                      animation: "rb-bounce-in 0.4s ease-out",
                    }}
                  >
                    {/* Automation Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {getTypeIcon(automation.type)}
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                            {(automation.config as any).name || `Automation ${automation.type}`}
                          </h3>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            {automation.type.toUpperCase()} • {automation.config.runs?.length || 0} runs
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {getStatusIcon(automation.status)}
                        <button
                          onClick={() => handleRemoveAutomation(automation.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: 4,
                            borderRadius: 4,
                          }}
                          title="Remove automation"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          {automation.status === 'running' ? `Run ${automation.currentRunIndex + 1} of ${automation.config.runs?.length || 0}` : 
                           automation.status === 'completed' ? 'Completed' : 'Error'}
                        </span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          {formatDuration(automation.startTime, automation.endTime)}
                        </span>
                      </div>
                      <div style={{
                        width: "100%",
                        height: 8,
                        background: "#334155",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}>
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            height: "100%",
                            background: automation.status === 'error' ? '#ef4444' : 
                                       automation.status === 'completed' ? '#10b981' : '#3b82f6',
                            transition: "width 0.3s ease",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>

                    {/* Current Run Details */}
                    {automation.status === 'running' && currentRun && (
                      <div style={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 14,
                      }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>
                          Currently running: {currentRun.name}
                        </div>
                        {currentRun.presetTitle && (
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>
                            Preset: {currentRun.presetTitle}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error Details */}
                    {automation.status === 'error' && automation.error && (
                      <div style={{
                        background: "#7f1d1d",
                        border: "1px solid #ef4444",
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 14,
                        color: "#fecaca",
                      }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>Error:</div>
                        <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                          {automation.error}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

