"""Environment configuration loader."""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Jira Configuration
    JIRA_BASE_URL: str
    JIRA_EMAIL: str
    JIRA_API_TOKEN: str
    
    # MongoDB Configuration
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "testing_automation"
    
    # Vertex AI / Gemini Configuration
    GOOGLE_CLOUD_PROJECT: str
    GOOGLE_APPLICATION_CREDENTIALS: str  # Path to service account JSON file
    VERTEX_AI_LOCATION: str = "us-central1"
    GEMINI_MODEL_NAME: str = "gemini-2.5-pro"  # Model name for Vertex AI
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
