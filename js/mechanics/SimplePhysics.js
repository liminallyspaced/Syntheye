/**
 * SimplePhysics.js
 * Handles basic gravity and floor collision for a single object.
 */

export class SimplePhysics {
    constructor(mesh) {
        this.mesh = mesh;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.gravity = -20.0; // Units per second squared
        this.isEnabled = true;
        this.floorY = 0.5; // Half height of a 1-unit cube (so it sits on ground 0)
        this.drag = 0.98; // Air resistance
        this.elasticity = 0.3; // Bounciness
        this.isGround = false;
    }

    update(deltaTime) {
        if (!this.isEnabled || !this.mesh) return;

        // Apply gravity
        this.velocity.y += this.gravity * deltaTime;

        // Apply drag
        this.velocity.x *= this.drag;
        this.velocity.z *= this.drag;

        // Apply position change
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        // Floor collision
        if (this.mesh.position.y < this.floorY) {
            this.mesh.position.y = this.floorY;

            // Bounce
            if (Math.abs(this.velocity.y) > 0.5) {
                this.velocity.y = -this.velocity.y * this.elasticity;
                // Add some friction on bounce
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                this.isGround = false;
            } else {
                this.velocity.y = 0;
                this.isGround = true;

                // Ground friction
                this.velocity.x *= 0.9;
                this.velocity.z *= 0.9;
            }
        } else {
            this.isGround = false;
        }
    }

    resetVelocity() {
        this.velocity = { x: 0, y: 0, z: 0 };
    }

    addImpulse(vector) {
        this.velocity.x += vector.x;
        this.velocity.y += vector.y;
        this.velocity.z += vector.z;
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    setVelocity(x, y, z) {
        this.velocity.x = x;
        this.velocity.y = y;
        this.velocity.z = z;
    }
}
