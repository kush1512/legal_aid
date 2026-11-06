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
        self.client=AsyncGroq(api_key=settings.groq_api_key)
        self.model=settings.groq_whisper_model

    async def transcribe(self, audio: bytes, filename: str, content_type: str) -> str:
        try:
            result=await self.client.audio.transcriptions.create(
                file=(filename,audio,content_type),
                model=self.model,
                response_format="json"
            )
            text=getattr(result,"text","")
            if not text:
                raise ProviderError("Speech provider returned an empty transcript")
            return text
        except ProviderError:
            raise
        except Exception as exc:
            status=getattr(exc,"status_code",None)
            transient=status in (408,429,500,502,503,504) or "timeout" in str(exc).lower()
            raise ProviderError("Speech transcription provider failed",transient=transient) from exc
