from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_path: str = "./argus.db"
    host: str = "0.0.0.0"
    port: int = 8000
    argus_env: str = "development"


settings = Settings()