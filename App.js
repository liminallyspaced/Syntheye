import { initScene, animateScene, cleanupScene } from './three-scene.js';
import { DOM, STATE } from './constants.js';
import { showArchive } from './archive.js';
import { openModelInspector, closeModelInspector } from './inspector.js';
import { setScreen, updateMenuSelection, handleMenuKeydown, openExternalLink } from './utils.js';

// Global access point for HTML event handlers
window.App = {
    setScreen,
    closeExhibit: () => setScreen(STATE.currentScreenBeforePopup === 'archive-menu' ? 'archive-menu' : 'overworld'),
    toggleCrtEffect: () => {
        STATE.isCrtActive = !STATE.isCrtActive;
        DOM.body.classList.toggle('crt-effect', STATE.isCrtActive);
        DOM.body.querySelector('#crt-status').textContent = STATE.isCrtActive ? 'ACTIVE' : 'INACTIVE';
    },
    showMenu: (menuId) => setScreen(menuId),
    hideMenu: (menuId) => setScreen('main-menu'),
    showArchive,
    openModelInspector,
    closeModelInspector,
    openExternalLink,
};

// --- Initialization ---
function initApp() {
    setupMainMenu();
    setupGlobalKeyHandlers();

    // Start with the main menu screen
    setScreen('main-menu');
}

// --- Main Menu Logic ---
function setupMainMenu() {
    const menuItems = Array.from(document.querySelectorAll('#menu-options .menu-item'));
    
    // Mouse/Click handling
    menuItems.forEach((item, index) => {
        item.addEventListener('mouseover', () => updateMenuSelection(index));
        item.addEventListener('click', () => handleMenuAction(item.dataset.action));
    });
}

// --- Global Key Handlers ---
function setupGlobalKeyHandlers() {
    document.addEventListener('keydown', (e) => {
        // Handle menu navigation on main menu
        if (STATE.screen === 'main-menu') {
            handleMenuKeydown(e);
            return;
        }

        // Handle ESC key for pausing/closing
        if (e.key === 'Escape' && STATE.screen !== 'main-menu' && STATE.screen !== 'archive-menu') {
            e.preventDefault();
            // If in overworld, show menu overlay
            if (STATE.screen === 'overworld') {
                cleanupScene(); // Pause the 3D loop
                setScreen('main-menu');
            } else if (STATE.screen === 'popup-ui' || STATE.screen === 'model-inspector-ui') {
                // If in a popup/inspector, close it
                if (STATE.screen === 'model-inspector-ui') {
                    window.App.closeModelInspector();
                } else {
                    window.App.closeExhibit();
                }
            } else if (STATE.screen === 'options-menu' || STATE.screen === 'credits-menu' || STATE.screen === 'about-me-menu') {
                 setScreen('main-menu');
            }
            return;
        }

        // Handle 'B' key to close popups or return from archive (mapped to closeExhibit/setScreen calls)
        if (e.key.toLowerCase() === 'b' && (STATE.screen === 'popup-ui' || STATE.screen === 'model-inspector-ui')) {
            e.preventDefault();
            if (STATE.screen === 'model-inspector-ui') {
                window.App.closeModelInspector();
            } else {
                window.App.closeExhibit();
            }
            return;
        }
        
        // Handle 'E' key for overworld interaction
        if (e.key.toLowerCase() === 'e' && STATE.screen === 'overworld' && STATE.activeTrigger) {
            e.preventDefault();
            STATE.activeTrigger.callback();
        }
    });
}

// --- Menu Action Dispatcher ---
function handleMenuAction(action) {
    switch (action) {
        case 'start':
            DOM.loadingIndicator.classList.remove('hidden');
            setScreen('overworld');
            initScene();
            animateScene();
            break;
        case 'archive':
            showArchive();
            break;
        case 'about':
            setScreen('about-me-menu');
            break;
        case 'options':
            DOM.body.querySelector('#crt-status').textContent = STATE.isCrtActive ? 'ACTIVE' : 'INACTIVE';
            setScreen('options-menu');
            break;
        case 'credits':
            setScreen('credits-menu');
            break;
    }
}


// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);