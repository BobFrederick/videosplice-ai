/**
 * Frontend wrapper for shared LLM segmentation service
 * 
 * Re-exports the shared segmentation logic for use in the frontend.
 * This allows the frontend to do re-segmentation without uploading to the backend.
 */

import type { Segment } from '@/lib/types'

// Re-export shared segmentation types and functions
export type { WhisperSegment, LLMSegmentationResult, SegmentationOptions } from '@shared/lib/types'
export { generateIntelligentSegments } from '@shared/lib/llmSegmentation'

// Legacy class-based interface for backward compatibility
// This is now just a thin wrapper around the shared function
export class LLMSegmentationService {
  private ollamaEndpoint = 'http://localhost:11434'

  async generateIntelligentSegments(
    fullTranscript: string,
    whisperSegments: any[],
    videoDuration: number,
    videoFileName?: string,
    customPrompt?: string
  ): Promise<{ segments: Segment[]; reasoning?: string }> {
    const { generateIntelligentSegments } = await import('@shared/lib/llmSegmentation')
    
    return generateIntelligentSegments(
      fullTranscript,
      whisperSegments,
      videoDuration,
      {
        ollamaEndpoint: this.ollamaEndpoint,
        fileName: videoFileName,
        customPrompt
      }
    )
  }
}

// Factory function - creates a new instance of the segmentation service
export function createLLMSegmentationService(): LLMSegmentationService {
  return new LLMSegmentationService()
}