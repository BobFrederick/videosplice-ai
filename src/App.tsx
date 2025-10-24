import { useState, useEffect, useRef } from 'react'
import { Brain, Plus, SpinnerIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { JobCard } from '@/components/JobCard'
import { ProjectView } from '@/components/ProjectView'
import { SettingsDialog } from '@/components/SettingsDialog'
import UploadPage from '@/components/UploadPage'
import type { VideoJob, Project } from '@/lib/types'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useJobQueue } from '@/hooks/useJobQueue'
import { VideoJobProcessor } from '@/lib/jobProcessor'
import { toast } from 'sonner'

type AppPage = 'queue' | 'upload'

function App() {
  const [projects, setProjects] = useLocalStorage<Project[]>('video-projects', [])
  const [currentPage, setCurrentPage] = useState<AppPage>('queue')
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  
  // Use the job queue system
  const {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    isProcessing,
    currentJobId,
    addJob,
    updateJobStatus,
    removeJob,
    setJobProcessor
  } = useJobQueue()

  const projectsList = Array.isArray(projects) ? projects : []
  const currentProject = projectsList.find((p) => p.id === currentProjectId)
  
  // Store video files temporarily 
  const videoFilesRef = useRef<Map<string, File>>(new Map())
  
  // Initialize job processor
  useEffect(() => {
    const processor = new VideoJobProcessor({
      updateJobStatus,
      setProjects
    })
    
    setJobProcessor(async (job: VideoJob) => {
      // Check if job is already completed or failed - don't reprocess
      if (job.status === 'completed' || job.status === 'failed') {
        console.log('⏭️ Skipping already completed/failed job:', job.id, job.status)
        return
      }
      
      // Get the stored video file
      const videoFile = videoFilesRef.current.get(job.id)
      if (!videoFile) {
        throw new Error('Video file not found for job')
      }
      
      console.log('🎬 Processing job with file:', job.id, videoFile.name)
      
      try {
        // Process with the actual file
        await processor.processJobWithFile(job, videoFile)
        console.log('🎉 Job processing completed successfully:', job.id)
        
        // Clean up stored file only after successful completion
        videoFilesRef.current.delete(job.id)
        console.log('🗑️ Cleaned up video file for completed job:', job.id)
      } catch (error) {
        console.error('❌ Job processing failed, keeping video file for retry:', job.id, error)
        // Don't delete the file on error so it can be retried
        throw error
      }
    })
  }, [updateJobStatus, setProjects, setJobProcessor])

  // Clean up orphaned jobs (jobs without video files) on app start
  useEffect(() => {
    // Use a timeout to ensure this runs after initial job loading
    const timeoutId = setTimeout(() => {
      console.log('🧹 Cleaning up orphaned jobs on app start...')
      
      // Get fresh jobs from localStorage to avoid stale state
      const freshJobs = (() => {
        try {
          const item = window.localStorage.getItem('video-jobs')
          return item ? JSON.parse(item) : []
        } catch {
          return []
        }
      })()
      
      const orphanedJobs = freshJobs.filter((job: any) => 
        ['queued', 'processing', 'transcribing', 'analyzing'].includes(job.status) &&
        !videoFilesRef.current.has(job.id)
      )
      
      if (orphanedJobs.length > 0) {
        console.log('🗑️ Found orphaned jobs (no video files):', orphanedJobs.map((j: any) => ({ id: j.id, status: j.status })))
        
        // Mark orphaned jobs as failed instead of trying to process them
        orphanedJobs.forEach((job: any) => {
          updateJobStatus(job.id, {
            status: 'failed',
            errorMessage: 'Video file no longer available (app restart)'
          })
        })
      } else {
        console.log('✅ No orphaned jobs found')
      }
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [updateJobStatus]) // Only depend on updateJobStatus

  const handleConfirmUpload = async (
    file: File,
    transcriptFile?: File
  ) => {
    // Generate job ID
    const jobId = `job-${Date.now()}`
    
    // Store the video file for processing
    videoFilesRef.current.set(jobId, file)
    
    // Create job with queued status
    const newJob: VideoJob = {
      id: jobId,
      fileName: file.name,
      fileSize: file.size,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hasCustomTranscript: !!transcriptFile
    }

    console.log('🆕 Adding job to queue:', newJob.id, newJob.fileName)
    
    // Add job to queue (this will trigger processing)
    addJob(newJob)
    
    toast.success('Video added to queue!', {
      description: `${file.name} will be processed automatically`,
    })
  }

  const handleViewDetails = (jobId: string) => {
    const project = projectsList.find((p) => p.jobId === jobId)
    
    if (project) {
      setCurrentProjectId(project.id)
    } else {
      toast.error('Project not found', {
        description: 'Unable to find the project for this job',
      })
    }
  }

  const handleDeleteJob = (jobId: string) => {
    removeJob(jobId)
    
    // Clean up stored file
    videoFilesRef.current.delete(jobId)
    
    // Remove associated project
    setProjects(currentProjects => {
      const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
      return existingProjects.filter(p => p.jobId !== jobId)
    })
    
    toast.success('Job deleted successfully')
  }

  const handleBackToJobs = () => {
    setCurrentProjectId(null)
  }

  // Debug logging for queue state
  console.log('🔍 Queue Debug:')
  console.log('- Total jobs:', jobs.length)
  console.log('- Active jobs:', activeJobs.length, activeJobs.map(j => ({ id: j.id, status: j.status })))
  console.log('- Completed jobs:', completedJobs.length, completedJobs.map(j => ({ id: j.id, status: j.status })))
  console.log('- Failed jobs:', failedJobs.length, failedJobs.map(j => ({ id: j.id, status: j.status })))
  console.log('- Is processing:', isProcessing)
  console.log('- Current job:', currentJobId)
  console.log('- Jobs array:', jobs)
  
  // Log current job details if processing
  if (currentJobId && isProcessing) {
    const currentJob = jobs.find(j => j.id === currentJobId)
    if (currentJob) {
      console.log('🎬 Current Job Details:')
      console.log(`   Status: ${currentJob.status}`)
      console.log(`   Progress: ${currentJob.progress}%`)
      console.log(`   File: ${currentJob.fileName}`)
    }
  }

  if (currentProject) {
    return (
      <ProjectView 
        project={currentProject} 
        onBack={handleBackToJobs}
        onProjectUpdate={(updatedProject) => {
          setProjects(currentProjects => {
            const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
            return existingProjects.map(p => 
              p.id === updatedProject.id ? updatedProject : p
            )
          })
        }}
      />
    )
  }

  // Render upload page
  if (currentPage === 'upload') {
    return (
      <UploadPage
        onBack={() => setCurrentPage('queue')}
        onConfirmUpload={handleConfirmUpload}
      />
    )
  }

  // Render main queue page
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-purple-600 rounded-xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              VideoSplice AI
            </h1>
          </div>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Intelligent video segmentation powered by local AI. Upload your videos and let our system automatically create meaningful chapters.
          </p>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-gray-50 border border-gray-200">
              <TabsTrigger value="active" className="text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:bg-white">
                Active Jobs ({activeJobs.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:bg-white">
                Completed ({completedJobs.length})
              </TabsTrigger>
              <TabsTrigger value="failed" className="text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:bg-white">
                Failed ({failedJobs.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4">
              <SettingsDialog />
              <Button
                onClick={() => setCurrentPage('upload')}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={isProcessing}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : 'Upload Video'}
              </Button>
            </div>
          </div>

          <TabsContent value="active" className="space-y-4">
            {activeJobs.length === 0 ? (
              <div className="text-center py-12">
                <SpinnerIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">No active jobs</p>
                <p className="text-gray-400">Upload a video to get started</p>
              </div>
            ) : (
              activeJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onViewDetails={handleViewDetails}
                  onDelete={handleDeleteJob}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedJobs.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-700 text-lg mb-2">No completed jobs yet</p>
                <p className="text-gray-500">Processed videos will appear here</p>
              </div>
            ) : (
              completedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onViewDetails={handleViewDetails}
                  onDelete={handleDeleteJob}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="failed" className="space-y-4">
            {failedJobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-500 text-xl">!</span>
                </div>
                <p className="text-gray-500 text-lg mb-2">No failed jobs</p>
                <p className="text-gray-400">Failed processing attempts will appear here</p>
              </div>
            ) : (
              failedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onViewDetails={handleViewDetails}
                  onDelete={handleDeleteJob}
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        <Toaster />
      </div>
    </div>
  )
}

export default App