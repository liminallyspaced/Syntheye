export const STATE = {
    screen: 'video', 
    room: 'ROOM_HALL',
    // Using object literal to avoid THREE dependency in constants
    pos: {x:0, y:1, z:0}, 
    target: null, 
    activeHotspot: null,
    cluesFound: [false, false, false],
    secretUnlocked: false,
    audioEnabled: true,
    music_volume: 0.5
};

export const PORTFOLIO_CONTENT = {
    clue_clock: { title: 'CLOCK NOTE', text: "The hour hand points to ONE. Not 1 o'clock, but one clue.", type: 'puzzle' },
    gallery_model1: { title: 'THE WATCHER', text: "Low-poly character model. 2024.", type: 'inspect' },
    archive_concept: { title: 'CONCEPT ART', text: "Early sketches of the facility.", type: 'text' }
};

export const ROOM_DATA = {
    ROOM_HALL: {
        name: "MAIN HALL",
        camPos: [10, 8, 10], camTarget: [0, 0, 0],
        spawn: [0, 1, 0],
        geometry: [
            { type: 'box', dim: [20, 0.2, 20], pos: [0, 0, 0], color: 0x2a2a2a, name: 'floor' }, 
            { type: 'box', dim: [1, 4, 1], pos: [5, 2, -5], color: 0x3d2719, name: 'clock', hotspot: { type: 'inspect', id: 'gallery_model1', title: 'GRANDFATHER CLOCK', text: "Time stands still...", clueIdx: 0 } }
        ],
        hotspots: [
            { type: 'door', pos: [0, 1, -9], radius: 1.5, target: 'ROOM_GALLERY', spawn: [0, 1, 8], label: 'GALLERY' },
            { type: 'door', pos: [-9, 1, 0], radius: 1.5, target: 'ROOM_ARCHIVE', spawn: [8, 1, 0], label: 'ARCHIVE' }
        ]
    },
    ROOM_GALLERY: {
        name: "THE GALLERY",
        camPos: [-10, 6, 0], camTarget: [0, 1, 0],
        spawn: [0, 1, 8],
        geometry: [
            { type: 'box', dim: [20, 0.2, 20], pos: [0, 0, 0], color: 0x1a1a1a, name: 'floor' },
            { type: 'box', dim: [2, 1, 2], pos: [0, 0.5, 0], color: 0x550000, name: 'pedestal', hotspot: { type: 'inspect', id: 'gallery_model1', title: 'ARTIFACT', text: "Strange geometry.", clueIdx: 1 } }
        ],
        hotspots: [
            { type: 'door', pos: [0, 1, 9], radius: 1.5, target: 'ROOM_HALL', spawn: [0, 1, -8], label: 'MAIN HALL' }
        ]
    },
    ROOM_ARCHIVE: {
        name: "ARCHIVE STORAGE",
        camPos: [0, 10, 0], camTarget: [0, 0, 0],
        spawn: [8, 1, 0],
        geometry: [
            { type: 'box', dim: [20, 0.2, 10], pos: [0, 0, 0], color: 0x1a2a1a, name: 'floor' },
            { type: 'box', dim: [2, 2, 2], pos: [-5, 1, 0], color: 0x444444, name: 'files', hotspot: { type: 'text', id: 'archive_concept', title: 'LOGS', text: "System corrupted...", clueIdx: 2 } }
        ],
        hotspots: [
            { type: 'door', pos: [9, 1, 0], radius: 1.5, target: 'ROOM_HALL', spawn: [-8, 1, 0], label: 'MAIN HALL' }
        ]
    }
};