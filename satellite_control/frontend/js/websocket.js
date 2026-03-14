/**
 * WebSocket Client
 *
 * Manages connection to the FastAPI backend with auto-reconnect.
 */

class SatelliteWebSocket {
    constructor() {
        this._ws = null;
        this._connected = false;
        this._reconnectDelay = 1000;
        this._maxReconnectDelay = 16000;
        this._shouldReconnect = true;

        // Callbacks
        this.onFullState = null;
        this.onSubsystemUpdate = null;
        this.onLinkUpdate = null;
        this.onTelemetryUpdate = null;
        this.onCommandAck = null;
        this.onMqttStatus = null;
        this.onConnectionChange = null;
    }

    connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws`;

        this._ws = new WebSocket(url);

        this._ws.onopen = () => {
            this._connected = true;
            this._reconnectDelay = 1000;
            if (this.onConnectionChange) this.onConnectionChange(true);
        };

        this._ws.onclose = () => {
            this._connected = false;
            if (this.onConnectionChange) this.onConnectionChange(false);
            if (this._shouldReconnect) {
                setTimeout(() => this.connect(), this._reconnectDelay);
                this._reconnectDelay = Math.min(
                    this._reconnectDelay * 2,
                    this._maxReconnectDelay
                );
            }
        };

        this._ws.onerror = () => {
            // onclose will fire after this
        };

        this._ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._dispatch(msg);
            } catch (e) {
                console.error('Invalid WebSocket message:', e);
            }
        };
    }

    disconnect() {
        this._shouldReconnect = false;
        if (this._ws) {
            this._ws.close();
        }
    }

    sendCommand(subsystemId, action) {
        if (!this._connected) return false;
        this._ws.send(JSON.stringify({
            type: 'command',
            payload: {
                subsystem_id: subsystemId,
                action: action,
            },
        }));
        return true;
    }

    _dispatch(msg) {
        switch (msg.type) {
            case 'full_state':
                if (this.onFullState) this.onFullState(msg.payload);
                break;
            case 'subsystem_update':
                if (this.onSubsystemUpdate) this.onSubsystemUpdate(msg.payload);
                break;
            case 'link_update':
                if (this.onLinkUpdate) this.onLinkUpdate(msg.payload);
                break;
            case 'telemetry_update':
                if (this.onTelemetryUpdate) this.onTelemetryUpdate(msg.payload);
                break;
            case 'command_ack':
                if (this.onCommandAck) this.onCommandAck(msg.payload);
                break;
            case 'mqtt_status':
                if (this.onMqttStatus) this.onMqttStatus(msg.payload);
                break;
        }
    }

    get isConnected() {
        return this._connected;
    }
}
