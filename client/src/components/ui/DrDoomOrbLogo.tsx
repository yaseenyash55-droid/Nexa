import React from 'react';

interface DrDoomOrbLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const DrDoomOrbLogo: React.FC<DrDoomOrbLogoProps> = ({
  className = '',
  size = 64,
  showText = true
}) => {
  return (
    <div className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-transform hover:scale-105"
      >
        <defs>
          {/* Gradients */}
          <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="40%" stopColor="#10B981" />
            <stop offset="75%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="orbCore" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ECFDF5" />
            <stop offset="30%" stopColor="#34D399 text-glow" />
            <stop offset="70%" stopColor="#059669" />
            <stop offset="100%" stopColor="#022C22" />
          </radialGradient>

          <linearGradient id="hoodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#065F46" />
            <stop offset="50%" stopColor="#047857" />
            <stop offset="100%" stopColor="#022C22" />
          </linearGradient>

          <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="30%" stopColor="#64748B" />
            <stop offset="70%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id="goldAcc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* Outer Hexagonal Emblem Shield */}
        <polygon
          points="100,10 175,50 175,150 100,190 25,150 25,50"
          fill="#090D16"
          stroke="#10B981"
          strokeWidth="3"
          strokeDasharray="4 2"
        />

        {/* Hood Background */}
        <path
          d="M 50 150 C 50 70, 70 30, 100 30 C 130 30, 150 70, 150 150 Z"
          fill="url(#hoodGrad)"
          stroke="#059669"
          strokeWidth="2"
        />
        <path
          d="M 65 145 C 70 85, 80 50, 100 50 C 120 50, 130 85, 135 145 Z"
          fill="#022C22"
        />

        {/* Dr. Doom Metal Mask */}
        <path
          d="M 80 75 L 120 75 L 125 115 L 100 130 L 75 115 Z"
          fill="url(#metalGrad)"
          stroke="#CBD5E1"
          strokeWidth="2"
        />
        {/* Brow line */}
        <path d="M 78 78 L 122 78" stroke="#475569" strokeWidth="3" />

        {/* Glowing Eye Sockets */}
        <ellipse cx="88" cy="92" rx="7" ry="4" fill="#000000" />
        <ellipse cx="112" cy="92" rx="7" ry="4" fill="#000000" />
        <ellipse cx="88" cy="92" rx="4" ry="2" fill="#10B981" />
        <ellipse cx="112" cy="92" rx="4" ry="2" fill="#10B981" />

        {/* Mask Mouth Grille Slots */}
        <path d="M 90 110 L 90 120 M 95 108 L 95 122 M 100 107 L 100 123 M 105 108 L 105 122 M 110 110 L 110 120" stroke="#1E293B" strokeWidth="2" />

        {/* Hood Clasp Gold Medallions */}
        <circle cx="68" cy="130" r="6" fill="url(#goldAcc)" stroke="#78350F" strokeWidth="1" />
        <circle cx="132" cy="130" r="6" fill="url(#goldAcc)" stroke="#78350F" strokeWidth="1" />

        {/* Armored Cuirass / Hands holding Orb */}
        <path d="M 55 160 C 70 140, 85 145, 90 155" stroke="url(#metalGrad)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 145 160 C 130 140, 115 145, 110 155" stroke="url(#metalGrad)" strokeWidth="8" strokeLinecap="round" />

        {/* Floating Magical Energy Orb Aura Glow */}
        <circle cx="100" cy="152" r="36" fill="url(#orbGlow)" opacity="0.8" />
        <circle cx="100" cy="152" r="24" fill="url(#orbGlow)" opacity="0.9" />

        {/* Solid Core Magical Orb */}
        <circle cx="100" cy="152" r="18" fill="url(#orbCore)" stroke="#A7F3D0" strokeWidth="1.5" />

        {/* Orbital Energy Rings & Cosmic Sparks */}
        <ellipse cx="100" cy="152" rx="28" ry="8" fill="none" stroke="#6EE7B7" strokeWidth="1.5" transform="rotate(-25 100 152)" />
        <ellipse cx="100" cy="152" rx="28" ry="8" fill="none" stroke="#34D399" strokeWidth="1.5" transform="rotate(35 100 152)" />

        <circle cx="78" cy="142" r="2" fill="#A7F3D0" />
        <circle cx="124" cy="146" r="2.5" fill="#6EE7B7" />
        <circle cx="95" cy="128" r="1.5" fill="#ECFDF5" />
        <circle cx="108" cy="172" r="2" fill="#34D399" />
      </svg>

      {showText && (
        <div className="flex flex-col items-center">
          <span className="text-lg font-black tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent uppercase drop-shadow-[0_2px_8px_rgba(16,185,129,0.5)]">
            NEXA
          </span>
          <span className="text-[9px] font-bold text-emerald-400/80 tracking-wider uppercase">
            Doom's Magical Orb
          </span>
        </div>
      )}
    </div>
  );
};
