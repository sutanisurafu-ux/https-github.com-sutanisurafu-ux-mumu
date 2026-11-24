import React from 'react';
import { CharacterClassId } from '../game/types';

/**
 * Classic MU Online Season 1 Dragon Head Ornament framing the left/right edges of the HUD dock.
 */
export const DragonHeadOrnament: React.FC<{ side: 'left' | 'right'; className?: string }> = ({
  side,
  className = '',
}) => {
  const mirror = side === 'right';
  return (
    <svg
      viewBox="0 0 116 64"
      className={className}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`dragonScale_${side}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6b5c49" />
          <stop offset="45%" stopColor="#352d26" />
          <stop offset="100%" stopColor="#120f0d" />
        </linearGradient>
        <linearGradient id={`dragonHorn_${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c7a976" />
          <stop offset="60%" stopColor="#685339" />
          <stop offset="100%" stopColor="#261e17" />
        </linearGradient>
        <radialGradient id={`dragonEye_${side}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
      </defs>

      {/* Upper sweeping dragon horn */}
      <path
        d="M2,12 C18,2 44,5 62,18 C52,18 36,15 16,22 Z"
        fill={`url(#dragonHorn_${side})`}
        stroke="#0a0807"
        strokeWidth="1.4"
      />
      {/* Back jaw ridge & neck plates */}
      <path
        d="M0,20 C24,14 50,15 74,23 C90,29 102,38 112,48 L96,52 C85,43 72,39 58,41 L74,56 L54,57 L40,47 L0,52 Z"
        fill={`url(#dragonScale_${side})`}
        stroke="#0c0a09"
        strokeWidth="1.6"
      />
      {/* Sculpted dragon snout & upper fang ridge */}
      <path
        d="M22,22 C44,17 68,20 92,31 C102,36 109,43 114,49 C103,48 93,43 84,39 L78,44 L73,37 L63,40 L57,34 L36,36 Z"
        fill="#241e19"
        stroke="#8c7350"
        strokeWidth="1"
      />
      {/* Lower jaw & fangs */}
      <path
        d="M42,46 C62,43 80,45 99,55 C86,58 68,58 46,54 Z"
        fill="#191411"
        stroke="#69563c"
        strokeWidth="1"
      />
      {/* Gleaming bronze fang highlights */}
      <path d="M84,39 L87,46 L91,41 Z M70,37 L73,44 L76,38 Z" fill="#d6c096" />
      {/* Glowing amber dragon eye */}
      <ellipse cx="55" cy="27" rx="4.5" ry="2.6" fill={`url(#dragonEye_${side})`} />
      <ellipse cx="56" cy="27" rx="1.4" ry="2.2" fill="#180d05" />
      {/* Metallic brow ridge & armor studs */}
      <path
        d="M42,23 C52,19 63,21 71,26"
        fill="none"
        stroke="#bfa16f"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="14" cy="30" r="2.2" fill="#8f754d" stroke="#110d0a" strokeWidth="0.9" />
      <circle cx="28" cy="34" r="2.2" fill="#8f754d" stroke="#110d0a" strokeWidth="0.9" />
    </svg>
  );
};

/**
 * Faceted Crystal HP (Ruby) or MP (Sapphire) Globe matching Classic MU Online.
 * Uses direct DOM ref scaleY (origin-bottom) for zero-re-render 60fps liquid fill!
 */
export const CrystalGlobe: React.FC<{
  variant: 'hp' | 'mp';
  barRef: React.RefObject<HTMLDivElement | null>;
  ghostBarRef?: React.RefObject<HTMLDivElement | null>;
  sizeClassName?: string;
  label: string;
}> = ({ variant, barRef, ghostBarRef, sizeClassName = 'w-[62px] h-[62px]', label }) => {
  const isHp = variant === 'hp';
  const clipId = isHp ? 'muRubyGlobeClip' : 'muSapphireGlobeClip';
  const liquidGrad = isHp
    ? 'linear-gradient(180deg, #ff5454 0%, #dc2626 38%, #991b1b 78%, #450a0a 100%)'
    : 'linear-gradient(180deg, #38bdf8 0%, #2563eb 40%, #1d4ed8 78%, #0f172a 100%)';
  const rimGlow = isHp
    ? 'shadow-[0_0_16px_rgba(220,38,38,0.5),inset_0_0_12px_rgba(0,0,0,0.9)]'
    : 'shadow-[0_0_16px_rgba(37,99,235,0.55),inset_0_0_12px_rgba(0,0,0,0.9)]';

  return (
    <div
      className={`relative shrink-0 rounded-full border-2 border-[#6e5a3e] bg-[#0b080a] p-[2px] ${rimGlow} ${sizeClassName}`}
      aria-label={label}
    >
      {/* Inner recessed sphere */}
      <div className="relative w-full h-full rounded-full overflow-hidden bg-[#10090e]">
        {/* Delayed ghost damage layer (HP only) */}
        {ghostBarRef && (
          <div
            ref={ghostBarRef}
            className="absolute inset-0 origin-bottom bg-gradient-to-t from-amber-600/80 via-amber-400/70 to-yellow-200/80 transition-transform duration-75"
            style={{ transform: 'scaleY(1)' }}
          />
        )}

        {/* Live 60fps vertical-draining liquid fill */}
        <div
          ref={barRef}
          className="absolute inset-0 origin-bottom"
          style={{ background: liquidGrad, transform: 'scaleY(1)' }}
        >
          {/* Bright meniscus shimmer along liquid top edge */}
          <div
            className={`absolute inset-x-0 top-0 h-[3px] ${
              isHp ? 'bg-rose-200/80' : 'bg-sky-200/85'
            } blur-[0.5px]`}
          />
        </div>

        {/* Faceted Crystal Glass Overlay SVG (matching classic MU gem facets!) */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="49" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            {/* Outer faceted ring geometry */}
            <polygon
              points="50,6 84,22 94,56 76,88 32,92 8,64 16,24"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.5"
            />
            <polygon
              points="50,20 72,34 74,64 52,80 28,68 26,36"
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.2"
            />
            {/* Facet diagonals */}
            <line x1="50" y1="6" x2="50" y2="20" stroke="rgba(255,255,255,0.26)" strokeWidth="1.3" />
            <line x1="84" y1="22" x2="72" y2="34" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
            <line x1="94" y1="56" x2="74" y2="64" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
            <line x1="76" y1="88" x2="52" y2="80" stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" />
            <line x1="32" y1="92" x2="28" y2="68" stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" />
            <line x1="8" y1="64" x2="26" y2="36" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
            <line x1="16" y1="24" x2="50" y2="20" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
            {/* Specular crystal top-left facet gleam */}
            <polygon
              points="20,25 48,10 62,22 44,36 26,38"
              fill="rgba(255,255,255,0.32)"
            />
            <ellipse
              cx="36"
              cy="24"
              rx="11"
              ry="5.5"
              transform="rotate(-24 36 24)"
              fill="rgba(255,255,255,0.48)"
            />
            {/* Deep lower crescent shadow for 3D spherical weight */}
            <path
              d="M6,58 C18,90 78,94 94,56 C90,92 20,98 6,58 Z"
              fill="rgba(0,0,0,0.48)"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

/**
 * Classic MU Online Glass Potion Bottle (HP Ruby Vial / MP Sapphire-Violet Vial).
 */
export const PotionBottleIcon: React.FC<{ variant: 'hp' | 'mp'; className?: string }> = ({
  variant,
  className = 'w-7 h-7',
}) => {
  const isHp = variant === 'hp';
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`potLiquid_${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isHp ? '#ff7b7b' : '#7dd3fc'} />
          <stop offset="45%" stopColor={isHp ? '#dc2626' : '#6366f1'} />
          <stop offset="100%" stopColor={isHp ? '#7f1d1d' : '#312e81'} />
        </linearGradient>
      </defs>
      {/* Cork stopper */}
      <rect x="14.5" y="3" width="7" height="4.5" rx="1.2" fill="#a87c4f" stroke="#2c1d0f" strokeWidth="1" />
      {/* Bottle neck & bronze collar */}
      <rect x="13" y="7" width="10" height="4" rx="1" fill="#475569" stroke="#0f172a" strokeWidth="1" />
      {/* Flask glass body */}
      <path
        d="M14,11 L22,11 L24,15 C28,18 29,24 27,29 C25,32 21,33 18,33 C15,33 11,32 9,29 C7,24 8,18 12,15 Z"
        fill="#161420"
        stroke="#94a3b8"
        strokeWidth="1.2"
      />
      {/* Glowing potion liquid */}
      <path
        d="M11.8,17.5 L24.2,17.5 C27,20 27.5,24.8 25.6,28.4 C24,31 20.6,31.6 18,31.6 C15.4,31.6 12,31 10.4,28.4 C8.5,24.8 9,20 11.8,17.5 Z"
        fill={`url(#potLiquid_${variant})`}
      />
      {/* Classic golden waist band on MU flasks */}
      <rect x="9.5" y="21.5" width="17" height="2.4" rx="1" fill="#d4a853" opacity="0.88" />
      {/* Glass specular highlight */}
      <path
        d="M12.5,19 C11,22 11.2,26 13,28.5"
        fill="none"
        stroke="rgba(255,255,255,0.68)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Handcrafted MU Online Skill SVG Icon for all 12 class skills + primary attacks.
 */
export const SkillSvgIcon: React.FC<{
  skillId: string;
  classId?: CharacterClassId;
  hasWeapon?: boolean;
  className?: string;
}> = ({ skillId, classId = 'dark_knight', hasWeapon = true, className = 'w-7 h-7' }) => {
  if (skillId === 'primary_attack') {
    if (!hasWeapon) {
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <path
            d="M11,17 C11,13 14,11 18,11 C22,11 25,13 25,17 L26,23 C26,27 23,30 18,30 C13,30 10,27 10,23 Z"
            fill="#d97706"
            stroke="#fef3c7"
            strokeWidth="1.5"
          />
          <path d="M14,14 L14,20 M18,13 L18,20 M22,14 L22,20" stroke="#78350f" strokeWidth="1.4" />
        </svg>
      );
    }
    if (classId === 'dark_wizard') {
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <line x1="8" y1="29" x2="23" y2="14" stroke="#b45309" strokeWidth="3" strokeLinecap="round" />
          <circle cx="25.5" cy="11.5" r="5.5" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1.5" />
          <circle cx="25.5" cy="11.5" r="2.2" fill="#ffffff" />
          <path d="M25.5,3 L26.6,6.5 M33,11.5 L29.5,12.5 M18,6 L21,8.5" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    }
    if (classId === 'fairy_elf') {
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <path d="M10,7 C24,9 28,22 10,29" fill="none" stroke="#d4a853" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="10" y1="8" x2="10" y2="28" stroke="#e2e8f0" strokeWidth="1.1" />
          <line x1="7" y1="18" x2="29" y2="18" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="31,18 25,14.5 26.5,18 25,21.5" fill="#bbf7d0" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
        <path d="M28,7 L15,20 L18,23 L31,10 L30,6 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="1.1" />
        <line x1="12" y1="17" x2="20" y2="25" stroke="#d4a853" strokeWidth="2.8" strokeLinecap="round" />
        <line x1="8" y1="28" x2="15" y2="21" stroke="#7c2d12" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="7.5" cy="28.5" r="2.2" fill="#fbbf24" />
      </svg>
    );
  }

  switch (skillId) {
    /* ===== DARK KNIGHT ===== */
    case 'cyclone_slash':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <path
            d="M7,24 C6,13 15,6 27,8 C21,12 18,18 20,25 C15,27 9,27 7,24 Z"
            fill="#ef4444"
            opacity="0.32"
          />
          <path
            d="M8,24 C8,12 17,7 29,9"
            fill="none"
            stroke="#f87171"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M11,26 C13,17 20,13 28,14"
            fill="none"
            stroke="#fef08a"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M16,28 L27,10" stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'twisting_slash':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="12" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="16 6" />
          <path
            d="M18,5 C26,6 31,13 29,21 M18,31 C10,30 5,23 7,15"
            fill="none"
            stroke="#fde047"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path d="M12,12 L24,24 M24,12 L12,24" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="18" cy="18" r="3.4" fill="#ef4444" stroke="#fef08a" strokeWidth="1.2" />
        </svg>
      );

    case 'death_stab':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <ellipse cx="18" cy="26" rx="13" ry="5" fill="#dc2626" opacity="0.45" stroke="#fb923c" strokeWidth="1.4" />
          <path d="M18,5 L18,24" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
          <path d="M13,11 L23,11" stroke="#d4a853" strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M10,27 L14,22 L18,26 L22,21 L26,27"
            fill="none"
            stroke="#fde047"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'combo_nova':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="11" fill="#0ea5e9" opacity="0.28" stroke="#38bdf8" strokeWidth="1.8" />
          <polygon
            points="18,3 21,13 32,12 23,19 29,29 18,23 7,29 13,19 4,12 15,13"
            fill="#fde047"
            stroke="#ea580c"
            strokeWidth="1.1"
          />
          <circle cx="18" cy="18" r="3.5" fill="#ffffff" />
        </svg>
      );

    /* ===== DARK WIZARD ===== */
    case 'aqua_beam':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <path d="M4,25 L31,10" stroke="#0284c7" strokeWidth="8" strokeLinecap="round" opacity="0.45" />
          <path d="M5,25 L31,10" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          <path d="M7,24 L30,11" stroke="#e0f2fe" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="30" cy="10.5" r="3.8" fill="#ffffff" stroke="#38bdf8" strokeWidth="1.4" />
        </svg>
      );

    case 'evil_spirits':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <path
            d="M6,24 C10,12 22,8 29,14 C23,14 19,18 22,24 C25,29 15,31 9,27"
            fill="none"
            stroke="#a855f7"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M29,22 C25,30 13,30 8,22 C13,22 17,17 14,12 C11,7 22,5 28,11"
            fill="none"
            stroke="#e879f9"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="26" cy="13" r="3" fill="#f3e8ff" />
          <circle cx="10" cy="23" r="2.8" fill="#d8b4fe" />
        </svg>
      );

    case 'hellfire_meteor':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <path
            d="M18,5 C24,11 28,16 26,23 C25,28 22,31 18,31 C14,31 11,28 10,23 C8,16 12,11 18,5 Z"
            fill="#ea580c"
            stroke="#fde047"
            strokeWidth="1.4"
          />
          <path
            d="M18,12 C21,16 23,19 22,24 C21,27 19.5,28 18,28 C16.5,28 15,27 14,24 C13,19 15,16 18,12 Z"
            fill="#facc15"
          />
          <circle cx="18" cy="23" r="3" fill="#ffffff" />
        </svg>
      );

    case 'soul_supernova':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="12" fill="#9333ea" opacity="0.35" stroke="#e879f9" strokeWidth="1.6" />
          <path
            d="M18,3 L20.5,14.5 L33,18 L20.5,21.5 L18,33 L15.5,21.5 L3,18 L15.5,14.5 Z"
            fill="#f5d0fe"
            stroke="#c026d3"
            strokeWidth="1.1"
          />
          <circle cx="18" cy="18" r="4" fill="#ffffff" />
        </svg>
      );

    /* ===== FAIRY ELF ===== */
    case 'triple_shot':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <line x1="6" y1="25" x2="29" y2="10" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="7" y1="28" x2="31" y2="18" stroke="#86efac" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="10" y1="30" x2="28" y2="27" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="31,9 25,9.5 27.5,13" fill="#dcfce7" />
          <polygon points="33,18 27,15.5 28,20.5" fill="#dcfce7" />
          <polygon points="30,27 24.5,24.5 25,29.5" fill="#dcfce7" />
        </svg>
      );

    case 'ice_arrow':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <line x1="6" y1="28" x2="28" y2="8" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <polygon points="31,5 22,8.5 27.5,14" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1" />
          <path d="M14,14 L22,22 M22,14 L14,22" stroke="#bae6fd" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="18" cy="18" r="4.5" fill="none" stroke="#7dd3fc" strokeWidth="1.4" />
        </svg>
      );

    case 'starfall_blessing':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <polygon
            points="18,4 21,13 30,13 23,18.5 25.5,28 18,22.5 10.5,28 13,18.5 6,13 15,13"
            fill="#facc15"
            stroke="#fef9c3"
            strokeWidth="1.2"
          />
          <path d="M18,12 L18,22 M13,17 L23,17" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case 'infinity_arrow_storm':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="12" fill="#059669" opacity="0.28" stroke="#34d399" strokeWidth="1.6" />
          <path d="M9,10 L17,28 M18,6 L18,29 M27,10 L19,28" stroke="#6ee7b7" strokeWidth="2.4" strokeLinecap="round" />
          <polygon points="18,32 14,25 22,25" fill="#fef08a" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="10" fill="#d4a853" opacity="0.4" stroke="#fde68a" strokeWidth="1.8" />
          <circle cx="18" cy="18" r="4" fill="#fef08a" />
        </svg>
      );
  }
};

/**
 * Classic MU Online Embossed Metallic Square Utility Icons (Character, Inventory, Chaos, Map, Party, Shop, Crossed Swords, Loot).
 */
export const MuUtilityIcon: React.FC<{
  kind: 'stats' | 'inventory' | 'chaos' | 'map' | 'party' | 'shop' | 'swords' | 'loot';
  className?: string;
}> = ({ kind, className = 'w-5 h-5' }) => {
  switch (kind) {
    case 'stats':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M12 3L6 6v5c0 4.5 2.7 8.1 6 10 3.3-1.9 6-5.5 6-10V6l-6-3z" />
          <circle cx="12" cy="10" r="2.2" fill="currentColor" />
          <path d="M9 15.5c1-1.3 5-1.3 6 0" strokeLinecap="round" />
        </svg>
      );
    case 'inventory':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M7 9a5 5 0 0 1 10 0" />
          <rect x="4.5" y="9" width="15" height="11.5" rx="2.2" />
          <path d="M4.5 14h15" />
          <rect x="10.2" y="12.4" width="3.6" height="3.2" rx="0.6" fill="currentColor" />
        </svg>
      );
    case 'chaos':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M12 3c2.8 3.2 5.5 6 5.5 10a5.5 5.5 0 1 1-11 0c0-2.5 1.1-4.8 2.6-6.7.2 1.8 1.2 2.9 2.4 3.2-.6-2.4-.2-4.6.5-6.5z" />
          <circle cx="12" cy="14.5" r="2" fill="currentColor" />
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.8 12h16.4M12 3.5c2.6 2.5 2.6 14.5 0 17M12 3.5c-2.6 2.5-2.6 14.5 0 17" />
        </svg>
      );
    case 'party':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <circle cx="9" cy="8.5" r="3" />
          <circle cx="16.5" cy="9.5" r="2.3" />
          <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" strokeLinecap="round" />
          <path d="M15.2 14.4c2.1.3 4.2 1.7 4.8 4.6" strokeLinecap="round" />
        </svg>
      );
    case 'shop':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M3.5 9.5L5.5 4.5h13l2 5" strokeLinejoin="round" />
          <path d="M3.5 9.5c0 1.4 1.2 2.5 2.8 2.5s2.8-1.1 2.8-2.5c0 1.4 1.3 2.5 2.9 2.5s2.9-1.1 2.9-2.5c0 1.4 1.2 2.5 2.8 2.5s2.8-1.1 2.8-2.5" />
          <path d="M5.5 12v7.5h13V12" />
        </svg>
      );
    case 'swords':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 19l5.5-5.5M19 19l-5.5-5.5" strokeLinecap="round" />
          <path d="M19.5 4.5L9 15l-2.5-2.5L17 2h2.5v2.5z" />
          <path d="M4.5 4.5L15 15l2.5-2.5L7 2H4.5v2.5z" />
          <path d="M6.5 15.5l2 2M17.5 15.5l-2 2" strokeLinecap="round" />
        </svg>
      );
    case 'loot':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <polygon points="12,3 20,9 12,21 4,9" />
          <path d="M4 9h16M12 3l-3 6 3 12 3-12-3-6z" />
        </svg>
      );
  }
};
