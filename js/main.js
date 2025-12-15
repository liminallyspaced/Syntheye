// =================================================================================
// --- MAIN.JS - Main Entry Point ---
// =================================================================================
// Main game loop, handles startup, calls initialization functions.
// This is the single entry point imported by index.html.
// =================================================================================

import * as THREE from 'three';
import { STATE } from './config.js';
import { SoundManager } from './sound.js';
import {
    setScreen,
    showMenu,
    hideMenu,
    updateMenuSelection,
    handleMenuAction,
    closePopup,
    returnToMainMenu,
    setupCrtToggle,
    menuItems
} from './utils.js';
import {
    initThree,
    renderer,
    scene,
    camera,
    playerMesh,
    targetMarkerMesh,
    updateAnimations,
    playOnceAnimation,
    createTestLevelElements
} from './three-init.js';
import { loadAllRooms, setRoom, spawnRoomItems } from './rooms.js';
import { controls, updatePlayerMovement } from './movement.js';
import { handleMouseDown, checkHotspots, handleEInteraction, updateDroppedItems } from './interactions.js';
import { setupInspectionView, animateInspection } from './inspection.js';
import { updateSecretDoorState } from './puzzle.js';
import { initInventoryUI, handleInventoryKeydown } from './inventory-ui.js';
import { toggleInventory, isInventoryOpen } from './inventory.js';
import { initFlashlight, updateFlashlight, toggleFlashlight } from './flashlight.js';
import { isPadlockOpen, handlePadlockKeydown, closePadlock } from './padlock.js';
import { initDebugMenu, updateDebugValues, handleDebugKeydown, handleDebugKeyup } from './debug.js';
import { initNarration, showNarration, checkSelfDialogTriggers } from './narration.js';
import { updateCameraZone, setInitialZone, resetCameraZones, initCameraForRoom } from './camera-zones.js';
import { initIntro } from './intro.js';
import { handleVideoInspectKeydown, exitVideoInspect, initializeVideoScreens } from './video-manager.js';

// =================================================================================
// MAKE FUNCTIONS AVAILABLE GLOBALLY FOR HTML ONCLICK HANDLERS
// =================================================================================
window.SoundManager = SoundManager;
window.handleMenuClick = function (element, index) {
    STATE.menuIndex = index;
    SoundManager.playSelect();
    updateMenuSelection();
    handleMenuAction(element.dataset.action);
};
window.showMenu = showMenu;
window.hideMenu = hideMenu;
window.closePopup = closePopup;
window.returnToMainMenu = returnToMainMenu;

// =================================================================================
// START OVERWORLD
// =================================================================================
export function startOverworld() {
    STATE.interaction_mode = 'OVERWORLD';  // Critical: set mode before anything else
    setScreen('overworld-ui');

    // If "testing" difficulty, load the Test Range instead of the default room
    if (STATE.difficulty === 'testing') {
        STATE.current_room = 'ROOM_TESTRANGE';
        STATE.player_pos.set(0, 0.05, 8);

        // Enable telekinesis mode for test range
        window.TELEKINESIS_MODE = true;

        // Create test level elements (LevitationBall, etc.)
        createTestLevelElements();

        // Show test level UI (mode indicator and reset buttons)
        if (window.showTestLevelUI) {
            window.showTestLevelUI();
        }

        // Initialize hand tracking systems for test level only
        initHandTracking();
    } else {
        // Telekinesis mode off by default outside test range
        window.TELEKINESIS_MODE = false;
    }

    setRoom(STATE.current_room, STATE.player_pos);

    // Spawn items for the starting room
    setTimeout(() => {
        spawnRoomItems(STATE.current_room);
    }, 100);

    animateInspection();
    console.log('Overworld started, interaction_mode:', STATE.interaction_mode, 'room:', STATE.current_room);
}

// =================================================================================
// MAIN GAME LOOP
// =================================================================================
let gameTime = 0;
let lastFrameTime = performance.now();
const MAX_DELTA_TIME = 0.1; // Clamp deltaTime to prevent huge jumps

// =================================================================================
// PHASE 2 FIX: Shared hand state object
// MediaPipe callback ONLY updates this. RAF loop reads it for processing.
// =================================================================================
window.HAND_STATE = {
    hasHand: false,
    landmarks: null,
    gesture: 'NONE',
    gestureEnum: null,
    timestamp: 0,
    previousGesture: null
};

// Hand tracking systems (set during init, used in RAF)
window.handTrackingSystems = null;

function animate() {
    requestAnimationFrame(animate);

    // PHASE 2 FIX: Compute real deltaTime with clamping
    const now = performance.now();
    let deltaTime = (now - lastFrameTime) / 1000; // Convert to seconds
    deltaTime = Math.min(deltaTime, MAX_DELTA_TIME); // Clamp to prevent huge jumps
    lastFrameTime = now;

    gameTime += deltaTime;

    try {
        if (STATE.interaction_mode === 'OVERWORLD') {
            updatePlayerMovement();
            checkHotspots();

            // NOTE: Crosshair visibility is now controlled by LevitationSystem
            // based on levitation state (HOVERING = show, else hide)
        }

        // Camera zone lerp system - smooth pan when entering zones
        if (STATE.interaction_mode === 'OVERWORLD' && playerMesh) {
            // Updated: Only update zones if Hand Control is NOT overriding it
            if (!window.HAND_CAMERA_CONTROL_ACTIVE) {
                updateCameraZone(playerMesh.position);
            }

            // Check for proximity-based self-dialog triggers
            checkSelfDialogTriggers(playerMesh.position);
        }

        // =============================================================
        // PHASE 2 FIX: Hand tracking updates moved to RAF loop
        // This ensures physics/camera/levitation are synced with render
        // =============================================================
        if (window.handTrackingSystems && STATE.current_room === 'ROOM_TESTRANGE') {
            const systems = window.handTrackingSystems;
            const handState = window.HAND_STATE;

            // PHASE 1 FIX: Hard gate - skip ALL processing if no hand detected
            if (!handState.hasHand) {
                window.HAND_CAMERA_CONTROL_ACTIVE = false;
                // Still update physics for gravity/collisions even without hand
                if (systems.physics) {
                    systems.physics.update(deltaTime);
                }
            } else {
                // Hand is present - do full processing
                const gesture = handState.gestureEnum;
                const landmarks = handState.landmarks;
                const currentMode = window.getControlMode ? window.getControlMode() : 'A';

                // Update Physics with real deltaTime
                if (systems.physics) {
                    systems.physics.update(deltaTime);
                }

                // Update Basketball Hoop score detection
                if (systems.basketballHoop && window.levitationCube) {
                    systems.basketballHoop.update(window.levitationCube);
                }

                // Update interaction system based on current mode
                if (currentMode === 'A' && systems.levitationSystem) {
                    // Update last valid state for hand-loss grace period
                    if (handState.hasHand) {
                        systems.levitationSystem.updateLastValidState(camera);
                    }
                    // Pass hasHand and deltaTime for new UX improvements
                    systems.levitationSystem.update(
                        gesture,
                        landmarks,
                        systems.gestureRecognizer,
                        handState.hasHand,
                        deltaTime
                    );
                } else if (systems.windSystem) {
                    systems.windSystem.update(gesture, landmarks, systems.gestureRecognizer);
                }

                // Update Camera control
                if (systems.cameraControl) {
                    const GESTURE = systems.GESTURE;
                    const isCameraGesture = gesture === GESTURE.OPEN_HAND || gesture === GESTURE.PINCH;
                    const justChangedGesture = handState.gestureEnum !== handState.previousGesture;

                    if (isCameraGesture && !justChangedGesture) {
                        // Pass deltaTime for dt-stable smoothing
                        const isHandControllingCamera = systems.cameraControl.update(gesture, landmarks, deltaTime);
                        window.HAND_CAMERA_CONTROL_ACTIVE = isHandControllingCamera;
                    } else {
                        if (currentMode === 'A' && gesture === GESTURE.THREE_FINGER) {
                            systems.cameraControl.blockFor(200);
                        }
                        window.HAND_CAMERA_CONTROL_ACTIVE = false;
                    }
                }

                // Update previous gesture for next frame
                handState.previousGesture = handState.gestureEnum;
            }
        }

    } catch (error) {
        console.error('GAME LOOP ERROR:', error);
    }

    // Update character animations
    updateAnimations();

    // Update eye-light flashlight (follows camera, main cone light)
    updateFlashlight();

    // Update dropped items floating animation
    updateDroppedItems(gameTime);

    // Update debug panel values
    updateDebugValues();

    if (renderer && scene && camera) {
        // ONE-TIME: Log camera state when first entering OVERWORLD
        if (!window._cameraLogged && STATE.interaction_mode === 'OVERWORLD') {
            window._cameraLogged = true;
            console.log('=== CAMERA DIAGNOSTICS ===');
            console.log(`Camera position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            console.log(`Camera direction: (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)})`);
            console.log(`Scene children: ${scene.children.length}`);
            console.log('=========================');
        }
        renderer.render(scene, camera);
    }
}

// =================================================================================
// KEYBOARD EVENT HANDLERS
// =================================================================================
document.addEventListener('keydown', (event) => {
    // NOTE: Removed per-keypress console.log for performance (Phase 1 fix)

    // Debug menu toggle (works in any mode)
    if (handleDebugKeydown(event)) return;

    // === T KEY: TELEKINESIS MODE TOGGLE (Test Range only) ===
    if ((event.key === 't' || event.key === 'T') && STATE.current_room === 'ROOM_TESTRANGE') {
        window.TELEKINESIS_MODE = !window.TELEKINESIS_MODE;
        console.log(`Telekinesis Mode: ${window.TELEKINESIS_MODE ? 'ON' : 'OFF'}`);

        // If turning OFF and levitation system exists, force disable (drop if holding)
        if (!window.TELEKINESIS_MODE && window.handTrackingSystems?.levitationSystem) {
            window.handTrackingSystems.levitationSystem.forceDisable();
        }
        return;
    }

    // Video inspection mode takes priority
    if (STATE.interaction_mode === 'INSPECT_VIDEO') {
        if (handleVideoInspectKeydown(event)) return;
    }
    if (STATE.screen === 'main-menu') {
        switch (event.key) {
            case 'ArrowUp':
            case 'w':
                event.preventDefault();
                STATE.menuIndex = (STATE.menuIndex - 1 + menuItems.length) % menuItems.length;
                updateMenuSelection();
                break;
            case 'ArrowDown':
            case 's':
                event.preventDefault();
                STATE.menuIndex = (STATE.menuIndex + 1) % menuItems.length;
                updateMenuSelection();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                SoundManager.playSelect();
                const action = menuItems[STATE.menuIndex].dataset.action;
                if (action === 'start') {
                    // Go to difficulty selection first (consistent with click handler)
                    setScreen('difficulty-select');
                } else {
                    handleMenuAction(action);
                }
                break;
        }
    }
    // Check difficulty-select by DOM visibility (more reliable than STATE.screen)
    else if (!document.getElementById('difficulty-select').classList.contains('hidden')) {
        // Keyboard navigation for difficulty selection
        const difficultyBtns = document.querySelectorAll('#difficulty-options .difficulty-btn');
        let selectedIndex = Array.from(difficultyBtns).findIndex(btn => btn.classList.contains('selected'));
        if (selectedIndex < 0) selectedIndex = 0;

        switch (event.key) {
            case 'ArrowUp':
            case 'w':
                event.preventDefault();
                selectedIndex = (selectedIndex - 1 + difficultyBtns.length) % difficultyBtns.length;
                difficultyBtns.forEach((btn, i) => {
                    const arrow = btn.querySelector('.selection-arrow');
                    btn.classList.toggle('selected', i === selectedIndex);
                    if (arrow) arrow.style.visibility = i === selectedIndex ? 'visible' : 'hidden';
                });
                SoundManager.playBlip();
                break;
            case 'ArrowDown':
            case 's':
                event.preventDefault();
                selectedIndex = (selectedIndex + 1) % difficultyBtns.length;
                difficultyBtns.forEach((btn, i) => {
                    const arrow = btn.querySelector('.selection-arrow');
                    btn.classList.toggle('selected', i === selectedIndex);
                    if (arrow) arrow.style.visibility = i === selectedIndex ? 'visible' : 'hidden';
                });
                SoundManager.playBlip();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                SoundManager.playSelect();
                const selectedBtn = difficultyBtns[selectedIndex];
                if (selectedBtn) {
                    STATE.difficulty = selectedBtn.dataset.difficulty;
                    console.log(`Difficulty set to: ${STATE.difficulty}`);
                    startOverworld();
                }
                break;
            case 'Escape':
                event.preventDefault();
                SoundManager.playBlip();
                setScreen('main-menu');
                break;
        }
    }
    else if (STATE.interaction_mode === 'OVERWORLD') {
        // Cancel click-to-move when using keyboard
        if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) {
            STATE.active_target = null;
            if (targetMarkerMesh) targetMarkerMesh.visible = false;
        }

        switch (event.key.toLowerCase()) {
            case 'w': controls.w = true; break;
            case 's': controls.s = true; break;
            case 'a': controls.a = true; break;
            case 'd': controls.d = true; break;
            case 'arrowup': controls.w = true; break;
            case 'arrowdown': controls.s = true; break;
            case 'arrowleft': controls.a = true; break;
            case 'arrowright': controls.d = true; break;
            case 'tab':
                // Open inventory
                event.preventDefault();
                toggleInventory();
                break;
            case 'e':
                // Interact with hotspot and play interact animation
                handleEInteraction();
                break;
            case ' ':
                // Jump animation (spacebar)
                event.preventDefault();
                playOnceAnimation('Jump');
                break;
            case 'escape':
                SoundManager.playBlip();
                showMenu('options-menu');
                break;
            case 'f':
                // Toggle flashlight
                toggleFlashlight();
                SoundManager.playBlip();
                break;
            case 'm':
                SoundManager.playBlip();
                returnToMainMenu();
                break;
        }
    }
    else if (STATE.interaction_mode === 'INVENTORY') {
        // Pass keyboard events to inventory handler
        handleInventoryKeydown(event);
    }
    else if (isPadlockOpen()) {
        // Pass keyboard events to padlock handler
        handlePadlockKeydown(event);
    }
    else if (event.key === 'Escape') {
        event.preventDefault();
        SoundManager.playBlip();
        if (STATE.interaction_mode === 'POPUP_TEXT' || STATE.interaction_mode === 'POPUP_INSPECT') {
            closePopup();
        } else if (STATE.interaction_mode === 'MENU_PAUSE') {
            // Close any open overlay menu
            const overlayMenus = ['options-menu', 'how-to-play-menu', 'bug-report-menu', 'credits-menu', 'main-menu-options'];
            overlayMenus.forEach(menuId => {
                const menu = document.getElementById(menuId);
                if (menu && !menu.classList.contains('hidden')) {
                    hideMenu(menuId);
                }
            });
        }
    }
});

document.addEventListener('keyup', (event) => {
    // Handle debug/free cam key releases first
    if (handleDebugKeyup(event)) return;

    if (STATE.interaction_mode === 'OVERWORLD') {
        switch (event.key.toLowerCase()) {
            case 'w': controls.w = false; break;
            case 's': controls.s = false; break;
            case 'a': controls.a = false; break;
            case 'd': controls.d = false; break;
            case 'arrowup': controls.w = false; break;
            case 'arrowdown': controls.s = false; break;
            case 'arrowleft': controls.a = false; break;
            case 'arrowright': controls.d = false; break;
        }
    }
});

// =================================================================================
// INITIALIZATION
// =================================================================================
window.onload = () => {
    // Setup CRT toggle button
    setupCrtToggle();

    // Initialize inspection view renderer
    setupInspectionView();

    // Initialize main THREE.js scene
    initThree();

    // Initialize eye-light flashlight (always on)
    initFlashlight();

    // Pre-build all room geometry
    loadAllRooms();

    // Initialize video screens from room configs
    initializeVideoScreens();

    // Initialize inventory UI
    initInventoryUI();

    // Initialize debug menu (press ` to toggle)
    initDebugMenu();

    // Initialize narration system
    initNarration();

    // Hide main menu initially (intro will show it)
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.style.display = 'none';

    // Start intro sequence, show menu when complete
    initIntro(() => {
        // Intro complete - show main menu (remove hidden class)
        if (mainMenu) {
            mainMenu.classList.remove('hidden');
            mainMenu.style.display = 'flex';
        }
        STATE.screen = 'main-menu';
        STATE.interaction_mode = 'MENU';
        console.log('Intro complete, showing main menu');
    });

    // Attach mouse handler to 3D container
    document.getElementById('three-container').addEventListener('mousedown', handleMouseDown);

    // =================================================================================
    // SETUP EVENT LISTENERS (replaces inline onclick handlers for ES module compatibility)
    // =================================================================================

    // Main menu items
    const menuItemElements = document.querySelectorAll('#menu-options .menu-item');
    menuItemElements.forEach((item) => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            STATE.menuIndex = index;
            SoundManager.playSelect();
            updateMenuSelection();

            const action = item.dataset.action;
            if (action === 'start') {
                // Show difficulty selection instead of starting directly
                setScreen('difficulty-select');
            } else {
                handleMenuAction(action);
            }
        });
    });

    // Difficulty selection buttons
    const difficultyBtns = document.querySelectorAll('#difficulty-options .difficulty-btn');
    let difficultyIndex = 0;
    difficultyBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            STATE.difficulty = difficulty;
            SoundManager.playSelect();
            console.log(`Difficulty set to: ${STATE.difficulty}`);
            startOverworld();
        });

        // Hover effect
        btn.addEventListener('mouseenter', () => {
            difficultyBtns.forEach((b, i) => {
                const arrow = b.querySelector('.selection-arrow');
                if (b === btn) {
                    arrow.style.visibility = 'visible';
                    b.classList.add('selected');
                } else {
                    arrow.style.visibility = 'hidden';
                    b.classList.remove('selected');
                }
            });
        });
    });

    // Back button from difficulty selection
    document.getElementById('btn-back-difficulty')?.addEventListener('click', () => {
        SoundManager.playBlip();
        setScreen('main-menu');
    });

    // Game menu buttons (in overworld)
    document.getElementById('btn-options')?.addEventListener('click', () => {
        SoundManager.playBlip();
        showMenu('options-menu');
    });

    document.getElementById('btn-main-menu')?.addEventListener('click', () => {
        SoundManager.playBlip();
        returnToMainMenu();
    });

    // Popup close buttons
    document.getElementById('btn-close-text-popup')?.addEventListener('click', () => {
        SoundManager.playBlip();
        closePopup();
    });

    document.getElementById('btn-close-inspect-popup')?.addEventListener('click', () => {
        SoundManager.playBlip();
        closePopup();
    });

    // Pause menu - Resume button
    document.getElementById('btn-resume')?.addEventListener('click', () => {
        SoundManager.playBlip();
        hideMenu('options-menu');
    });

    // Pause menu - Exit to Main Menu button
    document.getElementById('btn-pause-main-menu')?.addEventListener('click', () => {
        SoundManager.playBlip();
        hideMenu('options-menu');
        returnToMainMenu();
    });

    // Sound toggle
    document.getElementById('toggle-sound')?.addEventListener('click', (e) => {
        const btn = e.target;
        const isOn = btn.dataset.setting === 'on';
        btn.dataset.setting = isOn ? 'off' : 'on';
        btn.textContent = isOn ? 'OFF' : 'ON';
        btn.classList.toggle('bg-green-600', !isOn);
        btn.classList.toggle('bg-red-600', isOn);
        SoundManager.setMuted(isOn);
        if (!isOn) SoundManager.playBlip();
    });

    // Volume sliders
    document.getElementById('volume-master')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('volume-master-val').textContent = val + '%';
        SoundManager.setMasterVolume(val / 100);
    });

    document.getElementById('volume-music')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('volume-music-val').textContent = val + '%';
        SoundManager.setMusicVolume(val / 100);
    });

    document.getElementById('volume-fx')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('volume-fx-val').textContent = val + '%';
        SoundManager.setFxVolume(val / 100);
    });

    // How-to-play menu back button
    document.getElementById('btn-back-howto')?.addEventListener('click', () => {
        SoundManager.playBlip();
        hideMenu('how-to-play-menu');
    });

    // Bug report menu back button
    document.getElementById('btn-back-bugreport')?.addEventListener('click', () => {
        SoundManager.playBlip();
        hideMenu('bug-report-menu');
    });

    // Credits menu back button
    document.getElementById('btn-back-credits')?.addEventListener('click', () => {
        SoundManager.playBlip();
        hideMenu('credits-menu');
    });

    // Main Menu Options - Back button
    document.getElementById('btn-back-mm-options')?.addEventListener('click', () => {
        SoundManager.playBlip();
        hideMenu('main-menu-options');
    });

    // Main Menu Options - CRT toggle
    document.getElementById('mm-toggle-crt')?.addEventListener('click', (e) => {
        const btn = e.target;
        const isOn = btn.dataset.setting === 'on';
        btn.dataset.setting = isOn ? 'off' : 'on';
        btn.textContent = isOn ? 'OFF' : 'ON';
        btn.classList.toggle('bg-green-600', !isOn);
        btn.classList.toggle('bg-red-600', isOn);
        document.body.classList.toggle('crt-active', !isOn);
        // Sync with in-game toggle
        const inGameBtn = document.getElementById('toggle-crt');
        if (inGameBtn) {
            inGameBtn.dataset.setting = btn.dataset.setting;
            inGameBtn.textContent = btn.textContent;
            inGameBtn.className = btn.className;
        }
        SoundManager.playBlip();
    });

    // Main Menu Options - Sound toggle
    document.getElementById('mm-toggle-sound')?.addEventListener('click', (e) => {
        const btn = e.target;
        const isOn = btn.dataset.setting === 'on';
        btn.dataset.setting = isOn ? 'off' : 'on';
        btn.textContent = isOn ? 'OFF' : 'ON';
        btn.classList.toggle('bg-green-600', !isOn);
        btn.classList.toggle('bg-red-600', isOn);
        SoundManager.setMuted(isOn);
        // Sync with in-game toggle
        const inGameBtn = document.getElementById('toggle-sound');
        if (inGameBtn) {
            inGameBtn.dataset.setting = btn.dataset.setting;
            inGameBtn.textContent = btn.textContent;
            inGameBtn.className = btn.className;
        }
        if (!isOn) SoundManager.playBlip();
    });

    // Main Menu Options - Volume sliders
    document.getElementById('mm-volume-master')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('mm-volume-master-val').textContent = val + '%';
        document.getElementById('volume-master').value = val;
        document.getElementById('volume-master-val').textContent = val + '%';
        SoundManager.setMasterVolume(val / 100);
    });

    document.getElementById('mm-volume-music')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('mm-volume-music-val').textContent = val + '%';
        document.getElementById('volume-music').value = val;
        document.getElementById('volume-music-val').textContent = val + '%';
        SoundManager.setMusicVolume(val / 100);
    });

    document.getElementById('mm-volume-fx')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('mm-volume-fx-val').textContent = val + '%';
        document.getElementById('volume-fx').value = val;
        document.getElementById('volume-fx-val').textContent = val + '%';
        SoundManager.setFxVolume(val / 100);
    });

    // Start main game loop
    animate();

    console.log('SYNTHEYE v1.1 - Modular Edition loaded successfully!');
    console.log('Folder structure:');
    console.log('  /js - JavaScript modules');
    console.log('  /assets/models/characters - Character GLB files');
    console.log('  /assets/models/props - Prop GLB files');
    console.log('  /assets/animations - Animation files');

    // =================================================================================
    // HAND TRACKING INITIALIZATION - ONLY FOR TESTING MODE
    // =================================================================================
    // NOTE: Hand tracking is now initialized via initHandTracking() when entering
    // testing difficulty in startOverworld(). This keeps the test systems separate
    // from the main game.
    // =================================================================================
};

// =================================================================================
// HAND TRACKING INIT FUNCTION (called only when entering ROOM_TESTRANGE)
// =================================================================================
// PHASE 2 FIX: MediaPipe callback now ONLY updates HAND_STATE.
// All physics/levitation/camera updates happen in RAF loop for sync'd timing.
// =================================================================================
function initHandTracking() {
    console.log('Initializing Hand Tracking Systems for Test Range...');

    import('./hand-tracking/HandTracker.js').then(({ HandTracker }) => {
        import('./hand-tracking/GestureRecognizer.js').then(({ GestureRecognizer, GESTURE }) => {
            import('./mechanics/SimplePhysics.js').then(({ SimplePhysics }) => {
                import('./mechanics/LevitationSystem.js').then(({ LevitationSystem }) => {
                    import('./mechanics/CameraControl.js').then(({ CameraControl }) => {
                        import('./mechanics/WindSystem.js').then(({ WindSystem }) => {
                            import('./mechanics/BasketballHoop.js').then(({ BasketballHoop }) => {

                                // Setup Systems
                                const handTracker = new HandTracker();
                                const gestureRecognizer = new GestureRecognizer();

                                // Wait for window.levitationCube to be ready (from three-init)
                                if (window.levitationCube) {
                                    const physics = new SimplePhysics(window.levitationCube);
                                    const levitationSystem = new LevitationSystem(scene, camera, window.levitationCube, physics);
                                    const cameraControl = new CameraControl(camera);
                                    const windSystem = new WindSystem(scene, camera, window.levitationCube, physics);
                                    const basketballHoop = new BasketballHoop(scene);

                                    // PHASE 2 FIX: Store all systems globally for RAF loop access
                                    window.handTrackingSystems = {
                                        handTracker,
                                        gestureRecognizer,
                                        physics,
                                        levitationSystem,
                                        cameraControl,
                                        windSystem,
                                        basketballHoop,
                                        GESTURE
                                    };

                                    // Expose to window for debug reset buttons and cleanup
                                    window.gameCamera = camera;
                                    window.targetCube = window.levitationCube;
                                    window.gamePhysics = physics;
                                    window.basketballHoop = basketballHoop;
                                    window.handTracker = handTracker;

                                    // Wire up scene for debug tracer
                                    physics.scene = scene;

                                    // === MODE TOGGLE ===
                                    let currentMode = 'A';
                                    const modeTextEl = document.getElementById('mode-text');
                                    const modeIndicatorEl = document.getElementById('mode-indicator');

                                    document.addEventListener('keydown', (e) => {
                                        if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                                            currentMode = currentMode === 'A' ? 'B' : 'A';
                                            if (modeTextEl) {
                                                if (currentMode === 'A') {
                                                    modeTextEl.textContent = 'MODE A: LEVITATE';
                                                    modeIndicatorEl.style.borderColor = '#00ffff';
                                                    modeTextEl.style.color = '#00ffff';
                                                } else {
                                                    modeTextEl.textContent = 'MODE B: WIND';
                                                    modeIndicatorEl.style.borderColor = '#ff00ff';
                                                    modeTextEl.style.color = '#ff00ff';
                                                }
                                            }
                                        }
                                    });

                                    window.getControlMode = () => currentMode;

                                    // =====================================================
                                    // PHASE 2 FIX: MediaPipe callback ONLY updates state
                                    // No physics, levitation, or camera updates here!
                                    // =====================================================
                                    handTracker.init((results) => {
                                        const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

                                        if (hasHand) {
                                            const landmarks = results.multiHandLandmarks[0];
                                            const gesture = gestureRecognizer.recognize(landmarks);
                                            const gestureName = Object.keys(GESTURE).find(key => GESTURE[key] === gesture) || 'UNKNOWN';

                                            // Update shared state (RAF loop reads this)
                                            window.HAND_STATE.hasHand = true;
                                            window.HAND_STATE.landmarks = landmarks;
                                            window.HAND_STATE.gesture = gestureName;
                                            window.HAND_STATE.gestureEnum = gesture;
                                            window.HAND_STATE.timestamp = performance.now();

                                            handTracker.setGesture(gestureName);
                                        } else {
                                            // No hand detected
                                            window.HAND_STATE.hasHand = false;
                                            window.HAND_STATE.landmarks = null;
                                            window.HAND_STATE.gesture = 'NONE';
                                            window.HAND_STATE.gestureEnum = GESTURE.NONE;

                                            handTracker.setGesture('NONE');
                                        }

                                        // NOTE: All processing now happens in RAF loop!
                                    });

                                    // Dev toggle for debug view
                                    window.addEventListener('keydown', (e) => {
                                        if (e.key === 'h') {
                                            const isHidden = handTracker.canvasElement.style.display === 'none';
                                            handTracker.toggleDebug(isHidden);
                                        }

                                        // Reset cube and level with 'R' key
                                        if (e.key === 'r' || e.key === 'R') {
                                            window.levitationCube.position.set(0, 2, -8);
                                            window.levitationCube.material.color.setHex(0x0000FF);
                                            physics.resetVelocity();
                                            physics.setEnabled(true);
                                        }
                                    });

                                    // Reset button click handler
                                    document.getElementById('reset-btn')?.addEventListener('click', () => {
                                        window.levitationCube.position.set(0, 2, -8);
                                        window.levitationCube.material.color.setHex(0x0000FF);
                                        physics.resetVelocity();
                                        physics.setEnabled(true);
                                    });

                                    console.log("Hand Tracking Systems Integrated (Phase 2 architecture).");
                                } else {
                                    console.error("Levitation Cube not found in scene!");
                                }
                            });
                        });
                    });
                });
            });
        });
    });
}

