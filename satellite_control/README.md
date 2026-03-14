# Satellite Control System

3D satellite visualization and control interface that connects to an existing ground system via MQTT.

## Architecture

- **Backend**: Python FastAPI server with WebSocket support
- **Frontend**: Three.js 3D interactive satellite model
- **Message Bus**: MQTT for ground system integration

## Quick Start

### Prerequisites

- Python 3.10+
- MQTT broker (e.g., Mosquitto) running on `localhost:1883`

### Install & Run

```bash
cd satellite_control
pip install -r requirements.txt
python -m satellite_control
```

Open http://localhost:8000 in your browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_HOST` | `localhost` | MQTT broker hostname |
| `MQTT_PORT` | `1883` | MQTT broker port |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |

## MQTT Topics

### Commands (app → ground system)

```
satellite/cmd/{subsystem_id}
Payload: {"action": "on"|"off"|"reboot", "timestamp": "ISO8601"}
```

### Status Updates (ground system → app)

```
satellite/status/{subsystem_id}
Payload: {"state": "on"|"off"|"error"|"rebooting", "health": {...}, "timestamp": "ISO8601"}
```

### Link Status

```
satellite/link/{link_id}   (laser_isl, s_band, k_band)
Payload: {"active": true, "signal_dbm": -72, "latency_ms": 240, "data_rate_kbps": 100.0}
```

### Telemetry

```
satellite/telemetry/{subsystem_id}
Payload: {"temperature_c": 25.3, "power_w": 12.5, ...}
```

## Subsystems

| ID | Name | Commands |
|----|------|----------|
| `solar_panels` | Solar Panels | on, off |
| `s_band_antenna` | S-Band Antenna | on, off, reboot |
| `k_band_antenna` | K-Band Antenna | on, off, reboot |
| `laser_isl` | Laser ISL Terminal | on, off, reboot |
| `reaction_wheels` | Reaction Wheels | on, off, reboot |
| `thrusters` | Thrusters | on, off |
| `battery` | Battery Pack | on, off |
| `obc` | On-Board Computer | on, off, reboot |
| `payload_optical` | Payload — Optical | on, off, reboot |
| `payload_swir` | Payload — SWIR | on, off, reboot |
| `payload_ir` | Payload — IR | on, off, reboot |

## Testing Without a Ground System

You can simulate status updates using `mosquitto_pub`:

```bash
# Set OBC to "on"
mosquitto_pub -t satellite/status/obc -m '{"state":"on","health":{"temperature_c":35.2,"power_w":3.1}}'

# Set S-Band link active
mosquitto_pub -t satellite/link/s_band -m '{"active":true,"signal_dbm":-72,"latency_ms":240,"data_rate_kbps":9.6}'

# Send telemetry
mosquitto_pub -t satellite/telemetry/battery -m '{"temperature_c":22.0,"voltage_v":8.2,"current_a":1.5}'
```

## UI Features

- **3D Satellite Model**: Interactive Three.js visualization with orbit controls
- **Click-to-Inspect**: Click any subsystem part for detailed status and commands
- **Color-Coded Status**: Green (on), gray (off), red (error), yellow (rebooting)
- **Link Status Bar**: Real-time Laser ISL, S-Band, K-Band indicators
- **Command Console**: Timestamped log of all commands and responses
- **Hover Labels**: Mouse over parts to see subsystem names
