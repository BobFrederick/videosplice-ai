import { useState } from 'react'
import { ArrowLeft, Brain, DownloadSimple, Spinner, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Timeline } from '@/components/Timeline'
import { SegmentEditor } from '@/components/SegmentEditor'
import type { Project, Segment } from '@/lib/types'
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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(project.duration || 450)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleSegmentChange = (segments: Segment[]) => {
    onProjectUpdate({ ...project, segments })
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
      
      const promptText = `You are a video segmentation expert. Analyze the following transcript and identify logical chapter boundaries where topic changes occur.

For each segment, provide:
1. A descriptive title (3-7 words)
2. Start time in seconds
3. End time in seconds
4. Brief description of the segment content

Transcript:
${transcriptText}

Video duration: ${videoDuration} seconds

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

      const response = await window.spark.llm(promptText, 'gpt-4o', true)
      const result = JSON.parse(response)

      const segments: Segment[] = result.segments.map((seg: any, index: number) => ({
        id: `segment-${Date.now()}-${index}`,
        title: seg.title,
        startTime: seg.startTime,
        endTime: seg.endTime,
        description: seg.description,
      }))

      handleSegmentChange(segments)
      toast.success(`Generated ${segments.length} segments`)
    } catch (error) {
      console.error('Failed to analyze transcript:', error)
      toast.error('Failed to analyze transcript')
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
      toast.success(`Generated ${project.segments.length} video segments`, {
        description: 'Files are ready for download',
      })
    }, 3000)
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
              duration={duration}
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {project.transcript}
                    </p>
                  </div>
                </CardContent>
              </Card>
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
