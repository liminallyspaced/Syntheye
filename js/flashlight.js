// =================================================================================
// --- FLASHLIGHT.JS - Eye-Light System ---
// =================================================================================
// Creates a spot light around the character plus a visible light cone beam.
// Toggle with F key. The cone rotates to face the camera's direction.
// In FPS mode, follows camera. In third-person, follows playerMesh.
// =================================================================================

import * as THREE from 'three';
import { scene, camera, playerMesh } from './three-init.js';
import { STATE } from './config.js';
import { hasItem } from './inventory.js';

// =================================================================================
// FLASHLIGHT STATE
// =================================================================================
export let eyeLight = null;           // The actual SpotLight for illumination
export let eyeLightTarget = null;     // Target for spotlight direction
export let lightConeMesh = null;      // Visible cone beam
let flashlightOn = false;             // Starts OFF, press F to turn on

// Cone angle for reveal system
const CONE_ANGLE = Math.PI / 5;       // ~36 degrees, matching visible cone
const REVEAL_DISTANCE = 25;           // How far the reveal effect reaches

// Objects that can be revealed by the flashlight
export let revealableObjects = [];

// =================================================================================
// TOGGLE FLASHLIGHT
// =================================================================================
export function toggleFlashlight() {
    // Check if player owns flashlight item (optional gate)
    // Uncomment to require flashlight item:
    // if (!hasItem('flashlight')) {
    //     console.log('Flashlight not owned');
    //     return false;
    // }

    flashlightOn = !flashlightOn;
    if (eyeLight) {
        eyeLight.visible = flashlightOn;
        // Also toggle ambient glow
        if (eyeLight.userData.ambientGlow) {
            eyeLight.userData.ambientGlow.visible = flashlightOn;
        }
    }
    if (lightConeMesh) {
        lightConeMesh.visible = flashlightOn;
    }
    console.log(`Flashlight: ${flashlightOn ? 'ON' : 'OFF'}`);
    return flashlightOn;
}

export function isFlashlightOn() {
    return flashlightOn;
}

// =================================================================================
// INITIALIZE EYE-LIGHT - SpotLight + PointLight + visible cone beam
// =================================================================================
export function initFlashlight() {
    // Create SpotLight - directional beam that illuminates where player looks
    eyeLight = new THREE.SpotLight(
        0xffffee,       // color - warm white light
        3.0,            // intensity
        30,             // distance - how far light reaches
        Math.PI / 6,    // angle - 30 degree cone
        0.5,            // penumbra - soft edge
        1.0             // decay
    );
    eyeLight.position.set(0, 2, 0); // Will be updated to follow player
    scene.add(eyeLight);

    // Create target for spotlight direction
    eyeLightTarget = new THREE.Object3D();
    eyeLightTarget.position.set(0, 0, 10);
    scene.add(eyeLightTarget);
    eyeLight.target = eyeLightTarget;

    // Also add a subtle PointLight for ambient glow around player
    const ambientGlow = new THREE.PointLight(0xffffee, 0.8, 12, 2);
    ambientGlow.position.set(0, 2, 0);
    scene.add(ambientGlow);
    // Store reference to update position
    eyeLight.userData.ambientGlow = ambientGlow;

    // Create visible light cone beam
    const coneHeight = 15;
    const coneRadius = 5;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true);

    // Shift geometry so tip is at origin (cone expands from tip outward)
    coneGeometry.translate(0, -coneHeight / 2, 0);

    const coneMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffcc,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    lightConeMesh = new THREE.Mesh(coneGeometry, coneMaterial);

    scene.add(lightConeMesh);

    // Start OFF
    eyeLight.visible = false;
    eyeLight.userData.ambientGlow.visible = false;
    lightConeMesh.visible = false;

    console.log('Flashlight initialized: SpotLight + ambient glow + visible cone beam');
}

// =================================================================================
// UPDATE FLASHLIGHT - Position light and cone to follow camera (FPS) or player
// =================================================================================
export function updateFlashlight() {
    if (!eyeLight) return;

    let lightPos;
    let facingAngle;

    // Determine source based on camera mode
    if (STATE.cameraMode === 'FPS') {
        // FPS mode: flashlight follows camera
        lightPos = camera.position.clone();
        facingAngle = STATE.player.yaw;
    } else if (playerMesh) {
        // Third-person mode: flashlight follows playerMesh
        const headHeight = playerMesh.position.y + 2.0;
        lightPos = new THREE.Vector3(playerMesh.position.x, headHeight, playerMesh.position.z);
        facingAngle = playerMesh.rotation.y;
    } else {
        // Fallback to STATE.player.position
        const eyeHeight = STATE.player.isCrouching ? STATE.player.crouchHeight : STATE.player.eyeHeight;
        lightPos = new THREE.Vector3(
            STATE.player.position.x,
            STATE.player.position.y + eyeHeight,
            STATE.player.position.z
        );
        facingAngle = STATE.player.yaw;
    }

    // Position the SpotLight
    eyeLight.position.copy(lightPos);

    // Position ambient glow
    if (eyeLight.userData.ambientGlow) {
        eyeLight.userData.ambientGlow.position.copy(lightPos);
    }

    // Update spotlight target - point it in the facing direction
    if (eyeLightTarget) {
        const targetDistance = 20;
        eyeLightTarget.position.set(
            lightPos.x + Math.sin(facingAngle) * targetDistance,
            lightPos.y - 0.5, // Slightly downward angle
            lightPos.z + Math.cos(facingAngle) * targetDistance
        );
    }

    // Position and orient the visible cone mesh
    if (lightConeMesh) {
        lightConeMesh.position.copy(lightPos);
        lightConeMesh.position.y -= 0.5; // Lower slightly

        // Rotate cone to point in the facing direction
        lightConeMesh.rotation.set(
            Math.PI / 2,           // Tilt horizontal (tip forward)
            0,                      // No twist
            -facingAngle + Math.PI  // Rotate to face direction + 180 degrees on Z
        );
    }

    updateRevealables();
}

// =================================================================================
// REVEALABLE OBJECTS SYSTEM
// =================================================================================
export function registerRevealable(mesh, id) {
    const originalMaterial = mesh.material;
    const revealMaterial = originalMaterial.clone();
    revealMaterial.transparent = true;
    revealMaterial.opacity = 0;
    revealMaterial.needsUpdate = true;
    mesh.material = revealMaterial;

    revealableObjects.push({
        mesh: mesh,
        id: id,
        revealed: false,
        currentOpacity: 0,
        targetOpacity: 0
    });

    console.log(`Registered revealable: ${id}`);
}

function updateRevealables() {
    if (!eyeLight) return;

    // If flashlight is off, hide all revealables
    if (!flashlightOn) {
        revealableObjects.forEach(obj => {
            if (obj.mesh && obj.mesh.material) {
                obj.targetOpacity = 0;
                obj.currentOpacity = Math.max(0, obj.currentOpacity - 0.1);
                obj.mesh.material.opacity = obj.currentOpacity;
            }
        });
        return;
    }

    // Get flashlight world position
    const lightWorldPos = new THREE.Vector3();
    eyeLight.getWorldPosition(lightWorldPos);

    // Get light direction
    const targetWorldPos = new THREE.Vector3();
    eyeLightTarget.getWorldPosition(targetWorldPos);
    const lightDirection = targetWorldPos.clone().sub(lightWorldPos).normalize();

    revealableObjects.forEach(obj => {
        if (!obj.mesh || !obj.mesh.parent) return;

        const meshWorldPos = new THREE.Vector3();
        obj.mesh.getWorldPosition(meshWorldPos);

        const toMesh = meshWorldPos.clone().sub(lightWorldPos);
        const distance = toMesh.length();
        toMesh.normalize();

        if (distance > REVEAL_DISTANCE) {
            obj.targetOpacity = 0;
        } else {
            const angle = lightDirection.angleTo(toMesh);
            const coneAngle = CONE_ANGLE;

            if (angle < coneAngle) {
                const angleRatio = 1 - (angle / coneAngle);
                const distanceRatio = 1 - (distance / REVEAL_DISTANCE);
                const revealStrength = angleRatio * distanceRatio;

                if (revealStrength > 0.3) {
                    obj.targetOpacity = Math.min(1, revealStrength * 2);
                } else {
                    obj.targetOpacity = 0;
                }
            } else {
                obj.targetOpacity = 0;
            }
        }

        const fadeSpeed = 0.08;
        if (obj.currentOpacity < obj.targetOpacity) {
            obj.currentOpacity = Math.min(obj.targetOpacity, obj.currentOpacity + fadeSpeed);
        } else if (obj.currentOpacity > obj.targetOpacity) {
            obj.currentOpacity = Math.max(obj.targetOpacity, obj.currentOpacity - fadeSpeed * 0.5);
        }

        if (obj.mesh.material) {
            obj.mesh.material.opacity = obj.currentOpacity;
            if (obj.currentOpacity > 0.9 && !obj.revealed) {
                obj.revealed = true;
                console.log(`Revealed: ${obj.id}`);
            }
        }
    });
}

export function isRevealed(id) {
    const obj = revealableObjects.find(o => o.id === id);
    return obj ? obj.revealed : false;
}

export function clearRevealables() {
    revealableObjects = [];
}
