export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | unknown

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        const delay = delayMs * Math.pow(2, i)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
  const maxSize = 2 * 1024 * 1024 * 1024
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload MP4, MOV, AVI, or WEBM files.',
    }
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${formatFileSize(maxSize)}.`,
    }
  }
  
  return { valid: true }
}

export function validateTranscriptFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['text/plain', 'text/vtt', 'application/x-subrip']
  const validExtensions = ['.txt', '.srt', '.vtt']
  
  const hasValidType = validTypes.includes(file.type)
  const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  
  if (!hasValidType && !hasValidExtension) {
    return {
      valid: false,
      error: 'Invalid transcript file. Please upload TXT, SRT, or VTT files.',
    }
  }
  
  return { valid: true }
}

export function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}
