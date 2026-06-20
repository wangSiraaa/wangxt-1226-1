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


settings = Settings()
