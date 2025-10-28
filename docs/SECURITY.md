# Security

## Overview

Splice is a **local-first** application designed for internal use. Your video files are processed entirely on your own hardware.

## Security Model

✅ **What Splice Does:**
- Processes videos entirely on your local machine
- Stores files only in the local filesystem
- Uses local AI models (Whisper.cpp, Ollama)
- Connects only to localhost services

❌ **What Splice Does NOT Do:**
- Upload video files to any cloud service
- Track user behavior or analytics
- Require internet connectivity (except for model downloads)

## Multi-User Considerations

⚠️ **Important**: Splice is designed as an internal tool where all users on the same server share:
- The same job queue (everyone sees all jobs)
- The same file system (no user isolation)
- The same Redis instance

**For production use with multiple teams**, deploy separate instances per user/team.

## Best Practices

- Run Splice only on computers you control
- Keep software updated (Node.js, FFmpeg, Redis, Ollama)
- Use firewall rules to block external access to service ports
- Monitor disk usage in `/server/uploads`
- Clear old jobs from Redis periodically

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email the maintainer directly
3. Include description, steps to reproduce, and potential impact

We will respond within 48 hours.
