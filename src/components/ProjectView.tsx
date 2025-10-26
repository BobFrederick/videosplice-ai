import { useState, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { ArrowLeft, Brain, DownloadSimple, Spinner, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Timeline } from '@/components/Timeline'
import { SegmentEditor } from '@/components/SegmentEditor'
import { TranscriptViewer } from '@/components/TranscriptViewer'
import { ExportView } from '@/components/ExportView'
import { DeleteProjectDialog } from '@/components/DeleteProjectDialog'
import type { Project, Segment } from '@/lib/types'
import type { LLMSettings } from '@/components/SettingsDialog'
import { retryWithBackoff, parseErrorMessage } from '@/lib/helpers'
import { createLLMService } from '@/lib/llm'
import { createDefaultPrompt } from '@shared/lib/prompts'
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
  console.log('🎥 ProjectView - Project data:', {
    id: project.id,
    name: project.name,
    videoUrl: project.videoUrl,
    segmentCount: project.segments?.length || 0
  })
  
  const [settings] = useLocalStorage<LLMSettings>('llm-settings', {
    model: 'qwen2.5:7b',
    provider: 'local',
    localEndpoint: 'http://localhost:11434',
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(project.duration || 450)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showExportView, setShowExportView] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [showAdvancedMode, setShowAdvancedMode] = useState(false)
  const [customInstructions, setCustomInstructions] = useState('')

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
      toast.error('No transcript available to analyze')
      return
    }

    if (!settings) {
      toast.error('LLM settings not configured. Please check Settings.')
      return
    }

    setIsAnalyzing(true)

    try {
      const transcriptText = project.transcript
      const videoDuration = duration
      
      // Use whisperSegments if available, otherwise create basic segments from transcript
      const whisperSegments = project.whisperSegments || []
      
      // Generate prompt using shared createDefaultPrompt function
      const promptText = settings?.customPrompt 
        ? settings.customPrompt
            .replace(/\{transcript\}/g, transcriptText)
            .replace(/\{duration\}/g, String(videoDuration))
        : createDefaultPrompt(
            transcriptText,
            whisperSegments,
            videoDuration,
            project.name,
            customInstructions || undefined
          )

      // Create LLM service with current settings
      const llmService = createLLMService(settings)
      
      const response = await retryWithBackoff(async () => {
        const llmResponse = await llmService.generateText(promptText)
        return llmResponse.text
      }, 3, 2000)
      
      // Parse JSON response
      let result
      try {
        result = JSON.parse(response)
      } catch (parseError) {
        // Try to extract JSON from response if it's wrapped in markdown or other text
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Could not parse JSON from LLM response')
        }
      }

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
      toast.success(`Generated ${validSegments.length} segments`, {
        description: `Using ${settings.provider}/${settings.model}`,
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#282c34]">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#21252b]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft size={20} weight="bold" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
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
                segments={project.segments}
                onTranscriptUpdate={handleTranscriptUpdate}
                editable={true}
              />
            )}
          </div>

          <div className="lg:col-span-1 lg:max-h-[calc(100vh-12rem)] lg:sticky lg:top-6 space-y-4">
            {/* Advanced Mode Toggle */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="advanced-mode" className="text-sm font-medium">
                    Advanced Mode
                  </Label>
                  <Switch
                    id="advanced-mode"
                    checked={showAdvancedMode}
                    onCheckedChange={setShowAdvancedMode}
                  />
                </div>
              </CardHeader>
              {showAdvancedMode && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="custom-instructions" className="text-xs text-muted-foreground">
                      Custom segmentation instructions (optional)
                    </Label>
                    <Textarea
                      id="custom-instructions"
                      placeholder="e.g., Create more granular segments focusing on specific topics, or combine similar sections..."
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      className="min-h-[100px] text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      These instructions will be added to the AI prompt when you regenerate segments.
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
            
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
