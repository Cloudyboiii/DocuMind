from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    GOOGLE_API_KEY: str = ""
    MAX_FILE_SIZE_MB: int = 25
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    GEMINI_MODEL: str = "gemini-3.6-flash"
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    TOP_K_RESULTS: int = 8

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
