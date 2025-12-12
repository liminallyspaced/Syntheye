// =================================================================================
// --- INSPECTION.JS - 360° Object Inspection View ---
// =================================================================================
// The 360° object viewer with OrbitControls, resize handling, start/stop inspection.
// =================================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STATE } from './config.js';

// =================================================================================
// INSPECTION VIEW STATE
// =================================================================================
let inspectionRenderer = null;
let inspectionScene = null;
let inspectionCamera = null;
let inspectionControls = null;
let inspectionObject = null;
let inspectionMixer = null;
let inspectionClock = new THREE.Clock();

// =================================================================================
// SETUP INSPECTION VIEW
// =================================================================================
// Call once at startup to initialize the inspection renderer and scene
// =================================================================================
export function setupInspectionView() {
    inspectionRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    inspectionRenderer.setPixelRatio(window.devicePixelRatio / 2);
    inspectionScene = new THREE.Scene();
    inspectionCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    inspectionCamera.position.z = 5;

    inspectionScene.add(new THREE.AmbientLight(0xFFFFFF, 0.5));
    const pointLight = new THREE.PointLight(0xFFFFFF, 2);
    pointLight.position.set(5, 5, 5);
    inspectionScene.add(pointLight);

    const container = document.getElementById('inspection-view-container');
    container.appendChild(inspectionRenderer.domElement);

    inspectionControls = new OrbitControls(inspectionCamera, inspectionRenderer.domElement);
    inspectionControls.enableDamping = true;
    inspectionControls.minDistance = 2;
    inspectionControls.maxDistance = 6;
    inspectionControls.screenSpacePanning = false;

    function resizeInspection() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        inspectionCamera.aspect = width / height;
        inspectionCamera.updateProjectionMatrix();
        inspectionRenderer.setSize(width, height);
    }
    resizeInspection();
    container.resizeHandler = resizeInspection;
    window.addEventListener('resize', resizeInspection, false);
}

// =================================================================================
// START INSPECTION VIEW
// =================================================================================
// Load and display an object for 360° viewing
// @param contentId - Content ID to determine which object to show
// 
// To add new inspectable objects:
// 1. Add a case for your content_id
// 2. Either create geometry programmatically OR
// 3. Load a GLB from /assets/models/props/
// =================================================================================
export function startInspectionView(contentId) {
    const container = document.getElementById('inspection-view-container');
    if (container.resizeHandler) container.resizeHandler();

    if (inspectionObject) {
        inspectionScene.remove(inspectionObject);
        inspectionObject = null;
    }

    if (inspectionMixer) {
        inspectionMixer = null;
    }

    const loader = new GLTFLoader();

    // =================================================================================
    // PROP LOADING:
    // To add custom 3D props for inspection:
    // 1. Place GLB file in /assets/models/props/
    // 2. Add new case below mapping content_id to the file path
    // 3. The model will automatically be centered and scaled
    // =================================================================================

    // Map content IDs to prop paths
    const propPaths = {
        'gallery_model1': './assets/models/props/watcher.glb',
        'clue_clock': './assets/models/props/clock.glb',
        'clue_painting': './assets/models/props/painting.glb',
        // Add more mappings here as you create props
    };

    if (propPaths[contentId]) {
        // Try to load custom model
        loader.load(
            propPaths[contentId],
            (gltf) => {
                inspectionObject = gltf.scene;

                // Auto-center and scale the model
                const box = new THREE.Box3().setFromObject(inspectionObject);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;

                inspectionObject.scale.setScalar(scale);
                inspectionObject.position.sub(center.multiplyScalar(scale));

                // Setup animations if present
                if (gltf.animations && gltf.animations.length > 0) {
                    inspectionMixer = new THREE.AnimationMixer(inspectionObject);
                    gltf.animations.forEach(clip => {
                        inspectionMixer.clipAction(clip).play();
                    });
                }

                inspectionScene.add(inspectionObject);
            },
            undefined,
            (error) => {
                // Fallback to placeholder if model not found
                createPlaceholderObject(contentId);
            }
        );
    } else {
        // No custom model defined, use placeholder
        createPlaceholderObject(contentId);
    }

    inspectionCamera.position.z = 3;
    inspectionControls.update();

    // Start animation loop
    animateInspection();
}

// =================================================================================
// CREATE PLACEHOLDER OBJECT
// =================================================================================
function createPlaceholderObject(contentId) {
    let geo, mat;

    if (contentId === 'gallery_model1') {
        geo = new THREE.DodecahedronGeometry(1);
        mat = new THREE.MeshBasicMaterial({ color: 0x00FF00, wireframe: true });
    } else if (contentId === 'clue_clock') {
        // Clock placeholder - cylinder with details
        geo = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 32);
        mat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    } else if (contentId === 'clue_painting') {
        // Painting placeholder - flat box
        geo = new THREE.BoxGeometry(1.5, 1, 0.1);
        mat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
    } else {
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        mat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
    }

    inspectionObject = new THREE.Mesh(geo, mat);
    inspectionScene.add(inspectionObject);
}

// =================================================================================
// STOP INSPECTION VIEW
// =================================================================================
export function stopInspectionView() {
    if (inspectionObject) {
        inspectionScene.remove(inspectionObject);
        inspectionObject = null;
    }
    inspectionMixer = null;
}

// =================================================================================
// INSPECTION ANIMATION LOOP
// =================================================================================
export function animateInspection() {
    if (STATE.interaction_mode === 'POPUP_INSPECT') {
        requestAnimationFrame(animateInspection);

        // Update animation mixer if present
        if (inspectionMixer) {
            const delta = inspectionClock.getDelta();
            inspectionMixer.update(delta);
        }

        inspectionControls.update();
        if (inspectionRenderer && inspectionScene && inspectionCamera) {
            inspectionRenderer.render(inspectionScene, inspectionCamera);
        }
    }
}
