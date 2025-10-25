import { useState, useCallback } from 'react'
import { UploadSimple, VideoCamera, CheckCircle, Warning, Spinner } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface UploadZoneProps {
  onUpload: (file: File, customTranscript?: string) => void
  isUploading?: boolean
  uploadProgress?: number
  isProcessing?: boolean
  disabled?: boolean
}

export function UploadZone({ 
  onUpload, 
  isUploading = false, 
  uploadProgress = 0, 
  isProcessing = false,
  disabled = false 
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
    const maxSize = 2 * 1024 * 1024 * 1024

    if (!validTypes.includes(file.type)) {
      return 'Please upload a valid video file (MP4, MOV, or AVI)'
    }

    if (file.size > maxSize) {
      return 'File size exceeds 2GB limit'
    }

    return null
  }

  const handleFile = useCallback((file: File) => {
    setError(null)
    const validationError = validateFile(file)
    
    if (validationError) {
      setError(validationError)
      return
    }

    onUpload(file)
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        isDragging && 'border-accent bg-accent/5',
        error && 'border-destructive',
        (isUploading || isProcessing || disabled) && 'pointer-events-none opacity-50'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <label className="flex flex-col items-center justify-center p-12 cursor-pointer">
        <input
          type="file"
          className="hidden"
          accept="video/mp4,video/quicktime,video/x-msvideo"
          onChange={handleFileInput}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {error ? (
            <Warning size={48} weight="duotone" className="text-destructive" />
          ) : isProcessing ? (
            <Spinner size={48} weight="duotone" className="text-primary animate-spin" />
          ) : isUploading ? (
            <VideoCamera size={48} weight="duotone" className="text-primary animate-pulse" />
          ) : (
            <UploadSimple size={48} weight="duotone" className="text-muted-foreground" />
          )}

          <div className="space-y-2">
            {error ? (
              <p className="text-sm font-medium text-destructive">{error}</p>
            ) : isProcessing ? (
              <p className="text-sm font-medium text-foreground">Processing file...</p>
            ) : isUploading ? (
              <>
                <p className="text-sm font-medium text-foreground">Uploading video...</p>
                <Progress value={uploadProgress} className="w-64" />
                <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drop your video here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports MP4, MOV, AVI up to 2GB
                </p>
              </>
            )}
          </div>
        </div>
      </label>
    </Card>
  )
}
