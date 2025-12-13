/**
 * GestureConfig.js
 * Centralized gesture mapping for all game actions
 * Change gestures here to update them across ALL systems
 */

// Available gestures (from GestureRecognizer.js)
// NONE = 0, OPEN_HAND = 1, CLOSED_FIST = 2, PINCH = 3, TWO_FINGER = 4, THREE_FINGER = 5

export const GESTURE_CONFIG = {
    // === MODE A: LEVITATE ===
    modeA: {
        grab: 'OPEN_HAND',      // Gesture to pick up objects
        move: 'OPEN_HAND',      // Gesture to move objects (push/pull)
        drop: 'CLOSED_FIST',    // Gesture to drop objects
        freeze: 'PINCH',        // Gesture to freeze object in place
        throw: 'OPEN_HAND',     // Gesture that can trigger throw (with wrist flick)
        camera: 'OPEN_HAND',    // Gesture to control camera
    },

    // === MODE B: WIND ===
    modeB: {
        push: 'OPEN_HAND',      // Gesture to push objects with wind
        camera: 'OPEN_HAND',    // Gesture to control camera
    },

    // === SENSITIVITY THRESHOLDS ===
    thresholds: {
        windSwipeMin: 0.06,     // Minimum swipe velocity to trigger wind push
        wristFlickMin: 0.06,   // Minimum wrist flick to trigger wind
        throwFlickMin: 0.05,    // Minimum wrist flick to trigger throw
    }
};

// Helper to get gesture by name string
export function getGestureByName(gestureName, GESTURE) {
    return GESTURE[gestureName] ?? GESTURE.NONE;
}
