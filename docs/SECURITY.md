# Security Policy

## Overview

Splice is a **local-first** application designed to run entirely on your own hardware. This means your video files never leave your computer, providing inherent privacy and security benefits.

## Security Model

### Local-Only Architecture

✅ **What Splice Does (Default Configuration):**
- Processes videos entirely on your local machine
- Stores temporary files only in the local filesystem
- Uses local AI models (Whisper.cpp, Ollama)
- Connects only to localhost services

⚠️ **Optional External API Usage:**
- Users can optionally configure OpenAI or Anthropic APIs for LLM segmentation
- When enabled, video transcripts are sent to external APIs
- API keys are stored in browser LocalStorage (unencrypted)
- **Note:** This feature is not yet production-ready and lacks proper security measures

❌ **What Splice Does NOT Do:**
- Upload video files to any cloud service (transcripts only, if external APIs configured)
- Track user behavior or analytics
- Require internet connectivity (except for external API usage and model downloads)

## Reporting Security Issues

If you discover a security vulnerability in Splice:

1. **Do NOT** open a public GitHub issue
2. Email the maintainer directly (see GitHub profile)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Best Practices

### For Users

- Run Splice only on computers you control
- Keep software updated (Node.js, FFmpeg, Redis, Ollama)
- Monitor disk usage in `/server/uploads`
- Use firewall rules to block external access to service ports
- Clear old jobs from Redis periodically

### For Developers

- Validate file types and sizes on upload
- Sanitize filenames to prevent path traversal
- Handle errors without exposing system details
- Review PRs for security implications
- Follow OWASP best practices

## Data Privacy

**Temporary Storage:**
- Video files stored in `/server/uploads` during processing
- Files automatically deleted after completion
- Transcripts stored in Redis (local only)
- Settings stored in browser LocalStorage

**External API Usage (Optional):**
- If OpenAI or Anthropic APIs are configured:
  - Video transcripts (text only, not video files) are sent to external APIs
  - API keys stored unencrypted in browser LocalStorage
  - Responses cached in Redis
  - **Security Warning:** These API integrations are experimental and not recommended for sensitive content
  - **Recommendation:** Use local Ollama models for privacy-sensitive videos

**Complete Data Removal:**
```bash
# Clear all jobs from Redis
redis-cli FLUSHALL

# Remove uploaded files
rm -rf server/uploads/*

# Clear browser LocalStorage (including API keys)
# In browser console: localStorage.clear()
```

## Known Limitations

- No authentication (single-user local application)
- No encryption at rest for temporary files
- No rate limiting (acceptable for local use)
- Relies on localhost network isolation
- **API keys stored unencrypted** in browser LocalStorage (for OpenAI/Anthropic)
- **No HTTPS** for external API calls (handled by external providers)
- **No audit logging** for external API usage
- **Shared job queue** - All users see the same job queue in multi-user deployments (no per-user isolation)

**Recommendations:**
- Use local Ollama models for privacy-sensitive content
- Do not use external APIs on shared computers
- Rotate API keys regularly if using external providers
- Monitor API usage on provider dashboards
- **For multi-user deployments:** Deploy separate instances per user to maintain job privacy

For detailed security information, see our [GitHub Security Advisories](https://github.com/BobFrederick/videosplice-ai/security).

---

**Last Updated:** 2025-10-26
