import assert from 'node:assert/strict';
import test from 'node:test';
import { computeJoystickVector, JOYSTICK_MAX_RADIUS } from './joystick';
import {
  ALL_ELEMENTS,
  ALL_MERCHANT_SLOTS,
  ELEMENT_CATALOG,
  getChosenElement,
  getElementAffinity,
  getElementAreaValue,
  getElementAttackPower,
  getMerchantUpgradeCost,
  ITEM_DROP_RATE_CHEST,
  MAX_ELEMENT_BRANCH_LEVEL,
  MAX_WAVES,
  MERCHANT_DURATION_SEC,
  MERCHANT_GEAR_CATALOG,
  MERCHANT_SPAWN_TRAVEL_SEC,
  RARITY_DROP_WEIGHTS,
  WAVE_CONFIGS,
  WAVE_DURATION_SEC,
} from './catalog';
import {
  applyEnemyStatus,
  applyPlayerStatus,
  closeMerchantShop,
  closeSkillTree,
  computeElementalSkillDamage,
  computeEnemyCoinDrop,
  computeHeroStats,
  createEmptyInput,
  createInitialWorld,
  damageEnemy,
  damagePlayer,
  equipPendingLoot,
  generateGearItem,
  getHudSnapshot,
  getItemSalvageGold,
  inspectLootDrop,
  openMerchantShop,
  openSkillTree,
  openWorldChest,
  rollGearRarity,
  salvagePendingLoot,
  selectClassSkillMutation,
  spawnEnemyAt,
  spawnLootDrop,
  spawnMerchantNow,
  startNewRun,
  stepWorld,
  triggerDash,
  unlockOrUpgradeElement,
  upgradeClassSkill,
  upgradeEquippedItem,
  upgradeItemSkill,
  upgradeMerchantGear,
  xpForLevel,
} from './engine';
import {
  ALL_HERO_CLASSES,
  ALL_SKILL_ATTRIBUTES,
  ALL_SKILL_TIERS,
  CLASS_SKILL_CATALOG,
  HERO_BASIC_WEAPON_CONFIG,
  HERO_CLASS_CATALOG,
  HYBRID_FUSION_CATALOG,
  getActiveHybridFusions,
  getSkillSynergyMultiplier,
} from './classSkills';
import { computeMinimapRadar, MINIMAP_RADAR_RANGE } from './minimap';
import type { BossKind } from './types';

function advanceFrames(
  world: ReturnType<typeof createInitialWorld>,
  input: ReturnType<typeof createEmptyInput>,
  frames: number,
  dt = 1 / 60
): void {
  for (let i = 0; i < frames; i++) {
    stepWorld(world, dt, input);
  }
}

test('20-stage progression has 20s pacing, tougher difficulty curve, and 4 major bosses', () => {
  assert.equal(MAX_WAVES, 20);
  assert.equal(WAVE_DURATION_SEC, 20);
  assert.equal(WAVE_CONFIGS.length, 20);
  assert.equal(WAVE_CONFIGS[4].bossKind, 'boss_behemoth');
  assert.equal(WAVE_CONFIGS[9].bossKind, 'boss_pyrolord');
  assert.equal(WAVE_CONFIGS[14].bossKind, 'boss_frostqueen');
  assert.equal(WAVE_CONFIGS[19].bossKind, 'lich_boss');
  assert.ok(WAVE_CONFIGS[19].hpMult > 12, 'Stage 20 should have steep hardcore HP scaling');
});

test('new run equips class starter weapon (Wizard Magic Missile) and survives opening 5s with no levelup modal', () => {
  const world = createInitialWorld(0, 42);
  const input = createEmptyInput();
  startNewRun(world, 42);

  assert.equal(world.phase, 'playing');
  assert.ok(world.player.equipment.weapon, 'hero starts with starter normal weapon');
  assert.equal(world.player.equipment.weapon?.rarity, 'normal');
  assert.equal(world.player.equipment.weapon?.name, '매직 미사일 지팡이');
  assert.equal(world.player.equipment.weapon?.attachedSkills.length, 0, 'starter weapon carries no duplicate attached skills');

  advanceFrames(world, input, 300); // 5 seconds
  assert.equal(world.phase, 'playing', 'no levelup modal should interrupt gameplay');
  assert.ok(world.player.hp > 0, 'hero survives opening 5 seconds safely');
});

test('exact loot economy: ~20% item drop rate and chart rarity distribution (2% Legendary / 10% Epic / 30% Rare / 58% Normal)', () => {
  const world = createInitialWorld(0, 2026);
  startNewRun(world, 2026);

  // 1. Test rarity distribution over 10,000 rolls matching user chart ranges
  const counts = { legendary: 0, epic: 0, rare: 0, normal: 0 };
  const totalRarityRolls = 10000;
  for (let i = 0; i < totalRarityRolls; i++) {
    counts[rollGearRarity(world)] += 1;
  }

  const legPct = counts.legendary / totalRarityRolls;
  const epicPct = counts.epic / totalRarityRolls;
  const rarePct = counts.rare / totalRarityRolls;
  const normPct = counts.normal / totalRarityRolls;

  assert.equal(RARITY_DROP_WEIGHTS.legendary, 0.02);
  assert.equal(RARITY_DROP_WEIGHTS.epic, 0.1);
  assert.equal(RARITY_DROP_WEIGHTS.rare, 0.3);
  assert.equal(RARITY_DROP_WEIGHTS.normal, 0.58);

  assert.ok(legPct >= 0.01 && legPct <= 0.03, `Legendary must be in 1%~3% (got ${(legPct * 100).toFixed(2)}%)`);
  assert.ok(epicPct >= 0.07 && epicPct <= 0.12, `Epic must be in 7%~12% (got ${(epicPct * 100).toFixed(2)}%)`);
  assert.ok(rarePct >= 0.25 && rarePct <= 0.35, `Rare must be in 25%~35% (got ${(rarePct * 100).toFixed(2)}%)`);
  assert.ok(normPct >= 0.5 && normPct <= 0.65, `Normal must be in 50%~65% (got ${(normPct * 100).toFixed(2)}%)`);

  // 2. Test wooden chest item drop rate over 1,000 chests (~20%)
  let chestDrops = 0;
  const totalChests = 1000;
  for (let i = 0; i < totalChests; i++) {
    const before = world.lootDrops.length;
    openWorldChest(world, {
      id: 10000 + i,
      x: 50,
      y: 50,
      tier: 'wooden',
      opened: false,
      openAnim: 0,
      bobPhase: 0,
    });
    if (world.lootDrops.length > before) {
      chestDrops += 1;
      world.lootDrops.length = 0;
    }
  }
  const chestDropRate = chestDrops / totalChests;
  assert.ok(
    Math.abs(chestDropRate - ITEM_DROP_RATE_CHEST) < 0.035,
    `Wooden chest drop rate should be ~20% (got ${(chestDropRate * 100).toFixed(1)}%)`
  );
  assert.ok(world.player.gold > 2000, 'non-gear chests should yield Gold for the Wandering Equipment Merchant');
  assert.equal(world.player.upgradeShards, 0, 'removed upgrade shard economy should not accumulate shards');
});

test('dropped gear carries clean stats without duplicate attached skills and equipping swaps stats while refunding Gold', () => {
  const world = createInitialWorld(0, 777);
  startNewRun(world, 777);

  const drop = spawnLootDrop(world, 40, 0, 'boss', 'weapon', 'epic');
  assert.equal(drop.item.attachedSkills.length, 0, 'dropped gear must not attach duplicate weapon skills');

  const goldBefore = world.player.gold;
  const oldWeapon = world.player.equipment.weapon!;
  const expectedRefund = getItemSalvageGold(oldWeapon);
  assert.equal(inspectLootDrop(world, drop), true);
  assert.equal(world.phase, 'loot');
  assert.equal(equipPendingLoot(world), true);
  assert.equal(world.phase, 'playing');

  assert.equal(world.player.equipment.weapon?.id, drop.item.id, 'new weapon equipped cleanly');
  assert.equal(
    world.player.gold,
    goldBefore + expectedRefund,
    'replacing equipped weapon automatically salvages old weapon into Gold'
  );
  assert.equal(world.player.upgradeShards, 0, 'equipping never awards deprecated upgrade shards');

  const armorDrop = spawnLootDrop(world, 45, 0, 'elite', 'armor', 'rare');
  assert.equal(armorDrop.item.attachedSkills.length, 0, 'dropped armor carries clean stats without attached skills');
  inspectLootDrop(world, armorDrop);
  equipPendingLoot(world);
  assert.equal(world.player.equipment.armor?.id, armorDrop.item.id);
});

test('salvaging loot yields Gold and deprecated Shard Forge & Skill-XP weapon upgrades are disabled', () => {
  const world = createInitialWorld(0, 321);
  startNewRun(world, 321);

  const drop = spawnLootDrop(world, 30, 0, 'chest_wooden', 'weapon', 'legendary');
  const expectedGold = getItemSalvageGold(drop.item);
  assert.ok(expectedGold >= 75, `salvaging Legendary yields >=75G for Merchant upgrades (got ${expectedGold}G)`);
  inspectLootDrop(world, drop);
  assert.equal(salvagePendingLoot(world), true);
  assert.equal(world.player.gold, expectedGold, 'salvaging Legendary grants exact Gold payout');
  assert.equal(world.player.upgradeShards, 0, 'salvaging does not produce deprecated shards');

  // Old duplicate progression APIs must remain disabled
  world.player.upgradeShards = 999;
  world.player.skillXp = 999;
  assert.equal(upgradeEquippedItem(world, 'weapon'), false, 'deprecated Shard Forge upgrade must be disabled');
  assert.equal(upgradeItemSkill(world, 'weapon', 0), false, 'deprecated Skill-XP weapon upgrade must be disabled');
});

test('XP gain levels up into Class Skill Tree (+SP) cleanly without stockpiling deprecated skillXp', () => {
  const world = createInitialWorld(0, 555);
  const input = createEmptyInput();
  startNewRun(world, 555);

  world.pickups.push({
    id: world.nextEntityId++,
    kind: 'xp_large',
    x: world.player.x,
    y: world.player.y,
    vx: 0,
    vy: 0,
    value: 220,
    magnetized: true,
    bobPhase: 0,
  });

  advanceFrames(world, input, 3);
  assert.equal(world.phase, 'playing', 'leveling up plays celebration without forcibly pausing combat');
  assert.ok(world.levelUpAnimTimer > 0, 'leveling up triggers level-up celebration animation timer');
  assert.ok(world.player.level >= 2, 'level increases smoothly');
  assert.ok(world.player.skillPoints >= 1, 'leveling up awards Skill Points');
  assert.equal(world.player.skillXp, 0, 'deprecated skillXp is no longer stockpiled');
  assert.equal(openSkillTree(world), true, 'player can open Skill Tree on demand');
  assert.equal(world.phase, 'skill_tree');
  closeSkillTree(world);
  assert.equal(world.phase, 'playing', 'closing skill tree resumes gameplay');
});

test('infinite open field allows unbounded exploration and procedurally generates new chunks & chests', () => {
  const world = createInitialWorld(0, 88);
  const input = createEmptyInput();
  startNewRun(world, 88);

  const initialChunks = world.visitedChunks.size;
  input.keys.add('KeyD');
  for (let f = 0; f < 400; f++) {
    if (world.phase === 'skill_tree') closeSkillTree(world);
    if (world.phase === 'merchant') closeMerchantShop(world);
    stepWorld(world, 1 / 60, input);
  }

  assert.ok(world.player.x > 1100, `hero should explore beyond old 1040 wall (x=${world.player.x.toFixed(1)})`);
  assert.ok(world.visitedChunks.size > initialChunks, 'new infinite world chunks discovered');
  assert.ok(world.chests.length >= 1, 'newly discovered chunks maintain active treasure chests');
});

test('lag fix: normal kills and heavy AoE hits never trigger hitstop; 100-mob swarm steps smoothly', () => {
  const world = createInitialWorld(0, 101);
  const input = createEmptyInput();
  startNewRun(world, 101);

  for (let i = 0; i < 95; i++) {
    const a = (i / 95) * Math.PI * 2;
    spawnEnemyAt(world, i % 3 === 0 ? 'bat' : 'skeleton', Math.cos(a) * 260, Math.sin(a) * 260);
  }

  for (let i = 0; i < 15; i++) {
    damageEnemy(world, world.enemies[i], 9999, 0, 0, 120, true, false);
  }
  assert.equal(world.hitstopTimer, 0, 'normal kills must never trigger hitstop');
  if (world.phase === 'skill_tree') closeSkillTree(world);

  for (let f = 0; f < 60; f++) {
    if (world.phase === 'skill_tree') closeSkillTree(world);
    stepWorld(world, 1 / 60, input);
  }
  assert.ok(world.elapsed > 0.9, '100-mob swarm advances smoothly without freezing');
});

test('dash, all 4 boss archetypes, biome evolution, defeat, and Stage 20 victory work reliably', () => {
  const world = createInitialWorld(0, 999);
  const input = createEmptyInput();
  startNewRun(world, 999);

  // Dash works
  const x0 = world.player.x;
  assert.equal(triggerDash(world, 1, 0), true);
  advanceFrames(world, input, 12);
  assert.ok(world.player.x > x0 + 50, 'dash moves hero rapidly');

  // Biome evolution triggered by upgrading high-tier legendary weapon
  const legWeapon = generateGearItem(world, 'boss', 'weapon', 'legendary');
  legWeapon.stats.atk = 90;
  world.player.equipment.weapon = legWeapon;
  const drop = spawnLootDrop(world, 0, 0, 'boss', 'armor', 'legendary');
  inspectLootDrop(world, drop);
  equipPendingLoot(world);
  assert.ok(world.biomeIndex >= 1, 'high CP gear evolves field biome');

  // Boss kills: Stage 5/10/15 mid-bosses continue run (after dismissing any level-up skill tree); Stage 20 Lich Lord wins
  const bosses: BossKind[] = ['boss_behemoth', 'boss_pyrolord', 'boss_frostqueen', 'lich_boss'];
  for (let i = 0; i < bosses.length - 1; i++) {
    const b = spawnEnemyAt(world, bosses[i], world.player.x + 260, world.player.y);
    damageEnemy(world, b, 999999, 0, 0, 0, false, false);
    if (world.phase === 'skill_tree') closeSkillTree(world);
    advanceFrames(world, input, 10);
    assert.equal(world.phase, 'playing', `mid-boss ${bosses[i]} kill continues run`);
  }

  world.wave = 20;
  const lich = spawnEnemyAt(world, 'lich_boss', world.player.x + 260, world.player.y);
  damageEnemy(world, lich, 999999, 0, 0, 0, false, false);
  advanceFrames(world, input, 60);
  assert.equal(world.phase, 'victory', 'Stage 20 Lich Lord kill triggers victory');

  // Defeat reachable
  const w2 = createInitialWorld(0, 123);
  startNewRun(w2, 123);
  w2.player.hp = 1;
  spawnEnemyAt(w2, 'skeleton', w2.player.x + 2, w2.player.y);
  advanceFrames(w2, createEmptyInput(), 80);
  assert.equal(w2.phase, 'gameover', 'player defeat triggers gameover');
});

test('late-game balance: cooldownMult cap, dense late-stage swarms, and max-upgraded AFK hero is NOT immortal', () => {
  // 1. Late-stage swarm density check
  const stage20 = WAVE_CONFIGS[19];
  assert.ok(stage20.maxEnemies >= 135, `Stage 20 maxEnemies should be dense (got ${stage20.maxEnemies})`);
  assert.ok(stage20.batchSize >= 6, `Stage 20 batchSize should be >= 6 (got ${stage20.batchSize})`);
  assert.ok(stage20.spawnInterval <= 0.22, `Stage 20 spawnInterval should be <= 0.22s (got ${stage20.spawnInterval})`);

  // 2. Equip full Legendary gear + Merchant upgrades with extreme atkSpeedPct
  const world = createInitialWorld(0, 2027);
  startNewRun(world, 2027);
  world.wave = 18;
  world.elapsed = 17 * WAVE_DURATION_SEC + 2;

  const slots = ['weapon', 'armor', 'helm', 'accessory'] as const;
  for (const slot of slots) {
    const drop = spawnLootDrop(world, world.player.x, world.player.y, 'boss', slot, 'legendary');
    drop.item.stats.atkSpeedPct += 35; // push raw atkSpeedPct way above cap
    inspectLootDrop(world, drop);
    equipPendingLoot(world);
  }
  // Apply Merchant upgrades across all 5 slots
  world.player.gold = 999999;
  spawnMerchantNow(world, world.player.x + 10, world.player.y);
  openMerchantShop(world);
  for (const mSlot of ALL_MERCHANT_SLOTS) {
    for (let u = 0; u < 5; u++) {
      upgradeMerchantGear(world, mSlot);
    }
  }
  closeMerchantShop(world);

  const computed = computeHeroStats(world.player);
  assert.ok(
    world.player.cooldownMult >= 0.679,
    `cooldownMult must be capped at >=0.68 (got ${world.player.cooldownMult.toFixed(3)})`
  );
  assert.ok(
    computed.damageReduction <= 0.551,
    `damageReduction must be capped at <=0.55 (got ${computed.damageReduction.toFixed(3)})`
  );

  // 3. Stand completely still (AFK) in Stage 18 for up to 45 seconds — player must NOT stay immortal!
  const startHp = world.player.hp;
  let minHpSeen = startHp;
  const emptyInput = createEmptyInput();
  for (let f = 0; f < 60 * 45; f++) {
    if (world.lootDrops.length > 0) world.lootDrops.length = 0;
    if (world.phase === 'loot') {
      world.pendingLoot = null;
      world.phase = 'playing';
    }
    if (world.phase === 'skill_tree') closeSkillTree(world);
    if (world.phase === 'merchant') closeMerchantShop(world);
    stepWorld(world, 1 / 60, emptyInput);
    if (world.player.hp < minHpSeen) minHpSeen = world.player.hp;
    if (world.phase === 'gameover') break;
  }

  assert.equal(
    world.phase,
    'gameover',
    `Max-upgraded AFK hero standing still in Stage 18 must die rather than be immortal (endPhase=${world.phase}, hp=${world.player.hp.toFixed(0)}/${world.player.maxHp}, minHp=${minHpSeen.toFixed(0)}, enemies=${world.enemies.length})`
  );
});

test('pooled VFX systems trigger on dash, hit, kill, damage, and boss spawn, decay cleanly, and never grow arrays', () => {
  const world = createInitialWorld(0, 404);
  const input = createEmptyInput();
  startNewRun(world, 404);

  const initParticles = world.particles.length;
  const initBursts = world.impactBursts.length;
  const initAfterimages = world.afterimages.length;
  const initDecals = world.groundDecals.length;

  // 1. Dash spawns afterimage + slash_arc burst + spark particles
  assert.equal(triggerDash(world, 1, 0), true);
  assert.ok(world.afterimages.some((g) => g.active), 'dash should activate an afterimage');
  assert.ok(world.impactBursts.some((b) => b.active && b.kind === 'slash_arc'), 'dash should activate a slash_arc burst');

  advanceFrames(world, input, 4);
  const activeGhosts = world.afterimages.filter((g) => g.active).length;
  assert.ok(activeGhosts >= 2, `continuous dash should leave multiple afterimages (got ${activeGhosts})`);

  // 2. Killing an enemy spawns impact burst + ground decal
  const target = spawnEnemyAt(world, 'skeleton', world.player.x + 120, world.player.y);
  damageEnemy(world, target, 9999, world.player.x, world.player.y, 120, true);
  assert.ok(
    world.impactBursts.some((b) => b.active && (b.kind === 'hit_spark' || b.kind === 'crit_star')),
    'enemy hit should activate hit_spark or crit_star burst'
  );
  assert.ok(world.groundDecals.some((d) => d.active), 'enemy death should leave a fading ground decal');

  // 3. Boss kill triggers level_pillar + screenFlash
  const boss = spawnEnemyAt(world, 'boss_behemoth', world.player.x + 150, world.player.y);
  damageEnemy(world, boss, 999999, world.player.x, world.player.y, 0, true);
  assert.ok(
    world.impactBursts.some((b) => b.active && b.kind === 'level_pillar'),
    'boss kill should trigger level_pillar effect'
  );
  assert.ok(world.screenFlashTimer > 0, 'boss kill should trigger subtle screen flash');

  // 4. Clear boss loot drop and dismiss level-up skill tree, then advance 6s
  world.lootDrops.length = 0;
  if (world.phase === 'skill_tree') closeSkillTree(world);
  for (let f = 0; f < 360; f++) {
    if (world.phase === 'skill_tree') closeSkillTree(world);
    if (world.phase === 'merchant') closeMerchantShop(world);
    stepWorld(world, 1 / 60, input);
  }
  assert.equal(world.particles.length, initParticles, 'particle pool size must remain fixed');
  assert.equal(world.impactBursts.length, initBursts, 'impactBurst pool size must remain fixed');
  assert.equal(world.afterimages.length, initAfterimages, 'afterimage pool size must remain fixed');
  assert.equal(world.groundDecals.length, initDecals, 'groundDecal pool size must remain fixed');
  assert.equal(world.afterimages.filter((g) => g.active).length, 0, 'afterimages should decay cleanly');
});

test('monster death spawns bouncing pixel shatter shards and boss waves trigger Boss Appearance Alert', () => {
  const world = createInitialWorld(0, 909);
  const input = createEmptyInput();
  startNewRun(world, 909);

  const initShardPoolSize = world.pixelShards.length;
  assert.equal(initShardPoolSize, 240, 'pixelShards pool should be fixed at 240');

  // 1. Killing a skeleton activates pixel shards that scatter and bounce on the floor
  const skel = spawnEnemyAt(world, 'skeleton', world.player.x + 110, world.player.y);
  damageEnemy(world, skel, 9999, world.player.x, world.player.y, 140, false);

  const activeAfterKill = world.pixelShards.filter((s) => s.active);
  assert.ok(activeAfterKill.length >= 10, `enemy death should activate pixel shards (got ${activeAfterKill.length})`);
  assert.ok(skel.deathTimer <= 0.11, 'dying enemy uses crisp short flash timer before shatter replaces sprite');

  // Advance 0.5s — shards should have fallen and bounced/settled
  advanceFrames(world, input, 30);
  const bouncedOrSettled = world.pixelShards.some((s) => s.active && (s.bounces > 0 || s.y >= s.groundY - 1));
  assert.ok(bouncedOrSettled, 'pixel shards should experience gravity and bounce/settle on groundY');

  // Advance another 1.5s — all shards decay cleanly without growing pool
  advanceFrames(world, input, 90);
  assert.equal(world.pixelShards.length, initShardPoolSize, 'pixelShards pool size must remain fixed');
  assert.equal(world.pixelShards.filter((s) => s.active).length, 0, 'pixel shards should decay cleanly');

  // 2. Reaching Stage 5 triggers Boss Appearance Alert in both WorldState and HudSnapshot
  world.elapsed = 4 * WAVE_DURATION_SEC - 0.05;
  advanceFrames(world, input, 6);
  assert.equal(world.wave, 5, 'should enter Stage 5');
  assert.ok(world.bossAlertTimer > 3.0, 'Stage 5 boss spawn should trigger bossAlertTimer');

  const snapActive = getHudSnapshot(world);
  assert.ok(snapActive.bossAlert !== null, 'HudSnapshot should expose bossAlert when boss spawns');
  assert.equal(snapActive.bossAlert?.stage, 5);
  assert.equal(snapActive.bossAlert?.name, '철갑 거수 베히모스');
  assert.ok((snapActive.bossAlert?.ratio ?? 0) > 0.8);

  // Advance 4.2s — Boss Appearance Alert expires cleanly to null
  advanceFrames(world, input, 252);
  assert.equal(world.bossAlertTimer, 0, 'bossAlertTimer should decay to 0');
  assert.equal(getHudSnapshot(world).bossAlert, null, 'bossAlert should clear from HudSnapshot after duration');
});

test('open-field minimap projects player position, unopened chests, and clamps distant boss direction accurately', () => {
  const world = createInitialWorld(0, 515);
  startNewRun(world, 515);
  world.player.x = 100;
  world.player.y = 200;
  world.chests = [
    { id: 1, x: 300, y: 200, tier: 'wooden', opened: false, openAnim: 0, bobPhase: 0 },
    { id: 2, x: 100, y: 200 - MINIMAP_RADAR_RANGE * 2, tier: 'golden', opened: false, openAnim: 0, bobPhase: 0 },
    { id: 3, x: 120, y: 210, tier: 'wooden', opened: true, openAnim: 1, bobPhase: 0 },
  ];

  // Spawn a distant boss straight to the south-east (+2000, +2000 from player)
  spawnEnemyAt(world, 'boss_behemoth', world.player.x + 2000, world.player.y + 2000);

  const radar = computeMinimapRadar(world);
  assert.equal(radar.playerX, 100);
  assert.equal(radar.playerY, 200);
  assert.equal(radar.chests.length, 2, 'opened chests must be omitted from minimap');

  const nearChest = radar.chests.find((c) => c.kind === 'chest_wooden')!;
  assert.equal(nearChest.clamped, false, 'near chest sits inside radar');
  assert.ok(nearChest.nx > 0 && Math.abs(nearChest.ny) < 0.01, 'east chest projects onto +X axis');

  const farChest = radar.chests.find((c) => c.kind === 'chest_golden')!;
  assert.equal(farChest.clamped, true, 'far golden chest clamps cleanly to radar perimeter');
  assert.ok(farChest.ny < -0.85 && Math.abs(farChest.nx) < 0.01, 'far north chest clamps to top edge');

  assert.ok(radar.boss !== null, 'active boss appears on minimap');
  assert.equal(radar.boss?.clamped, true, 'distant boss clamps to perimeter directional arrow');
  assert.ok(
    Math.abs((radar.boss?.angle ?? 0) - Math.PI / 4) < 0.01,
    `south-east boss bearing should be ~45deg (got ${radar.boss?.angle})`
  );

  const snap = getHudSnapshot(world);
  assert.equal(snap.playerCoordX, 10);
  assert.equal(snap.playerCoordY, 20);
  assert.equal(snap.unopenedChestCount, 2);
});

test('freeze, burn, and poison status effects apply DoT/slow/particles on both monsters and player and decay cleanly', () => {
  const world = createInitialWorld(0, 818);
  const input = createEmptyInput();
  startNewRun(world, 818);

  // 1. Enemy Burn + Poison DoT ticks deal damage & emit status particles
  const tank = spawnEnemyAt(world, 'charger', world.player.x + 260, world.player.y);
  tank.hp = 500;
  tank.maxHp = 500;
  applyEnemyStatus(tank, 'freeze', 2.0);
  applyEnemyStatus(tank, 'burn', 2.0);
  applyEnemyStatus(tank, 'poison', 2.0);

  assert.ok(tank.slowTimer > 1.9);
  assert.ok(tank.burnTimer > 1.9);
  assert.ok(tank.poisonTimer > 1.9);

  advanceFrames(world, input, 50); // ~0.83s -> at least 1 burn tick + 1 poison tick
  assert.ok(tank.hp < 500, `Burn/Poison DoT must damage enemy (hp=${tank.hp}/500)`);
  assert.ok(world.particles.some((pt) => pt.active), 'active status effects should emit pooled ambient particles');

  // 2. Player Freeze slows movement speed & exposes badges in HudSnapshot; Burn/Poison tick safely
  world.enemies.length = 0;
  world.projectiles.length = 0;
  world.hazards.length = 0;
  world.spawnTimer = 99;

  applyPlayerStatus(world, 'freeze', 1.5);
  applyPlayerStatus(world, 'burn', 1.5);
  applyPlayerStatus(world, 'poison', 1.5);

  const snapWithStatuses = getHudSnapshot(world);
  assert.deepEqual(snapWithStatuses.playerStatuses, ['freeze', 'burn', 'poison']);

  const hpBefore = world.player.hp;
  advanceFrames(world, input, 55); // ~0.92s -> burn & poison tick once
  assert.ok(world.player.hp < hpBefore && world.player.hp >= 1, 'player Burn/Poison ticks HP cleanly without unfair 1-shot');

  // 3. After another 2s with no incoming hits, all statuses decay cleanly to 0 and disappear from HudSnapshot
  advanceFrames(world, input, 130);
  assert.equal(world.player.slowTimer, 0);
  assert.equal(world.player.burnTimer, 0);
  assert.equal(world.player.poisonTimer, 0);
  assert.deepEqual(getHudSnapshot(world).playerStatuses, []);
});

test('Brawl Stars virtual joystick computes deadzone, analog throttle, dynamic follow, and moves/dashes hero smoothly', () => {
  // 1. Deadzone suppresses micro jitter
  const idle = computeJoystickVector(100, 100, 103, 102);
  assert.equal(idle.active, false);
  assert.equal(idle.x, 0);
  assert.equal(idle.y, 0);

  // 2. Half-tilt gives smooth partial analog magnitude
  const half = computeJoystickVector(100, 100, 100 + JOYSTICK_MAX_RADIUS * 0.55, 100);
  assert.equal(half.active, true);
  assert.ok(half.x > 0.35 && half.x < 0.65, `expected partial analog x, got ${half.x}`);
  assert.equal(Math.abs(half.y) < 0.001, true);

  // 3. Far drag clamps knob to rim and dynamically follows base origin
  const far = computeJoystickVector(100, 100, 260, 100);
  assert.equal(far.active, true);
  assert.ok(Math.abs(far.x - 1) < 0.001);
  assert.ok(Math.abs(far.knobX - JOYSTICK_MAX_RADIUS) < 0.01);
  assert.ok(far.nextOriginX > 100, 'origin should slide dynamically toward thumb when dragged past outer rim');

  // 4. Engine steps player cleanly along analog joystick vector and dashes along joystick aim
  const world = createInitialWorld(0, 909);
  const input = createEmptyInput();
  startNewRun(world, 909);
  world.enemies.length = 0;
  world.spawnTimer = 99;

  input.joyActive = true;
  input.joyX = 0.7071;
  input.joyY = 0.7071;
  advanceFrames(world, input, 30);
  assert.ok(world.player.x > 40 && world.player.y > 40, 'hero should move diagonally along joystick vector');
  assert.equal(world.player.facing, 1);

  input.dashJustPressed = true;
  advanceFrames(world, input, 2);
  assert.ok(world.player.dashActiveTimer > 0, 'dash should fire immediately while steering with joystick');
  assert.ok(world.player.dashDirX > 0.5 && world.player.dashDirY > 0.5, 'dash should follow joystick heading');
});

test('realistic combat audio emits distinct hit, crit_hit, kill, and boss_kill events', () => {
  const world = createInitialWorld(0, 991);
  const input = createEmptyInput();
  startNewRun(world, 991);
  world.enemies.length = 0;
  world.spawnTimer = 99;

  // Verify crit_hit + boss_kill when player lands guaranteed crits on a boss
  const boss = spawnEnemyAt(world, 'boss_behemoth', world.player.x + 110, world.player.y);
  boss.hp = 90;
  boss.maxHp = 90;
  world.player.critChance = 1;
  world.player.damageMult = 2.2;
  world.soundQueue.length = 0;

  const seen = new Set<string>();
  for (let i = 0; i < 180; i++) {
    stepWorld(world, 1 / 60, input);
    for (const s of world.soundQueue) seen.add(s);
    world.soundQueue.length = 0;
    if (seen.has('boss_kill')) break;
  }
  assert.ok(seen.has('crit_hit'), `expected crit_hit sound event, got ${[...seen].join(',')}`);
  assert.ok(seen.has('boss_kill'), `expected boss_kill sound event, got ${[...seen].join(',')}`);

  // Verify normal kill sound on regular monster (clear boss loot drop so loot modal does not pause)
  world.lootDrops.length = 0;
  world.pendingLoot = null;
  world.phase = 'playing';
  const skel = spawnEnemyAt(world, 'skeleton', world.player.x + 90, world.player.y);
  skel.hp = 10;
  skel.maxHp = 10;
  world.player.critChance = 0;
  const seenNormal = new Set<string>();
  for (let i = 0; i < 90; i++) {
    stepWorld(world, 1 / 60, input);
    for (const s of world.soundQueue) seenNormal.add(s);
    world.soundQueue.length = 0;
    if (seenNormal.has('kill')) break;
  }
  assert.ok(seenNormal.has('kill'), `expected kill sound event, got ${[...seenNormal].join(',')}`);
});

test('Auto-XP on kill grants XP directly without XP gem drops and triggers Skill Tree on level-up', () => {
  const world = createInitialWorld(0, 1001);
  startNewRun(world, 1001);
  world.enemies.length = 0;
  world.pickups.length = 0;
  world.spawnTimer = 99;

  const xpBefore = world.player.xp;
  const skel = spawnEnemyAt(world, 'skeleton', world.player.x + 150, world.player.y);
  damageEnemy(world, skel, 9999, world.player.x, world.player.y, 0, false);

  assert.ok(world.player.xp > xpBefore, 'killing an enemy immediately adds XP directly to player');
  assert.equal(
    world.pickups.some((pk) => pk.kind.startsWith('xp_')),
    false,
    'enemy kills must NOT spawn ground XP gems'
  );

  // Higher XP requirement curve: Lv.1 needs >= 85 XP (~2.8x slower than old 28 XP)
  assert.ok(xpForLevel(1) >= 85, `Lv.1 XP requirement should be raised for immersion (got ${xpForLevel(1)})`);
  assert.ok(xpForLevel(5) > xpForLevel(1) * 4, 'XP curve should scale steeply across levels');

  // Kill enough enemies to exceed xpToNext and trigger non-pausing level-up celebration + SP
  const levelBefore = world.player.level;
  const spBefore = world.player.skillPoints;
  for (let i = 0; i < 30 && world.player.level === levelBefore; i++) {
    const mob = spawnEnemyAt(world, 'skeleton', world.player.x + 150, world.player.y);
    damageEnemy(world, mob, 9999, world.player.x, world.player.y, 0, false);
  }
  assert.ok(world.player.level > levelBefore, 'accumulated Auto-XP levels the player up');
  assert.ok(world.player.skillPoints > spBefore, 'level-up grants +1 skill point');
  assert.equal(world.phase, 'playing', 'level-up does NOT pause combat with a forced modal');
  assert.ok(world.levelUpAnimTimer > 2.0, 'level-up activates spectacular center celebration timer');
  const snap = getHudSnapshot(world);
  assert.ok(snap.levelUpAnimRatio > 0.8, 'HudSnapshot exposes active level-up celebration ratio');
  assert.equal(snap.levelUpAnimLevel, world.player.level);
});

test('Level-scaled coin drops start at 1 coin (1G) for Lv.1 enemies and scale up with enemy level, elite, and boss', () => {
  const lv1 = computeEnemyCoinDrop(1, false, false);
  assert.equal(lv1.count, 1, 'Lv.1 normal enemy drops exactly 1 coin');
  assert.equal(lv1.valuePerCoin, 1, 'Lv.1 normal enemy coin is worth 1G');

  const lv5 = computeEnemyCoinDrop(5, false, false);
  const lv12 = computeEnemyCoinDrop(12, false, false);
  const eliteLv5 = computeEnemyCoinDrop(5, true, false);
  const bossLv10 = computeEnemyCoinDrop(10, false, true);

  assert.ok(lv5.count * lv5.valuePerCoin > lv1.count * lv1.valuePerCoin, 'Lv.5 enemy drops more gold than Lv.1');
  assert.ok(lv12.count * lv12.valuePerCoin > lv5.count * lv5.valuePerCoin, 'Lv.12 enemy drops more gold than Lv.5');
  assert.ok(eliteLv5.count * eliteLv5.valuePerCoin > lv5.count * lv5.valuePerCoin, 'Elite drops more gold than normal');
  assert.ok(bossLv10.count * bossLv10.valuePerCoin > eliteLv5.count * eliteLv5.valuePerCoin, 'Boss drops hefty gold');

  // Verify live kill spawns coin pickup and picking it up adds player.gold + emits 'coin' SFX
  const world = createInitialWorld(0, 1002);
  const input = createEmptyInput();
  startNewRun(world, 1002);
  world.enemies.length = 0;
  world.pickups.length = 0;
  world.spawnTimer = 99;
  world.wave = 1;

  const mob = spawnEnemyAt(world, 'skeleton', world.player.x + 8, world.player.y);
  assert.equal(mob.enemyLevel, 1);
  damageEnemy(world, mob, 9999, world.player.x, world.player.y, 0, false);

  const coins = world.pickups.filter((pk) => pk.kind === 'coin');
  assert.equal(coins.length, 1, 'Lv.1 normal kill spawns exactly 1 coin pickup');
  assert.equal(coins[0].value, 1, 'Lv.1 coin pickup value is 1G');

  world.soundQueue.length = 0;
  advanceFrames(world, input, 20);
  assert.equal(world.player.gold, 1, 'collecting Lv.1 coin increments player.gold by 1');
  assert.ok(world.soundQueue.includes('coin'), 'collecting coin emits coin SFX');
});

test('Wandering Equipment Merchant stays 30s, shows on minimap, upgrades all 5 gear slots with Gold, and Armor uses exact flat damage reduction', () => {
  const world = createInitialWorld(0, 1003);
  const input = createEmptyInput();
  startNewRun(world, 1003);
  world.enemies.length = 0;
  world.spawnTimer = 99;

  // 1. Spawn Merchant far to the east (+1800, 0)
  spawnMerchantNow(world, world.player.x + 1800, world.player.y);
  assert.equal(world.merchant.active, true);
  assert.equal(world.merchant.timer, MERCHANT_DURATION_SEC);
  assert.ok(world.merchantAlertTimer > 0, 'Merchant spawn triggers on-screen alert timer');
  assert.ok(world.soundQueue.includes('merchant'), 'Merchant spawn emits merchant chime SFX');

  const radar = computeMinimapRadar(world);
  assert.ok(radar.merchant !== null, 'Minimap displays active Merchant marker');
  assert.equal(radar.merchant?.clamped, true, 'Distant Merchant clamps to minimap directional arrow');
  assert.ok(Math.abs(radar.merchant?.angle ?? 99) < 0.05, 'East Merchant bearing points ~0 rad');
  const hud = getHudSnapshot(world);
  assert.equal(hud.merchantActive, true, 'HudSnapshot exposes active merchant flag');
  assert.equal(hud.merchantTimeLeft, MERCHANT_DURATION_SEC, 'HudSnapshot exposes merchant 30s countdown');
  assert.ok(hud.merchantAlertRatio > 0, 'HudSnapshot exposes merchant arrival alert banner');

  // 2. Open Merchant shop & upgrade all 5 slots (weapon, helm, armor, gloves, boots)
  assert.equal(openMerchantShop(world), true);
  assert.equal(world.phase, 'merchant');
  world.player.gold = 500;

  const baseStats = computeHeroStats(world.player);
  const baseHud = getHudSnapshot(world);
  const hpBeforeHelm = world.player.hp;

  for (const slot of ALL_MERCHANT_SLOTS) {
    const cost = getMerchantUpgradeCost(world.player.merchantGearLevels[slot])!;
    const goldBefore = world.player.gold;
    assert.equal(upgradeMerchantGear(world, slot), true, `upgrading ${slot} should succeed`);
    assert.equal(world.player.merchantGearLevels[slot], 1);
    assert.equal(world.player.gold, goldBefore - cost, `${slot} upgrade deducts exact Gold cost`);
  }

  const afterStats = computeHeroStats(world.player);
  const afterHud = getHudSnapshot(world);
  assert.equal(afterStats.atk, baseStats.atk + MERCHANT_GEAR_CATALOG.weapon.perLevelValue, '무기 raises ATK by +6');
  assert.equal(afterStats.maxHp, baseStats.maxHp + MERCHANT_GEAR_CATALOG.helm.perLevelValue, '투구 raises MaxHP by +22');
  assert.equal(world.player.hp, hpBeforeHelm + MERCHANT_GEAR_CATALOG.helm.perLevelValue, '투구 heals HP by delta');
  assert.equal(afterStats.def, baseStats.def + MERCHANT_GEAR_CATALOG.armor.perLevelValue, '갑옷 raises flat DEF by +3');
  assert.equal(
    afterHud.atkSpeedPct,
    baseHud.atkSpeedPct + MERCHANT_GEAR_CATALOG.gloves.perLevelValue,
    '장갑 raises atkSpeedPct by +6%'
  );
  assert.ok(afterStats.cooldownMult < baseStats.cooldownMult, '장갑 shortens spell cooldownMult');
  assert.equal(
    afterHud.moveSpeedPct,
    baseHud.moveSpeedPct + MERCHANT_GEAR_CATALOG.boots.perLevelValue,
    '장화 raises moveSpeedPct by +5%'
  );
  assert.ok(afterStats.moveSpeed > baseStats.moveSpeed, '장화 raises hero moveSpeed');

  // 3. Upgrade Armor 2 more times (Lv.3 -> +9 DEF total, base def=0) and verify exact flat subtraction
  upgradeMerchantGear(world, 'armor');
  upgradeMerchantGear(world, 'armor');
  closeMerchantShop(world);
  assert.equal(world.phase, 'playing');

  const defNow = computeHeroStats(world.player).def;
  assert.equal(defNow, 9, 'Lv.3 Merchant Armor with starter weapon yields exact DEF 9');
  const hpPreHit = world.player.hp;
  assert.equal(damagePlayer(world, 30, world.player.x + 20, world.player.y), true);
  assert.equal(hpPreHit - world.player.hp, 21, 'Monster 30 ATK minus 9 DEF deals exact 21 damage');

  // Verify minimum 1 damage when DEF >= monster ATK
  world.player.invulnTimer = 0;
  const hpPreTinyHit = world.player.hp;
  assert.equal(damagePlayer(world, 5, world.player.x + 20, world.player.y), true);
  assert.equal(hpPreTinyHit - world.player.hp, 1, 'Flat DEF never reduces damage below 1');

  // 4. Advance 30.2 seconds -> Merchant departs cleanly
  advanceFrames(world, input, Math.ceil((MERCHANT_DURATION_SEC + 0.3) * 60));
  assert.equal(world.merchant.active, false, 'Merchant departs cleanly after 30 seconds');
  assert.equal(computeMinimapRadar(world).merchant, null, 'Minimap clears Merchant marker after departure');
});

test('Merchant natural spawn distance is ~20 seconds of travel time (off-screen)', () => {
  const world = createInitialWorld(0, 1005);
  startNewRun(world, 1005);
  world.enemies.length = 0;
  world.spawnTimer = 99;

  const speed = world.player.moveSpeed;
  spawnMerchantNow(world);
  const dist = Math.hypot(world.merchant.x - world.player.x, world.merchant.y - world.player.y);
  const travelSec = dist / speed;

  assert.equal(MERCHANT_SPAWN_TRAVEL_SEC, 20);
  assert.ok(
    travelSec >= 18.8 && travelSec <= 21.2,
    `Merchant should spawn ~20s travel distance away (got ${travelSec.toFixed(2)}s, dist=${dist.toFixed(0)}px, speed=${speed})`
  );
  assert.ok(dist > 1500, 'Merchant must spawn well outside the visible screen');
  const radar = computeMinimapRadar(world);
  assert.equal(radar.merchant?.clamped, true, 'Off-screen 20s Merchant clamps to minimap edge directional arrow');
});

test('Single-element specialization locks other 3 elements, max branch level is 10, and affinity cycle works', () => {
  assert.equal(MAX_ELEMENT_BRANCH_LEVEL, 10);

  // 1. Verify full 4-element affinity cycle: Fire ▶ Ice ▶ Poison ▶ Lightning ▶ Fire
  assert.equal(getElementAffinity('fire', 'ice').mult, 1.5);
  assert.equal(getElementAffinity('ice', 'poison').mult, 1.5);
  assert.equal(getElementAffinity('poison', 'lightning').mult, 1.5);
  assert.equal(getElementAffinity('lightning', 'fire').mult, 1.5);
  assert.equal(getElementAffinity('fire', 'lightning').mult, 0.7);
  assert.equal(getElementAffinity('ice', 'fire').mult, 0.7);
  assert.equal(getElementAffinity('poison', 'ice').mult, 0.7);
  assert.equal(getElementAffinity('lightning', 'poison').mult, 0.7);

  // 2. Picking Fire locks out Ice, Lightning, and Poison permanently for the run
  const world = createInitialWorld(0, 1004);
  startNewRun(world, 1004);
  world.enemies.length = 0;
  world.spawnTimer = 99;
  world.player.skillPoints = 30;

  assert.equal(getChosenElement(world.player.elementTree), null);
  assert.equal(unlockOrUpgradeElement(world, 'fire'), true, 'unlock chosen element fire');
  assert.equal(getChosenElement(world.player.elementTree), 'fire');

  for (const other of ALL_ELEMENTS) {
    if (other === 'fire') continue;
    assert.equal(
      unlockOrUpgradeElement(world, other),
      false,
      `cannot unlock ${other} once fire has been chosen`
    );
    assert.equal(world.player.elementTree[other].unlocked, false);
  }

  // 3. Both Power and Area branches scale cleanly up to Lv.10 max and refuse Lv.11
  for (let lv = 1; lv <= 10; lv++) {
    assert.equal(unlockOrUpgradeElement(world, 'fire', 'power'), true, `fire power lv ${lv}`);
    assert.equal(unlockOrUpgradeElement(world, 'fire', 'area'), true, `fire area lv ${lv}`);
  }
  assert.equal(world.player.elementTree.fire.powerLv, 10);
  assert.equal(world.player.elementTree.fire.areaLv, 10);
  assert.equal(unlockOrUpgradeElement(world, 'fire', 'power'), false, 'cannot exceed power Lv.10');
  assert.equal(unlockOrUpgradeElement(world, 'fire', 'area'), false, 'cannot exceed area Lv.10');
  assert.equal(
    computeElementalSkillDamage(world.player, 'fire'),
    world.player.atk + getElementAttackPower(world.player.elementTree, 'fire'),
    'damage equals Weapon ATK + Element ATK'
  );

  // 4. Verify live affinity multipliers in damageEnemy
  const iceMob = spawnEnemyAt(world, 'skeleton', world.player.x + 200, world.player.y);
  iceMob.hp = 1000;
  iceMob.maxHp = 1000;
  damageEnemy(world, iceMob, 100, world.player.x, world.player.y, 0, false, false, 'fire');
  assert.equal(1000 - iceMob.hp, 150, 'Fire deals 1.5x to Ice enemy');

  const lightningMob = spawnEnemyAt(world, 'charger', world.player.x - 200, world.player.y);
  lightningMob.hp = 1000;
  lightningMob.maxHp = 1000;
  damageEnemy(world, lightningMob, 100, world.player.x, world.player.y, 0, false, false, 'fire');
  assert.equal(1000 - lightningMob.hp, 70, 'Fire deals 0.7x to Lightning enemy');
});

test('Elemental area mechanics: Fire radius blast, Ice pierce+slow+shatter, Lightning 1->11 chain, and Poison Well', () => {
  const input = createEmptyInput();

  // 1. FIRE: explosion damages ALL enemies in radius, and radius grows from Lv.0 to Lv.10
  {
    const w = createInitialWorld(0, 2001);
    startNewRun(w, 2001);
    w.enemies.length = 0;
    w.spawnTimer = 99;
    w.player.weapons = {}; // isolate Fire magic only
    w.player.basicAttackTimer = 999;
    w.player.skillPoints = 15;
    unlockOrUpgradeElement(w, 'fire');
    const r0 = getElementAreaValue(w.player.elementTree, 'fire');
    for (let i = 0; i < 6; i++) unlockOrUpgradeElement(w, 'fire', 'area');
    const r6 = getElementAreaValue(w.player.elementTree, 'fire');
    assert.ok(r6 > r0 + 90, `Fire blast radius should expand markedly (Lv.0=${r0}, Lv.6=${r6})`);

    const center = spawnEnemyAt(w, 'skeleton', w.player.x + 120, w.player.y);
    const bystander = spawnEnemyAt(w, 'skeleton', w.player.x + 120 + (r6 - 30), w.player.y);
    center.hp = 500;
    center.maxHp = 500;
    bystander.hp = 500;
    bystander.maxHp = 500;
    w.player.elementTimers.fire = 0;

    advanceFrames(w, input, 25);
    assert.ok(center.hp < 500, 'Fireball hits primary target');
    assert.ok(bystander.hp < 500, 'Fireball explosion damages bystander within expanded radius');
    assert.ok(bystander.burnTimer > 0, 'Fireball explosion applies Burn');
  }

  // 2. ICE: piercing count scales with areaLv, slows pierced enemies, and killing slowed enemy shatters ice onto neighbors
  {
    const w = createInitialWorld(0, 2002);
    startNewRun(w, 2002);
    w.enemies.length = 0;
    w.spawnTimer = 99;
    w.player.weapons = {};
    w.player.basicAttackTimer = 999;
    w.player.skillPoints = 15;
    unlockOrUpgradeElement(w, 'ice');
    assert.equal(getElementAreaValue(w.player.elementTree, 'ice'), 1, 'Ice Lv.0 pierces 1 enemy');
    for (let i = 0; i < 4; i++) unlockOrUpgradeElement(w, 'ice', 'area');
    assert.equal(getElementAreaValue(w.player.elementTree, 'ice'), 5, 'Ice Lv.4 pierces 5 enemies');

    // Line up 3 enemies in a row along +X
    const e1 = spawnEnemyAt(w, 'bat', w.player.x + 80, w.player.y);
    const e2 = spawnEnemyAt(w, 'bat', w.player.x + 145, w.player.y);
    const e3 = spawnEnemyAt(w, 'bat', w.player.x + 210, w.player.y);
    for (const e of [e1, e2, e3]) {
      e.hp = 500;
      e.maxHp = 500;
      e.speed = 0;
    }
    w.player.elementTimers.ice = 0;
    advanceFrames(w, input, 35);
    assert.ok(e1.hp < 500 && e2.hp < 500 && e3.hp < 500, 'Piercing Ice lance hits all 3 lined-up enemies');
    assert.ok(e1.slowTimer > 0 && e2.slowTimer > 0, 'Piercing Ice lance slows enemies');

    // Now kill slowed e1 -> Ice Shatter must deal bonus Ice damage to nearby neighbor!
    const neighbor = spawnEnemyAt(w, 'bat', e1.x, e1.y + 60);
    neighbor.hp = 500;
    neighbor.maxHp = 500;
    neighbor.speed = 0;
    damageEnemy(w, e1, 9999, w.player.x, w.player.y, 0, false, false, 'ice');
    assert.ok(neighbor.hp < 500, 'Killing a slowed enemy shatters ice and damages nearby enemy');
  }

  // 3. LIGHTNING: Lv.0 hits exactly 1 target; higher areaLv chains across multiple targets up to 11
  {
    const w = createInitialWorld(0, 2003);
    startNewRun(w, 2003);
    w.enemies.length = 0;
    w.spawnTimer = 99;
    w.player.weapons = {};
    w.player.basicAttackTimer = 999;
    w.player.skillPoints = 15;
    unlockOrUpgradeElement(w, 'lightning');
    assert.equal(getElementAreaValue(w.player.elementTree, 'lightning'), 1, 'Lightning Lv.0 hits 1 enemy');

    const mobs = [0, 1, 2, 3, 4].map((idx) => {
      const m = spawnEnemyAt(w, 'imp', w.player.x + 110 + idx * 50, w.player.y);
      m.hp = 800;
      m.maxHp = 800;
      m.speed = 0;
      return m;
    });
    w.player.elementTimers.lightning = 0;
    advanceFrames(w, input, 2);
    const damagedAtLv0 = mobs.filter((m) => m.hp < 800).length;
    assert.equal(damagedAtLv0, 1, `Lightning area Lv.0 should hit exactly 1 enemy (got ${damagedAtLv0})`);

    // Upgrade area branch to Lv.4 -> should chain across all 5 enemies!
    for (let i = 0; i < 4; i++) unlockOrUpgradeElement(w, 'lightning', 'area');
    assert.equal(getElementAreaValue(w.player.elementTree, 'lightning'), 5);
    for (const m of mobs) m.hp = 800;
    w.player.elementTimers.lightning = 0;
    advanceFrames(w, input, 2);
    const damagedAtLv4 = mobs.filter((m) => m.hp < 800).length;
    assert.equal(damagedAtLv4, 5, `Lightning area Lv.4 should chain to 5 enemies (got ${damagedAtLv4})`);
  }

  // 4. POISON: hitting an enemy creates a Poison Well whose radius scales with areaLv and damages enemies crossing it
  {
    const w = createInitialWorld(0, 2004);
    startNewRun(w, 2004);
    w.enemies.length = 0;
    w.spawnTimer = 99;
    w.player.weapons = {};
    w.player.basicAttackTimer = 999;
    w.player.skillPoints = 15;
    unlockOrUpgradeElement(w, 'poison');
    const r0 = getElementAreaValue(w.player.elementTree, 'poison');
    for (let i = 0; i < 5; i++) unlockOrUpgradeElement(w, 'poison', 'area');
    const r5 = getElementAreaValue(w.player.elementTree, 'poison');
    assert.ok(r5 > r0 + 70, `Poison Well radius grows with level (Lv.0=${r0}, Lv.5=${r5})`);

    const target = spawnEnemyAt(w, 'charger', w.player.x + 120, w.player.y);
    target.hp = 1000;
    target.maxHp = 1000;
    target.speed = 0;
    w.player.elementTimers.poison = 0;
    advanceFrames(w, input, 25);

    assert.ok(w.poisonWells.length >= 1, 'Poison orb hit spawns a Poison Well at impact location');
    const well = w.poisonWells[0];
    assert.equal(well.radius, r5, 'Poison Well uses areaLv-scaled radius');

    // Place a fresh enemy walking over the Poison Well -> takes Poison damage & Poison status!
    const walker = spawnEnemyAt(w, 'charger', well.x + well.radius * 0.5, well.y);
    walker.hp = 600;
    walker.maxHp = 600;
    walker.speed = 0;
    advanceFrames(w, input, 40);
    assert.ok(walker.hp < 600, 'Enemy standing/passing over Poison Well takes Poison damage');
    assert.ok(walker.poisonTimer > 0, 'Poison Well applies Poison status');
  }
});

test('3 playable classes (Wizard, Warrior, Archer) have distinct base stats and complete 5x3 (45 total) Diablo 2 skill catalog', () => {
  assert.deepEqual(ALL_HERO_CLASSES, ['wizard', 'warrior', 'archer']);
  assert.deepEqual(ALL_SKILL_ATTRIBUTES, ['fire', 'ice', 'lightning', 'poison', 'physical']);
  assert.deepEqual(ALL_SKILL_TIERS, [1, 2, 3]);

  let totalSkills = 0;
  for (const cls of ALL_HERO_CLASSES) {
    assert.ok(HERO_CLASS_CATALOG[cls].name.length > 0);
    for (const attr of ALL_SKILL_ATTRIBUTES) {
      for (const tier of ALL_SKILL_TIERS) {
        const sk = CLASS_SKILL_CATALOG[cls][attr][tier];
        assert.ok(sk.name.length > 0, `${cls}.${attr}.${tier} must have a name`);
        assert.ok(sk.mut5A.title.length > 0 && sk.mut5B.title.length > 0, `${cls}.${attr}.${tier} must define Lv.5 A/B mutations`);
        assert.ok(sk.mut10A.title.length > 0 && sk.mut10B.title.length > 0, `${cls}.${attr}.${tier} must define Lv.10 A/B mutations`);
        totalSkills += 1;
      }
    }
  }
  assert.equal(totalSkills, 45, '3 classes x 5 attributes x 3 tiers = 45 unique skills');

  const wWiz = createInitialWorld(0, 3001, 'wizard');
  const wWar = createInitialWorld(0, 3002, 'warrior');
  const wArc = createInitialWorld(0, 3003, 'archer');
  startNewRun(wWiz, 3001, 'wizard');
  startNewRun(wWar, 3002, 'warrior');
  startNewRun(wArc, 3003, 'archer');

  assert.equal(wWiz.player.heroClass, 'wizard');
  assert.equal(wWar.player.heroClass, 'warrior');
  assert.equal(wArc.player.heroClass, 'archer');
  assert.ok(wWar.player.maxHp > wWiz.player.maxHp, 'Warrior starts with higher MaxHP than Wizard');
  assert.ok(wWar.player.def > wWiz.player.def, 'Warrior starts with higher DEF than Wizard');
  assert.ok(wArc.player.moveSpeed > wWiz.player.moveSpeed, 'Archer starts with faster moveSpeed');
  assert.ok(wArc.player.critChance > wWiz.player.critChance, 'Archer starts with higher critChance');
});

test('Diablo 2 tier prerequisites (1T->2T->3T), Synergy Bonus scaling, Lv.5/10 Mutations, and Hybrid Fusion Passives', () => {
  const world = createInitialWorld(0, 3100, 'wizard');
  startNewRun(world, 3100, 'wizard');
  world.enemies.length = 0;
  world.spawnTimer = 99;
  world.player.skillPoints = 25;

  // 1. Cannot unlock 2T or 3T before prerequisite tier
  assert.equal(upgradeClassSkill(world, 'fire', 2), false, 'cannot unlock 2T before 1T Lv.1');
  assert.equal(upgradeClassSkill(world, 'fire', 3), false, 'cannot unlock 3T before 2T Lv.1');

  // 2. Invest 1T to Lv.5 -> unlocks 2T and Lv.5 mutation A/B
  for (let i = 0; i < 5; i++) {
    assert.equal(upgradeClassSkill(world, 'fire', 1), true);
  }
  assert.equal(world.player.classSkills.fire[1].level, 5);
  assert.equal(selectClassSkillMutation(world, 'fire', 1, 5, 'A'), true, 'can pick Lv.5 Mutation A at Lv.5');
  assert.equal(world.player.classSkills.fire[1].mut5, 'A');
  assert.equal(selectClassSkillMutation(world, 'fire', 1, 10, 'B'), false, 'cannot pick Lv.10 Mutation before Lv.10');

  // Invest 1T to Lv.10 -> unlocks Lv.10 mutation A/B, refuses Lv.11
  for (let i = 0; i < 5; i++) {
    assert.equal(upgradeClassSkill(world, 'fire', 1), true);
  }
  assert.equal(upgradeClassSkill(world, 'fire', 1), false, 'max skill level is 10');
  assert.equal(selectClassSkillMutation(world, 'fire', 1, 10, 'B'), true, 'can pick Lv.10 Mutation B at Lv.10');
  assert.equal(world.player.classSkills.fire[1].mut10, 'B');

  // 3. Unlock 2T & 3T and check Synergy Bonus scaling from lower tiers
  assert.equal(upgradeClassSkill(world, 'fire', 2), true, '2T unlocks once 1T >= 1');
  assert.equal(upgradeClassSkill(world, 'fire', 3), true, '3T unlocks once 2T >= 1');
  const syn2 = getSkillSynergyMultiplier(world.player.classSkills, 'fire', 2);
  const syn3 = getSkillSynergyMultiplier(world.player.classSkills, 'fire', 3);
  assert.ok(syn2.dmgMult > 2.0, `1T Lv.10 should heavily boost 2T synergy multiplier (got ${syn2.dmgMult})`);
  assert.ok(syn3.areaMult >= 2.0, `1T Lv.10 + 2T Lv.1 should double 3T area synergy (got ${syn3.areaMult})`);

  // 4. Hybrid Fusion Passive: Fire 2T+ & Ice 2T+ activates 'thermal_shock' (열충격)
  assert.equal(HYBRID_FUSION_CATALOG.length, 4);
  assert.deepEqual(getActiveHybridFusions(world.player.classSkills), []);
  assert.equal(upgradeClassSkill(world, 'ice', 1), true);
  assert.equal(upgradeClassSkill(world, 'ice', 2), true);
  assert.ok(
    getActiveHybridFusions(world.player.classSkills).includes('thermal_shock'),
    'Holding Fire 2T+ and Ice 2T+ activates Thermal Shock hybrid fusion'
  );

  // 5. Live Thermal Shock execution: Fire hit on Frozen enemy melts ice and deals 15% MaxHP true damage
  const target = spawnEnemyAt(world, 'charger', world.player.x + 140, world.player.y);
  target.hp = 1000;
  target.maxHp = 1000;
  applyEnemyStatus(target, 'freeze', 5);
  damageEnemy(world, target, 10, world.player.x, world.player.y, 0, false, true, 'fire');
  assert.equal(target.slowTimer, 0, 'Thermal Shock melts freeze status immediately');
  assert.ok(
    target.hp <= 850,
    `Thermal Shock must deal 15% MaxHP bonus true damage (hp=${target.hp}/1000)`
  );
});

test('Class combat gimmicks execute cleanly for Wizard, Warrior (Rage/Collision), and Archer (Combo/Crit Bleed)', () => {
  const input = createEmptyInput();

  // 1. Warrior: gains Rage on hit, and Physical 2T (충격파 반사) triggers knockback collision AoE + stun
  {
    const w = createInitialWorld(0, 3201, 'warrior');
    startNewRun(w, 3201, 'warrior');
    w.enemies.length = 0;
    w.spawnTimer = 99;
    w.player.skillPoints = 5;
    upgradeClassSkill(w, 'physical', 1);
    upgradeClassSkill(w, 'physical', 2);

    const e1 = spawnEnemyAt(w, 'skeleton', w.player.x + 70, w.player.y);
    const e2 = spawnEnemyAt(w, 'skeleton', w.player.x + 100, w.player.y);
    e1.hp = e1.maxHp = 500;
    e2.hp = e2.maxHp = 500;
    e1.speed = e2.speed = 0;

    damageEnemy(w, e1, 20, w.player.x, w.player.y, 260, false, true);
    advanceFrames(w, input, 8);
    assert.ok(w.player.rage > 0, 'Warrior builds Rage on combat hit');
    assert.ok(e2.hp < 500, 'Warrior knockback collision deals AoE damage to adjacent enemy');
    assert.ok(e2.stunTimer > 0, 'Warrior 충격파 반사 stuns collided enemy');
  }

  // 2. Archer: builds combo on hit, Physical 2T (약점 포착) raises crit & applies Bleed on crit
  {
    const w = createInitialWorld(0, 3202, 'archer');
    startNewRun(w, 3202, 'archer');
    w.enemies.length = 0;
    w.spawnTimer = 99;
    w.player.skillPoints = 5;
    const critBefore = w.player.critChance;
    upgradeClassSkill(w, 'physical', 1);
    upgradeClassSkill(w, 'physical', 2);
    assert.ok(w.player.critChance > critBefore, 'Archer 약점 포착 boosts critChance');

    const target = spawnEnemyAt(w, 'charger', w.player.x + 180, w.player.y);
    target.hp = target.maxHp = 500;
    target.speed = 0;
    w.player.critChance = 1;
    damageEnemy(w, target, 25, w.player.x, w.player.y, 0, false, true);
    assert.ok(w.player.comboCount >= 1, 'Archer builds combo count on hit');
    assert.ok(target.bleedTimer > 0, 'Archer 약점 포착 applies bleed on critical hit');
  }

  // 3. Wizard: Fire 3T (종말의 태양) spawns Solar Blackhole GroundZone that damages enemies
  {
    const w = createInitialWorld(0, 3203, 'wizard');
    startNewRun(w, 3203, 'wizard');
    w.enemies.length = 0;
    w.spawnTimer = 99;
    w.player.weapons = {};
    w.player.skillPoints = 5;
    upgradeClassSkill(w, 'fire', 1);
    upgradeClassSkill(w, 'fire', 2);
    upgradeClassSkill(w, 'fire', 3);

    const mob = spawnEnemyAt(w, 'charger', w.player.x + 90, w.player.y);
    mob.hp = mob.maxHp = 1000;
    mob.speed = 0;
    w.player.classSkillTimers['fire_3'] = 0;
    advanceFrames(w, input, 35);
    assert.ok(
      w.groundZones.some((z) => z.kind === 'solar_blackhole'),
      'Wizard 종말의 태양 summons a solar_blackhole ground zone'
    );
    assert.ok(mob.hp < 1000, 'Solar Blackhole damages enemies within its pull radius');
  }
});

test('Distinct class starter weapons (Wizard Magic Missile, Warrior Greatsword, Archer Arrow) have balanced ATK and Attack Speed', () => {
  const input = createEmptyInput();
  const wWiz = createInitialWorld(0, 4101, 'wizard');
  const wWar = createInitialWorld(0, 4102, 'warrior');
  const wArc = createInitialWorld(0, 4103, 'archer');
  startNewRun(wWiz, 4101, 'wizard');
  startNewRun(wWar, 4102, 'warrior');
  startNewRun(wArc, 4103, 'archer');

  // 1. Starter weapon identities
  assert.equal(wWiz.player.equipment.weapon?.name, '매직 미사일 지팡이');
  assert.equal(wWar.player.equipment.weapon?.name, '강철 대검');
  assert.equal(wArc.player.equipment.weapon?.name, '사냥꾼의 장궁');

  // 2. ATK ordering: Warrior > Wizard (baseline) > Archer
  assert.ok(
    wWar.player.atk > wWiz.player.atk,
    `Warrior ATK (${wWar.player.atk}) must be stronger than Wizard baseline (${wWiz.player.atk})`
  );
  assert.ok(
    wWiz.player.atk > wArc.player.atk,
    `Archer ATK (${wArc.player.atk}) must be weaker than Wizard baseline (${wWiz.player.atk})`
  );

  // 3. Attack speed / base cooldown ordering: Warrior slowest > Wizard baseline > Archer fastest
  assert.ok(
    HERO_BASIC_WEAPON_CONFIG.warrior.baseCooldown > HERO_BASIC_WEAPON_CONFIG.wizard.baseCooldown,
    'Warrior Greatsword must swing slower than Wizard Magic Missile'
  );
  assert.ok(
    HERO_BASIC_WEAPON_CONFIG.archer.baseCooldown < HERO_BASIC_WEAPON_CONFIG.wizard.baseCooldown,
    'Archer Arrow must fire faster than Wizard Magic Missile'
  );
  assert.ok(
    wArc.player.cooldownMult < wWiz.player.cooldownMult,
    'Archer starter bow atkSpeedPct also speeds up effective attack cadence'
  );

  // 4. Wizard fires 'magic_missile' projectile
  wWiz.enemies.length = 0;
  wWiz.spawnTimer = 99;
  const wizMob = spawnEnemyAt(wWiz, 'charger', wWiz.player.x + 220, wWiz.player.y);
  wizMob.hp = wizMob.maxHp = 500;
  wizMob.speed = 0;
  wWiz.player.basicAttackTimer = 0;
  advanceFrames(wWiz, input, 2);
  assert.ok(
    wWiz.projectiles.some((pr) => pr.kind === 'magic_missile'),
    'Wizard basic attack must fire a magic_missile projectile'
  );

  // 5. Warrior swings wide melee Greatsword cleave (slash_arc + multi-target hit + knockback, no basic projectiles)
  wWar.enemies.length = 0;
  wWar.spawnTimer = 99;
  const warMob1 = spawnEnemyAt(wWar, 'charger', wWar.player.x + 85, wWar.player.y - 18);
  const warMob2 = spawnEnemyAt(wWar, 'charger', wWar.player.x + 90, wWar.player.y + 22);
  warMob1.hp = warMob1.maxHp = 500;
  warMob2.hp = warMob2.maxHp = 500;
  warMob1.speed = warMob2.speed = 0;
  wWar.player.basicAttackTimer = 0;
  advanceFrames(wWar, input, 2);
  assert.equal(wWar.projectiles.length, 0, 'Warrior Greatsword cleave is pure melee, not a projectile');
  assert.ok(
    wWar.impactBursts.some((b) => b.active && b.kind === 'slash_arc'),
    'Warrior Greatsword cleave emits sweeping slash_arc VFX'
  );
  assert.ok(warMob1.hp < 500 && warMob2.hp < 500, 'Warrior Greatsword cleaves multiple enemies in frontal arc');
  assert.ok(warMob1.knockVx > 50, 'Warrior Greatsword cleave applies heavy knockback');

  // 6. Archer rapidly fires 'hunter_arrow' projectile
  wArc.enemies.length = 0;
  wArc.spawnTimer = 99;
  const arcMob = spawnEnemyAt(wArc, 'charger', wArc.player.x + 240, wArc.player.y);
  arcMob.hp = arcMob.maxHp = 500;
  arcMob.speed = 0;
  wArc.player.basicAttackTimer = 0;
  advanceFrames(wArc, input, 2);
  assert.ok(
    wArc.projectiles.some((pr) => pr.kind === 'hunter_arrow'),
    'Archer basic attack must fire a hunter_arrow projectile'
  );
});







