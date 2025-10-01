// frontend/src/components/PresetEditor/PresetEditor.tsx
import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/components/Notification/Notification';
import { api } from '@/services/api';

interface PresetData {
  id?: string;
  name: string;
  type: "ocr" | "prompt" | "chat";
  content: {
    prompt?: string;
    context?: string;
    params?: {
      temperature: number;
      max_tokens: number;
      top_p: number;
      top_k: number;
    };
    metrics?: {
      rouge: boolean;
      bleu: boolean;
      f1: boolean;
      em: boolean;
      em_avg: boolean;
      bertscore: boolean;
      perplexity: boolean;
      accuracy: boolean;
      accuracy_avg: boolean;
      precision: boolean;
      precision_avg: boolean;
      recall: boolean;
      recall_avg: boolean;
    };
  };
}

interface PresetEditorProps {
  preset?: PresetData | null;
  onSave: (preset: PresetData) => void;
  onCancel: () => void;
  onDelete?: (presetId: string) => void;
  onClone?: (preset: PresetData) => void;
  onExport?: (preset: PresetData) => void;
}

export default function PresetEditor({ 
  preset, 
  onSave, 
  onCancel, 
  onDelete, 
  onClone, 
  onExport 
}: PresetEditorProps) {
  const { showSuccess, showError } = useNotifications();
  const [activeTab, setActiveTab] = useState<'prompt' | 'parameters' | 'metrics'>('prompt');
  const [formData, setFormData] = useState<PresetData>({
    name: "",
    type: "ocr",
    content: {
      prompt: "",
      context: "",
      params: {
        temperature: 0.2,
        max_tokens: 512,
        top_p: 1.0,
        top_k: 40,
      },
      metrics: {
        rouge: true,
        bleu: true,
        f1: true,
        em: false,
        em_avg: false,
        bertscore: false,
        perplexity: false,
        accuracy: false,
        accuracy_avg: false,
        precision: false,
        precision_avg: false,
        recall: false,
        recall_avg: false,
      },
    },
  });

  useEffect(() => {
    if (preset) {
      setFormData(preset);
    }
  }, [preset]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError("Invalid Preset", "Please provide a name for the preset.");
      return;
    }

    if (!formData.content.prompt?.trim() && !formData.content.context?.trim()) {
      showError("Invalid Preset", "Please provide either a prompt or context.");
      return;
    }

    try {
      await onSave(formData);
      showSuccess("Preset Saved", `Preset "${formData.name}" has been saved successfully.`);
    } catch (error: any) {
      showError("Save Failed", "Failed to save preset: " + (error.message || error));
    }
  };

  const handleDelete = async () => {
    if (!preset?.id || !onDelete) return;
    
    if (window.confirm(`Are you sure you want to delete preset "${formData.name}"?`)) {
      try {
        await onDelete(preset.id);
        showSuccess("Preset Deleted", `Preset "${formData.name}" has been deleted successfully.`);
      } catch (error: any) {
        showError("Delete Failed", "Failed to delete preset: " + (error.message || error));
      }
    }
  };

  const handleClone = () => {
    if (!onClone) return;
    const clonedPreset = {
      ...formData,
      name: `${formData.name} (Copy)`,
      id: undefined
    };
    onClone(clonedPreset);
  };

  const handleExport = () => {
    if (!onExport) return;
    onExport(formData);
  };

  const updateFormData = (path: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData as any;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const getPlaceholders = () => {
    switch (formData.type) {
      case 'ocr':
        return ['{extracted text}', '{pdf_text}', '{source_text}', '{reference}'];
      case 'prompt':
        return ['{reference}', '{context}'];
      case 'chat':
        return ['{user_input}', '{context}'];
      default:
        return [];
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById('prompt-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + placeholder + text.substring(end);
      
      updateFormData('content.prompt', newText);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            {preset ? `Edit Preset: ${preset.name}` : 'Create New Preset'}
          </h3>
          <div style={styles.headerActions}>
            {preset && onClone && (
              <button onClick={handleClone} style={styles.actionBtn}>
                📋 Clone
              </button>
            )}
            {preset && onExport && (
              <button onClick={handleExport} style={styles.actionBtn}>
                📤 Export
              </button>
            )}
            {preset && onDelete && (
              <button onClick={handleDelete} style={{...styles.actionBtn, ...styles.dangerBtn}}>
                🗑️ Delete
              </button>
            )}
            <button onClick={onCancel} style={styles.closeBtn}>
              ×
            </button>
          </div>
        </div>

        <div style={styles.content}>
          {/* Basic Info */}
          <div style={styles.section}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Preset Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="Enter preset name"
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Preset Type</label>
              <select
                value={formData.type}
                onChange={(e) => updateFormData('type', e.target.value)}
                style={styles.select}
              >
                <option value="ocr">OCR Evaluation</option>
                <option value="prompt">Prompt Evaluation</option>
                <option value="chat">Chat</option>
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              className={activeTab === 'prompt' ? 'active' : ''}
              onClick={() => setActiveTab('prompt')}
              style={{...styles.tab, ...(activeTab === 'prompt' ? styles.tabActive : {})}}
            >
              {formData.type === 'chat' ? 'Context' : 'Prompt/Context'}
            </button>
            <button
              className={activeTab === 'parameters' ? 'active' : ''}
              onClick={() => setActiveTab('parameters')}
              style={{...styles.tab, ...(activeTab === 'parameters' ? styles.tabActive : {})}}
            >
              Parameters
            </button>
            {(formData.type === 'ocr' || formData.type === 'prompt') && (
              <button
                className={activeTab === 'metrics' ? 'active' : ''}
                onClick={() => setActiveTab('metrics')}
                style={{...styles.tab, ...(activeTab === 'metrics' ? styles.tabActive : {})}}
              >
                Metrics
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            {activeTab === 'prompt' && (
              <div>
                {formData.type === 'chat' ? (
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Context/System Prompt</label>
                    <textarea
                      value={formData.content.context || ""}
                      onChange={(e) => updateFormData('content.context', e.target.value)}
                      placeholder="Enter context prompt for the chat assistant..."
                      style={{...styles.textarea, minHeight: 120}}
                    />
                  </div>
                ) : (
                  <>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Prompt Template</label>
                      <div style={styles.placeholderButtons}>
                        {getPlaceholders().map(placeholder => (
                          <button
                            key={placeholder}
                            onClick={() => insertPlaceholder(placeholder)}
                            style={styles.placeholderBtn}
                          >
                            {placeholder}
                          </button>
                        ))}
                      </div>
                      <textarea
                        id="prompt-textarea"
                        value={formData.content.prompt || ""}
                        onChange={(e) => updateFormData('content.prompt', e.target.value)}
                        placeholder={`Enter prompt template (use ${getPlaceholders().join(', ')} as placeholders)...`}
                        style={{...styles.textarea, minHeight: 120}}
                      />
                    </div>
                    {formData.type === 'prompt' && (
                      <div style={styles.inputGroup}>
                        <label style={styles.label}>Context (Optional)</label>
                        <textarea
                          value={formData.content.context || ""}
                          onChange={(e) => updateFormData('content.context', e.target.value)}
                          placeholder="Enter additional context..."
                          style={{...styles.textarea, minHeight: 80}}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'parameters' && (
              <div style={styles.parametersGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Temperature</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.content.params?.temperature || 0.2}
                    onChange={(e) => updateFormData('content.params.temperature', parseFloat(e.target.value))}
                    style={styles.input}
                  />
                  <div style={styles.helpText}>Controls randomness (0 = deterministic, 2 = very random)</div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Max Tokens</label>
                  <input
                    type="number"
                    min="1"
                    max="4096"
                    value={formData.content.params?.max_tokens || 512}
                    onChange={(e) => updateFormData('content.params.max_tokens', parseInt(e.target.value))}
                    style={styles.input}
                  />
                  <div style={styles.helpText}>Maximum number of tokens to generate</div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Top P</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.content.params?.top_p || 1.0}
                    onChange={(e) => updateFormData('content.params.top_p', parseFloat(e.target.value))}
                    style={styles.input}
                  />
                  <div style={styles.helpText}>Nucleus sampling parameter (0-1)</div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Top K</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.content.params?.top_k || 40}
                    onChange={(e) => updateFormData('content.params.top_k', parseInt(e.target.value))}
                    style={styles.input}
                  />
                  <div style={styles.helpText}>Top-k sampling parameter</div>
                </div>
              </div>
            )}

            {activeTab === 'metrics' && (formData.type === 'ocr' || formData.type === 'prompt') && (
              <div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Evaluation Metrics</label>
                  <div style={styles.metricsGrid}>
                    {Object.entries(formData.content.metrics || {}).map(([key, value]) => (
                      <label key={key} style={styles.metricItem}>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => updateFormData(`content.metrics.${key}`, e.target.checked)}
                          style={styles.checkbox}
                        />
                        <span style={styles.metricLabel}>
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={styles.footer}>
          <button onClick={onCancel} style={styles.cancelBtn}>
            Cancel
          </button>
          <button onClick={handleSave} style={styles.saveBtn}>
            {preset ? 'Update Preset' : 'Create Preset'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: 0,
    minWidth: 800,
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #334155',
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: '#e2e8f0',
    fontWeight: 600,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    padding: '6px 12px',
    border: '1px solid #334155',
    borderRadius: 6,
    background: '#1e293b',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 12,
  },
  dangerBtn: {
    borderColor: '#ef4444',
    color: '#ef4444',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: 24,
    cursor: 'pointer',
    padding: 4,
  },
  content: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
  },
  section: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 8,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #334155',
    borderRadius: 8,
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: 14,
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #334155',
    borderRadius: 8,
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: 14,
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #334155',
    borderRadius: 8,
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'monospace',
  },
  placeholderButtons: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  placeholderBtn: {
    padding: '4px 8px',
    border: '1px solid #334155',
    borderRadius: 4,
    background: '#1e293b',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    borderBottom: '1px solid #334155',
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    borderRadius: '8px 8px 0 0',
    fontSize: 14,
  },
  tabActive: {
    background: '#1e293b',
    color: '#e2e8f0',
    fontWeight: 500,
  },
  tabContent: {
    minHeight: 300,
  },
  parametersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
  },
  helpText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  metricItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px',
    background: '#0f172a',
    borderRadius: 6,
    border: '1px solid #334155',
  },
  checkbox: {
    margin: 0,
  },
  metricLabel: {
    fontSize: 12,
    color: '#e2e8f0',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '20px 24px',
    borderTop: '1px solid #334155',
  },
  cancelBtn: {
    padding: '8px 16px',
    border: '1px solid #334155',
    borderRadius: 8,
    background: '#0f172a',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 14,
  },
  saveBtn: {
    padding: '8px 16px',
    background: '#10b981',
    border: 'none',
    borderRadius: 8,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
};

