import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.database import get_db
from app.core.event_bus import event_bus
from app.repositories import run_repo, span_repo

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/runs/{run_id}")
async def run_stream(websocket: WebSocket, run_id: str):
    await websocket.accept()

    async with get_db() as db:
        run = await run_repo.get_by_id(db, run_id)
        if run is None:
            await websocket.send_json({"event": "error", "error": {"message": f"Run '{run_id}' not found"}})
            await websocket.close(code=4004)
            return

        await websocket.send_json({"event": "connected", "run_id": run_id})

        # Backfill spans that arrived before this WS connection
        existing_spans = await span_repo.get_for_run(db, run_id)
        for span in existing_spans:
            event_type = "span_end" if span.end_time else "span_start"
            await websocket.send_json({
                "event": event_type,
                "span": {
                    "span_id": span.span_id,
                    "parent_span_id": span.parent_span_id,
                    "name": span.name,
                    "kind": span.kind,
                    "start_time": span.start_time.isoformat(),
                    "end_time": span.end_time.isoformat() if span.end_time else None,
                    "status_code": span.status_code,
                    "status_message": span.status_message,
                    "attributes": span.attributes,
                    "events": span.events,
                },
            })

    queue = event_bus.subscribe(run_id)
    try:
        while True:
            # Race between incoming WS messages (e.g. cancel) and outgoing events
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(_receive(websocket)),
                    asyncio.create_task(queue.get()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()

            result = done.pop().result()

            if isinstance(result, dict):
                # Outgoing span/run event from the bus
                await websocket.send_json(result)
                if result.get("event") in ("run_end", "error"):
                    break
            elif isinstance(result, str):
                # Incoming client message
                try:
                    msg = json.loads(result)
                    if msg.get("action") == "cancel":
                        async with get_db() as db:
                            from app.services import run_service
                            await run_service.cancel_run(db, run_id)
                except (json.JSONDecodeError, Exception):
                    pass

    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        event_bus.unsubscribe(run_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass


async def _receive(ws: WebSocket) -> str:
    return await ws.receive_text()
