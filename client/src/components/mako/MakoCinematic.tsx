import React from 'react';
import type { MakoState } from '../../types/startup.ts';

interface MakoCinematicProps {
  state?: MakoState;
  className?: string;
  animated?: boolean;
}

export const MakoCinematic: React.FC<MakoCinematicProps> = ({
  state = 'idle',
  className = '',
  animated = true,
}) => {
  const isCurious = state === 'empty';
  const isFocused = state === 'discovering';
  const isHappy = state === 'success';
  const isSleeping = state === 'offline';

  return (
    <div
      className={`mako-cinematic-container mako-state-${state} ${
        animated ? 'mako-cinematic-animated' : ''
      } ${className}`}
      role="img"
      aria-label={`Mako the Shark Guide in cinematic 3D perspective (${state} state)`}
    >
      <svg
        viewBox="0 0 920 540"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mako-cinematic-svg"
      >
        <defs>
          {/* Surface Sunlight Rays from Above */}
          <linearGradient
            id="makoSunlightApex"
            x1="450"
            y1="10"
            x2="450"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#63DDF3" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#125A8D" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#061827" stopOpacity="0" />
          </linearGradient>

          {/* Pelagic Blue Shark Dorsal Body */}
          <linearGradient
            id="makoPelagicDorsal"
            x1="450"
            y1="50"
            x2="450"
            y2="340"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#2A8BBD" />
            <stop offset="22%" stopColor="#1A6794" />
            <stop offset="55%" stopColor="#104A70" />
            <stop offset="85%" stopColor="#0B3450" />
            <stop offset="100%" stopColor="#062135" />
          </linearGradient>

          {/* Silvery Ice-White Ventral Counter-Shading */}
          <linearGradient
            id="makoSilveryBelly"
            x1="450"
            y1="220"
            x2="450"
            y2="380"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#EAF6FD" />
            <stop offset="70%" stopColor="#B2E0F2" />
            <stop offset="100%" stopColor="#3B92B5" />
          </linearGradient>

          {/* Tall Majestic Dorsal Fin Apex Light */}
          <linearGradient
            id="makoDorsalApexLight"
            x1="435"
            y1="20"
            x2="435"
            y2="210"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="15%" stopColor="#63DDF3" />
            <stop offset="45%" stopColor="#1C6F9C" />
            <stop offset="80%" stopColor="#104566" />
            <stop offset="100%" stopColor="#09293E" />
          </linearGradient>

          {/* Left Forward Hydrofoil Wing Gradient */}
          <linearGradient
            id="makoLeftHydrofoil"
            x1="400"
            y1="240"
            x2="100"
            y2="420"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1C6F9C" />
            <stop offset="45%" stopColor="#104566" />
            <stop offset="80%" stopColor="#08293E" />
            <stop offset="100%" stopColor="#63DDF3" />
          </linearGradient>

          {/* Right Hydrofoil Wing Gradient */}
          <linearGradient
            id="makoRightHydrofoil"
            x1="490"
            y1="230"
            x2="800"
            y2="350"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1C6F9C" />
            <stop offset="45%" stopColor="#104566" />
            <stop offset="80%" stopColor="#08293E" />
            <stop offset="100%" stopColor="#63DDF3" />
          </linearGradient>

          {/* Snout Conical Surface Specular Highlight */}
          <linearGradient
            id="makoSnoutLightSpec"
            x1="460"
            y1="180"
            x2="560"
            y2="270"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#63DDF3" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1C6F9C" stopOpacity="0" />
          </linearGradient>

          {/* Volumetric Caustic Sunlight Ripple Bands */}
          <linearGradient
            id="makoCausticWaves"
            x1="350"
            y1="160"
            x2="520"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#63DDF3" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#63DDF3" stopOpacity="0.15" />
          </linearGradient>

          {/* Eye Radial Luminescence */}
          <radialGradient id="makoEyeOrbGlow" cx="65%" cy="65%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#63DDF3" />
            <stop offset="75%" stopColor="#0E688F" />
            <stop offset="100%" stopColor="#030D19" />
          </radialGradient>

          {/* Bioluminescent Bloom Filter */}
          <filter id="makoCyanAura" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Under-Shark Abyssal Volumetric Shadow */}
          <radialGradient id="makoDepthShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#02070D" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#02070D" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#02070D" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Abyssal Depth Shadow */}
        <ellipse
          cx="450"
          cy="465"
          rx="340"
          ry="44"
          fill="url(#makoDepthShadow)"
          className="mako-cinematic-shadow"
        />

        {/* Caudal Tail Assembly (Sweeping in Distance behind Left Flank) */}
        <g className="mako-cinematic-tail">
          <path
            d="M380 230
               C320 190, 240 140, 190 90
               C215 145, 255 195, 290 225
               C245 245, 205 290, 195 345
               C240 300, 305 255, 360 240 Z"
            fill="url(#makoPelagicDorsal)"
            stroke="#072233"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Tail Upper Lobe Cyan Bioluminescent Highlight */}
          <path
            d="M190 90 C218 140, 258 195, 290 225"
            stroke="#63DDF3"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#makoCyanAura)"
          />
        </g>

        {/* Far Right Pectoral Wing (Dynamic Hydrofoil Outstretch) */}
        <g className="mako-cinematic-far-fin">
          <path
            d="M510 245
               C580 260, 690 300, 790 355
               C765 320, 665 275, 560 252 Z"
            fill="url(#makoRightHydrofoil)"
            stroke="#072233"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Right Wing Leading Edge Glow */}
          <path
            d="M510 245 C590 265, 700 305, 790 355"
            stroke="#63DDF3"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#makoCyanAura)"
          />
          <path
            d="M515 250 C590 270, 695 308, 780 350"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* Tall Majestic Dorsal Fin (Reaching High into Surface Sunlight) */}
        <g className="mako-cinematic-dorsal">
          {/* Main Dorsal Fin Blade */}
          <path
            d="M405 185
               C415 105, 428 45, 438 22
               C446 65, 458 125, 475 180 Z"
            fill="url(#makoDorsalApexLight)"
            stroke="#072233"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Dorsal Leading Edge Sunbeam Sheen */}
          <path
            d="M410 165 C420 95, 430 42, 438 22"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
            filter="url(#makoCyanAura)"
          />
          <path
            d="M414 125 C424 72, 433 38, 438 22"
            stroke="#63DDF3"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Main Torso & Head (3/4 Forward Dynamic Sculpted Form) */}
        <path
          d="M370 230
             C340 210, 355 175, 400 168
             C450 160, 510 175, 565 210
             C605 235, 625 252, 608 272
             C570 305, 505 345, 440 348
             C365 350, 320 305, 340 270
             C350 250, 362 238, 370 230 Z"
          fill="url(#makoPelagicDorsal)"
          stroke="#0A324C"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Volumetric Caustic Wave Bands on Upper Back */}
        <path
          d="M390 182 C445 172, 510 185, 555 212 C520 226, 455 212, 405 204 Z"
          fill="url(#makoCausticWaves)"
        />
        <path
          d="M410 192 C460 184, 515 198, 545 218"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Dorsal Spine Surface Light Ridge */}
        <path
          d="M400 168 C450 162, 520 178, 580 220 C608 238, 620 252, 608 272"
          stroke="#63DDF3"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#makoCyanAura)"
        />

        {/* Broad Ventral Chest & Belly Counter-Shading (Silvery Ice-White) */}
        <path
          d="M355 272
             C410 288, 490 298, 565 268
             C605 250, 625 262, 608 272
             C568 308, 498 345, 440 348
             C380 350, 338 318, 355 272 Z"
          fill="url(#makoSilveryBelly)"
        />

        {/* Conical Hydrodynamic Snout Specular Spec */}
        <path
          d="M530 222 C572 242, 608 256, 618 264 C605 272, 568 280, 532 274 Z"
          fill="url(#makoSnoutLightSpec)"
        />

        {/* 5 Hydrodynamic Oceanic Gill Slits */}
        <g stroke="#0A324C" strokeWidth="3" strokeLinecap="round" opacity="0.85">
          <path d="M455 225 C452 242, 452 260, 458 278" />
          <path d="M470 226 C467 242, 467 259, 473 275" />
          <path d="M485 227 C482 242, 482 258, 488 272" />
          <path d="M500 228 C497 242, 497 257, 503 269" />
          <path d="M515 229 C512 242, 512 256, 518 266" />
        </g>

        {/* Bioluminescent Flank Lateral Line */}
        <path
          d="M400 240 C465 238, 535 252, 585 266"
          stroke="#63DDF3"
          strokeWidth="3.5"
          strokeLinecap="round"
          filter="url(#makoCyanAura)"
        />

        {/* Primary Foreground Left Hydrofoil Wing (Dynamic Sweeping Hydrofoil) */}
        <g className="mako-cinematic-pectoral">
          <path
            d="M395 262
               C385 315, 335 390, 255 450
               C235 418, 280 348, 345 275 Z"
            fill="url(#makoLeftHydrofoil)"
            stroke="#072233"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Wing Leading Edge Cyan Bioluminescent Rim */}
          <path
            d="M395 262 C382 322, 332 398, 255 450"
            stroke="#63DDF3"
            strokeWidth="4.5"
            strokeLinecap="round"
            filter="url(#makoCyanAura)"
          />
          <path
            d="M390 272 C378 330, 328 398, 262 444"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Jawline & Observant Smile */}
        {isHappy ? (
          <path
            d="M565 274 C584 278, 604 275, 614 266"
            stroke="#030D19"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : isCurious ? (
          <path
            d="M568 274 C586 276, 602 274, 612 268"
            stroke="#030D19"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M570 272 C588 274, 604 272, 612 266"
            stroke="#030D19"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Intelligent Pelagic Scout Eye */}
        <g className="mako-cinematic-eye">
          {isSleeping ? (
            <path
              d="M558 230 C568 238, 584 238, 594 230"
              stroke="#030D19"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <>
              {/* Outer Sclera Orbit Ring */}
              <circle cx="576" cy="232" r="16" fill="#030D19" />

              {/* Radiant Bioluminescent Iris */}
              <circle
                cx={isFocused ? '579' : isCurious ? '576' : '575'}
                cy={isFocused ? '233' : isCurious ? '230' : '232'}
                r="12"
                fill="url(#makoEyeOrbGlow)"
                filter="url(#makoCyanAura)"
              />

              {/* Deep Pupil */}
              <circle
                cx={isFocused ? '580' : isCurious ? '577' : '576'}
                cy={isFocused ? '233' : isCurious ? '230' : '232'}
                r={isCurious ? '7' : '6'}
                fill="#030D19"
              />

              {/* Primary Specular Light Sparkle */}
              <circle
                cx={isFocused ? '577' : isCurious ? '574' : '573'}
                cy={isFocused ? '228' : isCurious ? '226' : '228'}
                r="4"
                fill="#FFFFFF"
              />

              {/* Secondary Cyan Micro Catchlight */}
              <circle
                cx={isFocused ? '582' : isCurious ? '580' : '579'}
                cy={isFocused ? '236' : isCurious ? '234' : '235'}
                r="1.8"
                fill="#63DDF3"
              />
            </>
          )}

          {/* Expressive Eyebrow Brow Ridge */}
          {isCurious ? (
            <path
              d="M558 212 C570 204, 588 206, 596 216"
              stroke="#63DDF3"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#makoCyanAura)"
            />
          ) : isFocused ? (
            <path
              d="M558 214 C570 212, 588 216, 596 224"
              stroke="#63DDF3"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#makoCyanAura)"
            />
          ) : isHappy ? (
            <path
              d="M558 212 C574 206, 592 206, 598 214"
              stroke="#63DDF3"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#makoCyanAura)"
            />
          ) : (
            <path
              d="M560 214 C572 208, 588 210, 596 218"
              stroke="#63DDF3"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
              filter="url(#makoCyanAura)"
            />
          )}
        </g>

        {/* State-Specific Sonar Rings (discovering state) */}
        {state === 'discovering' && (
          <g className="mako-sonar-pings">
            <circle
              cx="618"
              cy="264"
              r="22"
              stroke="#63DDF3"
              strokeWidth="2.5"
              fill="none"
              opacity="0.8"
              className="sonar-ping-ring ping-1"
            />
            <circle
              cx="618"
              cy="264"
              r="44"
              stroke="#63DDF3"
              strokeWidth="1.8"
              fill="none"
              opacity="0.5"
              className="sonar-ping-ring ping-2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
