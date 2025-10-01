// frontend/src/lib/files.ts

/**
 * Get an emoji icon for a file based on its MIME type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return '🖼️';
  }
  if (mimeType.startsWith('video/')) {
    return '🎥';
  }
  if (mimeType.startsWith('audio/')) {
    return '🎵';
  }
  if (mimeType === 'application/pdf') {
    return '📄';
  }
  if (mimeType.includes('text/') || mimeType === 'application/json') {
    return '📝';
  }
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) {
    return '📦';
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return '📄';
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return '📊';
  }
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return '📈';
  }
  return '📁';
}

/**
 * Format file size in bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if a file type is valid for upload
 */
export function isValidFileType(mimeType: string): boolean {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/json',
    'text/csv',
  ];
  
  return allowedTypes.includes(mimeType);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if file is a text file
 */
export function isTextFile(mimeType: string): boolean {
  return mimeType.startsWith('text/') || mimeType === 'application/json';
}


