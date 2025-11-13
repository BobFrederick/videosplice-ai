export interface VideoJob {
  id: string
  fileName: string
  fileSize: number
  filePath: string
  status: JobStatus
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
  duration?: number
  segmentCount?: number
  errorMessage?: string
  progress?: number
  hasCustomTranscript?: boolean
  hasVttFile?: boolean
}

export type JobStatus = 
  | 'queued' 
  | 'processing' 
  | 'transcribing' 
  | 'analyzing' 
  | 'completed' 
  | 'failed'

export interface JobProgress {
  jobId: string
  status: JobStatus
  progress: number
  message: string
  error?: string
}

export interface LLMSettings {
  model: string
  provider: 'local' | 'openai'
  localEndpoint: string
  customPrompt?: string
}

export interface ProcessingOptions {
  llmSettings: LLMSettings
  customTranscript?: string
  vttFilePath?: string
}