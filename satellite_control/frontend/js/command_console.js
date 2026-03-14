/**
 * Command Console
 *
 * Bottom panel showing timestamped command log.
 * Color-coded: cyan=command sent, green=ACK, red=error, gray=info.
 */

class CommandConsole {
    constructor() {
        this.log = document.getElementById('console-log');
        this.toggleBtn = document.getElementById('console-toggle');
        this.console = document.getElementById('command-console');
        this._collapsed = false;
        this._maxEntries = 200;

        this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    toggle() {
        this._collapsed = !this._collapsed;
        this.console.classList.toggle('collapsed', this._collapsed);
        this.toggleBtn.textContent = this._collapsed ? '\u25B2' : '\u25BC';
    }

    addEntry(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = 'console-entry';

        const time = new Date().toISOString().substring(11, 19);
        entry.innerHTML = `<span class="console-time">${time}</span><span class="console-msg ${type}">${this._escape(message)}</span>`;

        this.log.appendChild(entry);

        // Trim old entries
        while (this.log.children.length > this._maxEntries) {
            this.log.removeChild(this.log.firstChild);
        }

        // Auto-scroll
        this.log.scrollTop = this.log.scrollHeight;
    }

    logCommand(subsystemId, action) {
        this.addEntry(`CMD → ${subsystemId}: ${action}`, 'cmd');
    }

    logAck(subsystemId, action, success) {
        if (success) {
            this.addEntry(`ACK ← ${subsystemId}: ${action} accepted`, 'ack');
        } else {
            this.addEntry(`NAK ← ${subsystemId}: ${action} rejected`, 'error');
        }
    }

    logStatus(subsystemId, state) {
        this.addEntry(`STATUS: ${subsystemId} → ${state}`, 'info');
    }

    logError(message) {
        this.addEntry(`ERROR: ${message}`, 'error');
    }

    logInfo(message) {
        this.addEntry(message, 'info');
    }

    _escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
