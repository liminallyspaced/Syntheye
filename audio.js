import { STATE } from '.constants.js';

export function initAudio() {}

export function playMusic(track) {
    const mMenu = document.getElementById('bgm-menu');
    const mGame = document.getElementById('bgm-game');

    if(!mMenu  !mGame) return;

    mMenu.pause();
    mGame.pause();

    if (track === 'menu') {
        mMenu.volume = 0.4;
        mMenu.currentTime = 0;
        mMenu.play().catch(e = console.warn(Audio blocked));
    } else if (track === 'game') {
        mGame.volume = 0.3;
        mGame.currentTime = 0;
        mGame.play().catch(e = console.warn(Audio blocked));
    }
}