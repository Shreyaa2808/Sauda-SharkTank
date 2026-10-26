import React from 'react';
import './SaudaLoader.css';

export interface SaudaLoaderProps {
  /** Optional understated status caption */
  message?: string;
  /** Whether the loader occupies the full viewport stage */
  fullScreen?: boolean;
  /** Custom additional CSS class name */
  className?: string;
  /** Optional accessible status label for screen readers */
  accessibleLabel?: string;
}

export const SaudaLoader: React.FC<SaudaLoaderProps> = ({
  message = 'Entering Sauda',
  fullScreen = true,
  className = '',
  accessibleLabel = 'Loading Sauda',
}) => {
  return (
    <div
      className={`sauda-loader-wrapper ${fullScreen ? 'fullscreen-stage' : 'inline-stage'} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loader-sr-only">{accessibleLabel}</span>
      <div className="loader-ambient-bloom" aria-hidden="true" />

      {/* Orbit System */}
      <div className="loader-orbit-system" aria-hidden="true">
        <div className="orbit-outer-faint" />
        <div className="orbit-ring-track" />

        {/* Concentric Water Ripples */}
        <div className="water-ripple" />
        <div className="water-ripple ripple-delay-1" />
        <div className="water-ripple ripple-delay-2" />

        {/* Subtle Water Droplets */}
        <div className="water-droplet droplet-1" />
        <div className="water-droplet droplet-2" />
        <div className="water-droplet droplet-3" />
        <div className="water-droplet droplet-4" />

        {/* Center Golden Beacon */}
        <div className="center-anchor" />

        {/* The Orbiting Shark Silhouette */}
        <div className="shark-orbit-arm">
          {/* Wake: a fading arc of disturbed water trailing behind the shark */}
          <div className="shark-wake" />
          <div className="shark-runner">
            {/* Intermittent bubbles shed from the tail */}
            <span className="shark-bubble bubble-1" />
            <span className="shark-bubble bubble-2" />
            <span className="shark-bubble bubble-3" />
            <div className="shark-body-flex">
              <svg className="shark-svg" viewBox="0 0 54 22" fill="none">
                <defs>
                  <linearGradient id="saudaSharkGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C3A064" />
                    <stop offset="45%" stopColor="#F3E7CA" />
                    <stop offset="100%" stopColor="#C3A064" />
                  </linearGradient>
                </defs>
                <path
                  d="M 52 10
                     C 46 8, 38 6, 32 6
                     C 30 6, 28 6, 26 6
                     C 26 4, 25 1, 23 0.5
                     C 23.5 3, 22.5 5.5, 20 6.5
                     C 16 7, 12 8, 8 9
                     C 7 9, 6 8.5, 5 8
                     C 4 6, 2 2, 0 1
                     C 1.5 5, 2.5 8, 3.5 10
                     C 2 12, 1 15, 0 18
                     C 2 16, 4 13, 6 12
                     C 10 12.5, 14 13, 18 12.5
                     C 20 13, 22 14, 23 16.5
                     C 24 19, 23 21, 22 21.5
                     C 24 19, 27 15, 30 13
                     C 36 13, 44 12, 52 10 Z"
                  fill="url(#saudaSharkGoldGrad)"
                />
                <path
                  d="M 34 8 Q 33 10 34 11.5"
                  stroke="#071C33"
                  strokeWidth="0.75"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <path
                  d="M 36 8 Q 35 10 36 11.5"
                  stroke="#071C33"
                  strokeWidth="0.75"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <circle cx="46" cy="9.2" r="0.9" fill="#071C33" />
                <circle cx="46.2" cy="9" r="0.4" fill="#FFFFFF" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Typography & Understated Status */}
      <div className="loader-branding">
        <h2 className="loader-wordmark">
          SAUDA<span className="loader-dot">.</span>
        </h2>
        <p className="loader-subtitle">THE STARTUP EXCHANGE</p>

        {message && (
          <div className="loader-telemetry-row" aria-hidden="true">
            <span className="telemetry-indicator-dot" />
            <span className="loader-caption">{message}</span>
          </div>
        )}

      </div>
    </div>
  );
};

export default SaudaLoader;
