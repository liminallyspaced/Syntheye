// =================================================================================
// --- UTILS.JS - Utility Functions ---
// =================================================================================
// Contains utility functions like setScreen, menu handling, popup handling.
// =================================================================================

import { STATE, PORTFOLIO_CONTENT } from './config.js';
import { SoundManager } from './sound.js';
import { setClueFound } from './puzzle.js';
import { startInspectionView, stopInspectionView } from './inspection.js';
import { scene, targetMarkerMesh, playerMesh } from './three-init.js';
import { currentRoomGroup, collidableMeshes, setCollidableMeshes, setCurrentRoomGroup } from './rooms.js';

// =================================================================================
// DOM ELEMENTS
// =================================================================================
const body = document.body;
export const menuItems = document.querySelectorAll('#menu-options .menu-item');

// =================================================================================
// SCREEN MANAGEMENT
// =================================================================================
export function setScreen(newScreen) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(newScreen).classList.remove('hidden');

    if (newScreen === 'main-menu') {
        STATE.screen = 'main-menu';
        STATE.interaction_mode = 'MENU';
    } else if (newScreen === 'difficulty-select') {
        STATE.screen = 'difficulty-select';
        STATE.interaction_mode = 'MENU';
    } else if (newScreen === 'overworld-ui') {
        STATE.screen = 'overworld';
        STATE.interaction_mode = 'OVERWORLD';
    } else if (newScreen === 'text-popup' || newScreen === 'inspection-popup') {
        STATE.screen = 'popup';
        STATE.interaction_mode = 'POPUP';
    }
    console.log(`Screen: ${STATE.screen}, Mode: ${STATE.interaction_mode}`);
}

// =================================================================================
// MENU MANAGEMENT
// =================================================================================
export function updateMenuSelection() {
    menuItems.forEach((item, index) => {
        const isSelected = index === STATE.menuIndex;
        item.classList.toggle('selected', isSelected);
        item.querySelector('.selection-arrow').style.visibility = isSelected ? 'visible' : 'hidden';
    });
    SoundManager.playBlip();
}

export function handleMenuClick(element, index) {
    STATE.menuIndex = index;
    SoundManager.playSelect();
    updateMenuSelection();
    handleMenuAction(element.dataset.action);
}

export function handleMenuAction(action) {
    // 'start' action is handled directly in main.js to avoid circular dependency
    if (action === 'options') {
        // Show main menu options (not the in-game pause menu)
        showMenu('main-menu-options');
    } else if (action === 'how-to-play') {
        showMenu('how-to-play-menu');
    } else if (action === 'bug-report') {
        showMenu('bug-report-menu');
    } else if (action === 'credits') {
        showMenu('credits-menu');
    } else if (action === 'portfolio') {
        // Portfolio viewer mode - same as Free Roam but from main menu
        console.log('Portfolio Viewer selected - launching Free Roam mode');
        // This will be handled by main.js
    }
    // For 'start', main.js handles it directly
}

export function showMenu(menuId) {
    document.getElementById(menuId).classList.remove('hidden');
    STATE.interaction_mode = 'MENU_PAUSE';
    STATE.screen = 'menu-overlay';
}

export function hideMenu(menuId) {
    document.getElementById(menuId).classList.add('hidden');

    // Check if we were in main menu context (main-menu-options, how-to-play from main menu, etc.)
    const mainMenuOverlays = ['main-menu-options', 'how-to-play-menu', 'bug-report-menu', 'credits-menu'];
    if (mainMenuOverlays.includes(menuId) && STATE.screen !== 'overworld') {
        // Return to main menu, not overworld
        STATE.interaction_mode = 'MENU';
        STATE.screen = 'main-menu';
    } else if (STATE.interaction_mode === 'MENU_PAUSE') {
        STATE.interaction_mode = 'OVERWORLD';
        STATE.screen = 'overworld';
    }
}

// =================================================================================
// RETURN TO MAIN MENU
// =================================================================================
export function returnToMainMenu(sceneRef, currentRoomGroupRef) {
    STATE.clues_found = [false, false, false];
    STATE.secret_unlocked = false;
    STATE.current_room = 'ROOM_HALL';
    STATE.player_pos.set(0, 1, 0);
    STATE.active_target = null;
    STATE.active_hotspot = null;

    if (currentRoomGroup) {
        scene.remove(currentRoomGroup);
        setCurrentRoomGroup(null);
        setCollidableMeshes([]);
    }

    if (targetMarkerMesh) targetMarkerMesh.visible = false;
    setScreen('main-menu');
}

// =================================================================================
// POPUP MANAGEMENT
// =================================================================================
export function openPopup(content) {
    SoundManager.playSelect();
    STATE.active_target = null;
    if (targetMarkerMesh) targetMarkerMesh.visible = false;

    if (content.type === 'text' || content.type === 'puzzle') {
        const data = PORTFOLIO_CONTENT[content.content_id];
        document.getElementById('popup-title').textContent = data.title.toUpperCase();
        document.getElementById('popup-text').textContent = data.text.toUpperCase();

        let clueStatus = '';
        if (content.clue !== undefined) {
            setClueFound(content.clue);
            clueStatus = STATE.clues_found[content.clue] ? "CLUE LOGGED" : "CLUE FOUND: CHECK LOG";
        }
        document.getElementById('popup-clue-status').textContent = clueStatus;

        setScreen('text-popup');
        STATE.interaction_mode = 'POPUP_TEXT';

    } else if (content.type === 'inspect') {
        const data = PORTFOLIO_CONTENT[content.content_id];
        document.getElementById('inspect-title').textContent = data.title.toUpperCase();
        document.getElementById('inspect-description').textContent = data.text.toUpperCase();

        let clueStatus = '';
        if (content.clue !== undefined) {
            setClueFound(content.clue);
            clueStatus = STATE.clues_found[content.clue] ? "CLUE LOGGED" : "CLUE FOUND: CHECK LOG";
        }
        document.getElementById('inspect-clue-status').textContent = clueStatus;

        setScreen('inspection-popup');
        STATE.interaction_mode = 'POPUP_INSPECT';
        startInspectionView(content.content_id);
    }
}

export function closePopup() {
    stopInspectionView();
    setScreen('overworld-ui');
}

// =================================================================================
// CRT FILTER TOGGLE
// =================================================================================
export function setupCrtToggle() {
    const toggleCrtButton = document.getElementById('toggle-crt');
    if (toggleCrtButton) {
        toggleCrtButton.onclick = () => {
            SoundManager.playBlip();
            STATE.isCrtActive = !STATE.isCrtActive;
            body.classList.toggle('crt-active', STATE.isCrtActive);
            toggleCrtButton.textContent = STATE.isCrtActive ? 'ON' : 'OFF';
        };
    }
}
