import * as THREE from 'three';
import { SceneManager } from './engine/SceneManager.js';
import { EnvironmentManager } from './engine/Environment.js';
import { DroneModel } from './drone/DroneModel.js';
import { DronePhysics } from './physics/DronePhysics.js';
import { InputManager } from './input/InputManager.js';
import { TrackEditor } from './editor/TrackEditor.js';
import { HUDController } from './ui/HUDController.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { RaceManager } from './gameplay/RaceManager.js';

class Application {
    constructor() {
        // 1. Initialize Canvas & Scene Manager
        this.canvas = document.getElementById('webgl-canvas');
        this.sceneManager = new SceneManager(this.canvas);

        // 2. Initialize Environment
        this.environment = new EnvironmentManager(this.sceneManager);
        this.environment.loadEnvironment('school_hall');
        document.getElementById('stat-env-name').innerText = "SCHOOL HALL";

        // 3. Initialize Audio
        this.audio = new AudioEngine();

        // 4. Initialize Drone Model & Physics
        this.droneModel = new DroneModel(this.sceneManager.scene);
        this.physics = new DronePhysics(this.droneModel);

        // 5. Initialize Race & Track Systems
        this.raceManager = new RaceManager(this.physics, this.audio);
        this.trackEditor = new TrackEditor(this.sceneManager);
        this.trackEditor.loadPresetTrack('manual_plan');
        this.raceManager.scanTrackObjects(this.trackEditor.trackObjects);
        this.resetDroneToStartGate();

        // 6. Initialize HUD & Input
        this.hud = new HUDController(this.physics, this.raceManager);
        this.input = new InputManager();

        // Application State
        this.currentMode = 'FLY'; // 'FLY' or 'BUILD'
        this.lastTime = performance.now();

        // Setup Event Handlers & Start Loop
        this.setupInputHandlers();
        this.setupUIListeners();
        this.startLoop();

        this.showToast("Welcome to AeroX 3D Drone Simulator & Sandbox!");
    }

    setMode(mode) {
        this.currentMode = mode;
        const flyBtn = document.getElementById('btn-mode-fly');
        const buildBtn = document.getElementById('btn-mode-build');
        const hudOverlay = document.getElementById('hud-overlay');
        const editorOverlay = document.getElementById('editor-overlay');

        if (mode === 'BUILD') {
            flyBtn.classList.remove('active');
            buildBtn.classList.add('active');
            hudOverlay.classList.add('hidden');
            editorOverlay.classList.remove('hidden');

            this.trackEditor.setEnabled(true);
            this.sceneManager.setCameraMode('BUILDER');
            this.showToast("🛠️ Sandbox Track Builder Mode Active");
        } else {
            buildBtn.classList.remove('active');
            flyBtn.classList.add('active');
            editorOverlay.classList.add('hidden');
            hudOverlay.classList.remove('hidden');

            this.trackEditor.setEnabled(false);
            this.sceneManager.setCameraMode('CHASE', this.droneModel.mesh);
            this.raceManager.scanTrackObjects(this.trackEditor.trackObjects);
            this.showToast("🎮 Fly Mode Active - Ready for Takeoff!");
        }
    }

    setupInputHandlers() {
        // Toggle Camera Mode
        this.input.onCameraToggle = () => {
            if (this.currentMode !== 'FLY') return;
            const modes = ['CHASE', 'FPV', 'ORBIT'];
            const idx = modes.indexOf(this.sceneManager.activeCameraMode);
            const nextMode = modes[(idx + 1) % modes.length];
            this.sceneManager.setCameraMode(nextMode, this.droneModel.mesh);

            const camNameEl = document.getElementById('cam-name');
            if (camNameEl) camNameEl.innerText = nextMode;
            this.showToast(`Camera: ${nextMode}`);
        };

        // Toggle Flight Mode (Stabilized / Acro / Hover)
        this.input.onModeToggle = () => {
            const modes = ['STABILIZED', 'ACRO', 'HOVER'];
            const idx = modes.indexOf(this.physics.flightMode);
            this.physics.flightMode = modes[(idx + 1) % modes.length];
            this.showToast(`Flight Mode: ${this.physics.flightMode}`);
        };

        // Toggle Track Builder Sandbox Mode (E)
        this.input.onEditorToggle = () => {
            this.setMode(this.currentMode === 'FLY' ? 'BUILD' : 'FLY');
        };

        // Reset Drone Position to Start Arch Takeoff Pad (R key)
        this.input.onResetDrone = () => {
            if (this.currentMode === 'FLY') {
                this.resetDroneToStartGate();
            }
        };

        this.input.onRotateEditorItem = () => {
            if (this.currentMode === 'BUILD') this.trackEditor.rotateSelected();
        };

        this.input.onDeleteEditorItem = () => {
            if (this.currentMode === 'BUILD') this.trackEditor.deleteSelected();
        };
    }

    resetDroneToStartGate() {
        const startArch = this.trackEditor.trackObjects.find(
            obj => obj.userData.type === 'start_gate' || obj.userData.isStartGate
        );

        if (startArch) {
            const rotY = startArch.rotation.y;
            this.physics.resetPosition(startArch.position.x, 0.18, startArch.position.z);
            this.physics.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
            this.showToast("🚀 Drone ready at Start Arch Takeoff Pad!");
        } else {
            this.physics.resetPosition(0, 0.18, 0);
            this.showToast("🚀 Drone reset to center!");
        }
    }

    setupUIListeners() {
        // Mode Switch Buttons
        document.getElementById('btn-mode-fly').addEventListener('click', () => this.setMode('FLY'));
        document.getElementById('btn-mode-build').addEventListener('click', () => this.setMode('BUILD'));
        document.getElementById('btn-playtest-track').addEventListener('click', () => this.setMode('FLY'));

        // Sound Toggle
        document.getElementById('btn-sound-toggle').addEventListener('click', () => {
            this.audio.init();
            const muted = this.audio.toggleMute();
            document.getElementById('btn-sound-toggle').innerText = muted ? "🔇" : "🔊";
        });

        // Camera Toggle Header Button
        document.getElementById('btn-camera-toggle').addEventListener('click', () => {
            if (this.input.onCameraToggle) this.input.onCameraToggle();
        });

        // Modals Toggle
        document.getElementById('btn-settings-toggle').addEventListener('click', () => {
            document.getElementById('modal-settings').classList.remove('hidden');
        });
        document.getElementById('btn-help-toggle').addEventListener('click', () => {
            document.getElementById('modal-help').classList.remove('hidden');
        });

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.getAttribute('data-modal');
                if (modalId) document.getElementById(modalId).classList.add('hidden');
            });
        });

        // Track Builder Object Palette Buttons
        document.querySelectorAll('.palette-item').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.palette-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.getAttribute('data-type');
                this.trackEditor.setSelectedType(type);
            });
        });

        // 3D Ruler Grid & Tape Measure Controls
        const btnRuler = document.getElementById('btn-toggle-ruler');
        if (btnRuler) {
            btnRuler.addEventListener('click', () => {
                this.trackEditor.toggleRulerVisibility();
                const active = this.trackEditor.rulerVisible;
                btnRuler.classList.toggle('active', active);
                this.showToast(active ? "📐 3D Metric Floor Ruler Enabled" : "3D Ruler Disabled");
            });
        }

        const btnTape = document.getElementById('btn-measure-tape');
        if (btnTape) {
            btnTape.addEventListener('click', () => {
                const active = this.trackEditor.toggleMeasuringMode();
                btnTape.classList.toggle('active', active);
                this.showToast(active ? "📏 Laser Tape Measure Active: Click 2 points on ground" : "Tape Measure Deactivated");
            });
        }

        // Sandbox Tool Mode Selector (Select vs Place)
        const toolSelect = document.getElementById('tool-select');
        const toolPlace = document.getElementById('tool-place');
        if (toolSelect && toolPlace) {
            toolSelect.addEventListener('click', () => {
                this.trackEditor.activeTool = 'select';
                toolSelect.classList.add('active');
                toolPlace.classList.remove('active');
                this.showToast("🖐️ Select & Drag/Move Mode Active");
            });
            toolPlace.addEventListener('click', () => {
                this.trackEditor.activeTool = 'place';
                toolPlace.classList.add('active');
                toolSelect.classList.remove('active');
                this.showToast("➕ Place Mode: Click ground to place item");
            });
        }

        // Editor Action Buttons
        document.getElementById('btn-rotate-item').addEventListener('click', () => this.trackEditor.rotateSelected());
        document.getElementById('btn-elevate-up').addEventListener('click', () => this.trackEditor.elevateSelected(0.5));
        document.getElementById('btn-elevate-down').addEventListener('click', () => this.trackEditor.elevateSelected(-0.5));
        document.getElementById('btn-delete-item').addEventListener('click', () => this.trackEditor.deleteSelected());
        document.getElementById('btn-clear-track').addEventListener('click', () => {
            this.trackEditor.clearTrack();
            this.showToast("Track cleared");
        });

        // Track Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                this.trackEditor.loadPresetTrack(preset);
                this.showToast(`Loaded Preset: ${preset.toUpperCase()}`);
            });
        });

        // Save & Load File Actions
        document.getElementById('btn-save-local').addEventListener('click', () => {
            this.trackEditor.saveToLocalStorage();
            this.showToast("💾 Saved track to LocalStorage!");
        });

        document.getElementById('btn-load-local').addEventListener('click', () => {
            const success = this.trackEditor.loadFromLocalStorage();
            this.showToast(success ? "📂 Loaded track from LocalStorage!" : "No saved track found!");
        });

        document.getElementById('btn-export-json').addEventListener('click', () => {
            const json = this.trackEditor.exportToJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'aerox_custom_track.json';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast("📤 Exported JSON file!");
        });

        document.getElementById('btn-import-trigger').addEventListener('click', () => {
            document.getElementById('file-import-json').click();
        });

        document.getElementById('file-import-json').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const success = this.trackEditor.importFromJSON(evt.target.result);
                    this.showToast(success ? "📥 Imported custom track!" : "Failed to parse JSON track!");
                };
                reader.readAsText(file);
            }
        });

        // Settings Modal Controls
        document.getElementById('setting-env-select').addEventListener('change', (e) => {
            const env = e.target.value;
            this.environment.loadEnvironment(env);
            document.getElementById('stat-env-name').innerText = env.toUpperCase();
            this.showToast(`Environment: ${env.toUpperCase()}`);
        });

        document.getElementById('setting-drone-model').addEventListener('change', (e) => {
            const modelType = e.target.value;
            this.droneModel.buildDrone(modelType);
            this.showToast(`Drone Model: ${modelType.toUpperCase()}`);
        });

        // Keybindings Configurator Event Handlers
        this.updateKeybindUI();
        document.querySelectorAll('.keybind-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                if (!action) return;

                document.querySelectorAll('.keybind-btn').forEach(b => b.classList.remove('listening'));

                btn.classList.add('listening');
                btn.innerText = 'PRESS KEY...';

                this.input.rebindTargetAction = action;
                this.input.onRebindComplete = (reboundAction, newCode) => {
                    btn.classList.remove('listening');
                    this.updateKeybindUI();
                    this.showToast(`Rebound ${reboundAction} to [${this.input.getKeyDisplayName(newCode)}]`);
                };
            });
        });

        const resetKbBtn = document.getElementById('btn-reset-keybinds');
        if (resetKbBtn) {
            resetKbBtn.addEventListener('click', () => {
                this.input.resetKeyBindings();
                this.updateKeybindUI();
                this.showToast("Reset all control buttons to default!");
            });
        }

        // Joystick & Controller Settings Handlers
        this.setupTouchJoysticks();
        this.updateJoystickUI();

        document.getElementById('joy-mode-select').addEventListener('change', (e) => {
            this.input.joystickSettings.mode = parseInt(e.target.value);
            this.input.saveSettings();
            this.updateJoystickUI();
            this.showToast(`Joystick Mode: ${e.target.value === '1' ? 'Mode 1' : 'Mode 2'}`);
        });

        document.getElementById('joy-expo-slider').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.input.joystickSettings.expo = val;
            document.getElementById('joy-expo-val').innerText = val.toFixed(2);
            this.input.saveSettings();
        });

        document.getElementById('joy-deadzone-slider').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.input.joystickSettings.deadzone = val;
            document.getElementById('joy-deadzone-val').innerText = val.toFixed(2);
            this.input.saveSettings();
        });

        document.getElementById('joy-show-touch').addEventListener('change', (e) => {
            const val = e.target.value;
            const container = document.getElementById('touch-joysticks-container');
            if (container) {
                if (val === 'never') container.classList.add('hidden');
                else container.classList.remove('hidden');
            }
        });

        const bindCheck = (id, prop) => {
            document.getElementById(id).addEventListener('change', (e) => {
                this.input.joystickSettings[prop] = e.target.checked;
                this.input.saveSettings();
            });
        };
        bindCheck('joy-inv-throt', 'invertThrottle');
        bindCheck('joy-inv-pitch', 'invertPitch');
        bindCheck('joy-inv-roll', 'invertRoll');
        bindCheck('joy-inv-yaw', 'invertYaw');

        document.getElementById('btn-reset-joystick').addEventListener('click', () => {
            this.input.resetJoystickSettings();
            this.updateJoystickUI();
            this.showToast("Reset joystick settings to default!");
        });

        // Unlock Web Audio on first user interaction click
        window.addEventListener('click', () => this.audio.init(), { once: true });
    }

    setupTouchJoysticks() {
        const setupStick = (baseId, stickId, onMove) => {
            const base = document.getElementById(baseId);
            const stick = document.getElementById(stickId);
            if (!base || !stick) return;

            let dragging = false;
            const radius = 45;

            const handleMove = (clientX, clientY) => {
                const rect = base.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                let dx = clientX - centerX;
                let dy = clientY - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > radius) {
                    dx = (dx / dist) * radius;
                    dy = (dy / dist) * radius;
                }

                stick.style.transform = `translate(${dx}px, ${dy}px)`;
                onMove(dx / radius, dy / radius);
            };

            const endMove = () => {
                dragging = false;
                stick.style.transform = `translate(0px, 0px)`;
                onMove(0, 0);
            };

            base.addEventListener('pointerdown', (e) => {
                dragging = true;
                base.setPointerCapture(e.pointerId);
                handleMove(e.clientX, e.clientY);
            });

            base.addEventListener('pointermove', (e) => {
                if (dragging) handleMove(e.clientX, e.clientY);
            });

            base.addEventListener('pointerup', endMove);
            base.addEventListener('pointercancel', endMove);
        };

        setupStick('left-joystick-base', 'left-joystick-stick', (x, y) => {
            this.input.touchInputs.leftX = x;
            this.input.touchInputs.leftY = y;
        });

        setupStick('right-joystick-base', 'right-joystick-stick', (x, y) => {
            this.input.touchInputs.rightX = x;
            this.input.touchInputs.rightY = y;
        });
    }

    updateJoystickUI() {
        const s = this.input.joystickSettings;
        const modeSel = document.getElementById('joy-mode-select');
        if (modeSel) modeSel.value = s.mode;

        const expoSlider = document.getElementById('joy-expo-slider');
        const expoVal = document.getElementById('joy-expo-val');
        if (expoSlider && expoVal) {
            expoSlider.value = s.expo;
            expoVal.innerText = parseFloat(s.expo).toFixed(2);
        }

        const dzSlider = document.getElementById('joy-deadzone-slider');
        const dzVal = document.getElementById('joy-deadzone-val');
        if (dzSlider && dzVal) {
            dzSlider.value = s.deadzone;
            dzVal.innerText = parseFloat(s.deadzone).toFixed(2);
        }

        document.getElementById('joy-inv-throt').checked = s.invertThrottle;
        document.getElementById('joy-inv-pitch').checked = s.invertPitch;
        document.getElementById('joy-inv-roll').checked = s.invertRoll;
        document.getElementById('joy-inv-yaw').checked = s.invertYaw;

        const lLabel = document.getElementById('left-joy-label');
        const rLabel = document.getElementById('right-joy-label');
        if (lLabel && rLabel) {
            if (parseInt(s.mode) === 1) {
                lLabel.innerText = "PITCH / YAW";
                rLabel.innerText = "THROTTLE / ROLL";
            } else {
                lLabel.innerText = "THROTTLE / YAW";
                rLabel.innerText = "PITCH / ROLL";
            }
        }
    }

    updateKeybindUI() {
        document.querySelectorAll('.keybind-btn').forEach(btn => {
            const action = btn.getAttribute('data-action');
            if (action && this.input.keyBindings[action]) {
                const keyCode = this.input.keyBindings[action];
                btn.innerText = this.input.getKeyDisplayName(keyCode);
            }
        });
    }

    startLoop() {
        const loop = (now) => {
            const delta = Math.min((now - this.lastTime) / 1000, 0.1);
            this.lastTime = now;

            // 1. Process Input
            const inputs = this.input.update();

            // 2. Update Drone Physics in Fly Mode with 3D Prop Collision Checking
            if (this.currentMode === 'FLY') {
                this.physics.update(inputs, delta, this.trackEditor.trackObjects);
                this.audio.updateMotorSound(this.physics.motorPowers);
                this.raceManager.update(delta);
                this.hud.update(delta);
            }

            // 3. Update Camera
            this.sceneManager.updateCamera(this.droneModel.mesh, this.physics.quaternion, delta);

            // 4. Render 3D Scene
            this.sceneManager.render();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Instantiate on DOM Load
window.addEventListener('DOMContentLoaded', () => {
    new Application();
});
