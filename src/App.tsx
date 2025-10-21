import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Brain, Plus, Spinner } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { UploadZone } from '@/components/UploadZone'
import { UploadPreview } from '@/components/UploadPreview'
import { JobCard } from '@/components/JobCard'
import { ProjectView } from '@/components/ProjectView'
import { SettingsDialog } from '@/components/SettingsDialog'
import type { VideoJob, Project } from '@/lib/types'
import { toast } from 'sonner'

function App() {
  const [jobs, setJobs] = useKV<VideoJob[]>('video-jobs', [])
  const [projects, setProjects] = useKV<Project[]>('video-projects', [])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null)

  const jobsList = Array.isArray(jobs) ? jobs : []
  const projectsList = Array.isArray(projects) ? projects : []
  const currentProject = projectsList.find((p) => p.id === currentProjectId)

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)
    setIsProcessing(true)

    await new Promise(resolve => setTimeout(resolve, 100))

    const videoUrl = URL.createObjectURL(file)
    
    setPreviewFile({ file, url: videoUrl })
    setIsUploading(false)
    setIsProcessing(false)
    setUploadProgress(0)
  }

  const handlePreviewCancel = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url)
    }
    setPreviewFile(null)
    setShowUpload(false)
  }

  const handlePreviewConfirm = async (file: File, transcriptFile?: File) => {
    setIsUploading(true)
    setUploadProgress(0)
    setIsProcessing(true)

    await new Promise(resolve => setTimeout(resolve, 100))

    const jobId = `job-${Date.now()}`
    const videoUrl = previewFile?.url || URL.createObjectURL(file)
    
    let transcriptContent: string | undefined
    let transcriptFileName: string | undefined

    if (transcriptFile) {
      transcriptFileName = transcriptFile.name
      try {
        transcriptContent = await transcriptFile.text()
      } catch (error) {
        toast.error('Failed to read transcript file')
      }
    }
    
    const newJob: VideoJob = {
      id: jobId,
      fileName: file.name,
      fileSize: file.size,
      status: 'uploading',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hasCustomTranscript: !!transcriptFile,
      transcriptFileName,
    }

    setJobs((currentJobs) => {
      const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
      return [newJob, ...existingJobs]
    })
    setIsProcessing(false)
    setPreviewFile(null)

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 10
      })
    }, 200)

    setTimeout(() => {
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      const nextStatus = transcriptFile ? 'analyzing' : 'transcribing'
      const nextProgress = transcriptFile ? 50 : 25
      
      setJobs((currentJobs) => {
        const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
        return existingJobs.map((job) =>
          job.id === jobId
            ? { ...job, status: nextStatus, progress: nextProgress, updatedAt: Date.now() }
            : job
        )
      })

      const processingDelay = transcriptFile ? 2000 : 3000

      setTimeout(() => {
        setJobs((currentJobs) => {
          const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
          return existingJobs.map((job) =>
            job.id === jobId
              ? { ...job, status: 'analyzing', progress: 60, updatedAt: Date.now() }
              : job
          )
        })

        setTimeout(() => {
          setJobs((currentJobs) => {
            const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
            return existingJobs.map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    status: 'completed',
                    progress: 100,
                    updatedAt: Date.now(),
                    duration: 450,
                    segmentCount: 6,
                  }
                : job
            )
          })

          const mockTranscript = transcriptContent || `Welcome to this tutorial on video editing. Today we'll cover the basics of cutting and splicing footage.

First, let's talk about the timeline interface. The timeline is where you'll spend most of your editing time. It displays your video clips in chronological order.

Next, we'll explore different cutting techniques. The most common is the straight cut, where one clip immediately follows another.

Now let's discuss transitions. Transitions help smooth the flow between different clips and can add professional polish to your work.

Finally, we'll cover audio mixing. Good audio is just as important as good video, so pay attention to your levels and use appropriate music.`

          const newProject: Project = {
            id: `project-${Date.now()}`,
            name: file.name,
            jobId: jobId,
            videoUrl,
            duration: 450,
            transcript: mockTranscript,
            segments: [
              {
                id: 'seg-1',
                title: 'Introduction',
                startTime: 0,
                endTime: 45,
                description: 'Welcome and overview of the tutorial',
              },
              {
                id: 'seg-2',
                title: 'Timeline Interface',
                startTime: 45,
                endTime: 120,
                description: 'Understanding the timeline and clip arrangement',
              },
              {
                id: 'seg-3',
                title: 'Cutting Techniques',
                startTime: 120,
                endTime: 210,
                description: 'Different methods for cutting video clips',
              },
              {
                id: 'seg-4',
                title: 'Transitions',
                startTime: 210,
                endTime: 315,
                description: 'Adding smooth transitions between clips',
              },
              {
                id: 'seg-5',
                title: 'Audio Mixing',
                startTime: 315,
                endTime: 420,
                description: 'Balancing audio levels and adding music',
              },
              {
                id: 'seg-6',
                title: 'Conclusion',
                startTime: 420,
                endTime: 450,
                description: 'Recap and final thoughts',
              },
            ],
          }

          setProjects((currentProjects) => {
            const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
            return [newProject, ...existingProjects]
          })
          
          const successMessage = transcriptFile 
            ? `Video processed with custom transcript!`
            : 'Video processed successfully!'
          
          const description = transcriptFile
            ? `${file.name} has been segmented into 6 chapters using your transcript`
            : `${file.name} has been segmented into 6 chapters`

          toast.success(successMessage, {
            description,
          })
        }, 3000)
      }, processingDelay)

      setIsUploading(false)
      setUploadProgress(0)
      setShowUpload(false)
    }, 2000)
  }

  const activeJobs = jobsList.filter((job) => 
    ['uploading', 'transcribing', 'analyzing', 'segmenting', 'queued'].includes(job.status)
  )
  
  const completedJobs = jobsList.filter((job) => job.status === 'completed')
  const failedJobs = jobsList.filter((job) => job.status === 'failed')

  const handleViewDetails = (jobId: string) => {
    setProjects((currentProjects) => {
      const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
      const project = existingProjects.find((p) => p.jobId === jobId)
      
      if (project) {
        setCurrentProjectId(project.id)
      } else {
        toast.error('Project not found', {
          description: 'Unable to find the project for this job',
        })
      }
      
      return existingProjects
    })
  }

  const handleProjectUpdate = (updatedProject: Project) => {
    setProjects((currentProjects) => {
      const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
      return existingProjects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      )
    })
  }

  const handleProjectDelete = (projectId: string) => {
    setProjects((currentProjects) => {
      const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
      return existingProjects.filter((p) => p.id !== projectId)
    })
  }

  const handleJobDelete = (jobId: string) => {
    setProjects((currentProjects) => {
      const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
      const project = existingProjects.find((p) => p.jobId === jobId)
      
      if (project) {
        const updatedProjects = existingProjects.filter((p) => p.id !== project.id)
        
        setJobs((currentJobs) => {
          const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
          return existingJobs.filter((j) => j.id !== jobId)
        })
        
        toast.success('Project deleted', {
          description: 'The project and its data have been removed',
        })
        
        return updatedProjects
      }
      
      return existingProjects
    })
    
    setJobs((currentJobs) => {
      const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
      const jobExists = existingJobs.some((j) => j.id === jobId)
      
      if (jobExists) {
        toast.success('Job deleted', {
          description: 'The job has been removed',
        })
        return existingJobs.filter((j) => j.id !== jobId)
      }
      
      return existingJobs
    })
  }

  const handleJobRetry = (jobId: string) => {
    setJobs((currentJobs) => {
      const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
      const job = existingJobs.find((j) => j.id === jobId)
      
      if (!job) return existingJobs
      
      const updatedJobs = existingJobs.map((j) =>
        j.id === jobId
          ? { ...j, status: 'queued' as const, progress: 0, errorMessage: undefined, updatedAt: Date.now() }
          : j
      )
      
      toast.success('Job queued for retry', {
        description: 'The job will be processed again',
      })
      
      setTimeout(() => {
        setJobs((currentJobs) => {
          const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
          return existingJobs.map((j) =>
            j.id === jobId
              ? { ...j, status: 'transcribing' as const, progress: 25, updatedAt: Date.now() }
              : j
          )
        })
      }, 1000)
      
      return updatedJobs
    })
  }

  if (currentProject) {
    return (
      <ProjectView
        project={currentProject}
        onBack={() => setCurrentProjectId(null)}
        onProjectUpdate={handleProjectUpdate}
        onProjectDelete={handleProjectDelete}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain size={24} weight="duotone" className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">VideoSplit</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Video Segmentation</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <SettingsDialog />
              <Button onClick={() => setShowUpload(!showUpload)}>
                <Plus size={16} weight="bold" className="mr-2" />
                New Upload
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {showUpload && !previewFile && (
            <UploadZone
              onUpload={handleUpload}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              isProcessing={isProcessing}
            />
          )}

          {showUpload && previewFile && (
            <UploadPreview
              file={previewFile.file}
              videoUrl={previewFile.url}
              onConfirm={handlePreviewConfirm}
              onCancel={handlePreviewCancel}
            />
          )}

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="active">
                Active {activeJobs.length > 0 && `(${activeJobs.length})`}
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed {completedJobs.length > 0 && `(${completedJobs.length})`}
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed {failedJobs.length > 0 && `(${failedJobs.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6 space-y-4">
              {activeJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No active jobs</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {activeJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-6 space-y-4">
              {completedJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No completed jobs</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {completedJobs.map((job) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      onViewDetails={handleViewDetails}
                      onDelete={handleJobDelete}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="failed" className="mt-6 space-y-4">
              {failedJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No failed jobs</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {failedJobs.map((job) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      onViewDetails={handleViewDetails}
                      onRetry={handleJobRetry}
                      onDelete={handleJobDelete}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

export default App