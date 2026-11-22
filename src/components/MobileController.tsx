import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import { gameAudio } from '../game/audio';
import { computeJoystickVector, JOYSTICK_MAX_RADIUS } from '../game/joystick';
import type { InputState } from '../game/types';

interface MobileControllerProps {
  inputRef: MutableRefObject<InputState>;
  dashRatio: number;
  dashCooldownSec: number;
  visible: boolean;
  onTriggerDash: () => void;
  onQuickTapCanvas: (clientX: number, clientY: number) => void;
}

const PAD_DIAMETER = 112;
const PAD_RADIUS = PAD_DIAMETER / 2;

export function MobileController({
  inputRef,
  dashRatio,
  dashCooldownSec,
  visible,
  onTriggerDash,
  onQuickTapCanvas,
}: MobileControllerProps) {
  const [engaged, setEngaged] = useState(false);
  const [dashPressed, setDashPressed] = useState(false);

  const zoneRef = useRef<HTMLDivElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const arrowRingRef = useRef<HTMLDivElement | null>(null);

  const activePointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const downMetaRef = useRef({ x: 0, y: 0, time: 0 });
  const floatingOffsetRef = useRef({ x: 0, y: 0 });
  const homeCenterRef = useRef({ x: 0, y: 0 });

  // Reset stick cleanly if overlay hides or window blurs
  useEffect(() => {
    const resetStick = () => {
      activePointerIdRef.current = null;
      inputRef.current.joyActive = false;
      inputRef.current.joyX = 0;
      inputRef.current.joyY = 0;
      setEngaged(false);
      if (padRef.current) {
        padRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
      }
      if (knobRef.current) {
        knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
      }
      if (arrowRingRef.current) {
        arrowRingRef.current.style.opacity = '0';
      }
    };

    if (!visible) {
      resetStick();
      return;
    }

    window.addEventListener('blur', resetStick);
    return () => {
      window.removeEventListener('blur', resetStick);
      resetStick();
    };
  }, [visible, inputRef]);

  if (!visible) return null;

  const dashReady = dashRatio >= 0.99;
  const ringRadius = 33;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - Math.max(0, Math.min(1, dashRatio)));

  const handleZonePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) return;
    e.stopPropagation();
    gameAudio.unlock();

    const padEl = padRef.current;
    if (!padEl) return;

    // Measure resting home position (transform is 0,0 before touch)
    const rect = padEl.getBoundingClientRect();
    const homeX = rect.left + rect.width * 0.5;
    const homeY = rect.top + rect.height * 0.5;
    homeCenterRef.current = { x: homeX, y: homeY };

    // Clamp floating joystick center inside comfortable screen bounds
    const clampedOriginX = Math.max(PAD_RADIUS + 10, Math.min(window.innerWidth * 0.48, e.clientX));
    const clampedOriginY = Math.max(150, Math.min(window.innerHeight - 92, e.clientY));

    originRef.current = { x: clampedOriginX, y: clampedOriginY };
    floatingOffsetRef.current = {
      x: clampedOriginX - homeX,
      y: clampedOriginY - homeY,
    };
    downMetaRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    activePointerIdRef.current = e.pointerId;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic events
    }

    padEl.style.transform = `translate3d(${floatingOffsetRef.current.x}px, ${floatingOffsetRef.current.y}px, 0px)`;
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    setEngaged(true);
  };

  const handleZonePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();

    const sample = computeJoystickVector(
      originRef.current.x,
      originRef.current.y,
      e.clientX,
      e.clientY,
      JOYSTICK_MAX_RADIUS
    );

    // Brawl Stars dynamic base follow when thumb drags beyond outer rim
    const nextOriginX = Math.max(PAD_RADIUS + 10, Math.min(window.innerWidth * 0.52, sample.nextOriginX));
    const nextOriginY = Math.max(150, Math.min(window.innerHeight - 92, sample.nextOriginY));
    if (nextOriginX !== originRef.current.x || nextOriginY !== originRef.current.y) {
      originRef.current = { x: nextOriginX, y: nextOriginY };
      const shiftX = nextOriginX - homeCenterRef.current.x;
      const shiftY = nextOriginY - homeCenterRef.current.y;
      if (padRef.current) {
        padRef.current.style.transform = `translate3d(${shiftX}px, ${shiftY}px, 0px)`;
      }
    }

    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${sample.knobX}px, ${sample.knobY}px, 0px)`;
    }

    if (arrowRingRef.current) {
      if (sample.active) {
        const deg = (sample.angle * 180) / Math.PI;
        arrowRingRef.current.style.opacity = '1';
        arrowRingRef.current.style.transform = `rotate(${deg}deg)`;
      } else {
        arrowRingRef.current.style.opacity = '0';
      }
    }

    inputRef.current.joyActive = sample.active;
    inputRef.current.joyX = sample.x;
    inputRef.current.joyY = sample.y;
    inputRef.current.pointerActive = false;
  };

  const handleZonePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();

    const elapsedMs = performance.now() - downMetaRef.current.time;
    const movedDist = Math.hypot(e.clientX - downMetaRef.current.x, e.clientY - downMetaRef.current.y);

    activePointerIdRef.current = null;
    inputRef.current.joyActive = false;
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
    setEngaged(false);

    if (padRef.current) {
      padRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    if (arrowRingRef.current) {
      arrowRingRef.current.style.opacity = '0';
    }

    // Quick tap passthrough allows tapping chests or loot drops even inside the left zone
    if (elapsedMs < 190 && movedDist < 14) {
      onQuickTapCanvas(e.clientX, e.clientY);
    }
  };

  return (
    <div
      data-testid="mobile-controller"
      className="fixed inset-0 z-20 pointer-events-none select-none"
    >
      {/* Left-Half Floating/Anchored Brawl Stars Virtual Thumbstick Zone */}
      <div
        ref={zoneRef}
        data-testid="mobile-joystick-zone"
        aria-label="이동 가상 조이스틱 영역"
        onPointerDown={handleZonePointerDown}
        onPointerMove={handleZonePointerMove}
        onPointerUp={handleZonePointerEnd}
        onPointerCancel={handleZonePointerEnd}
        className="pointer-events-auto touch-none fixed left-0 bottom-[66px] [@media(max-height:520px)]:bottom-2 w-[54%] h-[52%]"
      >
        {/* Resting / Floating Circular Thumbstick Base */}
        <div
          ref={padRef}
          data-testid="mobile-joystick"
          className={`absolute left-5 bottom-3 [@media(max-height:520px)]:bottom-3 w-[112px] h-[112px] rounded-full flex items-center justify-center transition-opacity duration-150 ${
            engaged ? 'opacity-100' : 'opacity-80'
          }`}
          style={{
            background: engaged
              ? 'radial-gradient(circle, rgba(16, 24, 38, 0.52) 0%, rgba(12, 18, 28, 0.78) 100%)'
              : 'radial-gradient(circle, rgba(14, 20, 30, 0.32) 0%, rgba(10, 14, 22, 0.62) 100%)',
            border: engaged ? '2px solid rgba(56, 189, 248, 0.82)' : '2px solid rgba(148, 163, 184, 0.42)',
            boxShadow: engaged
              ? '0 0 22px rgba(56, 189, 248, 0.25), inset 0 0 18px rgba(15, 23, 42, 0.7)'
              : '0 6px 18px rgba(0, 0, 0, 0.45), inset 0 0 14px rgba(15, 23, 42, 0.5)',
          }}
        >
          {/* Subtle inner guide ring & cardinal direction ticks */}
          <div className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-slate-400/25" />
          <span className="pointer-events-none absolute top-2 text-[9px] text-slate-300/60 leading-none">▲</span>
          <span className="pointer-events-none absolute bottom-2 text-[9px] text-slate-300/60 leading-none">▼</span>
          <span className="pointer-events-none absolute left-2 text-[9px] text-slate-300/60 leading-none">◀</span>
          <span className="pointer-events-none absolute right-2 text-[9px] text-slate-300/60 leading-none">▶</span>

          {/* Active Directional Heading Pointer */}
          <div
            ref={arrowRingRef}
            className="pointer-events-none absolute inset-0 transition-opacity duration-75"
            style={{ opacity: 0 }}
          >
            <div
              className="absolute right-[-7px] top-1/2 -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderLeft: '9px solid #38bdf8',
                filter: 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.9))',
              }}
            />
          </div>

          {/* Tactile Inner Thumb Knob */}
          <div
            ref={knobRef}
            data-testid="mobile-joystick-knob"
            className="pointer-events-none w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: engaged
                ? 'radial-gradient(circle at 35% 32%, #7dd3fc 0%, #0284c7 62%, #0c4a6e 100%)'
                : 'radial-gradient(circle at 35% 32%, #94a3b8 0%, #334155 68%, #0f172a 100%)',
              border: engaged ? '2px solid #e0f2fe' : '2px solid rgba(203, 213, 225, 0.65)',
              boxShadow: engaged
                ? '0 4px 16px rgba(56, 189, 248, 0.55)'
                : '0 4px 12px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div className="w-4 h-4 rounded-full bg-white/25 border border-white/40" />
          </div>
        </div>
      </div>

      {/* Right-Thumb Circular Brawl Stars Dash Action Pad */}
      <button
        type="button"
        tabIndex={-1}
        data-testid="mobile-dash-btn"
        aria-label="모바일 대시 충격파 발동"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          gameAudio.unlock();
          setDashPressed(true);
          onTriggerDash();
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setDashPressed(false);
        }}
        onPointerCancel={() => setDashPressed(false)}
        onPointerLeave={() => setDashPressed(false)}
        className={`pointer-events-auto touch-none fixed right-5 bottom-[84px] [@media(max-height:520px)]:bottom-5 w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center transition-transform duration-75 cursor-pointer ${
          dashPressed ? 'scale-92' : 'scale-100'
        }`}
        style={{
          background: dashReady
            ? 'radial-gradient(circle at 35% 28%, #fbbf24 0%, #d97706 68%, #78350f 100%)'
            : 'radial-gradient(circle at 35% 28%, #334155 0%, #1e293b 70%, #0f172a 100%)',
          boxShadow: dashReady
            ? '0 8px 22px rgba(245, 158, 11, 0.42), inset 0 1px 4px rgba(254, 243, 199, 0.65)'
            : '0 6px 16px rgba(0, 0, 0, 0.58)',
        }}
      >
        {/* Radial Cooldown Ring */}
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 76 76"
          aria-hidden="true"
        >
          <circle
            cx="38"
            cy="38"
            r={ringRadius}
            fill="none"
            stroke="rgba(15, 23, 42, 0.65)"
            strokeWidth="4.5"
          />
          <circle
            cx="38"
            cy="38"
            r={ringRadius}
            fill="none"
            stroke={dashReady ? '#fef08a' : '#f59e0b'}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringOffset}
          />
        </svg>

        {/* Dash Bolt Glyph */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="relative z-10"
        >
          <path
            d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"
            fill={dashReady ? '#1c1205' : '#94a3b8'}
          />
        </svg>
        <span
          className={`relative z-10 text-[11px] font-extrabold leading-none mt-0.5 font-mono-num ${
            dashReady ? 'text-[#1c1205]' : 'text-slate-300'
          }`}
        >
          {dashReady ? '대시' : `${dashCooldownSec.toFixed(1)}s`}
        </span>
      </button>
    </div>
  );
}
