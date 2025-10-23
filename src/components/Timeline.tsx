import { useRef, useState, useCallback, useEffect } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import type { Segment } from '@/lib/types'
import { cn } from '@/lib/utils'

const MIN_SEGMENT_DURATION = 5

interface TimelineProps {
  segments: Segment[]
  onSegmentChange: (segments: Segment[]) => void
  duration: number
  currentTime: number
  onSeek: (time: number) => void
  className?: string
}

export function Timeline({
  segments,
  onSegmentChange,
  duration,
  currentTime,
  onSeek,
  className,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [draggingBoundary, setDraggingBoundary] = useState<number | null>(null)
  const [draggingSegmentIds, setDraggingSegmentIds] = useState<{ leftId: string; rightId: string } | null>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const segmentsRef = useRef<Segment[]>(segments)
  const [originalSegments] = useState<Segment[]>(segments)

  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true)
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false)
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTimeFromPosition = (clientX: number): number => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    const time = percentage * duration
    return time
  }

  const getBoundaries = () => {
    const boundaries: number[] = []
    segments.forEach((segment) => {
      if (!boundaries.includes(segment.startTime)) {
        boundaries.push(segment.startTime)
      }
      if (!boundaries.includes(segment.endTime)) {
        boundaries.push(segment.endTime)
      }
    })
    return boundaries
  }

  const findNearestBoundary = (time: number, threshold: number = 2): number | null => {
    const boundaries = getBoundaries()
    
    for (const boundary of boundaries) {
      if (boundary === 0 || boundary === duration) continue
      if (Math.abs(boundary - time) < threshold) {
        return boundary
      }
    }
    return null
  }

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = getTimeFromPosition(e.clientX)
    const affectedSegment = segments.find(
      (seg) => time > seg.startTime && time < seg.endTime
    )
    if (affectedSegment) {
      setHoverPosition(time)
    }
  }

  const handleMouseLeave = () => {
    setHoverPosition(null)
  }

  const handleBoundaryMouseDown = (boundary: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (boundary === 0 || boundary === duration) {
      return
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

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingBoundary !== null) return
    
    const time = getTimeFromPosition(e.clientX)
    const nearestBoundary = findNearestBoundary(time, 3)

    if (isCtrlPressed) {
      const clickedSegment = segments.find(
        (seg) => time >= seg.startTime && time <= seg.endTime
      )
      
      if (clickedSegment) {
        removeSegment(clickedSegment)
      }
    } else if (nearestBoundary !== null && !isShiftPressed) {
      onSeek(nearestBoundary)
    } else if (isShiftPressed) {
      addBoundary(time)
    } else {
      onSeek(time)
    }
  }

  const removeSegment = (segmentToRemove: Segment) => {
    if (segments.length <= 1) {
      return
    }

    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime)
    const index = sortedSegments.findIndex((seg) => seg.id === segmentToRemove.id)
    
    if (index === -1) return
    
    const isFirstOriginalSegment = 
      index === 0 && 
      segmentToRemove.startTime === 0 &&
      originalSegments.some(s => s.id === segmentToRemove.id && s.startTime === 0)
    
    const isLastOriginalSegment = 
      index === sortedSegments.length - 1 &&
      segmentToRemove.endTime === duration &&
      originalSegments.some(s => s.id === segmentToRemove.id && s.endTime === duration)
    
    if (isFirstOriginalSegment || isLastOriginalSegment) {
      return
    }
    
    const segmentBefore = sortedSegments[index - 1]
    const segmentAfter = sortedSegments[index + 1]
    
    if (segmentBefore && segmentAfter) {
      const midpoint = (segmentToRemove.startTime + segmentToRemove.endTime) / 2
      const updatedSegments = segments
        .filter((seg) => seg.id !== segmentToRemove.id)
        .map((seg) =>
          seg.id === segmentBefore.id
            ? { ...seg, endTime: midpoint }
            : seg.id === segmentAfter.id
            ? { ...seg, startTime: midpoint }
            : seg
        )
      onSegmentChange(updatedSegments)
    } else if (segmentBefore && !segmentAfter) {
      const updatedSegments = segments
        .filter((seg) => seg.id !== segmentToRemove.id)
        .map((seg) =>
          seg.id === segmentBefore.id
            ? { ...seg, endTime: segmentToRemove.endTime }
            : seg
        )
      onSegmentChange(updatedSegments)
    } else if (!segmentBefore && segmentAfter) {
      const updatedSegments = segments
        .filter((seg) => seg.id !== segmentToRemove.id)
        .map((seg) =>
          seg.id === segmentAfter.id
            ? { ...seg, startTime: segmentToRemove.startTime }
            : seg
        )
      onSegmentChange(updatedSegments)
    }
  }

  const addBoundary = (time: number) => {
    if (time < MIN_SEGMENT_DURATION || time > duration - MIN_SEGMENT_DURATION) {
      return
    }

    const boundaries = getBoundaries()
    if (boundaries.some(b => Math.abs(b - time) < MIN_SEGMENT_DURATION)) {
      return
    }

    const affectedSegment = segments.find(
      (seg) => time > seg.startTime && time < seg.endTime
    )

    if (affectedSegment) {
      const newSegment: Segment = {
        id: `segment-${Date.now()}`,
        title: 'New Segment',
        startTime: time,
        endTime: affectedSegment.endTime,
        description: '',
      }

      const updatedSegments = segments.map((seg) =>
        seg.id === affectedSegment.id
          ? { ...seg, endTime: time }
          : seg
      )
      
      onSegmentChange([...updatedSegments, newSegment])
    }
  }

  const handlePlayheadAddClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addBoundary(currentTime)
  }

  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0

  const generateTimeGrid = () => {
    const gridLines: number[] = []
    let interval = 30
    
    if (duration <= 60) {
      interval = 10
    } else if (duration <= 180) {
      interval = 30
    } else if (duration <= 600) {
      interval = 60
    } else {
      interval = 120
    }

    for (let time = interval; time < duration; time += interval) {
      gridLines.push(time)
    }

    return gridLines
  }

  const timeGrid = generateTimeGrid()

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Timeline</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Plus size={14} weight="bold" />
            <span>Shift+Click to add split</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Trash size={14} weight="bold" />
            <span>Ctrl+Click to remove segment</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Drag split to move</span>
          </div>
        </div>
      </div>

      <Card className="p-0 overflow-visible">
        <div
          ref={timelineRef}
          className="relative h-24 bg-muted/30 cursor-pointer overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleTimelineClick}
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
          }}
        >
          {timeGrid.map((time) => {
            const position = duration > 0 ? (time / duration) * 100 : 0
            return (
              <div
                key={`grid-${time}`}
                className="absolute top-0 h-full w-px bg-border"
                style={{ left: `${position}%` }}
              >
                <div className="absolute -top-5 left-0 -translate-x-1/2 text-xs text-muted-foreground">
                  {formatTime(time)}
                </div>
              </div>
            )
          })}

          {segments.map((segment, index) => {
            const left = duration > 0 ? (segment.startTime / duration) * 100 : 0
            const right = duration > 0 ? ((duration - segment.endTime) / duration) * 100 : 0
            const width = 100 - left - right
            const colors = [
              'bg-chart-1/20',
              'bg-chart-2/20',
              'bg-chart-3/20',
              'bg-chart-4/20',
              'bg-chart-5/20',
            ]
            const color = colors[index % colors.length]

            return (
              <div
                key={segment.id}
                className={cn(
                  'absolute top-0 h-full border-l border-r border-border',
                  color
                )}
                style={{ 
                  left: `${left}%`, 
                  right: `${right}%`,
                }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center px-2 gap-0.5">
                  <span className="text-xs font-medium truncate w-full text-center">{segment.title}</span>
                  {width > 8 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {getBoundaries().map((boundary) => {
            const position = duration > 0 ? (boundary / duration) * 100 : 0
            const isEdge = boundary === 0 || boundary === duration
            const isHovered = hoverPosition !== null && findNearestBoundary(hoverPosition, 3) === boundary

            return (
              <div
                key={`boundary-${boundary}`}
                className="absolute top-0 h-full z-20"
                style={{ left: `${position}%` }}
              >
                <div
                  className={cn(
                    'absolute top-0 h-full w-1 -translate-x-1/2 transition-all',
                    isEdge ? 'bg-border cursor-default' : 'bg-foreground/40 cursor-col-resize hover:bg-primary hover:w-1.5',
                    draggingBoundary === boundary && 'bg-primary w-1.5'
                  )}
                  onMouseDown={(e) => handleBoundaryMouseDown(boundary, e)}
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                  }}
                />
                {(isHovered || draggingBoundary === boundary) && !isEdge && (
                  <div
                    className={cn(
                      'absolute -top-6 left-0 -translate-x-1/2 px-1.5 py-0.5 rounded text-xs whitespace-nowrap pointer-events-none',
                      'bg-primary text-primary-foreground'
                    )}
                  >
                    {formatTime(boundary)}
                  </div>
                )}
              </div>
            )
          })}

          {hoverPosition !== null && findNearestBoundary(hoverPosition, 3) === null && (
            <div
              className="absolute top-0 h-full w-px bg-foreground/20 pointer-events-none z-15"
              style={{ left: `${duration > 0 ? (hoverPosition / duration) * 100 : 0}%` }}
            />
          )}

          <div
            className="absolute top-0 h-full w-0.5 bg-primary z-40"
            style={{ left: `${playheadPosition}%` }}
          >
            <button
              onClick={handlePlayheadAddClick}
              className="absolute -top-2 -left-2.5 w-5 h-5 bg-primary rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 hover:scale-110 transition-transform cursor-pointer z-50"
              title="Add segment at current position"
            >
              <Plus size={14} weight="bold" className="text-primary-foreground" />
            </button>
            <div className="absolute top-0 left-0.5 w-px h-full bg-primary/50 pointer-events-none" />
          </div>
        </div>

        <div className="relative h-6 px-0">
          <div className="absolute top-0 left-0 w-full h-px bg-border" />
          
          <div className="absolute top-0 left-0 text-xs text-muted-foreground font-mono">
            {formatTime(0)}
          </div>
          
          {timeGrid.map((time) => {
            const position = duration > 0 ? (time / duration) * 100 : 0
            // Hide grid labels that are too close to the end timestamp to prevent overlap
            const isTooCloseToEnd = duration - time < 15
            if (isTooCloseToEnd) return null
            return (
              <div
                key={`time-label-${time}`}
                className="absolute top-0 text-xs text-muted-foreground font-mono"
                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              >
                {formatTime(time)}
              </div>
            )
          })}
          
          <div className="absolute top-0 right-0 text-xs text-muted-foreground font-mono">
            {formatTime(duration)}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
        <span className="font-mono">Current: {formatTime(currentTime)}</span>
      </div>
    </div>
  )
}
