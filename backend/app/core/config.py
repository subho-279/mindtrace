from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379"
    ml_facial_url: str = "http://localhost:8001"
    ml_speech_url: str = "http://localhost:8002"
    ml_text_url: str = "http://localhost:8003"
    ml_micro_url: str = "http://localhost:8004"
    secret_key: str = "dev-secret"
    environment: str = "development"
    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
