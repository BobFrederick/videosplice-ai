import { useRef, useState, useCallback } from 'react'
import { Scissors, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  const [draggingSegment, setDraggingSegment] = useState<string | null>(null)
  const [draggingEdge, setDraggingEdge] = useState<'start' | 'end' | null>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || draggingSegment) return

    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const time = percentage * duration

    onSeek(time)
  }

  const handleDragStart = (segmentId: string, edge: 'start' | 'end') => {
    setDraggingSegment(segmentId)
    setDraggingEdge(edge)
  }

  const handleDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!draggingSegment || !draggingEdge || !timelineRef.current) return

      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, x / rect.width))
      const time = percentage * duration

      const updatedSegments = segments.map((segment) => {
        if (segment.id === draggingSegment) {
          if (draggingEdge === 'start') {
            return {
              ...segment,
              startTime: Math.min(time, segment.endTime - 1),
            }
          } else {
            return {
              ...segment,
              endTime: Math.max(time, segment.startTime + 1),
            }
          }
        }
        return segment
      })

      onSegmentChange(updatedSegments)
    },
    [draggingSegment, draggingEdge, duration, segments, onSegmentChange]
  )

  const handleDragEnd = () => {
    setDraggingSegment(null)
    setDraggingEdge(null)
  }

  const getSegmentPosition = (segment: Segment) => {
    const left = (segment.startTime / duration) * 100
    const width = ((segment.endTime - segment.startTime) / duration) * 100
    return { left: `${left}%`, width: `${width}%` }
  }

  const playheadPosition = (currentTime / duration) * 100

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Timeline</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <Card
        ref={timelineRef}
        className="relative h-24 cursor-crosshair overflow-hidden"
        onClick={handleTimelineClick}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="absolute inset-0 bg-muted/30">
          {segments.map((segment, index) => {
            const { left, width } = getSegmentPosition(segment)
            const colors = [
              'bg-primary/20 border-primary',
              'bg-accent/20 border-accent',
              'bg-secondary/20 border-secondary',
            ]
            const color = colors[index % colors.length]

            return (
              <div
                key={segment.id}
                className={cn(
                  'absolute top-0 h-full border-2 transition-all',
                  color,
                  draggingSegment === segment.id && 'ring-2 ring-ring'
                )}
                style={{ left, width }}
              >
                <div
                  className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-current opacity-50 hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleDragStart(segment.id, 'start')
                  }}
                />
                
                <div className="px-2 py-1 overflow-hidden">
                  <p className="text-xs font-medium truncate">{segment.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                  </p>
                </div>

                <div
                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-current opacity-50 hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleDragStart(segment.id, 'end')
                  }}
                />
              </div>
            )
          })}

          <div
            className="absolute top-0 h-full w-0.5 bg-primary pointer-events-none z-10"
            style={{ left: `${playheadPosition}%` }}
          >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-primary rounded-full" />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Scissors size={14} />
        <span>Drag segment edges to adjust boundaries</span>
      </div>
    </div>
  )
}
