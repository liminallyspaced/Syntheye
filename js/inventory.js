// =================================================================================
// --- INVENTORY.JS - Inventory System Core ---
// =================================================================================
// Manages player inventory: items, active item, UI state, drag-and-drop.
// Emits events for world integration (pickup/drop).
// =================================================================================

import { STATE } from './config.js';
import { SoundManager } from './sound.js';

// =================================================================================
// INVENTORY STATE
// =================================================================================
export const inventoryState = {
    items: [],              // Array of item IDs the player owns
    activeItemId: null,     // Currently equipped/active item ID
    selectedIndex: 0,       // Currently selected slot in UI
    uiState: 'CLOSED',      // CLOSED | LIST | INSPECT
    inspectedItemId: null,  // Item being inspected (in INSPECT state)
    dragState: {
        isDragging: false,
        draggedItemId: null,
        dragOriginIndex: -1
    }
};

// Maximum inventory slots
export const MAX_SLOTS = 12;

// =================================================================================
// ITEM DATA - All collectible items in the game
// =================================================================================
export const ITEM_DATA = {
    // =========================================================================
    // ROOM 1: CONCERT ROOM ITEMS
    // =========================================================================
    'statue_head_left': {
        name: 'Statue Head (Left Half)',
        description: 'A cracked stone head, the left half. Part of who you once were.',
        icon: '🗿',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'statue_head_right': {
        name: 'Statue Head (Right Half)',
        description: 'A cracked stone head, the right half. Memories trapped within.',
        icon: '🗿',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'backstage_key': {
        name: 'Backstage Key',
        description: 'A worn metal key. Opens the path to the next chapter.',
        icon: '🔑',
        modelPath: null,
        canEquip: true
    },
    'film_reel_c': {
        name: 'Film Reel Fragment C',
        description: 'A piece of celluloid found in the road case. Part of a larger story.',
        icon: '🎞️',
        modelPath: null,
        canEquip: false,
        puzzleItem: true,
        usedIn: 'ROOM_MUSICVIDEO'
    },

    // =========================================================================
    // ROOM 2: MUSIC VIDEOS ROOM ITEMS
    // =========================================================================
    'reel_a': {
        name: 'Film Reel A',
        description: 'A complete film reel. Ready for projection.',
        icon: '🎬',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'reel_b': {
        name: 'Film Reel B',
        description: 'A complete film reel found in Room 5. The middle chapter.',
        icon: '🎬',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'film_reel_fragment': {
        name: 'Film Reel Fragment',
        description: 'A piece of celluloid. The story continues...',
        icon: '🎞️',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },

    // =========================================================================
    // ROOM 3: 3D ART ROOM ITEMS
    // =========================================================================
    'render_shard_a': {
        name: 'Render Shard A',
        description: 'A wireframe fragment glowing faintly blue.',
        icon: '🔷',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'render_shard_b': {
        name: 'Render Shard B',
        description: 'A polygonal piece, edges sharp and digital.',
        icon: '🔷',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'render_shard_c': {
        name: 'Render Shard C',
        description: 'The final piece. Your learning journey made tangible.',
        icon: '🔷',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'shape_block': {
        name: 'Shape Puzzle Block',
        description: 'A geometric block with symbols on each face. Used in the VFX room.',
        icon: '🧊',
        modelPath: null,
        canEquip: false,
        puzzleItem: true,
        usedIn: 'ROOM_VFX'
    },

    // =========================================================================
    // ROOM 4: MUSIC ROOM ITEMS
    // =========================================================================
    'tuning_dial': {
        name: 'Tuning Dial',
        description: 'A worn radio knob. Turn it to find the right frequency.',
        icon: '🎛️',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'fx_element_1': {
        name: 'FX Layer: Fire',
        description: 'A base layer effect. Flames dance within.',
        icon: '🔥',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'fx_element_2': {
        name: 'FX Layer: Smoke',
        description: 'A middle layer effect. Wreathing smoke.',
        icon: '💨',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'fx_element_3': {
        name: 'FX Layer: Sparks',
        description: 'A top layer effect. Electric sparks.',
        icon: '✨',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'color_lens': {
        name: 'Color Lens',
        description: 'A special filter lens. See what\'s hidden behind the green.',
        icon: '🔮',
        modelPath: null,
        canEquip: true,
        puzzleItem: false,
        usedIn: 'ROOM_VFX'
    },

    // =========================================================================
    // ROOM 5: GAME DEV ROOM ITEMS
    // =========================================================================
    'circuit_fuse': {
        name: 'Circuit Fuse',
        description: 'A small cylindrical fuse with a flickering emissive strip.',
        icon: '⚡',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'debug_keycard': {
        name: 'Debug Keycard',
        description: 'An ID badge with a pixelated barcode. Access granted.',
        icon: '💳',
        modelPath: null,
        canEquip: true
    },

    // =========================================================================
    // ROOM 6: ABOUT ME ROOM ITEMS
    // =========================================================================
    'memory_fragment_1': {
        name: 'Memory Fragment 1',
        description: 'A blurred concert shot. The beginning.',
        icon: '📸',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'memory_fragment_2': {
        name: 'Memory Fragment 2',
        description: 'A pixelated 3D scene render. Growth.',
        icon: '📸',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },
    'memory_fragment_3': {
        name: 'Memory Fragment 3',
        description: 'A frame from a music video. Expression.',
        icon: '📸',
        modelPath: null,
        canEquip: false,
        puzzleItem: true
    },

    // =========================================================================
    // LEGACY TEST ITEMS (can be removed later)
    // =========================================================================
    'key_rusty': {
        name: 'Rusty Key',
        description: 'An old rusty key. Might open something...',
        icon: '🔑',
        modelPath: null,
        canEquip: true
    },
    'flashlight': {
        name: 'Flashlight',
        description: 'A dim flashlight. Better than nothing.',
        icon: '🔦',
        modelPath: null,
        canEquip: true
    },
    'note_cryptic': {
        name: 'Cryptic Note',
        description: 'A note with strange symbols.',
        icon: '📜',
        modelPath: null,
        canEquip: false
    }
};

// =================================================================================
// CALLBACKS (set by game layer for world integration)
// =================================================================================
let onItemDroppedToWorldCallback = null;
let onInventoryStateChangeCallback = null;

export function setOnItemDroppedToWorld(callback) {
    onItemDroppedToWorldCallback = callback;
}

export function setOnInventoryStateChange(callback) {
    onInventoryStateChangeCallback = callback;
}

function notifyStateChange() {
    if (onInventoryStateChangeCallback) {
        onInventoryStateChangeCallback(inventoryState);
    }
}

// =================================================================================
// OPEN / CLOSE / TOGGLE
// =================================================================================
export function openInventory() {
    if (inventoryState.uiState === 'CLOSED') {
        inventoryState.uiState = 'LIST';
        inventoryState.selectedIndex = 0;
        STATE.interaction_mode = 'INVENTORY';
        SoundManager.playBlip();
        notifyStateChange();
        return true;
    }
    return false;
}

export function closeInventory() {
    if (inventoryState.uiState !== 'CLOSED') {
        inventoryState.uiState = 'CLOSED';
        inventoryState.inspectedItemId = null;
        cancelDrag();
        STATE.interaction_mode = 'OVERWORLD';
        SoundManager.playBlip();
        notifyStateChange();
        return true;
    }
    return false;
}

export function toggleInventory() {
    if (inventoryState.uiState === 'CLOSED') {
        return openInventory();
    } else {
        return closeInventory();
    }
}

export function isInventoryOpen() {
    return inventoryState.uiState !== 'CLOSED';
}

// =================================================================================
// ITEM MANAGEMENT
// =================================================================================
export function addItem(itemId) {
    if (!ITEM_DATA[itemId]) {
        console.warn(`Unknown item: ${itemId}`);
        return false;
    }
    if (inventoryState.items.length >= MAX_SLOTS) {
        console.warn('Inventory full!');
        return false;
    }
    if (inventoryState.items.includes(itemId)) {
        console.warn(`Already have item: ${itemId}`);
        return false;
    }

    inventoryState.items.push(itemId);
    SoundManager.playSuccess();
    notifyStateChange();
    console.log(`Added item: ${itemId}`);
    return true;
}

export function removeItem(itemId) {
    const index = inventoryState.items.indexOf(itemId);
    if (index === -1) {
        return false;
    }

    inventoryState.items.splice(index, 1);

    // Clear active if we removed the active item
    if (inventoryState.activeItemId === itemId) {
        inventoryState.activeItemId = null;
    }

    // Adjust selected index if needed
    if (inventoryState.selectedIndex >= inventoryState.items.length) {
        inventoryState.selectedIndex = Math.max(0, inventoryState.items.length - 1);
    }

    notifyStateChange();
    return true;
}

export function hasItem(itemId) {
    return inventoryState.items.includes(itemId);
}

export function getItems() {
    return [...inventoryState.items];
}

export function getItemData(itemId) {
    return ITEM_DATA[itemId] || null;
}

// =================================================================================
// SELECTION
// =================================================================================
export function selectSlot(index) {
    if (index >= 0 && index < MAX_SLOTS) {
        inventoryState.selectedIndex = index;
        SoundManager.playTone(400, 'sine', 0.05, 0.03);
        notifyStateChange();
    }
}

export function selectNext() {
    const newIndex = (inventoryState.selectedIndex + 1) % MAX_SLOTS;
    selectSlot(newIndex);
}

export function selectPrev() {
    const newIndex = (inventoryState.selectedIndex - 1 + MAX_SLOTS) % MAX_SLOTS;
    selectSlot(newIndex);
}

export function selectDown() {
    // Assuming 4 columns
    const cols = 4;
    const newIndex = (inventoryState.selectedIndex + cols) % MAX_SLOTS;
    selectSlot(newIndex);
}

export function selectUp() {
    const cols = 4;
    const newIndex = (inventoryState.selectedIndex - cols + MAX_SLOTS) % MAX_SLOTS;
    selectSlot(newIndex);
}

export function getSelectedItemId() {
    return inventoryState.items[inventoryState.selectedIndex] || null;
}

// =================================================================================
// ACTIVE ITEM (EQUIP)
// =================================================================================
export function setActiveItem(itemId) {
    if (itemId && !inventoryState.items.includes(itemId)) {
        return false;
    }

    const itemData = ITEM_DATA[itemId];
    if (itemId && itemData && !itemData.canEquip) {
        console.log(`Cannot equip: ${itemId}`);
        return false;
    }

    // Toggle off if same item
    if (inventoryState.activeItemId === itemId) {
        inventoryState.activeItemId = null;
    } else {
        inventoryState.activeItemId = itemId;
    }

    SoundManager.playSelect();
    notifyStateChange();
    return true;
}

export function clearActiveItem() {
    inventoryState.activeItemId = null;
    notifyStateChange();
}

export function getActiveItemId() {
    return inventoryState.activeItemId;
}

export function equipSelectedItem() {
    const itemId = getSelectedItemId();
    if (itemId) {
        return setActiveItem(itemId);
    }
    return false;
}

// =================================================================================
// INSPECT MODE
// =================================================================================
export function inspectSelectedItem() {
    const itemId = getSelectedItemId();
    if (itemId && inventoryState.uiState === 'LIST') {
        inventoryState.uiState = 'INSPECT';
        inventoryState.inspectedItemId = itemId;
        SoundManager.playBlip();
        notifyStateChange();
        return true;
    }
    return false;
}

export function exitInspect() {
    if (inventoryState.uiState === 'INSPECT') {
        inventoryState.uiState = 'LIST';
        inventoryState.inspectedItemId = null;
        SoundManager.playBlip();
        notifyStateChange();
        return true;
    }
    return false;
}

// =================================================================================
// DRAG & DROP
// =================================================================================
export function startDrag(slotIndex) {
    if (inventoryState.uiState !== 'LIST') return false;

    const itemId = inventoryState.items[slotIndex];
    if (!itemId) return false;

    inventoryState.dragState.isDragging = true;
    inventoryState.dragState.draggedItemId = itemId;
    inventoryState.dragState.dragOriginIndex = slotIndex;

    notifyStateChange();
    return true;
}

export function cancelDrag() {
    inventoryState.dragState.isDragging = false;
    inventoryState.dragState.draggedItemId = null;
    inventoryState.dragState.dragOriginIndex = -1;
    notifyStateChange();
}

export function endDragOnSlot(targetIndex) {
    if (!inventoryState.dragState.isDragging) return false;

    const originIndex = inventoryState.dragState.dragOriginIndex;

    if (targetIndex !== originIndex && targetIndex >= 0 && targetIndex < inventoryState.items.length) {
        // Swap items
        const temp = inventoryState.items[originIndex];
        inventoryState.items[originIndex] = inventoryState.items[targetIndex];
        inventoryState.items[targetIndex] = temp;
        SoundManager.playTone(300, 'triangle', 0.1, 0.05);
    }

    cancelDrag();
    return true;
}

export function endDragOnDropBox() {
    if (!inventoryState.dragState.isDragging) return false;

    const itemId = inventoryState.dragState.draggedItemId;

    // Remove from inventory
    removeItem(itemId);

    // Notify world to spawn the item
    if (onItemDroppedToWorldCallback) {
        onItemDroppedToWorldCallback(itemId, {
            playerPosition: STATE.player_pos.clone()
        });
    }

    SoundManager.playDoor(); // Drop sound
    cancelDrag();
    return true;
}

export function isDragging() {
    return inventoryState.dragState.isDragging;
}

export function getDraggedItemId() {
    return inventoryState.dragState.draggedItemId;
}

// =================================================================================
// DEBUG: Add test items
// =================================================================================
export function addTestItems() {
    addItem('key_rusty');
    addItem('flashlight');
    addItem('note_cryptic');
}
