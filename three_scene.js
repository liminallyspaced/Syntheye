import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { STATE } from './constants.js';
import { loadRoom as gameLoadRoom } from './game.js';

let scene, camera, renderer, playerMesh;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let interactionCallback;
let currentRoomGroup;

export function initThree(onInteract) {
    interactionCallback = onInteract;
    const container = document.getElementById('game-canvas-container');
    
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio / 2);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 5, 25);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

    const pGeo = new THREE.BoxGeometry(1, 2, 1);
    const pMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
    playerMesh = new THREE.Mesh(pGeo, pMat);
    playerMesh.position.y = 1;
    scene.add(playerMesh);

    scene.add(new THREE.AmbientLight(0x404040, 3));
    const dLight = new THREE.DirectionalLight(0xFFFFFF, 2);
    dLight.position.set(20, 30, 10);
    scene.add(dLight);

    window.addEventListener('resize', onResize);
    container.addEventListener('mousedown', handleMouseDown);
}

export function setRoom(roomKey, spawnPoint) {
    // Delegate geometry creation to game engine
    currentRoomGroup = gameLoadRoom(roomKey, scene, camera);
    if(spawnPoint) {
        playerMesh.position.set(spawnPoint[0], spawnPoint[1], spawnPoint[2]);
        STATE.pos.x = spawnPoint[0];
        STATE.pos.z = spawnPoint[2];
    }
}

export function animate() {
    requestAnimationFrame(animate);
    if(STATE.screen === 'overworld') {
        updateMovement();
    }
    renderer.render(scene, camera);
}

function updateMovement() {
    if(STATE.target) {
        const targetV = new THREE.Vector3(STATE.target.x, 1, STATE.target.z);
        const dir = new THREE.Vector3().subVectors(targetV, playerMesh.position).normalize();
        const dist = playerMesh.position.distanceTo(targetV);
        
        if(dist > 0.2) {
            playerMesh.position.add(dir.multiplyScalar(STATE.speed));
            playerMesh.rotation.y = Math.atan2(dir.x, dir.z);
        } else {
            STATE.target = null;
            if(STATE.activeHotspot && interactionCallback) {
                interactionCallback(STATE.activeHotspot);
                STATE.activeHotspot = null;
            }
        }
    }
}

function handleMouseDown(e) {
    if(STATE.screen !== 'overworld') return;
    
    e.preventDefault();
    const rect = e.target.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(currentRoomGroup.children);
    
    if(intersects.length > 0) {
        const obj = intersects[0].object;
        if(obj.userData.hotspot) {
            const h = obj.userData.hotspot;
            if(h.type === 'door') {
                setRoom(h.target_room, h.spawn); // Changed for consistency
            } else {
                STATE.target = intersects[0].point;
                STATE.activeHotspot = h;
            }
        } else if(obj.name === 'floor') {
            STATE.target = intersects[0].point;
            STATE.activeHotspot = null;
        }
    }
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}