import {
  GEAR_RARITY_META,
  GEAR_SLOT_META,
  LEGENDARY_EFFECT_META,
} from '../game/catalog';
import { getItemSalvageGold } from '../game/engine';
import type { EquipmentSlots, GearItem, GearRarity } from '../game/types';
import { GearSlotIconSvg } from './GameIcons';

interface LootCompareModalProps {
  dropped: GearItem;
  equipped: EquipmentSlots;
  onEquip: () => void;
  onSalvage: () => void;
  onDismiss: () => void;
}

interface StatRowDef {
  label: string;
  key: keyof GearItem['stats'];
  suffix?: string;
}

export interface RarityVisualFx {
  borderActive: string;
  borderEquipped: string;
  cardSurface: string;
  equippedSurface: string;
  radialGlow: string;
  iconGlow: string;
  outerShadow: string;
  modalShadow: string;
  topBarGradient: string;
  cornerColor: string;
  showBeam: boolean;
  showSheen: boolean;
  pulseAura: boolean;
}

export const RARITY_MODAL_FX: Record<GearRarity, RarityVisualFx> = {
  normal: {
    borderActive: '#64748b',
    borderEquipped: '#475569',
    cardSurface: 'linear-gradient(165deg, #222a38 0%, #151b26 55%, #11161f 100%)',
    equippedSurface: 'linear-gradient(165deg, #19202c 0%, #121721 100%)',
    radialGlow: 'radial-gradient(ellipse 85% 60% at 50% 0%, rgba(148, 163, 184, 0.16) 0%, transparent 72%)',
    iconGlow: 'radial-gradient(circle, rgba(148, 163, 184, 0.24) 0%, transparent 70%)',
    outerShadow: '0 8px 22px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(203, 213, 225, 0.16)',
    modalShadow: '0 24px 64px rgba(0, 0, 0, 0.88)',
    topBarGradient: 'linear-gradient(90deg, transparent 5%, #94a3b8 50%, transparent 95%)',
    cornerColor: 'rgba(148, 163, 184, 0.45)',
    showBeam: false,
    showSheen: false,
    pulseAura: false,
  },
  rare: {
    borderActive: '#3b82f6',
    borderEquipped: 'rgba(59, 130, 246, 0.58)',
    cardSurface: 'linear-gradient(165deg, #16294a 0%, #111d34 52%, #0e1524 100%)',
    equippedSurface: 'linear-gradient(165deg, #14213a 0%, #101726 100%)',
    radialGlow: 'radial-gradient(ellipse 90% 65% at 50% 0%, rgba(59, 130, 246, 0.34) 0%, rgba(37, 99, 235, 0.08) 48%, transparent 76%)',
    iconGlow: 'radial-gradient(circle, rgba(96, 165, 250, 0.42) 0%, rgba(59, 130, 246, 0.1) 52%, transparent 74%)',
    outerShadow: '0 0 26px rgba(59, 130, 246, 0.28), 0 10px 26px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(147, 197, 253, 0.35)',
    modalShadow: '0 0 42px rgba(37, 99, 235, 0.24), 0 24px 64px rgba(0, 0, 0, 0.9)',
    topBarGradient: 'linear-gradient(90deg, transparent 0%, #60a5fa 50%, transparent 100%)',
    cornerColor: 'rgba(96, 165, 250, 0.72)',
    showBeam: false,
    showSheen: true,
    pulseAura: false,
  },
  epic: {
    borderActive: '#a855f7',
    borderEquipped: 'rgba(168, 85, 247, 0.62)',
    cardSurface: 'linear-gradient(165deg, #2d1847 0%, #1c122e 52%, #130e1f 100%)',
    equippedSurface: 'linear-gradient(165deg, #221436 0%, #141021 100%)',
    radialGlow: 'radial-gradient(ellipse 92% 70% at 50% 0%, rgba(168, 85, 247, 0.44) 0%, rgba(126, 34, 206, 0.14) 50%, transparent 78%)',
    iconGlow: 'radial-gradient(circle, rgba(192, 132, 252, 0.52) 0%, rgba(168, 85, 247, 0.14) 55%, transparent 75%)',
    outerShadow: '0 0 34px rgba(168, 85, 247, 0.38), 0 12px 30px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(216, 180, 254, 0.45)',
    modalShadow: '0 0 56px rgba(168, 85, 247, 0.32), 0 24px 68px rgba(0, 0, 0, 0.92)',
    topBarGradient: 'linear-gradient(90deg, transparent 0%, #d8b4fe 50%, transparent 100%)',
    cornerColor: 'rgba(192, 132, 252, 0.85)',
    showBeam: true,
    showSheen: true,
    pulseAura: true,
  },
  legendary: {
    borderActive: '#f97316',
    borderEquipped: 'rgba(249, 115, 22, 0.68)',
    cardSurface: 'linear-gradient(165deg, #40200c 0%, #26140b 50%, #170e0a 100%)',
    equippedSurface: 'linear-gradient(165deg, #2c180c 0%, #18100c 100%)',
    radialGlow: 'radial-gradient(ellipse 95% 74% at 50% 0%, rgba(251, 146, 60, 0.52) 0%, rgba(234, 88, 12, 0.18) 48%, transparent 80%)',
    iconGlow: 'radial-gradient(circle, rgba(253, 224, 71, 0.56) 0%, rgba(249, 115, 22, 0.24) 52%, transparent 76%)',
    outerShadow: '0 0 42px rgba(249, 115, 22, 0.48), 0 0 14px rgba(251, 191, 36, 0.28), 0 12px 32px rgba(0, 0, 0, 0.68), inset 0 1px 0 rgba(254, 215, 170, 0.58)',
    modalShadow: '0 0 68px rgba(249, 115, 22, 0.38), 0 24px 72px rgba(0, 0, 0, 0.94)',
    topBarGradient: 'linear-gradient(90deg, transparent 0%, #fde047 35%, #fb923c 50%, #fde047 65%, transparent 100%)',
    cornerColor: 'rgba(251, 191, 36, 0.92)',
    showBeam: true,
    showSheen: true,
    pulseAura: true,
  },
};

const STAT_ROWS: StatRowDef[] = [
  { label: '공격력', key: 'atk' },
  { label: '방어력', key: 'def' },
  { label: '최대 체력', key: 'maxHp' },
  { label: '치명타', key: 'critChance', suffix: '%' },
  { label: '공격 속도', key: 'atkSpeedPct', suffix: '%' },
  { label: '이동 속도', key: 'moveSpeedPct', suffix: '%' },
];

function GearCard({
  title,
  item,
  compareAgainst,
  highlight,
}: {
  title: string;
  item: GearItem | null;
  compareAgainst?: GearItem | null;
  highlight?: boolean;
}) {
  if (!item) {
    return (
      <div className="flex-1 bg-[#10141d] border border-[#2a3342] rounded-lg p-4 flex flex-col justify-between min-h-[215px]">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#7f8a9c]">{title}</p>
          <p className="text-sm font-bold text-[#697386] mt-3">비어 있는 슬롯</p>
          <p className="text-xs text-[#697386] mt-1 leading-relaxed">
            현재 장착된 장비가 없습니다. 새 장비를 장착하면 능력치가 즉시 반영됩니다.
          </p>
        </div>
        <div className="pt-3 border-t border-[#1e2634] text-xs font-mono-num text-[#697386]">
          장비 점수 0
        </div>
      </div>
    );
  }

  const rarity = GEAR_RARITY_META[item.rarity];
  const fx = RARITY_MODAL_FX[item.rarity];
  const slot = GEAR_SLOT_META[item.slot];
  const powerDelta =
    compareAgainst !== undefined ? item.powerScore - (compareAgainst?.powerScore ?? 0) : null;

  return (
    <div
      data-testid={highlight ? 'loot-card-dropped' : 'loot-card-equipped'}
      data-rarity={item.rarity}
      className="relative flex-1 rounded-lg p-4 flex flex-col justify-between min-h-[215px] border overflow-hidden"
      style={{
        background: highlight ? fx.cardSurface : fx.equippedSurface,
        borderColor: highlight ? fx.borderActive : fx.borderEquipped,
        boxShadow: highlight
          ? fx.outerShadow
          : `0 6px 18px rgba(0, 0, 0, 0.42), inset 0 1px 0 ${fx.cornerColor}`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 inset-x-0 h-[2px]"
        style={{ background: fx.topBarGradient }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          highlight && fx.pulseAura ? 'animate-loot-aura' : ''
        }`}
        style={{
          background: fx.radialGlow,
          opacity: highlight ? 1 : 0.48,
        }}
      />

      {highlight && fx.showBeam && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 w-36 h-40 blur-xl"
          style={{
            background:
              item.rarity === 'legendary'
                ? 'linear-gradient(180deg, rgba(253, 224, 71, 0.34) 0%, rgba(249, 115, 22, 0.16) 55%, transparent 100%)'
                : 'linear-gradient(180deg, rgba(216, 180, 254, 0.28) 0%, rgba(168, 85, 247, 0.12) 55%, transparent 100%)',
          }}
        />
      )}

      {highlight && fx.showSheen && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-24 animate-loot-sheen"
          style={{
            background:
              item.rarity === 'legendary'
                ? 'linear-gradient(90deg, transparent, rgba(254, 240, 138, 0.22), transparent)'
                : item.rarity === 'epic'
                  ? 'linear-gradient(90deg, transparent, rgba(216, 180, 254, 0.18), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(147, 197, 253, 0.14), transparent)',
          }}
        />
      )}

      {highlight && item.rarity !== 'normal' && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 rounded-tl-[2px]"
            style={{ borderColor: fx.cornerColor }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 rounded-tr-[2px]"
            style={{ borderColor: fx.cornerColor }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 rounded-bl-[2px]"
            style={{ borderColor: fx.cornerColor }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 rounded-br-[2px]"
            style={{ borderColor: fx.cornerColor }}
          />
        </>
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-[#b3bdd0]">{title}</span>
          <span className="text-[11px] font-bold font-mono-num" style={{ color: rarity.color }}>
            {rarity.label} · Lv.{item.itemLevel}
          </span>
        </div>

        <div className="flex items-center gap-2.5 mt-2.5">
          <div
            className="relative w-11 h-11 rounded-md flex items-center justify-center bg-[#0b0f17]/95 border shrink-0 overflow-hidden"
            style={{
              borderColor: highlight ? fx.borderActive : fx.borderEquipped,
              boxShadow: highlight ? `0 0 14px ${fx.borderActive}55` : 'none',
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: fx.iconGlow }}
            />
            <GearSlotIconSvg slot={item.slot} color={rarity.color} className="relative z-10 w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3
              className="text-sm sm:text-base font-bold leading-snug truncate"
              style={{
                color: rarity.color,
                textShadow: highlight && item.rarity !== 'normal' ? `0 0 12px ${fx.borderActive}55` : 'none',
              }}
            >
              {item.name}
            </h3>
            <p className="text-[11px] text-[#98a3b4]">{slot.label}</p>
          </div>
        </div>

        {/* Stat rows with green/red delta comparison */}
        <div className="mt-3 space-y-1">
          {STAT_ROWS.map((row) => {
            const val = item.stats[row.key];
            const baseVal = compareAgainst ? compareAgainst.stats[row.key] : 0;
            const delta = compareAgainst !== undefined ? val - baseVal : 0;
            if (val === 0 && delta === 0) return null;

            return (
              <div key={row.key} className="flex items-center justify-between text-xs">
                <span className="text-[#b0bacb]">{row.label}</span>
                <div className="flex items-center gap-1.5 font-mono-num">
                  <span className="font-bold text-[#f3eee4]">
                    +{val}
                    {row.suffix ?? ''}
                  </span>
                  {compareAgainst !== undefined && delta !== 0 && (
                    <span
                      className={
                        delta > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'
                      }
                    >
                      ({delta > 0 ? `+${delta}` : delta}
                      {row.suffix ?? ''})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legendary Unique Effect */}
        {item.legendaryEffect && (
          <div className="mt-3 px-2.5 py-2 rounded bg-[#211207]/92 border border-[#f97316]/75 shadow-[0_0_16px_rgba(249,115,22,0.2)]">
            <p className="text-[11px] font-bold text-orange-300">
              전설 고유 효과 · {LEGENDARY_EFFECT_META[item.legendaryEffect].name}
            </p>
            <p className="text-[11px] text-[#efe3cf] mt-0.5 leading-snug">
              {LEGENDARY_EFFECT_META[item.legendaryEffect].description}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-mono-num">
        <span className="text-[#95a0b2]">장비 점수</span>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#f6f1e6]">{item.powerScore}</span>
          {powerDelta !== null && powerDelta !== 0 && (
            <span
              className={
                powerDelta > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'
              }
            >
              {powerDelta > 0 ? `▲+${powerDelta}` : `▼${powerDelta}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function LootCompareModal({
  dropped,
  equipped,
  onEquip,
  onSalvage,
  onDismiss,
}: LootCompareModalProps) {
  const current = equipped[dropped.slot];
  const rarity = GEAR_RARITY_META[dropped.rarity];
  const droppedFx = RARITY_MODAL_FX[dropped.rarity];
  const slotMeta = GEAR_SLOT_META[dropped.slot];
  const isUpgrade = dropped.powerScore > (current?.powerScore ?? 0);
  const sellGold = getItemSalvageGold(dropped);
  const replaceGold = current ? getItemSalvageGold(current) : 0;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#06080d]/86"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loot-compare-heading"
    >
      <div
        data-testid="loot-compare-modal"
        data-rarity={dropped.rarity}
        className="relative animate-modal-enter w-full max-w-2xl bg-[#10151f] border rounded-lg p-4 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto overflow-x-hidden"
        style={{
          borderColor: droppedFx.borderActive,
          boxShadow: droppedFx.modalShadow,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 inset-x-0 h-[3px]"
          style={{ background: droppedFx.topBarGradient }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[78%] h-36 blur-2xl opacity-55"
          style={{ background: droppedFx.radialGlow }}
        />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p
              className="text-[11px] font-bold tracking-widest uppercase"
              style={{ color: rarity.color }}
            >
              {rarity.label} {slotMeta.label} 발견
            </p>
            <h2
              id="loot-compare-heading"
              className="text-xl sm:text-2xl font-bold text-[#f6f1e6] mt-0.5"
            >
              장비 비교 및 선택
            </h2>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded border whitespace-nowrap ${
              isUpgrade
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                : 'bg-[#1a202c] border-[#394457] text-[#a5b0c2]'
            }`}
          >
            {isUpgrade ? '장비 교체 추천' : '판매해 골드 확보'}
          </span>
        </div>

        {/* Side-by-Side Comparison Cards */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <GearCard title="현재 장착 장비" item={current} />
          <GearCard title="발견한 새 장비" item={dropped} compareAgainst={current} highlight />
        </div>

        {/* One-Click Actions */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            data-testid="loot-equip-btn"
            onClick={onEquip}
            className="w-full py-3 px-4 text-sm font-bold text-[#141008] bg-[#e5a43a] hover:bg-[#f2b852] rounded-md transition-colors cursor-pointer shadow-[0_4px_14px_rgba(229,164,58,0.28)]"
          >
            {replaceGold > 0
              ? `장착 · 기존 판매(+${replaceGold}G) [1 / E]`
              : '장착하기 [1 / E]'}
          </button>
          <button
            type="button"
            data-testid="loot-salvage-btn"
            onClick={onSalvage}
            className="w-full py-3 px-4 text-sm font-bold text-amber-200 bg-[#251f14] hover:bg-[#332a1a] border border-amber-500/60 rounded-md transition-colors cursor-pointer"
          >
            판매 (+{sellGold}G &amp; 체력 회복) [2 / Q]
          </button>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-2 text-xs text-[#8d98aa]">
          <span>획득한 골드로 방랑 장비 상인에게 무기·투구·갑옷·장갑·장화를 강화하세요</span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[#a5b0c2] hover:text-[#f6f1e6] underline underline-offset-2 whitespace-nowrap cursor-pointer"
          >
            바닥에 두기 [ESC]
          </button>
        </div>
      </div>
    </div>
  );
}
