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
    }

    blockFor(durationMs) {
        this.cooldownUntil = Date.now() + durationMs;
    }

    update(currentGesture, landmarks) {
        const now = Date.now();

        // Check cooldown
        if (this.cooldownUntil && now < this.cooldownUntil) {
            this.previousGesture = currentGesture;
            this.isControlling = false;
            return false;
        }

        // Stop camera if gesture is for object manipulation
        if (currentGesture === GESTURE.THREE_FINGER ||
            currentGesture === GESTURE.OPEN_HAND ||
            currentGesture === GESTURE.TWO_FINGER) {

            if (this.isControlling) {
                this.isControlling = false;
                this.framesSinceStart = 0;
            }
            this.cooldownUntil = now + 300;
            this.previousGesture = currentGesture;
            return false;
        }

        // Add cooldown when transitioning from grab/throw to pinch
        const wasGrabbingOrThrowing = this.previousGesture === GESTURE.THREE_FINGER ||
            this.previousGesture === GESTURE.OPEN_HAND;

        if (wasGrabbingOrThrowing && currentGesture === GESTURE.PINCH) {
            this.isControlling = false;
            this.framesSinceStart = 0;
            this.previousGesture = currentGesture;
            this.cooldownUntil = now + 500;
            return false;
        }

        // Handle PINCH gesture
        if (currentGesture === GESTURE.PINCH && landmarks) {
            const handX = landmarks[8].x;
            const handY = landmarks[8].y;

            // Start tracking if not already
            if (!this.isControlling) {
                this.isControlling = true;
                this.framesSinceStart = 0;
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
