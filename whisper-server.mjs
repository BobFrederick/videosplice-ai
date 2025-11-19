#!/usr/bin/env node

import express from 'express'
import multer from 'multer'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import cors from 'cors'

const app = express()
const upload = multer({ dest: tmpdir() })

app.use(cors())
app.use(express.json())

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`)
  next()
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', whisper: 'available' })
})

// Transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  console.log('🎙️ Received transcription request')
  console.log('📁 File received:', req.file ? req.file.originalname : 'No file')
  
  try {
    if (!req.file) {
      console.error('❌ No audio file provided')
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const { language = 'en', model = 'base', outputFormat = 'json' } = req.body
    const uploadedFilePath = req.file.path
    console.log('🔧 Processing with language:', language, 'model:', model)
    console.log('📁 Uploaded file:', uploadedFilePath, 'size:', req.file.size, 'bytes')
    
    const modelPath = process.env.WHISPER_MODEL_PATH || `${process.env.HOME}/.whisper/ggml-${model}.bin`

    // Check if model exists
    if (!existsSync(modelPath)) {
      return res.status(500).json({ 
        error: `Whisper model not found: ${modelPath}`,
        hint: 'Download with: wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -O ~/.whisper/ggml-base.bin'
      })
    }

    // Extract audio from video file using ffmpeg
    const audioPath = join(tmpdir(), `audio_${Date.now()}.wav`)
    const ffmpegCmd = `ffmpeg -i "${uploadedFilePath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}" -y`
    
    console.log('🎥 Extracting audio:', ffmpegCmd)
    
    try {
      execSync(ffmpegCmd, { stdio: 'pipe' })
      console.log('✅ Audio extracted successfully')
    } catch (error) {
      console.error('❌ FFmpeg failed:', error.message)
      return res.status(500).json({ 
        error: 'Failed to extract audio from video',
        details: error.message
      })
    }

    const outputPath = join(tmpdir(), `transcription_${Date.now()}`)

    // Build whisper command with word-level timestamps
    const cmd = [
      'whisper',
      '-m', modelPath,
      '-f', audioPath,
      '-of', outputPath,
      '-l', language,
      '--output-json',
      '--no-prints',
      '--max-len', '1'  // Enable word-level timestamps (1 word per segment)
    ].join(' ')

    console.log('Running whisper:', cmd)

    // Run whisper
    execSync(cmd, { stdio: 'pipe' })

    // Read the JSON output
    const jsonFile = `${outputPath}.json`
    if (!existsSync(jsonFile)) {
      return res.status(500).json({ error: 'Transcription failed - no output generated' })
    }

    const transcriptionData = JSON.parse(readFileSync(jsonFile, 'utf8'))
    
    // Log the actual whisper output structure for debugging
    console.log('🔍 Whisper JSON structure:', JSON.stringify(transcriptionData, null, 2))

    // Clean up temporary files
    unlinkSync(uploadedFilePath)  // Original uploaded video file
    unlinkSync(audioPath)         // Extracted audio file
    unlinkSync(jsonFile)          // Whisper output file

    // Format response - handle whisper.cpp output format
    let fullText = ''
    let segments = []
    
    // Handle the actual whisper.cpp JSON structure
    if (transcriptionData.transcription && Array.isArray(transcriptionData.transcription)) {
      // Whisper.cpp format: transcription is an array of objects with text and offsets
      fullText = transcriptionData.transcription.map(seg => seg.text || '').join('')
      
      segments = transcriptionData.transcription.map((seg) => ({
        start: seg.offsets ? seg.offsets.from / 1000 : 0, // Convert ms to seconds
        end: seg.offsets ? seg.offsets.to / 1000 : 0,
        text: (seg.text || '').trim()
      }))
    } else if (transcriptionData.segments && Array.isArray(transcriptionData.segments)) {
      // Alternative format: segments array
      fullText = transcriptionData.segments.map(seg => seg.text || '').join(' ')
      segments = transcriptionData.segments.map((seg) => ({
        start: (seg.start || seg.from || 0) / (seg.from ? 1000 : 1),
        end: (seg.end || seg.to || 0) / (seg.to ? 1000 : 1),
        text: (seg.text || '').trim()
      }))
    } else if (transcriptionData.text) {
      // Simple text format
      fullText = transcriptionData.text
    }

    // Ensure fullText is a string and trim safely
    const finalText = typeof fullText === 'string' ? fullText.trim() : String(fullText || '').trim()

    const result = {
      text: finalText,
      segments: segments,
      language: transcriptionData.result?.language || transcriptionData.language || language,
      duration: segments.length > 0 ? Math.max(...segments.map(s => s.end)) : 0
    }

    res.json(result)

  } catch (error) {
    console.error('Transcription error:', error)
    
    // Clean up on error
    if (req.file?.path && existsSync(req.file.path)) {
      unlinkSync(req.file.path)
    }

    res.status(500).json({ 
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Cleanup endpoint
app.post('/api/cleanup', (req, res) => {
  try {
    const { filePath } = req.body
    if (filePath && existsSync(filePath)) {
      unlinkSync(filePath)
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Cleanup failed' })
  }
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`🎙️  Whisper API server running on port ${PORT}`)
  console.log(`📍 Endpoints:`)
  console.log(`   GET  /api/health     - Health check`)
  console.log(`   POST /api/transcribe - Upload audio for transcription`)
  console.log(`   POST /api/cleanup    - Cleanup temporary files`)
})