// frontend/src/components/HistoryModal/HistoryModal.tsx
import React, { useState, useEffect } from 'react';
import { SavedEvaluation, SavedChat, EvaluationSelection, ModelInfo } from '@/types/history';
import { historyService } from '@/services/history';
import { useModel } from '@/context/ModelContext';
import { useNavigate } from 'react-router-dom';

interface HistoryModalProps {
  item: SavedEvaluation | SavedChat | null;
  onClose: () => void;
  onLoad: (item: SavedEvaluation | SavedChat) => void;
  onRun: (item: SavedEvaluation | SavedChat) => void;
}

export default function HistoryModal({ item, onClose, onLoad, onRun }: HistoryModalProps) {
  const [editedMetrics, setEditedMetrics] = useState<string[]>([]);
  const [editedParams, setEditedParams] = useState<Record<string, any>>({});
  const { selected } = useModel();
  const navigate = useNavigate();

  useEffect(() => {
    if (item) {
      if ('metrics' in item) {
        setEditedMetrics(item.metrics);
        setEditedParams(item.parameters);
      } else {
        setEditedParams(item.parameters);
      }
    }
  }, [item]);

  if (!item) return null;

  const isEvaluation = 'type' in item;
  const isChat = !isEvaluation;

  const handleLoad = () => {
    const updatedItem = {
      ...item,
      parameters: editedParams,
      ...(isEvaluation && { metrics: editedMetrics })
    };
    onLoad(updatedItem);
    onClose();
  };

  const handleRun = () => {
    const updatedItem = {
      ...item,
      parameters: editedParams,
      ...(isEvaluation && { metrics: editedMetrics })
    };
    onRun(updatedItem);
    onClose();
  };

  const handleExport = () => {
    const selection: EvaluationSelection = {
      type: isEvaluation ? item.type : 'chat',
      modelId: item.model.id,
      provider: item.model.provider,
      parameters: editedParams,
      metrics: isEvaluation ? editedMetrics : [],
      context: isChat ? item.context : undefined,
      usedText: isEvaluation ? item.usedText : item.usedText || {},
      files: isEvaluation ? item.files : {},
      timestamp: new Date().toISOString()
    };
    historyService.exportSelection(selection);
  };

  const availableMetrics = [
    'rouge', 'bleu', 'f1', 'em', 'bertscore', 'perplexity', 
    'accuracy', 'precision', 'recall'
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: 24,
        maxWidth: '80vw',
        maxHeight: '80vh',
        overflow: 'auto',
        color: '#e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          borderBottom: '1px solid #334155',
          paddingBottom: 16
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: '#e2e8f0' }}>
              {isEvaluation ? `${item.type.toUpperCase()} Evaluation` : 'Chat Session'}
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: 14 }}>
              {item.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 24,
              cursor: 'pointer',
              padding: 4
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left Column */}
          <div>
            {/* Model Info */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#e2e8f0' }}>Model</h3>
              <div style={{
                padding: 12,
                backgroundColor: '#0f172a',
                borderRadius: 8,
                border: '1px solid #334155'
              }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{item.model.id}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.model.provider}</div>
              </div>
            </div>

            {/* Metrics (for evaluations) */}
            {isEvaluation && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#e2e8f0' }}>Metrics</h3>
                <div style={{
                  padding: 12,
                  backgroundColor: '#0f172a',
                  borderRadius: 8,
                  border: '1px solid #334155'
                }}>
                  {availableMetrics.map(metric => (
                    <label key={metric} style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: 8,
                      fontSize: 14
                    }}>
                      <input
                        type="checkbox"
                        checked={editedMetrics.includes(metric)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditedMetrics([...editedMetrics, metric]);
                          } else {
                            setEditedMetrics(editedMetrics.filter(m => m !== metric));
                          }
                        }}
                        style={{ marginRight: 8 }}
                      />
                      {metric.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#e2e8f0' }}>Parameters</h3>
              <div style={{
                padding: 12,
                backgroundColor: '#0f172a',
                borderRadius: 8,
                border: '1px solid #334155'
              }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: '#94a3b8' }}>Temperature</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={editedParams.temperature || 0.7}
                    onChange={(e) => setEditedParams({
                      ...editedParams,
                      temperature: parseFloat(e.target.value)
                    })}
                    style={{
                      width: '100%',
                      padding: 6,
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 4,
                      color: '#e2e8f0',
                      fontSize: 14
                    }}
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: '#94a3b8' }}>Max Tokens</label>
                  <input
                    type="number"
                    min="1"
                    value={editedParams.max_tokens || 1000}
                    onChange={(e) => setEditedParams({
                      ...editedParams,
                      max_tokens: parseInt(e.target.value)
                    })}
                    style={{
                      width: '100%',
                      padding: 6,
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 4,
                      color: '#e2e8f0',
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8' }}>Top P</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={editedParams.top_p || 1.0}
                    onChange={(e) => setEditedParams({
                      ...editedParams,
                      top_p: parseFloat(e.target.value)
                    })}
                    style={{
                      width: '100%',
                      padding: 6,
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 4,
                      color: '#e2e8f0',
                      fontSize: 14
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Files Used */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#e2e8f0' }}>Files Used</h3>
              <div style={{
                padding: 12,
                backgroundColor: '#0f172a',
                borderRadius: 8,
                border: '1px solid #334155'
              }}>
                {isEvaluation ? (
                  <>
                    {item.files.sourceFileName && (
                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        Source: {item.files.sourceFileName}
                      </div>
                    )}
                    {item.files.referenceFileName && (
                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        Reference: {item.files.referenceFileName}
                      </div>
                    )}
                    {item.files.promptFileName && (
                      <div style={{ fontSize: 14 }}>
                        Prompt: {item.files.promptFileName}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 14, color: '#94a3b8' }}>
                    No files attached
                  </div>
                )}
              </div>
            </div>

            {/* Used Text Snapshot */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#e2e8f0' }}>Text Snapshot</h3>
              <div style={{
                padding: 12,
                backgroundColor: '#0f172a',
                borderRadius: 8,
                border: '1px solid #334155',
                maxHeight: 200,
                overflow: 'auto'
              }}>
                {isEvaluation ? (
                  <>
                    {item.usedText.ocrText && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>OCR Text:</div>
                        <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                          {item.usedText.ocrText.substring(0, 200)}
                          {item.usedText.ocrText.length > 200 && '...'}
                        </div>
                      </div>
                    )}
                    {item.usedText.referenceText && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Reference:</div>
                        <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                          {item.usedText.referenceText.substring(0, 200)}
                          {item.usedText.referenceText.length > 200 && '...'}
                        </div>
                      </div>
                    )}
                    {item.usedText.promptText && (
                      <div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Prompt:</div>
                        <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                          {item.usedText.promptText.substring(0, 200)}
                          {item.usedText.promptText.length > 200 && '...'}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {item.messagesSummary || 'No messages summary available'}
                  </div>
                )}
              </div>
            </div>

            {/* Results (for evaluations) */}
            {isEvaluation && item.results && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#e2e8f0' }}>Results</h3>
                <div style={{
                  padding: 12,
                  backgroundColor: '#0f172a',
                  borderRadius: 8,
                  border: '1px solid #334155'
                }}>
                  {Object.entries(item.results).map(([key, value]) => (
                    <div key={key} style={{ fontSize: 14, marginBottom: 4 }}>
                      {key}: {typeof value === 'number' ? value.toFixed(3) : String(value)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid #334155'
        }}>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Export
          </button>
          <button
            onClick={handleLoad}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Load
          </button>
          <button
            onClick={handleRun}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              border: '1px solid #3b82f6',
              borderRadius: 8,
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}

