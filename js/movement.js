// =================================================================================
// --- MOVEMENT.JS - First-Person Movement & Collision ---
// =================================================================================
// FPS movement: camera-relative WASD, sprint, jump, crouch, physics.
// Uses STATE.player for all position/velocity/state tracking.
// =================================================================================

import * as THREE from 'three';
import { STATE } from './config.js';
import { camera, playerMesh, targetMarkerMesh, playAnimation } from './three-init.js';
import { collidableMeshes } from './rooms.js';

// =================================================================================
// KEYBOARD CONTROLS STATE
// =================================================================================
export const controls = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,  // Sprint
    ctrl: false,   // Crouch
    space: false   // Jump
};

// Track if player is currently moving (for animation)
let isMoving = false;

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
    controls.ctrl = false;
    controls.space = false;

    // Reset movement state
    isMoving = false;

    // Reset velocity in STATE.player
    STATE.player.velocity.set(0, 0, 0);
    STATE.player.isGrounded = true;
    STATE.player.isCrouching = false;
    STATE.player.isRunning = false;

    // Reset legacy state
    STATE.currentSpeed = 0;
    STATE.moveDelayTimer = 0;
    STATE.active_target = null;

    // Play idle animation if playerMesh exists
    if (playerMesh) {
        playAnimation('Idle_Breathing', 0.15) ||
            playAnimation('idle_breathing', 0.15) ||
            playAnimation('Idle', 0.15);
    }
}

// =================================================================================
// COLLISION DETECTION (AABB)
// =================================================================================
// Check collision at a given position with optional height adjustment for crouching
// =================================================================================
export function checkCollision(nextX, nextZ, nextY = null) {
    const player = STATE.player;
    const currentY = nextY !== null ? nextY : player.position.y;
    const eyeHeight = player.isCrouching ? player.crouchHeight : player.eyeHeight;

    const playerRadius = 0.3;
    const playerMinX = nextX - playerRadius;
    const playerMaxX = nextX + playerRadius;
    const playerMinZ = nextZ - playerRadius;
    const playerMaxZ = nextZ + playerRadius;

    // Player Y height range (feet to head)
    const playerMinY = currentY + 0.1;
    const playerMaxY = currentY + eyeHeight;

    for (const collider of collidableMeshes) {
        // Skip colliders that are completely below player feet or above player head
        const cMinY = collider.pos.y - collider.dim.y / 2;
        const cMaxY = collider.pos.y + collider.dim.y / 2;
        if (cMaxY < playerMinY || cMinY > playerMaxY) {
            continue;
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
// CHECK CLEARANCE ABOVE (for crouch-jump standing check)
// =================================================================================
export function checkClearanceAbove() {
    const player = STATE.player;
    const standingHeight = player.eyeHeight;
    const currentHeight = player.isCrouching ? player.crouchHeight : standingHeight;

    // Check if there's room to stand up
    const testY = player.position.y + (standingHeight - currentHeight);
    return !checkCollision(player.position.x, player.position.z, testY);
}

// =================================================================================
// UPDATE PLAYER MOVEMENT (First-Person)
// =================================================================================
// Called every frame from the main game loop
// Handles camera-relative WASD, sprint, jump, crouch with physics
// =================================================================================
export function updatePlayerMovement() {
    if (STATE.interaction_mode !== 'OVERWORLD') return;
    if (STATE.cameraMode !== 'FPS') return;

    const player = STATE.player;
    const deltaTime = 1 / 60; // Approximate, should use actual deltaTime from game loop

    // =================================================================================
    // CROUCH HANDLING
    // =================================================================================
    const wantsToCrouch = controls.ctrl;
    if (wantsToCrouch && !player.isCrouching) {
        player.isCrouching = true;
    } else if (!wantsToCrouch && player.isCrouching) {
        // Only stand up if there's clearance
        if (checkClearanceAbove()) {
            player.isCrouching = false;
        }
        // Otherwise stay crouched
    }

    // =================================================================================
    // SPRINT HANDLING
    // =================================================================================
    player.isRunning = controls.shift && !player.isCrouching && player.isGrounded;

    // =================================================================================
    // MOVEMENT SPEED CALCULATION
    // =================================================================================
    let moveSpeed;
    if (player.isCrouching) {
        moveSpeed = player.crouchSpeed;
    } else if (player.isRunning) {
        moveSpeed = player.runSpeed;
    } else {
        moveSpeed = player.walkSpeed;
    }

    // =================================================================================
    // HORIZONTAL MOVEMENT (Camera-relative)
    // =================================================================================
    let moveX = 0;
    let moveZ = 0;

    // Get forward and right vectors from camera yaw
    const yaw = player.yaw;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    // WASD input
    if (controls.w) {
        moveX += forwardX;
        moveZ += forwardZ;
    }
    if (controls.s) {
        moveX -= forwardX;
        moveZ -= forwardZ;
    }
    if (controls.a) {
        moveX -= rightX;
        moveZ -= rightZ;
    }
    if (controls.d) {
        moveX += rightX;
        moveZ += rightZ;
    }

    // Normalize diagonal movement
    const inputLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (inputLength > 0) {
        moveX = (moveX / inputLength) * moveSpeed * deltaTime;
        moveZ = (moveZ / inputLength) * moveSpeed * deltaTime;
    }

    // =================================================================================
    // JUMP HANDLING
    // =================================================================================
    if (controls.space && player.isGrounded) {
        // Apply jump velocity
        player.velocity.y = player.jumpVelocity;
        player.isGrounded = false;

        // Crouch-jump: higher jump if crouching (Half-Life style)
        // The crouch gives clearance, not extra height
        controls.space = false; // Consume jump input
    }

    // =================================================================================
    // VERTICAL PHYSICS (Gravity)
    // =================================================================================
    if (!player.isGrounded) {
        player.velocity.y += player.gravity * deltaTime;
    }

    // Apply vertical velocity
    const nextY = player.position.y + player.velocity.y * deltaTime;

    // Floor collision
    const floorY = 0.05; // Ground level
    if (nextY <= floorY) {
        player.position.y = floorY;
        player.velocity.y = 0;
        player.isGrounded = true;
    } else {
        player.position.y = nextY;
        player.isGrounded = false;
    }

    // =================================================================================
    // HORIZONTAL COLLISION & MOVEMENT
    // =================================================================================
    const nextX = player.position.x + moveX;
    const nextZ = player.position.z + moveZ;

    let moved = false;

    if (!checkCollision(nextX, nextZ)) {
        player.position.x = nextX;
        player.position.z = nextZ;
        moved = inputLength > 0;
    } else {
        // Try to slide along walls
        if (!checkCollision(nextX, player.position.z)) {
            player.position.x = nextX;
            moved = true;
        } else if (!checkCollision(player.position.x, nextZ)) {
            player.position.z = nextZ;
            moved = true;
        }
    }

    // =================================================================================
    // SYNC LEGACY STATE
    // =================================================================================
    STATE.player_pos.copy(player.position);

    // Update playerMesh if it exists (for third-person fallback or debug)
    if (playerMesh) {
        playerMesh.position.copy(player.position);
        playerMesh.rotation.y = player.yaw;
    }

    // =================================================================================
    // ANIMATION STATE (only if playerMesh exists)
    // =================================================================================
    if (playerMesh) {
        setMovingState(moved && inputLength > 0);
    }
}

// =================================================================================
// ANIMATION STATE HELPER
// =================================================================================
function setMovingState(moving) {
    if (!playerMesh) return;

    if (moving !== isMoving) {
        isMoving = moving;

        if (moving) {
            // Transition to walking animation with fast crossfade
            playAnimation('walking', 0.15) ||
                playAnimation('Walking', 0.15) ||
                playAnimation('Walk', 0.15);
        } else {
            // Transition back to idle animation with fast crossfade
            playAnimation('Idle_Breathing', 0.15) ||
                playAnimation('idle_breathing', 0.15) ||
                playAnimation('Idle', 0.15) ||
                playAnimation('idle', 0.15);
        }
    }
}

// =================================================================================
// KEYBOARD EVENT HANDLERS FOR MOVEMENT
// =================================================================================
// These should be called from main.js keydown/keyup handlers
// =================================================================================
export function handleMovementKeyDown(key) {
    switch (key.toLowerCase()) {
        case 'w': controls.w = true; break;
        case 'a': controls.a = true; break;
        case 's': controls.s = true; break;
        case 'd': controls.d = true; break;
        case 'shift': controls.shift = true; break;
        case 'control': controls.ctrl = true; break;
        case ' ': controls.space = true; break;
    }
}

export function handleMovementKeyUp(key) {
    switch (key.toLowerCase()) {
        case 'w': controls.w = false; break;
        case 'a': controls.a = false; break;
        case 's': controls.s = false; break;
        case 'd': controls.d = false; break;
        case 'shift': controls.shift = false; break;
        case 'control': controls.ctrl = false; break;
        case ' ': controls.space = false; break;
    }
}
