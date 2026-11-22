import {
  ALL_SKILL_ATTRIBUTES,
  ATTRIBUTE_META,
  CLASS_SKILL_CATALOG,
  getActiveHybridFusions,
  getSkillSynergyMultiplier,
} from './classSkills';
import type {
  ElementId,
  Enemy,
  GroundDecalKind,
  GroundZone,
  ImpactBurstKind,
  ParticleShape,
  SkillAttribute,
  SkillTier,
  SoundEvent,
  StatusEffectKind,
  WorldState,
} from './types';

export interface ClassCombatHooks {
  damageEnemy: (
    world: WorldState,
    enemy: Enemy,
    rawDamage: number,
    sourceX: number,
    sourceY: number,
    knockback?: number,
    heavy?: boolean,
    allowCritNova?: boolean,
    element?: ElementId,
    skillAttr?: SkillAttribute
  ) => void;
  applyEnemyStatus: (enemy: Enemy, kind: StatusEffectKind, duration: number) => void;
  spawnParticles: (
    world: WorldState,
    x: number,
    y: number,
    count: number,
    color: string,
    speedMin: number,
    speedMax: number,
    size?: number,
    life?: number,
    shape?: ParticleShape
  ) => void;
  spawnImpactBurst: (
    world: WorldState,
    kind: ImpactBurstKind,
    x: number,
    y: number,
    angle: number,
    size: number,
    color: string,
    life?: number
  ) => void;
  spawnGroundDecal: (
    world: WorldState,
    kind: GroundDecalKind,
    x: number,
    y: number,
    radius: number,
    color: string,
    life?: number
  ) => void;
  spawnFloatingText: (
    world: WorldState,
    x: number,
    y: number,
    text: string,
    color: string,
    scale?: number
  ) => void;
  emitSound: (world: WorldState, event: SoundEvent) => void;
  nextRandom: (world: WorldState) => number;
  findNearestEnemy: (world: WorldState, x: number, y: number, maxRange: number) => Enemy | null;
}

function toElement(attr: SkillAttribute): ElementId | undefined {
  return attr === 'physical' ? undefined : attr;
}

export function computeClassSkillDamage(
  world: WorldState,
  attr: SkillAttribute,
  tier: SkillTier,
  isSingleOrBoss = false
): number {
  const p = world.player;
  const node = p.classSkills[attr][tier];
  const lv = Math.max(1, node.level);
  const syn = getSkillSynergyMultiplier(p.classSkills, attr, tier);
  const tierBase = tier === 3 ? 1.55 : tier === 2 ? 1.2 : 1.0;
  let mult = tierBase * (1 + (lv - 1) * 0.16) * syn.dmgMult;

  // Mutation B boosts single-target / boss burst; Mutation A boosts multi-target/AoE slightly
  if (node.mut5 === 'B' && isSingleOrBoss) mult *= 1.45;
  else if (node.mut5 === 'B') mult *= 1.18;
  if (node.mut10 === 'B' && isSingleOrBoss) mult *= 1.55;
  else if (node.mut10 === 'B') mult *= 1.22;

  // Warrior Rage bonus
  if (p.heroClass === 'warrior' && p.rage >= 50) {
    mult *= 1 + (p.rage / p.maxRage) * 0.25;
  }
  // Archer Combo bonus
  if (p.heroClass === 'archer' && p.comboCount >= 5) {
    mult *= 1 + Math.min(0.4, p.comboCount * 0.02);
  }
  return Math.max(4, Math.round((p.atk + lv * 5) * mult));
}

function getMutationAreaMult(world: WorldState, attr: SkillAttribute, tier: SkillTier): number {
  const node = world.player.classSkills[attr][tier];
  const syn = getSkillSynergyMultiplier(world.player.classSkills, attr, tier);
  let mult = syn.areaMult;
  if (node.mut5 === 'A') mult *= 1.32;
  if (node.mut10 === 'A') mult *= 1.25;
  if (world.player.heroClass === 'warrior' && world.player.tyrantTimer > 0) {
    mult *= 1.65;
  }
  return mult;
}

function findDensestEnemy(world: WorldState, maxRange: number): Enemy | null {
  const p = world.player;
  let best: Enemy | null = null;
  let bestScore = -1;
  const r2 = maxRange * maxRange;
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.dying) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d2 > r2) continue;
    let neighbors = 1 + (e.isBoss ? 4 : e.isElite ? 2 : 0);
    for (let j = 0; j < world.enemies.length; j++) {
      if (i === j) continue;
      const o = world.enemies[j];
      if (o.dying) continue;
      if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= 120 * 120) neighbors += 1;
    }
    if (neighbors > bestScore) {
      bestScore = neighbors;
      best = e;
    }
  }
  return best;
}

function addGroundZone(world: WorldState, zone: Omit<GroundZone, 'id'>): void {
  if (world.groundZones.length >= 14) {
    world.groundZones.shift();
  }
  world.groundZones.push({ id: world.nextEntityId++, ...zone });
}

export function triggerHybridFusionsOnHit(
  world: WorldState,
  enemy: Enemy,
  damage: number,
  skillAttr: SkillAttribute | undefined,
  isCrit: boolean,
  knockback: number,
  hooks: ClassCombatHooks
): void {
  if (!skillAttr || enemy.dying) return;
  const activeFusions = getActiveHybridFusions(world.player.classSkills);
  if (activeFusions.length === 0) return;

  // 1. 열충격 (Thermal Shock): Fire hitting Frozen enemy melts ice -> 15% MaxHP true damage (5% on boss)
  if (
    skillAttr === 'fire' &&
    enemy.slowTimer > 0 &&
    activeFusions.includes('thermal_shock')
  ) {
    enemy.slowTimer = 0; // Ice melts immediately!
    const pct = enemy.isBoss ? 0.05 : 0.15;
    const shockDmg = Math.max(14, Math.round(enemy.maxHp * pct));
    enemy.hp -= shockDmg;
    world.novaRings.push({
      x: enemy.x,
      y: enemy.y,
      radius: 12,
      maxRadius: 96,
      life: 0.3,
      maxLife: 0.3,
      color: '#f472b6',
    });
    hooks.spawnImpactBurst(world, 'crit_star', enemy.x, enemy.y, 0, 38, '#f472b6', 0.3);
    hooks.spawnParticles(world, enemy.x, enemy.y, 12, '#f472b6', 65, 200, 4, 0.36, 'ember');
    hooks.spawnFloatingText(world, enemy.x, enemy.y - 30, `열충격 ${shockDmg}!`, '#f472b6', 1.24);
    hooks.emitSound(world, 'nova');
  }

  // 2. 산성 과부하 (Acid Overload): Lightning hitting Poisoned enemy triggers massive toxic-electric AoE detonation
  if (
    skillAttr === 'lightning' &&
    (enemy.poisonTimer > 0 || enemy.poisonStacks > 0) &&
    activeFusions.includes('acid_overload')
  ) {
    const blastR = 115;
    const blastDmg = Math.max(16, Math.round(damage * 0.95));
    enemy.poisonStacks = Math.max(0, enemy.poisonStacks - 1);
    world.novaRings.push({
      x: enemy.x,
      y: enemy.y,
      radius: 14,
      maxRadius: blastR,
      life: 0.32,
      maxLife: 0.32,
      color: '#a3e635',
    });
    hooks.spawnParticles(world, enemy.x, enemy.y, 14, '#a3e635', 75, 220, 4, 0.36, 'spark');
    hooks.spawnFloatingText(world, enemy.x, enemy.y - 30, '산성 과부하!', '#a3e635', 1.2);
    hooks.emitSound(world, 'lightning');
    for (let i = 0; i < world.enemies.length; i++) {
      const other = world.enemies[i];
      if (!other || other.dying || other.id === enemy.id) continue;
      if ((other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2 <= (blastR + other.radius) ** 2) {
        hooks.applyEnemyStatus(other, 'poison', 2.4);
        other.hp -= Math.round(blastDmg * 0.7);
      }
    }
  }

  // 3. 파쇄 충격 (Shatter Impact): Physical crit or strong knockback on frozen enemy
  if (
    skillAttr === 'physical' &&
    enemy.slowTimer > 0 &&
    (isCrit || knockback >= 150) &&
    activeFusions.includes('shatter_impact')
  ) {
    const shatterR = 104;
    const shatterDmg = Math.max(15, Math.round(damage * 0.85));
    world.novaRings.push({
      x: enemy.x,
      y: enemy.y,
      radius: 12,
      maxRadius: shatterR,
      life: 0.28,
      maxLife: 0.28,
      color: '#67e8f9',
    });
    hooks.spawnImpactBurst(world, 'frost_shatter', enemy.x, enemy.y, 0, 34, '#67e8f9', 0.28);
    hooks.spawnFloatingText(world, enemy.x, enemy.y - 28, '파쇄 충격!', '#67e8f9', 1.18);
    for (let i = 0; i < world.enemies.length; i++) {
      const other = world.enemies[i];
      if (!other || other.dying || other.id === enemy.id) continue;
      if ((other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2 <= (shatterR + other.radius) ** 2) {
        other.hp -= Math.round(shatterDmg * 0.65);
      }
    }
  }

  // 4. 작열 강타 (Blaze Strike): Physical crit/knockback triggers fiery shockwave
  if (
    skillAttr === 'physical' &&
    (isCrit || knockback >= 165) &&
    activeFusions.includes('blaze_strike')
  ) {
    const blastR = 96;
    const blastDmg = Math.max(12, Math.round(damage * 0.72));
    world.novaRings.push({
      x: enemy.x,
      y: enemy.y,
      radius: 12,
      maxRadius: blastR,
      life: 0.26,
      maxLife: 0.26,
      color: '#fbbf24',
    });
    hooks.spawnFloatingText(world, enemy.x, enemy.y - 28, '작열 강타!', '#fbbf24', 1.16);
    for (let i = 0; i < world.enemies.length; i++) {
      const other = world.enemies[i];
      if (!other || other.dying || other.id === enemy.id) continue;
      if ((other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2 <= (blastR + other.radius) ** 2) {
        hooks.applyEnemyStatus(other, 'burn', 2.4);
        other.hp -= Math.round(blastDmg * 0.6);
      }
    }
  }
}

export function onClassEnemyDamaged(
  world: WorldState,
  enemy: Enemy,
  dmg: number,
  isCrit: boolean,
  knockback: number,
  skillAttr: SkillAttribute | undefined,
  hooks: ClassCombatHooks
): void {
  const p = world.player;

  // Trigger Hybrid Fusion Passives!
  triggerHybridFusionsOnHit(world, enemy, dmg, skillAttr, isCrit, knockback, hooks);

  // Class Resource Generation
  if (p.heroClass === 'warrior') {
    p.rage = Math.min(p.maxRage, p.rage + (isCrit ? 6 : 3));
    // Warrior Fire 2T: 열기 축적 (on hit, emit heat pulse)
    const heatNode = p.classSkills.fire[2];
    if (heatNode.level > 0 && (p.classSkillTimers.war_heat_cd ?? 0) <= 0) {
      p.classSkillTimers.war_heat_cd = 0.85;
      const pulseR = Math.round((85 + heatNode.level * 8) * getMutationAreaMult(world, 'fire', 2));
      const pulseDmg = Math.round(computeClassSkillDamage(world, 'fire', 2) * 0.65);
      world.novaRings.push({
        x: p.x,
        y: p.y,
        radius: 12,
        maxRadius: pulseR,
        life: 0.26,
        maxLife: 0.26,
        color: '#fb923c',
      });
      for (let i = 0; i < world.enemies.length; i++) {
        const o = world.enemies[i];
        if (!o || o.dying) continue;
        if ((o.x - p.x) ** 2 + (o.y - p.y) ** 2 <= (pulseR + o.radius) ** 2) {
          hooks.applyEnemyStatus(o, 'burn', 2.6);
          o.hp -= pulseDmg;
        }
      }
    }
    // Warrior Poison 1T: 부식성 무기 (armor shred + poison stacks)
    const corrNode = p.classSkills.poison[1];
    if (corrNode.level > 0) {
      enemy.armorShred = Math.min(0.45, enemy.armorShred + 0.04 + corrNode.level * 0.008);
      enemy.poisonStacks = Math.min(8, enemy.poisonStacks + 1);
      hooks.applyEnemyStatus(enemy, 'poison', 3.4);
    }
  } else if (p.heroClass === 'archer') {
    p.comboCount = Math.min(99, p.comboCount + 1);
    p.comboTimer = 4.2;

    // Archer Lightning 2T: 피뢰침 표식 (every 3 hits — or 2 with mut5 B — calls down lightning)
    const rodNode = p.classSkills.lightning[2];
    if (rodNode.level > 0) {
      enemy.lightningHits += 1;
      const req = rodNode.mut5 === 'B' ? 2 : 3;
      if (enemy.lightningHits >= req) {
        enemy.lightningHits = 0;
        const strikeDmg = computeClassSkillDamage(world, 'lightning', 2, enemy.isBoss);
        world.lightningArcs.push({
          points: [
            { x: enemy.x, y: enemy.y - 170 },
            { x: enemy.x, y: enemy.y },
          ],
          life: 0.26,
          maxLife: 0.26,
          color: '#fde047',
        });
        hooks.spawnImpactBurst(world, 'crit_star', enemy.x, enemy.y, 0, 32, '#fde047', 0.26);
        hooks.spawnFloatingText(world, enemy.x, enemy.y - 26, `낙뢰 ${strikeDmg}!`, '#fde047', 1.18);
        hooks.emitSound(world, 'lightning');
        enemy.hp -= strikeDmg;
        triggerHybridFusionsOnHit(world, enemy, strikeDmg, 'lightning', false, 0, hooks);
      }
    }

    // Archer Physical 2T: 약점 포착 (crit inflicts bleed)
    const weakNode = p.classSkills.physical[2];
    if (weakNode.level > 0 && isCrit) {
      enemy.bleedTimer = Math.max(enemy.bleedTimer, 3.6 + weakNode.level * 0.25);
      if (enemy.bleedTickTimer <= 0) enemy.bleedTickTimer = 0.5;
    }

    // Archer Poison 2T: 신경 독소 (poisoned enemies become confused & hurt nearby enemies)
    const neuroNode = p.classSkills.poison[2];
    if (neuroNode.level > 0 && (enemy.poisonTimer > 0 || skillAttr === 'poison')) {
      enemy.confusedTimer = Math.max(enemy.confusedTimer, 2.5 + neuroNode.level * 0.25);
    }
  } else if (p.heroClass === 'wizard') {
    // Wizard Ice 2T: 빙결 파쇄 (hitting frozen enemy sprays ice shards)
    const shatterNode = p.classSkills.ice[2];
    if (
      shatterNode.level > 0 &&
      enemy.slowTimer > 0 &&
      (p.classSkillTimers.wiz_shatter_cd ?? 0) <= 0
    ) {
      p.classSkillTimers.wiz_shatter_cd = 0.35;
      const syn = getSkillSynergyMultiplier(p.classSkills, 'ice', 2);
      const count = 4 + syn.bonusCount + (shatterNode.mut5 === 'A' ? 3 : 0);
      const shardDmg = Math.round(computeClassSkillDamage(world, 'ice', 2) * 0.52);
      for (let s = 0; s < count; s++) {
        const a = (s / count) * Math.PI * 2 + hooks.nextRandom(world) * 0.4;
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'ice_petal',
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * 390,
          vy: Math.sin(a) * 390,
          radius: 6,
          damage: shardDmg,
          life: 0.65,
          maxLife: 0.65,
          pierce: shatterNode.mut5 === 'A' ? 2 : 0,
          hitIds: [enemy.id],
          color: '#7dd3fc',
          element: 'ice',
          skillAttribute: 'ice',
        });
      }
      hooks.spawnImpactBurst(world, 'frost_shatter', enemy.x, enemy.y, 0, 26, '#7dd3fc', 0.24);
    }

    // Wizard Poison 2T: 역병 전염 (when poison stacks hit max 5, explode poison cloud)
    const plagueNode = p.classSkills.poison[2];
    if (plagueNode.level > 0 && skillAttr === 'poison') {
      enemy.poisonStacks += 1;
      if (enemy.poisonStacks >= 5) {
        enemy.poisonStacks = 0;
        const rad = Math.round((95 + plagueNode.level * 10) * getMutationAreaMult(world, 'poison', 2));
        const popDmg = computeClassSkillDamage(world, 'poison', 2, enemy.isBoss);
        world.novaRings.push({
          x: enemy.x,
          y: enemy.y,
          radius: 12,
          maxRadius: rad,
          life: 0.32,
          maxLife: 0.32,
          color: '#4ade80',
        });
        hooks.spawnFloatingText(world, enemy.x, enemy.y - 26, '역병 폭발!', '#4ade80', 1.15);
        for (let i = 0; i < world.enemies.length; i++) {
          const o = world.enemies[i];
          if (!o || o.dying || o.id === enemy.id) continue;
          if ((o.x - enemy.x) ** 2 + (o.y - enemy.y) ** 2 <= (rad + o.radius) ** 2) {
            hooks.applyEnemyStatus(o, 'poison', 3.4);
            o.poisonStacks = Math.min(5, o.poisonStacks + (plagueNode.mut5 === 'A' ? 2 : 1));
            o.hp -= Math.round(popDmg * 0.72);
          }
        }
      }
    }
  }
}

export function onClassEnemyKilled(
  world: WorldState,
  enemy: Enemy,
  hooks: ClassCombatHooks
): void {
  const p = world.player;

  // Wizard Fire 2T: 불씨 전이 (killing a burning enemy spreads fire explosion)
  if (p.heroClass === 'wizard' && enemy.burnTimer > 0 && p.classSkills.fire[2].level > 0) {
    const node = p.classSkills.fire[2];
    const spreadR = Math.round((96 + node.level * 10) * getMutationAreaMult(world, 'fire', 2));
    const spreadDmg = computeClassSkillDamage(world, 'fire', 2);
    world.novaRings.push({
      x: enemy.x,
      y: enemy.y,
      radius: 10,
      maxRadius: spreadR,
      life: 0.28,
      maxLife: 0.28,
      color: '#fb923c',
    });
    hooks.spawnParticles(world, enemy.x, enemy.y, 10, '#fb923c', 65, 190, 3.8, 0.35, 'ember');
    hooks.spawnFloatingText(world, enemy.x, enemy.y - 26, '불씨 전이!', '#fb923c', 1.1);
    for (let i = 0; i < world.enemies.length; i++) {
      const o = world.enemies[i];
      if (!o || o.dying || o.id === enemy.id) continue;
      if ((o.x - enemy.x) ** 2 + (o.y - enemy.y) ** 2 <= (spreadR + o.radius) ** 2) {
        hooks.applyEnemyStatus(o, 'burn', 3.2);
        hooks.damageEnemy(world, o, spreadDmg, enemy.x, enemy.y, 85, false, false, 'fire', 'fire');
      }
    }
  }

  // Warrior Poison 2T: 독혈 흡수 (killing poisoned enemy heals HP & fires poison thorns)
  if (p.heroClass === 'warrior' && (enemy.poisonTimer > 0 || enemy.poisonStacks > 0) && p.classSkills.poison[2].level > 0) {
    const node = p.classSkills.poison[2];
    const heal = Math.max(2, Math.round(2 + node.level * 0.8)) * (node.mut10 === 'A' ? 2 : 1);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    const syn = getSkillSynergyMultiplier(p.classSkills, 'poison', 2);
    const thorns = 4 + syn.bonusCount + (node.mut5 === 'A' ? 4 : 0);
    const thornDmg = Math.round(computeClassSkillDamage(world, 'poison', 2) * 0.6);
    for (let t = 0; t < thorns; t++) {
      const a = (t / thorns) * Math.PI * 2;
      world.projectiles.push({
        id: world.nextEntityId++,
        owner: 'player',
        kind: 'poison_dart',
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(a) * 380,
        vy: Math.sin(a) * 380,
        radius: 5,
        damage: thornDmg,
        life: 0.7,
        maxLife: 0.7,
        pierce: node.mut5 === 'A' ? 2 : 0,
        hitIds: [enemy.id],
        color: '#4ade80',
        element: 'poison',
        skillAttribute: 'poison',
      });
    }
  }
}

export function onClassPlayerHurt(
  world: WorldState,
  sourceX: number,
  sourceY: number,
  hooks: ClassCombatHooks
): void {
  const p = world.player;
  if (p.heroClass !== 'warrior') return;

  // Warrior Rage gain on damage taken
  p.rage = Math.min(p.maxRage, p.rage + 16);

  // Warrior Ice 2T: 서리 갑옷 (freeze nearby attackers & retaliate)
  const armorNode = p.classSkills.ice[2];
  if (armorNode.level > 0) {
    const rad = Math.round((115 + armorNode.level * 10) * getMutationAreaMult(world, 'ice', 2));
    const dmg = computeClassSkillDamage(world, 'ice', 2);
    world.novaRings.push({
      x: p.x,
      y: p.y,
      radius: 14,
      maxRadius: rad,
      life: 0.3,
      maxLife: 0.3,
      color: '#38bdf8',
    });
    hooks.spawnFloatingText(world, p.x, p.y - 26, '서리 갑옷 반격!', '#7dd3fc', 1.12);
    hooks.emitSound(world, 'frost');
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (!e || e.dying) continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (rad + e.radius) ** 2) {
        hooks.applyEnemyStatus(e, 'freeze', 3.2 + armorNode.level * 0.25);
        hooks.damageEnemy(world, e, dmg, p.x, p.y, 130, false, false, 'ice', 'ice');
      }
    }
  }

  // Warrior Fire 2T: 열기 축적 (emit heat blast on hurt)
  const heatNode = p.classSkills.fire[2];
  if (heatNode.level > 0) {
    const rad = Math.round((120 + heatNode.level * 12) * getMutationAreaMult(world, 'fire', 2));
    const dmg = computeClassSkillDamage(world, 'fire', 2);
    world.novaRings.push({
      x: p.x,
      y: p.y,
      radius: 14,
      maxRadius: rad,
      life: 0.3,
      maxLife: 0.3,
      color: '#f97316',
    });
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (!e || e.dying) continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (rad + e.radius) ** 2) {
        hooks.applyEnemyStatus(e, 'burn', 3.0);
        hooks.damageEnemy(world, e, dmg, sourceX, sourceY, 120, false, false, 'fire', 'fire');
      }
    }
  }
}

export function updateClassSkillsAndZones(
  world: WorldState,
  dt: number,
  movedDist: number,
  hooks: ClassCombatHooks
): void {
  const p = world.player;
  const t = p.classSkillTimers;
  for (const key of Object.keys(t)) {
    if (t[key] > 0) t[key] = Math.max(0, t[key] - dt);
  }

  if (p.tyrantTimer > 0) {
    p.tyrantTimer = Math.max(0, p.tyrantTimer - dt);
  }
  if (p.comboTimer > 0) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) {
      p.comboCount = 0;
    }
  }
  if (p.heroClass === 'warrior') {
    if (movedDist > 0.5) {
      p.rage = Math.min(p.maxRage, p.rage + movedDist * 0.045);
    } else if (p.rage > 0) {
      p.rage = Math.max(0, p.rage - dt * 3);
    }
  }

  // Update active GroundZones (Solar Blackhole, Fire Puddles, Lava Fissures, Blizzards, Thunder Storm, Death Fog, Plague Aura)
  for (let i = world.groundZones.length - 1; i >= 0; i--) {
    const z = world.groundZones[i];
    z.life -= dt;
    if (z.life <= 0) {
      world.groundZones.splice(i, 1);
      continue;
    }
    if (z.followPlayer) {
      z.x = p.x;
      z.y = p.y;
    }

    // Blackhole / Blizzard pull effect
    if (z.pullStrength && z.pullStrength > 0) {
      for (let j = 0; j < world.enemies.length; j++) {
        const e = world.enemies[j];
        if (e.dying || e.isBoss) continue;
        const dx = z.x - e.x;
        const dy = z.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 14 && dist < z.radius * 1.15) {
          const pull = z.pullStrength * dt;
          e.x += (dx / dist) * pull;
          e.y += (dy / dist) * pull;
        }
      }
    }

    z.tickTimer -= dt;
    if (z.tickTimer <= 0) {
      z.tickTimer = z.tickInterval;
      const el = toElement(z.attribute);
      for (let j = 0; j < world.enemies.length; j++) {
        const e = world.enemies[j];
        if (e.dying) continue;
        const dx = e.x - z.x;
        const dy = e.y - z.y;
        const hitR = z.radius + e.radius;
        if (dx * dx + dy * dy <= hitR * hitR) {
          if (z.attribute === 'fire') hooks.applyEnemyStatus(e, 'burn', 2.4);
          else if (z.attribute === 'ice') hooks.applyEnemyStatus(e, 'freeze', 2.2);
          else if (z.attribute === 'poison') {
            hooks.applyEnemyStatus(e, 'poison', 3.0);
            e.poisonStacks = Math.min(8, e.poisonStacks + 1);
          }
          hooks.damageEnemy(world, e, z.damage, z.x, z.y, 18, false, false, el, z.attribute);
        }
      }
    }
  }

  // Update Enemy Bleed, Bloom, Stun, Confusion, and Warrior Knockback Collision Synergy!
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.dying) continue;

    if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - dt);
    if (e.markedTimer > 0) e.markedTimer = Math.max(0, e.markedTimer - dt);

    // Bleed DoT (Archer 약점 포착)
    if (e.bleedTimer > 0) {
      e.bleedTimer = Math.max(0, e.bleedTimer - dt);
      e.bleedTickTimer -= dt;
      if (e.bleedTickTimer <= 0) {
        e.bleedTickTimer = 0.55;
        const bleedDmg = Math.max(5, Math.round(p.atk * 0.42));
        hooks.damageEnemy(world, e, bleedDmg, e.x, e.y, 0, false, false, undefined, 'physical');
      }
    }

    // Archer Poison 3T: 맹독 꽃봉오리 detonation
    if (e.bloomTimer > 0) {
      e.bloomTimer -= dt;
      if (e.bloomTimer <= 0) {
        const rad = 95;
        world.novaRings.push({
          x: e.x,
          y: e.y,
          radius: 12,
          maxRadius: rad,
          life: 0.3,
          maxLife: 0.3,
          color: '#22c55e',
        });
        hooks.spawnFloatingText(world, e.x, e.y - 26, '맹독 개화!', '#4ade80', 1.15);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          world.projectiles.push({
            id: world.nextEntityId++,
            owner: 'player',
            kind: 'poison_dart',
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 340,
            vy: Math.sin(a) * 340,
            radius: 6,
            damage: Math.max(8, Math.round(e.bloomDmg * 0.55)),
            life: 0.75,
            maxLife: 0.75,
            pierce: 0,
            hitIds: [e.id],
            color: '#4ade80',
            element: 'poison',
            skillAttribute: 'poison',
          });
        }
        hooks.damageEnemy(world, e, e.bloomDmg, e.x, e.y, 60, true, false, 'poison', 'poison');
      }
    }

    // Confused enemies strike adjacent enemies (Archer 신경 독소)
    if (e.confusedTimer > 0) {
      e.confusedTimer = Math.max(0, e.confusedTimer - dt);
      if (hooks.nextRandom(world) < dt * 2.2) {
        for (let j = 0; j < world.enemies.length; j++) {
          const other = world.enemies[j];
          if (other.dying || other.id === e.id) continue;
          if ((other.x - e.x) ** 2 + (other.y - e.y) ** 2 <= 82 * 82) {
            hooks.damageEnemy(world, other, Math.max(6, Math.round(e.damage * 0.9)), e.x, e.y, 50, false, false, 'poison', 'poison');
            break;
          }
        }
      }
    }

    // Warrior Trigger Synergy: Knocked-back enemy colliding with another enemy deals bonus AoE impact damage (+ chain stun with 충격파 반사!)
    if (p.heroClass === 'warrior') {
      const knockSpd = Math.hypot(e.knockVx, e.knockVy);
      if (knockSpd > 145) {
        const reflLv = p.classSkills.physical[2].level;
        for (let j = 0; j < world.enemies.length; j++) {
          const other = world.enemies[j];
          if (other.dying || other.id === e.id) continue;
          const hitR = e.radius + other.radius + 10;
          if ((other.x - e.x) ** 2 + (other.y - e.y) ** 2 <= hitR * hitR) {
            const impactDmg = Math.max(10, Math.round(p.atk * (0.75 + reflLv * 0.14)));
            e.knockVx *= 0.35;
            e.knockVy *= 0.35;
            other.stunTimer = Math.max(other.stunTimer, reflLv > 0 ? 1.4 : 0.45);
            world.novaRings.push({
              x: other.x,
              y: other.y,
              radius: 10,
              maxRadius: 72 + reflLv * 8,
              life: 0.22,
              maxLife: 0.22,
              color: '#f97316',
            });
            hooks.spawnFloatingText(world, other.x, other.y - 24, `충돌 ${impactDmg}!`, '#fb923c', 1.12);
            hooks.damageEnemy(world, other, impactDmg, e.x, e.y, 130, true, false, undefined, 'physical');
            break;
          }
        }
      }
    }
  }

  // Run Class-Specific Active Skills (all 5 attributes × 3 tiers)
  if (p.heroClass === 'wizard') {
    updateWizardSkills(world, dt, movedDist, hooks);
  } else if (p.heroClass === 'warrior') {
    updateWarriorSkills(world, dt, movedDist, hooks);
  } else {
    updateArcherSkills(world, dt, hooks);
  }
}

function updateWizardSkills(
  world: WorldState,
  dt: number,
  movedDist: number,
  hooks: ClassCombatHooks
): void {
  const p = world.player;
  const cs = p.classSkills;
  const t = p.classSkillTimers;

  // FIRE 1T: 유성 파편 (Drop meteors on densest enemy cluster)
  if (cs.fire[1].level > 0 && (t.wiz_f1 ?? 0) <= 0) {
    const target = findDensestEnemy(world, 460);
    if (target) {
      t.wiz_f1 = Math.max(0.85, (2.2 - cs.fire[1].level * 0.07) * p.cooldownMult);
      const count = 1 + (cs.fire[1].mut5 === 'A' ? 2 : 0) + (cs.fire[1].mut10 === 'A' ? 2 : 0);
      const rad = Math.round((68 + cs.fire[1].level * 7) * getMutationAreaMult(world, 'fire', 1));
      const dmg = computeClassSkillDamage(world, 'fire', 1, target.isBoss);
      for (let m = 0; m < count; m++) {
        const mx = target.x + (m === 0 ? 0 : (hooks.nextRandom(world) - 0.5) * 110);
        const my = target.y + (m === 0 ? 0 : (hooks.nextRandom(world) - 0.5) * 110);
        world.novaRings.push({ x: mx, y: my, radius: 12, maxRadius: rad, life: 0.34, maxLife: 0.34, color: '#fb923c' });
        hooks.spawnImpactBurst(world, 'level_pillar', mx, my, 0, 0.9, '#fb923c', 0.32);
        hooks.spawnGroundDecal(world, 'scorch', mx, my + 4, rad * 0.65, '#ea580c', 3.0);
        hooks.spawnParticles(world, mx, my, 12, '#fb923c', 70, 200, 4, 0.38, 'ember');
        for (let i = 0; i < world.enemies.length; i++) {
          const e = world.enemies[i];
          if (e.dying) continue;
          if ((e.x - mx) ** 2 + (e.y - my) ** 2 <= (rad + e.radius) ** 2) {
            hooks.applyEnemyStatus(e, 'burn', 3.2);
            hooks.damageEnemy(world, e, dmg, mx, my, 120, true, true, 'fire', 'fire');
          }
        }
      }
      hooks.emitSound(world, 'nova');
    }
  }

  // FIRE 3T: 종말의 태양 (Giant Solar Blackhole + DoT)
  if (cs.fire[3].level > 0 && (t.wiz_f3 ?? 0) <= 0) {
    const target = findDensestEnemy(world, 420);
    if (target) {
      t.wiz_f3 = Math.max(4.5, (7.8 - cs.fire[3].level * 0.2) * p.cooldownMult);
      const rad = Math.round((125 + cs.fire[3].level * 8) * getMutationAreaMult(world, 'fire', 3));
      const dmg = Math.round(computeClassSkillDamage(world, 'fire', 3, target.isBoss) * 0.48);
      addGroundZone(world, {
        kind: 'solar_blackhole',
        x: target.x,
        y: target.y,
        radius: rad,
        life: 4.5,
        maxLife: 4.5,
        tickTimer: 0.1,
        tickInterval: 0.45,
        damage: dmg,
        attribute: 'fire',
        pullStrength: 135,
      });
      hooks.spawnFloatingText(world, target.x, target.y - 36, '종말의 태양!', '#fb923c', 1.24);
      hooks.emitSound(world, 'nova');
    }
  }

  // ICE 1T: 서리 고리 (Periodic frost wave around Wizard)
  if (cs.ice[1].level > 0 && (t.wiz_i1 ?? 0) <= 0) {
    t.wiz_i1 = Math.max(1.1, (2.5 - cs.ice[1].level * 0.08) * p.cooldownMult);
    const rad = Math.round((125 + cs.ice[1].level * 10) * getMutationAreaMult(world, 'ice', 1));
    const dmg = computeClassSkillDamage(world, 'ice', 1);
    world.novaRings.push({ x: p.x, y: p.y, radius: 16, maxRadius: rad, life: 0.34, maxLife: 0.34, color: '#38bdf8' });
    hooks.spawnImpactBurst(world, 'frost_shatter', p.x, p.y, 0, 34, '#7dd3fc', 0.28);
    hooks.emitSound(world, 'frost');
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (e.dying) continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (rad + e.radius) ** 2) {
        hooks.applyEnemyStatus(e, 'freeze', 3.0 + cs.ice[1].level * 0.2);
        hooks.damageEnemy(world, e, dmg, p.x, p.y, 110, false, true, 'ice', 'ice');
      }
    }
  }

  // ICE 3T: 절대영도 (Full-screen freeze + max-HP proportional shatter)
  if (cs.ice[3].level > 0 && (t.wiz_i3 ?? 0) <= 0 && world.enemies.length > 0) {
    t.wiz_i3 = Math.max(5.5, (9.5 - cs.ice[3].level * 0.25) * p.cooldownMult) * (cs.ice[3].mut5 === 'A' ? 0.75 : 1);
    const baseDmg = computeClassSkillDamage(world, 'ice', 3);
    world.novaRings.push({ x: p.x, y: p.y, radius: 30, maxRadius: 460, life: 0.55, maxLife: 0.55, color: '#7dd3fc' });
    hooks.spawnFloatingText(world, p.x, p.y - 38, '절대영도!', '#7dd3fc', 1.28);
    hooks.emitSound(world, 'frost');
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (e.dying) continue;
      if (Math.abs(e.x - p.x) <= 580 && Math.abs(e.y - p.y) <= 420) {
        hooks.applyEnemyStatus(e, 'freeze', 4.0);
        const pctDmg = Math.round(e.maxHp * (e.isBoss ? 0.05 : 0.14));
        hooks.damageEnemy(world, e, baseDmg + pctDmg, p.x, p.y, 80, true, true, 'ice', 'ice');
      }
    }
  }

  // LIGHTNING 1T: 연쇄 번개 & 2T: 정전기장
  if (cs.lightning[1].level > 0 && (t.wiz_l1 ?? 0) <= 0) {
    const first = hooks.findNearestEnemy(world, p.x, p.y, 440);
    if (first) {
      t.wiz_l1 = Math.max(0.85, (2.0 - cs.lightning[1].level * 0.07) * p.cooldownMult);
      const dmg = computeClassSkillDamage(world, 'lightning', 1, first.isBoss);
      if (cs.lightning[1].mut5 === 'B') {
        // Mutation B: 5x concentrated strikes on single target!
        const pts = [{ x: p.x, y: p.y - 8 }, { x: first.x, y: first.y }];
        world.lightningArcs.push({ points: pts, life: 0.3, maxLife: 0.3, color: '#fde047' });
        hooks.damageEnemy(world, first, Math.round(dmg * 2.15), p.x, p.y, 60, true, true, 'lightning', 'lightning');
      } else {
        const chains = 2 + cs.lightning[1].level + (cs.lightning[1].mut5 === 'A' ? 5 : 0);
        const visited = new Set<number>();
        const hitList: Enemy[] = [];
        const pts = [{ x: p.x, y: p.y - 8 }];
        let cur: Enemy | null = first;
        for (let c = 0; c < chains && cur; c++) {
          visited.add(cur.id);
          hitList.push(cur);
          pts.push({ x: cur.x, y: cur.y });
          hooks.damageEnemy(world, cur, dmg, p.x, p.y, 65, c === 0, true, 'lightning', 'lightning');
          let next: Enemy | null = null;
          let bestD2 = 240 * 240;
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
        world.lightningArcs.push({ points: pts, life: 0.28, maxLife: 0.28, color: '#fde047' });

        // LIGHTNING 2T: 정전기장 (Static tethers between hit enemies)
        if (cs.lightning[2].level > 0 && hitList.length >= 2) {
          const tetherDmg = Math.round(computeClassSkillDamage(world, 'lightning', 2) * 0.55);
          for (let k = 0; k < hitList.length - 1; k++) {
            const a = hitList[k];
            const b = hitList[k + 1];
            if (!a.dying && !b.dying) {
              world.lightningArcs.push({
                points: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }],
                life: 0.45,
                maxLife: 0.45,
                color: '#fef08a',
              });
              hooks.damageEnemy(world, b, tetherDmg, a.x, a.y, 20, false, false, 'lightning', 'lightning');
            }
          }
        }
      }
      hooks.emitSound(world, 'lightning');
    }
  }

  // LIGHTNING 3T: 뇌신의 심판 (Persistent thunderstorm aura around Wizard)
  if (cs.lightning[3].level > 0 && (t.wiz_l3 ?? 0) <= 0) {
    t.wiz_l3 = 3.2;
    const rad = Math.round((155 + cs.lightning[3].level * 10) * getMutationAreaMult(world, 'lightning', 3));
    const dmg = Math.round(computeClassSkillDamage(world, 'lightning', 3) * 0.52);
    const existing = world.groundZones.find((z) => z.kind === 'thunder_storm');
    if (existing) {
      existing.life = 3.6;
      existing.radius = rad;
      existing.damage = dmg;
    } else {
      addGroundZone(world, {
        kind: 'thunder_storm',
        x: p.x,
        y: p.y,
        radius: rad,
        life: 3.6,
        maxLife: 3.6,
        tickTimer: 0.2,
        tickInterval: 0.45,
        damage: dmg,
        attribute: 'lightning',
        followPlayer: true,
      });
    }
  }

  // POISON 1T: 맹독 늪지 (Leaves Poison Wells along movement trail)
  if (cs.poison[1].level > 0) {
    t.wiz_p1_dist = (t.wiz_p1_dist ?? 0) + movedDist;
    if ((t.wiz_p1 ?? 0) <= 0 && (t.wiz_p1_dist >= 55 || movedDist > 0.2)) {
      t.wiz_p1 = Math.max(0.75, 1.5 - cs.poison[1].level * 0.05);
      t.wiz_p1_dist = 0;
      const rad = Math.round((56 + cs.poison[1].level * 7) * getMutationAreaMult(world, 'poison', 1));
      const dmg = Math.round(computeClassSkillDamage(world, 'poison', 1) * 0.45);
      if (world.poisonWells.length >= 12) world.poisonWells.shift();
      world.poisonWells.push({
        id: world.nextEntityId++,
        x: p.x,
        y: p.y,
        radius: rad,
        life: 4.5 + (cs.poison[1].mut5 === 'A' ? 2 : 0),
        maxLife: 4.5 + (cs.poison[1].mut5 === 'A' ? 2 : 0),
        tickTimer: 0.15,
        damagePerTick: dmg,
        poisonDur: 3.2,
      });
    }
  }

  // POISON 3T: 죽음의 안개 (Screen-wide lethal poison fog)
  if (cs.poison[3].level > 0 && (t.wiz_p3 ?? 0) <= 0) {
    t.wiz_p3 = 5.5;
    const rad = Math.round((270 + cs.poison[3].level * 16) * getMutationAreaMult(world, 'poison', 3));
    const dmg = Math.round(computeClassSkillDamage(world, 'poison', 3) * 0.42);
    addGroundZone(world, {
      kind: 'death_fog',
      x: p.x,
      y: p.y,
      radius: rad,
      life: 5.2,
      maxLife: 5.2,
      tickTimer: 0.25,
      tickInterval: cs.poison[3].mut5 === 'A' ? 0.42 : 0.65,
      damage: dmg,
      attribute: 'poison',
      followPlayer: true,
    });
    hooks.spawnFloatingText(world, p.x, p.y - 34, '죽음의 안개!', '#4ade80', 1.2);
  }

  // PHYSICAL 1T: 염동력 구체 (Orbiting knockback orbs) + 2T: 중력 왜곡
  if (cs.physical[1].level > 0) {
    p.kineticOrbitAngle += dt * (2.8 + cs.physical[1].level * 0.12);
    if ((t.wiz_k1 ?? 0) <= 0) {
      t.wiz_k1 = 0.22;
      const orbCount = 2 + Math.floor(cs.physical[1].level / 3) + (cs.physical[1].mut5 === 'A' ? 2 : 0);
      const orbitR = 74 + cs.physical[1].level * 4;
      const dmg = Math.round(computeClassSkillDamage(world, 'physical', 1) * 0.72);
      for (let k = 0; k < orbCount; k++) {
        const a = p.kineticOrbitAngle + (k / orbCount) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * orbitR;
        const oy = p.y + Math.sin(a) * orbitR;
        for (let j = 0; j < world.enemies.length; j++) {
          const e = world.enemies[j];
          if (e.dying) continue;
          if ((e.x - ox) ** 2 + (e.y - oy) ** 2 <= (e.radius + 18) ** 2) {
            hooks.damageEnemy(world, e, dmg, p.x, p.y, 210, false, true, undefined, 'physical');
          }
        }
      }
    }
  }

  // PHYSICAL 2T: 중력 왜곡 (Periodic pull + compression blast)
  if (cs.physical[2].level > 0 && (t.wiz_k2 ?? 0) <= 0) {
    const target = findDensestEnemy(world, 360);
    if (target) {
      t.wiz_k2 = Math.max(2.2, 4.2 - cs.physical[2].level * 0.12);
      const rad = Math.round((115 + cs.physical[2].level * 10) * getMutationAreaMult(world, 'physical', 2));
      const dmg = computeClassSkillDamage(world, 'physical', 2, target.isBoss);
      world.novaRings.push({ x: target.x, y: target.y, radius: rad, maxRadius: 12, life: 0.35, maxLife: 0.35, color: '#cbd5e1' });
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= rad + e.radius) {
          if (!e.isBoss && d > 12) {
            e.x += (dx / d) * Math.min(d * 0.65, 85);
            e.y += (dy / d) * Math.min(d * 0.65, 85);
          }
          hooks.damageEnemy(world, e, dmg, target.x, target.y, 65, true, true, undefined, 'physical');
        }
      }
      hooks.emitSound(world, 'nova');
    }
  }

  // PHYSICAL 3T: 차원 칼날 난무 (Phantom sword barrage)
  if (cs.physical[3].level > 0 && (t.wiz_k3 ?? 0) <= 0 && world.enemies.length > 0) {
    t.wiz_k3 = Math.max(1.8, (3.6 - cs.physical[3].level * 0.1) * p.cooldownMult);
    const syn = getSkillSynergyMultiplier(cs, 'physical', 3);
    const blades = 5 + syn.bonusCount + (cs.physical[3].mut5 === 'A' ? 5 : 0);
    const dmg = computeClassSkillDamage(world, 'physical', 3);
    let struck = 0;
    for (let i = 0; i < world.enemies.length && struck < blades; i++) {
      const e = world.enemies[i];
      if (e.dying) continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= 420 * 420) {
        struck += 1;
        hooks.spawnImpactBurst(world, 'slash_arc', e.x, e.y, hooks.nextRandom(world) * Math.PI * 2, 34, '#e2e8f0', 0.24);
        hooks.damageEnemy(world, e, dmg, p.x, p.y, 95, true, true, undefined, 'physical');
      }
    }
    if (struck > 0) hooks.emitSound(world, 'chakram');
  }
}

function updateWarriorSkills(
  world: WorldState,
  dt: number,
  movedDist: number,
  hooks: ClassCombatHooks
): void {
  const p = world.player;
  const cs = p.classSkills;
  const t = p.classSkillTimers;
  const tyrantScale = p.tyrantTimer > 0 ? 1.85 : 1;

  // LIGHTNING 2T: 과충전 도약 (speed scales lightning & attack frequency)
  const overdriveMult = cs.lightning[2].level > 0 ? Math.max(0.55, 1 - (Math.hypot(p.vx, p.vy) / 260) * (0.14 + cs.lightning[2].level * 0.025)) : 1;

  // FIRE 1T: 용암의 도끼 (Frontal cone fire cleave)
  if (cs.fire[1].level > 0 && (t.war_f1 ?? 0) <= 0) {
    const nearest = hooks.findNearestEnemy(world, p.x, p.y, 175 * tyrantScale);
    if (nearest) {
      t.war_f1 = Math.max(0.65, (1.45 - cs.fire[1].level * 0.05) * p.cooldownMult * overdriveMult);
      const aim = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      const rad = Math.round((118 + cs.fire[1].level * 7) * getMutationAreaMult(world, 'fire', 1));
      const dmg = computeClassSkillDamage(world, 'fire', 1, nearest.isBoss);
      const is360 = cs.fire[1].mut5 === 'A';
      hooks.spawnImpactBurst(world, 'slash_arc', p.x + Math.cos(aim) * 24, p.y + Math.sin(aim) * 24, aim, rad * 0.65, '#f97316', 0.26);
      hooks.emitSound(world, 'nova');
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy > (rad + e.radius) ** 2) continue;
        if (!is360) {
          const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - aim), Math.cos(Math.atan2(dy, dx) - aim)));
          if (diff > 1.05) continue;
        }
        hooks.applyEnemyStatus(e, 'burn', 3.0);
        hooks.damageEnemy(world, e, dmg, p.x, p.y, 185, true, true, 'fire', 'fire');
      }
    }
  }

  // FIRE 3T: 화산 폭발 (Lava erupts along movement trail)
  if (cs.fire[3].level > 0) {
    t.war_f3_dist = (t.war_f3_dist ?? 0) + movedDist;
    if ((t.war_f3 ?? 0) <= 0 && t.war_f3_dist >= 68) {
      t.war_f3 = Math.max(0.75, 1.6 - cs.fire[3].level * 0.06);
      t.war_f3_dist = 0;
      const rad = Math.round((78 + cs.fire[3].level * 6) * getMutationAreaMult(world, 'fire', 3));
      const dmg = Math.round(computeClassSkillDamage(world, 'fire', 3) * 0.65);
      addGroundZone(world, {
        kind: 'lava_fissure',
        x: p.x,
        y: p.y,
        radius: rad,
        life: 3.4,
        maxLife: 3.4,
        tickTimer: 0.1,
        tickInterval: 0.55,
        damage: dmg,
        attribute: 'fire',
      });
      hooks.emitSound(world, 'nova');
    }
  }

  // ICE 1T: 빙하 강타 (Ground slam spawning frontal ice spikes)
  if (cs.ice[1].level > 0 && (t.war_i1 ?? 0) <= 0) {
    const nearest = hooks.findNearestEnemy(world, p.x, p.y, 240 * tyrantScale);
    if (nearest) {
      t.war_i1 = Math.max(1.0, (2.1 - cs.ice[1].level * 0.06) * p.cooldownMult);
      const aim = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      const dmg = computeClassSkillDamage(world, 'ice', 1, nearest.isBoss);
      const sx = p.x + Math.cos(aim) * 95;
      const sy = p.y + Math.sin(aim) * 95;
      const rad = Math.round((86 + cs.ice[1].level * 7) * getMutationAreaMult(world, 'ice', 1));
      world.novaRings.push({ x: sx, y: sy, radius: 12, maxRadius: rad, life: 0.3, maxLife: 0.3, color: '#38bdf8' });
      hooks.spawnImpactBurst(world, 'frost_shatter', sx, sy, aim, 36, '#7dd3fc', 0.28);
      hooks.emitSound(world, 'frost');
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        if ((e.x - sx) ** 2 + (e.y - sy) ** 2 <= (rad + e.radius) ** 2) {
          hooks.applyEnemyStatus(e, 'freeze', 3.2);
          hooks.damageEnemy(world, e, dmg, p.x, p.y, 165, true, true, 'ice', 'ice');
        }
      }
    }
  }

  // ICE 3T: 빙벽 돌진 (Ice shield charge — executes frozen regular enemies!)
  if (cs.ice[3].level > 0 && (t.war_i3 ?? 0) <= 0) {
    const target = hooks.findNearestEnemy(world, p.x, p.y, 260);
    if (target) {
      t.war_i3 = Math.max(2.6, (5.2 - cs.ice[3].level * 0.16) * p.cooldownMult);
      const rad = Math.round((112 + cs.ice[3].level * 8) * getMutationAreaMult(world, 'ice', 3));
      const dmg = computeClassSkillDamage(world, 'ice', 3, target.isBoss);
      world.novaRings.push({ x: p.x, y: p.y, radius: 16, maxRadius: rad, life: 0.34, maxLife: 0.34, color: '#7dd3fc' });
      hooks.spawnFloatingText(world, p.x, p.y - 34, '빙벽 돌진!', '#7dd3fc', 1.22);
      hooks.emitSound(world, 'frost');
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (rad + e.radius) ** 2) {
          if (e.slowTimer > 0 && !e.isBoss && !e.isElite) {
            hooks.spawnFloatingText(world, e.x, e.y - 28, '빙결 즉사!', '#e0f2fe', 1.2);
            hooks.damageEnemy(world, e, e.hp + 999, p.x, p.y, 180, true, false, 'ice', 'ice');
          } else {
            hooks.applyEnemyStatus(e, 'freeze', 3.4);
            hooks.damageEnemy(world, e, dmg, p.x, p.y, 180, true, true, 'ice', 'ice');
          }
        }
      }
    }
  }

  // LIGHTNING 1T: 번개 망토 (Auto spark every 0.5s to nearby enemies)
  if (cs.lightning[1].level > 0 && (t.war_l1 ?? 0) <= 0) {
    t.war_l1 = 0.5 * overdriveMult;
    const rad = Math.round((130 + cs.lightning[1].level * 9) * getMutationAreaMult(world, 'lightning', 1));
    const hits = 1 + (cs.lightning[1].mut5 === 'A' ? 3 : 1);
    const dmg = Math.round(computeClassSkillDamage(world, 'lightning', 1) * 0.52);
    let count = 0;
    for (let i = 0; i < world.enemies.length && count < hits; i++) {
      const e = world.enemies[i];
      if (e.dying) continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (rad + e.radius) ** 2) {
        count += 1;
        world.lightningArcs.push({
          points: [{ x: p.x, y: p.y }, { x: e.x, y: e.y }],
          life: 0.16,
          maxLife: 0.16,
          color: '#fde047',
        });
        hooks.damageEnemy(world, e, dmg, p.x, p.y, 55, false, true, 'lightning', 'lightning');
      }
    }
  }

  // LIGHTNING 3T: 뇌전 일섬 (High-speed blink slashes between frontal enemies)
  if (cs.lightning[3].level > 0 && (t.war_l3 ?? 0) <= 0) {
    const target = hooks.findNearestEnemy(world, p.x, p.y, 320);
    if (target) {
      t.war_l3 = Math.max(2.6, (5.4 - cs.lightning[3].level * 0.16) * p.cooldownMult * overdriveMult);
      const dmg = computeClassSkillDamage(world, 'lightning', 3, target.isBoss);
      const maxTargets = 4 + Math.floor(cs.lightning[3].level / 2) + (cs.lightning[3].mut5 === 'A' ? 4 : 0);
      const pts = [{ x: p.x, y: p.y }];
      let struck = 0;
      for (let i = 0; i < world.enemies.length && struck < maxTargets; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= 340 * 340) {
          struck += 1;
          pts.push({ x: e.x, y: e.y });
          hooks.spawnImpactBurst(world, 'slash_arc', e.x, e.y, hooks.nextRandom(world) * 6.28, 36, '#fde047', 0.24);
          hooks.damageEnemy(world, e, dmg, p.x, p.y, 90, true, true, 'lightning', 'lightning');
        }
      }
      if (pts.length > 1) {
        world.lightningArcs.push({ points: pts, life: 0.34, maxLife: 0.34, color: '#fde047' });
        hooks.spawnFloatingText(world, p.x, p.y - 34, '뇌전 일섬!', '#fde047', 1.24);
        hooks.emitSound(world, 'lightning');
      }
    }
  }

  // POISON 3T: 역병의 화신 (Massive toxic aura around Warrior)
  if (cs.poison[3].level > 0 && (t.war_p3 ?? 0) <= 0) {
    t.war_p3 = 3.0;
    const rad = Math.round((135 + cs.poison[3].level * 10) * getMutationAreaMult(world, 'poison', 3));
    const dmg = Math.round(computeClassSkillDamage(world, 'poison', 3) * 0.48);
    const existing = world.groundZones.find((z) => z.kind === 'plague_aura');
    if (existing) {
      existing.life = 3.5;
      existing.radius = rad;
      existing.damage = dmg;
    } else {
      addGroundZone(world, {
        kind: 'plague_aura',
        x: p.x,
        y: p.y,
        radius: rad,
        life: 3.5,
        maxLife: 3.5,
        tickTimer: 0.15,
        tickInterval: 0.45,
        damage: dmg,
        attribute: 'poison',
        followPlayer: true,
      });
    }
  }

  // PHYSICAL 1T: 대지 분쇄 (Giant heavy knockback slam!)
  if (cs.physical[1].level > 0 && (t.war_k1 ?? 0) <= 0) {
    const nearest = hooks.findNearestEnemy(world, p.x, p.y, 185 * tyrantScale);
    if (nearest) {
      t.war_k1 = Math.max(0.85, (1.75 - cs.physical[1].level * 0.05) * p.cooldownMult);
      const rad = Math.round((125 + cs.physical[1].level * 8) * getMutationAreaMult(world, 'physical', 1));
      const dmg = computeClassSkillDamage(world, 'physical', 1, nearest.isBoss);
      world.novaRings.push({ x: p.x, y: p.y, radius: 16, maxRadius: rad, life: 0.3, maxLife: 0.3, color: '#e2e8f0' });
      hooks.spawnImpactBurst(world, 'slash_arc', p.x, p.y, p.aimAngle, rad * 0.6, '#e2e8f0', 0.26);
      hooks.emitSound(world, 'nova');
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (rad + e.radius) ** 2) {
          hooks.damageEnemy(world, e, dmg, p.x, p.y, 310, true, true, undefined, 'physical');
        }
      }
    }
  }

  // PHYSICAL 3T: 전장의 폭군 (2x Giant mode + destroys all enemy projectiles!)
  if (cs.physical[3].level > 0) {
    if ((t.war_k3 ?? 0) <= 0) {
      t.war_k3 = Math.max(6.5, 11 - cs.physical[3].level * 0.25);
      p.tyrantTimer = 5.0 + cs.physical[3].level * 0.35;
      hooks.spawnFloatingText(world, p.x, p.y - 40, '전장의 폭군 각성!', '#fbbf24', 1.3);
      hooks.emitSound(world, 'levelup');
    }
    if (p.tyrantTimer > 0) {
      const destroyR = 115;
      for (let i = world.projectiles.length - 1; i >= 0; i--) {
        const pr = world.projectiles[i];
        if (pr.owner === 'enemy' && (pr.x - p.x) ** 2 + (pr.y - p.y) ** 2 <= destroyR * destroyR) {
          hooks.spawnParticles(world, pr.x, pr.y, 4, '#fbbf24', 40, 120, 3, 0.22, 'spark');
          world.projectiles.splice(i, 1);
        }
      }
    }
  }
  void dt;
}

function updateArcherSkills(
  world: WorldState,
  dt: number,
  hooks: ClassCombatHooks
): void {
  const p = world.player;
  const cs = p.classSkills;
  const t = p.classSkillTimers;

  // Helper aim angle toward nearest enemy or player aim
  const getAim = (range: number): { angle: number; target: Enemy | null } => {
    const target = hooks.findNearestEnemy(world, p.x, p.y, range);
    return {
      angle: target ? Math.atan2(target.y - p.y, target.x - p.x) : p.aimAngle,
      target,
    };
  };

  // FIRE 1T: 소이탄 화살 (+ 2T 집속 폭약 split)
  if (cs.fire[1].level > 0 && (t.arc_f1 ?? 0) <= 0) {
    const { angle, target } = getAim(520);
    if (target) {
      t.arc_f1 = Math.max(0.7, (1.65 - cs.fire[1].level * 0.06) * p.cooldownMult);
      const dmg = computeClassSkillDamage(world, 'fire', 1, target.isBoss);
      const shots = cs.fire[1].mut10 === 'A' ? 2 : 1;
      const cluster = cs.fire[2].level > 0 ? (cs.fire[2].mut5 === 'A' ? 6 : 3) : 0;
      for (let s = 0; s < shots; s++) {
        const a = angle + (s - (shots - 1) / 2) * 0.14;
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'incendiary_arrow',
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 580,
          vy: Math.sin(a) * 580,
          radius: 8,
          damage: dmg,
          life: 1.2,
          maxLife: 1.2,
          pierce: 0,
          hitIds: [],
          color: '#fb923c',
          element: 'fire',
          skillAttribute: 'fire',
          aoeRadius: Math.round((62 + cs.fire[1].level * 6) * getMutationAreaMult(world, 'fire', 1)),
          spawnZoneOnHit: 'fire_puddle',
          clusterSplit: cluster,
          applyMark: true,
        });
      }
      hooks.emitSound(world, 'bolt');
    }
  }

  // FIRE 3T: 유성 화살비 (Fire arrow barrage onto marked/densest target)
  if (cs.fire[3].level > 0 && (t.arc_f3 ?? 0) <= 0) {
    const marked = world.enemies.find((e) => !e.dying && e.markedTimer > 0) ?? findDensestEnemy(world, 500);
    if (marked) {
      t.arc_f3 = Math.max(2.6, (5.2 - cs.fire[3].level * 0.15) * p.cooldownMult);
      const rad = Math.round((115 + cs.fire[3].level * 8) * getMutationAreaMult(world, 'fire', 3));
      const dmg = computeClassSkillDamage(world, 'fire', 3, marked.isBoss);
      world.novaRings.push({ x: marked.x, y: marked.y, radius: 14, maxRadius: rad, life: 0.36, maxLife: 0.36, color: '#fb923c' });
      hooks.spawnImpactBurst(world, 'level_pillar', marked.x, marked.y, 0, 1.0, '#fb923c', 0.38);
      hooks.spawnFloatingText(world, marked.x, marked.y - 34, '유성 화살비!', '#fb923c', 1.2);
      hooks.emitSound(world, 'nova');
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        if ((e.x - marked.x) ** 2 + (e.y - marked.y) ** 2 <= (rad + e.radius) ** 2) {
          hooks.applyEnemyStatus(e, 'burn', 3.4);
          hooks.damageEnemy(world, e, dmg, marked.x, marked.y, 85, true, true, 'fire', 'fire');
        }
      }
    }
  }

  // ICE 1T: 서리 송곳 (+ 2T 다중 도탄 + 3T 만년설 폭풍)
  if (cs.ice[1].level > 0 && (t.arc_i1 ?? 0) <= 0) {
    const { angle, target } = getAim(540);
    if (target) {
      t.arc_i1 = Math.max(0.65, (1.55 - cs.ice[1].level * 0.05) * p.cooldownMult);
      const dmg = computeClassSkillDamage(world, 'ice', 1, target.isBoss);
      const shots = cs.ice[1].mut10 === 'A' ? 3 : 1;
      const ricochet = cs.ice[2].level > 0 ? 2 + Math.floor(cs.ice[2].level / 2) + (cs.ice[2].mut5 === 'A' ? 3 : 0) : 0;
      const pierce = 2 + Math.floor(cs.ice[1].level / 2) + (cs.ice[1].mut5 === 'A' ? 4 : 0);
      for (let s = 0; s < shots; s++) {
        const a = angle + (s - (shots - 1) / 2) * 0.16;
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'frost_arrow',
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 620,
          vy: Math.sin(a) * 620,
          radius: 8,
          damage: dmg,
          life: 1.35,
          maxLife: 1.35,
          pierce,
          hitIds: [],
          color: '#38bdf8',
          element: 'ice',
          skillAttribute: 'ice',
          ricochetLeft: ricochet,
          spawnZoneOnHit: cs.ice[3].level > 0 ? 'blizzard' : undefined,
          applyMark: true,
        });
      }
      hooks.emitSound(world, 'frost');
    }
  }

  // LIGHTNING 1T: 전격 화살 (Ultra-fast straight laser arrow)
  if (cs.lightning[1].level > 0 && (t.arc_l1 ?? 0) <= 0) {
    const { angle, target } = getAim(580);
    if (target) {
      t.arc_l1 = Math.max(0.42, (1.15 - cs.lightning[1].level * 0.04) * p.cooldownMult) * (cs.lightning[1].mut5 === 'A' ? 0.8 : 1);
      const dmg = computeClassSkillDamage(world, 'lightning', 1, target.isBoss);
      const shots = cs.lightning[1].mut5 === 'A' ? 2 : 1;
      for (let s = 0; s < shots; s++) {
        const a = angle + (s - (shots - 1) / 2) * 0.08;
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'lightning_arrow',
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 860,
          vy: Math.sin(a) * 860,
          radius: 7,
          damage: dmg,
          life: 0.95,
          maxLife: 0.95,
          pierce: 3,
          hitIds: [],
          color: '#fde047',
          element: 'lightning',
          skillAttribute: 'lightning',
          applyMark: true,
        });
      }
      hooks.emitSound(world, 'lightning');
    }
  }

  // LIGHTNING 3T: 전자기 레일건 (Screen-piercing giant electric beam)
  if (cs.lightning[3].level > 0 && (t.arc_l3 ?? 0) <= 0) {
    const { angle, target } = getAim(640);
    if (target) {
      t.arc_l3 = Math.max(2.6, (5.2 - cs.lightning[3].level * 0.16) * p.cooldownMult) * (cs.lightning[3].mut5 === 'A' ? 0.8 : 1);
      const beamLen = 780;
      const beamW = (26 + cs.lightning[3].level * 2) * (cs.lightning[3].mut5 === 'A' ? 1.8 : 1);
      const ex = p.x + Math.cos(angle) * beamLen;
      const ey = p.y + Math.sin(angle) * beamLen;
      const dmg = computeClassSkillDamage(world, 'lightning', 3, target.isBoss);
      world.lightningArcs.push({
        points: [{ x: p.x, y: p.y }, { x: ex, y: ey }],
        life: 0.36,
        maxLife: 0.36,
        color: '#38bdf8',
      });
      hooks.spawnFloatingText(world, p.x, p.y - 34, '전자기 레일건!', '#fde047', 1.24);
      hooks.emitSound(world, 'lightning');
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        if (e.dying) continue;
        // Distance to beam segment
        const vx = ex - p.x;
        const vy = ey - p.y;
        const l2 = vx * vx + vy * vy || 1;
        const proj = Math.max(0, Math.min(1, ((e.x - p.x) * vx + (e.y - p.y) * vy) / l2));
        const px = p.x + proj * vx;
        const py = p.y + proj * vy;
        if ((e.x - px) ** 2 + (e.y - py) ** 2 <= (beamW + e.radius) ** 2) {
          hooks.damageEnemy(world, e, dmg, p.x, p.y, 130, true, true, 'lightning', 'lightning');
        }
      }
    }
  }

  // POISON 1T: 독침 연사 (5-dart fan) + 3T 맹독 꽃봉오리
  if (cs.poison[1].level > 0 && (t.arc_p1 ?? 0) <= 0) {
    const { angle, target } = getAim(460);
    if (target) {
      t.arc_p1 = Math.max(0.55, (1.3 - cs.poison[1].level * 0.04) * p.cooldownMult) * (cs.poison[1].mut10 === 'A' ? 0.7 : 1);
      const darts = 5 + (cs.poison[1].mut5 === 'A' ? 4 : 0);
      const spread = cs.poison[1].mut5 === 'B' ? 0.24 : 0.62;
      const dmg = Math.round(computeClassSkillDamage(world, 'poison', 1) * 0.54);
      for (let d = 0; d < darts; d++) {
        const a = angle + ((d / (darts - 1)) - 0.5) * spread;
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'poison_dart',
          x: p.x + Math.cos(a) * 14,
          y: p.y + Math.sin(a) * 14,
          vx: Math.cos(a) * 520,
          vy: Math.sin(a) * 520,
          radius: 5,
          damage: dmg,
          life: 0.95,
          maxLife: 0.95,
          pierce: cs.poison[1].mut5 === 'A' ? 1 : 0,
          hitIds: [],
          color: '#4ade80',
          element: 'poison',
          skillAttribute: 'poison',
          sourceSkillTier: cs.poison[3].level > 0 ? 3 : 1,
        });
      }
      hooks.emitSound(world, 'bolt');
    }
  }

  // PHYSICAL 1T: 관통 강철화살
  if (cs.physical[1].level > 0 && (t.arc_k1 ?? 0) <= 0) {
    const { angle, target } = getAim(560);
    if (target) {
      t.arc_k1 = Math.max(0.65, (1.45 - cs.physical[1].level * 0.05) * p.cooldownMult) * (cs.physical[1].mut10 === 'A' ? 0.75 : 1);
      const dmg = computeClassSkillDamage(world, 'physical', 1, target.isBoss);
      const shots = cs.physical[1].mut5 === 'A' ? 2 : 1;
      for (let s = 0; s < shots; s++) {
        const a = angle + (s - (shots - 1) / 2) * 0.1;
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'steel_arrow',
          x: p.x + Math.cos(a) * 16,
          y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 680,
          vy: Math.sin(a) * 680,
          radius: 8,
          damage: dmg,
          life: 1.35,
          maxLife: 1.35,
          pierce: 99,
          hitIds: [],
          color: '#e2e8f0',
          skillAttribute: 'physical',
          applyMark: true,
        });
      }
      hooks.emitSound(world, 'chakram');
    }
  }

  // PHYSICAL 3T: 천공의 일격 (Colossal screen-splitting arrow)
  if (cs.physical[3].level > 0 && (t.arc_k3 ?? 0) <= 0) {
    const { angle, target } = getAim(640);
    if (target) {
      t.arc_k3 = Math.max(2.8, (5.5 - cs.physical[3].level * 0.16) * p.cooldownMult);
      const dmg = Math.round(computeClassSkillDamage(world, 'physical', 3, target.isBoss) * 1.45);
      const rad = Math.round((24 + cs.physical[3].level * 2) * (cs.physical[3].mut5 === 'A' ? 1.5 : 1));
      const dirs = cs.physical[3].mut10 === 'A' ? [angle, angle + Math.PI] : [angle];
      for (const a of dirs) {
        world.projectiles.push({
          id: world.nextEntityId++,
          owner: 'player',
          kind: 'sky_arrow',
          x: p.x + Math.cos(a) * 20,
          y: p.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 760,
          vy: Math.sin(a) * 760,
          radius: rad,
          damage: dmg,
          life: 1.25,
          maxLife: 1.25,
          pierce: 99,
          hitIds: [],
          color: '#fef08a',
          skillAttribute: 'physical',
        });
      }
      hooks.spawnFloatingText(world, p.x, p.y - 36, '천공의 일격!', '#fef08a', 1.26);
      hooks.emitSound(world, 'nova');
    }
  }
  void dt;
}

export function onClassProjectileHit(
  world: WorldState,
  pr: WorldState['projectiles'][number],
  enemy: Enemy,
  hooks: ClassCombatHooks
): void {
  const p = world.player;
  if (pr.applyMark) {
    enemy.markedTimer = Math.max(enemy.markedTimer, 5.0);
  }

  // Archer Fire 1T puddle + 2T cluster split
  if (pr.spawnZoneOnHit === 'fire_puddle') {
    addGroundZone(world, {
      kind: 'fire_puddle',
      x: enemy.x,
      y: enemy.y,
      radius: pr.aoeRadius ?? 64,
      life: 3.4,
      maxLife: 3.4,
      tickTimer: 0.15,
      tickInterval: 0.5,
      damage: Math.max(6, Math.round(pr.damage * 0.4)),
      attribute: 'fire',
    });
  }
  if (pr.clusterSplit && pr.clusterSplit > 0) {
    const count = pr.clusterSplit;
    const subDmg = Math.max(8, Math.round(pr.damage * 0.58));
    for (let c = 0; c < count; c++) {
      const a = (c / count) * Math.PI * 2 + hooks.nextRandom(world) * 0.3;
      const sx = enemy.x + Math.cos(a) * 46;
      const sy = enemy.y + Math.sin(a) * 46;
      world.novaRings.push({ x: sx, y: sy, radius: 8, maxRadius: 48, life: 0.24, maxLife: 0.24, color: '#fb923c' });
      for (let j = 0; j < world.enemies.length; j++) {
        const o = world.enemies[j];
        if (!o || o.dying) continue;
        if ((o.x - sx) ** 2 + (o.y - sy) ** 2 <= (48 + o.radius) ** 2) {
          hooks.applyEnemyStatus(o, 'burn', 2.4);
          hooks.damageEnemy(world, o, subDmg, sx, sy, 65, false, false, 'fire', 'fire');
        }
      }
    }
  }

  // Archer Ice 3T Blizzard tornado
  if (pr.spawnZoneOnHit === 'blizzard' && (p.classSkillTimers.arc_blizz_cd ?? 0) <= 0) {
    p.classSkillTimers.arc_blizz_cd = 1.6;
    const rad = Math.round((84 + p.classSkills.ice[3].level * 7) * getMutationAreaMult(world, 'ice', 3));
    addGroundZone(world, {
      kind: 'blizzard',
      x: enemy.x,
      y: enemy.y,
      radius: rad,
      life: 3.6,
      maxLife: 3.6,
      tickTimer: 0.15,
      tickInterval: 0.48,
      damage: Math.max(8, Math.round(computeClassSkillDamage(world, 'ice', 3) * 0.45)),
      attribute: 'ice',
      pullStrength: p.classSkills.ice[3].mut10 === 'A' ? 85 : 35,
    });
  }

  // Archer Ice 2T Ricochet when hitting a frozen enemy
  if (pr.ricochetLeft && pr.ricochetLeft > 0 && enemy.slowTimer > 0) {
    let nextTarget: Enemy | null = null;
    let bestD2 = 260 * 260;
    for (let j = 0; j < world.enemies.length; j++) {
      const cand = world.enemies[j];
      if (cand.dying || cand.id === enemy.id || pr.hitIds.includes(cand.id)) continue;
      const d2 = (cand.x - enemy.x) ** 2 + (cand.y - enemy.y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        nextTarget = cand;
      }
    }
    if (nextTarget) {
      const a = Math.atan2(nextTarget.y - enemy.y, nextTarget.x - enemy.x);
      const spd = Math.hypot(pr.vx, pr.vy) || 580;
      pr.vx = Math.cos(a) * spd;
      pr.vy = Math.sin(a) * spd;
      pr.ricochetLeft -= 1;
      pr.pierce = Math.max(pr.pierce, 1);
    }
  }

  // Archer Poison 3T: plant 맹독 꽃봉오리 seed inside enemy
  if (pr.kind === 'poison_dart' && pr.sourceSkillTier === 3 && enemy.bloomTimer <= 0) {
    enemy.bloomTimer = 1.3;
    enemy.bloomDmg = computeClassSkillDamage(world, 'poison', 3, enemy.isBoss);
  }
}

export function getClassSkillSummaryForHud(world: WorldState): {
  investedCount: number;
  attributeTotals: Record<SkillAttribute, number>;
} {
  const totals: Record<SkillAttribute, number> = {
    fire: 0,
    ice: 0,
    lightning: 0,
    poison: 0,
    physical: 0,
  };
  let invested = 0;
  for (const attr of ALL_SKILL_ATTRIBUTES) {
    const sum =
      world.player.classSkills[attr][1].level +
      world.player.classSkills[attr][2].level +
      world.player.classSkills[attr][3].level;
    totals[attr] = sum;
    invested += sum;
  }
  return { investedCount: invested, attributeTotals: totals };
}

export { ATTRIBUTE_META, CLASS_SKILL_CATALOG };
