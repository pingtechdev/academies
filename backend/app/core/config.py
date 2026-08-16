from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/academy_backend"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    base_domain: str = "victory.pingtech.dev"
    platform_subdomains: tuple[str, ...] = ("admin", "platform")

    cors_origins: list[str] = ["http://localhost:3000"]

    login_rate_limit_attempts: int = 10
    login_rate_limit_window_seconds: int = 60

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
