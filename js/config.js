// =================================================================================
// --- CONFIG.JS - Core Configuration & Content ---
// =================================================================================
// Holds STATE, ROOM_DATA, PORTFOLIO_CONTENT, and all static configuration.
// Only stores data, no gameplay logic.

import * as THREE from 'three';

// =================================================================================
// GAME STATE
// =================================================================================
export const STATE = {
    screen: 'main-menu',
    menuIndex: 0,
    isCrtActive: true,
    current_room: 'ROOM_CONCERT',
    interaction_mode: 'OVERWORLD',
    difficulty: 'normal',  // 'freeroam', 'normal', 'hard', 'testing'
    player_pos: new THREE.Vector3(0, 0.05, 5),  // Legacy - use STATE.player.position
    active_target: null,
    active_hotspot: null,
    clues_found: [false, false, false],
    secret_unlocked: false,

    // =================================================================================
    // PLAYER STATE (First-Person)
    // =================================================================================
    player: {
        position: new THREE.Vector3(0, 0.05, 5),
        velocity: new THREE.Vector3(0, 0, 0),
        yaw: 0,              // Horizontal mouse rotation (radians)
        pitch: 0,            // Vertical mouse rotation (radians)
        isGrounded: true,
        isCrouching: false,
        isRunning: false,
        eyeHeight: 1.7,
        crouchHeight: 0.9,
        walkSpeed: 5.0,
        runSpeed: 9.0,
        crouchSpeed: 2.5,
        jumpVelocity: 8.0,
        gravity: -25.0
    },

    // =================================================================================
    // CAMERA MODE
    // =================================================================================
    cameraMode: 'FPS',  // 'FPS' | 'LEVITATION' | 'THIRD_PERSON' | 'CUTSCENE'
    currentLevitationZone: null,  // Active levitation zone ID when in LEVITATION mode

    // Movement settings (legacy - used by old movement.js)
    speed: 0.03,               // Slow walking speed
    move_tolerance: 0.2,

    // Inertia/weight simulation (legacy)
    acceleration: 0.003,
    deceleration: 0.006,
    currentSpeed: 0,
    moveDelay: 0.01,
    moveDelayTimer: 0,
};


// =================================================================================
// PORTFOLIO CONTENT
// =================================================================================
export const PORTFOLIO_CONTENT = {
    // Concert Room content
    statue_interact: {
        title: 'Broken Statue',
        text: 'A STATUE FROM YOUR PAST. THE HEAD IS MISSING. FIND THE PIECES TO RESTORE WHO YOU WERE.',
        type: 'puzzle'
    },
    statue_complete: {
        title: 'Statue Restored',
        text: 'THE STATUE IS WHOLE AGAIN. A MEMORY UNLOCKED. THE PATH FORWARD IS NOW OPEN.',
        type: 'puzzle'
    },
    // Music Videos Room content
    projector_interact: {
        title: 'Film Projector',
        text: 'ALIGN THE REELS TO PLAY THE FORGOTTEN FOOTAGE.',
        type: 'puzzle'
    },
    // Legacy content (can be kept or removed)
    clue_clock: {
        title: 'Clock Note',
        text: "THE HOUR HAND POINTS TO ONE. NOT ONE O'CLOCK, BUT ONE CLUE.",
        type: 'puzzle'
    },
    clue_painting: {
        title: 'Etched Symbol',
        text: "A ROUGHLY CARVED SUN SYMBOL. IT LOOKS LIKE A CLOCK FACE AT 9.",
        type: 'puzzle'
    },
    clue_plaque: {
        title: 'Archival Date',
        text: "EARLY DRAFT SUBMITTED ON: 05-02-1998. MAYBE THE MONTH IS IMPORTANT.",
        type: 'puzzle'
    },
    gallery_model1: {
        title: '3D Character Model',
        text: "LOW-POLY MODEL FROM A 2024 PROJECT. TEXTURES USE STRICT COLOR PALETTE. CLICK AND DRAG TO ROTATE.",
        type: 'inspect'
    },
    archive_concept: {
        title: 'Concept Art Case',
        text: "THIS GLASS CASE CONTAINS EARLY CONCEPT SKETCHES. THE PROCESS WAS MESSY, BUT ESSENTIAL.",
        type: 'text'
    },
    secret_ending: {
        title: 'Final Revelation',
        text: "CONGRATULATIONS. YOU HAVE UNLOCKED THE FINAL PIECE.\n\nTHIS IS THE 'ABOUT ME' MONOLOGUE.\n\nMY NAME IS NICHOLAS SIEGEL. THANK YOU FOR EXPLORING MY ADVENTURE.",
        type: 'text'
    }
};

// =================================================================================
// ROOM DATA
// =================================================================================
// Each room contains: name, camera position, spawn point, geometry, and hotspots.
// - geometry: Static room elements (floors, walls, props)
// - hotspots: Interactive triggers (doors, inspectable objects)
// 
// To add new rooms:
// 1. Create a new ROOM_KEY entry below
// 2. Define geometry array with { name, dim, pos, color, collider, hotspot? }
// 3. Define hotspots array with { name, pos, radius, type, ... }
// =================================================================================
export const ROOM_DATA = {
    // =========================================================================
    // ROOM 1: CONCERT VIDEOS ROOM
    // Theme: Beginning, Tours, Chaos, Memory fragmentation
    // Lighting: Dark warm-red stage lighting, flickering
    // Palette: Reds, blacks, grimey browns
    // =========================================================================
    ROOM_CONCERT: {
        name: 'CONCERT VIDEOS',
        camera: { pos: [8, 6, 10], target: [0, 1, 0] },  // Fallback camera
        spawn: new THREE.Vector3(0, 0.05, 5),
        lighting: 'concert',
        puzzleCompleted: false,
        // Camera zones - just 2 cameras covering each other's blind spots
        cameraZones: [
            {
                name: 'south_view',  // Camera from south, covers north half
                type: 'general',
                priority: 1,
                bounds: { x1: -12, x2: 12, z1: -12, z2: 0 },  // North half of room
                cameraPosition: { x: 0, y: 5, z: 10 },
                cameraTarget: { x: 0, y: 1, z: -3 },
                transitionSpeed: 0.03
            },
            {
                name: 'north_view',  // Camera from north, covers south half  
                type: 'general',
                priority: 1,
                bounds: { x1: -12, x2: 12, z1: 0, z2: 12 },  // South half of room
                cameraPosition: { x: 0, y: 5, z: -10 },
                cameraTarget: { x: 0, y: 1, z: 3 },
                transitionSpeed: 0.03
            }
        ],
        geometry: [
            // Floor - dark worn stage floor, extended back
            { name: 'floor', dim: [24, 0.2, 42], pos: [0, 0, -9], color: 0x1a0a0a, collider: true },

            // Ceiling
            { name: 'ceiling', dim: [24, 0.2, 42], pos: [0, 15, -9], color: 0x111111, collider: true },

            // Walls - dark backstage walls, extended and higher
            { name: 'wall_n', dim: [24, 15, 0.5], pos: [0, 7.5, -24], color: 0x2a1515, collider: true },
            { name: 'wall_s', dim: [24, 15, 0.5], pos: [0, 7.5, 12], color: 0x2a1515, collider: true },
            { name: 'wall_e', dim: [0.5, 15, 42], pos: [12, 7.5, -9], color: 0x2a1515, collider: true },
            { name: 'wall_w', dim: [0.5, 15, 42], pos: [-12, 7.5, -9], color: 0x2a1515, collider: true },

            // === CENTRAL STATUE (puzzle focal point) ===
            { name: 'statue_body', dim: [1.2, 3.5, 1.2], pos: [0, 1.75, 0], color: 0x555555, collider: true },
            { name: 'statue_base', dim: [2, 0.4, 2], pos: [0, 0.2, 0], color: 0x444444, collider: true },
            // Broken neck area (where heads attach)
            { name: 'statue_neck', dim: [0.6, 0.3, 0.6], pos: [0, 3.65, 0], color: 0x666666, collider: false },

            // === ROAD CASE (padlock puzzle) ===
            { name: 'road_case_body', dim: [2.5, 1.2, 1.8], pos: [3, 0.6, 2], color: 0x2a2a2a, collider: true },
            { name: 'road_case_lid', dim: [2.6, 0.15, 1.9], pos: [3, 1.25, 2], color: 0x222222, collider: false },
            // Metal corner reinforcements
            { name: 'road_case_corner1', dim: [0.15, 1.3, 0.15], pos: [4.15, 0.65, 2.85], color: 0x666666, collider: false },
            { name: 'road_case_corner2', dim: [0.15, 1.3, 0.15], pos: [1.85, 0.65, 2.85], color: 0x666666, collider: false },
            { name: 'road_case_corner3', dim: [0.15, 1.3, 0.15], pos: [4.15, 0.65, 1.15], color: 0x666666, collider: false },
            { name: 'road_case_corner4', dim: [0.15, 1.3, 0.15], pos: [1.85, 0.65, 1.15], color: 0x666666, collider: false },

            // === SPEAKER STACK (hum clue) ===
            { name: 'speaker_base', dim: [3, 2, 2], pos: [9, 1, -5], color: 0x1a1a1a, collider: true },
            { name: 'speaker_mid', dim: [2.8, 1.8, 1.8], pos: [9, 2.9, -5], color: 0x222222, collider: false },
            { name: 'speaker_top', dim: [2.6, 1.5, 1.6], pos: [9, 4.55, -5], color: 0x252525, collider: false },
            // Speaker cones
            { name: 'speaker_cone1', dim: [1.5, 1.5, 0.3], pos: [9, 1, -3.85], color: 0x111111, collider: false },
            { name: 'speaker_cone2', dim: [1.2, 1.2, 0.3], pos: [9, 2.9, -3.95], color: 0x111111, collider: false },
            { name: 'speaker_cone3', dim: [1.0, 1.0, 0.3], pos: [9, 4.5, -4.05], color: 0x111111, collider: false },

            // === POSTER FRAME (where hidden clue is) ===
            { name: 'poster_frame', dim: [2.2, 3, 0.1], pos: [-10, 3, -4], color: 0x332211, collider: false },
            { name: 'poster_surface', dim: [2, 2.8, 0.05], pos: [-10.05, 3, -4], color: 0x443322, collider: false },

            // === HIDDEN CLUE - "2017" (flashlight reveals) ===
            {
                name: 'hidden_clue_2017',
                dim: [1.8, 0.8, 0.02],
                pos: [-10.08, 3.5, -4],
                color: 0xFFDD00,  // Bright yellow when revealed
                collider: false,
                requiresFlashlight: true,
                revealId: 'clue_2017'
            },

            // === CRATES (environmental) ===
            { name: 'crate1', dim: [1.5, 1.5, 1.5], pos: [-8, 0.75, 4], color: 0x3d2817, collider: true },
            { name: 'crate2', dim: [1.2, 1.2, 1.2], pos: [-9.2, 0.6, 5], color: 0x4a3420, collider: true },
            { name: 'crate3', dim: [1, 1, 1], pos: [-7.5, 2, 4.2], color: 0x3d2817, collider: false },

            // === STAGE EDGE ===
            { name: 'stage_edge', dim: [18, 0.6, 1], pos: [0, 0.3, -8], color: 0x222222, collider: true },

            // === DOOR FRAME ===
            { name: 'door_frame_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, -11.5], color: 0x442211, collider: false },
            { name: 'door_frame_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, -11.5], color: 0x442211, collider: false },
            { name: 'door_frame_top', dim: [4.5, 0.5, 0.5], pos: [0, 5, -11.5], color: 0x442211, collider: false },
            { name: 'door_surface', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, -11.5], color: 0x553322, collider: false }
        ],
        hotspots: [
            // Door to Room 2 (LOCKED until road case puzzle complete)
            {
                name: 'door_next',
                pos: new THREE.Vector3(0, 1, -11),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_MUSICVIDEO',
                target_spawn: new THREE.Vector3(0, 0.05, 9),
                locked: true,
                prompt: 'DOOR TO MUSIC VIDEOS (LOCKED)'
            },
            // Road Case (padlock puzzle - code is "2017", gives film reel)
            {
                name: 'road_case',
                pos: new THREE.Vector3(3, 0.5, 2),
                radius: 2.0,
                type: 'padlock',
                code: '2017',
                rewardItem: 'film_reel_c',
                rewardSpawn: { x: 4, y: 0.5, z: 2 },
                successMessage: 'THE CASE CREAKS OPEN... A FILM REEL FRAGMENT GLINTS INSIDE.',
                prompt: 'ROAD CASE (LOCKED)',
                inspectDialog: 'Heavy… reinforced. There\'s a false bottom in here… if I can get it open.'
            },
            // Central Statue (requires both head pieces)
            {
                name: 'statue',
                pos: new THREE.Vector3(0, 1, 0),
                radius: 2.5,
                type: 'puzzle_statue',
                prompt: 'BROKEN STATUE',
                inspectDialog: 'The neck joints are clean. Two pieces fit here. I\'ve only found one.'
            },
            // Speaker Stack (hum clue)
            {
                name: 'speaker_stack',
                pos: new THREE.Vector3(9, 1, -5),
                radius: 2.5,
                type: 'inspect',
                prompt: '[E] SPEAKER STACK',
                inspectDialog: 'That hum… it\'s not random. It matches something… somewhere.',
                content: 'The speakers emit a low, rhythmic hum. The frequency feels familiar...'
            },
            // Hidden Poster (flashlight reveals code)
            {
                name: 'poster',
                pos: new THREE.Vector3(-10, 2.5, -4),
                radius: 2.0,
                type: 'inspect',
                prompt: '[E] TORN POSTER',
                inspectDialog: 'Just another poster… or maybe not.',
                content: 'An old concert poster, torn and faded. Something seems hidden beneath the surface...'
            },
            // Video Screen - Concert footage
            {
                name: 'concert_projector',
                pos: new THREE.Vector3(-8, 2, -8),
                radius: 3.0,
                type: 'video_screen',
                videoScreenId: 'concert_video_1',
                prompt: '[E] WATCH CONCERT FOOTAGE'
            }
        ],
        // Video screens in this room
        videoScreens: [
            {
                id: 'concert_video_1',
                videoSrc: '/assets/videos/concert_demo.mp4',
                position: { x: -8, y: 3, z: -10 },
                rotation: { x: 0, y: 0, z: 0 },
                width: 6,
                height: 3.375,
                cameraPosition: { x: -8, y: 3, z: -4 },
                cameraTarget: { x: -8, y: 3, z: -10 }
            }
        ],
        // Item spawn positions - only ONE statue head here (other is in Room 3)
        itemSpawns: [
            { itemId: 'statue_head_left', pos: new THREE.Vector3(-7.5, 1.8, 4.5) }  // On top of crates
        ],
        // Self-dialog triggers (proximity-based narration)
        selfDialogTriggers: [
            {
                name: 'statue_approach',
                pos: new THREE.Vector3(0, 0, 0),
                radius: 4,
                dialog: '…It\'s missing something. No—two things.',
                triggered: false
            },
            {
                name: 'speaker_approach',
                pos: new THREE.Vector3(9, 0, -5),
                radius: 3,
                dialog: 'That hum… it\'s not random. It matches something… somewhere.',
                triggered: false
            },
            {
                name: 'poster_approach',
                pos: new THREE.Vector3(-10, 0, -4),
                radius: 3,
                dialog: 'Just another poster… or maybe not.',
                triggered: false
            }
        ],
        // =================================================================================
        // LEVITATION ZONES - Areas where first-person mode switches to fixed levitation cam
        // =================================================================================
        levitationZones: [
            {
                id: 'concert_statue_zone',
                bounds: { x1: -6, x2: 6, z1: -4, z2: 6 },      // Around the central statue
                cameraPosition: { x: 0, y: 8, z: 12 },         // Fixed camera looking down at statue
                cameraTarget: { x: 0, y: 1, z: 0 },
                allowedObjects: ['LevitationBall']             // Objects that can be levitated here
            }
        ],
        group: null,
        colliders: []
    },

    // =========================================================================
    // ROOM 2: MUSIC VIDEOS ROOM
    // Theme: Creativity, Editing, Storytelling
    // Lighting: Soft gold, film-set look
    // Palette: Warm beige, sepia
    // =========================================================================
    ROOM_MUSICVIDEO: {
        name: 'MUSIC VIDEOS',
        camera: { pos: [10, 8, 10], target: [0, 0, 0] },  // Fallback
        spawn: new THREE.Vector3(0, 0.05, 9),
        lighting: 'musicvideo',
        puzzleCompleted: false,
        // Single camera zone using original working position
        cameraZones: [
            {
                name: 'general_room',
                type: 'general',
                priority: 0,
                bounds: { x1: -20, x2: 20, z1: -20, z2: 20 },
                cameraPosition: { x: 10, y: 8, z: 10 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            }
        ],
        geometry: [
            // Floor - warm wood
            { name: 'floor', dim: [20, 0.2, 20], pos: [0, 0, 0], color: 0x8B7355, collider: false },

            // Walls - warm beige film studio walls
            { name: 'wall_n', dim: [20, 10, 0.5], pos: [0, 5, -10], color: 0xAA9977, collider: true },
            { name: 'wall_s', dim: [20, 10, 0.5], pos: [0, 5, 10], color: 0xAA9977, collider: true },
            { name: 'wall_e', dim: [0.5, 10, 20], pos: [10, 5, 0], color: 0xAA9977, collider: true },
            { name: 'wall_w', dim: [0.5, 10, 20], pos: [-10, 5, 0], color: 0xAA9977, collider: true },

            // === CENTRAL PROJECTOR ===
            { name: 'projector_body', dim: [1.2, 1.5, 2], pos: [0, 1.25, 0], color: 0x444444, collider: true },
            { name: 'projector_lens', dim: [0.4, 0.4, 0.6], pos: [0, 1.5, -1.2], color: 0x222222, collider: false },
            { name: 'projector_reels_left', dim: [0.1, 0.8, 0.8], pos: [-0.5, 2, 0.3], color: 0x333333, collider: false },
            { name: 'projector_reels_right', dim: [0.1, 0.8, 0.8], pos: [0.5, 2, 0.3], color: 0x333333, collider: false },
            { name: 'projector_stand', dim: [1.5, 0.5, 1.5], pos: [0, 0.25, 0], color: 0x554433, collider: true },

            // === FILM SCREEN (north wall) ===
            { name: 'screen_frame', dim: [8, 5, 0.2], pos: [0, 4.5, -9.5], color: 0x222222, collider: false },
            { name: 'screen_surface', dim: [7.5, 4.5, 0.1], pos: [0, 4.5, -9.4], color: 0xDDDDDD, collider: false },

            // === EDITING DESK (east side) ===
            { name: 'edit_desk', dim: [4, 1, 2], pos: [7, 0.5, 2], color: 0x5a4a3a, collider: true },
            { name: 'edit_monitor1', dim: [1.5, 1.2, 0.2], pos: [6, 1.6, 1.5], color: 0x333333, collider: false },
            { name: 'edit_monitor2', dim: [1.5, 1.2, 0.2], pos: [8, 1.6, 1.5], color: 0x333333, collider: false },

            // === STORYBOARD WALL (west side) ===
            { name: 'storyboard_frame', dim: [4, 3, 0.15], pos: [-9.5, 3, -3], color: 0x443322, collider: false },
            { name: 'storyboard_paper1', dim: [0.8, 1, 0.02], pos: [-9.45, 3.5, -3.8], color: 0xFFFAE6, collider: false },
            { name: 'storyboard_paper2', dim: [0.8, 1, 0.02], pos: [-9.45, 3.5, -3], color: 0xFFFAE6, collider: false },
            { name: 'storyboard_paper3', dim: [0.8, 1, 0.02], pos: [-9.45, 3.5, -2.2], color: 0xFFFAE6, collider: false },
            { name: 'storyboard_paper4', dim: [0.8, 1, 0.02], pos: [-9.45, 2.2, -3.8], color: 0xFFFAE6, collider: false },
            { name: 'storyboard_paper5', dim: [0.8, 1, 0.02], pos: [-9.45, 2.2, -3], color: 0xFFFAE6, collider: false },
            { name: 'storyboard_paper6', dim: [0.8, 1, 0.02], pos: [-9.45, 2.2, -2.2], color: 0xFFFAE6, collider: false },

            // === BROKEN LIGHT PANEL (password fragment) ===
            { name: 'light_panel_frame', dim: [2, 2.5, 0.2], pos: [9.4, 3, -4], color: 0x555555, collider: false },
            { name: 'light_panel_glass', dim: [1.8, 2.3, 0.1], pos: [9.35, 3, -4], color: 0x335566, collider: false },
            // Hidden fragment inside - revealed with flashlight
            {
                name: 'password_fragment_one',
                dim: [0.8, 0.4, 0.02],
                pos: [9.3, 2.8, -4],
                color: 0xFF8800,
                collider: false,
                requiresFlashlight: true,
                revealId: 'password_one'
            },

            // === SHELVING UNIT (holds Reel A) ===
            { name: 'shelf_unit', dim: [3, 4, 1], pos: [-7, 2, 6], color: 0x4a3a2a, collider: true },
            { name: 'shelf1', dim: [2.8, 0.1, 0.9], pos: [-7, 1, 6], color: 0x5a4a3a, collider: false },
            { name: 'shelf2', dim: [2.8, 0.1, 0.9], pos: [-7, 2, 6], color: 0x5a4a3a, collider: false },
            { name: 'shelf3', dim: [2.8, 0.1, 0.9], pos: [-7, 3, 6], color: 0x5a4a3a, collider: false },

            // === FILM CANS (environmental) ===
            { name: 'film_can1', dim: [0.5, 0.15, 0.5], pos: [-7.5, 1.15, 6], color: 0x777777, collider: false },
            { name: 'film_can2', dim: [0.5, 0.15, 0.5], pos: [-6.5, 1.15, 6], color: 0x666666, collider: false },
            { name: 'film_can3', dim: [0.5, 0.15, 0.5], pos: [-7, 2.15, 6], color: 0x888888, collider: false },

            // === DOOR FRAMES ===
            { name: 'door_frame_s_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, 9.5], color: 0x442211, collider: false },
            { name: 'door_frame_s_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, 9.5], color: 0x442211, collider: false },
            { name: 'door_surface_s', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, 9.5], color: 0x553322, collider: false },
            { name: 'door_frame_n_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, -9.5], color: 0x442211, collider: false },
            { name: 'door_frame_n_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, -9.5], color: 0x442211, collider: false },
            { name: 'door_surface_n', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, -9.5], color: 0x553322, collider: false }
        ],
        hotspots: [
            // Door back to Concert Room
            {
                name: 'door_back',
                pos: new THREE.Vector3(0, 1, 9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_CONCERT',
                target_spawn: new THREE.Vector3(0, 0.05, -9),
                prompt: 'BACK TO CONCERT ROOM'
            },
            // Door to Room 3 (LOCKED until projector puzzle complete)
            {
                name: 'door_next',
                pos: new THREE.Vector3(0, 1, -9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_3DART',
                target_spawn: new THREE.Vector3(0, 0.05, 7),
                locked: true,
                prompt: 'DOOR TO 3D ART (LOCKED)'
            },
            // Central Projector (needs 3 reels)
            {
                name: 'projector',
                pos: new THREE.Vector3(0, 1, 0),
                radius: 2.5,
                type: 'puzzle_projector',
                prompt: 'FILM PROJECTOR',
                inspectDialog: 'The reels won\'t play until all three are here… and complete.',
                requiredItems: ['reel_a', 'reel_b', 'film_reel_c']
            },
            // Storyboard Wall
            {
                name: 'storyboard',
                pos: new THREE.Vector3(-9, 2.5, -3),
                radius: 2.5,
                type: 'inspect',
                prompt: '[E] STORYBOARD',
                inspectDialog: 'The drawings point to something… order might matter later.',
                content: 'Storyboard frames showing symbol sequences: ▲ → ■ → ● The order seems deliberate.'
            },
            // Broken Light Panel (password fragment)
            {
                name: 'light_panel',
                pos: new THREE.Vector3(9, 2.5, -4),
                radius: 2.0,
                type: 'inspect',
                prompt: '[E] BROKEN LIGHT PANEL',
                inspectDialog: 'The glass is cracked… a piece of writing inside: \'ONE\'. That\'s… part of something bigger.',
                content: 'A damaged light panel. Through the cracked glass, you can see letters: "ONE"'
            },
            // Shelf with Reel A
            {
                name: 'shelf',
                pos: new THREE.Vector3(-7, 1.5, 6),
                radius: 2.0,
                type: 'inspect',
                prompt: '[E] FILM SHELVES',
                inspectDialog: 'Old film cans... one reel stands out.',
                content: 'Dusty film cans line the shelves. One reel is labeled "A".'
            }
        ],
        // Item spawns
        itemSpawns: [
            { itemId: 'reel_a', pos: new THREE.Vector3(-7, 2.2, 6) }  // On middle shelf
        ],
        // Self-dialog triggers
        selfDialogTriggers: [
            {
                name: 'room_enter',
                pos: new THREE.Vector3(0, 0, 8),
                radius: 3,
                dialog: 'All these lights… but something feels unfinished.',
                triggered: false
            },
            {
                name: 'projector_approach',
                pos: new THREE.Vector3(0, 0, 0),
                radius: 4,
                dialog: 'It\'s waiting… missing pieces, just like the statue.',
                triggered: false
            },
            {
                name: 'storyboard_approach',
                pos: new THREE.Vector3(-9, 0, -3),
                radius: 3,
                dialog: 'Symbols… a pattern. They feel important, but incomplete.',
                triggered: false
            }
        ],
        group: null,
        colliders: []
    },

    // =========================================================================
    // ROOM 3: 3D WORK ROOM
    // Theme: Digital sculpture, wireframes, modeling, 3D artistry
    // Lighting: Cool blue, digital glow
    // =========================================================================
    ROOM_3DART: {
        name: '3D WORK',
        camera: { pos: [10, 8, 10], target: [0, 0, 0] },
        spawn: new THREE.Vector3(0, 0.05, 8),
        lighting: '3dart',
        puzzleCompleted: false,
        // Camera zones - puzzle-centric
        cameraZones: [
            // General room coverage - uses original camera
            {
                name: 'general_room',
                type: 'general',
                priority: 0,
                bounds: { x1: -12, x2: 12, z1: -12, z2: 12 },
                cameraPosition: { x: 10, y: 8, z: 10 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            },
            // PUZZLE: Render Terminal - slightly closer
            {
                name: 'puzzle_terminal',
                type: 'puzzle',
                priority: 10,
                bounds: { x1: -4, x2: 4, z1: -4, z2: 4 },
                cameraPosition: { x: 7, y: 6, z: 7 },
                cameraTarget: { x: 0, y: 2, z: 0 },
                transitionSpeed: 0.08
            },
            // PUZZLE: Blueprint wall (west side)
            {
                name: 'puzzle_blueprint',
                type: 'puzzle',
                priority: 8,
                bounds: { x1: -10, x2: -5, z1: -3, z2: 3 },
                cameraPosition: { x: -2, y: 5, z: 6 },
                cameraTarget: { x: -9, y: 3, z: 0 },
                transitionSpeed: 0.07
            },
            // Wireframe sculptures area (east side)
            {
                name: 'sculptures',
                type: 'general',
                priority: 3,
                bounds: { x1: 4, x2: 10, z1: -6, z2: 2 },
                cameraPosition: { x: 8, y: 5, z: 6 },
                cameraTarget: { x: 7, y: 2, z: -2 },
                transitionSpeed: 0.06
            },
            // Entrance (south side)
            {
                name: 'entrance',
                type: 'general',
                priority: 2,
                bounds: { x1: -5, x2: 5, z1: 6, z2: 10 },
                cameraPosition: { x: 0, y: 7, z: 12 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            }
        ],
        geometry: [
            // Floor - dark blue tech floor
            { name: 'floor', dim: [20, 0.2, 20], pos: [0, 0, 0], color: 0x1a2233, collider: false },

            // Walls - cool blue-grey
            { name: 'wall_n', dim: [20, 10, 0.5], pos: [0, 5, -10], color: 0x2a3344, collider: true },
            { name: 'wall_s', dim: [20, 10, 0.5], pos: [0, 5, 10], color: 0x2a3344, collider: true },
            { name: 'wall_e', dim: [0.5, 10, 20], pos: [10, 5, 0], color: 0x2a3344, collider: true },
            { name: 'wall_w', dim: [0.5, 10, 20], pos: [-10, 5, 0], color: 0x2a3344, collider: true },

            // === RENDER TERMINAL (central puzzle) ===
            { name: 'terminal_base', dim: [2, 0.5, 2], pos: [0, 0.25, 0], color: 0x333344, collider: true },
            { name: 'terminal_body', dim: [1.5, 2.5, 1.5], pos: [0, 1.5, 0], color: 0x2266aa, collider: true },
            { name: 'terminal_screen', dim: [1.2, 0.8, 0.1], pos: [0, 2.2, -0.75], color: 0x001122, collider: false },
            // Shard slots (visual indicators)
            { name: 'shard_slot_a', dim: [0.4, 0.4, 0.1], pos: [-0.5, 1, 0.75], color: 0x446688, collider: false },
            { name: 'shard_slot_b', dim: [0.4, 0.4, 0.1], pos: [0, 1, 0.75], color: 0x446688, collider: false },
            { name: 'shard_slot_c', dim: [0.4, 0.4, 0.1], pos: [0.5, 1, 0.75], color: 0x446688, collider: false },

            // === BLUEPRINT WALL (shard order clue) ===
            { name: 'blueprint_frame', dim: [3, 4, 0.15], pos: [-9.5, 3, 0], color: 0x334455, collider: false },
            { name: 'blueprint_paper', dim: [2.8, 3.8, 0.05], pos: [-9.45, 3, 0], color: 0x223344, collider: false },
            // Hidden order clue - revealed with flashlight
            {
                name: 'blueprint_order',
                dim: [2.5, 1, 0.02],
                pos: [-9.4, 3.5, 0],
                color: 0x44AAFF,
                collider: false,
                requiresFlashlight: true,
                revealId: 'shard_order'
            },

            // === WIREFRAME SCULPTURES (environmental) ===
            // Sculpture 1 - pyramid wireframe
            { name: 'sculpture1_base', dim: [1.5, 0.2, 1.5], pos: [7, 0.1, -2], color: 0x4488aa, collider: true },
            { name: 'sculpture1_body', dim: [1, 2, 1], pos: [7, 1.2, -2], color: 0x3377aa, collider: false },
            // Sculpture 2 - cube wireframe
            { name: 'sculpture2_base', dim: [1.2, 0.2, 1.2], pos: [7, 0.1, 2], color: 0x4488aa, collider: true },
            { name: 'sculpture2_body', dim: [0.8, 0.8, 0.8], pos: [7, 0.8, 2], color: 0x55aacc, collider: false },
            // Sculpture 3 - sphere placeholder
            { name: 'sculpture3_base', dim: [1.3, 0.2, 1.3], pos: [5, 0.1, 0], color: 0x4488aa, collider: true },
            { name: 'sculpture3_body', dim: [0.9, 0.9, 0.9], pos: [5, 0.9, 0], color: 0x66bbdd, collider: false },

            // === SHAPE PUZZLE BLOCKS (for Room 4) ===
            { name: 'puzzle_block_holder', dim: [1.5, 1, 1.5], pos: [-6, 0.5, -5], color: 0x445566, collider: true },
            // The actual block item is in itemSpawns

            // === WORKSTATION (environmental) ===
            { name: 'workstation_desk', dim: [4, 0.8, 1.5], pos: [-6, 0.4, 5], color: 0x3a3a4a, collider: true },
            { name: 'workstation_monitor', dim: [2, 1.5, 0.15], pos: [-6, 1.55, 4.5], color: 0x222233, collider: false },
            { name: 'workstation_keyboard', dim: [1.2, 0.1, 0.4], pos: [-6, 0.85, 5.5], color: 0x333344, collider: false },

            // === STATUE HEAD RIGHT (for Room 1 puzzle) ===
            // Hidden behind sculptures - player finds second head here
            { name: 'head_pedestal', dim: [0.6, 0.8, 0.6], pos: [8, 0.4, -5], color: 0x555566, collider: true },

            // === DOOR FRAMES ===
            { name: 'door_frame_s_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, 9.5], color: 0x334455, collider: false },
            { name: 'door_frame_s_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, 9.5], color: 0x334455, collider: false },
            { name: 'door_surface_s', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, 9.5], color: 0x445566, collider: false },
            { name: 'door_frame_n_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, -9.5], color: 0x334455, collider: false },
            { name: 'door_frame_n_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, -9.5], color: 0x334455, collider: false },
            { name: 'door_surface_n', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, -9.5], color: 0x445566, collider: false }
        ],
        hotspots: [
            // Door back to Music Videos
            {
                name: 'door_back',
                pos: new THREE.Vector3(0, 1, 9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_MUSICVIDEO',
                target_spawn: new THREE.Vector3(0, 0.05, -8),
                prompt: 'BACK TO MUSIC VIDEOS'
            },
            // Door to VFX Room (LOCKED until terminal puzzle complete)
            {
                name: 'door_next',
                pos: new THREE.Vector3(0, 1, -9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_VFX',
                target_spawn: new THREE.Vector3(0, 0.05, 7),
                locked: true,
                prompt: 'DOOR TO VFX (LOCKED)'
            },
            // Render Terminal (needs 3 shards)
            {
                name: 'terminal',
                pos: new THREE.Vector3(0, 1.5, 0),
                radius: 2.5,
                type: 'puzzle_terminal',
                prompt: 'RENDER TERMINAL',
                inspectDialog: 'It\'s quiet. Sleeping. It needs the shards.',
                requiredItems: ['render_shard_a', 'render_shard_b', 'render_shard_c']
            },
            // Blueprint Wall
            {
                name: 'blueprint',
                pos: new THREE.Vector3(-9, 2.5, 0),
                radius: 2.5,
                type: 'inspect',
                prompt: '[E] BLUEPRINT',
                inspectDialog: 'Three shapes… three steps… but the order\'s the key.',
                content: 'Technical drawings showing assembly instructions. The order A → B → C is marked.'
            },
            // Wireframe Sculptures
            {
                name: 'sculptures',
                pos: new THREE.Vector3(6.5, 1, 0),
                radius: 3.0,
                type: 'inspect',
                prompt: '[E] WIREFRAME SCULPTURES',
                inspectDialog: 'These pieces… broken, but familiar.',
                content: 'Digital sculptures rendered in wireframe. Each represents a different shape.'
            },
            // Pedestal with Statue Head Right
            {
                name: 'head_pedestal',
                pos: new THREE.Vector3(8, 0.5, -5),
                radius: 1.5,
                type: 'inspect',
                prompt: '[E] STONE PEDESTAL',
                inspectDialog: 'Something sits here... a familiar shape.',
                content: 'A small pedestal with an object resting on top.'
            }
        ],
        // Item spawns - Statue head right is here, plus Render Shard A
        itemSpawns: [
            { itemId: 'statue_head_right', pos: new THREE.Vector3(8, 1, -5) },  // On pedestal
            { itemId: 'render_shard_a', pos: new THREE.Vector3(-6, 0.9, -5) },  // Near puzzle block holder
            { itemId: 'shape_block', pos: new THREE.Vector3(-6, 1.1, -5) }       // On the holder
        ],
        // Self-dialog triggers
        selfDialogTriggers: [
            {
                name: 'terminal_approach',
                pos: new THREE.Vector3(0, 0, 0),
                radius: 4,
                dialog: 'It won\'t start until everything lines up exactly.',
                triggered: false
            },
            {
                name: 'sculptures_approach',
                pos: new THREE.Vector3(7, 0, 0),
                radius: 3,
                dialog: 'These pieces… broken, but familiar.',
                triggered: false
            },
            {
                name: 'blueprint_approach',
                pos: new THREE.Vector3(-9, 0, 0),
                radius: 3,
                dialog: 'Three shapes… three steps… but the order\'s the key.',
                triggered: false
            }
        ],
        group: null,
        colliders: []
    },

    // =========================================================================
    // ROOM 4: MUSIC ROOM
    // Theme: Music creation, emotional expression, recording, lyrics, stems
    // Lighting: Warm orange/amber, intimate studio feel
    // =========================================================================
    ROOM_MUSIC: {
        name: 'MUSIC',
        camera: { pos: [10, 8, 10], target: [0, 0, 0] },
        spawn: new THREE.Vector3(0, 0.05, 8),
        lighting: 'vfx',
        puzzleCompleted: false,
        // Camera zones - based on original camera position (10, 8, 10)
        cameraZones: [
            {
                name: 'general_room',
                type: 'general',
                priority: 0,
                bounds: { x1: -12, x2: 12, z1: -12, z2: 12 },
                cameraPosition: { x: 10, y: 8, z: 10 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            },
            {
                name: 'puzzle_console',
                type: 'puzzle',
                priority: 10,
                bounds: { x1: -4, x2: 4, z1: -4, z2: 4 },
                cameraPosition: { x: 7, y: 6, z: 7 },
                cameraTarget: { x: 0, y: 1.5, z: 0 },
                transitionSpeed: 0.08
            },
            {
                name: 'puzzle_green_wall',
                type: 'puzzle',
                priority: 8,
                bounds: { x1: 5, x2: 10, z1: -6, z2: 0 },
                cameraPosition: { x: 8, y: 5, z: 4 },
                cameraTarget: { x: 9, y: 3, z: -3 },
                transitionSpeed: 0.07
            },
            {
                name: 'entrance',
                type: 'general',
                priority: 2,
                bounds: { x1: -5, x2: 5, z1: 6, z2: 10 },
                cameraPosition: { x: 0, y: 7, z: 12 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            }
        ],
        geometry: [
            // Floor - dark purple
            { name: 'floor', dim: [20, 0.2, 20], pos: [0, 0, 0], color: 0x221122, collider: false },

            // Walls - magenta tinted
            { name: 'wall_n', dim: [20, 10, 0.5], pos: [0, 5, -10], color: 0x332233, collider: true },
            { name: 'wall_s', dim: [20, 10, 0.5], pos: [0, 5, 10], color: 0x332233, collider: true },
            { name: 'wall_e', dim: [0.5, 10, 20], pos: [10, 5, 0], color: 0x332233, collider: true },
            { name: 'wall_w', dim: [0.5, 10, 20], pos: [-10, 5, 0], color: 0x332233, collider: true },

            // === FX CONSOLE (central puzzle) ===
            { name: 'console_base', dim: [3, 0.5, 2], pos: [0, 0.25, 0], color: 0x333344, collider: true },
            { name: 'console_body', dim: [2.5, 1.5, 1.5], pos: [0, 1, 0], color: 0x664477, collider: true },
            { name: 'console_screens', dim: [2.2, 1, 0.1], pos: [0, 1.5, -0.75], color: 0x221133, collider: false },
            // Layer slots
            { name: 'layer_slot_1', dim: [0.6, 0.6, 0.1], pos: [-0.8, 0.8, 0.75], color: 0xff4444, collider: false },
            { name: 'layer_slot_2', dim: [0.6, 0.6, 0.1], pos: [0, 0.8, 0.75], color: 0x44ff44, collider: false },
            { name: 'layer_slot_3', dim: [0.6, 0.6, 0.1], pos: [0.8, 0.8, 0.75], color: 0x4444ff, collider: false },

            // === GREEN WALL (color lens reveal) ===
            { name: 'green_wall_frame', dim: [4, 5, 0.2], pos: [9.4, 3, -3], color: 0x224422, collider: false },
            { name: 'green_wall_surface', dim: [3.8, 4.8, 0.1], pos: [9.35, 3, -3], color: 0x00AA00, collider: false },
            // Hidden layer order - revealed with color lens
            {
                name: 'hidden_layer_order',
                dim: [3, 2, 0.02],
                pos: [9.3, 3.5, -3],
                color: 0xFF44FF,
                collider: false,
                requiresFlashlight: true,
                revealId: 'layer_order'
            },

            // === COMPOSITING MONITORS ===
            { name: 'monitor_desk', dim: [5, 0.8, 1.5], pos: [-6, 0.4, 0], color: 0x3a3a4a, collider: true },
            { name: 'monitor_1', dim: [1.8, 1.4, 0.15], pos: [-7, 1.5, -0.2], color: 0x222233, collider: false },
            { name: 'monitor_2', dim: [1.8, 1.4, 0.15], pos: [-5, 1.5, -0.2], color: 0x222233, collider: false },

            // === EFFECT PREVIEW SCREENS ===
            { name: 'preview_stand', dim: [2, 3, 0.3], pos: [-8, 1.5, -6], color: 0x443355, collider: true },
            { name: 'preview_screen', dim: [1.8, 2.5, 0.1], pos: [-8, 1.5, -5.85], color: 0x111122, collider: false },

            // === DOOR FRAMES ===
            { name: 'door_frame_s_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, 9.5], color: 0x443355, collider: false },
            { name: 'door_frame_s_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, 9.5], color: 0x443355, collider: false },
            { name: 'door_surface_s', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, 9.5], color: 0x554466, collider: false },
            { name: 'door_frame_n_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, -9.5], color: 0x443355, collider: false },
            { name: 'door_frame_n_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, -9.5], color: 0x443355, collider: false },
            { name: 'door_surface_n', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, -9.5], color: 0x554466, collider: false }
        ],
        hotspots: [
            {
                name: 'door_back',
                pos: new THREE.Vector3(0, 1, 9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_3DART',
                target_spawn: new THREE.Vector3(0, 0.05, -8),
                prompt: 'BACK TO 3D ART'
            },
            {
                name: 'door_next',
                pos: new THREE.Vector3(0, 1, -9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_WEB',
                target_spawn: new THREE.Vector3(0, 0.05, 7),
                locked: true,
                prompt: 'DOOR TO WEB (LOCKED)'
            },
            {
                name: 'fx_console',
                pos: new THREE.Vector3(0, 1, 0),
                radius: 2.5,
                type: 'puzzle_console',
                prompt: 'FX CONSOLE',
                inspectDialog: 'Three layers… but the order\'s wrong. I can feel it.',
                requiredItems: ['fx_element_1', 'fx_element_2', 'fx_element_3']
            },
            {
                name: 'green_wall',
                pos: new THREE.Vector3(9, 2.5, -3),
                radius: 2.5,
                type: 'inspect',
                prompt: '[E] GREEN WALL',
                inspectDialog: 'Light behaves strangely here… If only I had something to filter it.',
                content: 'A green screen wall. Something seems hidden beneath the surface...'
            },
            {
                name: 'monitors',
                pos: new THREE.Vector3(-6, 1, 0),
                radius: 2.5,
                type: 'inspect',
                prompt: '[E] COMPOSITING MONITORS',
                inspectDialog: 'These effects don\'t blend right without proper order.',
                content: 'Dual monitors showing layered effects. The sequence matters.'
            }
        ],
        itemSpawns: [
            { itemId: 'fx_element_1', pos: new THREE.Vector3(-8, 0.5, -6) },
            { itemId: 'fx_element_2', pos: new THREE.Vector3(6, 0.5, 5) },
            { itemId: 'fx_element_3', pos: new THREE.Vector3(-6, 0.9, 0) }
        ],
        selfDialogTriggers: [
            {
                name: 'console_approach',
                pos: new THREE.Vector3(0, 0, 0),
                radius: 4,
                dialog: 'Three layers… but the order\'s wrong. I can feel it.',
                triggered: false
            },
            {
                name: 'green_wall_approach',
                pos: new THREE.Vector3(9, 0, -3),
                radius: 3,
                dialog: 'Light behaves strangely here… If only I had something to filter it.',
                triggered: false
            }
        ],
        group: null,
        colliders: []
    },

    // =========================================================================
    // ROOM 5: GAME DEVELOPMENT ROOM
    // Theme: Building games, mixing systems (music + 3D + logic), passion project
    // Lighting: Teal/green, digital
    // =========================================================================
    ROOM_GAMEDEV: {
        name: 'GAME DEVELOPMENT',
        camera: { pos: [10, 8, 10], target: [0, 0, 0] },
        spawn: new THREE.Vector3(0, 0.05, 8),
        lighting: 'web',
        puzzleCompleted: false,
        cameraZones: [
            {
                name: 'general_room',
                type: 'general',
                priority: 0,
                bounds: { x1: -12, x2: 12, z1: -12, z2: 12 },
                cameraPosition: { x: 10, y: 8, z: 10 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            },
            {
                name: 'puzzle_terminal',
                type: 'puzzle',
                priority: 10,
                bounds: { x1: -4, x2: 4, z1: -4, z2: 4 },
                cameraPosition: { x: 7, y: 6, z: 7 },
                cameraTarget: { x: 0, y: 1.5, z: 0 },
                transitionSpeed: 0.08
            },
            {
                name: 'puzzle_server',
                type: 'puzzle',
                priority: 8,
                bounds: { x1: 5, x2: 10, z1: -2, z2: 4 },
                cameraPosition: { x: 8, y: 5, z: 6 },
                cameraTarget: { x: 8, y: 2, z: 1 },
                transitionSpeed: 0.07
            },
            {
                name: 'entrance',
                type: 'general',
                priority: 2,
                bounds: { x1: -5, x2: 5, z1: 6, z2: 10 },
                cameraPosition: { x: 0, y: 7, z: 12 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            }
        ],
        geometry: [
            // Floor - dark teal
            { name: 'floor', dim: [20, 0.2, 20], pos: [0, 0, 0], color: 0x112222, collider: false },

            // Walls - teal tinted
            { name: 'wall_n', dim: [20, 10, 0.5], pos: [0, 5, -10], color: 0x223333, collider: true },
            { name: 'wall_s', dim: [20, 10, 0.5], pos: [0, 5, 10], color: 0x223333, collider: true },
            { name: 'wall_e', dim: [0.5, 10, 20], pos: [10, 5, 0], color: 0x223333, collider: true },
            { name: 'wall_w', dim: [0.5, 10, 20], pos: [-10, 5, 0], color: 0x223333, collider: true },

            // === COMPILE TERMINAL (central puzzle) ===
            { name: 'terminal_base', dim: [2.5, 0.5, 2], pos: [0, 0.25, 0], color: 0x334444, collider: true },
            { name: 'terminal_body', dim: [2, 2.5, 1.5], pos: [0, 1.5, 0], color: 0x227755, collider: true },
            { name: 'terminal_screen', dim: [1.6, 1.2, 0.1], pos: [0, 2, -0.75], color: 0x001111, collider: false },
            // Code fragment slots
            { name: 'code_slot_1', dim: [0.5, 0.5, 0.1], pos: [-0.6, 1, 0.75], color: 0x44aa88, collider: false },
            { name: 'code_slot_2', dim: [0.5, 0.5, 0.1], pos: [0, 1, 0.75], color: 0x44aa88, collider: false },
            { name: 'code_slot_3', dim: [0.5, 0.5, 0.1], pos: [0.6, 1, 0.75], color: 0x44aa88, collider: false },

            // === SERVER RACK (IP clues) ===
            { name: 'server_rack', dim: [2, 5, 1.5], pos: [8, 2.5, 1], color: 0x333344, collider: true },
            { name: 'server_lights_1', dim: [1.8, 0.3, 0.1], pos: [8, 1, 0.25], color: 0x00ff00, collider: false },
            { name: 'server_lights_2', dim: [1.8, 0.3, 0.1], pos: [8, 2, 0.25], color: 0x00ff00, collider: false },
            { name: 'server_lights_3', dim: [1.8, 0.3, 0.1], pos: [8, 3, 0.25], color: 0xff8800, collider: false },
            { name: 'server_lights_4', dim: [1.8, 0.3, 0.1], pos: [8, 4, 0.25], color: 0x00ff00, collider: false },

            // === RENDER KEY SLOT ===
            { name: 'key_slot_stand', dim: [1, 1.5, 1], pos: [-7, 0.75, -5], color: 0x445555, collider: true },
            { name: 'key_slot_top', dim: [0.8, 0.2, 0.8], pos: [-7, 1.6, -5], color: 0x336666, collider: false },

            // === SHELVING (holds Reel B) ===
            { name: 'shelf_unit', dim: [3, 4, 1], pos: [7, 2, -6], color: 0x3a4a4a, collider: true },
            { name: 'shelf1', dim: [2.8, 0.1, 0.9], pos: [7, 1, -6], color: 0x4a5a5a, collider: false },
            { name: 'shelf2', dim: [2.8, 0.1, 0.9], pos: [7, 2, -6], color: 0x4a5a5a, collider: false },
            { name: 'shelf3', dim: [2.8, 0.1, 0.9], pos: [7, 3, -6], color: 0x4a5a5a, collider: false },

            // === WORKSTATIONS ===
            { name: 'desk_1', dim: [3, 0.8, 1.2], pos: [-6, 0.4, 4], color: 0x3a4a4a, collider: true },
            { name: 'monitor_1', dim: [1.5, 1.2, 0.15], pos: [-6, 1.4, 3.6], color: 0x222233, collider: false },

            // === DOOR FRAMES ===
            { name: 'door_frame_s_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, 9.5], color: 0x334444, collider: false },
            { name: 'door_frame_s_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, 9.5], color: 0x334444, collider: false },
            { name: 'door_surface_s', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, 9.5], color: 0x445555, collider: false },
            { name: 'door_frame_n_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, -9.5], color: 0x334444, collider: false },
            { name: 'door_frame_n_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, -9.5], color: 0x334444, collider: false },
            { name: 'door_surface_n', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, -9.5], color: 0x445555, collider: false }
        ],
        hotspots: [
            {
                name: 'door_back',
                pos: new THREE.Vector3(0, 1, 9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_VFX',
                target_spawn: new THREE.Vector3(0, 0.05, -8),
                prompt: 'BACK TO VFX'
            },
            {
                name: 'door_next',
                pos: new THREE.Vector3(0, 1, -9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_AI',
                target_spawn: new THREE.Vector3(0, 0.05, 7),
                locked: true,
                prompt: 'DOOR TO AI (LOCKED)'
            },
            {
                name: 'compile_terminal',
                pos: new THREE.Vector3(0, 1.5, 0),
                radius: 2.5,
                type: 'puzzle_compile',
                prompt: 'COMPILE TERMINAL',
                inspectDialog: 'Three fragments needed… and the output\'s broken until the address is correct.',
                requiredItems: ['code_fragment_1', 'code_fragment_2', 'code_fragment_3']
            },
            {
                name: 'server_rack',
                pos: new THREE.Vector3(8, 2, 1),
                radius: 2.5,
                type: 'inspect',
                prompt: '[E] SERVER RACK',
                inspectDialog: 'Numbers repeating… they\'re pointing me toward something.',
                content: 'Server rack with blinking lights. IP addresses scroll: 192.168.1.1...'
            },
            {
                name: 'render_key_slot',
                pos: new THREE.Vector3(-7, 1, -5),
                radius: 2.0,
                type: 'inspect',
                prompt: '[E] KEY SLOT',
                inspectDialog: 'This feels like it belongs here… maybe the key changes something.',
                content: 'An empty slot shaped for a key. It awaits the Render Key from Room 3.'
            },
            {
                name: 'shelf',
                pos: new THREE.Vector3(7, 1.5, -6),
                radius: 2.0,
                type: 'inspect',
                prompt: '[E] STORAGE SHELF',
                inspectDialog: 'More film reels... one is labeled "B".',
                content: 'Shelves holding various tech equipment. A film reel labeled "B" stands out.'
            }
        ],
        itemSpawns: [
            { itemId: 'reel_b', pos: new THREE.Vector3(7, 2.2, -6) },  // On shelf - for Room 2 projector
            { itemId: 'code_fragment_1', pos: new THREE.Vector3(-6, 0.9, 4) },
            { itemId: 'code_fragment_2', pos: new THREE.Vector3(6, 0.5, 5) }
        ],
        selfDialogTriggers: [
            {
                name: 'terminal_approach',
                pos: new THREE.Vector3(0, 0, 0),
                radius: 4,
                dialog: 'It won\'t compile. Missing parts… the story of my life.',
                triggered: false
            },
            {
                name: 'server_approach',
                pos: new THREE.Vector3(8, 0, 1),
                radius: 3,
                dialog: 'Numbers repeating… they\'re pointing me toward something.',
                triggered: false
            }
        ],
        group: null,
        colliders: []
    },

    // =========================================================================
    // ROOM 6: ABOUT ME (FINAL)
    // Theme: Integration, memory, synthesis, bringing everything together
    // Lighting: Deep purple, ethereal
    // =========================================================================
    ROOM_ABOUTME: {
        name: 'ABOUT ME',
        camera: { pos: [10, 8, 10], target: [0, 0, 0] },
        spawn: new THREE.Vector3(0, 0.05, 8),
        lighting: 'ai',
        puzzleCompleted: false,
        cameraZones: [
            {
                name: 'general_room',
                type: 'general',
                priority: 0,
                bounds: { x1: -12, x2: 12, z1: -12, z2: 12 },
                cameraPosition: { x: 10, y: 8, z: 10 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            },
            {
                name: 'puzzle_memory_box',
                type: 'puzzle',
                priority: 10,
                bounds: { x1: -4, x2: 4, z1: -4, z2: 4 },
                cameraPosition: { x: 7, y: 6, z: 7 },
                cameraTarget: { x: 0, y: 1.5, z: 0 },
                transitionSpeed: 0.08
            },
            {
                name: 'entrance',
                type: 'general',
                priority: 2,
                bounds: { x1: -5, x2: 5, z1: 6, z2: 10 },
                cameraPosition: { x: 0, y: 7, z: 12 },
                cameraTarget: { x: 0, y: 1, z: 0 },
                transitionSpeed: 0.06
            }
        ],
        geometry: [
            // Floor - deep purple
            { name: 'floor', dim: [20, 0.2, 20], pos: [0, 0, 0], color: 0x110022, collider: false },

            // Walls - ethereal purple
            { name: 'wall_n', dim: [20, 10, 0.5], pos: [0, 5, -10], color: 0x220033, collider: true },
            { name: 'wall_s', dim: [20, 10, 0.5], pos: [0, 5, 10], color: 0x220033, collider: true },
            { name: 'wall_e', dim: [0.5, 10, 20], pos: [10, 5, 0], color: 0x220033, collider: true },
            { name: 'wall_w', dim: [0.5, 10, 20], pos: [-10, 5, 0], color: 0x220033, collider: true },

            // === MEMORY BOX (final puzzle) ===
            { name: 'memory_base', dim: [2.5, 0.5, 2.5], pos: [0, 0.25, 0], color: 0x332244, collider: true },
            { name: 'memory_box', dim: [2, 2, 2], pos: [0, 1.5, 0], color: 0x6633aa, collider: true },
            { name: 'memory_glow', dim: [1.8, 1.8, 1.8], pos: [0, 1.5, 0], color: 0x8844ff, collider: false },
            // Password input panel
            { name: 'input_panel', dim: [1.5, 0.8, 0.1], pos: [0, 1.2, 1], color: 0x442266, collider: false },

            // === FLOATING PANELS (environmental) ===
            { name: 'float_panel_1', dim: [2, 1.5, 0.1], pos: [-6, 4, -3], color: 0x553377, collider: false },
            { name: 'float_panel_2', dim: [1.5, 2, 0.1], pos: [6, 3.5, -4], color: 0x553377, collider: false },
            { name: 'float_panel_3', dim: [2.5, 1, 0.1], pos: [-5, 5, 4], color: 0x553377, collider: false },

            // === COLOR LENS GIFT (given early) ===
            { name: 'lens_pedestal', dim: [0.8, 1, 0.8], pos: [-7, 0.5, 6], color: 0x443355, collider: true },
            // The lens item is in itemSpawns

            // === HIDDEN PASSWORD FRAGMENTS (flashlight reveals) ===
            {
                name: 'password_fragment_two',
                dim: [1, 0.5, 0.02],
                pos: [-9.4, 4, 2],
                color: 0xFF44AA,
                collider: false,
                requiresFlashlight: true,
                revealId: 'password_two'
            },
            {
                name: 'password_fragment_three',
                dim: [1, 0.5, 0.02],
                pos: [9.4, 4, -2],
                color: 0x44AAFF,
                collider: false,
                requiresFlashlight: true,
                revealId: 'password_three'
            },

            // === DOOR FRAME (back only - no forward) ===
            { name: 'door_frame_s_left', dim: [0.5, 5, 0.5], pos: [-2, 2.5, 9.5], color: 0x332244, collider: false },
            { name: 'door_frame_s_right', dim: [0.5, 5, 0.5], pos: [2, 2.5, 9.5], color: 0x332244, collider: false },
            { name: 'door_surface_s', dim: [3.5, 4.5, 0.2], pos: [0, 2.25, 9.5], color: 0x443355, collider: false }
        ],
        hotspots: [
            {
                name: 'door_back',
                pos: new THREE.Vector3(0, 1, 9),
                radius: 2.0,
                type: 'door',
                target_room: 'ROOM_WEB',
                target_spawn: new THREE.Vector3(0, 0.05, -8),
                prompt: 'BACK TO WEB'
            },
            {
                name: 'memory_box',
                pos: new THREE.Vector3(0, 1.5, 0),
                radius: 2.5,
                type: 'puzzle_final',
                prompt: 'MEMORY BOX',
                inspectDialog: 'It only opens if I know the whole truth… three pieces, one key.',
                password: 'SYNTHEYE'
            },
            {
                name: 'lens_pedestal',
                pos: new THREE.Vector3(-7, 0.5, 6),
                radius: 2.0,
                type: 'inspect',
                prompt: '[E] LENS PEDESTAL',
                inspectDialog: 'A colored lens... for seeing what\'s hidden.',
                content: 'A pedestal holding a special color filter lens. Take it for the VFX room.'
            },
            {
                name: 'float_panels',
                pos: new THREE.Vector3(-5, 3, 0),
                radius: 4.0,
                type: 'inspect',
                prompt: '[E] FLOATING PANELS',
                inspectDialog: 'They\'re incomplete alone, but together… they\'ll speak.',
                content: 'Ethereal panels displaying fragmented memories and symbols.'
            }
        ],
        itemSpawns: [
            { itemId: 'color_lens', pos: new THREE.Vector3(-7, 1.1, 6) }  // On pedestal - for Room 4
        ],
        selfDialogTriggers: [
            {
                name: 'room_enter',
                pos: new THREE.Vector3(0, 0, 8),
                radius: 3,
                dialog: 'Everything I\'ve found… it leads here.',
                triggered: false
            },
            {
                name: 'memory_box_approach',
                pos: new THREE.Vector3(0, 0, 0),
                radius: 4,
                dialog: 'It only opens if I know the whole truth… three pieces, one key.',
                triggered: false
            }
        ],
        group: null,
        colliders: []
    },

    // =========================================================================
    // TEST RANGE (Gun Range for Levitation Testing)
    // =========================================================================
    ROOM_TESTRANGE: {
        name: 'TEST RANGE',
        camera: { pos: [0, 8, 12], target: [0, 1, -5] },
        spawn: new THREE.Vector3(0, 0.05, 8),
        lighting: 'vfx',
        puzzleCompleted: false,
        cameraZones: [
            {
                name: 'general_room',
                type: 'general',
                priority: 0,
                bounds: { x1: -15, x2: 15, z1: -15, z2: 15 },
                cameraPosition: { x: 0, y: 10, z: 12 },
                cameraTarget: { x: 0, y: 1, z: -5 },
                transitionSpeed: 0.06
            }
        ],
        geometry: [
            // Floor - industrial grey, extended back (collider for ball physics)
            { name: 'floor', dim: [30, 0.2, 50], pos: [0, 0, -5], color: 0x333333, collider: true },

            // Ceiling (collider for ball physics)
            { name: 'ceiling', dim: [30, 0.2, 50], pos: [0, 15, -5], color: 0x222222, collider: true },

            // Walls - extended and higher
            { name: 'wall_n', dim: [30, 15, 0.5], pos: [0, 7.5, -25], color: 0x444444, collider: true },
            { name: 'wall_s', dim: [30, 15, 0.5], pos: [0, 7.5, 15], color: 0x444444, collider: true },
            { name: 'wall_e', dim: [0.5, 15, 50], pos: [15, 7.5, -5], color: 0x444444, collider: true },
            { name: 'wall_w', dim: [0.5, 15, 50], pos: [-15, 7.5, -5], color: 0x444444, collider: true },

            // Divider Wall (Medium height) - player stands behind this
            { name: 'divider_wall', dim: [20, 3, 0.5], pos: [0, 1.5, 2], color: 0x555555, collider: true },
            // Counter/Shelf on top of divider
            { name: 'divider_counter', dim: [20, 0.2, 1], pos: [0, 3.1, 2], color: 0x666666, collider: false },

            // Target Platform (where the ball will be)
            { name: 'target_platform', dim: [4, 0.3, 4], pos: [0, 0.15, -8], color: 0x222288, collider: true },

            // Lane Markers (visual guides)
            { name: 'lane_marker_1', dim: [0.1, 0.05, 20], pos: [-5, 0.15, -10], color: 0xFFFF00, collider: false },
            { name: 'lane_marker_2', dim: [0.1, 0.05, 20], pos: [5, 0.15, -10], color: 0xFFFF00, collider: false },

            // Ceiling lights (visual)
            { name: 'ceiling_light_1', dim: [2, 0.2, 0.5], pos: [-5, 14, 0], color: 0xFFFFCC, collider: false },
            { name: 'ceiling_light_2', dim: [2, 0.2, 0.5], pos: [5, 14, 0], color: 0xFFFFCC, collider: false },
            { name: 'ceiling_light_3', dim: [2, 0.2, 0.5], pos: [0, 14, -12], color: 0xFFFFCC, collider: false }
        ],
        hotspots: [],
        itemSpawns: [],
        selfDialogTriggers: [],
        // LEVITATION PUZZLE ZONE - player presses E to activate
        levitationZones: [
            {
                id: 'testrange_levitation',
                bounds: { x1: -10, x2: 10, z1: -15, z2: 5 },  // Area in front of divider wall
                cameraPosition: { x: 0, y: 10, z: 12 },       // Fixed overhead camera
                cameraTarget: { x: 0, y: 1, z: -5 },
                allowedObjects: ['LevitationBall']
            }
        ],
        group: null,
        colliders: []
    }
};

// Room order for linear progression
export const ROOM_ORDER = [
    'ROOM_CONCERT',
    'ROOM_MUSICVIDEO',
    'ROOM_3DART',
    'ROOM_MUSIC',
    'ROOM_GAMEDEV',
    'ROOM_ABOUTME'
];
