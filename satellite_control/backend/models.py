"""Pydantic models for satellite control system."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SubsystemAction(str, Enum):
    ON = "on"
    OFF = "off"
    REBOOT = "reboot"


class SubsystemState(str, Enum):
    ON = "on"
    OFF = "off"
    ERROR = "error"
    REBOOTING = "rebooting"
    UNKNOWN = "unknown"


class SubsystemCommand(BaseModel):
    subsystem_id: str
    action: SubsystemAction
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthMetrics(BaseModel):
    temperature_c: Optional[float] = None
    power_w: Optional[float] = None
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class SubsystemStatus(BaseModel):
    subsystem_id: str
    name: str
    state: SubsystemState = SubsystemState.UNKNOWN
    health: HealthMetrics = Field(default_factory=HealthMetrics)
    commands: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class LinkStatus(BaseModel):
    link_id: str
    name: str
    active: bool = False
    signal_dbm: Optional[float] = None
    latency_ms: Optional[float] = None
    data_rate_kbps: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TelemetryUpdate(BaseModel):
    subsystem_id: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# WebSocket message types
class WSMessageType(str, Enum):
    FULL_STATE = "full_state"
    SUBSYSTEM_UPDATE = "subsystem_update"
    LINK_UPDATE = "link_update"
    TELEMETRY_UPDATE = "telemetry_update"
    COMMAND = "command"
    COMMAND_ACK = "command_ack"
    MQTT_STATUS = "mqtt_status"


class WSMessage(BaseModel):
    type: WSMessageType
    payload: Dict[str, Any]
