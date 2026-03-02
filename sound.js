// ========== SOUND.JS ==========
// Звуковий рушій гри (Web Audio API). Підключається перед game.js.
//
// ВИПРАВЛЕННЯ:
//   AudioContext тепер створюється тільки після першої взаємодії користувача
//   (click / touchstart). Браузери блокують автозапуск аудіо — цей патч
//   вирішує проблему мовчання при першому відкритті гри.

const SoundEngine = {
    ctx: null,
    muted: localStorage.getItem('soundMuted') === 'true',
    volume: parseFloat(localStorage.getItem('soundVolume')) || 0.3,

    // ========== ІНІЦІАЛІЗАЦІЯ ==========
    // Не викликаємо в конструкторі — тільки після кліку користувача.

    _unlocked: false,

    _onFirstInteraction() {
        if (SoundEngine._unlocked) return;
        SoundEngine._unlocked = true;
        try {
            if (!SoundEngine.ctx) {
                SoundEngine.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            // Якщо контекст був suspended — розблоковуємо
            if (SoundEngine.ctx.state === 'suspended') {
                SoundEngine.ctx.resume();
            }
        } catch (e) {
            console.warn('[SoundEngine] AudioContext init failed:', e);
        }
        // Після першого розблокування прибираємо слухачів
        document.removeEventListener('click',      SoundEngine._onFirstInteraction);
        document.removeEventListener('touchstart', SoundEngine._onFirstInteraction);
        if (window.DEBUG) console.log('[SoundEngine] AudioContext unlocked');
    },

    init() {
        // ⚠️ Не створюємо AudioContext до першої взаємодії користувача —
        // браузер або заблокує його (Chrome), або кине NotAllowedError (Safari).
        // _onFirstInteraction() є єдиним місцем де ctx створюється.
        if (!this._unlocked) return null;

        // Контекст вже є — переконуємось що не suspended
        if (this.ctx) {
            if (this.ctx.state === 'closed') return null;
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return this.ctx;
        }

        // _unlocked = true, але ctx ще немає (малоймовірно, але захист)
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('[SoundEngine] AudioContext create failed:', e);
            return null;
        }
        return this.ctx;
    },

    play(name) {
        if (this.muted) return;
        const ctx = this.init();
        if (!ctx) return; // AudioContext ще не дозволено браузером
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => this._playSound(name));
            return;
        }
        this._playSound(name);
    },

    _playSound(name) {
        const ctx = this.ctx;
        if (!ctx) return;
        try {
            const t = ctx.currentTime;
            const g = ctx.createGain();
            g.gain.value = this.volume;
            g.connect(ctx.destination);

            switch (name) {
                case 'cardPlay': {
                    const o = ctx.createOscillator(); o.type = 'sine';
                    o.frequency.setValueAtTime(400, t); o.frequency.linearRampToValueAtTime(800, t + 0.1);
                    o.connect(g); g.gain.linearRampToValueAtTime(0, t + 0.15); o.start(t); o.stop(t + 0.15); break;
                }
                case 'attack': {
                    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
                    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(g);
                    g.gain.linearRampToValueAtTime(0, t + 0.15); s.start(t); break;
                }
                case 'damage': {
                    const o = ctx.createOscillator(); o.type = 'sawtooth';
                    o.frequency.setValueAtTime(200, t); o.frequency.linearRampToValueAtTime(80, t + 0.2);
                    o.connect(g); g.gain.linearRampToValueAtTime(0, t + 0.2); o.start(t); o.stop(t + 0.2); break;
                }
                case 'heal': {
                    const o = ctx.createOscillator(); o.type = 'sine';
                    o.frequency.setValueAtTime(500, t); o.frequency.linearRampToValueAtTime(900, t + 0.15);
                    o.connect(g); g.gain.setValueAtTime(this.volume * 0.5, t);
                    g.gain.linearRampToValueAtTime(0, t + 0.3); o.start(t); o.stop(t + 0.3); break;
                }
                case 'victory': {
                    [523, 659, 784, 1047].forEach((f, i) => {
                        const o = ctx.createOscillator(); const gn = ctx.createGain();
                        o.type = 'sine'; o.frequency.value = f;
                        gn.gain.setValueAtTime(this.volume * 0.4, t + i * 0.15);
                        gn.gain.linearRampToValueAtTime(0, t + i * 0.15 + 0.3);
                        o.connect(gn); gn.connect(ctx.destination);
                        o.start(t + i * 0.15); o.stop(t + i * 0.15 + 0.3);
                    }); break;
                }
                case 'defeat': {
                    [400, 350, 300, 200].forEach((f, i) => {
                        const o = ctx.createOscillator(); const gn = ctx.createGain();
                        o.type = 'sawtooth'; o.frequency.value = f;
                        gn.gain.setValueAtTime(this.volume * 0.3, t + i * 0.2);
                        gn.gain.linearRampToValueAtTime(0, t + i * 0.2 + 0.3);
                        o.connect(gn); gn.connect(ctx.destination);
                        o.start(t + i * 0.2); o.stop(t + i * 0.2 + 0.3);
                    }); break;
                }
                case 'manaSpend': {
                    const o = ctx.createOscillator(); o.type = 'triangle';
                    o.frequency.setValueAtTime(1200, t); o.frequency.linearRampToValueAtTime(600, t + 0.1);
                    o.connect(g); g.gain.setValueAtTime(this.volume * 0.2, t);
                    g.gain.linearRampToValueAtTime(0, t + 0.12); o.start(t); o.stop(t + 0.12); break;
                }
                case 'tick': {
                    // Короткий метрономний клік для таймера ходу (відрізняється від 'click' кнопки)
                    const o = ctx.createOscillator(); o.type = 'square';
                    o.frequency.setValueAtTime(880, t);
                    o.connect(g);
                    g.gain.setValueAtTime(this.volume * 0.12, t);
                    g.gain.linearRampToValueAtTime(0, t + 0.04);
                    o.start(t); o.stop(t + 0.04); break;
                }
                case 'click': {
                    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1000;
                    o.connect(g); g.gain.setValueAtTime(this.volume * 0.15, t);
                    g.gain.linearRampToValueAtTime(0, t + 0.05); o.start(t); o.stop(t + 0.05); break;
                }
                case 'packOpen': {
                    [600, 700, 800, 900, 1100].forEach((f, i) => {
                        const o = ctx.createOscillator(); const gn = ctx.createGain();
                        o.type = 'sine'; o.frequency.value = f;
                        gn.gain.setValueAtTime(this.volume * 0.3, t + i * 0.08);
                        gn.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.2);
                        o.connect(gn); gn.connect(ctx.destination);
                        o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.2);
                    }); break;
                }
            }
        } catch (e) {
            console.warn('[SoundEngine] playSound error:', e);
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('soundMuted', this.muted);
        const btn = document.getElementById('sound-toggle');
        if (btn) btn.textContent = this.muted ? '🔇' : '🔊';
    }
};

window.SoundEngine = SoundEngine;

// ========== ПІДПИСКА НА ПЕРШУ ВЗАЄМОДІЮ ==========
// Браузер вимагає взаємодії перед AudioContext.
// once:true — автоматично знімає слухач після першого спрацювання.
document.addEventListener('click',      SoundEngine._onFirstInteraction, { once: true, passive: true });
document.addEventListener('touchstart', SoundEngine._onFirstInteraction, { once: true, passive: true });
