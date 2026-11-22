import type {
  BiomeDef,
  BiomeId,
  BossKind,
  ElementId,
  ElementSkillTree,
  EnemyKind,
  GearRarity,
  GearSlot,
  LegendaryEffectId,
  MerchantGearSlot,
  WeaponDef,
  WeaponId,
} from './types';

export const MAX_WAVES = 20;
export const WAVE_DURATION_SEC = 20; // 20 stages x 20s = 6:40 escalating survival with bosses at 5, 10, 15, 20

// Exact Loot Economy Constants requested by user
export const ITEM_DROP_RATE_CHEST = 0.2; // 20% item drop chance from wooden chests
export const ITEM_DROP_RATE_GOLDEN_CHEST = 0.25; // 25% item drop chance from golden chests
export const ITEM_DROP_RATE_ELITE = 0.2; // 20% item drop chance from special elite monsters
export const MAX_GEAR_UPGRADE_LEVEL = 10;

// Rarity drop rates matching balance chart: Legendary 2% (1-3%) | Epic 10% (7-12%) | Rare 30% (25-35%) | Normal 58% (50-65%)
export const RARITY_DROP_WEIGHTS: Record<GearRarity, number> = {
  legendary: 0.02,
  epic: 0.1,
  rare: 0.3,
  normal: 0.58,
};

// Banked Skill XP costs (2x increased so reaching Lv.5 requires meaningful progression)
export const SKILL_UPGRADE_XP_COSTS: Record<number, number> = {
  1: 70,
  2: 130,
  3: 210,
  4: 320,
};

export const BIOME_CATALOG: Record<BiomeId, BiomeDef> = {
  0: {
    id: 0,
    name: '이끼 낀 망자의 유적',
    subtitle: '고대 석조 회랑 · 1단계 전장',
    accent: '#f5b041',
    fallbackFloor: '#181e27',
    tintOverlay: 'rgba(12, 18, 26, 0.34)',
    glowInner: 'rgba(251, 168, 52, 0.22)',
    glowOuter: 'rgba(234, 114, 34, 0.06)',
    minCp: 0,
    minLevel: 1,
    minWave: 1,
  },
  1: {
    id: 1,
    name: '잿빛 화산 용암 지대',
    subtitle: '작열하는 흑요석 대지 · 2단계 전장',
    accent: '#fb923c',
    fallbackFloor: '#241614',
    tintOverlay: 'rgba(72, 22, 12, 0.48)',
    glowInner: 'rgba(251, 113, 45, 0.28)',
    glowOuter: 'rgba(220, 38, 38, 0.08)',
    minCp: 190,
    minLevel: 5,
    minWave: 6,
  },
  2: {
    id: 2,
    name: '영원한 서리 성채',
    subtitle: '빙결의 수정 석판 · 3단계 전장',
    accent: '#38bdf8',
    fallbackFloor: '#12212e',
    tintOverlay: 'rgba(14, 48, 78, 0.48)',
    glowInner: 'rgba(56, 189, 248, 0.26)',
    glowOuter: 'rgba(14, 165, 233, 0.08)',
    minCp: 380,
    minLevel: 10,
    minWave: 11,
  },
  3: {
    id: 3,
    name: '종말의 공허 심연',
    subtitle: '자수정 룬의 심연 · 최종 전장',
    accent: '#c084fc',
    fallbackFloor: '#1a1228',
    tintOverlay: 'rgba(46, 16, 78, 0.52)',
    glowInner: 'rgba(192, 132, 252, 0.28)',
    glowOuter: 'rgba(126, 34, 206, 0.08)',
    minCp: 620,
    minLevel: 15,
    minWave: 16,
  },
};

export const ALL_GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'helm', 'accessory'];

export const GEAR_SLOT_META: Record<GearSlot, { label: string; shortLabel: string; role: string }> = {
  weapon: { label: '무기', shortLabel: '무기', role: '공격력 · 핵심 전투 스킬' },
  armor: { label: '갑옷', shortLabel: '갑옷', role: '방어력 · 체력 · 보조 스킬' },
  helm: { label: '투구', shortLabel: '투구', role: '방어력 · 치명타 · 보조 스킬' },
  accessory: { label: '장신구', shortLabel: '장신구', role: '공격력 · 공속 · 보조 스킬' },
};

export const GEAR_RARITY_META: Record<
  GearRarity,
  {
    label: string;
    color: string;
    border: string;
    bg: string;
    beamHeight: number;
    statMult: number;
    salvageShards: number;
    dropPctLabel: string;
  }
> = {
  normal: {
    label: '노말',
    color: '#cbd5e1',
    border: '#64748b',
    bg: '#1c2330',
    beamHeight: 54,
    statMult: 1.0,
    salvageShards: 2,
    dropPctLabel: '58%',
  },
  rare: {
    label: '레어',
    color: '#60a5fa',
    border: '#3b82f6',
    bg: '#15233b',
    beamHeight: 88,
    statMult: 1.42,
    salvageShards: 4,
    dropPctLabel: '30%',
  },
  epic: {
    label: '에픽',
    color: '#c084fc',
    border: '#a855f7',
    bg: '#261638',
    beamHeight: 126,
    statMult: 1.92,
    salvageShards: 7,
    dropPctLabel: '10%',
  },
  legendary: {
    label: '전설',
    color: '#fb923c',
    border: '#f97316',
    bg: '#331c0d',
    beamHeight: 170,
    statMult: 2.6,
    salvageShards: 12,
    dropPctLabel: '2%',
  },
};

export const LEGENDARY_EFFECT_META: Record<
  LegendaryEffectId,
  { name: string; description: string }
> = {
  crit_nova: {
    name: '태양 파열',
    description: '치명타 적중 시 주변 적에게 42% 화염 폭발 피해',
  },
  life_leech: {
    name: '피의 갈증',
    description: '적 처치 시 30% 확률로 체력 +1 회복 (정예·보스는 +5)',
  },
  dash_storm: {
    name: '폭풍 질주',
    description: '대시 충격파 피해 +60% 및 폭발 반경 +35%',
  },
  treasure_hunter: {
    name: '파편 수집가',
    description: '보물상자·정예 처치 시 강화 파편 +2 추가 획득 및 드랍률 +5%',
  },
};

export const GEAR_NAME_PREFIXES: Record<GearRarity, string[]> = {
  normal: ['낡은', '강철의', '단련된', '수비대의', '견고한'],
  rare: ['마력의', '신속한', '예리한', '서리깃든', '수호의'],
  epic: ['학살자의', '심연의', '성광의', '폭풍군주의', '불멸의'],
  legendary: ['종말의', '용살자의', '태양왕의', '영원한 밤의', '신화의'],
};

export const GEAR_BASE_NAMES: Record<GearSlot, string[]> = {
  weapon: ['룬 대검', '사냥꾼 장궁', '전쟁 도끼', '마도 지팡이', '쌍날 창'],
  armor: ['판금 흉갑', '용비늘 갑옷', '수호자 외투', '암흑 사슬갑옷'],
  helm: ['기사 투구', '지혜의 왕관', '그림자 두건', '철갑 면갑'],
  accessory: ['고대 반지', '심연의 목걸이', '별빛 부적', '피의 인장'],
};

export const ELITE_AFFIXES: Array<{ title: string; color: string; hpMult: number; spdMult: number }> = [
  { title: '광폭한', color: '#f97316', hpMult: 3.1, spdMult: 1.22 },
  { title: '서리심장', color: '#38bdf8', hpMult: 3.4, spdMult: 1.12 },
  { title: '철갑의', color: '#facc15', hpMult: 3.9, spdMult: 1.06 },
  { title: '공허의', color: '#c084fc', hpMult: 3.3, spdMult: 1.18 },
];

export const BOSS_META: Record<
  BossKind,
  { name: string; subtitle: string; accent: string }
> = {
  boss_behemoth: {
    name: '철갑 거수 베히모스',
    subtitle: '연속 분쇄 돌진 · 대지 충격파',
    accent: '#ef4444',
  },
  boss_pyrolord: {
    name: '심연의 화염군주 이프리트',
    subtitle: '나선 불꽃 탄막 · 유성 폭격',
    accent: '#fb923c',
  },
  boss_frostqueen: {
    name: '서리 여왕 글라시아',
    subtitle: '빙결 십자 광선 · 순간이동 냉기',
    accent: '#38bdf8',
  },
  lich_boss: {
    name: '종말의 고대 리치 군주',
    subtitle: '심연 탄막 · 저주 마법진 · 공허 돌격',
    accent: '#c084fc',
  },
};

export const WEAPON_CATALOG: Record<WeaponId, WeaponDef> = {
  arcane_bolt: {
    id: 'arcane_bolt',
    kind: 'weapon',
    name: '비전 화살',
    role: '자동 조준 · 단일 집중',
    accent: '#f5b041',
    maxLevel: 5,
    levelDescriptions: [
      '가장 가까운 적에게 마력 화살을 자동 발사합니다.',
      '화살 발사 수 +1, 피해량 +25%',
      '공격 속도 +18%, 관통 +1',
      '화살 발사 수 +1 (총 3발), 피해량 +25%',
      '폭풍 마력: 4발 연사 및 고속 관통',
    ],
  },
  orbit_blades: {
    id: 'orbit_blades',
    kind: 'weapon',
    name: '수호 회전검',
    role: '근접 방어 · 넉백 회전',
    accent: '#93c5fd',
    maxLevel: 5,
    levelDescriptions: [
      '영웅 주위를 도는 2개의 수호 검을 소환합니다.',
      '회전검 +1개 (총 3개), 회전 반경 증가',
      '회전 속도 +25%, 피해량 +30%',
      '회전검 +1개 (총 4개), 강한 넉백',
      '폭풍의 칼날: 5개의 고속 수호검 전개',
    ],
  },
  chain_lightning: {
    id: 'chain_lightning',
    kind: 'weapon',
    name: '연쇄 번개',
    role: '즉발 광역 · 연쇄 감전',
    accent: '#7dd3fc',
    maxLevel: 5,
    levelDescriptions: [
      '주변 적 3명에게 연쇄적으로 튀는 번개를 내립니다.',
      '연쇄 대상 +1명, 피해량 +30%',
      '재사용 대기시간 -20%',
      '연쇄 대상 +2명 (총 6명), 피해량 +25%',
      '천둥 군주: 8연쇄 초고압 낙뢰',
    ],
  },
  ember_nova: {
    id: 'ember_nova',
    kind: 'weapon',
    name: '화염 고리',
    role: '전방위 폭발 · 군중 제어',
    accent: '#fb923c',
    maxLevel: 5,
    levelDescriptions: [
      '주기적으로 불꽃 충격파를 방출해 주변 적을 밀쳐냅니다.',
      '폭발 반경 +22%, 피해량 +30%',
      '재사용 대기시간 -20%',
      '폭발 반경 +20%, 피해량 +35%',
      '태양의 심판: 초대형 화염 파동 연쇄 폭발',
    ],
  },
  frost_lance: {
    id: 'frost_lance',
    kind: 'weapon',
    name: '서리 창',
    role: '관통 직선 · 둔화 효과',
    accent: '#67e8f9',
    maxLevel: 5,
    levelDescriptions: [
      '적을 관통하며 이동 속도를 45% 늦추는 얼음 창을 던집니다.',
      '관통 횟수 +2, 피해량 +30%',
      '서리 창 +1발 (양갈래 발사)',
      '재사용 대기시간 -22%, 둔화 지속 증가',
      '빙하의 창: 3발 관통 극한 냉기',
    ],
  },
  holy_chakram: {
    id: 'holy_chakram',
    kind: 'weapon',
    name: '성스러운 차크람',
    role: '부메랑 궤도 · 왕복 타격',
    accent: '#fde047',
    maxLevel: 5,
    levelDescriptions: [
      '던진 뒤 영웅에게 돌아오며 경로의 모든 적을 벱니다.',
      '차크람 크기 +20%, 피해량 +30%',
      '차크람 +1개 동시 투척',
      '재사용 대기시간 -20%, 피해량 +30%',
      '빛의 윤회: 3개의 대형 성광 차크람 투척',
    ],
  },
};

export const ALL_WEAPON_IDS: WeaponId[] = [
  'arcane_bolt',
  'orbit_blades',
  'chain_lightning',
  'ember_nova',
  'frost_lance',
  'holy_chakram',
];

export interface WaveConfig {
  wave: number;
  title: string;
  spawnInterval: number;
  batchSize: number;
  maxEnemies: number;
  hpMult: number;
  speedMult: number;
  eliteChance: number;
  weights: { skeleton: number; imp: number; charger: number; bat: number };
  bossKind: BossKind | null;
}

const STAGE_TITLES: string[] = [
  '스테이지 1 · 망자의 회랑',
  '스테이지 2 · 유적의 파수꾼',
  '스테이지 3 · 정예 척후대 출현',
  '스테이지 4 · 밤의 날개 편대',
  '스테이지 5 · 보스: 철갑 거수 베히모스',
  '스테이지 6 · 화염 임프 군단',
  '스테이지 7 · 강철 창기병의 행진',
  '스테이지 8 · 용암 지대 정예 분대',
  '스테이지 9 · 불타는 포위망',
  '스테이지 10 · 보스: 화염군주 이프리트',
  '스테이지 11 · 서리 성채의 선봉',
  '스테이지 12 · 빙결 정예 수호대',
  '스테이지 13 · 극한의 파도',
  '스테이지 14 · 얼어붙은 돌격대',
  '스테이지 15 · 보스: 서리 여왕 글라시아',
  '스테이지 16 · 심연의 전조',
  '스테이지 17 · 공허 정예 집행자',
  '스테이지 18 · 멸망의 대군',
  '스테이지 19 · 종말 직전의 광란',
  '최종 스테이지 20 · 종말의 고대 리치 군주',
];

// Hardcore-rebalanced 20-stage difficulty curve
export const WAVE_CONFIGS: WaveConfig[] = Array.from({ length: MAX_WAVES }, (_, idx) => {
  const stage = idx + 1;
  const bossKind: BossKind | null =
    stage === 5
      ? 'boss_behemoth'
      : stage === 10
        ? 'boss_pyrolord'
        : stage === 15
          ? 'boss_frostqueen'
          : stage === 20
            ? 'lich_boss'
            : null;

  const hpMult = Number((1 + (stage - 1) * 0.48 + Math.pow(stage - 1, 1.56) * 0.18).toFixed(2));
  const speedMult = Number((1 + (stage - 1) * 0.034).toFixed(3));
  const spawnInterval = Number(Math.max(0.18, 0.94 - (stage - 1) * 0.044).toFixed(2));
  const batchSize =
    stage >= 18 ? 7 : stage >= 15 ? 6 : stage >= 11 ? 5 : stage >= 7 ? 3 : stage >= 4 ? 2 : 1;
  const maxEnemies = Math.min(160, 24 + stage * 6 + Math.max(0, stage - 9) * 4);
  const eliteChance =
    stage <= 1
      ? 0.0
      : stage === 3 || stage === 8 || stage === 12 || stage === 17
        ? 0.18
        : Math.min(0.16, 0.04 + stage * 0.006);

  const weights =
    stage <= 2
      ? { skeleton: 0.56, imp: 0.24, charger: 0.08, bat: 0.12 }
      : stage <= 5
        ? { skeleton: 0.36, imp: 0.25, charger: 0.21, bat: 0.18 }
        : stage <= 10
          ? { skeleton: 0.24, imp: 0.3, charger: 0.26, bat: 0.2 }
          : stage <= 15
            ? { skeleton: 0.2, imp: 0.26, charger: 0.28, bat: 0.26 }
            : { skeleton: 0.16, imp: 0.28, charger: 0.3, bat: 0.26 };

  return {
    wave: stage,
    title: STAGE_TITLES[idx],
    spawnInterval,
    batchSize,
    maxEnemies,
    hpMult,
    speedMult,
    eliteChance,
    weights,
    bossKind,
  };
});

// ============================================================================
// 5-Slot Wandering Equipment Merchant Catalog (Gold Upgrades)
// ============================================================================
export const MERCHANT_DURATION_SEC = 30;
export const MERCHANT_SPAWN_TRAVEL_SEC = 20;
export const MAX_MERCHANT_GEAR_LEVEL = 15;

export const ALL_MERCHANT_SLOTS: MerchantGearSlot[] = ['weapon', 'helm', 'armor', 'gloves', 'boots'];

export interface MerchantGearDef {
  slot: MerchantGearSlot;
  name: string;
  statLabel: string;
  perLevelValue: number;
  unit: string;
  description: string;
  accent: string;
}

export const MERCHANT_GEAR_CATALOG: Record<MerchantGearSlot, MerchantGearDef> = {
  weapon: {
    slot: 'weapon',
    name: '마도 무기',
    statLabel: '무기 공격력',
    perLevelValue: 6,
    unit: '',
    description: '기본 공격력 및 모든 마법의 무기 공격력 합산 피해 증가',
    accent: '#fb923c',
  },
  helm: {
    slot: 'helm',
    name: '수호 투구',
    statLabel: '체력 상한치',
    perLevelValue: 22,
    unit: ' HP',
    description: '최대 체력 상한치를 높이고 증가량만큼 즉시 회복',
    accent: '#f87171',
  },
  armor: {
    slot: 'armor',
    name: '마력 갑옷',
    statLabel: '고정 방어력',
    perLevelValue: 3,
    unit: '',
    description: '몬스터 공격력에서 방어력 수치만큼 피해를 직접 차감',
    accent: '#60a5fa',
  },
  gloves: {
    slot: 'gloves',
    name: '신속 장갑',
    statLabel: '공격 속도',
    perLevelValue: 6,
    unit: '%',
    description: '기본 마법과 속성 마법의 시전 속도를 빠르게 단축',
    accent: '#facc15',
  },
  boots: {
    slot: 'boots',
    name: '질풍 장화',
    statLabel: '이동 속도',
    perLevelValue: 5,
    unit: '%',
    description: '전장 기동력과 회피 이동 속도를 영구적으로 강화',
    accent: '#4ade80',
  },
};

export function getMerchantUpgradeCost(currentLevel: number): number | null {
  if (currentLevel >= MAX_MERCHANT_GEAR_LEVEL) return null;
  return 5 + currentLevel * 6 + Math.floor(currentLevel * currentLevel * 1.4);
}

// ============================================================================
// 4-Element Mage Skill Tree (Single-Element Specialization, Max Lv.10)
// ============================================================================
export const MAX_ELEMENT_BRANCH_LEVEL = 10;
export const ALL_ELEMENTS: ElementId[] = ['fire', 'ice', 'lightning', 'poison'];

export interface ElementSkillDef {
  id: ElementId;
  name: string;
  spellName: string;
  color: string;
  border: string;
  bg: string;
  baseAtk: number;
  powerPerLv: number;
  baseArea: number;
  areaPerLv: number;
  areaUnit: string;
  strongAgainst: ElementId;
  weakAgainst: ElementId;
  summary: string;
  powerBranchTitle: string;
  powerBranchDesc: string;
  areaBranchTitle: string;
  areaBranchDesc: string;
}

// Elemental Cycle: Fire ▶ Ice ▶ Poison ▶ Lightning ▶ Fire (1.5x Weakness / 0.7x Resistance)
export const ELEMENT_CATALOG: Record<ElementId, ElementSkillDef> = {
  fire: {
    id: 'fire',
    name: '화염',
    spellName: '화염 폭발구',
    color: '#fb923c',
    border: '#ea580c',
    bg: 'rgba(67, 20, 7, 0.72)',
    baseAtk: 14,
    powerPerLv: 9,
    baseArea: 68,
    areaPerLv: 18,
    areaUnit: 'px',
    strongAgainst: 'ice',
    weakAgainst: 'lightning',
    summary: '폭발 시 반경 안의 모든 적에게 화염 피해와 화상을 입힙니다.',
    powerBranchTitle: '작열 화력 강화',
    powerBranchDesc: '화염 속성 공격력 +9 & 화상 피해 강화',
    areaBranchTitle: '화염 폭발 반경 확장',
    areaBranchDesc: '폭발 반경 +18px (반경 내 전체 적 화염 피해)',
  },
  ice: {
    id: 'ice',
    name: '얼음',
    spellName: '빙하 파편창',
    color: '#38bdf8',
    border: '#0284c7',
    bg: 'rgba(12, 42, 64, 0.72)',
    baseAtk: 13,
    powerPerLv: 8,
    baseArea: 1,
    areaPerLv: 1,
    areaUnit: '명 관통',
    strongAgainst: 'poison',
    weakAgainst: 'fire',
    summary: '적을 관통·둔화시키며, 둔화 적 처치 시 얼음 파쇄로 주위에 추가 피해를 입힙니다.',
    powerBranchTitle: '극한 냉기 강화',
    powerBranchDesc: '얼음 속성 공격력 +8 & 파쇄·둔화 지속 강화',
    areaBranchTitle: '빙창 관통 & 파쇄 확장',
    areaBranchDesc: '관통 수 +1명/레벨 & 둔화 적 처치 파쇄 반경 증가',
  },
  lightning: {
    id: 'lightning',
    name: '전기',
    spellName: '연쇄 뇌격',
    color: '#fde047',
    border: '#ca8a04',
    bg: 'rgba(56, 44, 8, 0.72)',
    baseAtk: 15,
    powerPerLv: 10,
    baseArea: 1,
    areaPerLv: 1,
    areaUnit: '명 연쇄',
    strongAgainst: 'fire',
    weakAgainst: 'poison',
    summary: '고압 번개가 적을 강타하며, 범위 레벨이 오를수록 1명에서 다수로 연쇄됩니다.',
    powerBranchTitle: '초고압 전류 강화',
    powerBranchDesc: '전기 속성 공격력 +10 & 감전 피해 증폭',
    areaBranchTitle: '연쇄 번개 대상 확장',
    areaBranchDesc: '연쇄 타격 수 +1명/레벨 (1명 → 최대 11명)',
  },
  poison: {
    id: 'poison',
    name: '독',
    spellName: '맹독 우물구',
    color: '#4ade80',
    border: '#16a34a',
    bg: 'rgba(11, 48, 26, 0.72)',
    baseAtk: 12,
    powerPerLv: 8,
    baseArea: 56,
    areaPerLv: 16,
    areaUnit: 'px',
    strongAgainst: 'lightning',
    weakAgainst: 'ice',
    summary: '명중 위치에 독 우물을 생성해 그 위를 지나는 적에게 지속 독 피해를 입힙니다.',
    powerBranchTitle: '맹독 농축 강화',
    powerBranchDesc: '독 속성 공격력 +8 & 독 우물·중독 피해 강화',
    areaBranchTitle: '독 우물 넓이 확장',
    areaBranchDesc: '독 우물 반경 +16px (지나가는 적 지속 독 피해)',
  },
};

export function getChosenElement(tree: ElementSkillTree): ElementId | null {
  for (let i = 0; i < ALL_ELEMENTS.length; i++) {
    const el = ALL_ELEMENTS[i];
    if (tree[el].unlocked) return el;
  }
  return null;
}

export function getElementAffinity(
  attackEl: ElementId,
  targetEl: ElementId
): { mult: number; relation: 'strong' | 'weak' | 'neutral' } {
  const def = ELEMENT_CATALOG[attackEl];
  if (def.strongAgainst === targetEl) {
    return { mult: 1.5, relation: 'strong' };
  }
  if (def.weakAgainst === targetEl) {
    return { mult: 0.7, relation: 'weak' };
  }
  return { mult: 1.0, relation: 'neutral' };
}

export function getEnemyElement(kind: EnemyKind, eliteTitle?: string): ElementId {
  if (eliteTitle === '서리심장') return 'ice';
  if (eliteTitle === '광폭한') return 'fire';
  if (eliteTitle === '철갑의') return 'lightning';
  if (eliteTitle === '공허의') return 'poison';
  switch (kind) {
    case 'skeleton':
    case 'boss_frostqueen':
      return 'ice';
    case 'imp':
    case 'boss_pyrolord':
      return 'fire';
    case 'charger':
    case 'boss_behemoth':
      return 'lightning';
    case 'bat':
    case 'lich_boss':
      return 'poison';
  }
}

export function getElementAttackPower(tree: ElementSkillTree, element: ElementId): number {
  const node = tree[element];
  if (!node.unlocked) return 0;
  const def = ELEMENT_CATALOG[element];
  return def.baseAtk + node.powerLv * def.powerPerLv;
}

export function getElementAreaValue(tree: ElementSkillTree, element: ElementId): number {
  const node = tree[element];
  const def = ELEMENT_CATALOG[element];
  return def.baseArea + node.areaLv * def.areaPerLv;
}
