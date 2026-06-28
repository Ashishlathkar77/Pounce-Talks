"""
Pounce — /api/live SSE router

Streams real-time call events (transcript turns, call started/ended) to the
Live Monitor dashboard. Uses a simple in-memory asyncio.Queue broadcaster —
one queue per connected frontend client. The agent_worker pushes events via
POST /api/webhook/calls/{id}/live-event; this router fans them out to all
connected SSE subscribers.

Single-process design (works for ECS single-task or local dev). If you ever
scale to multiple API instances, replace _subscribers with a Redis pub/sub.
"""

from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/live", tags=["live"])

# One asyncio.Queue per connected SSE client. Max 100 events buffered.
_subscribers: list[asyncio.Queue] = []


def broadcast(event: dict) -> None:
    """Push a JSON event to every connected Live Monitor client."""
    payload = json.dumps(event)
    dead = []
    for q in _subscribers:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        try:
            _subscribers.remove(q)
        except ValueError:
            pass


@router.get("/calls")
async def live_calls_sse(request: Request):
    """
    SSE stream consumed by the Live Monitor page.
    Sends a `snapshot` of current active calls on connect, then streams
    `call_started`, `transcript_turn`, and `call_ended` events in real time.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.append(q)
    log.info("live_sse_client_connected", total=len(_subscribers))

    async def _generate():
        try:
            # Initial snapshot — empty (agent_worker will push call_started soon)
            yield f"data: {json.dumps({'type': 'snapshot', 'calls': []})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=25.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"  # keeps the connection alive through proxies
        finally:
            try:
                _subscribers.remove(q)
            except ValueError:
                pass
            log.info("live_sse_client_disconnected", total=len(_subscribers))

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        },
    )
