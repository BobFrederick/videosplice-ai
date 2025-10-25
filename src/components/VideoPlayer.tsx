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
    if (!video || !src) {
      console.log('🎥 VideoPlayer: No video element or src', { hasVideo: !!video, src })
      return
    }

    // Construct full URL for debugging
    const fullUrl = src.startsWith('http') ? src : `http://localhost:8080${src}`
    console.log('🎥 VideoPlayer: Loading video from:', src)
    console.log('🎥 VideoPlayer: Full URL would be:', fullUrl)
    setIsPlaying(false)
    setProgress(0)

    const handleLoadedMetadata = () => {
      const validDuration = isFinite(video.duration) ? video.duration : 0
      console.log('🎥 VideoPlayer: Metadata loaded, duration:', validDuration)
      setDuration(validDuration)
      onDurationChange?.(validDuration)
    }

    const handleTimeUpdate = () => {
      isSeekingRef.current = false
      setProgress(video.currentTime)
      onTimeUpdate?.(video.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleCanPlay = () => {
      if (video.readyState >= 2) {
        const validDuration = isFinite(video.duration) ? video.duration : 0
        setDuration(validDuration)
        onDurationChange?.(validDuration)
      }
    }

    const handleError = (e: Event) => {
      console.error('🎥 VideoPlayer: Error loading video', {
        src,
        error: video.error,
        errorCode: video.error?.code,
        errorMessage: video.error?.message,
        networkState: video.networkState,
        readyState: video.readyState
      })
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)

    video.load()

    if (video.readyState >= 1) {
      handleLoadedMetadata()
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
    }
  }, [src, onTimeUpdate, onDurationChange])

  const togglePlay = async () => {
    const video = videoRef.current
    if (!video) return

    try {
      if (isPlaying) {
        video.pause()
      } else {
        if (video.readyState < 2) {
          video.load()
          await new Promise((resolve) => {
            const handleCanPlay = () => {
              video.removeEventListener('canplay', handleCanPlay)
              resolve(undefined)
            }
            video.addEventListener('canplay', handleCanPlay)
          })
        }
        const playPromise = video.play()
        if (playPromise !== undefined) {
          await playPromise
        }
      }
    } catch (error) {
      console.error('Error toggling video playback:', error)
      setIsPlaying(false)
    }
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
            preload="auto"
            playsInline
            crossOrigin="anonymous"
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
