import { STATE, ROOM_DATA } from './constants.js';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

let roomGroup;

export function initGame(scene, onInteract) {
    roomGroup = new THREE.Group();
    scene.add(roomGroup);
    
    // Add Click Listener handled in Three.js Scene Logic usually, 
    // but simplified: Game Logic here handles room data loading
}

export function loadRoom(roomKey, scene, camera) {
    // Clean old
    while(roomGroup.children.length > 0){ 
        roomGroup.remove(roomGroup.children[0]); 
    }

    const data = ROOM_DATA[roomKey];
    STATE.room = roomKey;

    // Geometry
    data.geometry.forEach(geo => {
        const geometry = new THREE.BoxGeometry(geo.dim[0], geo.dim[1], geo.dim[2]);
        const mat = new THREE.MeshLambertMaterial({ color: geo.color });
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(geo.pos[0], geo.pos[1], geo.pos[2]);
        mesh.name = geo.name || 'wall';
        if(geo.hotspot) {
            mesh.userData.hotspot = geo.hotspot;
            mesh.userData.isMeshHotspot = true;
        }
        roomGroup.add(mesh);
    });

    // Hotspots
    data.hotspots.forEach(h => {
        const geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const mat = new THREE.MeshBasicMaterial({ color: h.locked ? 0xFF0000 : 0x00FF00, transparent: true, opacity: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(h.pos[0], 1, h.pos[2]);
        mesh.userData.hotspot = h;
        mesh.userData.isHotspot = true;
        roomGroup.add(mesh);
    });

    // Camera
    camera.position.set(data.camPos[0], data.camPos[1], data.camPos[2]);
    camera.lookAt(data.camTarget[0], data.camTarget[1], data.camTarget[2]);

    document.getElementById('ui-room-name').innerText = data.name;
    return roomGroup;
}