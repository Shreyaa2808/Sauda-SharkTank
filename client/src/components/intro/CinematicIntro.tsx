import React, { useCallback, useEffect, useRef, useState } from 'react';
import './CinematicIntro.css';

interface CinematicIntroProps {
  onComplete: () => void;
}

type ScenePhase = 'shark' | 'enter';

export const INTRO_SESSION_STORAGE_KEY = 'sauda_intro_has_started';

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ onComplete }) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [phase, setPhase] = useState<ScenePhase>(() =>
    prefersReducedMotion ? 'enter' : 'shark',
  );
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(() =>
    prefersReducedMotion ? 100 : 0,
  );
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [exitMode, setExitMode] = useState<'enter' | 'skip'>('enter');

  const videoRef = useRef<HTMLVideoElement>(null);
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
  }, [prefersReducedMotion]);

  // Immediate skip transition
  const handleSkip = useCallback(() => {
    if (isExitingRef.current) return;
    try {
      sessionStorage.setItem(INTRO_SESSION_STORAGE_KEY, 'true');
    } catch {}
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
  }, [prefersReducedMotion]);

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
  // Shark sequence runs 0.0s - 11.5s; cross-dissolve to investor room completes by ~11.8s.
  // We trigger the title reveal at 11.8s so typography emerges precisely over the investor room.
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    const duration = video.duration || 16;
    const pct = Math.min(100, Math.round((current / duration) * 100));
    setProgress(pct);

    if (current >= 11.8) {
      if (phase !== 'enter') setPhase('enter');
    } else {
      if (phase !== 'shark') setPhase('shark');
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
          src="/media/sauda-shark-intro.mp4"
          muted
          playsInline
          autoPlay
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onCanPlay={() => {
            setVideoLoaded(true);
            setVideoError(false);
          }}
          onError={() => {
            // Fallback to source if trimmed intro is not available
            const v = videoRef.current;
            if (v && v.src.endsWith('sauda-shark-intro.mp4')) {
              v.src = '/media/sauda-shark-source.mp4';
              v.play().catch(() => {
                setVideoError(true);
                setPhase('enter');
              });
            } else {
              setVideoError(true);
              setPhase('enter');
            }
          }}
        />
      )}

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
          <h1 className="intro-wordmark">
            SAUDA<span className="wordmark-dot">.</span>
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
