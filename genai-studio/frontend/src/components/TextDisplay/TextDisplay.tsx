import React, { useState, useEffect } from 'react';
import ExpandableTextarea from '@/components/ExpandableTextarea/ExpandableTextarea';
import { api } from '@/services/api';

interface TextDisplayProps {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface TextSplittingSettings {
  enabled: boolean;
  characterLimit: number;
  collapseBehavior: "all-collapsed" | "first-expanded" | "all-expanded";
}

export default function TextDisplay({ 
  value, 
  onChange, 
  editable = false, 
  title,
  className,
  style 
}: TextDisplayProps) {
  const [textSplittingSettings, setTextSplittingSettings] = useState<TextSplittingSettings>({
    enabled: false,
    characterLimit: 1000,
    collapseBehavior: "first-expanded"
  });

  // State to track which parts are expanded
  const [expandedParts, setExpandedParts] = useState<Record<number, boolean>>({});

  // Load text splitting settings from the backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/settings/settings");
        const settings = res.data?.ui?.textSplitting;
        if (settings) {
          setTextSplittingSettings(settings);
        }
      } catch (error) {
        console.warn("Failed to load text splitting settings:", error);
      }
    };
    loadSettings();
  }, []);

  // Split text into parts based on character limit
  const splitText = (text: string): string[] => {
    if (!textSplittingSettings.enabled || text.length <= textSplittingSettings.characterLimit) {
      return [text];
    }

    const parts: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + textSplittingSettings.characterLimit;
      
      // Try to break at a word boundary if possible
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastSpace, lastNewline);
        
        if (breakPoint > start + textSplittingSettings.characterLimit * 0.8) {
          end = breakPoint;
        }
      }
      
      parts.push(text.slice(start, end));
      start = end;
    }
    
    return parts;
  };

  const textParts = splitText(value);

  // Initialize expanded state based on collapse behavior
  useEffect(() => {
    const newExpandedParts: Record<number, boolean> = {};
    textParts.forEach((_, index) => {
      switch (textSplittingSettings.collapseBehavior) {
        case "all-expanded":
          newExpandedParts[index] = true;
          break;
        case "all-collapsed":
          newExpandedParts[index] = false;
          break;
        case "first-expanded":
        default:
          newExpandedParts[index] = index === 0;
          break;
      }
    });
    setExpandedParts(newExpandedParts);
  }, [textParts.length, textSplittingSettings.collapseBehavior]);

  // If text splitting is disabled or only one part, use the original component
  if (!textSplittingSettings.enabled || textParts.length <= 1) {
    return (
      <ExpandableTextarea
        editable={editable}
        value={value}
        onChange={onChange}
      />
    );
  }

  // Render split text with collapsible sections
  return (
    <div className={className} style={style}>
      {title && (
        <div style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: "#e2e8f0", 
          marginBottom: 8 
        }}>
          {title} ({textParts.length} parts)
        </div>
      )}
      
      {/* Collapse/Expand All Toggle */}
      <div style={{ 
        display: "flex", 
        gap: 8, 
        marginBottom: 12,
        justifyContent: "flex-end"
      }}>
        {(() => {
          const allExpanded = textParts.every((_, index) => expandedParts[index]);
          const allCollapsed = textParts.every((_, index) => !expandedParts[index]);
          
          // If all are expanded, show "Collapse All", otherwise show "Expand All"
          const isExpandMode = !allExpanded;
          
          return (
            <button
              onClick={() => {
                const newExpandedParts: Record<number, boolean> = {};
                textParts.forEach((_, index) => {
                  newExpandedParts[index] = isExpandMode;
                });
                setExpandedParts(newExpandedParts);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                background: isExpandMode 
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : "linear-gradient(135deg, #ef4444, #dc2626)",
                border: "none",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = isExpandMode 
                  ? "0 2px 4px rgba(16, 185, 129, 0.3)"
                  : "0 2px 4px rgba(239, 68, 68, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                {isExpandMode ? (
                  <path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"/>
                ) : (
                  <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
                )}
              </svg>
              {isExpandMode ? "Expand All" : "Collapse All"}
            </button>
          );
        })()}
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {textParts.map((part, index) => {
          const isExpanded = expandedParts[index] || false;
          const toggleExpanded = () => {
            setExpandedParts(prev => ({
              ...prev,
              [index]: !prev[index]
            }));
          };

          return (
            <div key={index} style={{
              border: "1px solid #334155",
              borderRadius: 8,
              background: "#1e293b",
              overflow: "hidden"
            }}>
              <button
                onClick={toggleExpanded}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#0f172a",
                  border: "none",
                  color: "#e2e8f0",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1e293b";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#0f172a";
                }}
              >
                <span>Part {index + 1} ({part.length} characters)</span>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease"
                  }}
                >
                  <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
                </svg>
              </button>
              
              {isExpanded && (
                <div style={{ padding: "16px" }}>
                  {editable ? (
                    <textarea
                      value={part}
                      onChange={(e) => {
                        if (onChange) {
                          const newParts = [...textParts];
                          newParts[index] = e.target.value;
                          onChange(newParts.join(''));
                        }
                      }}
                      style={{
                        width: "100%",
                        minHeight: "120px",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        padding: 12,
                        fontFamily: "monospace",
                        fontSize: 13,
                        background: "#0f172a",
                        color: "#e2e8f0",
                        resize: "vertical",
                        outline: "none"
                      }}
                    />
                  ) : (
                    <div style={{
                      fontFamily: "monospace",
                      fontSize: 13,
                      color: "#e2e8f0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.5,
                      maxHeight: "300px",
                      overflow: "auto",
                      padding: "8px",
                      background: "#0f172a",
                      borderRadius: 4,
                      border: "1px solid #334155"
                    }}>
                      {part}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
