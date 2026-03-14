"""In-memory state cache for all satellite subsystems and links."""

import json
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from .models import (
    HealthMetrics,
    LinkStatus,
    SubsystemState,
    SubsystemStatus,
)

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent.parent / "config" / "subsystems.json"


class StateCache:
    """Thread-safe in-memory cache of satellite subsystem and link states."""

    def __init__(self):
        self._lock = threading.Lock()
        self._subsystems: Dict[str, SubsystemStatus] = {}
        self._links: Dict[str, LinkStatus] = {}
        self._load_config()

    def _load_config(self):
        """Load subsystem and link definitions from config."""
        try:
            with open(CONFIG_PATH) as f:
                config = json.load(f)
        except FileNotFoundError:
            logger.warning("Config file not found at %s, using defaults", CONFIG_PATH)
            config = {"subsystems": [], "links": []}

        for sub in config.get("subsystems", []):
            self._subsystems[sub["id"]] = SubsystemStatus(
                subsystem_id=sub["id"],
                name=sub["name"],
                state=SubsystemState.UNKNOWN,
                commands=sub.get("commands", []),
            )

        for link in config.get("links", []):
            self._links[link["id"]] = LinkStatus(
                link_id=link["id"],
                name=link["name"],
            )

        logger.info(
            "Loaded %d subsystems, %d links from config",
            len(self._subsystems),
            len(self._links),
        )

    def get_full_state(self) -> Dict[str, Any]:
        """Get complete state snapshot for new WebSocket clients."""
        with self._lock:
            return {
                "subsystems": {
                    sid: s.model_dump(mode="json")
                    for sid, s in self._subsystems.items()
                },
                "links": {
                    lid: l.model_dump(mode="json")
                    for lid, l in self._links.items()
                },
            }

    def update_subsystem(
        self,
        subsystem_id: str,
        state: Optional[str] = None,
        health: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update a subsystem's state. Returns the updated status dict or None."""
        with self._lock:
            sub = self._subsystems.get(subsystem_id)
            if sub is None:
                logger.warning("Unknown subsystem: %s", subsystem_id)
                return None

            if state is not None:
                try:
                    sub.state = SubsystemState(state)
                except ValueError:
                    sub.state = SubsystemState.UNKNOWN

            if health is not None:
                sub.health = HealthMetrics(
                    temperature_c=health.get("temperature_c"),
                    power_w=health.get("power_w"),
                    voltage_v=health.get("voltage_v"),
                    current_a=health.get("current_a"),
                    extra={
                        k: v
                        for k, v in health.items()
                        if k not in ("temperature_c", "power_w", "voltage_v", "current_a")
                    },
                )

            if timestamp:
                try:
                    sub.timestamp = datetime.fromisoformat(timestamp)
                except ValueError:
                    sub.timestamp = datetime.utcnow()
            else:
                sub.timestamp = datetime.utcnow()

            return sub.model_dump(mode="json")

    def update_link(
        self,
        link_id: str,
        active: Optional[bool] = None,
        signal_dbm: Optional[float] = None,
        latency_ms: Optional[float] = None,
        data_rate_kbps: Optional[float] = None,
        timestamp: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update a link's status. Returns the updated status dict or None."""
        with self._lock:
            link = self._links.get(link_id)
            if link is None:
                logger.warning("Unknown link: %s", link_id)
                return None

            if active is not None:
                link.active = active
            if signal_dbm is not None:
                link.signal_dbm = signal_dbm
            if latency_ms is not None:
                link.latency_ms = latency_ms
            if data_rate_kbps is not None:
                link.data_rate_kbps = data_rate_kbps

            if timestamp:
                try:
                    link.timestamp = datetime.fromisoformat(timestamp)
                except ValueError:
                    link.timestamp = datetime.utcnow()
            else:
                link.timestamp = datetime.utcnow()

            return link.model_dump(mode="json")

    def get_subsystem(self, subsystem_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            sub = self._subsystems.get(subsystem_id)
            return sub.model_dump(mode="json") if sub else None

    def get_link(self, link_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            link = self._links.get(link_id)
            return link.model_dump(mode="json") if link else None
