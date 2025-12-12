// =================================================================================
// --- SOUND.JS - Sound Manager (Web Audio API) ---
// =================================================================================
// Contains the entire SoundManager using the Web Audio API.
// Exports SoundManager for use in other files.
// =================================================================================

export const SoundManager = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    fxGain: null,

    // Volume settings (0-1)
    masterVolume: 0.8,
    musicVolume: 0.7,
    fxVolume: 1.0,
    muted: false,

    init: function () {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Create gain nodes for volume control
            this.masterGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();
            this.fxGain = this.ctx.createGain();

            // Route: fx/music -> master -> destination
            this.fxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            // Apply initial volumes
            this.masterGain.gain.value = this.masterVolume;
            this.musicGain.gain.value = this.musicVolume;
            this.fxGain.gain.value = this.fxVolume;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Volume control methods
    setMasterVolume: function (vol) {
        this.masterVolume = Math.max(0, Math.min(1, vol));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
        }
    },

    setMusicVolume: function (vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.musicGain) {
            this.musicGain.gain.value = this.musicVolume;
        }
    },

    setFxVolume: function (vol) {
        this.fxVolume = Math.max(0, Math.min(1, vol));
        if (this.fxGain) {
            this.fxGain.gain.value = this.fxVolume;
        }
    },

    setMuted: function (muted) {
        this.muted = muted;
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : this.masterVolume;
        }
    },

    playTone: function (freq, type, duration, vol = 0.1) {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.fxGain); // Route through FX gain
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playBlip: function () {
        this.init();
        this.playTone(800, 'square', 0.1, 0.05);
    },

    playSelect: function () {
        this.init();
        this.playTone(400, 'sawtooth', 0.2, 0.1);
        setTimeout(() => this.playTone(600, 'sawtooth', 0.4, 0.1), 100);
    },

    playDoor: function () {
        this.init();
        if (this.muted) return;
        // Simple noise buffer for "creak" effect
        const bufferSize = this.ctx.sampleRate * 1.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        // Low pass filter to make it rumble
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.fxGain); // Route through FX gain
        noise.start();
    },

    playSuccess: function () {
        this.init();
        if (this.muted) return;
        // Major triad arpeggio
        const now = this.ctx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.3);
            osc.connect(gain);
            gain.connect(this.fxGain); // Route through FX gain
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    }
};
