/**
 * Shared LLM prompt templates for video segmentation
 * 
 * These prompts instruct the LLM to analyze video transcripts and create
 * logical content segments using Whisper segment indices for precise timing.
 */

import type { WhisperSegment } from './types'

/**
 * Default segmentation prompt that uses Whisper segment indices
 * 
 * This approach ensures precise timing by having the LLM reference actual
 * Whisper segment boundaries rather than arbitrary timestamps.
 * 
 * Template variables:
 * - {fileName} - Video filename for context
 * - {duration} - Total video duration in seconds
 * - {transcript} - Full transcript text
 * - {whisperSegments} - Formatted Whisper segments with indices and timestamps
 * - {whisperSegmentCount} - Total number of Whisper segments
 */
export function createDefaultPrompt(
  transcript: string,
  whisperSegments: WhisperSegment[],
  duration: number,
  fileName?: string
): string {
  return `You are an expert video content analyzer. Your job is to create meaningful, logical segments from a video transcript.

**Video Information:**
- File: ${fileName || 'Unknown'}
- Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s
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
6. Cover the full video duration from start (0s) to end (${Math.ceil(duration)}s)

**Things to avoid:**
- Creating segments that overlap in time
- Leaving gaps between segments
- Using vague or generic titles
- Zero length segments
- First segments that express Conclusion or Ending prematurely
- Never use the word conclusion or ending in the first segment.

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

/**
 * Creates a custom prompt with template variable substitution
 * 
 * Supports these template variables:
 * - {transcript} - Full video transcript
 * - {duration} - Video duration in seconds
 * - {whisperSegments} - JSON array of Whisper segments
 */
export function createCustomPrompt(
  transcript: string,
  whisperSegments: WhisperSegment[],
  duration: number,
  customPrompt: string
): string {
  return customPrompt
    .replace(/{transcript}/g, transcript)
    .replace(/{duration}/g, duration.toString())
    .replace(/{whisperSegments}/g, JSON.stringify(whisperSegments, null, 2))
}
