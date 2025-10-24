// Utility functions for safe localStorage operations with validation

export interface LocalStorageConfig<T> {
  key: string;
  defaultValue: T;
  validator?: (value: unknown) => value is T;
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  };
}

export function safeLocalStorage<T>(config: LocalStorageConfig<T>): {
  get: () => T;
  set: (value: T) => void;
  remove: () => void;
} {
  const { key, defaultValue, validator, serializer } = config;
  
  const defaultSerializer = {
    serialize: (value: T) => {
      if (value instanceof Set) {
        return JSON.stringify(Array.from(value));
      }
      return JSON.stringify(value);
    },
    deserialize: (value: string) => {
      const parsed = JSON.parse(value);
      // Convert arrays back to Sets if the default value is a Set
      if (defaultValue instanceof Set && Array.isArray(parsed)) {
        return new Set(parsed) as T;
      }
      return parsed;
    }
  };
  
  const { serialize, deserialize } = serializer || defaultSerializer;

  return {
    get: () => {
      try {
        const item = localStorage.getItem(key);
        if (item === null) {
          return defaultValue;
        }
        
        const parsed = deserialize(item);
        
        if (validator && !validator(parsed)) {
          console.warn(`Invalid data in localStorage for key "${key}", using default value`);
          return defaultValue;
        }
        
        return parsed;
      } catch (error) {
        console.error(`Error reading from localStorage for key "${key}":`, error);
        return defaultValue;
      }
    },
    
    set: (value: T) => {
      try {
        if (validator && !validator(value)) {
          console.warn(`Invalid data being stored in localStorage for key "${key}"`);
          return;
        }
        localStorage.setItem(key, serialize(value));
      } catch (error) {
        console.error(`Error writing to localStorage for key "${key}":`, error);
      }
    },
    
    remove: () => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing from localStorage for key "${key}":`, error);
      }
    }
  };
}

// Validators for common types
export const validators = {
  string: (value: unknown): value is string => typeof value === 'string',
  boolean: (value: unknown): value is boolean => typeof value === 'boolean',
  number: (value: unknown): value is number => typeof value === 'number',
  array: (value: unknown): value is unknown[] => Array.isArray(value),
  object: (value: unknown): value is Record<string, unknown> => 
    typeof value === 'object' && value !== null && !Array.isArray(value),
  
  set: (value: unknown): value is Set<string> => 
    value instanceof Set,
  
  stringArray: (value: unknown): value is string[] => 
    Array.isArray(value) && value.every(item => typeof item === 'string')
};
