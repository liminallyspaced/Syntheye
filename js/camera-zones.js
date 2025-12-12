// =================================================================================
// --- CAMERA-ZONES.JS - Clock Tower Style Camera System ---
// =================================================================================
// Static camera zones per room. Camera LERPS when player enters new zone.
// Priority system: puzzle > hidden > general
// =================================================================================

import * as THREE from 'three';
import { camera } from './three-init.js';
import { STATE, ROOM_DATA } from './config.js';
import { showNarration } from './narration.js';

// =================================================================================
// CAMERA ZONE STATE
// =================================================================================
let currentZone = null;
let currentZoneName = '';

// Lerp transition state
let isTransitioning = false;
let targetCameraPosition = new THREE.Vector3();
let targetLookAt = new THREE.Vector3();
let currentLookAt = new THREE.Vector3();
let transitionSpeed = 0.08;
let trackPlayerMode = false;  // Track player position instead of fixed target
let playerPositionRef = new THREE.Vector3();  // Reference to player position

// Distance threshold for zone reevaluation
const ZONE_CHECK_DISTANCE = 0.5;
let lastCheckPosition = new THREE.Vector3();

// =================================================================================
// INITIALIZE CAMERA FOR ROOM
// =================================================================================
export function initCameraForRoom(roomKey, playerPos) {
    const roomConfig = ROOM_DATA[roomKey];
    if (!roomConfig) return;

    console.log(`initCameraForRoom: ${roomKey}, playerPos: (${playerPos.x}, ${playerPos.y}, ${playerPos.z})`);

    // Reset transition state
    isTransitioning = false;
    currentZone = null;
    currentZoneName = '';
    lastCheckPosition.copy(playerPos);

    // Set initial zone
    const zone = findBestZone(playerPos, roomConfig.cameraZones);
    console.log(`findBestZone returned: ${zone ? zone.name : 'null'}`);

    if (zone) {
        console.log(`Applying zone: ${zone.name}, camPos: (${zone.cameraPosition.x}, ${zone.cameraPosition.y}, ${zone.cameraPosition.z})`);
        applyZoneInstantly(zone);
    } else if (roomConfig.camera) {
        // Use room fallback camera
        const cam = roomConfig.camera;
        console.log(`Using fallback camera: (${cam.pos[0]}, ${cam.pos[1]}, ${cam.pos[2]})`);
        camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
        camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
        currentLookAt.set(cam.target[0], cam.target[1], cam.target[2]);
    }
}

// =================================================================================
// UPDATE CAMERA ZONE (called from game loop)
// =================================================================================
export function updateCameraZone(playerPos) {
    const roomConfig = ROOM_DATA[STATE.current_room];
    if (!roomConfig || !roomConfig.cameraZones) return;

    // Only check zones if player moved enough
    const distanceMoved = lastCheckPosition.distanceTo(playerPos);
    if (distanceMoved < ZONE_CHECK_DISTANCE) {
        return; // Player hasn't moved enough, skip check
    }
    lastCheckPosition.copy(playerPos);

    // Find best zone with hysteresis to prevent flickering at boundaries
    const bestZone = findBestZoneWithHysteresis(playerPos, roomConfig.cameraZones);

    // If zone changed, apply instantly (PS1 style instant camera cuts)
    if (bestZone && currentZoneName !== bestZone.name) {
        console.log(`Zone change: ${currentZoneName} -> ${bestZone.name}`);
        applyZoneInstantly(bestZone);
    } else if (!bestZone && currentZoneName !== '_fallback') {
        // No zone found, use room fallback
        applyFallbackCamera(roomConfig);
    }
}

// =================================================================================
// FIND BEST ZONE WITH HYSTERESIS (prevents flickering at boundaries)
// =================================================================================
function findBestZoneWithHysteresis(playerPos, zones) {
    if (!zones || zones.length === 0) return null;

    // Hysteresis buffer - player must be this far inside a zone to switch
    const HYSTERESIS = 1.5;

    let bestZone = null;
    let highestPriority = -1;

    for (const zone of zones) {
        const b = zone.bounds;

        // For the CURRENT zone, use normal bounds (easy to stay in)
        // For OTHER zones, use shrunk bounds (harder to enter)
        let inZone = false;

        if (zone.name === currentZoneName) {
            // Current zone - normal bounds
            inZone = playerPos.x >= b.x1 && playerPos.x <= b.x2 &&
                playerPos.z >= b.z1 && playerPos.z <= b.z2;
        } else {
            // Other zones - must be HYSTERESIS units inside to enter
            inZone = playerPos.x >= (b.x1 + HYSTERESIS) && playerPos.x <= (b.x2 - HYSTERESIS) &&
                playerPos.z >= (b.z1 + HYSTERESIS) && playerPos.z <= (b.z2 - HYSTERESIS);
        }

        if (inZone) {
            const priority = zone.priority || 0;
            if (priority > highestPriority) {
                highestPriority = priority;
                bestZone = zone;
            }
        }
    }

    return bestZone;
}

// =================================================================================
// FIND BEST ZONE (highest priority that contains player)
// =================================================================================
function findBestZone(playerPos, zones) {
    if (!zones || zones.length === 0) return null;

    let bestZone = null;
    let highestPriority = -1;

    for (const zone of zones) {
        if (isInBounds(playerPos, zone.bounds)) {
            const priority = zone.priority || 0;
            if (priority > highestPriority) {
                highestPriority = priority;
                bestZone = zone;
            }
        }
    }

    return bestZone;
}

// =================================================================================
// CHECK IF POSITION IS WITHIN BOUNDS
// =================================================================================
function isInBounds(pos, bounds) {
    return pos.x >= bounds.x1 && pos.x <= bounds.x2 &&
        pos.z >= bounds.z1 && pos.z <= bounds.z2;
}

// =================================================================================
// CHECK IF ZONE CHANGE IS DIAGONAL (opposite corners)
// =================================================================================
function isDiagonalZoneChange(fromZone, toZone) {
    // Diagonal pairs: SE↔NW and NE↔SW
    const diagonalPairs = [
        ['quadrant_se', 'quadrant_nw'],
        ['quadrant_nw', 'quadrant_se'],
        ['quadrant_ne', 'quadrant_sw'],
        ['quadrant_sw', 'quadrant_ne']
    ];

    return diagonalPairs.some(pair =>
        (fromZone === pair[0] && toZone === pair[1])
    );
}

// =================================================================================
// START TRANSITION TO NEW ZONE
// =================================================================================
function startTransitionToZone(zone) {
    console.log(`Camera zone: ${zone.name} (priority: ${zone.priority || 0})`);

    currentZoneName = zone.name;
    currentZone = zone;

    // Set target position (direct lerp, no waypoints)
    const pos = zone.cameraPosition;
    targetCameraPosition.set(pos.x, pos.y, pos.z);

    // Check if this zone tracks player or uses fixed target
    if (zone.trackPlayer) {
        trackPlayerMode = true;
    } else {
        trackPlayerMode = false;
        const target = zone.cameraTarget;
        targetLookAt.set(target.x, target.y, target.z);
    }

    // Set transition speed
    transitionSpeed = zone.transitionSpeed || 0.03;

    // Start transitioning
    isTransitioning = true;

    // Trigger zone narration if defined
    if (zone.narration) {
        showNarration(zone.narration, 3000);
    }
}

// =================================================================================
// APPLY ZONE INSTANTLY (no lerp - used for initial setup)
// =================================================================================
function applyZoneInstantly(zone) {
    console.log(`Camera zone (instant): ${zone.name}`);

    currentZoneName = zone.name;
    currentZone = zone;

    const pos = zone.cameraPosition;
    camera.position.set(pos.x, pos.y, pos.z);
    targetCameraPosition.set(pos.x, pos.y, pos.z);

    // Check if this zone tracks player or uses fixed target
    if (zone.trackPlayer) {
        trackPlayerMode = true;
        // Look at spawn position initially
        camera.lookAt(0, 1, 0);
        currentLookAt.set(0, 1, 0);
    } else {
        trackPlayerMode = false;
        const target = zone.cameraTarget;
        camera.lookAt(target.x, target.y, target.z);
        targetLookAt.set(target.x, target.y, target.z);
        currentLookAt.set(target.x, target.y, target.z);
    }

    isTransitioning = false;
}

// =================================================================================
// UPDATE CAMERA LERP
// =================================================================================
function updateCameraLerp(playerPos) {
    // Lerp camera position directly to target
    camera.position.lerp(targetCameraPosition, transitionSpeed);

    // If tracking player, look at player position
    if (trackPlayerMode && playerPos) {
        camera.lookAt(playerPos.x, playerPos.y + 1, playerPos.z);
        currentLookAt.set(playerPos.x, playerPos.y + 1, playerPos.z);
    } else {
        // Lerp look-at target (fixed target mode)
        currentLookAt.lerp(targetLookAt, transitionSpeed);
        camera.lookAt(currentLookAt);
    }

    // Check if transition is complete
    const posDistance = camera.position.distanceTo(targetCameraPosition);

    if (posDistance < 0.1) {
        camera.position.copy(targetCameraPosition);
        isTransitioning = false;
    }
}

// =================================================================================
// APPLY FALLBACK CAMERA
// =================================================================================
function applyFallbackCamera(roomConfig) {
    if (!roomConfig.camera) return;

    currentZoneName = '_fallback';
    currentZone = null;

    const cam = roomConfig.camera;
    targetCameraPosition.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    targetLookAt.set(cam.target[0], cam.target[1], cam.target[2]);
    transitionSpeed = 0.06;
    isTransitioning = true;

    console.log('Camera: transitioning to fallback');
}

// =================================================================================
// GET CURRENT ZONE NAME
// =================================================================================
export function getCurrentZoneName() {
    return currentZoneName;
}

// =================================================================================
// RESET CAMERA ZONES (call on room change)
// =================================================================================
export function resetCameraZones() {
    currentZone = null;
    currentZoneName = '';
    isTransitioning = false;
}

// =================================================================================
// SET INITIAL ZONE (call after room load) - Legacy compatibility
// =================================================================================
export function setInitialZone(playerPos) {
    initCameraForRoom(STATE.current_room, playerPos);
}

// =================================================================================
// FORCE CAMERA UPDATE (for debug/testing)
// =================================================================================
export function forceCameraUpdate(playerPos) {
    lastCheckPosition.set(0, 0, 0); // Reset to force recheck
    updateCameraZone(playerPos);
}

// =================================================================================
// IS TRANSITIONING
// =================================================================================
export function isCameraTransitioning() {
    return isTransitioning;
}
