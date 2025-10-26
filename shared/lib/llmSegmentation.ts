/**
 * Shared LLM segmentation service
 * 
 * Core logic for intelligent video segmentation using LLM analysis.
 * Works in both browser (frontend) and Node.js (backend) environments.
 * 
 * Flow: Whisper segments → LLM analysis → Logical segments with titles/descriptions
 */

import type { WhisperSegment, Segment, LLMSegmentationResult, SegmentationOptions } from './types'
import { createDefaultPrompt, createCustomPrompt } from './prompts'

/**
 * Main segmentation function - generates intelligent video segments using LLM
 * 
 * @param fullTranscript - Complete video transcript text
 * @param whisperSegments - Raw Whisper segments with precise timestamps
 * @param videoDuration - Total video length in seconds
 * @param options - Configuration options (endpoint, model, custom prompt, etc.)
 * @returns Logical segments with titles, descriptions, and timing
 */
export async function generateIntelligentSegments(
  fullTranscript: string,
  whisperSegments: WhisperSegment[],
  videoDuration: number,
  options: SegmentationOptions = {}
): Promise<LLMSegmentationResult> {
  console.log('🧠 Starting LLM segmentation analysis...')
  
  const {
    ollamaEndpoint = 'http://localhost:11434',
    model = 'qwen2.5:7b',
    temperature = 0.3,
    customPrompt
  } = options
  
  try {
    // Build prompt: either custom or default segmentation prompt
    const prompt = customPrompt
      ? createCustomPrompt(fullTranscript, whisperSegments, videoDuration, customPrompt)
      : createDefaultPrompt(fullTranscript, whisperSegments, videoDuration, options.fileName)
    
    // Call Ollama LLM
    const response = await callOllama(prompt, { ollamaEndpoint, model, temperature })
    
    // Parse and validate response
    const result = parseSegmentationResponse(response, whisperSegments, videoDuration)
    
    console.log('✅ LLM segmentation completed:', result.segments.length, 'segments')
    return result
    
  } catch (error) {
    // If LLM fails, fall back to simple time-based segments
    console.error('❌ LLM segmentation failed, falling back to basic segments:', error)
    return createFallbackSegments(whisperSegments, videoDuration)
  }
}

/**
 * Calls Ollama LLM API with the segmentation prompt
 * 
 * Uses low temperature (0.3 default) for consistent, focused output
 * Stream disabled to get complete response at once
 */
async function callOllama(
  prompt: string,
  options: { ollamaEndpoint: string; model: string; temperature: number }
): Promise<string> {
  const response = await fetch(`${options.ollamaEndpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature,
        top_p: 0.9,
        max_tokens: 2000
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`)
  }

  const result = await response.json() as { response?: string }
  return result.response || ''
}

/**
 * Parses LLM JSON response and converts to actual segment timing
 * 
 * LLM provides Whisper segment indices (e.g., segments 0-5, 6-12, etc.)
 * We map those indices to actual timestamps using the Whisper segment array
 * 
 * Also handles:
 * - Extracting JSON from potentially messy LLM output
 * - Converting segment indices to real start/end times
 * - Supporting direct time values as fallback
 * - Ensuring last segment extends to full video duration
 * - Validating and fixing overlaps/gaps
 */
function parseSegmentationResponse(
  response: string,
  whisperSegments: WhisperSegment[],
  videoDuration: number
): LLMSegmentationResult {
  try {
    // LLMs sometimes add explanatory text before/after JSON - extract just the JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    
    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      throw new Error('Invalid segments format')
    }

    // Convert LLM segment indices to actual timestamps using Whisper segment timing
    const segments: Segment[] = parsed.segments.map((llmSeg: any, index: number) => {
      let startTime: number
      let endTime: number
      
      // Handle both whisper segment indices AND direct time values (for flexibility)
      if (llmSeg.whisperSegmentStart !== undefined && llmSeg.whisperSegmentEnd !== undefined) {
        // LLM provided indices - map to Whisper segment timestamps
        // Clamp to valid range [0, whisperSegments.length - 1]
        const startIdx = Math.max(0, llmSeg.whisperSegmentStart || 0)
        const endIdx = Math.min(whisperSegments.length - 1, llmSeg.whisperSegmentEnd || 0)
        
        startTime = whisperSegments[startIdx]?.start || 0
        endTime = whisperSegments[endIdx]?.end || 0
      } else if (llmSeg.startTime !== undefined && llmSeg.endTime !== undefined) {
        // LLM provided direct timestamps (fallback for custom prompts)
        startTime = llmSeg.startTime
        endTime = llmSeg.endTime
      } else {
        // Fallback: distribute evenly if no timing info
        const segmentDuration = videoDuration / parsed.segments.length
        startTime = index * segmentDuration
        endTime = (index + 1) * segmentDuration
      }
      
      // Special case: Last segment should extend to full video duration
      // This ensures we don't have trailing content without a segment
      const isLastSegment = index === parsed.segments.length - 1
      const finalEndTime = isLastSegment ? Math.ceil(videoDuration) : Math.floor(endTime)

      return {
        id: llmSeg.id || `seg-${index + 1}`,
        title: llmSeg.title || `Segment ${index + 1}`,
        description: llmSeg.description || '',
        startTime: Math.floor(startTime),
        endTime: finalEndTime
      }
    })

    // Filter out invalid segments, then validate and fix overlaps/gaps
    const validSegments = segments.filter(seg => seg.endTime > seg.startTime)
    const fixedSegments = validateAndFixSegments(validSegments)
    
    // Final cleanup: Remove any zero-duration segments
    const finalSegments = fixedSegments.filter(seg => {
      const duration = seg.endTime - seg.startTime
      if (duration <= 0) {
        console.log(`🚫 Removing zero-duration segment: "${seg.title}" (${seg.startTime}s - ${seg.endTime}s)`)
        return false
      }
      return true
    })

    return {
      segments: finalSegments,
      reasoning: parsed.reasoning
    }

  } catch (error) {
    console.error('Failed to parse LLM response:', error)
    throw error
  }
}

/**
 * Validates and fixes common segment timing issues
 * 
 * LLMs can create segments with issues:
 * - Too short segments (< 10 seconds) - merges with adjacent segment
 * - Overlapping segments - adjusts end time to match next segment's start
 * - Gaps between segments - extends to fill the gap
 * 
 * Goal: Create clean, contiguous segments that cover the full video
 */
function validateAndFixSegments(segments: Segment[]): Segment[] {
  const MIN_SEGMENT_DURATION = 10 // 10 seconds minimum
  
  // Sort by start time in case LLM returned them out of order
  let sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime)
  
  // PASS 1: Remove or merge segments that are too short
  const validSegments: Segment[] = []
  
  for (let i = 0; i < sortedSegments.length; i++) {
    const current = sortedSegments[i]
    const duration = current.endTime - current.startTime
    
    if (duration < MIN_SEGMENT_DURATION) {
      console.log(`🔧 Segment "${current.title}" is too short (${duration}s), merging with adjacent segment`)
      
      // Try to merge with next segment (extend next backward to cover current)
      if (i < sortedSegments.length - 1) {
        const next = sortedSegments[i + 1]
        next.startTime = current.startTime
        next.title = `${current.title} / ${next.title}`
        continue // Skip adding current segment (it's now merged into next)
      }
      // If it's the last segment, merge with previous
      else if (validSegments.length > 0) {
        const prev = validSegments[validSegments.length - 1]
        prev.endTime = current.endTime
        prev.title = `${prev.title} / ${current.title}`
        continue // Skip adding current segment (it's now merged into previous)
      }
    }
    
    validSegments.push(current)
  }
  
  // PASS 2: Fix overlaps and gaps between consecutive segments
  const finalSegments: Segment[] = []
  
  for (let i = 0; i < validSegments.length - 1; i++) {
    const current = validSegments[i]
    const next = validSegments[i + 1]
    
    // OVERLAP: Current extends past next's start
    if (current.endTime > next.startTime) {
      console.log(`🔧 Fixing segment overlap: "${current.title}" ending at ${current.endTime}s overlaps with "${next.title}" starting at ${next.startTime}s`)
      current.endTime = next.startTime
    }
    // GAP: There's empty time between current and next
    else if (current.endTime < next.startTime) {
      console.log(`🔧 Fixing segment gap: "${current.title}" ends at ${current.endTime}s but "${next.title}" starts at ${next.startTime}s`)
      current.endTime = next.startTime
    }
    
    // Only keep segments that still have valid duration after fixes
    const duration = current.endTime - current.startTime
    if (duration >= MIN_SEGMENT_DURATION) {
      finalSegments.push(current)
    } else {
      console.log(`🚫 Removing segment "${current.title}" with ${duration}s duration after overlap/gap fixing`)
      // Extend the next segment to cover this removed segment's time
      if (next) {
        next.startTime = current.startTime
      }
    }
  }
  
  // Add the last segment if it has valid duration
  if (validSegments.length > 0) {
    const lastSegment = validSegments[validSegments.length - 1]
    const duration = lastSegment.endTime - lastSegment.startTime
    if (duration >= MIN_SEGMENT_DURATION) {
      finalSegments.push(lastSegment)
    } else if (finalSegments.length > 0) {
      // Merge short last segment with previous segment
      const prevSegment = finalSegments[finalSegments.length - 1]
      prevSegment.endTime = lastSegment.endTime
      prevSegment.title = `${prevSegment.title} / ${lastSegment.title}`
      console.log(`🔧 Merged short last segment "${lastSegment.title}" with previous segment`)
    }
  }
  
  return finalSegments
}

/**
 * Fallback strategy when LLM fails or is unavailable
 * 
 * Creates simple time-based segments:
 * - 3-6 segments depending on video duration (1 segment per minute roughly)
 * - Equal duration for each segment
 * - Generic titles like "Part 1", "Part 2"
 */
function createFallbackSegments(
  whisperSegments: WhisperSegment[],
  duration: number
): LLMSegmentationResult {
  // Calculate number of segments based on video duration
  // Roughly 1 segment per minute, with 3-6 segment range
  const segmentCount = Math.min(6, Math.max(3, Math.floor(duration / 60)))
  const segmentDuration = duration / segmentCount
  
  const segments: Segment[] = []
  
  for (let i = 0; i < segmentCount; i++) {
    const startTime = Math.floor(i * segmentDuration)
    // Last segment extends to end of video
    const endTime = i === segmentCount - 1 ? duration : Math.floor((i + 1) * segmentDuration)
    
    segments.push({
      id: `seg-${i + 1}`,
      title: `Part ${i + 1}`,
      description: `Content from ${startTime}s to ${endTime}s`,
      startTime,
      endTime
    })
  }

  return {
    segments,
    reasoning: 'Fallback: Created basic time-based segments due to LLM failure'
  }
}
