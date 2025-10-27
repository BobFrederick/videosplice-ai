import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, Eye, Upload, RefreshCw, Film } from 'lucide-react'
import { UploadZone } from './UploadZone'
import queueAPI from '@/services/queueAPI'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { toast } from 'sonner'

// Video Thumbnail Component
function VideoThumbnail({ file }: { file: File }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const url = URL.createObjectURL(file)

    video.src = url
    video.currentTime = 1 // Seek to 1 second for thumbnail
    
    video.addEventListener('loadeddata', () => {
      canvas.width = 96
      canvas.height = 54
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setThumbnail(canvas.toDataURL())
      }
      URL.revokeObjectURL(url)
    })

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  return (
    <div className="w-24 h-[54px] bg-gray-200 dark:bg-gray-800 rounded overflow-hidden flex items-center justify-center">
      {thumbnail ? (
        <img src={thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
      ) : (
        <Film className="w-8 h-8 text-gray-400" />
      )}
    </div>
  )
}

interface QueueJob {
  id: string
  name: string
  data: any
  progress: number
  timestamp: number
  processedOn?: number
  finishedOn?: number
  failedReason?: string
  returnvalue?: any
}

interface LLMSettings {
  model: string
  provider: 'local' | 'openai'
  localEndpoint: string
  customPrompt?: string
}

interface BullMQQueueProps {
  onViewProject?: (projectId: string, job?: any) => void
}

export function BullMQQueue({ onViewProject }: BullMQQueueProps = {}) {
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [pendingJobs, setPendingJobs] = useState<Map<string, { file: File, timestamp: number, realJobId?: string }>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(true)
  const [llmSettings] = useLocalStorage<LLMSettings>('llm-settings', {
    model: 'qwen2.5:7b',
    provider: 'local',
    localEndpoint: 'http://localhost:11434',
  })
  const [jobUpdates, setJobUpdates] = useState<Map<string, any>>(new Map())
  
  // Use a ref to always have the latest jobUpdates for onClick handlers
  const jobUpdatesRef = useRef<Map<string, any>>(new Map())
  
  // Keep ref in sync with state
  useEffect(() => {
    jobUpdatesRef.current = jobUpdates
  }, [jobUpdates])

  // Connection check - test actual server connectivity
  const checkConnection = async () => {
    console.log('🔗 Testing actual server connection...')
    try {
      const response = await fetch('http://localhost:8080/api/stats')
      if (response.ok) {
        console.log('✅ Server connection confirmed')
        setIsConnected(true)
        toast.success('Server connection confirmed')
      } else {
        console.log('❌ Server responded with error:', response.status)
        setIsConnected(false)
        toast.error(`Server error: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ Server connection failed:', error)
      setIsConnected(false)
      toast.error('Server connection failed')
    }
  }

  // Load jobs on component mount
  useEffect(() => {
    loadJobs()
    loadStats()
    
    // More aggressive polling - 500ms for active jobs, 2s for idle
    const interval = setInterval(() => {
      const hasActiveJobs = Array.from(jobUpdates.values()).some(
        update => update?.status === 'processing' || update?.status === 'transcribing' || update?.status === 'analyzing'
      ) || Array.from(pendingJobs.values()).some(p => p.realJobId)
      
      // Fast polling when jobs are active, slower when idle
      const shouldPollNow = hasActiveJobs || Date.now() % 2000 < 500
      
      if (shouldPollNow) {
        loadJobs()
        loadStats()
      }
    }, 500) // Check every 500ms

    return () => clearInterval(interval)
  }, [jobUpdates, pendingJobs])

  const loadJobs = async () => {
    try {
      console.log('📋 Loading jobs from API...')
      const fetchedJobs = await queueAPI.getAllJobs()
      console.log('📋 Fetched jobs:', fetchedJobs.length, fetchedJobs)
      
      // Also try loading completed jobs specifically
      try {
        const completedJobs = await fetch('http://localhost:8080/api/jobs?status=completed').then(r => r.json())
        console.log('📋 Completed jobs check:', completedJobs)
      } catch (e) {
        console.log('📋 Failed to check completed jobs:', e)
      }
      setJobs(fetchedJobs)
      
      // Keep pending jobs visible much longer since jobs complete very fast
      // Only clean up based on WebSocket completion status, not API presence
      const now = Date.now()
      setPendingJobs(prev => {
        const newMap = new Map()
        for (const [tempId, pendingJob] of prev.entries()) {
          const jobAge = now - pendingJob.timestamp
          const webSocketUpdate = pendingJob.realJobId ? jobUpdates.get(pendingJob.realJobId) : null
          
          // Keep pending job if:
          // 1. No real job ID yet (still uploading)
          // 2. Job is less than 2 minutes old (extended visibility) 
          // 3. WebSocket hasn't confirmed completion yet
          // 4. Or WebSocket shows completion but job is less than 30 seconds old (show results briefly)
          
          const isCompleted = webSocketUpdate?.status === 'completed'
          const isFailed = webSocketUpdate?.status === 'failed'
          const shouldKeepCompleted = isCompleted && jobAge < 30000 // Keep completed jobs for 30s
          const shouldKeepFailed = isFailed && jobAge < 15000 // Keep failed jobs for 15s
          
          if (!pendingJob.realJobId || jobAge < 120000 || shouldKeepCompleted || shouldKeepFailed) {
            newMap.set(tempId, pendingJob)
          } else {
            console.log(`🧹 Cleaning up pending job ${tempId} - age: ${Math.round(jobAge/1000)}s, status: ${webSocketUpdate?.status}`)
          }
        }
        return newMap
      })
      
      // If we successfully loaded jobs, we're connected
      setIsConnected(true)
      console.log('✅ Jobs loaded successfully - connection confirmed')
    } catch (error) {
      console.error('Failed to load jobs:', error)
      setIsConnected(false)
      toast.error('Failed to load jobs')
    }
  }

  const loadStats = async () => {
    try {
      const fetchedStats = await queueAPI.getStats()
      setStats(fetchedStats)
      // If we successfully loaded stats, we're connected
      setIsConnected(true)
      console.log('✅ Stats loaded successfully - connection confirmed')
    } catch (error) {
      console.error('Failed to load stats:', error)
      setIsConnected(false)
    }
  }

  const cacheCompletedJob = async (jobId: string, jobData: any) => {
    try {
      const response = await fetch(`http://localhost:8080/api/jobs/${jobId}/cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData)
      })
      
      if (response.ok) {
        console.log(`💾 Successfully cached completed job: ${jobId}`)
      } else {
        console.error(`❌ Failed to cache job: ${jobId}`, response.status)
      }
    } catch (error) {
      console.error(`❌ Error caching job ${jobId}:`, error)
    }
  }

  const handleUpload = async (file: File, customTranscript?: string) => {
    // Create a temporary ID for the pending job
    const tempJobId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('🚀 Starting upload process for:', file.name, 'tempJobId:', tempJobId)
    
    // Add to pending jobs immediately for instant UI feedback
    setPendingJobs(prev => new Map(prev.set(tempJobId, { 
      file, 
      timestamp: Date.now() 
    })))
    
    console.log('📝 Added pending job, current pending jobs:', pendingJobs.size + 1)
    
    setIsLoading(true)
    
    try {
      console.log('📤 Calling queueAPI.uploadVideo...')
      const result = await queueAPI.uploadVideo(
        file,
        { llmSettings, customTranscript }
      )
      console.log('✅ queueAPI.uploadVideo result:', result)
      
      if (!result || !result.jobId) {
        throw new Error('Upload returned no job ID')
      }
      
      const { jobId } = result
      console.log('🆔 Received jobId:', jobId)
      
      // Store the real job ID in the pending job for cleanup later
      setPendingJobs(prev => {
        const existing = prev.get(tempJobId)
        console.log('🔗 Linking pending job to real job:', tempJobId, '→', jobId)
        if (existing) {
          const newMap = new Map(prev)
          newMap.set(tempJobId, { ...existing, realJobId: jobId })
          return newMap
        }
        return prev
      })

      // Subscribe to job updates
      console.log('📡 Setting up WebSocket subscription for job:', jobId)
      const unsubscribe = queueAPI.subscribeToJob(jobId, (update) => {
        console.log('📡 Received job update:', jobId, update)
        console.log('📡 Full update object:', JSON.stringify(update, null, 2))
        
        // Update both state AND ref immediately to avoid timing issues
        setJobUpdates(prev => {
          const newMap = new Map(prev)
          newMap.set(jobId, update)
          console.log('📡 jobUpdates map updated:', Array.from(newMap.entries()))
          
          // Also update ref immediately so onClick handlers have instant access
          jobUpdatesRef.current = newMap
          console.log('📡 jobUpdatesRef also updated immediately')
          
          return newMap
        })
        
        if (update.status === 'completed') {
          toast.success(`Video processing completed: ${file.name}`)
          
          // Cache the completed job data to ensure it persists
          cacheCompletedJob(jobId, {
            name: 'process-video',
            data: {
              id: jobId,
              fileName: file.name,
              fileSize: file.size,
              status: 'completed'
            },
            progress: 100,
            timestamp: Date.now(),
            processedOn: Date.now(),
            finishedOn: Date.now(),
            returnvalue: update.result
          })
          
          // Immediately trigger a job reload to get the completed job from API
          console.log(`✅ Job ${jobId} completed - triggering immediate reload`)
          loadJobs()
        } else if (update.status === 'failed') {
          toast.error(`Video processing failed: ${update.error || 'Unknown error'}`)
          console.log(`❌ Job ${jobId} failed - keeping visible via pending job system`)
        }
      })

      // Clean up subscription when job completes or component unmounts
      setTimeout(() => {
        if (jobUpdates.get(jobId)?.status === 'completed' || jobUpdates.get(jobId)?.status === 'failed') {
          unsubscribe()
        }
      }, 60000) // Auto cleanup after 1 minute

      toast.success(`Video uploaded successfully: ${file.name}`)
      console.log('📋 Job created, refreshing job list...', jobId)
      
      // Immediately refresh the job list to show the new job
      await loadJobs()
      console.log('📋 Job list refreshed, jobs count:', jobs.length)
      
      // Light polling just to refresh stats, not for job visibility (handled by WebSocket + pending jobs)
      console.log(`📡 WebSocket handling job visibility for ${jobId}, minimal polling for stats only`)
      
    } catch (error) {
      console.error('❌ Upload failed at step:', error)
      console.error('❌ Full error object:', error)
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')
      
      // Remove from pending jobs on upload failure
      setPendingJobs(prev => {
        const newMap = new Map(prev)
        newMap.delete(tempJobId)
        console.log('🧹 Removed failed pending job:', tempJobId)
        return newMap
      })
      
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      console.log('🏁 Upload process completed, isLoading set to false')
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    try {
      await queueAPI.deleteJob(jobId)
      toast.success('Job deleted successfully')
      loadJobs()
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete job')
    }
  }

  const getJobStatus = (job: QueueJob): string => {
    if (job.failedReason) return 'failed'
    if (job.finishedOn) {
      // Add debugging to see what's in returnvalue
      console.log(`🔍 Job ${job.id} finished, returnvalue:`, job.returnvalue)
      
      // Check if we have actual results before marking as completed
      if (job.returnvalue && (job.returnvalue.segments || job.returnvalue.transcript)) {
        return 'completed'
      } else if (job.data && (job.data.segments || job.data.transcript || job.data.result)) {
        // Some jobs might store results in data instead of returnvalue
        console.log(`🔍 Found results in job.data for ${job.id}:`, job.data)
        return 'completed'
      } else {
        // Check if job has been finished for more than 2 minutes - might be stuck
        const finishedAge = Date.now() - job.finishedOn
        if (finishedAge > 2 * 60 * 1000) { // 2 minutes
          console.log(`⚠️ Job ${job.id} has been "finished" for ${Math.round(finishedAge/1000)}s but no results`)
          console.log(`⚠️ Job data:`, JSON.stringify(job.data, null, 2))
          console.log(`⚠️ Job returnvalue:`, JSON.stringify(job.returnvalue, null, 2))
          console.log(`⚠️ Marking as failed`)
          return 'failed'
        }
        
        // BullMQ finished but no results yet - still analyzing
        return 'analyzing'
      }
    }
    if (job.processedOn) return 'processing'
    return 'waiting'
  }

  const getJobProgress = (job: QueueJob): number => {
    const update = jobUpdates.get(job.id)
    if (update?.progress !== undefined) return update.progress
    return job.progress || 0
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white'
      case 'failed': return 'bg-red-500 text-white dark:bg-red-600 dark:text-white'
      case 'processing': return 'bg-purple-400 text-white dark:bg-purple-600 dark:text-white'
      case 'analyzing': return 'bg-purple-500 text-white dark:bg-purple-500 dark:text-white'
      case 'waiting': return 'bg-purple-300 text-gray-900 dark:bg-purple-700 dark:text-white'
      case 'uploading': return 'bg-purple-200 text-gray-900 dark:bg-purple-800 dark:text-white'
      default: return 'bg-gray-400 text-white dark:bg-gray-600 dark:text-white'
    }
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Video for Processing
          </CardTitle>
          <CardDescription>
            Upload a video to process with BullMQ queue system. One job processes at a time to protect GPU resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadZone
            onUpload={handleUpload}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Alert>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Queue Server: {isConnected ? '✅ Connected' : '❌ Disconnected'}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkConnection}
              className="ml-2"
            >
              Test Connection
            </Button>
          </span>
          {stats && (() => {
            // Calculate actual user-visible stats
            let active = 0, waiting = 0, completed = 0, failed = 0
            
            // Count pending jobs
            for (const [tempId, pendingJob] of pendingJobs.entries()) {
              const webSocketData = pendingJob.realJobId ? jobUpdates.get(pendingJob.realJobId) : null
              const realJob = pendingJob.realJobId ? jobs.find(j => j.id === pendingJob.realJobId) : null
              
              let status = pendingJob.realJobId ? 'waiting' : 'uploading'
              
              if (webSocketData) {
                if (webSocketData.status === 'completed' && webSocketData.result?.segments) {
                  status = 'completed'
                } else if (webSocketData.status === 'failed') {
                  status = 'failed'
                } else if (webSocketData.status === 'processing' || webSocketData.progress >= 0) {
                  status = 'processing'
                }
              } else if (realJob) {
                const realJobStatus = getJobStatus(realJob)
                if (realJob.processedOn && realJobStatus !== 'waiting') {
                  status = realJobStatus
                }
              }
              
              if (status === 'uploading' || status === 'processing' || status === 'analyzing') {
                active++
              } else if (status === 'waiting') {
                waiting++
              } else if (status === 'completed') {
                completed++
              } else if (status === 'failed') {
                failed++
              }
            }
            
            // Count real jobs that don't have pending counterparts
            const pendingRealJobIds = new Set(Array.from(pendingJobs.values()).map(p => p.realJobId).filter(Boolean))
            jobs.filter(job => !pendingRealJobIds.has(job.id)).forEach(job => {
              const status = getJobStatus(job)
              if (status === 'processing' || status === 'analyzing') {
                active++
              } else if (status === 'waiting') {
                waiting++
              } else if (status === 'completed') {
                completed++
              } else if (status === 'failed') {
                failed++
              }
            })
            
            return (
              <span>
                Active: {active} | Waiting: {waiting} | Completed: {completed} | Failed: {failed}
              </span>
            )
          })()}
        </AlertDescription>
      </Alert>

      {/* Jobs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Processing Queue</h3>
          <Button
            variant="outline" 
            size="sm"
            onClick={() => { loadJobs(); loadStats(); }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Render pending jobs with WebSocket updates */}
        {Array.from(pendingJobs.entries()).map(([tempId, pendingJob]) => {
          const webSocketData = pendingJob.realJobId ? jobUpdates.get(pendingJob.realJobId) : null
          const fileName = pendingJob.file.name
          const fileSize = pendingJob.file.size
          
          // Determine current status from WebSocket or job creation state
          let status = pendingJob.realJobId ? 'waiting' : 'uploading'
          let showViewResults = false
          
          // Check if we can find the real job in the jobs array for fallback status
          const realJob = pendingJob.realJobId ? jobs.find(j => j.id === pendingJob.realJobId) : null
          
          if (webSocketData) {
            console.log(`🔍 WebSocket data check for ${tempId}:`, {
              status: webSocketData.status,
              hasResult: !!webSocketData.result,
              resultKeys: webSocketData.result ? Object.keys(webSocketData.result) : []
            })
            
            if (webSocketData.status === 'completed') {
              // Mark as completed if we have any result data
              if (webSocketData.result) {
                status = 'completed'
                showViewResults = true
                console.log(`✅ Job ${pendingJob.realJobId} completed with results:`, webSocketData.result)
              } else {
                // Job says completed but no results yet - keep processing status
                status = 'processing'
                console.log(`⚠️ Job ${pendingJob.realJobId} claims completed but no results yet:`, webSocketData)
              }
            } else if (webSocketData.status === 'failed') {
              status = 'failed'
            } else if (webSocketData.status === 'processing' || webSocketData.status === 'transcribing' || webSocketData.status === 'analyzing') {
              status = 'processing'
            } else if (webSocketData.progress !== undefined && webSocketData.progress >= 0) {
              // If we have progress data, the job is processing
              status = 'processing'
            }
          } else if (realJob && pendingJob.realJobId) {
            // Fallback to BullMQ job status if no WebSocket data, but only for jobs that have actually started processing
            const realJobStatus = getJobStatus(realJob)
            // Only override waiting status if the job has actually started processing (has processedOn timestamp)
            if (realJob.processedOn && (realJobStatus === 'processing' || realJobStatus === 'failed')) {
              status = realJobStatus
            } else if (realJob.processedOn && realJobStatus === 'completed') {
              // For completed jobs, check if we have actual results
              if (realJob.returnvalue && (realJob.returnvalue.segments || realJob.returnvalue.transcript)) {
                status = 'completed'
                showViewResults = true
              } else {
                // BullMQ says completed but no results - probably still processing LLM segments
                status = 'analyzing' // Special status for post-completion LLM processing
                console.log(`⚠️ BullMQ job ${realJob.id} completed but no results:`, realJob.returnvalue)
              }
            }
          }
          
          // Additional debugging for status determination
          console.log(`📋 Pending job ${tempId}:`, {
            status,
            realJobId: pendingJob.realJobId,
            hasWebSocketData: !!webSocketData,
            hasRealJob: !!realJob,
            realJobProcessedOn: realJob?.processedOn,
            webSocketStatus: webSocketData?.status,
            webSocketProgress: webSocketData?.progress
          })
          
          if (webSocketData) {
            console.log(`🔍 WebSocket data for ${tempId}:`, webSocketData)
          } else if (realJob) {
            console.log(`🔍 Real job fallback for ${tempId}:`, {
              processedOn: realJob.processedOn,
              finishedOn: realJob.finishedOn,
              failedReason: realJob.failedReason,
              jobStatus: getJobStatus(realJob)
            })
          } else {
            console.log(`🔍 No data sources for ${tempId}, realJobId: ${pendingJob.realJobId}`)
          }
          
          return (
            <Card key={tempId}>
              <CardContent className="py-4">
                <div className="flex gap-4">
                  {/* Video Thumbnail */}
                  <div className="flex-shrink-0">
                    <VideoThumbnail file={pendingJob.file} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-4">
                    {/* Header with title, badge, and buttons */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{fileName}</h4>
                          <Badge className={getStatusColor(status)}>
                        {status === 'uploading' && (
                          <>Uploading<span className="ml-1">
                            <span className="animate-bounce inline-block" style={{animationDelay: '0ms'}}>.</span>
                            <span className="animate-bounce inline-block" style={{animationDelay: '150ms'}}>.</span>
                            <span className="animate-bounce inline-block" style={{animationDelay: '300ms'}}>.</span>
                          </span></>
                        )}
                        {status === 'waiting' && (
                          <>Queued<span className="ml-1">
                            <span className="animate-bounce inline-block" style={{animationDelay: '0ms'}}>.</span>
                            <span className="animate-bounce inline-block" style={{animationDelay: '150ms'}}>.</span>
                            <span className="animate-bounce inline-block" style={{animationDelay: '300ms'}}>.</span>
                          </span></>
                        )}
                        {status === 'processing' && (
                          <>
                            {webSocketData?.progress !== undefined ? (
                              <>
                                {webSocketData.progress === 0 && <>Initializing</>}
                                {webSocketData.progress === 10 && <>Transcribing</>}
                                {webSocketData.progress > 10 && webSocketData.progress < 60 && <>Transcribing</>}
                                {webSocketData.progress >= 60 && webSocketData.progress < 90 && <>Analyzing</>}
                                {webSocketData.progress >= 90 && webSocketData.progress < 100 && <>Segmenting</>}
                              </>
                            ) : (
                              <>Processing</>
                            )}
                            <span className="ml-1">
                              <span className="animate-bounce inline-block" style={{animationDelay: '0ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '150ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '300ms'}}>.</span>
                            </span>
                          </>
                        )}
                        {status === 'analyzing' && (
                          <>Analyzing<span className="ml-1">
                            <span className="animate-bounce inline-block" style={{animationDelay: '0ms'}}>.</span>
                            <span className="animate-bounce inline-block" style={{animationDelay: '150ms'}}>.</span>
                            <span className="animate-bounce inline-block" style={{animationDelay: '300ms'}}>.</span>
                          </span></>
                        )}
                        {status === 'completed' && 'Completed'}
                        {status === 'failed' && 'Failed'}
                      </Badge>
                    </div>
                    
                    {/* Only show details when completed */}
                    {status === 'completed' && (
                      <div className="text-sm text-muted-foreground">
                        <div>File size: {(fileSize / 1024 / 1024).toFixed(2)} MB</div>
                        {pendingJob.realJobId && <div>Job ID: {pendingJob.realJobId}</div>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Debug: Log button condition status */}
                    {(() => {
                      console.log(`🔍 Button check for ${tempId}: status=${status}, showViewResults=${showViewResults}, onViewProject=${!!onViewProject}, hasWebSocketData=${!!webSocketData}, hasResult=${!!webSocketData?.result}`)
                      return null
                    })()}
                    
                    {/* Show View Results immediately when WebSocket confirms completion with data */}
                    {status === 'completed' && showViewResults && onViewProject && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={async () => {
                          console.log('🚀 Pending job View Results clicked (WebSocket):', tempId)
                          
                          // Get fresh WebSocket data from ref (not state) to avoid stale closure
                          const currentWebSocketData = pendingJob.realJobId ? jobUpdatesRef.current.get(pendingJob.realJobId) : null
                          console.log('🔍 Current WebSocket data at click time (from ref):', currentWebSocketData)
                          
                          // Safety check: ensure webSocketData and result exist at click time
                          if (!currentWebSocketData || !currentWebSocketData.result) {
                            console.error('❌ WebSocket data missing at click time:', { currentWebSocketData, tempId, realJobId: pendingJob.realJobId })
                            toast.error('Result data not available. Please refresh the page.')
                            return
                          }
                          
                          try {
                            const projectId = currentWebSocketData.result.projectId || pendingJob.realJobId
                            // Construct a job-like object from WebSocket data
                            const jobData = {
                              id: pendingJob.realJobId,
                              returnvalue: currentWebSocketData.result,
                              data: {
                                fileName: fileName,
                                fileSize: fileSize,
                              }
                            }
                            
                            console.log('🚀 Calling onViewProject with:', { projectId, jobData })
                            await onViewProject(projectId, jobData)
                            console.log('✅ onViewProject completed successfully')
                          } catch (error) {
                            console.error('❌ Error in onViewProject:', error)
                            toast.error(`Failed to open project: ${error instanceof Error ? error.message : 'Unknown error'}`)
                          }
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Results
                      </Button>
                    )}
                    
                    {status !== 'uploading' && status !== 'processing' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (pendingJob.realJobId) {
                            handleDeleteJob(pendingJob.realJobId)
                          }
                          // Also remove from pending jobs
                          setPendingJobs(prev => {
                            const newMap = new Map(prev)
                            newMap.delete(tempId)
                            return newMap
                          })
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {/* Full-width Progress Bar Section */}
                {(status === 'uploading' || status === 'processing' || status === 'waiting' || status === 'analyzing') && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-600">
                        {status === 'uploading' && 'Uploading to server'}
                        {status === 'waiting' && 'Waiting in queue'}
                        {status === 'analyzing' && 'LLM analyzing content'}
                        {status === 'processing' && webSocketData?.progress !== undefined && (
                          <>
                            {webSocketData.progress === 0 && 'Initializing job'}
                            {webSocketData.progress === 10 && 'Transcribing audio'}
                            {webSocketData.progress > 10 && webSocketData.progress < 60 && 'Transcribing audio'}
                            {webSocketData.progress >= 60 && webSocketData.progress < 90 && 'Analyzing content'}
                            {webSocketData.progress >= 90 && webSocketData.progress < 100 && 'Creating segments'}
                          </>
                        )}
                        {status === 'processing' && webSocketData?.progress === undefined && 'Processing'}
                      </span>
                      {/* Show percentage for active processing */}
                      {status === 'processing' && webSocketData?.progress !== undefined && (
                        <span className="text-blue-600 font-semibold">
                          {Math.round(webSocketData.progress)}%
                        </span>
                      )}
                    </div>
                    <Progress 
                      value={status === 'uploading' ? 0 : 
                             status === 'analyzing' ? 0 : 
                             (webSocketData?.progress || 0)} 
                      className="w-full h-3 animate-pulse"
                    />
                    
                    {/* WebSocket Messages Only */}
                    {webSocketData?.message && (
                      <div className="text-sm">
                        <div className="text-gray-600 italic">{webSocketData.message}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Completion Status */}
                {status === 'completed' && webSocketData?.result && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>✅ Processing completed successfully</div>
                    <div>📊 Segments: {webSocketData.result.segmentCount || 'N/A'}</div>
                    <div>⏱️ Duration: {webSocketData.result.duration ? Math.round(webSocketData.result.duration) + 's' : 'N/A'}</div>
                  </div>
                )}
                
                {status === 'failed' && (
                  <div className="text-sm text-red-600">
                    ❌ Processing failed: {webSocketData?.error || 'Unknown error'}
                  </div>
                )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Render real jobs that don't have pending counterparts */}
        {(() => {
          const pendingRealJobIds = new Set(Array.from(pendingJobs.values()).map(p => p.realJobId).filter(Boolean))
          return jobs.filter(job => !pendingRealJobIds.has(job.id)).map((job) => {
            console.log('📋 Rendering real job card:', job.id, job.data?.fileName)
            const status = getJobStatus(job)
            const progress = getJobProgress(job)
            const update = jobUpdates.get(job.id)
            const fileName = job.data?.fileName || job.name || 'Unknown'
            
            return (
              <Card key={job.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{fileName}</h4>
                        <Badge className={getStatusColor(status)}>
                          {status === 'processing' && (
                            <>Processing<span className="ml-1">
                              <span className="animate-bounce inline-block" style={{animationDelay: '0ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '150ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '300ms'}}>.</span>
                            </span></>
                          )}
                          {status === 'analyzing' && (
                            <>Analyzing<span className="ml-1">
                              <span className="animate-bounce inline-block" style={{animationDelay: '0ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '150ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '300ms'}}>.</span>
                            </span></>
                          )}
                          {status === 'waiting' && (
                            <>Queued<span className="ml-1">
                              <span className="animate-bounce inline-block" style={{animationDelay: '0ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '150ms'}}>.</span>
                              <span className="animate-bounce inline-block" style={{animationDelay: '300ms'}}>.</span>
                            </span></>
                          )}
                          {status === 'completed' && 'Completed'}
                          {status === 'failed' && 'Failed'}
                        </Badge>
                      </div>
                      






                      {/* Only show detailed info when completed or failed */}
                      {(status === 'completed' || status === 'failed') && (
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Job ID: {job.id}</div>
                          <div>Created: {new Date(job.timestamp).toLocaleString()}</div>
                          {job.processedOn && (
                            <div>Started: {new Date(job.processedOn).toLocaleString()}</div>
                          )}
                          {job.finishedOn && (
                            <div>
                              Completed: {new Date(job.finishedOn).toLocaleString()} 
                              ({formatDuration(job.finishedOn - (job.processedOn || job.timestamp))})
                            </div>
                          )}
                          {job.failedReason && (
                            <div className="text-red-600">Error: {job.failedReason}</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Debug: Log job details for button condition */}
                      {(() => {
                        console.log(`📋 Real job ${job.id}: status=${status}, hasReturnValue=${!!job.returnvalue}, onViewProject=${!!onViewProject}`)
                        console.log(`📋 Full job object:`, job)
                        return null
                      })()}
                      
                      {status === 'completed' && (job.returnvalue || job.data) && onViewProject && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            console.log('🔍 Real job View Results clicked:', job)
                            // Use returnvalue first, fallback to data if available
                            const projectId = job.returnvalue?.projectId || job.data?.projectId || job.id
                            onViewProject(projectId, job)
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Results
                        </Button>
                      )}
                      
                      {status === 'analyzing' && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-purple-600 italic flex items-center">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-2"></div>
                            LLM analyzing content for segments...
                          </div>
                          {(() => {
                            const finishedAge = job.finishedOn ? Date.now() - job.finishedOn : 0
                            return finishedAge > 2 * 60 * 1000 && ( // Show after 2 minutes
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  console.log('🔧 Force completing job:', job)
                                  console.log('🔧 job.data:', JSON.stringify(job.data, null, 2))
                                  console.log('🔧 job.returnvalue:', JSON.stringify(job.returnvalue, null, 2))
                                  
                                  // Try multiple API endpoints to find the results
                                  const endpoints = [
                                    `/api/projects/${job.id}`,
                                    `/api/jobs/${job.id}/result`,
                                    `/api/results/${job.id}`,
                                    `/api/transcripts/${job.id}`
                                  ]
                                  
                                  let foundData = null
                                  
                                  for (const endpoint of endpoints) {
                                    try {
                                      console.log(`🔧 Trying endpoint: ${endpoint}`)
                                      const response = await fetch(`http://localhost:8080${endpoint}`)
                                      if (response.ok) {
                                        const data = await response.json()
                                        console.log(`🔧 Data from ${endpoint}:`, JSON.stringify(data, null, 2))
                                        
                                        // Check if this looks like valid project data
                                        if (data && (data.segments || data.transcript || (data.length > 0 && data[0].segments))) {
                                          foundData = Array.isArray(data) ? data[0] : data
                                          console.log(`🎉 Found valid project data at ${endpoint}!`)
                                          break
                                        }
                                      } else {
                                        console.log(`🔧 ${endpoint} returned ${response.status}`)
                                      }
                                    } catch (error) {
                                      console.log(`🔧 Error with ${endpoint}:`, error)
                                    }
                                  }
                                  
                                  if (foundData) {
                                    // Found data somewhere - use it!
                                    if (onViewProject) {
                                      onViewProject(job.id, { ...job, returnvalue: foundData })
                                    }
                                    return
                                  }
                                  
                                  // Check if there are result files in the uploads directory
                                  try {
                                    console.log('🔧 Checking for result files...')
                                    const resultFiles = [
                                      `/api/files/${job.id}-transcript.json`,
                                      `/api/files/${job.id}-segments.json`,
                                      `/api/files/results/${job.id}.json`
                                    ]
                                    
                                    for (const fileEndpoint of resultFiles) {
                                      try {
                                        const fileResponse = await fetch(`http://localhost:8080${fileEndpoint}`)
                                        if (fileResponse.ok) {
                                          const fileData = await fileResponse.json()
                                          console.log(`🎉 Found result file ${fileEndpoint}:`, fileData)
                                          if (onViewProject) {
                                            onViewProject(job.id, { ...job, returnvalue: fileData })
                                          }
                                          return
                                        }
                                      } catch (e) {
                                        // File doesn't exist, continue
                                      }
                                    }
                                  } catch (error) {
                                    console.log('🔧 Error checking result files:', error)
                                  }
                                  
                                  // Fallback: Force view the job even without proper results
                                  if (onViewProject) {
                                    onViewProject(job.data?.projectId || job.id, job)
                                  }
                                }}
                                className="text-xs bg-blue-50 hover:bg-blue-100"
                              >
                                🔍 Debug View
                              </Button>
                            )
                          })()}
                          {(() => {
                            const finishedAge = job.finishedOn ? Date.now() - job.finishedOn : 0
                            return finishedAge > 30 * 1000 && ( // Show after 30 seconds
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  console.log('🔄 Refreshing job status:', job.id)
                                  // Force reload jobs to get fresh data
                                  await loadJobs()
                                }}
                                className="text-xs"
                              >
                                Refresh
                              </Button>
                            )
                          })()}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteJob(job.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        })()}

        {/* Show empty state if no jobs */}
        {jobs.length === 0 && pendingJobs.size === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No jobs in queue. Upload a video to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}