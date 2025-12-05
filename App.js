import { STATE } from './constants.js';
import { setScreen, showMenu, hideMenu } from './utils.js';
import { initAudio, playMusic } from './audio.js';
import { setupInspectionView, startInspectionView, stopInspectionView } from './inspector.js';
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
        
        const videos = [
            'assets/video/syntheye_logo.mp4',
            'assets/video/syntheye_loading.mp4',
            'assets/video/syntheye_demoreel.mp4'
        ];
        
        let currentVidIdx = 0;

        const playNext = () => {
            if (videoSeq.style.display === 'none') return;

            if (currentVidIdx >= videos.length) {
                App.skipSequence();
                return;
            }

            mainVideo.src = videos[currentVidIdx];
            mainVideo.classList.remove('hidden');
            placeholder.classList.add('hidden');
            
            mainVideo.play().then(() => {
                // Video playing
            }).catch(e => {
                console.warn("Autoplay blocked. Showing placeholder.");
                mainVideo.classList.add('hidden');
                placeholder.classList.remove('hidden');
                setTimeout(() => {
                    if (videoSeq.style.display !== 'none') {
                        currentVidIdx++;
                        playNext();
                    }
                }, 3000); 
            });
        };

        mainVideo.onended = () => {
            currentVidIdx++;
            playNext();
        };

        playNext();
    },

    skipSequence: () => {
        const videoSeq = document.getElementById('video-sequence');
        const pressStart = document.getElementById('screen-press-start');
        const mainVideo = document.getElementById('main-video');

        if (videoSeq.style.display !== 'none') {
            console.log("Skipping Intro...");
            if(mainVideo) {
                mainVideo.pause();
                mainVideo.onended = null;
            }
            videoSeq.style.display = 'none';
            if(pressStart) pressStart.style.display = 'flex';
        }
    },

    init: () => {
        initAudio();
        setupInspectionView();
        initThree(App.handleInteraction);
        animate(); 

        App.startVideoSequence();

        const videoSeq = document.getElementById('video-sequence');
        const pressStart = document.getElementById('screen-press-start');
        const btnPressStart = document.getElementById('btn-press-start');

        // Global Click Listener for skipping
        document.addEventListener('click', (e) => {
            if (videoSeq && videoSeq.style.display !== 'none') {
                e.preventDefault(); 
                App.skipSequence();
            }
        });

        if (btnPressStart) {
            btnPressStart.addEventListener('click', () => {
                if(pressStart) pressStart.style.display = 'none';
                setScreen('screen-main-menu');
            });
        }

        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'start') {
                    const loading = document.getElementById('loading-indicator');
                    if(loading) loading.classList.remove('hidden');
                    
                    setTimeout(() => {
                        if(loading) loading.classList.add('hidden');
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
        
        console.log("App initialized successfully.");
    }
};

window.App = App;
window.onload = App.init;