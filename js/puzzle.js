// =================================================================================
// --- PUZZLE.JS - Puzzle Logic ---
// =================================================================================
// Clue tracking and secret door unlock logic.
// =================================================================================

import { STATE, ROOM_DATA } from './config.js';
import { SoundManager } from './sound.js';

// =================================================================================
// SET CLUE FOUND
// =================================================================================
export function setClueFound(index) {
    if (!STATE.clues_found[index]) {
        STATE.clues_found[index] = true;
        SoundManager.playSelect(); // Clue found sound

        // Check if all clues are found
        if (STATE.clues_found.every(c => c === true)) {
            unlockSecretDoor();
        }
    }
}

// =================================================================================
// UNLOCK SECRET DOOR
// =================================================================================
export function unlockSecretDoor() {
    if (!STATE.secret_unlocked) {
        STATE.secret_unlocked = true;
        setTimeout(() => SoundManager.playSuccess(), 500);
        updateSecretDoorState();
    }
}

// =================================================================================
// UPDATE SECRET DOOR STATE
// =================================================================================
// Updates the visual appearance of the secret door based on unlock status
// =================================================================================
export function updateSecretDoorState() {
    const roomHall = ROOM_DATA.ROOM_HALL;
    const secretDoorHotspot = roomHall.hotspots.find(h => h.name === 'door_secret');
    const secretDoorMesh = roomHall.group?.children.find(
        c => c.userData.isHotspot && c.userData.hotspot.name === 'door_secret'
    );

    if (secretDoorHotspot && secretDoorMesh) {
        if (STATE.secret_unlocked) {
            secretDoorHotspot.locked = false;
            secretDoorHotspot.prompt = 'UNLOCKED SECRET DOOR';
            secretDoorMesh.material.color.set(0x00FF00); // Green = unlocked
        } else {
            secretDoorHotspot.locked = true;
            secretDoorMesh.material.color.set(0xFF0000); // Red = locked
        }
    }
}
