/**
 * CameraControl.js
 * Handles gesture-based camera rotation (Pinch + Drag).
 * 
 * FIX HISTORY:
 * - Changed aim landmark from index tip (8) to palm center (9) to prevent drift during pinch
 * - Added resetBaseline() for immediate re-anchoring on state transitions
 * - Implemented dt-stable exponential smoothing
 * - Added rotation rate clamping
 * - Increased dead zones and reduced sensitivity
 */

import * as THREE from 'three';
import { GESTURE } from '../hand-tracking/GestureRecognizer.js';

export class CameraControl {
    constructor(camera) {
        this.camera = camera;
        this.isControlling = false;

        // === TUNING PARAMETERS (reduced for less jitter) ===
        this.sensitivityYaw = 1.0;    // Was 1.5 - radians per normalized unit
        this.sensitivityPitch = 0.8;  // Lower for pitch to reduce vertical jitter

        // Increased dead zones to filter noise
        this.deadZoneX = 0.02;  // Was 0.01 - normalized units
        this.deadZoneY = 0.03;  // Was 0.02 - Y is more sensitive

        // Pitch limits
        this.minPitch = -Math.PI / 2;
        this.maxPitch = Math.PI / 3;

        // === DT-STABLE SMOOTHING ===
        this.smoothingTau = 0.08;  // Time constant in seconds (lower = snappier)

        // === ROTATION RATE CLAMPING (rad/sec) ===
        this.maxYawRate = 2.0;    // Max yaw change per second
        this.maxPitchRate = 1.5;  // Max pitch change per second

        // State tracking
        this.previousGesture = GESTURE.NONE;
        this.baselineReady = false;  // Immediate baseline flag

        // Baseline values for relative offset
        this.handStartX = undefined;
        this.handStartY = undefined;
        this.cameraStartYaw = undefined;
        this.cameraStartPitch = undefined;

        // Current smoothed rotation targets
        this.targetYaw = 0;
        this.targetPitch = 0;
    }

    /**
     * Immediately reset baseline to current hand position.
     * Called by LevitationSystem on grab to prevent aim jump.
     * @param {Array} landmarks - Current hand landmarks
     */
    resetBaseline(landmarks) {
        if (landmarks) {
            // Use palm center (9) for stable reference during pinch
            const palmCenter = landmarks[9];
            this.handStartX = palmCenter.x;
            this.handStartY = palmCenter.y;
        }
        this.cameraStartYaw = this.camera.rotation.y;
        this.cameraStartPitch = this.camera.rotation.x;
        this.targetYaw = this.camera.rotation.y;
        this.targetPitch = this.camera.rotation.x;
        this.baselineReady = true;
        this.isControlling = true;
    }

    blockFor(durationMs) {
        this.cooldownUntil = Date.now() + durationMs;
    }

    /**
     * Update camera rotation based on hand position.
     * @param {number} currentGesture - Current detected gesture
     * @param {Array} landmarks - Hand landmarks array
     * @param {number} dt - Delta time in seconds (from RAF)
     * @returns {boolean} - Whether camera is being controlled
     */
    update(currentGesture, landmarks, dt = 0.016) {
        const now = Date.now();

        // Check cooldown
        if (this.cooldownUntil && now < this.cooldownUntil) {
            this.previousGesture = currentGesture;
            this.isControlling = false;
            return false;
        }

        // Stop camera if gesture is for object manipulation (THREE_FINGER, TWO_FINGER)
        if (currentGesture === GESTURE.THREE_FINGER ||
            currentGesture === GESTURE.TWO_FINGER) {

            if (this.isControlling) {
                this.isControlling = false;
                this.baselineReady = false;
            }
            this.cooldownUntil = now + 300;
            this.previousGesture = currentGesture;
            return false;
        }

        // Handle switching from OPEN_HAND to PINCH - short delay
        const switchingFromOpenHandToPinch = this.previousGesture === GESTURE.OPEN_HAND && currentGesture === GESTURE.PINCH;
        if (switchingFromOpenHandToPinch) {
            this.pinchCooldownUntil = now + 300;
            this.isControlling = false;
            this.previousGesture = currentGesture;
            return false;
        }

        // Skip camera control during pinch cooldown
        if (currentGesture === GESTURE.PINCH && this.pinchCooldownUntil && now < this.pinchCooldownUntil) {
            this.previousGesture = currentGesture;
            return false;
        }

        // PINCH and OPEN_HAND control camera
        if ((currentGesture === GESTURE.PINCH || currentGesture === GESTURE.OPEN_HAND) && landmarks) {
            // === FIX: Use palm center (9) instead of index tip (8) ===
            // Palm center is stable during pinch gesture
            const palmCenter = landmarks[9];
            const handX = palmCenter.x;
            const handY = palmCenter.y;

            // Detect gesture change - need to reset baseline
            const gestureChanged = this.previousGesture !== currentGesture;

            // Initialize or reset baseline
            if (!this.baselineReady || gestureChanged) {
                this.handStartX = handX;
                this.handStartY = handY;
                this.cameraStartYaw = this.camera.rotation.y;
                this.cameraStartPitch = this.camera.rotation.x;
                this.targetYaw = this.camera.rotation.y;
                this.targetPitch = this.camera.rotation.x;
                this.baselineReady = true;
                this.isControlling = true;
                this.previousGesture = currentGesture;
                // Immediate baseline - no multi-frame delay
                return true;
            }

            // Calculate offset from baseline
            const offsetX = handX - this.handStartX;
            const offsetY = handY - this.handStartY;

            // Apply dead zones
            let adjX = Math.abs(offsetX) > this.deadZoneX ? offsetX : 0;
            let adjY = Math.abs(offsetY) > this.deadZoneY ? offsetY : 0;

            // Calculate raw target rotation
            const rawTargetYaw = this.cameraStartYaw + (adjX * this.sensitivityYaw);
            const rawTargetPitch = this.cameraStartPitch - (adjY * this.sensitivityPitch);

            // === DT-STABLE EXPONENTIAL SMOOTHING ===
            // alpha = 1 - exp(-dt / tau)
            const alpha = 1 - Math.exp(-dt / this.smoothingTau);

            this.targetYaw = this.targetYaw + (rawTargetYaw - this.targetYaw) * alpha;
            this.targetPitch = this.targetPitch + (rawTargetPitch - this.targetPitch) * alpha;

            // === ROTATION RATE CLAMPING ===
            const currentYaw = this.camera.rotation.y;
            const currentPitch = this.camera.rotation.x;

            let deltaYaw = this.targetYaw - currentYaw;
            let deltaPitch = this.targetPitch - currentPitch;

            // Clamp to max rate per second, scaled by dt
            const maxYawDelta = this.maxYawRate * dt;
            const maxPitchDelta = this.maxPitchRate * dt;

            deltaYaw = Math.max(-maxYawDelta, Math.min(maxYawDelta, deltaYaw));
            deltaPitch = Math.max(-maxPitchDelta, Math.min(maxPitchDelta, deltaPitch));

            // Apply rotation with clamping
            this.camera.rotation.y = currentYaw + deltaYaw;
            this.camera.rotation.x = Math.max(this.minPitch, Math.min(this.maxPitch, currentPitch + deltaPitch));

            this.previousGesture = currentGesture;
            return true;
        }

        // Not a camera control gesture - end control
        if (this.isControlling) {
            this.isControlling = false;
            this.baselineReady = false;
            this.handStartX = undefined;
            this.handStartY = undefined;
            this.cooldownUntil = now + 500;
        }
        this.previousGesture = currentGesture;
        return false;
    }
}

