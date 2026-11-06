import asyncio
from typing import Protocol
from groq import AsyncGroq

from app.config import Settings
from app.llm import ProviderError


class SpeechProvider(Protocol):
    async def transcribe(self, audio: bytes, filename: str, content_type: str) -> str: ...


class GroqWhisperProvider:
    name = "groq_whisper"

    def __init__(self, settings: Settings):
        if not settings.groq_api_key:
            raise ProviderError("GROQ_API_KEY is not configured")
        self.timeout = settings.llm_timeout_seconds
        self.max_retries = max(0, settings.llm_max_retries)
        self.client = AsyncGroq(
            api_key=settings.groq_api_key,
            timeout=self.timeout,
            max_retries=0,
        )
        self.model = settings.groq_whisper_model

    async def transcribe(self, audio: bytes, filename: str, content_type: str) -> str:
        last_error: ProviderError | None = None
        for attempt in range(self.max_retries + 1):
            try:
                result = await asyncio.wait_for(
                    self.client.audio.transcriptions.create(
                        file=(filename, audio, content_type),
                        model=self.model,
                        response_format="json",
                    ),
                    timeout=self.timeout,
                )
                transcript = getattr(result, "text", "")
                if not transcript:
                    raise ProviderError("Speech provider returned an empty transcript")
                return transcript
            except asyncio.TimeoutError:
                last_error = ProviderError("Speech transcription timed out", transient=True)
            except ProviderError as exc:
                last_error = exc
            except Exception as exc:
                status = getattr(exc, "status_code", None)
                text = str(exc).lower()
                transient = status in (408, 409, 429, 500, 502, 503, 504) or any(
                    marker in text for marker in ("timeout", "temporarily unavailable", "connection reset", "rate limit")
                )
                last_error = ProviderError("Speech transcription provider failed", transient=transient)
            if not last_error.transient or attempt >= self.max_retries:
                break
            await asyncio.sleep(min(2 ** attempt, 4))
        raise last_error or ProviderError("Speech transcription provider unavailable", transient=True)
