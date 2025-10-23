// frontend/src/pages/PromptEval/components/tabs/MetricsTab.tsx
import React from 'react';
import { RunResult } from '@/types/promptEval';

interface MetricsTabProps {
  currentRun: RunResult | null;
}

export default function MetricsTab({ currentRun }: MetricsTabProps) {
  if (!currentRun || !currentRun.usage) {
    return (
      <div style={{
        padding: '16px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '12px',
      }}>
        No metrics available. Run a prompt to see metrics.
      </div>
    );
  }

  const formatDuration = (startTime: number, endTime: number) => {
    const duration = endTime - startTime;
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-GB');
  };

  const metrics = [
    {
      label: 'Latency',
      value: formatDuration(currentRun.startedAt, currentRun.finishedAt),
      description: 'Total response time',
    },
    {
      label: 'Prompt Tokens',
      value: currentRun.usage.promptTokens.toLocaleString(),
      description: 'Input tokens processed',
    },
    {
      label: 'Completion Tokens',
      value: currentRun.usage.completionTokens.toLocaleString(),
      description: 'Output tokens generated',
    },
    {
      label: 'Total Tokens',
      value: currentRun.usage.totalTokens.toLocaleString(),
      description: 'Total tokens used',
    },
    {
      label: 'Cost',
      value: currentRun.usage.costUSD ? `$${currentRun.usage.costUSD.toFixed(4)}` : 'N/A',
      description: 'Estimated cost',
    },
    {
      label: 'Tokens/sec',
      value: currentRun.usage.completionTokens > 0 
        ? (currentRun.usage.completionTokens / ((currentRun.finishedAt - currentRun.startedAt) / 1000)).toFixed(2)
        : 'N/A',
      description: 'Generation speed',
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      <h4 style={{
        color: '#e2e8f0',
        margin: '0 0 16px 0',
        fontSize: '14px',
        fontWeight: '600',
      }}>
        Performance Metrics
      </h4>

      <div style={{ marginBottom: '16px' }}>
        <div style={{
          background: '#334155',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '8px',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>
            Run Details
          </div>
          <div style={{ color: '#e2e8f0', fontSize: '12px' }}>
            <div>Model: {currentRun.modelId}</div>
            <div>Started: {formatTimestamp(currentRun.startedAt)}</div>
            <div>Finished: {formatTimestamp(currentRun.finishedAt)}</div>
            <div>Resources: {currentRun.resources.length} files</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              background: '#334155',
              borderRadius: '6px',
              padding: '12px',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}>
              <span style={{
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: '500',
              }}>
                {metric.label}
              </span>
              <span style={{
                color: '#3b82f6',
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: '600',
              }}>
                {metric.value}
              </span>
            </div>
            <div style={{
              color: '#94a3b8',
              fontSize: '10px',
            }}>
              {metric.description}
            </div>
          </div>
        ))}
      </div>

      {/* Simple Chart Placeholder */}
      <div style={{ marginTop: '16px' }}>
        <div style={{
          background: '#334155',
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
            Response Time Trend
          </div>
          <div style={{
            height: '60px',
            background: '#1e293b',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '10px',
          }}>
            Chart visualization would go here
          </div>
        </div>
      </div>
    </div>
  );
}



