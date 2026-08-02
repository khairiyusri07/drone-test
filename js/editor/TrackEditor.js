import * as THREE from 'three';
import { TrackObjectFactory } from './TrackObjects.js';

export class TrackEditor {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.scene = sceneManager.scene;
        this.camera = sceneManager.camera;
        this.canvas = sceneManager.canvas;

        this.enabled = false;
        this.activeTool = 'select'; // 'select' (Select & Drag/Move) or 'place' (Click Ground to Add)
        this.selectedObjectType = 'ring';
        this.trackObjects = [];
        this.selectedObject = null;
        this.isDragging = false;

        // Metric Floor Ruler Group
        this.rulerGroup = new THREE.Group();
        this.rulerVisible = true;
        this.scene.add(this.rulerGroup);
        this.buildMetricFloorRuler();

        // Dynamic Interactive Measurement Guide Lines
        this.guideGroup = new THREE.Group();
        this.scene.add(this.guideGroup);

        // Laser Tape Measure Tool State
        this.measuringMode = false;
        this.measurePointA = null;
        this.measurePointB = null;
        this.measureLine = null;

        // Raycasting for Mouse targeting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Highlight selection box
        this.selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // Mouse Listeners
        this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));

        // Load Official Manual Flight Plan Track on Init
        this.loadPresetTrack('manual_plan');
    }

    // 1. BUILD 3D METRIC FLOOR RULER GRID (Tick Marks & Meter Labels)
    buildMetricFloorRuler() {
        while (this.rulerGroup.children.length > 0) {
            this.rulerGroup.remove(this.rulerGroup.children[0]);
        }

        const size = 10;
        const gridMat = new THREE.LineBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.6 });
        const minorMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.25 });

        for (let i = -size / 2; i <= size / 2; i += 1.0) {
            const geoX = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-size / 2, 0.005, i),
                new THREE.Vector3(size / 2, 0.005, i)
            ]);
            const lineX = new THREE.Line(geoX, (i === 0) ? gridMat : minorMat);
            this.rulerGroup.add(lineX);

            const geoZ = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i, 0.005, -size / 2),
                new THREE.Vector3(i, 0.005, size / 2)
            ]);
            const lineZ = new THREE.Line(geoZ, (i === 0) ? gridMat : minorMat);
            this.rulerGroup.add(lineZ);
        }

        for (let x = -4; x <= 4; x += 1) {
            for (let z = -4; z <= 4; z += 1) {
                if (x === 0 && z === 0) continue;
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 32;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffe600';
                ctx.font = 'Bold 18px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${x > 0 ? '+' : ''}${x}m,${z > 0 ? '+' : ''}${z}m`, 32, 20);

                const texture = new THREE.CanvasTexture(canvas);
                const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.7 });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(0.6, 0.3, 1);
                sprite.position.set(x, 0.03, z);
                this.rulerGroup.add(sprite);
            }
        }
    }

    toggleRulerVisibility(visible) {
        this.rulerVisible = visible !== undefined ? visible : !this.rulerVisible;
        this.rulerGroup.visible = this.rulerVisible;
    }

    toggleMeasuringMode() {
        this.measuringMode = !this.measuringMode;
        if (!this.measuringMode) {
            this.clearMeasureLine();
        }
        return this.measuringMode;
    }

    clearMeasureLine() {
        if (this.measureLine) {
            this.scene.remove(this.measureLine);
            this.measureLine = null;
        }
        this.measurePointA = null;
        this.measurePointB = null;
        const badge = document.getElementById('measure-badge');
        if (badge) badge.classList.add('hidden');
    }

    setEnabled(enable) {
        this.enabled = enable;
        if (!enable) {
            this.deselectObject();
            this.clearMeasureLine();
            this.clearGuideLines();
            this.isDragging = false;
        }
    }

    setSelectedType(type) {
        this.selectedObjectType = type;
        this.activeTool = 'place';
    }

    clearGuideLines() {
        while (this.guideGroup.children.length > 0) {
            const obj = this.guideGroup.children[0];
            this.guideGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }
    }

    onPointerMove(event) {
        if (!this.enabled) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const groundPoint = new THREE.Vector3();

        if (this.raycaster.ray.intersectPlane(this.groundPlane, groundPoint)) {
            // 1. Interactive Mouse Dragging of Selected Object
            if (this.isDragging && this.selectedObject) {
                const snapX = Math.round(groundPoint.x * 10) / 10;
                const snapZ = Math.round(groundPoint.z * 10) / 10;
                this.selectedObject.position.x = snapX;
                this.selectedObject.position.z = snapZ;
                this.selectionBox.update();

                this.updateInteractiveRulerGuides(this.selectedObject.position);
                return;
            }

            // 2. Update Laser Tape Measure line if measuring
            if (this.measuringMode && this.measurePointA) {
                this.updateMeasureLine(this.measurePointA, groundPoint);
                return;
            }

            // 3. Draw Dynamic Interactive Ruler Guide Lines to nearest track prop
            this.updateInteractiveRulerGuides(groundPoint);
        }
    }

    // 2. DYNAMIC INTERACTIVE RULER MEASUREMENT GUIDES
    updateInteractiveRulerGuides(currentPoint) {
        this.clearGuideLines();
        if (this.trackObjects.length === 0) return;

        let nearestObj = null;
        let minDist = Infinity;

        const activeTargetPos = this.selectedObject ? this.selectedObject.position : currentPoint;

        this.trackObjects.forEach(obj => {
            if (obj === this.selectedObject) return;
            const dist = activeTargetPos.distanceTo(obj.position);
            if (dist < minDist && dist > 0.01) {
                minDist = dist;
                nearestObj = obj;
            }
        });

        if (nearestObj && minDist < 8.0) {
            const geom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(activeTargetPos.x, 0.06, activeTargetPos.z),
                new THREE.Vector3(nearestObj.position.x, 0.06, nearestObj.position.z)
            ]);
            const mat = new THREE.LineDashedMaterial({ color: 0x00f0ff, dashSize: 0.1, gapSize: 0.05, linewidth: 2 });
            const line = new THREE.Line(geom, mat);
            line.computeLineDistances();
            this.guideGroup.add(line);

            const midX = (activeTargetPos.x + nearestObj.position.x) / 2;
            const midZ = (activeTargetPos.z + nearestObj.position.z) / 2;

            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#00f0ff';
            ctx.font = 'Bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`↔ ${minDist.toFixed(2)} m`, 64, 22);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(1.2, 0.3, 1);
            sprite.position.set(midX, 0.25, midZ);
            this.guideGroup.add(sprite);
        }

        const badge = document.getElementById('measure-badge');
        if (badge && !this.measuringMode) {
            badge.classList.remove('hidden');
            const snapX = Math.round(activeTargetPos.x * 10) / 10;
            const snapZ = Math.round(activeTargetPos.z * 10) / 10;
            badge.innerText = `📍 POSITION: X: ${snapX > 0 ? '+' : ''}${snapX.toFixed(1)}m, Z: ${snapZ > 0 ? '+' : ''}${snapZ.toFixed(1)}m | ↔ NEAREST: ${nearestObj ? minDist.toFixed(2) + 'm' : 'N/A'}`;
        }
    }

    onPointerDown(event) {
        if (!this.enabled || event.button !== 0) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        if (this.measuringMode) {
            const hitPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint)) {
                if (!this.measurePointA) {
                    this.measurePointA = hitPoint.clone();
                } else {
                    this.measurePointB = hitPoint.clone();
                    this.updateMeasureLine(this.measurePointA, this.measurePointB);
                    this.measurePointA = null;
                }
            }
            return;
        }

        const intersects = this.raycaster.intersectObjects(this.trackObjects, true);

        if (intersects.length > 0) {
            let rootObj = intersects[0].object;
            while (rootObj.parent && !rootObj.userData.isTrackProp) {
                rootObj = rootObj.parent;
            }
            this.selectObject(rootObj);

            // Start Dragging Object Position
            this.isDragging = true;
            if (this.sceneManager.controls) {
                this.sceneManager.controls.enabled = false; // Disable orbit camera during drag
            }
        } else {
            if (this.activeTool === 'place') {
                const intersectionPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.groundPlane, intersectionPoint)) {
                    this.placeObject(this.selectedObjectType, intersectionPoint);
                }
            } else {
                this.deselectObject();
            }
        }
    }

    onPointerUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.sceneManager.controls && this.enabled) {
                this.sceneManager.controls.enabled = true; // Restore orbit camera
            }
        }
    }

    updateMeasureLine(pA, pB) {
        if (this.measureLine) this.scene.remove(this.measureLine);

        const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(pA.x, 0.05, pA.z),
            new THREE.Vector3(pB.x, 0.05, pB.z)
        ]);
        const mat = new THREE.LineBasicMaterial({ color: 0xff0055, linewidth: 3 });
        this.measureLine = new THREE.Line(geom, mat);
        this.scene.add(this.measureLine);

        const distMeters = pA.distanceTo(pB);
        const dx = Math.abs(pB.x - pA.x);
        const dz = Math.abs(pB.z - pA.z);

        const badge = document.getElementById('measure-badge');
        if (badge) {
            badge.classList.remove('hidden');
            badge.innerText = `📏 TAPE MEASURE: ${distMeters.toFixed(2)} m (${Math.round(distMeters * 100)} cm) [ΔX: ${dx.toFixed(2)}m, ΔZ: ${dz.toFixed(2)}m]`;
        }
    }

    placeObject(type, position) {
        const obj = TrackObjectFactory.createObject(type);

        // Precise 0.1m Grid Snapping
        obj.position.x = Math.round(position.x * 10) / 10;
        obj.position.y = 0;
        obj.position.z = Math.round(position.z * 10) / 10;

        this.scene.add(obj);
        this.trackObjects.push(obj);

        this.selectObject(obj);
        return obj;
    }

    selectObject(obj) {
        this.selectedObject = obj;
        if (obj) {
            this.selectionBox.setFromObject(obj);
            this.selectionBox.visible = true;
        } else {
            this.selectionBox.visible = false;
        }
    }

    deselectObject() {
        this.selectedObject = null;
        this.selectionBox.visible = false;
        this.clearGuideLines();
    }

    rotateSelected(deg = 45) {
        if (this.selectedObject) {
            this.selectedObject.rotation.y += THREE.MathUtils.degToRad(deg);
            this.selectionBox.update();
        }
    }

    elevateSelected(deltaY = 0.5) {
        if (this.selectedObject) {
            this.selectedObject.position.y = Math.max(0, Math.round((this.selectedObject.position.y + deltaY) * 10) / 10);
            this.selectionBox.update();
        }
    }

    deleteSelected() {
        if (this.selectedObject) {
            this.scene.remove(this.selectedObject);
            const idx = this.trackObjects.indexOf(this.selectedObject);
            if (idx !== -1) this.trackObjects.splice(idx, 1);
            this.deselectObject();
        }
    }

    clearTrack() {
        this.trackObjects.forEach(obj => this.scene.remove(obj));
        this.trackObjects = [];
        this.deselectObject();
    }

    // Preset Track Layouts (Exact Real-World 1:1 Metric Coordinates)
    loadPresetTrack(presetName) {
        this.clearTrack();

        if (presetName === 'empty') return;

        if (presetName === 'manual_plan') {
            // OFFICIAL 4m x 4m CONTOH PELAN PENERBANGAN SECARA MANUAL

            // 1. Take Off Point (Red Circle - 0.5m Diameter) at (-2.0m, +2.0m)
            const start = this.placeObject('start_gate', new THREE.Vector3(-2.0, 0, 2.0));
            start.rotation.y = Math.PI / 2;

            // 2. Section 1: "Slalom" (3 Slalom Poles spaced 1.0m apart)
            this.placeObject('pole_1m', new THREE.Vector3(-1.5, 0, 2.0));
            this.placeObject('pole_1m', new THREE.Vector3(-0.5, 0, 2.0));
            this.placeObject('pole_1m', new THREE.Vector3(0.5, 0, 2.0));

            // 3. Section 2: "Forward Up & Under" Gate Frame (1m x 1m) at (+1.5m, +2.0m)
            const fwdGate = this.placeObject('gate_1m', new THREE.Vector3(1.5, 0, 2.0));
            fwdGate.rotation.y = Math.PI / 2;

            // 4. Section 3: "Landing Pad 1" (Yellow Circle - 0.5m Diameter) at (+2.0m, +2.0m)
            this.placeObject('helipad', new THREE.Vector3(2.0, 0, 2.0));

            // 5. Section 4: "Figure of 8" Weaving Slalom Poles along right side at (+2.0m, +1.0m) and (+2.0m, 0.0m)
            this.placeObject('pole_1m', new THREE.Vector3(2.0, 0, 1.0));
            this.placeObject('pole_1m', new THREE.Vector3(2.0, 0, 0.0));

            // 6. Section 5: "Through the Tunnel" at (+2.0m, -1.0m)
            const tunnel = this.placeObject('tunnel', new THREE.Vector3(2.0, 0, -1.5));

            // 7. Section 6: "Landing Pad 2" (Yellow Circle - 0.5m Diameter) at (+2.0m, -2.0m)
            this.placeObject('helipad', new THREE.Vector3(2.0, 0, -3.0));

            // 8. Section 7: "Sideward Up & Under" Gate Frame (1m x 1m) at (+1.0m, -2.0m)
            const sideGate = this.placeObject('gate_1m', new THREE.Vector3(0.5, 0, -3.0));

            // 9. Section 8: "Point of Interest" (POI) Ring at (0.0m, -2.0m)
            this.placeObject('pole_1m', new THREE.Vector3(-1.0, 0, -3.0));


            // 10. Section 9: "Landing Pad 3" (Yellow Circle - 0.5m Diameter) at (-2.0m, -2.0m)
            this.placeObject('helipad', new THREE.Vector3(-2.0, 0, -3.0));

            this.deselectObject();
        } else if (presetName === 'cyber') {
            const start = this.placeObject('start_gate', new THREE.Vector3(0, 0, -2.0));
            const ring1 = this.placeObject('ring', new THREE.Vector3(0, 0, -5.0));
            const ring2 = this.placeObject('ring', new THREE.Vector3(3.0, 0, -8.0));
            ring2.rotation.y = Math.PI / 4;
            const boost = this.placeObject('boost', new THREE.Vector3(6.0, 0, -5.0));
            boost.rotation.y = Math.PI / 2;
            const tunnel = this.placeObject('tunnel', new THREE.Vector3(7.0, 0, 0));
            tunnel.rotation.y = Math.PI / 2;
            const helipad = this.placeObject('helipad', new THREE.Vector3(-3.0, 0, 3.0));
        } else if (presetName === 'slalom') {
            this.placeObject('start_gate', new THREE.Vector3(0, 0, -2.0));
            for (let i = 1; i <= 6; i++) {
                const x = (i % 2 === 0) ? 1.0 : -1.0;
                this.placeObject('slalom', new THREE.Vector3(x, 0, -i * 2.0));
            }
            this.placeObject('ring', new THREE.Vector3(0, 0, -14.0));
        } else if (presetName === 'canyon') {
            this.placeObject('start_gate', new THREE.Vector3(0, 0, -2.0));
            this.placeObject('ring', new THREE.Vector3(0, 0, -5.0));
            this.placeObject('tunnel', new THREE.Vector3(-2.0, 0, -8.0));
            this.placeObject('barrier', new THREE.Vector3(0, 0, -11.0));
            this.placeObject('boost', new THREE.Vector3(2.0, 0, -14.0));
            this.placeObject('ring', new THREE.Vector3(0, 0, -17.0));
        }
    }

    // Save & Load Tracks
    exportToJSON() {
        const data = this.trackObjects.map(obj => ({
            type: obj.userData.type,
            pos: [obj.position.x, obj.position.y, obj.position.z],
            rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z]
        }));
        return JSON.stringify(data, null, 2);
    }

    importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.clearTrack();
            data.forEach(item => {
                const obj = TrackObjectFactory.createObject(item.type);
                obj.position.set(...item.pos);
                obj.rotation.set(...item.rot);
                this.scene.add(obj);
                this.trackObjects.push(obj);
            });
            return true;
        } catch (e) {
            console.error("Invalid Track JSON:", e);
            return false;
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('aerox_custom_track', this.exportToJSON());
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('aerox_custom_track');
        if (saved) {
            return this.importFromJSON(saved);
        }
        return false;
    }
}
