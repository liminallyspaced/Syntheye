import { STATE } from './constants.js';

let iScene, iCam, iRenderer, iControls, iMesh;
let iReqId;

export function setupInspectionView() {
    const container = document.getElementById('inspection-canvas-container');
    if(!container) return;

    // Use Global THREE
    iScene = new THREE.Scene();
    iScene.background = new THREE.Color(0x111111);
    
    iCam = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 10);
    iCam.position.z = 4;

    iRenderer = new THREE.WebGLRenderer({ antialias: true });
    iRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(iRenderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(1, 1, 1);
    iScene.add(light);
    iScene.add(new THREE.AmbientLight(0x404040));

    // Use Global OrbitControls (loaded via script tag in HTML)
    iControls = new THREE.OrbitControls(iCam, iRenderer.domElement);
    iControls.enableDamping = true;
}

export function startInspectionView(id) {
    if (iMesh) iScene.remove(iMesh);

    let geo, col;
    if (id === 'gallery_model1') { geo = new THREE.DodecahedronGeometry(1); col = 0x00FF00; }
    else { geo = new THREE.BoxGeometry(1.5, 1.5, 1.5); col = 0xFF0000; }

    const mat = new THREE.MeshStandardMaterial({ color: col, wireframe: true });
    iMesh = new THREE.Mesh(geo, mat);
    iScene.add(iMesh);

    animateInspection();
}

function animateInspection() {
    if (STATE.screen === 'popup') {
        iReqId = requestAnimationFrame(animateInspection);
        iControls.update();
        if(iMesh) iMesh.rotation.y += 0.005; 
        iRenderer.render(iScene, iCam);
    }
}

export function stopInspectionView() {
    cancelAnimationFrame(iReqId);
}