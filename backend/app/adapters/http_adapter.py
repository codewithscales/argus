from typing import Any

import httpx

from app.adapters.base import AdapterError, BaseAdapter, RunInput, RunOutput


class HTTPAdapter(BaseAdapter):
    """
    Config: { "url": str, "method": str, "headers": dict, "timeout_s": int }
    Sends run input as JSON body; expects JSON response.
    Agent is responsible for its own OTel instrumentation.
    """

    @classmethod
    def validate_config(cls, config: dict[str, Any]) -> None:
        if "url" not in config:
            raise ValueError("HTTPAdapter config requires 'url'")

    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        timeout = self.config.get("timeout_s", 60)
        method = self.config.get("method", "POST").upper()
        headers = self.config.get("headers", {})
        payload = {"run_id": run_id, **input.data}

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.request(
                    method=method,
                    url=self.config["url"],
                    json=payload,
                    headers=headers,
                )
            except httpx.ConnectError as exc:
                raise AdapterError(f"Could not connect to agent: {exc}") from exc
            except httpx.TimeoutException as exc:
                raise AdapterError(f"Agent timed out after {timeout}s") from exc

            if response.status_code >= 400:
                raise AdapterError(
                    f"Agent returned {response.status_code}: {response.text[:256]}",
                    status_code=response.status_code,
                )

            try:
                return RunOutput(data=response.json())
            except Exception:
                return RunOutput(data={"raw": response.text})