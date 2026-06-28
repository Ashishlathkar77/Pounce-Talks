"""
Pounce — Twilio TwiML webhook endpoints.

When Twilio places an outbound call and the prospect answers, Twilio hits
/api/twiml/{room_name}. We return TwiML that bridges the Twilio call into
the LiveKit room via SIP inbound, connecting the prospect to the AI agent.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/twiml", tags=["twiml"])

# LiveKit SIP inbound proxy for the Claivon cluster
_LK_SIP_HOST = "claivon-ai-exz68em3.sip.livekit.cloud"


@router.api_route("/{room_name}", methods=["GET", "POST"])
async def twiml_bridge(room_name: str, request: Request):
    """
    Called by Twilio when the prospect answers.
    Returns TwiML that bridges the Twilio call into the LiveKit SIP room.
    """
    log.info("twiml_bridge_called", room=room_name)

    # <Dial><Sip> bridges the Twilio call into the LiveKit SIP inbound proxy.
    # LiveKit's callee dispatch rule routes pounce-* rooms to the matching room.
    # transport=tls is required for LiveKit SIP to accept the call
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="+15108900197" timeout="30">
    <Sip>sip:{room_name}@{_LK_SIP_HOST}</Sip>
  </Dial>
</Response>"""

    return PlainTextResponse(content=twiml, media_type="text/xml")


@router.api_route("/status/{room_name}", methods=["GET", "POST"])
async def twiml_status(room_name: str, request: Request):
    """Twilio call status callback — logged only."""
    form = await request.form()
    status = form.get("CallStatus", "unknown")
    call_sid = form.get("CallSid", "")
    log.info("twilio_call_status", room=room_name, status=status, call_sid=call_sid)
    return PlainTextResponse(content="OK")
