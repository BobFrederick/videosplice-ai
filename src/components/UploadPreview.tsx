import { useState, useCallback } from 'react'
import { X, FileText, CheckCircle, Trash } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VideoPlayer } from '@/components/VideoPlayer'
import { cn } from '@/lib/utils'

interface UploadPreviewProps {
  file: File
  videoUrl: string
  onConfirm: (file: File, transcriptFile?: File) => void
  onCancel: () => void
}

export function UploadPreview({ file, videoUrl, onConfirm, onCancel }: UploadPreviewProps) {
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)

  const validateTranscriptFile = (file: File): string | null => {
    const validTypes = ['text/plain', 'text/vtt', 'application/x-subrip', 'text/srt']
    const maxSize = 10 * 1024 * 1024

    const extension = file.name.split('.').pop()?.toLowerCase()
    const validExtensions = ['txt', 'srt', 'vtt']
    
    if (!validExtensions.includes(extension || '')) {
      return 'Please upload a valid transcript file (.txt, .srt, or .vtt)'
    }

    if (file.size > maxSize) {
      return 'Transcript file size exceeds 10MB limit'
    }

    return null
  }

  const handleTranscriptFile = useCallback((file: File) => {
    setTranscriptError(null)
    const validationError = validateTranscriptFile(file)
    
    if (validationError) {
      setTranscriptError(validationError)
      return
    }

    setTranscriptFile(file)
  }, [])

  const handleTranscriptInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleTranscriptFile(file)
    }
  }, [handleTranscriptFile])

  const handleTranscriptDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleTranscriptFile(file)
    }
  }, [handleTranscriptFile])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleConfirm = () => {
    onConfirm(file, transcriptFile || undefined)
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Preview Upload</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{file.name}</span>
              <span>•</span>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
          >
            <X size={20} />
          </Button>
        </div>

        <VideoPlayer src={videoUrl} />
      </Card>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Transcript (Optional)</h4>
          <p className="text-xs text-muted-foreground">
            Upload an existing transcript to skip AI transcription and speed up processing
          </p>
        </div>

        {transcriptFile ? (
          <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} weight="fill" className="text-accent" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{transcriptFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(transcriptFile.size)}</p>
              </div>
            </div>
            <Button
              onClick={() => setTranscriptFile(null)}
              variant="ghost"
              size="sm"
            >
              <Trash size={16} />
            </Button>
          </div>
        ) : (
          <label
            className={cn(
              'flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
              transcriptError ? 'border-destructive bg-destructive/5' : 'border-border hover:border-accent hover:bg-accent/5'
            )}
            onDrop={handleTranscriptDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              type="file"
              className="hidden"
              accept=".txt,.srt,.vtt,text/plain,text/vtt,application/x-subrip"
              onChange={handleTranscriptInput}
            />
            <FileText size={32} weight="duotone" className={transcriptError ? 'text-destructive' : 'text-muted-foreground'} />
            <div className="mt-3 text-center space-y-1">
              {transcriptError ? (
                <p className="text-sm font-medium text-destructive">{transcriptError}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop transcript here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports .txt, .srt, .vtt up to 10MB</p>
                </>
              )}
            </div>
          </label>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          onClick={onCancel}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
        >
          Confirm & Process
        </Button>
      </div>
    </div>
  )
}
