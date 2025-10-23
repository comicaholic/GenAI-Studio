// frontend/src/pages/PromptEval/components/tabs/AttachmentsTab.tsx
import React from 'react';
import { RunResult } from '@/types/promptEval';
import { getFileIcon, formatFileSize } from '@/lib/files';

interface AttachmentsTabProps {
  currentRun: RunResult | null;
}

export default function AttachmentsTab({ currentRun }: AttachmentsTabProps) {
  if (!currentRun || currentRun.resources.length === 0) {
    return (
      <div style={{
        padding: '16px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '12px',
      }}>
        No attachments in this run.
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h4 style={{
        color: '#e2e8f0',
        margin: '0 0 16px 0',
        fontSize: '14px',
        fontWeight: '600',
      }}>
        Attachments ({currentRun.resources.length})
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {currentRun.resources.map((resource) => (
          <div
            key={resource.id}
            style={{
              background: '#334155',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '20px' }}>
              {getFileIcon(resource.mime)}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: '500',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {resource.name}
              </div>
              <div style={{
                color: '#94a3b8',
                fontSize: '10px',
                marginTop: '2px',
              }}>
                {resource.mime} • {formatFileSize(resource.size)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {resource.dataUrl && (
                <button className="btn h-10 min-w-[96px]" onClick={() => {
                    // Open preview in new window
                    const newWindow = window.open();
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head><title>${resource.name}</title></head>
                          <body style="margin:0; padding:20px; background:#1e293b; color:#e2e8f0;">
                            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">${resource.name}</h3>
                            ${resource.mime.startsWith('image/') 
                              ? `<img src="${resource.dataUrl}" style="max-width:100%; height:auto;" />`
                              : `<pre style="white-space: pre-wrap; font-family: monospace;">${resource.dataUrl}</pre>`
                            }
                          </body>
                        </html>
                      `);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                  title="Preview"
                >
                  👁️
                </button>
              )}
              
              <button className="btn h-10 min-w-[96px]" onClick={() => {
                  if (resource.file) {
                    const url = URL.createObjectURL(resource.file);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = resource.name;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#10b981',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
                title="Download"
              >
                ⬇️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        marginTop: '16px',
        padding: '8px 12px',
        background: '#1e293b',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#94a3b8',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Total files: {currentRun.resources.length}</span>
          <span>
            Total size: {formatFileSize(
              currentRun.resources.reduce((sum, r) => sum + r.size, 0)
            )}
          </span>
        </div>
      </div>
    </div>
  );
}



