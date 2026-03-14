/**
 * Callout Annotation System
 *
 * Replicates the Mouser HotspotDot component:
 * - Glowing dots positioned on the 3D model
 * - Dashed connecting lines to label boxes
 * - Small endpoint dots
 * - Label boxes with title + subtitle
 * - Pulse animation on selected dot
 * - Click to select / show detail panel
 */

class CalloutManager {
    constructor(container, satellite3d) {
        this.container = container;
        this.satellite = satellite3d;
        this.svgLayer = document.getElementById('callout-lines');
        this.htmlLayer = document.getElementById('callout-layer');
        this.callouts = {};
        this.selectedId = null;
        this.onSelect = null; // callback(subsystemId)
        this._animFrame = null;

        // Callout definitions: subsystem_id -> label position offsets
        this._definitions = {
            solar_panels:    { label: 'Solar Panels',         sub: 'Power generation',        offX: -180, offY: -60,  side: 'left'  },
            s_band_antenna:  { label: 'S-Band Antenna',       sub: 'Ground link',             offX: -160, offY: -50,  side: 'left'  },
            k_band_antenna:  { label: 'K-Band Antenna',       sub: 'High-rate downlink',      offX:  130, offY: -50,  side: 'right' },
            laser_isl:       { label: 'Laser ISL Terminal',    sub: 'Intersatellite link',     offX:  120, offY: -70,  side: 'right' },
            reaction_wheels: { label: 'Reaction Wheels',       sub: 'Attitude control',        offX: -170, offY:  40,  side: 'left'  },
            thrusters:       { label: 'Thrusters',             sub: 'Orbit maneuvers',         offX:  140, offY:  50,  side: 'right' },
            battery:         { label: 'Battery Pack',          sub: 'Energy storage',          offX: -160, offY:  70,  side: 'left'  },
            obc:             { label: 'On-Board Computer',     sub: 'Central processing',      offX:  150, offY:   0,  side: 'right' },
            payload_optical: { label: 'Payload — Optical',     sub: 'Visible spectrum sensor',  offX: -180, offY: 100,  side: 'left'  },
            payload_swir:    { label: 'Payload — SWIR',        sub: 'Short-wave IR sensor',    offX:   10, offY: 110,  side: 'right' },
            payload_ir:      { label: 'Payload — IR',          sub: 'Infrared sensor',         offX:  150, offY:  90,  side: 'right' },
        };

        this._statusMap = {};  // subsystem_id -> current state string

        this._createCallouts();
        this._startUpdateLoop();
    }

    _createCallouts() {
        // Set SVG layer to fill container
        this.svgLayer.style.position = 'absolute';
        this.svgLayer.style.top = '0';
        this.svgLayer.style.left = '0';
        this.svgLayer.style.width = '100%';
        this.svgLayer.style.height = '100%';
        this.svgLayer.style.pointerEvents = 'none';
        this.svgLayer.style.zIndex = '9';
        this.svgLayer.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        this.htmlLayer.style.position = 'absolute';
        this.htmlLayer.style.top = '0';
        this.htmlLayer.style.left = '0';
        this.htmlLayer.style.width = '100%';
        this.htmlLayer.style.height = '100%';
        this.htmlLayer.style.pointerEvents = 'none';
        this.htmlLayer.style.zIndex = '10';

        for (const [id, def] of Object.entries(this._definitions)) {
            this.callouts[id] = this._createCallout(id, def);
        }
    }

    _createCallout(id, def) {
        const wrapper = document.createElement('div');
        wrapper.className = 'callout';
        wrapper.dataset.subsystem = id;

        // Dot
        const dot = document.createElement('div');
        dot.className = 'callout-dot';
        dot.style.pointerEvents = 'all';
        dot.addEventListener('click', () => this._select(id));

        // Glow ring
        const glow = document.createElement('div');
        glow.className = 'callout-glow';

        // Endpoint dot
        const endpoint = document.createElement('div');
        endpoint.className = 'callout-endpoint';

        // Label box
        const label = document.createElement('div');
        label.className = 'callout-label';
        label.style.pointerEvents = 'all';
        label.addEventListener('click', () => this._select(id));

        const title = document.createElement('div');
        title.className = 'callout-label-title';
        title.textContent = def.label;

        const sub = document.createElement('div');
        sub.className = 'callout-label-sub';
        sub.textContent = def.sub;

        label.appendChild(title);
        label.appendChild(sub);

        wrapper.appendChild(dot);
        wrapper.appendChild(glow);
        wrapper.appendChild(endpoint);
        wrapper.appendChild(label);
        this.htmlLayer.appendChild(wrapper);

        // SVG line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', 'rgba(0, 212, 170, 0.35)');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '4 3');
        this.svgLayer.appendChild(line);

        return { wrapper, dot, glow, endpoint, label, line, def };
    }

    _select(id) {
        // Deselect previous
        if (this.selectedId && this.callouts[this.selectedId]) {
            this.callouts[this.selectedId].wrapper.classList.remove('selected');
            this.callouts[this.selectedId].dot.classList.remove('selected');
        }

        if (this.selectedId === id) {
            this.selectedId = null;
            return;
        }

        this.selectedId = id;
        this.callouts[id].wrapper.classList.add('selected');
        this.callouts[id].dot.classList.add('selected');

        // Stop auto-rotation when user interacts
        this.satellite.controls.autoRotate = false;

        if (this.onSelect) {
            this.onSelect(id);
        }
    }

    deselect() {
        if (this.selectedId && this.callouts[this.selectedId]) {
            this.callouts[this.selectedId].wrapper.classList.remove('selected');
            this.callouts[this.selectedId].dot.classList.remove('selected');
        }
        this.selectedId = null;
    }

    updateStatus(subsystemId, state) {
        this._statusMap[subsystemId] = state;
        const callout = this.callouts[subsystemId];
        if (!callout) return;

        // Update sublabel with current state
        const sub = callout.label.querySelector('.callout-label-sub');
        const def = callout.def;
        if (state && state !== 'unknown') {
            sub.textContent = `${def.sub} · ${state.toUpperCase()}`;
        } else {
            sub.textContent = def.sub;
        }
    }

    _startUpdateLoop() {
        const update = () => {
            this._updatePositions();
            this._animFrame = requestAnimationFrame(update);
        };
        update();
    }

    _updatePositions() {
        const canvas = this.satellite.canvas;
        const rect = canvas.getBoundingClientRect();
        const camera = this.satellite.camera;
        const containerRect = this.container.getBoundingClientRect();

        for (const [id, callout] of Object.entries(this.callouts)) {
            const group = this.satellite.parts[id];
            if (!group) {
                callout.wrapper.style.display = 'none';
                continue;
            }

            // Get world center of the subsystem group
            const box = new THREE.Box3().setFromObject(group);
            const center = box.getCenter(new THREE.Vector3());

            // Project to screen
            const projected = center.clone().project(camera);

            // Check if behind camera
            if (projected.z > 1) {
                callout.wrapper.style.display = 'none';
                callout.line.style.display = 'none';
                continue;
            }

            callout.wrapper.style.display = '';
            callout.line.style.display = '';

            const cx = (projected.x * 0.5 + 0.5) * rect.width;
            const cy = (-projected.y * 0.5 + 0.5) * rect.height;

            // Position dot
            callout.dot.style.left = (cx - 8) + 'px';
            callout.dot.style.top = (cy - 8) + 'px';

            // Position glow
            callout.glow.style.left = (cx - 15) + 'px';
            callout.glow.style.top = (cy - 15) + 'px';

            // Label position
            const def = callout.def;
            const lx = cx + def.offX;
            const ly = cy + def.offY;

            if (def.side === 'left') {
                const labelW = callout.label.offsetWidth || 160;
                callout.label.style.left = (lx - labelW) + 'px';
            } else {
                callout.label.style.left = lx + 'px';
            }
            callout.label.style.top = (ly - 10) + 'px';

            // Endpoint dot
            callout.endpoint.style.left = (lx - 3) + 'px';
            callout.endpoint.style.top = (ly - 3) + 'px';

            // SVG line
            callout.line.setAttribute('x1', cx);
            callout.line.setAttribute('y1', cy);
            callout.line.setAttribute('x2', lx);
            callout.line.setAttribute('y2', ly);

            // Update line color for selected state
            const isSelected = id === this.selectedId;
            callout.line.setAttribute('stroke',
                isSelected ? '#00d4aa' : 'rgba(0, 212, 170, 0.35)');
        }
    }

    dispose() {
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
        }
    }
}
