"""WebSocket manager for real-time frontend communication."""

import json
import logging
from typing import Any, Dict, Set

from fastapi import WebSocket

from .models import WSMessage, WSMessageType

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections to frontend clients."""

    def __init__(self):
        self._connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.add(ws)
        logger.info("WebSocket client connected (%d total)", len(self._connections))

    def disconnect(self, ws: WebSocket):
        self._connections.discard(ws)
        logger.info("WebSocket client disconnected (%d total)", len(self._connections))

    async def send_to(self, ws: WebSocket, msg_type: WSMessageType, payload: Dict[str, Any]):
        """Send a message to a specific client."""
        message = WSMessage(type=msg_type, payload=payload)
        try:
            await ws.send_json(message.model_dump(mode="json"))
        except Exception as e:
            logger.error("Error sending to WebSocket: %s", e)
            self.disconnect(ws)

    async def broadcast(self, msg_type: WSMessageType, payload: Dict[str, Any]):
        """Broadcast a message to all connected clients."""
        if not self._connections:
            return

        message = WSMessage(type=msg_type, payload=payload)
        data = message.model_dump(mode="json")
        dead = []

        for ws in self._connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self._connections.discard(ws)

    @property
    def client_count(self) -> int:
        return len(self._connections)
