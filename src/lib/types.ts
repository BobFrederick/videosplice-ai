export type JobStatus = 'queued' | 'uploading' | 'transcribing' | 'analyzing' | 'segmenting' | 'completed' | 'failed'

export interface VideoJob {
  id: string
  fileName: string
  fileSize: number
  status: JobStatus
  progress: number
  createdAt: number
  updatedAt: number
  duration?: number
  transcriptUrl?: string
  transcriptFileName?: string
  hasCustomTranscript?: boolean
  segmentCount?: number
  errorMessage?: string
}

export interface Segment {
  id: string
  title: string
  startTime: number
  endTime: number
  description?: string
}

export interface Project {
  id: string
  name: string
  videoUrl?: string
  transcript?: string
  segments: Segment[]
  jobId: string
  duration?: number
}
