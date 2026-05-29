import asyncio
from collections import defaultdict


class SpanEventBus:
    """In-process pub/sub for WebSocket fan-out. One queue per subscriber per run."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

    def subscribe(self, run_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers[run_id].append(q)
        return q

    async def publish(self, run_id: str, event: dict) -> None:
        for q in list(self._subscribers.get(run_id, [])):
            await q.put(event)

    def unsubscribe(self, run_id: str, q: asyncio.Queue) -> None:
        subs = self._subscribers.get(run_id, [])
        try:
            subs.remove(q)
        except ValueError:
            pass
        if not subs:
            self._subscribers.pop(run_id, None)

    def has_subscribers(self, run_id: str) -> bool:
        return bool(self._subscribers.get(run_id))


event_bus = SpanEventBus()