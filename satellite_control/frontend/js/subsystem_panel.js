/**
 * Subsystem Detail Panel
 *
 * Slides in from the right when a satellite part is clicked.
 * Shows status, health metrics, and command buttons.
 */

class SubsystemPanel {
    constructor() {
        this.panel = document.getElementById('subsystem-panel');
        this.title = document.getElementById('panel-title');
        this.statusBadge = document.getElementById('panel-status');
        this.metricsContainer = document.getElementById('panel-metrics');
        this.commandsContainer = document.getElementById('panel-commands');
        this.closeBtn = document.getElementById('panel-close');

        this.currentSubsystem = null;
        this.onCommand = null; // callback(subsystemId, action)
        this._subsystemData = {};

        this.closeBtn.addEventListener('click', () => this.hide());
    }

    show(subsystemId) {
        this.currentSubsystem = subsystemId;
        const data = this._subsystemData[subsystemId];

        if (data) {
            this.title.textContent = data.name || subsystemId;
            this._updateStatus(data.state);
            this._renderMetrics(data.health);
            this._renderCommands(data.commands || []);
        } else {
            this.title.textContent = subsystemId;
            this._updateStatus('unknown');
            this.metricsContainer.innerHTML = '<div class="metric-row"><span class="metric-label">No data available</span></div>';
            this._renderCommands([]);
        }

        this.panel.classList.remove('hidden');
    }

    hide() {
        this.panel.classList.add('hidden');
        this.currentSubsystem = null;
    }

    updateSubsystemData(subsystemId, data) {
        this._subsystemData[subsystemId] = data;

        // If this subsystem is currently displayed, refresh it
        if (this.currentSubsystem === subsystemId) {
            this._updateStatus(data.state);
            this._renderMetrics(data.health);
            if (data.commands) {
                this._renderCommands(data.commands);
            }
        }
    }

    loadFullState(subsystems) {
        for (const [id, data] of Object.entries(subsystems)) {
            this._subsystemData[id] = data;
        }
    }

    _updateStatus(state) {
        this.statusBadge.textContent = state || 'unknown';
        this.statusBadge.className = 'status-badge ' + (state || 'unknown');
    }

    _renderMetrics(health) {
        if (!health) {
            this.metricsContainer.innerHTML = '';
            return;
        }

        const metrics = [];

        if (health.temperature_c != null) {
            metrics.push(['Temperature', `${health.temperature_c.toFixed(1)} °C`]);
        }
        if (health.power_w != null) {
            metrics.push(['Power Draw', `${health.power_w.toFixed(2)} W`]);
        }
        if (health.voltage_v != null) {
            metrics.push(['Voltage', `${health.voltage_v.toFixed(2)} V`]);
        }
        if (health.current_a != null) {
            metrics.push(['Current', `${health.current_a.toFixed(3)} A`]);
        }

        // Extra metrics
        if (health.extra) {
            for (const [key, value] of Object.entries(health.extra)) {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const display = typeof value === 'number' ? value.toFixed(2) : String(value);
                metrics.push([label, display]);
            }
        }

        if (metrics.length === 0) {
            this.metricsContainer.innerHTML = '<div class="metric-row"><span class="metric-label">No telemetry</span></div>';
            return;
        }

        this.metricsContainer.innerHTML = metrics.map(([label, value]) =>
            `<div class="metric-row">
                <span class="metric-label">${label}</span>
                <span class="metric-value">${value}</span>
            </div>`
        ).join('');
    }

    _renderCommands(commands) {
        this.commandsContainer.innerHTML = commands.map(cmd =>
            `<button class="cmd-btn ${cmd}" data-action="${cmd}">${cmd.charAt(0).toUpperCase() + cmd.slice(1)}</button>`
        ).join('');

        // Bind click handlers
        this.commandsContainer.querySelectorAll('.cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (this.onCommand && this.currentSubsystem) {
                    this.onCommand(this.currentSubsystem, action);
                }
            });
        });
    }
}
