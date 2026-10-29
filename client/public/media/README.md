# Sauda Intro Video

- **File**: `sauda-pitch-intro.mp4` (founder walking into the pitch arena, 10s, muted)
- **Used by**: `src/components/intro/CinematicIntro.tsx`
- **Speed**: set via `PLAYBACK_RATE` (1.25x by default, ~8s total)
- **Wordmark timing**: animated `SAUDA.` reveal starts at `TITLE_REVEAL_AT` (media seconds, default 6.6)

If the video fails to load or autoplay is blocked, the intro jumps straight to the animated wordmark and ENTER button.
