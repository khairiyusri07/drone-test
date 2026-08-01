import * as THREE from 'three';

export class HUDController {
    constructor(physicsEngine, raceManager) {
        this.physics = physicsEngine;
        this.race = raceManager;

        // Artificial Horizon Canvas
        this.horizonCanvas = document.getElementById('horizon-canvas');
        this.ctxH = this.horizonCanvas ? this.horizonCanvas.getContext('2d') : null;

        // Mini-Map Radar Canvas
        this.radarCanvas = document.getElementById('radar-canvas');
        this.ctxR = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

        // DOM Elements
        this.valSpeed = document.getElementById('val-speed');
        this.valAlt = document.getElementById('val-altitude');
        this.valBattery = document.getElementById('stat-battery-pct');
        this.batteryFill = document.getElementById('battery-fill');
        this.statFlightMode = document.getElementById('stat-flight-mode');

        this.m1Bar = document.getElementById('m1-bar');
        this.m2Bar = document.getElementById('m2-bar');
        this.m3Bar = document.getElementById('m3-bar');
        this.m4Bar = document.getElementById('m4-bar');

        // Battery state simulation
        this.battery = 100;
    }

    update(delta) {
        if (!this.physics) return;

        const pos = this.physics.position;
        const vel = this.physics.velocity;
        const speedMs = vel.length();

        // 1. Update Numeric Gauges
        if (this.valSpeed) this.valSpeed.innerText = speedMs.toFixed(1);
        if (this.valAlt) this.valAlt.innerText = Math.max(0, pos.y).toFixed(1);

        // Update Flight Mode Text
        if (this.statFlightMode) {
            this.statFlightMode.innerText = this.physics.flightMode;
        }

        // Battery drain simulation
        if (speedMs > 0.5) {
            this.battery = Math.max(0, this.battery - delta * 0.08);
            if (this.valBattery) this.valBattery.innerText = `${Math.round(this.battery)}%`;
            if (this.batteryFill) this.batteryFill.style.width = `${this.battery}%`;
        }

        // 2. Update Motor RPM Bars
        const powers = this.physics.motorPowers;
        if (this.m1Bar) this.m1Bar.style.height = `${(powers[0] || 0) * 100}%`;
        if (this.m2Bar) this.m2Bar.style.height = `${(powers[1] || 0) * 100}%`;
        if (this.m3Bar) this.m3Bar.style.height = `${(powers[2] || 0) * 100}%`;
        if (this.m4Bar) this.m4Bar.style.height = `${(powers[3] || 0) * 100}%`;

        // 3. Draw Horizon HUD Canvas
        this.drawArtificialHorizon();

        // 4. Draw Radar Canvas
        this.drawRadar();
    }

    drawArtificialHorizon() {
        if (!this.ctxH) return;

        const w = this.horizonCanvas.width;
        const h = this.horizonCanvas.height;
        const cx = w / 2;
        const cy = h / 2;

        this.ctxH.clearRect(0, 0, w, h);

        // Get Euler Angles (Roll, Pitch)
        const euler = new THREE.Euler().setFromQuaternion(this.physics.quaternion, 'YXZ');
        const roll = euler.z;
        const pitch = euler.x;

        this.ctxH.save();
        this.ctxH.translate(cx, cy);
        this.ctxH.rotate(-roll);

        // Draw Pitch Ladder Lines
        const pitchOffset = pitch * 120; // 120px per radian
        this.ctxH.strokeStyle = 'rgba(0, 240, 255, 0.7)';
        this.ctxH.lineWidth = 2;

        // Center Horizon Line
        this.ctxH.beginPath();
        this.ctxH.moveTo(-60, pitchOffset);
        this.ctxH.lineTo(-20, pitchOffset);
        this.ctxH.moveTo(20, pitchOffset);
        this.ctxH.lineTo(60, pitchOffset);
        this.ctxH.stroke();

        // Pitch Bars +10, +20, -10, -20 deg
        for (let p = -30; p <= 30; p += 10) {
            if (p === 0) continue;
            const y = pitchOffset - (p * Math.PI / 180) * 120;
            this.ctxH.beginPath();
            this.ctxH.moveTo(-30, y);
            this.ctxH.lineTo(30, y);
            this.ctxH.stroke();

            this.ctxH.fillStyle = '#00f0ff';
            this.ctxH.font = '10px Orbitron';
            this.ctxH.fillText(`${p}°`, 35, y + 3);
        }

        this.ctxH.restore();

        // Fixed Crosshair Reticle in Center
        this.ctxH.strokeStyle = '#ffe600';
        this.ctxH.lineWidth = 2;
        this.ctxH.beginPath();
        this.ctxH.arc(cx, cy, 6, 0, Math.PI * 2);
        this.ctxH.moveTo(cx - 14, cy);
        this.ctxH.lineTo(cx - 6, cy);
        this.ctxH.moveTo(cx + 6, cy);
        this.ctxH.lineTo(cx + 14, cy);
        this.ctxH.moveTo(cx, cy - 14);
        this.ctxH.lineTo(cx, cy - 6);
        this.ctxH.stroke();
    }

    drawRadar() {
        if (!this.ctxR) return;

        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radarRange = 15; // 15 meters real-world hall range

        this.ctxR.clearRect(0, 0, w, h);

        // Radar Concentric Circles
        this.ctxR.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        this.ctxR.lineWidth = 1;
        this.ctxR.beginPath();
        this.ctxR.arc(cx, cy, cx * 0.4, 0, Math.PI * 2);
        this.ctxR.arc(cx, cy, cx * 0.8, 0, Math.PI * 2);
        this.ctxR.moveTo(cx, 0);
        this.ctxR.lineTo(cx, h);
        this.ctxR.moveTo(0, cy);
        this.ctxR.lineTo(w, cy);
        this.ctxR.stroke();

        // Center Drone Pointer
        const euler = new THREE.Euler().setFromQuaternion(this.physics.quaternion, 'YXZ');
        const heading = euler.y;

        this.ctxR.save();
        this.ctxR.translate(cx, cy);
        this.ctxR.rotate(-heading);

        // Yellow Drone Arrow
        this.ctxR.fillStyle = '#ffe600';
        this.ctxR.beginPath();
        this.ctxR.moveTo(0, -7);
        this.ctxR.lineTo(5, 6);
        this.ctxR.lineTo(0, 3);
        this.ctxR.lineTo(-5, 6);
        this.ctxR.closePath();
        this.ctxR.fill();

        this.ctxR.restore();

        // Render Checkpoints on Radar if Race active
        if (this.race && this.race.checkpoints) {
            const dronePos = this.physics.position;
            this.race.checkpoints.forEach((cp, idx) => {
                const dx = cp.position.x - dronePos.x;
                const dz = cp.position.z - dronePos.z;

                const mapX = cx + (dx / radarRange) * (w * 0.45);
                const mapY = cy + (dz / radarRange) * (h * 0.45);

                this.ctxR.fillStyle = (idx === this.race.currentCheckpointIndex) ? '#00ff88' : '#00f0ff';
                this.ctxR.beginPath();
                this.ctxR.arc(mapX, mapY, 3, 0, Math.PI * 2);
                this.ctxR.fill();
            });
        }
    }
}
