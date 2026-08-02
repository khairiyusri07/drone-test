import * as THREE from 'three';
import { PIDController } from './PIDController.js';

export class DronePhysics {
    constructor(droneModel) {
        this.droneModel = droneModel;
        this.mesh = droneModel.mesh;

        // Drone Physical Properties (Ryze Tech Tello: 98 x 92.5 x 41 mm, 80g)
        this.mass = 0.080; // 80 grams
        this.gravity = 9.81;
        this.armLength = 0.065; // meters

        // State Vectors
        this.position = new THREE.Vector3(0, 1.5, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.quaternion = new THREE.Quaternion();
        this.angularVelocity = new THREE.Vector3(0, 0, 0);

        // Flight Controller State & Modes
        this.isArmed = true; // Drone motor power state (Armed = ON, Disarmed = OFF)
        this.flightMode = 'STABILIZED'; // 'STABILIZED', 'ACRO', 'HOVER'
        this.motorPowers = [0.25, 0.25, 0.25, 0.25]; // 0.0 to 1.0

        // Wind Vector
        this.windVector = new THREE.Vector3(0, 0, 0);

        // PID Controllers
        this.pidRoll = new PIDController(4.5, 0.05, 1.2);
        this.pidPitch = new PIDController(4.5, 0.05, 1.2);
        this.pidYaw = new PIDController(3.0, 0.02, 0.8);
        this.pidAltitude = new PIDController(3.5, 0.1, 1.5);

        // Hover height lock state & Self-Level Sensitivity
        this.levelSensitivity = 8.0;
        this.speedMultiplier = 1.0; // Adjustable flight speed scale (0.2x to 3.0x)
        this.targetAltitude = 1.5;
        this.yawTargetAltitude = null;
        this.isYawingActive = false;

        // Crash Callback & Cooldown
        this.onCrash = null;
        this.lastCrashTime = 0;

        // Reset mesh position
        this.mesh.position.copy(this.position);
    }

    toggleArm() {
        this.isArmed = !this.isArmed;
        if (!this.isArmed) {
            this.motorPowers = [0, 0, 0, 0];
        }
        return this.isArmed;
    }

    setArmed(state) {
        this.isArmed = !!state;
        if (!this.isArmed) {
            this.motorPowers = [0, 0, 0, 0];
        }
    }

    setSpeedMultiplier(scale) {
        this.speedMultiplier = Math.max(0.2, Math.min(3.0, parseFloat(scale) || 1.0));
    }

    resetPosition(x = 0, y = 1.5, z = 0) {
        this.position.set(x, y, z);
        this.velocity.set(0, 0, 0);
        this.quaternion.identity();
        this.angularVelocity.set(0, 0, 0);
        this.motorPowers = [0.25, 0.25, 0.25, 0.25];
        this.targetAltitude = y;
        this.yawTargetAltitude = null;
        this.isYawingActive = false;
        this.mesh.position.copy(this.position);
        this.mesh.quaternion.copy(this.quaternion);
        this.pidRoll.reset();
        this.pidPitch.reset();
        this.pidYaw.reset();
    }

    setWind(speedKmH) {
        // Convert km/h to m/s
        const speedMs = speedKmH / 3.6;
        this.windVector.set(speedMs * 0.7, 0, speedMs * 0.7);
    }

    update(inputs, delta, trackObjects = []) {
        if (delta <= 0) return;
        delta = Math.min(delta, 0.05); // Cap max delta time for numerical stability

        // 1. Process Control Inputs (Throttle, Roll, Pitch, Yaw)
        const throttleInput = inputs.throttle; // 0.0 to 1.0 (0.5 = Neutral / Center)
        const rollInput = inputs.roll;         // -1.0 to +1.0
        const pitchInput = inputs.pitch;       // -1.0 to +1.0
        const yawInput = inputs.yaw;           // -1.0 to +1.0

        // Yaw Altitude Static Hold logic
        const isYawing = Math.abs(yawInput) > 0.01;
        if (isYawing) {
            if (!this.isYawingActive || this.yawTargetAltitude === null) {
                this.isYawingActive = true;
                this.yawTargetAltitude = this.position.y;
            }
            if (Math.abs(throttleInput - 0.5) <= 0.08) {
                this.targetAltitude = this.yawTargetAltitude;
                this.velocity.y *= 0.8;
                this.position.y = THREE.MathUtils.lerp(this.position.y, this.yawTargetAltitude, 0.25);
            } else {
                this.yawTargetAltitude = this.position.y;
            }
        } else {
            this.isYawingActive = false;
            this.yawTargetAltitude = null;
        }

        // Calculate Target Angles/Rates based on Flight Mode
        const speedScale = this.speedMultiplier || 1.0;
        let targetRollRate = 0;
        let targetPitchRate = 0;
        let targetYawRate = yawInput * 3.0 * speedScale; // rad/s scaled

        // Extract Current Euler Angles (Roll, Pitch, Yaw) from Quaternion
        const euler = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ');
        const currentRoll = euler.z;
        const currentPitch = euler.x;

        if (this.flightMode === 'STABILIZED') {
            const baseTiltDeg = this.levelSensitivity ? (this.levelSensitivity * 5) : 40;
            const maxTilt = THREE.MathUtils.degToRad(baseTiltDeg * Math.min(2.0, Math.sqrt(speedScale)));
            const targetRollAngle = -rollInput * maxTilt;
            const targetPitchAngle = pitchInput * maxTilt;

            targetRollRate = this.pidRoll.update(targetRollAngle, currentRoll, delta);
            targetPitchRate = this.pidPitch.update(targetPitchAngle, currentPitch, delta);
        } else if (this.flightMode === 'HOVER') {
            if (Math.abs(throttleInput - 0.5) > 0.05) {
                this.targetAltitude += (throttleInput - 0.5) * 5.0 * speedScale * delta;
                this.targetAltitude = Math.max(0.5, Math.min(100, this.targetAltitude));
            }
            const altCorrection = this.pidAltitude.update(this.targetAltitude, this.position.y, delta);
            targetRollRate = this.pidRoll.update(-rollInput * 0.3 * speedScale, currentRoll, delta);
            targetPitchRate = this.pidPitch.update(pitchInput * 0.3 * speedScale, currentPitch, delta);
        } else {
            targetRollRate = -rollInput * Math.PI * 2 * speedScale;
            targetPitchRate = pitchInput * Math.PI * 2 * speedScale;
        }

        // Calculate Motor Thrust Mixing
        const hoverThrustPerMotor = (this.mass * this.gravity) / 4.0;
        const maxClimbThrustPerMotor = (this.mass * this.gravity * 2.2 * Math.sqrt(speedScale)) / 4.0;

        let baseThrust = hoverThrustPerMotor;

        if (this.flightMode === 'HOVER' || (isYawing && Math.abs(throttleInput - 0.5) <= 0.08)) {
            const altLockTarget = (isYawing && this.yawTargetAltitude !== null) ? this.yawTargetAltitude : this.targetAltitude;
            const altCorrection = this.pidAltitude.update(altLockTarget, this.position.y, delta);
            baseThrust = hoverThrustPerMotor + altCorrection * 0.25 + (altLockTarget - this.position.y) * 2.5;
        } else {
            if (throttleInput > 0.52) {
                const climbRatio = (throttleInput - 0.5) / 0.5;
                baseThrust = hoverThrustPerMotor + climbRatio * (maxClimbThrustPerMotor - hoverThrustPerMotor);
            } else if (throttleInput < 0.48) {
                const descentRatio = throttleInput / 0.5;
                baseThrust = descentRatio * hoverThrustPerMotor;
            } else {
                baseThrust = hoverThrustPerMotor;
                this.velocity.y *= 0.92;
            }
        }

        // Tilt compensation: compensate vertical thrust component when drone is tilted or rotating in yaw
        const droneUpY = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion).y;
        if (droneUpY > 0.25) {
            baseThrust /= droneUpY;
        }

        const rollCorrection = targetRollRate * 0.25;
        const pitchCorrection = targetPitchRate * 0.25;
        const yawCorrection = targetYawRate * 0.15;

        let f1 = baseThrust - rollCorrection + pitchCorrection + yawCorrection;
        let f2 = baseThrust + rollCorrection + pitchCorrection - yawCorrection;
        let f3 = baseThrust - rollCorrection - pitchCorrection - yawCorrection;
        let f4 = baseThrust + rollCorrection - pitchCorrection + yawCorrection;

        const maxMotorForce = maxClimbThrustPerMotor * 1.2;
        f1 = Math.max(0, Math.min(maxMotorForce, f1));
        f2 = Math.max(0, Math.min(maxMotorForce, f2));
        f3 = Math.max(0, Math.min(maxMotorForce, f3));
        f4 = Math.max(0, Math.min(maxMotorForce, f4));

        if (!this.isArmed) {
            f1 = 0; f2 = 0; f3 = 0; f4 = 0;
            this.motorPowers = [0, 0, 0, 0];
        } else {
            this.motorPowers = [
                f1 / maxMotorForce,
                f2 / maxMotorForce,
                f3 / maxMotorForce,
                f4 / maxMotorForce
            ];
        }

        // 2. Sum Forces & Acceleration
        const totalThrust = f1 + f2 + f3 + f4;
        const thrustLocal = new THREE.Vector3(0, totalThrust, 0);
        const thrustWorld = thrustLocal.clone().applyQuaternion(this.quaternion);

        const gravityWorld = new THREE.Vector3(0, -this.mass * this.gravity, 0);
        const totalVel = this.velocity.clone().sub(this.windVector);
        const dragForce = totalVel.clone().multiplyScalar(-0.5 * 1.2 * 0.25 * totalVel.length());

        const netForce = new THREE.Vector3().add(thrustWorld).add(gravityWorld).add(dragForce);
        // Scale horizontal force vectors directly by speedScale
        netForce.x *= speedScale;
        netForce.z *= speedScale;

        const acceleration = netForce.divideScalar(this.mass);

        this.velocity.addScaledVector(acceleration, delta);
        this.position.addScaledVector(this.velocity, delta);

        // 3. Integrate Rotations
        const angularAcceleration = new THREE.Vector3(
            (targetPitchRate - this.angularVelocity.x) * 12.0,
            (targetYawRate - this.angularVelocity.y) * 8.0,
            (targetRollRate - this.angularVelocity.z) * 12.0
        );

        this.angularVelocity.addScaledVector(angularAcceleration, delta);

        const deltaRotation = new THREE.Quaternion().setFromAxisAngle(
            this.angularVelocity.clone().normalize(),
            this.angularVelocity.length() * delta
        );
        if (this.angularVelocity.length() > 0.0001) {
            this.quaternion.multiply(deltaRotation).normalize();
        }

        if (inputs.brake) {
            this.velocity.multiplyScalar(0.92);
            this.angularVelocity.multiplyScalar(0.85);
        }

        // 4. Ground Collision Response
        const groundHeight = 0.15;
        if (this.position.y <= groundHeight) {
            this.position.y = groundHeight;
            if (this.velocity.y < 0) {
                this.velocity.y = -this.velocity.y * 0.25;
            }
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
            this.angularVelocity.multiplyScalar(0.5);

            if (this.flightMode === 'STABILIZED') {
                const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);
                this.quaternion.slerp(targetQuat, 0.1);
            }
        }

        // 5. 3D Track Objects Collision Detection & Bouncing Physics
        this.checkPropCollisions(trackObjects);

        // Sync 3D Mesh
        this.mesh.position.copy(this.position);
        this.mesh.quaternion.copy(this.quaternion);

        // Animate Rotors
        this.droneModel.updateRotors(this.motorPowers, delta);
    }

    triggerCrash(propType) {
        const now = performance.now();
        if (now - this.lastCrashTime < 600) return; // 600ms cooldown to avoid multi-trigger
        this.lastCrashTime = now;

        if (this.onCrash) {
            this.onCrash(propType);
        }
    }

    checkPropCollisions(trackObjects) {
        if (!trackObjects || trackObjects.length === 0) return;

        const droneRadius = 0.12; // Physical collision radius for Tello
        const dronePos = this.position;

        for (let i = 0; i < trackObjects.length; i++) {
            const obj = trackObjects[i];
            const type = obj.userData.type;
            const objPos = obj.position;
            const rotY = obj.rotation.y || 0;

            if (type === 'tunnel') {
                // ── Rectangular Tunnel Collision (1m x 1m x 1m open front & back) ──
                const localDrone = dronePos.clone().sub(objPos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotY);
                const W = 1.0;
                const H = 1.0;
                const D = 1.0;

                // Check if drone is inside tunnel depth envelope (Z zone)
                if (Math.abs(localDrone.z) <= (D / 2 + droneRadius) && localDrone.y >= 0 && localDrone.y <= (H + droneRadius + 0.1)) {
                    let collided = false;

                    // 1. Left/Right Side Wall Posts & Frame Collision
                    if (Math.abs(localDrone.x) >= (W / 2 - droneRadius) && Math.abs(localDrone.x) <= (W / 2 + droneRadius + 0.15)) {
                        collided = true;
                    }

                    // 2. Roof Ceiling Crossbars Collision
                    if (localDrone.y >= (H - droneRadius) && Math.abs(localDrone.x) <= (W / 2 + droneRadius)) {
                        collided = true;
                    }

                    // 3. Corner Posts (4 vertical cylinders at corners)
                    const postRadius = 0.05 + droneRadius;
                    const corners = [[-W / 2, D / 2], [W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2]];
                    for (const [cx, cz] of corners) {
                        const dist = Math.sqrt(Math.pow(localDrone.x - cx, 2) + Math.pow(localDrone.z - cz, 2));
                        if (dist < postRadius) {
                            collided = true;
                            break;
                        }
                    }

                    if (collided) {
                        this.triggerCrash('tunnel');
                        return;
                    }
                }
            } else if (type === 'gate_1m') {
                // 1m x 1m Gate Frame (Posts and Top Bar)
                const localDrone = dronePos.clone().sub(objPos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotY);
                const postRadius = 0.08 + droneRadius;
                const leftDist = Math.sqrt(Math.pow(localDrone.x - (-0.5), 2) + Math.pow(localDrone.z, 2));
                const rightDist = Math.sqrt(Math.pow(localDrone.x - 0.5, 2) + Math.pow(localDrone.z, 2));

                if (localDrone.y >= 0 && localDrone.y <= 1.1) {
                    if (leftDist < postRadius || rightDist < postRadius) {
                        this.triggerCrash('gate_1m');
                        return;
                    }
                }
                if (Math.abs(localDrone.x) <= 0.55 && Math.abs(localDrone.z) <= 0.15 && Math.abs(localDrone.y - 1.0) < 0.15) {
                    this.triggerCrash('gate_1m');
                    return;
                }
            } else if (type === 'ring') {
                // Ring Checkpoint (Outer Ring Frame Collision)
                const localDrone = dronePos.clone().sub(objPos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotY);
                if (Math.abs(localDrone.z) <= 0.15) {
                    const distFromCenter = Math.sqrt(Math.pow(localDrone.x, 2) + Math.pow(localDrone.y - 1.0, 2));
                    const ringRadius = 0.6;
                    const ringThickness = 0.06 + droneRadius;
                    if (distFromCenter >= (ringRadius - ringThickness) && distFromCenter <= (ringRadius + ringThickness)) {
                        this.triggerCrash('ring');
                        return;
                    }
                }
            } else if (type === 'pole_1m' || type === 'slalom') {
                const height = (type === 'pole_1m') ? 1.0 : 1.5;
                const poleRadius = 0.12 + droneRadius;

                if (dronePos.y >= 0 && dronePos.y <= height + 0.1) {
                    const dx = dronePos.x - objPos.x;
                    const dz = dronePos.z - objPos.z;
                    const distHoriz = Math.sqrt(dx * dx + dz * dz);
                    if (distHoriz < poleRadius && distHoriz > 0.0001) {
                        this.triggerCrash(type);
                        return;
                    }
                }
            } else if (type === 'barrier') {
                const localDrone = dronePos.clone().sub(objPos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotY);
                if (Math.abs(localDrone.x) <= 1.2 && Math.abs(localDrone.z) <= 0.4 && localDrone.y >= 0 && localDrone.y <= 1.5) {
                    this.triggerCrash('barrier');
                    return;
                }
            }
        }
    }
}
