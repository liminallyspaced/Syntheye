// =================================================================================
// --- DEBUG.JS - Debug Menu System with Camera Position Editor ---
// =================================================================================
// Press ` (backtick) to toggle debug menu
// Provides: free cam, camera position list per room, add/delete/export positions
// =================================================================================

import * as THREE from 'three';
import { STATE, ROOM_DATA, ROOM_ORDER } from './config.js';
import { camera, playerMesh, scene } from './three-init.js';
import { setRoom } from './rooms.js';

// =================================================================================
// DEBUG STATE
// =================================================================================
let debugMenuVisible = false;
let debugOverlay = null;
let allDoorsUnlocked = false;
let freeCamMode = false;

// Free cam movement keys state
const freeCamKeys = {
    w: false, a: false, s: false, d: false,
    q: false, e: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};
const FREE_CAM_SPEED = 0.3;
const FREE_CAM_ROT_SPEED = 0.02;

// Right-click rotation state
let isRightMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
const MOUSE_SENSITIVITY = 0.003;

// Camera positions storage per room
// Structure: { ROOM_CONCERT: [ { name: 'general', pos: {x,y,z}, target: {x,y,z}, set: false }, ... ] }
let cameraPositions = {};

// Initialize default camera positions based on puzzle count
function initializeCameraPositions() {
    for (const roomKey of ROOM_ORDER) {
        const room = ROOM_DATA[roomKey];
        if (!room) continue;

        cameraPositions[roomKey] = [];

        // Always add a general room position
        cameraPositions[roomKey].push({
            name: 'general_room',
            pos: { x: 10, y: 8, z: 10 },
            target: { x: 0, y: 1, z: 0 },
            set: false
        });

        // Add positions based on hotspots (puzzles/objects)
        if (room.hotspots) {
            room.hotspots.forEach((hotspot, idx) => {
                if (hotspot.type === 'padlock' || hotspot.type === 'puzzle_statue' ||
                    hotspot.type === 'puzzle_projector' || hotspot.type === 'puzzle_terminal' ||
                    hotspot.type === 'puzzle_console' || hotspot.type === 'puzzle_compile' ||
                    hotspot.type === 'puzzle_final') {
                    cameraPositions[roomKey].push({
                        name: `puzzle_${hotspot.name || idx}`,
                        pos: { x: hotspot.pos[0] + 5, y: 5, z: hotspot.pos[2] + 5 },
                        target: { x: hotspot.pos[0], y: 1.5, z: hotspot.pos[2] },
                        set: false
                    });
                }
            });
        }

        // Add entrance position
        cameraPositions[roomKey].push({
            name: 'entrance',
            pos: { x: 0, y: 6, z: 12 },
            target: { x: 0, y: 1, z: 0 },
            set: false
        });
    }
}

// =================================================================================
// INITIALIZE DEBUG MENU
// =================================================================================
export function initDebugMenu() {
    // Initialize camera positions from room data
    initializeCameraPositions();

    // Create debug overlay
    debugOverlay = document.createElement('div');
    debugOverlay.id = 'debug-overlay';
    debugOverlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 360px;
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid #00ff00;
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        padding: 15px;
        z-index: 9999;
        display: none;
        max-height: 90vh;
        overflow-y: auto;
    `;

    debugOverlay.innerHTML = `
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #00ff00; padding-bottom: 5px;">
            🎮 DEBUG MENU [~]
        </div>
        
        <!-- FREE CAM MODE -->
        <div style="margin-bottom: 10px; padding: 8px; background: #001100; border: 1px solid #0f0;">
            <label><input type="checkbox" id="debug-freecam"> <b>FREE CAM MODE</b></label>
            <div style="font-size: 10px; color: #080; margin-top: 5px;">
                WASD: Move | Q/E: Up/Down | Right-Click+Drag: Rotate
            </div>
        </div>
        
        <!-- LIVE CAMERA DISPLAY -->
        <div id="debug-live-pos" style="margin-bottom: 10px; padding: 8px; background: #111; font-size: 10px; font-family: monospace;">
            <div>CAM POS: <span id="cam-pos-display">(0, 0, 0)</span></div>
            <div>CAM DIR: <span id="cam-dir-display">(0, 0, 0)</span></div>
        </div>
        
        <!-- QUICK ACTIONS -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 10px;">
            <button id="debug-set-location" style="padding: 6px; background: #004400; color: #0f0; border: 1px solid #0f0; cursor: pointer; font-size: 10px;">
                📍 SET LOCATION
            </button>
            <button id="debug-apply-camera" style="padding: 6px; background: #003300; color: #0f0; border: 1px solid #0f0; cursor: pointer; font-size: 10px;">
                ▶ Apply Camera
            </button>
        </div>
        
        <!-- CAMERA INPUT -->
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; margin-bottom: 8px; font-size: 9px;">
            <div>X:</div><input type="number" id="debug-cam-x" value="8" step="0.5" style="width: 40px; background: #111; color: #0f0; border: 1px solid #0f0; font-size: 9px;">
            <div>Y:</div><input type="number" id="debug-cam-y" value="6" step="0.5" style="width: 40px; background: #111; color: #0f0; border: 1px solid #0f0; font-size: 9px;">
            <div>Z:</div><input type="number" id="debug-cam-z" value="10" step="0.5" style="width: 40px; background: #111; color: #0f0; border: 1px solid #0f0; font-size: 9px;">
            <div>TX:</div><input type="number" id="debug-target-x" value="0" step="0.5" style="width: 40px; background: #111; color: #0f0; border: 1px solid #0f0; font-size: 9px;">
            <div>TY:</div><input type="number" id="debug-target-y" value="1" step="0.5" style="width: 40px; background: #111; color: #0f0; border: 1px solid #0f0; font-size: 9px;">
            <div>TZ:</div><input type="number" id="debug-target-z" value="0" step="0.5" style="width: 40px; background: #111; color: #0f0; border: 1px solid #0f0; font-size: 9px;">
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="font-size: 10px;"><input type="checkbox" id="debug-unlock-doors"> Unlock All Doors</label>
        </div>
        
        <!-- ROOM SELECT -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 5px; margin-bottom: 10px;">
            <select id="debug-room-select" style="padding: 4px; background: #111; color: #0f0; border: 1px solid #0f0; font-size: 10px;">
                <option value="ROOM_CONCERT">Room 1: Concert Videos</option>
                <option value="ROOM_MUSICVIDEO">Room 2: Music Videos</option>
                <option value="ROOM_3DART">Room 3: 3D Work</option>
                <option value="ROOM_MUSIC">Room 4: Music</option>
                <option value="ROOM_GAMEDEV">Room 5: Game Development</option>
                <option value="ROOM_ABOUTME">Room 6: About Me</option>
            </select>
            <button id="debug-goto-room" style="padding: 4px; background: #003300; color: #0f0; border: 1px solid #0f0; cursor: pointer; font-size: 10px;">Go</button>
        </div>
        
        <!-- PLAYER INFO -->
        <div id="debug-current-values" style="font-size: 9px; color: #0a0; margin-bottom: 10px;">
            Player: (0, 0, 0) | Room: NONE
        </div>
        
        <!-- ================================================================== -->
        <!-- CAMERA POSITION EDITOR - PER-ROOM -->
        <!-- ================================================================== -->
        <div style="margin-top: 15px; padding: 10px; background: #0a0a0a; border: 2px solid #00aa00;">
            <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px; color: #0f0; text-align: center;">
                📷 CAMERA POSITIONS
            </div>
            
            <!-- ROOM STATUS INDICATORS -->
            <div id="room-status-indicators" style="display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 8px; font-size: 9px;">
                <!-- Will be populated with room status badges -->
            </div>
            
            <!-- CURRENT ROOM DISPLAY -->
            <div id="current-room-header" style="background: #002200; padding: 5px; margin-bottom: 8px; text-align: center; font-weight: bold;">
                ROOM: ---
            </div>
            
            <!-- ADD BUTTON -->
            <button id="debug-add-position" style="width: 100%; padding: 6px; margin-bottom: 6px; background: #003300; color: #0f0; border: 1px solid #0f0; cursor: pointer; font-size: 10px;">
                + ADD NEW CAMERA POSITION
            </button>
            
            <!-- POSITIONS LIST (CURRENT ROOM ONLY) -->
            <div id="debug-positions-list" style="max-height: 180px; overflow-y: auto; background: #000; border: 1px solid #0f0; padding: 5px; margin-bottom: 8px; min-height: 60px;">
                <!-- Positions for current room only -->
            </div>
            
            <!-- EXPORT BUTTON FOR CURRENT ROOM -->
            <button id="debug-export-positions" style="width: 100%; padding: 8px; background: #442200; color: #ff0; border: 2px solid #ff0; cursor: pointer; font-weight: bold; font-size: 10px;">
                📤 EXPORT CURRENT ROOM CAMERAS
            </button>
        </div>
    `;

    document.body.appendChild(debugOverlay);

    // Setup event listeners
    setupDebugListeners();

    // Setup mouse listeners for right-click rotate
    setupMouseListeners();

    console.log('Debug menu initialized (press ` to toggle)');
}

// =================================================================================
// SETUP MOUSE LISTENERS FOR RIGHT-CLICK ROTATE (Blender-style fly mode)
// =================================================================================
function setupMouseListeners() {
    document.addEventListener('mousedown', (e) => {
        if (e.button === 2 && freeCamMode) { // Right click
            isRightMouseDown = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            e.preventDefault();
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            isRightMouseDown = false;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isRightMouseDown && freeCamMode && camera) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            // Blender-style rotation:
            // - Horizontal mouse = rotate around WORLD Y axis (yaw/turntable)
            // - Vertical mouse = rotate around LOCAL X axis (pitch/tilt)

            // Use rotation order YXZ to prevent gimbal lock
            camera.rotation.order = 'YXZ';

            // Yaw: rotate around world Y axis
            camera.rotation.y -= deltaX * MOUSE_SENSITIVITY;

            // Pitch: rotate around local X axis (clamped to prevent flipping)
            camera.rotation.x -= deltaY * MOUSE_SENSITIVITY;
            camera.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, camera.rotation.x));

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });

    // Prevent context menu on right click
    document.addEventListener('contextmenu', (e) => {
        if (freeCamMode) {
            e.preventDefault();
        }
    });
}

// =================================================================================
// SETUP EVENT LISTENERS
// =================================================================================
function setupDebugListeners() {
    // Free cam mode checkbox
    document.getElementById('debug-freecam').addEventListener('change', (e) => {
        freeCamMode = e.target.checked;
        if (freeCamMode) {
            STATE.interaction_mode = 'DEBUG_FREECAM';
            console.log('FREE CAM MODE ENABLED - WASD to move, QE up/down, Right-click+drag to rotate');
        } else {
            STATE.interaction_mode = 'OVERWORLD';
            console.log('FREE CAM MODE DISABLED');
        }
    });

    // Unlock doors checkbox
    document.getElementById('debug-unlock-doors').addEventListener('change', (e) => {
        allDoorsUnlocked = e.target.checked;
        toggleAllDoors(allDoorsUnlocked);
        console.log(`All doors ${allDoorsUnlocked ? 'UNLOCKED' : 'LOCKED'}`);
    });

    // Set Location button - captures current camera position
    document.getElementById('debug-set-location').addEventListener('click', () => {
        if (camera) {
            // Update the input fields with current camera position
            document.getElementById('debug-cam-x').value = camera.position.x.toFixed(1);
            document.getElementById('debug-cam-y').value = camera.position.y.toFixed(1);
            document.getElementById('debug-cam-z').value = camera.position.z.toFixed(1);

            // Calculate target from camera direction
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const target = camera.position.clone().add(dir.multiplyScalar(5));

            document.getElementById('debug-target-x').value = target.x.toFixed(1);
            document.getElementById('debug-target-y').value = target.y.toFixed(1);
            document.getElementById('debug-target-z').value = target.z.toFixed(1);

            console.log(`Location set: Pos(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}) → Target(${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`);
        }
    });

    // Apply camera button
    document.getElementById('debug-apply-camera').addEventListener('click', () => {
        const x = parseFloat(document.getElementById('debug-cam-x').value);
        const y = parseFloat(document.getElementById('debug-cam-y').value);
        const z = parseFloat(document.getElementById('debug-cam-z').value);
        const tx = parseFloat(document.getElementById('debug-target-x').value);
        const ty = parseFloat(document.getElementById('debug-target-y').value);
        const tz = parseFloat(document.getElementById('debug-target-z').value);

        if (camera) {
            camera.position.set(x, y, z);
            camera.lookAt(tx, ty, tz);
            console.log(`Camera applied: (${x}, ${y}, ${z}) looking at (${tx}, ${ty}, ${tz})`);
        }
    });

    // Go to room button
    document.getElementById('debug-goto-room').addEventListener('click', () => {
        const room = document.getElementById('debug-room-select').value;
        setRoom(room);
        updatePositionsList();
        console.log(`Switched to room: ${room}`);
    });

    // Add position button
    document.getElementById('debug-add-position').addEventListener('click', () => {
        const roomKey = STATE.current_room;
        if (!cameraPositions[roomKey]) {
            cameraPositions[roomKey] = [];
        }

        // Get current camera position
        const pos = camera ? {
            x: parseFloat(camera.position.x.toFixed(1)),
            y: parseFloat(camera.position.y.toFixed(1)),
            z: parseFloat(camera.position.z.toFixed(1))
        } : { x: 10, y: 8, z: 10 };

        const dir = new THREE.Vector3();
        if (camera) camera.getWorldDirection(dir);
        const targetVec = camera ? camera.position.clone().add(dir.multiplyScalar(5)) : new THREE.Vector3(0, 1, 0);
        const target = {
            x: parseFloat(targetVec.x.toFixed(1)),
            y: parseFloat(targetVec.y.toFixed(1)),
            z: parseFloat(targetVec.z.toFixed(1))
        };

        const name = `position_${cameraPositions[roomKey].length}`;
        cameraPositions[roomKey].push({ name, pos, target, set: true });

        updatePositionsList();
        console.log(`Added new camera position: ${name}`);
    });

    // Export positions button
    document.getElementById('debug-export-positions').addEventListener('click', () => {
        exportCurrentRoomPositions();
    });

    // Initial positions list update
    updatePositionsList();
}

// =================================================================================
// UPDATE POSITIONS LIST UI (CURRENT ROOM ONLY)
// =================================================================================
function updatePositionsList() {
    const container = document.getElementById('debug-positions-list');
    const statusContainer = document.getElementById('room-status-indicators');
    const roomHeader = document.getElementById('current-room-header');

    // Update room status indicators (badges for all rooms)
    if (statusContainer) {
        let statusHtml = '';
        for (const roomKey of ROOM_ORDER) {
            const positions = cameraPositions[roomKey] || [];
            const setCount = positions.filter(p => p.set).length;
            const total = positions.length;
            const allSet = total > 0 && setCount === total;
            const isCurrentRoom = STATE.current_room === roomKey;
            const roomNum = ROOM_ORDER.indexOf(roomKey) + 1;

            const bgColor = allSet ? '#004400' : (setCount > 0 ? '#442200' : '#220000');
            const borderColor = isCurrentRoom ? '#0f0' : (allSet ? '#0a0' : '#550');
            const indicator = allSet ? '✓' : `${setCount}/${total}`;

            statusHtml += `<div style="padding: 2px 5px; background: ${bgColor}; border: 1px solid ${borderColor}; ${isCurrentRoom ? 'font-weight: bold;' : ''}" title="${ROOM_DATA[roomKey]?.name || roomKey}">
                R${roomNum}: ${indicator}
            </div>`;
        }
        statusContainer.innerHTML = statusHtml;
    }

    // Update current room header
    if (roomHeader) {
        const currentRoomData = ROOM_DATA[STATE.current_room];
        const roomName = currentRoomData ? currentRoomData.name : STATE.current_room;
        const positions = cameraPositions[STATE.current_room] || [];
        const setCount = positions.filter(p => p.set).length;
        roomHeader.innerHTML = `${roomName} (${setCount}/${positions.length} set)`;
    }

    // Update positions list (CURRENT ROOM ONLY)
    if (!container) return;

    const currentRoomKey = STATE.current_room;
    const positions = cameraPositions[currentRoomKey] || [];

    if (positions.length === 0) {
        container.innerHTML = '<div style="color: #555; text-align: center; padding: 10px;">No camera positions for this room.<br>Click "+ ADD" to create one.</div>';
        return;
    }

    let html = '';
    positions.forEach((pos, idx) => {
        const setIndicator = pos.set ? '✓' : '○';
        const setColor = pos.set ? '#0f0' : '#555';
        const bgColor = pos.set ? '#001a00' : '#0a0a0a';

        html += `
            <div style="display: flex; align-items: center; gap: 5px; padding: 4px; margin-bottom: 3px; background: ${bgColor}; border: 1px solid #222; font-size: 10px;">
                <span style="color: ${setColor}; width: 15px; font-weight: bold;">${setIndicator}</span>
                <span style="flex: 1; cursor: pointer; color: #0f0;" 
                      onclick="window.debugApplyPosition('${currentRoomKey}', ${idx})"
                      title="Click to apply this camera position">
                    ${pos.name}
                </span>
                <button onclick="window.debugSetPosition('${currentRoomKey}', ${idx})" 
                        style="padding: 2px 6px; background: #003300; color: #0f0; border: 1px solid #0f0; cursor: pointer; font-size: 9px;"
                        title="Save current camera to this position">SET</button>
                <button onclick="window.debugDeletePosition('${currentRoomKey}', ${idx})" 
                        style="padding: 2px 6px; background: #330000; color: #f00; border: 1px solid #f00; cursor: pointer; font-size: 9px;"
                        title="Delete this position">X</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Global functions for button clicks in the list
window.debugApplyPosition = (roomKey, idx) => {
    const pos = cameraPositions[roomKey]?.[idx];
    if (pos && camera) {
        camera.position.set(pos.pos.x, pos.pos.y, pos.pos.z);
        camera.lookAt(pos.target.x, pos.target.y, pos.target.z);

        // Update input fields
        document.getElementById('debug-cam-x').value = pos.pos.x;
        document.getElementById('debug-cam-y').value = pos.pos.y;
        document.getElementById('debug-cam-z').value = pos.pos.z;
        document.getElementById('debug-target-x').value = pos.target.x;
        document.getElementById('debug-target-y').value = pos.target.y;
        document.getElementById('debug-target-z').value = pos.target.z;

        console.log(`Applied position: ${pos.name} in ${roomKey}`);
    }
};

window.debugSetPosition = (roomKey, idx) => {
    const pos = cameraPositions[roomKey]?.[idx];
    if (pos && camera) {
        // Update position with current camera
        pos.pos = {
            x: parseFloat(camera.position.x.toFixed(1)),
            y: parseFloat(camera.position.y.toFixed(1)),
            z: parseFloat(camera.position.z.toFixed(1))
        };

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const targetVec = camera.position.clone().add(dir.multiplyScalar(5));
        pos.target = {
            x: parseFloat(targetVec.x.toFixed(1)),
            y: parseFloat(targetVec.y.toFixed(1)),
            z: parseFloat(targetVec.z.toFixed(1))
        };

        pos.set = true;
        updatePositionsList();
        console.log(`Set position ${pos.name}: Pos(${pos.pos.x}, ${pos.pos.y}, ${pos.pos.z}) → Target(${pos.target.x}, ${pos.target.y}, ${pos.target.z})`);
    }
};

window.debugDeletePosition = (roomKey, idx) => {
    if (cameraPositions[roomKey]) {
        const deleted = cameraPositions[roomKey].splice(idx, 1);
        updatePositionsList();
        console.log(`Deleted position: ${deleted[0]?.name}`);
    }
};

// =================================================================================
// EXPORT CURRENT ROOM POSITIONS TO CLIPBOARD
// =================================================================================
function exportCurrentRoomPositions() {
    const roomKey = STATE.current_room;
    const roomData = ROOM_DATA[roomKey];
    const roomName = roomData ? roomData.name : roomKey;
    const positions = cameraPositions[roomKey] || [];
    const setPositions = positions.filter(p => p.set);

    if (setPositions.length === 0) {
        alert('No camera positions are SET for this room!\nUse the SET button to save positions first.');
        return;
    }

    let output = `// ${roomName} Camera Positions\n`;
    output += `${roomKey}: [\n`;

    setPositions.forEach((pos, idx) => {
        output += `    {\n`;
        output += `        name: '${pos.name}',\n`;
        output += `        cameraPosition: { x: ${pos.pos.x}, y: ${pos.pos.y}, z: ${pos.pos.z} },\n`;
        output += `        cameraTarget: { x: ${pos.target.x}, y: ${pos.target.y}, z: ${pos.target.z} }\n`;
        output += `    }${idx < setPositions.length - 1 ? ',' : ''}\n`;
    });

    output += `],`;

    // Copy to clipboard
    navigator.clipboard.writeText(output).then(() => {
        alert(`✓ COPIED TO CLIPBOARD!\n\n${setPositions.length} camera positions for ${roomName}\n\nJust paste (Ctrl+V) in the chat!`);
        console.log('Camera positions copied to clipboard:');
        console.log(output);
    }).catch(err => {
        // Fallback if clipboard fails
        console.log(output);
        prompt('Copy this data (Ctrl+A, Ctrl+C):', output);
    });
}

// =================================================================================
// TOGGLE ALL DOORS
// =================================================================================
function toggleAllDoors(unlock) {
    for (const key in ROOM_DATA) {
        if (ROOM_DATA[key].hotspots) {
            ROOM_DATA[key].hotspots.forEach(hotspot => {
                if (hotspot.locked !== undefined) {
                    hotspot.locked = !unlock;
                }
            });
        }
    }
}

// =================================================================================
// TOGGLE DEBUG MENU
// =================================================================================
export function toggleDebugMenu() {
    debugMenuVisible = !debugMenuVisible;
    if (debugOverlay) {
        debugOverlay.style.display = debugMenuVisible ? 'block' : 'none';
        if (debugMenuVisible) {
            updatePositionsList();
        }
    }
}

// =================================================================================
// UPDATE DEBUG VALUES (called every frame)
// =================================================================================
export function updateDebugValues() {
    if (!debugMenuVisible) return;

    // Update player info
    const valuesDiv = document.getElementById('debug-current-values');
    if (valuesDiv && playerMesh) {
        const p = playerMesh.position;
        valuesDiv.innerHTML = `Player: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}) | Room: ${STATE.current_room}`;
    }

    // Update live camera position display
    const camPosDisplay = document.getElementById('cam-pos-display');
    const camDirDisplay = document.getElementById('cam-dir-display');
    if (camPosDisplay && camDirDisplay && camera) {
        camPosDisplay.textContent = `(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`;

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const target = camera.position.clone().add(dir.multiplyScalar(5));
        camDirDisplay.textContent = `→ (${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`;
    }

    // Free cam movement
    if (freeCamMode && camera) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // WASD movement
        if (freeCamKeys.w) camera.position.add(forward.clone().multiplyScalar(FREE_CAM_SPEED));
        if (freeCamKeys.s) camera.position.add(forward.clone().multiplyScalar(-FREE_CAM_SPEED));
        if (freeCamKeys.a) camera.position.add(right.clone().multiplyScalar(-FREE_CAM_SPEED));
        if (freeCamKeys.d) camera.position.add(right.clone().multiplyScalar(FREE_CAM_SPEED));

        // QE up/down
        if (freeCamKeys.q) camera.position.y -= FREE_CAM_SPEED;
        if (freeCamKeys.e) camera.position.y += FREE_CAM_SPEED;

        // Arrow keys rotation (backup for non-mouse users)
        if (freeCamKeys.ArrowLeft) camera.rotation.y += FREE_CAM_ROT_SPEED;
        if (freeCamKeys.ArrowRight) camera.rotation.y -= FREE_CAM_ROT_SPEED;
        if (freeCamKeys.ArrowUp) camera.rotation.x += FREE_CAM_ROT_SPEED;
        if (freeCamKeys.ArrowDown) camera.rotation.x -= FREE_CAM_ROT_SPEED;
    }
}

// =================================================================================
// HANDLE DEBUG KEY
// =================================================================================
export function handleDebugKeydown(event) {
    // Backtick/tilde toggle removed - debug now controlled by single * key via DebugManager

    // Free cam keys
    if (freeCamMode) {
        const key = event.key.toLowerCase();
        if (key in freeCamKeys) {
            freeCamKeys[key] = true;
            return true;
        }
        if (event.key in freeCamKeys) {
            freeCamKeys[event.key] = true;
            return true;
        }
    }

    return false;
}

export function handleDebugKeyup(event) {
    if (freeCamMode) {
        const key = event.key.toLowerCase();
        if (key in freeCamKeys) {
            freeCamKeys[key] = false;
            return true;
        }
        if (event.key in freeCamKeys) {
            freeCamKeys[event.key] = false;
            return true;
        }
    }
    return false;
}

export { allDoorsUnlocked, freeCamMode };
