// src/components/AutomationModal/AutomationGroupModal.tsx
import React from 'react';
import { SavedAutomation, SavedEvaluation } from '@/types/history';

interface AutomationGroupModalProps {
  automations: SavedAutomation[];
  evaluations?: SavedEvaluation[];
  onClose: () => void;
  onLoad: (automationSet: any) => void;
  onRun: (automationSet: any) => void;
  onRunDetails: (automation: SavedAutomation, runIndex: number) => void;
}

export default function AutomationGroupModal({ 
  automations, 
  evaluations = [],
  onClose, 
  onLoad, 
  onRun, 
  onRunDetails 
}: AutomationGroupModalProps) {
  if (!automations || automations.length === 0) return null;

  const groupName = automations[0].name;
  const totalRuns = automations.reduce((total, automation) => total + (automation.runs?.length || 0), 0) + evaluations.length;
  const successCount = automations.reduce((total, automation) => 
    total + (automation.runs?.filter(run => run.status === 'completed' && !run.error).length || 0), 0) +
    evaluations.filter(evaluation => evaluation.results && Object.keys(evaluation.results).length > 0).length;
  const errorCount = automations.reduce((total, automation) => 
    total + (automation.runs?.filter(run => run.status === 'error' || run.error).length || 0), 0) +
    evaluations.filter(evaluation => !evaluation.results || Object.keys(evaluation.results).length === 0).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90vw",
          maxWidth: "1200px",
          height: "85vh",
          maxHeight: "900px",
          background: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 16,
          padding: 24,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 700, color: "#e2e8f0" }}>
              {groupName}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14, color: "#94a3b8" }}>
              <span>Automations: {automations.length}</span>
              <span>Total Runs: {totalRuns}</span>
              <span>Type: {automations[0].type}</span>
              <span>Model: {automations[0].model?.label || automations[0].model?.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 24,
              padding: 8,
              borderRadius: 8,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1e293b";
              e.currentTarget.style.color = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            ×
          </button>
        </div>

        {/* Status Summary */}
        <div style={{ 
          display: "flex", 
          gap: 16, 
          marginBottom: 24,
          padding: 20,
          background: "#0f172a",
          borderRadius: 12,
          border: "1px solid #334155"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              background: successCount > 0 ? "#10b981" : "#6b7280" 
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Success: {successCount}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              background: errorCount > 0 ? "#ef4444" : "#6b7280" 
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Errors: {errorCount}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              background: "#3b82f6" 
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Total: {totalRuns}</span>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
            Created: {new Date(automations[0].createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => onLoad(automations)}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              border: "none",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Load Automation Group
          </button>
          <button
            onClick={() => onRun(automations)}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              border: "none",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
            </svg>
            Run Automation Group
          </button>
        </div>

        {/* Automation Runs List */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>
            All Runs ({totalRuns})
          </h3>
          <div style={{ display: "grid", gap: 16 }}>
            {automations.map((automation, automationIndex) => (
              <div key={automation.id} style={{ marginBottom: 24 }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  marginBottom: 12,
                  padding: "12px 16px",
                  background: "#1e293b",
                  borderRadius: 8,
                  border: "1px solid #334155"
                }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 8, 
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
                      Automation #{automationIndex + 1}
                    </h4>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      ID: {automation.id} | Status: {automation.status} | Runs: {automation.runs?.length || 0}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: "grid", gap: 12, marginLeft: 20 }}>
                  {automation.runs?.map((run, runIndex) => (
                    <div
                      key={run.id}
                      style={{
                        padding: 16,
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => onRunDetails(automation, runIndex)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#1e293b";
                        e.currentTarget.style.borderColor = "#475569";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#0f172a";
                        e.currentTarget.style.borderColor = "#334155";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <h5 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                          {run.runName}
                        </h5>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: "50%", 
                            background: run.error ? "#ef4444" : "#10b981" 
                          }} />
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>
                            {run.error ? "Error" : "Success"}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                        Model: {run.model?.id || automation.model?.id} | 
                        Status: {run.status} | 
                        Started: {new Date(run.startedAt).toLocaleString()}
                      </div>
                      
                      {run.error && (
                        <div style={{ 
                          fontSize: 12, 
                          color: "#ef4444", 
                          background: "#ef444410", 
                          padding: 8, 
                          borderRadius: 4,
                          marginBottom: 8
                        }}>
                          Error: {run.error}
                        </div>
                      )}
                      
                      {run.results && !run.error && (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Results: {Object.keys(run.results).length} metrics computed
                        </div>
                      )}
                      
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
                        Click to view detailed run information
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Evaluations Section */}
          {evaluations.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>
                Individual Evaluations ({evaluations.length})
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {evaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    style={{
                      padding: 16,
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1e293b";
                      e.currentTarget.style.borderColor = "#475569";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#0f172a";
                      e.currentTarget.style.borderColor = "#334155";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <h5 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                        {evaluation.title}
                      </h5>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: "50%", 
                          background: evaluation.results && Object.keys(evaluation.results).length > 0 ? "#10b981" : "#ef4444" 
                        }} />
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          {evaluation.results && Object.keys(evaluation.results).length > 0 ? "Success" : "Failed"}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                      Type: {evaluation.type} | 
                      Model: {evaluation.model?.id} | 
                      Started: {new Date(evaluation.startedAt).toLocaleString()}
                    </div>
                    
                    {evaluation.results && Object.keys(evaluation.results).length > 0 && (
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        Results: {Object.keys(evaluation.results).length} metrics computed
                      </div>
                    )}
                    
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
                      Click to view detailed evaluation information
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
