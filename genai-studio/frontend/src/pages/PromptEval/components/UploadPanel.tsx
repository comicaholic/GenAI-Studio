// frontend/src/pages/PromptEval/components/UploadPanel.tsx
import React, { useState, useRef, useCallback } from 'react';
import { resourceStore } from '@/stores/resourceStore';
import { Resource } from '@/types/promptEval';
import { getFileIcon, formatFileSize, isValidFileType } from '@/lib/files';

interface UploadPanelProps {
  resourceIds: string[];
  onResourceIdsChange: (ids: string[]) => void;
}

export default function UploadPanel({ resourceIds, onResourceIdsChange }: UploadPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resources = resourceStore.getByIds(resourceIds);
  const stats = resourceStore.getStats();

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrors([]);

    const fileArray = Array.from(files);
    const result = await resourceStore.add(fileArray);

    if (result.resources.length > 0) {
      const newResourceIds = [...resourceIds, ...result.resources.map(r => r.id)];
      onResourceIdsChange(newResourceIds);
    }

    if (result.errors.length > 0) {
      setErrors(result.errors);
    }

    setUploading(false);
  }, [resourceIds, onResourceIdsChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = useCallback((resourceId: string) => {
    resourceStore.remove(resourceId);
    const newResourceIds = resourceIds.filter(id => id !== resourceId);
    onResourceIdsChange(newResourceIds);
  }, [resourceIds, onResourceIdsChange]);

  const handleRename = useCallback((resourceId: string, newName: string) => {
    resourceStore.rename(resourceId, newName);
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all resources?')) {
      resourceStore.clear();
      onResourceIdsChange([]);
    }
  }, [onResourceIdsChange]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragOver ? '#3b82f6' : '#475569'}`,
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          background: isDragOver ? '#1e40af20' : 'transparent',
          marginBottom: '16px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={handleBrowseClick}
      >
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', marginBottom: '4px' }}>
          Drop files here or click to browse
        </div>
        <div style={{ color: '#94a3b8', fontSize: '12px' }}>
          PNG, JPG, PDF, TXT, MD, DOCX (max 25MB each)
        </div>
        {uploading && (
          <div style={{ color: '#3b82f6', fontSize: '12px', marginTop: '8px' }}>
            Uploading...
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.docx"
        onChange={(e) => handleFileSelect(e.target.files)}
        style={{ display: 'none' }}
      />

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {errors.map((error, index) => (
            <div
              key={index}
              style={{
                background: '#ef444420',
                color: '#fca5a5',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                marginBottom: '4px',
              }}
            >
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Resource List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {resources.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#94a3b8', 
            fontSize: '12px',
            padding: '24px 0'
          }}>
            No resources uploaded
          </div>
        ) : (
          <div>
            {resources.map((resource) => (
              <ResourceItem
                key={resource.id}
                resource={resource}
                onRemove={() => handleRemove(resource.id)}
                onRename={(newName) => handleRename(resource.id, newName)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats and Actions */}
      <div style={{ 
        borderTop: '1px solid #334155', 
        paddingTop: '12px',
        marginTop: '12px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '11px' }}>
            {stats.count} files • {stats.totalSizeFormatted}
          </div>
          <button className="btn h-10 min-w-[96px]" onClick={handleClearAll}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '2px 4px',
            }}>
            Clear All
          </button>
        </div>
        
        {/* Storage usage bar */}
        <div style={{ 
          width: '100%', 
          height: '4px', 
          background: '#334155', 
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${(stats.totalSize / stats.maxTotalSize) * 100}%`,
            height: '100%',
            background: stats.totalSize > stats.maxTotalSize * 0.8 ? '#ef4444' : '#3b82f6',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

interface ResourceItemProps {
  resource: Resource;
  onRemove: () => void;
  onRename: (newName: string) => void;
}

function ResourceItem({ resource, onRemove, onRename }: ResourceItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(resource.name);

  const handleRenameSubmit = () => {
    if (newName.trim() && newName !== resource.name) {
      onRename(newName.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setNewName(resource.name);
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      borderRadius: '6px',
      marginBottom: '4px',
      background: '#334155',
    }}>
      <div style={{ fontSize: '16px', marginRight: '8px' }}>
        {getFileIcon(resource.mime)}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRenaming ? (
          <input className="input h-10 text-sm" type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              padding: '2px 6px',
              color: '#e2e8f0',
              fontSize: '12px',
            }}
            autoFocus
          />
        ) : (
          <div>
            <div style={{ 
              color: '#e2e8f0', 
              fontSize: '12px', 
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {resource.name}
            </div>
            <div style={{ 
              color: '#94a3b8', 
              fontSize: '10px' 
            }}>
              {formatFileSize(resource.size)}
            </div>
          </div>
        )}
      </div>

      {!isRenaming && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn h-10 min-w-[96px]" onClick={() => setIsRenaming(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '2px 4px',
            }}
            title="Rename"
          >
            ✏️
          </button>
          <button className="btn h-10 min-w-[96px]" onClick={onRemove}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '2px 4px',
            }}
            title="Remove">
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}



