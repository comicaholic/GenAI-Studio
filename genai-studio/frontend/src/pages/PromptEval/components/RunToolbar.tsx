// frontend/src/pages/PromptEval/components/RunToolbar.tsx
import React, { useState } from 'react';
import { useModel } from '@/context/ModelContext';

interface RunToolbarProps {
  selectedModel: any;
  onModelSelect: (modelId: string) => void;
  onRun: () => void;
  isRunning: boolean;
  error: string | null;
}

export default function RunToolbar({ 
  selectedModel, 
  onModelSelect, 
  onRun, 
  isRunning, 
  error 
}: RunToolbarProps) {
  const { selected } = useModel();
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);

  const handleModelClick = (model: any) => {
    onModelSelect(model.id);
    setIsModelSelectorOpen(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      {/* Model Selector */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
          style={{
            background: '#334155',
            border: '1px solid #475569',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontSize: '14px',
            minWidth: '200px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            {selectedModel ? selectedModel.label : 'Select Model'}
          </span>
          <span style={{ fontSize: '12px' }}>
            {isModelSelectorOpen ? '▲' : '▼'}
          </span>
        </button>

        {isModelSelectorOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            marginTop: '4px',
            maxHeight: '300px',
            overflow: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}>
            {selected && (
              <div style={{
                padding: '8px 12px',
                background: '#f0f9ff',
                color: '#0c4a6e',
                fontSize: '12px',
                borderBottom: '1px solid #334155',
              }}>
                Selected: {selected.id}
              </div>
            )}
            
            <div style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>
              Use the model selector in the top bar to choose a model.
            </div>
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={onRun}
        disabled={isRunning || !selectedModel}
        style={{
          background: isRunning || !selectedModel ? '#6b7280' : '#3b82f6',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 24px',
          color: 'white',
          cursor: isRunning || !selectedModel ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background 0.2s ease',
        }}
      >
        {isRunning ? (
          <>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #ffffff40',
              borderTop: '2px solid #ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            Running...
          </>
        ) : (
          'Run'
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#ef444420',
          color: '#fca5a5',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          maxWidth: '300px',
        }}>
          {error}
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}
