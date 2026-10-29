import React, { useCallback, useEffect, useRef, useState } from 'react';
import './CinematicIntro.css';

interface CinematicIntroProps {
  onComplete: () => void;
}

type ScenePhase = 'video' | 'enter';

export const INTRO_SESSION_STORAGE_KEY = 'sauda_intro_has_started';

// Pitch-arena clip is 10s at 24fps. Played at 1.25x so the whole intro lasts ~8s, matching the theme audio.
const INTRO_VIDEO_SRC = '/media/sauda-pitch-intro.mp4';
const PLAYBACK_RATE = 1.25;
// Media-time (seconds) at which the animated SAUDA. wordmark begins, shortly before the clip ends.
const TITLE_REVEAL_AT = 6.6;
// Background theme audio. Starts automatically when the browser allows it, otherwise on the first click/key press.
const MUSIC_SRC = '/media/sauda-intro-theme.mp3';
const MUSIC_VOLUME = 1.0;
const WORDMARK_LETTERS = ['S', 'A', 'U', 'D', 'A'];

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ onComplete }) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [phase, setPhase] = useState<ScenePhase>(() =>
    prefersReducedMotion ? 'enter' : 'video',
  );
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(() =>
    prefersReducedMotion ? 100 : 0,
  );
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [exitMode, setExitMode] = useState<'enter' | 'skip'>('enter');

  const [muted, setMuted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enterBtnRef = useRef<HTMLButtonElement>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const isExitingRef = useRef(false);

  // Mark the intro as having started immediately upon first appearance in this tab session
  useEffect(() => {
    try {
      sessionStorage.setItem(INTRO_SESSION_STORAGE_KEY, 'true');
    } catch {
      // Ignore if sessionStorage is restricted
    }
  }, []);

  // Lock page scroll behind the intro and drop the reserved scrollbar gutter
  // (index.css sets `scrollbar-gutter: stable`, which left a strip on the right edge)
  useEffect(() => {
    const html = document.documentElement;
    const prev = {
      body: document.body.style.overflow,
      html: html.style.overflow,
      gutter: html.style.scrollbarGutter,
    };
    document.body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'auto';
    return () => {
      document.body.style.overflow = prev.body;
      html.style.overflow = prev.html;
      html.style.scrollbarGutter = prev.gutter;
    };
  }, []);

  // Fade the theme out (used on Enter / Skip / unmount)
  const stopMusic = useCallback(() => {
    const a = musicRef.current;
    if (!a || a.paused) return;
    if (fadeRef.current) clearInterval(fadeRef.current);
    fadeRef.current = setInterval(() => {
      if (a.volume > 0.06) {
        a.volume = Math.max(0, a.volume - 0.06);
      } else {
        a.pause();
        if (fadeRef.current) clearInterval(fadeRef.current);
      }
    }, 40);
  }, []);

  // Try to autoplay; browsers often block sound until the viewer interacts, so retry on first interaction
  useEffect(() => {
    if (prefersReducedMotion) return;
    const a = musicRef.current;
    if (!a) return;
    a.volume = MUSIC_VOLUME;
    let started = false;

    const tryPlay = () => {
      if (started || isExitingRef.current) return;
      a.play()
        .then(() => {
          started = true;
          cleanup();
        })
        .catch(() => {});
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', tryPlay);
      window.removeEventListener('keydown', tryPlay);
      window.removeEventListener('touchstart', tryPlay);
    };

    tryPlay();
    window.addEventListener('pointerdown', tryPlay);
    window.addEventListener('keydown', tryPlay);
    window.addEventListener('touchstart', tryPlay);
    return () => {
      cleanup();
      if (fadeRef.current) clearInterval(fadeRef.current);
      a.pause();
    };
  }, [prefersReducedMotion]);

  const toggleMute = useCallback(() => {
    const a = musicRef.current;
    const next = !muted;
    setMuted(next);
    if (a) {
      a.muted = next;
      if (!next && a.paused && a.currentTime === 0) a.play().catch(() => {});
    }
  }, [muted]);

  // Clean up exit timeout only on unmount
  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  // Dissolve-out exit transition when user clicks "ENTER SAUDA"
  const handleEnter = useCallback(() => {
    if (isExitingRef.current) return;
    try {
      sessionStorage.setItem(INTRO_SESSION_STORAGE_KEY, 'true');
    } catch {}
    stopMusic();
    isExitingRef.current = true;
    setIsExiting(true);
    setExitMode('enter');

    if (prefersReducedMotion) {
      onCompleteRef.current();
      return;
    }

    exitTimeoutRef.current = setTimeout(() => {
      onCompleteRef.current();
    }, 520);
  }, [prefersReducedMotion, stopMusic]);

  // Immediate skip transition
  const handleSkip = useCallback(() => {
    if (isExitingRef.current) return;
    try {
      sessionStorage.setItem(INTRO_SESSION_STORAGE_KEY, 'true');
    } catch {}
    stopMusic();
    isExitingRef.current = true;
    setIsExiting(true);
    setExitMode('skip');

    if (prefersReducedMotion) {
      onCompleteRef.current();
      return;
    }

    exitTimeoutRef.current = setTimeout(() => {
      onCompleteRef.current();
    }, 180);
  }, [prefersReducedMotion, stopMusic]);

  // Global keyboard shortcuts (Escape = skip immediately, Enter = enter Sauda)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'Enter' && phase === 'enter') {
        e.preventDefault();
        handleEnter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [phase, handleSkip, handleEnter]);

  // Fallback timer: if video fails to decode or takes longer than 6s, show title and permit immediate entry
  useEffect(() => {
    if (prefersReducedMotion) return;

    const timeout = setTimeout(() => {
      if (!videoLoaded) {
        setVideoError(true);
        setPhase('enter');
      }
    }, 6000);

    return () => clearTimeout(timeout);
  }, [videoLoaded, prefersReducedMotion]);

  // Video time-update driven progression
  // The wordmark reveal starts just before the clip finishes so SAUDA. emerges over the arena.
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    const duration = video.duration || 10;
    const pct = Math.min(100, Math.round((current / duration) * 100));
    setProgress(pct);

    if (current >= TITLE_REVEAL_AT) {
      if (phase !== 'enter') setPhase('enter');
    } else {
      if (phase !== 'video') setPhase('video');
    }
  };

  const handleVideoEnded = () => {
    setPhase('enter');
    setProgress(100);
  };

  // Attempt video playback on mount
  useEffect(() => {
    if (prefersReducedMotion) return;

    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.defaultPlaybackRate = PLAYBACK_RATE;
      video.playbackRate = PLAYBACK_RATE;
      video
        .play()
        .then(() => {
          setVideoLoaded(true);
          setVideoError(false);
        })
        .catch(() => {
          // If browser policy blocked autoplay, show enter action immediately so user is never trapped
          setVideoError(true);
          setPhase('enter');
        });
    }
  }, [prefersReducedMotion]);

  const isTitleRevealed = phase === 'enter' || videoError;

  // Auto-focus ENTER SAUDA button upon reveal for accessible keyboard control
  useEffect(() => {
    if (isTitleRevealed && enterBtnRef.current) {
      enterBtnRef.current.focus();
    }
  }, [isTitleRevealed]);

  return (
    <aside
      className={`cinematic-intro-stage ${isExiting ? `fade-out mode-${exitMode}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Sauda brand intro experience"
    >
      {/* 1. Fine Gold Progress Sweep at Top Edge */}
      <div className="intro-progress-bar" style={{ width: `${progress}%` }} />

      {/* 1b. Background theme audio + mute toggle */}
      <audio ref={musicRef} src={MUSIC_SRC} preload="auto" />
      <div className="intro-sound-wrapper">
        <button
          type="button"
          className={`skip-intro-btn sound-btn ${muted ? '' : 'on'}`}
          onClick={toggleMute}
          disabled={isExiting}
          aria-pressed={!muted}
          aria-label={muted ? 'Unmute intro music' : 'Mute intro music'}
        >
          <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
          <span>{muted ? 'Sound off' : 'Sound on'}</span>
        </button>
      </div>

      {/* 2. Floating Bottom-Right Skip Intro Control */}
      <div className="intro-skip-wrapper">
        <button
          type="button"
          className="skip-intro-btn"
          onClick={handleSkip}
          disabled={isExiting}
          aria-label="Skip cinematic intro and enter Sauda platform"
        >
          <span>Skip intro</span>
          <span className="skip-key-hint">Esc</span>
          <span className="skip-arrow">→</span>
        </button>
      </div>

      {/* 3. Full-Stage Background Video */}
      {!prefersReducedMotion && (
        <video
          ref={videoRef}
          className={`intro-video-element ${videoLoaded && !videoError ? 'visible' : 'hidden'}`}
          src={INTRO_VIDEO_SRC}
          muted
          playsInline
          autoPlay
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onLoadedMetadata={() => {
            if (videoRef.current) videoRef.current.playbackRate = PLAYBACK_RATE;
          }}
          onCanPlay={() => {
            setVideoLoaded(true);
            setVideoError(false);
          }}
          onError={() => {
            setVideoError(true);
            setPhase('enter');
          }}
        />
      )}

      {/* 3b. Fade-from-black opening */}
      {!prefersReducedMotion && <div className="intro-fade-from-black" aria-hidden="true" />}

      {/* 4. Subtle Radial Scrim: Dims investor chairs to ensure typography contrast */}
      <div
        className={`intro-scrim ${isTitleRevealed ? 'active' : ''}`}
        aria-hidden="true"
      />

      {/* 5. Filmic Vignette Edge Softener */}
      <div className="intro-vignette" aria-hidden="true" />

      {/* 6. Centered Title Reveal Stage */}
      <div className="intro-center-stage">
        <div
          className={`intro-reveal-centerpiece ${isTitleRevealed ? 'revealed' : ''} ${
            isExiting && exitMode === 'enter' ? 'dissolve-out' : ''
          }`}
        >
          {/* Order 1: Brand Emblem */}
          <div className="intro-emblem" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
              <path
                d="M16 2 L28 6 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V6 L16 2 Z"
                fill="rgba(10, 25, 41, 0.85)"
                stroke="#C3A064"
                strokeWidth="1.2"
              />
              <path
                d="M11 20 C13 20 15 18 16 15 C17 12 18 8 22 7 C20 11 20 15 23 17 C20 18 16 20 11 20 Z"
                fill="#C3A064"
              />
            </svg>
          </div>

          {/* Order 2: SAUDA Wordmark */}
          <h1 className="intro-wordmark" aria-label="Sauda.">
            <span className="wordmark-letters" aria-hidden="true">
              {WORDMARK_LETTERS.map((ch, i) => (
                <span
                  key={i}
                  className="wordmark-letter"
                  style={{ ['--i' as string]: i } as React.CSSProperties}
                >
                  {ch}
                </span>
              ))}
              <span className="wordmark-dot">.</span>
            </span>
            <span className="wordmark-rule" aria-hidden="true" />
          </h1>

          {/* Order 3: THE STARTUP EXCHANGE Subtitle */}
          <p className="intro-subtitle">THE STARTUP EXCHANGE</p>

          {/* Order 4: Supporting Institutional Tagline */}
          <div className="intro-tagline">
            <span className="tagline-dash" />
            <span className="tagline-text">STARTUP DISCOVERY · PITCH REGISTRY</span>
            <span className="tagline-dash" />
          </div>

          {/* Order 5: ENTER SAUDA CTA Action */}
          <div className="enter-platform-btn-container">
            <button
              ref={enterBtnRef}
              type="button"
              className="enter-platform-btn"
              onClick={handleEnter}
              disabled={isExiting}
              autoFocus={isTitleRevealed}
              aria-label="Enter Sauda Startup Discovery Platform"
            >
              <span className="enter-btn-text">ENTER SAUDA</span>
              <span className="enter-btn-icon" aria-hidden="true">
                ↗
              </span>
            </button>
            <span className="enter-key-shortcut" aria-hidden="true">
              PRESS ENTER TO CONTINUE
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default CinematicIntro;
