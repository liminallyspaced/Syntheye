// =================================================================================
// --- INVENTORY-UI.JS - Inventory UI Rendering ---
// =================================================================================
// Handles rendering the inventory UI, drag-and-drop visuals, and user input.
// =================================================================================

import {
    inventoryState,
    MAX_SLOTS,
    ITEM_DATA,
    toggleInventory,
    closeInventory,
    selectSlot,
    selectUp,
    selectDown,
    selectNext,
    selectPrev,
    equipSelectedItem,
    inspectSelectedItem,
    exitInspect,
    startDrag,
    cancelDrag,
    endDragOnSlot,
    endDragOnDropBox,
    isDragging,
    getDraggedItemId,
    setOnInventoryStateChange,
    getSelectedItemId
} from './inventory.js';
import { SoundManager } from './sound.js';

// =================================================================================
// DOM REFERENCES
// =================================================================================
let inventoryOverlay = null;
let inventoryGrid = null;
let dropBox = null;
let dragGhost = null;
let inspectOverlay = null;
let inspectItemName = null;
let inspectItemDesc = null;

// =================================================================================
// INITIALIZATION
// =================================================================================
export function initInventoryUI() {
    // Create inventory overlay
    createInventoryHTML();

    // Get DOM references
    inventoryOverlay = document.getElementById('inventory-overlay');
    inventoryGrid = document.getElementById('inventory-grid');
    dropBox = document.getElementById('drop-box');
    dragGhost = document.getElementById('drag-ghost');
    inspectOverlay = document.getElementById('inspect-overlay');
    inspectItemName = document.getElementById('inspect-item-name');
    inspectItemDesc = document.getElementById('inspect-item-desc');

    // Set up event listeners
    setupEventListeners();

    // Subscribe to state changes
    setOnInventoryStateChange(renderInventory);

    console.log('Inventory UI initialized');
}

// =================================================================================
// CREATE HTML STRUCTURE
// =================================================================================
function createInventoryHTML() {
    // Check if already exists
    if (document.getElementById('inventory-overlay')) return;

    const html = `
        <!-- Inventory Overlay -->
        <div id="inventory-overlay" class="hidden">
            <div id="inventory-panel">
                <div id="inventory-title">▼ INVENTORY ▼</div>
                <div id="inventory-grid"></div>
                <div id="drop-box">
                    <span>⬇ DROP ⬇</span>
                </div>
                <div id="inventory-actions">
                    <button id="btn-inspect" class="inv-btn">[ INSPECT ]</button>
                    <button id="btn-equip" class="inv-btn">[ EQUIP ]</button>
                    <button id="btn-close" class="inv-btn">[ CLOSE ]</button>
                </div>
                <div id="inventory-hint">TAB: Close | WASD: Navigate | E: Inspect | SPACE: Equip</div>
            </div>
            <div id="drag-ghost" class="hidden"></div>
        </div>
        
        <!-- Inspect Overlay -->
        <div id="inspect-overlay" class="hidden">
            <div id="inspect-panel">
                <div id="inspect-item-name">ITEM NAME</div>
                <div id="inspect-item-icon"></div>
                <div id="inspect-item-desc">Item description goes here.</div>
                <button id="btn-inspect-back" class="inv-btn">[ BACK ]</button>
            </div>
        </div>
    `;

    // Insert before #three-container
    const container = document.getElementById('three-container');
    container.insertAdjacentHTML('beforebegin', html);

    // Add styles
    addInventoryStyles();
}

// =================================================================================
// ADD CSS STYLES
// =================================================================================
function addInventoryStyles() {
    if (document.getElementById('inventory-styles')) return;

    const styles = `
        <style id="inventory-styles">
            #inventory-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                font-family: 'Press Start 2P', monospace;
            }
            
            #inventory-overlay.hidden {
                display: none;
            }
            
            #inventory-panel {
                background: linear-gradient(135deg, #1a0a0a 0%, #2d1515 50%, #1a0808 100%);
                border: 3px solid #8b0000;
                box-shadow: 0 0 30px rgba(139, 0, 0, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.8);
                padding: 20px;
                min-width: 400px;
                max-width: 500px;
            }
            
            #inventory-title {
                text-align: center;
                color: #ff4444;
                font-size: 14px;
                margin-bottom: 15px;
                text-shadow: 0 0 10px #ff0000;
                letter-spacing: 4px;
            }
            
            #inventory-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 15px;
            }
            
            .inv-slot {
                width: 70px;
                height: 70px;
                background: rgba(0, 0, 0, 0.6);
                border: 2px solid #333;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 28px;
                cursor: pointer;
                transition: all 0.15s;
                position: relative;
            }
            
            .inv-slot:hover {
                border-color: #666;
                background: rgba(50, 20, 20, 0.6);
            }
            
            .inv-slot.selected {
                border-color: #ff4444;
                box-shadow: 0 0 15px rgba(255, 68, 68, 0.5);
            }
            
            .inv-slot.active::after {
                content: '★';
                position: absolute;
                top: 2px;
                right: 4px;
                font-size: 10px;
                color: #ffdd00;
            }
            
            .inv-slot.drag-over {
                border-color: #00ff00;
                background: rgba(0, 50, 0, 0.5);
            }
            
            .inv-slot.empty {
                opacity: 0.4;
            }
            
            #drop-box {
                background: linear-gradient(180deg, #3d0000 0%, #1a0000 100%);
                border: 2px dashed #ff0000;
                padding: 12px;
                text-align: center;
                color: #ff4444;
                font-size: 10px;
                margin-bottom: 15px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            #drop-box:hover, #drop-box.drag-over {
                background: linear-gradient(180deg, #5a0000 0%, #2a0000 100%);
                border-color: #ff4444;
                box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
            }
            
            #inventory-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-bottom: 10px;
            }
            
            .inv-btn {
                background: #1a0a0a;
                border: 2px solid #8b0000;
                color: #ff4444;
                padding: 8px 12px;
                font-family: 'Press Start 2P', monospace;
                font-size: 8px;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .inv-btn:hover {
                background: #3d0000;
                border-color: #ff4444;
                box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
            }
            
            #inventory-hint {
                text-align: center;
                color: #666;
                font-size: 6px;
                margin-top: 10px;
            }
            
            #drag-ghost {
                position: fixed;
                pointer-events: none;
                width: 60px;
                height: 60px;
                background: rgba(0, 0, 0, 0.8);
                border: 2px solid #ff4444;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 28px;
                z-index: 1001;
                opacity: 0.9;
                transform: translate(-50%, -50%);
            }
            
            #drag-ghost.hidden {
                display: none;
            }
            
            /* Inspect Overlay */
            #inspect-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1001;
                font-family: 'Press Start 2P', monospace;
            }
            
            #inspect-overlay.hidden {
                display: none;
            }
            
            #inspect-panel {
                background: linear-gradient(135deg, #0a0a1a 0%, #151530 50%, #08081a 100%);
                border: 3px solid #4444ff;
                box-shadow: 0 0 30px rgba(68, 68, 255, 0.5);
                padding: 30px;
                text-align: center;
                min-width: 350px;
            }
            
            #inspect-item-name {
                color: #8888ff;
                font-size: 14px;
                margin-bottom: 20px;
                text-shadow: 0 0 10px #4444ff;
            }
            
            #inspect-item-icon {
                font-size: 80px;
                margin: 20px 0;
            }
            
            #inspect-item-desc {
                color: #aaa;
                font-size: 8px;
                line-height: 1.8;
                margin-bottom: 20px;
                max-width: 300px;
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
}

// =================================================================================
// RENDER FUNCTIONS
// =================================================================================
export function renderInventory() {
    if (!inventoryOverlay) return;

    // Show/hide overlays based on state
    if (inventoryState.uiState === 'CLOSED') {
        inventoryOverlay.classList.add('hidden');
        inspectOverlay.classList.add('hidden');
        return;
    }

    if (inventoryState.uiState === 'LIST') {
        inventoryOverlay.classList.remove('hidden');
        inspectOverlay.classList.add('hidden');
        renderSlots();
    } else if (inventoryState.uiState === 'INSPECT') {
        inventoryOverlay.classList.add('hidden');
        inspectOverlay.classList.remove('hidden');
        renderInspectView();
    }
}

function renderSlots() {
    if (!inventoryGrid) return;

    inventoryGrid.innerHTML = '';

    for (let i = 0; i < MAX_SLOTS; i++) {
        const itemId = inventoryState.items[i];
        const itemData = itemId ? ITEM_DATA[itemId] : null;
        const isSelected = i === inventoryState.selectedIndex;
        const isActive = itemId === inventoryState.activeItemId;
        const isEmpty = !itemId;

        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.dataset.index = i;

        if (isSelected) slot.classList.add('selected');
        if (isActive) slot.classList.add('active');
        if (isEmpty) slot.classList.add('empty');

        if (itemData) {
            slot.textContent = itemData.icon;
            slot.title = itemData.name;
        }

        inventoryGrid.appendChild(slot);
    }
}

function renderInspectView() {
    const itemId = inventoryState.inspectedItemId;
    const itemData = itemId ? ITEM_DATA[itemId] : null;

    if (!itemData) return;

    inspectItemName.textContent = itemData.name.toUpperCase();
    document.getElementById('inspect-item-icon').textContent = itemData.icon;
    inspectItemDesc.textContent = itemData.description;
}

// =================================================================================
// EVENT LISTENERS
// =================================================================================
function setupEventListeners() {
    // Click handlers for slots
    inventoryGrid.addEventListener('click', (e) => {
        const slot = e.target.closest('.inv-slot');
        if (slot) {
            const index = parseInt(slot.dataset.index);
            selectSlot(index);
        }
    });

    // Double-click to inspect
    inventoryGrid.addEventListener('dblclick', (e) => {
        const slot = e.target.closest('.inv-slot');
        if (slot && inventoryState.items[parseInt(slot.dataset.index)]) {
            inspectSelectedItem();
        }
    });

    // Drag start
    inventoryGrid.addEventListener('mousedown', (e) => {
        const slot = e.target.closest('.inv-slot');
        if (slot && inventoryState.items[parseInt(slot.dataset.index)]) {
            const index = parseInt(slot.dataset.index);
            selectSlot(index);
            startDrag(index);
            updateGhostPosition(e.clientX, e.clientY);
            showGhost();
        }
    });

    // Mouse move (for dragging)
    document.addEventListener('mousemove', (e) => {
        if (isDragging()) {
            updateGhostPosition(e.clientX, e.clientY);
            updateDragOverStates(e);
        }
    });

    // Mouse up (end drag)
    document.addEventListener('mouseup', (e) => {
        if (isDragging()) {
            handleDragEnd(e);
        }
    });

    // Button handlers
    document.getElementById('btn-inspect')?.addEventListener('click', () => {
        inspectSelectedItem();
    });

    document.getElementById('btn-equip')?.addEventListener('click', () => {
        equipSelectedItem();
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
        closeInventory();
    });

    document.getElementById('btn-inspect-back')?.addEventListener('click', () => {
        exitInspect();
    });

    // Drop box hover
    dropBox?.addEventListener('mouseenter', () => {
        if (isDragging()) {
            dropBox.classList.add('drag-over');
        }
    });

    dropBox?.addEventListener('mouseleave', () => {
        dropBox.classList.remove('drag-over');
    });
}

// =================================================================================
// DRAG HELPERS
// =================================================================================
function showGhost() {
    if (!dragGhost) return;
    const itemId = getDraggedItemId();
    const itemData = itemId ? ITEM_DATA[itemId] : null;
    if (itemData) {
        dragGhost.textContent = itemData.icon;
        dragGhost.classList.remove('hidden');
    }
}

function hideGhost() {
    if (dragGhost) {
        dragGhost.classList.add('hidden');
    }
}

function updateGhostPosition(x, y) {
    if (dragGhost) {
        dragGhost.style.left = x + 'px';
        dragGhost.style.top = y + 'px';
    }
}

function updateDragOverStates(e) {
    // Clear all drag-over states
    document.querySelectorAll('.inv-slot.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    // Check if over a slot
    const slot = document.elementFromPoint(e.clientX, e.clientY)?.closest('.inv-slot');
    if (slot) {
        slot.classList.add('drag-over');
    }
}

function handleDragEnd(e) {
    hideGhost();

    // Clear drag-over states
    document.querySelectorAll('.inv-slot.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    dropBox?.classList.remove('drag-over');

    // Check where we dropped
    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);

    // Check if dropped on drop box
    if (elementAtPoint?.closest('#drop-box')) {
        endDragOnDropBox();
        return;
    }

    // Check if dropped on a slot
    const slot = elementAtPoint?.closest('.inv-slot');
    if (slot) {
        const targetIndex = parseInt(slot.dataset.index);
        endDragOnSlot(targetIndex);
        return;
    }

    // Dropped elsewhere - cancel
    cancelDrag();
}

// =================================================================================
// KEYBOARD HANDLER (called from main.js)
// =================================================================================
export function handleInventoryKeydown(event) {
    if (inventoryState.uiState === 'CLOSED') {
        // TAB opens inventory
        if (event.key === 'Tab') {
            event.preventDefault();
            toggleInventory();
            return true;
        }
        return false;
    }

    // Inventory is open
    event.preventDefault();

    if (inventoryState.uiState === 'LIST') {
        switch (event.key.toLowerCase()) {
            case 'tab':
            case 'escape':
                closeInventory();
                break;
            case 'w':
            case 'arrowup':
                selectUp();
                break;
            case 's':
            case 'arrowdown':
                selectDown();
                break;
            case 'a':
            case 'arrowleft':
                selectPrev();
                break;
            case 'd':
            case 'arrowright':
                selectNext();
                break;
            case 'e':
            case 'enter':
                inspectSelectedItem();
                break;
            case ' ':
            case 'f':
                equipSelectedItem();
                break;
        }
    } else if (inventoryState.uiState === 'INSPECT') {
        switch (event.key.toLowerCase()) {
            case 'tab':
            case 'escape':
            case 'e':
            case 'enter':
                exitInspect();
                break;
        }
    }

    return true;
}
