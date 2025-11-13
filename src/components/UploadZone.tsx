import { useState, useCallback } from 'react'
import { UploadSimple, VideoCamera, CheckCircle, Warning, Spinner, FileText } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface UploadZoneProps {
  onUpload: (file: File, vttFile?: File) => void
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
  const [showVttDialog, setShowVttDialog] = useState(false)
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null)
  const [vttFile, setVttFile] = useState<File | null>(null)

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

  const validateVttFile = (file: File): string | null => {
    if (!file.name.endsWith('.vtt')) {
      return 'Please upload a valid VTT subtitle file'
    }
    
    const maxSize = 10 * 1024 * 1024 // 10MB for VTT files
    if (file.size > maxSize) {
      return 'VTT file size exceeds 10MB limit'
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

    // Show VTT dialog before processing
    setPendingVideoFile(file)
    setVttFile(null)
    setShowVttDialog(true)
  }, [])

  const handleVttUpload = useCallback(() => {
    if (pendingVideoFile) {
      onUpload(pendingVideoFile, vttFile || undefined)
      setShowVttDialog(false)
      setPendingVideoFile(null)
      setVttFile(null)
    }
  }, [pendingVideoFile, vttFile, onUpload])

  const handleSkipVtt = useCallback(() => {
    if (pendingVideoFile) {
      onUpload(pendingVideoFile)
      setShowVttDialog(false)
      setPendingVideoFile(null)
      setVttFile(null)
    }
  }, [pendingVideoFile, onUpload])

  const handleVttFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validationError = validateVttFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setVttFile(file)
      setError(null)
    }
  }, [])

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
            <UploadSimple size={48} weight="duotone" className="text-purple-600 dark:text-purple-400" />
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

      {/* VTT Upload Dialog */}
      <Dialog open={showVttDialog} onOpenChange={setShowVttDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Optional: Upload Transcription</DialogTitle>
            <DialogDescription>
              Do you have an existing VTT transcription file? Uploading one will skip the audio transcription step and save time.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {vttFile ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <CheckCircle size={24} weight="fill" className="text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">{vttFile.name}</p>
                  <p className="text-xs text-green-700 dark:text-green-300">{(vttFile.size / 1024).toFixed(2)} KB</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVttFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
                <input
                  type="file"
                  className="hidden"
                  accept=".vtt"
                  onChange={handleVttFileSelect}
                />
                <FileText size={32} weight="duotone" className="text-gray-400 mb-2" />
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                  Click to upload VTT file
                </p>
                <p className="text-xs text-center text-gray-500 dark:text-gray-500 mt-1">
                  Optional subtitle/transcription file
                </p>
              </label>
            )}
            
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <Warning size={20} className="text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleSkipVtt}
              className="w-full sm:w-auto"
            >
              Skip - Use Whisper
            </Button>
            <Button
              onClick={handleVttUpload}
              className="w-full sm:w-auto"
              disabled={!vttFile && !pendingVideoFile}
            >
              {vttFile ? 'Upload with VTT' : 'Upload without VTT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
