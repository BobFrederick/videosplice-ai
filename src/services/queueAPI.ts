import { VideoJob, JobStatus } from '../lib/types'

interface ProcessingOptions {
  llmSettings: {
    model: string
    provider: 'local' | 'openai'
    localEndpoint: string
    customPrompt?: string
  }
  customTranscript?: string
}

class QueueAPIService {
  private baseUrl = 'http://localhost:8080/api'
  private wsUrl = 'ws://localhost:8081'
  private ws: WebSocket | null = null
  private subscribers: Map<string, Set<(update: any) => void>> = new Map()

  constructor() {
    this.initWebSocket()
  }

  private initWebSocket() {
    try {
      console.log('🔌 Attempting to connect to WebSocket:', this.wsUrl)
      this.ws = new WebSocket(this.wsUrl)
      
      this.ws.onopen = () => {
        console.log('🔌 Connected to queue server WebSocket')
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket connection error:', error)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'job-update' && data.jobId) {
            const callbacks = this.subscribers.get(data.jobId)
            if (callbacks) {
              callbacks.forEach(callback => callback(data))
            }
          }
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason, 'attempting to reconnect...')
        setTimeout(() => this.initWebSocket(), 5000)
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
      }

    } catch (error) {
      console.error('❌ Failed to connect to WebSocket:', error)
      setTimeout(() => this.initWebSocket(), 5000)
    }
  }

  async uploadVideo(
    file: File, 
    options: ProcessingOptions,
    customTranscript?: string
  ): Promise<{ jobId: string; job: VideoJob }> {
    
    console.log('📤 queueAPI.uploadVideo starting...')
    console.log('📤 File:', file.name, file.size, 'bytes')
    console.log('📤 Options:', options)
    console.log('📤 CustomTranscript:', customTranscript ? 'provided' : 'none')
    
    const formData = new FormData()
    formData.append('video', file)
    formData.append('llmSettings', JSON.stringify(options.llmSettings))
    
    if (customTranscript) {
      formData.append('customTranscript', customTranscript)
    }

    console.log('📤 Sending request to:', `${this.baseUrl}/upload`)
    
    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: formData
    })

    console.log('📤 Response status:', response.status)
    console.log('📤 Response ok:', response.ok)

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Upload error response:', error)
      throw new Error(error.error || 'Failed to upload video')
    }

    const result = await response.json()
    console.log('✅ Upload success result:', result)
    return { jobId: result.jobId, job: result.job }
  }

  async getJob(jobId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to get job status')
    }

    return response.json()
  }

  async getAllJobs(): Promise<any[]> {
    try {
      console.log('🔍 Fetching jobs from:', `${this.baseUrl}/jobs`)
      
      const response = await fetch(`${this.baseUrl}/jobs`)
      console.log('🔍 Jobs response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`Failed to get jobs: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('🔍 Jobs result:', result)
      return result.jobs || []
    } catch (error) {
      console.error('❌ getAllJobs failed:', error)
      throw error
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete job')
    }
  }

  async getStats(): Promise<any> {
    try {
      console.log('🔍 Fetching stats from:', `${this.baseUrl}/stats`)
      
      const response = await fetch(`${this.baseUrl}/stats`)
      console.log('🔍 Stats response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`Failed to get stats: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('🔍 Stats result:', result)
      return result
    } catch (error) {
      console.error('❌ getStats failed:', error)
      throw error
    }
  }

  subscribeToJob(jobId: string, callback: (update: any) => void): () => void {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set())
      
      // Subscribe via WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          jobId
        }))
      }
    }

    const callbacks = this.subscribers.get(jobId)!
    callbacks.add(callback)

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback)
      
      if (callbacks.size === 0) {
        this.subscribers.delete(jobId)
        
        // Unsubscribe via WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'unsubscribe',
            jobId
          }))
        }
      }
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      console.log('🔍 Checking connection to:', `${this.baseUrl}/stats`)
      
      // Check HTTP API connection with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      console.log('🔍 Response status:', response.status, response.statusText)
      
      const httpConnected = response.ok
      
      // WebSocket connection status
      const wsConnected = this.ws?.readyState === WebSocket.OPEN
      
      console.log('🔍 Connection status - HTTP:', httpConnected, 'WebSocket:', wsConnected)
      
      // Consider connected if HTTP API works (WebSocket is optional for basic functionality)
      return httpConnected
    } catch (error) {
      console.error('❌ Connection check failed:', error)
      if (error.name === 'AbortError') {
        console.error('❌ Connection timed out after 5 seconds')
      }
      return false
    }
  }

  close() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.subscribers.clear()
  }
}

export const queueAPI = new QueueAPIService()
export default queueAPI