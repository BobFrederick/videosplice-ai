import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import fs from 'fs'
import path from 'path'
import { VideoJob, ProcessingOptions } from '../types'
import wsService from '../services/websocketService'

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
        maxStalledCount: 1,
        stalledInterval: 30000,
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
    const { id, fileName, filePath, llmSettings, customTranscript } = job.data
    
    try {
      console.log(`🎬 Starting video processing: ${id} (${fileName})`)
      
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
        message: 'Transcribing audio...'
      })

      const transcriptionResult = await this.transcribeVideo(filePath, customTranscript)
      
      console.log(`🔍 DEBUG: Transcription completed for job ${id}:`, {
        transcriptLength: transcriptionResult.transcript?.length || 0,
        segmentCount: transcriptionResult.segments?.length || 0,
        duration: transcriptionResult.duration
      })
      
      await job.updateProgress(50)
      wsService.sendJobUpdate(id, {
        status: 'transcribing',
        progress: 50,
        message: 'Transcription completed'
      })

      // Step 2: LLM Analysis (50-90%)
      await job.updateProgress(60)
      wsService.sendJobUpdate(id, {
        status: 'analyzing',
        progress: 60,
        message: 'Analyzing content with LLM...'
      })

      const segmentationResult = await this.generateSegments(
        transcriptionResult.transcript,
        transcriptionResult.segments,
        transcriptionResult.duration,
        fileName,
        llmSettings.customPrompt
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

  private async transcribeVideo(filePath: string, customTranscript?: string): Promise<{
    transcript: string
    segments: any[]
    duration: number
  }> {
    if (customTranscript) {
      // Use custom transcript
      return {
        transcript: customTranscript,
        segments: [],
        duration: 0 // Will be determined later
      }
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Video file not found: ${filePath}`)
    }

    // Create form data for file upload using Node.js native FormData and Blob
    const fileBuffer = fs.readFileSync(filePath)
    const fileBlob = new Blob([fileBuffer], { type: 'video/mp4' })
    
    const formData = new FormData()
    formData.append('audio', fileBlob, path.basename(filePath))
    formData.append('language', 'en')
    formData.append('model', 'base')
    formData.append('outputFormat', 'json')

    // Call Whisper service with correct endpoint
    const response = await fetch('http://localhost:3001/api/transcribe', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Whisper transcription failed: ${response.statusText}`)
    }

    const result = await response.json() as { 
      text: string
      segments: any[]
      duration: number
    }
    
    return {
      transcript: result.text || result.segments?.map((s: any) => s.text).join(' ').trim() || '',
      segments: result.segments || [],
      duration: result.duration || (result.segments && result.segments.length > 0 ? Math.max(...result.segments.map((s: any) => s.end || 0)) : 0)
    }
  }

  private async generateSegments(
    transcript: string,
    whisperSegments: any[],
    duration: number,
    fileName?: string,
    customPrompt?: string
  ): Promise<{ segments: any[]; reasoning?: string }> {
    
    // Call LLM segmentation service
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: this.createSegmentationPrompt(transcript, whisperSegments, duration, fileName, customPrompt),
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 2000
        }
      })
    })

    if (!response.ok) {
      throw new Error(`LLM segmentation failed: ${response.statusText}`)
    }

    const result = await response.json() as { response: string }
    return this.parseSegmentationResponse(result.response, whisperSegments, duration)
  }

  private createSegmentationPrompt(
    transcript: string,
    whisperSegments: any[],
    duration: number,
    fileName?: string,
    customPrompt?: string
  ): string {
    if (customPrompt) {
      return customPrompt
        .replace(/{transcript}/g, transcript)
        .replace(/{duration}/g, duration.toString())
        .replace(/{whisperSegments}/g, JSON.stringify(whisperSegments, null, 2))
    }

    return `You are an expert video content analyzer. Analyze this transcript and create logical segments.

**Video Information:**
- File: ${fileName || 'Unknown'}
- Duration: ${Math.floor(duration / 60)}m ${duration % 60}s
- Total Whisper Segments: ${whisperSegments.length}

**Full Transcript:**
${transcript}

**Whisper Timing Segments:**
${whisperSegments.map((seg, i) => `[${i}] ${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s: "${seg.text}"`).join('\n')}

Create 4-8 logical segments with descriptive titles and descriptions. Respond with JSON only:

{
  "segments": [
    {
      "id": "seg-1",
      "title": "Descriptive title",
      "description": "What happens in this segment",
      "whisperSegmentStart": 0,
      "whisperSegmentEnd": 5
    }
  ],
  "reasoning": "Brief explanation"
}`
  }

  private parseSegmentationResponse(
    response: string,
    whisperSegments: any[],
    duration: number
  ): { segments: any[]; reasoning?: string } {
    try {
      console.log(`🔍 DEBUG: Raw LLM response length:`, response.length)
      console.log(`🔍 DEBUG: Raw LLM response preview:`, response.substring(0, 500) + '...')
      
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response')
      }

      console.log(`🔍 DEBUG: Extracted JSON:`, jsonMatch[0].substring(0, 500) + '...')
      const parsed = JSON.parse(jsonMatch[0])
      console.log(`🔍 DEBUG: Parsed LLM segments count:`, parsed.segments?.length || 0)
      
      const segments = parsed.segments.map((seg: any, index: number) => {
        let startTime: number
        let endTime: number
        
        console.log(`🔍 DEBUG: LLM segment ${index}: whisperStart=${seg.whisperSegmentStart}, whisperEnd=${seg.whisperSegmentEnd}`)
        
        // Handle both whisper segment indices AND direct time values
        if (seg.whisperSegmentStart !== undefined && seg.whisperSegmentEnd !== undefined) {
          // Use whisper segment indices
          const startIdx = Math.max(0, seg.whisperSegmentStart || 0)
          const endIdx = Math.min(whisperSegments.length - 1, seg.whisperSegmentEnd || 0)
          
          console.log(`🔍 DEBUG: Mapping indices ${startIdx}-${endIdx} to whisper segments`)
          console.log(`🔍 DEBUG: Whisper[${startIdx}]: ${whisperSegments[startIdx]?.start}s-${whisperSegments[startIdx]?.end}s`)
          console.log(`🔍 DEBUG: Whisper[${endIdx}]: ${whisperSegments[endIdx]?.start}s-${whisperSegments[endIdx]?.end}s`)
          
          startTime = whisperSegments[startIdx]?.start || 0
          endTime = whisperSegments[endIdx]?.end || 0
        } else if (seg.startTime !== undefined && seg.endTime !== undefined) {
          // Use direct time values
          startTime = seg.startTime
          endTime = seg.endTime
        } else {
          // Fallback to equal distribution
          const segmentDuration = duration / parsed.segments.length
          startTime = index * segmentDuration
          endTime = (index + 1) * segmentDuration
        }
        
        const isLastSegment = index === parsed.segments.length - 1
        
        return {
          id: `seg-${index + 1}`,
          title: seg.title || `Segment ${index + 1}`,
          description: seg.description || '',
          startTime: Math.floor(startTime),
          endTime: isLastSegment ? Math.ceil(duration) : Math.floor(endTime)
        }
      })

      return {
        segments: this.validateAndFixSegments(segments),
        reasoning: parsed.reasoning
      }
    } catch (error) {
      console.error('Failed to parse LLM response:', error)
      throw error
    }
  }

  private validateAndFixSegments(segments: any[]): any[] {
    const MIN_DURATION = 10 // 10 seconds minimum
    
    console.log(`🔍 DEBUG: Input segments for validation:`, segments.length)
    segments.forEach((seg, i) => {
      const duration = seg.endTime - seg.startTime
      console.log(`🔍 DEBUG: Segment ${i}: "${seg.title}" (${seg.startTime}s-${seg.endTime}s, duration: ${duration}s)`)
    })
    
    // Sort and validate segments
    const validSegments = segments
      .sort((a, b) => a.startTime - b.startTime)
      .filter(seg => {
        const duration = seg.endTime - seg.startTime
        const isValid = duration >= MIN_DURATION
        if (!isValid) {
          console.log(`🚫 DEBUG: Filtering out short segment: "${seg.title}" (${duration}s < ${MIN_DURATION}s)`)
        }
        return isValid
      })
      
    console.log(`🔍 DEBUG: Valid segments after filtering:`, validSegments.length)

    // Fix gaps and overlaps
    for (let i = 0; i < validSegments.length - 1; i++) {
      const current = validSegments[i]
      const next = validSegments[i + 1]
      
      if (current.endTime > next.startTime) {
        current.endTime = next.startTime
      } else if (current.endTime < next.startTime) {
        current.endTime = next.startTime
      }
    }

    return validSegments
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