import * as THREE from 'three';
import { SceneManager } from './engine/SceneManager.js';
import { EnvironmentManager } from './engine/Environment.js';
import { DroneModel } from './drone/DroneModel.js';
import { DronePhysics } from './physics/DronePhysics.js';
import { DroneTrail } from './drone/DroneTrail.js';
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
        const envStat = document.getElementById('stat-env-name');
        if (envStat) envStat.innerText = "SCHOOL HALL";

        // 3. Initialize Audio
        this.audio = new AudioEngine();

        // 4. Initialize Drone Model, Physics & 3D Flight Trail
        this.droneModel = new DroneModel(this.sceneManager.scene);
        this.physics = new DronePhysics(this.droneModel);
        this.droneTrail = new DroneTrail(this.sceneManager.scene);

        // Crash Collision Handler
        this.physics.onCrash = (propType) => this.handleDroneCrash(propType);

        // 5. Initialize Race & Track Systems
        this.raceManager = new RaceManager(this.physics, this.audio);
        this.trackEditor = new TrackEditor(this.sceneManager);
        this.lastCheckpoint = null;

        this.raceManager.onHelipadCheckpointSaved = (pos, rotY, padMesh) => {
            this.lastCheckpoint = { position: pos, rotationY: rotY };
            if (this.audio) this.audio.playCheckpointSound();
            this.showToast("🚩 Checkpoint Saved: Helipad Landing Pad!");
        };

        this.trackEditor.loadPresetTrack('manual_plan');
        this.raceManager.scanTrackObjects(this.trackEditor.trackObjects);
        this.resetDroneToStartGate();

        // 6. Initialize HUD & Input
        this.hud = new HUDController(this.physics, this.raceManager);
        this.input = new InputManager();

        // Application State
        this.currentMode = 'FLY'; // 'FLY' or 'BUILD'
        this.hudMode = localStorage.getItem('aerox_hud_mode') || 'full';
        this.checkpointResetEnabled = localStorage.getItem('aerox_cp_reset') !== 'false'; // Default ON
        this.collisionResetEnabled = localStorage.getItem('aerox_collision_reset') !== 'false'; // Default ON
        this.lastTime = performance.now();
        this.topBarAutoHideEnabled = true;
        this.topBarHideTimer = null;

        // Setup Event Handlers, Auto-Hide Header & Start Loop
        this.setupInputHandlers();
        this.setupUIListeners();
        this.updateCheckpointResetUI();
        this.updateCollisionResetUI();
        this.initTopBarAutoHide();
        this.setHUDMode(this.hudMode);
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

        // Toggle Motor Power / Arm (X key or Gamepad Start)
        this.input.onPowerToggle = () => {
            this.togglePower();
        };

        // Toggle Flight Mode (Stabilized / Acro / Hover)
        this.input.onModeToggle = () => {
            const modes = ['STABILIZED', 'ACRO', 'HOVER'];
            const idx = modes.indexOf(this.physics.flightMode);
            this.physics.flightMode = modes[(idx + 1) % modes.length];
            this.showToast(`Flight Mode: ${this.physics.flightMode}`);
        };

        // Toggle HUD Visibility Mode (H key)
        this.input.onHUDToggle = () => {
            this.toggleHUDMode();
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

    togglePower() {
        const armed = this.physics.toggleArm();
        this.updatePowerUI(armed);
        this.showToast(armed ? "🟢 Drone Engine ARMED (POWER ON)" : "🔴 Drone Engine DISARMED (POWER OFF)");
    }

    updatePowerUI(armed) {
        const btn = document.getElementById('btn-power-toggle');
        const label = document.getElementById('power-status-label');
        if (btn && label) {
            btn.classList.toggle('active', armed);
            btn.classList.toggle('disarmed', !armed);
            label.innerText = armed ? "ARMED" : "DISARMED";
        }

        const stat = document.getElementById('stat-power-state');
        if (stat) {
            stat.innerText = armed ? "ARMED" : "DISARMED";
            stat.classList.toggle('highlight-mode', armed);
            stat.classList.toggle('highlight-disarmed', !armed);
        }
    }

    handleDroneCrash(propType) {
        // 1. Audio Crash Sound
        if (this.audio) {
            this.audio.playCrashSound();
        }

        // 2. Red Flash Overlay Animation
        const overlay = document.getElementById('crash-flash');
        if (overlay) {
            overlay.classList.add('flash-active');
            setTimeout(() => overlay.classList.remove('flash-active'), 350);
        }

        // 3. Notification Toast & Collision Action
        const names = {
            tunnel: 'Tunnel Frame',
            gate_1m: 'Race Gate',
            ring: 'Checkpoint Ring',
            pole_1m: 'Slalom Pole',
            slalom: 'Slalom Pole',
            barrier: 'Barrier Wall'
        };
        const propName = names[propType] || 'Obstacle';

        if (this.collisionResetEnabled) {
            this.showToast(`💥 CRASHED into ${propName}! Restarting flight...`);

            // Auto-Restart Game / Drone Position
            this.resetDroneToStartGate();

            // Reset Active Race Timer if racing
            if (this.raceManager && this.raceManager.isRaceActive) {
                this.raceManager.isRaceActive = false;
                const timerVal = document.getElementById('timer-val');
                if (timerVal) timerVal.innerText = "00:00.000";
            }
        } else {
            this.showToast(`💥 Collided with ${propName}!`);
            // Bounce drone velocity backwards cleanly without auto-resetting position
            this.physics.velocity.multiplyScalar(-0.4);
            this.physics.angularVelocity.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3));
        }
    }

    toggleCollisionReset(enabled) {
        this.collisionResetEnabled = enabled !== undefined ? !!enabled : !this.collisionResetEnabled;
        localStorage.setItem('aerox_collision_reset', this.collisionResetEnabled ? 'true' : 'false');
        this.updateCollisionResetUI();
        this.showToast(this.collisionResetEnabled 
            ? "💥 Auto-Reset on Collision: ON (Restarts Flight on Crash)" 
            : "🛡️ Auto-Reset on Collision: OFF (Bounce Only)"
        );
    }

    updateCollisionResetUI() {
        const sel = document.getElementById('setting-collision-reset');
        if (sel) {
            sel.value = this.collisionResetEnabled ? 'on' : 'off';
        }
    }

    toggleCheckpointReset(enabled) {
        this.checkpointResetEnabled = enabled !== undefined ? !!enabled : !this.checkpointResetEnabled;
        localStorage.setItem('aerox_cp_reset', this.checkpointResetEnabled ? 'true' : 'false');
        this.updateCheckpointResetUI();
        this.showToast(this.checkpointResetEnabled 
            ? "🚩 Helipad Checkpoint Reset: ON (Respawn at Last Checkpoint)" 
            : "🏁 Helipad Checkpoint Reset: OFF (Always Reset to Start Gate)"
        );
    }

    updateCheckpointResetUI() {
        const btn = document.getElementById('btn-checkpoint-toggle');
        const label = document.getElementById('cp-toggle-label');
        if (btn && label) {
            btn.classList.toggle('active', this.checkpointResetEnabled);
            label.innerText = this.checkpointResetEnabled ? "CP ON" : "CP OFF";
        }

        const sel = document.getElementById('setting-checkpoint-reset');
        if (sel) {
            sel.value = this.checkpointResetEnabled ? 'on' : 'off';
        }
    }

    resetDroneToStartGate() {
        if (this.droneTrail) {
            this.droneTrail.clear();
        }

        // 1. Reset to Last Saved Helipad Checkpoint if Checkpoint Reset is ON and a checkpoint exists
        if (this.checkpointResetEnabled && this.lastCheckpoint) {
            const { position, rotationY } = this.lastCheckpoint;
            this.physics.resetPosition(position.x, position.y + 0.18, position.z);
            this.physics.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
            this.showToast("🚩 Drone reset to Last Helipad Checkpoint!");
            return;
        }

        // 2. Fallback to Start Arch / Takeoff Pad (if Checkpoint Reset is OFF or no checkpoint saved)
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
        const on = (id, evt, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(evt, fn);
        };

        // Power / Arm Toggle Button
        on('btn-power-toggle', 'click', () => this.togglePower());

        // Checkpoint Reset Toggle Button
        on('btn-checkpoint-toggle', 'click', () => this.toggleCheckpointReset());

        // Mode Switch Buttons
        on('btn-mode-fly', 'click', () => this.setMode('FLY'));
        on('btn-mode-build', 'click', () => this.setMode('BUILD'));
        on('btn-playtest-track', 'click', () => this.setMode('FLY'));

        // Sound Toggle
        on('btn-sound-toggle', 'click', () => {
            this.audio.init();
            const muted = this.audio.toggleMute();
            const btn = document.getElementById('btn-sound-toggle');
            if (btn) btn.innerText = muted ? "🔇" : "🔊";
        });

        // Camera Toggle Header Button
        on('btn-camera-toggle', 'click', () => {
            if (this.input.onCameraToggle) this.input.onCameraToggle();
        });

        // Modals Toggle & Dismiss Handlers
        const btnSettings = document.getElementById('btn-settings-toggle');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                this.syncSettingsUI();
                const modal = document.getElementById('modal-settings');
                if (modal) modal.classList.remove('hidden');
            });
        }

        const btnHelp = document.getElementById('btn-help-toggle');
        if (btnHelp) {
            btnHelp.addEventListener('click', () => {
                const modal = document.getElementById('modal-help');
                if (modal) modal.classList.remove('hidden');
            });
        }

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.getAttribute('data-modal');
                if (modalId) {
                    const modal = document.getElementById(modalId);
                    if (modal) modal.classList.add('hidden');
                }
            });
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.add('hidden'));
            }
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
        on('btn-rotate-item', 'click', () => this.trackEditor.rotateSelected());
        on('btn-elevate-up', 'click', () => this.trackEditor.elevateSelected(0.5));
        on('btn-elevate-down', 'click', () => this.trackEditor.elevateSelected(-0.5));
        on('btn-delete-item', 'click', () => this.trackEditor.deleteSelected());
        on('btn-clear-track', 'click', () => {
            this.trackEditor.clearTrack();
            this.lastCheckpoint = null;
            if (this.raceManager) this.raceManager.scanTrackObjects(this.trackEditor.trackObjects);
            this.showToast("Track cleared");
        });

        // Track Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                if (preset) {
                    this.lastCheckpoint = null;
                    this.trackEditor.loadPresetTrack(preset);
                    if (this.raceManager) this.raceManager.scanTrackObjects(this.trackEditor.trackObjects);
                    this.resetDroneToStartGate();
                    this.showToast(`Loaded Preset: ${preset.toUpperCase()}`);
                }
            });
        });

        // Save & Load File Actions
        on('btn-save-local', 'click', () => {
            this.trackEditor.saveToLocalStorage();
            this.showToast("💾 Saved track to LocalStorage!");
        });

        on('btn-load-local', 'click', () => {
            const success = this.trackEditor.loadFromLocalStorage();
            this.showToast(success ? "📂 Loaded track from LocalStorage!" : "No saved track found!");
        });

        on('btn-export-json', 'click', () => {
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

        on('btn-import-trigger', 'click', () => {
            const inp = document.getElementById('file-import-json');
            if (inp) inp.click();
        });

        on('file-import-json', 'change', (e) => {
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
        const envSelect = document.getElementById('setting-env-select');
        if (envSelect) {
            envSelect.addEventListener('change', (e) => {
                const env = e.target.value;
                this.environment.loadEnvironment(env);
                const envStat = document.getElementById('stat-env-name');
                if (envStat) envStat.innerText = env.toUpperCase().replace('_', ' ');
                this.showToast(`Environment: ${env.toUpperCase().replace('_', ' ')}`);
            });
        }

        const droneSelect = document.getElementById('setting-drone-model');
        if (droneSelect) {
            droneSelect.addEventListener('change', (e) => {
                const modelType = e.target.value;
                this.droneModel.buildDrone(modelType);
                this.showToast(`Drone Model: ${modelType.toUpperCase()}`);
            });
        }

        const flightModeSelect = document.getElementById('setting-flight-mode');
        if (flightModeSelect) {
            flightModeSelect.addEventListener('change', (e) => {
                const mode = e.target.value;
                this.physics.flightMode = mode;
                const modeStat = document.getElementById('stat-flight-mode');
                if (modeStat) modeStat.innerText = mode;
                this.showToast(`Flight Mode: ${mode}`);
            });
        }

        const hudModeSelect = document.getElementById('setting-hud-mode');
        if (hudModeSelect) {
            hudModeSelect.addEventListener('change', (e) => {
                this.setHUDMode(e.target.value);
            });
        }

        const trailSelect = document.getElementById('setting-drone-trail');
        if (trailSelect) {
            trailSelect.addEventListener('change', (e) => {
                const enabled = e.target.value === 'on';
                if (this.droneTrail) this.droneTrail.setEnabled(enabled);
                this.showToast(enabled ? "✨ 3D Line Trail Enabled" : "3D Line Trail Hidden");
            });
        }

        const btnClearTrail = document.getElementById('btn-clear-trail');
        if (btnClearTrail) {
            btnClearTrail.addEventListener('click', () => {
                if (this.droneTrail) this.droneTrail.clear();
                this.showToast("🧹 Drone Flight Line Trail Cleared!");
            });
        }

        const autoHideSelect = document.getElementById('setting-autohide-bar');
        if (autoHideSelect) {
            autoHideSelect.addEventListener('change', (e) => {
                this.topBarAutoHideEnabled = e.target.value === 'on';
                const topBar = document.getElementById('top-bar');
                if (topBar && !this.topBarAutoHideEnabled) {
                    topBar.classList.remove('autohide-hidden');
                }
                this.showToast(this.topBarAutoHideEnabled ? "📌 Top Bar Auto-Hide Enabled" : "📌 Top Bar Always Visible");
            });
        }

        const cpResetSelect = document.getElementById('setting-checkpoint-reset');
        if (cpResetSelect) {
            cpResetSelect.addEventListener('change', (e) => {
                this.toggleCheckpointReset(e.target.value === 'on');
            });
        }

        const collisionResetSelect = document.getElementById('setting-collision-reset');
        if (collisionResetSelect) {
            collisionResetSelect.addEventListener('change', (e) => {
                this.toggleCollisionReset(e.target.value === 'on');
            });
        }

        const btnHudToggle = document.getElementById('btn-hud-toggle');
        if (btnHudToggle) {
            btnHudToggle.addEventListener('click', () => {
                this.toggleHUDMode();
            });
        }

        // Speed Toggle & Adjustment Handlers
        const btnSpeedToggle = document.getElementById('btn-speed-toggle');
        if (btnSpeedToggle) {
            btnSpeedToggle.addEventListener('click', () => {
                const speeds = [0.5, 1.0, 1.5, 2.0, 3.0];
                const current = this.physics.speedMultiplier || 1.0;
                let nextIdx = speeds.findIndex(s => Math.abs(s - current) < 0.1) + 1;
                if (nextIdx >= speeds.length) nextIdx = 0;
                this.updateSpeedMultiplier(speeds[nextIdx]);
            });
        }

        const speedSlider = document.getElementById('setting-speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const speedScale = parseFloat(e.target.value);
                this.updateSpeedMultiplier(speedScale);
            });
        }

        document.querySelectorAll('.speed-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const speedScale = parseFloat(btn.getAttribute('data-speed'));
                this.updateSpeedMultiplier(speedScale);
            });
        });

        const windSlider = document.getElementById('setting-wind-slider');
        const windDisp = document.getElementById('val-wind-disp');
        if (windSlider) {
            windSlider.addEventListener('input', (e) => {
                const windSpeed = parseFloat(e.target.value);
                if (windDisp) windDisp.innerText = `${windSpeed} km/h`;
                this.physics.setWind(windSpeed);
            });
        }

        const pidP = document.getElementById('pid-p');
        const pidPVal = document.getElementById('pid-p-val');
        if (pidP) {
            pidP.addEventListener('input', (e) => {
                const pVal = parseFloat(e.target.value);
                if (pidPVal) pidPVal.innerText = pVal.toFixed(1);
                this.physics.pidRoll.kp = pVal;
                this.physics.pidPitch.kp = pVal;
            });
        }

        const pidLevel = document.getElementById('pid-level');
        const pidLevelVal = document.getElementById('pid-level-val');
        if (pidLevel) {
            pidLevel.addEventListener('input', (e) => {
                const levelVal = parseFloat(e.target.value);
                if (pidLevelVal) pidLevelVal.innerText = levelVal.toFixed(1);
                this.physics.levelSensitivity = levelVal;
            });
        }

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

        on('joy-mode-select', 'change', (e) => {
            this.input.joystickSettings.mode = parseInt(e.target.value);
            this.input.saveSettings();
            this.updateJoystickUI();
            this.showToast(`Joystick Mode: ${e.target.value === '1' ? 'Mode 1' : 'Mode 2'}`);
        });

        on('joy-expo-slider', 'input', (e) => {
            const val = parseFloat(e.target.value);
            this.input.joystickSettings.expo = val;
            const disp = document.getElementById('joy-expo-val');
            if (disp) disp.innerText = val.toFixed(2);
            this.input.saveSettings();
        });

        on('joy-deadzone-slider', 'input', (e) => {
            const val = parseFloat(e.target.value);
            this.input.joystickSettings.deadzone = val;
            const disp = document.getElementById('joy-deadzone-val');
            if (disp) disp.innerText = val.toFixed(2);
            this.input.saveSettings();
        });

        on('joy-show-touch', 'change', (e) => {
            const val = e.target.value;
            const container = document.getElementById('touch-joysticks-container');
            if (container) {
                if (val === 'never') container.classList.add('hidden');
                else container.classList.remove('hidden');
            }
        });

        const bindCheck = (id, prop) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.input.joystickSettings[prop] = e.target.checked;
                    this.input.saveSettings();
                });
            }
        };
        bindCheck('joy-inv-throt', 'invertThrottle');
        bindCheck('joy-inv-pitch', 'invertPitch');
        bindCheck('joy-inv-roll', 'invertRoll');
        bindCheck('joy-inv-yaw', 'invertYaw');

        on('btn-reset-joystick', 'click', () => {
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

        const setChk = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };
        setChk('joy-inv-throt', s.invertThrottle);
        setChk('joy-inv-pitch', s.invertPitch);
        setChk('joy-inv-roll', s.invertRoll);
        setChk('joy-inv-yaw', s.invertYaw);

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

    initTopBarAutoHide() {
        const topBar = document.getElementById('top-bar');
        const triggerZone = document.getElementById('top-bar-trigger-zone');
        if (!topBar) return;

        const scheduleHide = () => {
            if (this.topBarHideTimer) clearTimeout(this.topBarHideTimer);
            if (!this.topBarAutoHideEnabled) {
                topBar.classList.remove('autohide-hidden');
                return;
            }

            this.topBarHideTimer = setTimeout(() => {
                const isHovering = topBar.matches(':hover');
                const hasOpenModal = document.querySelector('.modal-overlay:not(.hidden)');
                if (!isHovering && !hasOpenModal) {
                    topBar.classList.add('autohide-hidden');
                } else {
                    scheduleHide();
                }
            }, 2500);
        };

        const reveal = () => {
            topBar.classList.remove('autohide-hidden');
            scheduleHide();
        };

        window.addEventListener('mousemove', () => reveal());
        window.addEventListener('keydown', () => reveal());
        window.addEventListener('touchstart', () => reveal());

        if (triggerZone) {
            triggerZone.addEventListener('mouseenter', () => reveal());
            triggerZone.addEventListener('mousemove', () => reveal());
        }

        topBar.addEventListener('mouseenter', () => {
            topBar.classList.remove('autohide-hidden');
            if (this.topBarHideTimer) clearTimeout(this.topBarHideTimer);
        });

        topBar.addEventListener('mouseleave', () => {
            scheduleHide();
        });

        scheduleHide();
    }

    startLoop() {
        const loop = (now) => {
            const delta = Math.min((now - this.lastTime) / 1000, 0.1);
            this.lastTime = now;

            // 1. Process Input
            const inputs = this.input.update();

            // 2. Update Drone Physics in Fly Mode & Update 3D Line Trail
            if (this.currentMode === 'FLY') {
                this.physics.update(inputs, delta, this.trackEditor.trackObjects);
                if (this.droneTrail) this.droneTrail.update(this.physics.position);
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

    openModal(id) {
        if (id === 'modal-settings') {
            this.syncSettingsUI();
        }
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    setHUDMode(mode) {
        const container = document.getElementById('hud-overlay');
        if (!container) return;

        container.classList.remove('hud-hidden', 'hud-minimal');

        if (mode === 'hidden') {
            container.classList.add('hud-hidden');
        } else if (mode === 'minimal') {
            container.classList.add('hud-minimal');
        }

        this.hudMode = mode;

        const hudSelect = document.getElementById('setting-hud-mode');
        if (hudSelect) hudSelect.value = mode;

        const btn = document.getElementById('btn-hud-toggle');
        if (btn) btn.classList.toggle('active', mode !== 'hidden');

        const labelMap = { full: 'FULL', minimal: 'MIN', hidden: 'OFF' };
        const label = document.getElementById('hud-toggle-label');
        if (label) label.innerText = labelMap[mode] || 'HUD';

        localStorage.setItem('aerox_hud_mode', mode);
    }

    toggleHUDMode() {
        const modes = ['full', 'minimal', 'hidden'];
        const current = this.hudMode || 'full';
        const idx = modes.indexOf(current);
        const nextMode = modes[(idx + 1) % modes.length];
        this.setHUDMode(nextMode);
        this.showToast(`👁️ HUD Overlays: ${nextMode.toUpperCase()}`);
    }

    updateSpeedMultiplier(scale) {
        scale = Math.max(0.2, Math.min(3.0, parseFloat(scale) || 1.0));
        this.physics.setSpeedMultiplier(scale);

        const pct = Math.round(scale * 100);
        const speedDisp = document.getElementById('val-speed-multiplier');
        if (speedDisp) speedDisp.innerText = `${pct}% (${scale.toFixed(1)}x)`;

        const slider = document.getElementById('setting-speed-slider');
        if (slider) slider.value = scale;

        const label = document.getElementById('speed-rate-label');
        if (label) label.innerText = `${scale.toFixed(1)}x`;

        document.querySelectorAll('.speed-preset-btn').forEach(btn => {
            const bSpeed = parseFloat(btn.getAttribute('data-speed'));
            btn.classList.toggle('active', Math.abs(bSpeed - scale) < 0.05);
        });

        this.showToast(`⚡ Flight Speed: ${pct}% (${scale.toFixed(1)}x)`);
    }

    syncSettingsUI() {
        const envSelect = document.getElementById('setting-env-select');
        if (envSelect && this.environment && this.environment.currentEnv) {
            envSelect.value = this.environment.currentEnv;
        }

        const flightModeSelect = document.getElementById('setting-flight-mode');
        if (flightModeSelect && this.physics) {
            flightModeSelect.value = this.physics.flightMode;
        }

        const hudSelect = document.getElementById('setting-hud-mode');
        if (hudSelect) {
            hudSelect.value = this.hudMode || 'full';
        }

        const trailSelect = document.getElementById('setting-drone-trail');
        if (trailSelect && this.droneTrail) {
            trailSelect.value = this.droneTrail.enabled ? 'on' : 'off';
        }

        const autoHideSelect = document.getElementById('setting-autohide-bar');
        if (autoHideSelect) {
            autoHideSelect.value = this.topBarAutoHideEnabled ? 'on' : 'off';
        }

        if (this.physics) {
            const scale = this.physics.speedMultiplier || 1.0;
            const pct = Math.round(scale * 100);
            const speedDisp = document.getElementById('val-speed-multiplier');
            if (speedDisp) speedDisp.innerText = `${pct}% (${scale.toFixed(1)}x)`;

            const slider = document.getElementById('setting-speed-slider');
            if (slider) slider.value = scale;

            const label = document.getElementById('speed-rate-label');
            if (label) label.innerText = `${scale.toFixed(1)}x`;

            document.querySelectorAll('.speed-preset-btn').forEach(btn => {
                const bSpeed = parseFloat(btn.getAttribute('data-speed'));
                btn.classList.toggle('active', Math.abs(bSpeed - scale) < 0.05);
            });
        }

        const pidP = document.getElementById('pid-p');
        const pidPVal = document.getElementById('pid-p-val');
        if (pidP && pidPVal && this.physics && this.physics.pidRoll) {
            pidP.value = this.physics.pidRoll.kp;
            pidPVal.innerText = parseFloat(this.physics.pidRoll.kp).toFixed(1);
        }

        const pidLevel = document.getElementById('pid-level');
        const pidLevelVal = document.getElementById('pid-level-val');
        if (pidLevel && pidLevelVal && this.physics) {
            pidLevel.value = this.physics.levelSensitivity || 8.0;
            pidLevelVal.innerText = parseFloat(this.physics.levelSensitivity || 8.0).toFixed(1);
        }

        const windSlider = document.getElementById('setting-wind-slider');
        const windDisp = document.getElementById('val-wind-disp');
        if (windSlider && windDisp) {
            windDisp.innerText = `${windSlider.value} km/h`;
        }

        this.updateKeybindUI();
        this.updateJoystickUI();
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

// Instantiate immediately or on DOM load (handles ES module race conditions)
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        window.app = new Application();
    });
} else {
    window.app = new Application();
}
