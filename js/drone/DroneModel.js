import * as THREE from 'three';

export class DroneModel {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.rotors = []; // Propeller meshes for animation
        this.type = 'tello'; // 'tello', 'fpv_racer', 'cargo_hex', 'stealth'
        
        this.buildDrone(this.type);
        this.scene.add(this.mesh);
    }

    buildDrone(type) {
        while (this.mesh.children.length > 0) {
            const obj = this.mesh.children[0];
            this.mesh.remove(obj);
        }
        this.rotors = [];
        this.type = type;

        switch (type) {
            case 'fpv_racer':
                this.buildApexQuad();
                break;
            case 'cargo_hex':
                this.buildHexacopter();
                break;
            case 'stealth':
                this.buildStealthQuad();
                break;
            case 'tello':
            default:
                this.buildTelloDrone();
                break;
        }
    }

    // 1. RYZE TECH TELLO QUADCOPTER DRONE (98mm x 92.5mm x 41mm, 80g)
    buildTelloDrone() {
        // Real-world Tello Dimensions: 0.098m width, 0.0925m length, 0.041m height
        
        // Sleek White Upper Canopy Shell (4.5cm x 2.0cm x 6.5cm)
        const topCanopyGeo = new THREE.BoxGeometry(0.045, 0.02, 0.065);
        const topCanopyMat = new THREE.MeshStandardMaterial({
            color: 0xf5f7fa,
            roughness: 0.15,
            metalness: 0.1
        });
        const topCanopy = new THREE.Mesh(topCanopyGeo, topCanopyMat);
        topCanopy.position.y = 0.01;
        topCanopy.castShadow = true;
        this.mesh.add(topCanopy);

        // Dark Lower Chassis & Battery Bay Base (4.2cm x 0.018m x 6.0cm)
        const baseChassisGeo = new THREE.BoxGeometry(0.042, 0.018, 0.06);
        const baseChassisMat = new THREE.MeshStandardMaterial({
            color: 0x111622,
            roughness: 0.4,
            metalness: 0.8
        });
        const baseChassis = new THREE.Mesh(baseChassisGeo, baseChassisMat);
        baseChassis.position.y = -0.008;
        baseChassis.castShadow = true;
        this.mesh.add(baseChassis);

        // Front HD Camera Lens Module (720p HD Camera)
        const camHousingGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16);
        const camHousingMat = new THREE.MeshStandardMaterial({ color: 0x050810, metalness: 0.9 });
        const camHousing = new THREE.Mesh(camHousingGeo, camHousingMat);
        camHousing.rotation.x = Math.PI / 2;
        camHousing.position.set(0, 0.002, 0.035);
        this.mesh.add(camHousing);

        // Camera Glass Lens (Cyan Optical Element)
        const lensGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.002, 16);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.8 });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 0.002, 0.041);
        this.mesh.add(lens);

        // Front Status LED Light (Green/Blue Tello Status LED)
        const ledGeo = new THREE.SphereGeometry(0.004, 8, 8);
        const ledMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 2.0 });
        const statusLed = new THREE.Mesh(ledGeo, ledMat);
        statusLed.position.set(-0.012, 0.01, 0.034);
        this.mesh.add(statusLed);

        // 4 Motor Arms with 360° Safety Propeller Guards (98mm x 92.5mm outer bounds)
        const armLength = 0.065;
        const armAngles = [
            Math.PI / 4,       // Front-Left
            -Math.PI / 4,      // Front-Right
            3 * Math.PI / 4,   // Rear-Left
            -3 * Math.PI / 4   // Rear-Right
        ];

        const armGeo = new THREE.BoxGeometry(0.008, 0.006, armLength);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.7, roughness: 0.3 });

        armAngles.forEach((angle) => {
            const armGroup = new THREE.Group();
            armGroup.rotation.y = angle;

            // Arm Strut
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.position.z = armLength / 2;
            arm.castShadow = true;
            armGroup.add(arm);

            // Coreless Micro Motor Pod
            const motorGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.016, 16);
            const motorMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, metalness: 0.9 });
            const motor = new THREE.Mesh(motorGeo, motorMat);
            motor.position.set(0, 0.008, armLength);
            armGroup.add(motor);

            // Tello Circular 360° Propeller Guard Ring (Safety Guard)
            const guardGeo = new THREE.TorusGeometry(0.038, 0.003, 12, 32);
            const guardMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.5 });
            const guard = new THREE.Mesh(guardGeo, guardMat);
            guard.rotation.x = Math.PI / 2;
            guard.position.set(0, 0.012, armLength);
            armGroup.add(guard);

            // 2-Blade Black 3-inch Tello Propeller Mesh
            const propGroup = new THREE.Group();
            propGroup.position.set(0, 0.016, armLength);

            const bladeGeo = new THREE.BoxGeometry(0.006, 0.001, 0.07);
            const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.3 });
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            propGroup.add(blade);

            armGroup.add(propGroup);
            this.mesh.add(armGroup);

            // Store propGroup reference for spinning animation
            this.rotors.push(propGroup);
        });

        // True 1:1 Real-World Scale: 98mm × 92.5mm × 41mm (no scaling)
        this.mesh.scale.set(1.0, 1.0, 1.0);
    }

    // 2. FPV APEX RACER QUADCOPTER
    buildApexQuad() {
        const bodyGeo = new THREE.BoxGeometry(0.35, 0.12, 0.45);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.4, metalness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.add(body);

        const armLength = 0.55;
        const armAngles = [Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
        armAngles.forEach((angle, idx) => {
            const armGroup = new THREE.Group();
            armGroup.rotation.y = angle;

            const motorGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08);
            const motorMat = new THREE.MeshStandardMaterial({ color: (idx < 2) ? 0x00f0ff : 0xff0055 });
            const motor = new THREE.Mesh(motorGeo, motorMat);
            motor.position.set(0, 0.04, armLength);
            armGroup.add(motor);

            const propGroup = new THREE.Group();
            propGroup.position.set(0, 0.08, armLength);
            for (let b = 0; b < 3; b++) {
                const bladeGeo = new THREE.BoxGeometry(0.03, 0.005, 0.28);
                const bladeMat = new THREE.MeshStandardMaterial({ color: (idx < 2) ? 0x00f0ff : 0xff0055, transparent: true, opacity: 0.8 });
                const blade = new THREE.Mesh(bladeGeo, bladeMat);
                blade.rotation.y = (b * Math.PI * 2) / 3;
                propGroup.add(blade);
            }
            armGroup.add(propGroup);
            this.mesh.add(armGroup);
            this.rotors.push(propGroup);
        });
        this.mesh.scale.set(1, 1, 1);
    }

    // 3. HEAVY CARGO HEXACOPTER
    buildHexacopter() {
        const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.16, 6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222a38, metalness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.add(body);

        const armLength = 0.65;
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const armGroup = new THREE.Group();
            armGroup.rotation.y = angle;

            const propGroup = new THREE.Group();
            propGroup.position.set(0, 0.09, armLength);
            const bladeGeo = new THREE.BoxGeometry(0.04, 0.006, 0.36);
            const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffe600, transparent: true, opacity: 0.8 });
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            propGroup.add(blade);

            armGroup.add(propGroup);
            this.mesh.add(armGroup);
            this.rotors.push(propGroup);
        }
        this.mesh.scale.set(1, 1, 1);
    }

    // 4. FUTURISTIC STEALTH QUAD
    buildStealthQuad() {
        const bodyGeo = new THREE.ConeGeometry(0.4, 0.8, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.2, metalness: 0.9 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI / 2;
        this.mesh.add(body);

        const armAngles = [Math.PI/4, -Math.PI/4, 3*Math.PI/4, -3*Math.PI/4];
        armAngles.forEach(angle => {
            const armGroup = new THREE.Group();
            armGroup.rotation.y = angle;

            const propGroup = new THREE.Group();
            propGroup.position.set(0, 0.05, 0.5);

            const bladeGeo = new THREE.TorusGeometry(0.18, 0.01, 8, 24);
            const bladeMat = new THREE.MeshStandardMaterial({ color: 0x9d4edd, emissive: 0x9d4edd, emissiveIntensity: 1.5 });
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            blade.rotation.x = Math.PI / 2;
            propGroup.add(blade);

            armGroup.add(propGroup);
            this.mesh.add(armGroup);
            this.rotors.push(propGroup);
        });
        this.mesh.scale.set(1, 1, 1);
    }

    updateRotors(motorPowers, delta) {
        this.rotors.forEach((rotor, idx) => {
            const speed = (motorPowers[idx % motorPowers.length] || 0.5) * 60;
            rotor.rotation.y += speed * delta;
        });
    }
}
