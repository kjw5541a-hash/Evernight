import {
  ALL_MERCHANT_SLOTS,
  MAX_MERCHANT_GEAR_LEVEL,
  MERCHANT_GEAR_CATALOG,
  getMerchantUpgradeCost,
} from '../game/catalog';
import type { MerchantGearLevels, MerchantGearSlot } from '../game/types';

interface MerchantModalProps {
  gold: number;
  merchantTimeLeft: number;
  merchantGearLevels: MerchantGearLevels;
  atk: number;
  maxHp: number;
  def: number;
  atkSpeedPct: number;
  moveSpeedPct: number;
  onUpgrade: (slot: MerchantGearSlot) => void;
  onClose: () => void;
}

function MerchantSlotIcon({ slot, color }: { slot: MerchantGearSlot; color: string }) {
  switch (slot) {
    case 'weapon':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="1.9">
          <path d="M18.5 3.5L20.5 5.5L9 17L5 19L7 15L18.5 3.5Z" />
          <path d="M14 8L16 10" />
          <path d="M4 20L7.5 16.5" />
        </svg>
      );
    case 'helm':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="1.9">
          <path d="M5 13a7 7 0 0 1 14 0v5H5v-5Z" />
          <path d="M12 6v7" />
          <path d="M8 14h8" />
        </svg>
      );
    case 'armor':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="1.9">
          <path d="M7 4l5 2 5-2 3 4-2.5 3v9h-11v-9L4 8l3-4Z" />
          <path d="M12 6v14" />
        </svg>
      );
    case 'gloves':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="1.9">
          <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4" />
          <path d="M10 10V5a1.5 1.5 0 0 1 3 0v5" />
          <path d="M13 10V6a1.5 1.5 0 0 1 3 0v5" />
          <path d="M16 11V8a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-2a5 5 0 0 1-5-5v-3a1.5 1.5 0 0 1 3 0" />
        </svg>
      );
    case 'boots':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="1.9">
          <path d="M7 4h6v9l5 2.5V19H6V4h1Z" />
          <path d="M6 16h12" />
        </svg>
      );
  }
}

export function MerchantModal({
  gold,
  merchantTimeLeft,
  merchantGearLevels,
  atk,
  maxHp,
  def,
  atkSpeedPct,
  moveSpeedPct,
  onUpgrade,
  onClose,
}: MerchantModalProps) {
  return (
    <div
      data-testid="merchant-modal"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#06090f]/82 backdrop-blur-xs"
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-lg bg-[#0f161c] border border-emerald-500/60 shadow-[0_22px_60px_rgba(0,0,0,0.85),0_0_32px_rgba(16,185,129,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label="방랑 장비 상인"
      >
        {/* Top emerald-gold accent stripe */}
        <div
          className="h-1 w-full"
          style={{
            background: 'linear-gradient(90deg, transparent, #34d399, #facc15, #34d399, transparent)',
          }}
        />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-[#25343f] bg-[#0b1116]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-950/90 border border-emerald-400/70 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#6ee7b7" strokeWidth="1.9">
                <path d="M4 10h16l-1.5 9h-13L4 10Z" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <circle cx="12" cy="14.5" r="1.5" fill="#facc15" stroke="none" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#f4f1ea] tracking-tight">
                  방랑 장비 상인
                </h2>
                <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono-num rounded-xs bg-emerald-950/90 border border-emerald-500/60 text-emerald-300">
                  체류 {merchantTimeLeft}초
                </span>
              </div>
              <p className="text-xs text-[#9fb0be] mt-0.5">
                전장에서 모은 골드로 5부위 장비를 영구 강화합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <div
              data-testid="merchant-gold"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1a160b] border border-amber-400/70 font-mono-num"
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-200" />
              <span className="text-sm sm:text-base font-extrabold text-amber-300">
                {gold.toLocaleString()} G
              </span>
            </div>
            <button
              type="button"
              data-testid="merchant-close-btn"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold rounded-md bg-[#18212c] hover:bg-[#233040] text-[#dce4ee] border border-[#3a4b5d] transition-colors cursor-pointer"
            >
              전장으로 [ESC]
            </button>
          </div>
        </div>

        {/* Hero Current Stat Summary Strip */}
        <div className="grid grid-cols-5 gap-1.5 px-4 py-2.5 sm:px-6 bg-[#0b1015] border-b border-[#202d38] text-center font-mono-num">
          <div className="px-1.5 py-1 rounded bg-[#121a22] border border-[#24313e]">
            <div className="text-[10px] text-[#8da0b2]">공격력</div>
            <div className="text-xs sm:text-sm font-bold text-amber-300">{atk}</div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[#121a22] border border-[#24313e]">
            <div className="text-[10px] text-[#8da0b2]">체력 상한</div>
            <div className="text-xs sm:text-sm font-bold text-rose-300">{maxHp}</div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[#121a22] border border-[#24313e]">
            <div className="text-[10px] text-[#8da0b2]">방어력</div>
            <div className="text-xs sm:text-sm font-bold text-sky-300">-{def}피해</div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[#121a22] border border-[#24313e]">
            <div className="text-[10px] text-[#8da0b2]">공격속도</div>
            <div className="text-xs sm:text-sm font-bold text-yellow-300">+{atkSpeedPct}%</div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[#121a22] border border-[#24313e]">
            <div className="text-[10px] text-[#8da0b2]">이동속도</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-300">+{moveSpeedPct}%</div>
          </div>
        </div>

        {/* 5-Slot Equipment Upgrade List */}
        <div className="p-4 sm:p-5 space-y-2.5">
          {ALL_MERCHANT_SLOTS.map((slot) => {
            const def = MERCHANT_GEAR_CATALOG[slot];
            const level = merchantGearLevels[slot];
            const cost = getMerchantUpgradeCost(level);
            const isMax = cost === null;
            const canAfford = cost !== null && gold >= cost;
            const currentBonus = level * def.perLevelValue;
            const nextBonus = (level + 1) * def.perLevelValue;

            return (
              <div
                key={slot}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-3 rounded-md bg-[#141d25] border border-[#293846] hover:border-[#3e5469] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-md flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: `${def.accent}18`,
                      borderColor: `${def.accent}66`,
                    }}
                  >
                    <MerchantSlotIcon slot={slot} color={def.accent} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-[#f5f2ea]">{def.name}</span>
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold font-mono-num rounded-xs border"
                        style={{
                          color: def.accent,
                          borderColor: `${def.accent}66`,
                          backgroundColor: `${def.accent}16`,
                        }}
                      >
                        Lv.{level} / {MAX_MERCHANT_GEAR_LEVEL}
                      </span>
                      <span className="text-xs font-bold font-mono-num text-[#d8e2ec]">
                        {def.statLabel}{' '}
                        <span style={{ color: def.accent }}>
                          +{currentBonus}
                          {def.unit}
                        </span>
                        {!isMax && (
                          <span className="text-[#8ba0b3]">
                            {' '}
                            →{' '}
                            <strong className="text-[#f5f2ea]">
                              +{nextBonus}
                              {def.unit}
                            </strong>
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94a6b8] mt-0.5 leading-snug">{def.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  data-testid={`merchant-upgrade-${slot}`}
                  onClick={() => onUpgrade(slot)}
                  className={`shrink-0 px-3.5 py-2 rounded-md text-xs font-extrabold font-mono-num border transition-colors ${
                    isMax
                      ? 'bg-[#17212b] text-[#64748b] border-[#293645] cursor-default'
                      : canAfford
                        ? 'bg-amber-400 hover:bg-amber-300 text-[#130e04] border-amber-200 cursor-pointer shadow-[0_4px_14px_rgba(251,191,36,0.28)]'
                        : 'bg-[#17202a] text-[#64748b] border-[#283543] cursor-not-allowed'
                  }`}
                >
                  {isMax ? 'MAX 달성' : `${cost} G 강화 (+${def.perLevelValue}${def.unit})`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
