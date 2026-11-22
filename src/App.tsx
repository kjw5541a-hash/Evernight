import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { LootCompareModal } from './components/LootCompareModal';
import { MerchantModal } from './components/MerchantModal';
import { MobileController } from './components/MobileController';
import { SkillTreeModal } from './components/SkillTreeModal';
import { EndRunModal, PauseModal } from './components/StatusModals';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { WAVE_DURATION_SEC } from './game/catalog';
import {
  applyEnemyStatus,
  applyPlayerStatus,
  closeMerchantShop,
  closeSkillTree,
  createEmptyInput,
  createInitialWorld,
  dismissPendingLoot,
  equipPendingLoot,
  getHudSnapshot,
  getRunSummary,
  openMerchantShop,
  openSkillTree,
  salvagePendingLoot,
  selectClassSkillMutation,
  spawnEnemyAt,
  spawnMerchantNow,
  startNewRun,
  stepWorld,
  triggerDash,
  triggerLevelUpCelebration,
  tryInteractAtWorldPoint,
  upgradeClassSkill,
  upgradeMerchantGear,
} from './game/engine';
import { renderMinimap } from './game/minimap';
import { ArenaRenderer } from './game/renderer';
import type {
  GamePhase,
  HeroClassId,
  HudSnapshot,
  MerchantGearSlot,
  MutationChoice,
  RunSummary,
  SkillAttribute,
  SkillTier,
  WorldState,
} from './game/types';

const BEST_SCORE_KEY = 'evernight_survivor_best_score_v2';

function parseClassParam(): HeroClassId {
  if (typeof window === 'undefined') return 'wizard';
  const raw = new URLSearchParams(window.location.search).get('class');
  if (raw === 'warrior' || raw === 'archer' || raw === 'wizard') return raw;
  return 'wizard';
}

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(Math.floor(score)));
  } catch {
    // ignore storage failures in private iframes
  }
}

function syncBodyState(phase: GamePhase): void {
  const mapped =
    phase === 'title'
      ? 'title'
      : phase === 'paused'
        ? 'paused'
        : phase === 'gameover' || phase === 'victory'
          ? 'gameover'
          : 'playing';
  document.body.dataset.state = mapped;
  document.body.dataset.substate = phase;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<WorldState | null>(null);
  const inputRef = useRef(createEmptyInput());
  const rendererRef = useRef<ArenaRenderer | null>(null);
  const prevBestRef = useRef<number>(0);
  const pointerDownMetaRef = useRef<{ x: number; y: number; time: number; active: boolean }>({
    x: 0,
    y: 0,
    time: 0,
    active: false,
  });

  const [selectedClass, setSelectedClass] = useState<HeroClassId>(() => parseClassParam());
  const selectedClassRef = useRef<HeroClassId>(selectedClass);
  selectedClassRef.current = selectedClass;

  if (!worldRef.current) {
    const storedBest = typeof window !== 'undefined' ? loadBestScore() : 0;
    prevBestRef.current = storedBest;
    worldRef.current = createInitialWorld(storedBest, undefined, selectedClass);
  }

  const [hud, setHud] = useState<HudSnapshot>(() => getHudSnapshot(worldRef.current!));
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [showMobileControls, setShowMobileControls] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('touch') === '1') return true;
    const touchOnly = window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches ?? false;
    return touchOnly || window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const forceTouch = params.get('touch') === '1';
    const update = () => {
      const touchOnly = window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches ?? false;
      setShowMobileControls(forceTouch || touchOnly || window.innerWidth < 768);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const flushHud = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.hudDirty = false;
    syncBodyState(world.phase);
    setHud(getHudSnapshot(world));
  }, []);

  const clearInputs = useCallback(() => {
    inputRef.current.keys.clear();
    inputRef.current.pointerActive = false;
    inputRef.current.waypointActive = false;
    inputRef.current.joyActive = false;
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
    inputRef.current.dashJustPressed = false;
    pointerDownMetaRef.current.active = false;
  }, []);

  const handleQuickTapCanvas = useCallback((clientX: number, clientY: number) => {
    const world = worldRef.current;
    const canvas = canvasRef.current;
    if (!world || !canvas || world.phase !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const wx = world.cameraX + (clientX - rect.left - rect.width / 2);
    const wy = world.cameraY + (clientY - rect.top - rect.height / 2);
    tryInteractAtWorldPoint(world, wx, wy, inputRef.current);
  }, []);

  const handleSelectClass = useCallback((heroClass: HeroClassId) => {
    selectedClassRef.current = heroClass;
    setSelectedClass(heroClass);
  }, []);

  const handleStartGame = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    gameAudio.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    clearInputs();
    prevBestRef.current = world.bestScore;
    startNewRun(world, undefined, selectedClassRef.current);
    setSummary(null);
    flushHud();
    canvasRef.current?.focus();
  }, [clearInputs, flushHud]);

  const handleTogglePause = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    if (world.phase === 'playing') {
      clearInputs();
      world.phase = 'paused';
      flushHud();
    } else if (world.phase === 'paused') {
      clearInputs();
      world.phase = 'playing';
      flushHud();
      canvasRef.current?.focus();
    }
  }, [clearInputs, flushHud]);

  const handleReturnTitle = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    clearInputs();
    const fresh = createInitialWorld(world.bestScore, undefined, selectedClassRef.current);
    Object.assign(world, fresh);
    world.phase = 'title';
    setSummary(null);
    flushHud();
  }, [clearInputs, flushHud]);

  const handleEquipLoot = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.phase !== 'loot') return;
    gameAudio.unlock();
    if (equipPendingLoot(world)) {
      clearInputs();
      flushHud();
      canvasRef.current?.focus();
    }
  }, [clearInputs, flushHud]);

  const handleSalvageLoot = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.phase !== 'loot') return;
    gameAudio.unlock();
    if (salvagePendingLoot(world)) {
      clearInputs();
      flushHud();
      canvasRef.current?.focus();
    }
  }, [clearInputs, flushHud]);

  const handleDismissLoot = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.phase !== 'loot') return;
    dismissPendingLoot(world);
    clearInputs();
    flushHud();
    canvasRef.current?.focus();
  }, [clearInputs, flushHud]);

  const handleUpgradeMerchantGear = useCallback(
    (slot: MerchantGearSlot) => {
      const world = worldRef.current;
      if (!world) return;
      gameAudio.unlock();
      if (upgradeMerchantGear(world, slot)) {
        flushHud();
      }
    },
    [flushHud]
  );

  const handleCloseMerchant = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.phase !== 'merchant') return;
    closeMerchantShop(world);
    clearInputs();
    flushHud();
    canvasRef.current?.focus();
  }, [clearInputs, flushHud]);

  const handleOpenSkillTree = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    if (world.phase !== 'playing' && world.phase !== 'paused') return;
    clearInputs();
    if (openSkillTree(world)) {
      flushHud();
    }
  }, [clearInputs, flushHud]);

  const handleCloseSkillTree = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.phase !== 'skill_tree') return;
    closeSkillTree(world);
    clearInputs();
    flushHud();
    canvasRef.current?.focus();
  }, [clearInputs, flushHud]);

  const handleUpgradeClassSkill = useCallback(
    (attribute: SkillAttribute, tier: SkillTier) => {
      const world = worldRef.current;
      if (!world) return;
      gameAudio.unlock();
      if (upgradeClassSkill(world, attribute, tier)) {
        flushHud();
      }
    },
    [flushHud]
  );

  const handleSelectSkillMutation = useCallback(
    (attribute: SkillAttribute, tier: SkillTier, milestone: 5 | 10, choice: MutationChoice) => {
      const world = worldRef.current;
      if (!world) return;
      gameAudio.unlock();
      if (selectClassSkillMutation(world, attribute, tier, milestone, choice)) {
        flushHud();
      }
    },
    [flushHud]
  );

  const handleToggleMute = useCallback(() => {
    gameAudio.unlock();
    const next = gameAudio.toggleMute();
    setMuted(next);
  }, []);

  const handleTriggerDash = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.phase !== 'playing') return;
    gameAudio.unlock();
    triggerDash(world);
    world.hudDirty = true;
  }, []);

  const actionsRef = useRef({
    handleStartGame,
    handleTogglePause,
    handleOpenSkillTree,
    handleCloseSkillTree,
    handleCloseMerchant,
    handleEquipLoot,
    handleSalvageLoot,
    handleDismissLoot,
    handleToggleMute,
    clearInputs,
    flushHud,
  });
  actionsRef.current = {
    handleStartGame,
    handleTogglePause,
    handleOpenSkillTree,
    handleCloseSkillTree,
    handleCloseMerchant,
    handleEquipLoot,
    handleSalvageLoot,
    handleDismissLoot,
    handleToggleMute,
    clearInputs,
    flushHud,
  };

  // Mount Canvas, ResizeObserver, Input Listeners, ?autostart=1, and 60fps RAF loop ONCE
  useEffect(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;

    if (!rendererRef.current) {
      rendererRef.current = new ArenaRenderer();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      actionsRef.current.handleStartGame();
      if (import.meta.env.DEV) {
        const waveParam = Number(params.get('wave'));
        if (Number.isInteger(waveParam) && waveParam >= 2 && waveParam <= world.maxWaves) {
          world.elapsed = (waveParam - 1) * WAVE_DURATION_SEC - 0.08;
        }
        if (params.get('statusdemo') === '1') {
          const eFreeze = spawnEnemyAt(world, 'charger', -120, -25);
          const eBurn = spawnEnemyAt(world, 'skeleton', 120, -25);
          const ePoison = spawnEnemyAt(world, 'imp', 0, 115);
          eFreeze.hp = eFreeze.maxHp = 260;
          eBurn.hp = eBurn.maxHp = 260;
          ePoison.hp = ePoison.maxHp = 260;
          applyEnemyStatus(eFreeze, 'freeze', 12);
          applyEnemyStatus(eBurn, 'burn', 12);
          applyEnemyStatus(ePoison, 'poison', 12);
          applyPlayerStatus(world, 'freeze', 12);
          applyPlayerStatus(world, 'burn', 12);
          world.hudDirty = true;
        }
        if (params.get('levelupdemo') === '1') {
          world.player.level = 2;
          world.player.skillPoints = 2;
          triggerLevelUpCelebration(world);
          world.hudDirty = true;
        }
        const lootDemo = params.get('lootdemo');
        if (lootDemo === 'normal' || lootDemo === 'rare' || lootDemo === 'epic' || lootDemo === 'legendary') {
          if (world.player.equipment.weapon) {
            world.player.equipment.weapon = {
              ...world.player.equipment.weapon,
              rarity: lootDemo === 'legendary' ? 'epic' : lootDemo === 'epic' ? 'rare' : 'normal',
              name:
                lootDemo === 'legendary'
                  ? '심연의 수정 대지팡이'
                  : lootDemo === 'epic'
                    ? '서리불꽃 비전봉'
                    : '매직 미사일 지팡이',
              itemLevel: 8,
              upgradeLevel: 0,
              powerScore: 148,
              stats: { atk: 28, def: 4, maxHp: 30, critChance: 9, atkSpeedPct: 8, moveSpeedPct: 0 },
              attachedSkills: [],
            };
          }
          world.pendingLoot = {
            id: world.nextEntityId++,
            x: world.player.x,
            y: world.player.y,
            vx: 0,
            vy: 0,
            bobPhase: 0,
            pickupDelay: 0,
            item: {
              id: world.nextEntityId++,
              slot: 'weapon',
              rarity: lootDemo,
              name:
                lootDemo === 'legendary'
                  ? '태양군주의 불멸 지팡이'
                  : lootDemo === 'epic'
                    ? '자수정 심연의 천둥봉'
                    : lootDemo === 'rare'
                      ? '빙결 군단의 사파이어 창'
                      : '무쇠 수습봉',
              itemLevel: 12,
              upgradeLevel: 0,
              powerScore: lootDemo === 'legendary' ? 312 : lootDemo === 'epic' ? 228 : lootDemo === 'rare' ? 168 : 96,
              stats: {
                atk: lootDemo === 'legendary' ? 58 : lootDemo === 'epic' ? 42 : lootDemo === 'rare' ? 31 : 18,
                def: 6,
                maxHp: lootDemo === 'legendary' ? 65 : 35,
                critChance: lootDemo === 'legendary' ? 18 : lootDemo === 'epic' ? 12 : 7,
                atkSpeedPct: lootDemo === 'legendary' ? 16 : 10,
                moveSpeedPct: lootDemo === 'legendary' ? 6 : 0,
              },
              attachedSkills: [],
              legendaryEffect: lootDemo === 'legendary' ? 'crit_nova' : undefined,
            },
          };
          world.phase = 'loot';
          world.hudDirty = true;
        }
        const merchantDemo = params.get('merchantdemo');
        if (merchantDemo === '1' || merchantDemo === 'shop') {
          world.player.gold = 120;
          if (merchantDemo === 'shop') {
            spawnMerchantNow(world, world.player.x + 190, world.player.y - 35);
            openMerchantShop(world);
          } else {
            spawnMerchantNow(world);
          }
          world.hudDirty = true;
        }
        const skillTreeDemo = params.get('skilltreedemo');
        if (skillTreeDemo === '1' || skillTreeDemo === 'pick') {
          world.player.level = 8;
          world.player.skillPoints = 6;
          if (skillTreeDemo === '1') {
            world.player.classSkills.fire[1].level = 5;
            world.player.classSkills.fire[2].level = 2;
            world.player.classSkills.ice[1].level = 1;
            world.player.classSkills.ice[2].level = 1;
          }
          openSkillTree(world);
          world.hudDirty = true;
        }
      }
    } else {
      syncBodyState(world.phase);
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    let canvasCssW = window.innerWidth;
    let canvasCssH = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let dirtyRender = true;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvasCssW = Math.max(1, rect.width || window.innerWidth);
      canvasCssH = Math.max(1, rect.height || window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(canvasCssW * dpr);
      canvas.height = Math.round(canvasCssH * dpr);
      dirtyRender = true;
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    const screenToWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: world.cameraX + (sx - rect.width / 2),
        y: world.cameraY + (sy - rect.height / 2),
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (world.phase !== 'playing') return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      gameAudio.unlock();
      const pt = screenToWorld(e.clientX, e.clientY);
      const isTouch = e.pointerType === 'touch';
      if (!isTouch) {
        inputRef.current.pointerActive = true;
        inputRef.current.pointerWorldX = pt.x;
        inputRef.current.pointerWorldY = pt.y;
        inputRef.current.waypointActive = false;
      }
      pointerDownMetaRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
        active: true,
      };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore synthetic events
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (world.phase !== 'playing') return;
      if (!inputRef.current.pointerActive) return;
      const pt = screenToWorld(e.clientX, e.clientY);
      inputRef.current.pointerWorldX = pt.x;
      inputRef.current.pointerWorldY = pt.y;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDownMetaRef.current.active) return;
      const elapsedMs = performance.now() - pointerDownMetaRef.current.time;
      const moveDist = Math.hypot(
        e.clientX - pointerDownMetaRef.current.x,
        e.clientY - pointerDownMetaRef.current.y
      );
      pointerDownMetaRef.current.active = false;
      inputRef.current.pointerActive = false;

      if (world.phase === 'playing') {
        const pt = screenToWorld(e.clientX, e.clientY);
        if (elapsedMs < 240 && moveDist < 20) {
          if (tryInteractAtWorldPoint(world, pt.x, pt.y, inputRef.current)) {
            return;
          }
          if (e.pointerType !== 'touch') {
            const dx = pt.x - world.player.x;
            const dy = pt.y - world.player.y;
            triggerDash(world, dx, dy);
            inputRef.current.waypointActive = true;
            inputRef.current.waypointX = pt.x;
            inputRef.current.waypointY = pt.y;
          }
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const code = e.code;

      if (world.phase === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          actionsRef.current.handleStartGame();
          return;
        }
      }

      if (world.phase === 'loot') {
        if (code === 'Digit1' || code === 'KeyE') {
          e.preventDefault();
          actionsRef.current.handleEquipLoot();
          return;
        }
        if (code === 'Digit2' || code === 'KeyQ') {
          e.preventDefault();
          actionsRef.current.handleSalvageLoot();
          return;
        }
        if (code === 'Escape') {
          e.preventDefault();
          actionsRef.current.handleDismissLoot();
          return;
        }
        return;
      }

      if (world.phase === 'merchant') {
        if (code === 'Escape') {
          e.preventDefault();
          actionsRef.current.handleCloseMerchant();
          return;
        }
        return;
      }

      if (world.phase === 'skill_tree') {
        if (code === 'Escape' || code === 'KeyK') {
          e.preventDefault();
          actionsRef.current.handleCloseSkillTree();
          return;
        }
        return;
      }

      if (code === 'KeyM') {
        e.preventDefault();
        actionsRef.current.handleToggleMute();
        return;
      }

      if (code === 'KeyK') {
        if (world.phase === 'playing') {
          e.preventDefault();
          actionsRef.current.handleOpenSkillTree();
          return;
        }
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (world.phase === 'playing' || world.phase === 'paused') {
          e.preventDefault();
          actionsRef.current.handleTogglePause();
          return;
        }
      }

      if (code === 'KeyR') {
        if (
          world.phase === 'playing' ||
          world.phase === 'paused' ||
          world.phase === 'gameover' ||
          world.phase === 'victory'
        ) {
          e.preventDefault();
          actionsRef.current.handleStartGame();
          return;
        }
      }

      if (world.phase === 'playing') {
        if (code === 'Space') {
          e.preventDefault();
          inputRef.current.dashJustPressed = true;
          return;
        }
        if (
          code === 'KeyW' ||
          code === 'KeyA' ||
          code === 'KeyS' ||
          code === 'KeyD' ||
          code === 'ArrowUp' ||
          code === 'ArrowDown' ||
          code === 'ArrowLeft' ||
          code === 'ArrowRight'
        ) {
          e.preventDefault();
          inputRef.current.keys.add(code);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      inputRef.current.keys.delete(e.code);
    };

    const onBlurOrHide = () => {
      actionsRef.current.clearInputs();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlurOrHide);
    document.addEventListener('visibilitychange', onBlurOrHide);

    let rafId = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;
    let lastPhase: GamePhase = world.phase;

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      const phaseChangedBefore = world.phase !== lastPhase;
      if (world.phase === 'playing') {
        stepWorld(world, rawDt, inputRef.current);
      } else {
        inputRef.current.dashJustPressed = false;
      }

      if (world.soundQueue.length > 0) {
        for (const ev of world.soundQueue) {
          gameAudio.play(ev, world.gemCombo);
        }
        world.soundQueue.length = 0;
      }

      const phaseChangedAfter = world.phase !== lastPhase;
      if (world.phase === 'playing' || dirtyRender || phaseChangedBefore || phaseChangedAfter) {
        dirtyRender = false;
        if (ctx && rendererRef.current) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          rendererRef.current.render(ctx, canvasCssW, canvasCssH, world, inputRef.current, now / 1000);
        }
        const minimapCanvas = minimapCanvasRef.current;
        if (minimapCanvas && world.phase !== 'title') {
          const mctx = minimapCanvas.getContext('2d');
          if (mctx) {
            renderMinimap(mctx, minimapCanvas.width, world, now / 1000);
          }
        }
      }

      hudAccumulator += Math.min(rawDt, 0.05);
      const phaseChanged = world.phase !== lastPhase;
      if (phaseChanged || world.hudDirty || (world.phase === 'playing' && hudAccumulator >= 0.25)) {
        hudAccumulator = 0;
        world.hudDirty = false;
        if (phaseChanged) {
          lastPhase = world.phase;
          syncBodyState(world.phase);
          if (world.phase === 'gameover' || world.phase === 'victory') {
            if (world.bestScore > prevBestRef.current) {
              saveBestScore(world.bestScore);
            }
            setSummary(getRunSummary(world, prevBestRef.current));
          }
        }
        setHud(getHudSnapshot(world));
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlurOrHide);
      document.removeEventListener('visibilitychange', onBlurOrHide);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0d13] touch-none select-none">
      {/* Isolated Full-Viewport Canvas2D Infinite Open Field */}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        data-testid="game-canvas"
        aria-label="에버나이트 서바이버 무한 전장 캔버스"
        className="block w-full h-full outline-none cursor-crosshair touch-none"
      />

      {/* Title Screen with 3-Class Selection */}
      {hud.phase === 'title' && (
        <TitleScreen
          selectedClass={selectedClass}
          bestScore={hud.bestScore}
          muted={muted}
          onSelectClass={handleSelectClass}
          onStart={handleStartGame}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active HUD */}
      {hud.phase !== 'title' && (
        <GameHud
          hud={hud}
          muted={muted}
          minimapCanvasRef={minimapCanvasRef}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onRestart={handleStartGame}
          onTriggerDash={handleTriggerDash}
          onOpenSkillTree={handleOpenSkillTree}
        />
      )}

      {/* Brawl Stars-Style Dual-Thumb Mobile Virtual Controller */}
      <MobileController
        inputRef={inputRef}
        dashRatio={hud.dashRatio}
        dashCooldownSec={hud.dashCooldownSec}
        visible={showMobileControls && hud.phase === 'playing'}
        onTriggerDash={handleTriggerDash}
        onQuickTapCanvas={handleQuickTapCanvas}
      />

      {/* Diablo-Style One-Click Equipment Comparison Modal */}
      {hud.phase === 'loot' && hud.pendingLoot && (
        <LootCompareModal
          dropped={hud.pendingLoot.item}
          equipped={hud.equipment}
          onEquip={handleEquipLoot}
          onSalvage={handleSalvageLoot}
          onDismiss={handleDismissLoot}
        />
      )}

      {/* Wandering Equipment Merchant 5-Slot Gold Upgrade Modal */}
      {hud.phase === 'merchant' && (
        <MerchantModal
          gold={hud.gold}
          merchantTimeLeft={hud.merchantTimeLeft}
          merchantGearLevels={hud.merchantGearLevels}
          atk={hud.atk}
          maxHp={hud.maxHp}
          def={hud.def}
          atkSpeedPct={hud.atkSpeedPct}
          moveSpeedPct={hud.moveSpeedPct}
          onUpgrade={handleUpgradeMerchantGear}
          onClose={handleCloseMerchant}
        />
      )}

      {/* Diablo 2-Style 3-Class × 5-Attribute × 3-Tier Visual Skill Tree & Popup Modal */}
      {hud.phase === 'skill_tree' && (
        <SkillTreeModal
          heroClass={hud.heroClass}
          level={hud.level}
          skillPoints={hud.skillPoints}
          weaponAtk={hud.atk}
          classSkills={hud.classSkills}
          activeFusions={hud.activeFusions}
          onUpgradeSkill={handleUpgradeClassSkill}
          onSelectMutation={handleSelectSkillMutation}
          onClose={handleCloseSkillTree}
        />
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <PauseModal
          onResume={handleTogglePause}
          onRestart={handleStartGame}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Victory / Game Over Modal */}
      {(hud.phase === 'gameover' || hud.phase === 'victory') && summary && (
        <EndRunModal
          summary={summary}
          onRestart={handleStartGame}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </div>
  );
}
