/**
 * DebugManager.js
 * Unified debug system - single * key controls ALL debug visibility.
 * Integrates existing debug panels and makes them draggable/minimizable.
 */

export class DebugManager {
    constructor() {
        this.isDebugMode = false;
        this.panels = [];

        // Setup will be called after DOM is ready
        this.initialized = false;
    }

    /**
     * Initialize after DOM is ready - find and register existing panels
     */
    init() {
        if (this.initialized) return;

        // Find existing debug panels
        const levitationDebug = document.getElementById('levitation-debug');
        const debugOverlay = document.getElementById('debug-overlay');
        const collisionDebug = document.getElementById('collision-debug');

        // Register panels we find
        if (levitationDebug) {
            this.registerPanel(levitationDebug, 'Physics/Levitation Debug');
            this.makePanelDraggable(levitationDebug);
            this.addMinimizeButton(levitationDebug, 'Physics/Levitation Debug');
        }

        if (debugOverlay) {
            this.registerPanel(debugOverlay, 'Camera Debug');
            this.makePanelDraggable(debugOverlay);
            this.addMinimizeButton(debugOverlay, 'Camera Debug');
        }

        // Collision debug is created dynamically - we'll handle it when it appears

        // Setup single * key handler (remove old handlers)
        document.addEventListener('keydown', (e) => {
            if (e.key === '*') {
                e.preventDefault();
                this.toggle();
            }
        });

        this.initialized = true;
        console.log('DebugManager initialized - press * to toggle all debug');
    }

    /**
     * Toggle all debug panels and visualization
     */
    toggle() {
        this.isDebugMode = !this.isDebugMode;

        // Toggle all registered panels
        this.panels.forEach(panel => {
            panel.element.style.display = this.isDebugMode ? 'block' : 'none';
        });

        // Also check for collision-debug which may be created dynamically
        const collisionDebug = document.getElementById('collision-debug');
        if (collisionDebug && !this.panels.find(p => p.element === collisionDebug)) {
            this.registerPanel(collisionDebug, 'Collision Debug');
            this.makePanelDraggable(collisionDebug);
        }
        if (collisionDebug) {
            collisionDebug.style.display = this.isDebugMode ? 'block' : 'none';
        }

        // Toggle debug visualization flags
        window.ENABLE_TRACER = this.isDebugMode;
        window.SHOW_HIT_POINTS = this.isDebugMode;
        window.SHOW_COLLISION_LOG = this.isDebugMode;

        // Reset debug-only state when closing
        if (!this.isDebugMode) {
            if (window.aimAssist) window.aimAssist.resetLock();
            window.COLLISION_LOG = [];
        }

        console.log(`Debug Mode: ${this.isDebugMode ? 'ON' : 'OFF'}`);
    }

    /**
     * Register an existing panel
     */
    registerPanel(element, name) {
        if (this.panels.find(p => p.element === element)) return;

        this.panels.push({ element, name });

        // Ensure panel is hidden initially
        element.style.display = 'none';
    }

    /**
     * Make a panel draggable by its header/first child
     */
    makePanelDraggable(panel) {
        // Find or create a drag handle
        let handle = panel.querySelector('.debug-drag-handle');
        if (!handle) {
            // Use first div as drag handle, or create one
            const firstChild = panel.firstElementChild;
            if (firstChild && firstChild.tagName === 'DIV') {
                handle = firstChild;
                handle.classList.add('debug-drag-handle');
                handle.style.cursor = 'move';
            }
        }

        if (!handle) return;

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' ||
                e.target.tagName === 'SELECT') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            // Change to absolute positioning if not already
            if (panel.style.position !== 'absolute') {
                panel.style.position = 'fixed';
                panel.style.left = startLeft + 'px';
                panel.style.top = startTop + 'px';
            }

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = (startLeft + dx) + 'px';
            panel.style.top = (startTop + dy) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    /**
     * Add minimize button to panel
     */
    addMinimizeButton(panel, title) {
        const firstChild = panel.firstElementChild;
        if (!firstChild) return;

        // Check if already has minimize button
        if (panel.querySelector('.debug-minimize-btn')) return;

        // Create header wrapper if needed
        firstChild.style.display = 'flex';
        firstChild.style.justifyContent = 'space-between';
        firstChild.style.alignItems = 'center';

        const minBtn = document.createElement('button');
        minBtn.className = 'debug-minimize-btn';
        minBtn.textContent = '−';
        minBtn.style.cssText = `
            background: none;
            border: 1px solid #ff0;
            color: #ff0;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            border-radius: 3px;
            margin-left: 10px;
        `;

        let isMinimized = false;
        const contentEls = Array.from(panel.children).slice(1); // All except header

        minBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            minBtn.textContent = isMinimized ? '+' : '−';
            contentEls.forEach(el => {
                el.style.display = isMinimized ? 'none' : '';
            });
        });

        firstChild.appendChild(minBtn);
    }

    /**
     * Check if debug mode is active
     */
    isActive() {
        return this.isDebugMode;
    }
}

// Export singleton instance
export const debugManager = new DebugManager();
