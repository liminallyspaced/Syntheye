import { STATE } from './constants.js';
import { handleMenuNavigation } from './menu.js';
import { setScreen, showMenu } from './utils.js';
import { closeExhibit, openExhibit } from './utils.js';
import { closeModelInspector } from './inspector.js';

export function setupInputListeners() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(event) {
    if (STATE.screen === 'main-menu') {
        handleMenuNavigation(event.key);
    } else if (STATE.screen === 'overworld') {
        switch (event.key.toLowerCase()) {
            case 'w': case 'arrowup': STATE.controls.w = true; break;
            case 's': case 'arrowdown': STATE.controls.s = true; break;
            case 'a': case 'arrowleft': STATE.controls.a = true; break;
            case 'd': case 'arrowright': STATE.controls.d = true; break;
            case 'escape':
                showMenu('options-menu');
                break;
            case 'e':
                if (STATE.activeTrigger) {
                    if (STATE.activeTrigger.content_key === 'menu') {
                        // Reloading the page for a clean return to the main menu
                        window.location.reload(); 
                    } else {
                        openExhibit(STATE.activeTrigger.content_key, STATE.activeTrigger.content_id);
                    }
                }
                break;
        }
    } else if (['popup', 'menu-overlay', 'archive', 'model-inspector', 'about'].includes(STATE.screen)) {
        if (event.key === 'Backspace' || event.key.toLowerCase() === 'b' || event.key === 'Escape') {
            if (STATE.screen === 'popup') closeExhibit();
            if (STATE.screen === 'menu-overlay') { 
                document.getElementById('options-menu').classList.contains('hidden') ? 
                    document.getElementById('credits-menu').click() : 
                    document.getElementById('options-menu').click(); 
            }
            if (STATE.screen === 'model-inspector') closeModelInspector();
            if (STATE.screen === 'archive' || STATE.screen === 'about') setScreen('main-menu');
        }
    }
}

function handleKeyUp(event) {
    if (STATE.screen === 'overworld') {
        switch (event.key.toLowerCase()) {
            case 'w': case 'arrowup': STATE.controls.w = false; break;
            case 's': case 'arrowdown': STATE.controls.s = false; break;
            case 'a': case 'arrowleft': STATE.controls.a = false; break;
            case 'd': case 'arrowright': STATE.controls.d = false; break;
        }
    }
}