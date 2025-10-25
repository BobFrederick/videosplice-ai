import { useState } from 'react'
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
}

export function TranscriptViewer({ transcript, segments, onTranscriptUpdate, editable = true }: TranscriptViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState(transcript)

  const handleSave = () => {
    if (onTranscriptUpdate) {
      onTranscriptUpdate(editedTranscript)
    }
    setIsEditing(false)
    toast.success('Transcript updated')
  }

  const handleCancel = () => {
    setEditedTranscript(transcript)
    setIsEditing(false)
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
          {!isEditing && (
            <>
              {segments && segments.length > 0 && (
                <Button variant="ghost" size="sm" onClick={downloadAllVTTs} title="Download all segment VTTs">
                  <Download size={16} weight="bold" />
                  VTT
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                <Copy size={16} weight="bold" />
              </Button>
              {editable && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <PencilSimple size={16} weight="bold" />
                </Button>
              )}
            </>
          )}
          {isEditing && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X size={16} weight="bold" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSave}>
                <Check size={16} weight="bold" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
            className="min-h-[300px] max-h-[500px] font-mono text-sm"
            placeholder="Enter transcript..."
          />
        ) : (
          <ScrollArea className="h-[300px] max-h-[500px] pr-4">
            {segments && segments.length > 0 ? (
              <div className="space-y-6">
                {segments.map((segment, index) => {
                  const segmentText = approximateSegmentText(segment)
                  return (
                    <div key={segment.id} className="border-l-4 border-l-purple-500 pl-4 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-sm text-foreground">{segment.title}</h3>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => downloadVTT(segment)}
                          title={`Download VTT for ${segment.title}`}
                        >
                          <Download size={14} />
                        </Button>
                      </div>
                      <div className="text-sm text-foreground/80 leading-relaxed">
                        {segmentText || segment.description}
                      </div>
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
        )}
      </CardContent>
    </Card>
  )
}
