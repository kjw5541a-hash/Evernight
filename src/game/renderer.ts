import { BIOME_CATALOG, ELEMENT_CATALOG, GEAR_RARITY_META } from './catalog';
import { getSpriteAtlas, type SpriteFrameSet } from './sprites';
import type { BiomeId, Enemy, InputState, WorldState } from './types';

export const ARENA_FLOOR_TILE_URL = '/src/assets/images/arena_floor_tile_1795130865064.jpg';

export class ArenaRenderer {
  private floorImg: HTMLImageElement | null = null;
  private floorTileSize = 256;
  private biomePatterns: Array<CanvasPattern | null> = [null, null, null, null];
  private biomeGlows: Array<HTMLCanvasElement | null> = [null, null, null, null];
  private visibleEnemies: Enemy[] = [];

  constructor() {
    if (typeof document !== 'undefined') {
      const biomeIds: BiomeId[] = [0, 1, 2, 3];
      for (const bid of biomeIds) {
        const def = BIOME_CATALOG[bid];
        const glow = document.createElement('canvas');
        glow.width = 180;
        glow.height = 180;
        const gctx = glow.getContext('2d');
        if (gctx) {
          const grad = gctx.createRadialGradient(90, 90, 6, 90, 90, 90);
          grad.addColorStop(0, def.glowInner);
          grad.addColorStop(0.55, def.glowOuter);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          gctx.fillStyle = grad;
          gctx.fillRect(0, 0, 180, 180);
        }
        this.biomeGlows[bid] = glow;
      }
    }

    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        this.floorImg = img;
        this.biomePatterns = [null, null, null, null];
      };
      img.src = ARENA_FLOOR_TILE_URL;
    }
  }

  private getBiomePattern(ctx: CanvasRenderingContext2D, biomeId: BiomeId): CanvasPattern | null {
    if (this.biomePatterns[biomeId]) return this.biomePatterns[biomeId];
    if (!this.floorImg || !this.floorImg.complete || this.floorImg.naturalWidth <= 0) return null;

    const size = this.floorTileSize;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    if (!octx) return null;

    const def = BIOME_CATALOG[biomeId];
    octx.drawImage(this.floorImg, 0, 0, size, size);
    octx.fillStyle = def.tintOverlay;
    octx.fillRect(0, 0, size, size);

    // Subtle procedural biome ground motifs baked ONCE into the 256x256 tile
    if (biomeId === 1) {
      // Ash Lava Wasteland: glowing magma cracks
      octx.strokeStyle = 'rgba(251, 113, 45, 0.28)';
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(28, 42);
      octx.lineTo(74, 68);
      octx.lineTo(116, 54);
      octx.moveTo(164, 152);
      octx.lineTo(208, 196);
      octx.lineTo(234, 182);
      octx.stroke();
    } else if (biomeId === 2) {
      // Eternal Frost Citadel: crisp glacial frost veins
      octx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
      octx.lineWidth = 1.5;
      octx.beginPath();
      octx.moveTo(40, 190);
      octx.lineTo(96, 148);
      octx.lineTo(132, 166);
      octx.moveTo(180, 48);
      octx.lineTo(220, 88);
      octx.stroke();
    } else if (biomeId === 3) {
      // Void Abyss: subtle amethyst rune rings
      octx.strokeStyle = 'rgba(192, 132, 252, 0.22)';
      octx.lineWidth = 1.5;
      octx.beginPath();
      octx.arc(128, 128, 36, 0, Math.PI * 2);
      octx.stroke();
    }

    const pat = ctx.createPattern(off, 'repeat');
    this.biomePatterns[biomeId] = pat;
    return pat;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    world: WorldState,
    input: InputState,
    nowSec: number
  ): void {
    const atlas = getSpriteAtlas();
    const curBiomeDef = BIOME_CATALOG[world.biomeIndex];

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const shakeMag = world.cameraTrauma * world.cameraTrauma * 13;
    const shakeX = shakeMag > 0.1 ? Math.sin(nowSec * 57) * shakeMag : 0;
    const shakeY = shakeMag > 0.1 ? Math.cos(nowSec * 63) * shakeMag : 0;

    const camLeft = world.cameraX - width / 2 + shakeX;
    const camTop = world.cameraY - height / 2 + shakeY;
    const camRight = camLeft + width;
    const camBottom = camTop + height;

    ctx.translate(-camLeft, -camTop);

    const visLeft = Math.floor(camLeft) - 2;
    const visTop = Math.floor(camTop) - 2;
    const visW = Math.ceil(width) + 4;
    const visH = Math.ceil(height) + 4;

    // 1. Infinite Seamless Open-Field Floor with Smooth Biome Crossfade
    const curPat = this.getBiomePattern(ctx, world.biomeIndex);
    if (world.biomeBlend < 0.99 && world.prevBiomeIndex !== world.biomeIndex) {
      const prevPat = this.getBiomePattern(ctx, world.prevBiomeIndex);
      ctx.fillStyle = prevPat ?? BIOME_CATALOG[world.prevBiomeIndex].fallbackFloor;
      ctx.fillRect(visLeft, visTop, visW, visH);

      ctx.save();
      ctx.globalAlpha = world.biomeBlend;
      ctx.fillStyle = curPat ?? curBiomeDef.fallbackFloor;
      ctx.fillRect(visLeft, visTop, visW, visH);
      ctx.restore();
    } else {
      ctx.fillStyle = curPat ?? curBiomeDef.fallbackFloor;
      ctx.fillRect(visLeft, visTop, visW, visH);
    }

    // Subtle inscribed origin sanctum circle at (0,0) as starting landmark
    if (camLeft < 160 && camRight > -160 && camTop < 160 && camBottom > -160) {
      ctx.strokeStyle = 'rgba(245, 176, 65, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 140, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 126, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 1.5. Ground Decals (fading scorch, frost, arcane & battle marks — pooled, frustum culled)
    for (let i = 0; i < world.groundDecals.length; i++) {
      const d = world.groundDecals[i];
      if (!d.active) continue;
      if (d.x + d.radius < camLeft || d.x - d.radius > camRight || d.y + d.radius < camTop || d.y - d.radius > camBottom) {
        continue;
      }
      const alpha = Math.min(1, d.life / Math.min(1.1, d.maxLife));
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      if (d.kind === 'scorch') {
        ctx.globalAlpha = alpha * 0.34;
        ctx.fillStyle = '#090706';
        ctx.beginPath();
        ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.28;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, d.radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      } else if (d.kind === 'frost') {
        ctx.globalAlpha = alpha * 0.24;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.42;
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 3; k++) {
          const ang = (k * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(-Math.cos(ang) * d.radius * 0.85, -Math.sin(ang) * d.radius * 0.85);
          ctx.lineTo(Math.cos(ang) * d.radius * 0.85, Math.sin(ang) * d.radius * 0.85);
          ctx.stroke();
        }
      } else if (d.kind === 'arcane') {
        ctx.globalAlpha = alpha * 0.26;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, d.radius * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.14;
        ctx.fillStyle = d.color;
        ctx.fill();
      } else {
        ctx.globalAlpha = alpha * 0.24;
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(0, 0, d.radius, d.radius * 0.68, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Ambient biome-tinted torch light pools (pre-baked, frustum culled)
    const glowStamp = this.biomeGlows[world.biomeIndex] ?? this.biomeGlows[0];
    if (glowStamp) {
      for (let i = 0; i < world.torches.length; i++) {
        const t = world.torches[i];
        if (t.x < camLeft - 100 || t.x > camRight + 100 || t.y < camTop - 100 || t.y > camBottom + 100) {
          continue;
        }
        const flicker = 0.92 + Math.sin(nowSec * 8 + t.phase) * 0.08;
        const size = 165 * flicker;
        ctx.drawImage(glowStamp, t.x - size * 0.5, t.y - size * 0.5, size, size);
      }
    }

    // 3. Click waypoint / pointer steering indicator
    if (world.phase === 'playing' && (input.pointerActive || input.waypointActive)) {
      const tx = input.pointerActive ? input.pointerWorldX : input.waypointX;
      const ty = input.pointerActive ? input.pointerWorldY : input.waypointY;
      const pulse = 1 + Math.sin(nowSec * 9) * 0.14;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 13 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.75)';
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3.5 Player Poison Wells (bubbling emerald toxic pools)
    for (let i = 0; i < world.poisonWells.length; i++) {
      const well = world.poisonWells[i];
      if (
        well.x + well.radius < camLeft ||
        well.x - well.radius > camRight ||
        well.y + well.radius < camTop ||
        well.y - well.radius > camBottom
      ) {
        continue;
      }
      const fade = Math.min(1, well.life / 0.75);
      const pulse = 0.85 + Math.sin(nowSec * 5.2 + well.id) * 0.15;
      ctx.save();
      ctx.globalAlpha = fade * 0.32;
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = fade * 0.24;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(well.x, well.y, well.radius * (0.64 + pulse * 0.08), 0, Math.PI * 2);
      ctx.fill();

      // Swirling toxic rim
      ctx.globalAlpha = fade * 0.78;
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -nowSec * 22;
      ctx.beginPath();
      ctx.arc(well.x, well.y, well.radius - 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rising toxic bubbles inside the well
      for (let b = 0; b < 5; b++) {
        const phase = (nowSec * 0.9 + b * 0.27 + well.id * 0.19) % 1;
        const ang = b * 1.35 + well.id;
        const rr = well.radius * (0.22 + ((b * 0.17) % 0.58));
        const bx = well.x + Math.cos(ang) * rr;
        const by = well.y + Math.sin(ang) * rr - phase * 6;
        ctx.globalAlpha = fade * (1 - phase) * 0.75;
        ctx.strokeStyle = '#bbf7d0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bx, by, 2.2 + phase * 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3.6 Class Skill Ground Zones (Solar Blackhole, Fire Puddle, Lava Fissure, Blizzard, Thunder Storm, Death Fog, Plague Aura)
    for (let i = 0; i < world.groundZones.length; i++) {
      const z = world.groundZones[i];
      if (
        z.x + z.radius < camLeft ||
        z.x - z.radius > camRight ||
        z.y + z.radius < camTop ||
        z.y - z.radius > camBottom
      ) {
        continue;
      }
      const fade = Math.min(1, z.life / 0.7);
      const pulse = 0.9 + Math.sin(nowSec * 6 + z.id) * 0.1;
      ctx.save();
      if (z.kind === 'solar_blackhole') {
        ctx.globalAlpha = fade * 0.28;
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(z.x, z.y, 18 * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.kind === 'fire_puddle' || z.kind === 'lava_fissure') {
        ctx.globalAlpha = fade * 0.3;
        ctx.fillStyle = z.kind === 'lava_fissure' ? '#dc2626' : '#f97316';
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * 0.78;
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * 0.92, 0, Math.PI * 2);
        ctx.stroke();
      } else if (z.kind === 'blizzard') {
        ctx.globalAlpha = fade * 0.24;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * 0.8;
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -nowSec * 65;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (z.kind === 'thunder_storm') {
        ctx.globalAlpha = fade * 0.16;
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * 0.72;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = nowSec * 45;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // death_fog or plague_aura
        ctx.globalAlpha = fade * (z.kind === 'death_fog' ? 0.18 : 0.25);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * 0.65;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Boss floor hazards (Circle Craters/Rings and Glacial/Void Beams)
    for (let i = 0; i < world.hazards.length; i++) {
      const h = world.hazards[i];
      const progress = 1 - Math.max(0, h.timer) / h.duration;
      if (h.shape === 'beam') {
        const a = h.angle ?? 0;
        const len = h.length ?? 400;
        const ex = h.x + Math.cos(a) * len;
        const ey = h.y + Math.sin(a) * len;
        ctx.save();
        ctx.strokeStyle = h.color;
        ctx.globalAlpha = 0.16 + progress * 0.28;
        ctx.lineWidth = h.radius * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.globalAlpha = 0.7 + progress * 0.3;
        ctx.lineWidth = Math.max(2, h.radius * 2 * progress * 0.38);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
      } else {
        if (h.x + h.radius < camLeft || h.x - h.radius > camRight || h.y + h.radius < camTop || h.y - h.radius > camBottom) {
          continue;
        }
        ctx.save();
        ctx.fillStyle = h.color;
        ctx.globalAlpha = 0.12 + progress * 0.22;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = h.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(h.x, h.y, Math.max(2, h.radius * progress), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Enemy attack windup telegraphs
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (e.dying || e.aiState !== 'windup') continue;
      if (e.kind === 'charger' || (e.kind === 'boss_behemoth' && e.attackPattern === 0)) {
        const laneLen = e.kind === 'boss_behemoth' ? 290 : 235;
        const laneW = e.kind === 'boss_behemoth' ? 42 : 28;
        const endX = e.x + Math.cos(e.telegraphAngle) * laneLen;
        const endY = e.y + Math.sin(e.telegraphAngle) * laneLen;
        const pulse = 0.55 + Math.sin(nowSec * 36) * 0.25;
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse * 0.45})`;
        ctx.lineWidth = laneW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.strokeStyle = `rgba(254, 202, 202, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
      } else if (e.isBoss) {
        const haloColor =
          e.kind === 'boss_pyrolord'
            ? 'rgba(251, 146, 60, 0.85)'
            : e.kind === 'boss_frostqueen'
              ? 'rgba(56, 189, 248, 0.85)'
              : 'rgba(192, 132, 252, 0.85)';
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 12 + Math.sin(nowSec * 24) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 6. Multi-Ring Shockwaves (additive energy wave + crisp hot inner core)
    if (world.novaRings.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < world.novaRings.length; i++) {
        const r = world.novaRings[i];
        const alpha = Math.max(0, r.life / r.maxLife);
        // Translucent expanding glow fill
        ctx.globalAlpha = alpha * 0.14;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.fill();

        // Outer wide shockwave ring
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = alpha * 0.85;
        ctx.lineWidth = 5 + alpha * 5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Crisp white-hot leading edge ring
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.72;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(4, r.radius - 2), 0, Math.PI * 2);
        ctx.stroke();

        // Secondary trailing inner echo ring
        if (r.radius > 28) {
          ctx.strokeStyle = r.color;
          ctx.globalAlpha = alpha * 0.35;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.74, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 7. World Treasure Chests (frustum culled)
    for (let i = 0; i < world.chests.length; i++) {
      const ch = world.chests[i];
      if (ch.x < camLeft - 64 || ch.x > camRight + 64 || ch.y < camTop - 64 || ch.y > camBottom + 64) continue;
      const isGolden = ch.tier === 'golden';
      const sprite = ch.opened
        ? isGolden
          ? atlas.chestGoldenOpen
          : atlas.chestWoodenOpen
        : isGolden
          ? atlas.chestGoldenClosed
          : atlas.chestWoodenClosed;

      if (!ch.opened) {
        const pulse = 0.5 + Math.sin(nowSec * 5 + ch.bobPhase) * 0.25;
        ctx.strokeStyle = isGolden ? `rgba(253, 224, 71, ${pulse})` : `rgba(245, 158, 11, ${pulse * 0.7})`;
        ctx.lineWidth = isGolden ? 2.5 : 1.8;
        ctx.beginPath();
        ctx.arc(ch.x, ch.y + 4, isGolden ? 28 : 23, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.drawImage(atlas.shadowOval, ch.x - 19, ch.y + 8, 38, 14);
      ctx.drawImage(sprite, Math.round(ch.x - sprite.width * 0.5), Math.round(ch.y - sprite.height * 0.5));

      if (!ch.opened) {
        ctx.font = '700 11px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = isGolden ? '황금 보물상자' : '보물상자';
        ctx.fillStyle = 'rgba(8, 10, 14, 0.85)';
        ctx.fillText(label, ch.x + 1, ch.y - 24);
        ctx.fillStyle = isGolden ? '#fde047' : '#fbbf24';
        ctx.fillText(label, ch.x, ch.y - 25);
      }
    }

    // 7.5. Wandering Equipment Merchant NPC (30-second limited open-field forge merchant)
    if (world.merchant.active) {
      const m = world.merchant;
      if (m.x >= camLeft - 90 && m.x <= camRight + 90 && m.y >= camTop - 110 && m.y <= camBottom + 90) {
        const bob = Math.sin(m.bobPhase) * 2.2;
        const pulse = 0.55 + Math.sin(nowSec * 5.5) * 0.25;
        const timeRatio = Math.max(0, Math.min(1, m.timer / m.maxDuration));

        // Emerald-gold ground beacon aura
        ctx.save();
        ctx.fillStyle = `rgba(16, 185, 129, ${(0.12 + pulse * 0.08).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y + 6, 36, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(52, 211, 153, ${pulse.toFixed(2)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(m.x, m.y + 6, 34 + Math.sin(nowSec * 5.5) * 2.5, 0, Math.PI * 2);
        ctx.stroke();

        // Warm merchant lantern light pool
        const lanternGrad = ctx.createRadialGradient(m.x + 14, m.y - 4, 2, m.x + 14, m.y - 4, 48);
        lanternGrad.addColorStop(0, 'rgba(253, 224, 71, 0.36)');
        lanternGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = lanternGrad;
        ctx.beginPath();
        ctx.arc(m.x + 14, m.y - 4, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Shadow & miniature forge anvil beside the Merchant
        ctx.drawImage(atlas.shadowOval, m.x - 24, m.y + 10, 48, 16);

        // Anvil on left side of merchant
        const ax = Math.round(m.x - 20);
        const ay = Math.round(m.y + 4);
        ctx.fillStyle = '#090c12';
        ctx.fillRect(ax - 8, ay - 6, 16, 12);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(ax - 7, ay - 5, 14, 4);
        ctx.fillStyle = '#475569';
        ctx.fillRect(ax - 4, ay - 1, 8, 6);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(ax - 6, ay - 5, 10, 2);

        // Hooded Emerald-Gold Merchant Figure
        const mx = Math.round(m.x + 2);
        const my = Math.round(m.y + bob);
        // Dark outline
        ctx.fillStyle = '#090c12';
        ctx.fillRect(mx - 12, my - 19, 24, 33);
        // Golden merchant pack on back
        ctx.fillStyle = '#b45309';
        ctx.fillRect(mx - 11, my - 8, 6, 14);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(mx - 10, my - 6, 4, 4);
        // Emerald travel cloak
        ctx.fillStyle = '#047857';
        ctx.fillRect(mx - 7, my - 9, 16, 20);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(mx - 5, my - 8, 12, 17);
        // Gold trim sash
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(mx - 2, my - 8, 4, 17);
        // Merchant hood & glowing eyes
        ctx.fillStyle = '#065f46';
        ctx.fillRect(mx - 8, my - 18, 16, 10);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(mx - 5, my - 14, 10, 5);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(mx - 3, my - 12, 2, 2);
        ctx.fillRect(mx + 2, my - 12, 2, 2);
        // Hanging warm lantern on right
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(mx + 10, my - 10, 2, 16);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(mx + 11, my - 8, 6, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx + 13, my - 6, 2, 3);

        // Floating Nameplate + Live 30s Countdown Bar
        const label = `장비 상인 · ${Math.max(1, Math.ceil(m.timer))}초`;
        ctx.font = '800 11px "Noto Sans KR", sans-serif';
        const tw = ctx.measureText(label).width;
        const boxW = Math.max(96, tw + 16);
        const boxX = Math.round(m.x - boxW * 0.5);
        const boxY = Math.round(m.y - 44 + bob);
        ctx.fillStyle = 'rgba(7, 15, 16, 0.92)';
        ctx.fillRect(boxX, boxY, boxW, 22);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, 21);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText(label, m.x, boxY + 9);
        // Remaining stay progress bar
        ctx.fillStyle = '#132a25';
        ctx.fillRect(boxX + 4, boxY + 17, boxW - 8, 3);
        ctx.fillStyle = timeRatio < 0.25 ? '#fb923c' : '#facc15';
        ctx.fillRect(boxX + 4, boxY + 17, Math.round((boxW - 8) * timeRatio), 3);
      }
    }

    // 8. Torches (frustum culled, zero save/restore)
    const torchFrame = Math.floor(nowSec * 6) % 2;
    const torchSprite = atlas.torch[torchFrame];
    const twHalf = torchSprite.width * 0.5;
    const thHalf = torchSprite.height * 0.5;
    for (let i = 0; i < world.torches.length; i++) {
      const t = world.torches[i];
      if (t.x < camLeft - 48 || t.x > camRight + 48 || t.y < camTop - 48 || t.y > camBottom + 48) continue;
      ctx.drawImage(atlas.shadowOval, t.x - 11, t.y + 7, 22, 10);
      ctx.drawImage(torchSprite, Math.round(t.x - twHalf), Math.round(t.y - thHalf));
    }

    // 9. Pickups (frustum culled — Coins, Potions, Magnets, XP Gems)
    for (let i = 0; i < world.pickups.length; i++) {
      const pk = world.pickups[i];
      if (pk.x < camLeft - 24 || pk.x > camRight + 24 || pk.y < camTop - 24 || pk.y > camBottom + 24) continue;
      const bob = Math.sin(pk.bobPhase) * 2.5;
      if (pk.kind === 'coin') {
        const spinW = Math.max(2.2, Math.abs(Math.cos(pk.bobPhase * 1.45)) * 6.2);
        const coinH = pk.value >= 10 ? 7.5 : 6.2;
        const cy = pk.y + bob;
        ctx.drawImage(atlas.shadowOval, pk.x - 5.5, pk.y + 5, 11, 5);
        if (pk.value >= 8) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
          ctx.beginPath();
          ctx.arc(pk.x, cy, 9.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(pk.x, cy, spinW + 1.2, coinH + 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.ellipse(pk.x, cy, spinW, coinH, 0, 0, Math.PI * 2);
        ctx.fill();
        if (spinW > 3) {
          ctx.fillStyle = '#fef9c3';
          ctx.fillRect(Math.round(pk.x - spinW * 0.35), Math.round(cy - coinH * 0.45), Math.max(1.5, spinW * 0.45), coinH * 0.9);
        }
        continue;
      }

      const sprite =
        pk.kind === 'potion'
          ? atlas.potion
          : pk.kind === 'magnet'
            ? atlas.magnet
            : pk.kind === 'xp_large'
              ? atlas.gemLarge
              : pk.kind === 'xp_medium'
                ? atlas.gemMedium
                : atlas.gemSmall;
      ctx.drawImage(atlas.shadowOval, pk.x - 6, pk.y + 4, 12, 6);
      ctx.drawImage(sprite, Math.round(pk.x - sprite.width * 0.5), Math.round(pk.y - sprite.height * 0.5 + bob));
    }

    // 10. Diablo-Style Dropped Gear with Vertical Rarity Light Beams & Ground Labels
    for (let i = 0; i < world.lootDrops.length; i++) {
      const drop = world.lootDrops[i];
      if (drop.x < camLeft - 90 || drop.x > camRight + 90 || drop.y < camTop - 180 || drop.y > camBottom + 60) {
        continue;
      }
      const meta = GEAR_RARITY_META[drop.item.rarity];
      const bob = Math.sin(drop.bobPhase) * 3;
      const beamH = meta.beamHeight;
      const beamW = drop.item.rarity === 'legendary' ? 18 : drop.item.rarity === 'rare' ? 13 : 9;

      // Vertical Light Pillar
      ctx.save();
      const grad = ctx.createLinearGradient(drop.x, drop.y, drop.x, drop.y - beamH);
      grad.addColorStop(0, meta.color);
      grad.addColorStop(0.55, `${meta.color}55`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = drop.item.rarity === 'legendary' ? 0.62 : 0.44;
      ctx.fillRect(Math.round(drop.x - beamW * 0.5), Math.round(drop.y - beamH), beamW, beamH);

      // Crisp bright core line for Rare & Legendary drops
      if (drop.item.rarity === 'rare' || drop.item.rarity === 'legendary') {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.45 + Math.sin(nowSec * 9 + drop.bobPhase) * 0.2;
        ctx.fillRect(Math.round(drop.x - 1.5), Math.round(drop.y - beamH * 0.88), 3, Math.round(beamH * 0.88));
      }
      ctx.restore();

      // Ground rarity ring + shadow + gear pixel icon
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y + 4, 15, 0, Math.PI * 2);
      ctx.stroke();

      const gearSprite = atlas.gearIcons[drop.item.slot][drop.item.rarity];
      ctx.drawImage(atlas.shadowOval, drop.x - 11, drop.y + 4, 22, 9);
      ctx.drawImage(
        gearSprite,
        Math.round(drop.x - gearSprite.width * 0.5),
        Math.round(drop.y - gearSprite.height * 0.5 - 4 + bob)
      );

      // Ground item nameplate
      const label = `[${meta.label}] ${drop.item.name}`;
      ctx.font = '700 11px "Noto Sans KR", sans-serif';
      const tw = ctx.measureText(label).width;
      const boxW = tw + 12;
      const boxX = Math.round(drop.x - boxW * 0.5);
      const boxY = Math.round(drop.y - 34 + bob);
      ctx.fillStyle = 'rgba(9, 12, 18, 0.88)';
      ctx.fillRect(boxX, boxY, boxW, 18);
      ctx.strokeStyle = meta.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, 17);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = meta.color;
      ctx.fillText(label, drop.x, boxY + 9);
    }

    // 11. Orbiting Blades around player with luminous sweeping slash-arc trails
    const p = world.player;
    const bladeLv = p.weapons.orbit_blades ?? 0;
    if (bladeLv > 0) {
      const bladeCount = bladeLv >= 5 ? 5 : bladeLv >= 4 ? 4 : bladeLv >= 2 ? 3 : 2;
      const orbitR = 62 + bladeLv * 8;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, orbitR, 0, Math.PI * 2);
      ctx.stroke();

      for (let b = 0; b < bladeCount; b++) {
        const a = p.orbitAngle + (b / bladeCount) * Math.PI * 2;
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.42)';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(p.x, p.y, orbitR, a - 0.58, a);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, orbitR, a - 0.34, a);
        ctx.stroke();
      }
      ctx.restore();

      for (let b = 0; b < bladeCount; b++) {
        const a = p.orbitAngle + (b / bladeCount) * Math.PI * 2;
        const bx = p.x + Math.cos(a) * orbitR;
        const by = p.y + Math.sin(a) * orbitR;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-5, -13, 10, 26);
        ctx.fillStyle = '#93c5fd';
        ctx.fillRect(-3, -11, 6, 19);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-1, -10, 2, 16);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-5, 6, 10, 3);
        ctx.restore();
      }
    }

    // 11.2. Wizard Physical 1T: 염동력 구체 (Orbiting Telekinetic Orbs)
    if (p.heroClass === 'wizard' && p.classSkills.physical[1].level > 0) {
      const kLv = p.classSkills.physical[1].level;
      const orbCount = 2 + Math.floor(kLv / 3) + (p.classSkills.physical[1].mut5 === 'A' ? 2 : 0);
      const orbitR = 74 + kLv * 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < orbCount; k++) {
        const a = p.kineticOrbitAngle + (k / orbCount) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * orbitR;
        const oy = p.y + Math.sin(a) * orbitR;
        ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
        ctx.beginPath();
        ctx.arc(ox, oy, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox - 2, oy - 2, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 11.5. Dash Afterimage Silhouettes (pooled kinetic trail)
    for (let i = 0; i < world.afterimages.length; i++) {
      const g = world.afterimages[i];
      if (!g.active) continue;
      const ratio = Math.max(0, g.life / g.maxLife);
      const heroFrame = atlas.hero[0];
      const ghostSprite = g.facing < 0 ? heroFrame.flashLeft : heroFrame.flashRight;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ratio * 0.48;
      ctx.translate(g.x, g.y);
      ctx.scale(g.scale, g.scale);
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(0, 2, 14 * ratio + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = ratio * 0.55;
      ctx.drawImage(ghostSprite, Math.round(-ghostSprite.width * 0.5), Math.round(-ghostSprite.height * 0.5));
      ctx.restore();
    }

    // 12. Frustum-culled, Y-sorted Enemies + Player
    this.visibleEnemies.length = 0;
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      const pad = e.isBoss ? 84 : e.isElite ? 60 : 46;
      if (e.x < camLeft - pad || e.x > camRight + pad || e.y < camTop - pad || e.y > camBottom + pad) continue;
      this.visibleEnemies.push(e);
    }
    this.visibleEnemies.sort((a, b) => a.y - b.y);

    const drawStatusEffects = (
      x: number,
      y: number,
      bob: number,
      radius: number,
      sx: number,
      sy: number,
      frameSet: SpriteFrameSet,
      isLeft: boolean,
      slowTimer: number,
      burnTimer: number,
      poisonTimer: number,
      seed: number
    ) => {
      if (slowTimer <= 0 && burnTimer <= 0 && poisonTimer <= 0) return;

      // 1. Pixel-Perfect Pre-Baked Color Tint Overlay directly over the character/monster silhouette
      const activeTints: HTMLCanvasElement[] = [];
      if (slowTimer > 0) activeTints.push(isLeft ? frameSet.freezeLeft : frameSet.freezeRight);
      if (burnTimer > 0) activeTints.push(isLeft ? frameSet.burnLeft : frameSet.burnRight);
      if (poisonTimer > 0) activeTints.push(isLeft ? frameSet.poisonLeft : frameSet.poisonRight);

      // Cycle tint smoothly when multiple statuses overlap so each color reads clearly
      const tintIdx = activeTints.length > 1 ? Math.floor(nowSec * 3.5) % activeTints.length : 0;
      const tintSprite = activeTints[tintIdx];
      const tintPulse = 0.38 + 0.16 * Math.sin(nowSec * 10 + seed);

      ctx.save();
      ctx.globalAlpha = tintPulse;
      ctx.translate(x, y - bob);
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      ctx.drawImage(tintSprite, Math.round(-tintSprite.width * 0.5), Math.round(-tintSprite.height * 0.5));
      ctx.restore();

      // 2. Freeze (빙결): Frosted cyan base shell + crystalline shard spikes + 3 orbiting ice diamonds
      if (slowTimer > 0) {
        const chillR = radius + 4;
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y + radius * 0.35, chillR, chillR * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(x, y + radius * 0.35, chillR, chillR * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Twin angular ice crystal shards flanking base
        ctx.fillStyle = 'rgba(186, 230, 253, 0.72)';
        for (const side of [-1, 1]) {
          const ix = x + side * (radius * 0.72);
          const iy = y + radius * 0.25;
          ctx.beginPath();
          ctx.moveTo(ix, iy - 9);
          ctx.lineTo(ix + side * 4.5, iy + 2);
          ctx.lineTo(ix - side * 2, iy + 3);
          ctx.closePath();
          ctx.fill();
        }

        // 3 orbiting diamond ice crystals
        ctx.fillStyle = '#e0f2fe';
        for (let c = 0; c < 3; c++) {
          const ca = nowSec * 3.6 + seed + (c * Math.PI * 2) / 3;
          const cx = x + Math.cos(ca) * chillR;
          const cy = y - 2 + Math.sin(ca) * (chillR * 0.62);
          ctx.beginPath();
          ctx.moveTo(cx, cy - 3.8);
          ctx.lineTo(cx + 2.6, cy);
          ctx.lineTo(cx, cy + 3.8);
          ctx.lineTo(cx - 2.6, cy);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 3. Burn (화상): Additive flickering flame tongues + fiery orange rim halo
      if (burnTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fireR = radius + 4;
        ctx.fillStyle = 'rgba(234, 88, 12, 0.24)';
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.86)';
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.ellipse(x, y + radius * 0.38, fireR, fireR * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 3 animated dancing flame licks rising along entity body
        for (let f = 0; f < 3; f++) {
          const phase = nowSec * 12 + seed * 1.7 + f * 2.1;
          const fx = x + (f - 1) * (radius * 0.58) + Math.sin(phase) * 2.6;
          const fy = y - bob + radius * 0.14 - (f === 1 ? 7 : 1);
          const fh = 12.5 + Math.sin(phase * 1.3) * 3.8;
          const fw = 4.6;

          ctx.fillStyle = 'rgba(249, 115, 22, 0.92)';
          ctx.beginPath();
          ctx.moveTo(fx, fy - fh);
          ctx.lineTo(fx + fw, fy);
          ctx.lineTo(fx, fy + 2.8);
          ctx.lineTo(fx - fw, fy);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(254, 240, 138, 0.96)';
          ctx.beginPath();
          ctx.moveTo(fx, fy - fh * 0.62);
          ctx.lineTo(fx + fw * 0.48, fy - 0.5);
          ctx.lineTo(fx - fw * 0.48, fy - 0.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 4. Poison (중독): Toxic emerald puddle ring + rising venom bubbles
      if (poisonTimer > 0) {
        ctx.save();
        const toxR = radius + 3.5;
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.72)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y + radius * 0.4, toxR, toxR * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 4 rising translucent venom bubbles with specular highlight
        for (let b = 0; b < 4; b++) {
          const cycle = (nowSec * 1.35 + seed * 0.37 + b * 0.25) % 1;
          const bx = x + Math.sin(seed + b * 2.4 + cycle * 4) * (radius * 0.68);
          const by = y + radius * 0.25 - cycle * (radius * 1.85);
          const br = (2.2 + (b % 2) * 1.1) * (1 - cycle * 0.35);
          const alpha = cycle < 0.15 ? cycle / 0.15 : 1 - cycle;

          ctx.globalAlpha = alpha * 0.9;
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(bx, by, br + 0.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#dcfce7';
          ctx.fillRect(Math.round(bx - br * 0.45), Math.round(by - br * 0.45), 1.5, 1.5);
        }
        ctx.restore();
      }
    };

    const drawEnemy = (e: Enemy) => {
      // Once shattered into pixel shards, hide intact sprite cleanly after brief 60ms white flash
      if (e.dying && e.deathTimer <= 0.04) return;

      const frameSet = atlas[e.kind][Math.floor(e.strideDist / 16) % 2];
      const isLeft = e.facing < 0;
      const sprite =
        e.dying || e.hitFlashTimer > 0
          ? isLeft
            ? frameSet.flashLeft
            : frameSet.flashRight
          : isLeft
            ? frameSet.left
            : frameSet.right;
      const bob = Math.abs(Math.sin(e.strideDist * 0.14)) * (e.kind === 'bat' ? 5 : 2.5);

      const shW = e.radius * 1.75;
      const shH = e.radius * 0.78;
      ctx.drawImage(atlas.shadowOval, e.x - shW * 0.5, e.y + e.radius * 0.38, shW, shH);

      // Elite special monster aura ring
      if (e.isElite && !e.dying) {
        const ringColor = e.eliteColor ?? '#facc15';
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(e.x, e.y + 4, e.radius + 5 + Math.sin(nowSec * 9) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Enraged phase-2 aura for bosses below 50% HP
      if (e.isBoss && !e.dying && e.hp < e.maxHp * 0.5) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 6 + Math.sin(nowSec * 14) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      const drawScale = e.isElite ? 1.24 : 1;
      let finalScaleX = drawScale;
      let finalScaleY = drawScale;
      if (e.dying || e.aiState === 'windup' || drawScale !== 1) {
        ctx.save();
        ctx.translate(e.x, e.y - bob);
        if (e.dying) {
          const pop = 1.14 * drawScale;
          finalScaleX = pop;
          finalScaleY = pop;
          ctx.scale(pop, pop);
        } else if (e.aiState === 'windup') {
          const crouch = 1 + Math.sin(nowSec * 38) * 0.08;
          finalScaleX = crouch * drawScale;
          finalScaleY = (2 - crouch) * drawScale;
          ctx.scale(finalScaleX, finalScaleY);
        } else {
          ctx.scale(drawScale, drawScale);
        }
        ctx.drawImage(sprite, Math.round(-sprite.width * 0.5), Math.round(-sprite.height * 0.5));
        ctx.restore();
      } else {
        ctx.drawImage(sprite, Math.round(e.x - sprite.width * 0.5), Math.round(e.y - bob - sprite.height * 0.5));
      }

      if (!e.dying && e.hitFlashTimer <= 0) {
        drawStatusEffects(
          e.x,
          e.y,
          bob,
          e.radius,
          finalScaleX,
          finalScaleY,
          frameSet,
          isLeft,
          e.slowTimer,
          e.burnTimer,
          e.poisonTimer,
          e.id * 0.73
        );
      }

      if (!e.dying && !e.isBoss && (e.hp < e.maxHp || e.isElite)) {
        const bw = e.isElite ? 42 : Math.max(24, e.radius * 1.6);
        const bx = Math.round(e.x - bw * 0.5);
        const by = Math.round(e.y - e.radius - 13);
        ctx.fillStyle = 'rgba(9, 12, 16, 0.88)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        ctx.fillStyle = e.isElite ? e.eliteColor ?? '#facc15' : '#dc2626';
        ctx.fillRect(bx, by, Math.round(bw * Math.max(0, e.hp / e.maxHp)), 3);

        // Crisp elemental affinity diamond beside enemy HP bar
        const elColor = ELEMENT_CATALOG[e.element].color;
        const ex = bx - 6;
        const ey = by + 1.5;
        ctx.fillStyle = '#090c12';
        ctx.beginPath();
        ctx.arc(ex, ey, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = elColor;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.3, 0, Math.PI * 2);
        ctx.fill();

        if (e.isElite && e.eliteTitle) {
          ctx.font = '700 10px "Noto Sans KR", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(8, 10, 14, 0.9)';
          ctx.fillText(e.eliteTitle, e.x + 1, by - 8);
          ctx.fillStyle = e.eliteColor ?? '#fde047';
          ctx.fillText(e.eliteTitle, e.x, by - 9);
        }
      }
    };

    const drawPlayer = () => {
      // Subtle pre-baked hero lantern light pool so hero stays the clear focal anchor
      const heroGlow = this.biomeGlows[world.biomeIndex] ?? this.biomeGlows[0];
      if (heroGlow) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.drawImage(heroGlow, p.x - 95, p.y - 95, 190, 190);
        ctx.restore();
      }

      // Radiant Level-Up Celebration Pillar + Rotating Rune Circle around Hero (unobstructed!)
      if (world.levelUpAnimTimer > 0) {
        const lvRatio = Math.max(0, Math.min(1, world.levelUpAnimTimer / world.levelUpAnimMax));
        const progress = 1 - lvRatio;
        const classAccent =
          p.heroClass === 'wizard' ? '#38bdf8' : p.heroClass === 'warrior' ? '#fb923c' : '#4ade80';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Vertical ascending golden light column on the character
        const beamW = 34 + Math.sin(nowSec * 16) * 5 + progress * 14;
        const beamGrad = ctx.createLinearGradient(p.x, p.y - 190, p.x, p.y + 24);
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0)');
        beamGrad.addColorStop(0.55, 'rgba(251, 191, 36, 0.32)');
        beamGrad.addColorStop(1, 'rgba(254, 249, 195, 0.62)');
        ctx.globalAlpha = lvRatio * 0.92;
        ctx.fillStyle = beamGrad;
        ctx.fillRect(p.x - beamW * 0.5, p.y - 190, beamW, 214);

        // Inner crisp white core pillar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(p.x - beamW * 0.16, p.y - 140, beamW * 0.32, 162);

        // Expanding shockwave rings
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.2;
        ctx.globalAlpha = lvRatio * 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 6, 26 + progress * 48, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = classAccent;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = lvRatio * 0.78;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 6, 18 + progress * 30, 0, Math.PI * 2);
        ctx.stroke();

        // Rotating 6-point golden rune halo around feet
        const runeR = 32 + Math.sin(nowSec * 12) * 3;
        ctx.save();
        ctx.translate(p.x, p.y + 10);
        ctx.scale(1, 0.55);
        ctx.rotate(nowSec * 3.4);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.globalAlpha = lvRatio * 0.88;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const rx = Math.cos(a) * runeR;
          const ry = Math.sin(a) * runeR;
          if (k === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Rising golden sparkle motes around hero
        for (let m = 0; m < 8; m++) {
          const cycle = (nowSec * 1.9 + m * 0.125) % 1;
          const mx = p.x + Math.cos(m * 2.1 + nowSec * 2.6) * (20 + (m % 3) * 7);
          const my = p.y + 14 - cycle * 92;
          ctx.globalAlpha = lvRatio * (1 - cycle) * 0.95;
          ctx.fillStyle = m % 2 === 0 ? '#fef08a' : classAccent;
          ctx.fillRect(mx - 2, my - 2, 4, 4);
        }

        ctx.restore();
      }

      // Warrior Physical 3T: 전장의 폭군 (2x Giant Battle Aura)
      const tyrantBoost = p.heroClass === 'warrior' && p.tyrantTimer > 0 ? 1.55 : 1;
      if (tyrantBoost > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 4, 34 + Math.sin(nowSec * 12) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const heroFrames =
        p.heroClass === 'wizard'
          ? atlas.heroWizard
          : p.heroClass === 'warrior'
            ? atlas.heroWarrior
            : atlas.heroArcher;
      const frameSet = heroFrames[Math.floor(p.strideDist / 16) % 2];
      const isLeft = p.facing < 0;
      const sprite =
        p.hitFlashTimer > 0
          ? isLeft
            ? frameSet.flashLeft
            : frameSet.flashRight
          : isLeft
            ? frameSet.left
            : frameSet.right;
      const bob = Math.abs(Math.sin(p.strideDist * 0.16)) * 3;

      const dashRatio = p.dashMaxCooldown > 0 ? Math.max(0, Math.min(1, 1 - p.dashCooldown / p.dashMaxCooldown)) : 1;
      ctx.strokeStyle = dashRatio >= 0.99 ? 'rgba(251, 191, 36, 0.45)' : 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 12, 20 * tyrantBoost, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dashRatio);
      ctx.stroke();

      ctx.drawImage(atlas.shadowOval, p.x - 14 * tyrantBoost, p.y + 7, 28 * tyrantBoost, 12 * tyrantBoost);

      const finalSX = p.scaleX * tyrantBoost;
      const finalSY = p.scaleY * tyrantBoost;
      const blinking = p.invulnTimer > 0 && p.dashActiveTimer <= 0 && Math.floor(nowSec * 18) % 2 === 0;
      const squashed = Math.abs(finalSX - 1) > 0.02 || Math.abs(finalSY - 1) > 0.02;
      if (blinking || squashed) {
        ctx.save();
        if (blinking) ctx.globalAlpha = 0.65;
        ctx.translate(p.x, p.y - bob);
        ctx.scale(finalSX, finalSY);
        ctx.drawImage(sprite, Math.round(-sprite.width * 0.5), Math.round(-sprite.height * 0.5));
        ctx.restore();
      } else {
        ctx.drawImage(sprite, Math.round(p.x - sprite.width * 0.5), Math.round(p.y - bob - sprite.height * 0.5));
      }

      if (p.hitFlashTimer <= 0) {
        drawStatusEffects(
          p.x,
          p.y,
          bob,
          p.radius * tyrantBoost,
          finalSX,
          finalSY,
          frameSet,
          isLeft,
          p.slowTimer,
          p.burnTimer,
          p.poisonTimer,
          0.19
        );
      }
    };

    let playerDrawn = false;
    for (let i = 0; i < this.visibleEnemies.length; i++) {
      const e = this.visibleEnemies[i];
      if (!playerDrawn && e.y > p.y) {
        drawPlayer();
        playerDrawn = true;
      }
      drawEnemy(e);
    }
    if (!playerDrawn) drawPlayer();

    // 12.5. Pooled Monster-Death Pixel Shatter Shards (gravity + ground bounce, crisp 1px pixel rim)
    for (let i = 0; i < world.pixelShards.length; i++) {
      const s = world.pixelShards[i];
      if (!s.active) continue;
      if (s.x < camLeft - 18 || s.x > camRight + 18 || s.y < camTop - 18 || s.y > camBottom + 18) continue;
      const lifeRatio = Math.max(0, s.life / s.maxLife);
      const alpha = Math.min(1, lifeRatio / 0.38);
      const sz = s.size;
      const half = sz * 0.5;

      // Ground drop shadow while airborne for crisp 2.5D depth read
      if (s.y < s.groundY - 1) {
        ctx.globalAlpha = alpha * 0.36;
        ctx.fillStyle = '#06080c';
        ctx.fillRect(Math.round(s.x - half), Math.round(s.groundY), sz, Math.max(2, Math.round(sz * 0.45)));
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.fillStyle = '#090c12';
      ctx.fillRect(-half - 1, -half - 1, sz + 2, sz + 2);
      ctx.fillStyle = s.color;
      ctx.fillRect(-half, -half, sz, sz);
      if (sz >= 4) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.fillRect(-half, -half, 2, 2);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 13. Multi-Layer Plasma Chain Lightning & Detonated Beam Flashes
    if (world.lightningArcs.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < world.lightningArcs.length; i++) {
        const arc = world.lightningArcs[i];
        const alpha = Math.max(0, arc.life / arc.maxLife);
        const isBeam = arc.points.length === 2;

        // Build jagged polyline path once
        ctx.beginPath();
        for (let k = 0; k < arc.points.length; k++) {
          const pt = arc.points[k];
          if (k === 0) ctx.moveTo(pt.x, pt.y);
          else if (isBeam) {
            ctx.lineTo(pt.x, pt.y);
          } else {
            const prev = arc.points[k - 1];
            const midX = (prev.x + pt.x) * 0.5 + Math.sin(k * 17 + nowSec * 65) * 11;
            const midY = (prev.y + pt.y) * 0.5 + Math.cos(k * 13 + nowSec * 65) * 11;
            ctx.lineTo(midX, midY);
            ctx.lineTo(pt.x, pt.y);
          }
        }
        // Wide outer plasma glow
        ctx.strokeStyle = arc.color;
        ctx.globalAlpha = alpha * 0.34;
        ctx.lineWidth = isBeam ? 22 : 11;
        ctx.stroke();

        // Mid vivid electric stroke
        ctx.globalAlpha = alpha * 0.92;
        ctx.lineWidth = isBeam ? 11 : 4.2;
        ctx.stroke();

        // Crisp white inner lightning core
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.lineWidth = isBeam ? 4.2 : 1.8;
        ctx.stroke();

        // Crackling energy flash nodes at each chained target
        if (!isBeam) {
          for (let k = 1; k < arc.points.length; k++) {
            const pt = arc.points[k];
            ctx.fillStyle = arc.color;
            ctx.globalAlpha = alpha * 0.55;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 10 * alpha + 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = alpha * 0.9;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3.5 * alpha + 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    // 14. Projectiles with Glowing Comet Motion Trails (frustum culled, zero shadowBlur)
    for (let i = 0; i < world.projectiles.length; i++) {
      const pr = world.projectiles[i];
      if (pr.x < camLeft - 36 || pr.x > camRight + 36 || pr.y < camTop - 36 || pr.y > camBottom + 36) continue;
      const spd = Math.hypot(pr.vx, pr.vy) || 1;
      const nx = pr.vx / spd;
      const ny = pr.vy / spd;

      if (pr.kind === 'frost' || pr.kind === 'ice_shard') {
        const tailLen = pr.kind === 'frost' ? 36 : 24;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = pr.color;
        ctx.globalAlpha = 0.62;
        ctx.lineWidth = pr.kind === 'frost' ? 7 : 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * tailLen, pr.y - ny * tailLen);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * (tailLen * 0.55), pr.y - ny * (tailLen * 0.55));
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(Math.atan2(pr.vy, pr.vx));
        ctx.fillStyle = '#0e7490';
        ctx.fillRect(-12, -4, 22, 8);
        ctx.fillStyle = pr.color;
        ctx.fillRect(-10, -2.5, 20, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(3, -1.5, 7, 3);
        ctx.restore();
      } else if (pr.kind === 'chakram') {
        const spin = pr.spin ?? 0;
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(spin);
        // Spinning motion-blur crescent arcs
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.58)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius + 3, 0, Math.PI * 0.78);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius + 3, Math.PI, Math.PI * 1.78);
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius - 1, 0, Math.PI * 0.6);
        ctx.stroke();
        ctx.restore();
      } else if (pr.kind === 'fireball' || pr.kind === 'poison_orb') {
        const isFire = pr.kind === 'fireball';
        const tailLen = 34;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = isFire ? '#fb923c' : '#4ade80';
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * tailLen, pr.y - ny * tailLen);
        ctx.stroke();

        ctx.fillStyle = isFire ? '#ea580c' : '#16a34a';
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.radius + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isFire ? '#fde047' : '#86efac';
        ctx.globalAlpha = 0.96;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pr.x + nx * 2, pr.y + ny * 2, pr.radius * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (
        pr.kind === 'incendiary_arrow' ||
        pr.kind === 'frost_arrow' ||
        pr.kind === 'lightning_arrow' ||
        pr.kind === 'poison_dart' ||
        pr.kind === 'steel_arrow' ||
        pr.kind === 'sky_arrow' ||
        pr.kind === 'ice_petal'
      ) {
        const isSky = pr.kind === 'sky_arrow';
        const tailLen = isSky ? 68 : pr.kind === 'lightning_arrow' ? 52 : 30;
        const shaftW = isSky ? 12 : pr.kind === 'steel_arrow' ? 5 : 4;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = pr.color;
        ctx.globalAlpha = 0.78;
        ctx.lineWidth = isSky ? 16 : 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * tailLen, pr.y - ny * tailLen);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = Math.max(1.8, shaftW * 0.45);
        ctx.beginPath();
        ctx.moveTo(pr.x + nx * 6, pr.y + ny * 6);
        ctx.lineTo(pr.x - nx * (tailLen * 0.65), pr.y - ny * (tailLen * 0.65));
        ctx.stroke();
        ctx.restore();
      } else if (pr.kind === 'magic_missile') {
        const tailLen = 36;
        const ang = Math.atan2(pr.vy, pr.vx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#818cf8';
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * tailLen, pr.y - ny * tailLen);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * (tailLen * 0.65), pr.y - ny * (tailLen * 0.65));
        ctx.stroke();

        ctx.translate(pr.x, pr.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#c4b5fd';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, 5.5);
        ctx.lineTo(-7, 0);
        ctx.lineTo(0, -5.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(2, 0, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (pr.kind === 'hunter_arrow') {
        const ang = Math.atan2(pr.vy, pr.vx);
        ctx.save();
        // Crisp wind trail
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(134, 239, 172, 0.55)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * 28, pr.y - ny * 28);
        ctx.stroke();
        ctx.restore();

        // Crisp fletched arrow silhouette
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(ang);
        // Wooden shaft
        ctx.strokeStyle = '#d6a461';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        // Emerald fletching feathers
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-16, -4);
        ctx.lineTo(-8, -3);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-8, 3);
        ctx.lineTo(-16, 4);
        ctx.closePath();
        ctx.fill();
        // Bright steel arrowhead
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(5, -4);
        ctx.lineTo(7, 0);
        ctx.lineTo(5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        const tailLen = pr.kind === 'bolt' ? 30 : 22;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = pr.color;
        ctx.globalAlpha = pr.kind === 'bolt' ? 0.68 : 0.5;
        ctx.lineWidth = pr.kind === 'bolt' ? 6 : 6.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pr.x - nx * tailLen, pr.y - ny * tailLen);
        ctx.stroke();
        if (pr.kind === 'bolt') {
          ctx.strokeStyle = '#fffbeb';
          ctx.globalAlpha = 0.78;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pr.x, pr.y);
          ctx.lineTo(pr.x - nx * (tailLen * 0.5), pr.y - ny * (tailLen * 0.5));
          ctx.stroke();
        }
        ctx.restore();

        const sprite =
          pr.kind === 'bolt'
            ? atlas.projBolt
            : pr.kind === 'rock_shard'
              ? atlas.projRock
              : pr.kind === 'fire_orb'
                ? atlas.projFireOrb
                : pr.kind === 'boss_orb'
                  ? atlas.projBossOrb
                  : atlas.projImpOrb;
        ctx.drawImage(sprite, Math.round(pr.x - sprite.width * 0.5), Math.round(pr.y - sprite.height * 0.5));
      }
    }

    // 14.5. Pooled Additive Impact Bursts (hit sparks, crit starbursts, slash arcs, muzzle flashes, frost shatters, light pillars)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < world.impactBursts.length; i++) {
      const b = world.impactBursts[i];
      if (!b.active) continue;
      if (b.x < camLeft - 120 || b.x > camRight + 120 || b.y < camTop - 220 || b.y > camBottom + 120) continue;
      const ratio = Math.max(0, b.life / b.maxLife);
      const progress = 1 - ratio;

      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.kind === 'hit_spark') {
        ctx.rotate(b.angle);
        const r = b.size * (0.55 + progress * 0.85);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = ratio * 0.9;
        ctx.lineWidth = 2.4 * ratio + 0.8;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.moveTo(0, -r * 0.65);
        ctx.lineTo(0, r * 0.65);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = ratio;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1.5, 4 * ratio), 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === 'crit_star') {
        const r = b.size * (0.5 + progress * 0.95);
        // Expanding golden crit ring
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = ratio * 0.82;
        ctx.lineWidth = 2.5 * ratio + 1;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        ctx.stroke();

        // 8-point radiant starburst
        ctx.rotate(b.angle + progress * 0.4);
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = ratio;
        ctx.lineWidth = 2.2 * ratio + 0.8;
        for (let s = 0; s < 4; s++) {
          const sa = (s * Math.PI) / 4;
          const len = s % 2 === 0 ? r : r * 0.62;
          ctx.beginPath();
          ctx.moveTo(-Math.cos(sa) * len, -Math.sin(sa) * len);
          ctx.lineTo(Math.cos(sa) * len, Math.sin(sa) * len);
          ctx.stroke();
        }
      } else if (b.kind === 'slash_arc') {
        ctx.rotate(b.angle);
        const r = b.size * (0.7 + progress * 0.55);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = ratio * 0.88;
        ctx.lineWidth = 6 * ratio + 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, r, -0.95, 0.95);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = ratio * 0.95;
        ctx.lineWidth = 2 * ratio + 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, r + 1.5, -0.7, 0.7);
        ctx.stroke();
      } else if (b.kind === 'muzzle_flash') {
        ctx.rotate(b.angle);
        const r = b.size * (0.6 + progress * 0.6);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = ratio * 0.65;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = ratio * 0.95;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, 0);
        ctx.lineTo(r * 1.15, 0);
        ctx.moveTo(0, -r * 0.65);
        ctx.lineTo(0, r * 0.65);
        ctx.stroke();
      } else if (b.kind === 'frost_shatter') {
        const r = b.size * (0.45 + progress * 0.95);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = ratio * 0.9;
        ctx.lineWidth = 2.2 * ratio + 0.8;
        for (let k = 0; k < 6; k++) {
          const ka = b.angle + (k * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ka) * r * 0.25, Math.sin(ka) * r * 0.25);
          ctx.lineTo(Math.cos(ka) * r, Math.sin(ka) * r);
          ctx.stroke();
        }
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = ratio * 0.7;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      } else if (b.kind === 'level_pillar') {
        const colW = (32 + progress * 24) * b.size;
        const colH = 220 * b.size;
        ctx.fillStyle = b.color;
        ctx.globalAlpha = ratio * 0.42;
        ctx.fillRect(-colW * 0.5, -colH, colW, colH + 10);

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = ratio * 0.55;
        ctx.fillRect(-colW * 0.16, -colH * 0.92, colW * 0.32, colH * 0.92 + 8);

        // Expanding ground rune ring
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = ratio * 0.85;
        ctx.lineWidth = 3 * ratio + 1;
        ctx.beginPath();
        ctx.ellipse(0, 8, (22 + progress * 58) * b.size, (10 + progress * 26) * b.size, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (b.kind === 'pickup_flash') {
        const r = b.size * (0.4 + progress * 0.85);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = ratio * 0.78;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = ratio * 0.85;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, 0);
        ctx.lineTo(r * 0.7, 0);
        ctx.moveTo(0, -r * 0.7);
        ctx.lineTo(0, r * 0.7);
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();

    // 15. Pooled Multi-Shape Particles (square debris, directional sparks, glowing embers — frustum culled)
    for (let i = 0; i < world.particles.length; i++) {
      const pt = world.particles[i];
      if (!pt.active) continue;
      if (pt.x < camLeft - 18 || pt.x > camRight + 18 || pt.y < camTop - 18 || pt.y > camBottom + 18) continue;
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = alpha;
      if (pt.shape === 'spark') {
        const tailScale = 0.045;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(1.5, pt.size * 0.65);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * tailScale, pt.y - pt.vy * tailScale);
        ctx.stroke();
      } else if (pt.shape === 'ember') {
        const r = pt.size * (0.55 + alpha * 0.55);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - r);
        ctx.lineTo(pt.x + r * 0.75, pt.y);
        ctx.lineTo(pt.x, pt.y + r);
        ctx.lineTo(pt.x - r * 0.75, pt.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x - pt.size * 0.5), Math.round(pt.y - pt.size * 0.5), pt.size, pt.size);
      }
    }
    ctx.globalAlpha = 1;

    // 16. Pooled Floating Damage Numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < world.floatingTexts.length; i++) {
      const ft = world.floatingTexts[i];
      if (!ft.active) continue;
      if (ft.x < camLeft - 48 || ft.x > camRight + 48 || ft.y < camTop - 28 || ft.y > camBottom + 28) continue;
      const alpha = Math.max(0, Math.min(1, (ft.life / ft.maxLife) * 1.4));
      const fontSize = ft.scale > 1.15 ? 16 : ft.scale > 1.05 ? 14 : 12;
      ctx.font = `800 ${fontSize}px "JetBrains Mono", monospace`;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(8, 10, 14, 0.92)';
      ctx.fillText(ft.text, ft.x + 1.5, ft.y + 1.5);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // 16.5. Screen-Space Ambient Biome Atmospheric Motes (28 deterministic zero-allocation particles)
    this.drawBiomeAtmosphere(ctx, width, height, world.biomeIndex, nowSec, camLeft, camTop);

    // 16.8. Screen-Space Damage Vignette, Low-HP Heartbeat & Event Edge Shimmer
    this.drawScreenVignettes(ctx, width, height, world, nowSec);

    // 17. Screen-Space Offscreen Exploration Wayfinders (Nearest Chest, Elite, Boss)
    if (world.phase === 'playing') {
      this.drawOffscreenPointer(ctx, width, height, camLeft, camTop, world);
    }
  }

  private drawBiomeAtmosphere(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    biomeIndex: BiomeId,
    nowSec: number,
    camLeft: number,
    camTop: number
  ): void {
    const moteCount = 26;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < moteCount; i++) {
      const seed = i * 97.31 + 13.7;
      const speedX = biomeIndex === 2 ? -34 : biomeIndex === 1 ? 14 : Math.sin(seed) * 12;
      const speedY = biomeIndex === 2 ? 42 : biomeIndex === 1 ? -46 : biomeIndex === 3 ? -28 : -14;
      const parallax = 0.25 + (i % 3) * 0.14;
      const rawX = (seed * 41 + nowSec * speedX - camLeft * parallax) % width;
      const rawY = (seed * 67 + nowSec * speedY - camTop * parallax) % height;
      const sx = rawX < 0 ? rawX + width : rawX;
      const sy = rawY < 0 ? rawY + height : rawY;
      const pulse = 0.22 + (0.5 + 0.5 * Math.sin(nowSec * 3.1 + seed)) * 0.34;
      const sz = 1.6 + (i % 3) * 0.9;

      ctx.globalAlpha = pulse;
      if (biomeIndex === 1) {
        ctx.fillStyle = i % 2 === 0 ? '#fb923c' : '#fde047';
      } else if (biomeIndex === 2) {
        ctx.fillStyle = i % 2 === 0 ? '#e0f2fe' : '#7dd3fc';
      } else if (biomeIndex === 3) {
        ctx.fillStyle = i % 2 === 0 ? '#c084fc' : '#f0abfc';
      } else {
        ctx.fillStyle = i % 3 === 0 ? '#fbbf24' : '#94a3b8';
      }
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawScreenVignettes(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    world: WorldState,
    nowSec: number
  ): void {
    const p = world.player;
    const lowHpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const lowHpPulse =
      world.phase === 'playing' && lowHpRatio < 0.32
        ? ((0.32 - lowHpRatio) / 0.32) * (0.28 + 0.18 * Math.sin(nowSec * 7.5))
        : 0;
    const redIntensity = Math.min(0.65, world.damageVignette * 0.55 + lowHpPulse);

    if (redIntensity > 0.02) {
      ctx.save();
      const cx = width * 0.5;
      const cy = height * 0.5;
      const outerR = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, outerR * 0.42, cx, cy, outerR);
      grad.addColorStop(0, 'rgba(220, 38, 38, 0)');
      grad.addColorStop(1, `rgba(220, 38, 38, ${redIntensity.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (world.screenFlashTimer > 0 && world.screenFlashMax > 0) {
      const ratio = Math.max(0, world.screenFlashTimer / world.screenFlashMax);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cx = width * 0.5;
      const cy = height * 0.5;
      const outerR = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, outerR * 0.45, cx, cy, outerR);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, world.screenFlashColor);
      ctx.globalAlpha = ratio * 0.34;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (world.bossAlertTimer > 0 && world.bossAlertMax > 0) {
      const fadeIn = Math.min(1, (world.bossAlertMax - world.bossAlertTimer) / 0.25);
      const fadeOut = Math.min(1, world.bossAlertTimer / 0.65);
      const pulse = 0.68 + 0.32 * Math.sin(nowSec * 9.5);
      const edgeAlpha = fadeIn * fadeOut * pulse * 0.32;
      if (edgeAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = edgeAlpha;
        const barH = Math.min(96, height * 0.14);
        const topGrad = ctx.createLinearGradient(0, 0, 0, barH);
        topGrad.addColorStop(0, world.bossAlertAccent);
        topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, width, barH);

        const botGrad = ctx.createLinearGradient(0, height, 0, height - barH);
        botGrad.addColorStop(0, world.bossAlertAccent);
        botGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = botGrad;
        ctx.fillRect(0, height - barH, width, barH);
        ctx.restore();
      }
    }

    // Subtle peripheral status-effect screen rim when player is Frozen, Burning, or Poisoned
    const statusColor =
      p.slowTimer > 0 ? '#38bdf8' : p.burnTimer > 0 ? '#f97316' : p.poisonTimer > 0 ? '#22c55e' : null;
    if (statusColor && world.phase === 'playing') {
      ctx.save();
      const cx = width * 0.5;
      const cy = height * 0.5;
      const outerR = Math.hypot(cx, cy);
      const pulse = 0.22 + 0.08 * Math.sin(nowSec * 6.5);
      const grad = ctx.createRadialGradient(cx, cy, outerR * 0.62, cx, cy, outerR);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, statusColor);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  private drawOffscreenPointer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camLeft: number,
    camTop: number,
    world: WorldState
  ): void {
    const p = world.player;
    const marginX = 44;
    const marginY = 92;

    const drawMarker = (tx: number, ty: number, color: string, label: string) => {
      const sx = tx - camLeft;
      const sy = ty - camTop;
      if (sx >= 24 && sx <= width - 24 && sy >= 56 && sy <= height - 56) return; // already visible on screen

      const cx = width * 0.5;
      const cy = height * 0.5;
      const dx = sx - cx;
      const dy = sy - cy;
      const angle = Math.atan2(dy, dx);
      const maxX = width * 0.5 - marginX;
      const maxY = height * 0.5 - marginY;
      const scale = Math.min(
        Math.abs(dx) > 0.001 ? maxX / Math.abs(dx) : 999,
        Math.abs(dy) > 0.001 ? maxY / Math.abs(dy) : 999
      );
      const mx = cx + dx * scale;
      const my = cy + dy * scale;

      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#090c12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.font = '700 10px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(8, 10, 14, 0.9)';
      ctx.fillText(label, mx + 1, my + 16);
      ctx.fillStyle = color;
      ctx.fillText(label, mx, my + 15);
    };

    // Nearest unopened chest
    let nearestChest = null;
    let bestChestD2 = Infinity;
    for (let i = 0; i < world.chests.length; i++) {
      const ch = world.chests[i];
      if (ch.opened) continue;
      const d2 = (ch.x - p.x) ** 2 + (ch.y - p.y) ** 2;
      if (d2 < bestChestD2) {
        bestChestD2 = d2;
        nearestChest = ch;
      }
    }
    if (nearestChest) {
      drawMarker(
        nearestChest.x,
        nearestChest.y,
        nearestChest.tier === 'golden' ? '#fde047' : '#f59e0b',
        nearestChest.tier === 'golden' ? '황금상자' : '보물상자'
      );
    }

    // Active Wandering Equipment Merchant offscreen directional indicator (with ETA in seconds)
    if (world.merchant.active) {
      const mDist = Math.hypot(world.merchant.x - p.x, world.merchant.y - p.y);
      const etaSec = Math.max(1, Math.round(mDist / Math.max(160, p.moveSpeed || 202)));
      drawMarker(
        world.merchant.x,
        world.merchant.y,
        '#34d399',
        `장비 상인 ${Math.max(1, Math.ceil(world.merchant.timer))}초 (약 ${etaSec}초 거리)`
      );
    }

    // Active Boss or nearest Elite
    let targetBoss: Enemy | null = null;
    let nearestElite: Enemy | null = null;
    let bestEliteD2 = Infinity;
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (e.dying) continue;
      if (e.isBoss) {
        targetBoss = e;
        break;
      }
      if (e.isElite) {
        const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d2 < bestEliteD2) {
          bestEliteD2 = d2;
          nearestElite = e;
        }
      }
    }
    if (targetBoss) {
      drawMarker(targetBoss.x, targetBoss.y, '#ef4444', '보스');
    } else if (nearestElite) {
      drawMarker(nearestElite.x, nearestElite.y, nearestElite.eliteColor ?? '#c084fc', '특수몹');
    }
  }
}
