"""MQTT client for satellite ground system integration."""

import json
import logging
import os
import time
import threading
from typing import Any, Callable, Dict, Optional

import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)

# Topic patterns
TOPIC_CMD = "satellite/cmd/{subsystem}"
TOPIC_STATUS = "satellite/status/#"
TOPIC_LINK = "satellite/link/#"
TOPIC_TELEMETRY = "satellite/telemetry/#"


class MQTTClient:
    """Manages MQTT connection to the satellite ground system message bus."""

    def __init__(
        self,
        broker_host: str = None,
        broker_port: int = None,
        client_id: str = "satellite-viz",
    ):
        self._broker_host = broker_host or os.getenv("MQTT_HOST", "localhost")
        self._broker_port = broker_port or int(os.getenv("MQTT_PORT", "1883"))
        self._client_id = client_id
        self._client: Optional[mqtt.Client] = None
        self._connected = False
        self._on_status_update: Optional[Callable] = None
        self._on_link_update: Optional[Callable] = None
        self._on_telemetry_update: Optional[Callable] = None
        self._on_connection_change: Optional[Callable] = None
        self._retry_thread: Optional[threading.Thread] = None
        self._should_run = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    def set_callbacks(
        self,
        on_status: Callable[[str, Dict[str, Any]], None] = None,
        on_link: Callable[[str, Dict[str, Any]], None] = None,
        on_telemetry: Callable[[str, Dict[str, Any]], None] = None,
        on_connection: Callable[[bool], None] = None,
    ):
        self._on_status_update = on_status
        self._on_link_update = on_link
        self._on_telemetry_update = on_telemetry
        self._on_connection_change = on_connection

    def connect(self):
        """Connect to MQTT broker with retry logic (non-blocking)."""
        self._should_run = True
        self._client = mqtt.Client(
            client_id=self._client_id,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

        self._retry_thread = threading.Thread(
            target=self._try_connect, daemon=True
        )
        self._retry_thread.start()

    def _try_connect(self):
        """Attempt connection with exponential backoff."""
        delays = [2, 4, 8, 16]
        for attempt, delay in enumerate(delays):
            try:
                logger.info(
                    "Connecting to MQTT broker at %s:%d (attempt %d)",
                    self._broker_host,
                    self._broker_port,
                    attempt + 1,
                )
                self._client.connect(self._broker_host, self._broker_port, keepalive=60)
                self._client.loop_start()
                return
            except (ConnectionRefusedError, OSError) as e:
                logger.warning("MQTT connect failed: %s, retrying in %ds", e, delay)
                if not self._should_run:
                    return
                time.sleep(delay)

        logger.error("Failed to connect to MQTT broker after all retries")
        if self._on_connection_change:
            self._on_connection_change(False)

    def disconnect(self):
        """Disconnect from MQTT broker."""
        self._should_run = False
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            self._connected = False
            logger.info("Disconnected from MQTT broker")

    def send_command(self, subsystem_id: str, action: str):
        """Publish a command to the ground system."""
        if not self._connected:
            logger.warning("Cannot send command: not connected to MQTT")
            return False

        topic = TOPIC_CMD.format(subsystem=subsystem_id)
        payload = json.dumps({
            "action": action,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })

        result = self._client.publish(topic, payload, qos=1)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            logger.info("Command sent: %s → %s", topic, payload)
            return True
        else:
            logger.error("Failed to publish command: rc=%d", result.rc)
            return False

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self._connected = True
            logger.info("Connected to MQTT broker")
            # Subscribe to all status/link/telemetry topics
            client.subscribe(TOPIC_STATUS, qos=1)
            client.subscribe(TOPIC_LINK, qos=1)
            client.subscribe(TOPIC_TELEMETRY, qos=1)
            if self._on_connection_change:
                self._on_connection_change(True)
        else:
            logger.error("MQTT connection failed: rc=%d", rc)

    def _on_disconnect(self, client, userdata, flags, rc, properties=None):
        self._connected = False
        logger.warning("Disconnected from MQTT broker: rc=%d", rc)
        if self._on_connection_change:
            self._on_connection_change(False)

        # Auto-reconnect
        if self._should_run:
            self._retry_thread = threading.Thread(
                target=self._try_connect, daemon=True
            )
            self._retry_thread.start()

    def _on_message(self, client, userdata, msg):
        """Handle incoming MQTT messages."""
        try:
            payload = json.loads(msg.payload.decode())
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.error("Invalid MQTT message on %s: %s", msg.topic, e)
            return

        topic_parts = msg.topic.split("/")
        if len(topic_parts) < 3:
            return

        category = topic_parts[1]  # status, link, or telemetry
        entity_id = "/".join(topic_parts[2:])  # subsystem or link id

        if category == "status" and self._on_status_update:
            self._on_status_update(entity_id, payload)
        elif category == "link" and self._on_link_update:
            self._on_link_update(entity_id, payload)
        elif category == "telemetry" and self._on_telemetry_update:
            self._on_telemetry_update(entity_id, payload)
