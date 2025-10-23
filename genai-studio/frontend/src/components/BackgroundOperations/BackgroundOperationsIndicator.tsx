// frontend/src/components/BackgroundOperations/BackgroundOperationsIndicator.tsx
import React, { useState } from 'react';
import { useBackgroundState } from '@/stores/backgroundState';

export default function BackgroundOperationsIndicator() {
  const { operations, clearCompleted } = useBackgroundState();
  const [isExpanded, setIsExpanded] = useState(false);

  const runningOperations = operations.filter(op => op.status === 'running');
  const completedOperations = operations.filter(op => op.status === 'completed');
  const errorOperations = operations.filter(op => op.status === 'error');

  if (operations.length === 0) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '⏳';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ocr': return '📄';
      case 'prompt': return '📝';
      case 'chat': return '💬';
      default: return '⚙️';
    }
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  return (
    <div style={styles.container}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={styles.toggleButton}
      >
        <span style={styles.icon}>⚙️</span>
        <span style={styles.count}>{operations.length}</span>
        {isExpanded ? '▼' : '▶'}
      </button>

      {isExpanded && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <h4 style={styles.title}>Background Operations</h4>
            {completedOperations.length > 0 && (
              <button
                onClick={clearCompleted}
                style={styles.clearButton}
              >
                Clear Completed
              </button>
            )}
          </div>

          <div style={styles.operations}>
            {operations.map(operation => (
              <div key={operation.id} style={styles.operation}>
                <div style={styles.operationHeader}>
                  <span style={styles.operationIcon}>
                    {getTypeIcon(operation.type)} {getStatusIcon(operation.status)}
                  </span>
                  <span style={styles.operationType}>
                    {operation.type.toUpperCase()} {operation.status}
                  </span>
                  <span style={styles.operationDuration}>
                    {formatDuration(operation.startTime, operation.endTime)}
                  </span>
                </div>
                
                {operation.progress !== undefined && (
                  <div style={styles.progressBar}>
                    <div 
                      style={{
                        ...styles.progressFill,
                        width: `${operation.progress}%`
                      }}
                    />
                  </div>
                )}
                
                {operation.error && (
                  <div style={styles.errorMessage}>
                    {operation.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 20,
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  icon: {
    fontSize: 16,
  },
  count: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderRadius: '50%',
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
  panel: {
    position: 'absolute',
    bottom: 50,
    right: 0,
    width: 300,
    maxHeight: 400,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #334155',
  },
  title: {
    margin: 0,
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: 600,
  },
  clearButton: {
    padding: '4px 8px',
    backgroundColor: '#059669',
    border: 'none',
    borderRadius: 6,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 12,
  },
  operations: {
    maxHeight: 300,
    overflow: 'auto',
  },
  operation: {
    padding: '12px 16px',
    borderBottom: '1px solid #334155',
  },
  operationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  operationIcon: {
    fontSize: 16,
  },
  operationType: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: 500,
    flex: 1,
  },
  operationDuration: {
    fontSize: 12,
    color: '#94a3b8',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease',
  },
  errorMessage: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    fontStyle: 'italic',
  },
};

