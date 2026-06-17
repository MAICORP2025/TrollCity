/**
 * Shared file upload validation utilities.
 * Use these before every Supabase storage upload.
 */

export const FILE_VALIDATION = {
  image: {
    maxSize: 5 * 1024 * 1024, // 5MB
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  imageStrict: {
    maxSize: 5 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp'],
  },
  pdf: {
    maxSize: 10 * 1024 * 1024, // 10MB
    types: ['application/pdf'],
  },
  imageOrPdf: {
    maxSize: 10 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  video: {
    maxSize: 250 * 1024 * 1024, // 250MB
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
  videoShort: {
    maxSize: 50 * 1024 * 1024, // 50MB
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
  audio: {
    maxSize: 25 * 1024 * 1024, // 25MB
    types: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/m4a'],
  },
} as const

export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates a file against size and type constraints.
 * Returns { valid: false, error: "message" } on failure.
 */
export function validateFile(
  file: File,
  allowedTypes: readonly string[],
  maxSizeBytes: number,
  label = 'File'
): FileValidationResult {
  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024))
    return { valid: false, error: `${label} must be under ${maxMB}MB. Selected: ${(file.size / (1024 * 1024)).toFixed(1)}MB` }
  }

  if (!allowedTypes.includes(file.type)) {
    const types = allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')
    return { valid: false, error: `${label} must be: ${types}. Selected: ${file.type || 'unknown'}` }
  }

  return { valid: true }
}
