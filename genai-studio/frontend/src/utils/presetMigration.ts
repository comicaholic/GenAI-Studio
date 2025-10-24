// frontend/src/utils/presetMigration.ts
import { PresetData } from '@/types/settings';
import { Preset } from '@/stores/presetStore';

/**
 * Migrates old preset data format to new standardized format
 * This ensures backward compatibility with existing user data
 */

// Old format interface for migration
interface OldPresetData {
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

/**
 * Converts old PresetData format to new standardized format
 */
export function migrateOldPresetData(oldPreset: OldPresetData): PresetData {
  return {
    id: oldPreset.id,
    title: oldPreset.name, // name -> title
    type: oldPreset.type,
    body: oldPreset.content.prompt || "", // content.prompt -> body
    context: oldPreset.content.context,
    parameters: oldPreset.content.params ? {
      temperature: oldPreset.content.params.temperature,
      max_tokens: oldPreset.content.params.max_tokens,
      top_p: oldPreset.content.params.top_p,
      top_k: oldPreset.content.params.top_k,
    } : undefined,
    metrics: oldPreset.content.metrics,
  };
}

/**
 * Converts new PresetData format to old format for backward compatibility
 */
export function convertToOldPresetData(newPreset: PresetData): OldPresetData {
  return {
    id: newPreset.id,
    name: newPreset.title, // title -> name
    type: newPreset.type,
    content: {
      prompt: newPreset.body, // body -> content.prompt
      context: newPreset.context,
      params: newPreset.parameters ? {
        temperature: newPreset.parameters.temperature,
        max_tokens: newPreset.parameters.max_tokens,
        top_p: newPreset.parameters.top_p,
        top_k: newPreset.parameters.top_k,
      } : undefined,
      metrics: newPreset.metrics,
    },
  };
}

/**
 * Converts Preset (from localStorage store) to PresetData format
 */
export function convertPresetToPresetData(preset: Preset, type: "ocr" | "prompt" | "chat"): PresetData {
  return {
    id: preset.id,
    title: preset.title,
    type,
    body: preset.body,
    context: preset.parameters?.system,
    parameters: preset.parameters ? {
      temperature: preset.parameters.temperature ?? 0.7,
      max_tokens: preset.parameters.max_tokens ?? 1024,
      top_p: preset.parameters.top_p ?? 1.0,
      top_k: preset.parameters.top_k ?? 40,
    } : undefined,
    metrics: preset.metrics ? {
      rouge: preset.metrics.rouge ?? false,
      bleu: preset.metrics.bleu ?? false,
      f1: preset.metrics.f1 ?? false,
      em: preset.metrics.em ?? false,
      em_avg: false,
      bertscore: preset.metrics.bertscore ?? false,
      perplexity: preset.metrics.perplexity ?? false,
      accuracy: preset.metrics.accuracy ?? false,
      accuracy_avg: false,
      precision: preset.metrics.precision ?? false,
      precision_avg: false,
      recall: preset.metrics.recall ?? false,
      recall_avg: false,
    } : undefined,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  };
}

/**
 * Converts PresetData to Preset format for localStorage storage
 */
export function convertPresetDataToPreset(presetData: PresetData): Omit<Preset, 'createdAt' | 'updatedAt'> {
  return {
    id: presetData.id || crypto.randomUUID(),
    title: presetData.title,
    body: presetData.body,
    parameters: presetData.parameters ? {
      temperature: presetData.parameters.temperature,
      max_tokens: presetData.parameters.max_tokens,
      top_p: presetData.parameters.top_p,
      top_k: presetData.parameters.top_k,
      system: presetData.context,
    } : undefined,
    metrics: presetData.metrics,
  };
}

/**
 * Migrates localStorage preset data to new format
 * This should be called once during app initialization
 */
export function migrateLocalStoragePresets(): void {
  const presetTypes = ['ocr', 'prompt-eval', 'chat'] as const;
  
  presetTypes.forEach(presetType => {
    const storageKey = `presets-${presetType}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const presets = JSON.parse(stored) as Preset[];
        
        // Check if migration is needed (look for old format indicators)
        const needsMigration = presets.some(preset => 
          preset.title === undefined || 
          preset.body === undefined ||
          (preset as any).name !== undefined
        );
        
        if (needsMigration) {
          console.log(`Migrating presets for ${presetType}...`);
          
          const migratedPresets = presets.map(preset => {
            // If it's already in new format, keep it
            if (preset.title && preset.body !== undefined) {
              return preset;
            }
            
            // Convert old format to new format
            const oldFormat = preset as any;
            return {
              id: oldFormat.id || crypto.randomUUID(),
              title: oldFormat.name || oldFormat.title || 'Untitled Preset',
              body: oldFormat.body || oldFormat.content?.prompt || '',
              parameters: oldFormat.parameters || oldFormat.content?.params ? {
                temperature: oldFormat.parameters?.temperature ?? oldFormat.content?.params?.temperature ?? 0.7,
                max_tokens: oldFormat.parameters?.max_tokens ?? oldFormat.content?.params?.max_tokens ?? 1024,
                top_p: oldFormat.parameters?.top_p ?? oldFormat.content?.params?.top_p ?? 1.0,
                top_k: oldFormat.parameters?.top_k ?? oldFormat.content?.params?.top_k ?? 40,
                system: oldFormat.parameters?.system || oldFormat.content?.context,
              } : undefined,
              metrics: oldFormat.metrics || oldFormat.content?.metrics,
              createdAt: oldFormat.createdAt || Date.now(),
              updatedAt: oldFormat.updatedAt || Date.now(),
            } as Preset;
          });
          
          localStorage.setItem(storageKey, JSON.stringify(migratedPresets));
          console.log(`Successfully migrated ${migratedPresets.length} presets for ${presetType}`);
        }
      } catch (error) {
        console.error(`Failed to migrate presets for ${presetType}:`, error);
      }
    }
  });
}

/**
 * Validates preset data format
 */
export function validatePresetData(preset: any): preset is PresetData {
  return (
    typeof preset === 'object' &&
    preset !== null &&
    typeof preset.title === 'string' &&
    typeof preset.type === 'string' &&
    ['ocr', 'prompt', 'chat'].includes(preset.type) &&
    typeof preset.body === 'string'
  );
}



