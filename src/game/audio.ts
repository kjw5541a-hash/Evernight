import type { SoundEvent } from './types';

// Per-event minimum interval (ms) keeps busy late-wave combat crisp without audio pileup
const SOUND_MIN_INTERVAL_MS: Partial<Record<SoundEvent, number>> = {
  hit: 48,
  crit_hit: 55,
  kill: 54,
  gem: 40,
  coin: 42,
  bolt: 62,
  frost: 75,
  chakram: 85,
  lightning: 95,
  telegraph: 95,
};

const PENTATONIC_RATIOS = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5, 3];

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private whiteNoiseBuf: AudioBuffer | null = null;
  private pinkNoiseBuf: AudioBuffer | null = null;
  private muted = false;
  private lastPlayedAt = new Map<SoundEvent, number>();

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterBus && this.ctx) {
      this.masterBus.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.015);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      // Master compressor + gain keeps multi-layered combat Foley punchy without harsh clipping
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.14, this.ctx.currentTime);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime);

      compressor.connect(master);
      master.connect(this.ctx.destination);
      this.masterBus = master;

      // Connect helper routing target through compressor
      this.busInput = compressor;
      this.initNoiseBuffers();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  private busInput: AudioNode | null = null;

  private initNoiseBuffers(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.8);

    // 1. Crisp white noise buffer (impacts, bone/crystal shatter, sparks, blades)
    const white = this.ctx.createBuffer(1, length, sampleRate);
    const wData = white.getChannelData(0);
    for (let i = 0; i < length; i++) {
      wData[i] = Math.random() * 2 - 1;
    }
    this.whiteNoiseBuf = white;

    // 2. Warm pink/brown-leaning noise buffer (whooshes, fire roars, heavy explosions)
    const pink = this.ctx.createBuffer(1, length, sampleRate);
    const pData = pink.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const wn = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + wn * 0.029;
      b1 = 0.985 * b1 + wn * 0.032;
      b2 = 0.95 * b2 + wn * 0.048;
      pData[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + wn * 0.14) * 2.1));
    }
    this.pinkNoiseBuf = pink;
  }

  private get output(): AudioNode | null {
    return this.busInput ?? this.ctx?.destination ?? null;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    attack = 0.005,
    filterHz?: number
  ): void {
    if (this.muted || !this.ctx || !this.output || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freq), now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (filterHz) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterHz, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(180, filterHz * 0.35), now + duration);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.output);
    osc.start(now);
    osc.stop(now + duration + 0.025);
  }

  private playNoise(
    duration: number,
    volume: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number,
    q = 1.2,
    delay = 0,
    usePink = false,
    attack = 0.004
  ): void {
    if (this.muted || !this.ctx || !this.output || this.ctx.state !== 'running') return;
    const buf = usePink ? this.pinkNoiseBuf : this.whiteNoiseBuf;
    if (!buf) return;

    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    // Randomize buffer start offset so rapid consecutive hits sound organic, never robotic
    const maxOffset = Math.max(0, buf.duration - duration - 0.02);
    const offset = maxOffset > 0 ? Math.random() * maxOffset : 0;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, now);
    filter.frequency.setValueAtTime(Math.max(40, startFreq), now);
    if (endFreq !== startFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    src.start(now, offset, duration + 0.02);
    src.stop(now + duration + 0.025);
  }

  public play(event: SoundEvent, gemCombo = 0): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;

    const minGap = SOUND_MIN_INTERVAL_MS[event];
    if (minGap) {
      const nowMs = performance.now();
      const prev = this.lastPlayedAt.get(event) ?? 0;
      if (nowMs - prev < minGap) return;
      this.lastPlayedAt.set(event, nowMs);
    }

    const jitter = 0.9 + Math.random() * 0.2;

    switch (event) {
      // Snappy arcane staff bolt: airy bow-snap + warm resonant pluck
      case 'bolt':
        this.playNoise(0.045, 0.055, 'bandpass', 2400 * jitter, 900 * jitter, 1.8, 0, false, 0.002);
        this.playTone(620 * jitter, 250 * jitter, 0.075, 'triangle', 0.055, 0, 0.003, 1800);
        break;

      // Crystalline frost spear: shimmering icy tinkle + chilly wind snap
      case 'frost':
        this.playNoise(0.09, 0.055, 'highpass', 3600 * jitter, 1800 * jitter, 1.1, 0, false, 0.004);
        this.playTone(1380 * jitter, 820 * jitter, 0.11, 'sine', 0.06, 0, 0.003);
        this.playTone(2120 * jitter, 1460 * jitter, 0.08, 'triangle', 0.032, 0.012, 0.003);
        break;

      // Whirring holy chakram: metallic blade slice + resonant ring
      case 'chakram':
        this.playNoise(0.1, 0.065, 'bandpass', 1600 * jitter, 3400 * jitter, 2.4, 0, false, 0.006);
        this.playTone(540 * jitter, 880 * jitter, 0.1, 'triangle', 0.055, 0, 0.005);
        this.playTone(1240 * jitter, 1020 * jitter, 0.09, 'sine', 0.035, 0.015);
        break;

      // Electric chain lightning: crackling plasma snap + sharp arc discharge
      case 'lightning':
        this.playNoise(0.06, 0.12, 'highpass', 2600 * jitter, 1100 * jitter, 0.9, 0, false, 0.002);
        this.playNoise(0.08, 0.08, 'bandpass', 4200 * jitter, 1400 * jitter, 2.2, 0.035, false, 0.002);
        this.playTone(1180 * jitter, 190 * jitter, 0.11, 'sawtooth', 0.055, 0, 0.002, 2400);
        break;

      // Ember nova: fiery ignition whoosh + low concussive burst
      case 'nova':
        this.playNoise(0.28, 0.16, 'lowpass', 1800 * jitter, 260, 0.9, 0, true, 0.01);
        this.playTone(165 * jitter, 46, 0.24, 'sine', 0.16, 0, 0.004);
        this.playTone(240 * jitter, 82, 0.18, 'sawtooth', 0.055, 0.01, 0.006, 680);
        break;

      // Kinetic dash shockwave: crisp wind whoosh + deep sub-kick punch
      case 'dash':
        this.playNoise(0.17, 0.14, 'bandpass', 420, 2100 * jitter, 1.3, 0, true, 0.012);
        this.playTone(190 * jitter, 58, 0.14, 'sine', 0.15, 0, 0.004);
        this.playTone(340 * jitter, 680 * jitter, 0.11, 'triangle', 0.055, 0.01, 0.006);
        break;

      // Physical monster hit: meaty low-mid body thud + crisp armor/flesh smack transient
      case 'hit':
        this.playTone(185 * jitter, 62 * jitter, 0.068, 'sine', 0.13, 0, 0.002);
        this.playNoise(0.038, 0.11, 'bandpass', 1850 * jitter, 680 * jitter, 1.4, 0, false, 0.002);
        this.playTone(340 * jitter, 130 * jitter, 0.042, 'triangle', 0.055, 0, 0.002, 1100);
        break;

      // Critical hit: heavy bass slam + sharp metallic slash-ring + crackle burst
      case 'crit_hit':
        this.playTone(160 * jitter, 46, 0.1, 'sine', 0.18, 0, 0.002);
        this.playNoise(0.065, 0.15, 'bandpass', 2800 * jitter, 950, 1.2, 0, false, 0.002);
        this.playTone(1460 * jitter, 980 * jitter, 0.11, 'triangle', 0.07, 0.006, 0.002);
        this.playTone(2240 * jitter, 1720 * jitter, 0.09, 'sine', 0.045, 0.01, 0.002);
        break;

      // Monster destruction / shatter: sub-punch + crunchy bone/pixel shatter + crisp pop
      case 'kill':
        this.playTone(148 * jitter, 42, 0.12, 'sine', 0.17, 0, 0.003);
        this.playNoise(0.095, 0.15, 'bandpass', 1350 * jitter, 3100 * jitter, 1.3, 0, false, 0.003);
        this.playNoise(0.11, 0.09, 'lowpass', 720 * jitter, 180, 0.8, 0.015, true, 0.004);
        this.playTone(460 * jitter, 690 * jitter, 0.085, 'triangle', 0.05, 0.025, 0.004);
        break;

      // Boss defeat explosion: seismic sub-boom + crumbling debris roar + triumphant brass chord
      case 'boss_kill':
        this.playTone(98, 28, 0.62, 'sine', 0.28, 0, 0.006);
        this.playNoise(0.55, 0.24, 'lowpass', 1400, 160, 0.8, 0, true, 0.01);
        this.playNoise(0.28, 0.16, 'bandpass', 2400, 700, 1.2, 0.04, false, 0.005);
        this.playTone(293.66, 293.66, 0.32, 'triangle', 0.09, 0.14, 0.02, 1600);
        this.playTone(440, 440, 0.36, 'triangle', 0.09, 0.22, 0.02, 1800);
        this.playTone(587.33, 587.33, 0.48, 'sine', 0.1, 0.3, 0.02);
        break;

      // Crystalline XP gem chime rising smoothly along a pentatonic scale
      case 'gem': {
        const idx = Math.min(PENTATONIC_RATIOS.length - 1, Math.floor(gemCombo / 2));
        const base = 587.33 * PENTATONIC_RATIOS[idx];
        this.playTone(base, base * 1.03, 0.085, 'sine', 0.068, 0, 0.003);
        this.playTone(base * 2, base * 2.02, 0.055, 'triangle', 0.025, 0.006, 0.002);
        break;
      }

      // Crisp metallic gold coin pickup clink
      case 'coin': {
        const coinJitter = 0.96 + Math.random() * 0.1;
        this.playNoise(0.024, 0.045, 'highpass', 4200, 2600, 2.0, 0, false, 0.001);
        this.playTone(1318 * coinJitter, 1760 * coinJitter, 0.085, 'sine', 0.072, 0, 0.002);
        this.playTone(2637 * coinJitter, 2637 * coinJitter, 0.11, 'triangle', 0.042, 0.025, 0.002);
        break;
      }

      // Wandering Equipment Merchant arrival bell fanfare
      case 'merchant':
        this.playTone(587.33, 587.33, 0.16, 'triangle', 0.09, 0, 0.005);
        this.playTone(880, 880, 0.18, 'sine', 0.095, 0.09, 0.005);
        this.playTone(1174.66, 1174.66, 0.28, 'sine', 0.09, 0.18, 0.006);
        this.playNoise(0.07, 0.05, 'highpass', 3600, 2400, 1.5, 0.18, false, 0.004);
        break;

      // Warm healing chime
      case 'heal':
        this.playTone(440, 523.25, 0.14, 'sine', 0.09, 0, 0.01);
        this.playTone(587.33, 880, 0.2, 'triangle', 0.085, 0.08, 0.01);
        this.playNoise(0.16, 0.03, 'highpass', 3200, 4800, 1.0, 0.04, false, 0.02);
        break;

      // Enemy attack telegraph ping
      case 'telegraph':
        this.playTone(360, 580, 0.14, 'sine', 0.055, 0, 0.01);
        break;

      // Player hurt: heavy visceral armor thud + gritty impact crunch + warning low growl
      case 'hurt':
        this.playTone(138, 44, 0.2, 'sawtooth', 0.14, 0, 0.003, 460);
        this.playTone(95, 38, 0.22, 'sine', 0.22, 0, 0.002);
        this.playNoise(0.14, 0.18, 'lowpass', 1100, 220, 1.1, 0, true, 0.002);
        break;

      // Treasure chest open: heavy wooden latch pop + shimmering golden fanfare
      case 'chest':
        this.playTone(145, 75, 0.08, 'sine', 0.14, 0, 0.003);
        this.playNoise(0.06, 0.1, 'bandpass', 900, 450, 1.6, 0, true, 0.002);
        this.playTone(523.25, 523.25, 0.13, 'triangle', 0.085, 0.05, 0.006);
        this.playTone(659.25, 659.25, 0.15, 'triangle', 0.09, 0.11, 0.006);
        this.playTone(783.99, 1046.5, 0.24, 'sine', 0.095, 0.18, 0.008);
        break;

      // Diablo-inspired loot drop: crisp metallic weapon clink + bright rare/legendary chime
      case 'loot_drop':
        this.playNoise(0.04, 0.09, 'highpass', 3200, 1800, 2.0, 0, false, 0.002);
        this.playTone(1568, 1520, 0.16, 'sine', 0.09, 0, 0.002);
        this.playTone(2349, 2280, 0.22, 'triangle', 0.07, 0.045, 0.002);
        this.playTone(3136, 3136, 0.24, 'sine', 0.045, 0.09, 0.004);
        break;

      // Gear equip: firm iron buckle & anvil click + confident harmonic lock
      case 'equip':
        this.playNoise(0.05, 0.11, 'bandpass', 1900, 800, 2.2, 0, false, 0.002);
        this.playTone(240, 120, 0.07, 'sine', 0.13, 0, 0.002);
        this.playTone(740, 1110, 0.14, 'triangle', 0.085, 0.045, 0.004);
        break;

      // Gear salvage / forge upgrade: metallic shatter + bright hammer spark
      case 'salvage':
        this.playNoise(0.09, 0.13, 'bandpass', 2600, 1100, 1.8, 0, false, 0.002);
        this.playTone(980, 520, 0.09, 'triangle', 0.08, 0, 0.002);
        this.playTone(1480, 1960, 0.16, 'sine', 0.08, 0.055, 0.003);
        break;

      // Biome evolution: atmospheric dark-fantasy horn swell
      case 'biome':
        this.playNoise(0.42, 0.08, 'bandpass', 420, 1100, 1.0, 0, true, 0.08);
        this.playTone(220, 220, 0.22, 'triangle', 0.09, 0, 0.02, 950);
        this.playTone(329.63, 329.63, 0.24, 'triangle', 0.09, 0.12, 0.02, 1200);
        this.playTone(440, 659.25, 0.4, 'sine', 0.1, 0.24, 0.02);
        break;

      // Skill / forge levelup fanfare
      case 'levelup':
        this.playTone(440, 440, 0.11, 'triangle', 0.095, 0, 0.006);
        this.playTone(554.37, 554.37, 0.11, 'triangle', 0.095, 0.08, 0.006);
        this.playTone(659.25, 659.25, 0.14, 'triangle', 0.105, 0.16, 0.006);
        this.playTone(880, 880, 0.3, 'sine', 0.11, 0.24, 0.008);
        break;

      // Boss arrival: ominous war horn + deep timpani drum slam
      case 'boss':
        this.playTone(82, 42, 0.42, 'sine', 0.24, 0, 0.008);
        this.playNoise(0.32, 0.16, 'lowpass', 620, 140, 0.9, 0, true, 0.015);
        this.playTone(146.83, 138.59, 0.48, 'sawtooth', 0.095, 0.04, 0.04, 580);
        this.playTone(110, 98, 0.55, 'sawtooth', 0.095, 0.24, 0.04, 520);
        break;

      // Victory fanfare
      case 'victory':
        this.playTone(523.25, 523.25, 0.15, 'triangle', 0.1, 0, 0.008);
        this.playTone(659.25, 659.25, 0.15, 'triangle', 0.1, 0.12, 0.008);
        this.playTone(783.99, 783.99, 0.18, 'triangle', 0.11, 0.24, 0.008);
        this.playTone(1046.5, 1046.5, 0.42, 'sine', 0.12, 0.36, 0.01);
        break;

      // Defeat descending brass
      case 'gameover':
        this.playTone(293.66, 246.94, 0.25, 'sawtooth', 0.085, 0, 0.015, 760);
        this.playTone(220, 174.61, 0.3, 'sawtooth', 0.085, 0.2, 0.015, 640);
        this.playTone(146.83, 82.41, 0.5, 'triangle', 0.12, 0.42, 0.02, 520);
        break;
    }
  }
}

export const gameAudio = new GameAudioEngine();
