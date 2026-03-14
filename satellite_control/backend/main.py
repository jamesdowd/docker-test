"""FastAPI application entry point for the Satellite Control System."""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .models import WSMessageType
from .mqtt_client import MQTTClient
from .subsystem_state import StateCache
from .websocket_manager import WebSocketManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Globals
state_cache = StateCache()
ws_manager = WebSocketManager()
mqtt_client = MQTTClient()
_event_loop: asyncio.AbstractEventLoop = None

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


def _schedule_broadcast(msg_type: WSMessageType, payload: Dict[str, Any]):
    """Schedule a WebSocket broadcast from a non-async context (MQTT thread)."""
    if _event_loop and _event_loop.is_running():
        asyncio.run_coroutine_threadsafe(
            ws_manager.broadcast(msg_type, payload),
            _event_loop,
        )


def _on_status_update(subsystem_id: str, data: Dict[str, Any]):
    """Called from MQTT thread when a subsystem status update arrives."""
    updated = state_cache.update_subsystem(
        subsystem_id,
        state=data.get("state"),
        health=data.get("health"),
        timestamp=data.get("timestamp"),
    )
    if updated:
        _schedule_broadcast(WSMessageType.SUBSYSTEM_UPDATE, updated)


def _on_link_update(link_id: str, data: Dict[str, Any]):
    """Called from MQTT thread when a link status update arrives."""
    updated = state_cache.update_link(
        link_id,
        active=data.get("active"),
        signal_dbm=data.get("signal_dbm"),
        latency_ms=data.get("latency_ms"),
        data_rate_kbps=data.get("data_rate_kbps"),
        timestamp=data.get("timestamp"),
    )
    if updated:
        _schedule_broadcast(WSMessageType.LINK_UPDATE, updated)


def _on_telemetry_update(subsystem_id: str, data: Dict[str, Any]):
    """Called from MQTT thread when telemetry data arrives."""
    # Update health metrics from telemetry
    state_cache.update_subsystem(subsystem_id, health=data)
    _schedule_broadcast(
        WSMessageType.TELEMETRY_UPDATE,
        {"subsystem_id": subsystem_id, "data": data},
    )


def _on_mqtt_connection(connected: bool):
    """Called from MQTT thread on connection state change."""
    _schedule_broadcast(
        WSMessageType.MQTT_STATUS,
        {"connected": connected},
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    global _event_loop
    _event_loop = asyncio.get_event_loop()

    # Set up MQTT callbacks and connect
    mqtt_client.set_callbacks(
        on_status=_on_status_update,
        on_link=_on_link_update,
        on_telemetry=_on_telemetry_update,
        on_connection=_on_mqtt_connection,
    )
    mqtt_client.connect()
    logger.info("Satellite Control System started")

    yield

    mqtt_client.disconnect()
    logger.info("Satellite Control System stopped")


app = FastAPI(
    title="Satellite Control System",
    description="3D satellite visualization and control interface",
    lifespan=lifespan,
)

# Serve static frontend files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
async def root():
    """Serve the main frontend page."""
    return FileResponse(str(FRONTEND_DIR / "index.html"))


class CommandRequest(BaseModel):
    subsystem_id: str
    action: str


@app.post("/api/command")
async def send_command(cmd: CommandRequest):
    """REST fallback for sending commands."""
    success = mqtt_client.send_command(cmd.subsystem_id, cmd.action)
    return {"success": success, "subsystem_id": cmd.subsystem_id, "action": cmd.action}


@app.get("/api/state")
async def get_state():
    """Get full satellite state snapshot."""
    return state_cache.get_full_state()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint for real-time frontend communication."""
    await ws_manager.connect(ws)

    # Send full state snapshot on connect
    await ws_manager.send_to(
        ws,
        WSMessageType.FULL_STATE,
        state_cache.get_full_state(),
    )

    # Send MQTT connection status
    await ws_manager.send_to(
        ws,
        WSMessageType.MQTT_STATUS,
        {"connected": mqtt_client.is_connected},
    )

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "command":
                payload = data.get("payload", {})
                subsystem_id = payload.get("subsystem_id")
                action = payload.get("action")
                if subsystem_id and action:
                    success = mqtt_client.send_command(subsystem_id, action)
                    await ws_manager.send_to(
                        ws,
                        WSMessageType.COMMAND_ACK,
                        {
                            "subsystem_id": subsystem_id,
                            "action": action,
                            "success": success,
                        },
                    )
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        ws_manager.disconnect(ws)


def main():
    """Run the application."""
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "satellite_control.backend.main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
