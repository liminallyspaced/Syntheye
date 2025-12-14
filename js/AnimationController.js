// =================================================================================
// --- ANIMATION CONTROLLER - Authoritative Animation State Machine ---
// =================================================================================
// Professional animation system with:
// - Strict clip name mapping (exact canonical names only)
// - Priority-based animation selection
// - Protected one-shot animations (run to completion)
// - Single "finished" event listener pattern
// - Levitation mode (sub-state machine)
// =================================================================================

import * as THREE from 'three';

// =================================================================================
// ANIMATION PRIORITY (higher = more important, cannot be interrupted by lower)
// =================================================================================
const PRIORITY = {
    IDLE: 0,
    WALKING: 1,
    RUNNING: 2,
    TURN: 3,  // Turn_Left_HM and Turn_Right_HM share priority
    LEVITATION_MID_HOLD: 4,
    LEVITATION_START_HOLD: 5,
    LEVITATION_LIFT: 6,
    JUMP: 7,
    PICKUP: 8,
    LEVITATION_THROW: 9
};

// =================================================================================
// CLIP CONFIGURATION - Strict canonical names
// =================================================================================
const CLIP_CONFIG = {
    // Locomotion (loops)
    'Idle_HM': { loop: true, priority: PRIORITY.IDLE, timeScale: 1.0 },
    'Walking_HM': { loop: true, priority: PRIORITY.WALKING, timeScale: 1.0 },
    'Running_HM': { loop: true, priority: PRIORITY.RUNNING, timeScale: 1.0 },

    // Turn-in-place (protected, only when stationary)
    'Turn_Left_HM': { loop: false, priority: PRIORITY.TURN, timeScale: 2.0, protected: true },
    'Turn_Right_HM': { loop: false, priority: PRIORITY.TURN, timeScale: 2.0, protected: true },

    // One-shots (protected)
    'Jump_HM': { loop: false, priority: PRIORITY.JUMP, timeScale: 1.5, protected: true },
    'Pickup_HM': { loop: false, priority: PRIORITY.PICKUP, timeScale: 1.0, protected: true },

    // Levitation mode
    'Levitation_HM': { loop: true, priority: PRIORITY.LEVITATION_MID_HOLD, timeScale: 1.0, levitationMode: true },
    'Levitation_Start_Hold_HM': { loop: false, priority: PRIORITY.LEVITATION_START_HOLD, timeScale: 1.0, protected: true, levitationMode: true },
    'Levitation_Mid_Hold_HM': { loop: true, priority: PRIORITY.LEVITATION_MID_HOLD, timeScale: 1.0, levitationMode: true },
    'Levitation_Lift_HM': { loop: false, priority: PRIORITY.LEVITATION_LIFT, timeScale: 1.0, protected: true, levitationMode: true },
    'Levitation_Throw_HM': { loop: false, priority: PRIORITY.LEVITATION_THROW, timeScale: 1.0, protected: true, levitationMode: true, exitsLevitation: true }
};

// =================================================================================
// ANIMATION CONTROLLER CLASS
// =================================================================================
export class AnimationController {
    constructor() {
        this.mixer = null;
        this.actions = {};           // Map of clipName -> THREE.AnimationAction
        this.currentAction = null;
        this.currentClipName = null;
        this.currentPriority = -1;

        // Protected one-shot lock
        this.protectedLock = false;
        this.protectedClipName = null;

        // Levitation mode
        this.levitationEnabled = false;

        // Single finished listener (never removed/re-added)
        this.finishedListenerAttached = false;

        // Crossfade duration
        this.crossFadeDuration = 0.15;
    }

    /**
     * Initialize with a THREE.AnimationMixer and clip list
     * @param {THREE.AnimationMixer} mixer 
     * @param {THREE.AnimationClip[]} clips 
     */
    init(mixer, clips) {
        this.mixer = mixer;

        // Register only canonical clip names
        clips.forEach(clip => {
            const config = CLIP_CONFIG[clip.name];
            if (config) {
                const action = this.mixer.clipAction(clip);

                // Apply config
                action.setLoop(config.loop ? THREE.LoopRepeat : THREE.LoopOnce);
                action.clampWhenFinished = !config.loop;
                action.timeScale = config.timeScale || 1.0;

                this.actions[clip.name] = action;
                console.log(`[AnimController] Registered: "${clip.name}" (priority=${config.priority}, loop=${config.loop})`);
            } else {
                console.log(`[AnimController] Ignored unknown clip: "${clip.name}"`);
            }
        });

        // Attach single finished listener
        if (!this.finishedListenerAttached) {
            this.mixer.addEventListener('finished', this._onAnimationFinished.bind(this));
            this.finishedListenerAttached = true;
        }

        // Start with Idle
        this.request('Idle_HM');
    }

    /**
     * Request an animation to play
     * Respects priority and protected one-shot locks
     * @param {string} clipName - Exact canonical clip name
     * @returns {boolean} - Whether the request was accepted
     */
    request(clipName) {
        const config = CLIP_CONFIG[clipName];
        const action = this.actions[clipName];

        if (!config || !action) {
            console.warn(`[AnimController] Unknown clip requested: "${clipName}"`);
            return false;
        }

        // Check protected lock - only higher priority can interrupt
        if (this.protectedLock && config.priority <= this.currentPriority) {
            // Lower or equal priority cannot interrupt protected animation
            return false;
        }

        // Check levitation mode
        if (config.levitationMode && !this.levitationEnabled) {
            // Cannot play levitation animations outside levitation mode
            return false;
        }

        // If same animation is already playing and looping, don't restart
        if (this.currentClipName === clipName && action.isRunning() && config.loop) {
            return true;
        }

        // Accept the request
        this._playAction(clipName, action, config);
        return true;
    }

    /**
     * Internal: Play an action with crossfade
     */
    _playAction(clipName, action, config) {
        // Fade out current
        if (this.currentAction && this.currentAction.isRunning()) {
            this.currentAction.fadeOut(this.crossFadeDuration);
        }

        // Set lock for protected one-shots
        if (config.protected && !config.loop) {
            this.protectedLock = true;
            this.protectedClipName = clipName;
        }

        // Play new action
        action.reset().fadeIn(this.crossFadeDuration).play();

        this.currentAction = action;
        this.currentClipName = clipName;
        this.currentPriority = config.priority;

        console.log(`[AnimController] Playing: "${clipName}"`);
    }

    /**
     * Handle animation finished events
     */
    _onAnimationFinished(event) {
        const finishedAction = event.action;

        // Find which clip finished
        let finishedClipName = null;
        for (const [name, action] of Object.entries(this.actions)) {
            if (action === finishedAction) {
                finishedClipName = name;
                break;
            }
        }

        if (!finishedClipName) return;

        const config = CLIP_CONFIG[finishedClipName];
        console.log(`[AnimController] Finished: "${finishedClipName}"`);

        // Release protected lock
        if (this.protectedClipName === finishedClipName) {
            this.protectedLock = false;
            this.protectedClipName = null;
        }

        // Handle levitation state transitions
        if (finishedClipName === 'Levitation_Start_Hold_HM') {
            // Transition to mid hold
            this.request('Levitation_Mid_Hold_HM');
            return;
        }

        if (finishedClipName === 'Levitation_Lift_HM') {
            // Return to mid hold
            this.request('Levitation_Mid_Hold_HM');
            return;
        }

        if (finishedClipName === 'Levitation_Throw_HM') {
            // Exit levitation mode
            this.levitationEnabled = false;
            this.request('Idle_HM');
            return;
        }

        // For other one-shots (Jump, Pickup, Turn), return to locomotion
        // The movement system will call updateFromIntent() which will set correct state
        // For now, fall back to Idle
        if (!config.loop) {
            if (this.levitationEnabled) {
                this.request('Levitation_Mid_Hold_HM');
            } else {
                this.request('Idle_HM');
            }
        }
    }

    // =========================================================================
    // LEVITATION MODE CONTROL
    // =========================================================================

    /**
     * Enter levitation mode (plays Levitation_Start_Hold_HM)
     */
    enterLevitation() {
        if (this.levitationEnabled) return;

        this.levitationEnabled = true;
        this.request('Levitation_Start_Hold_HM');
        console.log('[AnimController] Entered levitation mode');
    }

    /**
     * Trigger lift animation (upward gesture)
     */
    triggerLift() {
        if (!this.levitationEnabled) return;
        this.request('Levitation_Lift_HM');
    }

    /**
     * Trigger throw animation (exits levitation mode)
     */
    triggerThrow() {
        if (!this.levitationEnabled) return;
        this.request('Levitation_Throw_HM');
    }

    /**
     * Force exit levitation mode (e.g., drop without throw)
     */
    exitLevitation() {
        this.levitationEnabled = false;
        this.protectedLock = false;
        this.protectedClipName = null;
        this.request('Idle_HM');
        console.log('[AnimController] Exited levitation mode');
    }

    // =========================================================================
    // INTENT-BASED UPDATE (called by movement system)
    // =========================================================================

    /**
     * Update animation based on movement intent
     * @param {Object} intent - { moveMagnitude, isRunning, turnDirection, isTurningInPlace }
     */
    updateFromIntent(intent) {
        // Don't override if protected animation is playing
        if (this.protectedLock) return;

        // Don't override levitation mode
        if (this.levitationEnabled) return;

        const { moveMagnitude, isRunning, turnDirection, isTurningInPlace } = intent;

        // DEBUG: Log intent when turning might happen
        if (turnDirection !== 0) {
            console.log(`[AnimController] Intent: moveMag=${moveMagnitude}, turn=${turnDirection}, inPlace=${isTurningInPlace}`);
        }

        // Turn-in-place (only when stationary, symmetric left/right)
        if (isTurningInPlace && moveMagnitude === 0) {
            if (turnDirection === -1 && this.actions['Turn_Left_HM']) {
                console.log('[AnimController] Triggering Turn_Left_HM');
                this.request('Turn_Left_HM');
                return;
            }
            if (turnDirection === 1 && this.actions['Turn_Right_HM']) {
                console.log('[AnimController] Triggering Turn_Right_HM');
                this.request('Turn_Right_HM');
                return;
            }
        }

        // Moving - use Walking or Running based on isRunning flag
        if (moveMagnitude > 0) {
            if (isRunning && this.actions['Running_HM']) {
                this.request('Running_HM');
            } else if (this.actions['Walking_HM']) {
                this.request('Walking_HM');
            } else {
                // Fallback to Running if no Walk clip
                this.request('Running_HM');
            }
            return;
        }

        // Idle
        this.request('Idle_HM');
    }

    // =========================================================================
    // DISCRETE EVENT TRIGGERS
    // =========================================================================

    /**
     * Trigger jump animation
     */
    triggerJump() {
        if (this.levitationEnabled) return false;
        return this.request('Jump_HM');
    }

    /**
     * Trigger pickup animation
     */
    triggerPickup() {
        if (this.levitationEnabled) return false;
        return this.request('Pickup_HM');
    }

    // =========================================================================
    // STATE QUERIES
    // =========================================================================

    /**
     * Check if a protected one-shot is currently playing
     */
    isLocked() {
        return this.protectedLock;
    }

    /**
     * Check if in levitation mode
     */
    isLevitating() {
        return this.levitationEnabled;
    }

    /**
     * Get current animation name
     */
    getCurrentAnimation() {
        return this.currentClipName;
    }
}

// =================================================================================
// SINGLETON INSTANCE
// =================================================================================
export const animationController = new AnimationController();
