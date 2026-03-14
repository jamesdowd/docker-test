/**
 * Main Application
 *
 * Initializes all components and wires them together.
 * Layout inspired by Mouser: sidebar + header + viewer + action panel.
 */

(function () {
    'use strict';

    const canvas = document.getElementById('satellite-canvas');
    const viewerContainer = document.getElementById('viewer-container');

    // Initialize components
    const satellite = new Satellite3D(canvas);
    const callouts = new CalloutManager(viewerContainer, satellite);
    const panel = new SubsystemPanel();
    const console_ = new CommandConsole();
    const linkBar = new LinkStatusBar();
    const ws = new SatelliteWebSocket();

    // === Callout → Panel Interaction ===

    callouts.onSelect = (subsystemId) => {
        panel.show(subsystemId);
    };

    // Disable the old hover-label based interaction
    satellite.onSubsystemClick = (subsystemId) => {
        callouts._select(subsystemId);
        panel.show(subsystemId);
    };

    satellite.onSubsystemHover = null;

    // === Panel Commands ===

    panel.onCommand = (subsystemId, action) => {
        console_.logCommand(subsystemId, action);
        const sent = ws.sendCommand(subsystemId, action);
        if (!sent) {
            console_.logError('Not connected to server');
        }
    };

    // === Panel close → deselect callout ===

    const origHide = panel.hide.bind(panel);
    panel.hide = () => {
        origHide();
        callouts.deselect();
        satellite.controls.autoRotate = true;
    };

    // === WebSocket Events ===

    ws.onFullState = (state) => {
        console_.logInfo('Received full satellite state');

        if (state.subsystems) {
            panel.loadFullState(state.subsystems);
            for (const [id, data] of Object.entries(state.subsystems)) {
                satellite.updateSubsystemState(id, data.state);
                callouts.updateStatus(id, data.state);
            }
        }

        if (state.links) {
            linkBar.loadFullState(state.links);
        }
    };

    ws.onSubsystemUpdate = (data) => {
        const id = data.subsystem_id;
        panel.updateSubsystemData(id, data);
        satellite.updateSubsystemState(id, data.state);
        callouts.updateStatus(id, data.state);
        console_.logStatus(id, data.state);
    };

    ws.onLinkUpdate = (data) => {
        linkBar.updateLink(data.link_id, data);
    };

    ws.onTelemetryUpdate = (data) => {
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            panel.hide();
        }
    });

    // === Sidebar nav (placeholder for future pages) ===

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // === Start ===

    console_.logInfo('SatControl initializing...');
    ws.connect();
    console_.logInfo('3D satellite model loaded');

})();
