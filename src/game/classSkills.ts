import type {
  ClassSkillTreeState,
  HeroClassId,
  HybridFusionId,
  SkillAttribute,
  SkillTier,
} from './types';

export const ALL_HERO_CLASSES: readonly HeroClassId[] = ['wizard', 'warrior', 'archer'] as const;

export const ALL_SKILL_ATTRIBUTES: readonly SkillAttribute[] = [
  'fire',
  'ice',
  'lightning',
  'poison',
  'physical',
] as const;

export const ALL_SKILL_TIERS: readonly SkillTier[] = [1, 2, 3] as const;

export const MAX_CLASS_SKILL_LEVEL = 10;

export interface HeroClassDef {
  id: HeroClassId;
  name: string;
  englishName: string;
  concept: string;
  gimmick: string;
  synergy: string;
  accent: string;
  bg: string;
  border: string;
  starterWeaponName: string;
  basicWeaponLabel: string;
  atkSpeedSummary: string;
  baseHpMod: number;
  baseAtkMod: number;
  baseDefMod: number;
  baseMoveSpeedMod: number;
  baseCritBonus: number;
  resourceLabel: string;
}

export interface HeroBasicWeaponConfig {
  name: string;
  baseCooldown: number;
  damageScale: number;
  range: number;
  starterWeaponAtk: number;
  starterWeaponAtkSpdPct: number;
}

export const HERO_BASIC_WEAPON_CONFIG: Record<HeroClassId, HeroBasicWeaponConfig> = {
  wizard: {
    name: '매직 미사일',
    baseCooldown: 0.8,
    damageScale: 1.0,
    range: 500,
    starterWeaponAtk: 6,
    starterWeaponAtkSpdPct: 0,
  },
  warrior: {
    name: '대검',
    baseCooldown: 1.24,
    damageScale: 1.15,
    range: 148,
    starterWeaponAtk: 12,
    starterWeaponAtkSpdPct: 0,
  },
  archer: {
    name: '화살',
    baseCooldown: 0.44,
    damageScale: 0.92,
    range: 560,
    starterWeaponAtk: 3,
    starterWeaponAtkSpdPct: 12,
  },
};

export const HERO_CLASS_CATALOG: Record<HeroClassId, HeroClassDef> = {
  wizard: {
    id: 'wizard',
    name: '위저드',
    englishName: 'Wizard',
    concept: '원소 지배자 (AoE & 연쇄 반응)',
    gimmick: '일정 주기마다 밀집된 적군 위에 장판·낙하·연쇄 마법 시전',
    synergy: '서로 다른 속성 장판·상태가 겹치면 원소 융합(열충격·산성 과부하) 발생',
    accent: '#38bdf8',
    bg: 'rgba(12, 42, 68, 0.85)',
    border: '#0284c7',
    starterWeaponName: '매직 미사일 지팡이',
    basicWeaponLabel: '매직 미사일',
    atkSpeedSummary: '공격력 표준 · 공속 표준',
    baseHpMod: 0,
    baseAtkMod: 0,
    baseDefMod: 0,
    baseMoveSpeedMod: 0,
    baseCritBonus: 2,
    resourceLabel: '원소 융합',
  },
  warrior: {
    id: 'warrior',
    name: '워리어',
    englishName: 'Warrior',
    concept: '전장의 파괴자 (근접 충돌 & 스택)',
    gimmick: "이동·공격 시 쌓이는 '분노/충격' 게이지 소모 또는 피격·근접 충돌 시 폭발",
    synergy: '적을 밀쳐내 다른 적과 부딪히게 하면 추가 광역 충돌 피해',
    accent: '#f97316',
    bg: 'rgba(72, 24, 14, 0.85)',
    border: '#ea580c',
    starterWeaponName: '강철 대검',
    basicWeaponLabel: '대검 참격',
    atkSpeedSummary: '공격력 강함 · 공속 느림',
    baseHpMod: 25,
    baseAtkMod: 6,
    baseDefMod: 3,
    baseMoveSpeedMod: -4,
    baseCritBonus: 0,
    resourceLabel: '분노/충격',
  },
  archer: {
    id: 'archer',
    name: '아처',
    englishName: 'Archer',
    concept: '치명적인 사냥꾼 (투사체 변형 & 표식)',
    gimmick: '조준·이동 방향으로 투사체 발사, 타격 콤보에 따라 분열·도탄·관통',
    synergy: '원거리 유지 또는 치명타 적중 시 표식 폭발·즉발 기믹 발동',
    accent: '#4ade80',
    bg: 'rgba(14, 52, 32, 0.85)',
    border: '#16a34a',
    starterWeaponName: '사냥꾼의 장궁',
    basicWeaponLabel: '속사 화살',
    atkSpeedSummary: '공격력 약함 · 공속 빠름',
    baseHpMod: -5,
    baseAtkMod: -4,
    baseDefMod: 0,
    baseMoveSpeedMod: 14,
    baseCritBonus: 8,
    resourceLabel: '타격 콤보',
  },
};

export interface AttributeMeta {
  id: SkillAttribute;
  name: string;
  role: string;
  color: string;
  bg: string;
  border: string;
}

export const ATTRIBUTE_META: Record<SkillAttribute, AttributeMeta> = {
  fire: {
    id: 'fire',
    name: '화염',
    role: '지속·폭발',
    color: '#fb923c',
    bg: 'rgba(124, 45, 18, 0.36)',
    border: '#ea580c',
  },
  ice: {
    id: 'ice',
    name: '빙결',
    role: '제어·파쇄',
    color: '#38bdf8',
    bg: 'rgba(12, 74, 110, 0.36)',
    border: '#0284c7',
  },
  lightning: {
    id: 'lightning',
    name: '전기',
    role: '연쇄·속도',
    color: '#fde047',
    bg: 'rgba(113, 63, 18, 0.36)',
    border: '#eab308',
  },
  poison: {
    id: 'poison',
    name: '독',
    role: '중첩·전염',
    color: '#4ade80',
    bg: 'rgba(20, 83, 45, 0.36)',
    border: '#16a34a',
  },
  physical: {
    id: 'physical',
    name: '물리',
    role: '넉백·치명',
    color: '#e2e8f0',
    bg: 'rgba(51, 65, 85, 0.44)',
    border: '#94a3b8',
  },
};

export interface MutationOptionDef {
  title: string;
  desc: string;
  tag: '광역·잡몹' | '단일·보스';
}

export interface ClassSkillDef {
  id: string;
  heroClass: HeroClassId;
  attribute: SkillAttribute;
  tier: SkillTier;
  name: string;
  desc: string;
  synergyLabel: string;
  mut5A: MutationOptionDef;
  mut5B: MutationOptionDef;
  mut10A: MutationOptionDef;
  mut10B: MutationOptionDef;
}

type AttributeTiers = Record<SkillTier, ClassSkillDef>;

function makeSkill(
  heroClass: HeroClassId,
  attribute: SkillAttribute,
  tier: SkillTier,
  name: string,
  desc: string,
  synergyLabel: string,
  mut5A: [string, string],
  mut5B: [string, string],
  mut10A: [string, string],
  mut10B: [string, string]
): ClassSkillDef {
  return {
    id: `${heroClass}_${attribute}_t${tier}`,
    heroClass,
    attribute,
    tier,
    name,
    desc,
    synergyLabel,
    mut5A: { title: mut5A[0], desc: mut5A[1], tag: '광역·잡몹' },
    mut5B: { title: mut5B[0], desc: mut5B[1], tag: '단일·보스' },
    mut10A: { title: mut10A[0], desc: mut10A[1], tag: '광역·잡몹' },
    mut10B: { title: mut10B[0], desc: mut10B[1], tag: '단일·보스' },
  };
}

export const CLASS_SKILL_CATALOG: Record<HeroClassId, Record<SkillAttribute, AttributeTiers>> = {
  wizard: {
    fire: {
      1: makeSkill(
        'wizard', 'fire', 1, '유성 파편',
        '밀집된 적 머리 위로 불덩이를 낙하시켜 화염 폭발과 화상을 입힙니다.',
        '시너지: Lv당 [종말의 태양] 폭발 범위 +10%, [불씨 전이] 피해 +12%',
        ['유성 군락', '낙하 불덩이 +2개 및 폭발 반경 +30%'],
        ['고밀도 운석', '단일 중심 폭발 피해 +75% (보스 추가 화상)'],
        ['별똥별 폭격', '5연속 광역 유성 낙하 + 용암 지대 생성'],
        ['초신성 낙하', '보스·엘리트 대상 방어 무시 화염 폭딜 2.1×']
      ),
      2: makeSkill(
        'wizard', 'fire', 2, '불씨 전이',
        '화상 상태의 적이 처치되면 주변으로 불길이 연쇄 확산하며 폭발합니다.',
        '시너지: [유성 파편] Lv당 확산 피해 +12% 증가',
        ['들불 연쇄', '확산 반경 +45% 및 2차 연쇄 발화'],
        ['응축 작열', '화상 적 공격 시 매 타격 화염 추가폭발 +55%'],
        ['지옥불 연쇄', '처치 시 3방향 불기둥 동시 확산'],
        ['태양열 붕괴', '보스 화상 유지 시 초당 최대체력 비례 작열']
      ),
      3: makeSkill(
        'wizard', 'fire', 3, '종말의 태양',
        '전장에 거대한 태양을 소환해 적을 블랙홀처럼 끌어당기며 지속 화염 도트를 가합니다.',
        '시너지: [유성 파편] Lv당 태양 범위 +10%, [불씨 전이] Lv당 도트 +10%',
        ['성운 팽창', '태양 흡인 반경 +40% 및 동시 2개 소환'],
        ['핵융합 집중', '단일 보스 대상 지속 화염 피해 2× 집중'],
        ['적색 거성', '태양 종료 시 화면 전체 대폭발 충격파'],
        ['항성 붕괴', '태양 중심부 적에게 초고열 치명 화염 2.5×']
      ),
    },
    ice: {
      1: makeSkill(
        'wizard', 'ice', 1, '서리 고리',
        '캐릭터 주변에 주기적으로 빙결 파동을 방출해 적을 얼리고 둔화시킵니다.',
        '시너지: 2Lv마다 [빙결 파쇄] 얼음 파편 +1개, [절대영도] 피해 +10%',
        ['혹한 확장', '서리 고리 반경 +40% 및 이중 파동 방출'],
        ['동상 집중', '근접 단일 적 빙결 지속시간 2배 + 피해 +70%'],
        ['영구 동토', '서리 고리가 빙결 장판을 남겨 지속 둔화'],
        ['빙핵 파열', '보스 대상 빙결 저항 무시 및 파쇄 피해 +90%']
      ),
      2: makeSkill(
        'wizard', 'ice', 2, '빙결 파쇄',
        '얼어붙은 적을 타격하거나 처치하면 날카로운 얼음 파편이 사방으로 비산합니다.',
        '시너지: [서리 고리] 2Lv마다 파편 수 +1, 피해 +10%',
        ['난반사 빙정', '비산 파편 +4개 및 관통 2회 추가'],
        ['집속 고드름', '파편이 가장 강한 적(보스)에게 유도 집중'],
        ['만화경 파쇄', '파편 적중 적도 추가 소형 파쇄 연쇄'],
        ['심장 관통', '얼어붙은 보스 타격 시 치명 파쇄 피해 2.2×']
      ),
      3: makeSkill(
        'wizard', 'ice', 3, '절대영도',
        '화면 전체의 적을 순간 빙결시키고 체력 비례 파쇄 피해를 입힙니다.',
        '시너지: [서리 고리]·[빙결 파쇄] Lv당 파쇄 계수 +8%',
        ['빙하기 강림', '쿨타임 -25% 및 빙결 지속시간 +2.5초'],
        ['영하 극점', '보스 대상 체력 비례 파쇄 피해 상한 2배'],
        ['만년 빙하', '절대영도 후 전장 곳곳에 얼음 기둥 6회 추가 낙하'],
        ['절대 붕괴', '빙결 중인 단일 대상 즉발 치명타 +140%']
      ),
    },
    lightning: {
      1: makeSkill(
        'wizard', 'lightning', 1, '연쇄 번개',
        '가장 가까운 적부터 시작해 최대 N명의 적에게 번개가 연쇄 전이됩니다.',
        '시너지: Lv당 [정전기장]·[뇌신의 심판] 감전 피해 +12%',
        ['다중 전이', '전이 횟수 +5회 (잡몹 처리 특화)'],
        ['단일 중첩', '단일 대상에게 5번 중복 타격 (보스전 특화)'],
        ['천둥 연쇄망', '전이 시 주변 적에게 2갈래 추가 분기'],
        ['초고압 직격', '보스 단일 대상 과전류 중첩 피해 2.3×']
      ),
      2: makeSkill(
        'wizard', 'lightning', 2, '정전기장',
        '번개에 맞은 적들 사이로 전류 선이 연결되어 경로와 연결된 적에게 지속 피해를 줍니다.',
        '시너지: [연쇄 번개] Lv당 전류선 피해 +12%',
        ['고압 격자망', '전류 연결 대상 +4명 및 연결 거리 +45%'],
        ['과전류 결속', '단일 적에게 고압 전류 중첩 시 폭발 낙뢰'],
        ['플라즈마 구역', '전류선 교차점에 지속 감전 폭발 발생'],
        ['초전도 심판', '보스 대상 정전기 중첩당 받는 피해 +35%']
      ),
      3: makeSkill(
        'wizard', 'lightning', 3, '뇌신의 심판',
        '캐릭터 주변에 거대한 번개 폭풍을 고정 유지하며 범위 내 적을 지속적으로 감전시킵니다.',
        '시너지: [연쇄 번개] Lv당 폭풍 낙뢰 빈도·피해 +12%',
        ['태풍 전선', '번개 폭풍 반경 +45% 및 초당 낙뢰 +3회'],
        ['뇌신의 창', '폭풍 에너지를 보스 1체에 집중해 거대 낙뢰'],
        ['천공 뇌우', '폭풍 내 적 처치 시 연쇄 번개 자동 발사'],
        ['심판의 벼락', '단일 강적에게 치명 확률 +45% 초고압 벼락']
      ),
    },
    poison: {
      1: makeSkill(
        'wizard', 'poison', 1, '맹독 늪지',
        '이동 경로를 따라 발밑에 맹독 장판을 생성해 밟는 적에게 독 중첩과 피해를 줍니다.',
        '시너지: Lv당 [역병 전염]·[죽음의 안개] 독 피해 +12%',
        ['부패 확산', '독 장판 반경 +40% 및 지속시간 +2초'],
        ['농축 맹독', '독 중첩 속도 2배 및 중첩당 도트 피해 +65%'],
        ['독성 대습지', '장판 위 적 이동속도 40% 둔화 + 부식'],
        ['치사량 투여', '보스 독 최대 중첩 시 매초 추가 고정 피해']
      ),
      2: makeSkill(
        'wizard', 'poison', 2, '역병 전염',
        '적의 독 중첩이 최대치에 달하면 주변으로 독구름이 폭발하며 전염됩니다.',
        '시너지: [맹독 늪지] Lv당 폭발 반경 +8%, 피해 +12%',
        ['전염병 창궐', '독구름 폭발 반경 +45% 및 즉시 2중첩 전파'],
        ['신경 마비독', '최대 중첩 폭발 시 단일 대상 추가 극독 1.9×'],
        ['연쇄 부패', '폭발에 휘말린 적이 죽으면 2차 독구름 폭발'],
        ['치명적 독소', '보스 대상 최대 중첩 폭발 쿨타임 절반·피해 2.2×']
      ),
      3: makeSkill(
        'wizard', 'poison', 3, '죽음의 안개',
        '화면 전체에 서서히 짙어지는 치명적 독안개를 살포해 모든 적을 녹입니다.',
        '시너지: [맹독 늪지]·[역병 전염] Lv당 안개 농도·피해 +10%',
        ['종말의 역병', '전장 전체 독안개 틱 속도 +45% 및 중첩 가속'],
        ['맹독 응축', '보스·엘리트 주변에 독안개가 응집해 2.3× 피해'],
        ['부식성 폭우', '독안개 지속 중 전장에 산성 방울 추가 낙하'],
        ['사신의 숨결', '체력 25% 이하 일반 적 즉사·보스 피해 +80%']
      ),
    },
    physical: {
      1: makeSkill(
        'wizard', 'physical', 1, '염동력 구체',
        '캐릭터 주위를 공전하며 적을 강하게 밀쳐내는 염동력 구체를 소환합니다.',
        '시너지: Lv당 [중력 왜곡] 흡인력·[차원 칼날] 피해 +12%',
        ['다중 위성', '공전 염동력 구체 +2개 및 공전 반경 확장'],
        ['중질량 코어', '구체 충돌 피해 +80% 및 강력한 넉백 충격'],
        ['염동 방벽', '구체가 적 투사체를 상쇄하고 충격파 방출'],
        ['특이점 구체', '보스 충돌 시 방어 관통 물리 치명타 2×']
      ),
      2: makeSkill(
        'wizard', 'physical', 2, '중력 왜곡',
        '염동력 구체가 주기적으로 적을 중앙으로 끌어모은 뒤 압축 폭발을 일으킵니다.',
        '시너지: [염동력 구체] Lv당 압축 폭발 피해 +14%',
        ['광역 중력장', '끌어모으는 범위 +45% 및 폭발 범위 확장'],
        ['초중력 압착', '단일 보스에게 중력 압착 고정 피해 +85%'],
        ['블랙홀 연쇄', '압축 폭발 후 2차 충격파로 주변 적 기절'],
        ['시공간 파열', '압착된 적에게 치명타 피해 +110% 적용']
      ),
      3: makeSkill(
        'wizard', 'physical', 3, '차원 칼날 난무',
        '공간 균열에서 무수한 환영 검이 소환되어 주변 적을 초고속 난도질합니다.',
        '시너지: [염동력 구체]·[중력 왜곡] Lv당 환영 검 수 +1, 피해 +10%',
        ['무한 검제', '소환 환영 검 +6자루 및 광역 관통 베기'],
        ['차원 일점사', '모든 환영 검이 보스 1체에 집중 쇄도 (2.2×)'],
        ['균열 폭풍', '환영 검 적중마다 물리 충격파 추가 방출'],
        ['절대 참격', '차원 칼날 치명 확률 +40% 및 출혈 중첩']
      ),
    },
  },

  warrior: {
    fire: {
      1: makeSkill(
        'warrior', 'fire', 1, '용암의 도끼',
        '전방 부채꼴 범위로 뜨거운 화염 참격을 휘둘러 적을 베고 화상을 입힙니다.',
        '시너지: Lv당 [열기 축적]·[화산 폭발] 화염 피해 +12%',
        ['대선풍 참격', '부채꼴 각도 360도 회전 및 범위 +35%'],
        ['용암 양단', '정면 단일 대상 화염 치명 피해 +85%'],
        ['불꽃 연격', '참격 시 3갈래 용암 파동 전방 추가 발사'],
        ['심판의 도끼', '분노 50% 이상 시 보스 대상 2.3× 일격']
      ),
      2: makeSkill(
        'warrior', 'fire', 2, '열기 축적',
        '피격되거나 적을 타격할 때마다 몸에서 뜨거운 화염 파동을 방출합니다.',
        '시너지: [용암의 도끼] Lv당 화염 파동 범위 +8%, 피해 +12%',
        ['과열 노바', '화염 파동 반경 +45% 및 분노 획득량 +50%'],
        ['용광로 심장', '근접 단일 적에게 집중 열폭발 피해 +80%'],
        ['연쇄 폭발열', '파동 적중 적 처치 시 추가 화염 파동 유발'],
        ['불멸의 화로', '파동 발동 시 최대 체력 3% 회복 + 보스 극딜']
      ),
      3: makeSkill(
        'warrior', 'fire', 3, '화산 폭발',
        '이동 경로마다 지면이 갈라지며 뜨거운 용암 기둥이 연쇄 분출합니다.',
        '시너지: [용암의 도끼]·[열기 축적] Lv당 용암 기둥 수·피해 +12%',
        ['대지 균열', '용암 분출 간격 단축 및 폭발 반경 +40%'],
        ['마그마 분화구', '보스 발밑에 거대 용암 기둥 3연속 직격'],
        ['칼데라 대폭발', '분노 최대 도달 시 화면 전체 용암 폭우'],
        ['행성 핵 붕괴', '보스 대상 화염 방어 무시 2.5× 용암 강타']
      ),
    },
    ice: {
      1: makeSkill(
        'warrior', 'ice', 1, '빙하 강타',
        '지면을 강하게 내리쳐 전방에 날카로운 얼음 가시 지대를 생성합니다.',
        '시너지: Lv당 [서리 갑옷] 방어·[빙벽 돌진] 피해 +12%',
        ['빙하 지진', '얼음 가시 폭 +45% 및 3방향 동시 솟구침'],
        ['송곳니 강타', '전방 일직선 보스 대상 빙결 관통 폭딜 +80%'],
        ['만년 빙산', '얼음 가시가 터지며 사방으로 빙결 파편 발사'],
        ['절대 분쇄타', '빙결된 적 강타 시 치명타 확정 2.2×']
      ),
      2: makeSkill(
        'warrior', 'ice', 2, '서리 갑옷',
        '피격 시 공격자를 즉시 빙결시키고 워리어의 방어력을 크게 상승시킵니다.',
        '시너지: [빙하 강타] Lv당 추가 방어력 +2, 반격 피해 +12%',
        ['혹한 외피', '피격 시 주변 전체 빙결 반격파 방출'],
        ['강철 빙갑', '방어력 추가 +12 및 근접 반격 피해 2배'],
        ['얼음 가시갑옷', '이동 중 닿는 적에게도 자동 빙결 가시 반사'],
        ['불굴의 빙벽', '보스 공격 피격 시 피해 30% 추가 경감+극한 반격']
      ),
      3: makeSkill(
        'warrior', 'ice', 3, '빙벽 돌진',
        '얼음 방패를 두르고 돌진하며 경로의 적을 얼리고 빙결된 일반 적을 즉사시킵니다.',
        '시너지: [빙하 강타]·[서리 갑옷] Lv당 돌진 폭·보스 파쇄 피해 +12%',
        ['빙하 전차', '돌진 폭 +50% 및 경로 양옆 얼음 파편 폭격'],
        ['빙산 분쇄기', '빙결된 보스 충돌 시 최대체력 비례 대파쇄'],
        ['절대 빙벽', '돌진 종료 시 전방위 초대형 빙결 충격파'],
        ['처형 돌격', '체력 35% 이하 빙결 엘리트까지 즉사·보스 2.4×']
      ),
    },
    lightning: {
      1: makeSkill(
        'warrior', 'lightning', 1, '번개 망토',
        '0.5초마다 주변 적에게 자동으로 고압 번개 스파크를 방출합니다.',
        '시너지: Lv당 [과충전 도약] 가속·[뇌전 일섬] 피해 +12%',
        ['폭풍 외투', '스파크 동시 타격 수 +3명 및 반경 +35%'],
        ['고압 방전', '가장 가까운 적 1체에 스파크 2.2× 집중 낙뢰'],
        ['뇌전 장막', '스파크 적중 시 인접 적 2명에게 추가 연쇄'],
        ['초전도 코일', '보스 근접 시 0.25초마다 연속 고압 방전']
      ),
      2: makeSkill(
        'warrior', 'lightning', 2, '과충전 도약',
        '이동 속도가 빠를수록 공격 속도와 번개 방출 빈도가 크게 증가합니다.',
        '시너지: [번개 망토] Lv당 이동·공격 가속 보너스 +8%',
        ['전격 질주', '이동 속도 +18% 및 질주 중 전기 잔상 폭발'],
        ['과부하 일격', '최고 속도 도달 시 다음 공격 2.1× 전격 치명'],
        ['광속 충전', '대시 쿨타임 -35% 및 대시 시 연쇄 번개 방출'],
        ['뇌신의 맥박', '분노 비례 공격 속도·번개 빈도 극한 증폭']
      ),
      3: makeSkill(
        'warrior', 'lightning', 3, '뇌전 일섬',
        '전방의 적들 사이를 초고속으로 순간이동하며 연속 뇌전 참격을 가합니다.',
        '시너지: [번개 망토]·[과충전 도약] Lv당 참격 횟수·피해 +12%',
        ['천뢰 난무', '순간이동 참격 대상 +5명 및 광역 감전'],
        ['일점 뇌섬', '보스 1체를 6연속 초고속 집중 베기 (2.3×)'],
        ['번개 분신', '이동 경로마다 전기 잔상이 남아 2차 폭발'],
        ['신속 참수', '뇌전 일섬 전체 타격 치명타 확정 + 기절']
      ),
    },
    poison: {
      1: makeSkill(
        'warrior', 'poison', 1, '부식성 무기',
        '공격 시 적의 방어력을 깎고 받는 피해를 증가시키는 부식 독을 중첩합니다.',
        '시너지: Lv당 [독혈 흡수] 회복·[역병의 화신] 피해 +12%',
        ['산성 분무', '공격 시 전방 부채꼴로 부식 산성액 살포'],
        ['갑옷 용해', '단일 대상 방어력 감소 최대 +45% (보스 극딜)'],
        ['맹독 도포', '모든 스킬 공격이 부식 독 2중첩 동시 부여'],
        ['심층 부식', '최대 부식 적 타격 시 추가 고정 물리+독 피해']
      ),
      2: makeSkill(
        'warrior', 'poison', 2, '독혈 흡수',
        '독에 걸린 적을 처치하면 체력을 회복하고 주변으로 독가시를 발사합니다.',
        '시너지: [부식성 무기] Lv당 독가시 수 +1, 피해 +12%',
        ['가시 폭풍', '독가시 발사 수 +5개 및 관통 효과 추가'],
        ['혈독 포식', '독 적 타격 시에도 일정 확률로 체력 회복+강독'],
        ['역병 수확', '처치 시 회복량 2배 및 독 웅덩이 추가 생성'],
        ['불사의 독혈', '보스전 중 중독 타격마다 흡혈+독가시 집중']
      ),
      3: makeSkill(
        'warrior', 'poison', 3, '역병의 화신',
        '캐릭터 주변에 거대한 독성 오러를 두르고 닿는 모든 적을 빠르게 녹입니다.',
        '시너지: [부식성 무기]·[독혈 흡수] Lv당 오러 반경 +8%, 피해 +12%',
        ['부패의 군주', '독성 오러 반경 +45% 및 적 둔화 부여'],
        ['농축 맹독핵', '근접 보스에게 초당 맹독 융해 피해 2.3×'],
        ['역병 폭발', '오러 내부 적 처치 시 독구름 연쇄 폭발'],
        ['절대 용해', '오러 내 적 방어력 무력화 + 지속 치명 독']
      ),
    },
    physical: {
      1: makeSkill(
        'warrior', 'physical', 1, '대지 분쇄',
        '거대한 망치/검기를 강하게 휘둘러 적을 멀리 넉백시키고 큰 피해를 줍니다.',
        '시너지: Lv당 [충격파 반사] 충돌 피해 +15%, [전장의 폭군] 피해 +10%',
        ['지진 해머', '휘두르기 반경 +40% 및 지면 균열 충격파'],
        ['분쇄 일격', '단일 보스 강타 피해 +85% 및 넉백 충격 보너스'],
        ['대지 파열', '3방향 지진파가 전방으로 뻗어나가며 넉백'],
        ['거인의 파쇄', '분노 소모 시 치명타 확정 2.4× 대지 일격']
      ),
      2: makeSkill(
        'warrior', 'physical', 2, '충격파 반사',
        '밀려난 적이 다른 적과 부딪히면 연쇄 스턴과 추가 광역 충돌 피해를 유발합니다.',
        '시너지: [대지 분쇄] Lv당 연쇄 충돌 피해 +15%',
        ['도미노 붕괴', '충돌 폭발 반경 +45% 및 2차 연쇄 밀치기'],
        ['파괴 충격', '보스·엘리트에게 넉백 저항 시 대신 2배 충격 피해'],
        ['충격 공명', '스턴된 적에게 모든 피해 +40% 증폭'],
        ['분쇄 반향', '충돌 발생 시 분노 즉시 +25 회복 및 충격파']
      ),
      3: makeSkill(
        'warrior', 'physical', 3, '전장의 폭군',
        '워리어의 크기와 공격 범위가 2배로 거대화되며 닿는 모든 적 투사체를 파괴합니다.',
        '시너지: [대지 분쇄]·[충격파 반사] Lv당 거대화 피해 +12%',
        ['불멸의 거인', '거대화 범위 추가 +30% 및 주변 지속 진동파'],
        ['패왕의 일격', '거대화 중 단일 보스 대상 공격력 2.2×'],
        ['투사체 반사', '파괴한 적 투사체를 충격파로 되돌려 반격'],
        ['전장의 지배자', '거대화 유지 시간 극대화 + 방어력 2배 증폭']
      ),
    },
  },

  archer: {
    fire: {
      1: makeSkill(
        'archer', 'fire', 1, '소이탄 화살',
        '적중 위치에 타오르는 화염 웅덩이를 생성해 지속 화염 피해와 화상을 입힙니다.',
        '시너지: Lv당 [집속 폭약] 폭발 +12%, [유성 화살비] 범위 +8%',
        ['대화재 장판', '화염 웅덩이 반경 +40% 및 지속시간 +2초'],
        ['네이팜 직격', '직격 피해 +75% 및 웅덩이 중심부 화상 2배'],
        ['연소 연발', '한 번에 소이탄 화살 2발 동시 발사'],
        ['백린탄 화살', '보스 적중 시 방어 관통 고열 화상 2.2×']
      ),
      2: makeSkill(
        'archer', 'fire', 2, '집속 폭약',
        '소이탄 화살이 적중 시 3갈래 자탄으로 분열되어 각각 폭발합니다.',
        '시너지: [소이탄 화살] Lv당 자탄 폭발 피해 +12%',
        ['다연장 집속탄', '분열 자탄 +3발(총 6갈래) 및 폭발 범위 확장'],
        ['집중 성형작약', '모든 자탄이 최초 대상에게 집중 다중 폭발'],
        ['2차 집속', '자탄 폭발 위치에도 미니 화염 웅덩이 생성'],
        ['열압력 폭탄', '치명타 적중 시 자탄 피해 2.3× 증폭']
      ),
      3: makeSkill(
        'archer', 'fire', 3, '유성 화살비',
        '표식이 새겨진 적 머리 위로 하늘에서 불화살 폭격을 쏟아붓습니다.',
        '시너지: [소이탄 화살]·[집속 폭약] Lv당 폭격 화살 수 +2, 피해 +10%',
        ['초토화 폭격', '폭격 범위 +45% 및 불화살 +8발 추가 낙하'],
        ['정밀 화력집중', '보스 1체에 모든 불화살 집중 폭격 (2.3×)'],
        ['화염 장막비', '화살비 지역 전체가 거대 화염 지대로 변화'],
        ['심판의 화살비', '표식 폭발 시 치명타 확정 + 최대체력 비례 화염']
      ),
    },
    ice: {
      1: makeSkill(
        'archer', 'ice', 1, '서리 송곳',
        '적을 관통하며 이동속도를 크게 늦추는 날카로운 얼음 화살을 발사합니다.',
        '시너지: Lv당 [다중 도탄] 도탄 피해 +12%, [만년설 폭풍] 반경 +8%',
        ['관통 서리창', '관통 횟수 +4 및 화살 폭 +35% 확장'],
        ['빙결 저격', '원거리 단일 대상 피해 +80% 및 빙결 강화'],
        ['3연 서리송곳', '부채꼴 3발 동시 관통 사격'],
        ['절대 관통촉', '보스 적중 시 빙결 취약 표식 +40% 피해 증가']
      ),
      2: makeSkill(
        'archer', 'ice', 2, '다중 도탄',
        '빙결된 적에게 화살이 명중하면 주변 적에게 빠르게 도탄되며 빙결을 퍼뜨립니다.',
        '시너지: [서리 송곳] Lv당 도탄 피해 +12%, 도탄 횟수 증가',
        ['무한 빙정 도탄', '도탄 횟수 +4회 및 탐색 거리 +45%'],
        ['이중 반사 저격', '주변 적이 없으면 동일 대상에게 재도탄(2×)'],
        ['파쇄 도탄', '도탄마다 작은 얼음 파편 3개 추가 비산'],
        ['치명 도탄', '도탄될 때마다 치명타 확률 +20% 누적']
      ),
      3: makeSkill(
        'archer', 'ice', 3, '만년설 폭풍',
        '화살이 꽂힌 자리에 거대한 빙결 회오리를 생성해 적을 얼리고 갈아버립니다.',
        '시너지: [서리 송곳]·[다중 도탄] Lv당 회오리 지속·피해 +12%',
        ['쌍둥이 눈보라', '빙결 회오리 동시 2개 소환 및 범위 +40%'],
        ['극한 빙결 소용돌이', '보스 발밑 고정 추적 회오리 (피해 2.2×)'],
        ['눈사태 회오리', '회오리가 주변 적을 중심으로 흡인하며 둔화'],
        ['절대영도 폭풍', '회오리 내 빙결 적에게 치명 피해 +120%']
      ),
    },
    lightning: {
      1: makeSkill(
        'archer', 'lightning', 1, '전격 화살',
        '매우 빠른 탄속의 직선 레이저형 전격 화살을 발사해 즉각 관통 타격합니다.',
        '시너지: Lv당 [피뢰침 표식] 낙뢰 +12%, [전자기 레일건] 피해 +12%',
        ['광속 연사', '전격 화살 2연발 및 발사 쿨타임 -20%'],
        ['고전압 탄두', '직선 단일 타격 피해 +80% 및 치명타 보정'],
        ['전격 확산선', '적중 시 양옆으로 번개 스파크 2줄기 방출'],
        ['과전압 저격', '원거리 보스 적중 시 낙뢰 추가 유발 (2.1×)']
      ),
      2: makeSkill(
        'archer', 'lightning', 2, '피뢰침 표식',
        '화살에 3회 피격된 적에게 하늘에서 강력한 낙뢰가 떨어져 감전시킵니다.',
        '시너지: [전격 화살] Lv당 낙뢰 피해 +14%',
        ['연쇄 피뢰침', '낙뢰 적중 시 주변 4명에게 번개 추가 전이'],
        ['이중 낙뢰', '2회 피격마다 발동으로 단축 + 단일 낙뢰 2×'],
        ['폭풍 표식', '낙뢰 지점에 감전 충격파 폭발 추가'],
        ['천벌의 피뢰침', '보스 대상 낙뢰 치명타 확정 + 방어 무시']
      ),
      3: makeSkill(
        'archer', 'lightning', 3, '전자기 레일건',
        '화면 끝까지 닿는 거대한 전격 빔을 발사해 경로상의 모든 적을 증발시킵니다.',
        '시너지: [전격 화살]·[피뢰침 표식] Lv당 빔 폭·피해 +12%',
        ['광폭 전자포', '레일건 빔 폭 2배 확장 및 쿨타임 -20%'],
        ['과충전 레일건', '단일 보스 관통 시 2.5× 초고압 치명 피해'],
        ['이중 위상 빔', '교차하는 2줄기 레일건 빔 동시 발사'],
        ['궤도 포격 빔', '빔 경로 모든 표식 적에게 연쇄 낙뢰 폭격']
      ),
    },
    poison: {
      1: makeSkill(
        'archer', 'poison', 1, '독침 연사',
        '전방 부채꼴로 5발의 얇은 독침을 빠르게 발사해 독 중첩을 쌓습니다.',
        '시너지: Lv당 [신경 독소]·[맹독 꽃봉오리] 피해 +12%',
        ['부채꼴 폭우', '독침 발사 수 +4발(총 9발) 및 관통 +1'],
        ['집중 독침사격', '5발이 좁은 각도로 단일 보스 집중 명중 (+70%)'],
        ['연속 속사', '독침 연사 쿨타임 -30% 및 이동속도 소폭 상승'],
        ['치명 맹독침', '독침 치명타 시 독 중첩 3배 즉시 누적']
      ),
      2: makeSkill(
        'archer', 'poison', 2, '신경 독소',
        '독에 걸린 적이 혼란 상태에 빠져 서로를 공격하게 만듭니다.',
        '시너지: [독침 연사] Lv당 혼란 지속·자해 피해 +12%',
        ['집단 광기', '혼란 전파 범위 +50% 및 적 상호 피해 2배'],
        ['신경 붕괴', '보스·면역 대상은 혼란 대신 받는 피해 +45%'],
        ['환각 포자', '혼란된 적이 처치되면 주변 적도 즉시 혼란'],
        ['치사 신경독', '혼란 지속 중 매초 중독 폭발 추가 피해']
      ),
      3: makeSkill(
        'archer', 'poison', 3, '맹독 꽃봉오리',
        '적의 몸속에서 독초가 자라나 폭발하며 사방으로 맹독 씨앗을 살포합니다.',
        '시너지: [독침 연사]·[신경 독소] Lv당 씨앗 수 +1, 폭발 피해 +12%',
        ['만개한 독원', '폭발 시 살포 씨앗 +5개 및 2차 독 장판 생성'],
        ['기생 거대독초', '보스 체내 독초 폭발 피해 2.4× 집중'],
        ['연쇄 개화', '씨앗에 맞은 적에게 즉시 새 꽃봉오리 착상'],
        ['절대 맹독화', '폭발 시 중첩된 모든 독 피해를 한꺼번에 정산']
      ),
    },
    physical: {
      1: makeSkill(
        'archer', 'physical', 1, '관통 강철화살',
        '일직선상의 모든 적을 꿰뚫고 지나가는 묵직한 강철 화살을 발사합니다.',
        '시너지: Lv당 [약점 포착] 출혈 +12%, [천공의 일격] 피해 +12%',
        ['이중 강철시위', '관통 화살 2발 나란히 발사 및 넉백 강화'],
        ['철갑 파쇄촉', '관통할수록 피해 증가 + 단일 보스 +85%'],
        ['강철 연발포', '쿨타임 -25% 및 관통마다 충격파 발생'],
        ['절대 관통격', '원거리 치명타 피해 +120% 초강력 저격']
      ),
      2: makeSkill(
        'archer', 'physical', 2, '약점 포착',
        '치명타 확률을 대폭 증가시키고 치명타 적중 시 깊은 출혈을 유발합니다.',
        '시너지: [관통 강철화살] Lv당 출혈 도트 피해 +14%',
        ['급소 난사', '치명타 적중 시 주변 적에게도 출혈 파편 확산'],
        ['심장 저격', '치명타 확률 추가 +15% 및 보스 출혈 2.2×'],
        ['선혈의 사냥꾼', '출혈 적 처치 시 콤보 +3 및 공속 일시 급증'],
        ['처형자의 눈', '치명타 배율 1.65× → 2.35×로 대폭 강화']
      ),
      3: makeSkill(
        'archer', 'physical', 3, '천공의 일격',
        '화면을 가르는 초거대 화살을 발사해 경로상의 모든 적을 소멸시킵니다.',
        '시너지: [관통 강철화살]·[약점 포착] Lv당 화살 폭·피해 +12%',
        ['천지 개벽', '초거대 화살 폭 +55% 및 양옆 충격파 동반'],
        ['신살의 화살', '보스 적중 시 치명타 확정 2.6× 관통 극딜'],
        ['쌍성 천공격', '전후방 양방향으로 초거대 화살 동시 발사'],
        ['종말의 저격', '체력 30% 이하 일반 적 즉사·보스 출혈 폭발']
      ),
    },
  },
};

export interface HybridFusionDef {
  id: HybridFusionId;
  name: string;
  englishName: string;
  reqA: SkillAttribute;
  reqB: SkillAttribute;
  color: string;
  summary: string;
}

export const HYBRID_FUSION_CATALOG: readonly HybridFusionDef[] = [
  {
    id: 'thermal_shock',
    name: '열충격',
    englishName: 'Thermal Shock',
    reqA: 'fire',
    reqB: 'ice',
    color: '#f472b6',
    summary: '빙결된 적에게 화염 피해를 주면 얼음이 즉시 녹으며 최대 체력의 15% 고정 피해 (보스 5%)',
  },
  {
    id: 'acid_overload',
    name: '산성 과부하',
    englishName: 'Acid Overload',
    reqA: 'lightning',
    reqB: 'poison',
    color: '#a3e635',
    summary: '중독된 적이나 독 구름에 번개가 닿으면 구름 전체가 폭발하며 광역 감전 유발',
  },
  {
    id: 'shatter_impact',
    name: '파쇄 충격',
    englishName: 'Shatter Impact',
    reqA: 'ice',
    reqB: 'physical',
    color: '#67e8f9',
    summary: '빙결된 적에게 물리 치명타·넉백 시 빙결 충격파가 터져 광역 추가 파쇄 피해',
  },
  {
    id: 'blaze_strike',
    name: '작열 강타',
    englishName: 'Blaze Strike',
    reqA: 'fire',
    reqB: 'physical',
    color: '#fbbf24',
    summary: '물리 치명타 또는 넉백 충돌 발생 시 폭발성 화염 충격파로 주변 적을 연소',
  },
] as const;

export function createInitialClassSkillTree(): ClassSkillTreeState {
  const mkAttr = () => ({
    1: { level: 0, mut5: null, mut10: null },
    2: { level: 0, mut5: null, mut10: null },
    3: { level: 0, mut5: null, mut10: null },
  });
  return {
    fire: mkAttr(),
    ice: mkAttr(),
    lightning: mkAttr(),
    poison: mkAttr(),
    physical: mkAttr(),
  };
}

export function cloneClassSkillTree(tree: ClassSkillTreeState): ClassSkillTreeState {
  const out = createInitialClassSkillTree();
  for (const attr of ALL_SKILL_ATTRIBUTES) {
    for (const tier of ALL_SKILL_TIERS) {
      out[attr][tier] = { ...tree[attr][tier] };
    }
  }
  return out;
}

export function canUpgradeClassSkill(
  tree: ClassSkillTreeState,
  attribute: SkillAttribute,
  tier: SkillTier,
  skillPoints: number
): boolean {
  if (skillPoints <= 0) return false;
  const node = tree[attribute][tier];
  if (node.level >= MAX_CLASS_SKILL_LEVEL) return false;
  if (tier === 2 && tree[attribute][1].level < 1) return false;
  if (tier === 3 && tree[attribute][2].level < 1) return false;
  return true;
}

export function getSkillSynergyMultiplier(
  tree: ClassSkillTreeState,
  attribute: SkillAttribute,
  tier: SkillTier
): { dmgMult: number; areaMult: number; bonusCount: number; summaryPct: number } {
  const t1 = tree[attribute][1].level;
  const t2 = tree[attribute][2].level;
  if (tier === 1) {
    return { dmgMult: 1, areaMult: 1, bonusCount: 0, summaryPct: 0 };
  }
  if (tier === 2) {
    const pct = t1 * 12;
    return {
      dmgMult: 1 + pct / 100,
      areaMult: 1 + t1 * 0.06,
      bonusCount: Math.floor(t1 / 2),
      summaryPct: pct,
    };
  }
  const pct = t1 * 10 + t2 * 10;
  return {
    dmgMult: 1 + pct / 100,
    areaMult: 1 + t1 * 0.1 + t2 * 0.05,
    bonusCount: Math.floor((t1 + t2) / 3),
    summaryPct: pct,
  };
}

export function hasTier2OrHigher(tree: ClassSkillTreeState, attribute: SkillAttribute): boolean {
  return tree[attribute][2].level >= 1 || tree[attribute][3].level >= 1;
}

export function getActiveHybridFusions(tree: ClassSkillTreeState): HybridFusionId[] {
  const active: HybridFusionId[] = [];
  for (const fusion of HYBRID_FUSION_CATALOG) {
    if (hasTier2OrHigher(tree, fusion.reqA) && hasTier2OrHigher(tree, fusion.reqB)) {
      active.push(fusion.id);
    }
  }
  return active;
}

export function getTotalClassSkillPointsSpent(tree: ClassSkillTreeState): number {
  let total = 0;
  for (const attr of ALL_SKILL_ATTRIBUTES) {
    for (const tier of ALL_SKILL_TIERS) {
      total += tree[attr][tier].level;
    }
  }
  return total;
}

export function getAttributeInvestedPoints(
  tree: ClassSkillTreeState,
  attribute: SkillAttribute
): number {
  return tree[attribute][1].level + tree[attribute][2].level + tree[attribute][3].level;
}
