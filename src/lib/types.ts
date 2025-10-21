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

export interface ExportedSegment {
  id: string
  segmentNumber: number
  title: string
  description: string
  startTime: number
  endTime: number
  duration: number
  fileSize: number
  thumbnailUrl: string
  downloadUrl: string
  fileName: string
  status: 'processing' | 'completed' | 'failed'
}

export interface Project {
  id: string
  name: string
  videoUrl?: string
  transcript?: string
  segments: Segment[]
  jobId: string
  duration?: number
  exportedSegments?: ExportedSegment[]
}
