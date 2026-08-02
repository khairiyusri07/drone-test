import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;

        // 1. Create Scene with Bright Neutral Hall Background
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x252e42);
        this.scene.fog = null; // No dark fog

        // 2. Create Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // 3. Create Camera Modes
        this.activeCameraMode = 'CHASE'; // 'FPV', 'CHASE', 'ORBIT', 'BUILDER'

        // Main Perspective Camera
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 500);
        this.camera.position.set(0, 2.5, 4.0);

        // FPV Camera Offset
        this.fpvCamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.02, 1500);
        this.fpvTiltAngle = 12;

        // Orbit Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
        this.controls.enabled = true;

        // 4. Bright Lighting System
        this.setupLighting();

        // 5. Window Resize Handler
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xfff8ee, 1.8);
        this.dirLight.position.set(10, 20, 10);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 100;
        const d = 25;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.scene.add(this.dirLight);

        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334455, 0.6);
        this.scene.add(this.hemiLight);
    }

    setCameraMode(mode, droneMesh = null) {
        this.activeCameraMode = mode;

        if (mode === 'BUILDER') {
            this.controls.enabled = true;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
            this.controls.target.set(0, 0, 0);
            this.camera.position.set(0, 6.0, 5.5);
            this.camera.lookAt(0, 0, 0);
        } else if (mode === 'ORBIT') {
            this.controls.enabled = true;
            if (droneMesh) {
                this.controls.target.copy(droneMesh.position);
            }
        } else {
            this.controls.enabled = false;
        }
    }

    updateCamera(droneMesh, droneQuaternion, delta) {
        if (!droneMesh) return;

        const dronePos = droneMesh.position;

        if (this.activeCameraMode === 'FPV') {
            // FPV camera on front HD lens module (facing forward along +Z)
            const offset = new THREE.Vector3(0, 0.02, 0.04);
            offset.applyQuaternion(droneQuaternion);
            this.camera.position.copy(dronePos).add(offset);

            // Rotate camera 180° around Y so Three.js camera (-Z) faces forward (+Z), plus apply FPV tilt up
            const fpvQuat = new THREE.Quaternion();
            const rotY180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
            const tiltX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-this.fpvTiltAngle));
            fpvQuat.multiply(rotY180).multiply(tiltX);

            const finalQuat = droneQuaternion.clone().multiply(fpvQuat);
            this.camera.quaternion.copy(finalQuat);
        } else if (this.activeCameraMode === 'CHASE') {
            // Chase camera 1.2m behind (-Z) and 0.4m above drone
            const idealOffset = new THREE.Vector3(0, 0.4, -1.2);
            idealOffset.applyQuaternion(droneQuaternion);
            const targetCamPos = dronePos.clone().add(idealOffset);

            this.camera.position.lerp(targetCamPos, 0.2);
            const lookTarget = dronePos.clone().add(new THREE.Vector3(0, 0.05, 0.5).applyQuaternion(droneQuaternion));
            this.camera.lookAt(lookTarget);
        } else if (this.activeCameraMode === 'ORBIT') {
            this.controls.target.lerp(dronePos, 0.1);
            this.controls.update();
        } else if (this.activeCameraMode === 'BUILDER') {
            this.controls.update();
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
