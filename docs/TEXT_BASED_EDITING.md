# Text-Based Video Editing

## Overview

Text-based video editing allows users to edit video segments by selecting text directly in the transcript view. This feature provides an intuitive way to create, split, and modify video segments using the same text they see when watching the video.

## Requirements

- **WhisperSegments Required**: The feature requires word/phrase-level timestamps from Whisper transcription or VTT files
- **Automatic Enablement**: When whisperSegments are available, the text-based editor is automatically enabled
- **Fallback Support**: Projects without whisperSegments fall back to the standard transcript viewer

## Features

### 1. Text Selection to Timestamp Mapping

When you select text in the transcript:
- The system automatically calculates the corresponding video timestamp range
- Selection info is displayed showing start and end times
- Hover effects indicate selectable text regions

### 2. Delete to Split/Trim Segments

Press **Delete** or **Backspace** on selected text to:
- **Split segments**: If selection is within a segment, it splits into two parts
- **Trim segments**: If selection overlaps segment boundaries, it trims the segment
- **Modify multiple segments**: Can affect multiple overlapping segments at once

### 3. Right-Click Context Menu

Right-click on selected text to:
- **Create Segment from Selection**: Creates a new segment for the selected time range
- **Copy Timestamp**: Copies the timestamp range to clipboard

### 4. Visual Feedback

- **Selection Highlighting**: Selected text is visually highlighted
- **Timestamp Display**: Shows the time range for current selection
- **Hover Effects**: Text segments show hover state for better interactivity
- **Help Panel**: Toggle help to see usage instructions

## Usage Examples

### Example 1: Creating a Segment from Specific Text

1. Find the text in the transcript that represents the content you want as a segment
2. Click and drag to select that text
3. Right-click and choose "Create Segment from Selection"
4. The system creates a new segment at that precise timestamp range

### Example 2: Splitting a Long Segment

1. Navigate to a segment that's too long
2. Find the point in the transcript where you want to split
3. Select a small portion of text at that split point
4. Press **Delete** or **Backspace**
5. The segment is split into two parts at that location

### Example 3: Trimming Unwanted Content

1. Select text at the beginning or end of a segment that you want to remove
2. Press **Delete** or **Backspace**
3. The segment is trimmed to exclude the selected text

## Validation Rules

### Minimum Segment Duration

- All segments must be at least **1 second** long
- Operations that would create segments shorter than 1 second are rejected with an error message
- This prevents accidental creation of unusably short segments

### Timestamp Accuracy

- Text selections are mapped to whisperSegments with millisecond precision
- The mapping algorithm finds the whisper segments that overlap with the selected text
- Uses character position mapping for accurate timestamp calculation

### Overlap Handling

When creating or modifying segments, the system handles overlaps intelligently:
- **Complete overlap**: Removes segments entirely contained within selection
- **Partial overlap**: Adjusts boundaries to avoid conflicts
- **Split scenarios**: Creates new segments while maintaining continuity

## Technical Details

### Component Architecture

```
TranscriptViewerTextBased
├── Text Selection Handler
│   └── Maps DOM selection to whisperSegments
├── Keyboard Handler
│   └── Processes Delete/Backspace for segment operations
├── Context Menu
│   └── Provides right-click actions
└── Validation Layer
    └── Enforces minimum durations and validates operations
```

### Data Flow

1. User selects text in the transcript
2. Component calculates character offsets in the full transcript
3. Character offsets are mapped to whisperSegments
4. Timestamp range is extracted from overlapping whisperSegments
5. Operations are validated against minimum duration rules
6. Segment modifications are applied and sorted
7. Changes propagate to Timeline and SegmentEditor

### WhisperSegment Structure

```typescript
interface WhisperSegment {
  start: number  // Start time in seconds
  end: number    // End time in seconds
  text: string   // Transcribed text for this segment
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Delete** / **Backspace** | Split or trim segments at text selection |
| **Right-click** | Open context menu for selected text |

## Limitations

### Current Limitations

1. **Requires WhisperSegments**: Feature only works with Whisper transcription or VTT files
2. **Minimum Duration**: 1-second minimum segment duration
3. **Selection Granularity**: Limited to whisperSegment boundaries (typically phrase-level)

### Known Edge Cases

1. **Very Short Selections**: Selections shorter than 1 second display an error
2. **Multiple Segment Spans**: Selecting text across many segments may produce complex results
3. **Boundary Precision**: Timestamps are as precise as the whisperSegments provide

## Best Practices

### For Best Results

1. **Start with AI Segmentation**: Use the AI segmentation first, then refine with text-based editing
2. **Use Larger Selections**: Select complete phrases or sentences for clearer boundaries
3. **Review Changes**: Check the Timeline view after text-based edits to verify segment boundaries
4. **Test Playback**: Play the video to ensure segments start/end where expected

### Recommended Workflow

1. Upload video and let Whisper transcribe (or upload VTT)
2. Generate initial segments with AI
3. Review segments in the transcript view
4. Use text selection to refine boundaries:
   - Select and delete to remove unwanted parts
   - Right-click to create new segments from specific content
5. Verify in Timeline view
6. Export final segments

## Troubleshooting

### "Text-based editing not available"

**Cause**: No whisperSegments available for this project

**Solutions**:
- Re-process the video with Whisper transcription
- Upload a VTT file with the video
- Ensure the transcription completed successfully

### "Selection too short" error

**Cause**: Selected text represents less than 1 second of video

**Solutions**:
- Select a longer portion of text
- Use Timeline tools for very precise edits
- Combine with manual segment boundary adjustment

### "No segments overlap with selected text"

**Cause**: The selected time range doesn't intersect with any existing segments

**Solutions**:
- Create a segment first using the context menu
- Verify segments exist in the Timeline
- Check that you're selecting transcript text, not UI elements

### Timestamp seems inaccurate

**Cause**: WhisperSegment granularity may not be word-level

**Solutions**:
- This is a limitation of the transcription granularity
- Use Timeline drag handles for precise adjustments
- Consider re-transcribing with different Whisper settings

## Future Enhancements

Potential improvements for future versions:

1. **Word-level timestamps**: Finer granularity for more precise editing
2. **Multi-select**: Select multiple non-contiguous text regions
3. **Undo/Redo**: Reverse text-based editing operations
4. **Preview mode**: Preview segment before committing changes
5. **Batch operations**: Apply operations to multiple selections
6. **Custom shortcuts**: Configurable keyboard shortcuts

## Contributing

When working on text-based editing features:

1. Maintain minimum segment duration validation
2. Ensure operations are reversible through segment editor
3. Provide clear user feedback for all operations
4. Handle edge cases gracefully
5. Test with various transcript lengths and complexities

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [README](../README.md) - Main project documentation
- [Deployment](./DEPLOYMENT.md) - Production deployment guide
