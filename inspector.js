import { DOM, THREE_GLOBALS, STATE } from './constants.js';
import { setScreen } from './utils.js';

// --- Initialization and Setup for Model Inspector ---
export function openModelInspector(modelUrl, title) {
    DOM.body.classList.add('overflow-hidden');
    DOM.body.querySelector('#inspector-title').textContent = `3D MODEL INSPECTION: ${title}`;
    DOM.body.querySelector('#inspector-loading').classList.remove('hidden');
    
    setScreen('model-inspector-ui');
    
    // If the inspector is already running, clean up before loading new model
    if (THREE_GLOBALS.inspector.animateId) {
        cleanupInspector();
    }

    // Wait until the container is visible to get correct dimensions
    setTimeout(() => initInspectorScene(modelUrl), 50); 
}

function initInspectorScene(modelUrl) {
    const container = DOM.body.querySelector('#model-viewer-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0c); // Dark inspection background
    THREE_GLOBALS.inspector.scene = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 3);
    camera.lookAt(0, 0, 0);
    THREE_GLOBALS.inspector.camera = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Append renderer to the container, removing any previous canvas
    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) {
        container.removeChild(existingCanvas);
    }
    container.appendChild(renderer.domElement);
    THREE_GLOBALS.inspector.renderer = renderer;

    // 4. Lighting
    scene.add(new THREE.AmbientLight(0x404040, 5)); // Soft ambient light
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0x00aaff, 1.0);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    // 5. Load the Model
    const loader = new THREE.GLTFLoader();
    loader.load(
        modelUrl,
        (gltf) => {
            const model = gltf.scene;
            
            // Center the model and adjust scale (simple bounding box method)
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            model.position.sub(center); // Center the model
            
            // Adjust camera distance based on model size
            const maxDim = Math.max(size.x, size.y, size.z);
            const fitFactor = 3.5; 
            camera.position.z = maxDim * fitFactor;
            camera.far = maxDim * fitFactor * 2;
            camera.updateProjectionMatrix();

            scene.add(model);
            THREE_GLOBALS.inspector.mesh = model;
            DOM.body.querySelector('#inspector-loading').classList.add('hidden');
            
            // Attach mouse events for rotation
            setupInspectorControls(renderer.domElement);
            // Start the loop
            animateInspector();
        },
        // Progress (optional)
        () => {},
        // Error
        (error) => {
            console.error('Error loading model for inspector:', error);
            DOM.body.querySelector('#inspector-loading').textContent = 'ERROR LOADING MODEL';
        }
    );

    // Handle Resize
    window.addEventListener('resize', onInspectorResize, false);
}

function setupInspectorControls(canvas) {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
}

// Simple rotation logic for the inspector model
function onMouseDown(event) {
    THREE_GLOBALS.inspector.isDragging = true;
    THREE_GLOBALS.inspector.previousMousePosition.x = event.clientX;
    THREE_GLOBALS.inspector.previousMousePosition.y = event.clientY;
}

function onMouseUp() {
    THREE_GLOBALS.inspector.isDragging = false;
}

function onMouseMove(event) {
    if (!THREE_GLOBALS.inspector.isDragging || !THREE_GLOBALS.inspector.mesh) return;

    const deltaX = event.clientX - THREE_GLOBALS.inspector.previousMousePosition.x;
    const deltaY = event.clientY - THREE_GLOBALS.inspector.previousMousePosition.y;

    // Apply horizontal rotation (Yaw)
    THREE_GLOBALS.inspector.mesh.rotation.y += deltaX * 0.01;
    
    // Apply vertical rotation (Pitch) - clamped for stability
    const newX = THREE_GLOBALS.inspector.mesh.rotation.x + deltaY * 0.01;
    THREE_GLOBALS.inspector.mesh.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newX));

    THREE_GLOBALS.inspector.previousMousePosition.x = event.clientX;
    THREE_GLOBALS.inspector.previousMousePosition.y = event.clientY;
}

// Touch controls mimic mouse controls
function onTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault(); 
        onMouseDown({ clientX: event.touches[0].clientX, clientY: event.touches[0].clientY });
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault(); 
        onMouseMove({ clientX: event.touches[0].clientX, clientY: event.touches[0].clientY });
    }
}

function onTouchEnd() {
    onMouseUp();
}


function onInspectorResize() {
    const container = DOM.body.querySelector('#model-viewer-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (THREE_GLOBALS.inspector.camera && THREE_GLOBALS.inspector.renderer) {
        THREE_GLOBALS.inspector.camera.aspect = width / height;
        THREE_GLOBALS.inspector.camera.updateProjectionMatrix();
        THREE_GLOBALS.inspector.renderer.setSize(width, height);
    }
}

function animateInspector() {
    if (STATE.screen !== 'model-inspector-ui') {
        // Stop the loop if not in the inspector screen
        return;
    }
    
    THREE_GLOBALS.inspector.animateId = requestAnimationFrame(animateInspector);
    
    if (THREE_GLOBALS.inspector.renderer && THREE_GLOBALS.inspector.scene && THREE_GLOBALS.inspector.camera) {
        THREE_GLOBALS.inspector.renderer.render(THREE_GLOBALS.inspector.scene, THREE_GLOBALS.inspector.camera);
    }
}

// --- Cleanup ---
export function closeModelInspector() {
    cleanupInspector();
    setScreen(STATE.currentScreenBeforePopup === 'overworld' ? 'overworld' : 'archive-menu');
}

function cleanupInspector() {
    cancelAnimationFrame(THREE_GLOBALS.inspector.animateId);
    
    const canvas = DOM.body.querySelector('#model-viewer-container canvas');
    if (canvas) {
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseup', onMouseUp);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.remove();
    }
    
    // Clear all inspector state
    THREE_GLOBALS.inspector.animateId = null;
    THREE_GLOBALS.inspector.mesh = null;
    THREE_GLOBALS.inspector.scene = null;
    THREE_GLOBALS.inspector.camera = null;
    THREE_GLOBALS.inspector.renderer = null;

    window.removeEventListener('resize', onInspectorResize, false);
}