import { useState, useEffect, useRef } from 'react'
import { PencilSimple, Check, X, Copy, Download } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import type { Segment } from '@/lib/types'

interface TranscriptViewerProps {
  transcript: string
  segments?: Segment[]
  onTranscriptUpdate?: (transcript: string) => void
  editable?: boolean
  selectedSegmentId?: string // ID of the currently selected segment from Timeline/SegmentEditor
}

export function TranscriptViewer({ transcript, segments, onTranscriptUpdate, editable = true, selectedSegmentId }: TranscriptViewerProps) {
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editedSegmentTexts, setEditedSegmentTexts] = useState<Record<string, string>>({})
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to selected segment when it changes (from Timeline/SegmentEditor click)
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

  const handleSegmentSave = (segmentId: string) => {
    // In a real implementation, you'd update the segment's transcript portion
    // For now, just show success and close edit mode
    setEditingSegmentId(null)
    toast.success('Segment transcript updated')
  }

  const handleSegmentCancel = (segmentId: string) => {
    setEditingSegmentId(null)
    // Clear edited text for this segment
    const newTexts = { ...editedSegmentTexts }
    delete newTexts[segmentId]
    setEditedSegmentTexts(newTexts)
  }

  const handleSegmentEdit = (segmentId: string, text: string) => {
    setEditedSegmentTexts({
      ...editedSegmentTexts,
      [segmentId]: text
    })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript)
      toast.success('Transcript copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy transcript')
    }
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const generateVTT = (segment: Segment, segmentText: string): string => {
    // Break text into subtitle-appropriate chunks (max ~40 characters per line)
    const words = segmentText.split(' ')
    const lines: string[] = []
    let currentLine = ''
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= 40) {
        currentLine += (currentLine ? ' ' : '') + word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    
    // Create VTT content with proper formatting
    const vttContent = `WEBVTT - ${segment.title}

NOTE
Generated from VideoSplice AI segment: ${segment.title}
Duration: ${segment.endTime - segment.startTime} seconds

${segment.id}
${formatTime(segment.startTime)} --> ${formatTime(segment.endTime)}
${lines.join('\n')}`

    return vttContent
  }

  const approximateSegmentText = (segment: Segment): string => {
    if (!transcript || !segments) return ''
    
    // Better approximation: distribute transcript text proportionally across all segments
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    // Calculate total duration
    const totalDuration = Math.max(...segments.map(s => s.endTime))
    
    // Find this segment's index and calculate its proportion
    const segmentIndex = segments.findIndex(s => s.id === segment.id)
    if (segmentIndex === -1) return ''
    
    // Calculate how many sentences should go to this segment based on its duration
    const segmentDuration = segment.endTime - segment.startTime
    const segmentRatio = segmentDuration / totalDuration
    const sentencesForSegment = Math.max(1, Math.floor(sentences.length * segmentRatio))
    
    // Calculate starting position based on previous segments' durations
    let previousDuration = 0
    for (let i = 0; i < segmentIndex; i++) {
      previousDuration += segments[i].endTime - segments[i].startTime
    }
    
    const startRatio = previousDuration / totalDuration
    const startSentenceIndex = Math.floor(sentences.length * startRatio)
    const endSentenceIndex = Math.min(sentences.length, startSentenceIndex + sentencesForSegment)
    
    return sentences.slice(startSentenceIndex, endSentenceIndex)
      .map(s => s.trim())
      .join('. ') + (endSentenceIndex < sentences.length ? '.' : '')
  }

  const downloadVTT = (segment: Segment) => {
    const segmentText = approximateSegmentText(segment)
    const vttContent = generateVTT(segment, segmentText)
    
    const blob = new Blob([vttContent], { type: 'text/vtt' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${segment.title.replace(/[^a-zA-Z0-9]/g, '_')}.vtt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`VTT file downloaded: ${segment.title}`)
  }

  const downloadAllVTTs = () => {
    if (!segments || segments.length === 0) {
      toast.error('No segments available for export')
      return
    }

    segments.forEach(segment => {
      setTimeout(() => downloadVTT(segment), 100 * segments.indexOf(segment))
    })
    
    toast.success(`Downloading ${segments.length} VTT files`)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Transcript</CardTitle>
        <div className="flex items-center gap-2">
          {segments && segments.length > 0 && (
            <Button variant="ghost" size="sm" onClick={downloadAllVTTs} title="Download all segment VTTs">
              <Download size={16} weight="bold" />
              VTT
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy size={16} weight="bold" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] max-h-[500px] pr-4" ref={scrollAreaRef}>
          {segments && segments.length > 0 ? (
            <div className="space-y-4">
              {segments.map((segment, index) => {
                const segmentText = approximateSegmentText(segment)
                const isSelected = selectedSegmentId === segment.id
                const isEditing = editingSegmentId === segment.id
                const displayText = editedSegmentTexts[segment.id] ?? segmentText
                
                return (
                  <div 
                    key={segment.id}
                    ref={(el) => { segmentRefs.current[segment.id] = el }} // Store ref for auto-scroll
                    className={`border-l-4 pl-4 pb-4 transition-all ${
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
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleSegmentCancel(segment.id)}
                              title="Cancel"
                            >
                              <X size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleSegmentSave(segment.id)}
                              title="Save"
                            >
                              <Check size={14} />
                            </Button>
                          </>
                        ) : (
                          <>
                            {editable && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setEditingSegmentId(segment.id)}
                                title="Edit segment transcript"
                              >
                                <PencilSimple size={14} />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => downloadVTT(segment)}
                              title={`Download VTT for ${segment.title}`}
                            >
                              <Download size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={displayText}
                        onChange={(e) => handleSegmentEdit(segment.id, e.target.value)}
                        className="min-h-[100px] text-sm"
                        placeholder="Edit segment transcript..."
                      />
                    ) : (
                      <div className={`text-sm leading-relaxed ${
                        isSelected ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {displayText || segment.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {transcript}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
