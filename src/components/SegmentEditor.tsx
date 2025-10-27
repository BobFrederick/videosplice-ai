import { PencilSimple, Trash } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Segment } from '@/lib/types'
import { useEffect, useRef } from 'react'

interface SegmentEditorProps {
  segments: Segment[]
  onSegmentChange: (segments: Segment[]) => void
  onSegmentSelect: (segment: Segment) => void
  selectedSegmentId?: string
  duration?: number
}

export function SegmentEditor({
  segments,
  onSegmentChange,
  onSegmentSelect,
  selectedSegmentId,
  duration,
}: SegmentEditorProps) {
  // Store refs to each segment card for scrolling when selected from Timeline
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to segment when selected (triggered by Timeline click or SegmentEditor click)
  // This creates bidirectional sync: Timeline -> SegmentEditor and SegmentEditor -> VideoPlayer
  useEffect(() => {
    if (selectedSegmentId && segmentRefs.current[selectedSegmentId] && scrollAreaRef.current) {
      const segmentElement = segmentRefs.current[selectedSegmentId]
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      
      if (segmentElement && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect()
        const elementRect = segmentElement.getBoundingClientRect()
        const scrollTop = scrollContainer.scrollTop
        
        // Calculate the position to scroll to (center the element)
        const targetScrollTop = scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2) + (elementRect.height / 2)
        
        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        })
      }
    }
  }, [selectedSegmentId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const updateSegment = (id: string, updates: Partial<Segment>) => {
    const updated = segments.map((seg) =>
      seg.id === id ? { ...seg, ...updates } : seg
    )
    onSegmentChange(updated)
  }

  const deleteSegment = (id: string) => {
    const segmentToDelete = segments.find((seg) => seg.id === id)
    if (!segmentToDelete) return

    if (segments.length === 1) {
      onSegmentChange([])
      return
    }

    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime)
    const index = sortedSegments.findIndex((seg) => seg.id === id)

    if (index === -1) return

    const segmentBefore = sortedSegments[index - 1]
    const segmentAfter = sortedSegments[index + 1]

    if (segmentBefore && !segmentAfter) {
      const updated = segments
        .filter((seg) => seg.id !== id)
        .map((seg) =>
          seg.id === segmentBefore.id
            ? { ...seg, endTime: segmentToDelete.endTime }
            : seg
        )
      onSegmentChange(updated)
    } else if (!segmentBefore && segmentAfter) {
      const updated = segments
        .filter((seg) => seg.id !== id)
        .map((seg) =>
          seg.id === segmentAfter.id
            ? { ...seg, startTime: segmentToDelete.startTime }
            : seg
        )
      onSegmentChange(updated)
    } else if (segmentBefore && segmentAfter) {
      const midpoint = (segmentToDelete.startTime + segmentToDelete.endTime) / 2
      const updated = segments
        .filter((seg) => seg.id !== id)
        .map((seg) =>
          seg.id === segmentBefore.id
            ? { ...seg, endTime: midpoint }
            : seg.id === segmentAfter.id
            ? { ...seg, startTime: midpoint }
            : seg
        )
      onSegmentChange(updated)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">Segments</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-6" ref={scrollAreaRef}>
          <div className="space-y-3 py-2 px-1">
            {segments.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No segments yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use Shift+Click on the timeline to add segments
                </p>
              </div>
            ) : (
              [...segments]
                .sort((a, b) => a.startTime - b.startTime)
                .map((segment, index) => (
                <Card
                  key={segment.id}
                  ref={(el) => { segmentRefs.current[segment.id] = el }} // Store ref for auto-scroll on Timeline click
                  className={`cursor-pointer transition-all ${
                    selectedSegmentId === segment.id
                      ? 'ring-2 ring-primary'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => onSegmentSelect(segment)} // Seeks video to segment start time
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="space-y-1">
                          <Label htmlFor={`title-${segment.id}`} className="text-xs">
                            Title
                          </Label>
                          <Input
                            id={`title-${segment.id}`}
                            value={segment.title}
                            onChange={(e) =>
                              updateSegment(segment.id, { title: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Start</Label>
                            <Input
                              value={formatTime(segment.startTime)}
                              readOnly
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End</Label>
                            <Input
                              value={formatTime(segment.endTime)}
                              readOnly
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`desc-${segment.id}`} className="text-xs">
                            Description (optional)
                          </Label>
                          <Textarea
                            id={`desc-${segment.id}`}
                            value={segment.description || ''}
                            onChange={(e) =>
                              updateSegment(segment.id, {
                                description: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm resize-none"
                            rows={2}
                          />
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSegment(segment.id)
                        }}
                      >
                        <Trash size={16} className="text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Segment {index + 1}</span>
                      <span>•</span>
                      <span>
                        {formatTime(segment.endTime - segment.startTime)} duration
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
