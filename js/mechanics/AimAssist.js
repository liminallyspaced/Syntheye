/**
 * AimAssist.js
 * Centralized aim assist module - POST-PROCESSING ONLY, NEVER BLOCKS
 * 
 * Guardrails:
 * - Never influences control flow (no "if active return/skip")
 * - Only transforms rawReticle → assistedReticle
 * - No global sticky booleans
 * - All runtime state lives inside this instance
 */

import * as THREE from 'three';

// Aim assist state machine
const AIM_STATE = {
    IDLE: 'IDLE',
    ACQUIRED: 'ACQUIRED',
    LOCKED: 'LOCKED'
};

export class AimAssist {
    constructor(config = {}) {
        // Configuration (immutable during gameplay)
        this.acquireRadius = config.acquireRadius || 1.0;
        this.releaseRadius = config.releaseRadius || 1.5;
        this.maxLockMs = config.maxLockMs || 2000;
        this.maxStrength = config.maxStrength || 0.15;

        // Runtime state (mutable, reset on power switch)
        this.state = AIM_STATE.IDLE;
        this.lockedTargetId = null;
        this.lockedTargetPos = new THREE.Vector3();
        this.lockStartTime = 0;
        this.lastAssistPos = new THREE.Vector3();
        this.currentStrength = 0;
        this.currentDistance = Infinity;
    }

    /**
     * Apply aim assist to raw reticle position
     * @param {THREE.Vector3} rawPos - Raw reticle position from input
     * @param {Array} candidates - Array of { id, position } target objects
     * @param {number} deltaTime - Frame delta time in seconds
     * @returns {THREE.Vector3} Adjusted reticle position
     */
    apply(rawPos, candidates, deltaTime) {
        const result = rawPos.clone();

        // Safe default: empty candidates = return raw, clear lock
        if (!candidates || candidates.length === 0) {
            this.resetLock();
            this.lastAssistPos.copy(result);
            return result;
        }

        const now = Date.now();

        // Find closest candidate
        let closestTarget = null;
        let closestDist = Infinity;

        for (const target of candidates) {
            const dist = rawPos.distanceTo(target.position);
            if (dist < closestDist) {
                closestDist = dist;
                closestTarget = target;
            }
        }

        this.currentDistance = closestDist;

        // State machine transitions
        switch (this.state) {
            case AIM_STATE.IDLE:
                // Acquire if within acquire radius
                if (closestTarget && closestDist < this.acquireRadius) {
                    this.state = AIM_STATE.ACQUIRED;
                    this.lockedTargetId = closestTarget.id;
                    this.lockedTargetPos.copy(closestTarget.position);
                    this.lockStartTime = now;
                }
                break;

            case AIM_STATE.ACQUIRED:
            case AIM_STATE.LOCKED:
                // Check release conditions
                const shouldRelease =
                    !closestTarget ||
                    closestDist > this.releaseRadius ||
                    (now - this.lockStartTime) > this.maxLockMs;

                if (shouldRelease) {
                    this.resetLock();
                } else {
                    // Update locked target position
                    this.lockedTargetPos.copy(closestTarget.position);
                    this.state = AIM_STATE.LOCKED;
                }
                break;
        }

        // Apply assist if locked
        if (this.state === AIM_STATE.LOCKED) {
            // Strength curve: stronger when closer (inverse distance)
            // At acquireRadius: strength = 0
            // At distance 0: strength = maxStrength
            const normalizedDist = Math.min(closestDist / this.acquireRadius, 1);
            this.currentStrength = this.maxStrength * (1 - normalizedDist);

            // Lerp toward target
            result.lerp(this.lockedTargetPos, this.currentStrength);
        } else {
            this.currentStrength = 0;
        }

        this.lastAssistPos.copy(result);
        return result;
    }

    /**
     * Reset runtime lock state (called on power switch)
     * Does NOT reset configuration
     */
    resetLock() {
        this.state = AIM_STATE.IDLE;
        this.lockedTargetId = null;
        this.lockedTargetPos.set(0, 0, 0);
        this.lockStartTime = 0;
        this.currentStrength = 0;
        this.currentDistance = Infinity;
    }

    /**
     * Get debug state for UI display
     */
    getDebugState() {
        return {
            state: this.state,
            lockedTargetId: this.lockedTargetId,
            timeLockedMs: this.lockStartTime > 0 ? Date.now() - this.lockStartTime : 0,
            distance: this.currentDistance === Infinity ? -1 : this.currentDistance.toFixed(2),
            strength: (this.currentStrength * 100).toFixed(1) + '%'
        };
    }

    /**
     * Check if currently assisting (for debug display only, NOT for control flow gating)
     */
    isAssisting() {
        return this.state === AIM_STATE.LOCKED;
    }
}
