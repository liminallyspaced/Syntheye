/**
 * LevitationSystem.js
 * Physics-based telekinesis with spring-damped forces.
 * Objects follow your hand naturally and bump into things instead of phasing.
 */

import * as THREE from 'three';
import { GESTURE } from '../hand-tracking/GestureRecognizer.js';

const STATE = {
    IDLE: 'IDLE',
    HOVERING: 'HOVERING',
    GRABBED: 'GRABBED'
};

export class LevitationSystem {
    constructor(scene, camera, targetObject, physics) {
        this.scene = scene;
        this.camera = camera;
        this.targetObject = targetObject;
        this.physics = physics;

        this.raycaster = new THREE.Raycaster();
        this.state = STATE.IDLE;

        // Visual indicator
        this.highlightMesh = this.createHighlight();
        this.targetObject.add(this.highlightMesh);

        // Get crosshair element
        this.crosshairEl = document.getElementById('crosshair');

        // Hold parameters
        this.holdDistance = 8.0;
        this.targetHoldDistance = 8.0;
        this.minHoldDistance = 1.5;
        this.maxHoldDistance = 40.0;  // Extended to allow reaching hoop from player position

        // Spring-damper constants (tunable)
        this.springK = 150;      // Spring constant
        this.dampingD = 25;      // Damping coefficient
        this.maxForce = 500;     // Force clamp to prevent explosions

        // Angular spring constants
        this.angularK = 20;
        this.angularD = 8;
        this.maxTorque = 50;

        // Break conditions
        this.breakForceThreshold = 400;
        this.breakTimer = 0;
        this.breakTimeRequired = 0.5;

        // Velocity tracking for momentum-based throw
        this.velocityHistory = [];
        this.maxVelocityHistory = 10; // ~100-200ms at 60fps

        // Hand tracking baselines
        this.initialHandX = undefined;
        this.initialHandY = undefined;
        this.initialHandSize = undefined;
        this.lastHandSize = undefined;
        this.baseGrabDistance = 8.0;
        this.handOffsetX = 0;
        this.handOffsetY = 0;

        // Target position for spring system
        this.targetPosition = new THREE.Vector3();

        // Cooldown after throwing to prevent accidental re-grab
        this.grabCooldown = 0;

        // Aim assist now handled by centralized AimAssist.js module
    }

    createHighlight() {
        const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x00FFFF,
            wireframe: true,
            transparent: true,
            opacity: 0.0
        });
        return new THREE.Mesh(geo, mat);
    }

    resetReferencePoints() {
        this.initialHandX = undefined;
        this.initialHandY = undefined;
        this.initialHandSize = undefined;
        this.lastHandSize = undefined;
        this.baseGrabDistance = this.holdDistance;
        this.handOffsetX = 0;
        this.handOffsetY = 0;
    }

    update(currentGesture, landmarks, gestureRecognizer = null) {
        if (!this.targetObject) return;

        this.gestureRecognizer = gestureRecognizer;

        // Grab cooldown after throwing
        if (this.grabCooldown > 0) {
            this.grabCooldown -= 0.016;
            return; // Don't process anything during cooldown
        }

        // Raycast from screen center
        const screenCenter = new THREE.Vector2(0, 0);
        this.raycaster.setFromCamera(screenCenter, this.camera);
        const intersects = this.raycaster.intersectObject(this.targetObject);

        // Direct hit OR small proximity (just past crosshair)
        let isLookingAtCube = intersects.length > 0;
        let aimAssistDistance = Infinity;

        // Calculate proximity to cube for aim assist
        const rayOrigin = this.raycaster.ray.origin;
        const rayDir = this.raycaster.ray.direction;
        const cubePos = this.targetObject.position;

        const toCube = new THREE.Vector3().subVectors(cubePos, rayOrigin);
        const t = toCube.dot(rayDir);

        if (t > 0) {
            const closestPoint = new THREE.Vector3()
                .copy(rayOrigin)
                .add(rayDir.clone().multiplyScalar(t));

            aimAssistDistance = closestPoint.distanceTo(cubePos);

            if (aimAssistDistance < 0.6) {
                isLookingAtCube = true;
            }
        }

        // (Aim assist removed - was causing control freezes)

        switch (this.state) {
            case STATE.IDLE:
                this.highlightMesh.material.opacity = 0;
                this.setCrosshairColor('cyan');
                this.physics.setLevitating(false);

                if (isLookingAtCube) {
                    this.state = STATE.HOVERING;
                }
                break;

            case STATE.HOVERING:
                this.highlightMesh.material.opacity = 0.5;
                this.setCrosshairColor('yellow');

                const hoverGestureName = Object.keys(GESTURE).find(k => GESTURE[k] === currentGesture) || 'NONE';
                const gestureDisplay = document.getElementById('current-gesture-display');
                if (gestureDisplay) gestureDisplay.textContent = hoverGestureName;

                const grabGesture = window.levitationSettings?.gestureGrab || 'PINCH';

                if (!isLookingAtCube) {
                    this.state = STATE.IDLE;
                } else if (hoverGestureName === grabGesture) {
                    this.grabObject(landmarks);
                }
                break;

            case STATE.GRABBED:
                this.highlightMesh.material.opacity = 0.8 + Math.sin(Date.now() / 100) * 0.2;
                this.setCrosshairColor('lime');

                const settings = window.levitationSettings || {};
                const moveGesture = settings.gestureMove || 'OPEN_HAND';
                const dropGesture = settings.gestureDrop || 'CLOSED_FIST';
                const currentGestureName = Object.keys(GESTURE).find(k => GESTURE[k] === currentGesture) || 'NONE';

                const gestureDisp = document.getElementById('current-gesture-display');
                if (gestureDisp) gestureDisp.textContent = currentGestureName;

                if (currentGestureName === moveGesture) {
                    // Check for throw gesture
                    const wristFlick = this.gestureRecognizer ?
                        this.gestureRecognizer.getWristFlickVelocity() : 0;

                    const vel = this.gestureRecognizer ? this.gestureRecognizer.getVelocity() : { x: 0, y: 0 };
                    const flickYThreshold = window.levitationSettings?.flickYThreshold || 0.06;
                    const upwardSwipe = vel.y < -flickYThreshold;

                    const flickThreshold = window.levitationSettings?.throwFlickThreshold || 0.05;
                    if (wristFlick > flickThreshold || upwardSwipe) {
                        this.throwObject();
                    } else {
                        this.updateHoldPhysics(landmarks);
                    }
                } else if (currentGestureName === dropGesture || currentGestureName === 'ONE_FINGER') {
                    this.dropObject();
                } else {
                    this.updateHoldPhysics(landmarks);
                }
                break;
        }
    }

    setCrosshairColor(color) {
        if (this.crosshairEl) {
            const lines = this.crosshairEl.querySelectorAll('div');
            lines.forEach(line => {
                line.style.background = color;
            });
        }
    }

    grabObject(landmarks) {
        this.state = STATE.GRABBED;
        this.physics.setLevitating(true);
        this.physics.setEnabled(true); // Keep physics enabled for wall collisions
        this.targetObject.material.color.setHex(0x00FFFF);

        // Calculate actual distance to object
        const objectPos = this.targetObject.position.clone();
        const cameraPos = this.camera.position.clone();
        const actualDistance = objectPos.distanceTo(cameraPos);

        this.holdDistance = Math.max(this.minHoldDistance, Math.min(this.maxHoldDistance, actualDistance));
        this.targetHoldDistance = this.holdDistance;
        this.baseGrabDistance = this.holdDistance;

        // Store initial hand for relative movement
        if (landmarks) {
            this.initialHandZ = landmarks[9].z;
            this.lastPushPullZ = landmarks[9].z;
        }

        // Clear velocity history
        this.velocityHistory = [];
        this.breakTimer = 0;

        console.log(`Levitation: Object Grabbed at distance ${this.holdDistance.toFixed(1)}!`);
    }

    dropObject() {
        // === ATOMIC RELEASE ===
        this.state = STATE.IDLE;
        this.physics.setLevitating(false);

        // Clear aim assist lock
        if (window.aimAssist) {
            window.aimAssist.resetLock();
        }

        // Clear hold references
        this.resetReferencePoints();

        // Visual feedback
        this.targetObject.material.color.setHex(0xFF6600);

        // Cooldown to prevent instant re-grab (hysteresis)
        this.grabCooldown = 0.15; // 150ms

        console.log("Levitation: Object Dropped!");
    }

    /**
     * Update hold physics using spring-damped forces
     */
    updateHoldPhysics(landmarks) {
        if (!landmarks) return;

        // Calculate target position from hand input
        this.calculateTargetPosition(landmarks);

        // Track velocity for momentum throw
        const currentVel = this.physics.getVelocity();
        this.velocityHistory.push(currentVel.clone());
        if (this.velocityHistory.length > this.maxVelocityHistory) {
            this.velocityHistory.shift();
        }

        // === SPRING-DAMPED FORCE ===
        const objPos = this.targetObject.position;
        const error = new THREE.Vector3().subVectors(this.targetPosition, objPos);

        // Spring force: F = K * error
        const mass = this.physics.mass;
        const K = this.springK * mass;
        const D = this.dampingD * mass;

        const springForce = error.clone().multiplyScalar(K);

        // Damping force: F = -D * velocity
        const velocity = this.physics.getVelocity();
        const dampingForce = velocity.clone().multiplyScalar(-D);

        // Total force
        const totalForce = springForce.add(dampingForce);

        // Clamp force to prevent explosions
        if (totalForce.length() > this.maxForce) {
            totalForce.normalize().multiplyScalar(this.maxForce);
        }

        // Apply force
        this.physics.applyForce(totalForce);

        // === BREAK CONDITION ===
        if (springForce.length() > this.breakForceThreshold) {
            this.breakTimer += 0.016;
            if (this.breakTimer > this.breakTimeRequired) {
                console.log("Levitation: Grip broke due to excessive force!");
                this.dropObject();
                return;
            }
        } else {
            this.breakTimer = Math.max(0, this.breakTimer - 0.016);
        }

        // === AUTO-STABILIZE ROTATION ===
        // Gently damp angular velocity to stop wobbling
        const angVel = this.physics.angularVelocity;
        const stabilizeTorque = angVel.clone().multiplyScalar(-this.angularD);
        this.physics.applyTorque(stabilizeTorque);

        // Add subtle hover animation
        this.targetObject.position.y += Math.sin(Date.now() / 300) * 0.001;
    }

    /**
     * Calculate target position from hand input
     */
    calculateTargetPosition(landmarks) {
        const palmCenter = landmarks[9];
        const wrist = landmarks[0];
        const middleTip = landmarks[12];
        const handX = palmCenter.x;
        const handY = palmCenter.y;

        // Calculate hand size for push/pull
        const handSize = Math.sqrt(
            Math.pow(middleTip.x - wrist.x, 2) +
            Math.pow(middleTip.y - wrist.y, 2)
        );

        // Initialize baselines
        if (this.initialHandX === undefined) {
            this.initialHandX = handX;
            this.initialHandY = handY;
            this.initialHandSize = handSize;
            this.baseGrabDistance = this.holdDistance;
            this.baseOffsetX = 0;
            this.baseOffsetY = 0;
        }

        // XY movement relative to initial position
        const deltaX = this.initialHandX - handX;
        const deltaY = this.initialHandY - handY;

        const xyScale = (window.levitationSettings?.xyMoveScale) || 12;
        const targetOffsetX = this.baseOffsetX + deltaX * xyScale;
        const targetOffsetY = this.baseOffsetY + deltaY * (xyScale * 0.67);

        // Gradual centering - slowly drift toward center while allowing drag offset
        // This gives the "dragging" feel while the ball eventually settles near crosshair
        const centeringSpeed = 0.02; // How fast it drifts to center (0.02 = slow drift)
        this.handOffsetX = THREE.MathUtils.lerp(this.handOffsetX, targetOffsetX * 0.7, centeringSpeed + Math.abs(deltaX) * 0.5);
        this.handOffsetY = THREE.MathUtils.lerp(this.handOffsetY, targetOffsetY * 0.7, centeringSpeed + Math.abs(deltaY) * 0.5);

        // Push/pull based on hand size
        const sizeDiff = handSize - this.initialHandSize;

        if (this.lastHandSize === undefined) {
            this.lastHandSize = handSize;
        }
        const sizeVelocity = handSize - this.lastHandSize;
        this.lastHandSize = handSize;

        // Dead zone
        let adjustedDiff = 0;
        const deadZone = 0.01;
        if (Math.abs(sizeDiff) > deadZone) {
            adjustedDiff = sizeDiff > 0 ? sizeDiff - deadZone : sizeDiff + deadZone;
        }

        // Calculate target distance with velocity bonus
        const settings = window.levitationSettings || {};
        const velocityMultiplier = settings.velocityMultiplier || 400;
        const velocityBonus = sizeVelocity * velocityMultiplier;
        const pushPullStrength = settings.pushPullStrength || 150;

        this.targetHoldDistance = this.baseGrabDistance + (adjustedDiff * pushPullStrength) + velocityBonus;
        this.targetHoldDistance = Math.max(this.minHoldDistance, Math.min(this.maxHoldDistance, this.targetHoldDistance));

        // Smooth distance interpolation
        this.holdDistance = THREE.MathUtils.lerp(this.holdDistance, this.targetHoldDistance, 0.1);

        // Calculate final target position
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);

        this.targetPosition.copy(this.camera.position)
            .add(forward.multiplyScalar(this.holdDistance));

        this.targetPosition.add(right.multiplyScalar(this.handOffsetX));
        this.targetPosition.y += this.handOffsetY;

        // === AIM ASSIST - Soft snap toward hoop ===
        // Apply post-processing nudge when near valid targets
        if (window.aimAssist && window.basketballHoop) {
            const hoopCenter = window.basketballHoop.hoopCenter;
            if (hoopCenter) {
                // Build candidate targets list
                const candidates = [
                    { id: 'hoop', position: hoopCenter }
                ];

                // Apply aim assist - returns adjusted position
                const assisted = window.aimAssist.apply(
                    this.targetPosition,
                    candidates,
                    0.016 // deltaTime
                );

                // Use assisted position
                this.targetPosition.copy(assisted);
            }
        }

        // === WALL PROJECTION ===
        // Clamp target position to stay inside room bounds
        const margin = (window.ballRadius || 0.25) + 0.2;

        // Floor/ceiling
        this.targetPosition.y = Math.max(0.5 + margin, Math.min(14.5 - margin, this.targetPosition.y));

        // Walls (ROOM_TESTRANGE bounds: x±15, z=-25 to z=15)
        // Use smaller margin for back wall to allow hoop access
        const backWallMargin = (window.ballRadius || 0.25) + 0.1;
        this.targetPosition.x = Math.max(-15 + margin, Math.min(15 - margin, this.targetPosition.x));
        this.targetPosition.z = Math.max(-25 + backWallMargin, Math.min(15 - margin, this.targetPosition.z));
    }

    /**
     * Throw using momentum-based velocity
     * ATOMIC RELEASE ORDERING: release state FIRST, then apply impulse ONCE
     */
    throwObject() {
        // =====================================================
        // 1. ATOMIC RELEASE - Clear hold state FIRST (same frame)
        // =====================================================

        // a) Change state to IDLE immediately
        this.state = STATE.IDLE;

        // b) Disable levitation (no more stabilization forces)
        this.physics.setLevitating(false);

        // c) Clear aim assist lock (runtime only, doesn't affect config)
        if (window.aimAssist) {
            window.aimAssist.resetLock();
        }

        // d) Clear any hold references
        this.resetReferencePoints();

        // e) Visual feedback
        this.targetObject.material.color.setHex(0xFF6600);

        // f) Set cooldown to prevent accidental re-grab
        this.grabCooldown = 0.3;

        // =====================================================
        // 2. COMPUTE THROW DIRECTION FROM RAW INPUT (not aim-assisted)
        // =====================================================

        // Use RAW hand velocity from gesture recognizer
        let throwDirX = 0;
        let throwDirY = 0;
        let handSpeed = 0;
        let wristFlick = 0;

        if (this.gestureRecognizer) {
            // RAW velocity - NOT aim-assist adjusted
            const vel = this.gestureRecognizer.getVelocity();
            handSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            throwDirX = -vel.x * 80;
            throwDirY = -vel.y * 80;
            wristFlick = this.gestureRecognizer.getWristFlickVelocity();
        }

        // Calculate average momentum from history
        let avgVelocity = new THREE.Vector3(0, 0, 0);
        if (this.velocityHistory.length > 0) {
            for (const vel of this.velocityHistory) {
                avgVelocity.add(vel);
            }
            avgVelocity.divideScalar(this.velocityHistory.length);
        }

        // Base direction from camera forward (NOT aim-assisted target)
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        // Calculate throw speed - slower flick = shorter throw
        const minThrowSpeed = 2.0;
        const maxThrowSpeed = 100.0;
        const wristFlickMultiplier = 500;
        const handSpeedMultiplier = 250;

        let throwSpeed = minThrowSpeed +
            (wristFlick * wristFlickMultiplier) +
            (handSpeed * handSpeedMultiplier);

        throwSpeed = Math.min(throwSpeed, maxThrowSpeed);

        // Momentum bonus from tracked velocity
        const momentumBonus = avgVelocity.clone().multiplyScalar(0.5);

        // Upward boost for underhand toss
        let upwardBoost = 8;
        if (this.gestureRecognizer) {
            const vel = this.gestureRecognizer.getVelocity();
            if (vel.y < -0.01) {
                const boostAmount = Math.abs(vel.y) * 300;
                upwardBoost += boostAmount;
            }
        }

        // =====================================================
        // 3. APPLY ONE-SHOT IMPULSE (physics owns object after this)
        // =====================================================

        const throwVelocity = new THREE.Vector3(
            forward.x * throwSpeed + throwDirX + momentumBonus.x,
            forward.y * throwSpeed + throwDirY + upwardBoost + momentumBonus.y,
            forward.z * throwSpeed + momentumBonus.z
        );

        // Set velocity ONCE - physics takes over completely after this
        this.physics.setVelocity(throwVelocity.x, throwVelocity.y, throwVelocity.z);

        console.log(`Throw: speed=${throwSpeed.toFixed(1)}, wristFlick=${wristFlick.toFixed(4)}, momentum=${momentumBonus.length().toFixed(1)}`);
    }
}
