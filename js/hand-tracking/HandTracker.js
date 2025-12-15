/**
 * HandTracker.js
 * Wrapper for MediaPipe Hands to handle webcam input and hand tracking.
 */

export class HandTracker {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasCtx = null;
        this.hands = null;
        this.camera = null;
        this.results = null;
        this.onResultsCallback = null;
        this.isInitialized = false;
        this.currentGesture = 'NONE';
        this.startButton = null;

        // PHASE 1 FIX: Inference throttling (~18 FPS = 55ms interval)
        this.lastInferenceTime = 0;
        this.inferenceInterval = 55; // ms between inferences (18 FPS)

        // Setup DOM elements (created dynamically to keep HTML clean)
        this.setupElements();
    }

    setupElements() {
        // Hidden video element for raw webcam feed
        this.videoElement = document.createElement('video');
        this.videoElement.className = 'input_video';
        this.videoElement.style.display = 'none';
        this.videoElement.playsInline = true;
        document.body.appendChild(this.videoElement);

        // Debug canvas overlay (can be toggled)
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.className = 'output_canvas';
        this.canvasElement.width = 320;
        this.canvasElement.height = 240;
        this.canvasElement.style.position = 'absolute';
        this.canvasElement.style.bottom = '10px';
        this.canvasElement.style.right = '10px';
        this.canvasElement.style.width = '320px';
        this.canvasElement.style.height = '240px';
        this.canvasElement.style.zIndex = '1000';
        this.canvasElement.style.border = '2px solid #00FF00';
        this.canvasElement.style.display = 'none'; // Hide by default
        this.canvasElement.style.backgroundColor = '#000';
        document.body.appendChild(this.canvasElement);

        this.canvasCtx = this.canvasElement.getContext('2d');

        // Explicit ENABLE WEBCAM button
        this.startButton = document.createElement('button');
        this.startButton.innerText = "ENABLE HAND TRACKING";
        this.startButton.style.position = 'absolute';
        this.startButton.style.top = '20px';
        this.startButton.style.left = '50%';
        this.startButton.style.transform = 'translateX(-50%)';
        this.startButton.style.zIndex = '2000';
        this.startButton.style.padding = '10px 20px';
        this.startButton.style.backgroundColor = '#DD0000';
        this.startButton.style.color = 'white';
        this.startButton.style.fontSize = '14px';
        this.startButton.style.fontFamily = 'monospace';
        this.startButton.style.border = '2px solid white';
        this.startButton.style.cursor = 'pointer';
        document.body.appendChild(this.startButton);

        this.startButton.addEventListener('click', () => {
            this.startWebcam();
        });
    }

    async startWebcam() {
        this.startButton.innerText = "STARTING...";
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.videoElement.srcObject = stream;
            await this.videoElement.play();

            this.camera = new window.Camera(this.videoElement, {
                onFrame: async () => {
                    // PHASE 1 FIX: Throttle inference to ~18 FPS
                    const now = performance.now();
                    if (now - this.lastInferenceTime < this.inferenceInterval) {
                        return; // Skip this frame
                    }
                    this.lastInferenceTime = now;
                    await this.hands.send({ image: this.videoElement });
                },
                width: 640,   // PHASE 1 FIX: Reduced from 1280
                height: 480   // PHASE 1 FIX: Reduced from 720
            });
            await this.camera.start();
            this.isInitialized = true;
            this.startButton.style.display = 'none';
            this.toggleDebug(true); // Auto-show debug on start
            console.log("Webcam started.");
        } catch (e) {
            console.error("Webcam failed:", e);
            this.startButton.innerText = "WEBCAM FAILED - RETRY";
            alert("Could not access webcam. Please allow camera permissions and try again.");
        }
    }

    async init(onResults) {
        if (this.isInitialized) return;

        this.onResultsCallback = onResults;

        // Initialize MediaPipe Hands
        this.hands = new window.Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults(this.handleResults.bind(this));
        // init is now passive, waiting for button click to start camera
    }

    setGesture(gestureName) {
        this.currentGesture = gestureName;
    }

    handleResults(results) {
        this.results = results;

        // Draw debug overlay if visible
        if (this.canvasElement.style.display !== 'none') {
            this.drawDebug(results);
        }

        if (this.onResultsCallback) {
            this.onResultsCallback(results);
        }
    }

    toggleDebug(show) {
        this.canvasElement.style.display = show ? 'block' : 'none';
    }

    drawDebug(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasCtx.drawImage(
            results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                window.drawConnectors(this.canvasCtx, landmarks, window.HAND_CONNECTIONS,
                    { color: '#00FF00', lineWidth: 2 }); // Green connectors
                window.drawLandmarks(this.canvasCtx, landmarks,
                    { color: '#FF0000', lineWidth: 1 }); // Red dots
            }
        }

        // Draw current gesture text
        this.canvasCtx.fillStyle = '#00FFFF';
        this.canvasCtx.font = '16px monospace';
        this.canvasCtx.fillText(`GESTURE: ${this.currentGesture}`, 10, 20);

        this.canvasCtx.restore();
    }

    /**
     * Hide all hand tracker UI elements (for when leaving test room)
     */
    hideUI() {
        if (this.canvasElement) this.canvasElement.style.display = 'none';
        if (this.startButton) this.startButton.style.display = 'none';
    }

    /**
     * Show hand tracker UI elements (for when entering test room)
     */
    showUI() {
        if (this.startButton && !this.isInitialized) {
            this.startButton.style.display = 'block';
        }
        // Canvas only shows when debug is toggled on
    }
}
