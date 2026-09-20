/**
 * Procedural audio.
 *
 * Every cue is synthesised at runtime from oscillators and filtered noise —
 * there are no sample files in the repository, so nothing here can be
 * anyone else's audio. Swapping in recorded assets later means implementing
 * `play` against a sample bank; nothing else in the game calls Web Audio.
 */

export type SoundId =
  | 'shot'
  | 'shotLight'
  | 'sniper'
  | 'rail'
  | 'spikeRing'
  | 'flame'
  | 'tesla'
  | 'broadcast'
  | 'frost'
  | 'mortar'
  | 'explosion'
  | 'dinoDown'
  | 'bossDown'
  | 'bossRoar'
  | 'objectiveHit'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'error'
  | 'uiClick'
  | 'uiHover'
  | 'waveStart'
  | 'heroAbility'
  | 'reward'
  | 'victory'
  | 'defeat';

export interface PlayOptions {
  volume?: number;
  rate?: number;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

type Ctx = AudioContext;

const MAX_CONCURRENT = 22;

export class AudioManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private playing = 0;
  private lastPlayedAt = new Map<SoundId, number>();

  private settings: AudioSettings = {
    masterVolume: 0.75,
    musicVolume: 0.45,
    sfxVolume: 0.8,
    muted: false,
  };

  /** Must be called from a user gesture; browsers block audio otherwise. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(ctx.destination);
      this.applyVolumes();
      this.noiseBuffer = this.buildNoise(ctx);
    } catch {
      this.ctx = null;
    }
  }

  get isReady(): boolean {
    return this.ctx !== null;
  }

  setSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.master || !this.sfxBus || !this.musicBus) return;
    const m = this.settings.muted ? 0 : this.settings.masterVolume;
    this.master.gain.value = m;
    this.sfxBus.gain.value = this.settings.sfxVolume;
    this.musicBus.gain.value = this.settings.musicVolume * 0.4;
  }

  private buildNoise(ctx: Ctx): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /* ---- Building blocks --------------------------------------------- */

  private tone(
    type: OscillatorType,
    freq: number,
    endFreq: number,
    duration: number,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(
    duration: number,
    gain: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.noiseBuffer) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + duration);
    filter.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  /* ---- Cues --------------------------------------------------------- */

  play(id: SoundId, options: PlayOptions = {}): void {
    if (!this.ctx || this.settings.muted) return;
    if (this.playing > MAX_CONCURRENT) return;

    // Rate-limit the noisiest cues so a big wave stays listenable.
    const now = performance.now();
    const gap = id === 'shotLight' || id === 'flame' ? 55 : id === 'shot' ? 32 : id === 'broadcast' ? 90 : 0;
    if (gap > 0) {
      const last = this.lastPlayedAt.get(id) ?? 0;
      if (now - last < gap) return;
      this.lastPlayedAt.set(id, now);
    }

    const v = options.volume ?? 0.5;
    const r = options.rate ?? 1;
    this.playing++;
    window.setTimeout(() => {
      this.playing = Math.max(0, this.playing - 1);
    }, 220);

    switch (id) {
      case 'shot':
        this.noise(0.07, 0.22 * v, 'highpass', 1400 * r, 500 * r);
        this.tone('square', 320 * r, 110 * r, 0.06, 0.1 * v);
        break;
      case 'shotLight':
        this.noise(0.045, 0.13 * v, 'highpass', 2400 * r, 900 * r);
        break;
      case 'sniper':
        this.noise(0.22, 0.4 * v, 'lowpass', 3200, 320);
        this.tone('sawtooth', 180, 44, 0.24, 0.16 * v);
        break;
      case 'rail':
        this.tone('sawtooth', 1400, 120, 0.28, 0.2 * v);
        this.tone('sine', 90, 40, 0.34, 0.24 * v);
        this.noise(0.2, 0.24 * v, 'bandpass', 2600, 600);
        break;
      case 'spikeRing':
        this.noise(0.13, 0.24 * v, 'bandpass', 2600, 1100);
        this.tone('triangle', 620, 210, 0.11, 0.11 * v);
        break;
      case 'flame':
        this.noise(0.18, 0.16 * v, 'bandpass', 780, 420);
        break;
      case 'tesla':
        this.noise(0.12, 0.2 * v, 'highpass', 3400, 1600);
        this.tone('square', 1500, 420, 0.1, 0.09 * v);
        this.tone('square', 2100, 640, 0.07, 0.06 * v, 0.03);
        break;
      case 'broadcast':
        // Three stacked chirps, one per arc layer, over a short carrier sweep.
        [880, 1240, 1660].forEach((f, i) =>
          this.tone('sine', f, f * 1.9, 0.12, (0.08 - i * 0.018) * v, i * 0.035),
        );
        this.tone('sawtooth', 300, 120, 0.16, 0.07 * v);
        this.noise(0.14, 0.1 * v, 'bandpass', 3000, 1200);
        break;
      case 'frost':
        this.noise(0.24, 0.16 * v, 'highpass', 5200, 2000);
        this.tone('sine', 1200, 480, 0.22, 0.07 * v);
        break;
      case 'mortar':
        this.tone('sine', 240, 70, 0.16, 0.2 * v);
        this.noise(0.12, 0.16 * v, 'lowpass', 900, 200);
        break;
      case 'explosion':
        this.noise(0.42, 0.5 * v, 'lowpass', 1800, 90);
        this.tone('sine', 120, 32, 0.44, 0.36 * v);
        break;
      case 'dinoDown':
        this.tone('sawtooth', 300 * r, 90 * r, 0.2, 0.12 * v);
        this.noise(0.16, 0.1 * v, 'lowpass', 900, 260);
        break;
      case 'bossDown':
        this.tone('sawtooth', 210, 44, 0.9, 0.3 * v);
        this.tone('sine', 84, 30, 1.1, 0.28 * v);
        this.noise(0.7, 0.3 * v, 'lowpass', 1200, 90);
        break;
      case 'bossRoar':
        this.tone('sawtooth', 130, 62, 1.3, 0.34 * v);
        this.tone('square', 68, 40, 1.5, 0.22 * v);
        this.noise(1.1, 0.22 * v, 'bandpass', 620, 190);
        break;
      case 'objectiveHit':
        this.tone('square', 180, 62, 0.34, 0.24 * v);
        this.noise(0.28, 0.24 * v, 'lowpass', 1400, 180);
        break;
      case 'place':
        this.tone('triangle', 480, 720, 0.1, 0.16 * v);
        this.tone('sine', 720, 900, 0.09, 0.12 * v, 0.06);
        this.noise(0.09, 0.1 * v, 'lowpass', 1200, 400);
        break;
      case 'upgrade':
        this.tone('triangle', 520, 780, 0.1, 0.15 * v);
        this.tone('triangle', 780, 1180, 0.12, 0.14 * v, 0.07);
        this.tone('sine', 1180, 1560, 0.14, 0.12 * v, 0.15);
        break;
      case 'sell':
        this.tone('triangle', 620, 300, 0.14, 0.14 * v);
        break;
      case 'error':
        this.tone('square', 190, 130, 0.14, 0.15 * v);
        break;
      case 'uiClick':
        this.tone('triangle', 900, 1200, 0.045, 0.12 * v);
        break;
      case 'uiHover':
        this.tone('sine', 1400, 1650, 0.03, 0.05 * v);
        break;
      case 'waveStart':
        this.tone('sawtooth', 220, 330, 0.32, 0.16 * v);
        this.tone('sawtooth', 330, 440, 0.3, 0.13 * v, 0.16);
        this.noise(0.4, 0.1 * v, 'bandpass', 700, 320);
        break;
      case 'heroAbility':
        this.tone('sawtooth', 140, 620, 0.3, 0.2 * v);
        this.tone('square', 620, 180, 0.3, 0.14 * v, 0.12);
        this.noise(0.34, 0.24 * v, 'bandpass', 1600, 400);
        break;
      case 'reward':
        [660, 880, 1100, 1320].forEach((f, i) => this.tone('triangle', f, f * 1.02, 0.16, 0.13 * v, i * 0.09));
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.16 * v, i * 0.14));
        break;
      case 'defeat':
        [392, 349, 294, 233].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.55, 0.14 * v, i * 0.19));
        break;
    }
  }

  /* ---- Music -------------------------------------------------------- */

  /** Sparse original pad: a low drone with occasional pentatonic figures. */
  startMusic(mood: 'menu' | 'battle' = 'menu'): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const root = mood === 'battle' ? 73.42 : 98; // D2 / G2
    const scale = mood === 'battle' ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    this.musicStep = 0;

    const tick = () => {
      const ctx = this.ctx;
      const bus = this.musicBus;
      if (!ctx || !bus) return;
      const t = ctx.currentTime;
      const step = this.musicStep++;

      // Drone, refreshed each bar.
      if (step % 8 === 0) {
        for (const mult of [1, 1.5, 2]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 620;
          osc.type = 'sawtooth';
          osc.frequency.value = root * mult;
          osc.detune.value = (Math.random() - 0.5) * 12;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.05 / mult, t + 1.6);
          g.gain.linearRampToValueAtTime(0.0001, t + 7.6);
          osc.connect(f);
          f.connect(g);
          g.connect(bus);
          osc.start(t);
          osc.stop(t + 7.8);
        }
      }

      // Sparse melodic figure.
      if (step % 2 === 0 && Math.random() < 0.6) {
        const note = scale[Math.floor(Math.random() * scale.length)];
        const freq = root * 4 * Math.pow(2, note / 12);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.035, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        osc.connect(g);
        g.connect(bus);
        osc.start(t);
        osc.stop(t + 1.5);
      }

      // Heartbeat pulse in battle.
      if (mood === 'battle' && step % 4 === 0 && this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 160;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.09, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        src.connect(f);
        f.connect(g);
        g.connect(bus);
        src.start(t);
        src.stop(t + 0.32);
      }
    };

    tick();
    this.musicTimer = window.setInterval(tick, 1000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  destroy(): void {
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}

/** Shared instance — the UI and the scene both need the same output bus. */
export const audioManager = new AudioManager();
