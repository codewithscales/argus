from typing import Any

from app.adapters.base import BaseAdapter
from app.adapters.claude_adapter import ClaudeAdapter
from app.adapters.http_adapter import HTTPAdapter
from app.adapters.python_adapter import PythonCallableAdapter

_REGISTRY: dict[str, type[BaseAdapter]] = {
    "http": HTTPAdapter,
    "python": PythonCallableAdapter,
    "claude": ClaudeAdapter,
}


def get_adapter(adapter_type: str, config: dict[str, Any]) -> BaseAdapter:
    cls = _REGISTRY.get(adapter_type)
    if cls is None:
        raise ValueError(f"Unknown adapter type '{adapter_type}'. Valid: {list(_REGISTRY)}")
    cls.validate_config(config)
    return cls(config)