/**
 * SimplePhysics.js
 * Physics system with force/torque support for spring-damped levitation.
 */

import * as THREE from 'three';

export class SimplePhysics {
    constructor(mesh) {
        this.mesh = mesh;

        // Linear physics
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.forceAccumulator = new THREE.Vector3(0, 0, 0);
        this.mass = 1.0;

        // Angular physics
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        this.torqueAccumulator = new THREE.Vector3(0, 0, 0);
        this.angularDrag = 0.95;

        // Physics constants
        this.gravity = -20.0;
        this.isEnabled = true;
        this.floorY = 0.5;
        this.drag = 0.98;
        this.elasticity = 0.3;
        this.isGround = false;

        // Levitation mode (when held, gravity is cancelled)
        this.isLevitating = false;

        // Debug tracer - LINE for ball path, MARKERS for impacts
        this.tracerPositions = [];  // Array of Vector3 for line
        this.tracerLine = null;     // THREE.Line object
        this.impactMarkers = [];    // Collision point markers
        this.lastTracerTime = 0;
        this.scene = null;          // Set by main.js
        this.isTracking = false;    // Start tracking on throw
    }

    /**
     * Apply a force to the object (accumulated each tick, cleared after update)
     */
    applyForce(force) {
        this.forceAccumulator.add(force);
    }

    /**
     * Apply a torque to the object
     */
    applyTorque(torque) {
        this.torqueAccumulator.add(torque);
    }

    /**
     * Set levitation mode (cancels gravity)
     */
    setLevitating(levitating) {
        this.isLevitating = levitating;
    }

    update(deltaTime) {
        if (!this.isEnabled || !this.mesh) return;

        // Apply accumulated forces (F = ma, so a = F/m)
        const acceleration = this.forceAccumulator.clone().divideScalar(this.mass);
        this.velocity.add(acceleration.multiplyScalar(deltaTime));

        // Apply gravity (unless levitating)
        if (!this.isLevitating) {
            this.velocity.y += this.gravity * deltaTime;
        }

        // Apply drag
        this.velocity.x *= this.drag;
        this.velocity.z *= this.drag;
        if (this.isLevitating) {
            this.velocity.y *= this.drag; // Also drag Y when levitating
        }

        // Apply velocity to position
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        // Apply angular physics
        const angularAccel = this.torqueAccumulator.clone().divideScalar(this.mass);
        this.angularVelocity.add(angularAccel.multiplyScalar(deltaTime));
        this.angularVelocity.multiplyScalar(this.angularDrag);

        // Apply angular velocity to rotation
        this.mesh.rotation.x += this.angularVelocity.x * deltaTime;
        this.mesh.rotation.y += this.angularVelocity.y * deltaTime;
        this.mesh.rotation.z += this.angularVelocity.z * deltaTime;

        // Clear accumulators
        this.forceAccumulator.set(0, 0, 0);
        this.torqueAccumulator.set(0, 0, 0);

        // Floor collision
        if (this.mesh.position.y < this.floorY) {
            this.mesh.position.y = this.floorY;

            if (Math.abs(this.velocity.y) > 0.5) {
                this.velocity.y = -this.velocity.y * this.elasticity;
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                this.isGround = false;
            } else {
                this.velocity.y = 0;
                this.isGround = true;
                this.velocity.x *= 0.9;
                this.velocity.z *= 0.9;
            }
        } else {
            this.isGround = false;
        }

        // Ceiling collision
        const ceilingY = 14.5;
        if (this.mesh.position.y > ceilingY) {
            this.mesh.position.y = ceilingY;
            this.velocity.y = -this.velocity.y * this.elasticity;
            this.logCollision('CEILING', { y: ceilingY });
        }

        // Wall collisions - ORIGINAL VALUES with logging
        const ballRadius = window.ballRadius || 0.25;
        const wallMargin = ballRadius + 0.1;

        // X walls (left/right at x = ±15)
        if (this.mesh.position.x > 15 - wallMargin) {
            this.mesh.position.x = 15 - wallMargin;
            this.velocity.x = -this.velocity.x * this.elasticity;
            this.logCollision('WALL_EAST (x=15)', { x: this.mesh.position.x });
        }
        if (this.mesh.position.x < -15 + wallMargin) {
            this.mesh.position.x = -15 + wallMargin;
            this.velocity.x = -this.velocity.x * this.elasticity;
            this.logCollision('WALL_WEST (x=-15)', { x: this.mesh.position.x });
        }

        // Z walls (back at z=-25, front at z=15)
        if (this.mesh.position.z < -25 + wallMargin) {
            this.mesh.position.z = -25 + wallMargin;
            this.velocity.z = -this.velocity.z * this.elasticity;
            this.logCollision('WALL_BACK (z=-25)', { z: this.mesh.position.z });
        }
        if (this.mesh.position.z > 15 - wallMargin) {
            this.mesh.position.z = 15 - wallMargin;
            this.velocity.z = -this.velocity.z * this.elasticity;
            this.logCollision('WALL_FRONT (z=15)', { z: this.mesh.position.z });
        }

        // === DEBUG LINE TRACER (with limits to prevent freeze) ===
        if (this.scene && window.ENABLE_TRACER) {
            try {
                const speed = this.velocity.length();

                // Start tracking when thrown (speed > 1)
                if (speed > 1 && !this.isTracking) {
                    this.isTracking = true;
                    this.clearTracer();
                }

                // Stop tracking when ball settles
                if (speed < 0.5 && this.isTracking && this.isGround) {
                    this.isTracking = false;
                }

                // Add points to tracer while tracking (max 200 points)
                if (this.isTracking && this.tracerPositions.length < 200) {
                    const now = Date.now();
                    if (now - this.lastTracerTime > 50) { // Every 50ms
                        this.lastTracerTime = now;
                        this.tracerPositions.push(this.mesh.position.clone());
                        this.updateTracerLine();
                    }
                }
            } catch (e) {
                console.error('Tracer error:', e);
                this.isTracking = false;
            }
        }
    }

    /**
     * Update the visual tracer line
     */
    updateTracerLine() {
        if (!this.scene || this.tracerPositions.length < 2) return;

        // Remove old line
        if (this.tracerLine) {
            this.scene.remove(this.tracerLine);
            this.tracerLine.geometry.dispose();
        }

        // Create new line from positions
        const geometry = new THREE.BufferGeometry().setFromPoints(this.tracerPositions);
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,  // Bright cyan
            linewidth: 3
        });
        this.tracerLine = new THREE.Line(geometry, material);
        this.scene.add(this.tracerLine);
    }

    /**
     * Clear the tracer line and markers
     */
    clearTracer() {
        if (this.tracerLine && this.scene) {
            this.scene.remove(this.tracerLine);
            this.tracerLine.geometry.dispose();
            this.tracerLine = null;
        }
        this.tracerPositions = [];

        // Clear impact markers
        for (const marker of this.impactMarkers) {
            if (this.scene) this.scene.remove(marker);
            marker.geometry.dispose();
        }
        this.impactMarkers = [];
    }

    /**
     * Add a red impact marker at collision point (only if tracer enabled)
     */
    addImpactMarker(pos) {
        if (!this.scene || !window.ENABLE_TRACER) return;

        // Limit to 10 markers
        while (this.impactMarkers.length >= 10) {
            const old = this.impactMarkers.shift();
            this.scene.remove(old);
            old.geometry.dispose();
            old.material.dispose();
        }

        const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(pos);
        this.scene.add(marker);
        this.impactMarkers.push(marker);
    }

    /**
     * Log collision event to on-screen debug display
     * PHASE 1 FIX: Only logs when ENABLE_COLLISION_DEBUG is true
     */
    logCollision(what, pos) {
        // PHASE 1 FIX: Skip all logging/DOM work unless explicitly enabled
        if (!window.ENABLE_COLLISION_DEBUG) return;

        const msg = `HIT ${what} @ pos(${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.y.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`;

        // Add red impact marker at collision point (only if tracer enabled)
        this.addImpactMarker(this.mesh.position.clone());

        // Store in window for debug display
        if (!window.COLLISION_LOG) window.COLLISION_LOG = [];
        window.COLLISION_LOG.push({ time: Date.now(), msg });

        // Keep only last 10 entries
        if (window.COLLISION_LOG.length > 10) {
            window.COLLISION_LOG.shift();
        }

        // Update on-screen display
        this.updateDebugDisplay();
    }

    updateDebugDisplay() {
        // PHASE 1 FIX: Skip DOM work unless explicitly enabled
        if (!window.ENABLE_COLLISION_DEBUG) return;

        let el = document.getElementById('collision-debug');
        if (!el) {
            el = document.createElement('div');
            el.id = 'collision-debug';
            el.style.cssText = `
                position: fixed;
                bottom: 10px;
                left: 10px;
                background: rgba(0,0,0,0.9);
                color: #0f0;
                font-family: monospace;
                font-size: 11px;
                padding: 10px;
                border: 1px solid #0f0;
                z-index: 99999;
                max-height: 200px;
                overflow-y: auto;
            `;
            document.body.appendChild(el);
        }

        const logs = window.COLLISION_LOG || [];
        el.innerHTML = '<b>COLLISION LOG:</b><br>' +
            logs.map(l => l.msg).join('<br>') +
            '<br><b>Ball Z: ' + this.mesh.position.z.toFixed(2) + '</b>';
    }

    resetVelocity() {
        this.velocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
    }

    addImpulse(vector) {
        this.velocity.add(vector);
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    setVelocity(x, y, z) {
        this.velocity.set(x, y, z);
    }

    getVelocity() {
        return this.velocity.clone();
    }
}

