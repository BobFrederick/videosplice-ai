import type { Segment } from '@/lib/types'

interface WhisperSegment {
  start: number
  end: number
  text: string
}

interface LLMSegmentationResult {
  segments: Segment[]
  reasoning?: string
}

export class LLMSegmentationService {
  private ollamaEndpoint = 'http://localhost:11434'

  async generateIntelligentSegments(
    fullTranscript: string,
    whisperSegments: WhisperSegment[],
    videoDuration: number,
    videoFileName?: string,
    customPrompt?: string
  ): Promise<LLMSegmentationResult> {
    console.log('🧠 Starting LLM segmentation analysis...')
    
    try {
      const prompt = customPrompt 
        ? this.createCustomPrompt(fullTranscript, whisperSegments, videoDuration, customPrompt)
        : this.createSegmentationPrompt(fullTranscript, whisperSegments, videoDuration, videoFileName)
      
      const response = await this.callOllama(prompt)
      const result = this.parseSegmentationResponse(response, whisperSegments, videoDuration)
      
      console.log('✅ LLM segmentation completed:', result.segments.length, 'segments')
      return result
      
    } catch (error) {
      console.error('❌ LLM segmentation failed, falling back to basic segments:', error)
      return this.createFallbackSegments(whisperSegments, videoDuration)
    }
  }

  private createCustomPrompt(
    transcript: string,
    whisperSegments: WhisperSegment[],
    duration: number,
    customPrompt: string
  ): string {
    // Replace template variables in custom prompt
    return customPrompt
      .replace(/{transcript}/g, transcript)
      .replace(/{duration}/g, duration.toString())
      .replace(/{whisperSegments}/g, JSON.stringify(whisperSegments, null, 2))
  }

  private createSegmentationPrompt(
    transcript: string,
    whisperSegments: WhisperSegment[],
    duration: number,
    fileName?: string
  ): string {
    return `You are an expert video content analyzer. Your job is to create meaningful, logical segments from a video transcript.

**Video Information:**
- File: ${fileName || 'Unknown'}
- Duration: ${Math.floor(duration / 60)}m ${duration % 60}s
- Total Whisper Segments: ${whisperSegments.length}

**Full Transcript:**
${transcript}

**Whisper Timing Segments:**
${whisperSegments.map((seg, i) => `[${i}] ${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s: "${seg.text}"`).join('\n')}

**Task:**
Analyze the content and create 4-8 logical segments that group related Whisper segments together. Each segment should represent a distinct topic, concept, or section of the video.

**Requirements:**
1. Use the Whisper segment timing boundaries (don't create arbitrary timestamps)
2. Group consecutive Whisper segments that discuss the same topic
3. Create descriptive, specific titles (not generic like "Introduction" unless truly intro content)  
4. Write 1-2 sentence descriptions that summarize what happens in each segment
5. Ensure segments are CONTIGUOUS - no gaps between segments, each segment should end where the next begins
6. Cover the full video duration from start (0s) to end (${duration}s)

**Output Format (JSON only):**
{
  "segments": [
    {
      "id": "seg-1",
      "title": "Specific descriptive title",
      "description": "What actually happens in this segment.",
      "whisperSegmentStart": 0,
      "whisperSegmentEnd": 5
    }
  ],
  "reasoning": "Brief explanation of your segmentation strategy."
}

The "whisperSegmentStart" and "whisperSegmentEnd" refer to the indices [0] to [${whisperSegments.length - 1}] of the Whisper segments above.

Respond with valid JSON only:`
  }

  private async callOllama(prompt: string): Promise<string> {
    const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 2000
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.response || ''
  }

  private parseSegmentationResponse(
    response: string, 
    whisperSegments: WhisperSegment[],
    videoDuration: number
  ): LLMSegmentationResult {
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        throw new Error('Invalid segments format')
      }

      // Convert LLM output to our Segment format with real timestamps
      const segments: Segment[] = parsed.segments.map((llmSeg: any, index: number) => {
        const startIdx = Math.max(0, llmSeg.whisperSegmentStart || 0)
        const endIdx = Math.min(whisperSegments.length - 1, llmSeg.whisperSegmentEnd || 0)
        
        const startTime = whisperSegments[startIdx]?.start || 0
        const endTime = whisperSegments[endIdx]?.end || 0
        
        // For the last segment, ensure it extends to the full video duration
        const isLastSegment = index === parsed.segments.length - 1
        const finalEndTime = isLastSegment ? Math.ceil(videoDuration) : Math.floor(endTime)

        return {
          id: `seg-${index + 1}`,
          title: llmSeg.title || `Segment ${index + 1}`,
          description: llmSeg.description || '',
          startTime: Math.floor(startTime),
          endTime: finalEndTime
        }
      })

      // Validate and fix segment overlaps
      const validatedSegments = this.validateAndFixSegments(segments.filter(seg => seg.endTime > seg.startTime))
      
      // Final check: Remove any segments with zero or negative duration
      const finalSegments = validatedSegments.filter(seg => {
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

  private validateAndFixSegments(segments: Segment[]): Segment[] {
    const MIN_SEGMENT_DURATION = 10 // 10 seconds minimum
    
    // Sort segments by start time
    let sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime)
    
    // First pass: Remove or merge segments that are too short
    const validSegments: Segment[] = []
    
    for (let i = 0; i < sortedSegments.length; i++) {
      const current = sortedSegments[i]
      const duration = current.endTime - current.startTime
      
      if (duration < MIN_SEGMENT_DURATION) {
        console.log(`🔧 Segment "${current.title}" is too short (${duration}s), merging with adjacent segment`)
        
        // Try to merge with next segment
        if (i < sortedSegments.length - 1) {
          const next = sortedSegments[i + 1]
          next.startTime = current.startTime
          next.title = `${current.title} / ${next.title}`
          // Skip current segment (don't add to validSegments)
          continue
        }
        // Try to merge with previous segment  
        else if (validSegments.length > 0) {
          const prev = validSegments[validSegments.length - 1]
          prev.endTime = current.endTime
          prev.title = `${prev.title} / ${current.title}`
          // Skip current segment
          continue
        }
      }
      
      validSegments.push(current)
    }
    
    // Second pass: Fix overlaps and gaps
    const finalSegments: Segment[] = []
    
    for (let i = 0; i < validSegments.length - 1; i++) {
      const current = validSegments[i]
      const next = validSegments[i + 1]
      
      // If current segment overlaps with next, adjust current's end time to next's start
      if (current.endTime > next.startTime) {
        console.log(`🔧 Fixing segment overlap: "${current.title}" ending at ${current.endTime}s overlaps with "${next.title}" starting at ${next.startTime}s`)
        current.endTime = next.startTime
      }
      // If there's a gap between segments, extend current to meet next
      else if (current.endTime < next.startTime) {
        console.log(`🔧 Fixing segment gap: "${current.title}" ends at ${current.endTime}s but "${next.title}" starts at ${next.startTime}s`)
        current.endTime = next.startTime
      }
      
      // Only add segments that have valid duration after fixing
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
        // Merge with previous segment
        const prevSegment = finalSegments[finalSegments.length - 1]
        prevSegment.endTime = lastSegment.endTime
        prevSegment.title = `${prevSegment.title} / ${lastSegment.title}`
        console.log(`🔧 Merged short last segment "${lastSegment.title}" with previous segment`)
      }
    }
    
    return finalSegments
  }

  private createFallbackSegments(
    whisperSegments: WhisperSegment[], 
    duration: number
  ): LLMSegmentationResult {
    // Create simple segments based on duration if LLM fails
    const segmentCount = Math.min(6, Math.max(3, Math.floor(duration / 60))) // 3-6 segments
    const segmentDuration = duration / segmentCount
    
    const segments: Segment[] = []
    
    for (let i = 0; i < segmentCount; i++) {
      const startTime = Math.floor(i * segmentDuration)
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
}

export function createLLMSegmentationService(): LLMSegmentationService {
  return new LLMSegmentationService()
}