import { STATE } from './constants.js';
import { setScreen, showMenu, hideMenu } from './utils.js';
import { initAudio, playMusic } from './audio.js';
import { setupInspectionView, startInspectionView, stopInspectionView } from './inspector.js';
import { initThree, setRoom, animate } from './three_scene.js'; // Note file import change

const App = {
    setScreen, showMenu,
    
    closePopup: () => {
        stopInspectionView();
        setScreen('screen-overworld');
    },

    handleInteraction: (data) => {
        if (data.type === 'text') {
            document.getElementById('popup-text-title').innerText = data.title;
            document.getElementById('popup-text-content').innerText = data.text;
            setScreen('popup-text');
        } else if (data.type === 'inspect') {
            document.getElementById('popup-inspect-title').innerText = data.title;
            document.getElementById('popup-inspect-desc').innerText = data.text;
            setScreen('popup-inspect');
            startInspectionView(data.id);
        }
    },

    init: () => {
        initAudio();
        setupInspectionView();
        initThree(App.handleInteraction);
        animate(); 

        const videoSeq = document.getElementById('video-sequence');
        const pressStart = document.getElementById('screen-press-start');

        videoSeq.addEventListener('click', () => {
            videoSeq.style.display = 'none';
            pressStart.style.display = 'flex';
        });

        document.getElementById('btn-press-start').addEventListener('click', () => {
            pressStart.style.display = 'none';
            setScreen('screen-main-menu');
        });

        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'start') {
                    document.getElementById('loading-indicator').classList.remove('hidden');
                    setTimeout(() => {
                        document.getElementById('loading-indicator').classList.add('hidden');
                        setScreen('screen-overworld');
                        setRoom('ROOM_HALL', [0, 1, 0]);
                    }, 1000);
                } else if (action === 'about') {
                    document.getElementById('generic-title').innerText = "ABOUT THE ARCHITECT";
                    document.getElementById('generic-content').innerText = "Nicholas M. Siegel...";
                    setScreen('screen-generic');
                } else if (action === 'archive') {
                    document.getElementById('generic-title').innerText = "ARCHIVE";
                    document.getElementById('generic-content').innerText = "Loading Archive...";
                    setScreen('screen-generic');
                }
            });
        });
    }
};

window.App = App;
window.onload = App.init;