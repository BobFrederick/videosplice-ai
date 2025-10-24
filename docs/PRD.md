# Video Segmentation SaaS - Product Requirements Document

A self-hosted video segmentation platform that automatically transcribes, analyzes, and splits videos into logical chapters using AI-powered content understanding.

**Experience Qualities**:
1. **Effortless** - Upload a video, get intelligent segments back with minimal configuration or manual intervention
2. **Transparent** - Clear visibility into transcription, analysis, and segmentation progress with ability to review and adjust AI decisions
3. **Flexible** - Works with local LLMs for privacy-conscious teams or cloud APIs for convenience, adapts to different video types and use cases

**Complexity Level**: Complex Application (advanced functionality, accounts)
This is a full-stack application requiring video processing pipelines, LLM integration, job queue management, file storage, user authentication, and real-time progress tracking. It involves multiple backend services coordinating together, persistent storage of large media files, and sophisticated AI agent workflows.

## Essential Features

### 1. Video Upload & Intake
**Functionality**: Accept video files (mp4, mov, avi) up to configurable size limits with drag-and-drop or file browser selection

**Purpose**: Primary entry point for users to submit content for processing

**Trigger**: User clicks upload area or drags video file into browser

**Progression**: Select file → Upload with progress bar → Preview confirmation → Optional transcription upload → Queue for processing

**Success Criteria**: 
- Files successfully uploaded and stored with unique identifiers
- Upload progress accurately reflects transfer status
- System validates file format and provides clear error messages for unsupported formats
- Optional: Resume capability for large files

### 2. Transcription Generation
**Functionality**: Automatically transcribe audio from video using Whisper (local) or cloud speech-to-text APIs, with timestamp synchronization

**Purpose**: Convert spoken content to text for AI analysis and chapter detection

**Trigger**: Video successfully uploaded, or user selects "Skip transcription" to upload existing transcript file

**Progression**: Extract audio track → Send to transcription service → Receive timestamped transcript → Store with video metadata → Display in review interface

**Success Criteria**:
- Transcripts maintain accurate word-level timestamps
- Support for multiple languages detectable or user-specified
- Ability to import .srt, .vtt, or plain text transcript files as alternative
- Transcript editable before segmentation step

### 3. AI-Powered Chapter Detection
**Functionality**: LLM agent analyzes transcript to identify logical topic boundaries, generate chapter titles, and suggest segment points

**Purpose**: Intelligently determine where video should be split based on content meaning, not arbitrary time intervals

**Trigger**: Transcription completed and validated

**Progression**: Send transcript to LLM with prompt template → Agent identifies topic shifts → Generates chapter titles and descriptions → Proposes timestamp ranges → User reviews suggestions → Confirms or adjusts segments

**Success Criteria**:
- Chapter boundaries align with actual topic changes (validated through user feedback)
- Generated titles are descriptive and accurate (3-7 words ideal)
- Timestamp precision within 2-3 seconds of natural breaks
- Support for minimum/maximum segment duration constraints
- Ability to regenerate with different prompts or models

### 4. Segment Review & Editing
**Functionality**: Interactive timeline interface showing proposed segments with playback preview, adjustable boundaries, and editable titles

**Purpose**: Give users control to refine AI suggestions before final video splitting

**Trigger**: Chapter detection completed

**Progression**: View timeline with segments → Play video at boundary points → Drag segment edges to adjust → Edit titles/descriptions → Add or remove segments → Approve final structure

**Success Criteria**:
- Video player syncs with timeline visualization
- Drag-to-adjust feels responsive and precise
- Changes save as draft automatically
- Clear indication of segment duration and file size estimates

### 5. Video Splitting & Export
**Functionality**: Process approved segments into individual mp4 files with re-encoding options, chapter markers, and metadata embedding

**Purpose**: Deliver final segmented video files ready for distribution

**Trigger**: User approves segment structure and clicks "Generate Segments"

**Progression**: Queue splitting job → Process video cuts using ffmpeg → Embed metadata and chapters → Generate thumbnails → Package files → Notify completion → Provide download links or direct storage access

**Success Criteria**:
- Output files maintain source video quality (or user-selected quality)
- Processing time reasonable (aim for <2x video duration for simple cuts)
- Each segment includes embedded chapter title in metadata
- Batch download available as zip file
- Generated files stored with organized naming convention

### 6. Job Queue & Progress Tracking
**Functionality**: Background job processing with real-time status updates, queue position, and estimated completion times

**Purpose**: Handle long-running processes without blocking user interface, provide transparency into system activity

**Trigger**: Any processing task (transcription, LLM analysis, video splitting) initiated

**Progression**: Job created → Queue position displayed → Processing status updates → Progress percentage → Completion notification → Results available

**Success Criteria**:
- Multiple jobs can be queued per user
- Real-time updates via WebSocket or SSE
- Failed jobs show clear error messages with retry option
- Completed jobs accessible in history for 30 days (configurable)

### 7. LLM Configuration & Management
**Functionality**: User-friendly settings interface to configure cloud API keys (OpenAI, Anthropic) or local LLM endpoints (Ollama, LM Studio), with model selection and prompt customization. API keys stored securely in browser storage with password-masked input fields.

**Purpose**: Enable non-technical users to configure their own AI providers without developer intervention, supporting flexible deployment from cloud to air-gapped local setups

**Trigger**: Initial setup or settings modification by user

**Progression**: Navigate to settings → Select LLM provider type → Enter API key (masked) or endpoint URL → Test connection → Configure default models → Customize system prompts → Save configuration securely

**Success Criteria**:
- API keys entered via password-type input fields (hidden from view)
- Configuration validates connectivity before saving
- Supports multiple LLM providers (OpenAI, Anthropic, Local Ollama/LM Studio)
- Per-project or per-user model selection override
- Prompt templates editable with variable substitution ({transcript}, {duration})
- API usage tracking and cost estimation for cloud providers (future enhancement)
- Clear error messages for invalid keys or connection failures

### 8. User & Team Management
**Functionality**: Basic authentication, role-based access (admin/user), project organization, and quota management

**Purpose**: Support multi-user deployments with appropriate access controls and resource limits

**Trigger**: First-time setup, new user invitation, or team management actions

**Progression**: Admin creates accounts → Sends invitation links → Users register/login → Access dashboard → View assigned projects → Work within quota limits

**Success Criteria**:
- Secure authentication with session management
- Admins can set per-user quotas (storage, processing minutes)
- Project-based organization with sharing capabilities
- Activity logging for audit trails
- SSO/LDAP integration path for enterprise deployments

## Edge Case Handling

- **Large File Uploads**: Implement chunked uploads with resume capability; provide clear guidance on file size limits based on available storage
- **Transcription Failures**: Detect low-quality audio and warn user; offer manual transcript upload as fallback; retry logic for transient API failures
- **LLM Hallucinations**: Include confidence scores if available; allow easy regeneration with different parameters; provide manual override for all chapter decisions
- **Concurrent Processing**: Queue management prevents resource exhaustion; clear communication of wait times; admin controls for max concurrent jobs
- **Storage Limits**: Automatic cleanup of old processed files (configurable retention); user notifications approaching quota; graceful handling of disk full scenarios
- **Network Interruptions**: Resume uploads where possible; persist job state to survive service restarts; clear error messages with actionable next steps
- **Unsupported Formats**: Pre-upload validation with helpful error messages; suggest conversion tools; document supported codecs and containers
- **Very Long Videos**: Warn about processing time and costs; suggest pre-splitting; implement progress checkpoints to avoid complete restart on failure
- **Silent Videos**: Detect lack of audio track early; skip transcription gracefully; still allow manual segment creation by time markers

## Design Direction

The application should feel professional, trustworthy, and efficient—like a tool built for teams who value their time. The interface should project technical capability without overwhelming users, using a clean workspace aesthetic with subtle depth. Think Vercel Dashboard meets Linear—purposeful minimalism with attention to functional details. Visual hierarchy should guide users through the workflow naturally, with generous whitespace preventing cognitive overload during multi-step processes.

## Color Selection

**Triadic** (three equally spaced colors) - Using violet (brand), green (success/progress), and amber (attention/warning) to create a balanced, professional palette that communicates different system states clearly while maintaining visual harmony.

- **Primary Color**: Deep violet `oklch(0.45 0.18 290)` - Communicates creativity and technical sophistication; used for primary actions, links, and brand elements; suggests AI/ML capabilities
- **Secondary Colors**: 
  - Slate blue `oklch(0.35 0.05 260)` for secondary UI elements, navbars, and containers
  - Cool gray `oklch(0.55 0.02 260)` for subdued backgrounds and disabled states
- **Accent Color**: Vibrant green `oklch(0.65 0.19 150)` - Highlights active processing, success states, and progress indicators; draws attention to completion and positive actions
- **Destructive**: Warm red `oklch(0.58 0.22 25)` - Delete, cancel, and error states requiring caution
- **Warning/Attention**: Amber `oklch(0.75 0.15 85)` - Queue position, approaching limits, review required states

**Foreground/Background Pairings**:
- Background (Light: `oklch(0.98 0 0)`): Dark foreground `oklch(0.15 0 0)` - Ratio 18.5:1 ✓
- Card (Light: `oklch(1 0 0)`): Dark foreground `oklch(0.15 0 0)` - Ratio 20:1 ✓
- Primary (Deep Violet `oklch(0.45 0.18 290)`): White text `oklch(1 0 0)` - Ratio 8.2:1 ✓
- Secondary (Slate Blue `oklch(0.35 0.05 260)`): White text `oklch(1 0 0)` - Ratio 11.8:1 ✓
- Accent (Vibrant Green `oklch(0.65 0.19 150)`): Dark text `oklch(0.15 0 0)` - Ratio 6.9:1 ✓
- Muted (Cool Gray `oklch(0.96 0.01 260)`): Muted foreground `oklch(0.48 0.02 260)` - Ratio 7.2:1 ✓

## Font Selection

Typography should convey technical precision and modern professionalism while maintaining excellent readability for long transcripts and detailed interfaces. **Inter** for UI elements provides clean, neutral sans-serif that works at all sizes. **JetBrains Mono** for code, timestamps, and technical data gives monospaced clarity. **System font stack** as fallback ensures fast loading and native feel.

- **Typographic Hierarchy**:
  - H1 (Page Titles): Inter Bold / 32px / -0.02em tracking / 1.2 line-height
  - H2 (Section Headers): Inter SemiBold / 24px / -0.01em tracking / 1.3 line-height
  - H3 (Subsection Labels): Inter Medium / 18px / normal tracking / 1.4 line-height
  - Body (Primary Content): Inter Regular / 15px / normal tracking / 1.6 line-height
  - Small (Metadata, Captions): Inter Regular / 13px / 0.01em tracking / 1.5 line-height
  - Monospace (Technical): JetBrains Mono Regular / 14px / normal tracking / 1.5 line-height
  - Button Labels: Inter Medium / 14px / 0.005em tracking

## Animations

Animations should feel purposeful and snappy—reinforcing system responsiveness rather than adding delay. Motion communicates state changes, guides attention to new content or completed processes, and provides feedback for interactions. Keep durations under 300ms for most interactions; use easing that feels physically natural (ease-out for entrances, ease-in-out for movements).

- **Purposeful Meaning**: Progress indicators pulse gently to show active processing; completion checkmarks scale in with satisfaction; segment boundaries snap into place with subtle elasticity suggesting precision; page transitions slide with directionality showing navigation depth
- **Hierarchy of Movement**: High priority - upload progress, job status changes, error alerts; Medium priority - hover states, dropdowns, modals; Low priority - decorative micro-interactions

Key animations:
- Upload progress bar: Smooth continuous animation with pulse on active state
- Job status badges: Color fade transitions between states (queued → processing → complete)
- Segment timeline: Smooth drag with magnetic snap to natural break points
- Video player sync: Timeline position updates smoothly without jank
- Notification toasts: Slide in from top-right with gentle bounce
- Page transitions: 250ms slide-fade between workflow steps

## Component Selection

- **Components**:
  - **Navigation**: Sidebar component for main app navigation with collapsible sections for projects/settings
  - **Upload Interface**: Card with Dropzone area (custom component with drag states), Progress bars for upload tracking
  - **Video Player**: Custom component wrapping native HTML5 video with timeline overlay (likely need custom build or lightweight library)
  - **Timeline Editor**: Custom component with draggable segment markers, zoom controls, waveform visualization (consider WaveSurfer.js integration)
  - **Transcript Display**: ScrollArea with synchronized highlighting as video plays, inline editing with Textarea
  - **Segment Cards**: Card components showing chapter title, duration, thumbnail preview; use Badge for status indicators
  - **Job Queue**: Table component with sortable columns, status badges, action buttons; Sheet or Dialog for job details
  - **Forms**: Form, Input, Select, Textarea for configuration and settings; use react-hook-form with Zod validation
  - **Modals/Dialogs**: Dialog for confirmations, AlertDialog for destructive actions, Drawer for mobile-friendly side panels
  - **Data Display**: Table for job history, Badge for statuses, Avatar for user profiles, Separator for logical divisions
  - **Feedback**: Toast notifications (Sonner) for events, Progress indicators for long operations, Skeleton loaders for content loading
  - **Settings**: Tabs for organizing settings categories, Switch toggles, Radio groups for model selection

- **Customizations**:
  - **Video Timeline Component**: Custom horizontal scrollable timeline with segment boundaries, playhead indicator, waveform background, draggable handles
  - **Upload Zone**: Enhanced dropzone with file validation, size preview, format detection, multi-file support
  - **LLM Connection Tester**: Custom component showing connection status, latency, model availability with real-time validation
  - **Quota Display**: Custom gauge/progress visualization showing storage and processing minutes used vs. available

- **States**:
  - Buttons: Distinct hover (slight lift + color lightening), active (pressed down), loading (spinner + disabled), disabled (muted colors + no pointer)
  - Inputs: Focus ring in primary color, error state with destructive color border + message, success state with subtle accent color border
  - Upload zone: Default (dashed border), drag-over (solid border + accent background tint), uploading (progress overlay), error (destructive border + shake animation), success (accent border + checkmark)
  - Segment markers: Default, hover (highlight + cursor change), dragging (elevated + shadow), selected (primary color + thicker border)

- **Icon Selection**:
  - Upload: UploadSimple or CloudArrowUp
  - Video: VideoCamera or FilmSlate
  - Play/Pause: Play, Pause for player controls
  - Transcription: Subtitles or FileText
  - AI/LLM: Brain or MagicWand
  - Segments: Scissors or SplitVertical
  - Edit: PencilSimple or NotePencil
  - Download: DownloadSimple or ArrowDown
  - Settings: Gear or Wrench
  - Users: Users or UserCircle
  - Success: CheckCircle or Check
  - Error: XCircle or Warning
  - Processing: Spinner or CircleNotch (animated)
  - Timeline: SlidersHorizontal or Timeline

- **Spacing**: 
  - Base unit: 4px (Tailwind's default)
  - Component padding: 16px (p-4) for cards, 12px (p-3) for compact elements
  - Section gaps: 24px (gap-6) between major sections, 16px (gap-4) for related groups, 8px (gap-2) for tight groupings
  - Page margins: 32px (p-8) on desktop, 16px (p-4) on mobile
  - Form field spacing: 20px (space-y-5) for vertical form fields

- **Mobile**: 
  - Sidebar collapses to bottom navigation bar or hamburger menu
  - Video timeline switches to vertical scroll with larger touch targets
  - Segment cards stack vertically with full width
  - Upload zone maintains drag-drop on tablets, switches to button on phones
  - Tables convert to card-based list view with expandable details
  - Dual-pane views (transcript + video) switch to tabbed interface
  - Settings tabs become accordion sections for easier navigation
  - Touch-friendly drag handles sized minimum 44x44px
  - Video player controls enlarged for finger interaction

## Technical Architecture Notes

### Backend Stack (Recommended)
- **Framework**: Node.js with Express or Fastify for API server
- **Database**: PostgreSQL for relational data (users, projects, jobs), S3-compatible storage for video files
- **Job Queue**: BullMQ with Redis for background job processing
- **Video Processing**: FFmpeg for transcoding, splitting, metadata embedding
- **Transcription**: Whisper (local via whisper.cpp or faster-whisper) or OpenAI/AssemblyAI APIs
- **LLM Integration**: LangChain or custom abstraction supporting Ollama, OpenAI, Anthropic
- **Auth**: JWT tokens with refresh mechanism, optional SSO via SAML/OAuth

### Frontend Stack (Current Spark Template)
- **Framework**: React with TypeScript
- **State Management**: React Query for server state, useKV for persistence, Context for global UI state
- **Routing**: React Router for multi-page navigation
- **Real-time**: WebSocket or Server-Sent Events for job progress updates
- **Video**: HTML5 video element with custom controls overlay

### Deployment Considerations
- **Docker Compose**: Primary deployment method with services for API, worker, Redis, PostgreSQL
- **Environment Variables**: Configuration for LLM endpoints, storage paths, API keys, quotas
- **Volume Mounts**: Persistent storage for uploads, processed files, database
- **Scaling**: Horizontal scaling of worker containers for processing parallelism
- **Monitoring**: Health check endpoints, logging aggregation, optional Prometheus metrics

### API Design Patterns
- RESTful endpoints for CRUD operations
- WebSocket channel for real-time job updates
- Multipart upload endpoint with chunking support
- Webhook system for external integrations
- OpenAPI/Swagger documentation

## Success Metrics

- **Processing Accuracy**: >85% of AI-generated chapter boundaries require no manual adjustment
- **Performance**: Transcription completes in <1.5x video duration; segmentation in <2x duration
- **User Efficiency**: Average time from upload to download <10 minutes for 30-minute video
- **System Reliability**: <1% job failure rate; automatic recovery for >90% of failures
- **Adoption**: Easy setup in <30 minutes for technical users following documentation
- **Resource Efficiency**: Processes 100+ videos/day on 8-core server with 32GB RAM

## Future Expansion Considerations

- **Multi-language Support**: UI localization and transcript translation
- **Advanced Editing**: Frame-accurate trimming, subtitle burning, intro/outro insertion
- **AI Enhancements**: Auto-generated descriptions, keyword tagging, content summarization
- **Integrations**: Direct upload from cloud storage, export to YouTube/Vimeo with chapters
- **Analytics**: Video engagement metrics, popular segment tracking
- **Collaboration**: Comments on segments, approval workflows for teams
- **Templates**: Saved prompt templates for different content types (educational, podcast, presentation)
- **Batch Processing**: Upload multiple videos with shared segmentation rules
