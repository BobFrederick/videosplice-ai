import { useRef, useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Plus, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Segment } from '@/lib/types'

interface TimelineProps {
  segments: Segment[]
  duration: number
  currentTime: number
  onSegmentChange: (segments: Segment[]) => void
  onSeek: (time: number) => void
  className?: string
}

export function Timeline({
  segments,
  duration,
  currentTime,
  onSegmentChange,
  onSeek,
  className,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const segmentsRef = useRef<Segment[]>(segments)
  const [draggingBoundary, setDraggingBoundary] = useState<number | null>(null)
  const draggingSegmentsRef = useRef<{ left: Segment; right: Segment } | null>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const [originalSegments] = useState<Segment[]>(segments)
  
  const MIN_SEGMENT_DURATION = 10

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
    return percentage * duration
  }

  const getBoundaries = (): number[] => {
    const boundaries: number[] = []
    segments.forEach((segment) => {
      if (!boundaries.includes(segment.startTime)) {
        boundaries.push(segment.startTime)
      }
      if (!boundaries.includes(segment.endTime)) {
        boundaries.push(segment.endTime)
      }
    })
    return boundaries.sort((a, b) => a - b)
  }

  const getInteriorBoundaries = (): number[] => {
    const boundaries = getBoundaries()
    return boundaries.filter(b => b !== 0 && b !== duration)
  }

  const findNearestBoundary = (time: number, threshold: number = 2): number | null => {
    const boundaries = getInteriorBoundaries()
    
    for (const boundary of boundaries) {
      if (Math.abs(boundary - time) <= threshold) {
        return boundary
      }
    }
    return null
  }

  useEffect(() => {
    if (draggingBoundary === null) return

    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    let animationFrameId: number | null = null

    const handleGlobalMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = requestAnimationFrame(() => {
        if (!timelineRef.current || !draggingSegmentsRef.current) return
        
        const rect = timelineRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / rect.width))
        const time = percentage * duration
        
        const { left: leftSegment, right: rightSegment } = draggingSegmentsRef.current
        const currentSegments = segmentsRef.current
        
        const minTime = leftSegment.startTime + MIN_SEGMENT_DURATION
        const maxTime = rightSegment.endTime - MIN_SEGMENT_DURATION
        
        const clampedTime = Math.max(minTime, Math.min(maxTime, time))

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
        animationFrameId = null
      })
    }

    const handleGlobalMouseUp = (e: MouseEvent) => {
      e.preventDefault()
      
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      
      setDraggingBoundary(null)
      draggingSegmentsRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleGlobalMouseMove, { capture: true, passive: false })
    document.addEventListener('mouseup', handleGlobalMouseUp, { capture: true, passive: false })

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      document.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true } as EventListenerOptions)
      document.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true } as EventListenerOptions)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [draggingBoundary, onSegmentChange, duration])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingBoundary !== null) {
      const time = getTimeFromPosition(e.clientX)
      setHoverPosition(time)
      return
    }
    const time = getTimeFromPosition(e.clientX)
    setHoverPosition(time)
  }

  const handleMouseLeave = () => {
    if (draggingBoundary !== null) return
    setHoverPosition(null)
  }

  const handleBoundaryMouseDown = (boundary: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const leftSegment = segments.find(s => s.endTime === boundary)
    const rightSegment = segments.find(s => s.startTime === boundary)
    
    if (!leftSegment || !rightSegment) return
    
    draggingSegmentsRef.current = { left: leftSegment, right: rightSegment }
    setDraggingBoundary(boundary)
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingBoundary !== null) return
    
    const time = getTimeFromPosition(e.clientX)

    if (isCtrlPressed) {
      const clickedSegment = segments.find(
        (seg) => time >= seg.startTime && time <= seg.endTime
      )
      
      if (clickedSegment) {
        removeSegment(clickedSegment)
      }
    } else if (isShiftPressed) {
      addBoundary(time)
    }
  }

  const removeSegment = (segmentToRemove: Segment) => {
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
    
    if (segments.length <= 1) {
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

  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0
  const interiorBoundaries = getInteriorBoundaries()

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
          <span className="text-xs text-muted-foreground font-mono">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <Card
        ref={timelineRef}
        className={cn(
          'relative h-32 overflow-visible pt-6 p-0 select-none',
          isShiftPressed ? 'cursor-crosshair' : isCtrlPressed ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
        onClick={handleTimelineClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      >
        <div className="absolute inset-0 bg-muted/20 overflow-hidden">
          {timeGrid.map((time) => {
            const position = duration > 0 ? (time / duration) * 100 : 0
            return (
              <div
                key={`grid-${time}`}
                className="absolute top-0 h-full w-px bg-border/50 z-0"
                style={{ left: `${position}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                  {formatTime(time)}
                </div>
              </div>
            )
          })}

          {segments.map((segment, index) => {
            const left = duration > 0 ? (segment.startTime / duration) * 100 : 0
            const right = duration > 0 ? ((duration - segment.endTime) / duration) * 100 : 0
            
            const colors = [
              'bg-primary/20',
              'bg-accent/20',
              'bg-chart-1/20',
              'bg-chart-2/20',
              'bg-chart-3/20',
            ]
            const color = colors[index % colors.length]

            return (
              <div
                key={segment.id}
                className={cn('absolute top-0 h-full z-10', color)}
                style={{ 
                  left: `${left}%`, 
                  right: `${right}%`,
                }}
              >
                <div className="px-3 py-2 h-full flex flex-col justify-center">
                  <p className="text-sm font-medium truncate text-foreground">{segment.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                  </p>
                </div>
              </div>
            )
          })}

          {interiorBoundaries.map((boundary, boundaryIndex) => {
            const isDraggingThis = draggingBoundary === boundary
            const position = duration > 0 ? (boundary / duration) * 100 : 0
            const isHovered = hoverPosition !== null && findNearestBoundary(hoverPosition, 2) === boundary && !isDraggingThis

            return (
              <div
                key={boundary}
                className={cn(
                  'absolute top-0 h-full transition-all group',
                )}
                style={{ 
                  left: `${position}%`,
                  zIndex: isDraggingThis ? 30 : 20
                }}
              >
                <div
                  className={cn(
                    'absolute inset-0 -left-4 -right-4',
                  )}
                  onMouseDown={(e) => {
                    handleBoundaryMouseDown(boundary, e)
                  }}
                  onDragStart={(e) => {
                    e.preventDefault()
                  }}
                  style={{
                    cursor: 'ew-resize',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                  }}
                />

                <div
                  className={cn(
                    'absolute inset-0 border-l-2 border-dashed transition-all pointer-events-none',
                    isDraggingThis
                      ? 'border-primary border-l-[3px]'
                      : isHovered
                      ? 'border-primary border-l-[3px]'
                      : 'border-border'
                  )}
                />

                {(isDraggingThis || isHovered) && (
                  <div
                    className={cn(
                      'absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap shadow-lg z-50 pointer-events-none',
                      'bg-primary text-primary-foreground'
                    )}
                  >
                    {formatTime(boundary)}
                  </div>
                )}
              </div>
            )
          })}

          {hoverPosition !== null && findNearestBoundary(hoverPosition, 2) === null && (
            <div
              className="absolute top-0 h-full w-px bg-foreground/20 pointer-events-none z-15"
              style={{ left: `${duration > 0 ? (hoverPosition / duration) * 100 : 0}%` }}
            />
          )}

          <div
            className="absolute top-0 h-full w-0.5 bg-primary pointer-events-none z-40"
            style={{ left: `${playheadPosition}%` }}
          >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-primary rounded-full shadow-lg" />
            <div className="absolute top-0 left-0.5 w-px h-full bg-primary/50" />
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
