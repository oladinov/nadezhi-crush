/**
 * Sound and Music Manager for Nadezhi Match-3
 * Real acoustic fantasy instrumental music and procedural sound effects.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  public masterVolume: number = 0.7;
  public sfxVolume: number = 0.8;
  public bgmVolume: number = 0.55;
  public isMuted: boolean = false;

  private masterGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;

  // Real acoustic fantasy BGM audio element
  private bgmAudio: HTMLAudioElement | null = null;
  public isBgmPlaying: boolean = false;

  constructor() {
    this.initAudioElement();
  }

  private initAudioElement() {
    try {
      this.bgmAudio = new Audio('/fantasy_bgm.mp3');
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
      this.updateBgmVolume();
    } catch {
      // Audio element fallback
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGainNode.connect(this.ctx.destination);

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGainNode.connect(this.masterGainNode);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private updateBgmVolume() {
    if (this.bgmAudio) {
      const effectiveVol = this.isMuted ? 0 : this.masterVolume * this.bgmVolume;
      this.bgmAudio.volume = Math.max(0, Math.min(1, effectiveVol));
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (!this.isMuted && this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
    this.updateBgmVolume();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
    this.updateBgmVolume();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public userGesture() {
    this.initCtx();
    if (!this.isBgmPlaying && this.bgmAudio) {
      this.startBGM();
    }
  }

  public startBGM() {
    if (!this.bgmAudio) {
      this.initAudioElement();
    }
    if (this.bgmAudio) {
      this.updateBgmVolume();
      this.bgmAudio.play()
        .then(() => {
          this.isBgmPlaying = true;
        })
        .catch(() => {
          // Will retry on next interaction
        });
    }
  }

  public stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.isBgmPlaying = false;
    }
  }

  // ==========================================
  // SOUND EFFECTS (SFX)
  // ==========================================

  public playSwap() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playInvalidSwap() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMatch(cascade: number = 1) {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const baseFreq = 330;
    const semitones = Math.min(16, (cascade - 1) * 2.5);
    const freq = baseFreq * Math.pow(2, semitones / 12);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.14);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Bomb ignition cue: telegraphs that a bomb has been activated and is about to detonate!
   */
  public playBombIgnite() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.22);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.linearRampToValueAtTime(1400, now + 0.22);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playBombExplosion(tier: 1 | 2 = 1) {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const dur = tier === 1 ? 0.35 : 0.55;

    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(tier === 1 ? 420 : 260, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(tier === 1 ? 0.45 : 0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    noise.start(now);
    noise.stop(now + dur);

    // Sub-bass impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(tier === 1 ? 120 : 85, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + dur);

    subGain.gain.setValueAtTime(0.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    sub.connect(subGain);
    subGain.connect(this.sfxGainNode);

    sub.start(now);
    sub.stop(now + dur);
  }

  public playRainbowBeam() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.045;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.22);
    });
  }

  public playSpawnSpecial() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playWin() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.4);
    });
  }

  public playDefeat() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const notes = [440, 415.3, 392, 349.23];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.14;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.22);
    });
  }
}

export const sound = new SoundManager();
