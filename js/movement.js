// =================================================================================
// --- MOVEMENT.JS - Player Movement & Collision ---
// =================================================================================
// All WASD movement logic, player rotation, collision detection,
// and target click-to-move behavior.
// =================================================================================

import * as THREE from 'three';
import { STATE } from './config.js';
import { camera, playerMesh, targetMarkerMesh, animationController } from './three-init.js';
import { collidableMeshes } from './rooms.js';

// =================================================================================
// KEYBOARD CONTROLS STATE
// =================================================================================
export const controls = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false  // Hold shift to run
};

// Track if player is currently moving (for animation)
let isMoving = false;
let isRunning = false;  // Track running state for animation
let lastTurnDirection = 0; // -1 = left, 0 = none, 1 = right
let previousRotationY = 0; // Track rotation for turn detection


// =================================================================================
// RESET MOVEMENT STATE (call on room transitions)
// =================================================================================
export function resetMovement() {
    // Reset all keyboard controls
    controls.w = false;
    controls.a = false;
    controls.s = false;
    controls.d = false;
    controls.shift = false;

    // Reset movement state
    isMoving = false;
    isRunning = false;
    lastTurnDirection = 0;

    // Reset velocity state in STATE object
    STATE.currentSpeed = 0;
    STATE.moveDelayTimer = 0;
    STATE.active_target = null;

    // Request idle animation via new controller
    if (animationController) {
        animationController.request('Idle_HM');
    }
}

// =================================================================================
// COLLISION DETECTION (AABB)
// =================================================================================
export function checkCollision(nextX, nextZ) {
    const playerMinX = nextX - 0.5;
    const playerMaxX = nextX + 0.5;
    const playerMinZ = nextZ - 0.5;
    const playerMaxZ = nextZ + 0.5;

    // Player Y height range (feet to head) - feet slightly above floor
    const playerMinY = 0.2;
    const playerMaxY = 2;

    for (const collider of collidableMeshes) {
        // Skip colliders that are completely below player feet or above player head
        const cMinY = collider.pos.y - collider.dim.y / 2;
        const cMaxY = collider.pos.y + collider.dim.y / 2;
        if (cMaxY < playerMinY || cMinY > playerMaxY) {
            continue; // Collider is floor or ceiling, skip for player
        }

        const cMinX = collider.pos.x - collider.dim.x / 2;
        const cMaxX = collider.pos.x + collider.dim.x / 2;
        const cMinZ = collider.pos.z - collider.dim.z / 2;
        const cMaxZ = collider.pos.z + collider.dim.z / 2;

        if (playerMaxX > cMinX && playerMinX < cMaxX &&
            playerMaxZ > cMinZ && playerMinZ < cMaxZ) {
            return true; // Collision detected
        }
    }
    return false;
}

// =================================================================================
// UPDATE PLAYER MOVEMENT
// =================================================================================
// Called every frame from the main game loop
// Handles both click-to-move and WASD movement with inertia/weight simulation
// =================================================================================

// Track desired movement direction
let desiredMoveX = 0;
let desiredMoveZ = 0;
let wantsToMove = false;

// Stuck detection for click-to-move
let lastDistanceToTarget = Infinity;
let stuckTimer = 0;
const STUCK_THRESHOLD = 0.5; // seconds before considering stuck

export function updatePlayerMovement() {
    if (STATE.interaction_mode !== 'OVERWORLD') return;

    desiredMoveX = 0;
    desiredMoveZ = 0;
    wantsToMove = false;

    const cameraYaw = Math.atan2(
        camera.position.x - playerMesh.position.x,
        camera.position.z - playerMesh.position.z
    );

    // Click-to-move target tracking
    if (STATE.active_target) {
        const targetPos = STATE.active_target;
        const playerPos = playerMesh.position;

        // Update marker visual
        targetMarkerMesh.visible = true;
        targetMarkerMesh.position.set(targetPos.x, 0.1, targetPos.z);
        targetMarkerMesh.rotation.z += 0.05;

        const distance = playerPos.distanceTo(targetPos);

        // Check if we're stuck (not making progress)
        if (distance >= lastDistanceToTarget - 0.01) {
            stuckTimer += 0.016;
            if (stuckTimer > STUCK_THRESHOLD) {
                // Stuck for too long - cancel movement
                STATE.active_target = null;
                targetMarkerMesh.visible = false;
                STATE.currentSpeed = 0;
                stuckTimer = 0;
                lastDistanceToTarget = Infinity;
                setMovingState(false);
                return;
            }
        } else {
            stuckTimer = 0;
        }
        lastDistanceToTarget = distance;

        if (distance < STATE.move_tolerance) {
            STATE.active_target = null;
            targetMarkerMesh.visible = false;
            stuckTimer = 0;
            lastDistanceToTarget = Infinity;

            // Trigger interaction if we reached a hotspot
            if (STATE.active_hotspot && STATE.active_hotspot.trigger_on_reach) {
                import('./interactions.js').then(module => {
                    module.handleInteraction(STATE.active_hotspot);
                });
                STATE.active_hotspot = null;
            }
            // Don't return - let deceleration happen naturally
        } else {
            const direction = new THREE.Vector3()
                .subVectors(targetPos, playerPos)
                .setY(0)
                .normalize();
            desiredMoveX = direction.x;
            desiredMoveZ = direction.z;
            wantsToMove = true;
            playerMesh.rotation.y = Math.atan2(direction.x, direction.z);
        }
    }

    // WASD/Arrow key movement (only if no click-to-move target)
    let turnDirection = 0;  // -1 = left, 0 = forward, 1 = right
    let isTurningInPlace = false;  // True when pressing A/D without W/S

    if (!STATE.active_target && (controls.w || controls.s || controls.a || controls.d)) {
        targetMarkerMesh.visible = false;
        const forwardFactor = controls.w ? 1 : controls.s ? -1 : 0;
        const strafeFactor = controls.a ? 1 : controls.d ? -1 : 0;
        const forwardAngle = cameraYaw + Math.PI;
        let movementVector = new THREE.Vector2(0, 0);

        movementVector.x += forwardFactor * Math.sin(forwardAngle);
        movementVector.y += forwardFactor * Math.cos(forwardAngle);
        movementVector.x += strafeFactor * Math.sin(forwardAngle + Math.PI / 2);
        movementVector.y += strafeFactor * Math.cos(forwardAngle + Math.PI / 2);

        // Detect PURE turn-in-place: A or D pressed WITHOUT W or S
        if ((controls.a || controls.d) && !controls.w && !controls.s) {
            isTurningInPlace = true;
            turnDirection = controls.a ? -1 : 1;  // A = left, D = right
            wantsToMove = false;  // Don't translate, just rotate

            // Still update rotation for visual feedback
            if (movementVector.lengthSq() > 0) {
                movementVector.normalize();
                const newRotationY = Math.atan2(movementVector.x, movementVector.y);
                previousRotationY = newRotationY;
                playerMesh.rotation.y = newRotationY;
            }
        } else if (movementVector.lengthSq() > 0) {
            movementVector.normalize();
            desiredMoveX = movementVector.x;
            desiredMoveZ = movementVector.y;
            wantsToMove = true;

            const newRotationY = Math.atan2(movementVector.x, movementVector.y);

            // Detect turn direction from rotation change (while moving)
            let rotationDiff = newRotationY - previousRotationY;
            // Normalize rotation difference to -PI to PI
            while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
            while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

            // Threshold for significant turn (about 5 degrees)
            const turnThreshold = 0.08;
            if (rotationDiff > turnThreshold) {
                turnDirection = 1;  // Turning right
            } else if (rotationDiff < -turnThreshold) {
                turnDirection = -1; // Turning left
            }

            previousRotationY = newRotationY;
            playerMesh.rotation.y = newRotationY;
        }
    }

    // Handle movement delay (0.5s before character starts moving)
    if (wantsToMove) {
        // Run speed is 2x walk speed
        const targetSpeed = controls.shift ? STATE.speed * 2.0 : STATE.speed;
        const acceleration = controls.shift ? STATE.acceleration * 1.5 : STATE.acceleration;

        if (STATE.moveDelayTimer < STATE.moveDelay) {
            // Still in delay phase - accumulate time but don't move yet
            STATE.moveDelayTimer += 0.016; // ~60fps frame time
            // Pass actual turnDirection so turn animations trigger immediately
            setMovingState(true, controls.shift, turnDirection, false);
        } else {
            // Delay complete - accelerate towards max speed
            STATE.currentSpeed = Math.min(STATE.currentSpeed + acceleration, targetSpeed);
            // Also trigger animation here for turn direction
            setMovingState(true, controls.shift, turnDirection, false);
        }
    } else if (isTurningInPlace) {
        // Turn-in-place: not moving but rotating
        STATE.moveDelayTimer = 0;
        STATE.currentSpeed = Math.max(STATE.currentSpeed - STATE.deceleration, 0);
        setMovingState(false, false, turnDirection, true);  // isTurningInPlace = true
    } else {
        // Reset delay timer and decelerate
        STATE.moveDelayTimer = 0;
        STATE.currentSpeed = Math.max(STATE.currentSpeed - STATE.deceleration, 0);
    }

    // Apply movement with current velocity
    if (STATE.currentSpeed > 0.001) {
        const moveX = desiredMoveX * STATE.currentSpeed;
        const moveZ = desiredMoveZ * STATE.currentSpeed;

        const nextX = playerMesh.position.x + moveX;
        const nextZ = playerMesh.position.z + moveZ;

        let moved = false;

        if (!checkCollision(nextX, nextZ)) {
            playerMesh.position.x = nextX;
            playerMesh.position.z = nextZ;
            STATE.player_pos.set(nextX, playerMesh.position.y, nextZ);
            moved = true;
        } else {
            // Try to slide along walls
            if (!checkCollision(nextX, playerMesh.position.z)) {
                playerMesh.position.x = nextX;
                STATE.player_pos.x = nextX;
                moved = true;
            } else if (!checkCollision(playerMesh.position.x, nextZ)) {
                playerMesh.position.z = nextZ;
                STATE.player_pos.z = nextZ;
                moved = true;
            } else {
                // Completely blocked - cancel click-to-move and stop
                if (STATE.active_target) {
                    STATE.active_target = null;
                    if (targetMarkerMesh) targetMarkerMesh.visible = false;
                }
                // Reset velocity to stop movement
                STATE.currentSpeed = 0;
                setMovingState(false);
                return;
            }
        }

        if (moved) {
            setMovingState(true, controls.shift, turnDirection);
        }
    } else {
        setMovingState(false, false, 0);
    }
}

// =================================================================================
// ANIMATION STATE HELPER - Uses new AnimationController
// =================================================================================
// Outputs movement intent to the AnimationController which handles priority/locks
// @param moving - whether player is moving
// @param running - whether shift is held (run mode)
// @param turnDirection - -1 for left, 0 for forward, 1 for right
// @param turningInPlace - explicit turn-in-place flag (A/D without W/S)
// =================================================================================
function setMovingState(moving, running = false, turnDirection = 0, turningInPlace = false) {
    const stateChanged = (moving !== isMoving) || (running !== isRunning) || (turnDirection !== lastTurnDirection);

    if (stateChanged || turningInPlace) {
        isMoving = moving;
        isRunning = running;
        lastTurnDirection = turnDirection;

        // Build intent object for AnimationController
        const intent = {
            moveMagnitude: moving ? (running ? 1.0 : 0.5) : 0,
            isRunning: running,
            turnDirection: turnDirection,  // -1=left, 0=none, 1=right
            isTurningInPlace: turningInPlace
        };

        // Let AnimationController handle animation selection with priority system
        if (animationController) {
            animationController.updateFromIntent(intent);
        }
    }
}

