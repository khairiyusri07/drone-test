import * as THREE from 'three';

export class TrackObjectFactory {
    static createObject(type) {
        const group = new THREE.Group();
        group.userData = { type: type, isTrackProp: true };

        switch (type) {
            case 'gate_1m':
                this.buildGate1m(group);
                break;
            case 'pole_1m':
                this.buildPole1m(group);
                break;
            case 'ring':
                this.buildRing(group);
                break;
            case 'tunnel':
                this.buildTunnel(group);
                break;
            case 'slalom':
                this.buildSlalom(group);
                break;
            case 'boost':
                this.buildBoostPad(group);
                break;
            case 'helipad':
                this.buildHelipad(group);
                break;
            case 'start_gate':
                this.buildStartGate(group);
                break;
            case 'barrier':
            default:
                this.buildBarrier(group);
                break;
        }

        return group;
    }

    // 1. 1m x 1m GATE FRAME (Red Vertical Posts, Yellow Top Crossbar)
    static buildGate1m(group) {
        const postMat = new THREE.MeshStandardMaterial({
            color: 0xff0055,
            emissive: 0xff0055,
            emissiveIntensity: 0.6,
            roughness: 0.3
        });
        const barMat = new THREE.MeshStandardMaterial({
            color: 0xffe600,
            emissive: 0xffe600,
            emissiveIntensity: 1.0,
            roughness: 0.2
        });
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.5 });

        // Left Red Vertical Post (Height = 1.0m, x = -0.5m)
        const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 16);
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(-0.5, 0.5, 0);
        leftPost.castShadow = true;
        group.add(leftPost);

        const leftBaseGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16);
        const leftBase = new THREE.Mesh(leftBaseGeo, baseMat);
        leftBase.position.set(-0.5, 0.01, 0);
        group.add(leftBase);

        // Right Red Vertical Post (Height = 1.0m, x = +0.5m)
        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(0.5, 0.5, 0);
        rightPost.castShadow = true;
        group.add(rightPost);

        const rightBase = new THREE.Mesh(leftBaseGeo, baseMat);
        rightBase.position.set(0.5, 0.01, 0);
        group.add(rightBase);

        // Yellow Horizontal Crossbar across top (y = 1.0m, width = 1.05m)
        const barGeo = new THREE.BoxGeometry(1.05, 0.04, 0.04);
        const topBar = new THREE.Mesh(barGeo, barMat);
        topBar.position.set(0, 1.0, 0);
        group.add(topBar);

        group.userData.radius = 0.5;
        group.userData.height = 1.0;
        group.userData.width = 1.0;
    }

    // 2. 1-METER TALL POLE PROP
    static buildPole1m(group) {
        const baseGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.5 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.01;
        group.add(baseMesh);

        // 1m Cylinder Pole Body (Diameter 5cm = radius 0.025m)
        const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 16);
        const poleMat = new THREE.MeshStandardMaterial({
            color: 0x2b3648,
            roughness: 0.3,
            metalness: 0.8
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 0.5;
        pole.castShadow = true;
        group.add(pole);

        // Indicator Tip at 1.0m height
        const tipGeo = new THREE.SphereGeometry(0.04, 16, 16);
        const tipMat = new THREE.MeshStandardMaterial({
            color: 0xffe600,
            emissive: 0xffe600,
            emissiveIntensity: 1.0
        });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.y = 1.0;
        group.add(tip);

        group.userData.radius = 0.05;
        group.userData.height = 1.0;
    }

    // 3. SLALOM POLE (Real World Height = 1.5m)
    static buildSlalom(group) {
        const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 16);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 0.75;
        group.add(pole);


        group.userData.radius = 0.2;
        group.userData.height = 1;
    }

    // 4. NEON GATE RING (1.2m Diameter Checkpoint Ring)
    static buildRing(group) {
        const ringGeo = new THREE.TorusGeometry(0.6, 0.04, 16, 32);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 1.5,
            roughness: 0.2
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 1.0;
        group.add(ring);

        const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 16);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, metalness: 0.8 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = 0.2;
        group.add(post);

        group.userData.radius = 0.6;
    }

    // 5. RECTANGULAR TUNNEL FRAME (50cm x 50cm x 50cm)
    // Front view: 4 red corner posts + 2 yellow top crossbars
    // Open front & back — drone flies through
    static buildTunnel(group) {
        const postMat = new THREE.MeshStandardMaterial({
            color: 0xff0033,
            emissive: 0xff0033,
            emissiveIntensity: 0.7,
            roughness: 0.3
        });
        const barMat = new THREE.MeshStandardMaterial({
            color: 0xffe600,
            emissive: 0xffe600,
            emissiveIntensity: 1.0,
            roughness: 0.2
        });

        const POST_R = 0.025;   // 2.5cm radius (5cm diameter)
        const W = 0.5;          // 50cm width (left-right)
        const H = 1;          // 50cm height
        const D = 1;          // 50cm depth (front-back)
        const BAR_T = 0.03;     // bar cross-section thickness

        // ── 4 Vertical Corner Posts ──────────────────────────────────────
        const postGeo = new THREE.CylinderGeometry(POST_R, POST_R, H, 12);
        const corners = [
            [-W / 2, D / 2],   // front-left
            [W / 2, D / 2],   // front-right
            [-W / 2, -D / 2],   // back-left
            [W / 2, -D / 2],   // back-right
        ];
        corners.forEach(([x, z]) => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(x, H / 2, z);
            post.castShadow = true;
            group.add(post);
        });

        // ── Top Crossbars (Yellow) ────────────────────────────────────────
        // Left-right bar at FRONT (z = +D/2, y = H)
        const lrBarGeo = new THREE.BoxGeometry(W + POST_R * 2, BAR_T, BAR_T);
        const topFront = new THREE.Mesh(lrBarGeo, barMat);
        topFront.position.set(0, H, D / 2);
        group.add(topFront);

        // Left-right bar at BACK (z = -D/2, y = H)
        const topBack = new THREE.Mesh(lrBarGeo, barMat);
        topBack.position.set(0, H, -D / 2);
        group.add(topBack);

        // Front-back bar at LEFT (x = -W/2, y = H)
        const fbBarGeo = new THREE.BoxGeometry(BAR_T, BAR_T, D + POST_R * 2);
        const topLeft = new THREE.Mesh(fbBarGeo, barMat);
        topLeft.position.set(-W / 2, H, 0);
        group.add(topLeft);

        // Front-back bar at RIGHT (x = +W/2, y = H)
        const topRight = new THREE.Mesh(fbBarGeo, barMat);
        topRight.position.set(W / 2, H, 0);
        group.add(topRight);

        // ── Mid Crossbars (Yellow) — second row at H/2 ───────────────────
        const midFront = new THREE.Mesh(lrBarGeo, barMat);
        midFront.position.set(0, H / 2, D / 2);
        group.add(midFront);

        const midBack = new THREE.Mesh(lrBarGeo, barMat);
        midBack.position.set(0, H / 2, -D / 2);
        group.add(midBack);

        const midLeft = new THREE.Mesh(fbBarGeo, barMat);
        midLeft.position.set(-W / 2, H / 2, 0);
        group.add(midLeft);

        const midRight = new THREE.Mesh(fbBarGeo, barMat);
        midRight.position.set(W / 2, H / 2, 0);
        group.add(midRight);

        // Metadata
        group.userData.width = W;
        group.userData.height = H;
        group.userData.depth = D;
        group.userData.radius = W / 2;
    }

    // 6. SPEED BOOST PAD
    static buildBoostPad(group) {
        const padGeo = new THREE.BoxGeometry(0.8, 0.02, 1.2);
        const padMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 1.2,
            roughness: 0.2
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.01;
        group.add(pad);
        group.userData.isBoost = true;
    }

    // 7. LANDING HELIPAD (Target Touchdown Pad: 0.5m Diameter = 50cm)
    static buildHelipad(group) {
        const padGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 32);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x101726, roughness: 0.4 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.01;
        group.add(pad);

        const ringGeo = new THREE.TorusGeometry(0.22, 0.015, 8, 32);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 1.2 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.022;
        group.add(ring);
        group.userData.isHelipad = true;
    }

    // 8. START / TAKEOFF GATE (Red Takeoff Circle 0.5m Diameter + Arch 1.2m)
    static buildStartGate(group) {
        // Red Takeoff Pad Circle (0.5m Diameter = 50cm)
        const takeoffGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.015, 32);
        const takeoffMat = new THREE.MeshStandardMaterial({ color: 0xee2200, emissive: 0xee2200, emissiveIntensity: 0.9 });
        const takeoffPad = new THREE.Mesh(takeoffGeo, takeoffMat);
        takeoffPad.position.y = 0.008;
        group.add(takeoffPad);

        const archGeo = new THREE.TorusGeometry(0.6, 0.03, 16, 32, Math.PI);
        const archMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.8 });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.y = 0.01;
        group.add(arch);
        group.userData.isStartGate = true;
    }

    // 9. OBSTACLE BARRIER
    static buildBarrier(group) {
        const boxGeo = new THREE.BoxGeometry(1.0, 1.5, 0.2);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.5, metalness: 0.8 });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 0.75;
        group.add(box);
    }
}
