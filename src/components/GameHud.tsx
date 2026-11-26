import { type RefObject, useEffect, useRef, useState } from 'react';
import { ALL_GEAR_SLOTS, GEAR_RARITY_META, GEAR_SLOT_META } from '../game/catalog';
import {
  ALL_SKILL_ATTRIBUTES,
  ATTRIBUTE_META,
  HERO_CLASS_CATALOG,
  getAttributeInvestedPoints,
} from '../game/classSkills';
import type { HudSnapshot } from '../game/types';
import {
  GearSlotIconSvg,
  MuteIconSvg,
  PauseIconSvg,
  RestartIconSvg,
  SkullIconSvg,
} from './GameIcons';

const HERO_PORTRAIT_URL = `${import.meta.env.BASE_URL}src/assets/images/hero_portrait_1795130865371.jpg`;

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  minimapCanvasRef: RefObject<HTMLCanvasElement | null>;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onTriggerDash: () => void;
  onOpenSkillTree: () => void;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function GameHud({
  hud,
  muted,
  minimapCanvasRef,
  onToggleMute,
  onTogglePause,
  onRestart,
  onTriggerDash,
  onOpenSkillTree,
}: GameHudProps) {
  const [heroFailed, setHeroFailed] = useState(false);
  const [ghostHpRatio, setGhostHpRatio] = useState(1);
  const prevHpRef = useRef(hud.hp);

  const hpRatio = hud.maxHp > 0 ? Math.max(0, Math.min(1, hud.hp / hud.maxHp)) : 0;
  const xpRatio = hud.xpToNext > 0 ? Math.max(0, Math.min(1, hud.xp / hud.xpToNext)) : 0;
  const bossRatio = hud.bossMaxHp > 0 ? Math.max(0, Math.min(1, hud.bossHp / hud.bossMaxHp)) : 0;
  const rageRatio = hud.maxRage > 0 ? Math.max(0, Math.min(1, hud.rage / hud.maxRage)) : 0;
  const lowHp = hpRatio <= 0.3 && hud.hp > 0;
  const classDef = HERO_CLASS_CATALOG[hud.heroClass];
  const hasSp = hud.skillPoints > 0;
  const showLevelUpAnim = hud.levelUpAnimRatio > 0;

  useEffect(() => {
    if (hud.hp < prevHpRef.current) {
      const timer = window.setTimeout(() => {
        setGhostHpRatio(hpRatio);
      }, 300);
      prevHpRef.current = hud.hp;
      return () => window.clearTimeout(timer);
    }
    setGhostHpRatio(hpRatio);
    prevHpRef.current = hud.hp;
  }, [hud.hp, hpRatio]);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Peripheral critical low-HP crimson vignette */}
      {lowHp && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 90px rgba(220, 38, 38, 0.45)',
          }}
        />
      )}

      {/* Top-Anchored Level-Up Notification Banner (keeps center character animation 100% unobstructed!) */}
      {showLevelUpAnim && (
        <div
          key={`lvup-${hud.levelUpAnimLevel}`}
          data-testid="levelup-banner"
          role="status"
          aria-live="polite"
          className="fixed top-[68px] sm:top-[76px] inset-x-0 z-20 flex justify-center px-3 pointer-events-none"
          style={{ opacity: Math.min(1, hud.levelUpAnimRatio * 2.4) }}
        >
          <div className="relative flex flex-col items-center">
            {/* Subtle top sunburst glow strictly behind the upper banner */}
            <div
              aria-hidden="true"
              className="animate-levelup-spin absolute -top-12 w-44 h-44 rounded-full opacity-45"
              style={{
                background: `repeating-conic-gradient(from 0deg, ${classDef.accent}48 0deg 12deg, rgba(251,191,36,0.34) 12deg 18deg, transparent 18deg 36deg)`,
                maskImage: 'radial-gradient(circle, black 10%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 70%)',
              }}
            />

            <div
              className="animate-levelup-pop relative flex flex-col items-center px-5 py-2 sm:px-7 sm:py-2.5 rounded-lg bg-[#0d111b]/94 border-2 shadow-[0_12px_36px_rgba(0,0,0,0.85),0_0_28px_rgba(251,191,36,0.45)]"
              style={{ borderColor: '#fbbf24' }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-lg sm:text-2xl font-black tracking-tight hud-text-stroke"
                  style={{
                    backgroundImage: 'linear-gradient(180deg, #fef9c3 0%, #fbbf24 55%, #f59e0b 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  LEVEL UP!
                </span>
                <span className="text-[#475569]">·</span>
                <span
                  className="text-xs sm:text-sm font-extrabold font-mono-num"
                  style={{ color: classDef.accent }}
                >
                  Lv.{hud.levelUpAnimLevel} 달성
                </span>
                <span className="text-xs sm:text-sm font-extrabold font-mono-num text-amber-300">
                  +1 SP
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-[#cbd5e1] mt-0.5">
                하단 빛나는 스킬 트리 [K]에서 5속성 스킬을 강화하세요
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2 px-2.5 pt-2.5 sm:px-5 sm:pt-4">
        {/* Top-Left Cluster: Hero Portrait + Class Badge + Vitality Bar + Resource/ATK/DEF */}
        <div className="flex items-center gap-2 sm:gap-2.5 bg-[#121720]/90 border border-[#3a4352] rounded-md px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-[0_6px_18px_rgba(0,0,0,0.55)] shrink-0">
          <div
            className="relative w-9 h-9 sm:w-11 sm:h-11 rounded overflow-hidden border bg-[#1a212d] shrink-0"
            style={{ borderColor: classDef.accent }}
          >
            {!heroFailed ? (
              <img
                src={HERO_PORTRAIT_URL}
                alt={`${classDef.name} 영웅 초상화`}
                referrerPolicy="no-referrer"
                onError={() => setHeroFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-300">
                LV{hud.level}
              </div>
            )}
            <span className="absolute bottom-0 right-0 px-1 text-[10px] font-bold font-mono-num bg-[#0c0f15]/90 text-amber-300 leading-tight">
              {hud.level}
            </span>
          </div>

          <div className="w-28 sm:w-52 flex flex-col gap-1">
            {/* Class + CP + HP Readout */}
            <div className="flex items-baseline justify-between gap-1">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span
                  data-testid="hud-class-name"
                  className="text-[10px] sm:text-[11px] font-extrabold tracking-tight truncate"
                  style={{ color: classDef.accent }}
                >
                  {classDef.name}
                </span>
                <span className="text-[#475569] text-[9px]">·</span>
                <span
                  className="text-[10px] font-semibold tracking-wider text-amber-300 font-mono-num shrink-0"
                  data-testid="hud-cp"
                >
                  CP {hud.combatPower}
                </span>
              </div>
              <span
                className={`text-xs font-bold font-mono-num hud-text-stroke shrink-0 ${
                  lowHp ? 'text-red-400' : 'text-[#f3eee4]'
                }`}
              >
                {hud.hp}/{hud.maxHp}
              </span>
            </div>

            <div className="relative h-2 sm:h-2.5 w-full bg-[#0a0d13] border border-[#2d3544] rounded-xs overflow-hidden">
              <div
                className="absolute inset-0 origin-left bg-amber-300/80 transition-transform duration-300"
                style={{ transform: `scaleX(${Math.max(hpRatio, ghostHpRatio)})` }}
              />
              <div
                className="absolute inset-0 origin-left transition-transform duration-100"
                style={{
                  transform: `scaleX(${hpRatio})`,
                  backgroundColor: lowHp ? '#ef4444' : '#dc2626',
                }}
              />
            </div>

            {/* Compact ATK/DEF/GOLD + Class Resource Strip */}
            <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono-num">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[#cbd5e1]">
                <span>
                  공 <strong className="text-amber-200">{hud.atk}</strong>
                </span>
                <span>
                  방 <strong className="text-sky-300">{hud.def}</strong>
                </span>
                <span data-testid="hud-gold" className="text-yellow-300 font-bold">
                  {hud.gold.toLocaleString()}G
                </span>
              </div>

              {hud.heroClass === 'warrior' ? (
                <div className="hidden sm:flex items-center gap-1 w-16" title="워리어 분노/충격 게이지">
                  <span className="text-[9px] font-bold text-orange-300 shrink-0">
                    {hud.tyrantActive ? '폭군' : '분노'}
                  </span>
                  <div className="relative flex-1 h-1.5 bg-[#0a0d13] border border-[#2d3544] rounded-xs overflow-hidden">
                    <div
                      className="absolute inset-0 origin-left"
                      style={{
                        transform: `scaleX(${rageRatio})`,
                        backgroundColor: hud.tyrantActive ? '#facc15' : '#f97316',
                      }}
                    />
                  </div>
                </div>
              ) : hud.heroClass === 'archer' ? (
                <span className="hidden sm:inline text-[10px] font-bold text-emerald-300 shrink-0">
                  콤보 {hud.comboCount}
                </span>
              ) : hud.activeFusions.length > 0 ? (
                <span className="hidden sm:inline text-[10px] font-bold text-fuchsia-300 shrink-0">
                  융합 {hud.activeFusions.length}
                </span>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 w-14">
                  <div className="relative flex-1 h-1.5 bg-[#0a0d13] border border-[#2d3544] rounded-xs overflow-hidden">
                    <div
                      className="absolute inset-0 origin-left"
                      style={{
                        transform: `scaleX(${hud.dashRatio})`,
                        backgroundColor: hud.dashRatio >= 0.99 ? '#f5b041' : '#64748b',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {hud.playerStatuses.length > 0 && (
              <div className="flex items-center gap-1 pt-0.5" data-testid="hud-player-statuses">
                {hud.playerStatuses.map((st) => {
                  const cfg =
                    st === 'freeze'
                      ? { label: '빙결', color: '#7dd3fc', border: '#0284c7', bg: 'rgba(12, 74, 110, 0.88)' }
                      : st === 'burn'
                        ? { label: '화상', color: '#fdba74', border: '#ea580c', bg: 'rgba(124, 45, 18, 0.88)' }
                        : { label: '중독', color: '#86efac', border: '#16a34a', bg: 'rgba(20, 83, 45, 0.88)' };
                  return (
                    <span
                      key={st}
                      className="px-1.5 py-0.5 text-[9px] font-bold rounded-xs border leading-none"
                      style={{ color: cfg.color, borderColor: cfg.border, backgroundColor: cfg.bg }}
                    >
                      {cfg.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top-Center Cluster: Stage X/20 + Survival Timer + Dynamic Biome */}
        <div className="flex flex-col items-center min-w-0">
          <div className="flex flex-col items-center bg-[#121720]/88 border border-[#3a4352] rounded-md px-2.5 sm:px-4 py-1 sm:py-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider whitespace-nowrap">
              <span className="text-amber-300 font-mono-num" data-testid="hud-stage">
                STAGE {hud.wave}/{hud.maxWaves}
              </span>
              <span className="hidden sm:inline text-[#4c566a]">|</span>
              <span
                className="hidden sm:inline font-bold"
                style={{ color: hud.biomeAccent }}
                data-testid="hud-biome"
              >
                {hud.biomeName}
              </span>
            </div>
            <span className="text-base sm:text-2xl font-bold font-mono-num text-[#f6f1e6] leading-tight hud-text-stroke">
              {formatTime(hud.elapsed)}
            </span>
          </div>
        </div>

        {/* Responsive Boss HP Bar, Boss Alert & Stage Banner */}
        <div
          className={`fixed ${
            showLevelUpAnim ? 'top-[132px] sm:top-[142px]' : 'top-[72px] sm:top-[76px]'
          } left-2.5 right-[130px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 flex flex-col items-stretch sm:items-center pointer-events-none transition-all`}
        >
          {/* Boss HP Bar when active */}
          {hud.bossActive && (
            <div
              className="w-full sm:w-84 bg-[#14101c]/95 border rounded-md px-2.5 sm:px-3 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.75)]"
              style={{ borderColor: `${hud.bossAccent}88` }}
            >
              <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                <span className="font-bold text-[#f6f1e6] truncate">{hud.bossName}</span>
                <span className="font-mono-num shrink-0" style={{ color: hud.bossAccent }}>
                  {hud.bossHp}/{hud.bossMaxHp}
                </span>
              </div>
              {hud.bossSubtitle && (
                <p className="text-[10px] text-[#a5aebc] mb-1 truncate">{hud.bossSubtitle}</p>
              )}
              <div className="h-2 sm:h-2.5 w-full bg-[#09070f] border border-[#2a2f3d] rounded-xs overflow-hidden">
                <div
                  className="h-full w-full origin-left transition-transform duration-100"
                  style={{
                    transform: `scaleX(${bossRatio})`,
                    backgroundColor: hud.bossAccent,
                  }}
                />
              </div>
            </div>
          )}

          {/* Boss Appearance Alert (보스 출현 알림) */}
          {hud.bossAlert && (
            <div
              data-testid="boss-alert-banner"
              role="status"
              aria-live="assertive"
              className="mt-2 w-full sm:w-96 bg-[#0d0a14]/95 border rounded-md overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.85)]"
              style={{ borderColor: `${hud.bossAlert.accent}cc` }}
            >
              <div
                className="h-1 w-full"
                style={{
                  background: `linear-gradient(90deg, transparent, ${hud.bossAlert.accent}, transparent)`,
                }}
              />
              <div className="px-2.5 py-1.5 sm:px-5 sm:py-2.5 text-center">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-[9px] sm:text-xs font-extrabold tracking-[0.16em] sm:tracking-[0.22em] font-mono-num">
                  <span
                    className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rotate-45 shrink-0"
                    style={{ backgroundColor: hud.bossAlert.accent }}
                  />
                  <span className="truncate" style={{ color: hud.bossAlert.accent }}>
                    WARNING · STAGE {hud.bossAlert.stage} 보스 출현
                  </span>
                  <span
                    className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rotate-45 shrink-0"
                    style={{ backgroundColor: hud.bossAlert.accent }}
                  />
                </div>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-xl font-extrabold text-[#f8f3e8] hud-text-stroke tracking-tight truncate">
                  {hud.bossAlert.name}
                </p>
                <p className="mt-0.5 text-[10px] sm:text-xs font-medium text-[#cbd5e1] truncate">
                  {hud.bossAlert.subtitle}
                </p>
              </div>
              <div className="h-1 w-full bg-[#1a1524]">
                <div
                  className="h-full w-full origin-left transition-transform duration-200 ease-linear"
                  style={{
                    transform: `scaleX(${hud.bossAlert.ratio})`,
                    backgroundColor: hud.bossAlert.accent,
                  }}
                />
              </div>
            </div>
          )}

          {/* Wandering Equipment Merchant Arrival Alert & Live 30s Countdown */}
          {hud.merchantActive && hud.merchantAlertRatio > 0 && !hud.bossAlert && (
            <div
              data-testid="merchant-alert-banner"
              role="status"
              aria-live="polite"
              className="mt-2 w-full sm:w-96 bg-[#081512]/95 border border-emerald-400/85 rounded-md overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.82)]"
            >
              <div
                className="h-1 w-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, #34d399, #facc15, #34d399, transparent)',
                }}
              />
              <div className="px-3 py-1.5 sm:px-5 sm:py-2 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-extrabold tracking-[0.14em] text-emerald-300 font-mono-num">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                  <span>장비 상인 출현 · 남은 시간 {hud.merchantTimeLeft}초</span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm font-extrabold text-[#f6f1e6]">
                  미니맵 초록 방향(약 20초 거리) 상인에게 골드로 장비를 강화하세요!
                </p>
              </div>
              <div className="h-1 w-full bg-[#102721]">
                <div
                  className="h-full w-full origin-left bg-emerald-400 transition-transform duration-200 ease-linear"
                  style={{ transform: `scaleX(${hud.merchantAlertRatio})` }}
                />
              </div>
            </div>
          )}

          {hud.merchantActive && hud.merchantAlertRatio <= 0 && !hud.bossAlert && (
            <div
              data-testid="merchant-countdown-pill"
              className="mt-1.5 px-3 py-1 bg-[#081612]/92 border border-emerald-400/75 rounded text-[11px] sm:text-xs font-bold text-emerald-200 font-mono-num self-start sm:self-center shadow-[0_4px_14px_rgba(0,0,0,0.6)]"
            >
              방랑 장비 상인 출현 중 · 남은 {hud.merchantTimeLeft}초 (미니맵 초록 방향)
            </div>
          )}

          {/* Transient Stage / Biome Announcement Banner */}
          {hud.bannerText &&
            !hud.bossActive &&
            !hud.bossAlert &&
            !showLevelUpAnim &&
            !(hud.merchantActive && hud.merchantAlertRatio > 0) && (
              <div className="mt-1 px-3 py-1 bg-[#141821]/92 border border-[#7c5d2f] rounded text-xs sm:text-sm font-bold text-amber-200 hud-text-stroke whitespace-nowrap max-w-full sm:max-w-[92vw] truncate self-start sm:self-center">
                {hud.bannerText}
              </div>
            )}
        </div>

        {/* Top-Right Cluster: Kills/Score + Utility Buttons + Open-Field Minimap */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex items-center gap-3.5 bg-[#121720]/90 border border-[#3a4352] rounded-md px-3.5 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-1.5">
                <SkullIconSvg />
                <span
                  className="text-base font-bold font-mono-num text-[#f3eee4]"
                  data-testid="hud-kills"
                >
                  {hud.kills}
                </span>
              </div>
              <div className="w-px h-4 bg-[#313a49]" />
              <div className="flex flex-col items-end leading-none">
                <span className="text-[10px] text-[#95a0b0]">점수</span>
                <span
                  className="text-sm font-bold font-mono-num text-amber-300"
                  data-testid="hud-score"
                >
                  {hud.score.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
                title="음소거 [M]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="w-9 h-9 flex items-center justify-center bg-[#141a24]/92 hover:bg-[#1e2636] border border-[#3a4352] hover:border-amber-400/70 rounded-md transition-colors cursor-pointer"
              >
                <MuteIconSvg muted={muted} />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="일시정지"
                title="일시정지 [P]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTogglePause();
                }}
                className="w-9 h-9 flex items-center justify-center bg-[#141a24]/92 hover:bg-[#1e2636] border border-[#3a4352] hover:border-amber-400/70 rounded-md transition-colors cursor-pointer"
              >
                <PauseIconSvg />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="다시 시작"
                title="다시 시작 [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="hidden sm:flex w-9 h-9 items-center justify-center bg-[#141a24]/92 hover:bg-[#1e2636] border border-[#3a4352] hover:border-amber-400/70 rounded-md transition-colors cursor-pointer"
              >
                <RestartIconSvg />
              </button>
            </div>
          </div>

          {/* Top-Right Open-Field Radar Minimap */}
          <div
            data-testid="hud-minimap"
            className="flex flex-col items-center bg-[#0d1119]/92 border rounded-md p-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.68)]"
            style={{
              borderColor: hud.bossActive
                ? `${hud.bossAccent}aa`
                : hud.merchantActive
                  ? '#34d399cc'
                  : '#3a4352',
            }}
          >
            <div className="w-full flex items-center justify-between gap-2 px-0.5 pb-1 text-[9px] sm:text-[10px] font-mono-num leading-none">
              <span className="font-bold text-[#cbd5e1] tracking-wider">미니맵</span>
              <span className="text-[#8e9aad]">
                {hud.playerCoordX},{hud.playerCoordY}
              </span>
            </div>
            <canvas
              ref={minimapCanvasRef}
              width={136}
              height={136}
              data-testid="hud-minimap-canvas"
              aria-label="오픈 필드 미니맵"
              className="block w-[96px] h-[96px] sm:w-[132px] sm:h-[132px] rounded-xs"
            />
            <div className="w-full flex items-center justify-between gap-1 pt-1 px-0.5 text-[9px] leading-none">
              <span className="flex items-center gap-1 text-[#cbd5e1]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
                나
              </span>
              {hud.merchantActive ? (
                <span className="flex items-center gap-1 text-emerald-300 font-bold font-mono-num">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  상인 {hud.merchantTimeLeft}s
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-300 font-mono-num">
                  <span className="inline-block w-1.5 h-1.5 bg-amber-400" />
                  상자 {hud.unopenedChestCount}
                </span>
              )}
              <span
                className="flex items-center gap-1 font-bold"
                style={{ color: hud.bossActive ? hud.bossAccent : '#64748b' }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rotate-45"
                  style={{ backgroundColor: hud.bossActive ? hud.bossAccent : '#475569' }}
                />
                보스
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Strip: Equipped Gear Status + Glowing Class Skill Tree Button + Desktop Quick Dash */}
      <div className="fixed bottom-3.5 sm:bottom-4 left-2.5 right-2.5 sm:left-5 sm:right-5 flex items-end justify-center md:justify-between gap-2">
        <div className="flex items-end gap-1.5 sm:gap-2.5 min-w-0">
          {/* 4 Equipped Gear Status Badges (Merchant upgrades + looted gear; no duplicate shard forge) */}
          <div className="flex items-center gap-1 bg-[#10151e]/92 border border-[#3a4352] rounded-md p-1 shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
            {ALL_GEAR_SLOTS.map((slot) => {
              const item = hud.equipment[slot];
              const meta = GEAR_SLOT_META[slot];
              const rarity = item ? GEAR_RARITY_META[item.rarity] : null;
              return (
                <div
                  key={slot}
                  title={
                    item
                      ? `${item.name} (${rarity?.label}) · 상인에게 골드로 장비 강화 가능`
                      : `${meta.label} 미장착`
                  }
                  className="relative w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center border"
                  style={{
                    backgroundColor: rarity ? rarity.bg : '#151b26',
                    borderColor: rarity ? rarity.border : '#2f3848',
                  }}
                >
                  <GearSlotIconSvg
                    slot={slot}
                    color={rarity ? rarity.color : '#64748b'}
                    className="w-4 h-4 sm:w-5 sm:h-5"
                  />
                  <span className="absolute -bottom-1 right-0.5 text-[8px] sm:text-[9px] font-bold bg-[#0a0d13]/95 px-0.5 rounded-xs text-[#cbd5e1] leading-tight">
                    {meta.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Clickable 5-Attribute Class Skill Tree Button (Glowing + Shimmering when SP > 0!) */}
          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-skilltree-btn"
            data-glowing={hasSp ? 'true' : 'false'}
            aria-label={`${classDef.name} 스킬 트리 열기${hasSp ? ` (스킬 포인트 ${hud.skillPoints} 보유)` : ''}`}
            title={`${classDef.name} 5속성 × 3티어 스킬 트리 [K]`}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSkillTree();
            }}
            className={`pointer-events-auto relative flex flex-col items-start justify-center px-2.5 py-1.5 rounded-md border text-left transition-all cursor-pointer ${
              hasSp
                ? 'animate-skill-glow bg-[#2b1f09]/95 border-amber-300 hover:bg-[#3a2a0d]'
                : 'bg-[#10151e]/92 border-[#3a4352] hover:border-[#55647c] shadow-[0_4px_14px_rgba(0,0,0,0.55)]'
            }`}
          >
            {hasSp && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
              >
                <span className="animate-skill-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />
              </span>
            )}

            {hasSp && (
              <span
                data-testid="hud-sp-badge"
                className="animate-badge-bounce absolute -top-2 -right-2 px-1.5 py-0.5 text-[9.5px] font-black font-mono-num rounded-xs bg-amber-300 text-[#181003] border border-amber-100 leading-none shadow-[0_2px_10px_rgba(251,191,36,0.8)]"
              >
                +{hud.skillPoints} SP
              </span>
            )}

            <span
              className={`relative z-10 text-[10px] font-extrabold leading-tight whitespace-nowrap ${
                hasSp ? 'text-amber-200' : 'text-[#f3eee4]'
              }`}
            >
              스킬<span className="hidden sm:inline"> 트리 [K]</span>
            </span>
            <div className="relative z-10 flex items-center gap-1 mt-1">
              {ALL_SKILL_ATTRIBUTES.map((attr) => {
                const invested = getAttributeInvestedPoints(hud.classSkills, attr) > 0;
                const color = ATTRIBUTE_META[attr].color;
                return (
                  <span
                    key={attr}
                    className="inline-block w-2 h-2 rounded-xs border"
                    style={{
                      backgroundColor: invested ? color : '#18202c',
                      borderColor: invested ? color : '#334155',
                    }}
                  />
                );
              })}
            </div>
          </button>
        </div>

        {/* Dedicated Desktop Quick Dash Action Button */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="대시 충격파 발동"
          onClick={(e) => {
            e.currentTarget.blur();
            onTriggerDash();
          }}
          className={`hidden md:inline-flex pointer-events-auto px-3.5 py-2 text-xs font-bold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-[0_6px_16px_rgba(0,0,0,0.55)] ${
            hud.dashRatio >= 0.99
              ? 'bg-[#e5a43a] text-[#141008] border-[#fde68a] hover:bg-[#f2b852]'
              : 'bg-[#171d27]/90 text-[#8c96a8] border-[#333c4b]'
          }`}
        >
          {hud.dashRatio >= 0.99 ? '대시 충격파 [Space]' : `대시 ${hud.dashCooldownSec.toFixed(1)}s`}
        </button>
      </div>

      {/* Full-width slim bottom XP progress track */}
      <div className="fixed bottom-0 inset-x-0 h-2 bg-[#0a0d13] border-t border-[#293140]">
        <div
          className="h-full w-full origin-left bg-[#38bdf8] transition-transform duration-150"
          style={{ transform: `scaleX(${xpRatio})` }}
        />
      </div>
    </div>
  );
}
