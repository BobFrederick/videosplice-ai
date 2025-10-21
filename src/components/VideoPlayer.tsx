import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  src?: string
  currentTime?: number
  duration?: number
  onTimeUpdate?: (time: number) => void
  onDurationChange?: (duration: number) => void
  className?: string
}

export function VideoPlayer({ 
  src, 
  currentTime, 
  duration: initialDuration,
  onTimeUpdate, 
  onDurationChange,
  className 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(100)
  const [duration, setDuration] = useState(initialDuration || 0)
  const [playbackTime, setPlaybackTime] = useState(0)

  useEffect(() => {
    if (initialDuration && duration === 0) {
      setDuration(initialDuration)
    }
  }, [initialDuration, duration])

  useEffect(() => {
    if (videoRef.current && currentTime !== undefined) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime])

  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return
    const newVolume = value[0]
    videoRef.current.volume = newVolume / 100
    setVolume(newVolume)
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const time = videoRef.current.currentTime
    setPlaybackTime(time)
    onTimeUpdate?.(time)
  }

  const handleDurationChange = () => {
    if (!videoRef.current) return
    const dur = videoRef.current.duration
    setDuration(dur)
    onDurationChange?.(dur)
  }

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) {
      const time = value[0]
      setPlaybackTime(time)
      onTimeUpdate?.(time)
      return
    }
    const time = value[0]
    videoRef.current.currentTime = time
    setPlaybackTime(time)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          {src && <source src={src} type="video/mp4" />}
        </video>
        
        {!src && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No video loaded</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Slider
          value={[playbackTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={togglePlay}
              disabled={!src}
            >
              {isPlaying ? (
                <Pause size={20} weight="fill" />
              ) : (
                <Play size={20} weight="fill" />
              )}
            </Button>

            <span className="text-xs font-mono text-muted-foreground min-w-[80px]">
              {formatTime(playbackTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleMute}
              disabled={!src}
            >
              {isMuted || volume === 0 ? (
                <SpeakerSlash size={20} weight="fill" />
              ) : (
                <SpeakerHigh size={20} weight="fill" />
              )}
            </Button>
            <Slider
              value={[volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="w-20"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
