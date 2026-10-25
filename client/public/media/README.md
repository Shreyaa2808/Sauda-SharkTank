# Sauda Cinematic Video Asset Location

Place the signature realistic shark video asset in this directory:
- **Filename**: `sauda-shark-intro.mp4`
- **Path**: `client/public/media/sauda-shark-intro.mp4`
- **URL**: `/media/sauda-shark-intro.mp4`

## Specification Guidelines
- **Format**: MP4 (H.264 / AAC)
- **Resolution**: 1080p (1920x1080) or 4K widescreen
- **Duration**: ~5 to 8 seconds
- **Audio**: Muted by default (subtle oceanic ambience optional)
- **Subject**: Anatomically convincing shark with confident, subtle investment dealer personality (understated tailored dealer collar/vest or observant welcoming glance) swimming into frame from deep marine darkness, greeting the viewer, and transitioning to the Sauda reveal.

## Fallback Mechanism
If `sauda-shark-intro.mp4` has not yet been placed in this directory, `CinematicIntro.tsx` detects the missing file via `onError` and immediately falls back to the built-in cinematic deep-sea canvas simulation and wordmark reveal. Users can skip or enter the platform at any time without interruption.
