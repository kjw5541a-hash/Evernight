export type GamePhase = 'title' | 'playing' | 'loot' | 'merchant' | 'skill_tree' | 'paused' | 'victory' | 'gameover';

export type ElementId = 'fire' | 'ice' | 'lightning' | 'poison';
export type ElementBranch = 'power' | 'area';
export type MerchantGearSlot = 'weapon' | 'helm' | 'armor' | 'gloves' | 'boots';

export type HeroClassId = 'wizard' | 'warrior' | 'archer';
export type SkillAttribute = 'fire' | 'ice' | 'lightning' | 'poison' | 'physical';
export type SkillTier = 1 | 2 | 3;
export type MutationChoice = 'A' | 'B';
export type HybridFusionId = 'thermal_shock' | 'acid_overload' | 'shatter_impact' | 'blaze_strike';

export interface ClassSkillNodeState {
  level: number; // 0..10
  mut5: MutationChoice | null;
  mut10: MutationChoice | null;
}

export type ClassSkillTreeState = Record<SkillAttribute, Record<SkillTier, ClassSkillNodeState>>;

export interface ElementTreeNode {
  unlocked: boolean;
  powerLv: number; // 0..10 (속성 공격력 강화)
  areaLv: number;  // 0..10 (속성 범위 확장)
}

export type ElementSkillTree = Record<ElementId, ElementTreeNode>;
export type MerchantGearLevels = Record<MerchantGearSlot, number>;

export interface MerchantState {
  active: boolean;
  x: number;
  y: number;
  timer: number;
  maxDuration: number;
  bobPhase: number;
}

export type WeaponId =
  | 'arcane_bolt'
  | 'orbit_blades'
  | 'chain_lightning'
  | 'ember_nova'
  | 'frost_lance'
  | 'holy_chakram';

export type RelicId =
  | 'swift_boots'
  | 'blood_signet'
  | 'magnet_charm'
  | 'berserk_crest'
  | 'dash_core';

export type UpgradeId = WeaponId | RelicId;

export type BossKind = 'boss_behemoth' | 'boss_pyrolord' | 'boss_frostqueen' | 'lich_boss';
export type EnemyKind = 'skeleton' | 'imp' | 'charger' | 'bat' | BossKind;

export type GearSlot = 'weapon' | 'armor' | 'helm' | 'accessory';
export type GearRarity = 'normal' | 'rare' | 'epic' | 'legendary';
export type LegendaryEffectId = 'crit_nova' | 'life_leech' | 'dash_storm' | 'treasure_hunter';
export type BiomeId = 0 | 1 | 2 | 3;

export interface GearSkill {
  id: WeaponId;
  level: number; // 1..5, upgradeable via banked skillXp
}

export interface GearStats {
  atk: number;
  def: number;
  maxHp: number;
  critChance: number; // percentage points, e.g., 8 means +8%
  atkSpeedPct: number; // percentage points, e.g., 10 means +10%
  moveSpeedPct: number; // percentage points
}

export interface GearItem {
  id: number;
  slot: GearSlot;
  rarity: GearRarity;
  name: string;
  itemLevel: number;
  upgradeLevel: number; // +0 .. +10 via salvage shards
  powerScore: number;
  stats: GearStats;
  attachedSkills: GearSkill[];
  legendaryEffect?: LegendaryEffectId;
}

export type EquipmentSlots = Record<GearSlot, GearItem | null>;

export interface HeroComputedStats {
  atk: number;
  def: number;
  maxHp: number;
  damageMult: number;
  damageReduction: number; // 0..0.7
  critChance: number; // 0..0.75
  cooldownMult: number; // lower = faster attacks
  moveSpeed: number;
  pickupRadius: number;
  combatPower: number;
  hasCritNova: boolean;
  hasLifeLeech: boolean;
  hasDashStorm: boolean;
  hasTreasureHunter: boolean;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  subtitle: string;
  accent: string;
  fallbackFloor: string;
  tintOverlay: string;
  glowInner: string;
  glowOuter: string;
  minCp: number;
  minLevel: number;
  minWave: number;
}

export interface WeaponDef {
  id: WeaponId;
  kind: 'weapon';
  name: string;
  role: string;
  accent: string;
  maxLevel: number;
  levelDescriptions: string[];
}

export interface RelicDef {
  id: RelicId;
  kind: 'relic';
  name: string;
  role: string;
  accent: string;
  maxLevel: number;
  levelDescriptions: string[];
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number; // 1 right, -1 left
  aimAngle: number;
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  skillXp: number; // Banked XP spendable anytime to level up skills attached to equipped gear
  level: number;
  radius: number;
  moveSpeed: number;
  atk: number;
  def: number;
  critChance: number;
  damageMult: number;
  cooldownMult: number;
  pickupRadius: number;
  combatPower: number;
  invulnTimer: number;
  hitFlashTimer: number;
  slowTimer: number;
  burnTimer: number;
  burnTickTimer: number;
  poisonTimer: number;
  poisonTickTimer: number;
  statusVfxAccum: number;
  strideDist: number;
  scaleX: number;
  scaleY: number;
  dashCooldown: number;
  dashMaxCooldown: number;
  dashActiveTimer: number;
  dashDirX: number;
  dashDirY: number;
  dashBufferTimer: number;
  weapons: Partial<Record<WeaponId, number>>; // Derived strictly from equipped items' attachedSkills
  relics: Partial<Record<RelicId, number>>;
  weaponTimers: Record<WeaponId, number>;
  basicAttackTimer: number;
  orbitAngle: number;
  equipment: EquipmentSlots;
  upgradeShards: number; // Earned by salvaging weapons/gear & opening chests; spent to upgrade gear +N
  gold: number; // Earned from enemy coin drops; spent at the Wandering Equipment Merchant
  skillPoints: number; // Earned on level-up; spent on 4-element Mage Skill Tree
  merchantGearLevels: MerchantGearLevels;
  elementTree: ElementSkillTree;
  elementTimers: Record<ElementId, number>;
  heroClass: HeroClassId;
  classSkills: ClassSkillTreeState;
  classSkillTimers: Record<string, number>;
  rage: number;
  maxRage: number;
  comboCount: number;
  comboTimer: number;
  tyrantTimer: number;
  kineticOrbitAngle: number;
}

export type StatusEffectKind = 'freeze' | 'burn' | 'poison';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  knockVx: number;
  knockVy: number;
  facing: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  xpValue: number;
  scoreValue: number;
  strideDist: number;
  hitFlashTimer: number;
  slowTimer: number;
  burnTimer: number;
  burnTickTimer: number;
  poisonTimer: number;
  poisonTickTimer: number;
  statusVfxAccum: number;
  aiState: 'chase' | 'windup' | 'action' | 'recover';
  aiTimer: number;
  attackPattern: number;
  patternRepeat: number;
  telegraphAngle: number;
  telegraphTargetX: number;
  telegraphTargetY: number;
  hasAttackToken: boolean;
  dying: boolean;
  deathTimer: number;
  orbitSign: number;
  isBoss: boolean;
  bossName?: string;
  isElite: boolean;
  eliteTitle?: string;
  eliteColor?: string;
  enemyLevel: number;
  element: ElementId;
  poisonStacks: number;
  lightningHits: number;
  armorShred: number;
  confusedTimer: number;
  bleedTimer: number;
  bleedTickTimer: number;
  markedTimer: number;
  stunTimer: number;
  bloomTimer: number;
  bloomDmg: number;
}

export interface WorldChest {
  id: number;
  x: number;
  y: number;
  tier: 'wooden' | 'golden';
  opened: boolean;
  openAnim: number;
  bobPhase: number;
}

export interface LootDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  item: GearItem;
  bobPhase: number;
  pickupDelay: number;
}

export interface Projectile {
  id: number;
  owner: 'player' | 'enemy';
  kind:
    | 'bolt'
    | 'magic_missile'
    | 'hunter_arrow'
    | 'frost'
    | 'chakram'
    | 'fireball'
    | 'poison_orb'
    | 'incendiary_arrow'
    | 'frost_arrow'
    | 'lightning_arrow'
    | 'poison_dart'
    | 'steel_arrow'
    | 'sky_arrow'
    | 'ice_petal'
    | 'imp_orb'
    | 'boss_orb'
    | 'fire_orb'
    | 'ice_shard'
    | 'rock_shard';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  pierce: number;
  hitIds: number[];
  color: string;
  element?: ElementId;
  skillAttribute?: SkillAttribute;
  aoeRadius?: number;
  returning?: boolean;
  spin?: number;
  ricochetLeft?: number;
  spawnZoneOnHit?: 'fire_puddle' | 'blizzard' | 'poison_well';
  clusterSplit?: number;
  applyMark?: boolean;
  sourceSkillTier?: SkillTier;
}

export interface LightningArc {
  points: Vec2[];
  life: number;
  maxLife: number;
  color: string;
}

export interface NovaRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  isEnemy?: boolean;
}

export interface HazardTelegraph {
  id: number;
  shape: 'circle' | 'beam';
  x: number;
  y: number;
  radius: number;
  angle?: number;
  length?: number;
  timer: number;
  duration: number;
  damage: number;
  color: string;
}

export interface PoisonWell {
  id: number;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  tickTimer: number;
  damagePerTick: number;
  poisonDur: number;
}

export type GroundZoneKind =
  | 'solar_blackhole'
  | 'fire_puddle'
  | 'lava_fissure'
  | 'blizzard'
  | 'thunder_storm'
  | 'death_fog'
  | 'plague_aura';

export interface GroundZone {
  id: number;
  kind: GroundZoneKind;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  tickTimer: number;
  tickInterval: number;
  damage: number;
  attribute: SkillAttribute;
  pullStrength?: number;
  followPlayer?: boolean;
}

export interface Pickup {
  id: number;
  kind: 'xp_small' | 'xp_medium' | 'xp_large' | 'coin' | 'potion' | 'magnet';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  magnetized: boolean;
  bobPhase: number;
}

export interface TorchProp {
  x: number;
  y: number;
  phase: number;
}

export type ParticleShape = 'square' | 'spark' | 'ember';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  shape: ParticleShape;
}

export type ImpactBurstKind =
  | 'hit_spark'
  | 'crit_star'
  | 'slash_arc'
  | 'muzzle_flash'
  | 'frost_shatter'
  | 'level_pillar'
  | 'pickup_flash';

export interface ImpactBurst {
  active: boolean;
  kind: ImpactBurstKind;
  x: number;
  y: number;
  angle: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface Afterimage {
  active: boolean;
  x: number;
  y: number;
  facing: number;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export type GroundDecalKind = 'scorch' | 'frost' | 'blood' | 'arcane';

export interface GroundDecal {
  active: boolean;
  kind: GroundDecalKind;
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  rotation: number;
}

export interface PixelShard {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  groundY: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  rotation: number;
  rotSpeed: number;
  bounces: number;
}

export interface BossAlertState {
  name: string;
  subtitle: string;
  accent: string;
  stage: number;
  ratio: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface InputState {
  keys: Set<string>;
  pointerActive: boolean;
  pointerWorldX: number;
  pointerWorldY: number;
  waypointActive: boolean;
  waypointX: number;
  waypointY: number;
  joyActive: boolean;
  joyX: number;
  joyY: number;
  dashJustPressed: boolean;
}

export type SoundEvent =
  | 'bolt'
  | 'frost'
  | 'chakram'
  | 'lightning'
  | 'nova'
  | 'dash'
  | 'hit'
  | 'crit_hit'
  | 'kill'
  | 'boss_kill'
  | 'gem'
  | 'coin'
  | 'merchant'
  | 'heal'
  | 'levelup'
  | 'telegraph'
  | 'hurt'
  | 'boss'
  | 'chest'
  | 'loot_drop'
  | 'equip'
  | 'salvage'
  | 'biome'
  | 'victory'
  | 'gameover';

export interface HudSnapshot {
  phase: GamePhase;
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  skillXp: number;
  skillPoints: number;
  gold: number;
  level: number;
  elapsed: number;
  wave: number;
  maxWaves: number;
  kills: number;
  score: number;
  bestScore: number;
  dashRatio: number;
  dashCooldownSec: number;
  atk: number;
  def: number;
  critChance: number;
  atkSpeedPct: number;
  moveSpeedPct: number;
  combatPower: number;
  upgradeShards: number;
  canUpgradeAnyGear: boolean;
  canUpgradeAnySkill: boolean;
  biomeIndex: BiomeId;
  biomeName: string;
  biomeAccent: string;
  equipment: EquipmentSlots;
  merchantGearLevels: MerchantGearLevels;
  elementTree: ElementSkillTree;
  heroClass: HeroClassId;
  classSkills: ClassSkillTreeState;
  activeFusions: HybridFusionId[];
  rage: number;
  maxRage: number;
  comboCount: number;
  tyrantActive: boolean;
  levelUpAnimRatio: number;
  levelUpAnimLevel: number;
  merchantActive: boolean;
  merchantTimeLeft: number;
  merchantAlertRatio: number;
  pendingLoot: LootDrop | null;
  bossActive: boolean;
  bossName: string;
  bossSubtitle: string;
  bossHp: number;
  bossMaxHp: number;
  bossAccent: string;
  bossAlert: BossAlertState | null;
  playerCoordX: number;
  playerCoordY: number;
  unopenedChestCount: number;
  playerStatuses: StatusEffectKind[];
  weapons: Array<{ id: WeaponId; level: number }>;
  bannerText: string | null;
}

export interface RunSummary {
  outcome: 'victory' | 'gameover';
  elapsed: number;
  wave: number;
  maxWaves: number;
  kills: number;
  level: number;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  combatPower: number;
  biomeName: string;
  equipment: EquipmentSlots;
  bossRemainingRatio: number | null;
  weapons: Array<{ id: WeaponId; level: number }>;
}

export interface WorldState {
  phase: GamePhase;
  elapsed: number;
  wave: number;
  maxWaves: number;
  kills: number;
  score: number;
  bestScore: number;
  nextEntityId: number;
  hitstopTimer: number;
  hitstopCooldown: number;
  cameraX: number;
  cameraY: number;
  cameraTrauma: number;
  spawnTimer: number;
  bossSpawnedWaves: Set<number>;
  visitedChunks: Set<string>;
  biomeIndex: BiomeId;
  prevBiomeIndex: BiomeId;
  biomeBlend: number;
  attackTokensUsed: number;
  maxAttackTokens: number;
  gemCombo: number;
  gemComboTimer: number;
  defeatDelayTimer: number;
  pendingOutcome: 'victory' | 'gameover' | null;
  bannerText: string | null;
  bannerTimer: number;
  player: PlayerState;
  enemies: Enemy[];
  chests: WorldChest[];
  lootDrops: LootDrop[];
  pendingLoot: LootDrop | null;
  projectiles: Projectile[];
  lightningArcs: LightningArc[];
  novaRings: NovaRing[];
  hazards: HazardTelegraph[];
  poisonWells: PoisonWell[];
  groundZones: GroundZone[];
  pickups: Pickup[];
  torches: TorchProp[];
  particles: Particle[];
  particleCursor: number;
  impactBursts: ImpactBurst[];
  impactBurstCursor: number;
  afterimages: Afterimage[];
  afterimageCursor: number;
  groundDecals: GroundDecal[];
  groundDecalCursor: number;
  pixelShards: PixelShard[];
  pixelShardCursor: number;
  bossAlertTimer: number;
  bossAlertMax: number;
  bossAlertName: string;
  bossAlertSubtitle: string;
  bossAlertAccent: string;
  bossAlertStage: number;
  levelUpAnimTimer: number;
  levelUpAnimMax: number;
  levelUpAnimLevel: number;
  damageVignette: number;
  screenFlashTimer: number;
  screenFlashMax: number;
  screenFlashColor: string;
  dashGhostAccum: number;
  footstepDustAccum: number;
  floatingTexts: FloatingText[];
  floatingTextCursor: number;
  merchant: MerchantState;
  merchantCooldown: number;
  merchantAlertTimer: number;
  merchantAlertMax: number;
  merchantReopenCooldown: number;
  soundQueue: SoundEvent[];
  rngState: number;
  hudDirty: boolean;
}
