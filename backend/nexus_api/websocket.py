"""WebSocket hub — broadcasts live decision events every second."""
import asyncio
import json
import random
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect


class WebSocketManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        try:
            await self._stream(ws)
        except WebSocketDisconnect:
            pass
        finally:
            self.active.discard(ws)

    async def _stream(self, ws: WebSocket):
        from .database import query
        txs = query("SELECT id, event_date, final_result, rules_fired FROM transactions")
        idx = 0
        while True:
            await asyncio.sleep(0.8)
            tx = txs[idx % len(txs)]
            idx += 1
            event = {
                "tx_id":       tx["id"],
                "timestamp":   __import__("datetime").datetime.utcnow().isoformat() + "Z",
                "result":      tx["final_result"],
                "rules_fired": tx["rules_fired"],
                "is_verified": tx["final_result"] == "IDENTITY_VERIFIED",
            }
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                break

    async def broadcast(self, message: dict):
        dead = set()
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.add(ws)
        self.active -= dead


websocket_manager = WebSocketManager()
