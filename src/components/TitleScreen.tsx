import { useState } from 'react';
import { ALL_HERO_CLASSES, HERO_CLASS_CATALOG } from '../game/classSkills';
import type { HeroClassId } from '../game/types';
import { TitleCrestSvg } from './GameIcons';

const TITLE_BG_URL = `${import.meta.env.BASE_URL}src/assets/images/title_bg_1795130863499.jpg`;

interface TitleScreenProps {
  selectedClass: HeroClassId;
  bestScore: number;
  muted: boolean;
  onSelectClass: (heroClass: HeroClassId) => void;
  onStart: () => void;
  onToggleMute: () => void;
}

function ClassEmblemSvg({ heroClass, color }: { heroClass: HeroClassId; color: string }) {
  if (heroClass === 'wizard') {
    return (
      <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none" stroke={color} strokeWidth="1.9">
        <path d="M14 3l2.2 5.4L22 10.6l-5.8 2.2L14 18.2l-2.2-5.4L6 10.6l5.8-2.2L14 3Z" fill={`${color}26`} />
        <path d="M14 18.2V25M10 23h8" strokeLinecap="round" />
      </svg>
    );
  }
  if (heroClass === 'warrior') {
    return (
      <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none" stroke={color} strokeWidth="1.9">
        <path d="M14 3l3 4v11h-6V7l3-4Z" fill={`${color}26`} strokeLinejoin="round" />
        <path d="M9 18h10M14 18v7M11.5 25h5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none" stroke={color} strokeWidth="1.9">
      <path d="M8 22C5 16.5 6.5 9.5 13 6c3.2-1.7 6.4-2 9-1.5" strokeLinecap="round" />
      <path d="M8 22L22 4.5" strokeLinecap="round" strokeOpacity="0.45" />
      <path d="M9 19l12-12M16 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TitleScreen({
  selectedClass,
  bestScore,
  muted,
  onSelectClass,
  onStart,
  onToggleMute,
}: TitleScreenProps) {
  const [bgFailed, setBgFailed] = useState(false);
  const activeDef = HERO_CLASS_CATALOG[selectedClass];

  return (
    <main className="fixed inset-0 z-20 flex flex-col justify-between overflow-y-auto bg-[#10151d]">
      {/* Illustrated Key-Art Backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        {!bgFailed ? (
          <img
            src={TITLE_BG_URL}
            alt="고대 던전 유적과 횃불이 타오르는 밤의 전장"
            referrerPolicy="no-referrer"
            onError={() => setBgFailed(true)}
            className="w-full h-full object-cover object-right md:object-center"
          />
        ) : (
          <div className="w-full h-full bg-[#131922]" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(9,12,18,0.94) 0%, rgba(9,12,18,0.82) 56%, rgba(9,12,18,0.42) 86%, rgba(9,12,18,0.58) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(0deg, rgba(8,11,16,0.92) 0%, rgba(8,11,16,0) 28%)',
          }}
        />
      </div>

      {/* Top safe spacer + sound toggle */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4 md:px-10 md:pt-6">
        <div className="text-xs text-[#a5aebc] font-mono-num">
          {bestScore > 0 ? (
            <span className="text-amber-300 font-semibold">최고 기록 {bestScore.toLocaleString()}점</span>
          ) : (
            <span>3클래스 · 5속성 × 3티어 스킬 트리 · 방랑 장비 상인</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
          className="px-3 py-1.5 text-xs font-semibold text-[#d7d0c3] bg-[#141923]/90 border border-[#3a4352] hover:border-[#c8923a] hover:text-[#fef3c7] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          {muted ? '음소거 해제 [M]' : '효과음 켜짐 [M]'}
        </button>
      </div>

      {/* Main Focal Composition: Title Crest + 3-Class Selector + Launch CTA */}
      <section className="relative z-10 flex-1 flex items-center px-5 py-4 sm:px-10 md:px-14 lg:px-18">
        <div className="w-full max-w-[780px] flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <TitleCrestSvg />
            <p className="text-sm sm:text-[15px] font-medium text-[#e5dfd2] leading-snug max-w-[600px]">
              3가지 직업과 5대 속성(화염·빙결·전기·독·물리) 3티어 스킬 트리, 방랑 장비 상인을 조합해 20단계 무한 전장을 돌파하세요.
            </p>
          </div>

          {/* 3 Playable Hero Class Selection Cards */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-300 tracking-wide">클래스 선택</span>
              <span className="text-[#96a2b4]">직업별 전용 기본 무기 · 시너지 · 하이브리드 퓨전</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ALL_HERO_CLASSES.map((clsId) => {
                const def = HERO_CLASS_CATALOG[clsId];
                const isSelected = selectedClass === clsId;

                return (
                  <button
                    key={clsId}
                    type="button"
                    data-testid={`class-select-${clsId}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectClass(clsId)}
                    className={`group relative flex flex-col justify-between text-left p-3.5 rounded-md border transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      isSelected
                        ? 'bg-[#141c28]/95 -translate-y-0.5'
                        : 'bg-[#0e131c]/88 border-[#2b3444] hover:border-[#4b5972] hover:bg-[#131a26]/92'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: def.accent,
                            boxShadow: `0 10px 26px rgba(0,0,0,0.65), 0 0 22px ${def.accent}2e`,
                          }
                        : undefined
                    }
                  >
                    <div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded flex items-center justify-center border shrink-0"
                          style={{
                            backgroundColor: isSelected ? `${def.accent}22` : '#161e2b',
                            borderColor: isSelected ? def.accent : '#313d50',
                          }}
                        >
                          <ClassEmblemSvg heroClass={clsId} color={def.accent} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className="text-base font-extrabold tracking-tight"
                              style={{ color: isSelected ? def.accent : '#f3eee4' }}
                            >
                              {def.name}
                            </span>
                            <span className="text-[11px] font-semibold text-[#8592a6]">{def.englishName}</span>
                          </div>
                          <div className="text-[11px] font-bold text-[#d8e0ec] truncate">{def.concept}</div>
                        </div>
                      </div>

                      <div className="mt-2.5 text-[11px] font-bold text-amber-200">
                        기본 무기: {def.basicWeaponLabel}
                        <span className="block text-[10.5px] font-semibold text-[#b8c4d4] mt-0.5">
                          {def.atkSpeedSummary}
                        </span>
                      </div>

                      <p className="mt-2 text-[11px] text-[#c3cedd] leading-snug">{def.gimmick}</p>
                      <p className="mt-1 text-[10.5px] text-[#94a3b8] leading-snug">
                        <strong style={{ color: def.accent }}>시너지:</strong> {def.synergy}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between gap-1 text-[10.5px] font-mono-num">
                      <span className="text-[#a5b5c9] truncate">고유 자원 · {def.resourceLabel}</span>
                      <span
                        className="font-extrabold shrink-0"
                        style={{ color: isSelected ? def.accent : '#64748b' }}
                      >
                        {isSelected ? '선택됨' : '선택'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Action CTA */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="px-8 py-3.5 text-base font-extrabold text-[#141008] bg-[#e5a43a] hover:bg-[#f2b852] active:translate-y-[1px] border border-[#fde68a]/80 rounded-md shadow-[0_10px_28px_rgba(0,0,0,0.65)] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              {activeDef.name}로 출정 · 게임 시작
            </button>
            <div className="text-xs text-[#a5b0c2] leading-snug">
              <div>
                시작 무기: <strong className="text-[#f3eee4]">{activeDef.starterWeaponName}</strong> ({activeDef.basicWeaponLabel})
              </div>
              <div className="text-[11px] text-[#8490a3]">
                {activeDef.atkSpeedSummary} · 20단계 · 보스 4종
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom flat borderless control hint line */}
      <footer className="relative z-10 px-5 pb-4 sm:px-10 md:px-14 lg:px-18 flex flex-wrap items-center justify-between gap-2 text-xs text-[#a9b2c1]">
        <p className="hud-text-stroke">
          클릭/드래그 이동 · K 스킬 트리(5속성 × 3티어) · 방랑 상인 골드 장비 강화 · Space 대시 · WASD 지원
        </p>
        <p className="text-[#808a9b] hud-text-stroke font-mono-num">
          노말 58% · 레어 30% · 에픽 10% · 전설 2%
        </p>
      </footer>
    </main>
  );
}
