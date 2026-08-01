import * as THREE from 'three';

export class EnvironmentManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.scene = sceneManager.scene;
        this.currentEnv = 'school_hall';
        this.envObjects = [];

        // Base Ground Plane Mesh
        this.groundMesh = null;
    }

    loadEnvironment(envType) {
        this.clearCurrentEnvironment();
        this.currentEnv = envType;

        switch (envType) {
            case 'cyber':
                this.buildCyberCity();
                break;
            case 'canyon':
                this.buildCanyonIsland();
                break;
            case 'hangar':
                this.buildTrainingHangar();
                break;
            case 'sandbox':
                this.buildSandboxField();
                break;
            case 'school_hall':
            default:
                this.buildSchoolHall();
                break;
        }
    }

    clearCurrentEnvironment() {
        this.envObjects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
        this.envObjects = [];
    }

    // 1. REALISTIC SCHOOL ASSEMBLY & SPORTS HALL (30.0m x 18.0m x 7.0m Real World Dimensions)
    buildSchoolHall() {
        this.scene.background = new THREE.Color(0x2b3548);
        this.scene.fog = null;

        if (this.sceneManager.ambientLight) {
            this.sceneManager.ambientLight.color.setHex(0xffffff);
            this.sceneManager.ambientLight.intensity = 1.2;
        }

        // Realistic Polished Wooden Basketball & Sports Parquet Floor (30m x 18m)
        const floorGeo = new THREE.PlaneGeometry(30, 18, 30, 18);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xc8965d,
            roughness: 0.3,
            metalness: 0.1
        });
        this.groundMesh = new THREE.Mesh(floorGeo, floorMat);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);
        this.envObjects.push(this.groundMesh);

        // Painted Basketball Court Boundary Lines (26m x 14m inside 30m x 18m hall)
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const blueLineMat = new THREE.MeshStandardMaterial({ color: 0x2b5c8f, roughness: 0.5 });

        // Center Court Circle (1.8m radius)
        const centerCircleGeo = new THREE.RingGeometry(1.75, 1.85, 36);
        const centerCircle = new THREE.Mesh(centerCircleGeo, blueLineMat);
        centerCircle.rotation.x = Math.PI / 2;
        centerCircle.position.y = 0.005;
        this.scene.add(centerCircle);
        this.envObjects.push(centerCircle);

        // Court Boundary Rectangle Mesh (26m x 14m)
        const boundBox = new THREE.BoxGeometry(26, 0.005, 14);
        const boundMesh = new THREE.Mesh(boundBox, lineMat);
        boundMesh.position.y = 0.004;
        this.scene.add(boundMesh);
        this.envObjects.push(boundMesh);

        // School Hall Walls (30m Length x 18m Width x 7m Height)
        const upperWallMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd1, roughness: 0.8 });
        const lowerWoodMat = new THREE.MeshStandardMaterial({ color: 0x6e431f, roughness: 0.4 });

        const walls = [
            { pos: [0, 3.5, -9], rot: [0, 0, 0], size: [30, 7, 0.4] },
            { pos: [0, 3.5, 9], rot: [0, 0, 0], size: [30, 7, 0.4] },
            { pos: [-15, 3.5, 0], rot: [0, Math.PI / 2, 0], size: [18, 7, 0.4] },
            { pos: [15, 3.5, 0], rot: [0, Math.PI / 2, 0], size: [18, 7, 0.4] }
        ];

        walls.forEach(w => {
            // Upper Wall Mesh
            const wallGeo = new THREE.BoxGeometry(...w.size);
            const wall = new THREE.Mesh(wallGeo, upperWallMat);
            wall.position.set(...w.pos);
            wall.rotation.set(...w.rot);
            wall.receiveShadow = true;
            this.scene.add(wall);
            this.envObjects.push(wall);

            // Lower Wood Paneling Wainscoting (Height = 2.0m)
            const woodSize = [w.size[0], 2.0, w.size[2] + 0.05];
            const woodGeo = new THREE.BoxGeometry(...woodSize);
            const woodPanel = new THREE.Mesh(woodGeo, lowerWoodMat);
            woodPanel.position.set(w.pos[0], 1.0, w.pos[2]);
            woodPanel.rotation.set(...w.rot);
            woodPanel.receiveShadow = true;
            this.scene.add(woodPanel);
            this.envObjects.push(woodPanel);
        });

        // School Assembly Stage Platform (Far Wall: x = -13.5m, Height = 0.8m)
        const stageGeo = new THREE.BoxGeometry(3.0, 0.8, 10.0);
        const stageMat = new THREE.MeshStandardMaterial({ color: 0x5a3617, roughness: 0.3 });
        const stage = new THREE.Mesh(stageGeo, stageMat);
        stage.position.set(-13.5, 0.4, 0);
        stage.receiveShadow = true;
        this.scene.add(stage);
        this.envObjects.push(stage);

        // Stage Red Velvet Curtains
        const curtainMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.9 });
        const curtainLeftGeo = new THREE.BoxGeometry(0.3, 5.0, 3.0);
        const curtainLeft = new THREE.Mesh(curtainLeftGeo, curtainMat);
        curtainLeft.position.set(-14.7, 3.3, -3.5);
        this.scene.add(curtainLeft);
        this.envObjects.push(curtainLeft);

        const curtainRight = new THREE.Mesh(curtainLeftGeo, curtainMat);
        curtainRight.position.set(-14.7, 3.3, 3.5);
        this.scene.add(curtainRight);
        this.envObjects.push(curtainRight);

        // Official FIBA Basketball Hoops & Backboards (3.05m Rim Height)
        const backboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xff4500 });

        // Left Hoop (x = -13m)
        const bbLeftGeo = new THREE.BoxGeometry(0.08, 1.05, 1.8);
        const bbLeft = new THREE.Mesh(bbLeftGeo, backboardMat);
        bbLeft.position.set(-13.0, 3.4, 0);
        this.scene.add(bbLeft);
        this.envObjects.push(bbLeft);

        const rimLeftGeo = new THREE.TorusGeometry(0.225, 0.02, 12, 24);
        const rimLeft = new THREE.Mesh(rimLeftGeo, rimMat);
        rimLeft.rotation.x = Math.PI / 2;
        rimLeft.position.set(-12.6, 3.05, 0);
        this.scene.add(rimLeft);
        this.envObjects.push(rimLeft);

        // Right Hoop (x = +13m)
        const bbRight = new THREE.Mesh(bbLeftGeo, backboardMat);
        bbRight.position.set(13.0, 3.4, 0);
        this.scene.add(bbRight);
        this.envObjects.push(bbRight);

        const rimRight = new THREE.Mesh(rimLeftGeo, rimMat);
        rimRight.rotation.x = Math.PI / 2;
        rimRight.position.set(12.6, 3.05, 0);
        this.scene.add(rimRight);
        this.envObjects.push(rimRight);

        // Overhead Roof Trusses & Hanging Gymnasium Lights (Ceiling Height = 7.0m)
        const trussMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.8 });
        const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff5e6, emissive: 0xfff5e6, emissiveIntensity: 1.0 });

        for (let x = -10; x <= 10; x += 5) {
            const trussGeo = new THREE.BoxGeometry(0.4, 0.4, 17.6);
            const truss = new THREE.Mesh(trussGeo, trussMat);
            truss.position.set(x, 6.7, 0);
            this.scene.add(truss);
            this.envObjects.push(truss);

            for (let z = -6; z <= 6; z += 6) {
                const lampGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.2, 16);
                const lamp = new THREE.Mesh(lampGeo, lampMat);
                lamp.position.set(x, 6.4, z);
                this.scene.add(lamp);
                this.envObjects.push(lamp);
            }
        }
    }

    // 2. SANDBOX FIELD
    buildSandboxField() {
        this.scene.background = new THREE.Color(0x0a0f1d);
        this.scene.fog.color.setHex(0x0a0f1d);
        this.scene.fog.density = 0.002;

        const groundGeo = new THREE.PlaneGeometry(100, 100, 40, 40);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x0c1222,
            roughness: 0.8,
            metalness: 0.2
        });

        this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);
        this.envObjects.push(this.groundMesh);

        const gridHelper = new THREE.GridHelper(100, 100, 0x00f0ff, 0x162238);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
        this.envObjects.push(gridHelper);
    }

    // 3. CYBERPUNK NEON CITY
    buildCyberCity() {
        this.scene.background = new THREE.Color(0x03050c);
        this.scene.fog.color.setHex(0x03050c);
        this.scene.fog.density = 0.003;

        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x05070e, roughness: 0.3, metalness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.envObjects.push(ground);

        const gridHelper = new THREE.GridHelper(200, 100, 0x9d4edd, 0x160c28);
        gridHelper.position.y = 0.02;
        this.scene.add(gridHelper);
        this.envObjects.push(gridHelper);
    }

    // 4. CANYON ISLAND
    buildCanyonIsland() {
        this.scene.background = new THREE.Color(0x0e1b2e);
        this.scene.fog.color.setHex(0x0e1b2e);
        this.scene.fog.density = 0.0025;

        const waterGeo = new THREE.PlaneGeometry(200, 200);
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x004466, roughness: 0.1, metalness: 0.8, opacity: 0.85, transparent: true });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.5;
        this.scene.add(water);
        this.envObjects.push(water);
    }

    // 5. INDOOR TRAINING HANGAR
    buildTrainingHangar() {
        this.scene.background = new THREE.Color(0x0b0d12);
        this.scene.fog.color.setHex(0x0b0d12);
        this.scene.fog.density = 0.005;

        const floorGeo = new THREE.PlaneGeometry(80, 80);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1e29, roughness: 0.6, metalness: 0.3 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.envObjects.push(floor);
    }
}
