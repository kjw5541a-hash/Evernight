// CC0-style built-in pixel sprite atlas (16x16 & 20x18 hand-crafted dungeon sprites)
// Pre-bakes BOTH right-facing and left-facing canvases + white hit-flash variants + shadow oval
// so the renderer can blit every sprite with a single ctx.drawImage() and zero save/scale/restore overhead!

import type { GearRarity, GearSlot } from './types';

export interface SpriteFrameSet {
  right: HTMLCanvasElement;
  left: HTMLCanvasElement;
  flashRight: HTMLCanvasElement;
  flashLeft: HTMLCanvasElement;
  freezeRight: HTMLCanvasElement;
  freezeLeft: HTMLCanvasElement;
  burnRight: HTMLCanvasElement;
  burnLeft: HTMLCanvasElement;
  poisonRight: HTMLCanvasElement;
  poisonLeft: HTMLCanvasElement;
}

export interface SpriteAtlas {
  hero: [SpriteFrameSet, SpriteFrameSet];
  heroWizard: [SpriteFrameSet, SpriteFrameSet];
  heroWarrior: [SpriteFrameSet, SpriteFrameSet];
  heroArcher: [SpriteFrameSet, SpriteFrameSet];
  skeleton: [SpriteFrameSet, SpriteFrameSet];
  imp: [SpriteFrameSet, SpriteFrameSet];
  charger: [SpriteFrameSet, SpriteFrameSet];
  bat: [SpriteFrameSet, SpriteFrameSet];
  boss_behemoth: [SpriteFrameSet, SpriteFrameSet];
  boss_pyrolord: [SpriteFrameSet, SpriteFrameSet];
  boss_frostqueen: [SpriteFrameSet, SpriteFrameSet];
  lich_boss: [SpriteFrameSet, SpriteFrameSet];
  gemSmall: HTMLCanvasElement;
  gemMedium: HTMLCanvasElement;
  gemLarge: HTMLCanvasElement;
  potion: HTMLCanvasElement;
  magnet: HTMLCanvasElement;
  torch: [HTMLCanvasElement, HTMLCanvasElement];
  shadowOval: HTMLCanvasElement;
  chestWoodenClosed: HTMLCanvasElement;
  chestWoodenOpen: HTMLCanvasElement;
  chestGoldenClosed: HTMLCanvasElement;
  chestGoldenOpen: HTMLCanvasElement;
  gearIcons: Record<GearSlot, Record<GearRarity, HTMLCanvasElement>>;
  projBolt: HTMLCanvasElement;
  projRock: HTMLCanvasElement;
  projImpOrb: HTMLCanvasElement;
  projFireOrb: HTMLCanvasElement;
  projBossOrb: HTMLCanvasElement;
}

function bakePixelSprite(
  rows: string[],
  palette: Record<string, string>,
  scale = 3,
  solidTint: string | null = null,
  flipX = false
): HTMLCanvasElement {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = solidTint ?? color;
      const drawX = flipX ? (w - 1 - x) * scale : x * scale;
      ctx.fillRect(drawX, y * scale, scale, scale);
    }
  }
  return canvas;
}

function bakeFrameSet(rows: string[], palette: Record<string, string>, scale = 3): SpriteFrameSet {
  return {
    right: bakePixelSprite(rows, palette, scale, null, false),
    left: bakePixelSprite(rows, palette, scale, null, true),
    flashRight: bakePixelSprite(rows, palette, scale, '#ffffff', false),
    flashLeft: bakePixelSprite(rows, palette, scale, '#ffffff', true),
    freezeRight: bakePixelSprite(rows, palette, scale, '#38bdf8', false),
    freezeLeft: bakePixelSprite(rows, palette, scale, '#38bdf8', true),
    burnRight: bakePixelSprite(rows, palette, scale, '#f97316', false),
    burnLeft: bakePixelSprite(rows, palette, scale, '#f97316', true),
    poisonRight: bakePixelSprite(rows, palette, scale, '#22c55e', false),
    poisonLeft: bakePixelSprite(rows, palette, scale, '#22c55e', true),
  };
}

function bakeShadowOval(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(24, 12, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

// Hooded Vanguard Ranger
const HERO_PALETTE: Record<string, string> = {
  o: '#0b0e14',
  g: '#2b4d37',
  G: '#447652',
  s: '#64748b',
  S: '#cbd5e1',
  f: '#e2b18d',
  e: '#1e293b',
  a: '#f59e0b',
  A: '#fef08a',
  b: '#5c3a21',
};

const HERO_F0 = [
  '....oooo........',
  '...oGGGgo.......',
  '..oGgggggo..oA..',
  '..ogoffogo.oAa..',
  '..ogoeefgo.oao..',
  '.oSSggggSSoao...',
  '.oSsgbbgsSoo....',
  '..oogbbgoo......',
  '..ogGggGgo......',
  '..oggggggo......',
  '...ogbbgo.......',
  '...ob..bo.......',
  '...oo..oo.......',
  '................',
];

const HERO_F1 = [
  '................',
  '....oooo........',
  '...oGGGgo...oA..',
  '..oGgggggo.oAa..',
  '..ogoffogo.oao..',
  '..ogoeefgooao...',
  '.oSSggggSSoo....',
  '.oSsgbbgsSo.....',
  '..oogbbgoo......',
  '..ogGggGgo......',
  '..ogg..ggo......',
  '..ob....bo......',
  '..oo....oo......',
  '................',
];

// Wizard: Sapphire Arcane Robe + Pointed Hat + Luminous Crystal Staff
const WIZARD_PALETTE: Record<string, string> = {
  o: '#0b0e14',
  g: '#1d4ed8',
  G: '#38bdf8',
  s: '#7c3aed',
  S: '#c084fc',
  f: '#f1c29b',
  e: '#0f172a',
  a: '#38bdf8',
  A: '#e0f2fe',
  b: '#b45309',
};

const WIZARD_F0 = [
  '.....oo.........',
  '....oGGo....oA..',
  '...oGggGo..oAa..',
  '..oGGGGGGooAao..',
  '...ooffo...ob...',
  '...ooeoo...ob...',
  '..oSgggSo..ob...',
  '..oSgggSooob....',
  '..ogGggGgo......',
  '..oggggggo......',
  '..ogGggGgo......',
  '...og..go.......',
  '...oo..oo.......',
  '................',
];

const WIZARD_F1 = [
  '................',
  '.....oo.....oA..',
  '....oGGo...oAa..',
  '...oGggGo..oAo..',
  '..oGGGGGGooob...',
  '...ooffo...ob...',
  '..oSgggSooob....',
  '..oSgggSo.......',
  '..ogGggGgo......',
  '..oggggggo......',
  '..ogg..ggo......',
  '..og....go......',
  '..oo....oo......',
  '................',
];

// Warrior: Heavy Steel Helm + Crimson Plume & Cape + Battleaxe
const WARRIOR_PALETTE: Record<string, string> = {
  o: '#0b0e14',
  g: '#b91c1c',
  G: '#ef4444',
  s: '#64748b',
  S: '#e2e8f0',
  f: '#cbd5e1',
  e: '#0f172a',
  a: '#f97316',
  A: '#fed7aa',
  b: '#78350f',
};

const WARRIOR_F0 = [
  '....oGGo........',
  '...oSSSSo..oSS..',
  '..oSssssSooSaS..',
  '..osoffosooSaS..',
  '..osoeesoo.ob...',
  '.oSSggggSSoob...',
  '.oSsgSSgsSo.....',
  '.oGogSSgoGo.....',
  '..oGssssGo......',
  '..oGssssGo......',
  '...osbbso.......',
  '...os..so.......',
  '...oo..oo.......',
  '................',
];

const WARRIOR_F1 = [
  '................',
  '....oGGo...oSS..',
  '...oSSSSo.oSaS..',
  '..oSssssSooSaS..',
  '..osoffoso.ob...',
  '.oSSggggSSoob...',
  '.oSsgSSgsSo.....',
  '.oGogSSgoGo.....',
  '..oGssssGo......',
  '..oGs..sGo......',
  '..os....so......',
  '..os....so......',
  '..oo....oo......',
  '................',
];

// Skeleton Swarmer
const SKELETON_PALETTE: Record<string, string> = {
  o: '#0b0e14',
  w: '#d6d3d1',
  W: '#f5f5f4',
  d: '#78716c',
  r: '#ef4444',
  m: '#94a3b8',
};

const SKELETON_F0 = [
  '....ooooo.......',
  '...oWWWWwo......',
  '..oWwoWwoWo.....',
  '..oWroWroWo.....',
  '...oWWWWwo......',
  '....odddo...om..',
  '..ooWwdWwoo.om..',
  '..oWdwdwdWoom...',
  '...ooWwdWoo.....',
  '....ow.wo.......',
  '...ow...wo......',
  '...oo...oo......',
  '................',
];

const SKELETON_F1 = [
  '................',
  '....ooooo.......',
  '...oWWWWwo......',
  '..oWwoWwoWo..m..',
  '..oWroWroWo.om..',
  '...oWWWWwo..om..',
  '....odddo..oom..',
  '..ooWwdWwoo.....',
  '..oWdwdwdWo.....',
  '....ow.wo.......',
  '....ow.wo.......',
  '...oo...oo......',
  '................',
];

// Ember Imp Ranged Caster
const IMP_PALETTE: Record<string, string> = {
  o: '#0b0e14',
  r: '#b91c1c',
  R: '#ef4444',
  a: '#fb923c',
  y: '#fde047',
  w: '#57534e',
};

const IMP_F0 = [
  '..oo....oo......',
  '..oRo..oRo..oy..',
  '...oRRRRo..oao..',
  '..oRyRRyRo.owo..',
  '..oRRRRRRo.owo..',
  '...oarrao..owo..',
  '..oRRaaRRoowo...',
  '..oRrrrrRRoo....',
  '...orrrro.......',
  '...or..ro.......',
  '..oo....oo......',
  '................',
];

const IMP_F1 = [
  '................',
  '..oo....oo..oy..',
  '..oRo..oRo.oao..',
  '...oRRRRo..owo..',
  '..oRyRRyRo.owo..',
  '..oRRRRRRoowo...',
  '...oarraooo.....',
  '..oRRaaRRo......',
  '...orrrro.......',
  '....or.ro.......',
  '...oo...oo......',
  '................',
];

// Heavy Iron Charger Knight
const CHARGER_PALETTE: Record<string, string> = {
  o: '#090c10',
  m: '#475569',
  M: '#94a3b8',
  r: '#dc2626',
  R: '#f87171',
  g: '#fbbf24',
};

const CHARGER_F0 = [
  '.oo........oo...',
  '.oMo.oooo.oMo...',
  '..oMoMMMMoMo....',
  '..ooMrrrrMoo....',
  '..oMMMMMMMMo....',
  '.oMMmggggmMMo...',
  '.oMmMRRRRMmMo...',
  '.oMmMRRRRMmMo...',
  '..oMMMMMMMMo....',
  '..oMMm..mMMo....',
  '..oMMo..oMMo....',
  '..ooo....ooo....',
  '................',
];

const CHARGER_F1 = [
  '................',
  '.oo........oo...',
  '.oMo.oooo.oMo...',
  '..oMoMMMMoMo....',
  '..ooMrrrrMoo....',
  '..oMMMMMMMMo....',
  '.oMMmggggmMMo...',
  '.oMmMRRRRMmMo...',
  '..oMMMMMMMMo....',
  '.oMMm....mMMo...',
  '.oMMo....oMMo...',
  '.ooo......ooo...',
  '................',
];

// Void Bat Flanker
const BAT_PALETTE: Record<string, string> = {
  o: '#0b0e14',
  p: '#581c87',
  P: '#9333ea',
  y: '#fbbf24',
  l: '#c084fc',
};

const BAT_F0 = [
  'oo..........oo..',
  'oPo..oooo..oPo..',
  'oPPooPPPPooPPo..',
  '.oPPPlyylPPPo...',
  '.oPPpPPPPpPPo...',
  '..ooPppppPoo....',
  '....oppppo......',
  '.....oooo.......',
];

const BAT_F1 = [
  '.....oooo.......',
  '....oPPPPo......',
  '..ooPlyylPoo....',
  '.oPPPpPPpPPPo...',
  'oPPpoPPPPopPPo..',
  'oPo..oppo..oPo..',
  'oo..........oo..',
  '................',
];

// BOSS 1 (Wave 3): Iron Behemoth Juggernaut (20x17)
const BEHEMOTH_PALETTE: Record<string, string> = {
  o: '#090b10',
  m: '#334155',
  M: '#64748b',
  S: '#cbd5e1',
  r: '#991b1b',
  R: '#ef4444',
  y: '#fde047',
  g: '#d97706',
};

const BEHEMOTH_F0 = [
  '.oo..............oo.',
  '.oSo............oSo.',
  '..oSSo.oooooo.oSSo..',
  '...oSSoMMMMMMoSSo...',
  '....oMMMRrrRMMMo....',
  '...oMMMRyRRyRMMMo...',
  '..oMMmMMMMMMMMmMMo..',
  '.oSSmMMggggggMMmSSo.',
  '.oSMmMRRRRRRRRMmMSo.',
  '.oSMmMRRyyyyRRMmMSo.',
  '.oMMmMRRRRRRRRMmMMo.',
  '..oMMmMMMMMMMMmMMo..',
  '...oMMmMMMMMMmMMo...',
  '...oMMm......mMMo...',
  '..oMMMo......oMMMo..',
  '..oooo........oooo..',
  '....................',
];

const BEHEMOTH_F1 = [
  '....................',
  '.oo..............oo.',
  '.oSo............oSo.',
  '..oSSo.oooooo.oSSo..',
  '...oSSoMMMMMMoSSo...',
  '....oMMMRrrRMMMo....',
  '...oMMMRyRRyRMMMo...',
  '..oMMmMMMMMMMMmMMo..',
  '.oSSmMMggggggMMmSSo.',
  '.oSMmMRRRRRRRRMmMSo.',
  '.oSMmMRRyyyyRRMmMSo.',
  '..oMMmMMMMMMMMmMMo..',
  '...oMMmMMMMMMmMMo...',
  '....oMMm....mMMo....',
  '...oMMMo....oMMMo...',
  '...oooo......oooo...',
  '....................',
];

// BOSS 2 (Wave 5): Abyssal Pyrolord Ifrit (20x17)
const PYROLORD_PALETTE: Record<string, string> = {
  o: '#0d0707',
  d: '#450a0a',
  r: '#b91c1c',
  R: '#f97316',
  a: '#fbbf24',
  Y: '#fef08a',
  m: '#292524',
};

const PYROLORD_F0 = [
  '.....oY..oo..Yo.....',
  '....oYaYoYYoYaYo....',
  '..oo.oRRaaaaRRo.oo..',
  '.oRRo.oRddddRo.oRRo.',
  'oRRaRoRddYYddRoRaRRo',
  'oRaaRRRdRRRRdRRRaaRo',
  'oRRdRRdRaaaaRdRRdRRo',
  '.oRddRdRaYYaRdRddRo.',
  '..ooRdRRaaaaRRdRoo..',
  '...oRddRRRRRRddRo...',
  '...oRdddRaaRdddRo...',
  '....oRddRRRRddRo....',
  '.....oRdd..ddRo.....',
  '....oRaa....aaRo....',
  '....oYY......YYo....',
  '.....oo......oo.....',
  '....................',
];

const PYROLORD_F1 = [
  '....oY...oo...Yo....',
  '...oYaYoYYYYoYaYo...',
  '.oo..oRRaaaaRRo..oo.',
  'oRRo..oRddddRo..oRRo',
  'oRaRo.RddYYddR.oRaRo',
  'oRaaRRRdRRRRdRRRaaRo',
  '.oRdRRdRaaaaRdRRdRo.',
  '..oRddRdRaYYaRdRdo..',
  '...oRdRRaaaaRRdRo...',
  '...oRddRRRRRRddRo...',
  '....oRddRaaRddRo....',
  '....oRddRRRRddRo....',
  '.....oRdd..ddRo.....',
  '.....oRaa..aaRo.....',
  '.....oYY....YYo.....',
  '......oo....oo......',
  '....................',
];

// BOSS 3 (Wave 7): Frost Queen Glacia (20x17)
const FROSTQUEEN_PALETTE: Record<string, string> = {
  o: '#08101c',
  c: '#0284c7',
  C: '#38bdf8',
  i: '#bae6fd',
  W: '#f0f9ff',
  d: '#1e3a8a',
  p: '#818cf8',
};

const FROSTQUEEN_F0 = [
  '......oW.oW.oW......',
  '.....oWiWiWiWiWo....',
  '.....oCCCCCCCCo.....',
  '....ooiiiiiiiiio....',
  '....oiioCiiCoiio....',
  '....oiiiiiiiiii0....',
  '.....ooiiiiiiio.....',
  '...ooCCWWWWWWCCoo...',
  '..oCCCCiCCCCiCCCCo..',
  '.oCCddCCiiiiCCddCCo.',
  '.oCCdCCCWWWWCCCdCCo.',
  '..oCddCCCCCCCCddCo..',
  '..oCCddCCCCCCddCCo..',
  '...oCCdCCiiCCdCCo...',
  '...oC..oCiiCo..Co...',
  '....o...oCCo...o....',
  '.........oo.........',
].map((r) => r.replace('0', 'o'));

const FROSTQUEEN_F1 = [
  '....................',
  '......oW.oW.oW......',
  '.....oWiWiWiWiWo....',
  '.....oCCCCCCCCo.....',
  '....ooiiiiiiiiio....',
  '....oiioCiiCoiio....',
  '....oiiiiiiiiiio....',
  '..oooCCWWWWWWCCooo..',
  '.oCCCCCiCCCCiCCCCCo.',
  '.oCCddCCiiiiCCddCCo.',
  '..oCdCCCWWWWCCCdCo..',
  '..oCddCCCCCCCCddCo..',
  '...oCddCCCCCCddCo...',
  '...oCCdCCiiCCdCCo...',
  '....oC.oCiiCo.Co....',
  '.....o..oCCo..o.....',
  '.........oo.........',
];

// BOSS 4 (Wave 10 Final): Ancient Lich Lord (20x17)
const LICH_PALETTE: Record<string, string> = {
  o: '#07090e',
  g: '#d97706',
  G: '#fde047',
  w: '#e2e8f0',
  p: '#581c87',
  P: '#9333ea',
  l: '#c084fc',
  c: '#38bdf8',
  d: '#1e1b4b',
};

const LICH_F0 = [
  '......oG.oG.oG......',
  '.....oGGGGGGGGo.....',
  '.....oggggggggo.....',
  '....oowwwwwwwwoo....',
  '....owwocwwcowwo....',
  '....owwwwwwwwwwo....',
  '.....oowdwwdwoo.....',
  '...ooPPggggggPPoo...',
  '..oPPPPPGGGGPPPPPo..',
  '.oPPddPPPPPPPPddPPo.',
  '.oPPdPllPPPPllPdPPo.',
  '.oPPdPPPPPPPPPPdPPo.',
  '..oPddPPPPPPPPddPo..',
  '..oPPddPPPPPPddPPo..',
  '...oPPddPPPPddPPo...',
  '...oP..oP..Po..Po...',
  '....o...o..o...o....',
];

const LICH_F1 = [
  '....................',
  '......oG.oG.oG......',
  '.....oGGGGGGGGo.....',
  '.....oggggggggo.....',
  '....oowwwwwwwwoo....',
  '....owwocwwcowwo....',
  '....owwwwwwwwwwo....',
  '.....oowdwwdwoo.....',
  '..oooPPggggggPPooo..',
  '.oPPPPPPGGGGPPPPPPo.',
  '.oPPddPPPPPPPPddPPo.',
  '.oPPdPllPPPPllPdPPo.',
  '..oPddPPPPPPPPddPo..',
  '..oPPddPPPPPPddPPo..',
  '...oPddPPPPPPddPo...',
  '..oP..oP....Po..Po..',
  '...o...o....o...o...',
];

const GEM_SMALL = [
  '..oo..',
  '.oGGoo',
  'oGgGgo',
  'oggggo',
  '.oggo.',
  '..oo..',
];

const GEM_MED = [
  '...oo...',
  '..oBBo..',
  '.oBbbBo.',
  'oBbBBbbo',
  '.obbbbo.',
  '..obbo..',
  '...oo...',
];

const GEM_LARGE = [
  '...oo...',
  '..oAAo..',
  '.oAaaAo.',
  'oAaAAaao',
  'oAaaaaao',
  '.oaaaao.',
  '..oaao..',
  '...oo...',
];

const POTION_ROWS = [
  '..ooo..',
  '..oWo..',
  '.oWWWo.',
  'oRRRRRo',
  'oRrrRRo',
  'orrrrro',
  '.ooooo.',
];

const MAGNET_ROWS = [
  '.oo.oo.',
  'oSSoSSo',
  'oRRoRRo',
  'oRRoRRo',
  'oRRRRRo',
  '.oRRRo.',
  '..ooo..',
];

const TORCH_F0 = [
  '...oo...',
  '..oYYo..',
  '.oYAAYo.',
  '.oAOAOo.',
  '..oooo..',
  '.oMMMMo.',
  '..oMMo..',
  '..oMMo..',
  '.oMMMMo.',
  '.oooooo.',
];

const TORCH_F1 = [
  '..oo....',
  '.oYYo...',
  '.oYAAo..',
  '.oOAAOo.',
  '..oooo..',
  '.oMMMMo.',
  '..oMMo..',
  '..oMMo..',
  '.oMMMMo.',
  '.oooooo.',
];

const CHEST_CLOSED_ROWS = [
  '..oooooooooo..',
  '.oMMMMMMMMMMo.',
  'oMWWWGGGGWWWo.',
  'oMwwwGyyGwwwMo',
  'oMMMMMMMMMMMMo',
  'oMwwwGyyGwwwMo',
  'oMwwwGGGGwwwMo',
  'oMwwwwwwwwwwMo',
  '.oMMMMMMMMMMo.',
  '..oooooooooo..',
];

const CHEST_OPEN_ROWS = [
  '.oMMMMMMMMMMo.',
  'oMddddddddddMo',
  '.oMMMMMMMMMMo.',
  'oMddddYYddddMo',
  'oMwwwGyyGwwwMo',
  'oMMMMMMMMMMMMo',
  'oMwwwGyyGwwwMo',
  'oMwwwwwwwwwwMo',
  '.oMMMMMMMMMMo.',
  '..oooooooooo..',
];

const GEAR_WEAPON_ROWS = [
  '.......oo.',
  '......oCCo',
  '.....oCWWo',
  '....oCWWo.',
  '...oCWWo..',
  '.ooCWWo...',
  '.oGGoo....',
  '..oGo.....',
  '.oGo......',
  '.oo.......',
];

const GEAR_ARMOR_ROWS = [
  '..oo..oo..',
  '.oCCooCCo.',
  'oCCWWWWCCo',
  'oCCWWWWCCo',
  '.oCWWWWCo.',
  '.oCCGGCCo.',
  '.oCCWWCCo.',
  '..oCCCCo..',
  '..oCooCo..',
  '...oooo...',
];

const GEAR_HELM_ROWS = [
  '...oooo...',
  '..oCCCCo..',
  '.oCCWWCCo.',
  '.oCCWWCCo.',
  'oCCGGGGCCo',
  'oCo.oo.oCo',
  'oCCo..oCCo',
  '.oCCooCCo.',
  '..oooooo..',
  '..........',
];

const GEAR_ACCESSORY_ROWS = [
  '...oooo...',
  '..oGGGGoo.',
  '.oGWWWWGo.',
  '.oGWCCWGo.',
  '..oGGGGoo.',
  '...oCCo...',
  '..oCooCo..',
  '..oC..Co..',
  '...oooo...',
  '..........',
];

function bakeOrbProjectile(radius: number, outerColor: string, coreColor: string): HTMLCanvasElement {
  const pad = 4;
  const size = (radius + pad) * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    ctx.fillStyle = '#0b0e14';
    ctx.beginPath();
    ctx.arc(cx, cx, radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outerColor;
    ctx.beginPath();
    ctx.arc(cx, cx, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coreColor;
    ctx.fillRect(Math.round(cx - 2), Math.round(cx - 2), 4, 4);
  }
  return c;
}

function bakeRockProjectile(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 18;
  c.height = 18;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(1, 1, 16, 16);
    ctx.fillStyle = '#78716c';
    ctx.fillRect(3, 3, 12, 12);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(6, 6, 6, 6);
  }
  return c;
}

const RARITY_SPRITE_PALETTES: Record<GearRarity, Record<string, string>> = {
  normal: { o: '#090c12', C: '#94a3b8', W: '#e2e8f0', G: '#64748b' },
  rare: { o: '#090c12', C: '#3b82f6', W: '#bfdbfe', G: '#93c5fd' },
  epic: { o: '#090c12', C: '#a855f7', W: '#e9d5ff', G: '#c084fc' },
  legendary: { o: '#090c12', C: '#f97316', W: '#ffedd5', G: '#fbbf24' },
};

function bakeGearSlotMap(rows: string[]): Record<GearRarity, HTMLCanvasElement> {
  return {
    normal: bakePixelSprite(rows, RARITY_SPRITE_PALETTES.normal, 2.5),
    rare: bakePixelSprite(rows, RARITY_SPRITE_PALETTES.rare, 2.5),
    epic: bakePixelSprite(rows, RARITY_SPRITE_PALETTES.epic, 2.5),
    legendary: bakePixelSprite(rows, RARITY_SPRITE_PALETTES.legendary, 2.5),
  };
}

let cachedAtlas: SpriteAtlas | null = null;

export function getSpriteAtlas(): SpriteAtlas {
  if (cachedAtlas) return cachedAtlas;

  const woodenPal = {
    o: '#090c10',
    M: '#475569',
    W: '#92400e',
    w: '#78350f',
    G: '#d97706',
    y: '#fde047',
    Y: '#fef08a',
    d: '#1c1917',
  };
  const goldenPal = {
    o: '#090c10',
    M: '#b45309',
    W: '#f59e0b',
    w: '#d97706',
    G: '#fde047',
    y: '#ffffff',
    Y: '#fef9c3',
    d: '#451a03',
  };

  const archerSet: [SpriteFrameSet, SpriteFrameSet] = [
    bakeFrameSet(HERO_F0, HERO_PALETTE, 3),
    bakeFrameSet(HERO_F1, HERO_PALETTE, 3),
  ];
  const wizardSet: [SpriteFrameSet, SpriteFrameSet] = [
    bakeFrameSet(WIZARD_F0, WIZARD_PALETTE, 3),
    bakeFrameSet(WIZARD_F1, WIZARD_PALETTE, 3),
  ];
  const warriorSet: [SpriteFrameSet, SpriteFrameSet] = [
    bakeFrameSet(WARRIOR_F0, WARRIOR_PALETTE, 3),
    bakeFrameSet(WARRIOR_F1, WARRIOR_PALETTE, 3),
  ];

  cachedAtlas = {
    hero: archerSet,
    heroWizard: wizardSet,
    heroWarrior: warriorSet,
    heroArcher: archerSet,
    skeleton: [bakeFrameSet(SKELETON_F0, SKELETON_PALETTE, 3), bakeFrameSet(SKELETON_F1, SKELETON_PALETTE, 3)],
    imp: [bakeFrameSet(IMP_F0, IMP_PALETTE, 3), bakeFrameSet(IMP_F1, IMP_PALETTE, 3)],
    charger: [bakeFrameSet(CHARGER_F0, CHARGER_PALETTE, 3), bakeFrameSet(CHARGER_F1, CHARGER_PALETTE, 3)],
    bat: [bakeFrameSet(BAT_F0, BAT_PALETTE, 3), bakeFrameSet(BAT_F1, BAT_PALETTE, 3)],
    boss_behemoth: [bakeFrameSet(BEHEMOTH_F0, BEHEMOTH_PALETTE, 4), bakeFrameSet(BEHEMOTH_F1, BEHEMOTH_PALETTE, 4)],
    boss_pyrolord: [bakeFrameSet(PYROLORD_F0, PYROLORD_PALETTE, 4), bakeFrameSet(PYROLORD_F1, PYROLORD_PALETTE, 4)],
    boss_frostqueen: [bakeFrameSet(FROSTQUEEN_F0, FROSTQUEEN_PALETTE, 4), bakeFrameSet(FROSTQUEEN_F1, FROSTQUEEN_PALETTE, 4)],
    lich_boss: [bakeFrameSet(LICH_F0, LICH_PALETTE, 4), bakeFrameSet(LICH_F1, LICH_PALETTE, 4)],
    gemSmall: bakePixelSprite(GEM_SMALL, { o: '#064e3b', g: '#10b981', G: '#6ee7b7' }, 2),
    gemMedium: bakePixelSprite(GEM_MED, { o: '#0c4a6e', b: '#38bdf8', B: '#bae6fd' }, 2),
    gemLarge: bakePixelSprite(GEM_LARGE, { o: '#78350f', a: '#f59e0b', A: '#fef08a' }, 2.5),
    potion: bakePixelSprite(POTION_ROWS, { o: '#1f0b0e', W: '#e2e8f0', R: '#ef4444', r: '#fca5a5' }, 3),
    magnet: bakePixelSprite(MAGNET_ROWS, { o: '#1e1b4b', S: '#e2e8f0', R: '#a855f7' }, 3),
    torch: [
      bakePixelSprite(TORCH_F0, { o: '#090c10', Y: '#fef08a', A: '#f59e0b', O: '#ea580c', M: '#475569' }, 3),
      bakePixelSprite(TORCH_F1, { o: '#090c10', Y: '#fef08a', A: '#f59e0b', O: '#ea580c', M: '#475569' }, 3),
    ],
    shadowOval: bakeShadowOval(),
    chestWoodenClosed: bakePixelSprite(CHEST_CLOSED_ROWS, woodenPal, 3),
    chestWoodenOpen: bakePixelSprite(CHEST_OPEN_ROWS, woodenPal, 3),
    chestGoldenClosed: bakePixelSprite(CHEST_CLOSED_ROWS, goldenPal, 3.2),
    chestGoldenOpen: bakePixelSprite(CHEST_OPEN_ROWS, goldenPal, 3.2),
    gearIcons: {
      weapon: bakeGearSlotMap(GEAR_WEAPON_ROWS),
      armor: bakeGearSlotMap(GEAR_ARMOR_ROWS),
      helm: bakeGearSlotMap(GEAR_HELM_ROWS),
      accessory: bakeGearSlotMap(GEAR_ACCESSORY_ROWS),
    },
    projBolt: bakeOrbProjectile(5.5, '#f59e0b', '#fef9c3'),
    projRock: bakeRockProjectile(),
    projImpOrb: bakeOrbProjectile(7, '#fb923c', '#ffffff'),
    projFireOrb: bakeOrbProjectile(8, '#f97316', '#fef08a'),
    projBossOrb: bakeOrbProjectile(9, '#c084fc', '#ffffff'),
  };

  return cachedAtlas;
}
