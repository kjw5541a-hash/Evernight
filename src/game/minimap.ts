import { BIOME_CATALOG, BOSS_META, GEAR_RARITY_META } from './catalog';
import { CHUNK_SIZE, isBossKind } from './engine';
import type { WorldState } from './types';

export const MINIMAP_RADAR_RANGE = 1150;

export interface MinimapMarker {
  nx: number;
  ny: number;
  angle: number;
  distance: number;
  clamped: boolean;
  color: string;
  kind: 'chest_wooden' | 'chest_golden' | 'elite' | 'loot';
}

export interface MinimapBossMarker {
  nx: number;
  ny: number;
  angle: number;
  distance: number;
  clamped: boolean;
  accent: string;
  name: string;
}

export interface MinimapMerchantMarker {
  nx: number;
  ny: number;
  angle: number;
  distance: number;
  clamped: boolean;
  timeLeft: number;
}

export interface MinimapRadarData {
  radarRange: number;
  playerX: number;
  playerY: number;
  playerAngle: number;
  biomeAccent: string;
  origin: { nx: number; ny: number; visible: boolean };
  chests: MinimapMarker[];
  elites: MinimapMarker[];
  lootDrops: MinimapMarker[];
  merchant: MinimapMerchantMarker | null;
  boss: MinimapBossMarker | null;
}

function projectToRadar(
  dx: number,
  dy: number,
  radarRange: number,
  clampRadius: number
): { nx: number; ny: number; angle: number; distance: number; clamped: boolean } {
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  if (distance <= radarRange) {
    return {
      nx: (dx / radarRange) * clampRadius,
      ny: (dy / radarRange) * clampRadius,
      angle,
      distance: Math.round(distance),
      clamped: false,
    };
  }
  return {
    nx: Math.cos(angle) * clampRadius,
    ny: Math.sin(angle) * clampRadius,
    angle,
    distance: Math.round(distance),
    clamped: true,
  };
}

export function computeMinimapRadar(
  world: WorldState,
  radarRange = MINIMAP_RADAR_RANGE
): MinimapRadarData {
  const p = world.player;
  const biomeAccent = BIOME_CATALOG[world.biomeIndex].accent;

  const originDx = -p.x;
  const originDy = -p.y;
  const originDist = Math.hypot(originDx, originDy);
  const origin = {
    nx: (originDx / radarRange) * 0.9,
    ny: (originDy / radarRange) * 0.9,
    visible: originDist <= radarRange * 0.96,
  };

  const chests: MinimapMarker[] = [];
  for (let i = 0; i < world.chests.length; i++) {
    const ch = world.chests[i];
    if (ch.opened) continue;
    const proj = projectToRadar(ch.x - p.x, ch.y - p.y, radarRange, 0.9);
    chests.push({
      ...proj,
      color: ch.tier === 'golden' ? '#fde047' : '#f59e0b',
      kind: ch.tier === 'golden' ? 'chest_golden' : 'chest_wooden',
    });
  }

  const lootDrops: MinimapMarker[] = [];
  for (let i = 0; i < world.lootDrops.length; i++) {
    const d = world.lootDrops[i];
    const dist = Math.hypot(d.x - p.x, d.y - p.y);
    if (dist > radarRange * 1.15) continue;
    const proj = projectToRadar(d.x - p.x, d.y - p.y, radarRange, 0.9);
    lootDrops.push({
      ...proj,
      color: GEAR_RARITY_META[d.item.rarity].color,
      kind: 'loot',
    });
  }

  const elites: MinimapMarker[] = [];
  let boss: MinimapBossMarker | null = null;
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.dying) continue;
    if (e.isBoss && !boss) {
      const proj = projectToRadar(e.x - p.x, e.y - p.y, radarRange, 0.86);
      const accent = isBossKind(e.kind) ? BOSS_META[e.kind].accent : '#ef4444';
      const name = isBossKind(e.kind) ? BOSS_META[e.kind].name : e.bossName ?? '보스';
      boss = {
        ...proj,
        accent,
        name,
      };
    } else if (e.isElite && elites.length < 6) {
      const proj = projectToRadar(e.x - p.x, e.y - p.y, radarRange, 0.88);
      elites.push({
        ...proj,
        color: e.eliteColor ?? '#c084fc',
        kind: 'elite',
      });
    }
  }

  let merchant: MinimapMerchantMarker | null = null;
  if (world.merchant.active) {
    const proj = projectToRadar(world.merchant.x - p.x, world.merchant.y - p.y, radarRange, 0.87);
    merchant = {
      ...proj,
      timeLeft: Math.max(0, Math.ceil(world.merchant.timer)),
    };
  }

  return {
    radarRange,
    playerX: p.x,
    playerY: p.y,
    playerAngle: p.aimAngle,
    biomeAccent,
    origin,
    chests,
    elites,
    lootDrops,
    merchant,
    boss,
  };
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  size: number,
  world: WorldState,
  nowSec: number
): void {
  const data = computeMinimapRadar(world);
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.5 - 4;

  ctx.save();
  ctx.clearRect(0, 0, size, size);

  // Dark obsidian tactical radar backdrop
  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, size, size);

  // Clip radar interior to subtle circular radar lens
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Biome-tinted subtle radial center glow
  const bgGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
  bgGrad.addColorStop(0, `${data.biomeAccent}1f`);
  bgGrad.addColorStop(0.65, '#0e1420');
  bgGrad.addColorStop(1, '#070a10');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Scrolling infinite open-field chunk grid lines
  const gridStepPx = (CHUNK_SIZE / data.radarRange) * (r * 0.9);
  if (gridStepPx >= 10) {
    const offX = ((-data.playerX % CHUNK_SIZE) / CHUNK_SIZE) * gridStepPx;
    const offY = ((-data.playerY % CHUNK_SIZE) / CHUNK_SIZE) * gridStepPx;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = cx + offX - gridStepPx * 3; x <= cx + r + gridStepPx; x += gridStepPx) {
      const rx = Math.round(x) + 0.5;
      ctx.moveTo(rx, cy - r);
      ctx.lineTo(rx, cy + r);
    }
    for (let y = cy + offY - gridStepPx * 3; y <= cy + r + gridStepPx; y += gridStepPx) {
      const ry = Math.round(y) + 0.5;
      ctx.moveTo(cx - r, ry);
      ctx.lineTo(cx + r, ry);
    }
    ctx.stroke();
  }

  // Concentric range rings & faint crosshairs
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();

  // Origin Sanctum (0, 0) landmark cross when visible
  if (data.origin.visible) {
    const ox = cx + data.origin.nx * r;
    const oy = cy + data.origin.ny * r;
    ctx.strokeStyle = 'rgba(245, 176, 65, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Ground Loot Drops (rarity-colored diamonds)
  for (let i = 0; i < data.lootDrops.length; i++) {
    const m = data.lootDrops[i];
    const mx = cx + m.nx * r;
    const my = cy + m.ny * r;
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(mx, my - 3);
    ctx.lineTo(mx + 2.5, my);
    ctx.lineTo(mx, my + 3);
    ctx.lineTo(mx - 2.5, my);
    ctx.closePath();
    ctx.fill();
  }

  // Special Elites (small affix triangles)
  for (let i = 0; i < data.elites.length; i++) {
    const m = data.elites[i];
    const mx = cx + m.nx * r;
    const my = cy + m.ny * r;
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(mx, my - 3.2);
    ctx.lineTo(mx + 3, my + 2.4);
    ctx.lineTo(mx - 3, my + 2.4);
    ctx.closePath();
    ctx.fill();
  }

  // Unopened Treasure Chests (pixel chest icons in-range, edge pips out-of-range)
  for (let i = 0; i < data.chests.length; i++) {
    const ch = data.chests[i];
    const mx = cx + ch.nx * r;
    const my = cy + ch.ny * r;
    const isGolden = ch.kind === 'chest_golden';

    if (ch.clamped) {
      // Edge directional pip pointing toward off-radar chest
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ch.angle);
      ctx.fillStyle = ch.color;
      ctx.strokeStyle = '#090c12';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4.5, 0);
      ctx.lineTo(-2.5, -3);
      ctx.lineTo(-2.5, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      if (isGolden) {
        const pulse = 0.32 + Math.sin(nowSec * 6 + i) * 0.16;
        ctx.fillStyle = `rgba(253, 224, 71, ${pulse.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(mx, my, 6.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#090c12';
      ctx.fillRect(Math.round(mx - 4), Math.round(my - 3.5), 8, 7);
      ctx.fillStyle = ch.color;
      ctx.fillRect(Math.round(mx - 3), Math.round(my - 2.5), 6, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(mx - 1), Math.round(my - 0.5), 2, 1.5);
    }
  }

  // Wandering Equipment Merchant Bearing Line + Pulsing Emerald-Gold Direction Marker
  if (data.merchant) {
    const m = data.merchant;
    const mx = cx + m.nx * r;
    const my = cy + m.ny * r;
    const pulse = 0.65 + 0.35 * Math.sin(nowSec * 8);

    ctx.save();
    ctx.strokeStyle = '#34d399';
    ctx.globalAlpha = 0.44 + pulse * 0.24;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.restore();

    if (m.clamped) {
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(m.angle);
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#090c12';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(7.5, 0);
      ctx.lineTo(-4.2, -5);
      ctx.lineTo(-1.8, 0);
      ctx.lineTo(-4.2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      const rimX = cx + Math.cos(m.angle) * (r - 4);
      const rimY = cy + Math.sin(m.angle) * (r - 4);
      ctx.save();
      ctx.translate(rimX, rimY);
      ctx.rotate(m.angle);
      ctx.fillStyle = '#34d399';
      ctx.globalAlpha = 0.72 + pulse * 0.28;
      ctx.beginPath();
      ctx.moveTo(4.2, 0);
      ctx.lineTo(-2.4, -3.2);
      ctx.lineTo(-0.8, 0);
      ctx.lineTo(-2.4, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = '#34d399';
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 5.5 + pulse * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#090c12';
      ctx.beginPath();
      ctx.arc(mx, my, 5.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(mx, my, 4.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.fillRect(Math.round(mx - 1.5), Math.round(my - 1.5), 3, 3);
    }
  }

  // Boss Bearing Line + Marker + Pulsing Directional Arrow
  if (data.boss) {
    const b = data.boss;
    const bx = cx + b.nx * r;
    const by = cy + b.ny * r;
    const pulse = 0.65 + 0.35 * Math.sin(nowSec * 9);

    // Dashed bearing line from Player (center) toward Boss
    ctx.save();
    ctx.strokeStyle = b.accent;
    ctx.globalAlpha = 0.42 + pulse * 0.22;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();

    if (b.clamped) {
      // Bold pulsing edge arrow pointing directly to off-radar Boss
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.accent;
      ctx.strokeStyle = '#090c12';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4.5, -5.5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4.5, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      // Perimeter directional chevron along boss bearing so direction reads instantly
      const rimX = cx + Math.cos(b.angle) * (r - 4);
      const rimY = cy + Math.sin(b.angle) * (r - 4);
      ctx.save();
      ctx.translate(rimX, rimY);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.72 + pulse * 0.28;
      ctx.beginPath();
      ctx.moveTo(4.5, 0);
      ctx.lineTo(-2.5, -3.5);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-2.5, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Pulsing boss aura + diamond marker
      ctx.strokeStyle = b.accent;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(bx, by, 6 + pulse * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#090c12';
      ctx.beginPath();
      ctx.moveTo(bx, by - 6.5);
      ctx.lineTo(bx + 6.5, by);
      ctx.lineTo(bx, by + 6.5);
      ctx.lineTo(bx - 6.5, by);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = b.accent;
      ctx.beginPath();
      ctx.moveTo(bx, by - 5);
      ctx.lineTo(bx + 5, by);
      ctx.lineTo(bx, by + 5);
      ctx.lineTo(bx - 5, by);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(bx - 1), Math.round(by - 1), 2, 2);
    }
  }

  // Player Position (Center Anchor) + Facing Direction Chevron
  const playerPulse = 0.35 + 0.2 * Math.sin(nowSec * 5);
  ctx.strokeStyle = `rgba(56, 189, 248, ${playerPulse.toFixed(2)})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(data.playerAngle);
  ctx.fillStyle = '#090c12';
  ctx.beginPath();
  ctx.moveTo(7.5, 0);
  ctx.lineTo(-4.5, -4.8);
  ctx.lineTo(-2.2, 0);
  ctx.lineTo(-4.5, 4.8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-3.5, -3.5);
  ctx.lineTo(-1.5, 0);
  ctx.lineTo(-3.5, 3.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0.5, 0, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore(); // end radar lens clip

  // Outer bezel ring (tinted with boss accent if boss active, emerald if merchant active)
  ctx.strokeStyle = data.boss
    ? `${data.boss.accent}aa`
    : data.merchant
      ? 'rgba(52, 211, 153, 0.85)'
      : 'rgba(100, 116, 139, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // North compass micro-label at top of bezel
  ctx.fillStyle = '#090d14';
  ctx.fillRect(cx - 6, 0, 12, 10);
  ctx.font = '800 8px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('N', cx, 5.5);

  ctx.restore();
}
