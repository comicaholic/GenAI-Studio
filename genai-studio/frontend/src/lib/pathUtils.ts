/**
 * Utility functions for handling file paths in a portable way
 */

/**
 * Converts an absolute path to a relative path based on the backend data directory
 * This ensures paths work across different devices and environments
 */
export function makePathRelative(absolutePath: string): string {
  if (!absolutePath) return "";
  
  // Common patterns to make relative
  const patterns = [
    /^.*\/data\/(source|reference|context)\/(.+)$/,
    /^.*\/backend\/data\/(source|reference|context)\/(.+)$/,
    /^.*\/genai-studio\/backend\/data\/(source|reference|context)\/(.+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = absolutePath.match(pattern);
    if (match) {
      const [, kind, filename] = match;
      return `${kind}/${filename}`;
    }
  }
  
  // If no pattern matches, try to extract just the filename
  const filename = absolutePath.split('/').pop() || absolutePath.split('\\').pop();
  return filename || absolutePath;
}

/**
 * Converts a relative path back to an absolute path for API calls
 * This ensures the backend can find the file
 */
export function makePathAbsolute(relativePath: string): string {
  if (!relativePath) return "";
  
  // If it's already absolute, return as-is
  if (relativePath.includes('://') || relativePath.startsWith('/') || relativePath.match(/^[A-Za-z]:/)) {
    return relativePath;
  }
  
  // If it's already in the correct format (kind/filename), return as-is
  if (relativePath.includes('/') && !relativePath.includes('\\')) {
    return relativePath;
  }
  
  // Otherwise, assume it's just a filename and try to determine the kind
  // This is a fallback - ideally the path should include the kind
  return `source/${relativePath}`;
}

/**
 * Extracts the file kind (source, reference, context) from a path
 */
export function getFileKind(path: string): 'source' | 'reference' | 'context' {
  if (path.includes('/reference/') || path.includes('\\reference\\')) return 'reference';
  if (path.includes('/context/') || path.includes('\\context\\')) return 'context';
  return 'source'; // default
}

/**
 * Extracts just the filename from a path
 */
export function getFilename(path: string): string {
  return path.split('/').pop() || path.split('\\').pop() || path;
}
