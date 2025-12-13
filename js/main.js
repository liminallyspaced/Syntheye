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
import { debugManager } from './debug/DebugManager.js';
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

        // Create test level elements (LevitationBall, etc.)
        createTestLevelElements();

        // Show test level UI (mode indicator and reset buttons)
        if (window.showTestLevelUI) {
            window.showTestLevelUI();
        }

        // Initialize hand tracking systems for test level only
        initHandTracking();
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

function animate() {
    requestAnimationFrame(animate);
    gameTime += 0.016; // ~60fps

    try {
        if (STATE.interaction_mode === 'OVERWORLD') {
            updatePlayerMovement();
            checkHotspots();

            // Show crosshair in Test Range
            const crosshair = document.getElementById('crosshair');
            if (crosshair) {
                crosshair.classList.toggle('hidden', STATE.current_room !== 'ROOM_TESTRANGE');
            }
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
    // DEBUG: Log current screen/mode on keypress
    console.log(`KEY: "${event.key}" | screen="${STATE.screen}" mode="${STATE.interaction_mode}"`);

    // Debug menu toggle (works in any mode)
    if (handleDebugKeydown(event)) return;

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

    // Initialize debug menu (camera debug)
    initDebugMenu();

    // Initialize unified debug system (single * key controls all)
    debugManager.init();
    window.debugManager = debugManager;

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

    // How-to-play menu X close button
    document.getElementById('btn-close-howto')?.addEventListener('click', () => {
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
function initHandTracking() {
    console.log('Initializing Hand Tracking Systems for Test Range...');

    import('./hand-tracking/HandTracker.js').then(({ HandTracker }) => {
        import('./hand-tracking/GestureRecognizer.js').then(({ GestureRecognizer, GESTURE }) => {
            import('./mechanics/SimplePhysics.js').then(({ SimplePhysics }) => {
                import('./mechanics/LevitationSystem.js').then(({ LevitationSystem }) => {
                    import('./mechanics/CameraControl.js').then(({ CameraControl }) => {
                        import('./mechanics/WindSystem.js').then(({ WindSystem }) => {
                            import('./mechanics/BasketballHoop.js').then(({ BasketballHoop }) => {
                                import('./mechanics/AimAssist.js').then(({ AimAssist }) => {

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

                                        // Centralized Aim Assist - POST-PROCESSING ONLY
                                        const aimAssist = new AimAssist({
                                            acquireRadius: 1.0,
                                            releaseRadius: 1.5,
                                            maxLockMs: 2000,
                                            maxStrength: 0.15
                                        });

                                        // Expose to window for debug reset buttons and cleanup
                                        window.gameCamera = camera;
                                        window.targetCube = window.levitationCube;
                                        window.gamePhysics = physics;
                                        window.basketballHoop = basketballHoop;
                                        window.handTracker = handTracker;
                                        window.aimAssist = aimAssist; // For debug panel

                                        // Wire up scene for debug tracer
                                        physics.scene = scene;

                                        // === POWER MODE ===
                                        // 'A' = Levitate (active on load)
                                        // 'B' = Wind (swipe to push, object floats then falls)
                                        // 'NONE' = No power active
                                        let currentMode = 'A'; // Start with Levitate active
                                        const modeTextEl = document.getElementById('mode-text');
                                        const modeIndicatorEl = document.getElementById('mode-indicator');
                                        const powerWheelEl = document.getElementById('power-wheel');

                                        // Track gesture transitions (declared before setActivePower uses them)
                                        let previousGesture = GESTURE.NONE;
                                        let transitionCooldownFrames = 0;

                                        // === ATOMIC POWER TRANSITION FUNCTION ===
                                        function setActivePower(newMode) {
                                            const oldMode = currentMode;
                                            if (newMode === oldMode) return;

                                            currentMode = newMode;

                                            // 1. Reset aim assist lock (runtime only)
                                            aimAssist.resetLock();

                                            // 2. Clear gesture cooldowns
                                            transitionCooldownFrames = 0;
                                            previousGesture = GESTURE.NONE;

                                            // 3. Update UI
                                            if (modeTextEl) {
                                                if (currentMode === 'A') {
                                                    modeTextEl.textContent = 'MODE A: LEVITATE';
                                                    modeIndicatorEl.style.borderColor = '#00ffff';
                                                    modeTextEl.style.color = '#00ffff';
                                                } else if (currentMode === 'B') {
                                                    modeTextEl.textContent = 'MODE B: WIND';
                                                    modeIndicatorEl.style.borderColor = '#ff00ff';
                                                    modeTextEl.style.color = '#ff00ff';
                                                } else {
                                                    modeTextEl.textContent = 'MODE X: NONE';
                                                    modeIndicatorEl.style.borderColor = '#888888';
                                                    modeTextEl.style.color = '#888888';
                                                }
                                            }

                                            // 4. Update wheel selection highlight
                                            document.querySelectorAll('.wheel-option').forEach(el => {
                                                el.classList.toggle('selected', el.dataset.power === currentMode);
                                            });

                                            console.log(`Power: ${oldMode} → ${currentMode}`);
                                        }

                                        // === POWER WHEEL - Hold Q to show ===
                                        let wheelVisible = false;

                                        document.addEventListener('keydown', (e) => {
                                            if (e.code === 'KeyQ' && !wheelVisible) {
                                                wheelVisible = true;
                                                if (powerWheelEl) {
                                                    powerWheelEl.style.display = 'block';
                                                    // Highlight current selection
                                                    document.querySelectorAll('.wheel-option').forEach(el => {
                                                        el.classList.toggle('selected', el.dataset.power === currentMode);
                                                    });
                                                }
                                            }
                                        });

                                        document.addEventListener('keyup', (e) => {
                                            if (e.code === 'KeyQ') {
                                                wheelVisible = false;
                                                if (powerWheelEl) {
                                                    powerWheelEl.style.display = 'none';
                                                }
                                            }
                                        });

                                        // Wheel option click handlers
                                        document.querySelectorAll('.wheel-option').forEach(el => {
                                            el.addEventListener('click', () => {
                                                const power = el.dataset.power;
                                                if (power) {
                                                    setActivePower(power);
                                                }
                                            });
                                        });

                                        // Expose mode globally for other systems
                                        window.getControlMode = () => currentMode;
                                        window.setActivePower = setActivePower;

                                        // Track hand velocity for fast movement detection
                                        let lastHandY = 0;
                                        let handVelocityY = 0;
                                        const VELOCITY_THRESHOLD = 0.02; // If hand moves faster than this, block camera

                                        // Start Hand Tracker
                                        handTracker.init((results) => {
                                            // 1. Recognize Gesture
                                            let gesture = GESTURE.NONE;
                                            let gestureName = 'NONE';
                                            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                                                gesture = gestureRecognizer.recognize(results.multiHandLandmarks[0]);
                                                gestureName = Object.keys(GESTURE).find(key => GESTURE[key] === gesture) || 'UNKNOWN';
                                            }
                                            handTracker.setGesture(gestureName);

                                            const landmarks = results.multiHandLandmarks ? results.multiHandLandmarks[0] : null;

                                            // === HAND VELOCITY TRACKING ===
                                            let handMovingFast = false;
                                            if (landmarks) {
                                                const currentHandY = landmarks[8].y; // Index tip Y
                                                handVelocityY = Math.abs(currentHandY - lastHandY);
                                                handMovingFast = handVelocityY > VELOCITY_THRESHOLD;
                                                lastHandY = currentHandY;
                                            }

                                            // === GESTURE TRANSITION DETECTION ===
                                            const justChangedGesture = gesture !== previousGesture;

                                            // Add short cooldown only for specific transitions that need it
                                            // Don't block camera when switching from PINCH to OPEN_HAND (that's grab→control)
                                            if (justChangedGesture && handMovingFast && gesture !== GESTURE.OPEN_HAND) {
                                                transitionCooldownFrames = Math.max(transitionCooldownFrames, 3);
                                                cameraControl.blockFor(200);
                                            }

                                            // Decrement cooldown
                                            if (transitionCooldownFrames > 0) {
                                                transitionCooldownFrames--;
                                            }

                                            // 2. Update Physics
                                            physics.update(0.016);

                                            // 2.5 Update Basketball Hoop score detection
                                            basketballHoop.update(window.levitationCube);

                                            // 3. Update interaction system based on current mode
                                            if (currentMode === 'A') {
                                                // Mode A: Levitation (grab/hold/throw)
                                                levitationSystem.update(gesture, landmarks, gestureRecognizer);
                                            } else if (currentMode === 'B') {
                                                // Mode B: Wind (swipe to push, float, fall)
                                                windSystem.update(gesture, landmarks, gestureRecognizer);
                                            }
                                            // Mode NONE: No power active, skip both systems

                                            // 4. Update Camera - both PINCH and OPEN_HAND control camera
                                            // Skip if in NONE mode (no hand tracking active)
                                            if (currentMode !== 'NONE') {
                                                const isCameraGesture = gesture === GESTURE.OPEN_HAND || gesture === GESTURE.PINCH;

                                                const shouldUpdateCamera =
                                                    transitionCooldownFrames === 0 &&
                                                    isCameraGesture &&
                                                    !justChangedGesture;

                                                if (shouldUpdateCamera) {
                                                    const isHandControllingCamera = cameraControl.update(gesture, landmarks);
                                                    window.HAND_CAMERA_CONTROL_ACTIVE = isHandControllingCamera;
                                                } else {
                                                    // Only block camera during THREE_FINGER (object grab gesture)
                                                    if (currentMode === 'A' && gesture === GESTURE.THREE_FINGER) {
                                                        cameraControl.blockFor(200);
                                                    }
                                                    window.HAND_CAMERA_CONTROL_ACTIVE = false;
                                                }
                                            }

                                            // Update previous gesture for next frame
                                            previousGesture = gesture;
                                        });

                                        // Dev toggle for debug view
                                        window.addEventListener('keydown', (e) => {
                                            if (e.key === 'h') {
                                                const isHidden = handTracker.canvasElement.style.display === 'none';
                                                handTracker.toggleDebug(isHidden);
                                                console.log("Hand Tracking Debug:", isHidden ? "ON" : "OFF");
                                            }

                                            // R key reset removed - now using button in UI
                                        });

                                        console.log("Hand Tracking Systems Integrated.");
                                    } else {
                                        console.error("Levitation Cube not found in scene!");
                                    }
                                });
                            }); // Close AimAssist import
                        }); // Close BasketballHoop import
                    });
                });
            });
        });
    }); // Close HandTracker import
}
