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
        // BUT: if switching from OPEN_HAND to PINCH, add delay before PINCH affects camera
        const switchingFromOpenHandToPinch = this.previousGesture === GESTURE.OPEN_HAND && currentGesture === GESTURE.PINCH;

        if (switchingFromOpenHandToPinch) {
            // Set a short cooldown so PINCH doesn't immediately move camera
            this.pinchCooldownUntil = now + 300;
            this.isControlling = false;
            this.previousGesture = currentGesture;
            return false; // Don't control camera, but levitation can still grab
        }

        // Skip camera control during pinch cooldown
        if (currentGesture === GESTURE.PINCH && this.pinchCooldownUntil && now < this.pinchCooldownUntil) {
            this.previousGesture = currentGesture;
            return false;
        }

        // PINCH and OPEN_HAND control camera
        if ((currentGesture === GESTURE.PINCH || currentGesture === GESTURE.OPEN_HAND) && landmarks) {
            const handX = landmarks[8].x;
            const handY = landmarks[8].y;

            // DETECT GESTURE CHANGE - reset baseline to prevent jump
            const gestureChanged = this.previousGesture !== currentGesture;

            // Start tracking if not already OR if gesture changed
            if (!this.isControlling || gestureChanged) {
                if (gestureChanged && this.isControlling) {
                    // Gesture changed while controlling - reset to current position
                    this.handStartX = handX;
                    this.handStartY = handY;
                    this.cameraStartYaw = this.camera.rotation.y;
                    this.cameraStartPitch = this.camera.rotation.x;
                    this.framesSinceStart = 5; // Skip stabilization, keep smooth
                } else {
                    this.isControlling = true;
                    this.framesSinceStart = 0;
                }
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
