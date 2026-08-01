export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.initialized = false;

        // Motor sound nodes
        this.osc1 = null;
        this.osc2 = null;
        this.gainNode = null;
        this.filterNode = null;
    }

    init() {
        if (this.initialized) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Master Gain
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = 0.15;

            // Low-pass Filter for Propeller Hum
            this.filterNode = this.ctx.createBiquadFilter();
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.value = 400;

            // Motor Oscillators (Sawtooth for motor drone)
            this.osc1 = this.ctx.createOscillator();
            this.osc1.type = 'sawtooth';
            this.osc1.frequency.value = 120; // Hz base

            this.osc2 = this.ctx.createOscillator();
            this.osc2.type = 'triangle';
            this.osc2.frequency.value = 240;

            this.osc1.connect(this.filterNode);
            this.osc2.connect(this.filterNode);
            this.filterNode.connect(this.gainNode);
            this.gainNode.connect(this.ctx.destination);

            this.osc1.start();
            this.osc2.start();

            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported:", e);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.gainNode) {
            this.gainNode.gain.value = this.isMuted ? 0 : 0.15;
        }
        return this.isMuted;
    }

    updateMotorSound(motorPowers) {
        if (!this.initialized || this.isMuted || !this.ctx) return;

        // Resume AudioContext if suspended by browser autoplay policy
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        // Average motor power [0.0 to 1.0]
        const avgPower = motorPowers.reduce((a, b) => a + b, 0) / (motorPowers.length || 4);

        // Modulate Frequency based on motor RPM: 100 Hz at idle -> 550 Hz at full throttle
        const targetFreq = 100 + avgPower * 450;
        this.osc1.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
        this.osc2.frequency.setTargetAtTime(targetFreq * 2, this.ctx.currentTime, 0.05);

        // Modulate Filter cutoff frequency
        this.filterNode.frequency.setTargetAtTime(300 + avgPower * 1200, this.ctx.currentTime, 0.05);
    }

    playCheckpointSound() {
        if (!this.initialized || this.isMuted || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5 note
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15); // A5 note

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
}
