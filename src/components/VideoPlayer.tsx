import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

interface VideoPlayerProps {
  src?: string
  currentTime?: number
  onTimeUpdate?: (time: number) => void
  onDurationChange?: (duration: number) => void
  className?: string
}

export function VideoPlayer({
  src,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const isSeekingRef = useRef(false)

  useEffect(() => {
    if (videoRef.current && currentTime !== undefined && !isSeekingRef.current) {
      const timeDiff = Math.abs(videoRef.current.currentTime - currentTime)
      if (timeDiff > 0.5) {
        videoRef.current.currentTime = currentTime
      }
    }
  }, [currentTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      onDurationChange?.(video.duration)
    }

    const handleTimeUpdate = () => {
      isSeekingRef.current = false
      setProgress(video.currentTime)
      onTimeUpdate?.(video.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handleLoadStart = () => {
      video.load()
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('loadstart', handleLoadStart)

    if (video.readyState >= 1) {
      handleLoadedMetadata()
    } else {
      video.load()
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('loadstart', handleLoadStart)
    }
  }, [src, onTimeUpdate, onDurationChange])

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

  const handleProgressChange = (value: number[]) => {
    if (!videoRef.current) return
    isSeekingRef.current = true
    const newTime = value[0]
    videoRef.current.currentTime = newTime
    setProgress(newTime)
  }

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            preload="metadata"
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">No video loaded</div>
        )}
      </div>
      <div className="space-y-3">
        <Slider
          value={[progress]}
          onValueChange={handleProgressChange}
          max={duration || 100}
          step={0.1}
          className="cursor-pointer"
          disabled={!src}
        />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={togglePlay}
              size="sm"
              variant="ghost"
              disabled={!src}
            >
              {isPlaying ? (
                <Pause size={20} weight="fill" />
              ) : (
                <Play size={20} weight="fill" />
              )}
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums min-w-[80px]">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              onClick={toggleMute}
              size="sm"
              variant="ghost"
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
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24 cursor-pointer"
              disabled={!src}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
