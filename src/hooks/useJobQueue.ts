import { useState, useCallback, useRef, useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'
import type { VideoJob, JobStatus } from '@/lib/types'

interface QueueState {
  jobs: VideoJob[]
  isProcessing: boolean
  currentJobId: string | null
}

type JobProcessor = (job: VideoJob) => Promise<void>

export function useJobQueue() {
  const [jobs, setJobs] = useLocalStorage<VideoJob[]>('video-jobs', [])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  
  // Use ref to store processor to avoid stale closures
  const processorRef = useRef<JobProcessor | null>(null)
  const processingRef = useRef(false)

  // Add job to queue
  const addJob = useCallback((job: VideoJob) => {
    console.log('🎯 Adding job to queue:', job.id, job.status)
    setJobs(currentJobs => {
      const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
      const updatedJobs = [job, ...existingJobs]
      console.log('📝 Jobs after adding:', updatedJobs.length, updatedJobs.map(j => ({ id: j.id, status: j.status })))
      return updatedJobs
    })
  }, [setJobs])

  // Update job status
  const updateJobStatus = useCallback((jobId: string, updates: Partial<VideoJob>) => {
    console.log('🔄 Updating job status:', jobId, updates)
    
    // Read fresh data from localStorage to avoid stale closures during async operations
    const freshJobsFromStorage = (() => {
      try {
        const item = window.localStorage.getItem('video-jobs')
        return item ? JSON.parse(item) : []
      } catch (error) {
        console.warn('Error reading fresh jobs from localStorage:', error)
        return []
      }
    })()
    
    console.log('📋 Fresh jobs from localStorage before update:', freshJobsFromStorage.length, freshJobsFromStorage.map((j: VideoJob) => ({ id: j.id, status: j.status })))
    
    setJobs(currentJobs => {
      // Use fresh data from localStorage instead of potentially stale React state
      const existingJobs = Array.isArray(freshJobsFromStorage) ? freshJobsFromStorage : []
      console.log('📋 Using fresh jobs for update:', existingJobs.length, existingJobs.map(j => ({ id: j.id, status: j.status })))
      
      const updatedJobs = existingJobs.map(job => 
        job.id === jobId ? { ...job, ...updates, updatedAt: Date.now() } : job
      )
      
      console.log('📋 Jobs after update:', updatedJobs.length, updatedJobs.map(j => ({ id: j.id, status: j.status })))
      return updatedJobs
    })
  }, [setJobs])

  // Remove job from queue
  const removeJob = useCallback((jobId: string) => {
    console.log('🗑️ Removing job from queue:', jobId)
    setJobs(currentJobs => {
      const existingJobs = Array.isArray(currentJobs) ? currentJobs : []
      return existingJobs.filter(job => job.id !== jobId)
    })
  }, [setJobs])

  // Track last processed job to prevent immediate reprocessing
  const lastProcessedJobRef = useRef<string | null>(null)

  // Process next job in queue
  const processNextJob = useCallback(() => {
    console.log('🔍 Processing next job...')
    
    if (processingRef.current || !processorRef.current) {
      console.log('🔒 Queue processing blocked:', { processingRef: processingRef.current, hasProcessor: !!processorRef.current })
      return
    }

    const currentJobs = Array.isArray(jobs) ? jobs : []
    
    // Only get jobs that are explicitly queued and not the last processed job
    const queuedJob = currentJobs.find(job => 
      job.status === 'queued' && job.id !== lastProcessedJobRef.current
    )
    
    console.log('🔎 Looking for queued jobs. Found:', !!queuedJob)
    console.log('📊 Job statuses:', currentJobs.map(j => ({ id: j.id, status: j.status })))
    console.log('🚫 Last processed job (excluded):', lastProcessedJobRef.current)
    
    if (!queuedJob) {
      console.log('📭 No queued jobs to process')
      setIsProcessing(false)
      setCurrentJobId(null)
      lastProcessedJobRef.current = null // Reset when no jobs to process
      return
    }

    console.log('⚡ Starting to process job:', queuedJob.id)
    lastProcessedJobRef.current = queuedJob.id // Track this job to prevent immediate reprocessing
    processingRef.current = true
    setIsProcessing(true)
    setCurrentJobId(queuedJob.id)

    const processJobAsync = async () => {
      try {
        // Update job to processing status
        updateJobStatus(queuedJob.id, { status: 'processing' })
        
        // Process the job using the registered processor
        await processorRef.current!(queuedJob)
        
        console.log('✅ Job processing completed:', queuedJob.id)
      } catch (error) {
        console.error('❌ Job processing failed:', queuedJob.id, error)
        updateJobStatus(queuedJob.id, { 
          status: 'failed', 
          errorMessage: error instanceof Error ? error.message : 'Unknown error' 
        })
      } finally {
        processingRef.current = false
        setIsProcessing(false)
        setCurrentJobId(null)
        
        // Process next job after a delay to allow state updates
        setTimeout(() => {
          console.log('⏳ Checking for next job after delay')
          processNextJob()
        }, 2000) // Increased delay to allow React state to update
      }
    }

    processJobAsync()
  }, [jobs, updateJobStatus])

  // Register job processor
  const setJobProcessor = useCallback((processor: JobProcessor) => {
    processorRef.current = processor
  }, [])

  // Start queue processing (call this when jobs are added)
  const startProcessing = useCallback(() => {
    console.log('🚀 Start processing called:', { isProcessing: processingRef.current, hasProcessor: !!processorRef.current })
    if (!processingRef.current) {
      console.log('✅ Starting queue processing')
      processNextJob()
    } else {
      console.log('⏸️ Already processing, skipping')
    }
  }, [processNextJob])

  // Reset stuck jobs (jobs that have been processing for more than 1 minute)
  const resetStuckJobs = useCallback(() => {
    console.log('🔍 Checking for stuck jobs...')
    const now = Date.now()
    const stuckTimeout = 1 * 60 * 1000 // 1 minute for faster recovery
    
    setJobs(currentJobs => {
      const stuckCheckJobs = Array.isArray(currentJobs) ? currentJobs : []
      let hasStuckJobs = false
      
      const updatedJobs = stuckCheckJobs.map(job => {
        const isStuck = ['processing', 'transcribing', 'analyzing'].includes(job.status) &&
                       (now - (job.updatedAt || job.createdAt)) > stuckTimeout
        
        if (isStuck) {
          console.log('🚨 Found stuck job, resetting:', job.id, job.status)
          hasStuckJobs = true
          return { ...job, status: 'queued' as JobStatus, updatedAt: now }
        }
        return job
      })
      
      if (hasStuckJobs) {
        console.log('🔄 Reset stuck jobs, restarting processing...')
        setTimeout(() => {
          processingRef.current = false
          setIsProcessing(false)
          setCurrentJobId(null)
          startProcessing()
        }, 1000)
      }
      
      return updatedJobs
    })
  }, [setJobs, startProcessing])

  // Effect to auto-start processing when queued jobs exist
  useEffect(() => {
    const currentJobsArray = Array.isArray(jobs) ? jobs : []
    const hasQueuedJobs = currentJobsArray.some(job => job.status === 'queued')
    
    if (hasQueuedJobs && !processingRef.current && processorRef.current) {
      startProcessing()
    }
  }, [jobs, startProcessing])

  // Effect to periodically check for stuck jobs
  useEffect(() => {
    const interval = setInterval(resetStuckJobs, 10000) // Check every 10 seconds for faster recovery
    return () => clearInterval(interval)
  }, [resetStuckJobs])

  // Get filtered job lists
  const jobsArray = Array.isArray(jobs) ? jobs : []
  const activeJobs = jobsArray.filter(job => 
    ['queued', 'processing', 'transcribing', 'analyzing'].includes(job.status)
  )
  const completedJobs = jobsArray.filter(job => job.status === 'completed')
  const failedJobs = jobsArray.filter(job => job.status === 'failed')

  return {
    // State
    jobs: jobsArray,
    isProcessing,
    currentJobId,
    
    // Filtered lists
    activeJobs,
    completedJobs,
    failedJobs,
    
    // Actions
    addJob,
    updateJobStatus,
    removeJob,
    setJobProcessor,
    startProcessing,
    resetStuckJobs,
  }
}