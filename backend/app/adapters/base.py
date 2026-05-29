from abc import ABC, abstractmethod
from typing import Any


class AdapterError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class RunInput:
    def __init__(self, data: dict[str, Any]) -> None:
        self.data = data


class RunOutput:
    def __init__(self, data: dict[str, Any]) -> None:
        self.data = data


class BaseAdapter(ABC):
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config

    @abstractmethod
    async def invoke(self, run_id: str, input: RunInput) -> RunOutput:
        ...

    @classmethod
    @abstractmethod
    def validate_config(cls, config: dict[str, Any]) -> None:
        ...