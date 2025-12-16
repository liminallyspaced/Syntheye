// =================================================================================
// --- FIRST-PERSON-CAMERA.JS - FPS Camera Controller ---
// =================================================================================
// Handles first-person camera: mouse look, pointer lock, and mode switching.
// Manages transitions between FPS mode and fixed-camera levitation mode.
// =================================================================================

import * as THREE from 'three';
import { STATE, ROOM_DATA } from './config.js';
import { camera, scene } from './three-init.js';

// =================================================================================
// POINTER LOCK STATE
// =================================================================================
let isPointerLocked = false;
let mouseSensitivity = 0.002;

// =================================================================================
// PITCH LIMITS
// =================================================================================
const MIN_PITCH = -Math.PI / 2 + 0.1;  // Almost straight down
const MAX_PITCH = Math.PI / 2 - 0.1;   // Almost straight up

// =================================================================================
// LEVITATION MODE STATE
// =================================================================================
let savedFPSPosition = new THREE.Vector3();
let savedFPSYaw = 0;
let savedFPSPitch = 0;

// =================================================================================
// INITIALIZE FPS CAMERA
// =================================================================================
export function initFPSCamera() {
    const container = document.getElementById('three-container');

    // Click to lock pointer
    container.addEventListener('click', () => {
        if (STATE.cameraMode === 'FPS' && STATE.interaction_mode === 'OVERWORLD') {
            container.requestPointerLock();
        }
    });

    // Pointer lock change handler
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === container;
    });

    // Mouse move handler
    document.addEventListener('mousemove', handleMouseMove);

    console.log('FPS Camera initialized. Click to lock pointer.');
}

// =================================================================================
// PLAYER MESH LAYER (for FPS camera culling)
// =================================================================================
const PLAYER_LAYER = 1;  // Dedicated layer for player renderables

// =================================================================================
// ENTER FPS MODE (call once on mode transition)
// =================================================================================
// Hides player mesh via layers, shows FPS crosshair, sets camera mode
// This is called ONCE when entering FPS mode, NOT every frame
// =================================================================================
export function enterFPSMode() {
    STATE.cameraMode = 'FPS';

    // Hide player mesh via layer system (camera won't render layer 1)
    // This is the proper way to hide player - not per-frame visibility toggle
    if (window.playerMesh) {
        // Put player mesh and all children on layer 1
        window.playerMesh.layers.set(PLAYER_LAYER);
        window.playerMesh.traverse(child => {
            if (child.isMesh || child.isSkinnedMesh) {
                child.layers.set(PLAYER_LAYER);
            }
        });
    }

    // FPS camera only renders layer 0 (excludes player layer 1)
    camera.layers.set(0);

    // Show FPS crosshair (dot), hide levitation crosshair (brackets)
    const fpsCrosshair = document.getElementById('fps-crosshair');
    const levCrosshair = document.getElementById('crosshair');
    if (fpsCrosshair) fpsCrosshair.classList.remove('hidden');
    if (levCrosshair) levCrosshair.classList.add('hidden');

    console.log('Entered FPS Mode');
}

// =================================================================================
// HANDLE MOUSE MOVEMENT
// =================================================================================
function handleMouseMove(event) {
    if (!isPointerLocked) return;
    if (STATE.cameraMode !== 'FPS') return;
    if (STATE.interaction_mode !== 'OVERWORLD') return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Update yaw (horizontal rotation)
    STATE.player.yaw -= movementX * mouseSensitivity;

    // Update pitch (vertical rotation) with clamping
    STATE.player.pitch -= movementY * mouseSensitivity;
    STATE.player.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, STATE.player.pitch));
}

// =================================================================================
// UPDATE FPS CAMERA (called every frame)
// =================================================================================
// Camera position = STATE.player.position + eye height
// Camera orientation = quaternion from yaw/pitch (no gimbal lock)
// NOTE: Mesh visibility and crosshair are controlled in enterFPSMode(), not here
// =================================================================================
export function updateFPSCamera() {
    if (STATE.cameraMode !== 'FPS') return;

    const player = STATE.player;
    const eyeHeight = player.isCrouching ? player.crouchHeight : player.eyeHeight;

    // Position camera at player eye level
    // NOTE: Forward offset removed - rely on near clip + hidden mesh instead
    camera.position.set(
        player.position.x,
        player.position.y + eyeHeight,
        player.position.z
    );

    // Apply orientation from yaw/pitch using quaternion (avoids gimbal lock)
    // Yaw = rotation around Y axis, Pitch = rotation around X axis
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), player.pitch);
    camera.quaternion.copy(yawQuat.multiply(pitchQuat));
}

// =================================================================================
// LEVITATION ZONE DETECTION
// =================================================================================
export function getCurrentLevitationZone() {
    const roomConfig = ROOM_DATA[STATE.current_room];
    if (!roomConfig || !roomConfig.levitationZones) return null;

    const playerPos = STATE.player.position;

    for (const zone of roomConfig.levitationZones) {
        const b = zone.bounds;
        if (playerPos.x >= b.x1 && playerPos.x <= b.x2 &&
            playerPos.z >= b.z1 && playerPos.z <= b.z2) {
            return zone;
        }
    }
    return null;
}

// =================================================================================
// CHECK IF PLAYER INSIDE ANY LEVITATION ZONE
// =================================================================================
export function isInLevitationZone() {
    return getCurrentLevitationZone() !== null;
}

// =================================================================================
// ENTER LEVITATION MODE
// =================================================================================
export function enterLevitationMode(zone) {
    if (STATE.cameraMode === 'LEVITATION_PUZZLE') return false;

    // Save current FPS state for restoration
    savedFPSPosition.copy(STATE.player.position);
    savedFPSYaw = STATE.player.yaw;
    savedFPSPitch = STATE.player.pitch;

    // Switch to levitation puzzle mode
    STATE.cameraMode = 'LEVITATION_PUZZLE';
    STATE.currentLevitationZone = zone.id;

    // Exit pointer lock
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    // Snap camera to zone's fixed transform
    const pos = zone.cameraPosition;
    const target = zone.cameraTarget;
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(target.x, target.y, target.z);

    // Show playerMesh in levitation mode (fixed camera can see player)
    if (window.playerMesh) {
        window.playerMesh.visible = true;
    }

    // Swap crosshairs: hide FPS dot, show levitation brackets
    const fpsCrosshair = document.getElementById('fps-crosshair');
    const levCrosshair = document.getElementById('crosshair');
    if (fpsCrosshair) fpsCrosshair.classList.add('hidden');
    // Note: levCrosshair visibility controlled by LevitationSystem based on state

    console.log(`Entered Levitation Puzzle Mode: ${zone.id}`);
    return true;
}

// =================================================================================
// EXIT LEVITATION MODE
// =================================================================================
export function exitLevitationMode() {
    if (STATE.cameraMode !== 'LEVITATION_PUZZLE') return false;

    // Force drop any held object
    if (window.handTrackingSystems?.levitationSystem) {
        window.handTrackingSystems.levitationSystem.forceDisable();
    }

    // Restore FPS state
    STATE.player.position.copy(savedFPSPosition);
    STATE.player.yaw = savedFPSYaw;
    STATE.player.pitch = savedFPSPitch;

    // Clear levitation zone
    STATE.currentLevitationZone = null;

    // Transition to FPS mode (handles mesh layers, crosshair, camera mode)
    enterFPSMode();

    // Re-lock pointer after short delay (browser requires user gesture)
    console.log('Exited Levitation Mode. Click to re-lock pointer.');
    return true;
}

// =================================================================================
// TOGGLE LEVITATION MODE (E key)
// =================================================================================
export function toggleLevitationMode() {
    if (STATE.cameraMode === 'LEVITATION_PUZZLE') {
        return exitLevitationMode();
    }

    const zone = getCurrentLevitationZone();
    if (zone) {
        return enterLevitationMode(zone);
    }

    return false;
}

// =================================================================================
// CHECK IF PLAYER LEFT ZONE (force-exit failsafe)
// =================================================================================
export function checkLevitationZoneExit() {
    if (STATE.cameraMode !== 'LEVITATION_PUZZLE') return;

    const currentZone = getCurrentLevitationZone();
    if (!currentZone || currentZone.id !== STATE.currentLevitationZone) {
        console.log('Left levitation zone - force exiting');
        exitLevitationMode();
    }
}

// =================================================================================
// IS POINTER LOCKED
// =================================================================================
export function isPointerCurrentlyLocked() {
    return isPointerLocked;
}

// =================================================================================
// SET MOUSE SENSITIVITY
// =================================================================================
export function setMouseSensitivity(value) {
    mouseSensitivity = value;
}
