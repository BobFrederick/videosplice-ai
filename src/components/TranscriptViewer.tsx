import { useState } from 'react'
import { PencilSimple, Check, X, Copy } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface TranscriptViewerProps {
  transcript: string
  onTranscriptUpdate?: (transcript: string) => void
  editable?: boolean
}

export function TranscriptViewer({ transcript, onTranscriptUpdate, editable = true }: TranscriptViewerProps) {
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Transcript</CardTitle>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
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
            className="min-h-[400px] font-mono text-sm"
            placeholder="Enter transcript..."
          />
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {transcript}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
