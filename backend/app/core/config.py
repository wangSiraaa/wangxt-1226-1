import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://admin:admin123@localhost:5432/stability_study"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "stability-study-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    SAMPLING_REMINDER_HOURS_BEFORE: int = 24

    TEMP_NORMAL_MIN: float = 25.0
    TEMP_NORMAL_MAX: float = 25.0
    HUMIDITY_NORMAL_MIN: float = 60.0
    HUMIDITY_NORMAL_MAX: float = 60.0
    TEMP_TOLERANCE: float = 2.0
    HUMIDITY_TOLERANCE: float = 5.0

    class Config:
        env_file = ".env"
        case_sensitive = True

    @classmethod
    def _apply_target_aliases(cls, values: dict) -> dict:
        temp_target = values.get("TEMP_NORMAL_TARGET")
        if temp_target is not None:
            temp_target = float(temp_target)
            if values.get("TEMP_NORMAL_MIN") is None:
                values["TEMP_NORMAL_MIN"] = temp_target
            if values.get("TEMP_NORMAL_MAX") is None:
                values["TEMP_NORMAL_MAX"] = temp_target

        humidity_target = values.get("HUMIDITY_NORMAL_TARGET")
        if humidity_target is not None:
            humidity_target = float(humidity_target)
            if values.get("HUMIDITY_NORMAL_MIN") is None:
                values["HUMIDITY_NORMAL_MIN"] = humidity_target
            if values.get("HUMIDITY_NORMAL_MAX") is None:
                values["HUMIDITY_NORMAL_MAX"] = humidity_target

        return values

    def __init__(self, **kwargs):
        env_values = {
            "TEMP_NORMAL_TARGET": os.getenv("TEMP_NORMAL_TARGET"),
            "HUMIDITY_NORMAL_TARGET": os.getenv("HUMIDITY_NORMAL_TARGET"),
        }
        merged = {**env_values, **kwargs}
        merged = self._apply_target_aliases(merged)
        super().__init__(**{k: v for k, v in merged.items() if v is not None})


settings = Settings()
