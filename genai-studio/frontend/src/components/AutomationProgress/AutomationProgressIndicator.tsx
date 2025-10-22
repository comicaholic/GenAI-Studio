import React, { useState, useEffect } from 'react';
import { automationStore, AutomationProgress } from '@/stores/automationStore';

interface AutomationProgressIndicatorProps {
  className?: string;
}

export default function AutomationProgressIndicator({ className = "" }: AutomationProgressIndicatorProps) {
  const [progress, setProgress] = useState<AutomationProgress[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = automationStore.subscribe(() => {
      setProgress(automationStore.getProgress());
    });
    
    // Initial load
    setProgress(automationStore.getProgress());
    
    return unsubscribe;
  }, []);

  const runningCount = progress.filter(p => p.status === 'running').length;
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const errorCount = progress.filter(p => p.status === 'error').length;

  if (progress.length === 0) return null;

  return (
    <div className={`automation-progress-indicator ${className}`} style={{ position: "relative" }}>
      {/* Main Indicator */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: runningCount > 0 ? "#1e40af" : "#1e293b",
          border: "1px solid #334155",
          borderRadius: 8,
          color: "#e2e8f0",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 500,
          transition: "all 0.2s ease",
          boxShadow: runningCount > 0 ? "0 0 0 2px rgba(59, 130, 246, 0.3)" : "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = runningCount > 0 ? "#1d4ed8" : "#334155";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = runningCount > 0 ? "#1e40af" : "#1e293b";
        }}
      >
        {/* Animated Icon */}
        {runningCount > 0 ? (
          <div className="rb-spin" style={{ width: 16, height: 16, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
          </svg>
        )}
        
        <span>
          {runningCount > 0 ? `${runningCount} Running` : 
           completedCount > 0 ? `${completedCount} Completed` :
           errorCount > 0 ? `${errorCount} Errors` : 
           `${progress.length} Total`}
        </span>

        {/* Status Badges */}
        <div style={{ display: "flex", gap: 4 }}>
          {runningCount > 0 && (
            <div style={{
              background: "#3b82f6",
              color: "white",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 10,
              minWidth: 16,
              textAlign: "center",
            }}>
              {runningCount}
            </div>
          )}
          {completedCount > 0 && (
            <div style={{
              background: "#10b981",
              color: "white",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 10,
              minWidth: 16,
              textAlign: "center",
            }}>
              {completedCount}
            </div>
          )}
          {errorCount > 0 && (
            <div style={{
              background: "#ef4444",
              color: "white",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 10,
              minWidth: 16,
              textAlign: "center",
            }}>
              {errorCount}
            </div>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="currentColor"
          style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
        </svg>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 8,
            background: "#0b1220",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            zIndex: 1000,
            animation: "rb-bounce-in 0.3s ease-out",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Automation Status
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {progress.map((automation) => {
              const progressPercent = Math.min(((automation.currentRunIndex + 1) / (automation.config.runs?.length || 1)) * 100, 100);
              
              return (
                <div
                  key={automation.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 8,
                    background: "#1e293b",
                    borderRadius: 8,
                    border: "1px solid #334155",
                  }}
                >
                  {/* Status Icon */}
                  <div style={{ flexShrink: 0 }}>
                    {automation.status === 'running' ? (
                      <div className="rb-spin" style={{ width: 12, height: 12, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : automation.status === 'completed' ? (
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
                    ) : (
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
                      {(automation.config as any).name || `Automation ${automation.type}`}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      {automation.status === 'running' ? 
                        `Run ${automation.currentRunIndex + 1} of ${automation.config.runs?.length || 0}` :
                        automation.status}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: 60, height: 4, background: "#334155", borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        height: "100%",
                        background: automation.status === 'error' ? '#ef4444' : 
                                   automation.status === 'completed' ? '#10b981' : '#3b82f6',
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
