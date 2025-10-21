import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Brain, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { UploadZone } from '@/components/UploadZone'
import { JobCard } from '@/components/JobCard'
import type { VideoJob } from '@/lib/types'
import { toast } from 'sonner'

function App() {
  const [jobs, setJobs] = useKV<VideoJob[]>('video-jobs', [])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUpload, setShowUpload] = useState(false)

  const jobsList = jobs ?? []

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)

    const jobId = `job-${Date.now()}`
    
    const newJob: VideoJob = {
      id: jobId,
      fileName: file.name,
      fileSize: file.size,
      status: 'uploading',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setJobs((currentJobs) => [newJob, ...(currentJobs ?? [])])

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
      
      setJobs((currentJobs) =>
        (currentJobs ?? []).map((job) =>
          job.id === jobId
            ? { ...job, status: 'transcribing', progress: 25, updatedAt: Date.now() }
            : job
        )
      )

      setTimeout(() => {
        setJobs((currentJobs) =>
          (currentJobs ?? []).map((job) =>
            job.id === jobId
              ? { ...job, status: 'analyzing', progress: 60, updatedAt: Date.now() }
              : job
          )
        )

        setTimeout(() => {
          setJobs((currentJobs) =>
            (currentJobs ?? []).map((job) =>
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
          )
          
          toast.success('Video processed successfully!', {
            description: `${file.name} has been segmented into 6 chapters`,
          })
        }, 3000)
      }, 3000)

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
            
            <Button onClick={() => setShowUpload(!showUpload)}>
              <Plus size={16} weight="bold" className="mr-2" />
              New Upload
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {showUpload && (
            <UploadZone
              onUpload={handleUpload}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
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
                    <JobCard key={job.id} job={job} />
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
                    <JobCard key={job.id} job={job} />
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