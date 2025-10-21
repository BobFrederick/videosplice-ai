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
  AlertDialogTrigger,
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
        startTime: seg.startTime || 0,
        endTime: seg.endTime || videoDuration,
        description: seg.description || '',
      }))

      if (segments.length === 0) {
        throw new Error('No segments generated')
      }

      handleSegmentChange(segments)
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
                  onClick={handleAnalyzeTranscript}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Spinner size={16} weight="bold" className="mr-2 animate-spin" />
                  ) : (
                    <Brain size={16} weight="bold" className="mr-2" />
                  )}
                  {isAnalyzing ? 'Analyzing...' : 'Auto-Generate Segments'}
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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash size={16} weight="bold" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{project.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onProjectDelete(project.id)
                          onBack()
                          toast.success('Project deleted')
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </header>

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

          <div className="lg:col-span-1">
            <SegmentEditor
              segments={project.segments}
              onSegmentChange={handleSegmentChange}
              onSegmentSelect={handleSegmentSelect}
              selectedSegmentId={selectedSegmentId}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
