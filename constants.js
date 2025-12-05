// --- STATE & GLOBALS ---
export const STATE = {
    screen: 'main-menu', // main-menu, overworld, popup, menu-overlay, archive, model-inspector
    menuIndex: 0,
    isCrtActive: true,
    player: { x: 0, z: 0, speed: 0.08, rotationY: 0 },
    activeTrigger: null, // Stores the trigger object when the player is near one
    controls: { w: false, s: false, a: false, d: false },
};

// --- DOM REFERENCES (Exported for easy access) ---
export const DOM = {
    body: document.body,
    promptText: document.getElementById('prompt-text'),
    interactionPrompt: document.getElementById('interaction-prompt'),
    loadingIndicator: document.getElementById('loading-indicator'),
    archiveContent: document.getElementById('archive-content'),
    archiveNav: document.getElementById('archive-nav'),
    popupTitle: document.getElementById('popup-title'),
    popupContent: document.getElementById('popup-content'),
    overworldUI: document.getElementById('overworld-ui'),
};

// --- THREE.JS GLOBALS (Managed externally but initialized here) ---
export const THREE_GLOBALS = {
    scene: null, 
    camera: null, 
    renderer: null,
    playerMesh: null, // GLTF scene/model
    clock: new THREE.Clock(),
    mixer: null, // Animation mixer
    actions: {}, // Animation actions map
    currentActionName: 'Idle',
    inspector: { // For the separate 3D model inspector
        scene: null, 
        camera: null, 
        renderer: null, 
        mesh: null,
        animateId: null,
        isDragging: false,
        previousMousePosition: { x: 0, y: 0 }
    }
};

// !!! UPDATED: Use the structure below for GitHub Pages direct links !!!
// Replace [YOUR-USERNAME], [REPO-NAME], and [PATH-TO-FILE] with your actual data.
const GITHUB_PAGES_BASE = 'https://[YOUR-USERNAME].github.io/[REPO-NAME]/assets/';

// This is the model used for the main player character in the 3D overworld
export const MODEL_URL = GITHUB_PAGES_BASE + 'models/main-character.glb'; 

// --- PORTFOLIO DATA ---
export const PORTFOLIO_DATA = [
    { 
        category: "REEL", 
        id: "reel",
        description: "A montage of different works made over the years.",
        items: [
            { 
                title: "2024 DEMO REEL", 
                type: "video", 
                embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1", // Placeholder link
                thumbnail: "https://placehold.co/1280x720/161618/d1d1d1?text=2024+DEMO+REEL"
            }
        ]
    },
    { 
        category: "3D MODELS", 
        id: "3d-models",
        description: "Inspect finished 3D assets from various projects. Drag to rotate.",
        items: [
            { 
                title: "NEBULA SHIP (Custom Model)", 
                type: "model", 
                // Placeholder for your GitHub-hosted model
                modelUrl: GITHUB_PAGES_BASE + 'models/nebula-ship.glb', 
                thumbnail: "https://placehold.co/1280x720/222224/d1d1d1?text=3D+MODEL:+SHIP"
            },
            { 
                title: "VINTAGE CAMERA (Custom Model)", 
                type: "model", 
                // Placeholder for your GitHub-hosted model
                modelUrl: GITHUB_PAGES_BASE + 'models/vintage-camera.glb', 
                thumbnail: "https://placehold.co/1280x720/222224/d1d1d1?text=3D+MODEL:+CAMERA"
            }
        ]
    },
    { 
        category: "SHARED FILES", 
        id: "shared-files",
        description: "Links to various files (PDFs, ZIPs, etc.). Direct URL required.",
        items: [
            { title: "Project Brief (PDF)", type: "link", url: GITHUB_PAGES_BASE + 'files/file-1.pdf', thumbnail: "https://placehold.co/1280x720/3b5249/d1d1d1?text=PROJECT+BRIEF" },
            { title: "Asset Pack (ZIP)", type: "link", url: GITHUB_PAGES_BASE + 'files/file-2.zip', thumbnail: "https://placehold.co/1280x720/3b5249/d1d1d1?text=ASSET+PACK" },
            { title: "Another GLB Asset", type: "link", url: GITHUB_PAGES_BASE + 'files/file-3.glb', thumbnail: "https://placehold.co/1280x720/3b5249/d1d1d1?text=GLB+DOWNLOAD" },
        ]
    }
];