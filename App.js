import { STATE } from './constants.js';
import { setScreen, showMenu, hideMenu } from './utils.js';
import { initAudio, playMusic } from './audio.js';
import { setupInspectionView, startInspectionView, stopInspectionView } from './inspector.js';
import { initThree, setRoom, animate } from './three_scene.js';

const App = {
    setScreen, 
    showMenu,
    
    closePopup: () => {
        stopInspectionView();
        setScreen('screen-overworld');
    },

    // Callback from game engine
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
        // 1. Initialize Sub-systems
        initAudio();
        setupInspectionView();
        initThree(App.handleInteraction);
        animate(); 

        // 2. UI References
        const videoSeq = document.getElementById('video-sequence');
        const pressStart = document.getElementById('screen-press-start');
        const btnPressStart = document.getElementById('btn-press-start');

        // 3. Robust Skip Logic
        // We define this function to handle the transition reliably
        const performSkip = () => {
            // Only skip if the video sequence is currently visible
            if (videoSeq && videoSeq.style.display !== 'none') {
                console.log("Skipping video sequence...");
                videoSeq.style.display = 'none';
                pressStart.style.display = 'flex';
                
                // Ensure the main video is paused if it was playing
                const videoEl = document.getElementById('main-video');
                if(videoEl) videoEl.pause();
            }
        };

        // Attach click listener to the specific container
        if (videoSeq) {
            videoSeq.addEventListener('click', performSkip);
        }

        // 4. Global Fallback Listener
        // This catches clicks anywhere on the document to ensure the skip happens
        document.addEventListener('click', (e) => {
            // Check if we are in the intro phase (video sequence is visible)
            if (videoSeq && videoSeq.style.display !== 'none') {
                performSkip();
            }
        });

        // 5. Press Start Button Logic
        if (btnPressStart) {
            btnPressStart.addEventListener('click', () => {
                pressStart.style.display = 'none';
                setScreen('screen-main-menu');
            });
        }

        // 6. Main Menu Button Logic
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'start') {
                    document.getElementById('loading-indicator').classList.remove('hidden');
                    // Simulate loading delay
                    setTimeout(() => {
                        document.getElementById('loading-indicator').classList.add('hidden');
                        setScreen('screen-overworld');
                        // Ensure we start in the main hall
                        setRoom('ROOM_HALL', [0, 1, 0]);
                    }, 1000);
                } else if (action === 'about') {
                    document.getElementById('generic-title').innerText = "ABOUT THE ARCHITECT";
                    document.getElementById('generic-content').innerText = "Nicholas M. Siegel is a multidisciplinary artist...";
                    setScreen('screen-generic');
                } else if (action === 'archive') {
                    document.getElementById('generic-title').innerText = "ARCHIVE";
                    document.getElementById('generic-content').innerText = "Project Archive loading...";
                    setScreen('screen-generic');
                }
            });
        });
    }
};

// Bind to window for HTML onclick access
window.App = App;
window.onload = App.init;