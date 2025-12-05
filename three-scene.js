import { DOM, THREE_GLOBALS, STATE, MODEL_URL } from './constants.js';
import { setScreen } from './utils.js';

const TRIGGER_DISTANCE_SQUARED = 2.5 * 2.5; // Player must be close to interact
const CAM_OFFSET = new THREE.Vector3(0, 3, 5); // Camera height and distance behind player
const PLAYER_SCALE = 1.0; 

// Mock Trigger Data (Replace with your actual exhibit data)
const MOCK_TRIGGERS = [
    { 
        position: new THREE.Vector3(5, 0, -5), 
        name: "3D Model Exhibit A", 
        callback: () => {
             // Example: Opening a simple popup for the exhibit
             DOM.popupTitle.textContent = "Exhibit A: The Sentinel Project";
             DOM.popupContent.innerHTML = `
                 <p>This is a mock description for the 3D Sentinel Project. The asset features procedural materials and highly optimized geometry for real-time rendering.</p>
                 <p class="mt-4 text-sm text-red-400">In a real application, this could trigger a detailed model viewer or a full-screen video.</p>
             `;
             STATE.currentScreenBeforePopup = 'overworld';
             setScreen('popup-ui');
        } 
    },
    { 
        position: new THREE.Vector3(-5, 0, 5), 
        name: "Video Exhibit B", 
        callback: () => {
             // Example: Opening the main archive video item directly
             const videoItem = PORTFOLIO_DATA.find(c => c.id === 'reel').items[0];
             window.App.openVideoPopup(videoItem.embedUrl, videoItem.title);
        }
    }
];

// --- Initialization ---
export function initScene() {
    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161618); // Dark background for horror aesthetic
    THREE_GLOBALS.scene = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    THREE_GLOBALS.camera = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Append renderer to the overworld UI container, removing any previous canvas
    const container = DOM.overworldUI;
    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) {
        container.removeChild(existingCanvas);
    }
    container.appendChild(renderer.domElement);
    THREE_GLOBALS.renderer = renderer;

    // 4. Lighting (Low-key, dramatic lighting)
    const ambientLight = new THREE.AmbientLight(0x444444); // Dim ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xcccccc, 1.5);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    // Set up shadow properties for the light
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    // 5. Ground Plane (Simple dark floor)
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // 6. Mock Interactable Meshes (Cubes for now)
    MOCK_TRIGGERS.forEach(trigger => {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x8b0000 }); // Dark Red/Maroon
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(trigger.position);
        cube.castShadow = true;
        scene.add(cube);
        trigger.mesh = cube; // Attach the mesh to the trigger data
    });

    // 7. Load Player Model
    loadPlayerModel();

    // 8. Handle Resize
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    if (THREE_GLOBALS.camera && THREE_GLOBALS.renderer) {
        THREE_GLOBALS.camera.aspect = window.innerWidth / window.innerHeight;
        THREE_GLOBALS.camera.updateProjectionMatrix();
        THREE_GLOBALS.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// --- Model Loading ---
function loadPlayerModel() {
    const loader = new THREE.GLTFLoader();
    loader.load(
        MODEL_URL,
        (gltf) => {
            const model = gltf.scene;
            model.scale.set(PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            model.position.set(STATE.player.x, 0, STATE.player.z);
            THREE_GLOBALS.scene.add(model);
            THREE_GLOBALS.playerMesh = model;

            // Setup Animations
            THREE_GLOBALS.mixer = new THREE.AnimationMixer(model);
            
            // Map animation names from the GLB file
            gltf.animations.forEach((clip) => {
                let name = clip.name;
                
                // CRUCIAL: Rename Walking to Walk for consistency if present
                if (name === 'Walking') {
                    name = 'Walk';
                    clip.name = 'Walk'; 
                }
                
                // Store action under its standardized name (Idle, Walk, Running)
                THREE_GLOBALS.actions[name] = THREE_GLOBALS.mixer.clipAction(clip);
            });

            // Ensure the required actions exist
            if (!THREE_GLOBALS.actions['Idle']) { console.warn("Animation 'Idle' not found in model."); }
            if (!THREE_GLOBALS.actions['Walk'] && THREE_GLOBALS.actions['Walking']) { 
                 THREE_GLOBALS.actions['Walk'] = THREE_GLOBALS.actions['Walking'];
            }
            if (!THREE_GLOBALS.actions['Walk'] && !THREE_GLOBALS.actions['Running']) {
                 console.warn("Animations 'Walk' or 'Running' not found. Movement animations will not work.");
            }

            // Play the default action
            if (THREE_GLOBALS.actions['Idle']) {
                THREE_GLOBALS.actions['Idle'].play();
                STATE.currentActionName = 'Idle';
            }

            // Hide loading indicator
            DOM.loadingIndicator.classList.add('hidden');
        },
        // Progress callback
        (xhr) => {
            const percentage = (xhr.loaded / xhr.total) * 100;
            DOM.loadingIndicator.querySelector('p').textContent = `LOADING// ${Math.floor(percentage)}% COMPLETE`;
        },
        // Error callback
        (error) => {
            console.error('Error loading GLTF model:', error);
            DOM.loadingIndicator.querySelector('p').textContent = `ERROR// FAILED TO LOAD ASSETS`;
        }
    );

    // Setup input listeners
    setupInputListeners();
}

// --- Animation/Action Management ---
function fadeToAction(name, duration = 0.2) {
    if (STATE.currentActionName === name) return;

    const previousAction = THREE_GLOBALS.actions[STATE.currentActionName];
    const newAction = THREE_GLOBALS.actions[name];

    if (!newAction) {
        console.warn(`Action "${name}" not found. Skipping animation.`);
        return;
    }

    newAction.enabled = true;
    
    if (previousAction) {
        previousAction.fadeOut(duration);
    }
    
    newAction
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(duration)
        .play();

    STATE.currentActionName = name;
}

// --- Movement and Game Loop ---
function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
            STATE.controls[key] = true;
        }
    });

    document.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
            STATE.controls[key] = false;
        }
    });
}


function updatePlayer(delta) {
    if (!THREE_GLOBALS.playerMesh) return;

    let moving = false;
    let direction = new THREE.Vector3();
    let forward = STATE.controls.w || STATE.controls.arrowup;
    let backward = STATE.controls.s || STATE.controls.arrowdown;
    let left = STATE.controls.a || STATE.controls.arrowleft;
    let right = STATE.controls.d || STATE.controls.arrowright;

    // Calculate direction and rotation
    if (forward || backward || left || right) {
        moving = true;
        
        let angle = Math.atan2(
            (right ? -1 : 0) + (left ? 1 : 0),
            (forward ? 1 : 0) + (backward ? -1 : 0)
        );
        
        // Convert to world space for movement
        direction.set(Math.sin(angle), 0, Math.cos(angle)).normalize();

        // Smooth rotation towards the movement direction
        const targetRotation = angle + Math.PI; // Adjust angle based on camera view
        STATE.player.rotationY = THREE_GLOBALS.playerMesh.rotation.y;
        
        // Simple smoothing for rotation
        THREE_GLOBALS.playerMesh.rotation.y = THREE_GLOBALS.playerMesh.rotation.y + (targetRotation - THREE_GLOBALS.playerMesh.rotation.y) * 0.1;

        // Apply movement
        STATE.player.x += direction.x * STATE.player.speed * delta * 60;
        STATE.player.z += direction.z * STATE.player.speed * delta * 60;
        
        THREE_GLOBALS.playerMesh.position.x = STATE.player.x;
        THREE_GLOBALS.playerMesh.position.z = STATE.player.z;

        // Animation update
        // Prioritize 'Walk' if it exists, otherwise fall back to 'Running' (as per PS1 horror movement style)
        if (THREE_GLOBALS.actions['Walk']) {
            fadeToAction('Walk');
        } else if (THREE_GLOBALS.actions['Running']) {
            fadeToAction('Running');
        } else if (THREE_GLOBALS.actions['Idle']) {
            // Fallback: stay on Idle
            fadeToAction('Idle');
        }
        
    } else if (moving === false) {
        // Animation update: stop moving
        if (STATE.currentActionName !== 'Idle' && THREE_GLOBALS.actions['Idle']) {
            fadeToAction('Idle');
        }
    }

    // Update Camera position
    const camTarget = new THREE.Vector3(STATE.player.x, 0, STATE.player.z);
    
    // Calculate camera target position behind the player
    const cameraYawOffset = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE_GLOBALS.playerMesh.rotation.y + Math.PI);
    cameraYawOffset.multiplyScalar(CAM_OFFSET.z * -1); // Distance behind
    
    const targetCameraPosition = new THREE.Vector3().addVectors(camTarget, cameraYawOffset);
    targetCameraPosition.y = CAM_OFFSET.y;

    // Smooth camera movement
    THREE_GLOBALS.camera.position.lerp(targetCameraPosition, 0.1);
    
    // Make camera look at player
    THREE_GLOBALS.camera.lookAt(THREE_GLOBALS.playerMesh.position.x, THREE_GLOBALS.playerMesh.position.y + 1.5, THREE_GLOBALS.playerMesh.position.z);

    // Check Triggers
    checkTriggers();

    // Update animation mixer
    if (THREE_GLOBALS.mixer) {
        THREE_GLOBALS.mixer.update(delta);
    }
}

function checkTriggers() {
    let closestTrigger = null;
    let minDistanceSq = TRIGGER_DISTANCE_SQUARED;

    const playerPos = THREE_GLOBALS.playerMesh.position;

    MOCK_TRIGGERS.forEach(trigger => {
        const distanceSq = playerPos.distanceToSquared(trigger.position);
        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestTrigger = trigger;
        }
    });

    if (closestTrigger && STATE.screen === 'overworld') {
        // Show prompt
        STATE.activeTrigger = closestTrigger;
        DOM.promptText.textContent = closestTrigger.name;
        DOM.interactionPrompt.classList.remove('hidden');
    } else {
        // Hide prompt
        STATE.activeTrigger = null;
        DOM.interactionPrompt.classList.add('hidden');
    }
}


export function animateScene() {
    if (STATE.screen !== 'overworld' || !THREE_GLOBALS.renderer) {
        // Stop the loop if not in the overworld screen
        return;
    }

    // RequestAnimationFrame returns an ID, which is not strictly needed here 
    // but standard practice for cleanup
    requestAnimationFrame(animateScene); 

    const delta = THREE_GLOBALS.clock.getDelta();

    updatePlayer(delta);

    THREE_GLOBALS.renderer.render(THREE_GLOBALS.scene, THREE_GLOBALS.camera);
}

// Cleans up the scene, stops the animation loop, and removes the canvas
export function cleanupScene() {
    // Note: Since we stop calling requestAnimationFrame in animateScene, 
    // no explicit cancelAnimationFrame is strictly required unless we stored the ID.
    // We mainly ensure the scene doesn't update when paused.
}