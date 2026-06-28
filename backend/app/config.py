"""
Pounce — application settings loaded from .env
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── OpenAI ────────────────────────────────────────────────────────────────
    openai_api_key: str
    llm_model: str = "gpt-4.1-mini"

    # ── Twilio ────────────────────────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # ── LiveKit ───────────────────────────────────────────────────────────────
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    livekit_sip_outbound_trunk_id: str = ""
    livekit_agent_name: str = "pounce"

    # ── STT / TTS ─────────────────────────────────────────────────────────────
    deepgram_api_key: str
    cartesia_api_key: str

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str
    secret_key: str

    # ── App ───────────────────────────────────────────────────────────────────
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000"

    # ── Demo ──────────────────────────────────────────────────────────────────
    demo_mode: bool = True
    demo_phone_number: str = ""

    # ── Cal.com ───────────────────────────────────────────────────────────────
    calcom_api_key: str = ""
    calcom_event_type_id: str = ""

    # ── Orange Slice ──────────────────────────────────────────────────────────
    orange_slice_api_key: str = ""

    # ── Deployment ────────────────────────────────────────────────────────────
    webhook_base_url: str = "http://localhost:8000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
