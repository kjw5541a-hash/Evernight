import {
  ALL_GEAR_SLOTS,
  GEAR_RARITY_META,
  GEAR_SLOT_META,
  LEGENDARY_EFFECT_META,
  MAX_GEAR_UPGRADE_LEVEL,
  WEAPON_CATALOG,
} from '../game/catalog';
import { getGearUpgradeCost, getSkillUpgradeCost } from '../game/engine';
import type { EquipmentSlots, GearSlot, RunSummary } from '../game/types';
import { formatTime } from './GameHud';
import { GearSlotIconSvg, UpgradeIconSvg } from './GameIcons';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onReturnTitle }: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#07090e]/82"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-heading"
    >
      <div className="animate-modal-enter w-full max-w-sm bg-[#141923] border border-[#4a5568] rounded-lg p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-5">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest text-[#9aa4b4]">PAUSED</p>
          <h2 id="pause-heading" className="text-2xl font-bold text-[#f6f1e6] mt-1">
            일시정지
          </h2>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-4 text-sm font-bold text-[#141008] bg-[#e5a43a] hover:bg-[#f2b852] rounded-md transition-colors cursor-pointer"
          >
            계속하기
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 text-sm font-semibold text-[#e6e0d5] bg-[#1d2432] hover:bg-[#273144] border border-[#3b4659] rounded-md transition-colors cursor-pointer"
          >
            다시 시작
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 px-4 text-sm font-semibold text-[#b2bccb] hover:text-[#f6f1e6] bg-transparent hover:bg-[#1a212e] border border-[#2d3647] rounded-md transition-colors cursor-pointer"
          >
            타이틀로 돌아가기
          </button>
        </div>

        <p className="text-center text-xs text-[#8893a5]">
          ESC 또는 P 키로 바로 복귀할 수 있습니다
        </p>
      </div>
    </div>
  );
}

interface EquipmentSheetModalProps {
  equipment: EquipmentSlots;
  atk: number;
  def: number;
  critChance: number;
  atkSpeedPct: number;
  combatPower: number;
  upgradeShards: number;
  skillXp: number;
  biomeName: string;
  onUpgradeGear: (slot: GearSlot) => void;
  onUpgradeSkill: (slot: GearSlot, skillIndex: number) => void;
  onClose: () => void;
}

export function EquipmentSheetModal({
  equipment,
  atk,
  def,
  critChance,
  atkSpeedPct,
  combatPower,
  upgradeShards,
  skillXp,
  biomeName,
  onUpgradeGear,
  onUpgradeSkill,
  onClose,
}: EquipmentSheetModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#07090e]/84"
      role="dialog"
      aria-modal="true"
      aria-labelledby="equip-sheet-heading"
    >
      <div className="animate-modal-enter w-full max-w-3xl bg-[#131823] border border-[#4a5568] rounded-lg p-4 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.9)] flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-amber-300">{biomeName}</p>
            <h2 id="equip-sheet-heading" className="text-xl sm:text-2xl font-bold text-[#f6f1e6]">
              장비 대장간 &amp; 부착 스킬 강화
            </h2>
          </div>

          {/* Banked Upgrade Resources */}
          <div className="flex items-center gap-2 font-mono-num">
            <div className="px-3 py-1.5 rounded bg-[#231c10] border border-amber-500/50 text-right">
              <span className="block text-[10px] text-amber-200/80">보유 강화 파편</span>
              <span className="text-base font-bold text-amber-300" data-testid="forge-shards">
                {upgradeShards}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded bg-[#102030] border border-sky-500/50 text-right">
              <span className="block text-[10px] text-sky-200/80">축적 스킬 XP</span>
              <span className="text-base font-bold text-sky-300" data-testid="forge-skill-xp">
                {skillXp}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded bg-[#151b28] border border-[#3a465c] text-right">
              <span className="block text-[10px] text-[#95a0b0]">전투력 (CP)</span>
              <span className="text-base font-bold text-[#f6f1e6]" data-testid="forge-cp">
                {combatPower}
              </span>
            </div>
          </div>
        </div>

        {/* Hero Summary Stat Bar */}
        <div className="grid grid-cols-4 gap-2 text-center bg-[#0e121b] border border-[#273041] rounded-md p-2.5">
          <div>
            <span className="block text-[10px] text-[#8f9aad]">공격력</span>
            <span className="text-sm font-bold font-mono-num text-[#f6f1e6]">{atk}</span>
          </div>
          <div>
            <span className="block text-[10px] text-[#8f9aad]">방어력</span>
            <span className="text-sm font-bold font-mono-num text-[#93c5fd]">{def}</span>
          </div>
          <div>
            <span className="block text-[10px] text-[#8f9aad]">치명타</span>
            <span className="text-sm font-bold font-mono-num text-amber-300">{critChance}%</span>
          </div>
          <div>
            <span className="block text-[10px] text-[#8f9aad]">공격 속도</span>
            <span className="text-sm font-bold font-mono-num text-emerald-300">+{atkSpeedPct}%</span>
          </div>
        </div>

        {/* 4 Core Equipment Slots with Shard Forge & Banked Skill XP Level-Up */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_GEAR_SLOTS.map((slot) => {
            const item = equipment[slot];
            const slotMeta = GEAR_SLOT_META[slot];
            const rarity = item ? GEAR_RARITY_META[item.rarity] : null;
            const gearCost = item ? getGearUpgradeCost(item) : null;
            const canAffordGear = gearCost !== null && upgradeShards >= gearCost;

            return (
              <div
                key={slot}
                className="rounded-md p-3.5 border flex flex-col justify-between gap-2.5"
                style={{
                  backgroundColor: rarity ? rarity.bg : '#0f141e',
                  borderColor: rarity ? rarity.border : '#293243',
                }}
              >
                <div className="flex flex-col gap-2">
                  {/* Slot Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <GearSlotIconSvg
                        slot={slot}
                        color={rarity?.color ?? '#64748b'}
                        className="w-5 h-5 shrink-0"
                      />
                      <span
                        className="text-sm font-bold truncate"
                        style={{ color: rarity?.color ?? '#8b96a8' }}
                      >
                        {item
                          ? `${item.upgradeLevel > 0 ? `+${item.upgradeLevel} ` : ''}${item.name}`
                          : `${slotMeta.label} (미장착)`}
                      </span>
                    </div>
                    {rarity && item && (
                      <span
                        className="text-[11px] font-bold shrink-0 font-mono-num"
                        style={{ color: rarity.color }}
                      >
                        {rarity.label}
                      </span>
                    )}
                  </div>

                  {item ? (
                    <>
                      {/* Item Stats */}
                      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-mono-num text-[#d8e0ec]">
                        {item.stats.atk > 0 && <span>공격 +{item.stats.atk}</span>}
                        {item.stats.def > 0 && <span>방어 +{item.stats.def}</span>}
                        {item.stats.maxHp > 0 && <span>체력 +{item.stats.maxHp}</span>}
                        {item.stats.critChance > 0 && <span>치명 +{item.stats.critChance}%</span>}
                        {item.stats.atkSpeedPct > 0 && <span>공속 +{item.stats.atkSpeedPct}%</span>}
                        {item.stats.moveSpeedPct > 0 && <span>이속 +{item.stats.moveSpeedPct}%</span>}
                      </div>

                      {item.legendaryEffect && (
                        <p className="text-[11px] text-orange-300 leading-snug">
                          ★ {LEGENDARY_EFFECT_META[item.legendaryEffect].name}:{' '}
                          {LEGENDARY_EFFECT_META[item.legendaryEffect].description}
                        </p>
                      )}

                      {/* Attached Skills & Skill XP Upgrade Buttons */}
                      {item.attachedSkills.length > 0 && (
                        <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                          {item.attachedSkills.map((sk, idx) => {
                            const def = WEAPON_CATALOG[sk.id];
                            const skCost = getSkillUpgradeCost(sk.level);
                            const canAffordSkill = skCost !== null && skillXp >= skCost;
                            const nextDesc =
                              sk.level < def.maxLevel
                                ? def.levelDescriptions[sk.level]
                                : '최대 레벨 도달';

                            return (
                              <div
                                key={`${sk.id}-${idx}`}
                                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#0c1018]/90 border border-[#2a3447]"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <UpgradeIconSvg id={sk.id} className="w-4 h-4 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-[#f3eee4] truncate">
                                        {def.name}
                                      </span>
                                      <span className="text-[10px] font-mono-num font-bold text-sky-300">
                                        Lv.{sk.level}/{def.maxLevel}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-[#8d98aa] truncate">{nextDesc}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  data-testid={`upgrade-skill-${slot}-${idx}`}
                                  disabled={!canAffordSkill}
                                  onClick={() => onUpgradeSkill(slot, idx)}
                                  className={`px-2 py-1 text-[11px] font-bold font-mono-num rounded border whitespace-nowrap shrink-0 transition-colors ${
                                    skCost === null
                                      ? 'bg-[#171d29] border-[#2e384b] text-[#6d7788] cursor-default'
                                      : canAffordSkill
                                        ? 'bg-sky-500 hover:bg-sky-400 text-[#09131d] border-sky-300 cursor-pointer'
                                        : 'bg-[#131a26] border-[#2b3649] text-[#6d7788] cursor-not-allowed'
                                  }`}
                                >
                                  {skCost === null ? 'MAX' : `스킬↑ ${skCost}XP`}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[#6d7788] py-3">
                      보물상자·정예·보스에서 획득해 장착하세요 (드랍율 20%)
                    </p>
                  )}
                </div>

                {/* Gear Shard Upgrade Action */}
                {item && (
                  <button
                    type="button"
                    data-testid={`upgrade-gear-${slot}`}
                    disabled={!canAffordGear}
                    onClick={() => onUpgradeGear(slot)}
                    className={`w-full py-2 px-3 text-xs font-bold font-mono-num rounded border transition-colors ${
                      gearCost === null
                        ? 'bg-[#181e29] border-[#30394a] text-[#6d7788] cursor-default'
                        : canAffordGear
                          ? 'bg-[#e5a43a] hover:bg-[#f2b852] text-[#141008] border-[#fde68a] cursor-pointer'
                          : 'bg-[#141a24] border-[#2e3748] text-[#788396] cursor-not-allowed'
                    }`}
                  >
                    {gearCost === null
                      ? `장비 최대 강화 (+${MAX_GEAR_UPGRADE_LEVEL})`
                      : `장비 강화 (+${item.upgradeLevel} → +${item.upgradeLevel + 1}) · 파편 ${gearCost}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 text-sm font-bold text-[#141008] bg-[#e5a43a] hover:bg-[#f2b852] rounded-md transition-colors cursor-pointer"
        >
          전투로 돌아가기 [ESC / I]
        </button>
      </div>
    </div>
  );
}

interface EndRunModalProps {
  summary: RunSummary;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function EndRunModal({ summary, onRestart, onReturnTitle }: EndRunModalProps) {
  const isVictory = summary.outcome === 'victory';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#07090e]/84"
      role="dialog"
      aria-modal="true"
      aria-labelledby="endrun-heading"
    >
      <div
        className={`animate-modal-enter w-full max-w-md bg-[#141923] border rounded-lg p-6 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.9)] flex flex-col gap-4 max-h-[92vh] overflow-y-auto ${
          isVictory ? 'border-[#c8923a]' : 'border-[#7f3338]'
        }`}
      >
        <div className="text-center">
          <p
            className={`text-xs font-bold tracking-widest ${
              isVictory ? 'text-amber-300' : 'text-red-400'
            }`}
          >
            {isVictory ? 'SURVIVAL COMPLETE' : 'RUN ENDED'}
          </p>
          <h2 id="endrun-heading" className="text-2xl sm:text-3xl font-bold text-[#f6f1e6] mt-1">
            {isVictory ? '20단계 심연 정복 완료' : '전장에서 쓰러졌습니다'}
          </h2>
          <p className="text-xs text-[#9aa4b4] mt-1">
            도달 지역: {summary.biomeName} · 전투력{' '}
            <span className="font-mono-num font-bold text-amber-300">{summary.combatPower}</span>
          </p>
          {summary.isNewBest && (
            <p className="text-xs font-semibold text-amber-300 mt-1">최고 기록 경신</p>
          )}
        </div>

        {/* 3 Focused Tabular-Nums Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[#1a202c] border border-[#2f3849] rounded-md p-3 text-center">
            <span className="block text-[11px] text-[#95a0b0]">생존 시간</span>
            <span className="block text-lg font-bold font-mono-num text-[#f6f1e6] mt-0.5">
              {formatTime(summary.elapsed)}
            </span>
          </div>
          <div className="bg-[#1a202c] border border-[#2f3849] rounded-md p-3 text-center">
            <span className="block text-[11px] text-[#95a0b0]">도달 단계</span>
            <span className="block text-lg font-bold font-mono-num text-amber-300 mt-0.5">
              {summary.wave}/{summary.maxWaves}
            </span>
          </div>
          <div className="bg-[#1a202c] border border-[#2f3849] rounded-md p-3 text-center">
            <span className="block text-[11px] text-[#95a0b0]">처치 수</span>
            <span className="block text-lg font-bold font-mono-num text-[#f6f1e6] mt-0.5">
              {summary.kills}
            </span>
          </div>
        </div>

        {/* Score / Best Summary */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#10141d] border border-[#273040] rounded-md text-xs">
          <span className="text-[#9aa4b4]">최종 점수 · 레벨 {summary.level}</span>
          <div className="flex items-center gap-2 font-mono-num">
            <span className="text-sm font-bold text-amber-300">{summary.score.toLocaleString()}</span>
            <span className="text-[#6d7788]">/ 최고 {summary.bestScore.toLocaleString()}</span>
          </div>
        </div>

        {/* Equipped 4-Slot Gear Summary */}
        <div className="grid grid-cols-2 gap-2">
          {ALL_GEAR_SLOTS.map((slot) => {
            const item = summary.equipment[slot];
            const rarity = item ? GEAR_RARITY_META[item.rarity] : null;
            return (
              <div
                key={slot}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#10141d] border text-xs min-w-0"
                style={{ borderColor: rarity?.border ?? '#263042' }}
              >
                <GearSlotIconSvg
                  slot={slot}
                  color={rarity?.color ?? '#4b5563'}
                  className="w-4 h-4 shrink-0"
                />
                <span className="truncate" style={{ color: rarity?.color ?? '#6b7280' }}>
                  {item
                    ? `${item.upgradeLevel > 0 ? `+${item.upgradeLevel} ` : ''}${item.name}`
                    : `${GEAR_SLOT_META[slot].label} 없음`}
                </span>
              </div>
            );
          })}
        </div>

        {summary.weapons.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {summary.weapons.map((w) => (
              <div
                key={w.id}
                title={`${WEAPON_CATALOG[w.id].name} Lv.${w.level}`}
                className="flex items-center gap-1.5 px-2 py-1 bg-[#1a202c] border border-[#313b4d] rounded text-xs text-[#dce2ec]"
              >
                <UpgradeIconSvg id={w.id} className="w-4 h-4" />
                <span>{WEAPON_CATALOG[w.id].name}</span>
                <span className="font-mono-num text-amber-300">Lv.{w.level}</span>
              </div>
            ))}
          </div>
        )}

        {/* Primary & Secondary Actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="w-full py-3 px-4 text-sm font-bold text-[#141008] bg-[#e5a43a] hover:bg-[#f2b852] rounded-md transition-colors cursor-pointer"
          >
            {isVictory ? '다시 출격하기' : '다시 도전하기'}
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 px-4 text-sm font-semibold text-[#b8c1d0] hover:text-[#f6f1e6] bg-[#1a212e] hover:bg-[#232c3d] border border-[#313b4d] rounded-md transition-colors cursor-pointer"
          >
            타이틀 화면으로
          </button>
        </div>
      </div>
    </div>
  );
}
