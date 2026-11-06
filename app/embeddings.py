from functools import lru_cache
from starlette.concurrency import run_in_threadpool
from app.config import get_settings

class EmbeddingProvider:
    dimensions: int
    async def embed_query(self, text: str) -> list[float]:
        raise NotImplementedError
    async def embed_passages(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

class LocalE5EmbeddingProvider(EmbeddingProvider):
    def __init__(self, model_name: str, dimensions: int, device: str):
        self.model_name, self.dimensions, self.device = model_name, dimensions, device
        self._model = None

    def _load(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name, device=self.device)
            actual = self._model.get_sentence_embedding_dimension()
            if actual != self.dimensions:
                raise ValueError(
                    f"Embedding dimension mismatch: configured {self.dimensions}, model returns {actual}. "
                    "Rebuild the pgvector column and re-embed the complete knowledge base."
                )
        return self._model

    def _encode(self, values: list[str]) -> list[list[float]]:
        model = self._load()
        vectors = model.encode(values, normalize_embeddings=True, convert_to_numpy=True)
        return vectors.tolist()

    async def embed_query(self, text: str) -> list[float]:
        vectors = await run_in_threadpool(self._encode, ["query: " + text])
        return vectors[0]

    async def embed_passages(self, texts: list[str]) -> list[list[float]]:
        return await run_in_threadpool(self._encode, ["passage: " + text for text in texts])

@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    settings = get_settings()
    if settings.embedding_provider == "local":
        return LocalE5EmbeddingProvider(
            settings.embedding_model, settings.embedding_dimensions, settings.embedding_device
        )
    raise ValueError(f"Unsupported embedding provider: {settings.embedding_provider}")
