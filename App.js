import { STATE } from './constants.js';
import { setScreen, showMenu, hideMenu } from './utils.js';
import { initAudio, playMusic } from './audio.js';
import { setupInspectionView, startInspectionView, stopInspectionView } from './inspector.js';
// Correct import matching the file above
import { initThree, setRoom, animate } from './three-scene.js';

const App = {
    setScreen, 
    showMenu,
    
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

    // --- Video Logic ---
    startVideoSequence: () => {
        const videoSeq = document.getElementById('video-sequence');
        const mainVideo = document.getElementById('main-video');
        const placeholder = document.getElementById('video-placeholder');
        
        // Sequence of videos to play
        const videos = [
            'assets/video/syntheye_logo.mp4',
            'assets/video/syntheye_loading.mp4',
            'assets/video/syntheye_demoreel.mp4'
        ];
        
        let currentVidIdx = 0;

        const playNext = () => {
            if (currentVidIdx >= videos.length) {
                // Sequence done
                App.skipSequence();
                return;
            }

            mainVideo.src = videos[currentVidIdx];
            mainVideo.classList.remove('hidden');
            placeholder.classList.add('hidden'); // Hide text once video starts
            
            mainVideo.play().then(() => {
                // Play successful
            }).catch(e => {
                console.warn("Autoplay blocked or file missing. Showing placeholder.");
                mainVideo.classList.add('hidden');
                placeholder.classList.remove('hidden');
                // Auto-advance placeholder after delay if video fails
                setTimeout(() => {
                    currentVidIdx++;
                    playNext();
                }, 3000); 
            });
        };

        // When one video ends, play next
        mainVideo.onended = () => {
            currentVidIdx++;
            playNext();
        };

        // Start first video
        playNext();
    },

    skipSequence: () => {
        const videoSeq = document.getElementById('video-sequence');
        const pressStart = document.getElementById('screen-press-start');
        const mainVideo = document.getElementById('main-video');

        if (videoSeq.style.display !== 'none') {
            mainVideo.pause();
            mainVideo.onended = null; // Stop chain
            videoSeq.style.display = 'none';
            pressStart.style.display = 'flex';
        }
    },

    init: () => {
        initAudio();
        setupInspectionView();
        initThree(App.handleInteraction);
        animate(); 

        // Start Intro
        App.startVideoSequence();

        // UI Event Listeners
        const videoSeq = document.getElementById('video-sequence');
        const pressStart = document.getElementById('screen-press-start');

        // Global click to skip intro
        videoSeq.addEventListener('click', App.skipSequence);

        // Press Start
        document.getElementById('btn-press-start').addEventListener('click', () => {
            pressStart.style.display = 'none';
            setScreen('screen-main-menu');
        });

        // Menu Buttons
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

window.App = App;
window.onload = App.init;