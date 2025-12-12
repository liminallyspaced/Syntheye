// =================================================================================
// --- NARRATION.JS - Bottom-Screen Text System ---
// =================================================================================
// Displays PS1 survival-horror style narration text at screen bottom
// Used for: examining objects, puzzle hints, flashlight reveals, pickups
// Also handles self-dialog triggers (proximity-based inner monologue)
// =================================================================================

import { STATE, ROOM_DATA } from './config.js';
// =================================================================================
// NARRATION STATE
// =================================================================================
let narrationOverlay = null;
let narrationText = null;
let narrationTimeout = null;
let isNarrationVisible = false;

// =================================================================================
// INITIALIZE NARRATION SYSTEM
// =================================================================================
export function initNarration() {
    // Create overlay container
    narrationOverlay = document.createElement('div');
    narrationOverlay.id = 'narration-overlay';
    narrationOverlay.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 80%;
        max-width: 700px;
        background: rgba(0, 0, 0, 0.85);
        border: 2px solid #444;
        padding: 15px 25px;
        z-index: 500;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    `;

    // Create text element
    narrationText = document.createElement('p');
    narrationText.id = 'narration-text';
    narrationText.style.cssText = `
        font-family: 'Press Start 2P', 'Courier New', monospace;
        font-size: 11px;
        color: #cccccc;
        text-align: center;
        line-height: 1.8;
        margin: 0;
        text-shadow: 1px 1px 0 #000;
        letter-spacing: 0.5px;
    `;

    narrationOverlay.appendChild(narrationText);
    document.body.appendChild(narrationOverlay);

    console.log('Narration system initialized');
}

// =================================================================================
// SHOW NARRATION
// =================================================================================
/**
 * Display narration text at bottom of screen
 * @param {string} text - The narration text to display
 * @param {number} duration - How long to show (ms), default 3000
 */
export function showNarration(text, duration = 3000) {
    if (!narrationOverlay || !narrationText) {
        console.warn('Narration system not initialized');
        return;
    }

    // Clear any existing timeout
    if (narrationTimeout) {
        clearTimeout(narrationTimeout);
    }

    // Set text and show
    narrationText.textContent = text;
    narrationOverlay.style.opacity = '1';
    isNarrationVisible = true;

    // Auto-hide after duration
    narrationTimeout = setTimeout(() => {
        hideNarration();
    }, duration);
}

// =================================================================================
// HIDE NARRATION
// =================================================================================
export function hideNarration() {
    if (narrationOverlay) {
        narrationOverlay.style.opacity = '0';
        isNarrationVisible = false;
    }
}

// =================================================================================
// CHECK IF NARRATION IS VISIBLE
// =================================================================================
export function isNarrationShowing() {
    return isNarrationVisible;
}

// =================================================================================
// PRESET NARRATIONS (PS1 survival-horror style)
// =================================================================================
export const NARRATIONS = {
    // Room 1 - Concert
    statue_examine: "A broken statue... something is missing.",
    statue_head_left_pickup: "A stone fragment. Half of a face.",
    statue_head_right_pickup: "The other half. Eyes still watching.",
    padlock_examine: "A four-digit lock. The numbers feel familiar.",
    padlock_success: "The case opens with a satisfying click.",
    clue_2017_reveal: "2017... A year I can't forget.",
    statue_complete: "The statue is whole again. Something shifts.",
    door_unlock: "A path opens.",

    // Room 2 - Music Videos
    projector_examine: "An old film projector. Missing reels.",
    film_reel_pickup: "A reel of memories recorded in light.",
    storyboard_reveal: "The frames show the correct sequence.",
    projector_complete: "The projector hums to life.",

    // Room 3 - 3D Art
    terminal_examine: "A render terminal. Needs power cores.",
    render_shard_pickup: "A fragment of rendered light.",
    blueprint_reveal: "Assembly instructions. ABC order.",
    terminal_complete: "The terminal powers on. Polygons dance.",

    // Room 4 - VFX
    console_examine: "A compositing station. Layers are wrong.",
    fx_element_pickup: "A visual effect element.",
    layer_order_reveal: "Fire, then smoke, then sparks.",
    console_complete: "The layers align. Reality bends.",

    // Room 5 - Web
    code_terminal_examine: "A code terminal awaits input.",
    code_fragment_pickup: "A snippet of logic.",
    pseudocode_reveal: "Initialize, process, render.",
    code_compile: "Compilation successful.",

    // Room 6 - AI
    memory_box_examine: "The final lock. Keywords are the key.",
    memory_fragment_pickup: "A memory resurfaces.",
    keyword_reveal: "SYNTH... EYE... AWAKE...",
    game_complete: "The eye opens. You remember everything."
};

// =================================================================================
// SELF-DIALOG TRIGGERS (proximity-based inner monologue)
// =================================================================================

/**
 * Check if player is near any self-dialog triggers in current room
 * @param {THREE.Vector3} playerPos - Current player position
 */
export function checkSelfDialogTriggers(playerPos) {
    // Only trigger in OVERWORLD mode (not during intro/menus)
    if (STATE.interaction_mode !== 'OVERWORLD') return;

    const roomConfig = ROOM_DATA[STATE.current_room];
    if (!roomConfig || !roomConfig.selfDialogTriggers) return;

    // Get player mesh for rotation check
    const playerMesh = window.playerMesh;
    if (!playerMesh) return;

    for (const trigger of roomConfig.selfDialogTriggers) {
        if (trigger.triggered) continue; // Already triggered this session

        // Calculate distance (ignore Y for floor-based triggers)
        const dx = trigger.pos.x - playerPos.x;
        const dz = trigger.pos.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance <= trigger.radius) {
            // Check if player is facing toward the trigger
            // Player's forward direction based on rotation.y
            const playerAngle = playerMesh.rotation.y;
            const angleToTarget = Math.atan2(dx, dz);

            // Calculate angle difference (allow ~90 degree cone)
            let angleDiff = angleToTarget - playerAngle;
            // Normalize to -PI to PI
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Only trigger if player is roughly facing the target (within 90 degrees)
            if (Math.abs(angleDiff) < Math.PI / 2) {
                trigger.triggered = true;
                showNarration(trigger.dialog, 4000);
                console.log(`Self-dialog triggered: ${trigger.name}`);
                break; // Only trigger one at a time
            }
        }
    }
}

/**
 * Reset all self-dialog triggers for a room (call on room entry)
 * @param {string} roomKey - Room to reset triggers for
 */
export function resetSelfDialogTriggers(roomKey) {
    const roomConfig = ROOM_DATA[roomKey];
    if (!roomConfig || !roomConfig.selfDialogTriggers) return;

    for (const trigger of roomConfig.selfDialogTriggers) {
        trigger.triggered = false;
    }
    console.log(`Self-dialog triggers reset for: ${roomKey}`);
}
