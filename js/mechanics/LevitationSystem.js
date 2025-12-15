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
    GRABBED: 'GRABBED',
    THROWN: 'THROWN'  // Prevents instant re-grab after throw
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

        // === UX IMPROVEMENTS ===

        // Hand-loss grace period (prevents instant drops)
        this.handLostTimer = 0;
        this.handLostGraceDuration = 0.2;  // 200ms
        this.lastValidCameraForward = new THREE.Vector3(0, 0, -1);
        this.lastValidCameraPosition = new THREE.Vector3();
        this.lastValidHoldDistance = 8.0;

        // Release hysteresis (requires stable release gesture)
        this.releaseGestureHoldCount = 0;
        this.releaseStabilityThreshold = 5;  // Frames required
        this.lastReleaseGesture = null;

        // HoldDistance rate limiting
        this.maxHoldDistanceRate = 8;  // units/sec

        // Dynamic damping based on hand stability
        this.baseDampingD = 25;
        this.stableDampingBonus = 5;
        this.movingDampingReduction = 5;
        this.handStabilityThreshold = 0.01;  // handSpeed below this = stable

        // Aim assist (unused but preserved)
        this.aimAssistRadius = 1.5;
        this.aimAssistStrength = 0.03;
        this.cameraLockTimer = 0;
        this.cameraLockDuration = 1.0;
        this.isAimAssisting = false;
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

    /**
     * Update last valid state for hand-loss grace period
     * Call this every frame when hand is present
     */
    updateLastValidState(camera) {
        this.lastValidCameraPosition.copy(camera.position);
        this.lastValidCameraForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        this.lastValidHoldDistance = this.holdDistance;
    }

    /**
     * Check if release gesture is stable (hysteresis)
     */
    isReleaseGestureStable(gestureName) {
        const isReleaseGesture = gestureName === 'CLOSED_FIST' || gestureName === 'ONE_FINGER';

        if (!isReleaseGesture) {
            this.releaseGestureHoldCount = 0;
            this.lastReleaseGesture = null;
            return false;
        }

        if (gestureName === this.lastReleaseGesture) {
            this.releaseGestureHoldCount++;
        } else {
            this.releaseGestureHoldCount = 1;
            this.lastReleaseGesture = gestureName;
        }

        return this.releaseGestureHoldCount >= this.releaseStabilityThreshold;
    }

    update(currentGesture, landmarks, gestureRecognizer = null, hasHand = true, deltaTime = 0.016) {
        if (!this.targetObject) return;

        this.gestureRecognizer = gestureRecognizer;

        // === CENTRALIZED CROSSHAIR VISIBILITY ===
        // Single authoritative condition: show ONLY when telekinesis ON and HOVERING
        const showCrosshair = window.TELEKINESIS_MODE === true && this.state === STATE.HOVERING;
        this.setCrosshairVisible(showCrosshair);
        if (showCrosshair) {
            this.setCrosshairColor('yellow');
        }

        // Check telekinesis mode (if not active, skip processing)
        if (window.TELEKINESIS_MODE === false) {
            return;
        }

        // Grab cooldown after throwing
        if (this.grabCooldown > 0) {
            this.grabCooldown -= deltaTime;
            // Transition from THROWN to IDLE when cooldown expires
            if (this.state === STATE.THROWN && this.grabCooldown <= 0) {
                this.state = STATE.IDLE;
            }
            return; // Don't process anything during cooldown
        }

        // === HAND-LOSS GRACE PERIOD ===
        if (this.state === STATE.GRABBED && !hasHand) {
            this.handLostTimer += deltaTime;

            if (this.handLostTimer >= this.handLostGraceDuration) {
                // Grace period expired - drop the object
                this.dropObject();
                this.handLostTimer = 0;
                return;
            }

            // During grace: keep holding using last valid state
            this.updateHoldPhysicsWithLastValid(deltaTime);
            return;
        } else if (hasHand) {
            this.handLostTimer = 0;  // Reset timer when hand is present
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
                // Crosshair handled by centralized logic above
                this.physics.setLevitating(false);

                if (isLookingAtCube) {
                    this.state = STATE.HOVERING;
                }
                break;

            case STATE.HOVERING:
                this.highlightMesh.material.opacity = 0.5;
                // Crosshair handled by centralized logic above

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
                // Crosshair handled by centralized logic above

                const settings = window.levitationSettings || {};
                const moveGesture = settings.gestureMove || 'OPEN_HAND';
                const dropGesture = settings.gestureDrop || 'CLOSED_FIST';
                const currentGestureName = Object.keys(GESTURE).find(k => GESTURE[k] === currentGesture) || 'NONE';

                const gestureDisp = document.getElementById('current-gesture-display');
                if (gestureDisp) gestureDisp.textContent = currentGestureName;

                if (currentGestureName === moveGesture) {
                    // Reset release gesture counter when in move gesture
                    this.releaseGestureHoldCount = 0;
                    this.lastReleaseGesture = null;

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
                        this.updateHoldPhysics(landmarks, deltaTime);
                    }
                } else if (this.isReleaseGestureStable(currentGestureName)) {
                    // Only drop if release gesture is stable (5 frames)
                    this.dropObject();
                } else {
                    // Continue holding even with unstable release gesture
                    this.updateHoldPhysics(landmarks, deltaTime);
                }
                break;
        }
    }

    /**
     * Set crosshair visibility with CSS transition support
     * @param {boolean} visible - Whether crosshair should be visible
     */
    setCrosshairVisible(visible) {
        if (this.crosshairEl) {
            if (visible) {
                this.crosshairEl.classList.remove('hidden');
            } else {
                this.crosshairEl.classList.add('hidden');
            }
        }
    }

    setCrosshairColor(color) {
        if (this.crosshairEl) {
            // Update bracket stroke color
            const brackets = this.crosshairEl.querySelectorAll('.bracket-left, .bracket-right');
            if (brackets.length > 0) {
                brackets.forEach(bracket => {
                    bracket.style.borderColor = color;
                });
            } else {
                // Fallback for old crosshair style
                const lines = this.crosshairEl.querySelectorAll('div');
                lines.forEach(line => {
                    line.style.background = color;
                });
            }
        }
    }

    /**
     * Force disable telekinesis - drop object if holding and reset to IDLE
     * Called when TELEKINESIS_MODE is toggled OFF
     */
    forceDisable() {
        // If holding, drop the object (not throw)
        if (this.state === STATE.GRABBED) {
            this.dropObject();
        }
        // Reset to IDLE
        this.state = STATE.IDLE;
        this.setCrosshairVisible(false);
        this.physics.setLevitating(false);
    }

    grabObject(landmarks) {
        this.state = STATE.GRABBED;
        this.physics.setLevitating(true);
        this.physics.setEnabled(true);
        this.targetObject.material.color.setHex(0x00FFFF);

        // === FIX: Reset camera baseline immediately to prevent aim jump ===
        if (window.handTrackingSystems?.cameraControl) {
            window.handTrackingSystems.cameraControl.resetBaseline(landmarks);
        }

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
    }

    dropObject() {
        this.state = STATE.IDLE;
        this.physics.setLevitating(false);
        this.targetObject.material.color.setHex(0xFF6600);
        // Reset release tracking
        this.releaseGestureHoldCount = 0;
        this.lastReleaseGesture = null;
    }

    /**
     * Update hold physics during hand-loss grace period (uses last valid state)
     */
    updateHoldPhysicsWithLastValid(deltaTime) {
        // Use last valid camera state instead of current
        this.targetPosition.copy(this.lastValidCameraPosition)
            .add(this.lastValidCameraForward.clone().multiplyScalar(this.lastValidHoldDistance));

        // Apply spring-damped force with increased damping (stable hold)
        const objPos = this.targetObject.position;
        const error = new THREE.Vector3().subVectors(this.targetPosition, objPos);

        const mass = this.physics.mass;
        const K = this.springK * mass;
        const D = (this.baseDampingD + this.stableDampingBonus) * mass;  // Extra damping during grace

        const springForce = error.clone().multiplyScalar(K);
        const velocity = this.physics.getVelocity();
        const dampingForce = velocity.clone().multiplyScalar(-D);
        const totalForce = springForce.add(dampingForce);

        if (totalForce.length() > this.maxForce) {
            totalForce.normalize().multiplyScalar(this.maxForce);
        }

        this.physics.applyForce(totalForce);

        // Auto-stabilize rotation
        const angVel = this.physics.angularVelocity;
        const stabilizeTorque = angVel.clone().multiplyScalar(-this.angularD);
        this.physics.applyTorque(stabilizeTorque);
    }

    /**
     * Update hold physics using spring-damped forces
     * @param {Array} landmarks - Hand landmarks
     * @param {number} deltaTime - Time since last frame
     */
    updateHoldPhysics(landmarks, deltaTime = 0.016) {
        if (!landmarks) return;

        // Calculate target position from hand input
        this.calculateTargetPosition(landmarks, deltaTime);

        // Track velocity for momentum throw
        const currentVel = this.physics.getVelocity();
        this.velocityHistory.push(currentVel.clone());
        if (this.velocityHistory.length > this.maxVelocityHistory) {
            this.velocityHistory.shift();
        }

        // === DYNAMIC DAMPING BASED ON HAND STABILITY ===
        let dynamicDampingD = this.baseDampingD;
        if (this.gestureRecognizer) {
            const vel = this.gestureRecognizer.getVelocity();
            const handSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

            if (handSpeed < this.handStabilityThreshold) {
                // Hand is stable - increase damping for steadier hold
                dynamicDampingD = this.baseDampingD + this.stableDampingBonus;
            } else if (handSpeed > 0.05) {
                // Hand is moving fast - reduce damping for responsiveness
                dynamicDampingD = this.baseDampingD - this.movingDampingReduction;
            }
        }

        // === SPRING-DAMPED FORCE ===
        const objPos = this.targetObject.position;
        const error = new THREE.Vector3().subVectors(this.targetPosition, objPos);

        const mass = this.physics.mass;
        const K = this.springK * mass;
        const D = dynamicDampingD * mass;

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
            this.breakTimer += deltaTime;
            if (this.breakTimer > this.breakTimeRequired) {
                this.dropObject();
                return;
            }
        } else {
            this.breakTimer = Math.max(0, this.breakTimer - deltaTime);
        }

        // === AUTO-STABILIZE ROTATION ===
        const angVel = this.physics.angularVelocity;
        const stabilizeTorque = angVel.clone().multiplyScalar(-this.angularD);
        this.physics.applyTorque(stabilizeTorque);

        // Add subtle hover animation
        this.targetObject.position.y += Math.sin(Date.now() / 300) * 0.001;
    }

    /**
     * Calculate target position from hand input
     * @param {Array} landmarks - Hand landmarks
     * @param {number} deltaTime - Time since last frame
     */
    calculateTargetPosition(landmarks, deltaTime = 0.016) {
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
        const centeringSpeed = 0.02;
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

        // === DT-BASED RATE LIMITING FOR HOLD DISTANCE ===
        // Max change of 8 units/sec instead of fixed lerp
        const distanceDelta = this.targetHoldDistance - this.holdDistance;
        const maxDelta = this.maxHoldDistanceRate * deltaTime;
        const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, distanceDelta));
        this.holdDistance += clampedDelta;

        // Calculate final target position
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);

        this.targetPosition.copy(this.camera.position)
            .add(forward.multiplyScalar(this.holdDistance));

        // === FIX: Object stays exactly on crosshair ray ===
        // Hand offsets are disabled so object doesn't drift from screen center
        // Push/pull (holdDistance) still works via hand size delta
        // To re-enable dragging: uncomment the lines below
        // this.targetPosition.add(right.multiplyScalar(this.handOffsetX));
        // this.targetPosition.y += this.handOffsetY;

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
     * Throw using momentum-based velocity with direction blending
     */
    throwObject() {
        // Calculate average velocity from history
        let avgVelocity = new THREE.Vector3(0, 0, 0);
        if (this.velocityHistory.length > 0) {
            for (const vel of this.velocityHistory) {
                avgVelocity.add(vel);
            }
            avgVelocity.divideScalar(this.velocityHistory.length);
        }

        // === THROW DIRECTION BLENDING ===
        // 80% camera forward, 20% hand velocity direction
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);

        const up = new THREE.Vector3(0, 1, 0);
        up.applyQuaternion(this.camera.quaternion);

        // Get hand velocity and compute camera-space direction
        let handVelDir = new THREE.Vector3(0, 0, 0);
        let handSpeed = 0;
        let wristFlick = 0;

        if (this.gestureRecognizer) {
            const vel = this.gestureRecognizer.getVelocity();
            handSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            wristFlick = this.gestureRecognizer.getWristFlickVelocity();

            // Convert 2D hand velocity to 3D camera-space direction
            // Note: MediaPipe X is inverted (mirror image)
            if (handSpeed > 0.01) {
                handVelDir.addScaledVector(right, -vel.x);
                handVelDir.addScaledVector(up, -vel.y);
                handVelDir.normalize();
            }
        }

        // Blend throw direction: 80% forward, 20% hand direction
        const throwDir = new THREE.Vector3();
        throwDir.addScaledVector(forward, 0.8);
        throwDir.addScaledVector(handVelDir, 0.2);
        throwDir.normalize();

        // === THROW SPEED with min/max limits ===
        const minThrowSpeed = 8;   // Raised from 2.0 - prevents "drops"
        const maxThrowSpeed = 45;  // Reduced from 100 - prevents chaos
        const wristFlickMultiplier = 400;
        const handSpeedMultiplier = 200;

        let throwSpeed = minThrowSpeed +
            (wristFlick * wristFlickMultiplier) +
            (handSpeed * handSpeedMultiplier);

        throwSpeed = Math.max(minThrowSpeed, Math.min(maxThrowSpeed, throwSpeed));

        // Add momentum from tracked velocity
        const momentumBonus = avgVelocity.clone().multiplyScalar(0.3);

        // Upward boost for underhand toss
        let upwardBoost = 5;
        if (this.gestureRecognizer) {
            const vel = this.gestureRecognizer.getVelocity();
            if (vel.y < -0.01) {
                upwardBoost += Math.abs(vel.y) * 200;
            }
        }

        // Apply final velocity along blended throw direction
        const throwVelocity = throwDir.clone().multiplyScalar(throwSpeed);
        throwVelocity.y += upwardBoost;
        throwVelocity.add(momentumBonus);

        this.physics.setVelocity(throwVelocity.x, throwVelocity.y, throwVelocity.z);

        // Release from levitation - use THROWN state to prevent instant re-grab
        this.state = STATE.THROWN;
        this.physics.setLevitating(false);
        this.targetObject.material.color.setHex(0xFF6600);

        // Set cooldown to prevent accidental re-grab
        this.grabCooldown = 0.4;

        // Reset release tracking
        this.releaseGestureHoldCount = 0;
        this.lastReleaseGesture = null;
    }
}
