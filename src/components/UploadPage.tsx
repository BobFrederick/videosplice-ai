import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Brain } from 'lucide-react'
import { UploadZone } from './UploadZone'
import { UploadPreview } from './UploadPreview'

interface UploadPageProps {
  onBack: () => void
  onConfirmUpload: (file: File, transcriptFile?: File) => void
}

export default function UploadPage({ onBack, onConfirmUpload }: UploadPageProps) {
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null)

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file)
    setPreviewFile({ file, url })
  }

  const handlePreviewConfirm = (file: File, transcriptFile?: File) => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url)
    }
    setPreviewFile(null)
    onConfirmUpload(file, transcriptFile)
    onBack() // Return to main page after upload
  }

  const handlePreviewCancel = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url)
    }
    setPreviewFile(null)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Queue
            </Button>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-purple-600 rounded-xl">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                Upload Video
              </h1>
            </div>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Select a video file to process with AI-powered segmentation. Supported formats: MP4, MOV, AVI up to 2GB.
            </p>
          </div>
        </div>

        {/* Upload Area */}
        <div className="max-w-4xl mx-auto">
          {!previewFile ? (
            <UploadZone 
              onUpload={handleUpload}
              isUploading={false}
              uploadProgress={0}
            />
          ) : (
            <UploadPreview
              file={previewFile.file}
              videoUrl={previewFile.url}
              onConfirm={handlePreviewConfirm}
              onCancel={handlePreviewCancel}
            />
          )}
        </div>
      </div>
    </div>
  )
}