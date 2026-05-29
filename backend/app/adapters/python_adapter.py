import asyncio
import importlib
from typing import Any

from app.adapters.base import AdapterError, BaseAdapter, RunInput, RunOutput


class PythonCallableAdapter(BaseAdapter):
    """
    Config: { "module": str, "callable": str }
    Callable signature: fn(run_id: str, input: dict) -> dict
    Use argus-sdk decorators inside the callable for span emission.
    """

    @classmethod
    def validate_config(cls, config: dict[str, Any]) -> None:
        for key in ("module", "callable"):
            if key not in config:
                raise ValueError(f"PythonCallableAdapter config requires '{key}'")

    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        try:
            module = importlib.import_module(self.config["module"])
        except ImportError as exc:
            raise AdapterError(f"Cannot import module '{self.config['module']}': {exc}") from exc

        fn = getattr(module, self.config["callable"], None)
        if fn is None:
            raise AdapterError(
                f"No callable '{self.config['callable']}' in '{self.config['module']}'"
            )

        try:
            if asyncio.iscoroutinefunction(fn):
                result = await fn(run_id=run_id, input=input.data)
            else:
                result = await asyncio.to_thread(fn, run_id=run_id, input=input.data)
        except AdapterError:
            raise
        except Exception as exc:
            raise AdapterError(f"Agent callable raised: {type(exc).__name__}: {exc}") from exc

        if not isinstance(result, dict):
            result = {"result": result}
        return RunOutput(data=result)