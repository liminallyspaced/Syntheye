// =================================================================================
// --- INTRO.JS - PS1-Style Boot Sequence ---
// =================================================================================
// Handles intro flow: Boot logos → Loading → Demo reel → Press Start → Menu
// All screens skippable with click/Space/Enter (advances to next, not menu)
// =================================================================================

import { STATE } from './config.js';
import { SoundManager } from './sound.js';

// =================================================================================
// INTRO STATE
// =================================================================================
let currentScreen = 0;
let introContainer = null;
let introSkipEnabled = true;
let introComplete = false;
let onIntroComplete = null;

// Screen sequence
const INTRO_SCREENS = [
    { id: 'boot-logo-1', duration: 2500, type: 'logo' },      // Dark Harbor Interactive
    { id: 'boot-logo-2', duration: 0, type: 'video' },        // Syntheye Logo Video
    { id: 'loading-screen', duration: 0, type: 'video' },     // Loading Video
    { id: 'demo-reel', duration: 0, type: 'video' },          // Demo video (skip manually)
    { id: 'press-start', duration: 0, type: 'input' }         // Press Start (wait for input)
];

// =================================================================================
// INITIALIZE INTRO SYSTEM
// =================================================================================
export function initIntro(completeCallback) {
    onIntroComplete = completeCallback;

    // Check if intro should be skipped
    if (localStorage.getItem('skipIntro') === 'true') {
        completeIntro();
        return;
    }

    // Create intro container
    createIntroScreens();

    // Setup skip handlers
    setupSkipHandlers();

    // Start sequence
    showScreen(0);
}

// =================================================================================
// CREATE INTRO SCREEN ELEMENTS
// =================================================================================
function createIntroScreens() {
    introContainer = document.createElement('div');
    introContainer.id = 'intro-container';
    introContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 10000;
    `;

    // Boot Logo 1 - Dark Harbor Interactive
    introContainer.innerHTML = `
        <div id="boot-logo-1" class="intro-screen" style="display: none;">
            <div class="boot-logo-content">
                <div class="boot-logo-text">DARK HARBOR</div>
                <div class="boot-logo-subtext">INTERACTIVE</div>
            </div>
        </div>
        
        <div id="boot-logo-2" class="intro-screen" style="display: none;">
            <video id="syntheye-logo-video" class="logo-video" playsinline>
                <source src="./assets/videos/SYNTHEYE_Logo.mp4" type="video/mp4">
            </video>
        </div>
        
        <div id="loading-screen" class="intro-screen" style="display: none;">
            <video id="loading-video" class="logo-video" playsinline>
                <source src="./assets/videos/LoadingScreen.mp4" type="video/mp4">
            </video>
        </div>
        
        <div id="demo-reel" class="intro-screen" style="display: none;">
            <video id="demo-reel-video" class="logo-video" playsinline>
                <source src="./assets/videos/DEMO REEL2025.mp4" type="video/mp4">
            </video>
        </div>
        
        <div id="press-start" class="intro-screen" style="display: none;">
            <div class="press-start-content">
                <div class="title-text">SYNTH<span style="color: #ff3366">EYE</span></div>
                <div class="author-text">NICHOLAS SIEGEL</div>
                <div class="year-text">1997</div>
                <div class="press-start-prompt blink">PRESS START</div>
            </div>
        </div>
        
        <style>
            .intro-screen {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #000;
                opacity: 0;
                transition: opacity 0.5s ease;
            }
            .intro-screen.active { opacity: 1; }
            
            .boot-logo-content, .loading-content, .demo-content, .press-start-content {
                text-align: center;
                font-family: 'Press Start 2P', 'Courier New', monospace;
                color: #fff;
            }
            
            .boot-logo-text {
                font-size: 32px;
                letter-spacing: 8px;
                margin-bottom: 10px;
            }
            .boot-logo-subtext {
                font-size: 14px;
                letter-spacing: 4px;
                color: #888;
            }
            
            .syntheye-logo {
                font-size: 48px;
                letter-spacing: 6px;
            }
            
            .logo-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .loading-text {
                font-size: 16px;
                margin-bottom: 20px;
            }
            .loading-bar-container {
                width: 300px;
                height: 20px;
                border: 2px solid #444;
                padding: 3px;
            }
            .loading-bar {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #ff3366, #ff6699);
                animation: loadingAnim 2.5s ease-out forwards;
            }
            @keyframes loadingAnim {
                0% { width: 0%; }
                100% { width: 100%; }
            }
            
            .demo-placeholder {
                font-size: 14px;
                color: #666;
                margin-bottom: 30px;
            }
            .skip-hint {
                font-size: 10px;
                color: #444;
            }
            
            .title-text {
                font-size: 42px;
                margin-bottom: 30px;
            }
            .author-text {
                font-size: 12px;
                color: #888;
                margin-bottom: 10px;
            }
            .year-text {
                font-size: 10px;
                color: #666;
                margin-bottom: 60px;
            }
            .press-start-prompt {
                font-size: 14px;
                color: #ff3366;
            }
            .blink {
                animation: blinkAnim 1s infinite;
            }
            @keyframes blinkAnim {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0; }
            }
        </style>
    `;

    document.body.appendChild(introContainer);
}

// =================================================================================
// SHOW SPECIFIC SCREEN
// =================================================================================
function showScreen(index) {
    if (index >= INTRO_SCREENS.length) {
        completeIntro();
        return;
    }

    currentScreen = index;
    const screenConfig = INTRO_SCREENS[index];

    // Hide all screens
    document.querySelectorAll('.intro-screen').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    // Show current screen
    const screen = document.getElementById(screenConfig.id);
    if (screen) {
        screen.style.display = 'flex';
        setTimeout(() => screen.classList.add('active'), 50);

        // Handle video screens - auto-advance when video ends
        const video = screen.querySelector('video');
        if (video && screenConfig.type === 'video') {
            video.currentTime = 0;
            video.volume = 1.0;
            video.play().catch(err => {
                console.log('Video play error:', err);
            });
            video.onended = () => {
                if (currentScreen === index) {
                    nextScreen();
                }
            };
        }
    }

    // Auto-advance for timed screens
    if (screenConfig.duration > 0) {
        setTimeout(() => {
            if (currentScreen === index) {
                nextScreen();
            }
        }, screenConfig.duration);
    }
}

// =================================================================================
// NEXT SCREEN
// =================================================================================
function nextScreen() {
    // Stop any currently playing video before advancing
    const currentScreenConfig = INTRO_SCREENS[currentScreen];
    if (currentScreenConfig) {
        const currentScreenEl = document.getElementById(currentScreenConfig.id);
        if (currentScreenEl) {
            const video = currentScreenEl.querySelector('video');
            if (video) {
                video.pause();
                video.currentTime = 0;
                video.volume = 0;
            }
        }
    }
    showScreen(currentScreen + 1);
}

// =================================================================================
// COMPLETE INTRO
// =================================================================================
function completeIntro() {
    if (introComplete) return;
    introComplete = true;

    // Remove intro container
    if (introContainer) {
        introContainer.style.opacity = '0';
        setTimeout(() => {
            introContainer.remove();
            introContainer = null;
        }, 500);
    }

    // Callback to main.js
    if (onIntroComplete) {
        onIntroComplete();
    }
}

// =================================================================================
// SKIP HANDLERS
// =================================================================================
function setupSkipHandlers() {
    const skipHandler = (e) => {
        if (!introSkipEnabled || introComplete) return;

        // Skip to next screen
        nextScreen();

        // Play skip sound
        SoundManager.playBlip();
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
            if (!introComplete && introContainer) {
                skipHandler(e);
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!introComplete && introContainer) {
            skipHandler(e);
        }
    });
}

// =================================================================================
// SET SKIP INTRO PREFERENCE
// =================================================================================
export function setSkipIntro(skip) {
    localStorage.setItem('skipIntro', skip ? 'true' : 'false');
}

export function getSkipIntro() {
    return localStorage.getItem('skipIntro') === 'true';
}
