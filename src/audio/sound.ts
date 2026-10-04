/**
 * Sound and Music Manager for Nadezhi Match-3
 * Real acoustic fantasy instrumental music and procedural sound effects.
 */

export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  file: string;
}

export const FANTASY_PLAYLIST: MusicTrack[] = [
  { id: 'folk_round', name: 'Fiesta en la Comarca', artist: 'Kevin MacLeod (Acoustic Folk)', file: '/fantasy_bgm.mp3' },
  { id: 'minstrel', name: 'Gremio de Juglares', artist: 'Kevin MacLeod (Lute & Flute)', file: '/music_minstrel.mp3' },
  { id: 'celtic', name: 'Brisas Celtas', artist: 'Kevin MacLeod (Celtic Guitars)', file: '/music_celtic.mp3' },
  { id: 'village', name: 'Posada del Dragón', artist: 'Kevin MacLeod (Village Consort)', file: '/music_village.mp3' },
];

class SoundManager {
  private ctx: AudioContext | null = null;
  public masterVolume: number = 0.7;
  public sfxVolume: number = 0.8;
  public bgmVolume: number = 0.55;
  public isMuted: boolean = false;
  public isBgmMuted: boolean = false;

  private masterGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private hasUserInteracted: boolean = false;

  // Real acoustic fantasy BGM audio element
  private bgmAudio: HTMLAudioElement | null = null;
  public isBgmPlaying: boolean = false;
  private currentTrackIndex: number = 0;

  constructor() {
    this.loadSettings();
    this.initAudioElement();
    this.setupLifecycleListeners();
  }

  private loadSettings() {
    try {
      const mVol = localStorage.getItem('nadezhi_master_vol');
      if (mVol !== null) this.masterVolume = parseFloat(mVol) || 0.7;
      const sVol = localStorage.getItem('nadezhi_sfx_vol');
      if (sVol !== null) this.sfxVolume = parseFloat(sVol) || 0.8;
      const bVol = localStorage.getItem('nadezhi_bgm_vol');
      if (bVol !== null) this.bgmVolume = parseFloat(bVol) || 0.55;
      const muted = localStorage.getItem('nadezhi_muted');
      if (muted !== null) this.isMuted = muted === 'true';
      const bgmMuted = localStorage.getItem('nadezhi_bgm_muted');
      if (bgmMuted !== null) this.isBgmMuted = bgmMuted === 'true';
    } catch {}
  }

  public get currentTrack(): MusicTrack {
    return FANTASY_PLAYLIST[this.currentTrackIndex];
  }

  public get playlist(): MusicTrack[] {
    return FANTASY_PLAYLIST;
  }

  private initAudioElement() {
    try {
      this.bgmAudio = new Audio(FANTASY_PLAYLIST[this.currentTrackIndex].file);
      this.bgmAudio.loop = false; // Continuously cycles through playlist!
      this.bgmAudio.preload = 'auto';

      this.bgmAudio.addEventListener('ended', () => {
        // Continuous playlist progression without sudden silence
        this.nextTrack();
      });

      this.bgmAudio.addEventListener('error', (e) => {
        console.warn('Audio playback error, recovering:', e);
        setTimeout(() => {
          if (this.isBgmPlaying && !this.isMuted && !this.isBgmMuted) {
            this.loadTrack(this.currentTrackIndex);
          }
        }, 1500);
      });

      this.updateBgmVolume();
    } catch {
      // Audio element fallback
    }
  }

  private setupLifecycleListeners() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.bgmAudio && !this.bgmAudio.paused) {
            this.bgmAudio.pause();
          }
          if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
          }
        } else {
          this.resumeAudioContextAndBgm();
        }
      });
      window.addEventListener('focus', () => {
        this.resumeAudioContextAndBgm();
      });
    }
  }

  public resumeAudioContextAndBgm() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.isBgmPlaying && !this.isMuted && !this.isBgmMuted && this.bgmAudio && this.bgmAudio.paused) {
      this.bgmAudio.play().catch(() => {});
    }
  }

  public nextTrack(): MusicTrack {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % FANTASY_PLAYLIST.length;
    this.loadTrack(this.currentTrackIndex);
    return this.currentTrack;
  }

  public prevTrack(): MusicTrack {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + FANTASY_PLAYLIST.length) % FANTASY_PLAYLIST.length;
    this.loadTrack(this.currentTrackIndex);
    return this.currentTrack;
  }

  public loadTrack(index: number) {
    this.currentTrackIndex = index % FANTASY_PLAYLIST.length;
    const track = FANTASY_PLAYLIST[this.currentTrackIndex];
    const wasPlaying = this.isBgmPlaying;
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.src = track.file;
      this.bgmAudio.load();
      this.updateBgmVolume();
      if (wasPlaying) {
        this.bgmAudio.play().then(() => {
          this.isBgmPlaying = true;
        }).catch(() => {});
      }
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Dynamics compressor to prevent digital clipping when many audio nodes fire simultaneously
        this.compressorNode = this.ctx.createDynamicsCompressor();
        this.compressorNode.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressorNode.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressorNode.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressorNode.release.setValueAtTime(0.25, this.ctx.currentTime);
        this.compressorNode.connect(this.ctx.destination);

        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGainNode.connect(this.compressorNode);

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGainNode.connect(this.masterGainNode);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private autoCleanup(source: AudioScheduledSourceNode, ...extraNodes: (AudioNode | null | undefined)[]) {
    source.onended = () => {
      try {
        source.disconnect();
        for (const node of extraNodes) {
          node?.disconnect();
        }
      } catch {}
    };
  }

  private updateBgmVolume() {
    if (this.bgmAudio) {
      const effectiveVol = (this.isMuted || this.isBgmMuted) ? 0 : this.masterVolume * this.bgmVolume;
      this.bgmAudio.volume = Math.max(0, Math.min(1, effectiveVol));
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (!this.isMuted && this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
    this.updateBgmVolume();
    try { localStorage.setItem('nadezhi_master_vol', String(this.masterVolume)); } catch {}
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
    try { localStorage.setItem('nadezhi_sfx_vol', String(this.sfxVolume)); } catch {}
  }

  public setBgmVolume(val: number) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    this.updateBgmVolume();
    try { localStorage.setItem('nadezhi_bgm_vol', String(this.bgmVolume)); } catch {}
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
    this.updateBgmVolume();
    try { localStorage.setItem('nadezhi_muted', String(this.isMuted)); } catch {}
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public setBgmMuted(muted: boolean) {
    this.isBgmMuted = muted;
    this.updateBgmVolume();
    if (this.isBgmMuted) {
      if (this.bgmAudio && !this.bgmAudio.paused) {
        this.bgmAudio.pause();
      }
    } else {
      if (this.isBgmPlaying && this.bgmAudio && this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => {});
      }
    }
    try { localStorage.setItem('nadezhi_bgm_muted', String(this.isBgmMuted)); } catch {}
  }

  public toggleBgmMute(): boolean {
    this.setBgmMuted(!this.isBgmMuted);
    return this.isBgmMuted;
  }

  public userGesture() {
    this.hasUserInteracted = true;
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
    this.autoCleanup(osc, gain);
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
    this.autoCleanup(osc, gain);
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
    this.autoCleanup(osc, gain);
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
    this.autoCleanup(osc, filter, gain);
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
    this.autoCleanup(noise, filter, gain);

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
    this.autoCleanup(sub, subGain);
  }

  public playChainSpark() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.1);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.1);
    this.autoCleanup(osc, gain);
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
      this.autoCleanup(osc, gain);
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
    this.autoCleanup(osc, gain);
  }

  public playBoardFill() {
    if (!this.hasUserInteracted) return;
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25, 783.99];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.055;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.14, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.18);
      this.autoCleanup(osc, gain);
    });
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
      this.autoCleanup(osc, gain);
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
      this.autoCleanup(osc, gain);
    });
  }

  /**
   * Cartoonish, punchy "Pop!" sound for dramatic gem bursts.
   */
  public playPopSound(pitchMult = 1.0) {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Snappy pitch drop from high to punchy low bubble pop
    osc.type = 'sine';
    const startFreq = 720 * pitchMult;
    const endFreq = 160 * pitchMult;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.09);
    this.autoCleanup(osc, gain);

    // Punchy snap click
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1200 * pitchMult, now);
    clickOsc.frequency.exponentialRampToValueAtTime(300, now + 0.025);
    clickGain.gain.setValueAtTime(0.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    clickOsc.connect(clickGain);
    clickGain.connect(this.sfxGainNode);
    clickOsc.start(now);
    clickOsc.stop(now + 0.025);
    this.autoCleanup(clickOsc, clickGain);
  }

  /**
   * Powerful fiery cross-blast sound for Bomb + Bomb Bomberman fusion.
   */
  public playCrossBlast() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;

    // 1. Deep rumble sub-bass
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.5);
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGainNode);
    subOsc.start(now);
    subOsc.stop(now + 0.55);
    this.autoCleanup(subOsc, subGain);

    // 2. High-energy laser/flame rushing whoosh
    const laserOsc = this.ctx.createOscillator();
    const laserGain = this.ctx.createGain();
    laserOsc.type = 'sawtooth';
    laserOsc.frequency.setValueAtTime(650, now);
    laserOsc.frequency.exponentialRampToValueAtTime(120, now + 0.4);
    laserGain.gain.setValueAtTime(0.35, now);
    laserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    laserOsc.connect(laserGain);
    laserGain.connect(this.sfxGainNode);
    laserOsc.start(now);
    laserOsc.stop(now + 0.45);
    this.autoCleanup(laserOsc, laserGain);
  }

  /**
   * Triumphant arcade combo chime chord (Killer Instinct style).
   */
  public playComboChime(tier: number) {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    let notes: number[] = [];

    switch (tier) {
      case 1: // Good combo: C5, E5, G5
        notes = [523.25, 659.25, 783.99];
        break;
      case 2: // Super combo: E5, G5, B5, E6
        notes = [659.25, 783.99, 987.77, 1318.51];
        break;
      case 3: // Mega combo: C5, G5, C6, E6, G6
        notes = [523.25, 783.99, 1046.50, 1318.51, 1567.98];
        break;
      case 4: // Ultra combo: D5, F#5, A5, D6, F#6, A6
        notes = [587.33, 739.99, 880.00, 1174.66, 1479.98, 1760.00];
        break;
      default: // Monster combo: C5, E5, G5, C6, E6, G6, C7
        notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
        break;
    }

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.05;

      osc.type = tier >= 4 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.24, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.35);
      this.autoCleanup(osc, gain);
    });
  }

  /**
   * Deep cosmic gravitational vortex hum with accelerating frequency and warble.
   */
  public playBlackHoleHum() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const duration = 1.6;

    // Sub-bass rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(45, now);
    subOsc.frequency.exponentialRampToValueAtTime(140, now + duration);

    // Low-pass filter for dark gravitational feel
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + duration);
    filter.Q.setValueAtTime(6, now);

    subGain.gain.setValueAtTime(0.05, now);
    subGain.gain.linearRampToValueAtTime(0.4, now + duration * 0.8);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    subOsc.connect(filter);
    filter.connect(subGain);
    subGain.connect(this.sfxGainNode);

    subOsc.start(now);
    subOsc.stop(now + duration);
    this.autoCleanup(subOsc, filter, subGain);

    // Ethereal choir-like high shimmer vortex
    const choirOsc = this.ctx.createOscillator();
    const choirGain = this.ctx.createGain();
    choirOsc.type = 'sine';
    choirOsc.frequency.setValueAtTime(440, now);
    choirOsc.frequency.exponentialRampToValueAtTime(1320, now + duration);

    choirGain.gain.setValueAtTime(0.01, now);
    choirGain.gain.linearRampToValueAtTime(0.2, now + duration * 0.85);
    choirGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    choirOsc.connect(choirGain);
    choirGain.connect(this.sfxGainNode);

    choirOsc.start(now);
    choirOsc.stop(now + duration);
    this.autoCleanup(choirOsc, choirGain);
  }

  /**
   * Colossal supernova explosion that shatters the singularity.
   */
  public playSupernovaExplosion() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;

    // 1. Deep seismic boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.9);

    subGain.gain.setValueAtTime(0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGainNode);
    subOsc.start(now);
    subOsc.stop(now + 0.95);
    this.autoCleanup(subOsc, subGain);

    // 2. Cosmic noise blast with bandpass sweep
    const bufferSize = this.ctx.sampleRate * 1.2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGainNode);

    whiteNoise.start(now);
    whiteNoise.stop(now + 1.2);
    this.autoCleanup(whiteNoise, filter, noiseGain);

    // 3. Crystalline celestial chime bell
    const bellOsc = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(1760, now + 0.05); // A6 chime
    bellGain.gain.setValueAtTime(0.3, now + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    bellOsc.connect(bellGain);
    bellGain.connect(this.sfxGainNode);
    bellOsc.start(now + 0.05);
    bellOsc.stop(now + 1.1);
    this.autoCleanup(bellOsc, bellGain);
  }

  /**
   * Royal celebratory fanfare for Board Clear (Tablero Limpio).
   * Ascending orchestral brass arpeggio (C5, E5, G5, C6, E6, G6, C7)
   * followed by crystalline celestial bells and shimmering chord.
   */
  public playBoardClearFanfare() {
    this.userGesture();
    if (this.isMuted || !this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];

    // Ascending brass fanfares
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.055;

      osc.type = idx >= 4 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.28, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.45);
      this.autoCleanup(osc, gain);
    });

    // Sustained celestial chord at the climax
    const chordNotes = [1046.5, 1318.51, 1567.98, 2093.0];
    chordNotes.forEach((freq) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + 0.42;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.85);
      this.autoCleanup(osc, gain);
    });
  }
}

export const sound = new SoundManager();
