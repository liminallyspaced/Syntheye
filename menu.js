import { STATE, DOM } from './constants.js';
import { setScreen, showMenu } from './utils.js';
import { showArchive } from './archive.js';
import { initScene, animate } from './three-scene.js';

// Cache menu items when the script runs
const menuItems = document.querySelectorAll('#menu-options .menu-item'); 

export function updateMenuSelection() {
    menuItems.forEach((item, index) => {
        const isSelected = index === STATE.menuIndex;
        item.classList.toggle('selected', isSelected);
        item.querySelector('.selection-arrow').style.visibility = isSelected ? 'visible' : 'hidden';
    });
}

export function executeMenuItem(index) {
    const action = menuItems[index].getAttribute('data-action');
    switch (action) {
        case 'start':
            setScreen('overworld-ui');
            DOM.loadingIndicator.classList.remove('hidden');
            // The scene is initialized on load, now we just ensure it's running
            animate(); 
            break;
        case 'archive':
            showArchive();
            break;
        case 'about':
            setScreen('about-me-menu');
            break;
        case 'options':
            showMenu('options-menu');
            break;
        case 'credits':
            showMenu('credits-menu');
            break;
    }
}

export function handleMenuNavigation(key) {
    if (key === 'ArrowUp' || key.toLowerCase() === 'w') {
        STATE.menuIndex = Math.max(0, STATE.menuIndex - 1);
        updateMenuSelection();
    } else if (key === 'ArrowDown' || key.toLowerCase() === 's') {
        STATE.menuIndex = Math.min(menuItems.length - 1, STATE.menuIndex + 1);
        updateMenuSelection();
    } else if (key === 'Enter' || key === ' ') {
        executeMenuItem(STATE.menuIndex);
    }
}