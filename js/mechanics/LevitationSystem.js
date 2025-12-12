/**
 * LevitationSystem.js
 * Manages interaction between Hand Tracking and the levitation cube.
 * Raycasting from screen center (crosshair).
 */

import * as THREE from 'three';
import { GESTURE } from '../hand-tracking/GestureRecognizer.js';

const STATE = {
    IDLE: 'IDLE',
    HOVERING: 'HOVERING',    // Crosshair is over cube
    GRABBED: 'GRABBED'       // Cube is being held
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

        // Movement
        this.targetPosition = new THREE.Vector3();
        this.grabDistance = 8.0; // Distance from camera when holding
        this.minGrabDistance = 1.5;  // Can bring very close
        this.maxGrabDistance = 30.0; // Can push very far

        // Track hand position for push/pull
        this.initialHandY = 0;
        this.baseGrabDistance = 8.0;
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

    // Reset reference points for fresh gesture start
    resetReferencePoints() {
        this.initialHandX = undefined;
        this.initialHandY = undefined;
        this.initialHandSize = undefined;
        this.lastHandSize = undefined; // Reset velocity tracking
        this.baseGrabDistance = this.grabDistance; // Keep current distance as new base
        this.handOffsetX = 0;
        this.handOffsetY = 0;
    }

    update(currentGesture, landmarks, gestureRecognizer = null) {
        if (!this.targetObject) return;

        // Store gesture recognizer for throw velocity
        this.gestureRecognizer = gestureRecognizer;

        // Raycast from screen center (crosshair)
        const screenCenter = new THREE.Vector2(0, 0);
        this.raycaster.setFromCamera(screenCenter, this.camera);
        const intersects = this.raycaster.intersectObject(this.targetObject);

        // Check for direct hit OR proximity hit (50% larger target area)
        let isLookingAtCube = intersects.length > 0;

        // If no direct hit, check if ray passes close to the cube (proximity check)
        if (!isLookingAtCube) {
            const rayOrigin = this.raycaster.ray.origin;
            const rayDir = this.raycaster.ray.direction;
            const cubePos = this.targetObject.position;

            // Calculate closest point on ray to cube center
            const toCube = new THREE.Vector3().subVectors(cubePos, rayOrigin);
            const t = toCube.dot(rayDir);

            if (t > 0) { // Only check if cube is in front of camera
                const closestPoint = new THREE.Vector3()
                    .copy(rayOrigin)
                    .add(rayDir.clone().multiplyScalar(t));

                const distance = closestPoint.distanceTo(cubePos);

                // Proximity threshold: 0.75 units (50% larger than 0.5 cube size)
                if (distance < 0.75) {
                    isLookingAtCube = true;
                }
            }
        }

        switch (this.state) {
            case STATE.IDLE:
                this.highlightMesh.material.opacity = 0;
                this.setCrosshairColor('cyan');

                if (isLookingAtCube) {
                    this.state = STATE.HOVERING;
                }
                break;

            case STATE.HOVERING:
                // Visual feedback - cube is highlighted
                this.highlightMesh.material.opacity = 0.5;
                this.setCrosshairColor('yellow');

                if (!isLookingAtCube) {
                    // Lost sight of cube
                    this.state = STATE.IDLE;
                } else if (currentGesture === GESTURE.THREE_FINGER) {
                    // GRAB with 3 fingers (pointer + middle + ring)
                    this.grabObject(landmarks);
                }
                break;

            case STATE.GRABBED:
                // Holding the cube
                this.highlightMesh.material.opacity = 0.8 + Math.sin(Date.now() / 100) * 0.2;
                this.setCrosshairColor('lime');

                if (currentGesture === GESTURE.OPEN_HAND) {
                    // OPEN_HAND: check for movement/rotation to decide throw vs drop
                    if (this.gestureRecognizer) {
                        const vel = this.gestureRecognizer.getVelocity();
                        const handSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
                        const wristFlick = this.gestureRecognizer.getWristFlickVelocity();

                        // Throw if hand is moving OR wrist is rotating
                        if (handSpeed > 0.02 || wristFlick > 0.03) {
                            this.throwObject();
                        } else {
                            // Hand is still - just drop
                            this.dropObject();
                        }
                    } else {
                        this.dropObject();
                    }
                } else if (currentGesture === GESTURE.CLOSED_FIST) {
                    // CLOSED_FIST: drop object (closing hand releases)
                    this.dropObject();
                } else if (currentGesture === GESTURE.THREE_FINGER) {
                    // THREE_FINGER: move + push/pull based on hand distance
                    this.moveAndPushPull(landmarks);
                } else if (currentGesture === GESTURE.PINCH) {
                    // PINCH: FREEZE object in place - allows user to reposition hand
                    // Don't move the object at all, just keep holding it where it is
                    // Reset reference points so THREE_FINGER starts fresh from new hand position
                    this.initialHandX = undefined;
                    this.initialHandY = undefined;
                    this.initialHandSize = undefined;
                    this.lastHandSize = undefined;
                    this.baseGrabDistance = this.grabDistance;
                    this.handOffsetX = 0;
                    this.handOffsetY = 0;
                    // Object stays at current position (no movement call)
                } else {
                    // Any other gesture (TWO_FINGER, NONE, etc): keep holding in place
                    // Don't move, just maintain position
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
        this.physics.setEnabled(false);
        this.targetObject.material.color.setHex(0x00FFFF); // Cyan

        // Calculate actual distance to object and use that as grab distance
        const objectPos = this.targetObject.position.clone();
        const cameraPos = this.camera.position.clone();
        const actualDistance = objectPos.distanceTo(cameraPos);

        // Use the actual distance as starting point
        this.grabDistance = Math.max(this.minGrabDistance, Math.min(this.maxGrabDistance, actualDistance));
        this.baseGrabDistance = this.grabDistance;

        // Store initial hand Z for push/pull baseline
        if (landmarks) {
            this.initialHandZ = landmarks[9].z;
            this.lastPushPullZ = landmarks[9].z;
        }

        console.log(`Levitation: Object Grabbed at distance ${this.grabDistance.toFixed(1)}!`);
    }

    dropObject() {
        this.state = STATE.IDLE;
        this.physics.setEnabled(true);
        this.targetObject.material.color.setHex(0x0000FF); // Blue
        this.physics.resetVelocity();
        console.log("Levitation: Object Dropped!");
    }

    moveObject(landmarks) {
        // Adjust grab distance based on hand Y position (push/pull)
        if (landmarks) {
            const currentHandY = landmarks[9].y; // Palm center

            // Initialize on first call - use CURRENT position as baseline
            if (this.initialHandY === undefined || this.initialHandY === 0) {
                this.initialHandY = currentHandY;
                this.baseGrabDistance = this.grabDistance; // Current distance becomes new base
            }

            const deltaY = this.initialHandY - currentHandY; // Higher hand (lower Y) = push forward

            // Map deltaY to distance change
            // Moving hand UP (negative deltaY in screen coords) = push object away
            this.grabDistance = this.baseGrabDistance + (deltaY * 30);
            this.grabDistance = Math.max(this.minGrabDistance, Math.min(this.maxGrabDistance, this.grabDistance));
        }

        // Move cube to adjusted distance in front of camera
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        const targetPoint = new THREE.Vector3()
            .copy(this.camera.position)
            .add(forward.multiplyScalar(this.grabDistance));

        // Lerp for smoothness
        this.targetObject.position.lerp(targetPoint, 0.1);

        // Subtle float wobble
        this.targetObject.position.y += Math.sin(Date.now() / 300) * 0.003;
    }

    pullObject() {
        // Gradually decrease grab distance to pull object toward camera
        this.grabDistance -= 0.15;
        this.grabDistance = Math.max(this.minGrabDistance, this.grabDistance);
        this.baseGrabDistance = this.grabDistance; // Update base so PEACE gesture uses new distance

        // Move cube toward camera
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        const targetPoint = new THREE.Vector3()
            .copy(this.camera.position)
            .add(forward.multiplyScalar(this.grabDistance));

        // Faster lerp for pull effect
        this.targetObject.position.lerp(targetPoint, 0.15);
    }

    moveAndPushPull(landmarks) {
        // ALL MOVEMENT IS RELATIVE to where hand was when gesture started
        // XY: Hand movement from initial position controls object offset
        // Push/Pull: Hand size change from initial size controls distance

        if (!landmarks) return;

        const palmCenter = landmarks[9];
        const wrist = landmarks[0];
        const middleTip = landmarks[12];
        const handX = palmCenter.x;
        const handY = palmCenter.y;

        // Calculate current hand size
        const handSize = Math.sqrt(
            Math.pow(middleTip.x - wrist.x, 2) +
            Math.pow(middleTip.y - wrist.y, 2)
        );

        // === INITIALIZE on first call - this becomes the BASELINE ===
        if (this.initialHandX === undefined) {
            this.initialHandX = handX;
            this.initialHandY = handY;
            this.initialHandSize = handSize;
            this.baseGrabDistance = this.grabDistance;
            // Store initial object offset from camera forward
            this.baseOffsetX = 0;
            this.baseOffsetY = 0;
        }

        // === XY MOVEMENT - RELATIVE to initial position ===
        // Only the CHANGE from initial position affects object position
        const deltaX = this.initialHandX - handX; // Hand moved left = positive 
        const deltaY = this.initialHandY - handY; // Hand moved up = positive

        this.handOffsetX = this.baseOffsetX + deltaX * 12; // Scale for object movement
        this.handOffsetY = this.baseOffsetY + deltaY * 8;

        // === PUSH/PULL - RELATIVE to initial hand size + VELOCITY ===
        // Hand closer to camera = bigger hand size = push object away
        // Hand farther from camera = smaller hand size = pull object closer
        const sizeDiff = handSize - this.initialHandSize;

        // Track hand size velocity (how fast hand is moving toward/away)
        if (this.lastHandSize === undefined) {
            this.lastHandSize = handSize;
        }
        const sizeVelocity = handSize - this.lastHandSize;
        this.lastHandSize = handSize;

        // Smaller dead zone for more sensitivity
        let adjustedDiff = 0;
        const deadZone = 0.01;
        if (Math.abs(sizeDiff) > deadZone) {
            adjustedDiff = sizeDiff > 0 ? sizeDiff - deadZone : sizeDiff + deadZone;
        }

        // VELOCITY BONUS: faster movement = more push/pull effect
        // sizeVelocity typically -0.01 to 0.01 per frame
        const velocityMultiplier = 200; // Boost from velocity
        const velocityBonus = sizeVelocity * velocityMultiplier;

        // Combined strength: distance offset + velocity boost
        const pushPullStrength = 40;
        let targetDistance = this.baseGrabDistance + (adjustedDiff * pushPullStrength) + velocityBonus;
        targetDistance = Math.max(this.minGrabDistance, Math.min(this.maxGrabDistance, targetDistance));

        // Faster response for snappy push/pull
        this.grabDistance = this.grabDistance * 0.8 + targetDistance * 0.2;

        // === FINAL POSITION ===
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);

        let targetPoint = new THREE.Vector3()
            .copy(this.camera.position)
            .add(forward.multiplyScalar(this.grabDistance));

        targetPoint.add(right.multiplyScalar(this.handOffsetX));
        targetPoint.y += this.handOffsetY;

        this.targetObject.position.lerp(targetPoint, 0.12);
        this.targetObject.position.y += Math.sin(Date.now() / 300) * 0.002;
    }

    throwObject() {
        // Get hand velocity for throw direction AND wrist flick for strength
        let throwDirX = 0;
        let throwDirY = 0;
        let handSpeed = 0;
        let wristFlick = 0;

        if (this.gestureRecognizer) {
            const vel = this.gestureRecognizer.getVelocity();
            // Calculate hand speed (magnitude of velocity) - for direction
            handSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

            // Map hand velocity to throw direction (weaker effect now)
            throwDirX = -vel.x * 80; // Flip X for mirrored webcam
            throwDirY = -vel.y * 80; // Flip Y (MediaPipe Y is inverted)

            // Get WRIST FLICK velocity - this is the main throw strength
            wristFlick = this.gestureRecognizer.getWristFlickVelocity();
        }

        // Get base direction from camera
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        // Dynamic throw speed based primarily on WRIST FLICK
        // wristFlick typically ranges from 0 to 0.3 for fast flicks
        const minThrowSpeed = 10.0;
        const maxThrowSpeed = 100.0;
        const wristFlickMultiplier = 400; // Wrist flick is main factor
        const handSpeedMultiplier = 200; // Hand speed is secondary

        // Calculate throw speed from wrist flick + hand speed
        let throwSpeed = minThrowSpeed +
            (wristFlick * wristFlickMultiplier) +
            (handSpeed * handSpeedMultiplier);

        throwSpeed = Math.min(throwSpeed, maxThrowSpeed); // Cap at max

        console.log(`Throw: speed=${throwSpeed.toFixed(1)}, wristFlick=${wristFlick.toFixed(4)}, handSpeed=${handSpeed.toFixed(4)}`);

        // Apply velocity in throw direction
        this.physics.setVelocity(
            forward.x * throwSpeed + throwDirX,
            forward.y * throwSpeed + throwDirY + 8, // Bigger upward arc
            forward.z * throwSpeed
        );

        // Enable physics and reset state
        this.state = STATE.IDLE;
        this.physics.setEnabled(true);
        this.targetObject.material.color.setHex(0xFF6600); // Orange flash for throw

        // Reset color after brief flash
        setTimeout(() => {
            this.targetObject.material.color.setHex(0x0000FF);
        }, 200);
    }
}
