# Video Processing Queue System with BullMQ

This document outlines the implementation of a robust Redis-based job queue system using BullMQ for processing video files safely with GPU resources.

## Architecture Overview

### Frontend (React)
- Upload videos via multipart form data to backend
- Monitor job progress via WebSocket connection
- Display real-time status updates

### Backend (Node.js + Express)
- Handles file uploads and stores them temporarily
- Creates BullMQ jobs for video processing
- WebSocket server for real-time updates
- Single worker process for GPU safety

### Redis + BullMQ
- Persistent job queue with retry logic
- Atomic job operations (no race conditions)
- Automatic cleanup of completed jobs
- Job progress tracking and metrics

## Implementation Steps

### 1. Install Dependencies

```bash
npm install bull bullmq ioredis express multer ws uuid
npm install --save-dev @types/express @types/multer @types/ws
```

### 2. Backend Server Structure

```
server/
├── src/
│   ├── app.ts              # Express app setup
│   ├── routes/
│   │   ├── upload.ts       # File upload endpoints  
│   │   └── jobs.ts         # Job status endpoints
│   ├── services/
│   │   ├── queueService.ts # BullMQ queue setup
│   │   └── workerService.ts# Video processing worker
│   ├── workers/
│   │   └── videoProcessor.ts # Job processing logic
│   └── types/
│       └── index.ts        # Shared types
├── uploads/                # Temporary file storage
├── package.json
└── tsconfig.json
```

### 3. Key Benefits

#### Reliability
- **Persistent Storage**: Jobs survive server restarts
- **Atomic Operations**: No race conditions or duplicate processing
- **Retry Logic**: Automatic retries with exponential backoff
- **Error Handling**: Proper job failure tracking and notifications

#### Performance
- **Single Worker**: Ensures one GPU-intensive job at a time
- **Memory Efficiency**: Files stored on disk, not in memory
- **Progress Tracking**: Real-time job progress updates
- **Cleanup**: Automatic cleanup of completed jobs and files

#### Scalability
- **Horizontal Scaling**: Add more workers on different machines
- **Load Balancing**: Redis handles job distribution
- **Monitoring**: Built-in metrics and job statistics
- **Priority Queues**: Handle urgent jobs first

## File Flow

1. **Upload**: Frontend uploads video to `/api/upload` endpoint
2. **Storage**: Server saves file to `uploads/` directory with UUID
3. **Job Creation**: Create BullMQ job with file path and processing options
4. **Processing**: Worker picks up job, processes video using existing services
5. **Updates**: Progress sent via WebSocket to frontend
6. **Cleanup**: Files and job data cleaned up after completion

## Error Handling

- **File Not Found**: Retry with exponential backoff
- **Processing Timeout**: Configurable job timeout (30min default)
- **Memory Issues**: Worker restarts automatically on OOM
- **GPU Errors**: Graceful failure with detailed error messages

## Monitoring

- **Job Statistics**: Completed, failed, active job counts
- **Processing Times**: Track average processing duration
- **Error Rates**: Monitor failure patterns
- **Resource Usage**: GPU and memory utilization tracking

Would you like me to implement this BullMQ solution step by step?