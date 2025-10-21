import { useState, useEffect } from 'react'
import { DownloadSimple, FileVideo, Package, CheckCircle, Spinner, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Project, Segment, ExportedSegment } from '@/lib/types'
import { formatDuration, formatFileSize } from '@/lib/helpers'

interface ExportViewProps {
  project: Project
  onClose: () => void
}

export function ExportView({ project, onClose }: ExportViewProps) {
  const [exportedSegments, setExportedSegments] = useState<ExportedSegment[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0)

  useEffect(() => {
    startExport()
  }, [])

  const startExport = async () => {
    setIsExporting(true)
    setExportProgress(0)
    
    const segments: ExportedSegment[] = []
    const totalSegments = project.segments.length
    
    for (let i = 0; i < project.segments.length; i++) {
      const segment = project.segments[i]
      setCurrentSegmentIndex(i)
      
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const duration = segment.endTime - segment.startTime
      const estimatedSize = Math.floor((duration / 60) * 15 * 1024 * 1024)
      
      const thumbnailCanvas = document.createElement('canvas')
      thumbnailCanvas.width = 640
      thumbnailCanvas.height = 360
      const ctx = thumbnailCanvas.getContext('2d')
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 640, 360)
        gradient.addColorStop(0, `hsl(${(i * 60) % 360}, 70%, 60%)`)
        gradient.addColorStop(1, `hsl(${(i * 60 + 30) % 360}, 70%, 40%)`)
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 640, 360)
        
        ctx.fillStyle = 'white'
        ctx.font = 'bold 32px Inter'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(segment.title, 320, 180)
      }
      const thumbnailUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.8)
      
      const exportedSegment: ExportedSegment = {
        id: segment.id,
        segmentNumber: i + 1,
        title: segment.title,
        description: segment.description || '',
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: duration,
        fileSize: estimatedSize,
        thumbnailUrl,
        downloadUrl: project.videoUrl || '',
        fileName: `${sanitizeFilename(project.name)}_segment_${String(i + 1).padStart(2, '0')}_${sanitizeFilename(segment.title)}.mp4`,
        status: 'completed',
      }
      
      segments.push(exportedSegment)
      setExportedSegments([...segments])
      setExportProgress(((i + 1) / totalSegments) * 100)
    }
    
    setIsExporting(false)
  }

  const sanitizeFilename = (name: string): string => {
    return name
      .replace(/[^a-z0-9_\-\.]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }

  const handleDownloadSegment = (segment: ExportedSegment) => {
    const link = document.createElement('a')
    link.href = segment.downloadUrl
    link.download = segment.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAll = async () => {
    for (const segment of exportedSegments) {
      await new Promise(resolve => setTimeout(resolve, 100))
      handleDownloadSegment(segment)
    }
  }

  const totalSize = exportedSegments.reduce((sum, seg) => sum + seg.fileSize, 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Export Complete</h1>
              <p className="text-xs text-muted-foreground">
                {exportedSegments.length} of {project.segments.length} segments ready
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {!isExporting && exportedSegments.length > 0 && (
                <Button onClick={handleDownloadAll}>
                  <Package size={16} weight="bold" className="mr-2" />
                  Download All ({exportedSegments.length})
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                <X size={20} weight="bold" />
              </Button>
            </div>
          </div>
          
          {isExporting && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Processing segment {currentSegmentIndex + 1} of {project.segments.length}
                </span>
                <span className="font-medium">{Math.round(exportProgress)}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {!isExporting && exportedSegments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle size={24} weight="duotone" className="text-accent" />
                  Export Summary
                </CardTitle>
                <CardDescription>
                  Your video has been split into {exportedSegments.length} segment{exportedSegments.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Segments</div>
                    <div className="text-2xl font-bold">{exportedSegments.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Duration</div>
                    <div className="text-2xl font-bold">
                      {formatDuration(project.duration || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Estimated Size</div>
                    <div className="text-2xl font-bold">{formatFileSize(totalSize)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {exportedSegments.map((segment) => (
              <Card key={segment.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative w-full md:w-48 h-32 md:h-auto bg-muted flex-shrink-0">
                    <img
                      src={segment.thumbnailUrl}
                      alt={segment.title}
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-2 left-2 bg-background/90 text-foreground">
                      #{segment.segmentNumber}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 p-4 md:p-6 md:pl-0 space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">{segment.title}</h3>
                      {segment.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {segment.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileVideo size={16} weight="duotone" />
                        <span>{formatDuration(segment.duration)}</span>
                      </div>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{formatFileSize(segment.fileSize)}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span className="font-mono text-xs">
                        {formatDuration(segment.startTime)} - {formatDuration(segment.endTime)}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleDownloadSegment(segment)}
                      >
                        <DownloadSimple size={16} weight="bold" className="mr-2" />
                        Download
                      </Button>
                      <Button size="sm" variant="outline">
                        <span className="font-mono text-xs">{segment.fileName}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {isExporting && exportedSegments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Spinner size={48} weight="bold" className="text-primary animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium">Processing your video</p>
                <p className="text-sm text-muted-foreground">
                  Splitting into {project.segments.length} segments...
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
