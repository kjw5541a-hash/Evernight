import {
  ALL_ELEMENTS,
  ALL_GEAR_SLOTS,
  ALL_WEAPON_IDS,
  BIOME_CATALOG,
  BOSS_META,
  ELEMENT_CATALOG,
  ELITE_AFFIXES,
  GEAR_BASE_NAMES,
  GEAR_NAME_PREFIXES,
  GEAR_RARITY_META,
  ITEM_DROP_RATE_CHEST,
  ITEM_DROP_RATE_ELITE,
  ITEM_DROP_RATE_GOLDEN_CHEST,
  MAX_ELEMENT_BRANCH_LEVEL,
  MAX_GEAR_UPGRADE_LEVEL,
  MAX_WAVES,
  MERCHANT_DURATION_SEC,
  MERCHANT_GEAR_CATALOG,
  MERCHANT_SPAWN_TRAVEL_SEC,
  RARITY_DROP_WEIGHTS,
  SKILL_UPGRADE_XP_COSTS,
  WAVE_CONFIGS,
  WAVE_DURATION_SEC,
  WEAPON_CATALOG,
  getChosenElement,
  getElementAffinity,
  getElementAreaValue,
  getElementAttackPower,
  getEnemyElement,
  getMerchantUpgradeCost,
} from './catalog';
import {
  onClassEnemyDamaged,
  onClassEnemyKilled,
  onClassPlayerHurt,
  onClassProjectileHit,
  updateClassSkillsAndZones,
  type ClassCombatHooks,
} from './classCombat';
import {
  ATTRIBUTE_META,
  CLASS_SKILL_CATALOG,
  HERO_BASIC_WEAPON_CONFIG,
  HERO_CLASS_CATALOG,
  HYBRID_FUSION_CATALOG,
  canUpgradeClassSkill,
  cloneClassSkillTree,
  createInitialClassSkillTree,
  getActiveHybridFusions,
  getTotalClassSkillPointsSpent,
} from './classSkills';
import type {
  Afterimage,
  BiomeId,
  BossKind,
  ElementBranch,
  ElementId,
  ElementSkillTree,
  Enemy,
  EnemyKind,
  EquipmentSlots,
  FloatingText,
  GearItem,
  GearRarity,
  GearSkill,
  GearSlot,
  GearStats,
  GroundDecal,
  GroundDecalKind,
  HeroClassId,
  HeroComputedStats,
  HudSnapshot,
  ImpactBurst,
  ImpactBurstKind,
  InputState,
  LegendaryEffectId,
  LootDrop,
  MerchantGearLevels,
  MerchantGearSlot,
  MutationChoice,
  Particle,
  ParticleShape,
  Pickup,
  PixelShard,
  PlayerState,
  PoisonWell,
  RunSummary,
  SkillAttribute,
  SkillTier,
  SoundEvent,
  StatusEffectKind,
  WeaponId,
  WorldChest,
  WorldState,
} from './types';

export const CHUNK_SIZE = 760;
const PARTICLE_POOL_SIZE = 200;
const PIXEL_SHARD_POOL_SIZE = 240;
const IMPACT_BURST_POOL_SIZE = 56;
const AFTERIMAGE_POOL_SIZE = 16;
const GROUND_DECAL_POOL_SIZE = 40;
const FLOATING_TEXT_POOL_SIZE = 34;
export const MAX_PICKUPS = 80;
export const MAX_LOOT_DROPS = 14;

const ENEMY_PIXEL_PALETTES: Record<EnemyKind, readonly string[]> = {
  skeleton: ['#f1f5f9', '#cbd5e1', '#94a3b8', '#475569'],
  imp: ['#ef4444', '#fb923c', '#fde047', '#991b1b'],
  charger: ['#94a3b8', '#dc2626', '#475569', '#f59e0b'],
  bat: ['#a855f7', '#c084fc', '#f43f5e', '#4c1d95'],
  boss_behemoth: ['#ef4444', '#94a3b8', '#fb923c', '#facc15'],
  boss_pyrolord: ['#fb923c', '#fde047', '#dc2626', '#57534e'],
  boss_frostqueen: ['#38bdf8', '#e0f2fe', '#0284c7', '#818cf8'],
  lich_boss: ['#fbbf24', '#c084fc', '#e2e8f0', '#6d28d9'],
};

// O(1) swap-and-pop removal avoids O(N) array shifting inside hot 60fps loops
function swapRemove<T>(arr: T[], index: number): void {
  const last = arr.length - 1;
  if (index !== last) {
    arr[index] = arr[last];
  }
  arr.pop();
}

// Infinite-coordinate Spatial Hash Grid with pooled bucket arrays (zero per-frame GC, rebuilt 1x/frame)
const GRID_CELL_SIZE = 64;

class InfiniteSpatialGrid {
  private buckets = new Map<number, number[]>();
  private pool: number[][] = [];
  private activeKeys: number[] = [];

  private hashKey(cx: number, cy: number): number {
    return ((cx + 32768) << 16) | ((cy + 32768) & 0xffff);
  }

  public clear(): void {
    for (let i = 0; i < this.activeKeys.length; i++) {
      const key = this.activeKeys[i];
      const bucket = this.buckets.get(key);
      if (bucket) {
        bucket.length = 0;
        this.pool.push(bucket);
      }
    }
    this.buckets.clear();
    this.activeKeys.length = 0;
  }

  public insert(enemyIndex: number, x: number, y: number): void {
    const cx = Math.floor(x / GRID_CELL_SIZE);
    const cy = Math.floor(y / GRID_CELL_SIZE);
    const key = this.hashKey(cx, cy);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = this.pool.pop() ?? [];
      this.buckets.set(key, bucket);
      this.activeKeys.push(key);
    }
    bucket.push(enemyIndex);
  }

  public forEachNeighbor(
    x: number,
    y: number,
    radiusCells: number,
    cb: (enemyIndex: number) => boolean | void
  ): void {
    const cx = Math.floor(x / GRID_CELL_SIZE);
    const cy = Math.floor(y / GRID_CELL_SIZE);
    for (let gy = cy - radiusCells; gy <= cy + radiusCells; gy++) {
      for (let gx = cx - radiusCells; gx <= cx + radiusCells; gx++) {
        const bucket = this.buckets.get(this.hashKey(gx, gy));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          if (cb(bucket[k]) === false) return;
        }
      }
    }
  }
}

const spatialGrid = new InfiniteSpatialGrid();

export function createEmptyInput(): InputState {
  return {
    keys: new Set<string>(),
    pointerActive: false,
    pointerWorldX: 0,
    pointerWorldY: 0,
    waypointActive: false,
    waypointX: 0,
    waypointY: 0,
    joyActive: false,
    joyX: 0,
    joyY: 0,
    dashJustPressed: false,
  };
}

export function nextRandom(world: WorldState): number {
  let t = (world.rngState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Slower, more immersive XP curve (~2.8x higher than early prototype) so level-ups feel impactful
export function xpForLevel(level: number): number {
  return Math.round(85 + (level - 1) * 62 + Math.pow(level - 1, 1.48) * 28);
}

export function computeGearPowerScore(
  stats: GearStats,
  attachedSkills: GearSkill[],
  legendaryEffect?: LegendaryEffectId
): number {
  let skillScore = 0;
  for (let i = 0; i < attachedSkills.length; i++) {
    skillScore += 18 + (attachedSkills[i].level - 1) * 14;
  }
  return Math.round(
    stats.atk * 2.6 +
      stats.def * 2.2 +
      stats.maxHp * 0.45 +
      stats.critChance * 2.8 +
      stats.atkSpeedPct * 1.6 +
      stats.moveSpeedPct * 1.2 +
      skillScore +
      (legendaryEffect ? 34 : 0)
  );
}

// 2x increased shard costs for gear upgrades (+0 -> +10)
export function getGearUpgradeCost(item: GearItem): number | null {
  if (item.upgradeLevel >= MAX_GEAR_UPGRADE_LEVEL) return null;
  const mult = item.rarity === 'legendary' ? 1.5 : item.rarity === 'epic' ? 1.25 : 1;
  return Math.round((4 + item.upgradeLevel * 4) * mult);
}

export function getSkillUpgradeCost(currentSkillLevel: number): number | null {
  return SKILL_UPGRADE_XP_COSTS[currentSkillLevel] ?? null;
}

export function getItemSalvageShards(item: GearItem): number {
  return GEAR_RARITY_META[item.rarity].salvageShards + item.upgradeLevel * 2;
}

export function getItemSalvageGold(item: GearItem): number {
  const baseByRarity =
    item.rarity === 'legendary' ? 75 : item.rarity === 'epic' ? 36 : item.rarity === 'rare' ? 18 : 8;
  return baseByRarity + Math.max(0, item.itemLevel - 1) * 2;
}

export function deriveWeaponsFromEquipment(equipment: EquipmentSlots): Partial<Record<WeaponId, number>> {
  const derived: Partial<Record<WeaponId, number>> = {};
  for (let i = 0; i < ALL_GEAR_SLOTS.length; i++) {
    const item = equipment[ALL_GEAR_SLOTS[i]];
    if (!item) continue;
    for (let s = 0; s < item.attachedSkills.length; s++) {
      const sk = item.attachedSkills[s];
      const prev = derived[sk.id] ?? 0;
      derived[sk.id] = Math.min(5, prev + sk.level);
    }
  }
  return derived;
}

export function createInitialMerchantGearLevels(): MerchantGearLevels {
  return {
    weapon: 0,
    helm: 0,
    armor: 0,
    gloves: 0,
    boots: 0,
  };
}

export function createInitialElementSkillTree(): ElementSkillTree {
  return {
    fire: { unlocked: false, powerLv: 0, areaLv: 0 },
    ice: { unlocked: false, powerLv: 0, areaLv: 0 },
    lightning: { unlocked: false, powerLv: 0, areaLv: 0 },
    poison: { unlocked: false, powerLv: 0, areaLv: 0 },
  };
}

export function computeElementalSkillDamage(player: PlayerState, element: ElementId): number {
  const weaponAtk = player.atk;
  const elementAtk = getElementAttackPower(player.elementTree, element);
  return Math.max(1, Math.round(weaponAtk + elementAtk));
}

export function computeEnemyCoinDrop(
  enemyLevel: number,
  isElite: boolean,
  isBoss: boolean
): { count: number; valuePerCoin: number; totalGold: number } {
  const lv = Math.max(1, Math.floor(enemyLevel));
  if (lv === 1 && !isElite && !isBoss) {
    return { count: 1, valuePerCoin: 1, totalGold: 1 };
  }
  const baseCount = lv <= 2 ? 1 : lv <= 4 ? 2 : lv <= 7 ? 3 : lv <= 11 ? 4 : 5;
  const count = baseCount + (isBoss ? 6 : isElite ? 2 : 0);
  const baseValue = Math.max(1, Math.round(1 + (lv - 1) * 0.9 + Math.floor(lv / 4)));
  const valuePerCoin = Math.max(1, Math.round(baseValue * (isBoss ? 2.4 : isElite ? 1.5 : 1)));
  return {
    count,
    valuePerCoin,
    totalGold: count * valuePerCoin,
  };
}

export function computeHeroStats(player: PlayerState): HeroComputedStats {
  const lv = player.level;
  const clsDef = HERO_CLASS_CATALOG[player.heroClass ?? 'wizard'];
  // Class-tuned base stats + gear + Merchant 5-slot upgrades + Diablo 2 Class Skill Tree
  let atk = 14 + clsDef.baseAtkMod + (lv - 1);
  let def = clsDef.baseDefMod; // Exact flat armor subtraction (monster ATK - DEF)
  let maxHp = 95 + clsDef.baseHpMod + (lv - 1) * 4;
  let critPct = 5 + clsDef.baseCritBonus;
  let atkSpeedPct = 0;
  let moveSpeedPct = 0;
  let hasCritNova = false;
  let hasLifeLeech = false;
  let hasDashStorm = false;
  let hasTreasureHunter = false;

  for (let i = 0; i < ALL_GEAR_SLOTS.length; i++) {
    const item = player.equipment[ALL_GEAR_SLOTS[i]];
    if (!item) continue;
    atk += item.stats.atk;
    def += item.stats.def;
    maxHp += item.stats.maxHp;
    critPct += item.stats.critChance;
    atkSpeedPct += item.stats.atkSpeedPct;
    moveSpeedPct += item.stats.moveSpeedPct;
    if (item.legendaryEffect === 'crit_nova') hasCritNova = true;
    if (item.legendaryEffect === 'life_leech') hasLifeLeech = true;
    if (item.legendaryEffect === 'dash_storm') hasDashStorm = true;
    if (item.legendaryEffect === 'treasure_hunter') hasTreasureHunter = true;
  }

  // Add Wandering Merchant 5-slot Gold Upgrade bonuses
  const mg = player.merchantGearLevels;
  if (mg) {
    atk += mg.weapon * MERCHANT_GEAR_CATALOG.weapon.perLevelValue;
    maxHp += mg.helm * MERCHANT_GEAR_CATALOG.helm.perLevelValue;
    def += mg.armor * MERCHANT_GEAR_CATALOG.armor.perLevelValue;
    atkSpeedPct += mg.gloves * MERCHANT_GEAR_CATALOG.gloves.perLevelValue;
    moveSpeedPct += mg.boots * MERCHANT_GEAR_CATALOG.boots.perLevelValue;
  }

  // Add Class Skill Tree Passive Stat Bonuses
  if (player.classSkills) {
    if (player.heroClass === 'warrior') {
      const frostArmor = player.classSkills.ice[2];
      if (frostArmor.level > 0) {
        def += 4 + frostArmor.level * 2 + player.classSkills.ice[1].level * 2 + (frostArmor.mut5 === 'B' ? 12 : 0);
      }
      const overdrive = player.classSkills.lightning[2];
      if (overdrive.level > 0) {
        atkSpeedPct += overdrive.level * 2;
        moveSpeedPct += overdrive.level * 2 + (overdrive.mut5 === 'A' ? 18 : 0);
      }
      if (player.tyrantTimer > 0) {
        atk += Math.round(atk * 0.25);
        if (player.classSkills.physical[3].mut10 === 'B') def *= 2;
      }
    } else if (player.heroClass === 'archer') {
      const weakSpot = player.classSkills.physical[2];
      if (weakSpot.level > 0) {
        critPct += 6 + weakSpot.level * 2.5 + (weakSpot.mut5 === 'B' ? 15 : 0);
      }
    }
  }

  const derivedWeapons = deriveWeaponsFromEquipment(player.equipment);
  let weaponLevels = 0;
  for (const wId of ALL_WEAPON_IDS) {
    weaponLevels += derivedWeapons[wId] ?? 0;
  }

  let elementTreeScore = 0;
  if (player.elementTree) {
    for (let i = 0; i < ALL_ELEMENTS.length; i++) {
      const node = player.elementTree[ALL_ELEMENTS[i]];
      if (node.unlocked) {
        elementTreeScore += 22 + node.powerLv * 14 + node.areaLv * 12;
      }
    }
  }
  const classSkillScore = player.classSkills
    ? getTotalClassSkillPointsSpent(player.classSkills) * 16 +
      getActiveHybridFusions(player.classSkills).length * 42
    : 0;

  const damageMult = Number((atk / 19).toFixed(3));
  // Cap attack-speed scaling so even maxed Lv.5 gear stays at ~50% of previous max fire rate
  const cappedAtkSpdPct = Math.min(47, atkSpeedPct);
  const totalAtkSpd = 1 + cappedAtkSpdPct / 100;
  const cooldownMult = Math.max(0.68, Number((1 / totalAtkSpd).toFixed(3)));
  const moveSpeed = Math.round((202 + clsDef.baseMoveSpeedMod) * (1 + moveSpeedPct / 100));
  const pickupRadius = 96;
  const critChance = Math.min(0.8, critPct / 100);
  const damageReduction = Math.min(0.48, (def * 1.55) / (100 + def * 1.55));

  const combatPower = Math.round(
    atk * 2.5 +
      def * 2.4 +
      maxHp * 0.42 +
      critPct * 2.6 +
      atkSpeedPct * 1.5 +
      moveSpeedPct * 1.1 +
      weaponLevels * 18 +
      elementTreeScore +
      classSkillScore
  );

  return {
    atk: Math.round(atk),
    def: Math.round(def),
    maxHp: Math.round(maxHp),
    damageMult,
    damageReduction,
    critChance,
    cooldownMult,
    moveSpeed,
    pickupRadius,
    combatPower,
    hasCritNova,
    hasLifeLeech,
    hasDashStorm,
    hasTreasureHunter,
  };
}

export function syncPlayerStats(world: WorldState, healDelta = true): HeroComputedStats {
  const p = world.player;
  const prevMaxHp = p.maxHp;
  const prevWeapons = p.weapons;
  const nextWeapons = deriveWeaponsFromEquipment(p.equipment);
  p.weapons = nextWeapons;

  // Trigger newly equipped skills promptly so weapon swaps feel immediate
  for (let i = 0; i < ALL_WEAPON_IDS.length; i++) {
    const wid = ALL_WEAPON_IDS[i];
    if ((nextWeapons[wid] ?? 0) > 0 && !(prevWeapons[wid] ?? 0)) {
      p.weaponTimers[wid] = Math.min(p.weaponTimers[wid] ?? 0.15, 0.15);
    }
  }

  const stats = computeHeroStats(p);
  p.atk = stats.atk;
  p.def = stats.def;
  p.maxHp = stats.maxHp;
  if (healDelta && p.maxHp > prevMaxHp) {
    p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMaxHp));
  } else {
    p.hp = Math.min(p.maxHp, p.hp);
  }
  p.critChance = stats.critChance;
  p.damageMult = stats.damageMult;
  p.cooldownMult = stats.cooldownMult;
  p.moveSpeed = stats.moveSpeed;
  p.pickupRadius = stats.pickupRadius;
  p.combatPower = stats.combatPower;
  return stats;
}

export function evaluateBiomeProgression(world: WorldState): boolean {
  const cp = world.player.combatPower;
  const lv = world.player.level;
  const wave = world.wave;

  let target: BiomeId = world.biomeIndex;
  const tiers: BiomeId[] = [1, 2, 3];
  for (let i = 0; i < tiers.length; i++) {
    const b = BIOME_CATALOG[tiers[i]];
    if (cp >= b.minCp || lv >= b.minLevel || wave >= b.minWave) {
      if (b.id > target) target = b.id;
    }
  }

  if (target > world.biomeIndex) {
    world.prevBiomeIndex = world.biomeIndex;
    world.biomeIndex = target;
    world.biomeBlend = 0;
    const def = BIOME_CATALOG[target];
    world.bannerText = `${def.name} 진입! · ${def.subtitle}`;
    world.bannerTimer = 3.4;
    world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.32);
    world.hudDirty = true;
    spawnImpactBurst(world, 'level_pillar', world.player.x, world.player.y, 0, 1.35, def.accent, 0.72);
    triggerScreenFlash(world, def.accent, 0.55);
    emitSound(world, 'biome');
    return true;
  }
  return false;
}

function createStarterWeapon(heroClass: HeroClassId = 'wizard'): GearItem {
  const cfg = HERO_BASIC_WEAPON_CONFIG[heroClass];
  const stats: GearStats = {
    atk: cfg.starterWeaponAtk,
    def: 0,
    maxHp: 0,
    critChance: 0,
    atkSpeedPct: cfg.starterWeaponAtkSpdPct,
    moveSpeedPct: 0,
  };
  const attachedSkills: GearSkill[] = [];
  return {
    id: 0,
    slot: 'weapon',
    rarity: 'normal',
    name: HERO_CLASS_CATALOG[heroClass].starterWeaponName,
    itemLevel: 1,
    upgradeLevel: 0,
    stats,
    attachedSkills,
    powerScore: computeGearPowerScore(stats, attachedSkills),
  };
}

function createInitialEquipment(heroClass: HeroClassId = 'wizard'): EquipmentSlots {
  return {
    weapon: createStarterWeapon(heroClass),
    armor: null,
    helm: null,
    accessory: null,
  };
}

function createInitialPlayer(heroClass: HeroClassId = 'wizard'): PlayerState {
  const equipment = createInitialEquipment(heroClass);
  const player: PlayerState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    aimAngle: 0,
    hp: 95,
    maxHp: 95,
    xp: 0,
    xpToNext: xpForLevel(1),
    skillXp: 0,
    level: 1,
    radius: 15,
    moveSpeed: 202,
    atk: 19,
    def: 0,
    critChance: 0.05,
    damageMult: 1,
    cooldownMult: 1,
    pickupRadius: 96,
    combatPower: 100,
    invulnTimer: 0,
    hitFlashTimer: 0,
    slowTimer: 0,
    burnTimer: 0,
    burnTickTimer: 0,
    poisonTimer: 0,
    poisonTickTimer: 0,
    statusVfxAccum: 0,
    strideDist: 0,
    scaleX: 1,
    scaleY: 1,
    dashCooldown: 0,
    dashMaxCooldown: 2.4,
    dashActiveTimer: 0,
    dashDirX: 1,
    dashDirY: 0,
    dashBufferTimer: 0,
    weapons: deriveWeaponsFromEquipment(equipment),
    relics: {},
    weaponTimers: {
      arcane_bolt: 0.2,
      orbit_blades: 0,
      chain_lightning: 0.4,
      ember_nova: 0.6,
      frost_lance: 0.35,
      holy_chakram: 0.5,
    },
    basicAttackTimer: 0.18,
    orbitAngle: 0,
    equipment,
    upgradeShards: 0,
    gold: 0,
    skillPoints: 0,
    merchantGearLevels: createInitialMerchantGearLevels(),
    elementTree: createInitialElementSkillTree(),
    elementTimers: {
      fire: 0.35,
      ice: 0.45,
      lightning: 0.55,
      poison: 0.65,
    },
    heroClass,
    classSkills: createInitialClassSkillTree(),
    classSkillTimers: {},
    rage: 0,
    maxRage: 100,
    comboCount: 0,
    comboTimer: 0,
    tyrantTimer: 0,
    kineticOrbitAngle: 0,
  };
  const stats = computeHeroStats(player);
  player.atk = stats.atk;
  player.def = stats.def;
  player.maxHp = stats.maxHp;
  player.hp = stats.maxHp;
  player.critChance = stats.critChance;
  player.damageMult = stats.damageMult;
  player.cooldownMult = stats.cooldownMult;
  player.moveSpeed = stats.moveSpeed;
  player.pickupRadius = stats.pickupRadius;
  player.combatPower = stats.combatPower;
  return player;
}

export function createInitialWorld(
  bestScore = 0,
  seed = 1337,
  heroClass: HeroClassId = 'wizard'
): WorldState {
  const particles: Particle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 3,
    color: '#ffffff',
    life: 0,
    maxLife: 0.3,
    gravity: 0,
    shape: 'square',
  }));

  const pixelShards: PixelShard[] = Array.from({ length: PIXEL_SHARD_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    groundY: 0,
    size: 4,
    color: '#cbd5e1',
    life: 0,
    maxLife: 0.7,
    rotation: 0,
    rotSpeed: 0,
    bounces: 0,
  }));

  const impactBursts: ImpactBurst[] = Array.from({ length: IMPACT_BURST_POOL_SIZE }, () => ({
    active: false,
    kind: 'hit_spark',
    x: 0,
    y: 0,
    angle: 0,
    size: 16,
    color: '#ffffff',
    life: 0,
    maxLife: 0.2,
  }));

  const afterimages: Afterimage[] = Array.from({ length: AFTERIMAGE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    facing: 1,
    color: '#fbbf24',
    life: 0,
    maxLife: 0.22,
    scale: 1,
  }));

  const groundDecals: GroundDecal[] = Array.from({ length: GROUND_DECAL_POOL_SIZE }, () => ({
    active: false,
    kind: 'scorch',
    x: 0,
    y: 0,
    radius: 18,
    color: '#1e1b18',
    life: 0,
    maxLife: 2.8,
    rotation: 0,
  }));

  const floatingTexts: FloatingText[] = Array.from({ length: FLOATING_TEXT_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vy: -40,
    text: '',
    color: '#ffffff',
    life: 0,
    maxLife: 0.6,
    scale: 1,
  }));

  return {
    phase: 'title',
    elapsed: 0,
    wave: 1,
    maxWaves: MAX_WAVES,
    kills: 0,
    score: 0,
    bestScore,
    nextEntityId: 1,
    hitstopTimer: 0,
    hitstopCooldown: 0,
    cameraX: 0,
    cameraY: 0,
    cameraTrauma: 0,
    spawnTimer: 0.65,
    bossSpawnedWaves: new Set<number>(),
    visitedChunks: new Set<string>(),
    biomeIndex: 0,
    prevBiomeIndex: 0,
    biomeBlend: 1,
    attackTokensUsed: 0,
    maxAttackTokens: 4,
    gemCombo: 0,
    gemComboTimer: 0,
    defeatDelayTimer: 0,
    pendingOutcome: null,
    bannerText: null,
    bannerTimer: 0,
    bossAlertTimer: 0,
    bossAlertMax: 3.8,
    bossAlertName: '',
    bossAlertSubtitle: '',
    bossAlertAccent: '#ef4444',
    bossAlertStage: 0,
    levelUpAnimTimer: 0,
    levelUpAnimMax: 2.6,
    levelUpAnimLevel: 1,
    player: createInitialPlayer(heroClass),
    enemies: [],
    chests: [],
    lootDrops: [],
    pendingLoot: null,
    projectiles: [],
    lightningArcs: [],
    novaRings: [],
    hazards: [],
    poisonWells: [],
    groundZones: [],
    pickups: [],
    torches: [],
    particles,
    particleCursor: 0,
    pixelShards,
    pixelShardCursor: 0,
    impactBursts,
    impactBurstCursor: 0,
    afterimages,
    afterimageCursor: 0,
    groundDecals,
    groundDecalCursor: 0,
    damageVignette: 0,
    screenFlashTimer: 0,
    screenFlashMax: 0.35,
    screenFlashColor: '#fde047',
    dashGhostAccum: 0,
    footstepDustAccum: 0,
    floatingTexts,
    floatingTextCursor: 0,
    merchant: {
      active: false,
      x: 0,
      y: 0,
      timer: 0,
      maxDuration: MERCHANT_DURATION_SEC,
      bobPhase: 0,
    },
    merchantCooldown: 22,
    merchantAlertTimer: 0,
    merchantAlertMax: 4.2,
    merchantReopenCooldown: 0,
    soundQueue: [],
    rngState: seed >>> 0 || 1337,
    hudDirty: true,
  };
}

// Exact rarity roll: Legendary 2% | Epic 10% | Rare 30% | Normal 58%
export function rollGearRarity(world: WorldState): GearRarity {
  const r = nextRandom(world);
  if (r < RARITY_DROP_WEIGHTS.legendary) return 'legendary';
  if (r < RARITY_DROP_WEIGHTS.legendary + RARITY_DROP_WEIGHTS.epic) return 'epic';
  if (r < RARITY_DROP_WEIGHTS.legendary + RARITY_DROP_WEIGHTS.epic + RARITY_DROP_WEIGHTS.rare) {
    return 'rare';
  }
  return 'normal';
}

function rollAttachedSkills(world: WorldState, slot: GearSlot, rarity: GearRarity): GearSkill[] {
  const count =
    slot === 'weapon'
      ? rarity === 'epic' || rarity === 'legendary'
        ? 2
        : 1
      : rarity === 'normal'
        ? 0
        : 1;

  if (count === 0) return [];
  const pool = [...ALL_WEAPON_IDS];
  const skills: GearSkill[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(nextRandom(world) * pool.length);
    const id = pool.splice(idx, 1)[0];
    skills.push({ id, level: 1 });
  }
  return skills;
}

export function generateGearItem(
  world: WorldState,
  _source: 'chest_wooden' | 'chest_golden' | 'elite' | 'boss',
  forcedSlot?: GearSlot,
  forcedRarity?: GearRarity
): GearItem {
  const slot: GearSlot =
    forcedSlot ?? ALL_GEAR_SLOTS[Math.floor(nextRandom(world) * ALL_GEAR_SLOTS.length)];

  const rarity: GearRarity = forcedRarity ?? rollGearRarity(world);
  const rarityMeta = GEAR_RARITY_META[rarity];
  const itemLevel = Math.max(1, world.wave + Math.floor((world.player.level - 1) * 0.4));
  const scale = (1 + (itemLevel - 1) * 0.14) * rarityMeta.statMult * (0.92 + nextRandom(world) * 0.18);

  const stats: GearStats = {
    atk: 0,
    def: 0,
    maxHp: 0,
    critChance: 0,
    atkSpeedPct: 0,
    moveSpeedPct: 0,
  };

  if (slot === 'weapon') {
    stats.atk = Math.max(5, Math.round(7.5 * scale));
    if (rarity !== 'normal') {
      stats.critChance = Math.max(2, Math.round(2.4 * rarityMeta.statMult + nextRandom(world) * 2.5));
    }
    if (rarity === 'epic' || rarity === 'legendary') {
      stats.atkSpeedPct = Math.max(4, Math.round(3.8 * rarityMeta.statMult + nextRandom(world) * 4));
    }
  } else if (slot === 'armor') {
    stats.def = Math.max(2, Math.round(2.4 * scale));
    stats.maxHp = Math.max(12, Math.round(18 * scale));
    if (rarity === 'epic' || rarity === 'legendary') {
      stats.moveSpeedPct = Math.round(3 + rarityMeta.statMult * 2.2);
    }
  } else if (slot === 'helm') {
    stats.def = Math.max(1, Math.round(1.4 * scale));
    stats.maxHp = Math.max(12, Math.round(15 * scale));
    if (rarity !== 'normal') {
      stats.critChance = Math.max(2, Math.round(2.0 * rarityMeta.statMult + nextRandom(world) * 2.5));
    }
    if (rarity === 'legendary') {
      stats.atk = Math.round(2.8 * scale);
    }
  } else {
    // accessory
    stats.atk = Math.max(3, Math.round(5.0 * scale));
    stats.atkSpeedPct = Math.max(3, Math.round(4.0 * rarityMeta.statMult + nextRandom(world) * 3.5));
    if (rarity !== 'normal') {
      stats.moveSpeedPct = Math.max(3, Math.round(3.2 * rarityMeta.statMult));
    }
    if (rarity === 'epic' || rarity === 'legendary') {
      stats.critChance = Math.max(2, Math.round(2.2 * rarityMeta.statMult));
    }
  }

  // Equipment provides Diablo-style stats & Legendary effects; active skills come exclusively from the Class Skill Tree
  const attachedSkills: GearSkill[] = [];

  let legendaryEffect: LegendaryEffectId | undefined;
  if (rarity === 'legendary') {
    const effects: LegendaryEffectId[] = ['crit_nova', 'life_leech', 'dash_storm', 'treasure_hunter'];
    legendaryEffect = effects[Math.floor(nextRandom(world) * effects.length)];
  }

  const prefixes = GEAR_NAME_PREFIXES[rarity];
  const bases = GEAR_BASE_NAMES[slot];
  const prefix = prefixes[Math.floor(nextRandom(world) * prefixes.length)];
  const base = bases[Math.floor(nextRandom(world) * bases.length)];
  const name = `${prefix} ${base}`;

  const powerScore = computeGearPowerScore(stats, attachedSkills, legendaryEffect);

  return {
    id: world.nextEntityId++,
    slot,
    rarity,
    name,
    itemLevel,
    upgradeLevel: 0,
    powerScore,
    stats,
    attachedSkills,
    legendaryEffect,
  };
}

export function spawnLootDrop(
  world: WorldState,
  x: number,
  y: number,
  source: 'chest_wooden' | 'chest_golden' | 'elite' | 'boss',
  forcedSlot?: GearSlot,
  forcedRarity?: GearRarity
): LootDrop {
  if (world.lootDrops.length >= MAX_LOOT_DROPS) {
    let worstIdx = 0;
    for (let i = 1; i < world.lootDrops.length; i++) {
      if (world.lootDrops[i].item.powerScore < world.lootDrops[worstIdx].item.powerScore) {
        worstIdx = i;
      }
    }
    swapRemove(world.lootDrops, worstIdx);
  }

  const item = generateGearItem(world, source, forcedSlot, forcedRarity);
  const angle = nextRandom(world) * Math.PI * 2;
  const speed = 55 + nextRandom(world) * 65;
  const drop: LootDrop = {
    id: world.nextEntityId++,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    item,
    bobPhase: nextRandom(world) * Math.PI * 2,
    pickupDelay: 0.25,
  };
  world.lootDrops.push(drop);
  emitSound(world, 'loot_drop');
  return drop;
}

export function openWorldChest(world: WorldState, chest: WorldChest): boolean {
  if (chest.opened) return false;
  chest.opened = true;
  chest.openAnim = 1;

  const isGolden = chest.tier === 'golden';
  const hasHunter = computeHeroStats(world.player).hasTreasureHunter;
  const dropRate = (isGolden ? ITEM_DROP_RATE_GOLDEN_CHEST : ITEM_DROP_RATE_CHEST) + (hasHunter ? 0.05 : 0);

  spawnParticles(
    world,
    chest.x,
    chest.y,
    isGolden ? 20 : 14,
    isGolden ? '#fde047' : '#f59e0b',
    65,
    195,
    4.2,
    0.48,
    'ember'
  );
  spawnImpactBurst(
    world,
    'level_pillar',
    chest.x,
    chest.y,
    0,
    isGolden ? 1.15 : 0.85,
    isGolden ? '#fde047' : '#f59e0b',
    0.55
  );
  world.novaRings.push({
    x: chest.x,
    y: chest.y,
    radius: 12,
    maxRadius: isGolden ? 82 : 60,
    life: 0.3,
    maxLife: 0.3,
    color: isGolden ? '#fde047' : '#f59e0b',
  });
  emitSound(world, 'chest');

  const droppedGear = nextRandom(world) < dropRate;
  if (droppedGear) {
    spawnLootDrop(world, chest.x, chest.y, isGolden ? 'chest_golden' : 'chest_wooden');
    spawnFloatingText(
      world,
      chest.x,
      chest.y - 22,
      isGolden ? '황금 보물상자 · 장비 획득!' : '보물상자 · 장비 획득!',
      isGolden ? '#fde047' : '#fbbf24',
      1.15
    );
  }

  // Reward Gold for the Wandering Equipment Merchant when no gear drops (plus bonus Gold on golden chests)
  const goldGain =
    (isGolden ? 24 : droppedGear ? 0 : 8 + Math.floor(nextRandom(world) * 8)) + (hasHunter ? 10 : 0);
  if (goldGain > 0) {
    world.player.gold += goldGain;
    if (!droppedGear) {
      spawnFloatingText(world, chest.x, chest.y - 22, `골드 +${goldGain}G`, '#fde047', 1.1);
    }
  }

  if (isGolden) {
    world.pickups.push({
      id: world.nextEntityId++,
      kind: 'potion',
      x: chest.x - 16,
      y: chest.y + 10,
      vx: -45,
      vy: 30,
      value: 30,
      magnetized: false,
      bobPhase: 0,
    });
  }
  spawnOrMergeXpGem(world, chest.x + 10, chest.y + 12, isGolden ? 26 : 10);
  world.score += isGolden ? 160 : 70;
  if (world.score > world.bestScore) world.bestScore = world.score;
  world.hudDirty = true;
  return true;
}

export function inspectLootDrop(world: WorldState, drop: LootDrop): boolean {
  if (world.phase !== 'playing' || world.pendingOutcome) return false;
  world.pendingLoot = drop;
  world.phase = 'loot';
  world.hudDirty = true;
  return true;
}

export function equipPendingLoot(world: WorldState): boolean {
  const drop = world.pendingLoot;
  if (!drop) return false;

  const slot = drop.item.slot;
  const previous = world.player.equipment[slot];
  let soldGold = 0;
  if (previous) {
    soldGold = getItemSalvageGold(previous);
    world.player.gold += soldGold;
  }

  world.player.equipment[slot] = drop.item;

  const idx = world.lootDrops.findIndex((d) => d.id === drop.id);
  if (idx >= 0) swapRemove(world.lootDrops, idx);

  const stats = syncPlayerStats(world, true);
  evaluateBiomeProgression(world);

  world.pendingLoot = null;
  if (world.phase === 'loot') world.phase = 'playing';
  world.hudDirty = true;

  const rarityColor = GEAR_RARITY_META[drop.item.rarity].color;
  spawnParticles(world, world.player.x, world.player.y, 18, rarityColor, 70, 200, 4, 0.48, 'ember');
  spawnImpactBurst(
    world,
    'level_pillar',
    world.player.x,
    world.player.y,
    0,
    drop.item.rarity === 'legendary' ? 1.25 : 0.95,
    rarityColor,
    0.58
  );
  if (drop.item.rarity === 'legendary' || drop.item.rarity === 'epic') {
    triggerScreenFlash(world, rarityColor, 0.35);
  }
  const label =
    soldGold > 0
      ? `장착! CP ${stats.combatPower} · 기존 판매 +${soldGold}G`
      : `장착! 전투력 ${stats.combatPower}`;
  spawnFloatingText(world, world.player.x, world.player.y - 24, label, '#fde047', 1.15);
  emitSound(world, 'equip');
  return true;
}

export function salvagePendingLoot(world: WorldState): boolean {
  const drop = world.pendingLoot;
  if (!drop) return false;

  const goldGain = getItemSalvageGold(drop.item);
  world.player.gold += goldGain;

  const idx = world.lootDrops.findIndex((d) => d.id === drop.id);
  if (idx >= 0) swapRemove(world.lootDrops, idx);

  const heal = Math.max(10, Math.round(world.player.maxHp * 0.12));
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + heal);

  world.pendingLoot = null;
  if (world.phase === 'loot') world.phase = 'playing';
  world.hudDirty = true;

  spawnParticles(world, world.player.x, world.player.y, 12, '#fde047', 55, 160, 3.8, 0.4);
  spawnFloatingText(world, world.player.x, world.player.y - 24, `판매! +${goldGain}G · +${heal}HP`, '#fde047', 1.12);
  emitSound(world, 'coin');
  return true;
}

// Disabled: progression uses Class Skill Tree (SP) and Wandering Equipment Merchant (Gold) exclusively
export function upgradeEquippedItem(_world: WorldState, _slot: GearSlot): boolean {
  return false;
}

// Disabled: progression uses Class Skill Tree (SP) and Wandering Equipment Merchant (Gold) exclusively
export function upgradeItemSkill(_world: WorldState, _slot: GearSlot, _skillIndex: number): boolean {
  return false;
}

export function dismissPendingLoot(world: WorldState): void {
  if (world.pendingLoot) {
    world.pendingLoot.pickupDelay = 1.8;
    world.pendingLoot = null;
  }
  if (world.phase === 'loot') {
    world.phase = 'playing';
  }
  world.hudDirty = true;
}

export function spawnMerchantNow(
  world: WorldState,
  customX?: number,
  customY?: number
): boolean {
  let mx = customX ?? world.player.x;
  let my = customY ?? world.player.y;
  if (customX === undefined || customY === undefined) {
    // Spawn off-screen at ~20 seconds of player travel distance so minimap direction & sprint matter
    const heroSpeed = Math.max(185, world.player.moveSpeed || 202);
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = nextRandom(world) * Math.PI * 2;
      const travelSec = MERCHANT_SPAWN_TRAVEL_SEC - 0.8 + nextRandom(world) * 1.6;
      const dist = Math.round(heroSpeed * travelSec);
      const cx = world.player.x + Math.cos(angle) * dist;
      const cy = world.player.y + Math.sin(angle) * dist;
      mx = cx;
      my = cy;
      const overlapsChest = world.chests.some(
        (ch) => !ch.opened && Math.hypot(ch.x - cx, ch.y - cy) < 105
      );
      if (!overlapsChest) break;
    }
  }

  world.merchant.active = true;
  world.merchant.x = mx;
  world.merchant.y = my;
  world.merchant.timer = MERCHANT_DURATION_SEC;
  world.merchant.maxDuration = MERCHANT_DURATION_SEC;
  world.merchant.bobPhase = 0;

  world.merchantAlertMax = 4.2;
  world.merchantAlertTimer = 4.2;
  world.merchantReopenCooldown = 0;

  spawnImpactBurst(world, 'level_pillar', mx, my, 0, 1.35, '#10b981', 0.72);
  world.novaRings.push({
    x: mx,
    y: my,
    radius: 16,
    maxRadius: 110,
    life: 0.38,
    maxLife: 0.38,
    color: '#34d399',
  });
  emitSound(world, 'merchant');
  world.hudDirty = true;
  return true;
}

export function openMerchantShop(world: WorldState): boolean {
  if (!world.merchant.active || world.pendingOutcome) return false;
  if (world.phase !== 'playing') return false;
  world.phase = 'merchant';
  emitSound(world, 'merchant');
  world.hudDirty = true;
  return true;
}

export function closeMerchantShop(world: WorldState): void {
  if (world.phase === 'merchant') {
    world.phase = 'playing';
    world.merchantReopenCooldown = 2.6;
    world.hudDirty = true;
  }
}

export function upgradeMerchantGear(world: WorldState, slot: MerchantGearSlot): boolean {
  const p = world.player;
  const currentLv = p.merchantGearLevels[slot];
  const cost = getMerchantUpgradeCost(currentLv);
  if (cost === null || p.gold < cost) return false;

  p.gold -= cost;
  p.merchantGearLevels[slot] = currentLv + 1;
  syncPlayerStats(world, true);
  evaluateBiomeProgression(world);
  world.hudDirty = true;

  const def = MERCHANT_GEAR_CATALOG[slot];
  spawnParticles(world, p.x, p.y, 16, def.accent, 60, 185, 4, 0.44, 'ember');
  spawnImpactBurst(world, 'level_pillar', p.x, p.y, 0, 1.05, def.accent, 0.52);
  spawnFloatingText(
    world,
    p.x,
    p.y - 24,
    `${def.name} Lv.${currentLv + 1}! (+${def.perLevelValue}${def.unit})`,
    def.accent,
    1.15
  );
  emitSound(world, 'equip');
  return true;
}

export function openSkillTree(world: WorldState): boolean {
  if (world.pendingOutcome) return false;
  if (world.phase !== 'playing' && world.phase !== 'paused') return false;
  world.phase = 'skill_tree';
  world.hudDirty = true;
  return true;
}

export function closeSkillTree(world: WorldState): void {
  if (world.phase === 'skill_tree') {
    world.phase = 'playing';
    world.hudDirty = true;
  }
}

export function unlockOrUpgradeElement(
  world: WorldState,
  element: ElementId,
  branch?: ElementBranch
): boolean {
  const p = world.player;
  if (p.skillPoints <= 0) return false;
  const chosen = getChosenElement(p.elementTree);
  // Single-element specialization: once one element is chosen, only that element can be developed
  if (chosen !== null && chosen !== element) return false;

  const node = p.elementTree[element];
  const def = ELEMENT_CATALOG[element];

  if (!node.unlocked) {
    if (branch) return false;
    p.skillPoints -= 1;
    node.unlocked = true;
    p.elementTimers[element] = 0.15;
    syncPlayerStats(world, false);
    evaluateBiomeProgression(world);
    world.hudDirty = true;
    spawnParticles(world, p.x, p.y, 18, def.color, 65, 195, 4.2, 0.48, 'ember');
    spawnImpactBurst(world, 'level_pillar', p.x, p.y, 0, 1.15, def.color, 0.58);
    spawnFloatingText(world, p.x, p.y - 26, `${def.name} 전속 마법 각성!`, def.color, 1.2);
    emitSound(world, 'levelup');
    return true;
  }

  if (!branch) return false;
  if (branch === 'power') {
    if (node.powerLv >= MAX_ELEMENT_BRANCH_LEVEL) return false;
    p.skillPoints -= 1;
    node.powerLv += 1;
  } else {
    if (node.areaLv >= MAX_ELEMENT_BRANCH_LEVEL) return false;
    p.skillPoints -= 1;
    node.areaLv += 1;
  }

  syncPlayerStats(world, false);
  evaluateBiomeProgression(world);
  world.hudDirty = true;

  const branchLabel = branch === 'power' ? `공격력 Lv.${node.powerLv}` : `범위 Lv.${node.areaLv}`;
  spawnParticles(world, p.x, p.y, 16, def.color, 60, 185, 4, 0.44, 'ember');
  spawnImpactBurst(world, 'level_pillar', p.x, p.y, 0, 1.05, def.color, 0.54);
  spawnFloatingText(world, p.x, p.y - 24, `${def.name} ${branchLabel}!`, def.color, 1.15);
  emitSound(world, 'levelup');
  return true;
}

export function upgradeClassSkill(
  world: WorldState,
  attribute: SkillAttribute,
  tier: SkillTier
): boolean {
  const p = world.player;
  if (!canUpgradeClassSkill(p.classSkills, attribute, tier, p.skillPoints)) {
    return false;
  }

  const prevFusions = new Set(getActiveHybridFusions(p.classSkills));
  const node = p.classSkills[attribute][tier];
  p.skillPoints -= 1;
  node.level += 1;

  // Reset timers for immediate skill response
  const prefix = p.heroClass === 'wizard' ? 'wiz' : p.heroClass === 'warrior' ? 'war' : 'arc';
  const attrKey = attribute === 'fire' ? 'f' : attribute === 'ice' ? 'i' : attribute === 'lightning' ? 'l' : attribute === 'poison' ? 'p' : 'k';
  p.classSkillTimers[`${prefix}_${attrKey}${tier}`] = Math.min(
    p.classSkillTimers[`${prefix}_${attrKey}${tier}`] ?? 0.15,
    0.15
  );

  syncPlayerStats(world, false);
  evaluateBiomeProgression(world);
  world.hudDirty = true;

  const skillDef = CLASS_SKILL_CATALOG[p.heroClass][attribute][tier];
  const attrColor = ATTRIBUTE_META[attribute].color;
  spawnParticles(world, p.x, p.y, 16, attrColor, 65, 195, 4, 0.46, 'ember');
  spawnImpactBurst(world, 'level_pillar', p.x, p.y, 0, 1.1, attrColor, 0.54);
  spawnFloatingText(world, p.x, p.y - 26, `${skillDef.name} Lv.${node.level}!`, attrColor, 1.18);

  // Check if investing this point newly unlocked a Hybrid Fusion Passive!
  const nowFusions = getActiveHybridFusions(p.classSkills);
  for (const fid of nowFusions) {
    if (!prevFusions.has(fid)) {
      const fdef = HYBRID_FUSION_CATALOG.find((f) => f.id === fid);
      if (fdef) {
        world.bannerText = `하이브리드 퓨전 각성! [${fdef.name}] 해금!`;
        world.bannerTimer = 3.6;
        spawnImpactBurst(world, 'crit_star', p.x, p.y, 0, 56, fdef.color, 0.5);
        spawnFloatingText(world, p.x, p.y - 46, `퓨전 해금: ${fdef.name}!`, fdef.color, 1.28);
      }
    }
  }
  emitSound(world, 'levelup');
  return true;
}

export function selectClassSkillMutation(
  world: WorldState,
  attribute: SkillAttribute,
  tier: SkillTier,
  milestone: 5 | 10,
  choice: MutationChoice
): boolean {
  const p = world.player;
  const node = p.classSkills[attribute][tier];
  if (node.level < milestone) return false;
  if (milestone === 5) {
    node.mut5 = choice;
  } else {
    node.mut10 = choice;
  }
  syncPlayerStats(world, false);
  world.hudDirty = true;
  const skillDef = CLASS_SKILL_CATALOG[p.heroClass][attribute][tier];
  const opt = milestone === 5 ? (choice === 'A' ? skillDef.mut5A : skillDef.mut5B) : choice === 'A' ? skillDef.mut10A : skillDef.mut10B;
  spawnFloatingText(world, p.x, p.y - 30, `각성 변형: ${opt.title}`, '#fde047', 1.18);
  emitSound(world, 'levelup');
  return true;
}

export function triggerLevelUpCelebration(world: WorldState): void {
  const p = world.player;
  world.levelUpAnimMax = 2.6;
  world.levelUpAnimTimer = 2.6;
  world.levelUpAnimLevel = p.level;
  const clsColor = HERO_CLASS_CATALOG[p.heroClass].accent;
  spawnImpactBurst(world, 'level_pillar', p.x, p.y, 0, 1.55, '#fde047', 0.85);
  spawnImpactBurst(world, 'crit_star', p.x, p.y, 0, 62, clsColor, 0.55);
  world.novaRings.push({
    x: p.x,
    y: p.y,
    radius: 16,
    maxRadius: 165,
    life: 0.45,
    maxLife: 0.45,
    color: '#fde047',
  });
  spawnParticles(world, p.x, p.y, 26, '#fde047', 85, 240, 4.4, 0.58, 'ember');
  spawnParticles(world, p.x, p.y, 16, clsColor, 70, 210, 3.8, 0.52, 'spark');
  triggerScreenFlash(world, '#fde047', 0.34);
  world.hudDirty = true;
}

export function tryInteractAtWorldPoint(
  world: WorldState,
  wx: number,
  wy: number,
  input: InputState
): boolean {
  if (world.phase !== 'playing') return false;
  const p = world.player;

  // 0. Check clicked Wandering Equipment Merchant
  if (world.merchant.active) {
    const m = world.merchant;
    if (Math.hypot(m.x - wx, m.y - wy) <= 64) {
      const distToPlayer = Math.hypot(m.x - p.x, m.y - p.y);
      if (distToPlayer <= 260) {
        return openMerchantShop(world);
      }
      input.waypointActive = true;
      input.waypointX = m.x;
      input.waypointY = m.y;
      return true;
    }
  }

  // 1. Check clicked LootDrop
  for (let i = 0; i < world.lootDrops.length; i++) {
    const drop = world.lootDrops[i];
    if (Math.hypot(drop.x - wx, drop.y - wy) <= 58) {
      const distToPlayer = Math.hypot(drop.x - p.x, drop.y - p.y);
      if (distToPlayer <= 260) {
        return inspectLootDrop(world, drop);
      }
      input.waypointActive = true;
      input.waypointX = drop.x;
      input.waypointY = drop.y;
      return true;
    }
  }

  // 2. Check clicked unopened WorldChest
  for (let i = 0; i < world.chests.length; i++) {
    const ch = world.chests[i];
    if (ch.opened) continue;
    if (Math.hypot(ch.x - wx, ch.y - wy) <= 56) {
      const distToPlayer = Math.hypot(ch.x - p.x, ch.y - p.y);
      if (distToPlayer <= 210) {
        return openWorldChest(world, ch);
      }
      input.waypointActive = true;
      input.waypointX = ch.x;
      input.waypointY = ch.y;
      return true;
    }
  }

  return false;
}

function populateChunk(world: WorldState, cx: number, cy: number): void {
  const key = `${cx},${cy}`;
  if (world.visitedChunks.has(key)) return;
  world.visitedChunks.add(key);

  const originX = cx * CHUNK_SIZE;
  const originY = cy * CHUNK_SIZE;

  // Starter chunk (0,0): place 1 guaranteed treasure chest within immediate sight + 4 ambient torches
  if (cx === 0 && cy === 0) {
    world.chests.push({
      id: world.nextEntityId++,
      x: 185,
      y: -55,
      tier: 'wooden',
      opened: false,
      openAnim: 0,
      bobPhase: 0,
    });
    const ringOffsets = [
      [-210, -170],
      [230, -190],
      [-220, 180],
      [210, 175],
    ];
    for (let i = 0; i < ringOffsets.length; i++) {
      world.torches.push({
        x: ringOffsets[i][0],
        y: ringOffsets[i][1],
        phase: i * 1.4,
      });
    }
    return;
  }

  // Ambient torches (2 per chunk)
  for (let t = 0; t < 2; t++) {
    const tx = originX + 90 + nextRandom(world) * (CHUNK_SIZE - 180);
    const ty = originY + 90 + nextRandom(world) * (CHUNK_SIZE - 180);
    world.torches.push({ x: tx, y: ty, phase: nextRandom(world) * 6.28 });
  }

  // World Treasure Chest (guarantee if < 2 unopened chests exist, otherwise 45% per wilderness chunk)
  let unopenedChests = 0;
  for (let i = 0; i < world.chests.length; i++) {
    if (!world.chests[i].opened) unopenedChests += 1;
  }
  if (world.chests.length < 14 && (unopenedChests < 2 || nextRandom(world) < 0.45)) {
    const chestX = originX + 120 + nextRandom(world) * (CHUNK_SIZE - 240);
    const chestY = originY + 120 + nextRandom(world) * (CHUNK_SIZE - 240);
    const goldenChance = computeHeroStats(world.player).hasTreasureHunter ? 0.44 : 0.28;
    world.chests.push({
      id: world.nextEntityId++,
      x: chestX,
      y: chestY,
      tier: nextRandom(world) < goldenChance ? 'golden' : 'wooden',
      opened: false,
      openAnim: 0,
      bobPhase: nextRandom(world) * Math.PI * 2,
    });
  }

  // Roaming Elite Special Monster guarding newly discovered wilderness chunks (skip frame-0 opening ambush)
  let activeElites = 0;
  for (let i = 0; i < world.enemies.length; i++) {
    if (world.enemies[i].isElite && !world.enemies[i].dying) activeElites += 1;
  }
  const eliteSpawnChance = world.wave >= 2 ? 0.44 : 0.25;
  if (world.elapsed >= 6 && activeElites < 3 && nextRandom(world) < eliteSpawnChance) {
    const ex = originX + 140 + nextRandom(world) * (CHUNK_SIZE - 280);
    const ey = originY + 140 + nextRandom(world) * (CHUNK_SIZE - 280);
    if (Math.hypot(ex - world.player.x, ey - world.player.y) > 420) {
      const elitePool: EnemyKind[] = ['charger', 'imp', 'skeleton', 'bat'];
      const kind = elitePool[Math.floor(nextRandom(world) * elitePool.length)];
      spawnEnemyAt(world, kind, ex, ey, true);
    }
  }
}

export function ensureChunksAroundPlayer(world: WorldState): void {
  const pcx = Math.floor(world.player.x / CHUNK_SIZE);
  const pcy = Math.floor(world.player.y / CHUNK_SIZE);

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      populateChunk(world, pcx + dx, pcy + dy);
    }
  }

  // Prune distant torches & stale chests so infinite travel keeps constant low memory
  const px = world.player.x;
  const py = world.player.y;
  for (let i = world.torches.length - 1; i >= 0; i--) {
    const t = world.torches[i];
    if (Math.abs(t.x - px) > 1550 || Math.abs(t.y - py) > 1550) {
      swapRemove(world.torches, i);
    }
  }
  for (let i = world.chests.length - 1; i >= 0; i--) {
    const ch = world.chests[i];
    const farLimit = ch.opened ? 950 : 2100;
    if (Math.abs(ch.x - px) > farLimit || Math.abs(ch.y - py) > farLimit) {
      swapRemove(world.chests, i);
    }
  }
}

export function startNewRun(
  world: WorldState,
  seed?: number,
  heroClass?: HeroClassId
): void {
  const chosenClass: HeroClassId = heroClass ?? world.player?.heroClass ?? 'wizard';
  const fresh = createInitialWorld(
    world.bestScore,
    seed ?? ((Date.now() & 0xfffffff) || 1337),
    chosenClass
  );
  Object.assign(world, fresh);
  world.phase = 'playing';
  world.merchantCooldown = 20 + nextRandom(world) * 14;
  world.bannerText = `${HERO_CLASS_CATALOG[chosenClass].name} 출정 · ${WAVE_CONFIGS[0].title}`;
  world.bannerTimer = 2.6;
  world.hudDirty = true;

  // Populate initial 3x3 open-world chunks around (0, 0)
  ensureChunksAroundPlayer(world);

  // Spawn 3 opening enemies at a safe ring (430px) so player sees immediate combat and survives opening seconds
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    spawnEnemyAt(world, 'skeleton', Math.cos(angle) * 430, Math.sin(angle) * 430);
  }
}

export function emitSound(world: WorldState, event: SoundEvent): void {
  if (world.soundQueue.length < 16) {
    world.soundQueue.push(event);
  }
}

export function spawnParticles(
  world: WorldState,
  x: number,
  y: number,
  count: number,
  color: string,
  speedMin: number,
  speedMax: number,
  size = 3.5,
  life = 0.35,
  shape: ParticleShape = 'square'
): void {
  const actualCount = world.enemies.length > 55 ? Math.max(1, Math.ceil(count * 0.6)) : count;
  for (let i = 0; i < actualCount; i++) {
    const p = world.particles[world.particleCursor];
    world.particleCursor = (world.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const angle = nextRandom(world) * Math.PI * 2;
    const speed = speedMin + nextRandom(world) * (speedMax - speedMin);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.size = size * (0.7 + nextRandom(world) * 0.6);
    p.color = color;
    p.maxLife = life * (0.75 + nextRandom(world) * 0.5);
    p.life = p.maxLife;
    p.gravity = shape === 'ember' ? -35 : 90;
    p.shape = shape;
  }
}

export function spawnImpactBurst(
  world: WorldState,
  kind: ImpactBurstKind,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
  life = 0.2
): void {
  const b = world.impactBursts[world.impactBurstCursor];
  world.impactBurstCursor = (world.impactBurstCursor + 1) % IMPACT_BURST_POOL_SIZE;
  b.active = true;
  b.kind = kind;
  b.x = x;
  b.y = y;
  b.angle = angle;
  b.size = size;
  b.color = color;
  b.life = life;
  b.maxLife = life;
}

export function spawnAfterimage(
  world: WorldState,
  x: number,
  y: number,
  facing: number,
  color: string,
  life = 0.22,
  scale = 1
): void {
  const g = world.afterimages[world.afterimageCursor];
  world.afterimageCursor = (world.afterimageCursor + 1) % AFTERIMAGE_POOL_SIZE;
  g.active = true;
  g.x = x;
  g.y = y;
  g.facing = facing;
  g.color = color;
  g.life = life;
  g.maxLife = life;
  g.scale = scale;
}

export function spawnGroundDecal(
  world: WorldState,
  kind: GroundDecalKind,
  x: number,
  y: number,
  radius: number,
  color: string,
  life = 3.0
): void {
  const d = world.groundDecals[world.groundDecalCursor];
  world.groundDecalCursor = (world.groundDecalCursor + 1) % GROUND_DECAL_POOL_SIZE;
  d.active = true;
  d.kind = kind;
  d.x = x;
  d.y = y;
  d.radius = radius;
  d.color = color;
  d.life = life;
  d.maxLife = life;
  d.rotation = nextRandom(world) * Math.PI * 2;
}

export function triggerScreenFlash(world: WorldState, color: string, duration = 0.35): void {
  world.screenFlashColor = color;
  world.screenFlashMax = duration;
  world.screenFlashTimer = duration;
}

export function spawnPixelShatter(world: WorldState, enemy: Enemy): void {
  const palette = ENEMY_PIXEL_PALETTES[enemy.kind];
  const baseCount = enemy.isBoss ? 40 : enemy.isElite ? 24 : 15;
  const count = !enemy.isBoss && world.enemies.length > 75 ? Math.max(9, Math.ceil(baseCount * 0.65)) : baseCount;
  const spread = enemy.radius * 0.78;
  const baseGroundY = enemy.y + enemy.radius * 0.48;

  for (let i = 0; i < count; i++) {
    const s = world.pixelShards[world.pixelShardCursor];
    world.pixelShardCursor = (world.pixelShardCursor + 1) % PIXEL_SHARD_POOL_SIZE;

    const ox = (nextRandom(world) * 2 - 1) * spread;
    const oy = (nextRandom(world) * 2 - 1) * spread - enemy.radius * 0.18;
    const angle = nextRandom(world) * Math.PI * 2;
    const horizSpeed = (enemy.isBoss ? 95 : enemy.isElite ? 78 : 64) + nextRandom(world) * (enemy.isBoss ? 210 : 150);

    s.active = true;
    s.x = enemy.x + ox;
    s.y = enemy.y + oy;
    s.vx = Math.cos(angle) * horizSpeed + enemy.knockVx * 0.25;
    s.vy = -((enemy.isBoss ? 125 : 88) + nextRandom(world) * (enemy.isBoss ? 145 : 105));
    s.groundY = baseGroundY + (nextRandom(world) - 0.5) * 14;
    s.size = enemy.isBoss ? 5 + Math.floor(nextRandom(world) * 4) : 4 + Math.floor(nextRandom(world) * 3.2);
    s.color =
      enemy.isElite && enemy.eliteColor && i % 3 === 0
        ? enemy.eliteColor
        : palette[Math.floor(nextRandom(world) * palette.length)];
    s.maxLife = (enemy.isBoss ? 0.92 : 0.62) + nextRandom(world) * (enemy.isBoss ? 0.5 : 0.38);
    s.life = s.maxLife;
    s.rotation = nextRandom(world) * Math.PI * 2;
    s.rotSpeed = (nextRandom(world) * 2 - 1) * 15;
    s.bounces = 0;
  }
}

export function triggerBossAlert(world: WorldState, bossKind: BossKind, stage: number): void {
  const meta = BOSS_META[bossKind];
  world.bossAlertMax = 3.8;
  world.bossAlertTimer = 3.8;
  world.bossAlertName = meta.name;
  world.bossAlertSubtitle = meta.subtitle;
  world.bossAlertAccent = meta.accent;
  world.bossAlertStage = stage;
  world.hudDirty = true;
}

export function spawnFloatingText(
  world: WorldState,
  x: number,
  y: number,
  text: string,
  color: string,
  scale = 1
): void {
  const ft = world.floatingTexts[world.floatingTextCursor];
  world.floatingTextCursor = (world.floatingTextCursor + 1) % FLOATING_TEXT_POOL_SIZE;
  ft.active = true;
  ft.x = x + (nextRandom(world) - 0.5) * 14;
  ft.y = y - 12;
  ft.vy = -44;
  ft.text = text;
  ft.color = color;
  ft.maxLife = 0.58;
  ft.life = ft.maxLife;
  ft.scale = scale;
}

export function isBossKind(kind: EnemyKind): kind is BossKind {
  return (
    kind === 'boss_behemoth' ||
    kind === 'boss_pyrolord' ||
    kind === 'boss_frostqueen' ||
    kind === 'lich_boss'
  );
}

export function spawnEnemyAt(
  world: WorldState,
  kind: EnemyKind,
  x: number,
  y: number,
  isElite = false
): Enemy {
  const waveCfg = WAVE_CONFIGS[Math.min(world.wave - 1, WAVE_CONFIGS.length - 1)];
  const hpMult = waveCfg.hpMult;
  const spdMult = waveCfg.speedMult;

  const baseStats: Record<
    EnemyKind,
    { hp: number; radius: number; speed: number; damage: number; xp: number; score: number; boss: boolean }
  > = {
    skeleton: { hp: 38, radius: 14, speed: 92, damage: 14, xp: 11, score: 25, boss: false },
    imp: { hp: 32, radius: 13, speed: 98, damage: 16, xp: 15, score: 40, boss: false },
    charger: { hp: 82, radius: 18, speed: 86, damage: 22, xp: 22, score: 65, boss: false },
    bat: { hp: 28, radius: 12, speed: 138, damage: 12, xp: 13, score: 35, boss: false },
    boss_behemoth: { hp: 1100, radius: 28, speed: 82, damage: 28, xp: 130, score: 750, boss: true },
    boss_pyrolord: { hp: 2300, radius: 28, speed: 80, damage: 33, xp: 185, score: 1250, boss: true },
    boss_frostqueen: { hp: 3800, radius: 27, speed: 88, damage: 38, xp: 240, score: 1850, boss: true },
    lich_boss: { hp: 6200, radius: 30, speed: 86, damage: 44, xp: 360, score: 3600, boss: true },
  };

  const s = baseStats[kind];
  const eliteFlag = !s.boss && isElite;
  const affix = eliteFlag ? ELITE_AFFIXES[Math.floor(nextRandom(world) * ELITE_AFFIXES.length)] : null;
  const finalHp = Math.round(
    s.hp * (s.boss ? 1 : hpMult) * (affix ? affix.hpMult : 1)
  );
  const finalSpeed = s.speed * (s.boss ? 1 : spdMult) * (affix ? affix.spdMult : 1);

  const enemy: Enemy = {
    id: world.nextEntityId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    knockVx: 0,
    knockVy: 0,
    facing: x > world.player.x ? -1 : 1,
    hp: finalHp,
    maxHp: finalHp,
    radius: eliteFlag ? Math.round(s.radius * 1.24) : s.radius,
    speed: finalSpeed,
    damage: Math.round(
      s.damage *
        (eliteFlag ? 1.38 : 1) *
        (s.boss ? 1 : 1 + (world.wave - 1) * 0.24 + Math.max(0, world.wave - 10) * 0.14)
    ),
    xpValue: eliteFlag ? s.xp * 3 : s.xp,
    scoreValue: eliteFlag ? s.score * 4 : s.score,
    strideDist: nextRandom(world) * 40,
    hitFlashTimer: 0,
    slowTimer: 0,
    burnTimer: 0,
    burnTickTimer: 0,
    poisonTimer: 0,
    poisonTickTimer: 0,
    statusVfxAccum: 0,
    aiState: 'chase',
    aiTimer: s.boss ? 1.4 : 0.7 + nextRandom(world) * 0.9,
    attackPattern: 0,
    patternRepeat: 0,
    telegraphAngle: 0,
    telegraphTargetX: 0,
    telegraphTargetY: 0,
    hasAttackToken: false,
    dying: false,
    deathTimer: 0,
    orbitSign: nextRandom(world) > 0.5 ? 1 : -1,
    isBoss: s.boss,
    bossName: isBossKind(kind) ? BOSS_META[kind].name : undefined,
    isElite: eliteFlag,
    eliteTitle: affix ? `${affix.title} 정예` : undefined,
    eliteColor: affix?.color,
    enemyLevel: world.wave + (s.boss ? 4 : eliteFlag ? 2 : 0),
    element: getEnemyElement(kind, affix?.title),
    poisonStacks: 0,
    lightningHits: 0,
    armorShred: 0,
    confusedTimer: 0,
    bleedTimer: 0,
    bleedTickTimer: 0,
    markedTimer: 0,
    stunTimer: 0,
    bloomTimer: 0,
    bloomDmg: 0,
  };

  world.enemies.push(enemy);
  return enemy;
}

function pickEnemyKindForWave(world: WorldState): EnemyKind {
  const cfg = WAVE_CONFIGS[Math.min(world.wave - 1, WAVE_CONFIGS.length - 1)];
  const r = nextRandom(world);
  let acc = cfg.weights.skeleton;
  if (r < acc) return 'skeleton';
  acc += cfg.weights.imp;
  if (r < acc) return 'imp';
  acc += cfg.weights.charger;
  if (r < acc) return 'charger';
  return 'bat';
}

// Level-up skill draft removed: skills are now bound to items and upgraded via banked Skill XP.

export function triggerDash(world: WorldState, dirX?: number, dirY?: number): boolean {
  const p = world.player;
  if (p.dashCooldown > 0 || p.dashActiveTimer > 0) {
    p.dashBufferTimer = 0.12;
    return false;
  }

  let dx = dirX ?? 0;
  let dy = dirY ?? 0;
  const len = Math.hypot(dx, dy);
  if (len > 0.01) {
    dx /= len;
    dy /= len;
  } else if (Math.hypot(p.vx, p.vy) > 10) {
    const vl = Math.hypot(p.vx, p.vy);
    dx = p.vx / vl;
    dy = p.vy / vl;
  } else {
    dx = Math.cos(p.aimAngle);
    dy = Math.sin(p.aimAngle);
  }

  p.dashDirX = dx;
  p.dashDirY = dy;
  p.facing = dx < -0.05 ? -1 : dx > 0.05 ? 1 : p.facing;
  p.dashActiveTimer = 0.16;
  p.dashCooldown = p.dashMaxCooldown;
  p.invulnTimer = Math.max(p.invulnTimer, 0.28);
  p.dashBufferTimer = 0;
  p.scaleX = 1.3;
  p.scaleY = 0.76;

  const coreLv = p.relics.dash_core ?? 0;
  const hasDashStorm = computeHeroStats(p).hasDashStorm;
  const novaRadius = Math.round((90 + coreLv * 24) * (hasDashStorm ? 1.35 : 1));
  const novaDamage = Math.round((20 + coreLv * 14) * p.damageMult * (hasDashStorm ? 1.6 : 1));
  world.novaRings.push({
    x: p.x,
    y: p.y,
    radius: 16,
    maxRadius: novaRadius,
    life: 0.26,
    maxLife: 0.26,
    color: hasDashStorm ? '#fb923c' : '#fbbf24',
  });

  for (let i = 0; i < world.enemies.length; i++) {
    const enemy = world.enemies[i];
    if (enemy.dying) continue;
    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (dist <= novaRadius + enemy.radius) {
      damageEnemy(world, enemy, novaDamage, p.x, p.y, 260, false);
    }
  }

  spawnAfterimage(world, p.x, p.y, p.facing, hasDashStorm ? '#fb923c' : '#fde047', 0.24, 1.05);
  spawnImpactBurst(world, 'slash_arc', p.x, p.y, Math.atan2(dy, dx), 42, hasDashStorm ? '#fb923c' : '#fde047', 0.22);
  spawnParticles(world, p.x, p.y, 14, hasDashStorm ? '#fb923c' : '#fbbf24', 85, 230, 4, 0.34, 'spark');
  world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.2);
  emitSound(world, 'dash');
  return true;
}

export function damageEnemy(
  world: WorldState,
  enemy: Enemy,
  rawDamage: number,
  sourceX: number,
  sourceY: number,
  knockback = 130,
  heavy = false,
  allowCritNova = true,
  element?: ElementId,
  skillAttr?: SkillAttribute
): void {
  if (enemy.dying) return;
  const affinity = element ? getElementAffinity(element, enemy.element) : null;
  const affinityMult = affinity ? affinity.mult : 1;
  const isCrit = nextRandom(world) < world.player.critChance;
  const critMult =
    world.player.heroClass === 'archer' && world.player.classSkills.physical[2].mut10 === 'B'
      ? 2.35
      : 1.65;
  const shredMult = 1 + (enemy.armorShred || 0);
  const dmg = Math.max(1, Math.round(rawDamage * affinityMult * shredMult * (isCrit ? critMult : 1)));
  enemy.hp -= dmg;
  enemy.hitFlashTimer = 0.075;

  const dx = enemy.x - sourceX;
  const dy = enemy.y - sourceY;
  const d = Math.hypot(dx, dy) || 1;
  const kbResist = enemy.isBoss ? 0.14 : enemy.isElite ? 0.35 : enemy.kind === 'charger' ? 0.45 : 1;
  enemy.knockVx += (dx / d) * knockback * kbResist;
  enemy.knockVy += (dy / d) * knockback * kbResist;

  if (
    isCrit ||
    heavy ||
    affinity?.relation === 'strong' ||
    enemy.isBoss ||
    enemy.isElite ||
    world.enemies.length < 36 ||
    nextRandom(world) < 0.45
  ) {
    const label =
      affinity?.relation === 'strong'
        ? `약점 ${dmg}!`
        : affinity?.relation === 'weak'
          ? `저항 ${dmg}`
          : isCrit
            ? `${dmg}!`
            : `${dmg}`;
    const color =
      affinity?.relation === 'strong'
        ? '#fde047'
        : affinity?.relation === 'weak'
          ? '#94a3b8'
          : isCrit
            ? '#fde047'
            : element
              ? ELEMENT_CATALOG[element].color
              : heavy
                ? '#fbbf24'
                : '#f8fafc';
    const scale =
      affinity?.relation === 'strong' ? 1.24 : isCrit ? 1.2 : heavy ? 1.1 : affinity?.relation === 'weak' ? 0.88 : 0.95;
    spawnFloatingText(world, enemy.x, enemy.y - enemy.radius, label, color, scale);
  }
  const hitAngle = Math.atan2(dy, dx);
  const sparkColor = element ? ELEMENT_CATALOG[element].color : heavy ? '#fbbf24' : '#f8fafc';
  if (isCrit || affinity?.relation === 'strong') {
    spawnImpactBurst(world, 'crit_star', enemy.x, enemy.y, hitAngle, enemy.radius + 14, isCrit ? '#fde047' : sparkColor, 0.24);
    spawnParticles(world, enemy.x, enemy.y, 7, isCrit ? '#fde047' : sparkColor, 70, 195, 3.6, 0.26, 'spark');
  } else {
    spawnImpactBurst(world, 'hit_spark', enemy.x, enemy.y, hitAngle, heavy ? 22 : 15, sparkColor, 0.16);
    spawnParticles(world, enemy.x, enemy.y, heavy ? 5 : 3, sparkColor, 55, 145, 3, 0.22, 'spark');
  }

  // Trigger Class Passive Reactions & Hybrid Fusion Passives (allowCritNova guards against infinite recursion)
  if (allowCritNova) {
    const resolvedAttr: SkillAttribute | undefined = skillAttr ?? element;
    onClassEnemyDamaged(world, enemy, dmg, isCrit, knockback, resolvedAttr, classCombatHooks);
  }

  // Legendary Effect: Crit Nova explosion
  if (isCrit && allowCritNova && computeHeroStats(world.player).hasCritNova) {
    const splashDmg = Math.round(dmg * 0.42);
    spawnGroundDecal(world, 'scorch', enemy.x, enemy.y, 44, '#ea580c', 2.8);
    spawnParticles(world, enemy.x, enemy.y, 10, '#fb923c', 60, 180, 3.8, 0.36, 'ember');
    world.novaRings.push({
      x: enemy.x,
      y: enemy.y,
      radius: 10,
      maxRadius: 84,
      life: 0.22,
      maxLife: 0.22,
      color: '#fb923c',
    });
    spatialGrid.forEachNeighbor(enemy.x, enemy.y, 2, (idx) => {
      const other = world.enemies[idx];
      if (!other || other.dying || other.id === enemy.id) return;
      const ox = other.x - enemy.x;
      const oy = other.y - enemy.y;
      if (ox * ox + oy * oy <= 84 * 84) {
        applyEnemyStatus(other, 'burn', 2.6);
        damageEnemy(world, other, splashDmg, enemy.x, enemy.y, 90, false, false, 'fire', 'fire');
      }
    });
  }

  // Lag Fix #1: NEVER trigger hitstop on normal/AoE weapon hits — silky 60fps in massive waves!
  if (enemy.hp <= 0) {
    killEnemy(world, enemy);
  } else {
    emitSound(world, isCrit ? 'crit_hit' : 'hit');
  }
}

function releaseAttackToken(world: WorldState, enemy: Enemy): void {
  if (enemy.hasAttackToken) {
    enemy.hasAttackToken = false;
    world.attackTokensUsed = Math.max(0, world.attackTokensUsed - 1);
  }
}

export function grantXpAndCheckLevelUp(
  world: WorldState,
  xpValue: number,
  openTreeOnLevelUp = false
): boolean {
  const p = world.player;
  p.xp += xpValue;
  world.score += xpValue;
  if (world.score > world.bestScore) world.bestScore = world.score;

  let leveledUp = false;
  while (p.xp >= p.xpToNext && !world.pendingOutcome) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.skillPoints += 1;
    p.xpToNext = xpForLevel(p.level);
    leveledUp = true;
  }

  if (leveledUp) {
    syncPlayerStats(world, true);
    evaluateBiomeProgression(world);
    triggerLevelUpCelebration(world);
    spawnFloatingText(world, p.x, p.y - 28, `LEVEL UP! Lv.${p.level} · +1 SP`, '#fde047', 1.24);
    emitSound(world, 'levelup');
    if (openTreeOnLevelUp && world.phase === 'playing' && !world.pendingOutcome) {
      world.phase = 'skill_tree';
    }
    world.hudDirty = true;
  }
  return leveledUp;
}

function spawnCoinsForEnemy(world: WorldState, enemy: Enemy): void {
  const { count, valuePerCoin } = computeEnemyCoinDrop(enemy.enemyLevel, enemy.isElite, enemy.isBoss);
  for (let c = 0; c < count; c++) {
    if (world.pickups.length >= MAX_PICKUPS) {
      let merged = false;
      for (let i = 0; i < world.pickups.length; i++) {
        const pk = world.pickups[i];
        if (!pk.magnetized && pk.kind === 'coin') {
          pk.value += valuePerCoin;
          merged = true;
          break;
        }
      }
      if (merged) continue;
    }
    const angle = count === 1 ? nextRandom(world) * Math.PI * 2 : (c / count) * Math.PI * 2 + nextRandom(world) * 0.6;
    const speed = count === 1 ? 26 + nextRandom(world) * 28 : 42 + nextRandom(world) * 48;
    world.pickups.push({
      id: world.nextEntityId++,
      kind: 'coin',
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      value: valuePerCoin,
      magnetized: false,
      bobPhase: nextRandom(world) * Math.PI * 2,
    });
  }
}

function spawnOrMergeXpGem(world: WorldState, x: number, y: number, xpValue: number): void {
  if (world.pickups.length >= 38) {
    const mergeRadiusSq = world.pickups.length >= MAX_PICKUPS - 6 ? 190 * 190 : 100 * 100;
    for (let i = 0; i < world.pickups.length; i++) {
      const pk = world.pickups[i];
      if (pk.magnetized || !pk.kind.startsWith('xp_')) continue;
      const dx = pk.x - x;
      const dy = pk.y - y;
      if (dx * dx + dy * dy <= mergeRadiusSq) {
        pk.value += xpValue;
        pk.kind = pk.value >= 40 ? 'xp_large' : pk.value >= 16 ? 'xp_medium' : 'xp_small';
        return;
      }
    }
  }

  if (world.pickups.length >= MAX_PICKUPS) {
    for (let i = 0; i < world.pickups.length; i++) {
      const pk = world.pickups[i];
      if (!pk.magnetized && pk.kind.startsWith('xp_')) {
        pk.value += xpValue;
        pk.kind = pk.value >= 40 ? 'xp_large' : pk.value >= 16 ? 'xp_medium' : 'xp_small';
        return;
      }
    }
  }

  const gemKind: Pickup['kind'] =
    xpValue >= 40 ? 'xp_large' : xpValue >= 16 ? 'xp_medium' : 'xp_small';
  world.pickups.push({
    id: world.nextEntityId++,
    kind: gemKind,
    x,
    y,
    vx: (nextRandom(world) - 0.5) * 45,
    vy: (nextRandom(world) - 0.5) * 45,
    value: xpValue,
    magnetized: false,
    bobPhase: nextRandom(world) * Math.PI * 2,
  });
}

function killEnemy(world: WorldState, enemy: Enemy): void {
  if (enemy.dying) return;
  releaseAttackToken(world, enemy);
  enemy.dying = true;
  enemy.deathTimer = 0.1;
  enemy.hp = 0;
  world.kills += 1;
  world.score += enemy.scoreValue;
  if (world.score > world.bestScore) {
    world.bestScore = world.score;
  }

  // Legendary Effect: Life Leech on kill (tuned so AFK standing cannot out-heal late hordes)
  if (computeHeroStats(world.player).hasLifeLeech) {
    const leech = enemy.isBoss || enemy.isElite ? 5 : nextRandom(world) < 0.3 ? 1 : 0;
    if (leech > 0) {
      world.player.hp = Math.min(world.player.maxHp, world.player.hp + leech);
    }
  }

  const deathColor =
    enemy.isElite && enemy.eliteColor
      ? enemy.eliteColor
      : enemy.kind === 'imp' || enemy.kind === 'boss_pyrolord'
        ? '#fb923c'
        : enemy.kind === 'charger' || enemy.kind === 'boss_behemoth'
          ? '#f87171'
          : enemy.kind === 'boss_frostqueen'
            ? '#38bdf8'
            : enemy.kind === 'bat'
              ? '#c084fc'
              : enemy.kind === 'lich_boss'
                ? '#fbbf24'
                : '#cbd5e1';

  spawnPixelShatter(world, enemy);

  spawnParticles(
    world,
    enemy.x,
    enemy.y,
    enemy.isBoss ? 24 : enemy.isElite ? 12 : 6,
    deathColor,
    60,
    enemy.isBoss ? 270 : 175,
    enemy.isBoss ? 5.2 : 3.5,
    0.42,
    enemy.isBoss || enemy.isElite ? 'ember' : 'spark'
  );
  const decalKind: GroundDecalKind =
    enemy.kind === 'boss_frostqueen'
      ? 'frost'
      : enemy.kind === 'imp' || enemy.kind === 'boss_pyrolord'
        ? 'scorch'
        : enemy.kind === 'bat' || enemy.kind === 'lich_boss'
          ? 'arcane'
          : 'blood';
  spawnGroundDecal(
    world,
    decalKind,
    enemy.x,
    enemy.y + 4,
    enemy.isBoss ? 48 : enemy.isElite ? 28 : 16,
    deathColor,
    enemy.isBoss ? 5.0 : 2.8
  );

  // Lag Fix #1: Hitstop STRICTLY reserved for Boss kills (never normal or elite kills!)
  if (enemy.isBoss) {
    world.hitstopTimer = Math.max(world.hitstopTimer, 0.065);
    world.hitstopCooldown = 0.8;
    world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.65);
    spawnImpactBurst(world, 'level_pillar', enemy.x, enemy.y, 0, 1.5, deathColor, 0.8);
    triggerScreenFlash(world, deathColor, 0.48);
  } else if (enemy.isElite) {
    world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.24);
    spawnImpactBurst(world, 'crit_star', enemy.x, enemy.y, 0, 36, deathColor, 0.3);
  } else {
    world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.06);
  }
  emitSound(world, enemy.isBoss ? 'boss_kill' : 'kill');

  // Ice Shatter: killing a slowed/frozen enemy shatters ice around them, dealing bonus Ice damage
  if (enemy.slowTimer > 0) {
    const iceNode = world.player.elementTree.ice;
    const shatterRadius = 88 + iceNode.areaLv * 12;
    const baseIceDmg = iceNode.unlocked
      ? computeElementalSkillDamage(world.player, 'ice')
      : world.player.atk;
    const shatterDmg = Math.max(8, Math.round(baseIceDmg * 0.85));

    world.novaRings.push({
      x: enemy.x,
      y: enemy.y,
      radius: 10,
      maxRadius: shatterRadius,
      life: 0.28,
      maxLife: 0.28,
      color: '#67e8f9',
    });
    spawnImpactBurst(world, 'frost_shatter', enemy.x, enemy.y, 0, Math.min(46, 26 + iceNode.areaLv * 2), '#67e8f9', 0.3);
    spawnParticles(world, enemy.x, enemy.y, 12, '#7dd3fc', 70, 210, 3.8, 0.38, 'spark');
    spawnGroundDecal(world, 'frost', enemy.x, enemy.y + 4, shatterRadius * 0.55, '#38bdf8', 2.8);
    spawnFloatingText(world, enemy.x, enemy.y - 28, '얼음 파쇄!', '#67e8f9', 1.12);
    emitSound(world, 'frost');

    for (let j = 0; j < world.enemies.length; j++) {
      const other = world.enemies[j];
      if (!other || other.dying || other.id === enemy.id) continue;
      const ox = other.x - enemy.x;
      const oy = other.y - enemy.y;
      const hitR = shatterRadius + other.radius;
      if (ox * ox + oy * oy <= hitR * hitR) {
        applyEnemyStatus(other, 'freeze', 1.6 + iceNode.powerLv * 0.15);
        damageEnemy(world, other, shatterDmg, enemy.x, enemy.y, 115, false, true, 'ice');
      }
    }
  }

  // Class on-kill passives (Wizard 불씨 전이, Warrior 독혈 흡수)
  onClassEnemyKilled(world, enemy, classCombatHooks);

  // 1. Auto-XP on enemy kill (grants XP directly + triggers Center-Screen Level-Up Animation without interrupting combat!)
  grantXpAndCheckLevelUp(world, enemy.xpValue, false);

  // 2. Level-scaled Gold Coin drops (starts at 1 coin = 1G at Lv.1, scales up with enemy level)
  spawnCoinsForEnemy(world, enemy);

  // Gear Drops: Bosses drop 1 gear + bonus Gold; Special Elites have 20% gear drop chance (else bonus Gold)
  const hasHunter = computeHeroStats(world.player).hasTreasureHunter;
  if (enemy.isBoss) {
    spawnLootDrop(world, enemy.x, enemy.y, 'boss');
    const bossGold = 35 + (hasHunter ? 15 : 0);
    world.player.gold += bossGold;
    spawnFloatingText(world, enemy.x, enemy.y - 26, `보스 격파! 장비 + ${bossGold}G 획득`, '#fde047', 1.2);
  } else if (enemy.isElite) {
    const eliteDropRate = ITEM_DROP_RATE_ELITE + (hasHunter ? 0.05 : 0);
    if (nextRandom(world) < eliteDropRate) {
      spawnLootDrop(world, enemy.x, enemy.y, 'elite');
      spawnFloatingText(world, enemy.x, enemy.y - 24, '특수 몬스터 처치! 장비 드랍', '#fde047', 1.12);
    } else {
      const goldGain = 14 + (hasHunter ? 8 : 0);
      world.player.gold += goldGain;
      spawnFloatingText(world, enemy.x, enemy.y - 24, `특수 몬스터 처치! +${goldGain}G`, '#fde047', 1.08);
    }
  }

  const roll = nextRandom(world);
  if (enemy.isBoss || (enemy.isElite && roll < 0.28) || (!enemy.isElite && roll < 0.01)) {
    world.pickups.push({
      id: world.nextEntityId++,
      kind: 'potion',
      x: enemy.x + 14,
      y: enemy.y - 8,
      vx: 30,
      vy: -20,
      value: enemy.isBoss ? 40 : 22,
      magnetized: false,
      bobPhase: 0,
    });
  } else if (roll < 0.036) {
    world.pickups.push({
      id: world.nextEntityId++,
      kind: 'magnet',
      x: enemy.x - 12,
      y: enemy.y + 8,
      vx: -25,
      vy: 20,
      value: 1,
      magnetized: false,
      bobPhase: 0,
    });
  }

  if (enemy.isBoss) {
    if (enemy.kind === 'lich_boss' && world.wave >= world.maxWaves) {
      world.pendingOutcome = 'victory';
      world.defeatDelayTimer = 0.55;
      world.bannerText = '종말의 고대 리치 군주 격파! 20단계 정복!';
      world.bannerTimer = 2.8;
      world.hudDirty = true;
      emitSound(world, 'victory');
    } else {
      world.bannerText = `${enemy.bossName ?? '보스'} 토벌 완료! 장비 + 강화 파편 드랍!`;
      world.bannerTimer = 2.6;
      world.hudDirty = true;
      emitSound(world, 'heal');
    }
  }
}

export function damagePlayer(world: WorldState, amount: number, sourceX: number, sourceY: number): boolean {
  const p = world.player;
  if (p.invulnTimer > 0 || world.pendingOutcome) return false;

  const stats = computeHeroStats(p);
  // Exact flat Armor defense subtraction: monster ATK minus player DEF (min 1)
  const dmg = Math.max(1, Math.round(amount - stats.def));
  p.hp = Math.max(0, p.hp - dmg);
  p.invulnTimer = world.wave >= 12 ? 0.22 : world.wave >= 7 ? 0.28 : 0.36;
  p.hitFlashTimer = 0.14;
  p.scaleX = 1.24;
  p.scaleY = 0.8;

  const dx = p.x - sourceX;
  const dy = p.y - sourceY;
  const len = Math.hypot(dx, dy) || 1;
  p.vx += (dx / len) * 140;
  p.vy += (dy / len) * 140;

  spawnFloatingText(world, p.x, p.y - 22, `-${dmg}`, '#ef4444', 1.2);
  spawnImpactBurst(world, 'hit_spark', p.x, p.y, Math.atan2(dy, dx), 24, '#ef4444', 0.22);
  spawnParticles(world, p.x, p.y, 12, '#ef4444', 70, 200, 4, 0.36, 'spark');
  world.damageVignette = Math.min(1, world.damageVignette + 0.85);

  // Brief hitstop on player damage only if cooldown elapsed
  if (world.hitstopCooldown <= 0) {
    world.hitstopTimer = Math.max(world.hitstopTimer, 0.032);
    world.hitstopCooldown = 0.75;
  }
  world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.42);
  emitSound(world, 'hurt');

  // Class on-hurt passives (Warrior Rage, 서리 갑옷, 열기 축적)
  onClassPlayerHurt(world, sourceX, sourceY, classCombatHooks);

  if (p.hp <= 0) {
    world.pendingOutcome = 'gameover';
    world.defeatDelayTimer = 0.52;
    world.hudDirty = true;
    emitSound(world, 'gameover');
  }
  return true;
}

export function applyEnemyStatus(enemy: Enemy, kind: StatusEffectKind, duration: number): void {
  if (enemy.dying || duration <= 0) return;
  if (kind === 'freeze') {
    enemy.slowTimer = Math.max(enemy.slowTimer, duration);
  } else if (kind === 'burn') {
    if (enemy.burnTimer <= 0) enemy.burnTickTimer = 0.55;
    enemy.burnTimer = Math.max(enemy.burnTimer, duration);
  } else {
    if (enemy.poisonTimer <= 0) enemy.poisonTickTimer = 0.65;
    enemy.poisonTimer = Math.max(enemy.poisonTimer, duration);
  }
}

export function applyPlayerStatus(world: WorldState, kind: StatusEffectKind, duration: number): void {
  const p = world.player;
  if (duration <= 0 || world.pendingOutcome) return;
  if (kind === 'freeze') {
    p.slowTimer = Math.max(p.slowTimer, duration);
  } else if (kind === 'burn') {
    if (p.burnTimer <= 0) p.burnTickTimer = 0.65;
    p.burnTimer = Math.max(p.burnTimer, duration);
  } else {
    if (p.poisonTimer <= 0) p.poisonTickTimer = 0.75;
    p.poisonTimer = Math.max(p.poisonTimer, duration);
  }
  world.hudDirty = true;
}

function findNearestEnemy(world: WorldState, x: number, y: number, maxRange: number): Enemy | null {
  let best: Enemy | null = null;
  let bestDistSq = maxRange * maxRange;
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.dying) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      best = e;
    }
  }
  return best;
}

function rebuildSpatialGrid(world: WorldState): void {
  spatialGrid.clear();
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (!e.dying) {
      spatialGrid.insert(i, e.x, e.y);
    }
  }
}

function updateClassBasicAttack(world: WorldState, dt: number): void {
  const p = world.player;
  const cfg = HERO_BASIC_WEAPON_CONFIG[p.heroClass];
  p.basicAttackTimer -= dt;
  if (p.basicAttackTimer > 0) return;

  const tyrantMult = p.heroClass === 'warrior' && p.tyrantTimer > 0 ? 1.55 : 1;
  const searchRange = p.heroClass === 'warrior' ? cfg.range * tyrantMult + 32 : cfg.range;
  const target = findNearestEnemy(world, p.x, p.y, searchRange);
  if (!target) return;

  p.basicAttackTimer = cfg.baseCooldown * p.cooldownMult;
  const angle = Math.atan2(target.y - p.y, target.x - p.x);
  p.aimAngle = angle;
  const baseDmg = Math.max(1, Math.round(p.atk * cfg.damageScale));

  if (p.heroClass === 'wizard') {
    // Wizard Starter Weapon: Magic Missile (baseline ATK & baseline ASPD)
    const speed = 495;
    world.projectiles.push({
      id: world.nextEntityId++,
      owner: 'player',
      kind: 'magic_missile',
      x: p.x + Math.cos(angle) * 14,
      y: p.y + Math.sin(angle) * 14,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 6.5,
      damage: baseDmg,
      life: 1.15,
      maxLife: 1.15,
      pierce: 0,
      hitIds: [],
      color: '#818cf8',
    });
    spawnImpactBurst(
      world,
      'muzzle_flash',
      p.x + Math.cos(angle) * 16,
      p.y + Math.sin(angle) * 16,
      angle,
      16,
      '#818cf8',
      0.14
    );
    emitSound(world, 'bolt');
  } else if (p.heroClass === 'warrior') {
    // Warrior Starter Weapon: Greatsword Cleave (high ATK, slower ASPD, wide sweeping arc + strong knockback)
    const reach = cfg.range * tyrantMult;
    spawnImpactBurst(world, 'slash_arc', p.x, p.y, angle, reach * 0.72, '#f8fafc', 0.24);
    spawnImpactBurst(world, 'slash_arc', p.x, p.y, angle, reach * 0.56, '#fb923c', 0.22);
    spawnParticles(
      world,
      p.x + Math.cos(angle) * (reach * 0.55),
      p.y + Math.sin(angle) * (reach * 0.55),
      8,
      '#fed7aa',
      70,
      195,
      3.5,
      0.24,
      'spark'
    );
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (!e || e.dying) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + e.radius) continue;
      let diff = Math.atan2(dy, dx) - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= 1.25 || dist <= 34 + e.radius) {
        damageEnemy(world, e, baseDmg, p.x, p.y, 225, true, true, undefined, 'physical');
      }
    }
    emitSound(world, 'dash');
  } else {
    // Archer Starter Weapon: Rapid Hunter Arrow (lower ATK per shot, much faster ASPD)
    const speed = 670;
    world.projectiles.push({
      id: world.nextEntityId++,
      owner: 'player',
      kind: 'hunter_arrow',
      x: p.x + Math.cos(angle) * 14,
      y: p.y + Math.sin(angle) * 14,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 5,
      damage: baseDmg,
      life: 1.05,
      maxLife: 1.05,
      pierce: 0,
      hitIds: [],
      color: '#4ade80',
      skillAttribute: 'physical',
    });
    spawnImpactBurst(
      world,
      'muzzle_flash',
      p.x + Math.cos(angle) * 16,
      p.y + Math.sin(angle) * 16,
      angle,
      11,
      '#86efac',
      0.1
    );
    emitSound(world, 'bolt');
  }
}

function updatePlayerWeapons(world: WorldState, dt: number): void {
  const p = world.player;

  // 0. Class Signature Starter Basic Weapon (Wizard Magic Missile / Warrior Greatsword / Archer Arrow)
  updateClassBasicAttack(world, dt);

  // 1. Legacy Arcane Bolt (only fires if explicitly present on p.weapons)
  const boltLv = p.weapons.arcane_bolt ?? 0;
  if (boltLv > 0) {
    p.weaponTimers.arcane_bolt -= dt;
    if (p.weaponTimers.arcane_bolt <= 0) {
      const target = findNearestEnemy(world, p.x, p.y, 490);
      if (target) {
        const baseCd = boltLv >= 5 ? 0.82 : boltLv >= 3 ? 0.85 : 0.88;
        p.weaponTimers.arcane_bolt = baseCd * p.cooldownMult;
        const count = boltLv >= 5 ? 4 : boltLv >= 4 ? 3 : boltLv >= 2 ? 2 : 1;
        const dmg = (16 + (boltLv - 1) * 5) * p.damageMult;
        const pierce = boltLv >= 5 ? 2 : boltLv >= 3 ? 1 : 0;
        const baseAngle = Math.atan2(target.y - p.y, target.x - p.x);
        p.aimAngle = baseAngle;

        for (let i = 0; i < count; i++) {
          const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.14;
          const a = baseAngle + spread;
          const speed = boltLv >= 5 ? 540 : 470;
          world.projectiles.push({
            id: world.nextEntityId++,
            owner: 'player',
            kind: 'bolt',
            x: p.x + Math.cos(a) * 14,
            y: p.y + Math.sin(a) * 14,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            radius: 6,
            damage: dmg,
            life: 1.15,
            maxLife: 1.15,
            pierce,
            hitIds: [],
            color: '#fbbf24',
          });
        }
        spawnImpactBurst(
          world,
          'muzzle_flash',
          p.x + Math.cos(baseAngle) * 16,
          p.y + Math.sin(baseAngle) * 16,
          baseAngle,
          16,
          '#fbbf24',
          0.14
        );
        emitSound(world, 'bolt');
      }
    }
  }

  // 2. Orbiting Blades (Lv.5 rotation & tick speed reduced to 50% so standing AFK cannot permanently knockback-lock hordes)
  const bladeLv = p.weapons.orbit_blades ?? 0;
  if (bladeLv > 0) {
    const rotSpeed = (bladeLv >= 5 ? 2.2 : bladeLv >= 3 ? 1.9 : 1.6) / p.cooldownMult;
    p.orbitAngle += rotSpeed * dt;
    p.weaponTimers.orbit_blades -= dt;
    if (p.weaponTimers.orbit_blades <= 0) {
      p.weaponTimers.orbit_blades = 0.24;
      const bladeCount = bladeLv >= 5 ? 5 : bladeLv >= 4 ? 4 : bladeLv >= 2 ? 3 : 2;
      const orbitR = 62 + bladeLv * 8;
      const dmg = (13 + bladeLv * 3.5) * p.damageMult;
      const kb = bladeLv >= 4 ? 125 : 95;

      for (let b = 0; b < bladeCount; b++) {
        const a = p.orbitAngle + (b / bladeCount) * Math.PI * 2;
        const bx = p.x + Math.cos(a) * orbitR;
        const by = p.y + Math.sin(a) * orbitR;
        spatialGrid.forEachNeighbor(bx, by, 1, (idx) => {
          const e = world.enemies[idx];
          if (!e || e.dying) return;
          const r = e.radius + 15;
          const dx = e.x - bx;
          const dy = e.y - by;
          if (dx * dx + dy * dy <= r * r) {
            spawnImpactBurst(world, 'slash_arc', e.x, e.y, a + Math.PI / 2, 24, '#93c5fd', 0.16);
            applyEnemyStatus(e, 'poison', 3.0);
            damageEnemy(world, e, dmg, p.x, p.y, kb, false, true, 'poison');
          }
        });
      }
    }
  }

  // 3. Chain Lightning (Lv.5 fire rate capped to 50% of previous speed)
  const lightLv = p.weapons.chain_lightning ?? 0;
  if (lightLv > 0) {
    p.weaponTimers.chain_lightning -= dt;
    if (p.weaponTimers.chain_lightning <= 0) {
      const first = findNearestEnemy(world, p.x, p.y, 410);
      if (first) {
        const baseCd = lightLv >= 5 ? 3.7 : lightLv >= 3 ? 3.85 : 4.1;
        p.weaponTimers.chain_lightning = baseCd * p.cooldownMult;
        const chains = lightLv >= 5 ? 8 : lightLv >= 4 ? 6 : lightLv >= 2 ? 4 : 3;
        const dmg = (20 + lightLv * 6) * p.damageMult;
        const visited = new Set<number>();
        const points: Array<{ x: number; y: number }> = [{ x: p.x, y: p.y - 8 }];
        let cur: Enemy | null = first;

        for (let i = 0; i < chains && cur; i++) {
          visited.add(cur.id);
          points.push({ x: cur.x, y: cur.y });
          spawnImpactBurst(world, 'hit_spark', cur.x, cur.y, i * 1.1, 22, '#7dd3fc', 0.22);
          spawnParticles(world, cur.x, cur.y, 4, '#7dd3fc', 65, 165, 3, 0.24, 'spark');
          damageEnemy(world, cur, dmg, p.x, p.y, 75, i === 0, true, 'lightning');
          let next: Enemy | null = null;
          let bestD2 = 220 * 220;
          for (let j = 0; j < world.enemies.length; j++) {
            const cand = world.enemies[j];
            if (cand.dying || visited.has(cand.id)) continue;
            const d2 = (cand.x - cur.x) ** 2 + (cand.y - cur.y) ** 2;
            if (d2 < bestD2) {
              bestD2 = d2;
              next = cand;
            }
          }
          cur = next;
        }
        world.lightningArcs.push({ points, life: 0.26, maxLife: 0.26, color: '#7dd3fc' });
        emitSound(world, 'lightning');
      }
    }
  }

  // 4. Ember Nova (Lv.5 fire rate capped to 50% of previous speed)
  const novaLv = p.weapons.ember_nova ?? 0;
  if (novaLv > 0) {
    p.weaponTimers.ember_nova -= dt;
    if (p.weaponTimers.ember_nova <= 0) {
      const baseCd = novaLv >= 5 ? 4.8 : novaLv >= 3 ? 5.0 : 5.4;
      p.weaponTimers.ember_nova = baseCd * p.cooldownMult;
      const radius = 105 + novaLv * 24;
      const dmg = (22 + novaLv * 8) * p.damageMult;
      spawnGroundDecal(world, 'scorch', p.x, p.y + 4, radius * 0.65, '#ea580c', 3.2);
      world.novaRings.push({
        x: p.x,
        y: p.y,
        radius: 18,
        maxRadius: radius,
        life: 0.36,
        maxLife: 0.36,
        color: '#fb923c',
      });
      const cellRange = Math.ceil((radius + 32) / GRID_CELL_SIZE);
      spatialGrid.forEachNeighbor(p.x, p.y, cellRange, (idx) => {
        const e = world.enemies[idx];
        if (!e || e.dying) return;
        const r = radius + e.radius;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy <= r * r) {
          applyEnemyStatus(e, 'burn', 3.4);
          damageEnemy(world, e, dmg, p.x, p.y, 175, true, true, 'fire');
        }
      });
      spawnParticles(world, p.x, p.y, 18, '#fb923c', 85, 240, 4.4, 0.44, 'ember');
      emitSound(world, 'nova');
    }
  }

  // 5. Frost Lance (Lv.5 fire rate capped to 50% of previous speed)
  const frostLv = p.weapons.frost_lance ?? 0;
  if (frostLv > 0) {
    p.weaponTimers.frost_lance -= dt;
    if (p.weaponTimers.frost_lance <= 0) {
      const target = findNearestEnemy(world, p.x, p.y, 500);
      if (target) {
        const baseCd = frostLv >= 5 ? 2.5 : frostLv >= 4 ? 2.65 : 2.9;
        p.weaponTimers.frost_lance = baseCd * p.cooldownMult;
        const count = frostLv >= 5 ? 3 : frostLv >= 3 ? 2 : 1;
        const pierce = 2 + frostLv * 2;
        const dmg = (20 + frostLv * 6) * p.damageMult;
        const baseAngle = Math.atan2(target.y - p.y, target.x - p.x);

        for (let i = 0; i < count; i++) {
          const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.22;
          const a = baseAngle + spread;
          world.projectiles.push({
            id: world.nextEntityId++,
            owner: 'player',
            kind: 'frost',
            x: p.x + Math.cos(a) * 16,
            y: p.y + Math.sin(a) * 16,
            vx: Math.cos(a) * 520,
            vy: Math.sin(a) * 520,
            radius: 8,
            damage: dmg,
            life: 1.2,
            maxLife: 1.2,
            pierce,
            hitIds: [],
            color: '#67e8f9',
            element: 'ice',
          });
        }
        spawnImpactBurst(
          world,
          'muzzle_flash',
          p.x + Math.cos(baseAngle) * 18,
          p.y + Math.sin(baseAngle) * 18,
          baseAngle,
          18,
          '#67e8f9',
          0.16
        );
        emitSound(world, 'frost');
      }
    }
  }

  // 6. Holy Chakram (Lv.5 fire rate capped to 50% of previous speed)
  const chakramLv = p.weapons.holy_chakram ?? 0;
  if (chakramLv > 0) {
    p.weaponTimers.holy_chakram -= dt;
    if (p.weaponTimers.holy_chakram <= 0) {
      const target = findNearestEnemy(world, p.x, p.y, 460);
      const baseAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.aimAngle;
      const baseCd = chakramLv >= 5 ? 3.4 : chakramLv >= 4 ? 3.6 : 3.9;
      p.weaponTimers.holy_chakram = baseCd * p.cooldownMult;
      const count = chakramLv >= 5 ? 3 : chakramLv >= 3 ? 2 : 1;
      const dmg = (22 + chakramLv * 7) * p.damageMult;
      const radius = chakramLv >= 2 ? 13 : 10;

      for (let i = 0; i < count; i++) {
        const a = baseAngle + (count === 1 ? 0 : (i - (count - 1) / 2) * 0.45);
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'chakram',
          x: p.x + Math.cos(a) * 14,
          y: p.y + Math.sin(a) * 14,
          vx: Math.cos(a) * 410,
          vy: Math.sin(a) * 410,
          radius,
          damage: dmg,
          life: 1.9,
          maxLife: 1.9,
          pierce: 99,
          hitIds: [],
          color: '#fde047',
          element: 'poison',
          returning: false,
          spin: 0,
        });
      }
      spawnImpactBurst(
        world,
        'muzzle_flash',
        p.x + Math.cos(baseAngle) * 16,
        p.y + Math.sin(baseAngle) * 16,
        baseAngle,
        18,
        '#fde047',
        0.16
      );
      emitSound(world, 'chakram');
    }
  }

  // 7. 4-Element Mage Skill Tree Auto-Casting (Damage = Weapon ATK + Element ATK, Area = Area Branch)
  updateElementalMagic(world, dt);
}

function updateElementalMagic(world: WorldState, dt: number): void {
  const p = world.player;
  const tree = p.elementTree;

  // Fire: 폭발 화염구 — explodes and deals Fire damage to ALL enemies inside radius (radius scales up to Lv.10)
  if (tree.fire.unlocked) {
    p.elementTimers.fire -= dt;
    if (p.elementTimers.fire <= 0) {
      const target = findNearestEnemy(world, p.x, p.y, 500);
      if (target) {
        p.elementTimers.fire = 1.95 * p.cooldownMult;
        const dmg = computeElementalSkillDamage(p, 'fire');
        const aoeRadius = getElementAreaValue(tree, 'fire');
        const a = Math.atan2(target.y - p.y, target.x - p.x);

        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'fireball',
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 440,
          vy: Math.sin(a) * 440,
          radius: 10 + Math.min(5, tree.fire.areaLv * 0.5),
          damage: dmg,
          life: 1.2,
          maxLife: 1.2,
          pierce: 0,
          hitIds: [],
          color: '#fb923c',
          element: 'fire',
          aoeRadius,
        });
        spawnImpactBurst(world, 'muzzle_flash', p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a, 20, '#fb923c', 0.16);
        emitSound(world, 'nova');
      }
    }
  }

  // Ice: 빙하 파편창 — pierces enemies (pierce count scales Lv.0=1 -> Lv.10=11), slows enemies, and slowed kills shatter!
  if (tree.ice.unlocked) {
    p.elementTimers.ice -= dt;
    if (p.elementTimers.ice <= 0) {
      const target = findNearestEnemy(world, p.x, p.y, 520);
      if (target) {
        p.elementTimers.ice = 1.95 * p.cooldownMult;
        const dmg = computeElementalSkillDamage(p, 'ice');
        const pierceCount = getElementAreaValue(tree, 'ice'); // Lv.0 = 1 pierce -> Lv.10 = 11 pierces
        const a = Math.atan2(target.y - p.y, target.x - p.x);

        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'frost',
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 560,
          vy: Math.sin(a) * 560,
          radius: 9,
          damage: dmg,
          life: 1.35,
          maxLife: 1.35,
          pierce: pierceCount,
          hitIds: [],
          color: '#38bdf8',
          element: 'ice',
        });
        spawnImpactBurst(world, 'muzzle_flash', p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a, 18, '#38bdf8', 0.16);
        emitSound(world, 'frost');
      }
    }
  }

  // Lightning: 연쇄 뇌격 — chains from 1 target at Lv.0 up to 11 targets at Lv.10!
  if (tree.lightning.unlocked) {
    p.elementTimers.lightning -= dt;
    if (p.elementTimers.lightning <= 0) {
      const firstRange = 380 + tree.lightning.areaLv * 24;
      const first = findNearestEnemy(world, p.x, p.y, firstRange);
      if (first) {
        p.elementTimers.lightning = 2.15 * p.cooldownMult;
        const dmg = computeElementalSkillDamage(p, 'lightning');
        const chains = getElementAreaValue(tree, 'lightning'); // Lv.0 = 1 target -> Lv.10 = 11 targets
        const chainRange = 220 + tree.lightning.areaLv * 24;
        const visited = new Set<number>();
        const points: Array<{ x: number; y: number }> = [{ x: p.x, y: p.y - 8 }];
        let cur: Enemy | null = first;

        for (let i = 0; i < chains && cur; i++) {
          visited.add(cur.id);
          points.push({ x: cur.x, y: cur.y });
          spawnImpactBurst(world, 'hit_spark', cur.x, cur.y, i * 1.1, 24, '#fde047', 0.22);
          spawnParticles(world, cur.x, cur.y, 4, '#fde047', 65, 175, 3.2, 0.24, 'spark');
          damageEnemy(world, cur, dmg, p.x, p.y, 75, i === 0, true, 'lightning');
          if (i + 1 >= chains) break;
          let next: Enemy | null = null;
          let bestD2 = chainRange * chainRange;
          for (let j = 0; j < world.enemies.length; j++) {
            const cand = world.enemies[j];
            if (cand.dying || visited.has(cand.id)) continue;
            const d2 = (cand.x - cur.x) ** 2 + (cand.y - cur.y) ** 2;
            if (d2 < bestD2) {
              bestD2 = d2;
              next = cand;
            }
          }
          cur = next;
        }
        world.lightningArcs.push({ points, life: 0.28, maxLife: 0.28, color: '#fde047' });
        emitSound(world, 'lightning');
      }
    }
  }

  // Poison: 맹독 우물구 — hitting an enemy spawns a Poison Well at impact; radius grows Lv.0 -> Lv.10
  if (tree.poison.unlocked) {
    p.elementTimers.poison -= dt;
    if (p.elementTimers.poison <= 0) {
      const target = findNearestEnemy(world, p.x, p.y, 480);
      if (target) {
        p.elementTimers.poison = 2.1 * p.cooldownMult;
        const dmg = computeElementalSkillDamage(p, 'poison');
        const wellRadius = getElementAreaValue(tree, 'poison');
        const a = Math.atan2(target.y - p.y, target.x - p.x);

        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'poison_orb',
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 410,
          vy: Math.sin(a) * 410,
          radius: 10,
          damage: dmg,
          life: 1.3,
          maxLife: 1.3,
          pierce: 0,
          hitIds: [],
          color: '#4ade80',
          element: 'poison',
          aoeRadius: wellRadius,
        });
        spawnImpactBurst(world, 'muzzle_flash', p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a, 18, '#4ade80', 0.16);
        emitSound(world, 'bolt');
      }
    }
  }
}

function updateBossAI(
  world: WorldState,
  e: Enemy,
  dt: number,
  dx: number,
  dy: number,
  dist: number,
  dirX: number,
  dirY: number,
  spd: number
): void {
  const p = world.player;
  const enraged = e.hp < e.maxHp * 0.5;
  const cdScale = enraged ? 0.78 : 1;

  if (e.kind === 'boss_behemoth') {
    if (e.aiState === 'chase') {
      e.vx = dirX * spd;
      e.vy = dirY * spd;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0 && dist < 460) {
        e.aiState = 'windup';
        e.telegraphAngle = Math.atan2(dy, dx);
        e.telegraphTargetX = e.x + Math.cos(e.telegraphAngle) * 290;
        e.telegraphTargetY = e.y + Math.sin(e.telegraphAngle) * 290;
        if (e.attackPattern === 0) {
          e.aiTimer = 0.58 * cdScale;
          e.patternRepeat = enraged ? 2 : 1;
        } else {
          e.aiTimer = 0.75 * cdScale;
          world.hazards.push({
            id: world.nextEntityId++,
            shape: 'circle',
            x: e.x,
            y: e.y,
            radius: 128,
            timer: e.aiTimer,
            duration: e.aiTimer,
            damage: 24,
            color: '#ef4444',
          });
        }
        emitSound(world, 'telegraph');
      }
    } else if (e.aiState === 'windup') {
      e.vx = 0;
      e.vy = 0;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        if (e.attackPattern === 0) {
          e.aiState = 'action';
          e.aiTimer = 0.44;
        } else {
          world.novaRings.push({
            x: e.x,
            y: e.y,
            radius: 20,
            maxRadius: 135,
            life: 0.3,
            maxLife: 0.3,
            color: '#ef4444',
            isEnemy: true,
          });
          const count = enraged ? 10 : 8;
          for (let k = 0; k < count; k++) {
            const a = (k / count) * Math.PI * 2 + e.telegraphAngle;
            world.projectiles.push({
              id: world.nextEntityId++,
              owner: 'enemy',
              kind: 'rock_shard',
              x: e.x + Math.cos(a) * 22,
              y: e.y + Math.sin(a) * 22,
              vx: Math.cos(a) * 250,
              vy: Math.sin(a) * 250,
              radius: 8,
              damage: 16,
              life: 2.2,
              maxLife: 2.2,
              pierce: 0,
              hitIds: [],
              color: '#f87171',
            });
          }
          world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.35);
          e.attackPattern = 0;
          e.aiState = 'recover';
          e.aiTimer = 1.2 * cdScale;
        }
      }
    } else if (e.aiState === 'action') {
      const chargeSpd = enraged ? 450 : 405;
      e.vx = Math.cos(e.telegraphAngle) * chargeSpd;
      e.vy = Math.sin(e.telegraphAngle) * chargeSpd;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        if (e.patternRepeat > 0) {
          e.patternRepeat -= 1;
          e.aiState = 'windup';
          e.aiTimer = 0.48 * cdScale;
          e.telegraphAngle = Math.atan2(p.y - e.y, p.x - e.x);
          e.telegraphTargetX = e.x + Math.cos(e.telegraphAngle) * 290;
          e.telegraphTargetY = e.y + Math.sin(e.telegraphAngle) * 290;
          emitSound(world, 'telegraph');
        } else {
          e.attackPattern = 1;
          e.aiState = 'recover';
          e.aiTimer = 1.05 * cdScale;
        }
      }
    } else {
      e.vx *= 0.82;
      e.vy *= 0.82;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiState = 'chase';
        e.aiTimer = 1.45 * cdScale;
      }
    }
    return;
  }

  if (e.kind === 'boss_pyrolord') {
    if (e.aiState === 'chase') {
      e.vx = dirX * spd;
      e.vy = dirY * spd;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiState = 'windup';
        e.aiTimer = 0.62 * cdScale;
        e.telegraphAngle = Math.atan2(dy, dx);
        emitSound(world, 'telegraph');
      }
    } else if (e.aiState === 'windup') {
      e.vx *= 0.8;
      e.vy *= 0.8;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        if (e.attackPattern === 0) {
          e.aiState = 'action';
          e.patternRepeat = enraged ? 2 : 1;
          e.aiTimer = 0.01;
        } else {
          const offsets = [
            [0, 0],
            [95, 0],
            [-95, 0],
            [0, 95],
            [0, -95],
          ];
          const count = enraged ? 5 : 4;
          for (let m = 0; m < count; m++) {
            const [ox, oy] = offsets[m];
            world.hazards.push({
              id: world.nextEntityId++,
              shape: 'circle',
              x: p.x + ox,
              y: p.y + oy,
              radius: 58,
              timer: 0.85 * cdScale,
              duration: 0.85 * cdScale,
              damage: 22,
              color: '#fb923c',
            });
          }
          if (e.hp < e.maxHp * 0.6 && world.enemies.length < 64) {
            for (let s = 0; s < 2; s++) {
              const a = e.telegraphAngle + (s === 0 ? 1.2 : -1.2);
              spawnEnemyAt(world, 'imp', e.x + Math.cos(a) * 65, e.y + Math.sin(a) * 65);
            }
          }
          e.attackPattern = 0;
          e.aiState = 'recover';
          e.aiTimer = 1.35 * cdScale;
        }
      }
    } else if (e.aiState === 'action') {
      e.vx = 0;
      e.vy = 0;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        const orbs = enraged ? 10 : 8;
        const spinOffset = e.patternRepeat * 0.34;
        for (let k = 0; k < orbs; k++) {
          const a = e.telegraphAngle + spinOffset + (k / orbs) * Math.PI * 2;
          world.projectiles.push({
            id: world.nextEntityId++,
            owner: 'enemy',
            kind: 'fire_orb',
            x: e.x + Math.cos(a) * 22,
            y: e.y + Math.sin(a) * 22,
            vx: Math.cos(a) * 225,
            vy: Math.sin(a) * 225,
            radius: 8,
            damage: 18,
            life: 2.7,
            maxLife: 2.7,
            pierce: 0,
            hitIds: [],
            color: '#fb923c',
          });
        }
        emitSound(world, 'nova');
        if (e.patternRepeat > 0) {
          e.patternRepeat -= 1;
          e.aiTimer = 0.35;
        } else {
          e.attackPattern = 1;
          e.aiState = 'recover';
          e.aiTimer = 1.3 * cdScale;
        }
      }
    } else {
      e.vx = dirX * spd * 0.45;
      e.vy = dirY * spd * 0.45;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiState = 'chase';
        e.aiTimer = 1.5 * cdScale;
      }
    }
    return;
  }

  if (e.kind === 'boss_frostqueen') {
    if (e.aiState === 'chase') {
      if (dist > 260) {
        e.vx = dirX * spd;
        e.vy = dirY * spd;
      } else if (dist < 150) {
        e.vx = -dirX * spd * 0.7;
        e.vy = -dirY * spd * 0.7;
      } else {
        e.vx = -dirY * e.orbitSign * spd * 0.7;
        e.vy = dirX * e.orbitSign * spd * 0.7;
      }
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiState = 'windup';
        e.aiTimer = 0.68 * cdScale;
        e.telegraphAngle = Math.atan2(dy, dx);
        if (e.attackPattern === 0) {
          const base = enraged ? e.telegraphAngle : e.telegraphAngle + Math.PI / 4;
          for (let b = 0; b < 4; b++) {
            const a = base + (b * Math.PI) / 2;
            world.hazards.push({
              id: world.nextEntityId++,
              shape: 'beam',
              x: e.x,
              y: e.y,
              radius: 22,
              angle: a,
              length: 440,
              timer: 0.78 * cdScale,
              duration: 0.78 * cdScale,
              damage: 24,
              color: '#38bdf8',
            });
          }
        }
        emitSound(world, 'telegraph');
      }
    } else if (e.aiState === 'windup') {
      e.vx *= 0.75;
      e.vy *= 0.75;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        if (e.attackPattern === 1) {
          const count = enraged ? 9 : 7;
          const baseA = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = 0; k < count; k++) {
            const spread = (k - (count - 1) / 2) * 0.19;
            const a = baseA + spread;
            world.projectiles.push({
              id: world.nextEntityId++,
              owner: 'enemy',
              kind: 'ice_shard',
              x: e.x + Math.cos(a) * 20,
              y: e.y + Math.sin(a) * 20,
              vx: Math.cos(a) * 290,
              vy: Math.sin(a) * 290,
              radius: 7,
              damage: 19,
              life: 2.3,
              maxLife: 2.3,
              pierce: 0,
              hitIds: [],
              color: '#67e8f9',
            });
          }
          emitSound(world, 'frost');
        } else if (e.attackPattern === 2) {
          const flankA = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI * 0.75 * e.orbitSign;
          const nx = p.x + Math.cos(flankA) * 220;
          const ny = p.y + Math.sin(flankA) * 220;
          spawnParticles(world, e.x, e.y, 12, '#67e8f9', 40, 140, 4, 0.35);
          e.x = nx;
          e.y = ny;
          spawnParticles(world, e.x, e.y, 14, '#bae6fd', 50, 160, 4, 0.38);
          world.hazards.push({
            id: world.nextEntityId++,
            shape: 'circle',
            x: e.x,
            y: e.y,
            radius: 112,
            timer: 0.65 * cdScale,
            duration: 0.65 * cdScale,
            damage: 23,
            color: '#38bdf8',
          });
          emitSound(world, 'frost');
        }
        e.attackPattern = (e.attackPattern + 1) % 3;
        e.aiState = 'recover';
        e.aiTimer = 1.2 * cdScale;
      }
    } else {
      e.vx = dirX * spd * 0.4;
      e.vy = dirY * spd * 0.4;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiState = 'chase';
        e.aiTimer = 1.35 * cdScale;
      }
    }
    return;
  }

  // BOSS 4 (Stage 20 Final): Ancient Lich Lord
  if (e.aiState === 'chase') {
    e.vx = dirX * spd;
    e.vy = dirY * spd;
    e.aiTimer -= dt;
    if (e.aiTimer <= 0) {
      e.aiState = 'windup';
      e.aiTimer = 0.68 * cdScale;
      e.telegraphAngle = Math.atan2(dy, dx);
      if (e.attackPattern === 2) {
        world.hazards.push({
          id: world.nextEntityId++,
          shape: 'beam',
          x: e.x,
          y: e.y,
          radius: 28,
          angle: e.telegraphAngle,
          length: 460,
          timer: 0.72 * cdScale,
          duration: 0.72 * cdScale,
          damage: 28,
          color: '#c084fc',
        });
      }
      emitSound(world, 'telegraph');
    }
  } else if (e.aiState === 'windup') {
    e.vx *= 0.78;
    e.vy *= 0.78;
    e.aiTimer -= dt;
    if (e.aiTimer <= 0) {
      if (e.attackPattern === 0) {
        const baseA = Math.atan2(p.y - e.y, p.x - e.x);
        const fanHalf = enraged ? 3 : 2;
        for (let k = -fanHalf; k <= fanHalf; k++) {
          const a = baseA + k * 0.22;
          world.projectiles.push({
            id: world.nextEntityId++,
            owner: 'enemy',
            kind: 'boss_orb',
            x: e.x + Math.cos(a) * 24,
            y: e.y + Math.sin(a) * 24,
            vx: Math.cos(a) * 255,
            vy: Math.sin(a) * 255,
            radius: 9,
            damage: 22,
            life: 2.8,
            maxLife: 2.8,
            pierce: 0,
            hitIds: [],
            color: '#c084fc',
          });
        }
        e.attackPattern = 1;
        e.aiState = 'recover';
        e.aiTimer = 1.15 * cdScale;
      } else if (e.attackPattern === 1) {
        const ringCount = enraged ? 5 : 3;
        for (let h = 0; h < ringCount; h++) {
          const a = (h / ringCount) * Math.PI * 2 + e.telegraphAngle;
          const r = h === 0 ? 0 : 105;
          world.hazards.push({
            id: world.nextEntityId++,
            shape: 'circle',
            x: p.x + Math.cos(a) * r,
            y: p.y + Math.sin(a) * r,
            radius: 60,
            timer: 0.82 * cdScale,
            duration: 0.82 * cdScale,
            damage: 26,
            color: '#c084fc',
          });
        }
        e.attackPattern = 2;
        e.aiState = 'recover';
        e.aiTimer = 1.2 * cdScale;
      } else {
        e.aiState = 'action';
        e.aiTimer = 0.36;
        if (world.enemies.length < 70) {
          for (let s = 0; s < 2; s++) {
            const a = e.telegraphAngle + (s === 0 ? 1.4 : -1.4);
            spawnEnemyAt(world, 'bat', e.x + Math.cos(a) * 58, e.y + Math.sin(a) * 58);
          }
        }
      }
    }
  } else if (e.aiState === 'action') {
    e.vx = Math.cos(e.telegraphAngle) * 430;
    e.vy = Math.sin(e.telegraphAngle) * 430;
    e.aiTimer -= dt;
    if (e.aiTimer <= 0) {
      e.attackPattern = 0;
      e.aiState = 'recover';
      e.aiTimer = 1.15 * cdScale;
    }
  } else {
    e.vx = dirX * spd * 0.4;
    e.vy = dirY * spd * 0.4;
    e.aiTimer -= dt;
    if (e.aiTimer <= 0) {
      e.aiState = 'chase';
      e.aiTimer = 1.4 * cdScale;
    }
  }
}

function updateEnemies(world: WorldState, dt: number): void {
  const p = world.player;

  // Uses the single spatialGrid built once at start of stepWorld (no redundant rebuilds!)
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
    if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);

    if (e.dying) {
      e.deathTimer -= dt;
      e.x += e.knockVx * dt;
      e.y += e.knockVy * dt;
      e.knockVx *= Math.pow(0.08, dt);
      e.knockVy *= Math.pow(0.08, dt);
      continue;
    }

    // Status Effect DoTs & Pooled Ambient Status Particles (Burn / Poison / Freeze)
    if (e.burnTimer > 0) {
      e.burnTimer = Math.max(0, e.burnTimer - dt);
      e.burnTickTimer -= dt;
      if (e.burnTickTimer <= 0 && !e.dying) {
        e.burnTickTimer = 0.55;
        const fireBonus = p.elementTree.fire.unlocked ? p.elementTree.fire.powerLv * 4 : 0;
        const burnDmg = Math.max(4, Math.round(p.atk * 0.36 + fireBonus));
        e.hp -= burnDmg;
        if (world.enemies.length < 48 || e.isBoss || e.isElite) {
          spawnFloatingText(world, e.x, e.y - e.radius - 2, `${burnDmg}`, '#fb923c', 0.92);
        }
        if (e.hp <= 0) {
          killEnemy(world, e);
          continue;
        }
      }
    }
    if (e.poisonTimer > 0) {
      e.poisonTimer = Math.max(0, e.poisonTimer - dt);
      e.poisonTickTimer -= dt;
      if (e.poisonTickTimer <= 0 && !e.dying) {
        e.poisonTickTimer = 0.65;
        const poisonBonus = p.elementTree.poison.unlocked ? p.elementTree.poison.powerLv * 5 : 0;
        const poisonDmg = Math.max(3, Math.round(p.atk * 0.28 + poisonBonus));
        e.hp -= poisonDmg;
        if (world.enemies.length < 48 || e.isBoss || e.isElite) {
          spawnFloatingText(world, e.x, e.y - e.radius - 2, `${poisonDmg}`, '#4ade80', 0.92);
        }
        if (e.hp <= 0) {
          killEnemy(world, e);
          continue;
        }
      }
    }
    if (e.slowTimer > 0 || e.burnTimer > 0 || e.poisonTimer > 0) {
      e.statusVfxAccum += dt;
      const vfxInterval = world.enemies.length > 65 ? 0.36 : 0.2;
      if (e.statusVfxAccum >= vfxInterval) {
        e.statusVfxAccum = 0;
        const ox = (nextRandom(world) - 0.5) * e.radius * 1.3;
        if (e.burnTimer > 0) {
          spawnParticles(world, e.x + ox, e.y - 2, 1, '#fb923c', 12, 34, 3.0, 0.36, 'ember');
        }
        if (e.poisonTimer > 0) {
          spawnParticles(world, e.x + ox, e.y - 2, 1, '#4ade80', 10, 28, 2.8, 0.42, 'ember');
        }
        if (e.slowTimer > 0) {
          spawnParticles(world, e.x + ox, e.y, 1, '#bae6fd', 12, 30, 2.5, 0.26, 'spark');
        }
      }
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Infinite Open Field: seamlessly wrap far-away normal mobs ahead of hero so action never dries up
    if (!e.isBoss && !e.isElite && dist > 1050) {
      const wrapAngle = p.aimAngle + (nextRandom(world) - 0.5) * 1.6;
      const wrapDist = 470 + nextRandom(world) * 130;
      e.x = p.x + Math.cos(wrapAngle) * wrapDist;
      e.y = p.y + Math.sin(wrapAngle) * wrapDist;
      continue;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;
    const slowMult = e.stunTimer > 0 ? 0.08 : e.slowTimer > 0 ? 0.55 : 1;
    const spd = e.speed * slowMult;

    if (e.aiState === 'chase') {
      e.facing = dirX < -0.05 ? -1 : dirX > 0.05 ? 1 : e.facing;
    }

    if (e.isBoss) {
      updateBossAI(world, e, dt, dx, dy, dist, dirX, dirY, spd);
    } else if (e.kind === 'skeleton') {
      e.vx = dirX * spd;
      e.vy = dirY * spd;
    } else if (e.kind === 'bat') {
      const tangX = -dirY * e.orbitSign;
      const tangY = dirX * e.orbitSign;
      const flankWeight = dist > 110 ? 0.62 : 0.25;
      const pullWeight = dist > 90 ? 0.78 : 0.95;
      e.vx = (dirX * pullWeight + tangX * flankWeight) * spd;
      e.vy = (dirY * pullWeight + tangY * flankWeight) * spd;
    } else if (e.kind === 'imp') {
      if (e.aiState === 'chase') {
        e.aiTimer -= dt;
        if (dist > 235) {
          e.vx = dirX * spd;
          e.vy = dirY * spd;
        } else if (dist < 145) {
          e.vx = -dirX * spd * 0.72;
          e.vy = -dirY * spd * 0.72;
        } else {
          e.vx = -dirY * e.orbitSign * spd * 0.5;
          e.vy = dirX * e.orbitSign * spd * 0.5;
        }

        if (e.aiTimer <= 0 && dist < 340 && world.attackTokensUsed < world.maxAttackTokens) {
          e.aiState = 'windup';
          e.aiTimer = 0.6;
          e.telegraphAngle = Math.atan2(dy, dx);
          e.telegraphTargetX = p.x;
          e.telegraphTargetY = p.y;
          e.hasAttackToken = true;
          world.attackTokensUsed += 1;
          emitSound(world, 'telegraph');
        }
      } else if (e.aiState === 'windup') {
        e.vx = 0;
        e.vy = 0;
        e.telegraphAngle = Math.atan2(dy, dx);
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          const a = e.telegraphAngle;
          world.projectiles.push({
            id: world.nextEntityId++,
            owner: 'enemy',
            kind: 'imp_orb',
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 235,
            vy: Math.sin(a) * 235,
            radius: 7,
            damage: e.damage,
            life: 2.3,
            maxLife: 2.3,
            pierce: 0,
            hitIds: [],
            color: '#fb923c',
          });
          releaseAttackToken(world, e);
          e.aiState = 'recover';
          e.aiTimer = 1.05;
        }
      } else {
        e.vx *= 0.85;
        e.vy *= 0.85;
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          e.aiState = 'chase';
          e.aiTimer = 1.1 + nextRandom(world) * 0.7;
        }
      }
    } else if (e.kind === 'charger') {
      if (e.aiState === 'chase') {
        e.vx = dirX * spd;
        e.vy = dirY * spd;
        e.aiTimer -= dt;
        if (e.aiTimer <= 0 && dist < 260 && dist > 65 && world.attackTokensUsed < world.maxAttackTokens) {
          e.aiState = 'windup';
          e.aiTimer = 0.65;
          e.telegraphAngle = Math.atan2(dy, dx);
          e.telegraphTargetX = e.x + Math.cos(e.telegraphAngle) * 240;
          e.telegraphTargetY = e.y + Math.sin(e.telegraphAngle) * 240;
          e.hasAttackToken = true;
          world.attackTokensUsed += 1;
          emitSound(world, 'telegraph');
        }
      } else if (e.aiState === 'windup') {
        e.vx = 0;
        e.vy = 0;
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          e.aiState = 'action';
          e.aiTimer = 0.42;
        }
      } else if (e.aiState === 'action') {
        const chargeSpd = 385 * slowMult;
        e.vx = Math.cos(e.telegraphAngle) * chargeSpd;
        e.vy = Math.sin(e.telegraphAngle) * chargeSpd;
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          releaseAttackToken(world, e);
          e.aiState = 'recover';
          e.aiTimer = 0.85;
        }
      } else {
        e.vx *= 0.82;
        e.vy *= 0.82;
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          e.aiState = 'chase';
          e.aiTimer = 1.3 + nextRandom(world) * 0.6;
        }
      }
    }

    // O(1) Spatial-Hash local separation (capped to 6 closest neighbors)
    let sepX = 0;
    let sepY = 0;
    let checks = 0;
    spatialGrid.forEachNeighbor(e.x, e.y, 1, (j) => {
      if (j === i || checks >= 6) return checks < 6;
      const other = world.enemies[j];
      if (!other || other.dying) return;
      const sx = e.x - other.x;
      const sy = e.y - other.y;
      const minDist = e.radius + other.radius + 3;
      const d2 = sx * sx + sy * sy;
      if (d2 > 0.01 && d2 < minDist * minDist) {
        const d = Math.sqrt(d2);
        const push = (minDist - d) / minDist;
        sepX += (sx / d) * push * 92;
        sepY += (sy / d) * push * 92;
        checks += 1;
      }
    });

    // Free infinite-world movement (no arena wall clamping!)
    e.x += (e.vx + e.knockVx + sepX) * dt;
    e.y += (e.vy + e.knockVy + sepY) * dt;
    e.strideDist += Math.hypot(e.vx * dt, e.vy * dt);

    e.knockVx *= Math.pow(0.008, dt);
    e.knockVy *= Math.pow(0.008, dt);

    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    if (pd < p.radius + e.radius - 2) {
      if (damagePlayer(world, e.damage, e.x, e.y)) {
        if (e.kind === 'bat' || e.eliteTitle?.includes('공허')) {
          applyPlayerStatus(world, 'poison', 2.8);
        } else if (e.kind === 'boss_frostqueen' || e.eliteTitle?.includes('서리')) {
          applyPlayerStatus(world, 'freeze', 2.2);
        } else if (e.kind === 'imp' || e.kind === 'boss_pyrolord') {
          applyPlayerStatus(world, 'burn', 2.4);
        }
      }
    }
  }
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return (px - x1) ** 2 + (py - y1) ** 2;
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return (px - x2) ** 2 + (py - y2) ** 2;
  const t = c1 / c2;
  const projX = x1 + t * vx;
  const projY = y1 + t * vy;
  return (px - projX) ** 2 + (py - projY) ** 2;
}

function updateProjectilesAndHazards(world: WorldState, dt: number): void {
  const p = world.player;

  // Uses the single spatialGrid built once per frame (zero redundant rebuild!)
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const pr = world.projectiles[i];
    pr.life -= dt;

    if (pr.kind === 'chakram') {
      pr.spin = (pr.spin ?? 0) + dt * 16;
      if (!pr.returning && pr.life < pr.maxLife * 0.56) {
        pr.returning = true;
        pr.hitIds.length = 0;
      }
      if (pr.returning) {
        const dx = p.x - pr.x;
        const dy = p.y - pr.y;
        const d = Math.hypot(dx, dy) || 1;
        pr.vx += (dx / d) * 1450 * dt;
        pr.vy += (dy / d) * 1450 * dt;
        const spd = Math.hypot(pr.vx, pr.vy);
        if (spd > 520) {
          pr.vx = (pr.vx / spd) * 520;
          pr.vy = (pr.vy / spd) * 520;
        }
        if (d < 22) {
          swapRemove(world.projectiles, i);
          continue;
        }
      }
    }

    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (
      pr.life <= 0 ||
      Math.abs(pr.x - p.x) > 1050 ||
      Math.abs(pr.y - p.y) > 1050
    ) {
      swapRemove(world.projectiles, i);
      continue;
    }

    if (pr.owner === 'player') {
      let consumed = false;
      spatialGrid.forEachNeighbor(pr.x, pr.y, 1, (idx) => {
        if (consumed) return false;
        const e = world.enemies[idx];
        if (!e || e.dying || pr.hitIds.includes(e.id)) return;
        const r = e.radius + pr.radius;
        const dx = e.x - pr.x;
        const dy = e.y - pr.y;
        if (dx * dx + dy * dy <= r * r) {
          pr.hitIds.push(e.id);
          if (pr.kind === 'fireball') {
            // Fire AoE explosion: damages ALL enemies inside blast radius with Fire elemental damage + Burn
            const blastR = pr.aoeRadius ?? 68;
            const burnDur = 3.0 + p.elementTree.fire.powerLv * 0.35;
            world.novaRings.push({
              x: pr.x,
              y: pr.y,
              radius: 14,
              maxRadius: blastR,
              life: 0.34,
              maxLife: 0.34,
              color: '#fb923c',
            });
            spawnGroundDecal(world, 'scorch', pr.x, pr.y + 4, blastR * 0.72, '#fb923c', 3.0);
            spawnParticles(world, pr.x, pr.y, 16, '#fb923c', 70, Math.min(280, 140 + blastR * 0.6), 4.2, 0.42, 'ember');
            const cellRange = Math.ceil((blastR + 32) / GRID_CELL_SIZE);
            spatialGrid.forEachNeighbor(pr.x, pr.y, cellRange, (nIdx) => {
              const other = world.enemies[nIdx];
              if (!other || other.dying) return;
              const ox = other.x - pr.x;
              const oy = other.y - pr.y;
              const hitR = blastR + other.radius;
              if (ox * ox + oy * oy <= hitR * hitR) {
                applyEnemyStatus(other, 'burn', burnDur);
                damageEnemy(world, other, pr.damage, pr.x, pr.y, 150, true, true, 'fire');
              }
            });
            consumed = true;
            return false;
          }

          if (pr.kind === 'poison_orb') {
            // Poison hit: deals initial Poison hit + spawns a persistent Poison Well at impact location
            const wellRadius = pr.aoeRadius ?? 56;
            const poisonDur = 3.2 + p.elementTree.poison.powerLv * 0.35;
            applyEnemyStatus(e, 'poison', poisonDur);
            damageEnemy(world, e, pr.damage, pr.x, pr.y, 85, true, true, 'poison');

            const well: PoisonWell = {
              id: world.nextEntityId++,
              x: e.x,
              y: e.y,
              radius: wellRadius,
              life: 4.6 + p.elementTree.poison.areaLv * 0.22,
              maxLife: 4.6 + p.elementTree.poison.areaLv * 0.22,
              tickTimer: 0.12,
              damagePerTick: Math.max(5, Math.round(pr.damage * 0.42)),
              poisonDur,
            };
            if (world.poisonWells.length >= 12) {
              world.poisonWells.shift();
            }
            world.poisonWells.push(well);

            world.novaRings.push({
              x: e.x,
              y: e.y,
              radius: 10,
              maxRadius: wellRadius,
              life: 0.28,
              maxLife: 0.28,
              color: '#4ade80',
            });
            spawnParticles(world, e.x, e.y, 12, '#4ade80', 45, 145, 3.8, 0.4, 'ember');
            consumed = true;
            return false;
          }

          if (pr.kind === 'frost' || pr.kind === 'frost_arrow' || pr.kind === 'ice_petal') {
            const freezeDur = 2.8 + p.elementTree.ice.powerLv * 0.3;
            applyEnemyStatus(e, 'freeze', freezeDur);
            spawnImpactBurst(world, 'frost_shatter', e.x, e.y, Math.atan2(pr.vy, pr.vx), 22, '#67e8f9', 0.22);
            spawnGroundDecal(world, 'frost', e.x, e.y + 4, 20, '#38bdf8', 2.4);
            spawnParticles(world, e.x, e.y, 5, '#67e8f9', 50, 150, 3.2, 0.26, 'spark');
          } else if (pr.kind === 'chakram' || pr.kind === 'poison_dart') {
            applyEnemyStatus(e, 'poison', 3.2);
            if (pr.kind === 'chakram') {
              spawnImpactBurst(world, 'slash_arc', e.x, e.y, Math.atan2(pr.vy, pr.vx), 28, '#fde047', 0.18);
            }
          } else if (pr.kind === 'incendiary_arrow') {
            applyEnemyStatus(e, 'burn', 3.2);
          }
          onClassProjectileHit(world, pr, e, classCombatHooks);
          damageEnemy(
            world,
            e,
            pr.damage,
            pr.x,
            pr.y,
            pr.kind === 'sky_arrow' ? 240 : pr.kind === 'steel_arrow' ? 175 : pr.kind === 'frost' ? 110 : 140,
            pr.kind === 'chakram' || pr.kind === 'sky_arrow',
            true,
            pr.element,
            pr.skillAttribute
          );
          if (pr.pierce > 0) {
            pr.pierce -= 1;
          } else {
            consumed = true;
            return false;
          }
        }
      });
      if (consumed) {
        swapRemove(world.projectiles, i);
      }
    } else {
      const r = p.radius + pr.radius - 2;
      const dx = p.x - pr.x;
      const dy = p.y - pr.y;
      if (dx * dx + dy * dy <= r * r) {
        if (damagePlayer(world, pr.damage, pr.x, pr.y)) {
          if (pr.kind === 'imp_orb' || pr.kind === 'fire_orb') {
            applyPlayerStatus(world, 'burn', 2.4);
          } else if (pr.kind === 'ice_shard') {
            applyPlayerStatus(world, 'freeze', 2.2);
          } else if (pr.kind === 'boss_orb') {
            applyPlayerStatus(world, 'poison', 2.8);
          }
        }
        swapRemove(world.projectiles, i);
      }
    }
  }

  for (let i = world.hazards.length - 1; i >= 0; i--) {
    const h = world.hazards[i];
    h.timer -= dt;
    if (h.timer <= 0) {
      if (h.shape === 'beam') {
        const a = h.angle ?? 0;
        const len = h.length ?? 400;
        const ex = h.x + Math.cos(a) * len;
        const ey = h.y + Math.sin(a) * len;
        const hitW = h.radius + p.radius * 0.55;
        if (pointToSegmentDistSq(p.x, p.y, h.x, h.y, ex, ey) <= hitW * hitW) {
          if (damagePlayer(world, h.damage, h.x, h.y)) {
            if (h.color === '#38bdf8') applyPlayerStatus(world, 'freeze', 2.4);
            else if (h.color === '#c084fc') applyPlayerStatus(world, 'poison', 2.8);
            else applyPlayerStatus(world, 'burn', 2.4);
          }
        }
        world.lightningArcs.push({
          points: [
            { x: h.x, y: h.y },
            { x: ex, y: ey },
          ],
          life: 0.22,
          maxLife: 0.22,
          color: h.color,
        });
        spawnParticles(
          world,
          h.x + Math.cos(a) * (len * 0.5),
          h.y + Math.sin(a) * (len * 0.5),
          10,
          h.color,
          40,
          140,
          4,
          0.3
        );
      } else {
        world.novaRings.push({
          x: h.x,
          y: h.y,
          radius: 12,
          maxRadius: h.radius,
          life: 0.28,
          maxLife: 0.28,
          color: h.color,
          isEnemy: true,
        });
        spawnGroundDecal(
          world,
          h.color === '#38bdf8' ? 'frost' : h.color === '#c084fc' ? 'arcane' : 'scorch',
          h.x,
          h.y,
          h.radius * 0.72,
          h.color,
          3.4
        );
        spawnParticles(world, h.x, h.y, 14, h.color, 60, 170, 4, 0.4, 'ember');
        if (Math.hypot(p.x - h.x, p.y - h.y) <= h.radius + p.radius * 0.5) {
          if (damagePlayer(world, h.damage, h.x, h.y)) {
            if (h.color === '#38bdf8') applyPlayerStatus(world, 'freeze', 2.4);
            else if (h.color === '#c084fc') applyPlayerStatus(world, 'poison', 2.8);
            else applyPlayerStatus(world, 'burn', 2.4);
          }
        }
      }
      swapRemove(world.hazards, i);
    }
  }

  // Player Poison Wells: damage & poison any enemy passing over them
  for (let i = world.poisonWells.length - 1; i >= 0; i--) {
    const well = world.poisonWells[i];
    well.life -= dt;
    if (well.life <= 0) {
      swapRemove(world.poisonWells, i);
      continue;
    }
    well.tickTimer -= dt;
    if (well.tickTimer <= 0) {
      well.tickTimer = 0.45;
      const cellRange = Math.ceil((well.radius + 32) / GRID_CELL_SIZE);
      spatialGrid.forEachNeighbor(well.x, well.y, cellRange, (nIdx) => {
        const other = world.enemies[nIdx];
        if (!other || other.dying) return;
        const ox = other.x - well.x;
        const oy = other.y - well.y;
        const hitR = well.radius + other.radius;
        if (ox * ox + oy * oy <= hitR * hitR) {
          applyEnemyStatus(other, 'poison', well.poisonDur);
          damageEnemy(world, other, well.damagePerTick, well.x, well.y, 20, false, false, 'poison');
        }
      });
      if (nextRandom(world) < 0.75) {
        const a = nextRandom(world) * Math.PI * 2;
        const rr = nextRandom(world) * well.radius * 0.8;
        spawnParticles(
          world,
          well.x + Math.cos(a) * rr,
          well.y + Math.sin(a) * rr,
          2,
          '#4ade80',
          12,
          45,
          3.0,
          0.38,
          'ember'
        );
      }
    }
  }
}

function updateChestsAndLoot(world: WorldState, dt: number): void {
  const p = world.player;

  // Auto-open treasure chests when hero approaches within 58px
  for (let i = 0; i < world.chests.length; i++) {
    const ch = world.chests[i];
    ch.bobPhase += dt * 3.2;
    if (ch.opened) continue;
    const dx = ch.x - p.x;
    const dy = ch.y - p.y;
    if (dx * dx + dy * dy <= 58 * 58) {
      openWorldChest(world, ch);
    }
  }

  // Update ground loot drops & open comparison modal when hero walks onto them
  for (let i = world.lootDrops.length - 1; i >= 0; i--) {
    const drop = world.lootDrops[i];
    drop.bobPhase += dt * 4.2;
    if (drop.pickupDelay > 0) drop.pickupDelay = Math.max(0, drop.pickupDelay - dt);
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.vx *= Math.pow(0.03, dt);
    drop.vy *= Math.pow(0.03, dt);

    if (drop.pickupDelay <= 0 && world.phase === 'playing' && !world.pendingOutcome) {
      const dx = drop.x - p.x;
      const dy = drop.y - p.y;
      if (dx * dx + dy * dy <= 56 * 56) {
        inspectLootDrop(world, drop);
        return;
      }
    }
  }
}

function updatePickups(world: WorldState, dt: number): void {
  const p = world.player;
  if (world.gemComboTimer > 0) {
    world.gemComboTimer -= dt;
    if (world.gemComboTimer <= 0) world.gemCombo = 0;
  }

  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const pk = world.pickups[i];
    pk.bobPhase += dt * 4.5;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.vx *= Math.pow(0.05, dt);
    pk.vy *= Math.pow(0.05, dt);

    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const distSq = dx * dx + dy * dy;

    if (!pk.magnetized && distSq <= p.pickupRadius * p.pickupRadius) {
      pk.magnetized = true;
    }

    if (pk.magnetized) {
      const dist = Math.sqrt(distSq) || 1;
      const pullSpd = 490;
      pk.x += (dx / dist) * pullSpd * dt;
      pk.y += (dy / dist) * pullSpd * dt;
    }

    const collectR = p.radius + 14;
    if (distSq <= collectR * collectR) {
      if (pk.kind === 'potion') {
        const healed = Math.min(p.maxHp - p.hp, pk.value);
        p.hp = Math.min(p.maxHp, p.hp + pk.value);
        spawnFloatingText(world, p.x, p.y - 20, `+${Math.round(healed || pk.value)} HP`, '#86efac', 1.1);
        spawnImpactBurst(world, 'pickup_flash', p.x, p.y, 0, 28, '#4ade80', 0.26);
        spawnParticles(world, pk.x, pk.y, 10, '#86efac', 45, 130, 3.6, 0.38, 'ember');
        emitSound(world, 'heal');
      } else if (pk.kind === 'coin') {
        p.gold += pk.value;
        world.score += pk.value * 2;
        if (world.score > world.bestScore) world.bestScore = world.score;
        spawnFloatingText(world, p.x, p.y - 18, `+${pk.value}G`, '#facc15', 1.0);
        spawnImpactBurst(world, 'pickup_flash', p.x, p.y, 0, 18, '#facc15', 0.16);
        emitSound(world, 'coin');
        world.hudDirty = true;
      } else if (pk.kind === 'magnet') {
        for (let m = 0; m < world.pickups.length; m++) {
          const mk = world.pickups[m].kind;
          if (mk.startsWith('xp_') || mk === 'coin') world.pickups[m].magnetized = true;
        }
        world.novaRings.push({
          x: p.x,
          y: p.y,
          radius: 18,
          maxRadius: 170,
          life: 0.34,
          maxLife: 0.34,
          color: '#c084fc',
        });
        spawnImpactBurst(world, 'pickup_flash', p.x, p.y, 0, 34, '#c084fc', 0.28);
        spawnFloatingText(world, p.x, p.y - 20, '자석 발동!', '#c084fc', 1.15);
        emitSound(world, 'heal');
      } else {
        world.gemCombo = Math.min(12, world.gemCombo + 1);
        world.gemComboTimer = 1.4;
        spawnImpactBurst(world, 'pickup_flash', p.x, p.y, 0, 18, '#38bdf8', 0.16);
        emitSound(world, 'gem');
        grantXpAndCheckLevelUp(world, pk.value, false);
      }
      swapRemove(world.pickups, i);
    }
  }
}

function updateMerchant(world: WorldState, dt: number): void {
  if (world.merchantAlertTimer > 0) {
    world.merchantAlertTimer = Math.max(0, world.merchantAlertTimer - dt);
    if (world.merchantAlertTimer <= 0) {
      world.hudDirty = true;
    }
  }
  if (world.merchantReopenCooldown > 0) {
    world.merchantReopenCooldown = Math.max(0, world.merchantReopenCooldown - dt);
  }

  const m = world.merchant;
  if (m.active) {
    m.timer -= dt;
    m.bobPhase += dt * 3.5;
    if (m.timer <= 0) {
      m.active = false;
      m.timer = 0;
      world.merchantCooldown = 28 + nextRandom(world) * 18;
      world.bannerText = '장비 상인이 다음 전장으로 떠났습니다.';
      world.bannerTimer = 2.4;
      world.hudDirty = true;
      return;
    }

    if (world.phase === 'playing' && !world.pendingOutcome && world.merchantReopenCooldown <= 0) {
      const dx = m.x - world.player.x;
      const dy = m.y - world.player.y;
      if (dx * dx + dy * dy <= 64 * 64) {
        openMerchantShop(world);
      }
    }
  } else {
    world.merchantCooldown -= dt;
    if (world.merchantCooldown <= 0) {
      spawnMerchantNow(world);
    }
  }
}

function updateWavesAndSpawning(world: WorldState, dt: number): void {
  const targetWave = Math.min(world.maxWaves, Math.floor(world.elapsed / WAVE_DURATION_SEC) + 1);
  if (targetWave > world.wave) {
    world.wave = targetWave;
    const cfg = WAVE_CONFIGS[world.wave - 1];
    world.bannerText = cfg.title;
    world.bannerTimer = 3.0;
    world.hudDirty = true;
    evaluateBiomeProgression(world);

    if (cfg.bossKind && !world.bossSpawnedWaves.has(world.wave)) {
      world.bossSpawnedWaves.add(world.wave);
      const a = nextRandom(world) * Math.PI * 2;
      const bx = world.player.x + Math.cos(a) * 440;
      const by = world.player.y + Math.sin(a) * 440;
      spawnEnemyAt(world, cfg.bossKind, bx, by);
      triggerBossAlert(world, cfg.bossKind, world.wave);
      const accent = BOSS_META[cfg.bossKind].accent;
      spawnImpactBurst(world, 'level_pillar', bx, by, 0, 1.6, accent, 0.85);
      world.novaRings.push({
        x: bx,
        y: by,
        radius: 18,
        maxRadius: 150,
        life: 0.42,
        maxLife: 0.42,
        color: accent,
        isEnemy: true,
      });
      triggerScreenFlash(world, accent, 0.45);
      world.cameraTrauma = Math.min(1, world.cameraTrauma + 0.55);
      emitSound(world, 'boss');
    } else if (world.wave === 3 || world.wave === 8 || world.wave === 12 || world.wave === 17) {
      // Dedicated Special Elite Squad wave arrival!
      const a = nextRandom(world) * Math.PI * 2;
      spawnEnemyAt(world, 'charger', world.player.x + Math.cos(a) * 420, world.player.y + Math.sin(a) * 420, true);
    }
  }

  // Scale simultaneous special attacker tokens in later stages so hordes pressure stationary players
  world.maxAttackTokens = world.wave >= 15 ? 7 : world.wave >= 10 ? 6 : world.wave >= 6 ? 5 : 4;

  const cfg = WAVE_CONFIGS[Math.min(world.wave - 1, WAVE_CONFIGS.length - 1)];
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0) {
    let activeCount = 0;
    let eliteCount = 0;
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (!e.dying) {
        activeCount += 1;
        if (e.isElite) eliteCount += 1;
      }
    }
    const maxElites = world.wave >= 12 ? 5 : 3;
    if (activeCount < cfg.maxEnemies) {
      world.spawnTimer = cfg.spawnInterval;
      const toSpawn = Math.min(cfg.batchSize, cfg.maxEnemies - activeCount);
      for (let b = 0; b < toSpawn; b++) {
        const a = nextRandom(world) * Math.PI * 2;
        const r = 400 + nextRandom(world) * 140;
        const sx = world.player.x + Math.cos(a) * r;
        const sy = world.player.y + Math.sin(a) * r;
        const spawnElite = eliteCount < maxElites && nextRandom(world) < cfg.eliteChance;
        if (spawnElite) eliteCount += 1;
        spawnEnemyAt(world, pickEnemyKindForWave(world), sx, sy, spawnElite);
      }
    } else {
      world.spawnTimer = 0.2;
    }
  }
}

function tickVisualEffects(world: WorldState, dt: number): void {
  if (world.cameraTrauma > 0) {
    world.cameraTrauma = Math.max(0, world.cameraTrauma - dt * 1.85);
  }
  if (world.damageVignette > 0) {
    world.damageVignette = Math.max(0, world.damageVignette - dt * 2.4);
  }
  if (world.screenFlashTimer > 0) {
    world.screenFlashTimer = Math.max(0, world.screenFlashTimer - dt);
  }
  if (world.bannerTimer > 0) {
    world.bannerTimer = Math.max(0, world.bannerTimer - dt);
    if (world.bannerTimer <= 0) world.bannerText = null;
  }
  if (world.bossAlertTimer > 0) {
    world.bossAlertTimer = Math.max(0, world.bossAlertTimer - dt);
    if (world.bossAlertTimer <= 0) {
      world.hudDirty = true;
    }
  }
  if (world.levelUpAnimTimer > 0) {
    world.levelUpAnimTimer = Math.max(0, world.levelUpAnimTimer - dt);
    if (world.levelUpAnimTimer <= 0) {
      world.hudDirty = true;
    }
  }
  if (world.biomeBlend < 1) {
    world.biomeBlend = Math.min(1, world.biomeBlend + dt * 0.75);
  }

  for (let i = 0; i < world.particles.length; i++) {
    const pt = world.particles[i];
    if (!pt.active) continue;
    pt.life -= dt;
    if (pt.life <= 0) {
      pt.active = false;
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += pt.gravity * dt;
    pt.vx *= Math.pow(0.2, dt);
  }

  for (let i = 0; i < world.pixelShards.length; i++) {
    const s = world.pixelShards[i];
    if (!s.active) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.active = false;
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 520 * dt;
    s.rotation += s.rotSpeed * dt;
    if (s.y >= s.groundY && s.vy > 0) {
      s.y = s.groundY;
      if (s.bounces < 2 && s.vy > 48) {
        s.vy = -s.vy * 0.46;
        s.vx *= 0.62;
        s.rotSpeed *= 0.6;
        s.bounces += 1;
      } else {
        s.vy = 0;
        s.vx *= Math.pow(0.06, dt);
        s.rotSpeed = 0;
      }
    }
  }

  for (let i = 0; i < world.impactBursts.length; i++) {
    const b = world.impactBursts[i];
    if (!b.active) continue;
    b.life -= dt;
    if (b.life <= 0) b.active = false;
  }

  for (let i = 0; i < world.afterimages.length; i++) {
    const g = world.afterimages[i];
    if (!g.active) continue;
    g.life -= dt;
    if (g.life <= 0) g.active = false;
  }

  for (let i = 0; i < world.groundDecals.length; i++) {
    const d = world.groundDecals[i];
    if (!d.active) continue;
    d.life -= dt;
    if (d.life <= 0) d.active = false;
  }

  for (let i = 0; i < world.floatingTexts.length; i++) {
    const ft = world.floatingTexts[i];
    if (!ft.active) continue;
    ft.life -= dt;
    if (ft.life <= 0) {
      ft.active = false;
      continue;
    }
    ft.y += ft.vy * dt;
    ft.vy *= Math.pow(0.18, dt);
  }

  for (let i = world.lightningArcs.length - 1; i >= 0; i--) {
    world.lightningArcs[i].life -= dt;
    if (world.lightningArcs[i].life <= 0) swapRemove(world.lightningArcs, i);
  }

  for (let i = world.novaRings.length - 1; i >= 0; i--) {
    const r = world.novaRings[i];
    r.life -= dt;
    const progress = 1 - Math.max(0, r.life) / r.maxLife;
    r.radius = 16 + (r.maxRadius - 16) * (1 - Math.pow(1 - progress, 3));
    if (r.life <= 0) swapRemove(world.novaRings, i);
  }
}

export function stepWorld(world: WorldState, rawDt: number, input: InputState): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return;

  if (
    world.phase === 'paused' ||
    world.phase === 'loot' ||
    world.phase === 'merchant' ||
    world.phase === 'skill_tree'
  ) {
    input.dashJustPressed = false;
    return;
  }

  tickVisualEffects(world, dt);

  if (world.phase !== 'playing') {
    input.dashJustPressed = false;
    return;
  }

  if (world.pendingOutcome) {
    world.defeatDelayTimer -= dt;
    if (world.defeatDelayTimer <= 0) {
      world.phase = world.pendingOutcome;
      world.pendingOutcome = null;
      world.hudDirty = true;
    }
    input.dashJustPressed = false;
    return;
  }

  if (world.hitstopCooldown > 0) {
    world.hitstopCooldown = Math.max(0, world.hitstopCooldown - dt);
  }

  if (world.hitstopTimer > 0) {
    world.hitstopTimer = Math.max(0, world.hitstopTimer - dt);
    if (world.player.hitFlashTimer > 0) {
      world.player.hitFlashTimer = Math.max(0, world.player.hitFlashTimer - dt);
    }
    input.dashJustPressed = false;
    return;
  }

  const p = world.player;
  world.elapsed += dt;
  if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  if (p.hitFlashTimer > 0) p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
  if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (p.dashBufferTimer > 0) p.dashBufferTimer = Math.max(0, p.dashBufferTimer - dt);

  // Player Status Effects (Freeze slow + Burn / Poison DoT + ambient particles)
  const hadPlayerStatus = p.slowTimer > 0 || p.burnTimer > 0 || p.poisonTimer > 0;
  if (p.slowTimer > 0) p.slowTimer = Math.max(0, p.slowTimer - dt);
  if (p.burnTimer > 0) {
    p.burnTimer = Math.max(0, p.burnTimer - dt);
    p.burnTickTimer -= dt;
    if (p.burnTickTimer <= 0 && !world.pendingOutcome) {
      p.burnTickTimer = 0.65;
      if (p.dashActiveTimer <= 0 && p.hp > 1) {
        const burnDmg = Math.max(1, Math.min(p.hp - 1, Math.round(p.maxHp * 0.015)));
        p.hp = Math.max(1, p.hp - burnDmg);
        spawnFloatingText(world, p.x, p.y - 22, `-${burnDmg}`, '#fb923c', 1.0);
        world.hudDirty = true;
      }
    }
  }
  if (p.poisonTimer > 0) {
    p.poisonTimer = Math.max(0, p.poisonTimer - dt);
    p.poisonTickTimer -= dt;
    if (p.poisonTickTimer <= 0 && !world.pendingOutcome) {
      p.poisonTickTimer = 0.75;
      if (p.dashActiveTimer <= 0 && p.hp > 1) {
        const poisonDmg = Math.max(1, Math.min(p.hp - 1, Math.round(p.maxHp * 0.012)));
        p.hp = Math.max(1, p.hp - poisonDmg);
        spawnFloatingText(world, p.x, p.y - 22, `-${poisonDmg}`, '#4ade80', 1.0);
        world.hudDirty = true;
      }
    }
  }
  const hasPlayerStatusNow = p.slowTimer > 0 || p.burnTimer > 0 || p.poisonTimer > 0;
  if (hadPlayerStatus && !hasPlayerStatusNow) {
    world.hudDirty = true;
  }
  if (hasPlayerStatusNow) {
    p.statusVfxAccum += dt;
    if (p.statusVfxAccum >= 0.14) {
      p.statusVfxAccum = 0;
      const ox = (nextRandom(world) - 0.5) * 20;
      if (p.burnTimer > 0) {
        spawnParticles(world, p.x + ox, p.y - 2, 1, '#fb923c', 14, 36, 3.2, 0.36, 'ember');
      }
      if (p.poisonTimer > 0) {
        spawnParticles(world, p.x + ox, p.y - 2, 1, '#4ade80', 10, 28, 3.0, 0.42, 'ember');
      }
      if (p.slowTimer > 0) {
        spawnParticles(world, p.x + ox, p.y, 1, '#bae6fd', 12, 30, 2.6, 0.28, 'spark');
      }
    }
  }

  p.scaleX += (1 - p.scaleX) * Math.min(1, dt * 14);
  p.scaleY += (1 - p.scaleY) * Math.min(1, dt * 14);

  let moveX = 0;
  let moveY = 0;
  let analogThrottle = 1;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) moveY -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) moveY += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) moveX -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) moveX += 1;

  if (moveX !== 0 || moveY !== 0) {
    input.waypointActive = false;
  } else if (input.joyActive && (Math.abs(input.joyX) > 0.001 || Math.abs(input.joyY) > 0.001)) {
    input.waypointActive = false;
    moveX = input.joyX;
    moveY = input.joyY;
    analogThrottle = Math.min(1, Math.hypot(moveX, moveY));
  } else if (input.pointerActive) {
    const dx = input.pointerWorldX - p.x;
    const dy = input.pointerWorldY - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 14) {
      moveX = dx / dist;
      moveY = dy / dist;
    }
  } else if (input.waypointActive) {
    const dx = input.waypointX - p.x;
    const dy = input.waypointY - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 14) {
      input.waypointActive = false;
    } else {
      moveX = dx / dist;
      moveY = dy / dist;
    }
  }

  const mLen = Math.hypot(moveX, moveY);
  if (mLen > 0.01) {
    moveX /= mLen;
    moveY /= mLen;
    p.aimAngle = Math.atan2(moveY, moveX);
    if (Math.abs(moveX) > 0.08) {
      p.facing = moveX < 0 ? -1 : 1;
    }
  }

  if (input.dashJustPressed) {
    input.dashJustPressed = false;
    triggerDash(world, mLen > 0.01 ? moveX : undefined, mLen > 0.01 ? moveY : undefined);
  } else if (p.dashBufferTimer > 0 && p.dashCooldown <= 0 && p.dashActiveTimer <= 0) {
    triggerDash(world, mLen > 0.01 ? moveX : undefined, mLen > 0.01 ? moveY : undefined);
  }

  if (p.dashActiveTimer > 0) {
    p.dashActiveTimer = Math.max(0, p.dashActiveTimer - dt);
    p.vx = p.dashDirX * 620;
    p.vy = p.dashDirY * 620;
    world.dashGhostAccum += dt;
    if (world.dashGhostAccum >= 0.028) {
      world.dashGhostAccum = 0;
      spawnAfterimage(world, p.x, p.y, p.facing, '#fde047', 0.22, 1.0);
    }
    spawnParticles(world, p.x, p.y + 4, 2, '#fbbf24', 15, 65, 3.4, 0.22, 'spark');
  } else {
    world.dashGhostAccum = 0;
    const playerSlowMult = p.slowTimer > 0 ? 0.72 : 1;
    const targetVx = moveX * analogThrottle * p.moveSpeed * playerSlowMult;
    const targetVy = moveY * analogThrottle * p.moveSpeed * playerSlowMult;
    const accel = mLen > 0.01 ? 14 : 11;
    p.vx += (targetVx - p.vx) * Math.min(1, dt * accel);
    p.vy += (targetVy - p.vy) * Math.min(1, dt * accel);
  }

  // Infinite Open Field: zero arena wall clamping!
  const prevX = p.x;
  const prevY = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const movedDist = Math.hypot(p.x - prevX, p.y - prevY);
  p.strideDist += movedDist;
  if (p.dashActiveTimer <= 0 && movedDist > 0.2) {
    world.footstepDustAccum += movedDist;
    if (world.footstepDustAccum >= 38) {
      world.footstepDustAccum = 0;
      const dustColor =
        world.biomeIndex === 1
          ? '#fb923c'
          : world.biomeIndex === 2
            ? '#bae6fd'
            : world.biomeIndex === 3
              ? '#c084fc'
              : '#94a3b8';
      spawnParticles(world, p.x, p.y + 11, 1, dustColor, 10, 32, 2.4, 0.28, 'ember');
    }
  }

  world.cameraX += (p.x - world.cameraX) * Math.min(1, dt * 8.5);
  world.cameraY += (p.y - world.cameraY) * Math.min(1, dt * 8.5);

  ensureChunksAroundPlayer(world);

  // Lag Fix #2: Build infinite spatial hash EXACTLY ONCE per frame for weapons, separation, AND projectiles!
  rebuildSpatialGrid(world);

  updatePlayerWeapons(world, dt);
  updateClassSkillsAndZones(world, dt, movedDist, classCombatHooks);
  updateWavesAndSpawning(world, dt);
  updateEnemies(world, dt);
  updateProjectilesAndHazards(world, dt);

  // Compact expired dying enemies with O(1) swap-and-pop AFTER all spatialGrid lookups finish
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.dying && e.deathTimer <= 0) {
      swapRemove(world.enemies, i);
    }
  }

  updateChestsAndLoot(world, dt);
  if (world.phase === 'playing') {
    updateMerchant(world, dt);
  }
  if (world.phase === 'playing') {
    updatePickups(world, dt);
  }
}

export function getHudSnapshot(world: WorldState): HudSnapshot {
  const p = world.player;
  const boss = world.enemies.find((e) => e.isBoss && !e.dying);
  const bossMeta = boss && isBossKind(boss.kind) ? BOSS_META[boss.kind] : null;
  const biomeDef = BIOME_CATALOG[world.biomeIndex];

  const weapons = (Object.entries(p.weapons) as Array<[WeaponId, number]>)
    .filter(([, lv]) => lv > 0)
    .map(([id, level]) => ({ id, level }));

  const canUpgradeAnyGear = false;
  const canUpgradeAnySkill = false;
  let totalAtkSpdPct = p.merchantGearLevels.gloves * MERCHANT_GEAR_CATALOG.gloves.perLevelValue;
  let totalMoveSpdPct = p.merchantGearLevels.boots * MERCHANT_GEAR_CATALOG.boots.perLevelValue;

  for (let i = 0; i < ALL_GEAR_SLOTS.length; i++) {
    const item = p.equipment[ALL_GEAR_SLOTS[i]];
    if (!item) continue;
    totalAtkSpdPct += item.stats.atkSpeedPct;
    totalMoveSpdPct += item.stats.moveSpeedPct;
  }

  const dashRatio = p.dashMaxCooldown > 0 ? Math.max(0, Math.min(1, 1 - p.dashCooldown / p.dashMaxCooldown)) : 1;

  let unopenedChestCount = 0;
  for (let i = 0; i < world.chests.length; i++) {
    if (!world.chests[i].opened) unopenedChestCount += 1;
  }

  const playerStatuses: StatusEffectKind[] = [];
  if (p.slowTimer > 0) playerStatuses.push('freeze');
  if (p.burnTimer > 0) playerStatuses.push('burn');
  if (p.poisonTimer > 0) playerStatuses.push('poison');

  const elementTreeSnapshot: ElementSkillTree = {
    fire: { ...p.elementTree.fire },
    ice: { ...p.elementTree.ice },
    lightning: { ...p.elementTree.lightning },
    poison: { ...p.elementTree.poison },
  };

  return {
    phase: world.phase,
    hp: Math.round(p.hp),
    maxHp: Math.round(p.maxHp),
    xp: Math.round(p.xp),
    xpToNext: Math.round(p.xpToNext),
    skillXp: Math.round(p.skillXp),
    skillPoints: p.skillPoints,
    gold: Math.round(p.gold),
    level: p.level,
    elapsed: world.elapsed,
    wave: world.wave,
    maxWaves: world.maxWaves,
    kills: world.kills,
    score: Math.round(world.score),
    bestScore: Math.round(world.bestScore),
    dashRatio,
    dashCooldownSec: Number(p.dashCooldown.toFixed(1)),
    atk: p.atk,
    def: p.def,
    critChance: Math.round(p.critChance * 100),
    atkSpeedPct: totalAtkSpdPct,
    moveSpeedPct: totalMoveSpdPct,
    combatPower: p.combatPower,
    upgradeShards: p.upgradeShards,
    canUpgradeAnyGear,
    canUpgradeAnySkill,
    biomeIndex: world.biomeIndex,
    biomeName: biomeDef.name,
    biomeAccent: biomeDef.accent,
    equipment: { ...p.equipment },
    merchantGearLevels: { ...p.merchantGearLevels },
    elementTree: elementTreeSnapshot,
    heroClass: p.heroClass,
    classSkills: cloneClassSkillTree(p.classSkills),
    activeFusions: getActiveHybridFusions(p.classSkills),
    rage: Math.round(p.rage),
    maxRage: p.maxRage,
    comboCount: p.comboCount,
    tyrantActive: p.tyrantTimer > 0,
    levelUpAnimRatio:
      world.levelUpAnimTimer > 0 && world.levelUpAnimMax > 0
        ? Math.max(0, Math.min(1, world.levelUpAnimTimer / world.levelUpAnimMax))
        : 0,
    levelUpAnimLevel: world.levelUpAnimLevel,
    merchantActive: world.merchant.active,
    merchantTimeLeft: world.merchant.active ? Math.max(0, Math.ceil(world.merchant.timer)) : 0,
    merchantAlertRatio:
      world.merchantAlertTimer > 0 && world.merchantAlertMax > 0
        ? Math.max(0, Math.min(1, world.merchantAlertTimer / world.merchantAlertMax))
        : 0,
    pendingLoot: world.pendingLoot,
    bossActive: Boolean(boss),
    bossName: bossMeta?.name ?? '',
    bossSubtitle: bossMeta?.subtitle ?? '',
    bossHp: boss ? Math.round(boss.hp) : 0,
    bossMaxHp: boss ? Math.round(boss.maxHp) : 1,
    bossAccent: bossMeta?.accent ?? '#c084fc',
    bossAlert:
      world.bossAlertTimer > 0 && world.bossAlertMax > 0
        ? {
            name: world.bossAlertName,
            subtitle: world.bossAlertSubtitle,
            accent: world.bossAlertAccent,
            stage: world.bossAlertStage,
            ratio: Math.max(0, Math.min(1, world.bossAlertTimer / world.bossAlertMax)),
          }
        : null,
    playerCoordX: Math.round(p.x / 10),
    playerCoordY: Math.round(p.y / 10),
    unopenedChestCount,
    playerStatuses,
    weapons,
    bannerText: world.bannerText,
  };
}

export function getRunSummary(world: WorldState, prevBest: number): RunSummary {
  const boss = world.enemies.find((e) => e.isBoss && !e.dying);
  const weapons = (Object.entries(world.player.weapons) as Array<[WeaponId, number]>)
    .filter(([, lv]) => lv > 0)
    .map(([id, level]) => ({ id, level }));
  const outcome: 'victory' | 'gameover' = world.phase === 'victory' ? 'victory' : 'gameover';
  return {
    outcome,
    elapsed: world.elapsed,
    wave: world.wave,
    maxWaves: world.maxWaves,
    kills: world.kills,
    level: world.player.level,
    score: Math.round(world.score),
    bestScore: Math.round(Math.max(world.bestScore, world.score)),
    isNewBest: world.score > prevBest && world.score > 0,
    combatPower: world.player.combatPower,
    biomeName: BIOME_CATALOG[world.biomeIndex].name,
    equipment: { ...world.player.equipment },
    bossRemainingRatio: boss ? Math.max(0, boss.hp / boss.maxHp) : null,
    weapons,
  };
}

const classCombatHooks: ClassCombatHooks = {
  damageEnemy,
  applyEnemyStatus,
  spawnParticles,
  spawnImpactBurst,
  spawnGroundDecal,
  spawnFloatingText,
  emitSound,
  nextRandom,
  findNearestEnemy,
};
