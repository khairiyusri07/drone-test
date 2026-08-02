import * as THREE from 'three';

export class RaceManager {
    constructor(physicsEngine, audioEngine) {
        this.physics = physicsEngine;
        this.audio = audioEngine;

        this.checkpoints = [];
        this.currentCheckpointIndex = 0;
        this.isRaceActive = false;

        this.startTime = 0;
        this.elapsedTime = 0;
        this.bestLapTime = parseFloat(localStorage.getItem('aerox_best_lap') || 0);

        // UI DOM References
        this.timerBanner = document.getElementById('race-banner');
        this.timerVal = document.getElementById('timer-val');
        this.cpCurrent = document.getElementById('cp-current');
        this.cpTotal = document.getElementById('cp-total');
        this.bestLapVal = document.getElementById('best-lap-val');

        if (this.bestLapTime > 0) {
            this.updateBestLapDisplay(this.bestLapTime);
        }
    }

    scanTrackObjects(trackObjects) {
        // Filter out ring checkpoints, boost pads, helipads
        this.checkpoints = trackObjects.filter(obj =>
            obj.userData.type === 'ring' || obj.userData.type === 'start_gate'
        );

        this.boostPads = trackObjects.filter(obj => obj.userData.type === 'boost');
        this.helipads = trackObjects.filter(obj => obj.userData.type === 'helipad' || obj.userData.isHelipad);

        this.currentCheckpointIndex = 0;
        this.isRaceActive = false;
        this.lastHelipadId = null;
        this.lastSavedCheckpoint = null;

        if (this.cpTotal) this.cpTotal.innerText = this.checkpoints.length;
        if (this.cpCurrent) this.cpCurrent.innerText = "0";

        if (this.checkpoints.length > 0) {
            if (this.timerBanner) this.timerBanner.classList.remove('hidden');
        } else {
            if (this.timerBanner) this.timerBanner.classList.add('hidden');
        }
    }

    update(delta) {
        if (!this.physics) return;

        const dronePos = this.physics.position;

        // 1. Check Helipad Touchdown Checkpoints (Savepoint)
        if (this.helipads && this.helipads.length > 0) {
            this.helipads.forEach(pad => {
                const padPos = new THREE.Vector3();
                pad.getWorldPosition(padPos);

                const dx = dronePos.x - padPos.x;
                const dz = dronePos.z - padPos.z;
                const dy = Math.abs(dronePos.y - padPos.y);

                const distHoriz = Math.sqrt(dx * dx + dz * dz);

                // Horizontal distance < 0.6m, vertical distance < 0.8m
                if (distHoriz < 0.6 && dy < 0.8) {
                    if (this.lastHelipadId !== pad.uuid) {
                        this.lastHelipadId = pad.uuid;
                        this.lastSavedCheckpoint = {
                            position: padPos.clone(),
                            rotationY: pad.rotation.y || 0
                        };
                        if (this.onHelipadCheckpointSaved) {
                            this.onHelipadCheckpointSaved(padPos.clone(), pad.rotation.y || 0, pad);
                        }
                    }
                }
            });
        }

        // 2. Check Ring Checkpoint Collisions
        if (this.checkpoints.length > 0) {
            const nextCP = this.checkpoints[this.currentCheckpointIndex];
            if (nextCP) {
                // Distance check between drone and checkpoint ring center
                const cpWorldPos = new THREE.Vector3();
                nextCP.getWorldPosition(cpWorldPos);
                cpWorldPos.y += 4.5; // Offset to ring center

                const dist = dronePos.distanceTo(cpWorldPos);
                const ringRadius = nextCP.userData.radius || 3.5;

                if (dist <= ringRadius) {
                    this.onCheckpointPassed();
                }
            }
        }

        // 3. Check Speed Boost Pads
        if (this.boostPads) {
            this.boostPads.forEach(pad => {
                const padPos = new THREE.Vector3();
                pad.getWorldPosition(padPos);
                if (dronePos.distanceTo(padPos) < 3.0 && dronePos.y < 1.5) {
                    // Apply instant velocity boost forward
                    const forward = new THREE.Vector3(0, 0, 15).applyQuaternion(this.physics.quaternion);
                    this.physics.velocity.add(forward);
                }
            });
        }

        // 3. Update Timer
        if (this.isRaceActive) {
            this.elapsedTime = (performance.now() - this.startTime) / 1000;
            if (this.timerVal) {
                this.timerVal.innerText = this.formatTime(this.elapsedTime);
            }
        }
    }

    onCheckpointPassed() {
        if (this.audio) this.audio.playCheckpointSound();

        // Start timer on first checkpoint pass
        if (!this.isRaceActive) {
            this.isRaceActive = true;
            this.startTime = performance.now();
        }

        this.currentCheckpointIndex++;
        if (this.cpCurrent) this.cpCurrent.innerText = this.currentCheckpointIndex;

        // Check if Lap Completed
        if (this.currentCheckpointIndex >= this.checkpoints.length) {
            this.onLapFinished();
        }
    }

    onLapFinished() {
        this.isRaceActive = false;
        const finalTime = this.elapsedTime;

        if (this.bestLapTime === 0 || finalTime < this.bestLapTime) {
            this.bestLapTime = finalTime;
            localStorage.setItem('aerox_best_lap', finalTime.toString());
            this.updateBestLapDisplay(finalTime);
        }

        // Reset index for next lap
        this.currentCheckpointIndex = 0;
        if (this.cpCurrent) this.cpCurrent.innerText = "0";
    }

    updateBestLapDisplay(timeInSeconds) {
        if (this.bestLapVal) {
            this.bestLapVal.innerText = this.formatTime(timeInSeconds);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
}
