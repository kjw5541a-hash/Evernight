import { useState } from 'react';
import {
  ALL_SKILL_ATTRIBUTES,
  ALL_SKILL_TIERS,
  ATTRIBUTE_META,
  CLASS_SKILL_CATALOG,
  HERO_CLASS_CATALOG,
  HYBRID_FUSION_CATALOG,
  MAX_CLASS_SKILL_LEVEL,
  canUpgradeClassSkill,
  getAttributeInvestedPoints,
  getSkillSynergyMultiplier,
  getTotalClassSkillPointsSpent,
  hasTier2OrHigher,
} from '../game/classSkills';
import type {
  ClassSkillTreeState,
  HeroClassId,
  HybridFusionId,
  MutationChoice,
  SkillAttribute,
  SkillTier,
} from '../game/types';

interface SkillTreeModalProps {
  heroClass: HeroClassId;
  level: number;
  skillPoints: number;
  weaponAtk: number;
  classSkills: ClassSkillTreeState;
  activeFusions: HybridFusionId[];
  onUpgradeSkill: (attribute: SkillAttribute, tier: SkillTier) => void;
  onSelectMutation: (
    attribute: SkillAttribute,
    tier: SkillTier,
    milestone: 5 | 10,
    choice: MutationChoice
  ) => void;
  onClose: () => void;
}

const TIER_META: Record<SkillTier, { badge: string; role: string }> = {
  1: { badge: '1T', role: '기본 발동기' },
  2: { badge: '2T', role: '메커니즘 변형 · 확장' },
  3: { badge: '3T', role: '궁극기 · 핵심 시너지' },
};

function SkillTileEmblem({
  attribute,
  tier,
  color,
  size = 'md',
}: {
  attribute: SkillAttribute;
  tier: SkillTier;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = size === 'lg' ? 'w-7 h-7' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  const strokeW = tier === 3 ? 2.1 : 1.85;

  switch (attribute) {
    case 'fire':
      return (
        <svg viewBox="0 0 24 24" className={`${cls} shrink-0`} fill="none" stroke={color} strokeWidth={strokeW}>
          {tier === 1 && (
            <path d="M12 2.5c2.5 3 5.5 5.4 5.5 10a5.5 5.5 0 1 1-11 0c0-2.1.9-3.9 2.2-5.4.1 1.6 1 2.6 2 2.9-.5-2.6.2-5.3 1.3-7.5Z" fill={`${color}24`} />
          )}
          {tier === 2 && (
            <>
              <circle cx="12" cy="12" r="5" fill={`${color}26`} />
              <path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5M5.2 5.2l2.5 2.5M16.3 16.3l2.5 2.5M18.8 5.2l-2.5 2.5M7.7 16.3l-2.5 2.5" strokeLinecap="round" />
            </>
          )}
          {tier === 3 && (
            <>
              <circle cx="12" cy="12" r="6.5" fill={`${color}30`} />
              <circle cx="12" cy="12" r="2.8" fill={color} stroke="none" />
              <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M19.2 4.8l-1.8 1.8M6.6 17.4l-1.8 1.8" strokeLinecap="round" />
            </>
          )}
        </svg>
      );
    case 'ice':
      return (
        <svg viewBox="0 0 24 24" className={`${cls} shrink-0`} fill="none" stroke={color} strokeWidth={strokeW}>
          {tier === 1 && (
            <path d="M12 3v18M3 12h18M5.8 5.8l12.4 12.4M18.2 5.8L5.8 18.2" strokeLinecap="round" />
          )}
          {tier === 2 && (
            <>
              <polygon points="12,3 20,9 17,20 7,20 4,9" fill={`${color}24`} />
              <path d="M12 3v17M4 9l16 0" strokeOpacity="0.7" />
            </>
          )}
          {tier === 3 && (
            <>
              <polygon points="12,2 19,7 19,17 12,22 5,17 5,7" fill={`${color}2b`} />
              <path d="M12 5v14M6.5 8.5l11 7M17.5 8.5l-11 7" strokeLinecap="round" />
            </>
          )}
        </svg>
      );
    case 'lightning':
      return (
        <svg viewBox="0 0 24 24" className={`${cls} shrink-0`} fill="none" stroke={color} strokeWidth={strokeW}>
          {tier === 1 && (
            <path d="M13.5 2L5 13.5h6L9.5 22 19 10.5h-6L13.5 2Z" fill={`${color}26`} strokeLinejoin="round" />
          )}
          {tier === 2 && (
            <>
              <path d="M4 15l5-7 5 5 6-8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="4" cy="15" r="2" fill={color} stroke="none" />
              <circle cx="14" cy="13" r="2" fill={color} stroke="none" />
              <circle cx="20" cy="5" r="2" fill={color} stroke="none" />
            </>
          )}
          {tier === 3 && (
            <>
              <circle cx="12" cy="12" r="8.5" strokeDasharray="4 3" />
              <path d="M13 4L7 13h4.5L10.5 20 17 11h-4.5L13 4Z" fill={`${color}38`} strokeLinejoin="round" />
            </>
          )}
        </svg>
      );
    case 'poison':
      return (
        <svg viewBox="0 0 24 24" className={`${cls} shrink-0`} fill="none" stroke={color} strokeWidth={strokeW}>
          {tier === 1 && (
            <>
              <path d="M12 3c-3.2 4.6-6 7.5-6 11a6 6 0 1 0 12 0c0-3.5-2.8-6.4-6-11Z" fill={`${color}24`} />
              <circle cx="10" cy="14" r="1.2" fill={color} stroke="none" />
              <circle cx="14" cy="16" r="1" fill={color} stroke="none" />
            </>
          )}
          {tier === 2 && (
            <>
              <circle cx="12" cy="13" r="6" fill={`${color}24`} />
              <circle cx="9.5" cy="12" r="1.2" fill={color} stroke="none" />
              <circle cx="14.5" cy="12" r="1.2" fill={color} stroke="none" />
              <path d="M7 5c1.5 1 2 2.5 2 3M17 5c-1.5 1-2 2.5-2 3M12 3v3" strokeLinecap="round" />
            </>
          )}
          {tier === 3 && (
            <>
              <circle cx="12" cy="12" r="7.5" fill={`${color}28`} />
              <path d="M12 6.5a5.5 5.5 0 0 1 5 3.2M12 17.5a5.5 5.5 0 0 1-5-3.2M9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0" />
            </>
          )}
        </svg>
      );
    case 'physical':
      return (
        <svg viewBox="0 0 24 24" className={`${cls} shrink-0`} fill="none" stroke={color} strokeWidth={strokeW}>
          {tier === 1 && (
            <>
              <path d="M14.5 4.5l5 5-9.5 9.5-5.5.5.5-5.5 9.5-9.5Z" fill={`${color}22`} strokeLinejoin="round" />
              <path d="M12 7l5 5" />
            </>
          )}
          {tier === 2 && (
            <>
              <path d="M5 19L19 5M19 19L5 5" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" fill={`${color}28`} />
            </>
          )}
          {tier === 3 && (
            <>
              <path d="M12 2l3 6.5L22 10l-5.5 4.5L18 21.5 12 18l-6 3.5 1.5-7L2 10l7-1.5L12 2Z" fill={`${color}2a`} strokeLinejoin="round" />
            </>
          )}
        </svg>
      );
  }
}

export function SkillTreeModal({
  heroClass,
  level,
  skillPoints,
  weaponAtk,
  classSkills,
  activeFusions,
  onUpgradeSkill,
  onSelectMutation,
  onClose,
}: SkillTreeModalProps) {
  const [selectedNode, setSelectedNode] = useState<{ attribute: SkillAttribute; tier: SkillTier } | null>(null);
  const [selectedFusionId, setSelectedFusionId] = useState<HybridFusionId | null>(null);

  const classDef = HERO_CLASS_CATALOG[heroClass];
  const totalSpent = getTotalClassSkillPointsSpent(classSkills);

  const activePopupDef = selectedNode
    ? CLASS_SKILL_CATALOG[heroClass][selectedNode.attribute][selectedNode.tier]
    : null;
  const activePopupNode = selectedNode
    ? classSkills[selectedNode.attribute][selectedNode.tier]
    : null;
  const activePopupAttrMeta = selectedNode ? ATTRIBUTE_META[selectedNode.attribute] : null;
  const activeFusionDef = selectedFusionId
    ? HYBRID_FUSION_CATALOG.find((f) => f.id === selectedFusionId) ?? null
    : null;

  return (
    <div
      data-testid="skill-tree-modal"
      className="fixed inset-0 z-30 flex items-center justify-center p-2 sm:p-4 bg-[#060910]/86 backdrop-blur-xs"
    >
      <div
        className="relative w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden rounded-lg bg-[#0d121c] border shadow-[0_24px_64px_rgba(0,0,0,0.92)]"
        style={{
          borderColor: `${classDef.accent}88`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.92), 0 0 36px ${classDef.accent}22`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${classDef.name} 5속성 스킬 트리`}
      >
        {/* Top 5-attribute trim */}
        <div
          className="h-1 w-full shrink-0"
          style={{
            background: 'linear-gradient(90deg, #fb923c, #38bdf8, #fde047, #4ade80, #cbd5e1)',
          }}
        />

        {/* Compact Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-[#223044] bg-[#090d15] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-[#f5f2ea] tracking-tight">
                <span style={{ color: classDef.accent }}>{classDef.name}</span> 스킬 트리
              </h2>
              <span className="text-xs font-bold font-mono-num text-amber-300">Lv.{level}</span>
              <span className="text-[#475569]">·</span>
              <span className="text-[11px] sm:text-xs text-[#9cb0c5]">
                스킬 아이콘을 눌러 팝업에서 상세 확인 및 강화 · 변형 선택
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="hidden md:inline text-[11px] font-mono-num text-[#8fa2b8] mr-1">
              공격력 {weaponAtk} · 투자 {totalSpent}pt
            </span>
            <div
              data-testid="skill-tree-sp"
              className={`px-2.5 py-1 rounded-md border font-mono-num text-xs sm:text-sm font-extrabold whitespace-nowrap ${
                skillPoints > 0
                  ? 'bg-[#2a1f0a] border-amber-300 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.3)]'
                  : 'bg-[#141c28] border-[#2c3a4f] text-[#7c90a8]'
              }`}
            >
              {skillPoints} SP
            </div>
            <button
              type="button"
              data-testid="skill-tree-close-btn"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-[#182230] hover:bg-[#233145] text-[#dce5f0] border border-[#3a4c64] transition-colors cursor-pointer whitespace-nowrap"
            >
              닫기 [ESC]
            </button>
          </div>
        </div>

        {/* Visual Diablo 2-Style 5-Attribute × 3-Tier Icon Skill Tree Board */}
        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          <div className="overflow-x-auto pb-1">
            <div className="grid grid-cols-5 gap-2 sm:gap-3 min-w-[540px]">
              {ALL_SKILL_ATTRIBUTES.map((attr) => {
                const meta = ATTRIBUTE_META[attr];
                const pts = getAttributeInvestedPoints(classSkills, attr);
                return (
                  <div
                    key={attr}
                    className="flex flex-col items-center rounded-md border border-[#1f2c3f] bg-[#0a0f18]/90 px-1.5 py-2.5 sm:px-2.5 sm:py-3"
                  >
                    {/* Column Attribute Header */}
                    <div className="flex items-center justify-between w-full px-1 pb-2 mb-2 border-b border-[#1c283a]">
                      <div className="flex items-center gap-1 min-w-0">
                        <SkillTileEmblem attribute={attr} tier={1} color={meta.color} size="sm" />
                        <span
                          className="text-xs sm:text-sm font-extrabold truncate"
                          style={{ color: meta.color }}
                        >
                          {meta.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono-num font-bold text-[#8ea1b8] shrink-0">
                        {pts}pt
                      </span>
                    </div>

                    {/* Vertical 1T -> 2T -> 3T Connected Skill Icon Tiles */}
                    <div className="flex flex-col items-center w-full">
                      {ALL_SKILL_TIERS.map((tier, idx) => {
                        const def = CLASS_SKILL_CATALOG[heroClass][attr][tier];
                        const node = classSkills[attr][tier];
                        const prereqMet =
                          tier === 1 ||
                          (tier === 2 && classSkills[attr][1].level >= 1) ||
                          (tier === 3 && classSkills[attr][2].level >= 1);
                        const canUp = canUpgradeClassSkill(classSkills, attr, tier, skillPoints);
                        const needsMut =
                          (node.level >= 5 && node.mut5 === null) ||
                          (node.level >= 10 && node.mut10 === null);
                        const isSelected =
                          selectedNode?.attribute === attr && selectedNode?.tier === tier;

                        return (
                          <div key={tier} className="flex flex-col items-center w-full">
                            {/* Vertical Tree Arrow Connector */}
                            {idx > 0 && (
                              <div className="flex flex-col items-center my-0.5">
                                <div
                                  className="w-0.5 h-3.5"
                                  style={{
                                    backgroundColor: prereqMet ? meta.color : '#243247',
                                  }}
                                />
                                <div
                                  className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent"
                                  style={{
                                    borderTopColor: prereqMet ? meta.color : '#243247',
                                  }}
                                />
                              </div>
                            )}

                            {/* Interactive RPG Skill Icon Node */}
                            <button
                              type="button"
                              data-testid={`skill-node-${attr}-${tier}`}
                              onClick={() => {
                                setSelectedFusionId(null);
                                setSelectedNode({ attribute: attr, tier });
                              }}
                              className={`group relative w-full flex flex-col items-center text-center p-2 sm:p-2.5 rounded-md border transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                                !prereqMet
                                  ? 'bg-[#0c111b] border-[#1f2b3d] opacity-55 hover:opacity-85'
                                  : isSelected
                                    ? 'bg-[#182436] scale-[1.02]'
                                    : node.level > 0
                                      ? 'bg-[#121c2c] hover:bg-[#162235]'
                                      : 'bg-[#101724] hover:bg-[#151f30]'
                              }`}
                              style={{
                                borderColor: isSelected
                                  ? '#fde047'
                                  : node.level > 0
                                    ? `${meta.color}cc`
                                    : canUp
                                      ? 'rgba(251, 191, 36, 0.55)'
                                      : '#253348',
                                boxShadow:
                                  node.level > 0
                                    ? `inset 0 0 18px ${meta.color}20`
                                    : canUp
                                      ? '0 0 14px rgba(251, 191, 36, 0.16)'
                                      : 'none',
                              }}
                            >
                              {/* Tier Corner Tag */}
                              <span
                                className="absolute top-1 left-1.5 text-[9px] font-black font-mono-num"
                                style={{ color: prereqMet ? meta.color : '#64748b' }}
                              >
                                {tier}T
                              </span>

                              {/* Mutation Ready / Upgradeable Corner Indicator */}
                              {needsMut ? (
                                <span className="absolute -top-1.5 -right-1 px-1 py-0.5 text-[8.5px] font-black rounded-xs bg-sky-400 text-[#07131e] border border-sky-100 leading-none">
                                  변형!
                                </span>
                              ) : canUp ? (
                                <span className="absolute top-1 right-1.5 text-[10px] font-black text-amber-300 leading-none">
                                  +
                                </span>
                              ) : null}

                              {/* Icon Frame */}
                              <div
                                className="mt-1.5 w-11 h-11 sm:w-12 sm:h-12 rounded-md flex items-center justify-center border"
                                style={{
                                  backgroundColor:
                                    node.level > 0 ? `${meta.color}22` : '#0d1420',
                                  borderColor:
                                    node.level > 0 ? meta.color : prereqMet ? '#33445e' : '#1f2c3f',
                                }}
                              >
                                <SkillTileEmblem
                                  attribute={attr}
                                  tier={tier}
                                  color={prereqMet ? meta.color : '#4b5a70'}
                                  size="md"
                                />
                              </div>

                              {/* Skill Title */}
                              <span className="mt-1.5 text-[11px] sm:text-xs font-extrabold text-[#f3eee4] leading-tight line-clamp-1">
                                {def.name}
                              </span>

                              {/* Level Readout + Compact Bar */}
                              <div className="mt-1 w-full flex items-center justify-between text-[10px] font-mono-num px-0.5">
                                <span
                                  data-testid={`skill-level-${attr}-${tier}`}
                                  className={
                                    node.level >= MAX_CLASS_SKILL_LEVEL
                                      ? 'font-black text-emerald-300'
                                      : node.level > 0
                                        ? 'font-bold text-amber-300'
                                        : 'text-[#64748b]'
                                  }
                                >
                                  {node.level}/{MAX_CLASS_SKILL_LEVEL}
                                </span>
                                <span className="text-[9px] text-sky-300 font-bold">
                                  {node.mut5 ? node.mut5 : ''}
                                  {node.mut10 ? `·${node.mut10}` : ''}
                                </span>
                              </div>
                              <div className="w-full h-1 mt-1 bg-[#1b2638] rounded-xs overflow-hidden">
                                <div
                                  className="h-full transition-all"
                                  style={{
                                    width: `${(node.level / MAX_CLASS_SKILL_LEVEL) * 100}%`,
                                    backgroundColor: meta.color,
                                  }}
                                />
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Hybrid Fusion Emblem Strip (Click any emblem to inspect details in popup) */}
          <div
            data-testid="hybrid-fusion-panel"
            className="mt-3 rounded-md border border-[#223044] bg-[#0a0f18] px-3 py-2 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <span className="font-extrabold text-[#f3eee4]">하이브리드 퓨전</span>
              <span className="text-[11px] text-[#7f92aa]">(두 속성 2T+ 조합)</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {HYBRID_FUSION_CATALOG.map((fusion) => {
                const isActive = activeFusions.includes(fusion.id);
                const aName = ATTRIBUTE_META[fusion.reqA].name;
                const bName = ATTRIBUTE_META[fusion.reqB].name;
                return (
                  <button
                    key={fusion.id}
                    type="button"
                    data-testid={`fusion-${fusion.id}`}
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => {
                      setSelectedNode(null);
                      setSelectedFusionId(fusion.id);
                    }}
                    className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#162030] text-[#f8f4ec]'
                        : 'bg-[#0e141f] text-[#8fa2b8] hover:text-[#dce5f0] border-[#243247]'
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: fusion.color,
                            boxShadow: `0 0 12px ${fusion.color}33`,
                          }
                        : undefined
                    }
                  >
                    <span style={{ color: isActive ? fusion.color : '#cbd5e1' }}>
                      {fusion.name}
                    </span>{' '}
                    <span className="text-[10px] font-mono-num opacity-80">
                      ({aName}+{bName})
                    </span>
                    {isActive && <span className="ml-1 text-emerald-300">●</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* In-Game RPG Skill Selection Popup Overlay (Clicking any Skill Node opens this focused popup!) */}
        {selectedNode && activePopupDef && activePopupNode && activePopupAttrMeta && (
          <div
            data-testid="skill-detail-popup"
            className="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-5 bg-[#04070d]/72 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedNode(null);
            }}
          >
            {(() => {
              const { attribute, tier } = selectedNode;
              const syn = getSkillSynergyMultiplier(classSkills, attribute, tier);
              const prereqMet =
                tier === 1 ||
                (tier === 2 && classSkills[attribute][1].level >= 1) ||
                (tier === 3 && classSkills[attribute][2].level >= 1);
              const canUp = canUpgradeClassSkill(classSkills, attribute, tier, skillPoints);
              const isMax = activePopupNode.level >= MAX_CLASS_SKILL_LEVEL;
              const mut5Unlocked = activePopupNode.level >= 5;
              const mut10Unlocked = activePopupNode.level >= 10;

              return (
                <div
                  className="animate-modal-enter w-full max-w-lg rounded-lg bg-[#101724] border-2 shadow-[0_24px_64px_rgba(0,0,0,0.92)] overflow-hidden"
                  style={{
                    borderColor: activePopupAttrMeta.color,
                    boxShadow: `0 24px 64px rgba(0,0,0,0.92), 0 0 32px ${activePopupAttrMeta.color}38`,
                  }}
                >
                  {/* Popup Header + Quick 1T/2T/3T Switcher */}
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#0a0f18] border-b border-[#223044]">
                    <div className="flex items-center gap-1.5">
                      {ALL_SKILL_TIERS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedNode({ attribute, tier: t })}
                          className={`px-2 py-0.5 text-[11px] font-extrabold font-mono-num rounded border transition-colors cursor-pointer ${
                            t === tier
                              ? 'text-[#0b0f17] border-white/60'
                              : 'bg-[#121a28] text-[#95a8be] border-[#263448] hover:text-[#f3eee4]'
                          }`}
                          style={t === tier ? { backgroundColor: activePopupAttrMeta.color } : undefined}
                        >
                          {t}T ({classSkills[attribute][t].level})
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      className="px-2 py-0.5 text-xs font-bold text-[#9cb0c5] hover:text-[#f8f4ec] rounded hover:bg-[#1a2435] cursor-pointer"
                    >
                      닫기 ✕
                    </button>
                  </div>

                  {/* Popup Body */}
                  <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-13 h-13 rounded-md flex items-center justify-center border shrink-0"
                        style={{
                          backgroundColor: `${activePopupAttrMeta.color}22`,
                          borderColor: activePopupAttrMeta.color,
                        }}
                      >
                        <SkillTileEmblem
                          attribute={attribute}
                          tier={tier}
                          color={activePopupAttrMeta.color}
                          size="lg"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-extrabold"
                            style={{ color: activePopupAttrMeta.color }}
                          >
                            {activePopupAttrMeta.name} · {TIER_META[tier].badge} {TIER_META[tier].role}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 mt-0.5">
                          <h3 className="text-lg font-extrabold text-[#f7f3eb] truncate">
                            {activePopupDef.name}
                          </h3>
                          <span className="text-sm font-black font-mono-num text-amber-300 shrink-0">
                            Lv.{activePopupNode.level}/{MAX_CLASS_SKILL_LEVEL}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 mt-1.5">
                          {Array.from({ length: MAX_CLASS_SKILL_LEVEL }, (_, i) => (
                            <span
                              key={i}
                              className={`h-1.5 flex-1 rounded-xs ${
                                i === 4 || i === 9 ? 'ring-1 ring-amber-300/45' : ''
                              }`}
                              style={{
                                backgroundColor:
                                  i < activePopupNode.level ? activePopupAttrMeta.color : '#223044',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs sm:text-[13px] text-[#dce4ef] leading-relaxed">
                      {activePopupDef.desc}
                    </p>

                    {/* Synergy Box */}
                    <div className="rounded border border-[#243247] bg-[#0b1019] px-3 py-2 text-[11.5px]">
                      <div className="text-amber-300 font-bold">{activePopupDef.synergyLabel}</div>
                      {tier > 1 && (
                        <div className="mt-0.5 font-mono-num text-emerald-300 font-bold">
                          현재 적용 시너지: 피해 +{syn.summaryPct}% · 범위 +{Math.round((syn.areaMult - 1) * 100)}%
                        </div>
                      )}
                    </div>

                    {/* Lv.5 & Lv.10 Mutation Choices */}
                    <div className="space-y-2">
                      {([5, 10] as const).map((milestone) => {
                        const unlocked = milestone === 5 ? mut5Unlocked : mut10Unlocked;
                        const current = milestone === 5 ? activePopupNode.mut5 : activePopupNode.mut10;
                        const optA = milestone === 5 ? activePopupDef.mut5A : activePopupDef.mut10A;
                        const optB = milestone === 5 ? activePopupDef.mut5B : activePopupDef.mut10B;

                        return (
                          <div
                            key={milestone}
                            className="rounded border border-[#223044] bg-[#0b1019] p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
                              <span
                                className={`font-extrabold ${
                                  milestone === 5 ? 'text-sky-300' : 'text-amber-300'
                                }`}
                              >
                                Lv.{milestone} 변형 각성
                              </span>
                              <span className="font-mono-num text-[#8396ad]">
                                {unlocked
                                  ? current
                                    ? `${current}안 적용 중`
                                    : '택 1 선택 가능'
                                  : `Lv.${milestone} 달성 시 해금`}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(['A', 'B'] as const).map((choice) => {
                                const mut = choice === 'A' ? optA : optB;
                                const chosen = current === choice;
                                return (
                                  <button
                                    key={choice}
                                    type="button"
                                    disabled={!unlocked}
                                    data-testid={`skill-mut-${attribute}-${tier}-${milestone}-${choice}`}
                                    aria-pressed={chosen}
                                    onClick={() => onSelectMutation(attribute, tier, milestone, choice)}
                                    className={`text-left p-2 rounded border transition-all ${
                                      !unlocked
                                        ? 'bg-[#101723] border-[#1f2b3d] opacity-50 cursor-not-allowed'
                                        : chosen
                                          ? 'bg-[#19283c] border-sky-400 cursor-pointer'
                                          : 'bg-[#121a28] border-[#2c3c54] hover:border-amber-300/75 cursor-pointer'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span
                                        className={`font-extrabold ${
                                          choice === 'A' ? 'text-sky-300' : 'text-amber-300'
                                        }`}
                                      >
                                        {choice} · {choice === 'A' ? '광역' : '보스'}
                                      </span>
                                      {chosen && <span className="text-emerald-300 font-bold">선택</span>}
                                    </div>
                                    <div className="text-xs font-bold text-[#f3eee4] mt-0.5 truncate">
                                      {mut.title}
                                    </div>
                                    <p className="text-[10.5px] text-[#9cb0c5] leading-snug mt-0.5">
                                      {mut.desc}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Primary Upgrade Action inside Popup */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={!canUp}
                        data-testid={`skill-upgrade-${attribute}-${tier}`}
                        onClick={() => onUpgradeSkill(attribute, tier)}
                        className={`flex-1 py-2.5 px-4 rounded-md text-sm font-extrabold border transition-colors ${
                          isMax
                            ? 'bg-[#152420] text-emerald-300 border-emerald-500/50 cursor-default'
                            : canUp
                              ? 'bg-amber-400 hover:bg-amber-300 text-[#150f04] border-amber-100 cursor-pointer shadow-[0_6px_18px_rgba(251,191,36,0.35)]'
                              : 'bg-[#161f2d] text-[#64748b] border-[#28364a] cursor-not-allowed'
                        }`}
                      >
                        {isMax
                          ? '최대 레벨 달성 (Lv.10)'
                          : !prereqMet
                            ? `${tier - 1}T Lv.1 선행 투자 필요`
                            : skillPoints <= 0
                              ? '스킬 포인트(SP) 부족'
                              : activePopupNode.level === 0
                                ? `스킬 해금 (1 SP · 보유 ${skillPoints} SP)`
                                : `스킬 강화 Lv.${activePopupNode.level} → ${activePopupNode.level + 1} (1 SP)`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedNode(null)}
                        className="px-4 py-2.5 rounded-md text-xs font-bold text-[#cbd5e1] bg-[#182230] hover:bg-[#233145] border border-[#3a4c64] cursor-pointer"
                      >
                        목록
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Hybrid Fusion Detail Popup */}
        {activeFusionDef && (
          <div
            data-testid="fusion-detail-popup"
            className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#04070d]/70 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedFusionId(null);
            }}
          >
            {(() => {
              const isActive = activeFusions.includes(activeFusionDef.id);
              const reqA = ATTRIBUTE_META[activeFusionDef.reqA];
              const reqB = ATTRIBUTE_META[activeFusionDef.reqB];
              const hasA = hasTier2OrHigher(classSkills, activeFusionDef.reqA);
              const hasB = hasTier2OrHigher(classSkills, activeFusionDef.reqB);
              return (
                <div
                  className="animate-modal-enter w-full max-w-sm rounded-lg bg-[#101724] border-2 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.92)]"
                  style={{ borderColor: activeFusionDef.color }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold" style={{ color: activeFusionDef.color }}>
                      {activeFusionDef.name} ({activeFusionDef.englishName})
                    </h3>
                    <span
                      className={`text-xs font-extrabold ${
                        isActive ? 'text-emerald-300' : 'text-[#8396ad]'
                      }`}
                    >
                      {isActive ? '활성화됨' : '미해금'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                    <span style={{ color: hasA ? reqA.color : '#64748b' }}>
                      {reqA.name} 2T+ {hasA ? '✓' : '✗'}
                    </span>
                    <span className="text-[#475569]">+</span>
                    <span style={{ color: hasB ? reqB.color : '#64748b' }}>
                      {reqB.name} 2T+ {hasB ? '✓' : '✗'}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs text-[#dce4ef] leading-relaxed">
                    {activeFusionDef.summary}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedFusionId(null)}
                    className="mt-4 w-full py-2 rounded-md text-xs font-bold text-[#dce5f0] bg-[#182230] hover:bg-[#233145] border border-[#3a4c64] cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
