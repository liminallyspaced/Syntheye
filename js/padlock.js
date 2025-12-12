// =================================================================================
// --- PADLOCK.JS - 4-Digit Padlock Puzzle System ---
// =================================================================================
// Provides a 4-digit combination lock UI with up/down arrow controls.
// Used for locked objects that require a password to open.
// =================================================================================

import { SoundManager } from './sound.js';

// =================================================================================
// PADLOCK STATE
// =================================================================================
let padlockState = {
    isOpen: false,
    digits: [0, 0, 0, 0],      // Current digit values (0-9 each)
    correctCode: '0000',        // The correct combination
    onSuccess: null,            // Callback when solved
    hotspotId: null             // ID of hotspot that opened this padlock
};

// =================================================================================
// OPEN PADLOCK UI
// =================================================================================
/**
 * Opens the padlock UI for a specific locked object.
 * @param {string} correctCode - The 4-digit code (e.g., "2017")
 * @param {Function} onSuccess - Callback when puzzle is solved
 * @param {string} hotspotId - Optional ID to track which hotspot opened this
 */
export function openPadlock(correctCode, onSuccess, hotspotId = null) {
    padlockState.isOpen = true;
    padlockState.digits = [0, 0, 0, 0];
    padlockState.correctCode = correctCode.toString().padStart(4, '0');
    padlockState.onSuccess = onSuccess;
    padlockState.hotspotId = hotspotId;

    renderPadlock();
    document.getElementById('padlock-overlay').classList.remove('hidden');

    console.log(`Padlock opened for: ${hotspotId}`);
}

// =================================================================================
// CLOSE PADLOCK UI
// =================================================================================
export function closePadlock() {
    padlockState.isOpen = false;
    padlockState.onSuccess = null;
    document.getElementById('padlock-overlay').classList.add('hidden');
}

// =================================================================================
// CHECK IF PADLOCK IS OPEN
// =================================================================================
export function isPadlockOpen() {
    return padlockState.isOpen;
}

// =================================================================================
// CHANGE DIGIT VALUE
// =================================================================================
function changeDigit(index, direction) {
    let newValue = padlockState.digits[index] + direction;

    // Wrap around 0-9
    if (newValue > 9) newValue = 0;
    if (newValue < 0) newValue = 9;

    padlockState.digits[index] = newValue;

    // Play click sound
    SoundManager.playSelect?.();

    // Update display
    updateDigitDisplay(index);

    // Check if solved
    checkSolution();
}

// =================================================================================
// CHECK SOLUTION
// =================================================================================
function checkSolution() {
    const currentCode = padlockState.digits.join('');

    if (currentCode === padlockState.correctCode) {
        console.log('Padlock solved!');

        // Visual feedback - green flash
        const container = document.getElementById('padlock-container');
        container.classList.add('padlock-solved');

        // Play success sound
        SoundManager.playInteract?.();

        // Delay close for visual feedback
        setTimeout(() => {
            // Call success callback
            if (padlockState.onSuccess) {
                padlockState.onSuccess(padlockState.hotspotId);
            }

            closePadlock();
        }, 800);
    }
}

// =================================================================================
// UPDATE SINGLE DIGIT DISPLAY
// =================================================================================
function updateDigitDisplay(index) {
    const digitElement = document.getElementById(`padlock-digit-${index}`);
    if (digitElement) {
        digitElement.textContent = padlockState.digits[index];
    }
}

// =================================================================================
// RENDER PADLOCK UI
// =================================================================================
function renderPadlock() {
    const container = document.getElementById('padlock-container');
    if (!container) return;

    container.classList.remove('padlock-solved');

    let html = `
        <div class="padlock-header">ENTER COMBINATION</div>
        <div class="padlock-wheels">
    `;

    for (let i = 0; i < 4; i++) {
        html += `
            <div class="padlock-wheel">
                <button class="padlock-arrow up" onclick="window.padlockDigitUp(${i})">▲</button>
                <div class="padlock-digit" id="padlock-digit-${i}">${padlockState.digits[i]}</div>
                <button class="padlock-arrow down" onclick="window.padlockDigitDown(${i})">▼</button>
            </div>
        `;
    }

    html += `
        </div>
        <button class="padlock-close" onclick="window.closePadlockUI()">CANCEL</button>
    `;

    container.innerHTML = html;
}

// =================================================================================
// GLOBAL HANDLERS (for onclick)
// =================================================================================
window.padlockDigitUp = (index) => changeDigit(index, 1);
window.padlockDigitDown = (index) => changeDigit(index, -1);
window.closePadlockUI = closePadlock;

// =================================================================================
// KEYBOARD CONTROLS
// =================================================================================
export function handlePadlockKeydown(event) {
    if (!padlockState.isOpen) return false;

    const key = event.key.toLowerCase();

    // ESC to close
    if (key === 'escape') {
        closePadlock();
        return true;
    }

    // Number keys to set digits quickly
    if (key >= '0' && key <= '9') {
        // Find first non-set digit or cycle through
        const num = parseInt(key);
        // Shift existing digits left and add new one
        padlockState.digits.shift();
        padlockState.digits.push(num);
        renderPadlock();
        checkSolution();
        return true;
    }

    return false;
}
