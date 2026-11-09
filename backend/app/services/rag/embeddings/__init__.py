"""
Embedding Layer for Clinical Hospital Copilot & Hybrid RAG.
Supports Gemini Embedding API with MRL (768 dimensions), In-Memory Vector Search, and Offline Fallbacks.
"""
from app.services.rag.embeddings.provider import (
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    MockEmbeddingProvider,
    cosine_similarity,
    get_embedding_provider
)
from app.services.rag.embeddings.vector_store import (
    VectorStore,
    get_vector_store
)

__all__ = [
    "BaseEmbeddingProvider",
    "GeminiEmbeddingProvider",
    "MockEmbeddingProvider",
    "cosine_similarity",
    "get_embedding_provider",
    "VectorStore",
    "get_vector_store"
]
