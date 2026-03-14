/**
 * Main Application
 *
 * Initializes all components and wires them together.
 */

(function () {
    'use strict';

    // Initialize components
    const canvas = document.getElementById('satellite-canvas');
    const hoverLabel = document.getElementById('hover-label');

    const satellite = new Satellite3D(canvas);
    const panel = new SubsystemPanel();
    const console_ = new CommandConsole();
    const linkBar = new LinkStatusBar();
    const ws = new SatelliteWebSocket();

    // Friendly names for subsystem IDs
    const SUBSYSTEM_NAMES = {
        solar_panels: 'Solar Panels',
        s_band_antenna: 'S-Band Antenna',
        k_band_antenna: 'K-Band Antenna',
        laser_isl: 'Laser ISL Terminal',
        reaction_wheels: 'Reaction Wheels',
        thrusters: 'Thrusters',
        battery: 'Battery Pack',
        obc: 'On-Board Computer',
        payload_optical: 'Payload — Optical',
        payload_swir: 'Payload — SWIR',
        payload_ir: 'Payload — IR',
    };

    // === 3D Interaction ===

    satellite.onSubsystemClick = (subsystemId) => {
        panel.show(subsystemId);
    };

    satellite.onSubsystemHover = (subsystemId, x, y) => {
        if (subsystemId) {
            hoverLabel.textContent = SUBSYSTEM_NAMES[subsystemId] || subsystemId;
            hoverLabel.style.left = (x + 15) + 'px';
            hoverLabel.style.top = (y - 10) + 'px';
            hoverLabel.style.display = 'block';
        } else {
            hoverLabel.style.display = 'none';
        }
    };

    // === Panel Commands ===

    panel.onCommand = (subsystemId, action) => {
        console_.logCommand(subsystemId, action);
        const sent = ws.sendCommand(subsystemId, action);
        if (!sent) {
            console_.logError('Not connected to server');
        }
    };

    // === WebSocket Events ===

    ws.onFullState = (state) => {
        console_.logInfo('Received full satellite state');

        // Load subsystem states
        if (state.subsystems) {
            panel.loadFullState(state.subsystems);
            for (const [id, data] of Object.entries(state.subsystems)) {
                satellite.updateSubsystemState(id, data.state);
            }
        }

        // Load link states
        if (state.links) {
            linkBar.loadFullState(state.links);
        }
    };

    ws.onSubsystemUpdate = (data) => {
        const id = data.subsystem_id;
        panel.updateSubsystemData(id, data);
        satellite.updateSubsystemState(id, data.state);
        console_.logStatus(id, data.state);
    };

    ws.onLinkUpdate = (data) => {
        linkBar.updateLink(data.link_id, data);
    };

    ws.onTelemetryUpdate = (data) => {
        // Telemetry updates health metrics for a subsystem
        const id = data.subsystem_id;
        if (id) {
            const existing = panel._subsystemData[id];
            if (existing) {
                existing.health = { ...existing.health, ...data.data };
                panel.updateSubsystemData(id, existing);
            }
        }
    };

    ws.onCommandAck = (data) => {
        console_.logAck(data.subsystem_id, data.action, data.success);
    };

    ws.onMqttStatus = (data) => {
        linkBar.setMqttStatus(data.connected);
        if (data.connected) {
            console_.logInfo('MQTT broker connected');
        } else {
            console_.logError('MQTT broker disconnected');
        }
    };

    ws.onConnectionChange = (connected) => {
        if (connected) {
            console_.logInfo('Connected to satellite control server');
        } else {
            console_.logError('Disconnected from server, reconnecting...');
        }
    };

    // === Window Events ===

    window.addEventListener('resize', () => {
        satellite.resize();
    });

    // Keyboard shortcut: Escape to close panel
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            panel.hide();
            satellite.controls.autoRotate = true;
        }
    });

    // === Start ===

    console_.logInfo('Satellite Control System initializing...');
    ws.connect();
    console_.logInfo('3D satellite model loaded');

})();
