# Timeline Implementation Documentation

## Overview

The Timeline component is an interactive video segmentation interface that allows users to visualize, split, merge, and adjust video segments in real-time. This document details the implementation, particularly focusing on the boundary dragging mechanism that was recently fixed.

## Component Architecture

### Core State Management

```typescript
const [draggingBoundary, setDraggingBoundary] = useState<number | null>(null)
const [draggingSegmentIds, setDraggingSegmentIds] = useState<{ leftId: string; rightId: string } | null>(null)
const [hoverPosition, setHoverPosition] = useState<number | null>(null)
const [isShiftPressed, setIsShiftPressed] = useState(false)
const [isCtrlPressed, setIsCtrlPressed] = useState(false)
const segmentsRef = useRef<Segment[]>(segments)
const [originalSegments] = useState<Segment[]>(segments)
```

**Key States:**
- `draggingBoundary`: Tracks which boundary (time value) is currently being dragged
- `draggingSegmentIds`: Stores the IDs of the left and right segments affected by the drag
- `hoverPosition`: Current mouse position for hover effects
- `isShiftPressed/isCtrlPressed`: Keyboard modifier states for different interactions
- `segmentsRef`: Ref to always access current segment state during drag operations
- `originalSegments`: Immutable reference to initial segments for validation

### Critical Implementation: Boundary Dragging

The boundary dragging system uses a **global event listener pattern** to ensure smooth, continuous dragging without interruption.

#### Problem That Was Solved

Previously, the drag operation would stop prematurely because:
1. Mouse events were only attached to the boundary element itself
2. When the mouse moved quickly, it would leave the small boundary hitbox
3. Events would stop firing, causing the drag to "stick"

#### Solution: Global Event Listeners

The fix uses `useEffect` to attach global document-level event listeners when a drag begins:

```typescript
useEffect(() => {
  if (draggingBoundary === null) return

  const handleGlobalMouseMove = (e: MouseEvent) => {
    e.preventDefault()
    const time = getTimeFromPosition(e.clientX)
    updateBoundary(time)
  }

  const handleGlobalMouseUp = () => {
    setDraggingBoundary(null)
    setDraggingSegmentIds(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false })
  document.addEventListener('mouseup', handleGlobalMouseUp)

  return () => {
    document.removeEventListener('mousemove', handleGlobalMouseMove)
    document.removeEventListener('mouseup', handleGlobalMouseUp)
  }
}, [draggingBoundary, updateBoundary])
```

**Why This Works:**
1. **Global Scope**: Events are attached to `document`, so they fire regardless of where the mouse moves
2. **Passive False**: `{ passive: false }` allows `preventDefault()` to work, preventing text selection during drag
3. **Cleanup**: The effect properly removes listeners when drag ends or component unmounts
4. **Cursor Management**: Sets `col-resize` cursor on the entire document during drag

#### Drag Initiation

```typescript
const handleBoundaryMouseDown = (boundary: number, e: React.MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  
  if (boundary === 0 || boundary === duration) {
    return // Prevent dragging first/last boundaries
  }
  
  const leftSegment = segments.find(s => Math.abs(s.endTime - boundary) < 0.5)
  const rightSegment = segments.find(s => Math.abs(s.startTime - boundary) < 0.5)
  
  if (!leftSegment || !rightSegment) {
    return
  }
  
  setDraggingBoundary(boundary)
  setDraggingSegmentIds({ leftId: leftSegment.id, rightId: rightSegment.id })
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}
```

**Key Steps:**
1. Prevent default behavior and event bubbling
2. Guard against edge boundaries (start/end of video)
3. Find the segments on either side of the boundary
4. Store the boundary time and affected segment IDs
5. Set global cursor and disable text selection

#### Boundary Update Logic

```typescript
const updateBoundary = useCallback((newTime: number) => {
  if (!draggingSegmentIds) return
  
  const currentSegments = segmentsRef.current
  const leftSegment = currentSegments.find(s => s.id === draggingSegmentIds.leftId)
  const rightSegment = currentSegments.find(s => s.id === draggingSegmentIds.rightId)
  
  if (!leftSegment || !rightSegment) return
  
  const minBound = leftSegment.startTime + MIN_SEGMENT_DURATION
  const maxBound = rightSegment.endTime - MIN_SEGMENT_DURATION
  
  const clampedTime = Math.max(minBound, Math.min(maxBound, newTime))

  const updatedSegments = currentSegments.map((segment) => {
    if (segment.id === leftSegment.id) {
      return { ...segment, endTime: clampedTime }
    }
    if (segment.id === rightSegment.id) {
      return { ...segment, startTime: clampedTime }
    }
    return segment
  })

  onSegmentChange(updatedSegments)
}, [onSegmentChange, draggingSegmentIds])
```

**Critical Aspects:**
1. **Ref Usage**: Uses `segmentsRef.current` instead of `segments` to avoid stale closures
2. **Boundary Clamping**: Ensures segments maintain minimum duration (5 seconds)
3. **Immutable Updates**: Creates new segment objects rather than mutating
4. **Adjacent Updates**: Updates both the left segment's `endTime` and right segment's `startTime`

### Position Calculation

```typescript
const getTimeFromPosition = (clientX: number): number => {
  if (!timelineRef.current) return 0
  const rect = timelineRef.current.getBoundingClientRect()
  const x = clientX - rect.left
  const percentage = Math.max(0, Math.min(1, x / rect.width))
  const time = percentage * duration
  return time
}
```

Converts mouse X coordinate to video time by:
1. Getting timeline element dimensions
2. Calculating relative position (0-1)
3. Multiplying by total video duration
4. Clamping to valid range

## User Interactions

### 1. Click to Seek
- **Action**: Click on timeline
- **Behavior**: Moves playhead to clicked position
- **Exception**: Clicking near a boundary (within 3 seconds) snaps to that boundary

### 2. Shift+Click to Split
- **Action**: Hold Shift and click on a segment
- **Behavior**: Creates a new boundary at click position, splitting one segment into two
- **Constraints**: 
  - Cannot split within `MIN_SEGMENT_DURATION` (5 seconds) of existing boundaries
  - Cannot split too close to start or end

### 3. Drag to Adjust
- **Action**: Click and drag a boundary line
- **Behavior**: Moves boundary left/right, adjusting adjacent segments
- **Constraints**:
  - Cannot drag edge boundaries (0 or duration)
  - Segments maintain minimum duration
  - Drag continues smoothly even if mouse leaves timeline

### 4. Ctrl+Click to Delete
- **Action**: Hold Ctrl and click on a segment
- **Behavior**: Removes segment, merging adjacent segments
- **Constraints**:
  - Cannot delete if only one segment remains
  - Cannot delete first original segment
  - Cannot delete last original segment

## Visual Feedback

### Boundary States
- **Default**: Gray line (`bg-foreground/40`)
- **Hover**: Primary color, slightly wider (`hover:bg-primary hover:w-1.5`)
- **Dragging**: Primary color, wider, with time label (`bg-primary w-1.5`)
- **Edge**: Border color, not interactive (`bg-border cursor-default`)

### Hover Effects
- Time label appears above boundaries on hover
- Faint vertical line shows where new boundary would be created
- Cursor changes to `col-resize` over draggable boundaries

### Segment Coloring
Uses chart colors from theme in rotation:
```typescript
const colors = [
  'bg-chart-1/20',
  'bg-chart-2/20',
  'bg-chart-3/20',
  'bg-chart-4/20',
  'bg-chart-5/20',
]
```

## Keyboard Modifiers

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') setIsShiftPressed(true)
    if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true)
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') setIsShiftPressed(false)
    if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }
}, [])
```

Tracks modifier keys globally to enable:
- **Shift**: Add new boundaries
- **Ctrl/Meta**: Delete segments

## Time Grid System

```typescript
const generateTimeGrid = () => {
  const gridLines: number[] = []
  let interval = 30
  
  if (duration <= 60) interval = 10
  else if (duration <= 180) interval = 30
  else if (duration <= 600) interval = 60
  else interval = 120

  for (let time = interval; time < duration; time += interval) {
    gridLines.push(time)
  }

  return gridLines
}
```

**Adaptive Intervals:**
- 0-60s: 10-second intervals
- 60-180s: 30-second intervals
- 180-600s: 1-minute intervals
- 600s+: 2-minute intervals

## Data Flow

```
User MouseDown on Boundary
    ↓
handleBoundaryMouseDown()
    ↓
Set draggingBoundary & draggingSegmentIds
Attach global listeners (useEffect triggers)
    ↓
User Moves Mouse Anywhere
    ↓
handleGlobalMouseMove()
    ↓
getTimeFromPosition()
    ↓
updateBoundary()
    ↓
Calculate clamped position
Update segments immutably
    ↓
onSegmentChange() (parent handler)
    ↓
Parent updates state
Segments prop changes
    ↓
segmentsRef.current updated (useEffect)
    ↓
Next drag update uses fresh data
    ↓
User Releases Mouse
    ↓
handleGlobalMouseUp()
    ↓
Clear drag state
Remove global listeners
Reset cursor
```

## Important Implementation Details

### 1. Stale Closure Prevention
Using `segmentsRef` ensures the drag handler always has current segment data:
```typescript
const segmentsRef = useRef<Segment[]>(segments)

useEffect(() => {
  segmentsRef.current = segments
}, [segments])

// Later in updateBoundary:
const currentSegments = segmentsRef.current // Always fresh
```

### 2. Event Propagation Control
```typescript
e.preventDefault() // Prevent default browser behavior
e.stopPropagation() // Stop event bubbling to timeline click handler
```

### 3. User Selection Prevention
```typescript
document.body.style.userSelect = 'none' // During drag
document.body.style.userSelect = '' // After drag
```

Prevents text/element selection during drag operations.

### 4. Segment Validation
- Minimum duration: 5 seconds per segment
- First/last original segments cannot be deleted
- Boundaries at 0 and duration cannot be moved

## Performance Considerations

1. **Memoization**: `updateBoundary` is wrapped in `useCallback` to prevent recreation
2. **Ref Usage**: Avoids unnecessary re-renders during drag
3. **Passive False**: Only set where needed for `preventDefault()`
4. **Cleanup**: All event listeners properly removed

## Testing Scenarios

### Successful Drag
1. Click on a middle boundary
2. Drag left or right
3. Boundary should move smoothly
4. Release mouse
5. Segments should maintain new positions

### Boundary Constraints
1. Try to drag boundary too far left (violates min duration)
2. Should stop at minimum position
3. Try to drag boundary too far right
4. Should stop at maximum position

### Fast Mouse Movement
1. Click and drag boundary
2. Move mouse very quickly outside timeline
3. Boundary should continue following cursor
4. Release anywhere
5. Drag should complete successfully

### Edge Cases
1. Try dragging first boundary (should not be draggable)
2. Try dragging last boundary (should not be draggable)
3. Delete segments until one remains (should prevent deletion)

## Future Enhancements

Potential improvements:
- Multi-boundary selection for bulk operations
- Keyboard shortcuts for fine-tuning (arrow keys)
- Snapping to specific time intervals
- Undo/redo functionality
- Touch device support
- Segment labels inline editing
- Zoom and pan for long videos
- Minimap for quick navigation

## Related Files

- **Component**: `/src/components/Timeline.tsx`
- **Types**: `/src/lib/types.ts`
- **Parent**: `/src/components/ProjectView.tsx`
- **App State**: `/src/App.tsx`

## Troubleshooting

### Drag not working
- Check that global listeners are attached (add console.log in useEffect)
- Verify `draggingBoundary` state is being set
- Ensure `preventDefault()` is being called

### Segments jumping
- Check `segmentsRef` is being updated
- Verify immutable updates in `updateBoundary`
- Ensure parent component passes updated segments

### Cursor stuck
- Verify `handleGlobalMouseUp` is cleaning up cursor styles
- Check cleanup function in useEffect is running

## Credits

Implementation inspired by professional video editing software including:
- Adobe Premiere Pro
- DaVinci Resolve
- Final Cut Pro

Built with React 19, TypeScript, Tailwind CSS, and shadcn/ui components.
