// Module alias setup - MUST be first
import '../moduleAlias'

import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { VideoJob, ProcessingOptions } from '../types'
import wsService from '../services/websocketService'
import { generateIntelligentSegments } from '@shared/llmSegmentation'

// Import your existing processing logic (we'll adapt these)
// Note: These imports will need to be adapted from your frontend services
interface WhisperService {
  transcribeVideo(file: File): Promise<{ transcript: string; segments: any[] }>
}

interface LLMSegmentationService {
  generateIntelligentSegments(
    transcript: string,
    whisperSegments: any[],
    duration: number,
    fileName?: string,
    customPrompt?: string
  ): Promise<{ segments: any[]; reasoning?: string }>
}

class VideoProcessor {
  private worker: Worker
  private redis: Redis

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    })

    this.worker = new Worker(
      'video-processing',
      this.processJob.bind(this),
      {
        connection: this.redis,
        concurrency: 1, // Process one job at a time to protect GPU
        maxStalledCount: 3, // Allow more retries for stalled jobs
        stalledInterval: 300000, // Check for stalled jobs every 5 minutes (large-v3 needs time)
        lockDuration: 3600000, // Lock job for 60 minutes (large-v3 can be very slow)
      }
    )

    this.setupEventHandlers()
    console.log('🔧 Video processing worker initialized')
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job: Job) => {
      console.log(`✅ Job completed: ${job.id}`)
      console.log(`🔍 DEBUG: Job completion handler - returnvalue:`, job.returnvalue ? 'EXISTS' : 'UNDEFINED')
      console.log(`🔍 DEBUG: Job completion handler - returnvalue type:`, typeof job.returnvalue)
      if (job.returnvalue) {
        console.log(`🔍 DEBUG: Job completion handler - returnvalue preview:`, JSON.stringify({
          jobId: job.returnvalue.jobId,
          segmentCount: job.returnvalue.segmentCount,
          hasTranscript: !!job.returnvalue.transcript
        }))
      }
      
      // Send completion update via WebSocket
      wsService.sendJobUpdate(job.id!, {
        status: 'completed',
        progress: 100,
        message: 'Video processing completed successfully',
        result: job.returnvalue
      })

      // Keep video file for project viewing - don't cleanup on success
      // this.cleanupJobFile(job.data.filePath) // Commented out to preserve video files
      console.log(`📁 Keeping video file for project viewing: ${job.data.filePath}`)
    })

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) {
        console.error(`❌ Job failed: ${job.id}`, err.message)
        
        // Send failure update via WebSocket
        wsService.sendJobUpdate(job.id!, {
          status: 'failed',
          progress: 0,
          message: 'Video processing failed',
          error: err.message
        })

        // Keep file for potential retry
        console.log(`📁 Keeping file for retry: ${job.data.filePath}`)
      }
    })

    this.worker.on('progress', (job: Job, progress: any) => {
      const progressValue = typeof progress === 'number' ? progress : progress.progress || 0
      console.log(`⏳ Job progress: ${job.id} - ${progressValue}%`)
      
      wsService.sendJobUpdate(job.id!, {
        status: 'processing',
        progress: progressValue,
        message: `Processing... ${progressValue}%`
      })
    })

    this.worker.on('error', (err: Error) => {
      console.error('❌ Worker error:', err)
    })

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`⚠️ Job stalled: ${jobId}`)
    })
  }

  private async processJob(job: Job<VideoJob & ProcessingOptions>): Promise<any> {
    const { id, fileName, filePath, llmSettings, customTranscript, vttFilePath } = job.data
    
    try {
      console.log(`🎬 Starting video processing: ${id} (${fileName})`)
      if (vttFilePath) {
        console.log(`📄 VTT file provided: ${vttFilePath} - Whisper transcription will be skipped`)
      }
      
      // Update job status
      await job.updateProgress(0)
      wsService.sendJobUpdate(id, {
        status: 'processing',
        progress: 0,
        message: 'Starting video processing...'
      })

      // Step 1: Transcription (0-50%)
      await job.updateProgress(10)
      wsService.sendJobUpdate(id, {
        status: 'transcribing',
        progress: 10,
        message: vttFilePath ? 'Reading VTT transcription...' : 'Transcribing audio with Whisper large-v3 (this may take 5-15 minutes)...'
      })

      const transcriptionResult = await this.transcribeVideo(filePath, customTranscript, vttFilePath)
      
      console.log(`🔍 DEBUG: Transcription completed for job ${id}:`, {
        transcriptLength: transcriptionResult.transcript?.length || 0,
        segmentCount: transcriptionResult.segments?.length || 0,
        duration: transcriptionResult.duration
      })
      
      await job.updateProgress(50)
      wsService.sendJobUpdate(id, {
        status: 'transcribing',
        progress: 50,
        message: 'Transcription completed successfully'
      })

      // Step 2: LLM Analysis (50-90%)
      await job.updateProgress(60)
      wsService.sendJobUpdate(id, {
        status: 'analyzing',
        progress: 60,
        message: 'Analyzing content with LLM...'
      })

      const segmentationResult = await generateIntelligentSegments(
        transcriptionResult.transcript,
        transcriptionResult.segments,
        transcriptionResult.duration,
        {
          customPrompt: llmSettings.customPrompt,
          fileName: fileName,
          ollamaEndpoint: 'http://localhost:11434',
          model: 'qwen2.5:7b',
          temperature: 0.3
        }
      )
      
      console.log(`🔍 DEBUG: Segmentation completed for job ${id}:`, {
        segmentCount: segmentationResult.segments?.length || 0,
        hasReasoning: !!segmentationResult.reasoning,
        firstSegment: segmentationResult.segments?.[0] || null
      })

      await job.updateProgress(90)
      
      try {
        // Step 3: Finalization (90-100%)
        const result = {
          jobId: id,
          fileName,
          duration: transcriptionResult.duration,
          transcript: transcriptionResult.transcript,
          whisperSegments: transcriptionResult.segments, // Include whisper segments for VTT generation
          segments: segmentationResult.segments,
          segmentCount: segmentationResult.segments.length,
          reasoning: segmentationResult.reasoning,
          completedAt: Date.now()
        }

        console.log(`🔍 DEBUG: Created result object for job ${id}:`, JSON.stringify({
          jobId: result.jobId,
          fileName: result.fileName,
          duration: result.duration,
          segmentCount: result.segmentCount,
          transcriptLength: result.transcript?.length || 0,
          hasSegments: !!result.segments && result.segments.length > 0,
          hasReasoning: !!result.reasoning
        }))

        await job.updateProgress(100)
        
        console.log(`🔍 DEBUG: About to return result for job ${id}`)
        console.log(`🎉 Video processing completed: ${id}`)
        
        // Send WebSocket update BEFORE returning to ensure clients get immediate notification
        // This is more reliable than waiting for the 'completed' event which may have timing issues
        console.log(`📡 Sending immediate completion WebSocket update for job ${id}`)
        wsService.sendJobUpdate(id, {
          status: 'completed',
          progress: 100,
          message: 'Video processing completed successfully',
          result: result
        })
        
        // Ensure we return the result properly
        console.log(`🔍 DEBUG: Returning result for job ${id}`)
        return result
        
      } catch (finalizationError) {
        console.error(`❌ Error during result finalization for job ${id}:`, finalizationError)
        throw finalizationError
      }

    } catch (error) {
      console.error(`❌ Video processing failed: ${id}`, error)
      throw error
    }
  }

  private async transcribeVideo(filePath: string, customTranscript?: string, vttFilePath?: string): Promise<{
    transcript: string
    segments: any[]
    duration: number
  }> {
    // If VTT file provided, parse it instead of using Whisper
    if (vttFilePath) {
      console.log(`📄 Parsing VTT file: ${vttFilePath}`)
      return this.parseVTTFile(vttFilePath)
    }
    
    if (customTranscript) {
      // Use custom transcript
      return {
        transcript: customTranscript,
        segments: [],
        duration: 0 // Will be determined later
      }
    }

    // Resolve to absolute path - handle both relative and absolute paths
    // If path is relative (like "uploads/xxx.mp4"), resolve from project root
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(process.cwd(), '..', filePath) // Go up one level from server/ to project root
    
    console.log(`🔍 File path resolution:`)
    console.log(`   - Original: ${filePath}`)
    console.log(`   - Absolute: ${absolutePath}`)
    console.log(`   - CWD: ${process.cwd()}`)
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      // Try alternative path (in case we're already at project root)
      const alternativePath = path.resolve(process.cwd(), filePath)
      console.log(`   - Alternative: ${alternativePath}`)
      
      if (fs.existsSync(alternativePath)) {
        console.log(`✅ Found file at alternative path: ${alternativePath}`)
        filePath = alternativePath
      } else {
        throw new Error(`Video file not found. Tried:\n  - ${absolutePath}\n  - ${alternativePath}`)
      }
    } else {
      console.log(`✅ Found file at: ${absolutePath}`)
      filePath = absolutePath
    }

    // Create form data for file upload using Node.js native FormData and Blob
    const fileBuffer = fs.readFileSync(filePath)
    const fileBlob = new Blob([fileBuffer], { type: 'video/mp4' })
    
    const formData = new FormData()
    formData.append('audio', fileBlob, path.basename(filePath))
    formData.append('language', 'en')
    formData.append('model', 'large-v3')
    formData.append('outputFormat', 'json')

    // Call Whisper service with correct endpoint (use environment variable or default to 3001)
    const whisperUrl = process.env.WHISPER_API_URL || 'http://localhost:3001'
    console.log(`🎙️ Calling Whisper API at: ${whisperUrl}/api/transcribe`)
    
    try {
      // Use axios with explicit timeout for large file processing (30 minutes)
      const response = await axios.post(`${whisperUrl}/api/transcribe`, formData, {
        timeout: 30 * 60 * 1000, // 30 minutes for both request and response
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          'Connection': 'keep-alive'
        }
      })
    
      if (response.status !== 200) {
        throw new Error(`Whisper transcription failed: ${response.statusText}`)
      }
      
      const result = response.data as { 
        text: string
        segments: any[]
        duration: number
      }
      
      return {
        transcript: result.text || result.segments?.map((s: any) => s.text).join(' ').trim() || '',
        segments: result.segments || [],
        duration: result.duration || (result.segments && result.segments.length > 0 ? Math.max(...result.segments.map((s: any) => s.end || 0)) : 0)
      }
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Whisper transcription timeout (30 minutes)')
      }
      throw error
    }
  }

  private async parseVTTFile(vttFilePath: string): Promise<{
    transcript: string
    segments: any[]
    duration: number
  }> {
    try {
      console.log(`📄 Reading VTT file: ${vttFilePath}`)
      
      const vttContent = fs.readFileSync(vttFilePath, 'utf-8')
      const segments: any[] = []
      let transcript = ''
      let maxDuration = 0

      // Parse VTT format
      // Example:
      // WEBVTT
      //
      // 1
      // 00:00:00.000 --> 00:00:05.000
      // First subtitle text
      
      const lines = vttContent.split('\n')
      let currentSegment: { start: number; end: number; text: string } | null = null
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Skip WEBVTT header, empty lines, and NOTE sections
        if (line === '' || line.startsWith('WEBVTT') || line.startsWith('NOTE') || /^\d+$/.test(line)) {
          continue
        }
        
        // Parse timestamp line (00:00:00.000 --> 00:00:05.000)
        if (line.includes('-->')) {
          const [startStr, endStr] = line.split('-->').map(s => s.trim())
          const start = this.parseVTTTimestamp(startStr)
          const end = this.parseVTTTimestamp(endStr)
          
          currentSegment = { start, end, text: '' }
          maxDuration = Math.max(maxDuration, end)
          continue
        }
        
        // Parse subtitle text
        if (currentSegment && line !== '') {
          if (currentSegment.text !== '') {
            currentSegment.text += ' '
          }
          currentSegment.text += line
          
          // Check if next line is empty or another timestamp (end of this subtitle)
          const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''
          if (nextLine === '' || nextLine.includes('-->') || /^\d+$/.test(nextLine)) {
            // Segment complete
            segments.push({
              start: currentSegment.start,
              end: currentSegment.end,
              text: currentSegment.text.trim()
            })
            
            transcript += (transcript ? ' ' : '') + currentSegment.text.trim()
            currentSegment = null
          }
        }
      }
      
      // Add any remaining segment
      if (currentSegment && currentSegment.text) {
        segments.push({
          start: currentSegment.start,
          end: currentSegment.end,
          text: currentSegment.text.trim()
        })
        transcript += (transcript ? ' ' : '') + currentSegment.text.trim()
      }

      console.log(`✅ Parsed VTT file: ${segments.length} segments, ${transcript.length} chars, ${maxDuration}s duration`)
      
      return {
        transcript: transcript.trim(),
        segments,
        duration: maxDuration
      }
    } catch (error) {
      console.error(`❌ Failed to parse VTT file: ${vttFilePath}`, error)
      throw new Error(`Failed to parse VTT file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private parseVTTTimestamp(timestamp: string): number {
    // Parse timestamp format: HH:MM:SS.mmm or MM:SS.mmm
    const parts = timestamp.split(':')
    let hours = 0, minutes = 0, seconds = 0
    
    if (parts.length === 3) {
      // HH:MM:SS.mmm
      hours = parseInt(parts[0])
      minutes = parseInt(parts[1])
      seconds = parseFloat(parts[2])
    } else if (parts.length === 2) {
      // MM:SS.mmm
      minutes = parseInt(parts[0])
      seconds = parseFloat(parts[1])
    } else {
      // SS.mmm
      seconds = parseFloat(parts[0])
    }
    
    return hours * 3600 + minutes * 60 + seconds
  }

  private cleanupJobFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`🗑️ Cleaned up file: ${filePath}`)
      }
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup file: ${filePath}`, error)
    }
  }

  async close() {
    await this.worker.close()
    await this.redis.quit()
    console.log('🔧 Video processor worker closed')
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  console.log('🔧 Starting video processing worker...')
  
  const processor = new VideoProcessor()
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down worker...')
    await processor.close()
    process.exit(0)
  })
}