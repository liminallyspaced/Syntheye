/**
 * WindSystem.js
 * Mode B control - wind-like interaction where swipes push objects
 * Object floats for ~2 seconds then slowly falls
 */

import * as THREE from 'three';
import { GESTURE } from '../hand-tracking/GestureRecognizer.js';

export class WindSystem {
    constructor(scene, camera, targetObject, physics) {
        this.scene = scene;
        this.camera = camera;
        this.targetObject = targetObject;
        this.physics = physics;

        // Wind push settings
        this.pushStrength = 50; // Increased for better horizontal movement
        this.floatDuration = 500; // 0.5 seconds of floating
        this.floatGravity = -5.0; // Faster fall during float
        this.normalGravity = -20.0; // Normal gravity after float

        // State tracking
        this.isFloating = false;
        this.floatStartTime = 0;
    }

    update(currentGesture, landmarks, gestureRecognizer) {
        if (!this.targetObject || !gestureRecognizer) return;

        // Update floating state
        this.updateFloatState();

        if (currentGesture === GESTURE.OPEN_HAND) {
            const vel = gestureRecognizer.getVelocity();
            const wristFlick = gestureRecognizer.getWristFlickVelocity();

            // Check for swipe - push the object (higher thresholds = less sensitive)
            const swipeStrength = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

            if (swipeStrength > 0.06 || wristFlick > 0.06) {
                this.pushObject(vel, wristFlick);
            }
        }
    }

    pushObject(velocity, wristFlick) {
        // Get camera orientation vectors for world-space movement
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        forward.y = 0; // Flatten to horizontal
        forward.normalize();

        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        right.y = 0; // Flatten to horizontal
        right.normalize();

        // Swipe direction from hand velocity (screen-space to world-space)
        // velocity.x: negative = swipe right, positive = swipe left (mirrored camera)
        // velocity.y: negative = swipe down, positive = swipe up
        // Amplify velocity for better response (velocities are typically 0.01-0.1)
        const ampVelX = velocity.x * 30; // Amplify horizontal
        const ampVelY = velocity.y * 30; // Amplify vertical

        const swipeStrength = Math.sqrt(ampVelX * ampVelX + ampVelY * ampVelY);
        const windForce = this.pushStrength * (1 + swipeStrength * 0.5);

        // Calculate world-space push direction from swipe
        const pushDir = new THREE.Vector3();
        pushDir.addScaledVector(right, -ampVelX * windForce * 0.1); // Swipe left/right - STRONG
        pushDir.y = -ampVelY * windForce * 0.03; // Swipe up/down - reduced
        pushDir.addScaledVector(forward, swipeStrength * windForce * 0.02); // Slight forward push

        // Cap max speed but allow good horizontal movement
        const totalSpeed = Math.min(pushDir.length(), 60);
        if (pushDir.length() > 0.1) {
            pushDir.normalize().multiplyScalar(totalSpeed);
        }

        // Minimal upward lift - mostly horizontal
        const upwardLift = 1 + wristFlick * 5;

        this.physics.setVelocity(
            pushDir.x,
            pushDir.y + upwardLift,
            pushDir.z
        );

        // Enable physics and start floating
        this.physics.setEnabled(true);
        this.startFloating();

        // Visual feedback - cyan flash for wind
        this.targetObject.material.color.setHex(0x00FFFF);
        setTimeout(() => {
            this.targetObject.material.color.setHex(0x0000FF);
        }, 300);

        console.log(`Wind push: dir=(${pushDir.x.toFixed(1)}, ${pushDir.y.toFixed(1)}, ${pushDir.z.toFixed(1)}), swipe=(${velocity.x.toFixed(3)}, ${velocity.y.toFixed(3)})`);
    }

    startFloating() {
        this.isFloating = true;
        this.floatStartTime = Date.now();
        this.physics.gravity = this.floatGravity;
    }

    updateFloatState() {
        if (this.isFloating) {
            const elapsed = Date.now() - this.floatStartTime;

            if (elapsed > this.floatDuration) {
                this.isFloating = false;

                // Gradually restore gravity
                const transitionDuration = 500;
                const startTime = Date.now();
                const startGravity = this.floatGravity;
                const endGravity = this.normalGravity;

                const restoreGravity = () => {
                    const t = Math.min(1, (Date.now() - startTime) / transitionDuration);
                    this.physics.gravity = startGravity + (endGravity - startGravity) * t;

                    if (t < 1) {
                        requestAnimationFrame(restoreGravity);
                    }
                };
                restoreGravity();
            }
        }
    }
}
