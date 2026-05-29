from typing import Any

from app.adapters.base import AdapterError, BaseAdapter, RunInput, RunOutput


class ClaudeAdapter(BaseAdapter):
    """
    Config: { "model": str, "system_prompt": str, "max_tokens": int }
    Single-turn: sends input["message"] to Claude, returns text response.
    Creates an llm span via argus-sdk (TODO: wire up when argus-sdk is built).
    """

    @classmethod
    def validate_config(cls, config: dict[str, Any]) -> None:
        if "model" not in config:
            raise ValueError("ClaudeAdapter config requires 'model'")

    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        try:
            import anthropic
        except ImportError as exc:
            raise AdapterError("anthropic package is not installed") from exc

        message = input.data.get("message")
        if not message:
            raise AdapterError("ClaudeAdapter input requires 'message' key")

        client = anthropic.AsyncAnthropic()
        try:
            response = await client.messages.create(
                model=self.config["model"],
                system=self.config.get("system_prompt", ""),
                messages=[{"role": "user", "content": message}],
                max_tokens=self.config.get("max_tokens", 1024),
            )
        except anthropic.APIError as exc:
            raise AdapterError(f"Anthropic API error: {exc}") from exc

        return RunOutput(
            data={
                "response": response.content[0].text,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                },
            }
        )