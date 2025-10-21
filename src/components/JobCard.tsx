import { VideoCamera, CheckCircle, XCircle, Spinner, Clock, Trash, FileText, ArrowClockwise } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { VideoJob } from '@/lib/types'
import { cn } from '@/lib/utils'

interface JobCardProps {
  job: VideoJob
  onViewDetails?: (jobId: string) => void
  onDelete?: (jobId: string) => void
  onRetry?: (jobId: string) => void
}

const statusConfig = {
  queued: {
    label: 'Queued',
    icon: Clock,
    color: 'bg-warning/10 text-warning-foreground border-warning/20',
  },
  uploading: {
    label: 'Uploading',
    icon: Spinner,
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  transcribing: {
    label: 'Transcribing',
    icon: Spinner,
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  analyzing: {
    label: 'Analyzing',
    icon: Spinner,
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  segmenting: {
    label: 'Segmenting',
    icon: Spinner,
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'bg-accent/10 text-accent-foreground border-accent/20',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'bg-destructive/10 text-destructive border-destructive/20',
  },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return date.toLocaleDateString()
}

export function JobCard({ job, onViewDetails, onDelete, onRetry }: JobCardProps) {
  const config = statusConfig[job.status]
  const Icon = config.icon
  const isProcessing = ['uploading', 'transcribing', 'analyzing', 'segmenting'].includes(job.status)

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-muted flex-shrink-0">
              <VideoCamera size={20} weight="duotone" className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <h3 className="font-medium text-sm truncate">{job.fileName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono">
                  {formatFileSize(job.fileSize)}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(job.createdAt)}
                </span>
                {job.hasCustomTranscript && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-accent-foreground flex items-center gap-1">
                      <FileText size={12} weight="bold" />
                      Custom transcript
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Badge variant="outline" className={cn('text-xs flex-shrink-0', config.color)}>
            <Icon
              size={12}
              weight="bold"
              className={cn('mr-1', isProcessing && 'animate-spin')}
            />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isProcessing && (
          <div className="space-y-1">
            <Progress value={job.progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{job.progress}% complete</p>
          </div>
        )}

        {job.status === 'failed' && (
          <div className="space-y-2">
            {job.errorMessage && (
              <p className="text-xs text-destructive">{job.errorMessage}</p>
            )}
            <div className="flex items-center gap-2">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry(job.id)}
                  className="flex-1"
                >
                  <ArrowClockwise size={16} weight="bold" className="mr-2" />
                  Retry
                </Button>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(job.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash size={16} weight="bold" />
                </Button>
              )}
            </div>
          </div>
        )}

        {job.status === 'completed' && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {job.segmentCount && (
                <span>{job.segmentCount} segments</span>
              )}
              {job.duration && (
                <span>{Math.floor(job.duration / 60)}:{(job.duration % 60).toString().padStart(2, '0')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onViewDetails ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewDetails(job.id)}
                >
                  View Details
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground italic">No project data</span>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(job.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash size={16} weight="bold" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
