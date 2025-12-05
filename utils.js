import { DOM, STATE } from './constants.js';

// --- Screen Management ---
const screens = {
    'main-menu': document.getElementById('main-menu'),
    'overworld': document.getElementById('overworld-ui'),
    'popup-ui': document.getElementById('popup-ui'),
    'archive-menu': document.getElementById('archive-menu'),
    'about-me-menu': document.getElementById('about-me-menu'),
    'model-inspector-ui': document.getElementById('model-inspector-ui'),
    'options-menu': document.getElementById('options-menu'),
    'credits-menu': document.getElementById('credits-menu'),
};

export function setScreen(newScreen) {
    if (STATE.screen === newScreen) return;
    
    // Special handling for popups to track where we came from
    if (newScreen === 'popup-ui' || newScreen === 'model-inspector-ui') {
        STATE.currentScreenBeforePopup = STATE.screen;
    }

    // Hide all screens
    Object.values(screens).forEach(el => el.classList.add('hidden'));

    // Show the new screen
    const targetScreen = screens[newScreen];
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        STATE.screen = newScreen;
    } else {
        console.error(`Attempted to set unknown screen: ${newScreen}`);
    }
}

// --- Menu Navigation ---
export function updateMenuSelection(index) {
    const menuItems = Array.from(document.querySelectorAll('#main-menu .menu-item'));
    if (index >= 0 && index < menuItems.length) {
        menuItems.forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            item.querySelector('.selection-arrow').classList.toggle('invisible', i !== index);
        });
        STATE.menuIndex = index;
    }
}

export function handleMenuKeydown(e) {
    const menuItems = Array.from(document.querySelectorAll('#main-menu .menu-item'));
    const maxIndex = menuItems.length - 1;

    let newIndex = STATE.menuIndex;
    let handled = false;

    if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        newIndex = (STATE.menuIndex + 1) % (maxIndex + 1);
        handled = true;
    } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        newIndex = (STATE.menuIndex - 1 + (maxIndex + 1)) % (maxIndex + 1);
        handled = true;
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const action = menuItems[STATE.menuIndex].dataset.action;
        // Dispatch the action through the global App object
        window.App.setScreen(action);
        handled = true;
    }

    if (handled) {
        e.preventDefault();
        updateMenuSelection(newIndex);
    }
}

// --- External Link Handler ---
export function openExternalLink(url) {
    window.open(url, '_blank');
}