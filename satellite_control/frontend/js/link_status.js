/**
 * Communication Link Status Indicators
 *
 * Header bar showing Laser ISL, S-Band, K-Band link status
 * plus MQTT/connection status.
 */

class LinkStatusBar {
    constructor() {
        this.indicators = {};
        this.mqttDot = document.getElementById('mqtt-dot');
        this.connectionLabel = document.getElementById('connection-label');

        document.querySelectorAll('.link-indicator').forEach(el => {
            const linkId = el.dataset.link;
            if (linkId) {
                this.indicators[linkId] = {
                    element: el,
                    dot: el.querySelector('.link-dot'),
                    details: el.querySelector('.link-details'),
                };
            }
        });
    }

    updateLink(linkId, data) {
        const ind = this.indicators[linkId];
        if (!ind) return;

        const active = data.active;
        ind.dot.className = 'link-dot' + (active ? ' active' : '');

        const parts = [];
        if (data.signal_dbm != null) {
            parts.push(`${data.signal_dbm.toFixed(0)}dBm`);
        }
        if (data.latency_ms != null) {
            parts.push(`${data.latency_ms.toFixed(0)}ms`);
        }
        ind.details.textContent = parts.join(' · ');
    }

    loadFullState(links) {
        for (const [id, data] of Object.entries(links)) {
            this.updateLink(id, data);
        }
    }

    setMqttStatus(connected) {
        this.mqttDot.className = 'link-dot' + (connected ? ' active' : '');
        this.connectionLabel.textContent = connected ? 'Running' : 'Offline';
    }
}
