# Argus — Agent Adapter Pattern

## Purpose

The adapter layer decouples "how Argus invokes an agent" from the rest of the system. Each adapter receives a run input, invokes the agent in its native way, and returns a response. Span emission is handled either by the agent itself (OTel path) or by the adapter wrapping the call (SDK path).

---

## Base Interface

```python
# backend/app/adapters/base.py

from abc import ABC, abstractmethod
from typing import Any
from app.models.run import RunInput, RunOutput

class BaseAdapter(ABC):
    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        """
        Invoke the agent. Must:
        - Return a RunOutput on success
        - Raise AdapterError on failure
        - Not swallow exceptions from the agent (let TraceService record them)
        """
        ...

    @classmethod
    @abstractmethod
    def validate_config(cls, config: dict) -> None:
        """Raise ValueError if config is invalid for this adapter type."""
        ...
```

```python
class AdapterError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code
```

---

## Adapters

### HTTPAdapter

Calls an arbitrary HTTP endpoint. Argus wraps the entire call in a root span.

```python
# backend/app/adapters/http_adapter.py

class HTTPAdapter(BaseAdapter):
    """
    Config: { "url": str, "method": str, "headers": dict, "timeout_s": int }
    Input is sent as JSON body. Response JSON is the output.
    """
    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        async with httpx.AsyncClient(timeout=self.config["timeout_s"]) as client:
            response = await client.request(
                method=self.config.get("method", "POST"),
                url=self.config["url"],
                json={"run_id": run_id, **input.data},
                headers=self.config.get("headers", {}),
            )
            if response.status_code >= 400:
                raise AdapterError(response.text, response.status_code)
            return RunOutput(data=response.json())
```

**Trace source:** The agent itself emits spans via OTel (Path A) or argus-sdk (Path B). The HTTP adapter does not create spans — it relies on the agent to instrument itself.

---

### PythonCallableAdapter

Imports and calls a Python function in-process. Used for agents written as pure Python callables.

```python
# backend/app/adapters/python_adapter.py

class PythonCallableAdapter(BaseAdapter):
    """
    Config: { "module": str, "callable": str }
    The callable receives (run_id: str, input: dict) → dict.
    """
    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        module = importlib.import_module(self.config["module"])
        fn = getattr(module, self.config["callable"])
        if asyncio.iscoroutinefunction(fn):
            result = await fn(run_id=run_id, input=input.data)
        else:
            result = await asyncio.to_thread(fn, run_id=run_id, input=input.data)
        return RunOutput(data=result)
```

**Trace source:** The callable is expected to use argus-sdk decorators internally. If it doesn't, the run still records — it just has no spans.

---

### ClaudeAdapter

Wraps an Anthropic SDK call directly. Argus creates spans for each API call.

```python
# backend/app/adapters/claude_adapter.py

class ClaudeAdapter(BaseAdapter):
    """
    Config: { "model": str, "system_prompt": str, "tools": list, "max_tokens": int }
    Single-turn: sends input.message to the model, returns the text response.
    """
    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        client = anthropic.AsyncAnthropic()
        with argus_sdk.span("llm.complete", kind="llm", run_id=run_id) as span:
            response = await client.messages.create(
                model=self.config["model"],
                system=self.config.get("system_prompt", ""),
                messages=[{"role": "user", "content": input.data["message"]}],
                max_tokens=self.config.get("max_tokens", 1024),
            )
            span.set_attributes({
                "llm.model": self.config["model"],
                "llm.input_tokens": response.usage.input_tokens,
                "llm.output_tokens": response.usage.output_tokens,
            })
        return RunOutput(data={"response": response.content[0].text})
```

---

## Adapter Registry

```python
# backend/app/adapters/registry.py

ADAPTER_MAP: dict[str, type[BaseAdapter]] = {
    "http":    HTTPAdapter,
    "python":  PythonCallableAdapter,
    "claude":  ClaudeAdapter,
}

def get_adapter(adapter_type: str, config: dict) -> BaseAdapter:
    cls = ADAPTER_MAP.get(adapter_type)
    if cls is None:
        raise ValueError(f"Unknown adapter type: {adapter_type}")
    cls.validate_config(config)
    return cls(config)
```

---

## Adding a New Adapter

1. Create `backend/app/adapters/my_adapter.py` implementing `BaseAdapter`
2. Add it to `ADAPTER_MAP` in `registry.py`
3. Document its `config` shape in this file
4. Add a test in `backend/tests/adapters/test_my_adapter.py`

No other files need to change.

---

## argus-sdk (Python Package)

The SDK provides span instrumentation for agents using `PythonCallableAdapter` or any Python agent code.

```python
# packages/argus-sdk/argus_sdk/__init__.py

# Decorator — wraps an entire function as a named span
@argus.trace(kind="agent")
async def my_agent(run_id: str, input: dict) -> dict:
    ...

# Context manager — manual sub-span
async with argus.span("tool.search", kind="tool", attributes={"query": q}) as s:
    result = await search(q)
    s.set_attribute("result_count", len(result))
```

The SDK creates OTel spans internally and exports them to `http://localhost:8000/v1/traces` by default (configurable via `ARGUS_ENDPOINT` env var). Run ID is propagated via a `contextvars.ContextVar` so nested spans self-associate without passing `run_id` explicitly after the first decorator.