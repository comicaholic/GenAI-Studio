// frontend/src/pages/PromptEval/components/ContextEditor.tsx
import React, { useState, useEffect } from 'react';
import { estimateTokens } from '@/lib/llm';

interface ContextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ContextEditor({ value, onChange }: ContextEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [tokenCount, setTokenCount] = useState(estimateTokens(value));

  // Sync with parent value
  useEffect(() => {
    setLocalValue(value);
    setTokenCount(estimateTokens(value));
  }, [value]);

  // Update token count when local value changes
  useEffect(() => {
    setTokenCount(estimateTokens(localValue));
  }, [localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localValue);
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid #334155',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <h3 style={{
          color: '#e2e8f0',
          margin: 0,
          fontSize: '14px',
          fontWeight: '600',
        }}>
          Context (Optional)
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            color: '#94a3b8',
            fontSize: '11px',
            fontFamily: 'monospace',
          }}>
            {tokenCount} tokens
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
            title="Copy context"
          >
            📋
          </button>
        </div>
      </div>

      <textarea
        value={localValue}
        onChange={handleChange}
        placeholder="Enter additional context, instructions, or background information..."
        style={{
          width: '100%',
          minHeight: '80px',
          maxHeight: '200px',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '12px',
          color: '#e2e8f0',
          fontSize: '13px',
          fontFamily: 'monospace',
          lineHeight: '1.5',
          resize: 'vertical',
          outline: 'none',
        }}
      />

      <div style={{
        marginTop: '8px',
        color: '#94a3b8',
        fontSize: '11px',
      }}>
        Provide additional context, instructions, or background information that the model should consider.
      </div>
    </div>
  );
}



