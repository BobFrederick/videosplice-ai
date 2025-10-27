// Module alias setup - MUST be first
import './moduleAlias'

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { spawn } from 'child_process'
import queueService from './services/queueService'
import wsService from './services/websocketService'
import { VideoJob, ProcessingOptions } from './types'

// Simple in-memory cache for completed jobs (since BullMQ removes them too quickly)
const completedJobsCache = new Map<string, any>()
const CACHE_RETENTION_MS = 10 * 60 * 1000 // Keep jobs for 10 minutes

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 8080
const WS_PORT = parseInt(process.env.WS_PORT || '8081')
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Middleware
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type']
}))

// Additional CORS headers for strict browsers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const jobId = req.body.jobId || uuidv4()
    const ext = path.extname(file.originalname)
    cb(null, `${jobId}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'))
    }
  }
})

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Serve video files for project viewing
app.get('/api/video/:jobId', (req, res) => {
  try {
    const { jobId } = req.params
    const videoPath = path.join(UPLOAD_DIR, `${jobId}.mp4`)
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      console.log(`❌ Video file not found: ${videoPath}`)
      return res.status(404).json({
        error: 'Video file not found',
        message: 'The video file may have been cleaned up or the job ID is invalid'
      })
    }
    
    console.log(`📺 Serving video file: ${jobId}.mp4`)
    
    // Get file stats for Content-Length
    const stat = fs.statSync(videoPath)
    const fileSize = stat.size
    
    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', fileSize.toString())
    
    // Stream the video file
    const videoStream = fs.createReadStream(videoPath)
    videoStream.pipe(res)
    
  } catch (error) {
    console.error('❌ Error serving video:', error)
    res.status(500).json({
      error: 'Failed to serve video',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Download trimmed segment
app.get('/api/segment/:jobId/:segmentId', async (req, res) => {
  try {
    const { jobId, segmentId } = req.params
    const { startTime, endTime, fileName } = req.query
    
    const videoPath = path.join(UPLOAD_DIR, `${jobId}.mp4`)
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      console.log(`❌ Video file not found: ${videoPath}`)
      return res.status(404).json({
        error: 'Video file not found',
        message: 'The video file may have been cleaned up or the job ID is invalid'
      })
    }

    if (!startTime || !endTime) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startTime and endTime are required'
      })
    }

    const start = parseFloat(startTime as string)
    const end = parseFloat(endTime as string)
    const duration = end - start

    console.log(`✂️ Trimming segment: ${jobId} (${start}s - ${end}s, duration: ${duration}s)`)

    // Set response headers for forced download
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || `segment_${segmentId}.mp4`}"`)
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')

    // Use ffmpeg to trim and stream the video
    // Using re-encoding for accurate trimming (codec copy can be inaccurate at keyframes)
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', start.toString(),
      '-t', duration.toString(),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-avoid_negative_ts', 'make_zero',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov', // Enable streaming
      'pipe:1' // Output to stdout
    ])

    ffmpeg.stdout.pipe(res)

    ffmpeg.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data}`)
    })

    ffmpeg.on('error', (error) => {
      console.error('❌ ffmpeg error:', error)
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to trim video',
          details: error.message
        })
      }
    })

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ ffmpeg exited with code ${code}`)
      } else {
        console.log(`✅ Segment trimmed successfully: ${segmentId}`)
      }
    })

  } catch (error) {
    console.error('❌ Error trimming segment:', error)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to trim segment',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
})

// Upload video and create job
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' })
    }

    const jobId = req.body.jobId || path.parse(req.file.filename).name
    const processingOptions: ProcessingOptions = {
      llmSettings: req.body.llmSettings ? JSON.parse(req.body.llmSettings) : {
        model: 'qwen2.5:7b',
        provider: 'local',
        localEndpoint: 'http://localhost:11434'
      },
      customTranscript: req.body.customTranscript
    }

    const videoJob: VideoJob = {
      id: jobId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: req.file.path,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hasCustomTranscript: !!req.body.customTranscript
    }

    // Add job to queue
    const job = await queueService.addVideoJob(videoJob, processingOptions)

    console.log(`📤 File uploaded: ${req.file.originalname} (${req.file.size} bytes)`)
    console.log(`🎯 Job created: ${jobId}`)

    res.json({
      success: true,
      jobId: jobId,
      message: 'Video uploaded and queued for processing',
      job: videoJob
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    res.status(500).json({
      error: 'Failed to upload video',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get job status
app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await queueService.getJob(jobId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue
    })

  } catch (error) {
    console.error('❌ Get job error:', error)
    res.status(500).json({
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const { status } = req.query
    const jobs = await queueService.getJobs(status as any)

    const jobList = jobs.map(job => {
      console.log(`🔍 DEBUG API: Job ${job.id} - returnvalue type:`, typeof job.returnvalue)
      console.log(`🔍 DEBUG API: Job ${job.id} - returnvalue exists:`, job.returnvalue ? 'YES' : 'NO')
      console.log(`🔍 DEBUG API: Job ${job.id} - finishedOn:`, job.finishedOn ? 'YES' : 'NO')
      
      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue
      }
    })

    // Add cached completed jobs that BullMQ has already removed
    const now = Date.now()
    const cachedJobs: any[] = []
    
    console.log(`🔍 DEBUG CACHE: Active jobs count: ${jobList.length}`)
    console.log(`🔍 DEBUG CACHE: Active job IDs:`, jobList.map(j => j.id))
    console.log(`🔍 DEBUG CACHE: Cached jobs count: ${completedJobsCache.size}`)
    console.log(`🔍 DEBUG CACHE: Cached job IDs:`, Array.from(completedJobsCache.keys()))
    
    for (const [jobId, cachedJob] of completedJobsCache.entries()) {
      const isInActiveList = jobList.find(j => j.id === jobId)
      console.log(`🔍 DEBUG CACHE: Job ${jobId} - inActiveList: ${!!isInActiveList}`)
      
      // Only include jobs that haven't expired and aren't already in the current job list
      if (now - cachedJob.cachedAt < CACHE_RETENTION_MS && !isInActiveList) {
        cachedJobs.push(cachedJob.jobData)
        console.log(`🔍 DEBUG CACHE: Adding cached job ${jobId}`)
      } else if (now - cachedJob.cachedAt >= CACHE_RETENTION_MS) {
        // Clean up expired jobs
        completedJobsCache.delete(jobId)
        console.log(`🔍 DEBUG CACHE: Expired cached job ${jobId}`)
      } else {
        console.log(`🔍 DEBUG CACHE: Skipping duplicate job ${jobId}`)
      }
    }

    console.log(`📋 Returning ${jobList.length} active jobs + ${cachedJobs.length} cached jobs`)
    res.json({ jobs: [...jobList, ...cachedJobs] })

  } catch (error) {
    console.error('❌ Get jobs error:', error)
    res.status(500).json({
      error: 'Failed to get jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Cache completed job data (called by frontend when job completes)
app.post('/api/jobs/:jobId/cache', async (req, res) => {
  try {
    const { jobId } = req.params
    const jobData = req.body

    // Store in cache with timestamp
    completedJobsCache.set(jobId, {
      jobData: {
        id: jobId,
        ...jobData,
        finishedOn: Date.now() // Ensure we have a completion time
      },
      cachedAt: Date.now()
    })

    console.log(`💾 Cached completed job: ${jobId}`)
    res.json({ success: true, message: 'Job cached successfully' })

  } catch (error) {
    console.error('❌ Cache job error:', error)
    res.status(500).json({
      error: 'Failed to cache job',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Delete job
app.delete('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await queueService.getJob(jobId)

    if (job && job.data.filePath) {
      // Remove file from disk
      try {
        fs.unlinkSync(job.data.filePath)
        console.log(`🗑️ Deleted file: ${job.data.filePath}`)
      } catch (err) {
        console.warn(`⚠️ Failed to delete file: ${job.data.filePath}`)
      }
    }

    await queueService.removeJob(jobId)
    res.json({ success: true, message: 'Job deleted' })

  } catch (error) {
    console.error('❌ Delete job error:', error)
    res.status(500).json({
      error: 'Failed to delete job',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get queue statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await queueService.getQueueStats()
    
    res.json({
      ...stats,
      connectedClients: wsService.getConnectedClients(),
      uptime: process.uptime()
    })

  } catch (error) {
    console.error('❌ Get stats error:', error)
    res.status(500).json({
      error: 'Failed to get statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: 'Maximum file size is 500MB'
      })
    }
  }

  console.error('❌ Server error:', error)
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  })
})

// Start servers
async function startServer() {
  try {
    // Initialize WebSocket service
    wsService.initialize(WS_PORT)

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Video processing server running on port ${PORT}`)
      console.log(`🌐 WebSocket server running on port ${WS_PORT}`)
      console.log(`📁 Upload directory: ${path.resolve(UPLOAD_DIR)}`)
    })

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down servers...')
      await queueService.close()
      wsService.close()
      process.exit(0)
    })

  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()