from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    app_name: str = "Legal Aid API"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"
    log_level: str = "INFO"

    supabase_url: str = ""
    # Prefer current Supabase publishable/secret API keys. Legacy variables remain as fallbacks.
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    mock_storage: bool = True
    dev_auth_bypass: bool = False

    llm_provider: str = "mock"
    llm_model: str = "mock-legal-aid-v1"
    case_extraction_model: str = ""
    legal_explanation_model: str = ""
    document_draft_model: str = ""
    gemini_api_key: str = ""
    fallback_llm_provider: str = ""
    fallback_llm_model: str = ""
    groq_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    llm_timeout_seconds: float = 35
    llm_max_output_tokens: int = 1800
    llm_max_retries: int = 2
    llm_fallback_enabled: bool = True

    # External LLM processing is off unless explicitly enabled for an allowlisted demo user.
    allow_external_llm_for_synthetic: bool = False
    allow_external_llm_for_non_sensitive: bool = True
    synthetic_demo_user_ids: str = ""
    admin_user_ids: str = ""
    # Kept as a separate, stricter opt-in for any future sensitive-data processor.
    allow_external_llm_for_sensitive: bool = False

    embedding_provider: str = "local"
    embedding_model: str = "intfloat/multilingual-e5-small"
    embedding_dimensions: int = 384
    embedding_device: str = "cpu"

    groq_whisper_model: str = "whisper-large-v3-turbo"
    max_audio_bytes: int = 20 * 1024 * 1024
    max_upload_bytes: int = 15 * 1024 * 1024
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60
    request_cache_ttl_seconds: int = 30
    max_request_chars: int = 12000

    @property
    def effective_supabase_publishable_key(self) -> str:
        return self.supabase_publishable_key or self.supabase_anon_key

    @property
    def effective_supabase_secret_key(self) -> str:
        return self.supabase_secret_key or self.supabase_service_role_key

    @property
    def synthetic_demo_user_id_list(self) -> set[str]:
        return {
            item.strip()
            for item in self.synthetic_demo_user_ids.split(",")
            if item.strip()
        }

    @property
    def admin_user_id_list(self) -> set[str]:
        return {item.strip() for item in self.admin_user_ids.split(",") if item.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            item.strip()
            for item in self.cors_origins.split(",")
            if item.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
