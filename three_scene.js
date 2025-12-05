import { STATE, ROOM_DATA } from './constants.js';

let scene, camera, renderer, playerMesh;
let currentRoomGroup;
let raycaster;
let mouse;
let interactionCallback = null;

export function initThree(onInteract) {
    interactionCallback = onInteract;
    const container = document.getElementById('game-canvas-container');
    
    // Initialize Globals
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    currentRoomGroup = new THREE.Group();

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio / 2); // PS1 Style
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 5, 25);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

    // Player
    const pGeo = new THREE.BoxGeometry(1, 2, 1);
    const pMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
    playerMesh = new THREE.Mesh(pGeo, pMat);
    playerMesh.position.y = 1;
    scene.add(playerMesh);

    // Lights
    scene.add(new THREE.AmbientLight(0x404040, 3));
    const dLight = new THREE.DirectionalLight(0xFFFFFF, 2);
    dLight.position.set(20, 30, 10);
    scene.add(dLight);

    scene.add(currentRoomGroup);

    // Events
    window.addEventListener('resize', onResize);
    container.addEventListener('mousedown', handleMouseDown);

    loadAllRooms(); 
}

function loadAllRooms() {
    // Note: We build room data on demand in setRoom to keep scene light, 
    // or pre-build here if optimization is needed.
    // For this version, we will build geometry inside setRoom for simplicity.
}

export function setRoom(roomKey, spawnPoint) {
    // Clear old room
    while(currentRoomGroup.children.length > 0){ 
        currentRoomGroup.remove(currentRoomGroup.children[0]); 
    }
    
    const config = ROOM_DATA[roomKey];
    
    // Build Geometry
    config.geometry.forEach(g => {
        const geo = new THREE.BoxGeometry(g.dim[0], g.dim[1], g.dim[2]);
        const mat = new THREE.MeshLambertMaterial({ color: g.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(g.pos[0], g.pos[1], g.pos[2]);
        mesh.name = g.name;
        if(g.hotspot) {
            mesh.userData.hotspot = g.hotspot;
            mesh.userData.isMeshHotspot = true;
        }
        currentRoomGroup.add(mesh);
    });

    // Build Hotspots
    config.hotspots.forEach(h => {
        const geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const mat = new THREE.MeshBasicMaterial({ color: h.locked ? 0xFF0000 : 0x00FF00, transparent: true, opacity: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(h.pos[0], 1, h.pos[2]);
        mesh.userData.hotspot = h;
        mesh.userData.isHotspot = true;
        currentRoomGroup.add(mesh);
    });

    camera.position.set(...config.camera.pos);
    camera.lookAt(...config.camera.target);

    STATE.current_room = roomKey;
    if(spawnPoint) {
        playerMesh.position.set(spawnPoint[0], spawnPoint[1], spawnPoint[2]);
        STATE.pos.x = spawnPoint[0];
        STATE.pos.z = spawnPoint[2];
    }
    document.getElementById('ui-room-name').innerText = config.name;
}

export function animate() {
    requestAnimationFrame(animate);
    if(STATE.interaction_mode === 'OVERWORLD') {
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
    if(STATE.interaction_mode !== 'OVERWORLD') return;
    
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
                setRoom(h.target_room, h.spawn);
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