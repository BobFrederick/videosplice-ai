/**
 * Shared types for video segmentation
 * Used by both frontend and backend
 */

// Raw Whisper transcription segment with word-level timestamps
export interface WhisperSegment {
  start: number
  end: number
  text: string
}

// Logical video segment created by LLM analysis
export interface Segment {
  id: string
  title: string
  description?: string
  startTime: number
  endTime: number
}

// LLM segmentation result with reasoning
export interface LLMSegmentationResult {
  segments: Segment[]
  reasoning?: string
}

// Options for LLM segmentation
export interface SegmentationOptions {
  ollamaEndpoint?: string
  model?: string
  temperature?: number
  customPrompt?: string
  fileName?: string
}
