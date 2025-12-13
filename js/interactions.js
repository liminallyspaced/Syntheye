// =================================================================================
// --- INTERACTIONS.JS - Interaction System ---
// =================================================================================
// Raycasting to detect hotspots, interaction handling, door transitions,
// popup content selection, and dropped item pickups.
// =================================================================================

import * as THREE from 'three';
import { STATE, ROOM_DATA } from './config.js';
import { SoundManager } from './sound.js';
import { camera, raycaster, targetMarkerMesh, playOnceAnimation, scene } from './three-init.js';
import { currentRoomGroup, setRoom } from './rooms.js';
import { openPopup } from './utils.js';
import { updateSecretDoorState } from './puzzle.js';
import { resetMovement } from './movement.js';
import { addItem, removeItem, hasItem, ITEM_DATA, setOnItemDroppedToWorld } from './inventory.js';
import { openPadlock } from './padlock.js';
import { enterVideoInspect } from './video-manager.js';

// =================================================================================
// DROPPED ITEMS TRACKING
// =================================================================================
// Items dropped on the ground that can be picked up
// Each entry: { mesh, itemId, position, roomKey }
// =================================================================================
const droppedItems = [];

// =================================================================================
// SPAWN DROPPED ITEM IN WORLD
// =================================================================================
export function spawnDroppedItem(itemId, position) {
    const itemData = ITEM_DATA[itemId];
    if (!itemData) {
        console.warn(`Cannot spawn unknown item: ${itemId}`);
        return null;
    }

    // Create a glowing pickup mesh
    const geometry = new THREE.SphereGeometry(0.4, 8, 8);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff6600,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.8
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, 0.5, position.z);
    mesh.castShadow = true;

    // Add floating animation data
    mesh.userData.floatOffset = Math.random() * Math.PI * 2;
    mesh.userData.isDroppedItem = true;
    mesh.userData.itemId = itemId;
    mesh.userData.itemName = itemData.name;

    // Create hotspot data for the mesh
    mesh.userData.hotspot = {
        type: 'pickup',
        itemId: itemId,
        prompt: `PICK UP: ${itemData.name.toUpperCase()}`,
        pos: mesh.position.clone()
    };
    mesh.userData.isMeshHotspot = true;

    // Add to current room group
    if (currentRoomGroup) {
        currentRoomGroup.add(mesh);
    } else {
        scene.add(mesh);
    }

    // Track the dropped item
    droppedItems.push({
        mesh: mesh,
        itemId: itemId,
        position: mesh.position.clone(),
        roomKey: STATE.current_room
    });

    console.log(`Dropped item spawned: ${itemData.name} at`, position);
    return mesh;
}

// =================================================================================
// PICKUP DROPPED ITEM
// =================================================================================
export function pickupDroppedItem(itemId) {
    const index = droppedItems.findIndex(d => d.itemId === itemId && d.roomKey === STATE.current_room);
    if (index === -1) return false;

    const dropped = droppedItems[index];

    // Add to inventory
    if (addItem(itemId)) {
        // Remove mesh from scene
        if (dropped.mesh.parent) {
            dropped.mesh.parent.remove(dropped.mesh);
        }
        dropped.mesh.geometry.dispose();
        dropped.mesh.material.dispose();

        // Remove from tracking
        droppedItems.splice(index, 1);

        SoundManager.playSuccess();
        console.log(`Picked up: ${itemId}`);
        return true;
    }

    return false;
}

// =================================================================================
// UPDATE DROPPED ITEMS (call in game loop for floating animation)
// =================================================================================
export function updateDroppedItems(time) {
    for (const dropped of droppedItems) {
        if (dropped.mesh && dropped.roomKey === STATE.current_room) {
            // Floating bob animation
            const offset = dropped.mesh.userData.floatOffset || 0;
            dropped.mesh.position.y = 0.5 + Math.sin(time * 2 + offset) * 0.15;
            dropped.mesh.rotation.y += 0.02;
        }
    }
}

// Initialize the drop callback
setOnItemDroppedToWorld((itemId, data) => {
    // Spawn item slightly in front of player
    const spawnPos = data.playerPosition.clone();
    spawnPos.x += (Math.random() - 0.5) * 1.5;
    spawnPos.z += (Math.random() - 0.5) * 1.5;
    spawnDroppedItem(itemId, spawnPos);
});

// =================================================================================
// MOUSE CLICK HANDLER
// =================================================================================
export function handleMouseDown(event) {
    SoundManager.init(); // Ensure audio context starts
    if (STATE.interaction_mode !== 'OVERWORLD') return;

    const rect = document.getElementById('three-container').getBoundingClientRect();
    const pointer = new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);
    const interactiveMeshes = currentRoomGroup.children.filter(
        c => c.userData.isMeshHotspot || c.userData.isHotspot
    );
    const intersects = raycaster.intersectObjects(interactiveMeshes, false);

    let clickedHotspot = null;
    if (intersects.length > 0) {
        for (const intersect of intersects) {
            if (intersect.object.userData.hotspot) {
                clickedHotspot = intersect.object.userData.hotspot;
                break;
            }
        }
    }

    if (clickedHotspot) {
        SoundManager.playBlip();
        const targetPos = new THREE.Vector3().copy(clickedHotspot.pos || clickedHotspot.position);
        const interactionPoint = targetPos.clone();
        interactionPoint.setY(STATE.player_pos.y);

        // Offset calculation - move player to face the hotspot
        const camAngle = Math.atan2(
            camera.position.x - targetPos.x,
            camera.position.z - targetPos.z
        );
        interactionPoint.x += 2 * Math.sin(camAngle);
        interactionPoint.z += 2 * Math.cos(camAngle);

        STATE.active_target = interactionPoint;
        STATE.active_hotspot = { ...clickedHotspot, trigger_on_reach: true };

    } else {
        // Click on floor to move
        const floorMesh = currentRoomGroup.children.find(c => c.name === 'floor');
        if (floorMesh) {
            const floorIntersects = raycaster.intersectObjects([floorMesh], false);
            if (floorIntersects.length > 0) {
                const target = floorIntersects[0].point.clone();
                target.y = STATE.player_pos.y;
                STATE.active_target = target;
                STATE.active_hotspot = null;

                // Audio Feedback for movement click
                SoundManager.playTone(200, 'triangle', 0.05, 0.05);
            }
        }
    }
}

// =================================================================================
// CHECK HOTSPOTS (proximity-based)
// =================================================================================
export function checkHotspots() {
    if (STATE.interaction_mode !== 'OVERWORLD') {
        document.getElementById('interaction-prompt').classList.add('hidden');
        STATE.active_hotspot = null;
        return;
    }

    const roomConfig = ROOM_DATA[STATE.current_room];
    let interactionPossible = false;
    let closestHotspot = null;
    let closestDistanceSq = Infinity;

    // Check door/trigger hotspots
    for (const hotspot of roomConfig.hotspots) {
        const dx = STATE.player_pos.x - hotspot.pos.x;
        const dz = STATE.player_pos.z - hotspot.pos.z;
        const distanceSq = dx * dx + dz * dz;

        if (distanceSq < hotspot.radius * hotspot.radius) {
            if (distanceSq < closestDistanceSq) {
                closestHotspot = hotspot;
                closestDistanceSq = distanceSq;
                interactionPossible = true;
            }
        }
    }

    // Check geometry-attached hotspots
    for (const geo of roomConfig.geometry) {
        if (geo.hotspot) {
            const dx = STATE.player_pos.x - geo.pos[0];
            const dz = STATE.player_pos.z - geo.pos[2];
            const distanceSq = dx * dx + dz * dz;
            if (distanceSq < 2.5 * 2.5) {
                if (distanceSq < closestDistanceSq) {
                    closestHotspot = geo.hotspot;
                    closestHotspot.pos = new THREE.Vector3(...geo.pos);
                    closestDistanceSq = distanceSq;
                    interactionPossible = true;
                }
            }
        }
    }

    // Check dropped items on the ground
    for (const dropped of droppedItems) {
        if (dropped.roomKey === STATE.current_room && dropped.mesh) {
            const dx = STATE.player_pos.x - dropped.mesh.position.x;
            const dz = STATE.player_pos.z - dropped.mesh.position.z;
            const distanceSq = dx * dx + dz * dz;
            const pickupRadius = 2.0; // 2 unit pickup range

            if (distanceSq < pickupRadius * pickupRadius) {
                if (distanceSq < closestDistanceSq) {
                    closestHotspot = dropped.mesh.userData.hotspot;
                    closestDistanceSq = distanceSq;
                    interactionPossible = true;
                }
            }
        }
    }

    if (interactionPossible && closestHotspot) {
        STATE.active_hotspot = closestHotspot;
        document.getElementById('interaction-prompt').textContent =
            `[ ! ] PRESS [E] / [CLICK] TO ENGAGE: ${closestHotspot.prompt.toUpperCase()}`;

        // Show locked message only if not in Free Roam mode
        if (closestHotspot.locked && STATE.difficulty !== 'freeroam') {
            document.getElementById('interaction-prompt').textContent =
                `[ ! ] DOOR LOCKED - REQUIRES KEY ITEM`;
        }
        document.getElementById('interaction-prompt').classList.remove('hidden');
    } else {
        document.getElementById('interaction-prompt').classList.add('hidden');
        STATE.active_hotspot = null;
    }
}

// =================================================================================
// HANDLE E KEY INTERACTION
// =================================================================================
export function handleEInteraction() {
    if (STATE.active_hotspot && STATE.interaction_mode === 'OVERWORLD') {
        const hotspot = STATE.active_hotspot;

        // Play interact animation
        playOnceAnimation('Interact');

        if (hotspot.type === 'door') {
            // Free Roam mode: bypass all locked doors
            if (hotspot.locked && STATE.difficulty !== 'freeroam') {
                SoundManager.playBlip(); // Deny sound
                return;
            }
            startTransition(hotspot.target_room, hotspot.target_spawn);
        } else if (hotspot.type === 'text' || hotspot.type === 'inspect') {
            openPopup(hotspot);
        } else if (hotspot.type === 'pickup') {
            // Pick up dropped item
            pickupDroppedItem(hotspot.itemId);
            STATE.active_hotspot = null;
            document.getElementById('interaction-prompt').classList.add('hidden');
        } else if (hotspot.type === 'puzzle_statue') {
            // Statue puzzle - check if player has both statue head pieces
            handleStatuePuzzle(hotspot);
        } else if (hotspot.type === 'padlock') {
            // Padlock puzzle - open combination UI
            handlePadlockInteraction(hotspot);
        } else if (hotspot.type === 'video_screen') {
            // Video screen - enter focused inspect mode
            SoundManager.playBlip();
            enterVideoInspect(hotspot.videoScreenId);
        }
    }
}

// =================================================================================
// STATUE PUZZLE HANDLER
// =================================================================================
function handleStatuePuzzle(hotspot) {
    const hasLeft = hasItem('statue_head_left');
    const hasRight = hasItem('statue_head_right');

    if (hasLeft && hasRight) {
        // Player has both pieces - complete the puzzle!
        removeItem('statue_head_left');
        removeItem('statue_head_right');

        // Mark puzzle as complete
        const roomConfig = ROOM_DATA['ROOM_CONCERT'];
        if (roomConfig) {
            roomConfig.puzzleCompleted = true;
        }

        // Unlock the door to the next room
        unlockDoor('ROOM_CONCERT', 'door_next');

        // Update the statue hotspot prompt
        hotspot.prompt = 'RESTORED STATUE';

        // Play success sound and show message
        SoundManager.playSuccess();
        openPopup({ type: 'text', content_id: 'statue_complete' });

        console.log('Statue puzzle completed! Door unlocked.');
    } else if (hasLeft || hasRight) {
        // Player has one piece
        SoundManager.playBlip();
        openPopup({
            type: 'text',
            content_id: null,
            title: 'Incomplete Statue',
            text: 'YOU HAVE ONE HALF OF THE HEAD. FIND THE OTHER PIECE TO RESTORE THE STATUE.'
        });
    } else {
        // Player has no pieces
        openPopup({ type: 'text', content_id: 'statue_interact' });
    }
}

// =================================================================================
// PADLOCK INTERACTION HANDLER
// =================================================================================
function handlePadlockInteraction(hotspot) {
    // Check if already unlocked
    if (hotspot.unlocked) {
        SoundManager.playBlip();
        openPopup({
            type: 'text',
            content_id: null,
            title: 'Already Open',
            text: 'THIS CASE HAS ALREADY BEEN OPENED.'
        });
        return;
    }

    // Open the padlock UI with the correct code
    const correctCode = hotspot.code || '0000';
    const onSuccess = (hotspotId) => {
        // Mark as unlocked
        hotspot.unlocked = true;

        // Spawn the reward item if specified
        if (hotspot.rewardItem) {
            const rewardPos = new THREE.Vector3(
                hotspot.rewardSpawn?.x || STATE.player_pos.x + 1,
                hotspot.rewardSpawn?.y || 0.5,
                hotspot.rewardSpawn?.z || STATE.player_pos.z
            );
            spawnDroppedItem(hotspot.rewardItem, rewardPos);
        }

        // Update prompt
        hotspot.prompt = hotspot.prompt.replace(' (LOCKED)', ' (OPEN)');

        // Show success message
        SoundManager.playSuccess();
        openPopup({
            type: 'text',
            content_id: null,
            title: 'Case Opened!',
            text: hotspot.successMessage || 'YOU UNLOCKED THE CASE!'
        });

        console.log(`Padlock unlocked: ${hotspotId}`);
    };

    openPadlock(correctCode, onSuccess, hotspot.name);
}

// =================================================================================
// UNLOCK DOOR HELPER
// =================================================================================
export function unlockDoor(roomKey, doorName) {
    const roomConfig = ROOM_DATA[roomKey];
    if (!roomConfig) return;

    for (const hotspot of roomConfig.hotspots) {
        if (hotspot.name === doorName) {
            hotspot.locked = false;
            hotspot.prompt = hotspot.prompt.replace(' (LOCKED)', '');

            // Play success sound
            SoundManager.playSuccess();

            // Screen flash effect for puzzle progress
            showPuzzleFlash();

            console.log(`Door unlocked: ${doorName} in ${roomKey}`);
            return;
        }
    }
}

// =================================================================================
// PUZZLE PROGRESS VISUAL FEEDBACK
// =================================================================================
function showPuzzleFlash() {
    // Create a temporary green flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 255, 100, 0.3);
        pointer-events: none;
        z-index: 9998;
        animation: puzzleFlash 0.5s ease-out forwards;
    `;

    // Add keyframes if not already present
    if (!document.getElementById('puzzle-flash-style')) {
        const style = document.createElement('style');
        style.id = 'puzzle-flash-style';
        style.textContent = `
            @keyframes puzzleFlash {
                0% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(flash);

    // Remove after animation
    setTimeout(() => {
        flash.remove();
    }, 500);
}

// =================================================================================
// HANDLE INTERACTION (called from movement when reaching target)
// =================================================================================
export function handleInteraction(hotspot) {
    // Play interact animation
    playOnceAnimation('Interact');

    if (hotspot.type === 'door') {
        // Free Roam mode: bypass all locked doors
        if (hotspot.locked && STATE.difficulty !== 'freeroam') {
            SoundManager.playBlip();
            return;
        }
        startTransition(hotspot.target_room, hotspot.target_spawn);
    } else if (hotspot.type === 'text' || hotspot.type === 'inspect') {
        openPopup(hotspot);
    } else if (hotspot.type === 'pickup') {
        pickupDroppedItem(hotspot.itemId);
        STATE.active_hotspot = null;
        document.getElementById('interaction-prompt').classList.add('hidden');
    } else if (hotspot.type === 'puzzle_statue') {
        handleStatuePuzzle(hotspot);
    }
}

// =================================================================================
// ROOM TRANSITION
// =================================================================================
export function startTransition(targetRoomKey, targetSpawn) {
    if (STATE.interaction_mode !== 'OVERWORLD') return;
    SoundManager.playDoor();
    STATE.interaction_mode = 'TRANSITION';
    STATE.active_target = null;
    if (targetMarkerMesh) targetMarkerMesh.visible = false;

    // Immediately reset movement to stop character from walking
    resetMovement();

    const overlay = document.getElementById('transition-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('transition-text').classList.remove('hidden');

    setTimeout(() => {
        overlay.style.opacity = 1;
    }, 50);

    setTimeout(() => {
        document.getElementById('transition-text').textContent = '...DOOR CREAKING...';

        // Clean up test level elements if leaving ROOM_TESTRANGE
        if (STATE.current_room === 'ROOM_TESTRANGE' && targetRoomKey !== 'ROOM_TESTRANGE') {
            // Hide test level UI
            if (window.hideTestLevelUI) {
                window.hideTestLevelUI();
            }

            // Hide hand tracker UI (webcam button, debug canvas)
            if (window.handTracker && window.handTracker.hideUI) {
                window.handTracker.hideUI();
            }

            // Dispose basketball hoop
            if (window.basketballHoop && window.basketballHoop.dispose) {
                window.basketballHoop.dispose();
                window.basketballHoop = null;
            }
            // Remove levitation ball
            import('./three-init.js').then(threeInit => {
                if (threeInit.removeTestLevelElements) {
                    threeInit.removeTestLevelElements();
                }
            }).catch(() => {
                // Fallback: manually remove if import fails
                if (window.levitationCube && window.levitationCube.parent) {
                    window.levitationCube.parent.remove(window.levitationCube);
                    window.levitationCube = null;
                }
            });
            console.log('Test level elements cleaned up');
        }

        setRoom(targetRoomKey, targetSpawn);
        // Reset movement again after room loads to ensure clean state
        resetMovement();
    }, 550);

    setTimeout(() => {
        document.getElementById('transition-text').classList.add('hidden');
        overlay.style.opacity = 0;
        STATE.interaction_mode = 'OVERWORLD';
        // Spawn items in the new room
        import('./rooms.js').then(rooms => {
            rooms.spawnRoomItems(targetRoomKey);
        });
        // Final reset when transition completes
        resetMovement();
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 500);
    }, 2000);
}
