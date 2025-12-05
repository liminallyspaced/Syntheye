import { STATE } from './constants.js';
import { playMusic } from './audio.js';

export function setScreen(newScreen) {
    const screens = ['video-sequence', 'screen-press-start', 'screen-main-menu', 'screen-overworld', 'screen-generic'];
    const popups = ['popup-text', 'popup-inspect'];
    
    screens.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    popups.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });

    const target = document.getElementById(newScreen);
    if(target) {
        if(newScreen.startsWith('popup')) {
            document.getElementById('screen-overworld').style.display = 'block';
            target.style.display = 'block';
        } else {
            target.style.display = (newScreen === 'screen-overworld') ? 'block' : 'flex';
        }
    }

    if (newScreen === 'screen-main-menu') {
        STATE.screen = 'main-menu'; 
        playMusic('menu');
    } else if (newScreen === 'screen-overworld') {
        STATE.screen = 'overworld';
        playMusic('game');
    } else if (newScreen.startsWith('popup')) {
        STATE.screen = 'popup';
    }
}

export function showMenu(menuId) {
    // Logic for overlay menus
}