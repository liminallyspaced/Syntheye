/**
 * BasketballHoop.js
 * Creates a basketball hoop and tracks scores when the ball passes through
 */

import * as THREE from 'three';

export class BasketballHoop {
    constructor(scene) {
        this.scene = scene;
        this.score = 0;
        this.lastScoreTime = 0;
        this.scoreDebounce = 1000; // 1 second between scores

        // Get ball radius from window for proper sizing
        const ballRadius = window.ballRadius || 0.25;
        // Hoop inner radius = ball diameter + 10% clearance
        this.hoopInnerRadius = ballRadius * 2 + 0.08;
        this.hoopZ = -24; // Right against back wall at z=-25

        this.createHoop();
        this.createScoreDisplay();
        this.createCollisionRim();
    }

    createHoop() {
        // Hoop ring (torus) - sized to fit ball with slight clearance
        const ringGeometry = new THREE.TorusGeometry(this.hoopInnerRadius, 0.03, 8, 24);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xff4400,
            metalness: 0.8,
            roughness: 0.3
        });
        this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
        this.ring.rotation.x = Math.PI / 2; // Lay flat
        this.ring.position.set(0, 3.5, this.hoopZ);
        this.scene.add(this.ring);

        // Backboard - larger and further back
        const backboardGeometry = new THREE.BoxGeometry(2.2, 1.4, 0.08);
        const backboardMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7
        });
        this.backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
        this.backboard.position.set(0, 3.9, this.hoopZ - 0.4);
        this.scene.add(this.backboard);

        // Backboard frame
        const frameGeometry = new THREE.BoxGeometry(2.25, 1.45, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.5
        });
        this.frame = new THREE.Mesh(frameGeometry, frameMaterial);
        this.frame.position.set(0, 3.9, this.hoopZ - 0.45);
        this.scene.add(this.frame);

        // Hoop bracket
        const bracketGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.5);
        const bracketMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
        this.bracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
        this.bracket.position.set(0, 3.5, this.hoopZ - 0.2);
        this.scene.add(this.bracket);

        // Net (simple cylinders to suggest a net)
        const netMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });
        this.netParts = [];
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const x = Math.cos(angle) * (this.hoopInnerRadius * 0.8);
            const z = Math.sin(angle) * (this.hoopInnerRadius * 0.8);
            const netLine = new THREE.Mesh(
                new THREE.CylinderGeometry(0.01, 0.015, 0.6, 4),
                netMaterial
            );
            netLine.position.set(x, 3.2, this.hoopZ + z);
            this.scene.add(netLine);
            this.netParts.push(netLine);
        }

        // Store hoop center for collision detection
        this.hoopCenter = new THREE.Vector3(0, 3.5, this.hoopZ);
        this.hoopRadius = this.hoopInnerRadius;
    }

    createCollisionRim() {
        // Create invisible collision boxes around the rim
        // These will be used for physics collision
        this.rimColliders = [];
        const rimMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.0 // Invisible
        });

        // Create 8 collision boxes around the rim
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = Math.cos(angle) * this.hoopInnerRadius;
            const z = Math.sin(angle) * this.hoopInnerRadius;

            const colliderGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08);
            const collider = new THREE.Mesh(colliderGeo, rimMaterial);
            collider.position.set(x, 3.5, this.hoopZ + z);
            collider.userData.isRimCollider = true;
            this.scene.add(collider);
            this.rimColliders.push(collider);
        }

        // Backboard collider
        this.backboardCollider = new THREE.Box3().setFromObject(this.backboard);
    }

    createScoreDisplay() {
        // Create canvas for score text
        this.scoreCanvas = document.createElement('canvas');
        this.scoreCanvas.width = 256;
        this.scoreCanvas.height = 128;
        this.scoreContext = this.scoreCanvas.getContext('2d');

        // Create texture and sprite
        this.scoreTexture = new THREE.CanvasTexture(this.scoreCanvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: this.scoreTexture });
        this.scoreSprite = new THREE.Sprite(spriteMaterial);
        this.scoreSprite.scale.set(1.5, 0.75, 1);
        this.scoreSprite.position.set(2.5, 3.9, this.hoopZ);
        this.scene.add(this.scoreSprite);

        this.updateScoreDisplay();
    }

    updateScoreDisplay() {
        const ctx = this.scoreContext;
        ctx.clearRect(0, 0, 256, 128);

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, 256, 128);

        // Border
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 248, 120);

        // Score text
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCORE', 128, 45);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px monospace';
        ctx.fillText(this.score.toString(), 128, 105);

        this.scoreTexture.needsUpdate = true;
    }

    checkCollisions(ball) {
        if (!ball || !window.gamePhysics) return;

        const ballPos = ball.position;
        const ballRadius = window.ballRadius || 0.25;
        const physics = window.gamePhysics;

        // Check rim collisions
        for (const collider of this.rimColliders) {
            const dx = ballPos.x - collider.position.x;
            const dy = ballPos.y - collider.position.y;
            const dz = ballPos.z - collider.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < ballRadius + 0.05) {
                // Bounce off rim
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;

                // Reflect velocity
                const dot = physics.velocity.x * nx + physics.velocity.y * ny + physics.velocity.z * nz;
                physics.velocity.x -= 1.5 * dot * nx;
                physics.velocity.y -= 1.5 * dot * ny;
                physics.velocity.z -= 1.5 * dot * nz;

                // Push ball out of collision
                ball.position.x = collider.position.x + nx * (ballRadius + 0.06);
                ball.position.y = collider.position.y + ny * (ballRadius + 0.06);
                ball.position.z = collider.position.z + nz * (ballRadius + 0.06);

                // Log rim collision
                this.logHoopCollision('HOOP_RIM', ball.position);
            }
        }

        // Check backboard collision
        if (ballPos.z < this.hoopZ - 0.3 && ballPos.z > this.hoopZ - 0.5 &&
            Math.abs(ballPos.x) < 1.1 && ballPos.y > 3.2 && ballPos.y < 4.6) {
            // Bounce off backboard
            physics.velocity.z *= -0.7;
            ball.position.z = this.hoopZ - 0.3;

            // Log backboard collision
            this.logHoopCollision('BACKBOARD', ball.position);
        }
    }

    logHoopCollision(what, pos) {
        const msg = `HIT ${what} @ pos(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
        console.log(msg);

        if (!window.COLLISION_LOG) window.COLLISION_LOG = [];
        window.COLLISION_LOG.push({ time: Date.now(), msg });

        if (window.COLLISION_LOG.length > 10) {
            window.COLLISION_LOG.shift();
        }

        // Update display if physics has it
        if (window.gamePhysics && window.gamePhysics.updateDebugDisplay) {
            window.gamePhysics.updateDebugDisplay();
        }
    }

    checkScore(ball) {
        if (!ball) return;

        const now = Date.now();
        if (now - this.lastScoreTime < this.scoreDebounce) return;

        const ballPos = ball.position;
        const ballRadius = window.ballRadius || 0.25;

        // Check if ball is passing through hoop
        const dx = ballPos.x - this.hoopCenter.x;
        const dz = ballPos.z - this.hoopCenter.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        // Check if ball center is within hoop opening and near hoop height
        const heightDiff = Math.abs(ballPos.y - this.hoopCenter.y);

        // Ball must be inside the hoop radius (with margin for ball size)
        if (horizontalDist < this.hoopRadius - ballRadius * 0.5 && heightDiff < 0.4) {
            const physics = window.gamePhysics;
            if (physics && physics.velocity && physics.velocity.y < -1) {
                this.addScore();
            }
        }
    }

    addScore() {
        this.score += 2;
        this.lastScoreTime = Date.now();
        this.updateScoreDisplay();

        // Flash the ring green
        this.ring.material.color.setHex(0x00ff00);
        setTimeout(() => {
            this.ring.material.color.setHex(0xff4400);
        }, 500);

        console.log(`SCORE! Total: ${this.score}`);
    }

    update(ball) {
        this.checkCollisions(ball);
        this.checkScore(ball);
    }

    /**
     * Dispose of all basketball hoop elements from the scene
     * Call this when leaving the test room
     */
    dispose() {
        // Remove ring
        if (this.ring) {
            this.scene.remove(this.ring);
            this.ring.geometry.dispose();
            this.ring.material.dispose();
        }

        // Remove backboard
        if (this.backboard) {
            this.scene.remove(this.backboard);
            this.backboard.geometry.dispose();
            this.backboard.material.dispose();
        }

        // Remove frame
        if (this.frame) {
            this.scene.remove(this.frame);
            this.frame.geometry.dispose();
            this.frame.material.dispose();
        }

        // Remove bracket
        if (this.bracket) {
            this.scene.remove(this.bracket);
            this.bracket.geometry.dispose();
            this.bracket.material.dispose();
        }

        // Remove net parts
        if (this.netParts) {
            for (const netLine of this.netParts) {
                this.scene.remove(netLine);
                netLine.geometry.dispose();
                netLine.material.dispose();
            }
            this.netParts = [];
        }

        // Remove rim colliders
        if (this.rimColliders) {
            for (const collider of this.rimColliders) {
                this.scene.remove(collider);
                collider.geometry.dispose();
                collider.material.dispose();
            }
            this.rimColliders = [];
        }

        // Remove score sprite
        if (this.scoreSprite) {
            this.scene.remove(this.scoreSprite);
            this.scoreSprite.material.map.dispose();
            this.scoreSprite.material.dispose();
        }

        console.log('BasketballHoop disposed');
    }
}
