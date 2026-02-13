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
 * - {customInstructions} - Optional user-provided custom instructions
 */
export function createDefaultPrompt(
  transcript: string,
  whisperSegments: WhisperSegment[],
  duration: number,
  fileName?: string,
  customInstructions?: string
): string {
  // Detect if we have word-level segments (typically > 100 segments for a short video)
  // or if segments are very short (< 3 seconds average)
  const avgSegmentDuration = whisperSegments.length > 0
    ? whisperSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0) / whisperSegments.length
    : 0
  const isWordLevel = whisperSegments.length > 100 || avgSegmentDuration < 3
  
  // If no whisperSegments OR if they're word-level (too granular for LLM), use transcript-only format
  if (!whisperSegments || whisperSegments.length === 0 || isWordLevel) {
    return `You are an expert video content analyzer. Your job is to create meaningful, logical segments from a video transcript.

**Video Information:**
- File: ${fileName || 'Unknown'}
- Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s

**Full Transcript:**
${transcript}

${customInstructions ? `
═══════════════════════════════════════════════════════════════════
🎯 USER'S CUSTOM INSTRUCTIONS - ABSOLUTE HIGHEST PRIORITY 🎯
═══════════════════════════════════════════════════════════════════
YOU MUST FOLLOW THESE INSTRUCTIONS EXACTLY. THEY OVERRIDE ALL OTHER REQUIREMENTS.

${customInstructions}

═══════════════════════════════════════════════════════════════════
` : ''}
**Task:**
Analyze the content and create 4-8 logical segments that cover the entire video. Each segment should represent a distinct topic, concept, or section of the video.
${customInstructions ? `\n⚠️ REMEMBER: Follow the custom instructions above for ALL segments!\n` : ''}
**CRITICAL REQUIREMENTS:**
1. ${customInstructions ? 'FIRST AND FOREMOST: Apply the custom instructions to every single segment' : 'Use timestamps in seconds (decimal values like 12.5 are allowed)'}
2. ${customInstructions ? 'Use timestamps in seconds (decimal values like 12.5 are allowed)' : 'Create descriptive, specific titles for each segment'}
3. ${customInstructions ? 'Create descriptive, specific titles for each segment' : 'Write 1-2 sentence descriptions that summarize what happens in each segment'}
4. ${customInstructions ? 'Write 1-2 sentence descriptions that summarize what happens in each segment' : 'Ensure segments are CONTIGUOUS - no gaps between segments, each segment should end where the next begins'}
5. ${customInstructions ? 'Ensure segments are CONTIGUOUS - no gaps between segments, each segment should end where the next begins' : 'No segments should be over 10 minutes in length'}
6. ${customInstructions ? 'No segments should be over 10 minutes in length' : 'Cover the full video duration from start (0s) to end (' + Math.ceil(duration) + 's)'}
7. Cover the full video duration from start (0s) to end (${Math.ceil(duration)}s)
${!customInstructions ? `8. The first segment should NOT be titled anything that implies conclusion or ending since it is the opening segment` : ''}
**Things to avoid:**
- ${customInstructions ? 'IGNORING THE CUSTOM INSTRUCTIONS (most important!)' : 'Creating segments that overlap in time'}
- Creating segments that overlap in time
- Leaving gaps between segments
- Using vague or generic titles
- Zero length segments
- Generic statements like "The video continues" or "Inroduction to the Video Content

**Output Format (JSON only):**
{
  "segments": [
    {
      "id": "seg-1",
      "title": "Specific descriptive title for first segment",
      "description": "Opening remarks and overview of the video content.",
      "startTime": 0,
      "endTime": 45.5
    },
    {
      "id": "seg-2",
      "title": "Specific descriptive title for second segment",
      "description": "What actually happens in this segment.",
      "startTime": 45.5,
      "endTime": 120.0
    }
  ],
  "reasoning": "Brief explanation of your segmentation strategy."
}

The "startTime" and "endTime" are in seconds and must be between 0 and ${Math.ceil(duration)}.

Respond with valid JSON only:`
  }
  
  // Original whisperSegment-based format
  return `You are an expert video content analyzer. Your job is to create meaningful, logical segments from a video transcript.

**Video Information:**
- File: ${fileName || 'Unknown'}
- Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s
- Total Whisper Segments: ${whisperSegments.length}

**Full Transcript:**
${transcript}

**Whisper Timing Segments:**
${whisperSegments.map((seg, i) => `[${i}] ${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s: "${seg.text}"`).join('\n')}

${customInstructions ? `
═══════════════════════════════════════════════════════════════════
🎯 USER'S CUSTOM INSTRUCTIONS - ABSOLUTE HIGHEST PRIORITY 🎯
═══════════════════════════════════════════════════════════════════
YOU MUST FOLLOW THESE INSTRUCTIONS EXACTLY. THEY OVERRIDE ALL OTHER REQUIREMENTS.
APPLY THESE INSTRUCTIONS TO EVERY SINGLE SEGMENT WITHOUT EXCEPTION.

${customInstructions}

REMINDER: The above custom instructions MUST be applied to ALL segments.
═══════════════════════════════════════════════════════════════════
` : ''}
**Task:**
Analyze the content and create 4-8 logical segments that group related Whisper segments together. Each segment should represent a distinct topic, concept, or section of the video.
${customInstructions ? `\n⚠️ CRITICAL: Follow the custom instructions above for EVERY segment without exception!\n` : ''}
**CRITICAL REQUIREMENTS:**
1. ${customInstructions ? '🔴 MOST IMPORTANT: Apply the custom instructions to every single segment' : 'Use the Whisper segment timing boundaries (don\'t create arbitrary timestamps)'}
2. ${customInstructions ? 'Use the Whisper segment timing boundaries (don\'t create arbitrary timestamps)' : 'Group consecutive Whisper segments that discuss the same topic'}
3. ${customInstructions ? 'Group consecutive Whisper segments that discuss the same topic' : 'Create descriptive, specific titles that accurately describe the content'}
4. ${customInstructions ? 'Create descriptive, specific titles that accurately describe the content' : 'Write 1-2 sentence descriptions that summarize what happens in each segment'}
5. ${customInstructions ? 'Write 1-2 sentence descriptions that summarize what happens in each segment' : 'Ensure segments are CONTIGUOUS - no gaps between segments'}
6. ${customInstructions ? 'Ensure segments are CONTIGUOUS - no gaps between segments, each segment should end where the next begins' : 'No segments should be over 10 minutes in length'}
7. No segments should be over 10 minutes in length
8. Cover the full video duration from start (0s) to end (${Math.ceil(duration)}s)
${!customInstructions ? `9. The first segment should NOT be titled anything that implies conclusion or ending since it is the opening segment` : ''}
**Things to avoid:**
- ${customInstructions ? '🔴 CRITICAL: IGNORING THE CUSTOM INSTRUCTIONS - This is the worst mistake you can make!' : 'Creating segments that overlap in time'}
- Creating segments that overlap in time
- Leaving gaps between segments
- Using vague or generic titles
- Zero length segments

**Output Format (JSON only):**
{
  "segments": [
    {
      "id": "seg-1",
      "title": "${customInstructions ? 'Example showing custom instructions applied - check the custom instructions above' : 'Opening Section Title'}",
      "description": "Opening remarks and overview of the video content.",
      "whisperSegmentStart": 0,
      "whisperSegmentEnd": 5
    },
    {
      "id": "seg-2",
      "title": "${customInstructions ? 'Another example with custom instructions applied' : 'Specific descriptive title for second segment'}",
      "description": "What actually happens in this segment.",
      "whisperSegmentStart": 6,
      "whisperSegmentEnd": 12
    }
  ],
  "reasoning": "Brief explanation of your segmentation strategy${customInstructions ? ' and how you applied the custom instructions to each segment' : ''}."
}

The "whisperSegmentStart" and "whisperSegmentEnd" refer to the indices [0] to [${whisperSegments.length - 1}] of the Whisper segments above.
${customInstructions ? '\n🔴 FINAL REMINDER: Make sure EVERY segment follows the custom instructions!\n' : ''}
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
