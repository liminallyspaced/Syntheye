// =================================================================================
// --- ROOMS.JS - Room Management ---
// =================================================================================
// Contains functions that build room geometry, load rooms, and switch between rooms.
// =================================================================================

import * as THREE from 'three';
import { STATE, ROOM_DATA } from './config.js';
import { scene, camera, playerMesh, targetMarkerMesh } from './three-init.js';
import { registerRevealable, clearRevealables } from './flashlight.js';
import { resetMovement } from './movement.js';
import { activateRoomVideos, deactivateAllVideos } from './video-manager.js';
import { initCameraForRoom, resetCameraZones } from './camera-zones.js';
import { resetSelfDialogTriggers } from './narration.js';

// =================================================================================
// EXPORTED ROOM STATE
// =================================================================================
export let currentRoomGroup = null;
export let collidableMeshes = [];

export function setCurrentRoomGroup(group) {
    currentRoomGroup = group;
}

export function setCollidableMeshes(meshes) {
    collidableMeshes = meshes;
}

// =================================================================================
// LOAD ALL ROOMS
// =================================================================================
// Pre-builds all room geometry and stores in ROOM_DATA[key].group
// Call this once at startup
// =================================================================================
export function loadAllRooms() {
    for (const key in ROOM_DATA) {
        const roomConfig = ROOM_DATA[key];
        roomConfig.group = new THREE.Group();
        roomConfig.colliders = [];

        // Build geometry from config
        roomConfig.geometry.forEach(g => {
            const geo = new THREE.BoxGeometry(g.dim[0], g.dim[1], g.dim[2]);
            const mat = new THREE.MeshLambertMaterial({ color: g.color, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.name = g.name;
            mesh.position.set(g.pos[0], g.pos[1], g.pos[2]);

            // Enable shadows - floor receives, objects cast and receive
            if (g.name === 'floor') {
                mesh.receiveShadow = true;
            } else {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }

            roomConfig.group.add(mesh);

            if (g.collider) {
                roomConfig.colliders.push({
                    pos: mesh.position,
                    dim: new THREE.Vector3(g.dim[0], g.dim[1], g.dim[2])
                });
            }
            if (g.hotspot) {
                mesh.userData.hotspot = g.hotspot;
                mesh.userData.isMeshHotspot = true;
            }

            // Store revealable info for flashlight system
            if (g.requiresFlashlight) {
                mesh.userData.requiresFlashlight = true;
                mesh.userData.revealId = g.revealId || g.name;
            }
        });

        console.log(`Room ${key}: Created ${roomConfig.group.children.length} objects`);

        // Store hotspot data without creating visual markers
        // (Hotspot visualization removed - use console logs instead)
        roomConfig.hotspots.forEach(h => {
            // Just store the hotspot references, no visual cylinders
        });
    }
    console.log('loadAllRooms complete');
}

// =================================================================================
// SET ACTIVE ROOM
// =================================================================================
// Switches to a new room, updates camera, and spawns player
// @param roomKey - Key from ROOM_DATA (e.g., 'ROOM_HALL')
// @param spawnPoint - Optional THREE.Vector3 for player spawn position
// @param onRoomReady - Optional callback fired when room is fully initialized
// =================================================================================
export function setRoom(roomKey, spawnPoint = null, onRoomReady = null) {
    console.log(`setRoom called: ${roomKey}`);
    if (currentRoomGroup) scene.remove(currentRoomGroup);

    // Clear revealables from previous room
    clearRevealables();

    const roomConfig = ROOM_DATA[roomKey];
    if (!roomConfig) {
        console.error(`ERROR: Room ${roomKey} not found in ROOM_DATA!`);
        return;
    }
    currentRoomGroup = roomConfig.group;
    collidableMeshes = roomConfig.colliders;
    scene.add(currentRoomGroup);

    // DIAGNOSTIC: Log room group details
    console.log(`setRoom: Added ${roomKey} with ${currentRoomGroup?.children.length} children`);
    console.log(`  Group visible: ${currentRoomGroup.visible}`);
    console.log(`  Group position: (${currentRoomGroup.position.x}, ${currentRoomGroup.position.y}, ${currentRoomGroup.position.z})`);
    if (currentRoomGroup.children.length > 0) {
        const firstChild = currentRoomGroup.children[0];
        console.log(`  First child: "${firstChild.name}" visible=${firstChild.visible} at (${firstChild.position.x}, ${firstChild.position.y}, ${firstChild.position.z})`);
        console.log(`  First child material color: ${firstChild.material?.color?.getHexString()}`);
    }

    // Expose for console debugging  
    window.debugScene = scene;
    window.debugRoomGroup = currentRoomGroup;

    STATE.current_room = roomKey;
    const newPos = spawnPoint || roomConfig.spawn;

    // Update legacy player_pos
    STATE.player_pos.copy(newPos);

    // Update new STATE.player.position
    STATE.player.position.copy(newPos);

    // Update playerMesh if it exists
    if (playerMesh) {
        playerMesh.position.copy(newPos);
    }

    // Camera positioning - ONLY in FPS mode (positive check)
    // Any other mode (levitation, future modes) should not have spawn camera writes
    if (STATE.cameraMode === 'FPS') {
        const eyeHeight = STATE.player.isCrouching ? STATE.player.crouchHeight : STATE.player.eyeHeight;
        camera.position.set(newPos.x, newPos.y + eyeHeight, newPos.z);
        // Use quaternion for orientation consistency
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), STATE.player.yaw);
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), STATE.player.pitch);
        camera.quaternion.copy(yawQuat.multiply(pitchQuat));
        console.log('[setRoom] FPS camera positioned at spawn');
    } else {
        console.log('[setRoom] Camera unchanged - mode is:', STATE.cameraMode);
    }

    // Reset movement velocity when entering new room
    STATE.currentSpeed = 0;
    STATE.moveDelayTimer = 0;
    STATE.active_target = null;

    // Reset controls and animation state
    resetMovement();

    if (targetMarkerMesh) targetMarkerMesh.visible = false;

    document.getElementById('room-title').textContent = `ROOM: ${roomConfig.name.toUpperCase()}`;

    // Register revealable objects for this room
    currentRoomGroup.traverse(child => {
        if (child.userData && child.userData.requiresFlashlight) {
            registerRevealable(child, child.userData.revealId);
        }
    });

    // Activate video screens for this room (ambient mode - silent looping)
    deactivateAllVideos();
    activateRoomVideos(roomKey);

    // Reset self-dialog triggers so they can fire again
    resetSelfDialogTriggers(roomKey);

    // Fire room-ready callback if provided (for mode transitions, item spawns, etc.)
    if (onRoomReady) {
        onRoomReady(roomKey, roomConfig);
    }
}

// =================================================================================
// SPAWN ROOM ITEMS
// =================================================================================
// Called once per room to spawn pickup items that haven't been collected yet
// Import spawnDroppedItem dynamically to avoid circular dependency
// =================================================================================
export function spawnRoomItems(roomKey) {
    const roomConfig = ROOM_DATA[roomKey];
    if (!roomConfig || !roomConfig.itemSpawns) return;

    // Dynamic import to avoid circular dependency with interactions.js
    import('./interactions.js').then(module => {
        import('./inventory.js').then(inv => {
            for (const spawn of roomConfig.itemSpawns) {
                // Only spawn if player doesn't already have the item
                if (!inv.hasItem(spawn.itemId)) {
                    module.spawnDroppedItem(spawn.itemId, spawn.pos);
                }
            }
        });
    });
}
