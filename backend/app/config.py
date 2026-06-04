import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "AppForge AI API"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Gemini Settings
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-pro"
    
    # Enable fallback mock generation if API key is invalid or missing
    ALLOW_MOCK_FALLBACK: bool = True
    # Force mock generation regardless of API key status (useful for development/demos)
    FORCE_MOCK_MODE: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./appforge.db"

    # CORS Settings
    CORS_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Post-processing settings to verify if mock mode should be used
def get_use_mock_mode() -> bool:
    if settings.FORCE_MOCK_MODE:
        return True
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.strip() == "":
        return True
    return False
