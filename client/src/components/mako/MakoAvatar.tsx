import React from 'react';
import type { MakoState } from '../../types/startup.ts';

interface MakoAvatarProps {
  state?: MakoState;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  animated?: boolean;
  interactive?: boolean;
  ariaLabel?: string;
  showSparkle?: boolean;
}

const SIZE_MAP = {
  xs: 32,
  sm: 48,
  md: 80,
  lg: 160,
  xl: 280,
};

export const MakoAvatar: React.FC<MakoAvatarProps> = ({
  state = 'idle',
  size = 'md',
  className = '',
  animated = true,
  interactive = false,
  ariaLabel = 'Mako the Shark Guide',
  showSparkle = false,
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 80;

  // Eye styling by state
  const isBlinking = state === 'offline';
  const isCurious = state === 'empty';
  const isFocused = state === 'discovering';
  const isHappy = state === 'success';

  return (
    <div
      className={`mako-wrapper mako-state-${state} ${animated ? 'mako-animated' : ''} ${
        interactive ? 'mako-interactive' : ''
      } ${className}`}
      style={{
        width: pixelSize,
        height: Math.round(pixelSize * 0.75),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="img"
      aria-label={`${ariaLabel} (${state} state)`}
    >
      <svg
        viewBox="0 0 320 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mako-svg"
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* Primary Body Gradient: Midnight Ocean to Deep Marine */}
          <linearGradient id="makoBodyGrad" x1="40" y1="60" x2="280" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B3157" />
            <stop offset="50%" stopColor="#0E3D6B" />
            <stop offset="100%" stopColor="#071C33" />
          </linearGradient>

          {/* Ventral Belly Gradient: Soft Ice Blue to Sea Cyan */}
          <linearGradient id="makoBellyGrad" x1="120" y1="120" x2="220" y2="190" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#EAF6FC" />
            <stop offset="100%" stopColor="#BAEBF8" />
          </linearGradient>

          {/* Electric Dorsal Highlight */}
          <linearGradient id="makoFinGrad" x1="130" y1="30" x2="160" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#63DDF3" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#238BCB" />
            <stop offset="100%" stopColor="#0B3157" />
          </linearGradient>

          {/* Eye Iris Glow */}
          <radialGradient id="makoEyeGrad" cx="72%" cy="68%" r="65%">
            <stop offset="0%" stopColor="#63DDF3" />
            <stop offset="70%" stopColor="#238BCB" />
            <stop offset="100%" stopColor="#071C33" />
          </radialGradient>

          {/* Soft Water Shadow */}
          <radialGradient id="makoShadowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#071C33" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#071C33" stopOpacity="0" />
          </radialGradient>

          {/* Filter for subtle glow */}
          <filter id="makoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Under-Shark Shadow */}
        <ellipse
          cx="160"
          cy="215"
          rx="90"
          ry="14"
          fill="url(#makoShadowGrad)"
          className="mako-shadow"
        />

        {/* Far Pectoral Fin (depth layer) */}
        <path
          d="M175 140 C195 155 220 180 235 185 C230 170 215 150 195 135 Z"
          fill="#071C33"
          opacity="0.7"
          className="mako-far-fin"
        />

        {/* Tail Assembly (Animated group) */}
        <g className="mako-tail-group">
          {/* Caudal Peduncle & Tail Fin */}
          <path
            d="M55 125 
               C42 120, 20 95, 8 72 
               C12 95, 24 116, 36 126
               C22 136, 12 155, 14 176
               C26 155, 44 135, 60 131 Z"
            fill="url(#makoFinGrad)"
            stroke="#071C33"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Tail Leading Edge Highlight */}
          <path
            d="M8 72 C14 88 28 114 36 126"
            stroke="#63DDF3"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>

        {/* Main Dorsal Fin */}
        <g className="mako-dorsal">
          <path
            d="M130 92 
               C142 55, 156 30, 172 24
               C168 45, 170 70, 182 86 Z"
            fill="url(#makoFinGrad)"
            stroke="#071C33"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Dorsal Electric Edge */}
          <path
            d="M145 55 C158 35 170 25 172 24"
            stroke="#63DDF3"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#makoGlow)"
          />
        </g>

        {/* Main Body (Hydrodynamic Pelagic Torso) */}
        <path
          d="M55 128
             C75 110, 110 88, 160 86
             C210 84, 260 98, 298 120
             C308 125, 312 131, 305 136
             C285 149, 245 168, 195 170
             C145 172, 95 155, 55 128 Z"
          fill="url(#makoBodyGrad)"
          stroke="#071C33"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Sleek Underbelly (Cream/Ice Blue) */}
        <path
          d="M110 145
             C155 152, 210 156, 260 142
             C285 135, 298 128, 305 136
             C285 149, 245 168, 195 170
             C150 172, 122 160, 110 145 Z"
          fill="url(#makoBellyGrad)"
          opacity="0.95"
        />

        {/* Flank Streamline Accent Lines */}
        <path
          d="M150 120 C185 118, 220 124, 255 134"
          stroke="#63DDF3"
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M170 128 C198 127, 230 133, 248 140"
          stroke="#238BCB"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Stylized Gill Slits (3 curved oceanic slits) */}
        <g stroke="#125A8D" strokeWidth="2" strokeLinecap="round" opacity="0.85">
          <path d="M196 112 C194 120, 194 128, 196 136" />
          <path d="M203 113 C201 120, 201 127, 203 135" />
          <path d="M210 114 C208 120, 208 126, 210 134" />
        </g>

        {/* Foreground Pectoral Fin (Dynamic main wing fin) */}
        <g className="mako-pectoral">
          <path
            d="M185 138
               C190 158, 185 190, 160 210
               C155 196, 162 172, 175 142 Z"
            fill="url(#makoFinGrad)"
            stroke="#071C33"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Fin Leading Edge */}
          <path
            d="M182 144 C186 168, 182 195, 160 210"
            stroke="#63DDF3"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>

        {/* Snout & Smile / Mouth Expression */}
        {isHappy ? (
          <path
            d="M272 136 C282 138, 292 137, 298 132"
            stroke="#071C33"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        ) : isCurious ? (
          <path
            d="M274 136 C283 137, 291 136, 295 135"
            stroke="#071C33"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M275 135 C284 136, 294 135, 297 133"
            stroke="#071C33"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Expressive Eye Assembly */}
        <g className="mako-eye-group">
          {isBlinking ? (
            /* Closed / Sleeping Eye Arc */
            <path
              d="M246 112 C252 116, 260 116, 266 112"
              stroke="#071C33"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <>
              {/* Outer Sclera / Orbit Ring */}
              <circle cx="256" cy="112" r="10" fill="#071C33" />
              
              {/* Vibrant Ocean Iris */}
              <circle
                cx={isFocused ? '257.5' : isCurious ? '256' : '255.5'}
                cy={isFocused ? '112.5' : isCurious ? '110.5' : '112'}
                r="7.5"
                fill="url(#makoEyeGrad)"
              />

              {/* Pupil */}
              <circle
                cx={isFocused ? '258' : isCurious ? '256.5' : '256'}
                cy={isFocused ? '112.5' : isCurious ? '110.5' : '112'}
                r={isCurious ? '4.5' : '3.8'}
                fill="#071C33"
              />

              {/* Primary Catchlight / Sparkle */}
              <circle
                cx={isFocused ? '256.5' : isCurious ? '254.5' : '254'}
                cy={isFocused ? '110.5' : isCurious ? '109' : '110'}
                r="2.2"
                fill="#FFFFFF"
              />

              {/* Secondary Micro Catchlight */}
              <circle
                cx={isFocused ? '259' : isCurious ? '258' : '257.5'}
                cy={isFocused ? '114' : isCurious ? '112.5' : '113.5'}
                r="1"
                fill="#63DDF3"
              />
            </>
          )}

          {/* Expressive Eyebrow Brow Ridge */}
          {isCurious ? (
            /* Quizzical raised arched brow */
            <path
              d="M248 100 C254 96, 263 98, 267 103"
              stroke="#63DDF3"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          ) : isFocused ? (
            /* Determined forward explorer brow */
            <path
              d="M248 101 C254 100, 263 103, 268 106"
              stroke="#63DDF3"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          ) : isHappy ? (
            /* Cheerful lifted brow */
            <path
              d="M248 100 C255 97, 264 97, 267 101"
              stroke="#63DDF3"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            /* Classic confident gentle brow */
            <path
              d="M249 101 C255 99, 263 100, 266 103"
              stroke="#63DDF3"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>

        {/* State-specific Accents */}
        {state === 'empty' && (
          /* Quizzical water bubble rising */
          <g className="mako-bubble-group">
            <circle cx="288" cy="85" r="7" fill="#EAF6FC" stroke="#63DDF3" strokeWidth="1.5" opacity="0.85" />
            <circle cx="286" cy="83" r="2" fill="#FFFFFF" opacity="0.9" />
            <circle cx="300" cy="65" r="4.5" fill="#EAF6FC" stroke="#63DDF3" strokeWidth="1.2" opacity="0.7" />
          </g>
        )}

        {state === 'offline' && (
          /* Warning coral beacon / sleepy indicator */
          <g className="mako-beacon-group">
            <circle cx="295" cy="98" r="8" fill="#FF9B75" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M295 94 L295 98 M295 101 L295 102" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {(state === 'success' || showSparkle) && (
          /* Electric Cyan Sparkle Star */
          <g className="mako-sparkle-group" filter="url(#makoGlow)">
            <path
              d="M305 75 Q305 85 315 85 Q305 85 305 95 Q305 85 295 85 Q305 85 305 75 Z"
              fill="#63DDF3"
            />
            <circle cx="305" cy="85" r="2" fill="#FFFFFF" />
          </g>
        )}
      </svg>
    </div>
  );
};
