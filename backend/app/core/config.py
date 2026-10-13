import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Maple Intranet"
    # Postgres connection string for asyncpg
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/maple_intranet"
    # Auth & Email Configuration
    AUTH_SECRET: str = "super_secret_temporary_key_for_dev_only"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    RESEND_API_KEY: str | None = None
    RESEND_FROM_EMAIL: str = "Maple Intranet <no-reply@intranet.maplelearningsolutions.com>"
    # Frontend URL for email links; override to production URL in prod .env
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    @property
    def effective_frontend_url(self) -> str:
        url = self.FRONTEND_URL.rstrip("/")
        if self.ENVIRONMENT == "production" and ("localhost" in url or "127.0.0.1" in url):
            # Production fallback to prevent broken localhost email links
            return "https://intranet.maplelearningsolutions.com"
        return url

    GROQ_API_KEY: str | None = None
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    NEWS_API_KEY: str | None = None
    REDIS_URL: str = "redis://localhost:6379/0"
    
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    
    # Celery Configuration
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None
    
    @property
    def get_celery_broker_url(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL
        
    @property
    def get_celery_result_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
