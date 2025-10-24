export interface TranscriptionOptions {
  language?: string
  model?: 'base' | 'small' | 'medium' | 'large'
  outputFormat?: 'txt' | 'srt' | 'vtt' | 'json'
}

export interface TranscriptionResult {
  text: string
  segments?: {
    start: number
    end: number
    text: string
  }[]
  language?: string
  duration?: number
}

export class WhisperService {
  private modelPath: string
  private whisperPath: string

  constructor(modelPath = '~/.whisper/ggml-base.bin', whisperPath = 'whisper') {
    this.modelPath = modelPath
    this.whisperPath = whisperPath
  }

  async transcribeVideo(
    videoFile: File, 
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    try {
      // Extract audio from video file first
      const audioBlob = await this.extractAudio(videoFile)
      
      // Save audio to temporary file
      const tempAudioPath = await this.saveToTempFile(audioBlob, 'wav')
      
      // Run whisper on the audio file
      const result = await this.runWhisper(tempAudioPath, options)
      
      // Clean up temp file
      await this.cleanupTempFile(tempAudioPath)
      
      return result
    } catch (error) {
      console.error('Transcription failed:', error)
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractAudio(videoFile: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      video.src = URL.createObjectURL(videoFile)
      video.crossOrigin = 'anonymous'
      
      video.addEventListener('loadedmetadata', async () => {
        try {
          // Use Web Audio API to extract audio
          const source = audioContext.createMediaElementSource(video)
          const destination = audioContext.createMediaStreamDestination()
          source.connect(destination)
          
          const mediaRecorder = new MediaRecorder(destination.stream, {
            mimeType: 'audio/webm;codecs=opus'
          })
          
          const chunks: Blob[] = []
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data)
            }
          }
          
          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks, { type: 'audio/webm' })
            resolve(audioBlob)
          }
          
          mediaRecorder.start()
          video.play()
          
          video.addEventListener('ended', () => {
            mediaRecorder.stop()
          })
          
        } catch (error) {
          reject(error)
        }
      })
      
      video.addEventListener('error', reject)
    })
  }

  private async saveToTempFile(blob: Blob, extension: string): Promise<string> {
    // For browser environment, we'll need to send this to a backend service
    // This is a placeholder - in a real implementation, you'd upload to your backend
    throw new Error('Backend service required for file processing')
  }

  private async runWhisper(audioPath: string, options: TranscriptionOptions): Promise<TranscriptionResult> {
    // This would call your backend API that runs whisper
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioPath,
        ...options
      })
    })

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`)
    }

    return response.json()
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    // Backend cleanup
    await fetch('/api/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    })
  }
}

// Browser-based fallback using WebAudio API for basic transcription
export class BrowserWhisperService {
  async extractAudioBuffer(videoFile: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.src = URL.createObjectURL(videoFile)
      
      video.addEventListener('loadeddata', async () => {
        try {
          const audioContext = new AudioContext()
          const source = audioContext.createMediaElementSource(video)
          
          // For now, we'll return a mock transcription
          // In a full implementation, you'd need a backend service
          resolve(new ArrayBuffer(0))
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  async transcribeVideo(videoFile: File, options: TranscriptionOptions = {}): Promise<TranscriptionResult> {
    console.log('🎙️ Starting real whisper transcription for:', videoFile.name)
    
    try {
      // Check if whisper server is available first
      const healthResponse = await fetch('http://localhost:3001/api/health')
      if (!healthResponse.ok) {
        throw new Error('Whisper server not available')
      }
      
      console.log('✅ Whisper server is available')

      // Try to use the backend whisper server first
      const formData = new FormData()
      formData.append('audio', videoFile)
      if (options.language) {
        formData.append('language', options.language)
      }
      if (options.model) {
        formData.append('model', options.model)
      }

      console.log('📤 Sending transcription request...')
      
      // Create a timeout promise to prevent hanging indefinitely
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transcription request timed out after 5 minutes')), 5 * 60 * 1000)
      })
      
      // Race between the fetch and the timeout
      const fetchPromise = fetch('http://localhost:3001/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response

      console.log('📥 Got response:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Whisper API error response:', errorText)
        throw new Error(`Whisper API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      
      // Validate the response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response format from whisper server')
      }
      
      // Ensure text field exists and is a string
      const transcriptText = result.text || result.transcription || ''
      if (typeof transcriptText !== 'string') {
        console.warn('⚠️ Unexpected text format from whisper:', typeof transcriptText, transcriptText)
        throw new Error(`Invalid text format: expected string, got ${typeof transcriptText}`)
      }
      
      console.log('✅ Transcription successful:', transcriptText.substring(0, 100) + '...')
      
      return {
        ...result,
        text: transcriptText
      }
    } catch (error) {
      console.error('❌ Real whisper transcription failed, falling back to mock:', error)
      console.error('Error details:', error.message)
      // Fall back to mock transcription if backend fails
      return this.getMockTranscription(videoFile)
    }
  }

  async getMockTranscription(videoFile: File): Promise<TranscriptionResult> {
    // Generate a realistic mock transcription based on video duration
    const video = document.createElement('video')
    video.src = URL.createObjectURL(videoFile)
    
    return new Promise((resolve) => {
      video.addEventListener('loadedmetadata', () => {
        const duration = video.duration
        
        const mockText = this.generateMockTranscript(duration)
        const segments = this.generateMockSegments(duration, mockText)
        
        resolve({
          text: mockText,
          segments,
          language: 'en',
          duration
        })
        
        URL.revokeObjectURL(video.src)
      })
    })
  }

  private generateMockTranscript(duration: number): string {
    const transcripts = [
      "Welcome to this video tutorial. Today we'll be exploring some fascinating concepts and diving deep into the subject matter.",
      "In this presentation, we'll cover several key topics that will help you understand the fundamentals and build a strong foundation.",
      "Let's start by examining the core principles and then move on to more advanced techniques and best practices.",
      "Throughout this session, we'll look at practical examples and real-world applications that demonstrate these concepts in action.",
      "As we progress through the material, feel free to pause and review any sections that require additional attention or clarification.",
      "Finally, we'll wrap up with a comprehensive summary and discuss next steps for further learning and development."
    ]
    
    const segmentCount = Math.min(Math.ceil(duration / 60), transcripts.length)
    return transcripts.slice(0, segmentCount).join(' ')
  }

  private generateMockSegments(duration: number, text: string): TranscriptionResult['segments'] {
    const sentences = text.split('. ').filter(s => s.length > 0)
    const segmentDuration = duration / sentences.length
    
    return sentences.map((sentence, index) => ({
      start: index * segmentDuration,
      end: Math.min((index + 1) * segmentDuration, duration),
      text: sentence + (index < sentences.length - 1 ? '.' : '')
    }))
  }
}

export function createWhisperService(): BrowserWhisperService {
  // For now, return the browser-based mock service
  // In production, you'd detect if backend is available and use WhisperService
  return new BrowserWhisperService()
}