// frontend/src/pages/PromptEval/components/tabs/ParametersTab.tsx
import React from 'react';

interface ParametersTabProps {
  parameters: {
    temperature: number;
    topP: number;
    maxTokens?: number;
    system?: string;
    seed?: number | null;
  };
  onChange: (parameters: any) => void;
}

export default function ParametersTab({ parameters, onChange }: ParametersTabProps) {
  const handleParameterChange = (key: string, value: any) => {
    onChange({ ...parameters, [key]: value });
  };

  return (
    <div style={{ padding: '16px' }}>
      <h4 style={{
        color: '#e2e8f0',
        margin: '0 0 16px 0',
        fontSize: '14px',
        fontWeight: '600',
      }}>
        Model Parameters
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Temperature */}
        <div>
          <label style={{
            display: 'block',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: '500',
            marginBottom: '6px',
          }}>
            Temperature: {parameters.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={parameters.temperature}
            onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
            style={{
              width: '100%',
              height: '6px',
              background: '#334155',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
          <div style={{
            color: '#94a3b8',
            fontSize: '10px',
            marginTop: '4px',
          }}>
            Controls randomness (0 = deterministic, 2 = very random)
          </div>
        </div>

        {/* Top-p */}
        <div>
          <label style={{
            display: 'block',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: '500',
            marginBottom: '6px',
          }}>
            Top-p: {parameters.topP}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={parameters.topP}
            onChange={(e) => handleParameterChange('topP', parseFloat(e.target.value))}
            style={{
              width: '100%',
              height: '6px',
              background: '#334155',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
          <div style={{
            color: '#94a3b8',
            fontSize: '10px',
            marginTop: '4px',
          }}>
            Nucleus sampling threshold (0 = most likely, 1 = all tokens)
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label style={{
            display: 'block',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: '500',
            marginBottom: '6px',
          }}>
            Max Tokens
          </label>
          <input
            type="number"
            min="1"
            max="8192"
            value={parameters.maxTokens || ''}
            onChange={(e) => handleParameterChange('maxTokens', e.target.value ? parseInt(e.target.value) : undefined)}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#e2e8f0',
              fontSize: '12px',
              outline: 'none',
            }}
            placeholder="1000"
          />
          <div style={{
            color: '#94a3b8',
            fontSize: '10px',
            marginTop: '4px',
          }}>
            Maximum tokens to generate (leave empty for model default)
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label style={{
            display: 'block',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: '500',
            marginBottom: '6px',
          }}>
            System Prompt
          </label>
          <textarea
            value={parameters.system || ''}
            onChange={(e) => handleParameterChange('system', e.target.value)}
            style={{
              width: '100%',
              minHeight: '80px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#e2e8f0',
              fontSize: '12px',
              fontFamily: 'monospace',
              outline: 'none',
              resize: 'vertical',
            }}
            placeholder="You are a helpful assistant."
          />
          <div style={{
            color: '#94a3b8',
            fontSize: '10px',
            marginTop: '4px',
          }}>
            Instructions for the model's behavior and personality
          </div>
        </div>

        {/* Seed */}
        <div>
          <label style={{
            display: 'block',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: '500',
            marginBottom: '6px',
          }}>
            Seed (Optional)
          </label>
          <input
            type="number"
            value={parameters.seed || ''}
            onChange={(e) => handleParameterChange('seed', e.target.value ? parseInt(e.target.value) : null)}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#e2e8f0',
              fontSize: '12px',
              outline: 'none',
            }}
            placeholder="Random seed for reproducibility"
          />
          <div style={{
            color: '#94a3b8',
            fontSize: '10px',
            marginTop: '4px',
          }}>
            Random seed for reproducible outputs (leave empty for random)
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={() => onChange({
            temperature: 0.7,
            topP: 1.0,
            maxTokens: 1000,
            system: 'You are a helpful assistant.',
            seed: null,
          })}
          style={{
            background: '#6b7280',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}



