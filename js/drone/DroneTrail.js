import * as THREE from 'three';

export class DroneTrail {
    constructor(scene, maxPoints = 1000) {
        this.scene = scene;
        this.maxPoints = maxPoints;
        this.enabled = true;
        this.minDistance = 0.03; // Add point if moved at least 3cm

        this.points = [];
        this.lastPosition = new THREE.Vector3();

        // 1. Line Geometry Setup
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxPoints * 3);
        this.colors = new Float32Array(this.maxPoints * 3);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        // 2. Primary Glowing Line Material
        this.material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            linewidth: 2
        });

        this.line = new THREE.Line(this.geometry, this.material);
        this.line.frustumCulled = false;
        this.scene.add(this.line);

        // 3. Secondary Outer Glow Effect
        const glowMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.4,
            linewidth: 5
        });
        this.glowLine = new THREE.Line(this.geometry, glowMat);
        this.glowLine.frustumCulled = false;
        this.scene.add(this.glowLine);
    }

    update(dronePos) {
        if (!this.enabled || !dronePos) return;

        // If trail is fresh, initialize with current drone position
        if (this.points.length === 0) {
            this.addPoint(dronePos);
            return;
        }

        // Distance from previous fixed point
        const dist = dronePos.distanceTo(this.lastPosition);
        if (dist >= this.minDistance) {
            this.addPoint(dronePos);
        } else if (this.points.length > 0) {
            // Update live tip position so line seamlessly connects to drone frame
            this.points[this.points.length - 1].copy(dronePos);
            this.rebuildBuffers();
        }
    }

    addPoint(pos) {
        const pt = pos.clone();
        // Prevent z-fighting with flat ground
        if (pt.y < 0.02) pt.y = 0.02;

        this.points.push(pt);
        this.lastPosition.copy(pos);

        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }

        this.rebuildBuffers();
    }

    rebuildBuffers() {
        const count = this.points.length;
        if (count < 2) {
            this.geometry.setDrawRange(0, 0);
            return;
        }

        const posAttr = this.geometry.attributes.position;
        const colorAttr = this.geometry.attributes.color;

        const tailColor = new THREE.Color(0x9d4edd); // Purple/magenta at tail
        const headColor = new THREE.Color(0x00f0ff); // Cyan glow at head

        for (let i = 0; i < count; i++) {
            const pt = this.points[i];
            posAttr.setXYZ(i, pt.x, pt.y, pt.z);

            // Progressive color gradient & opacity fade factor
            const factor = i / (count - 1);
            const col = tailColor.clone().lerp(headColor, Math.pow(factor, 1.5));
            colorAttr.setXYZ(i, col.r, col.g, col.b);
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        this.geometry.setDrawRange(0, count);
    }

    clear() {
        this.points = [];
        this.geometry.setDrawRange(0, 0);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        this.line.visible = enabled;
        this.glowLine.visible = enabled;
        if (!enabled) this.clear();
    }
}
