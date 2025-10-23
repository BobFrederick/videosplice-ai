import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { ArrowLeft, Brain, DownloadSimple, Spinner, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Timeline } from '@/components/Timeline'
import { SegmentEditor } from '@/components/SegmentEditor'
import { TranscriptViewer } from '@/components/TranscriptViewer'
import { ExportView } from '@/components/ExportView'
import { DeleteProjectDialog } from '@/components/DeleteProjectDialog'
import type { Project, Segment } from '@/lib/types'
import type { LLMSettings } from '@/components/SettingsDialog'
import { retryWithBackoff, parseErrorMessage } from '@/lib/helpers'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ProjectViewProps {
  project: Project
  onBack: () => void
  onProjectUpdate: (project: Project) => void
  onProjectDelete?: (projectId: string) => void
}

export function ProjectView({ project, onBack, onProjectUpdate, onProjectDelete }: ProjectViewProps) {
  const [settings] = useKV<LLMSettings>('llm-settings', {
    model: 'gpt-4o',
    provider: 'openai',
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(project.duration || 450)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showExportView, setShowExportView] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)

  // Update project duration when it changes from video metadata
  useEffect(() => {
    if (duration !== project.duration) {
      onProjectUpdate({ ...project, duration })
    }
  }, [duration])

  const handleSegmentChange = (segments: Segment[]) => {
    onProjectUpdate({ ...project, segments })
  }

  const handleTranscriptUpdate = (transcript: string) => {
    onProjectUpdate({ ...project, transcript })
  }

  const handleSegmentSelect = (segment: Segment) => {
    setSelectedSegmentId(segment.id)
    setCurrentTime(segment.startTime)
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
  }

  const handleAnalyzeTranscript = async () => {
    if (!project.transcript) {
      toast.error('No transcript available')
      return
    }

    setIsAnalyzing(true)

    try {
      const transcriptText = project.transcript
      const videoDuration = duration
      
      const defaultPrompt = `You are a video segmentation expert. Analyze the following transcript and identify logical chapter boundaries where topic changes occur.

For each segment, provide:
1. A descriptive title (3-7 words)
2. Start time in seconds
3. End time in seconds
4. Brief description of the segment content

IMPORTANT: The video duration is {duration} seconds. ALL segment times must be between 0 and {duration} seconds. The last segment's endTime must not exceed {duration} seconds.

Transcript:
{transcript}

Video duration: {duration} seconds

Return the result as a valid JSON object with a single property called "segments" that contains an array of segment objects.

Format:
{
  "segments": [
    {
      "title": "Introduction",
      "startTime": 0,
      "endTime": 45,
      "description": "Opening remarks and overview"
    }
  ]
}`

      const promptTemplate = settings?.customPrompt || defaultPrompt
      const promptText = promptTemplate
        .replace('{transcript}', transcriptText)
        .replace('{duration}', String(videoDuration))

      const model = settings?.model || 'gpt-4o'
      
      const response = await retryWithBackoff(async () => {
        return await spark.llm(promptText, model, true)
      }, 3, 2000)
      
      const result = JSON.parse(response)

      if (!result.segments || !Array.isArray(result.segments)) {
        throw new Error('Invalid response format from LLM')
      }

      const segments: Segment[] = result.segments.map((seg: any, index: number) => ({
        id: `segment-${Date.now()}-${index}`,
        title: seg.title || 'Untitled Segment',
        startTime: Math.max(0, Math.min(seg.startTime || 0, videoDuration)),
        endTime: Math.max(0, Math.min(seg.endTime || videoDuration, videoDuration)),
        description: seg.description || '',
      }))
      
      // Filter out invalid segments and clamp times to video duration
      const validSegments = segments.filter(seg => {
        // Ensure start is before end
        if (seg.startTime >= seg.endTime) return false
        // Ensure segment is within video bounds
        if (seg.startTime >= videoDuration || seg.endTime > videoDuration) return false
        // Ensure reasonable segment duration (at least 1 second)
        if (seg.endTime - seg.startTime < 1) return false
        return true
      }).map(seg => ({
        ...seg,
        startTime: Math.max(0, seg.startTime),
        endTime: Math.min(videoDuration, seg.endTime)
      }))

      if (validSegments.length === 0) {
        throw new Error('No valid segments generated')
      }

      handleSegmentChange(validSegments)
      toast.success(`Generated ${segments.length} segments`, {
        description: `Using ${model}`,
      })
    } catch (error) {
      console.error('Failed to analyze transcript:', error)
      const errorMessage = parseErrorMessage(error)
      toast.error('Failed to analyze transcript', {
        description: errorMessage,
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateSegments = async () => {
    if (project.segments.length === 0) {
      toast.error('No segments to generate')
      return
    }

    setIsGenerating(true)

    setTimeout(() => {
      setIsGenerating(false)
      setShowExportView(true)
      toast.success(`Generated ${project.segments.length} video segments`, {
        description: 'Files are ready for download',
      })
    }, 1000)
  }

  if (showExportView) {
    return (
      <ExportView
        project={project}
        onClose={() => setShowExportView(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft size={20} weight="bold" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{project.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {project.segments.length} segment{project.segments.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {project.transcript && (
                <Button
                  variant="outline"
                  onClick={() => setShowRegenerateDialog(true)}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Spinner size={16} weight="bold" className="mr-2 animate-spin" />
                  ) : (
                    <Brain size={16} weight="bold" className="mr-2" />
                  )}
                  {isAnalyzing ? 'Analyzing...' : 'Re-Generate Segments'}
                </Button>
              )}
              <Button
                onClick={handleGenerateSegments}
                disabled={isGenerating || project.segments.length === 0}
              >
                {isGenerating ? (
                  <Spinner size={16} weight="bold" className="mr-2 animate-spin" />
                ) : (
                  <DownloadSimple size={16} weight="bold" className="mr-2" />
                )}
                {isGenerating ? 'Generating...' : 'Generate Video Files'}
              </Button>
              
              {onProjectDelete && (
                <DeleteProjectDialog
                  projectName={project.name}
                  onDelete={() => {
                    onProjectDelete(project.id)
                    onBack()
                    toast.success('Project deleted')
                  }}
                >
                  <Button variant="destructive" size="icon">
                    <Trash size={16} weight="bold" />
                  </Button>
                </DeleteProjectDialog>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Re-Generate Segments Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-Generate Segments?</AlertDialogTitle>
            <AlertDialogDescription>
              This will use AI to analyze your transcript and create new segments. Any manual edits you've made to the current segments will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRegenerateDialog(false)
                handleAnalyzeTranscript()
              }}
            >
              Re-Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <VideoPlayer
              src={project.videoUrl}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
            />

            <Timeline
              segments={project.segments}
              duration={duration}
              currentTime={currentTime}
              onSegmentChange={handleSegmentChange}
              onSeek={handleSeek}
            />

            {project.transcript && (
              <TranscriptViewer
                transcript={project.transcript}
                onTranscriptUpdate={handleTranscriptUpdate}
                editable={true}
              />
            )}
          </div>

          <div className="lg:col-span-1 lg:max-h-[calc(100vh-12rem)] lg:sticky lg:top-6">
            <SegmentEditor
              segments={project.segments}
              onSegmentChange={handleSegmentChange}
              onSegmentSelect={handleSegmentSelect}
              selectedSegmentId={selectedSegmentId}
              duration={duration}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
