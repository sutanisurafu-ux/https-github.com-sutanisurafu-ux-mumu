// Rich multi-layered Web Audio procedural sound engine for MU Online ARPG feedback
class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayedAt = new Map<string, number>();
  public muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private canPlay(key: string, minIntervalMs: number): boolean {
    const now = Date.now();
    const prev = this.lastPlayedAt.get(key) ?? 0;
    if (now - prev < minIntervalMs) return false;
    this.lastPlayedAt.set(key, now);
    return true;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private pitchJitter(baseFreq: number, spread = 0.08): number {
    return baseFreq * (1 + (Math.random() * spread * 2 - spread));
  }

  private playTone(
    ctx: AudioContext,
    opts: {
      type: OscillatorType;
      startFreq: number;
      endFreq?: number;
      startTime: number;
      duration: number;
      peakGain: number;
      attack?: number;
      filterFreq?: number;
      filterType?: BiquadFilterType;
    }
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(20, opts.startFreq), opts.startTime);
    if (opts.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.endFreq),
        opts.startTime + opts.duration
      );
    }

    const attack = Math.min(opts.attack ?? 0.008, opts.duration * 0.35);
    gain.gain.setValueAtTime(0.0008, opts.startTime);
    gain.gain.linearRampToValueAtTime(opts.peakGain, opts.startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, opts.startTime + opts.duration);

    if (opts.filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType ?? 'lowpass';
      filter.frequency.setValueAtTime(opts.filterFreq, opts.startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);
    osc.start(opts.startTime);
    osc.stop(opts.startTime + opts.duration + 0.015);
  }

  private playNoiseBurst(
    ctx: AudioContext,
    opts: {
      startTime: number;
      duration: number;
      peakGain: number;
      filterType: BiquadFilterType;
      startFreq: number;
      endFreq?: number;
      q?: number;
    }
  ) {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.Q.setValueAtTime(opts.q ?? 1.4, opts.startTime);
    filter.frequency.setValueAtTime(opts.startFreq, opts.startTime);
    if (opts.endFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(60, opts.endFreq),
        opts.startTime + opts.duration
      );
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0008, opts.startTime);
    gain.gain.linearRampToValueAtTime(opts.peakGain, opts.startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, opts.startTime + opts.duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(opts.startTime);
    src.stop(opts.startTime + opts.duration + 0.02);
  }

  public playAttack(type: 'slash' | 'magic' | 'arrow' | 'heavy' | 'fist') {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay(`atk:${type}`, 45)) return;
    try {
      const now = ctx.currentTime;
      if (type === 'slash') {
        // Metallic blade swoosh + air cut
        this.playNoiseBurst(ctx, {
          startTime: now,
          duration: 0.11,
          peakGain: 0.085,
          filterType: 'bandpass',
          startFreq: this.pitchJitter(2400),
          endFreq: 620,
          q: 2.2,
        });
        this.playTone(ctx, {
          type: 'sawtooth',
          startFreq: this.pitchJitter(290),
          endFreq: 82,
          startTime: now,
          duration: 0.1,
          peakGain: 0.055,
          filterFreq: 1400,
        });
      } else if (type === 'fist') {
        // Quick martial punch thud + air snap
        this.playNoiseBurst(ctx, {
          startTime: now,
          duration: 0.075,
          peakGain: 0.07,
          filterType: 'bandpass',
          startFreq: this.pitchJitter(900),
          endFreq: 260,
          q: 1.5,
        });
        this.playTone(ctx, {
          type: 'triangle',
          startFreq: this.pitchJitter(170),
          endFreq: 55,
          startTime: now,
          duration: 0.08,
          peakGain: 0.075,
        });
      } else if (type === 'magic') {
        // Crystalline arcane cast harmonic + shimmer
        const f = this.pitchJitter(540);
        this.playTone(ctx, {
          type: 'sine',
          startFreq: f,
          endFreq: f * 0.42,
          startTime: now,
          duration: 0.19,
          peakGain: 0.07,
        });
        this.playTone(ctx, {
          type: 'triangle',
          startFreq: f * 1.5,
          endFreq: f * 1.95,
          startTime: now + 0.01,
          duration: 0.14,
          peakGain: 0.04,
        });
      } else if (type === 'arrow') {
        // Bowstring twang + whistling arrow release
        this.playTone(ctx, {
          type: 'triangle',
          startFreq: this.pitchJitter(410),
          endFreq: 145,
          startTime: now,
          duration: 0.075,
          peakGain: 0.06,
        });
        this.playNoiseBurst(ctx, {
          startTime: now + 0.015,
          duration: 0.085,
          peakGain: 0.065,
          filterType: 'highpass',
          startFreq: this.pitchJitter(3200),
          endFreq: 1100,
          q: 2.8,
        });
      } else {
        // Heavy cleave / slam
        this.playTone(ctx, {
          type: 'sawtooth',
          startFreq: this.pitchJitter(155),
          endFreq: 38,
          startTime: now,
          duration: 0.24,
          peakGain: 0.11,
          filterFreq: 750,
        });
        this.playNoiseBurst(ctx, {
          startTime: now,
          duration: 0.18,
          peakGain: 0.09,
          filterType: 'lowpass',
          startFreq: 1200,
          endFreq: 210,
        });
      }
    } catch {
      // ignore audio context errors
    }
  }

  public playSkillCast(pattern: string) {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay(`skill:${pattern}`, 65)) return;
    try {
      const now = ctx.currentTime;
      switch (pattern) {
        case 'whirlwind': {
          // Iconic DK Twisting Slash spinning blade vortex
          for (let i = 0; i < 3; i++) {
            const t = now + i * 0.065;
            this.playNoiseBurst(ctx, {
              startTime: t,
              duration: 0.11,
              peakGain: 0.085,
              filterType: 'bandpass',
              startFreq: 1600 + i * 450,
              endFreq: 520,
              q: 2.6,
            });
            this.playTone(ctx, {
              type: 'sawtooth',
              startFreq: this.pitchJitter(240 + i * 45),
              endFreq: 110,
              startTime: t,
              duration: 0.09,
              peakGain: 0.05,
              filterFreq: 1200,
            });
          }
          break;
        }
        case 'ice_arrow': {
          // Freezing crystalline frost shatter + high icy chimes
          this.playNoiseBurst(ctx, {
            startTime: now,
            duration: 0.16,
            peakGain: 0.07,
            filterType: 'highpass',
            startFreq: 4200,
            endFreq: 1800,
            q: 3.0,
          });
          [1174.66, 1567.98, 2093].forEach((freq, i) => {
            this.playTone(ctx, {
              type: 'sine',
              startFreq: this.pitchJitter(freq, 0.03),
              endFreq: freq * 0.94,
              startTime: now + i * 0.035,
              duration: 0.22,
              peakGain: 0.048,
            });
          });
          break;
        }
        case 'meteor_strike':
        case 'flame_burst': {
          // Fiery falling whistle -> deep volcanic explosion
          this.playTone(ctx, {
            type: 'sine',
            startFreq: 680,
            endFreq: 140,
            startTime: now,
            duration: 0.12,
            peakGain: 0.05,
          });
          this.playNoiseBurst(ctx, {
            startTime: now + 0.06,
            duration: 0.34,
            peakGain: 0.13,
            filterType: 'lowpass',
            startFreq: 1350,
            endFreq: 140,
          });
          this.playTone(ctx, {
            type: 'sawtooth',
            startFreq: 115,
            endFreq: 32,
            startTime: now + 0.06,
            duration: 0.32,
            peakGain: 0.11,
            filterFreq: 420,
          });
          break;
        }
        case 'dark_beam':
        case 'evil_spirits': {
          // Haunting MU Evil Spirits eerie spectral swirl
          [329.63, 392.0, 466.16, 622.25].forEach((freq, i) => {
            this.playTone(ctx, {
              type: 'triangle',
              startFreq: this.pitchJitter(freq, 0.04),
              endFreq: freq * 0.72,
              startTime: now + i * 0.04,
              duration: 0.24,
              peakGain: 0.055,
              filterFreq: 1500,
            });
          });
          break;
        }
        case 'triple_arrow': {
          // Rapid 3-arrow volley
          for (let i = 0; i < 3; i++) {
            const t = now + i * 0.045;
            this.playTone(ctx, {
              type: 'triangle',
              startFreq: this.pitchJitter(520 + i * 60),
              endFreq: 170,
              startTime: t,
              duration: 0.07,
              peakGain: 0.055,
            });
            this.playNoiseBurst(ctx, {
              startTime: t,
              duration: 0.07,
              peakGain: 0.05,
              filterType: 'highpass',
              startFreq: 3400,
              endFreq: 1500,
            });
          }
          break;
        }
        case 'guardian_buff': {
          // Warm emerald healing harp chord
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            this.playTone(ctx, {
              type: 'sine',
              startFreq: freq,
              startTime: now + i * 0.045,
              duration: 0.32,
              peakGain: 0.06,
            });
          });
          break;
        }
        case 'rageful_blow':
        case 'ground_slam': {
          // Earth-shattering shockwave slam
          this.playTone(ctx, {
            type: 'triangle',
            startFreq: 140,
            endFreq: 28,
            startTime: now,
            duration: 0.3,
            peakGain: 0.14,
          });
          this.playNoiseBurst(ctx, {
            startTime: now,
            duration: 0.26,
            peakGain: 0.11,
            filterType: 'lowpass',
            startFreq: 950,
            endFreq: 120,
          });
          break;
        }
        default: {
          // Versatile arcane/martial burst
          this.playAttack('magic');
          this.playNoiseBurst(ctx, {
            startTime: now,
            duration: 0.15,
            peakGain: 0.06,
            filterType: 'bandpass',
            startFreq: 1500,
            endFreq: 480,
          });
          break;
        }
      }
    } catch {}
  }

  public playComboBlast() {
    // Classic DK 3-skill Combo blue shockwave explosion!
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('combo', 150)) return;
    try {
      const now = ctx.currentTime;
      this.playTone(ctx, {
        type: 'sawtooth',
        startFreq: 180,
        endFreq: 36,
        startTime: now,
        duration: 0.42,
        peakGain: 0.13,
        filterFreq: 820,
      });
      this.playNoiseBurst(ctx, {
        startTime: now,
        duration: 0.36,
        peakGain: 0.12,
        filterType: 'bandpass',
        startFreq: 2400,
        endFreq: 260,
        q: 1.2,
      });
      [587.33, 880, 1174.66].forEach((freq, idx) => {
        this.playTone(ctx, {
          type: 'triangle',
          startFreq: freq,
          endFreq: freq * 1.12,
          startTime: now + idx * 0.035,
          duration: 0.28,
          peakGain: 0.065,
        });
      });
    } catch {}
  }

  public playHit(heavy = false, variant: 'normal' | 'crit' | 'double' = 'normal') {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay(`hit:${variant}`, 32)) return;
    try {
      const now = ctx.currentTime;
      if (variant === 'double') {
        // Twin crisp metallic strikes (Excellent Double Damage)
        for (let i = 0; i < 2; i++) {
          const t = now + i * 0.048;
          this.playTone(ctx, {
            type: 'triangle',
            startFreq: this.pitchJitter(420 + i * 160),
            endFreq: 110,
            startTime: t,
            duration: 0.095,
            peakGain: 0.085,
          });
          this.playTone(ctx, {
            type: 'sine',
            startFreq: 1320 + i * 330,
            startTime: t,
            duration: 0.11,
            peakGain: 0.045,
          });
        }
        return;
      }

      if (variant === 'crit') {
        // Sharp critical cleave + high steel ring
        this.playTone(ctx, {
          type: 'sawtooth',
          startFreq: this.pitchJitter(240),
          endFreq: 54,
          startTime: now,
          duration: 0.14,
          peakGain: 0.095,
          filterFreq: 1600,
        });
        this.playTone(ctx, {
          type: 'sine',
          startFreq: this.pitchJitter(1046.5, 0.05),
          endFreq: 880,
          startTime: now,
          duration: 0.15,
          peakGain: 0.055,
        });
        return;
      }

      // Standard or heavy meaty impact
      this.playTone(ctx, {
        type: heavy ? 'square' : 'triangle',
        startFreq: this.pitchJitter(heavy ? 138 : 205),
        endFreq: 42,
        startTime: now,
        duration: heavy ? 0.15 : 0.085,
        peakGain: heavy ? 0.1 : 0.058,
        filterFreq: heavy ? 850 : 1200,
      });
      if (heavy) {
        this.playNoiseBurst(ctx, {
          startTime: now,
          duration: 0.09,
          peakGain: 0.065,
          filterType: 'lowpass',
          startFreq: 900,
          endFreq: 180,
        });
      }
    } catch {}
  }

  public playEnemyDeath(isBoss = false) {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay(isBoss ? 'death:boss' : 'death:mob', isBoss ? 120 : 55)) return;
    try {
      const now = ctx.currentTime;
      if (isBoss) {
        // Epic Golden Boss collapse + victorious golden chord
        this.playTone(ctx, {
          type: 'sawtooth',
          startFreq: 130,
          endFreq: 28,
          startTime: now,
          duration: 0.55,
          peakGain: 0.13,
          filterFreq: 520,
        });
        this.playNoiseBurst(ctx, {
          startTime: now,
          duration: 0.45,
          peakGain: 0.11,
          filterType: 'lowpass',
          startFreq: 1400,
          endFreq: 120,
        });
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
          this.playTone(ctx, {
            type: 'triangle',
            startFreq: freq,
            startTime: now + 0.12 + idx * 0.06,
            duration: 0.4,
            peakGain: 0.075,
          });
        });
      } else {
        // Short bone rattle / spirit disperse
        this.playTone(ctx, {
          type: 'sawtooth',
          startFreq: this.pitchJitter(175),
          endFreq: 52,
          startTime: now,
          duration: 0.16,
          peakGain: 0.065,
          filterFreq: 680,
        });
        this.playNoiseBurst(ctx, {
          startTime: now + 0.02,
          duration: 0.12,
          peakGain: 0.055,
          filterType: 'bandpass',
          startFreq: 1100,
          endFreq: 320,
          q: 1.8,
        });
      }
    } catch {}
  }

  public playPlayerHurt() {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('player:hurt', 130)) return;
    try {
      const now = ctx.currentTime;
      this.playTone(ctx, {
        type: 'sawtooth',
        startFreq: this.pitchJitter(165),
        endFreq: 64,
        startTime: now,
        duration: 0.14,
        peakGain: 0.09,
        filterFreq: 640,
      });
      this.playNoiseBurst(ctx, {
        startTime: now,
        duration: 0.08,
        peakGain: 0.065,
        filterType: 'lowpass',
        startFreq: 750,
        endFreq: 200,
      });
    } catch {}
  }

  public playDash() {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('dash', 90)) return;
    try {
      const now = ctx.currentTime;
      this.playNoiseBurst(ctx, {
        startTime: now,
        duration: 0.16,
        peakGain: 0.085,
        filterType: 'bandpass',
        startFreq: 550,
        endFreq: 2600,
        q: 1.8,
      });
      this.playTone(ctx, {
        type: 'sine',
        startFreq: 260,
        endFreq: 620,
        startTime: now,
        duration: 0.13,
        peakGain: 0.045,
      });
    } catch {}
  }

  public playZenDrop() {
    // Soft metallic gold coin scatter
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('zen:drop', 70)) return;
    try {
      const now = ctx.currentTime;
      [2150, 2790].forEach((freq, i) => {
        this.playTone(ctx, {
          type: 'sine',
          startFreq: this.pitchJitter(freq, 0.05),
          startTime: now + i * 0.032,
          duration: 0.12,
          peakGain: 0.04,
        });
      });
    } catch {}
  }

  public playZenPickup() {
    // Crisp bright coin clink on pickup
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('zen:pickup', 55)) return;
    try {
      const now = ctx.currentTime;
      [1864.66, 2489.02].forEach((freq, i) => {
        this.playTone(ctx, {
          type: 'sine',
          startFreq: this.pitchJitter(freq, 0.03),
          startTime: now + i * 0.04,
          duration: 0.14,
          peakGain: 0.055,
        });
      });
    } catch {}
  }

  public playJewelDrop() {
    // Classic MU iconic high-pitched resonant crystalline "DING!" chime
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('jewel:drop', 85)) return;
    try {
      const now = ctx.currentTime;
      [1318.51, 1760, 2637.02, 3520].forEach((freq, idx) => {
        this.playTone(ctx, {
          type: idx % 2 === 0 ? 'sine' : 'triangle',
          startFreq: freq,
          startTime: now + idx * 0.042,
          duration: 0.42,
          peakGain: idx === 0 ? 0.095 : 0.068,
        });
      });
    } catch {}
  }

  public playEquipmentDrop(isRare = false) {
    // Metallic armor/weapon clatter on stone
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('eq:drop', 80)) return;
    try {
      const now = ctx.currentTime;
      this.playNoiseBurst(ctx, {
        startTime: now,
        duration: 0.12,
        peakGain: 0.065,
        filterType: 'bandpass',
        startFreq: 1900,
        endFreq: 750,
        q: 3.2,
      });
      const notes = isRare ? [880, 1174.66, 1567.98] : [660, 880];
      notes.forEach((freq, i) => {
        this.playTone(ctx, {
          type: 'triangle',
          startFreq: this.pitchJitter(freq, 0.03),
          startTime: now + i * 0.04,
          duration: isRare ? 0.28 : 0.16,
          peakGain: isRare ? 0.075 : 0.05,
        });
      });
    } catch {}
  }

  public playLootPickup() {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('loot:pickup', 50)) return;
    try {
      const now = ctx.currentTime;
      this.playTone(ctx, {
        type: 'triangle',
        startFreq: 520,
        endFreq: 880,
        startTime: now,
        duration: 0.1,
        peakGain: 0.06,
      });
    } catch {}
  }

  public playItemDrop() {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('item:drop', 70)) return;
    try {
      const now = ctx.currentTime;
      this.playTone(ctx, {
        type: 'triangle',
        startFreq: 380,
        endFreq: 165,
        startTime: now,
        duration: 0.11,
        peakGain: 0.065,
      });
    } catch {}
  }

  public playPotion(kind: 'hp' | 'mp') {
    // Glass gulp + sparkling elixir chime
    const ctx = this.getContext();
    if (!ctx || !this.canPlay(`potion:${kind}`, 120)) return;
    try {
      const now = ctx.currentTime;
      const base = kind === 'hp' ? 392 : 523.25;
      this.playTone(ctx, {
        type: 'sine',
        startFreq: base,
        endFreq: base * 1.45,
        startTime: now,
        duration: 0.12,
        peakGain: 0.07,
      });
      this.playTone(ctx, {
        type: 'sine',
        startFreq: base * 1.5,
        endFreq: base * 2.0,
        startTime: now + 0.065,
        duration: 0.16,
        peakGain: 0.055,
      });
    } catch {}
  }

  public playEquip(equipping = true) {
    // Crisp leather buckle + steel clasp snap
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('equip', 60)) return;
    try {
      const now = ctx.currentTime;
      this.playNoiseBurst(ctx, {
        startTime: now,
        duration: 0.06,
        peakGain: 0.055,
        filterType: 'bandpass',
        startFreq: equipping ? 2200 : 1200,
        endFreq: equipping ? 900 : 500,
        q: 2.5,
      });
      this.playTone(ctx, {
        type: 'triangle',
        startFreq: equipping ? 440 : 520,
        endFreq: equipping ? 740 : 280,
        startTime: now,
        duration: 0.11,
        peakGain: 0.065,
      });
    } catch {}
  }

  public playShopTrade() {
    // Blacksmith cash register / Zen pouch clink
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('shop:trade', 75)) return;
    try {
      const now = ctx.currentTime;
      [1396.91, 1760, 2349.32].forEach((freq, i) => {
        this.playTone(ctx, {
          type: 'sine',
          startFreq: freq,
          startTime: now + i * 0.045,
          duration: 0.18,
          peakGain: 0.06,
        });
      });
    } catch {}
  }

  public playStatUp() {
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('stat:up', 40)) return;
    try {
      const now = ctx.currentTime;
      this.playTone(ctx, {
        type: 'triangle',
        startFreq: 587.33,
        endFreq: 880,
        startTime: now,
        duration: 0.09,
        peakGain: 0.055,
      });
    } catch {}
  }

  public playChaosForge(success: boolean) {
    // Iconic Chaos Goblin anvil hammer -> triumph chord OR ominous fizzle
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('chaos:forge', 120)) return;
    try {
      const now = ctx.currentTime;
      if (success) {
        [523.25, 659.25, 783.99, 1046.5, 1567.98].forEach((freq, idx) => {
          this.playTone(ctx, {
            type: idx >= 3 ? 'sine' : 'triangle',
            startFreq: freq,
            startTime: now + idx * 0.055,
            duration: 0.42,
            peakGain: 0.085,
          });
        });
      } else {
        this.playTone(ctx, {
          type: 'sawtooth',
          startFreq: 260,
          endFreq: 85,
          startTime: now,
          duration: 0.34,
          peakGain: 0.09,
          filterFreq: 680,
        });
        this.playNoiseBurst(ctx, {
          startTime: now + 0.04,
          duration: 0.26,
          peakGain: 0.075,
          filterType: 'lowpass',
          startFreq: 900,
          endFreq: 180,
        });
      }
    } catch {}
  }

  public playTeleport() {
    // Shimmering arcane warp portal sweep
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('teleport', 150)) return;
    try {
      const now = ctx.currentTime;
      this.playTone(ctx, {
        type: 'sine',
        startFreq: 260,
        endFreq: 1240,
        startTime: now,
        duration: 0.32,
        peakGain: 0.075,
      });
      this.playTone(ctx, {
        type: 'triangle',
        startFreq: 520,
        endFreq: 1680,
        startTime: now + 0.05,
        duration: 0.28,
        peakGain: 0.05,
      });
      this.playNoiseBurst(ctx, {
        startTime: now,
        duration: 0.28,
        peakGain: 0.055,
        filterType: 'bandpass',
        startFreq: 600,
        endFreq: 3400,
        q: 2.0,
      });
    } catch {}
  }

  public playGoldenBossInvasion() {
    // Dramatic golden war-horn fanfare when a roaming Golden Boss invades the map!
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('golden:boss', 300)) return;
    try {
      const now = ctx.currentTime;
      const hornNotes = [
        { freq: 220, delay: 0, dur: 0.24 },
        { freq: 277.18, delay: 0.18, dur: 0.24 },
        { freq: 329.63, delay: 0.36, dur: 0.48 },
        { freq: 440, delay: 0.36, dur: 0.52 },
      ];
      for (const n of hornNotes) {
        this.playTone(ctx, {
          type: 'sawtooth',
          startFreq: n.freq,
          endFreq: n.freq * 1.01,
          startTime: now + n.delay,
          duration: n.dur,
          peakGain: 0.075,
          attack: 0.035,
          filterFreq: 1150,
        });
      }
    } catch {}
  }

  public playLevelUp() {
    // Grand MU Online ascending golden chord fanfare
    const ctx = this.getContext();
    if (!ctx || !this.canPlay('levelup', 140)) return;
    try {
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880, 1108.73].forEach((freq, idx) => {
        this.playTone(ctx, {
          type: idx >= 3 ? 'sine' : 'triangle',
          startFreq: freq,
          startTime: now + idx * 0.07,
          duration: 0.44,
          peakGain: idx === 4 ? 0.08 : 0.095,
        });
      });
    } catch {}
  }
}

export const soundEngine = new SoundEngine();
