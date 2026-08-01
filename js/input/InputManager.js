export class InputManager {
    constructor() {
        this.keys = {};
        
        // Control Axis Output Values (-1.0 to +1.0, throttle 0.0 to 1.0, 0.5 = neutral center hover)
        this.inputs = {
            throttle: 0.5,
            roll: 0.0,
            pitch: 0.0,
            yaw: 0.0,
            brake: false
        };

        // Default Keybindings Map
        this.defaultBindings = {
            throttleUp: 'KeyW',
            throttleDown: 'KeyS',
            yawLeft: 'KeyA',
            yawRight: 'KeyD',
            pitchForward: 'ArrowUp',
            pitchBackward: 'ArrowDown',
            rollLeft: 'ArrowLeft',
            rollRight: 'ArrowRight',
            brake: 'Space',
            camera: 'KeyC',
            mode: 'KeyM',
            editor: 'KeyE',
            reset: 'KeyR'
        };

        // Default Joystick & Gamepad Calibration Settings (Inverted Pitch & Roll)
        this.defaultJoystickSettings = {
            mode: 2,           // Mode 2 (Left: Throttle/Yaw, Right: Pitch/Roll) or Mode 1
            expo: 0.3,          // Stick Expo curve
            deadzone: 0.08,     // Stick Deadzone threshold
            invertThrottle: false,
            invertPitch: true,  // Pitch Inverted
            invertRoll: true,   // Roll Inverted
            invertYaw: false,
            axisThrottle: 1,
            axisYaw: 0,
            axisPitch: 3,
            axisRoll: 2
        };

        this.keyBindings = { ...this.defaultBindings };
        this.joystickSettings = { ...this.defaultJoystickSettings };
        this.loadSettings();

        // Virtual Touch Joystick Touch/Mouse State
        this.touchInputs = {
            leftX: 0, leftY: 0,
            rightX: 0, rightY: 0
        };

        // Event Callbacks
        this.onCameraToggle = null;
        this.onModeToggle = null;
        this.onEditorToggle = null;
        this.onResetDrone = null;
        this.onRotateEditorItem = null;
        this.onDeleteEditorItem = null;

        // Key rebind listening state
        this.rebindTargetAction = null;
        this.onRebindComplete = null;

        // Initialize Keyboard Event Listeners
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    loadSettings() {
        const savedKeys = localStorage.getItem('aerox_keybindings');
        if (savedKeys) {
            try { this.keyBindings = { ...this.defaultBindings, ...JSON.parse(savedKeys) }; } catch (e) {}
        }
        const savedJoy = localStorage.getItem('aerox_joystick_settings');
        if (savedJoy) {
            try {
                this.joystickSettings = { ...this.defaultJoystickSettings, ...JSON.parse(savedJoy) };
            } catch (e) {}
        } else {
            this.saveSettings();
        }
    }

    saveSettings() {
        localStorage.setItem('aerox_keybindings', JSON.stringify(this.keyBindings));
        localStorage.setItem('aerox_joystick_settings', JSON.stringify(this.joystickSettings));
    }

    resetJoystickSettings() {
        this.joystickSettings = { ...this.defaultJoystickSettings };
        this.saveSettings();
    }

    resetKeyBindings() {
        this.keyBindings = { ...this.defaultBindings };
        this.saveSettings();
    }

    rebindKey(action, keyCode) {
        if (this.keyBindings.hasOwnProperty(action)) {
            this.keyBindings[action] = keyCode;
            this.saveSettings();
        }
    }

    getKeyDisplayName(keyCode) {
        if (!keyCode) return 'NONE';
        if (keyCode.startsWith('Key')) return keyCode.replace('Key', '');
        if (keyCode.startsWith('Digit')) return keyCode.replace('Digit', '');
        switch (keyCode) {
            case 'ArrowUp': return '↑';
            case 'ArrowDown': return '↓';
            case 'ArrowLeft': return '←';
            case 'ArrowRight': return '→';
            case 'Space': return 'SPACE';
            case 'ControlLeft': case 'ControlRight': return 'CTRL';
            case 'ShiftLeft': case 'ShiftRight': return 'SHIFT';
            case 'AltLeft': case 'AltRight': return 'ALT';
            default: return keyCode;
        }
    }

    onKeyDown(e) {
        if (this.rebindTargetAction) {
            e.preventDefault();
            const action = this.rebindTargetAction;
            this.rebindKey(action, e.code);
            this.rebindTargetAction = null;
            if (this.onRebindComplete) this.onRebindComplete(action, e.code);
            return;
        }

        this.keys[e.code] = true;

        if (e.code === this.keyBindings.camera && this.onCameraToggle) this.onCameraToggle();
        if (e.code === this.keyBindings.mode && this.onModeToggle) this.onModeToggle();
        if (e.code === this.keyBindings.editor && this.onEditorToggle) this.onEditorToggle();
        if (e.code === this.keyBindings.reset && this.onResetDrone) this.onResetDrone();
        if (e.code === this.keyBindings.reset && this.onRotateEditorItem) this.onRotateEditorItem();
        if ((e.code === 'Delete' || e.code === 'Backspace') && this.onDeleteEditorItem) this.onDeleteEditorItem();
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
    }

    // Apply Deadzone & Exponential Stick Curve
    processStickAxis(val) {
        const dz = this.joystickSettings.deadzone;
        if (Math.abs(val) < dz) return 0.0;

        const sign = Math.sign(val);
        const norm = (Math.abs(val) - dz) / (1.0 - dz);
        const expo = this.joystickSettings.expo;
        const shaped = norm * (1.0 - expo) + Math.pow(norm, 3) * expo;
        return sign * shaped;
    }

    update() {
        // 1. Keyboard Axis Inputs
        let kbThrottleDelta = 0.0;
        let kbRoll = 0.0;
        let kbPitch = 0.0;
        let kbYaw = 0.0;
        let brake = false;

        if (this.keys[this.keyBindings.throttleUp]) kbThrottleDelta += 0.5;
        if (this.keys[this.keyBindings.throttleDown]) kbThrottleDelta -= 0.5;
        if (this.keys[this.keyBindings.yawLeft]) kbYaw -= 1.0;
        if (this.keys[this.keyBindings.yawRight]) kbYaw += 1.0;
        if (this.keys[this.keyBindings.pitchForward]) kbPitch += 1.0;
        if (this.keys[this.keyBindings.pitchBackward]) kbPitch -= 1.0;
        if (this.keys[this.keyBindings.rollLeft]) kbRoll -= 1.0;
        if (this.keys[this.keyBindings.rollRight]) kbRoll += 1.0;
        if (this.keys[this.keyBindings.brake]) brake = true;

        // 2. Virtual Touch Joystick Inputs
        let joyStickThrotY = 0.0;
        let joyRoll = 0.0;
        let joyPitch = 0.0;
        let joyYaw = 0.0;

        if (this.joystickSettings.mode === 2) {
            // Mode 2: Left = Throttle (Y) & Yaw (X), Right = Pitch (Y) & Roll (X)
            joyStickThrotY = -this.processStickAxis(this.touchInputs.leftY);
            joyYaw = this.processStickAxis(this.touchInputs.leftX);
            joyPitch = -this.processStickAxis(this.touchInputs.rightY);
            joyRoll = this.processStickAxis(this.touchInputs.rightX);
        } else {
            // Mode 1: Left = Pitch (Y) & Yaw (X), Right = Throttle (Y) & Roll (X)
            joyPitch = -this.processStickAxis(this.touchInputs.leftY);
            joyYaw = this.processStickAxis(this.touchInputs.leftX);
            joyStickThrotY = -this.processStickAxis(this.touchInputs.rightY);
            joyRoll = this.processStickAxis(this.touchInputs.rightX);
        }

        // 3. Web Gamepad API Inputs
        let gpThrotY = 0.0;
        let gpRoll = 0.0;
        let gpPitch = 0.0;
        let gpYaw = 0.0;
        let hasGamepad = false;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp && gp.axes.length >= 4) {
                const s = this.joystickSettings;
                gpThrotY = this.processStickAxis(-gp.axes[s.axisThrottle] || 0);
                gpYaw = this.processStickAxis(gp.axes[s.axisYaw] || 0);
                gpPitch = this.processStickAxis(-gp.axes[s.axisPitch] || 0);
                gpRoll = this.processStickAxis(gp.axes[s.axisRoll] || 0);
                hasGamepad = true;
                break;
            }
        }

        // Calculate Neutral Throttle centered at 0.5 (Static Hover)
        let throtOffset = kbThrottleDelta + (joyStickThrotY * 0.5) + (gpThrotY * 0.5);
        let finalThrottle = 0.5 + throtOffset;

        let finalYaw = kbYaw + joyYaw + gpYaw;
        let finalPitch = kbPitch + joyPitch + gpPitch;
        let finalRoll = kbRoll + joyRoll + gpRoll;

        // Apply Axis Inversions if enabled
        if (this.joystickSettings.invertThrottle) finalThrottle = 1.0 - finalThrottle;
        if (this.joystickSettings.invertPitch) finalPitch = -finalPitch;
        if (this.joystickSettings.invertRoll) finalRoll = -finalRoll;
        if (this.joystickSettings.invertYaw) finalYaw = -finalYaw;

        // Clamp & Assign Final State
        this.inputs.throttle = Math.max(0.0, Math.min(1.0, finalThrottle));
        this.inputs.roll = Math.max(-1.0, Math.min(1.0, finalRoll));
        this.inputs.pitch = Math.max(-1.0, Math.min(1.0, finalPitch));
        this.inputs.yaw = Math.max(-1.0, Math.min(1.0, finalYaw));
        this.inputs.brake = brake;

        return this.inputs;
    }
}
