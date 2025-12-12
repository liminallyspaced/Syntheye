// =================================================================================
// --- THREE-INIT.JS - THREE.js Scene Initialization ---
// =================================================================================
// Handles initializing THREE.js, loading the renderer, camera, scene, lights.
// Also responsible for loading the character GLTF and the placeholder box.
// =================================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STATE } from './config.js';
// NOTE: Flashlight is now self-managed in flashlight.js, no import needed here

// =================================================================================
// EXPORTED SCENE OBJECTS
// =================================================================================
export let renderer = null;
export let scene = null;
export let camera = null;
export let playerMesh = null;
export let targetMarkerMesh = null;
export let raycaster = null;

// Animation support
export let mixer = null;
export let animations = {};
export let clock = new THREE.Clock();

// Head bone for flashlight attachment
export let headBone = null;

// =================================================================================
// INITIALIZE THREE.JS
// =================================================================================
export function initThree() {
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio / 2);

    // Enable shadow mapping for cinematic lighting
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6; // Darker exposure for horror

    document.getElementById('three-container').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); // Very dark background

    // Dense fog for horror atmosphere
    scene.fog = new THREE.FogExp2(0x0a0808, 0.02);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    // Set default camera position (will be overridden by zone system)
    camera.position.set(8, 6, 10);
    camera.rotation.order = 'YXZ';  // CRITICAL: same rotation order as debug free cam uses
    camera.lookAt(0, 1, 0);

    raycaster = new THREE.Raycaster();

    // =================================================================================
    // LIGHTING SETUP - INCREASED FOR DEBUGGING
    // =================================================================================

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x444466, 1.5);
    scene.add(ambientLight);

    // Moonlight for shadows and atmosphere
    const moonLight = new THREE.DirectionalLight(0xaabbdd, 1.0);
    moonLight.position.set(-5, 15, -5);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 50;
    moonLight.shadow.camera.left = -20;
    moonLight.shadow.camera.right = 20;
    moonLight.shadow.camera.top = 20;
    moonLight.shadow.camera.bottom = -20;
    scene.add(moonLight);

    // NOTE: Eye-flashlight (cone light) is added in flashlight.js
    // It is the PRIMARY light source for the player

    // --- PLAYER CHARACTER (PLACEHOLDER & GLB LOADER) ---

    // 1. Create Placeholder (invisible by default, only shows if GLB fails)
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshLambertMaterial({
        color: 0xFF0000,
        transparent: true,
        opacity: 0  // Invisible placeholder - GLB will replace this
    });
    playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    playerMesh.position.y = 0.05;
    playerMesh.castShadow = true;
    playerMesh.receiveShadow = true;
    scene.add(playerMesh);

    // 2. Load Custom GLB Character
    // =================================================================================
    // CHARACTER LOADING:
    // Place your character GLB files in: /assets/models/characters/
    // The loader will attempt to load from the root first (./character.glb for backward compat)
    // Then try the assets folder.
    // 
    // ANIMATION SUPPORT:
    // If your GLB contains animations, they will be extracted and stored in the 
    // 'animations' object. Access them by name: animations['Idle'].play()
    // Available animation names will be logged to console.
    // =================================================================================
    const loader = new GLTFLoader();

    // Try loading character from root (existing location)
    loader.load('./character.glb',
        function (gltf) {
            loadCharacterModel(gltf);
        },
        undefined,
        function (error) {
            // Try loading from assets folder
            loader.load('./assets/models/characters/player.glb',
                function (gltf) {
                    loadCharacterModel(gltf);
                },
                undefined,
                function (error) {
                    console.log("No custom character found, keeping placeholder box.");
                }
            );
        }
    );

    // Target Marker (Destination Ring)
    const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.8 });
    targetMarkerMesh = new THREE.Mesh(ringGeo, ringMat);
    targetMarkerMesh.rotation.x = -Math.PI / 2;
    targetMarkerMesh.visible = false;
    scene.add(targetMarkerMesh);

    // =================================================================================
    // LEVITATION TARGET CUBE (Blue Cube)
    // =================================================================================
    const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const cubeMat = new THREE.MeshStandardMaterial({ color: 0x0000FF }); // Blue
    const levitationCube = new THREE.Mesh(cubeGeo, cubeMat);
    // Default position (will be moved by main.js if in testing mode)
    levitationCube.position.set(0, 2, -8); // On target platform in test range
    levitationCube.castShadow = true;
    levitationCube.receiveShadow = true;
    levitationCube.name = "LevitationCube"; // Tag it
    scene.add(levitationCube);
    window.levitationCube = levitationCube; // Expose globally for main.js to access

    // Lighting
    scene.add(new THREE.AmbientLight(0x404040, 3));
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 2);
    directionalLight.position.set(20, 30, 10);
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);
}

// =================================================================================
// CHARACTER MODEL LOADER
// =================================================================================
function loadCharacterModel(gltf) {
    const model = gltf.scene;

    // Adjust scale if your model is too big/small
    // Tweak this value as needed (0.5 = half size, 0.25 = quarter size, etc.)
    const characterScale = 1.0;
    model.scale.set(characterScale, characterScale, characterScale);

    // Sync position with current placeholder
    model.position.copy(playerMesh.position);
    model.rotation.copy(playerMesh.rotation);

    // Enable shadows on all meshes in the character
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Find the head bone (kept for potential future use)
    model.traverse((child) => {
        if (child.name === 'mixamorig:Head' || child.name === 'Head') {
            headBone = child;
            console.log('Found head bone:', child.name);
            // NOTE: Flashlight is no longer attached to head bone
            // It follows the player via updateFlashlight() in flashlight.js
        }
    });

    // Remove placeholder and add new model
    scene.remove(playerMesh);
    scene.add(model);
    playerMesh = model; // Update global reference so movement controls work

    // Setup animation mixer
    mixer = new THREE.AnimationMixer(model);

    // Load animations from character GLB
    if (gltf.animations && gltf.animations.length > 0) {
        console.log(`Character has ${gltf.animations.length} embedded animations`);

        gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            animations[clip.name] = action;
            console.log(`Animation loaded: "${clip.name}"`);

            // Create common aliases for the specific action names
            const lowerName = clip.name.toLowerCase();

            // Map idle_breathing to Idle alias
            if (lowerName.includes('idle') || lowerName.includes('breathing')) {
                animations['Idle'] = action;
                animations['idle'] = action;
            }

            // Map walking to Walk alias
            if (lowerName.includes('walk')) {
                animations['Walk'] = action;
                animations['Walking'] = action;
            }

            // Map run if present
            if (lowerName.includes('run')) {
                animations['Run'] = action;
            }

            // Map jump animation
            if (lowerName.includes('jump')) {
                animations['Jump'] = action;
                animations['jump'] = action;
                // Jump should play once, not loop
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            }

            // Map interact animation
            if (lowerName.includes('interact')) {
                animations['Interact'] = action;
                animations['interact'] = action;
                // Interact should play once
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            }
        });

        console.log('Animation aliases:', Object.keys(animations));

        // Start idle animation immediately (looping)
        if (animations['Idle']) {
            animations['Idle'].setLoop(THREE.LoopRepeat);
            animations['Idle'].play();
            currentAnimation = animations['Idle'];
            console.log('Started idle animation');
        }
    }

    console.log("Character loaded successfully!");
}

// =================================================================================
// EXTERNAL ANIMATION LOADER
// =================================================================================
// Loads additional animations from GLB or FBX files in /assets/animations/
// =================================================================================
function loadExternalAnimations() {
    const glbLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();

    // Helper to register animation with aliases
    function registerAnimation(clip, aliases) {
        if (!mixer) return;
        const action = mixer.clipAction(clip);
        animations[clip.name] = action;
        console.log(`External animation loaded: ${clip.name}`);

        aliases.forEach(alias => {
            if (!animations[alias]) {
                animations[alias] = action;
            }
        });
    }

    // Load FBX animations (Mixamo format)
    const fbxFiles = [
        { path: './assets/animations/walking.fbx', names: ['Walking', 'Walk', 'walk'] },
        { path: './assets/animations/idle.fbx', names: ['Idle', 'idle'] },
        { path: './assets/animations/running.fbx', names: ['Running', 'Run', 'run'] }
    ];

    fbxFiles.forEach(animFile => {
        fbxLoader.load(animFile.path,
            function (fbx) {
                if (fbx.animations && fbx.animations.length > 0) {
                    fbx.animations.forEach(clip => {
                        registerAnimation(clip, animFile.names);
                    });
                }
            },
            undefined,
            function (error) {
                // FBX not found, try GLB version
            }
        );
    });

    // Also try loading GLB animations as fallback
    const glbFiles = [
        { path: './assets/animations/walk.glb', names: ['Walking', 'Walk', 'walk'] },
        { path: './assets/animations/walking.glb', names: ['Walking', 'Walk', 'walk'] },
        { path: './walk.glb', names: ['Walking', 'Walk', 'walk'] },
        { path: './assets/animations/idle.glb', names: ['Idle', 'idle'] },
        { path: './assets/animations/running.glb', names: ['Running', 'Run', 'run'] }
    ];

    glbFiles.forEach(animFile => {
        glbLoader.load(animFile.path,
            function (gltf) {
                if (gltf.animations && gltf.animations.length > 0) {
                    gltf.animations.forEach(clip => {
                        registerAnimation(clip, animFile.names);
                    });
                }
            },
            undefined,
            function (error) {
                // Animation file not found - this is okay
            }
        );
    });
}

// =================================================================================
// WINDOW RESIZE HANDLER
// =================================================================================
export function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio / 2);
}

// =================================================================================
// ANIMATION UPDATE (call in main loop)
// =================================================================================
export function updateAnimations() {
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }
}

// =================================================================================
// LIGHTING UPDATE (call in main loop for flickering effect)
// =================================================================================
let flickerTime = 0;

export function updateLighting() {
    if (!window.playerLight || !playerMesh) return;

    // Make light follow player
    window.playerLight.position.x = playerMesh.position.x;
    window.playerLight.position.z = playerMesh.position.z;
    window.playerLight.position.y = playerMesh.position.y + 2.5;

    // Subtle flickering effect (like a candle or old lamp)
    flickerTime += 0.05;
    const flicker = 0.7 + Math.sin(flickerTime * 3.7) * 0.1 +
        Math.sin(flickerTime * 5.3) * 0.05 +
        Math.random() * 0.08;
    window.playerLight.intensity = flicker;
}

// =================================================================================
// ANIMATION CONTROL FUNCTIONS
// =================================================================================
let currentAnimation = null;

export function playAnimation(name, crossFadeDuration = 0.2) {
    if (!mixer) return false;

    // Try different name variations
    const namesToTry = [name, name.toLowerCase(), name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];

    let targetAction = null;
    for (const tryName of namesToTry) {
        if (animations[tryName]) {
            targetAction = animations[tryName];
            break;
        }
    }

    if (!targetAction) return false;

    // If already playing this animation, don't restart
    if (currentAnimation === targetAction && targetAction.isRunning()) {
        return true;
    }

    // Cross-fade from current animation
    if (currentAnimation && currentAnimation.isRunning()) {
        currentAnimation.fadeOut(crossFadeDuration);
    }

    targetAction.reset().fadeIn(crossFadeDuration).play();
    currentAnimation = targetAction;

    return true;
}

export function stopAnimation(name) {
    if (animations[name]) {
        animations[name].fadeOut(0.2);
        animations[name].stop();
    }
}

export function stopAllAnimations() {
    for (const name in animations) {
        animations[name].stop();
    }
    currentAnimation = null;
}

// Track if a one-shot animation is playing (prevents movement)
let isPlayingOnce = false;

// Play a one-shot animation (like jump or interact) then return to previous state
export function playOnceAnimation(name, duration = 0.1) {
    if (!mixer || isPlayingOnce) return false;

    const namesToTry = [name, name.toLowerCase(), name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];
    let targetAction = null;

    for (const tryName of namesToTry) {
        if (animations[tryName]) {
            targetAction = animations[tryName];
            break;
        }
    }

    if (!targetAction) return false;

    isPlayingOnce = true;

    // Fade out current animation
    if (currentAnimation && currentAnimation.isRunning()) {
        currentAnimation.fadeOut(duration);
    }

    // Play the one-shot animation (faster for jump)
    targetAction.reset().fadeIn(duration).play();

    // Listen for when animation finishes
    const onFinished = () => {
        isPlayingOnce = false;
        mixer.removeEventListener('finished', onFinished);
        targetAction.fadeOut(duration);

        // Check if player is still moving - return to Walking if so
        // Import controls from movement.js to check current state
        import('./movement.js').then(movement => {
            const c = movement.controls;
            if (c.w || c.a || c.s || c.d) {
                // Player is moving, return to walking
                if (animations['Walk'] || animations['Walking']) {
                    const walkAnim = animations['Walk'] || animations['Walking'];
                    walkAnim.reset().fadeIn(duration).play();
                    currentAnimation = walkAnim;
                }
            } else {
                // Player is idle, return to idle
                if (animations['Idle']) {
                    animations['Idle'].reset().fadeIn(duration).play();
                    currentAnimation = animations['Idle'];
                }
            }
        }).catch(() => {
            // Fallback to idle if import fails
            if (animations['Idle']) {
                animations['Idle'].reset().fadeIn(duration).play();
                currentAnimation = animations['Idle'];
            }
        });
    };

    mixer.addEventListener('finished', onFinished);
    return true;
}

// Check if a one-shot animation is currently playing
export function isActionAnimationPlaying() {
    return isPlayingOnce;
}
