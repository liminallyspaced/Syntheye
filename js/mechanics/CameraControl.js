/**
 * CameraControl.js
 * Handles gesture-based camera rotation (Pinch + Drag).
 */

import * as THREE from 'three';
import { GESTURE } from '../hand-tracking/GestureRecognizer.js';

// Global debug log storage
window.cameraDebugLogs = [];

export class CameraControl {
    constructor(camera) {
        this.camera = camera;
        this.isControlling = false;
        this.sensitivity = 1.5;
        this.deadZone = 0.005;
        this.minPitch = -Math.PI / 2;
        this.maxPitch = Math.PI / 3;
        this.previousGesture = GESTURE.NONE;
        this.framesSinceStart = 0;

        // Start values for absolute offset calculation
        this.handStartX = undefined;
        this.handStartY = undefined;
        this.cameraStartYaw = undefined;
        this.cameraStartPitch = undefined;

        // Smoothed palm tracking for clean handoffs
        this.smoothedPalmXY = { x: 0, y: 0 };
        this.lastPalmXY = { x: 0, y: 0 };
    }

    blockFor(durationMs) {
        this.cooldownUntil = Date.now() + durationMs;
    }

    /**
     * Reset hand anchor to current position - call on exit or when entering grab mode
     * Prevents camera jump on handoff by zeroing deltas
     */
    resetHandAnchor(palmXY) {
        if (palmXY) {
            this.lastPalmXY = { x: palmXY.x, y: palmXY.y };
            this.smoothedPalmXY = { x: palmXY.x, y: palmXY.y };
        }
        this.handStartX = undefined;
        this.handStartY = undefined;
        this.cameraStartYaw = undefined;
        this.cameraStartPitch = undefined;
        this.isControlling = false;
        this.framesSinceStart = 0;
    }

    update(currentGesture, landmarks, activeMode = 'CAMERA') {
        const now = Date.now();

        // OWNERSHIP CHECK: Only process if we're the active mode
        if (activeMode !== 'CAMERA') {
            // Not our turn - reset state but don't apply any camera movement
            if (this.isControlling) {
                this.resetHandAnchor(landmarks ? { x: landmarks[9].x, y: landmarks[9].y } : null);
            }
            this.previousGesture = currentGesture;
            return false;
        }

        // Check cooldown
        if (this.cooldownUntil && now < this.cooldownUntil) {
            this.previousGesture = currentGesture;
            this.isControlling = false;
            return false;
        }

        // (Aim assist camera lock removed - was causing freezes)

        // Stop camera if gesture is for object manipulation (only THREE_FINGER blocks)
        if (currentGesture === GESTURE.THREE_FINGER ||
            currentGesture === GESTURE.TWO_FINGER) {

            if (this.isControlling) {
                this.isControlling = false;
                this.framesSinceStart = 0;
            }
            this.cooldownUntil = now + 300;
            this.previousGesture = currentGesture;
            return false;
        }

        // No cooldown needed between gestures for camera control
        // Both PINCH and OPEN_HAND should smoothly control camera

        // Handle PINCH or OPEN_HAND for camera control
        // BUT: if switching from OPEN_HAND to PINCH, reset and re-stabilize
        const switchingFromOpenHandToPinch = this.previousGesture === GESTURE.OPEN_HAND && currentGesture === GESTURE.PINCH;

        if (switchingFromOpenHandToPinch) {
            // CRITICAL: Reset anchors to current position so no jump when resuming
            this.resetHandAnchor(landmarks ? { x: landmarks[9].x, y: landmarks[9].y } : null);
            this.pinchCooldownUntil = now + 300;
            this.previousGesture = currentGesture;
            return false; // Don't control camera, but levitation can still grab
        }

        // Skip camera control during pinch cooldown, but when cooldown ends, force re-stabilization
        if (currentGesture === GESTURE.PINCH && this.pinchCooldownUntil && now < this.pinchCooldownUntil) {
            this.previousGesture = currentGesture;
            return false;
        }

        // PINCH and OPEN_HAND control camera
        // NEW RULE: PINCH only controls camera when holding an object
        // This prevents camera flicks during OPEN_HAND -> PINCH transition for pickup
        const isHoldingObject = window.levitationState?.isHolding || false;

        if (currentGesture === GESTURE.PINCH && !isHoldingObject) {
            // PINCH without holding object = blocked from camera control
            // Reset state so next activation starts fresh
            if (this.isControlling) {
                this.resetHandAnchor(landmarks ? { x: landmarks[9].x, y: landmarks[9].y } : null);
            }
            this.previousGesture = currentGesture;
            return false;
        }

        if ((currentGesture === GESTURE.PINCH || currentGesture === GESTURE.OPEN_HAND) && landmarks) {
            const handX = landmarks[8].x;
            const handY = landmarks[8].y;

            // DETECT GESTURE CHANGE or coming out of cooldown - reset baseline to prevent jump
            const gestureChanged = this.previousGesture !== currentGesture;
            const comingOutOfCooldown = this.pinchCooldownUntil && now >= this.pinchCooldownUntil;

            // Clear cooldown after we've used it
            if (comingOutOfCooldown) {
                this.pinchCooldownUntil = null;
            }

            // Start tracking if not already OR if gesture changed OR coming out of cooldown
            if (!this.isControlling || gestureChanged || comingOutOfCooldown) {
                // ALWAYS reset to current position to prevent jump
                this.isControlling = true;
                this.handStartX = handX;
                this.handStartY = handY;
                this.cameraStartYaw = this.camera.rotation.y;
                this.cameraStartPitch = this.camera.rotation.x;
                this.framesSinceStart = 0; // Force full re-stabilization
            }

            this.framesSinceStart++;

            // First 5 frames: capture starting position, NO rotation
            if (this.framesSinceStart <= 5) {
                this.handStartX = handX;
                this.handStartY = handY;
                this.cameraStartYaw = this.camera.rotation.y;
                this.cameraStartPitch = this.camera.rotation.x;
                this.controlStartTime = now;
                this.previousGesture = currentGesture;
                window.cameraDebugLogs.push(`STABILIZING (frame ${this.framesSinceStart}) - hand: ${handX.toFixed(3)}, ${handY.toFixed(3)}`);
                return true; // Don't rotate, just capture
            }

            // Frame 6+: Calculate offset and apply rotation
            const offsetX = handX - this.handStartX;
            const offsetY = handY - this.handStartY;

            // Larger dead zone to prevent jitter
            const deadZoneX = 0.01;
            const deadZoneY = 0.02;
            let adjX = Math.abs(offsetX) > deadZoneX ? offsetX : 0;
            let adjY = Math.abs(offsetY) > deadZoneY ? offsetY : 0;

            // Y dampening for first 500ms
            const yDamp = (now - this.controlStartTime) < 500 ? 0.3 : 1.0;

            // Calculate TARGET rotation = start + offset (absolute, not incremental)
            const targetYaw = this.cameraStartYaw + (adjX * this.sensitivity);
            const targetPitch = this.cameraStartPitch - (adjY * this.sensitivity * yDamp);

            // SMOOTH the rotation using lerp (0.15 = smooth, responsive)
            const smoothFactor = 0.15;
            const newYaw = this.camera.rotation.y + (targetYaw - this.camera.rotation.y) * smoothFactor;
            const newPitch = this.camera.rotation.x + (targetPitch - this.camera.rotation.x) * smoothFactor;

            this.camera.rotation.y = newYaw;
            this.camera.rotation.x = Math.max(this.minPitch, Math.min(this.maxPitch, newPitch));

            this.previousGesture = currentGesture;
            return true;
        }

        // Not PINCH - end control
        if (this.isControlling) {
            this.isControlling = false;
            this.framesSinceStart = 0;
            this.handStartX = undefined;
            this.handStartY = undefined;
            this.cameraStartYaw = undefined;
            this.cameraStartPitch = undefined;
            this.cooldownUntil = now + 500;
        }
        this.previousGesture = currentGesture;
        return false;
    }
}
