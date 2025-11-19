import { useState, useEffect, useRef, useCallback } from 'react'
import { PencilSimple, Check, X, Copy, Download, Scissors, Plus, Info } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { toast } from 'sonner'
import type { Segment, WhisperSegment } from '@/lib/types'

interface TranscriptViewerTextBasedProps {
  transcript: string
  segments?: Segment[]
  whisperSegments?: WhisperSegment[]
  onTranscriptUpdate?: (transcript: string) => void
  onSegmentChange?: (segments: Segment[]) => void
  editable?: boolean
  selectedSegmentId?: string
}

export function TranscriptViewerTextBased({ 
  transcript, 
  segments = [], 
  whisperSegments = [],
  onTranscriptUpdate, 
  onSegmentChange,
  editable = true, 
  selectedSegmentId 
}: TranscriptViewerTextBasedProps) {
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editedSegmentTexts, setEditedSegmentTexts] = useState<Record<string, string>>({})
  const [selectedText, setSelectedText] = useState<{ text: string; startTime: number; endTime: number } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to selected segment when it changes
  useEffect(() => {
    if (selectedSegmentId && segmentRefs.current[selectedSegmentId] && scrollAreaRef.current) {
      const segmentElement = segmentRefs.current[selectedSegmentId]
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      
      if (segmentElement && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect()
        const elementRect = segmentElement.getBoundingClientRect()
        const scrollTop = scrollContainer.scrollTop
        
        const targetScrollTop = scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2) + (elementRect.height / 2)
        
        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        })
      }
    }
  }, [selectedSegmentId])

  // Get timestamp range for selected text
  const getTimestampForTextSelection = useCallback((): { startTime: number; endTime: number } | null => {
    if (!whisperSegments || whisperSegments.length === 0) {
      return null
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      return null
    }

    // Ensure the selection is within our transcript ref
    if (!transcriptRef.current || !transcriptRef.current.contains(selection.anchorNode)) {
      return null
    }

    // Get the selected text content
    const selectedText = selection.toString()
    
    // Find the character positions of the selection in the full transcript
    const range = selection.getRangeAt(0)
    const preSelectionRange = range.cloneRange()
    
    try {
      preSelectionRange.selectNodeContents(transcriptRef.current!)
      preSelectionRange.setEnd(range.startContainer, range.startOffset)
    } catch (error) {
      console.error('Error calculating text selection:', error)
      return null
    }
    
    const startCharOffset = preSelectionRange.toString().length
    const endCharOffset = startCharOffset + selectedText.length

    // Map character positions to whisper segments
    let currentCharPos = 0
    let startTime: number | null = null
    let endTime: number | null = null

    for (const whisperSeg of whisperSegments) {
      const segTextLength = whisperSeg.text.length
      const segStartChar = currentCharPos
      const segEndChar = currentCharPos + segTextLength

      // Check if this segment overlaps with the selection
      if (startTime === null && segEndChar > startCharOffset) {
        startTime = whisperSeg.start
      }

      if (segStartChar < endCharOffset) {
        endTime = whisperSeg.end
      }

      if (segStartChar >= endCharOffset) {
        break
      }

      currentCharPos = segEndChar + 1 // +1 for space between segments
    }

    if (startTime !== null && endTime !== null) {
      return { startTime, endTime }
    }

    return null
  }, [whisperSegments])

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.toString().trim() === '') {
      setSelectedText(null)
      return
    }

    const timestamps = getTimestampForTextSelection()
    console.log('📝 Text selected:', selection.toString().substring(0, 50), 'Timestamps:', timestamps)
    if (timestamps) {
      setSelectedText({
        text: selection.toString(),
        startTime: timestamps.startTime,
        endTime: timestamps.endTime
      })
    }
  }, [getTimestampForTextSelection])

  // Handle delete key to split/modify segments
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedText && onSegmentChange) {
      e.preventDefault()
      
      // Validate minimum duration for split segments
      const MIN_SEGMENT_DURATION = 1.0 // 1 second minimum
      const selectionDuration = selectedText.endTime - selectedText.startTime
      
      if (selectionDuration < MIN_SEGMENT_DURATION) {
        toast.error(`Selection too short (${selectionDuration.toFixed(1)}s). Minimum ${MIN_SEGMENT_DURATION}s required.`)
        return
      }
      
      // Find segments that overlap with the selected text
      const affectedSegments = segments.filter(seg => 
        !(selectedText.endTime <= seg.startTime || selectedText.startTime >= seg.endTime)
      )

      if (affectedSegments.length === 0) {
        toast.error('No segments overlap with selected text')
        return
      }

      // Split or modify segments based on selection
      const newSegments = [...segments]
      let modificationsCount = 0
      
      affectedSegments.forEach(segment => {
        const segIndex = newSegments.findIndex(s => s.id === segment.id)
        if (segIndex === -1) return

        // Case 1: Selection is entirely within the segment
        if (selectedText.startTime > segment.startTime && selectedText.endTime < segment.endTime) {
          const leftDuration = selectedText.startTime - segment.startTime
          const rightDuration = segment.endTime - selectedText.endTime
          
          // Ensure both resulting segments meet minimum duration
          if (leftDuration < MIN_SEGMENT_DURATION || rightDuration < MIN_SEGMENT_DURATION) {
            toast.error(`Split would create segments shorter than ${MIN_SEGMENT_DURATION}s. Adjust selection.`)
            return
          }
          
          // Split into two segments
          const leftSegment: Segment = {
            ...segment,
            endTime: selectedText.startTime,
          }
          const rightSegment: Segment = {
            id: `segment-${Date.now()}-split`,
            title: segment.title + ' (split)',
            startTime: selectedText.endTime,
            endTime: segment.endTime,
            description: segment.description,
          }
          
          // Replace the original segment with two new ones
          newSegments.splice(segIndex, 1, leftSegment, rightSegment)
          modificationsCount++
        }
        // Case 2: Selection starts in the segment
        else if (selectedText.startTime >= segment.startTime && selectedText.startTime < segment.endTime) {
          const newDuration = selectedText.startTime - segment.startTime
          if (newDuration < MIN_SEGMENT_DURATION) {
            toast.error(`Operation would create a segment shorter than ${MIN_SEGMENT_DURATION}s`)
            return
          }
          newSegments[segIndex] = {
            ...segment,
            endTime: selectedText.startTime,
          }
          modificationsCount++
        }
        // Case 3: Selection ends in the segment
        else if (selectedText.endTime > segment.startTime && selectedText.endTime <= segment.endTime) {
          const newDuration = segment.endTime - selectedText.endTime
          if (newDuration < MIN_SEGMENT_DURATION) {
            toast.error(`Operation would create a segment shorter than ${MIN_SEGMENT_DURATION}s`)
            return
          }
          newSegments[segIndex] = {
            ...segment,
            startTime: selectedText.endTime,
          }
          modificationsCount++
        }
      })

      if (modificationsCount > 0) {
        onSegmentChange(newSegments)
        setSelectedText(null)
        window.getSelection()?.removeAllRanges()
        toast.success(`Modified ${modificationsCount} segment${modificationsCount > 1 ? 's' : ''}`)
      }
    }
  }, [selectedText, segments, onSegmentChange])

  // Create new segment from selected text
  const createSegmentFromSelection = useCallback(() => {
    if (!selectedText || !onSegmentChange) {
      toast.error('No text selected')
      return
    }

    const MIN_SEGMENT_DURATION = 1.0 // 1 second minimum
    const selectionDuration = selectedText.endTime - selectedText.startTime
    
    if (selectionDuration < MIN_SEGMENT_DURATION) {
      toast.error(`Selection too short (${selectionDuration.toFixed(1)}s). Minimum ${MIN_SEGMENT_DURATION}s required.`)
      return
    }

    // Check if there's already a segment that exactly matches this range
    const existingSegment = segments.find(seg => 
      Math.abs(seg.startTime - selectedText.startTime) < 0.5 && 
      Math.abs(seg.endTime - selectedText.endTime) < 0.5
    )

    if (existingSegment) {
      toast.error('A segment already exists for this time range')
      return
    }

    // Find segments that need to be split or adjusted
    const overlappingSegments = segments.filter(seg => 
      !(selectedText.endTime <= seg.startTime || selectedText.startTime >= seg.endTime)
    )

    let newSegments = [...segments]
    let modificationsCount = 0

    // Remove or split overlapping segments
    overlappingSegments.forEach(segment => {
      const segIndex = newSegments.findIndex(s => s.id === segment.id)
      if (segIndex === -1) return

      // If segment is completely contained within selection, remove it
      if (segment.startTime >= selectedText.startTime && segment.endTime <= selectedText.endTime) {
        newSegments.splice(segIndex, 1)
        modificationsCount++
      }
      // If selection is completely within segment, split it
      else if (selectedText.startTime > segment.startTime && selectedText.endTime < segment.endTime) {
        const leftDuration = selectedText.startTime - segment.startTime
        const rightDuration = segment.endTime - selectedText.endTime
        
        if (leftDuration < MIN_SEGMENT_DURATION || rightDuration < MIN_SEGMENT_DURATION) {
          toast.error(`Creating segment would result in segments shorter than ${MIN_SEGMENT_DURATION}s`)
          return
        }
        
        const leftSegment: Segment = {
          ...segment,
          endTime: selectedText.startTime,
        }
        const rightSegment: Segment = {
          id: `segment-${Date.now()}-right`,
          title: segment.title + ' (after)',
          startTime: selectedText.endTime,
          endTime: segment.endTime,
          description: segment.description,
        }
        newSegments.splice(segIndex, 1, leftSegment, rightSegment)
        modificationsCount++
      }
      // Partial overlaps - adjust boundaries
      else if (selectedText.startTime <= segment.startTime) {
        const newDuration = segment.endTime - selectedText.endTime
        if (newDuration < MIN_SEGMENT_DURATION) {
          newSegments.splice(segIndex, 1) // Remove if too short
        } else {
          newSegments[segIndex] = {
            ...segment,
            startTime: selectedText.endTime,
          }
        }
        modificationsCount++
      } else {
        const newDuration = selectedText.startTime - segment.startTime
        if (newDuration < MIN_SEGMENT_DURATION) {
          newSegments.splice(segIndex, 1) // Remove if too short
        } else {
          newSegments[segIndex] = {
            ...segment,
            endTime: selectedText.startTime,
          }
        }
        modificationsCount++
      }
    })

    // Add the new segment
    const newSegment: Segment = {
      id: `segment-${Date.now()}`,
      title: 'New Segment',
      startTime: selectedText.startTime,
      endTime: selectedText.endTime,
      description: selectedText.text.substring(0, 100) + (selectedText.text.length > 100 ? '...' : ''),
    }

    newSegments.push(newSegment)

    // Sort segments by start time
    newSegments.sort((a, b) => a.startTime - b.startTime)

    onSegmentChange(newSegments)
    setSelectedText(null)
    window.getSelection()?.removeAllRanges()
    toast.success(`Created new segment (modified ${modificationsCount} existing segment${modificationsCount !== 1 ? 's' : ''})`)
  }, [selectedText, segments, onSegmentChange])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript)
      toast.success('Transcript copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy transcript')
    }
  }

  // Render segment cards with inline word-level editing
  const renderSegmentCards = () => {
    if (!segments || segments.length === 0) {
      // No segments yet - show full transcript with word-level editing
      return (
        <ContextMenu>
          <ContextMenuTrigger>
            <div 
              ref={transcriptRef}
              className="text-sm text-foreground whitespace-pre-wrap leading-relaxed select-text cursor-text p-3 rounded-md hover:bg-muted/30 transition-colors"
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
            >
              {whisperSegments.map((whisperSeg, index) => (
                <span key={index}>
                  <span 
                    data-start={whisperSeg.start} 
                    data-end={whisperSeg.end}
                    className="hover:bg-primary/10 px-0.5 rounded transition-colors"
                  >
                    {whisperSeg.text}
                  </span>
                  {index < whisperSegments.length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem 
              onClick={createSegmentFromSelection}
              disabled={!selectedText}
            >
              <Plus size={16} className="mr-2" />
              Create Segment from Selection
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={() => {
                if (selectedText) {
                  const text = `${formatTime(selectedText.startTime)} - ${formatTime(selectedText.endTime)}`
                  navigator.clipboard.writeText(text)
                  toast.success('Timestamp copied to clipboard')
                }
              }}
              disabled={!selectedText}
            >
              <Copy size={16} className="mr-2" />
              Copy Timestamp
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )
    }

    // Segment cards with inline word-level editing
    return (
      <div className="space-y-4">
        {segments.map((segment) => {
          const isSelected = selectedSegmentId === segment.id
          
          // Get whisperSegments that fall within this segment's time range
          const segmentWhisperSegments = whisperSegments.filter(ws => 
            ws.start >= segment.startTime && ws.end <= segment.endTime
          )
          
          return (
            <ContextMenu key={segment.id}>
              <ContextMenuTrigger asChild>
                <div
                  ref={(el) => {
                    if (el) segmentRefs.current[segment.id] = el
                  }}
                  className={`border-l-4 pl-4 pb-4 transition-all cursor-text ${
                    isSelected 
                      ? 'border-l-purple-500' 
                      : 'border-l-gray-300 dark:border-l-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={isSelected ? '' : 'opacity-50'}>
                      <h3 className="font-medium text-sm">{segment.title}</h3>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Editable word-level transcript within the card */}
                  <div
                    className={`text-sm leading-relaxed select-text ${
                      isSelected ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                    onMouseUp={handleTextSelection}
                    onKeyUp={handleTextSelection}
                  >
                    {segmentWhisperSegments.length > 0 ? (
                      segmentWhisperSegments.map((whisperSeg, index) => (
                        <span key={index}>
                          <span
                            data-start={whisperSeg.start}
                            data-end={whisperSeg.end}
                            className="hover:bg-primary/10 px-0.5 rounded transition-colors"
                          >
                            {whisperSeg.text}
                          </span>
                          {index < segmentWhisperSegments.length - 1 ? ' ' : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic">
                        {segment.description || 'No transcript text available for this segment'}
                      </span>
                    )}
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem 
                  onClick={createSegmentFromSelection}
                  disabled={!selectedText}
                >
                  <Plus size={16} className="mr-2" />
                  Create Segment from Selection
                </ContextMenuItem>
                <ContextMenuItem 
                  onClick={() => {
                    if (selectedText) {
                      const text = `${formatTime(selectedText.startTime)} - ${formatTime(selectedText.endTime)}`
                      navigator.clipboard.writeText(text)
                      toast.success('Timestamp copied to clipboard')
                    }
                  }}
                  disabled={!selectedText}
                >
                  <Copy size={16} className="mr-2" />
                  Copy Timestamp
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">
          Transcript
          {whisperSegments && whisperSegments.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              (Text-based editing enabled)
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowHelp(!showHelp)}
            title="Show text-based editing help"
          >
            <Info size={16} weight="bold" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy size={16} weight="bold" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showHelp && (
          <Alert className="mb-4">
            <Info size={16} weight="bold" />
            <AlertTitle>Text-Based Editing</AlertTitle>
            <AlertDescription className="text-xs space-y-2 mt-2">
              <p><strong>Select text</strong> in the transcript to see its timestamp range.</p>
              <p><strong>Delete/Backspace:</strong> Split or trim segments at selection boundaries.</p>
              <p><strong>Right-click:</strong> Create a new segment from selected text.</p>
              <p><strong>Timestamps:</strong> Automatically mapped from speech recognition data.</p>
            </AlertDescription>
          </Alert>
        )}
        {selectedText && (
          <div className="mb-4 p-3 bg-primary/10 rounded-md border border-primary/20">
            <p className="text-xs font-medium text-primary mb-1">
              Selection: {formatTime(selectedText.startTime)} - {formatTime(selectedText.endTime)}
            </p>
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-background rounded border">Delete</kbd> to split/remove, 
              or right-click to create segment
            </p>
          </div>
        )}
        <ScrollArea className="h-[300px] max-h-[500px] pr-4" ref={scrollAreaRef}>
          {whisperSegments && whisperSegments.length > 0 ? (
            renderSegmentCards()
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {transcript || 'No transcript available. Upload a VTT file or process the video with Whisper.'}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
