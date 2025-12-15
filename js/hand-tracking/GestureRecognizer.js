/**
 * GestureRecognizer.js
 * Analyzes MediaPipe hand landmarks to detect specific gestures.
 */

export const GESTURE = {
    NONE: 'NONE',
    PINCH: 'PINCH',                   // Camera Control (thumb + pointer touching)
    THREE_FINGER: 'THREE_FINGER',     // Pointer + Middle + Ring extended = Grab and move
    TWO_FINGER: 'TWO_FINGER',         // Pointer + Middle extended, Ring curled = Push/Pull
    ONE_FINGER: 'ONE_FINGER',         // Only pointer extended = Drop
    OPEN_HAND: 'OPEN_HAND',           // Throw (with directional flick)
    CLOSED_FIST: 'CLOSED_FIST'        // Not used currently
};

export class GestureRecognizer {
    constructor() {
        this.currentGesture = GESTURE.NONE;
        // Track hand velocity for throw detection
        this.previousPos = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.velocitySmoothed = { x: 0, y: 0 };

        // Track wrist flick velocity (angle change)
        this.previousWristAngle = 0;
        this.wristAngleVelocity = 0;
        this.wristAngleVelSmoothed = 0;

        // Gesture stabilization - prevent flickering during transitions
        this.lastRawGesture = GESTURE.NONE;
        this.gestureHoldCount = 0;
        this.gestureStabilityThreshold = 2; // Reduced for faster response
    }

    recognize(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            return this.currentGesture; // Keep last gesture if no landmarks
        }

        // Update velocity tracking using palm center
        const palmCenter = landmarks[9];
        const rawVelX = palmCenter.x - this.previousPos.x;
        const rawVelY = palmCenter.y - this.previousPos.y;

        // Smooth velocity
        this.velocitySmoothed.x = this.velocitySmoothed.x * 0.7 + rawVelX * 0.3;
        this.velocitySmoothed.y = this.velocitySmoothed.y * 0.7 + rawVelY * 0.3;
        this.velocity = { x: rawVelX, y: rawVelY };
        this.previousPos = { x: palmCenter.x, y: palmCenter.y };

        // === WRIST FLICK TRACKING ===
        // Calculate angle from wrist to middle fingertip
        const wrist = landmarks[0];
        const middleTip = landmarks[12];
        const dx = middleTip.x - wrist.x;
        const dy = middleTip.y - wrist.y;
        const currentAngle = Math.atan2(dy, dx);

        // Calculate angle velocity (how fast the wrist is rotating)
        const rawAngleVel = currentAngle - this.previousWristAngle;
        // Normalize angle difference to handle wrap-around
        const normalizedAngleVel = Math.abs(rawAngleVel) > Math.PI ?
            rawAngleVel - Math.sign(rawAngleVel) * 2 * Math.PI : rawAngleVel;

        this.wristAngleVelocity = normalizedAngleVel;
        this.wristAngleVelSmoothed = this.wristAngleVelSmoothed * 0.6 + Math.abs(normalizedAngleVel) * 0.4;
        this.previousWristAngle = currentAngle;

        // Detect raw gesture
        let rawGesture = GESTURE.NONE;

        // Priority order:
        // 1. Check ONE_FINGER first (pointer up only) - to avoid PINCH confusion
        if (this.isOneFinger(landmarks)) {
            rawGesture = GESTURE.ONE_FINGER;
        }
        // 2. Finger variants (2 or 3 fingers)
        else {
            const fingerResult = this.isFingerVariant(landmarks);
            if (fingerResult) {
                rawGesture = fingerResult;
            }
            // 3. PINCH (thumb + pointer close) - camera control
            else if (this.isPinch(landmarks)) {
                rawGesture = GESTURE.PINCH;
            }
            // 4. OPEN_HAND (all fingers extended) - for throw
            else if (this.isOpenHand(landmarks)) {
                rawGesture = GESTURE.OPEN_HAND;
            }
            // 5. CLOSED_FIST
            else if (this.isClosedFist(landmarks)) {
                rawGesture = GESTURE.CLOSED_FIST;
            }
        }

        // Gesture stabilization - require gesture to be held for multiple frames
        if (rawGesture === this.lastRawGesture) {
            this.gestureHoldCount++;
        } else {
            this.lastRawGesture = rawGesture;
            this.gestureHoldCount = 1;
        }

        // Only switch gesture if held for enough frames
        if (this.gestureHoldCount >= this.gestureStabilityThreshold) {
            this.currentGesture = rawGesture;
        }

        return this.currentGesture;
    }

    // Get velocity for throw direction
    getVelocity() {
        return this.velocitySmoothed;
    }

    // Get wrist flick velocity for throw strength
    getWristFlickVelocity() {
        return this.wristAngleVelSmoothed;
    }

    isPinch(landmarks) {
        // Thumb tip (4) close to Index tip (8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const distance = this.getDistance(thumbTip, indexTip);
        return distance < 0.05; // Lower threshold - easier to trigger pinch
    }

    isOneFinger(landmarks) {
        // Only index finger extended, all others curled (including thumb tucked)
        const wrist = landmarks[0];
        const palm = landmarks[9]; // Middle of palm

        const indexTipDist = this.getDistance(landmarks[8], wrist);
        const indexPipDist = this.getDistance(landmarks[6], wrist);
        const middleTipDist = this.getDistance(landmarks[12], wrist);
        const middlePipDist = this.getDistance(landmarks[10], wrist);
        const ringTipDist = this.getDistance(landmarks[16], wrist);
        const ringPipDist = this.getDistance(landmarks[14], wrist);
        const pinkyTipDist = this.getDistance(landmarks[20], wrist);
        const pinkyPipDist = this.getDistance(landmarks[18], wrist);
        const palmDist = this.getDistance(palm, wrist);

        // Index must be significantly extended - threshold from debug panel
        const threshold = window.levitationSettings?.oneFingerThreshold || 2.2;
        const indexExtended = indexTipDist > indexPipDist * threshold;

        // Index tip must be MUCH further than palm center (truly pointing out)
        const indexFurtherThanPalm = indexTipDist > palmDist * 1.8;

        // Index must be MUCH further than ALL other fingertips
        const indexFurtherThanMiddle = indexTipDist > middleTipDist * 1.6;
        const indexFurtherThanRing = indexTipDist > ringTipDist * 1.6;
        const indexFurtherThanPinky = indexTipDist > pinkyTipDist * 1.6;

        // Absolute check: index must be at least 0.15 further than middle
        const indexMuchFurtherAbsolute = (indexTipDist - middleTipDist) > 0.08;

        // Others must be clearly curled (tip closer than knuckle)
        const middleCurled = middleTipDist < middlePipDist * 0.9;
        const ringCurled = ringTipDist < ringPipDist * 0.9;
        const pinkyCurled = pinkyTipDist < pinkyPipDist * 0.9;

        return indexExtended && indexFurtherThanPalm && indexMuchFurtherAbsolute &&
            indexFurtherThanMiddle && indexFurtherThanRing && indexFurtherThanPinky &&
            middleCurled && ringCurled && pinkyCurled;
    }

    isFingerVariant(landmarks) {
        const wrist = landmarks[0];

        const indexExtended = this.getDistance(landmarks[8], wrist) > this.getDistance(landmarks[6], wrist);
        const middleExtended = this.getDistance(landmarks[12], wrist) > this.getDistance(landmarks[10], wrist);
        const ringExtended = this.getDistance(landmarks[16], wrist) > this.getDistance(landmarks[14], wrist);
        const pinkyExtended = this.getDistance(landmarks[20], wrist) > this.getDistance(landmarks[18], wrist);

        // THREE_FINGER: Index + Middle + Ring extended, regardless of pinky
        // This is the main grab/move/push-pull gesture
        if (indexExtended && middleExtended && ringExtended) {
            // If all 4 are extended, that's OPEN_HAND, not THREE_FINGER
            if (pinkyExtended) {
                return null; // Let isOpenHand handle this
            }
            return GESTURE.THREE_FINGER;
        }

        // TWO_FINGER: Index + Middle extended, Ring curled
        if (indexExtended && middleExtended && !ringExtended) {
            return GESTURE.TWO_FINGER;
        }

        // NOTE: ONE_FINGER is handled by isOneFinger() with stricter checks

        return null;
    }

    isOpenHand(landmarks) {
        const wrist = landmarks[0];
        const fingerTips = [8, 12, 16, 20];
        const fingerPIPs = [6, 10, 14, 18];

        let extendedCount = 0;
        for (let i = 0; i < 4; i++) {
            const dTip = this.getDistance(landmarks[fingerTips[i]], wrist);
            const dPip = this.getDistance(landmarks[fingerPIPs[i]], wrist);
            if (dTip > dPip) {
                extendedCount++;
            }
        }

        // Also check thumb
        const thumbExtended = this.getDistance(landmarks[4], wrist) > this.getDistance(landmarks[3], wrist);
        return extendedCount >= 4 && thumbExtended;
    }

    isClosedFist(landmarks) {
        const wrist = landmarks[0];
        const fingerTips = [8, 12, 16, 20];
        const fingerPIPs = [6, 10, 14, 18];

        let curledCount = 0;
        for (let i = 0; i < 4; i++) {
            const dTip = this.getDistance(landmarks[fingerTips[i]], wrist);
            const dPip = this.getDistance(landmarks[fingerPIPs[i]], wrist);
            if (dTip < dPip) {
                curledCount++;
            }
        }
        return curledCount >= 4;
    }

    getDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
