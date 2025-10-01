// frontend/src/pages/PromptEval/components/tabs/ResultTab.tsx
import React, { useState } from 'react';
import { RunResult } from '@/types/promptEval';

interface ResultTabProps {
  currentRun: RunResult | null;
  runHistory: RunResult[];
  isRunning: boolean;
}

export default function ResultTab({ currentRun, runHistory, isRunning }: ResultTabProps) {
  const [showHistory, setShowHistory] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDuration = (startTime: number, endTime: number) => {
    const duration = endTime - startTime;
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Current Run */}
      {currentRun && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <h4 style={{
              color: '#e2e8f0',
              margin: 0,
              fontSize: '14px',
              fontWeight: '600',
            }}>
              Current Run
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                color: '#94a3b8',
                fontSize: '11px',
              }}>
                {formatTimestamp(currentRun.startedAt)}
              </span>
              {currentRun.finishedAt > 0 && (
                <span style={{
                  color: '#10b981',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}>
                  {formatDuration(currentRun.startedAt, currentRun.finishedAt)}
                </span>
              )}
              <button
                onClick={() => handleCopy(currentRun.output)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
                title="Copy result"
              >
                📋
              </button>
            </div>
          </div>

          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '12px',
            minHeight: '200px',
            maxHeight: '400px',
            overflow: 'auto',
          }}>
            {currentRun.error ? (
              <div style={{
                color: '#ef4444',
                fontSize: '13px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
              }}>
                Error: {currentRun.error}
              </div>
            ) : (
              <div style={{
                color: '#e2e8f0',
                fontSize: '13px',
                fontFamily: 'monospace',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
              }}>
                {currentRun.output || (isRunning ? 'Generating response...' : 'No output yet')}
              </div>
            )}
          </div>

          {/* Usage Stats */}
          {currentRun.usage && (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: '#334155',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#94a3b8',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Prompt: {currentRun.usage.promptTokens} tokens</span>
                <span>Completion: {currentRun.usage.completionTokens} tokens</span>
                <span>Total: {currentRun.usage.totalTokens} tokens</span>
                {currentRun.usage.costUSD && (
                  <span>Cost: ${currentRun.usage.costUSD.toFixed(4)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Run History */}
      {runHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{showHistory ? '▼' : '▶'}</span>
            Run History ({runHistory.length})
          </button>

          {showHistory && (
            <div style={{ marginTop: '8px' }}>
              {runHistory.map((run) => (
                <div
                  key={run.id}
                  style={{
                    background: '#334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    marginBottom: '4px',
                    fontSize: '11px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}>
                    <span style={{ color: '#e2e8f0' }}>
                      {formatTimestamp(run.startedAt)}
                    </span>
                    <span style={{ color: '#10b981', fontFamily: 'monospace' }}>
                      {formatDuration(run.startedAt, run.finishedAt)}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', marginBottom: '4px' }}>
                    {run.modelId} • {run.usage?.totalTokens || 0} tokens
                  </div>
                  <div style={{
                    color: '#e2e8f0',
                    fontSize: '10px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {run.output.substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No runs message */}
      {!currentRun && runHistory.length === 0 && (
        <div style={{
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '12px',
          padding: '40px 0',
        }}>
          No runs yet. Click "Run" to execute your prompt.
        </div>
      )}
    </div>
  );
}



