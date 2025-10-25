import Redis from 'ioredis'
import { Queue, Worker, Job } from 'bullmq'
import { VideoJob, ProcessingOptions } from '../types'

class QueueService {
  private redis: Redis
  private queue: Queue<VideoJob & ProcessingOptions>
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    })

    this.queue = new Queue('video-processing', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50, // Keep last 50 completed jobs for better debugging
        removeOnFail: 50,     // Keep last 50 failed jobs
        attempts: parseInt(process.env.MAX_RETRIES || '3'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.RETRY_DELAY || '5000'),
        },
        delay: 0, // Process immediately
      },
    })

    console.log('🔌 Queue service initialized')
  }

  async addVideoJob(
    jobData: VideoJob, 
    options: ProcessingOptions
  ): Promise<Job<VideoJob & ProcessingOptions>> {
    const job = await this.queue.add(
      'process-video',
      { ...jobData, ...options },
      {
        jobId: jobData.id,
        priority: jobData.fileSize > 200 * 1024 * 1024 ? 1 : 10, // Large files get lower priority
      }
    )

    console.log(`📋 Added job to queue: ${jobData.id} (${jobData.fileName})`)
    return job
  }

  async getJob(jobId: string): Promise<Job | null> {
    const job = await this.queue.getJob(jobId)
    return job || null
  }

  async getJobs(status?: 'waiting' | 'active' | 'completed' | 'failed'): Promise<Job[]> {
    if (!status) {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
      ])
      
      // Debug completed jobs to see if they have returnvalue
      if (completed.length > 0) {
        console.log(`🔍 DEBUG: Found ${completed.length} completed jobs`)
        completed.forEach(job => {
          console.log(`🔍 DEBUG: Job ${job.id} - returnvalue:`, job.returnvalue ? 'EXISTS' : 'UNDEFINED')
          if (job.returnvalue) {
            console.log(`🔍 DEBUG: Job ${job.id} - returnvalue preview:`, JSON.stringify({
              jobId: job.returnvalue.jobId || 'missing',
              segmentCount: job.returnvalue.segmentCount || 'missing',
              hasTranscript: !!job.returnvalue.transcript
            }))
          }
        })
      }
      
      return [...waiting, ...active, ...completed, ...failed]
    }
    
    switch (status) {
      case 'waiting': return this.queue.getWaiting()
      case 'active': return this.queue.getActive()
      case 'completed': return this.queue.getCompleted()
      case 'failed': return this.queue.getFailed()
      default: return []
    }
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId)
    if (job) {
      await job.remove()
      console.log(`🗑️ Removed job: ${jobId}`)
    }
  }

  async getQueueStats() {
    const waiting = await this.queue.getWaiting()
    const active = await this.queue.getActive()
    const completed = await this.queue.getCompleted()
    const failed = await this.queue.getFailed()

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
    }
  }

  getQueue() {
    return this.queue
  }

  async close() {
    await this.queue.close()
    await this.redis.quit()
  }
}

export const queueService = new QueueService()
export default queueService