/**
 * Sound and Music Synthesizer for Nadezhi Match-3
 * Procedural Web Audio API sound effects and Fantasy Orchestral BGM (Shire / Hyrule style).
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  public masterVolume: number = 0.7;
  public sfxVolume: number = 0.8;
  public bgmVolume: number = 0.5;
  public isMuted: boolean = false;

  private masterGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private bgmGainNode: GainNode | null = null;

  // BGM playback state
  public isBgmPlaying: boolean = false;
  private bgmIntervalId: any = null;
  private currentMeasure: number = 0;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
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

        this.bgmGainNode = this.ctx.createGain();
        this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
        this.bgmGainNode.connect(this.masterGainNode);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (!this.isMuted && this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public userGesture() {
    this.initCtx();
    if (!this.isBgmPlaying) {
      this.startBGM();
    }
  }

  // ==========================================
  // FANTASY ORCHESTRAL BGM ENGINE (Shire / Hyrule style)
  // ==========================================

  public startBGM() {
    this.initCtx();
    if (!this.ctx || this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    this.currentMeasure = 0;

    // Tempo: 88 BPM, 4/4 time
    // 1 beat = 60 / 88 = 0.6818s, 1 measure = 4 beats = ~2.727s
    const measureDuration = (60 / 88) * 4;

    const scheduleNextMeasure = () => {
      if (!this.isBgmPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.playFantasyMeasure(now + 0.05, this.currentMeasure);
      this.currentMeasure = (this.currentMeasure + 1) % 16; // 16-measure loop
    };

    scheduleNextMeasure();
    this.bgmIntervalId = setInterval(scheduleNextMeasure, measureDuration * 1000);
  }

  public stopBGM() {
    this.isBgmPlaying = false;
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  /**
   * Generates a 4-beat measure of fantasy pastoral/epic overworld music.
   * Progression (D Major / G Lydian / B Minor fantasy modal):
   * Part A (Pastoral Shire):
   * M0: D (D - F# - A)
   * M1: G (G - B - D)
   * M2: A (A - C# - E)
   * M3: D (D - F# - A)
   * M4: Bm (B - D - F#)
   * M5: G (G - B - D)
   * M6: Em7 (E - G - B - D)
   * M7: Asus4 -> A (A - D - E -> A - C# - E)
   * Part B (Heroic Hyrule Field):
   * M8: Bm (B - D - F#)
   * M9: G (G - B - D)
   * M10: D/F# (F# - A - D)
   * M11: A (A - C# - E)
   * M12: G (G - B - D)
   * M13: Em (E - G - B)
   * M14: F#m7 (F# - A - C# - E)
   * M15: A7sus4 -> D (A - D - E - G -> D)
   */
  private playFantasyMeasure(startTime: number, measureIdx: number) {
    if (!this.ctx || !this.bgmGainNode) return;

    const beatDur = 60 / 88;

    // Chord definitions: [Bass, Triad Notes]
    const chords: { bass: number; notes: number[] }[] = [
      // 0: D
      { bass: 73.42, notes: [146.83, 220.0, 293.66, 369.99, 440.0] }, // D2, D3, A3, D4, F#4, A4
      // 1: G
      { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0, 493.88] }, // G2, G3, B3, D4, G4, B4
      // 2: A
      { bass: 110.0, notes: [220.0, 277.18, 329.63, 440.0, 554.37] }, // A2, A3, C#4, E4, A4, C#5
      // 3: D
      { bass: 73.42, notes: [146.83, 220.0, 293.66, 369.99, 440.0] },
      // 4: Bm
      { bass: 61.74, notes: [123.47, 185.0, 246.94, 293.66, 369.99] }, // B1, B2, F#3, B3, D4, F#4
      // 5: G
      { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0, 493.88] },
      // 6: Em7
      { bass: 82.41, notes: [164.81, 246.94, 293.66, 329.63, 392.0] }, // E2, E3, B3, D4, E4, G4
      // 7: Asus4 -> A
      { bass: 110.0, notes: [220.0, 293.66, 329.63, 440.0, 554.37] },
      // 8: Bm (Heroic section starts)
      { bass: 61.74, notes: [123.47, 185.0, 246.94, 293.66, 369.99] },
      // 9: G
      { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0, 493.88] },
      // 10: D/F#
      { bass: 92.5, notes: [185.0, 220.0, 293.66, 369.99, 440.0] },
      // 11: A
      { bass: 110.0, notes: [220.0, 277.18, 329.63, 440.0, 554.37] },
      // 12: G
      { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0, 493.88] },
      // 13: Em
      { bass: 82.41, notes: [164.81, 196.0, 246.94, 329.63, 392.0] },
      // 14: F#m7
      { bass: 92.5, notes: [185.0, 220.0, 277.18, 329.63, 369.99] },
      // 15: A -> D cadence
      { bass: 73.42, notes: [146.83, 220.0, 293.66, 369.99, 440.0] },
    ];

    const chord = chords[measureIdx];

    // 1. Warm Strings Pad (Sustained lush chords)
    this.playStringsPad(startTime, chord.notes.slice(1, 4), beatDur * 4);

    // 2. Celtic Harp / Acoustic Lute Arpeggios (Gentle rolling 8th notes)
    for (let beat = 0; beat < 4; beat++) {
      const t1 = startTime + beat * beatDur;
      const t2 = t1 + beatDur * 0.5;

      const n1 = chord.notes[beat % chord.notes.length];
      const n2 = chord.notes[(beat + 2) % chord.notes.length];

      this.playHarpNote(t1, n1, beatDur * 0.8, 0.08);
      this.playHarpNote(t2, n2, beatDur * 0.7, 0.06);
    }

    // 3. Pastoral Whistle / Flute Lead Melody (Shire & Hyrule motif)
    // Melody notes mapped per measure:
    const fluteMotifs: { beat: number; dur: number; freq: number }[][] = [
      // M0: D - E - F# - A
      [{ beat: 0, dur: 1.5, freq: 587.33 }, { beat: 1.5, dur: 0.5, freq: 659.25 }, { beat: 2, dur: 2.0, freq: 739.99 }],
      // M1: B - A - G - F#
      [{ beat: 0, dur: 1.5, freq: 987.77 }, { beat: 1.5, dur: 0.5, freq: 880.0 }, { beat: 2, dur: 1.0, freq: 783.99 }, { beat: 3, dur: 1.0, freq: 739.99 }],
      // M2: E - F# - G - A
      [{ beat: 0, dur: 2.0, freq: 659.25 }, { beat: 2, dur: 1.0, freq: 739.99 }, { beat: 3, dur: 1.0, freq: 880.0 }],
      // M3: F# ... D
      [{ beat: 0, dur: 2.5, freq: 739.99 }, { beat: 2.5, dur: 1.5, freq: 587.33 }],
      // M4: D - F# - B - C#
      [{ beat: 0, dur: 1.5, freq: 587.33 }, { beat: 1.5, dur: 0.5, freq: 739.99 }, { beat: 2, dur: 2.0, freq: 987.77 }],
      // M5: D5 - C#5 - B4 - A4
      [{ beat: 0, dur: 1.5, freq: 1174.66 }, { beat: 1.5, dur: 0.5, freq: 1108.73 }, { beat: 2, dur: 1.0, freq: 987.77 }, { beat: 3, dur: 1.0, freq: 880.0 }],
      // M6: G4 - B4 - D5
      [{ beat: 0, dur: 2.0, freq: 783.99 }, { beat: 2, dur: 2.0, freq: 1174.66 }],
      // M7: A4 ...
      [{ beat: 0, dur: 3.5, freq: 880.0 }],
      // M8: Heroic French Horn / Soaring Lead
      [{ beat: 0, dur: 1.0, freq: 493.88 }, { beat: 1, dur: 1.0, freq: 587.33 }, { beat: 2, dur: 2.0, freq: 739.99 }],
      // M9: G - A - B
      [{ beat: 0, dur: 1.5, freq: 783.99 }, { beat: 1.5, dur: 0.5, freq: 880.0 }, { beat: 2, dur: 2.0, freq: 987.77 }],
      // M10: A - F# - D
      [{ beat: 0, dur: 2.0, freq: 880.0 }, { beat: 2, dur: 2.0, freq: 587.33 }],
      // M11: E - F# - E
      [{ beat: 0, dur: 2.5, freq: 659.25 }, { beat: 2.5, dur: 1.5, freq: 739.99 }],
      // M12: G - B - D
      [{ beat: 0, dur: 1.5, freq: 783.99 }, { beat: 1.5, dur: 0.5, freq: 987.77 }, { beat: 2, dur: 2.0, freq: 1174.66 }],
      // M13: E5 - D5 - B4
      [{ beat: 0, dur: 1.5, freq: 1318.51 }, { beat: 1.5, dur: 0.5, freq: 1174.66 }, { beat: 2, dur: 2.0, freq: 987.77 }],
      // M14: C#5 - D5 - E5
      [{ beat: 0, dur: 1.5, freq: 1108.73 }, { beat: 1.5, dur: 0.5, freq: 1174.66 }, { beat: 2, dur: 2.0, freq: 1318.51 }],
      // M15: D5 resolve
      [{ beat: 0, dur: 4.0, freq: 1174.66 }],
    ];

    const motif = fluteMotifs[measureIdx];
    if (motif) {
      for (const note of motif) {
        const noteStart = startTime + note.beat * beatDur;
        const noteDur = note.dur * beatDur;
        this.playFantasyFlute(noteStart, note.freq, noteDur);
      }
    }
  }

  private playHarpNote(time: number, freq: number, duration: number, volume = 0.08) {
    if (!this.ctx || !this.bgmGainNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Harp: triangle oscillator with warm lowpass pluck
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + duration);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGainNode);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playStringsPad(time: number, freqs: number[], duration: number) {
    if (!this.ctx || !this.bgmGainNode) return;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, time);

    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.001, time);
    padGain.gain.linearRampToValueAtTime(0.06, time + 0.6); // Gentle swell
    padGain.gain.setValueAtTime(0.06, time + duration - 0.6);
    padGain.gain.linearRampToValueAtTime(0.001, time + duration);

    filter.connect(padGain);
    padGain.connect(this.bgmGainNode);

    freqs.forEach((freq) => {
      if (!this.ctx) return;
      // Pair of warm detuned oscillators for string ensemble warmth
      [-3, 3].forEach((detune) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.setValueAtTime(detune, time);
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + duration);
      });
    });
  }

  private playFantasyFlute(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.bgmGainNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Whistle/Flute: pure sine with soft breath overtone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    // Expressive vibrato LFO (5.2 Hz)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(5.2, time);
    lfoGain.gain.setValueAtTime(0, time);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.015, time + 0.3); // Vibrato develops over note
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(time);
    lfo.stop(time + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.09, time + 0.08); // Breath attack
    gain.gain.setValueAtTime(0.09, time + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGainNode);

    osc.start(time);
    osc.stop(time + duration);
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
    const semitones = Math.min(18, (cascade - 1) * 3);
    const freq = baseFreq * Math.pow(2, semitones / 12);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.14);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.18);
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
    filter.frequency.setValueAtTime(tier === 1 ? 400 : 250, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(tier === 1 ? 0.45 : 0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    noise.start(now);
    noise.stop(now + dur);

    // Sub-bass rumble
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(tier === 1 ? 120 : 90, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + dur);

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
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(time);
      osc.stop(time + 0.18);
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
