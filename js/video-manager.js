// =================================================================================
// --- VIDEO-MANAGER.JS - Video Screen System ---
// =================================================================================
// Manages video textures for TV/projector screens in rooms.
// Ambient mode: videos loop silently. Focused mode: selected video has audio.
// =================================================================================

import * as THREE from 'three';
import { STATE, ROOM_DATA } from './config.js';
import { scene, camera, playerMesh } from './three-init.js';

// =================================================================================
// VIDEO STATE
// =================================================================================

// All registered video screens: { id, videoElement, mesh, texture, roomKey, cameraPosition, cameraTarget }
const videoScreens = [];

// Currently focused video screen (in INSPECT_VIDEO mode)
let focusedScreen = null;

// Stored camera position/target to restore after exiting inspect
let savedCameraPosition = null;
let savedCameraTarget = null;

// =================================================================================
// CREATE VIDEO SCREEN
// =================================================================================
/**
 * Creates a video screen with a video texture.
 * @param {Object} config - Screen configuration
 * @param {string} config.id - Unique identifier for the screen
 * @param {string} config.roomKey - Room this screen belongs to
 * @param {string} config.videoSrc - Path to video file
 * @param {THREE.Vector3} config.position - Screen position in world
 * @param {THREE.Vector3} config.rotation - Screen rotation (Euler angles)
 * @param {number} config.width - Screen width
 * @param {number} config.height - Screen height
 * @param {THREE.Vector3} config.cameraPosition - Camera position when inspecting
 * @param {THREE.Vector3} config.cameraTarget - Camera look-at when inspecting
 * @returns {Object} The video screen object
 */
export function createVideoScreen(config) {
    const {
        id,
        roomKey,
        videoSrc,
        position,
        rotation = new THREE.Vector3(0, 0, 0),
        width = 4,
        height = 2.25,
        cameraPosition,
        cameraTarget
    } = config;

    // Create video element
    const video = document.createElement('video');
    video.src = videoSrc;
    video.loop = true;
    video.muted = true; // Start muted (ambient mode)
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.volume = 0;

    // Create video texture
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;

    // Create screen mesh
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(position);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);

    // Store reference for interaction
    mesh.userData.isVideoScreen = true;
    mesh.userData.videoScreenId = id;

    const screenObj = {
        id,
        roomKey,
        videoElement: video,
        mesh,
        texture,
        cameraPosition: cameraPosition || position.clone().add(new THREE.Vector3(0, 0, 3)),
        cameraTarget: cameraTarget || position.clone(),
        isPlaying: false
    };

    videoScreens.push(screenObj);

    return screenObj;
}

// =================================================================================
// INITIALIZE VIDEO SCREENS FROM ROOM CONFIG
// =================================================================================

/**
 * Initialize all video screens defined in ROOM_DATA
 * Call this once during game initialization
 */
export function initializeVideoScreens() {
    console.log('Initializing video screens from room configs...');

    for (const roomKey in ROOM_DATA) {
        const room = ROOM_DATA[roomKey];
        if (room.videoScreens && Array.isArray(room.videoScreens)) {
            room.videoScreens.forEach(screenConfig => {
                const position = new THREE.Vector3(
                    screenConfig.position.x,
                    screenConfig.position.y,
                    screenConfig.position.z
                );
                const rotation = new THREE.Vector3(
                    screenConfig.rotation?.x || 0,
                    screenConfig.rotation?.y || 0,
                    screenConfig.rotation?.z || 0
                );
                const camPos = screenConfig.cameraPosition ? new THREE.Vector3(
                    screenConfig.cameraPosition.x,
                    screenConfig.cameraPosition.y,
                    screenConfig.cameraPosition.z
                ) : null;
                const camTarget = screenConfig.cameraTarget ? new THREE.Vector3(
                    screenConfig.cameraTarget.x,
                    screenConfig.cameraTarget.y,
                    screenConfig.cameraTarget.z
                ) : null;

                createVideoScreen({
                    id: screenConfig.id,
                    roomKey: roomKey,
                    videoSrc: screenConfig.videoSrc,
                    position: position,
                    rotation: rotation,
                    width: screenConfig.width || 4,
                    height: screenConfig.height || 2.25,
                    cameraPosition: camPos,
                    cameraTarget: camTarget
                });

                console.log(`Created video screen: ${screenConfig.id} for room: ${roomKey}`);
            });
        }
    }

    console.log(`Total video screens initialized: ${videoScreens.length}`);
}

// =================================================================================
// ROOM VIDEO MANAGEMENT
// =================================================================================

/**
 * Activate all video screens for a room (ambient mode - silent looping)
 */
export function activateRoomVideos(roomKey) {
    videoScreens.forEach(screen => {
        if (screen.roomKey === roomKey) {
            screen.videoElement.muted = true;
            screen.videoElement.volume = 0;
            screen.videoElement.play().catch(e => {
                console.log(`Video ${screen.id} autoplay blocked, will play on interaction`);
            });
            screen.isPlaying = true;

            // Add mesh to scene if not already
            if (!screen.mesh.parent) {
                scene.add(screen.mesh);
            }
        }
    });
    console.log(`Activated videos for room: ${roomKey}`);
}

/**
 * Deactivate all video screens for a room (pause and detach)
 */
export function deactivateRoomVideos(roomKey) {
    videoScreens.forEach(screen => {
        if (screen.roomKey === roomKey) {
            screen.videoElement.pause();
            screen.isPlaying = false;

            // Remove mesh from scene
            if (screen.mesh.parent) {
                scene.remove(screen.mesh);
            }
        }
    });
    console.log(`Deactivated videos for room: ${roomKey}`);
}

/**
 * Deactivate all videos (for room transitions)
 */
export function deactivateAllVideos() {
    videoScreens.forEach(screen => {
        screen.videoElement.pause();
        screen.videoElement.volume = 0;
        screen.isPlaying = false;
    });
}

// =================================================================================
// VIDEO INSPECTION (FOCUSED MODE)
// =================================================================================

/**
 * Enter focused video inspection mode
 */
export function enterVideoInspect(screenId) {
    const screen = videoScreens.find(s => s.id === screenId);
    if (!screen) {
        console.error(`Video screen not found: ${screenId}`);
        return false;
    }

    // Save current camera state
    savedCameraPosition = camera.position.clone();
    savedCameraTarget = new THREE.Vector3();
    camera.getWorldDirection(savedCameraTarget);
    savedCameraTarget.add(camera.position);

    // Set focused screen
    focusedScreen = screen;

    // Mute all other videos, unmute this one
    videoScreens.forEach(s => {
        s.videoElement.muted = true;
        s.videoElement.volume = 0;
    });

    // Unmute focused screen
    screen.videoElement.muted = false;
    screen.videoElement.volume = 1;

    // Ensure video is playing
    if (!screen.isPlaying) {
        screen.videoElement.play().catch(e => console.log('Video play failed:', e));
        screen.isPlaying = true;
    }

    // Move camera to inspect position
    camera.position.copy(screen.cameraPosition);
    camera.lookAt(screen.cameraTarget);

    // Update game state
    STATE.interaction_mode = 'INSPECT_VIDEO';

    // Show video control overlay
    showVideoControls(screen);

    console.log(`Entered video inspect: ${screenId}`);
    return true;
}

/**
 * Exit video inspection mode
 */
export function exitVideoInspect() {
    if (!focusedScreen) return;

    // Mute the focused video (back to ambient)
    focusedScreen.videoElement.muted = true;
    focusedScreen.videoElement.volume = 0;

    // Restore camera
    if (savedCameraPosition) {
        camera.position.copy(savedCameraPosition);
    }
    if (savedCameraTarget) {
        camera.lookAt(savedCameraTarget);
    }

    // Hide video control overlay
    hideVideoControls();

    // Clear focused screen
    focusedScreen = null;

    // Restore game state
    STATE.interaction_mode = 'OVERWORLD';

    console.log('Exited video inspect');
}

/**
 * Get the currently focused screen
 */
export function getFocusedScreen() {
    return focusedScreen;
}

// =================================================================================
// VIDEO CONTROL OVERLAY
// =================================================================================

function showVideoControls(screen) {
    let overlay = document.getElementById('video-controls-overlay');

    if (!overlay) {
        // Create overlay if it doesn't exist
        overlay = document.createElement('div');
        overlay.id = 'video-controls-overlay';
        overlay.className = 'fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 p-4 rounded-lg border border-gray-600 z-50';
        overlay.innerHTML = `
            <div class="flex items-center space-x-4 font-mono text-sm">
                <button id="video-btn-playpause" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">
                    ⏸ PAUSE
                </button>
                <button id="video-btn-mute" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">
                    🔊 UNMUTED
                </button>
                <button id="video-btn-fullscreen" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">
                    ⛶ FULLSCREEN
                </button>
                <button id="video-btn-exit" class="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded">
                    ✕ EXIT
                </button>
            </div>
            <p class="text-center text-xs text-gray-400 mt-2">Press ESC to exit</p>
        `;
        document.body.appendChild(overlay);

        // Add event listeners
        document.getElementById('video-btn-playpause').addEventListener('click', toggleVideoPlayPause);
        document.getElementById('video-btn-mute').addEventListener('click', toggleVideoMute);
        document.getElementById('video-btn-fullscreen').addEventListener('click', toggleVideoFullscreen);
        document.getElementById('video-btn-exit').addEventListener('click', exitVideoInspect);
    }

    overlay.classList.remove('hidden');
    updateVideoControlButtons();
}

function hideVideoControls() {
    const overlay = document.getElementById('video-controls-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function updateVideoControlButtons() {
    if (!focusedScreen) return;

    const playPauseBtn = document.getElementById('video-btn-playpause');
    const muteBtn = document.getElementById('video-btn-mute');

    if (playPauseBtn) {
        playPauseBtn.textContent = focusedScreen.videoElement.paused ? '▶ PLAY' : '⏸ PAUSE';
    }

    if (muteBtn) {
        muteBtn.textContent = focusedScreen.videoElement.muted ? '🔇 MUTED' : '🔊 UNMUTED';
    }
}

// =================================================================================
// VIDEO CONTROL FUNCTIONS
// =================================================================================

export function toggleVideoPlayPause() {
    if (!focusedScreen) return;

    if (focusedScreen.videoElement.paused) {
        focusedScreen.videoElement.play();
        focusedScreen.isPlaying = true;
    } else {
        focusedScreen.videoElement.pause();
        focusedScreen.isPlaying = false;
    }
    updateVideoControlButtons();
}

export function toggleVideoMute() {
    if (!focusedScreen) return;

    focusedScreen.videoElement.muted = !focusedScreen.videoElement.muted;
    focusedScreen.videoElement.volume = focusedScreen.videoElement.muted ? 0 : 1;
    updateVideoControlButtons();
}

export function toggleVideoFullscreen() {
    if (!focusedScreen) return;

    const video = focusedScreen.videoElement;

    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else if (video.requestFullscreen) {
        video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
    } else if (video.mozRequestFullScreen) {
        video.mozRequestFullScreen();
    }
}

// =================================================================================
// KEYBOARD HANDLING FOR VIDEO INSPECT
// =================================================================================

export function handleVideoInspectKeydown(event) {
    if (STATE.interaction_mode !== 'INSPECT_VIDEO') return false;

    switch (event.key.toLowerCase()) {
        case 'escape':
            event.preventDefault();
            exitVideoInspect();
            return true;
        case ' ':
            event.preventDefault();
            toggleVideoPlayPause();
            return true;
        case 'm':
            event.preventDefault();
            toggleVideoMute();
            return true;
        case 'f':
            event.preventDefault();
            toggleVideoFullscreen();
            return true;
    }
    return false;
}

// =================================================================================
// GET VIDEO SCREEN BY ID
// =================================================================================

export function getVideoScreen(id) {
    return videoScreens.find(s => s.id === id);
}

export function getAllVideoScreens() {
    return videoScreens;
}
