import type { UpgradeId } from '../game/types';

export function TitleCrestSvg() {
  return (
    <svg
      viewBox="0 0 420 118"
      className="w-full max-w-[400px] h-auto select-none"
      role="img"
      aria-label="에버나이트 서바이버"
    >
      <defs>
        <filter id="crestShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#05070b" floodOpacity="0.9" />
        </filter>
      </defs>
      {/* Diegetic antique bronze sword & lantern crest divider */}
      <g filter="url(#crestShadow)">
        {/* Top ornamental blade rule */}
        <path
          d="M12 24 L250 24 L260 18 L270 24 L334 24"
          stroke="#c8923a"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <polygon points="6,24 14,19 22,24 14,29" fill="#f5b041" stroke="#0c0f15" strokeWidth="1.4" />
        <text
          x="32"
          y="16"
          fill="#d6b478"
          fontFamily="Cinzel, Georgia, serif"
          fontSize="12"
          fontWeight="700"
          letterSpacing="3.8"
        >
          EVERNIGHT SURVIVOR
        </text>

        {/* Primary Korean Display Lockup */}
        <text
          x="8"
          y="74"
          fill="#f6efe2"
          stroke="#0a0d13"
          strokeWidth="6"
          paintOrder="stroke fill"
          fontFamily="'Noto Sans KR', sans-serif"
          fontSize="44"
          fontWeight="800"
          letterSpacing="-1"
        >
          에버나이트
        </text>
        <text
          x="10"
          y="108"
          fill="#f2b950"
          stroke="#0a0d13"
          strokeWidth="5"
          paintOrder="stroke fill"
          fontFamily="'Noto Sans KR', sans-serif"
          fontSize="26"
          fontWeight="700"
          letterSpacing="3"
        >
          서바이버
        </text>
        {/* Right subtle rune sword glyph */}
        <path
          d="M148 98 L338 98"
          stroke="#8a6b38"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <polygon points="344,98 336,93 332,98 336,103" fill="#f5b041" stroke="#0c0f15" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

export function UpgradeIconSvg({ id, className = 'w-6 h-6' }: { id: UpgradeId; className?: string }) {
  switch (id) {
    case 'arcane_bolt':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M19 5L10 14M19 5L13 6M19 5L18 11" stroke="#0b0e14" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 19L10 14" stroke="#0b0e14" strokeWidth="4" strokeLinecap="round" />
          <path d="M19 5L6 18" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
          <polygon points="20,4 13,6 18,11" fill="#fef08a" stroke="#0b0e14" strokeWidth="1.3" />
          <circle cx="8" cy="16" r="2" fill="#fde68a" />
        </svg>
      );
    case 'orbit_blades':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M12 2L14.5 9L12 11L9.5 9Z" fill="#93c5fd" stroke="#0b0e14" strokeWidth="1.5" />
          <path d="M12 22L14.5 15L12 13L9.5 15Z" fill="#93c5fd" stroke="#0b0e14" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="2.2" fill="#f59e0b" stroke="#0b0e14" strokeWidth="1.2" />
        </svg>
      );
    case 'chain_lightning':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon
            points="14,2 5,13 11,13 9,22 19,10 13,10"
            fill="#7dd3fc"
            stroke="#0b0e14"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <polygon points="13.5,4.5 8,12 12,12 10.8,18.5 16.5,11 12.2,11" fill="#e0f2fe" />
        </svg>
      );
    case 'ember_nova':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="#7c2d12" stroke="#0b0e14" strokeWidth="1.8" />
          <path
            d="M12 4.5C14.5 7.5 16.5 9.5 16.5 12.5A4.5 4.5 0 1 1 7.5 12.5C7.5 9.8 9.8 8 10.6 6.2C11.1 7.4 11.8 7.5 12 4.5Z"
            fill="#fb923c"
            stroke="#0b0e14"
            strokeWidth="1.4"
          />
          <circle cx="12" cy="13.5" r="2.2" fill="#fef08a" />
        </svg>
      );
    case 'frost_lance':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="20,4 14,15 11,13 9,10" fill="#67e8f9" stroke="#0b0e14" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M4 20L11 13" stroke="#0b0e14" strokeWidth="4" strokeLinecap="round" />
          <path d="M4 20L11 13" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" />
          <circle cx="15" cy="9" r="1.4" fill="#ffffff" />
        </svg>
      );
    case 'holy_chakram':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="#0b0e14" strokeWidth="5.2" />
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="#fde047" strokeWidth="2.8" />
          <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="#fef9c3" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'swift_boots':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M7 5H13V13L18 14.5C19.2 14.9 20 15.9 20 17.2V19H5V13L7 5Z"
            fill="#4ade80"
            stroke="#0b0e14"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M4 9H8M3 12H7" stroke="#bbf7d0" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'blood_signet':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 20.5C12 20.5 4 15.2 4 9.5A4.5 4.5 0 0 1 12 6.8A4.5 4.5 0 0 1 20 9.5C20 15.2 12 20.5 12 20.5Z"
            fill="#ef4444"
            stroke="#0b0e14"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M8.5 9.5C8.5 8.2 9.5 7.5 10.6 7.5" stroke="#fecaca" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'magnet_charm':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M6 5V12A6 6 0 0 0 18 12V5H14.5V12A2.5 2.5 0 0 1 9.5 12V5Z"
            fill="#c084fc"
            stroke="#0b0e14"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <rect x="6" y="4.5" width="3.5" height="3.2" fill="#e2e8f0" stroke="#0b0e14" strokeWidth="1.2" />
          <rect x="14.5" y="4.5" width="3.5" height="3.2" fill="#e2e8f0" stroke="#0b0e14" strokeWidth="1.2" />
        </svg>
      );
    case 'berserk_crest':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon
            points="12,3 20,8 17,19 12,21 7,19 4,8"
            fill="#f59e0b"
            stroke="#0b0e14"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M12 7V16M8.5 11.5H15.5" stroke="#fef3c7" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'dash_core':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="13,3 21,12 13,21 13,15 4,15 4,9 13,9" fill="#38bdf8" stroke="#0b0e14" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M7 12H15" stroke="#e0f2fe" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

export function MuteIconSvg({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M4 9.5H8L13 5.5V18.5L8 14.5H4Z" fill="#e2dcd0" stroke="#0b0e14" strokeWidth="1.5" strokeLinejoin="round" />
      {muted ? (
        <path d="M16 9L21 15M21 9L16 15" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <path d="M16.5 8.5A4.8 4.8 0 0 1 16.5 15.5M19 6A8.2 8.2 0 0 1 19 18" fill="none" stroke="#f5b041" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function PauseIconSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <rect x="6" y="5" width="4.2" height="14" rx="1" fill="#e2dcd0" stroke="#0b0e14" strokeWidth="1.4" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1" fill="#e2dcd0" stroke="#0b0e14" strokeWidth="1.4" />
    </svg>
  );
}

export function RestartIconSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M19 12A7 7 0 1 1 16.8 6.9M19 4.5V8.5H15"
        fill="none"
        stroke="#e2dcd0"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SkullIconSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M12 3.5C7.6 3.5 4.5 6.6 4.5 10.6C4.5 13 5.7 15.1 7.6 16.3V19.5H16.4V16.3C18.3 15.1 19.5 13 19.5 10.6C19.5 6.6 16.4 3.5 12 3.5Z"
        fill="#e2dcd0"
        stroke="#0b0e14"
        strokeWidth="1.6"
      />
      <circle cx="9.2" cy="11" r="1.5" fill="#0b0e14" />
      <circle cx="14.8" cy="11" r="1.5" fill="#0b0e14" />
      <path d="M10 19.5V16.5M14 19.5V16.5" stroke="#0b0e14" strokeWidth="1.4" />
    </svg>
  );
}

export function GearSlotIconSvg({
  slot,
  color = '#cbd5e1',
  className = 'w-5 h-5',
}: {
  slot: 'weapon' | 'armor' | 'helm' | 'accessory';
  color?: string;
  className?: string;
}) {
  switch (slot) {
    case 'weapon':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M19.5 4.5L14 5.5L8.5 11L13 15.5L18.5 10L19.5 4.5Z"
            fill={color}
            stroke="#0b0e14"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M7 10L14 17" stroke="#f5b041" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M5 19L9.5 14.5" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'armor':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M7 4L10 6H14L17 4L20 7.5L17.5 11V19.5H6.5V11L4 7.5L7 4Z"
            fill={color}
            stroke="#0b0e14"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M12 7V19" stroke="#0b0e14" strokeWidth="1.3" opacity="0.55" />
          <path d="M8.5 11.5H15.5" stroke="#fef3c7" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        </svg>
      );
    case 'helm':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M5.5 13C5.5 8 8.3 4.5 12 4.5C15.7 4.5 18.5 8 18.5 13V18.5L15 17.5V13.5H9V17.5L5.5 18.5V13Z"
            fill={color}
            stroke="#0b0e14"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M12 4.5V12.5" stroke="#fef3c7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8.5 11.5H15.5" stroke="#0b0e14" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'accessory':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="14" r="6" fill="none" stroke={color} strokeWidth="2.8" />
          <polygon
            points="12,3 15.5,7 12,10 8.5,7"
            fill="#fef08a"
            stroke="#0b0e14"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}
